//! Actual Wasm/Sandbox financial and NFT callback checks. Publisher data here is synthetic.
use near_api::{AccountId, NearGas, NearToken};
use near_sdk::serde_json::{Value, json};
const PRICE: u128 = 10_000_000_000_000_000_000_000;

#[tokio::test]
async fn flexible_budget_limits_and_storage_are_independent() -> testresult::TestResult<()> {
    let s = near_sandbox::Sandbox::start_sandbox().await?;
    let net = near_api::NetworkConfig::from_rpc_url("sandbox", s.rpc_addr.parse()?);
    let alice = account(&s, "alice.sandbox").await?;
    let bob = account(&s, "bob.sandbox").await?;
    let seller = account(&s, "seller.sandbox").await?;
    let deployed = account(&s, "flexible.sandbox").await?;
    let contract = deployed.as_contract();
    let signer = near_api::Signer::from_secret_key(
        near_sandbox::config::DEFAULT_GENESIS_ACCOUNT_PRIVATE_KEY.parse()?,
    )?;
    let path = match std::env::var("PROOFBILL_WASM") {
        Ok(p) => std::path::PathBuf::from(p),
        Err(_) => cargo_near_build::build_with_cli(Default::default())?.into(),
    };
    near_api::Contract::deploy(contract.account_id().clone())
        .use_code(std::fs::read(path)?)
        .with_init_call(
            "init",
            json!({"seller_id":seller.account_id(),"publisher_id":alice.account_id()}),
        )?
        .with_signer(signer.clone())
        .send_to(&net)
        .await?
        .assert_success();
    macro_rules! send {
        ($who:expr,$method:expr,$args:expr,$deposit:expr) => {
            contract
                .call_function($method, $args)
                .transaction()
                .deposit(NearToken::from_yoctonear($deposit))
                .gas(NearGas::from_tgas(200))
                .with_signer($who.account_id().clone(), signer.clone())
                .send_to(&net)
                .await?
        };
    }
    macro_rules! read {
        ($method:expr,$args:expr) => {
            contract
                .call_function($method, $args)
                .read_only()
                .fetch_from(&net)
                .await?
                .data
        };
    }
    let amount = 1_234_500_000_000_000_000_000_000_u128;
    let expiry = ((std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)?
        .as_secs()
        + 3600)
        * 1_000_000_000)
        .to_string();
    send!(&alice,"create_flexible_budget_pass",json!({"service_id":"private-extraction-v1","expires_at_ns":expiry,"payment_mode":"Automatic","budget_yocto":amount.to_string(),"max_order_price_yocto":(PRICE-1).to_string()}),amount+3*PRICE).assert_success();
    send!(
        &alice,
        "assign_agent",
        json!({"token_id":"pass-1","expected_revision":0,"agent_id":bob.account_id()}),
        1
    )
    .assert_success();
    let denied = send!(
        &bob,
        "reserve_order",
        json!({"token_id":"pass-1","expected_revision":1,"request_commitment":"a".repeat(64)}),
        0
    );
    assert!(!denied.is_success());
    assert!(format!("{denied:?}").contains("ORDER_PRICE_LIMIT_EXCEEDED"));
    let denied = send!(
        &bob,
        "configure_budget_agent",
        json!({"token_id":"pass-1","expected_revision":1,"agent_id":bob.account_id(),"max_order_price_yocto":null}),
        1
    );
    assert!(!denied.is_success());
    assert!(format!("{denied:?}").contains("HOLDER_ONLY"));
    for number in 1..=3 {
        let p: Value = read!("get_pass", json!({"token_id":"pass-1"}));
        send!(&alice,"configure_budget_agent",json!({"token_id":"pass-1","expected_revision":p["authorization_revision"],"agent_id":bob.account_id(),"payment_mode":"Automatic","max_order_price_yocto":if number<3 {Some((PRICE*10).to_string())}else{None}}),1).assert_success();
        let p: Value = read!("get_pass", json!({"token_id":"pass-1"}));
        let required = p["storage_required_for_order_yocto"]
            .as_str()
            .unwrap()
            .parse::<u128>()?;
        if required > 0 {
            let before = p["budget"].clone();
            send!(
                &alice,
                "top_up_storage",
                json!({"token_id":"pass-1"}),
                required
            )
            .assert_success();
            let after: Value = read!("get_pass", json!({"token_id":"pass-1"}));
            assert_eq!(after["budget"], before);
        }
        let p: Value = read!("get_pass", json!({"token_id":"pass-1"}));
        send!(&bob,"reserve_order",json!({"token_id":"pass-1","expected_revision":p["authorization_revision"],"request_commitment":"a".repeat(64)}),0).assert_success();
        let id = format!("pass-1-order-{number}");
        send!(&alice,"publish_delivery",json!({"order_id":id,"request_commitment":"a".repeat(64),"response_commitment":"b".repeat(64),"evidence_commitment":"c".repeat(64),"model_id":"Qwen/Qwen3.8-27B","policy_id":"near-tee-ecdsa-v1","signature_kind":"provider_tee"}),0).assert_success();
        let o: Value = read!("get_order", json!({"order_id":id}));
        assert_eq!(o["phase"], "Paid");
        assert_eq!(
            o["max_order_price_yocto"],
            if number < 3 {
                json!((PRICE * 10).to_string())
            } else {
                Value::Null
            }
        );
        let p: Value = read!("get_pass", json!({"token_id":"pass-1"}));
        assert_eq!(p["budget"]["spent_yocto"], (number * PRICE).to_string());
        assert_eq!(
            p["budget"]["available_yocto"],
            (amount - number * PRICE).to_string()
        );
    }
    let p: Value = read!("get_pass", json!({"token_id":"pass-1"}));
    send!(
        &alice,
        "cancel_and_refund",
        json!({"token_id":"pass-1","expected_revision":p["authorization_revision"]}),
        1
    )
    .assert_success();
    let p: Value = read!("get_pass", json!({"token_id":"pass-1"}));
    assert_eq!(
        p["budget"]["refunded_yocto"],
        (amount - 3 * PRICE).to_string()
    );
    let first: Value = read!("get_order", json!({"order_id":"pass-1-order-1"}));
    assert_eq!(first["max_order_price_yocto"], (PRICE * 10).to_string());
    Ok(())
}

#[tokio::test]
async fn reusable_budget_purchases_handover_and_remaining_refund() -> testresult::TestResult<()> {
    let s = near_sandbox::Sandbox::start_sandbox().await?;
    let net = near_api::NetworkConfig::from_rpc_url("sandbox", s.rpc_addr.parse()?);
    let alice = account(&s, "alice.sandbox").await?;
    let bob = account(&s, "bob.sandbox").await?;
    let seller = account(&s, "seller.sandbox").await?;
    let deployed = account(&s, "budget.sandbox").await?;
    let contract = deployed.as_contract();
    let signer = near_api::Signer::from_secret_key(
        near_sandbox::config::DEFAULT_GENESIS_ACCOUNT_PRIVATE_KEY.parse()?,
    )?;
    let path = match std::env::var("PROOFBILL_WASM") {
        Ok(p) => std::path::PathBuf::from(p),
        Err(_) => cargo_near_build::build_with_cli(Default::default())?.into(),
    };
    near_api::Contract::deploy(contract.account_id().clone())
        .use_code(std::fs::read(path)?)
        .with_init_call(
            "init",
            json!({"seller_id":seller.account_id(),"publisher_id":alice.account_id()}),
        )?
        .with_signer(signer.clone())
        .send_to(&net)
        .await?
        .assert_success();
    macro_rules! send {
        ($who:expr,$method:expr,$args:expr,$deposit:expr) => {
            contract
                .call_function($method, $args)
                .transaction()
                .deposit(NearToken::from_yoctonear($deposit))
                .gas(NearGas::from_tgas(200))
                .with_signer($who.account_id().clone(), signer.clone())
                .send_to(&net)
                .await?
        };
    }
    macro_rules! read {
        ($method:expr,$args:expr) => {
            contract
                .call_function($method, $args)
                .read_only()
                .fetch_from(&net)
                .await?
                .data
        };
    }
    let expiry = ((std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)?
        .as_secs()
        + 3600)
        * 1_000_000_000)
        .to_string();
    send!(&alice,"create_budget_pass",json!({"service_id":"private-extraction-v1","expires_at_ns":expiry,"payment_mode":"Automatic","budget_yocto":(4*PRICE).to_string()}), 11*PRICE).assert_success();
    send!(
        &alice,
        "assign_agent",
        json!({"token_id":"pass-1","expected_revision":0,"agent_id":bob.account_id()}),
        1
    )
    .assert_success();
    for number in 1..=3 {
        let pass: Value = read!("get_pass", json!({"token_id":"pass-1"}));
        let revision = pass["authorization_revision"].as_u64().unwrap();
        if number == 3 {
            send!(
                &alice,
                "nft_transfer",
                json!({"token_id":"pass-1","receiver_id":bob.account_id()}),
                1
            )
            .assert_success();
            let transferred: Value = read!("get_pass", json!({"token_id":"pass-1"}));
            assert_eq!(transferred["payment_mode"], "Manual");
            assert!(transferred["agent_id"].is_null());
            assert_eq!(
                transferred["budget"]["available_yocto"],
                (2 * PRICE).to_string()
            );
            let denied = send!(
                &alice,
                "cancel_and_refund",
                json!({"token_id":"pass-1","expected_revision":transferred["authorization_revision"]}),
                1
            );
            assert!(!denied.is_success());
            assert!(format!("{denied:?}").contains("HOLDER_ONLY"));
            send!(&bob,"assign_agent",json!({"token_id":"pass-1","expected_revision":transferred["authorization_revision"],"agent_id":alice.account_id(),"payment_mode":"Manual"}),1).assert_success();
        }
        let pass: Value = read!("get_pass", json!({"token_id":"pass-1"}));
        let revision = if number == 3 {
            pass["authorization_revision"].as_u64().unwrap()
        } else {
            revision
        };
        let agent = if number == 3 { &alice } else { &bob };
        let id = format!("pass-1-order-{number}");
        send!(agent,"reserve_order",json!({"token_id":"pass-1","expected_revision":revision,"request_commitment":"a".repeat(64)}),0).assert_success();
        let denied = send!(
            agent,
            "reserve_order",
            json!({"token_id":"pass-1","expected_revision":revision,"request_commitment":"d".repeat(64)}),
            0
        );
        assert!(!denied.is_success());
        send!(&alice,"publish_delivery",json!({"order_id":id,"request_commitment":"a".repeat(64),"response_commitment":"b".repeat(64),"evidence_commitment":"c".repeat(64),"model_id":"Qwen/Qwen3.8-27B","policy_id":"near-tee-ecdsa-v1","signature_kind":"provider_tee"}),0).assert_success();
        if number == 3 {
            let before: Value = read!("get_order", json!({"order_id":id}));
            assert_eq!(before["phase"], "Delivered");
            send!(
                &bob,
                "approve_and_pay",
                json!({"order_id":id,"expected_delivery_commitment":"c".repeat(64)}),
                1
            )
            .assert_success();
        }
        let order: Value = read!("get_order", json!({"order_id":id}));
        assert_eq!(order["phase"], "Paid");
        assert_eq!(order["price_yocto"], PRICE.to_string());
        let pass: Value = read!("get_pass", json!({"token_id":"pass-1"}));
        assert_eq!(pass["phase"], "Available");
        assert_eq!(pass["budget"]["spent_yocto"], (number * PRICE).to_string());
        assert_eq!(
            pass["budget"]["available_yocto"],
            ((4 - number) * PRICE).to_string()
        );
        assert_eq!(pass["budget"]["reserved_yocto"], "0");
    }
    let pass: Value = read!("get_pass", json!({"token_id":"pass-1"}));
    send!(
        &bob,
        "cancel_and_refund",
        json!({"token_id":"pass-1","expected_revision":pass["authorization_revision"]}),
        1
    )
    .assert_success();
    let pass: Value = read!("get_pass", json!({"token_id":"pass-1"}));
    assert_eq!(pass["phase"], "Refunded");
    assert_eq!(pass["refund_receiver"], "bob.sandbox");
    assert_eq!(pass["budget"]["refunded_yocto"], PRICE.to_string());
    assert_eq!(pass["budget"]["spent_yocto"], (3 * PRICE).to_string());
    for number in 1..=3 {
        let order: Value = read!(
            "get_order",
            json!({"order_id":format!("pass-1-order-{number}")})
        );
        assert_eq!(order["phase"], "Paid");
        assert_eq!(
            order["payment_mode"],
            if number == 3 { "Manual" } else { "Automatic" }
        );
    }
    Ok(())
}
async fn account(
    s: &near_sandbox::Sandbox,
    name: &str,
) -> testresult::TestResult<near_api::Account> {
    let id: AccountId = name.parse()?;
    s.create_account(id.as_str().parse()?)
        .initial_balance(NearToken::from_near(10))
        .send()
        .await?;
    Ok(near_api::Account(id))
}

#[tokio::test]
async fn purchase_rights_callbacks_and_refund() -> testresult::TestResult<()> {
    let s = near_sandbox::Sandbox::start_sandbox().await?;
    let net = near_api::NetworkConfig::from_rpc_url("sandbox", s.rpc_addr.parse()?);
    let alice = account(&s, "alice.sandbox").await?;
    let bob = account(&s, "bob.sandbox").await?;
    let keeper = account(&s, "keeper.sandbox").await?;
    let returner = account(&s, "returner.sandbox").await?;
    let deployed = account(&s, "proofbill.sandbox").await?;
    let contract = deployed.as_contract();
    let signer = near_api::Signer::from_secret_key(
        near_sandbox::config::DEFAULT_GENESIS_ACCOUNT_PRIVATE_KEY.parse()?,
    )?;
    let path = match std::env::var("PROOFBILL_WASM") {
        Ok(p) => std::path::PathBuf::from(p),
        Err(_) => cargo_near_build::build_with_cli(Default::default())?.into(),
    };
    near_api::Contract::deploy(contract.account_id().clone())
        .use_code(std::fs::read(path)?)
        .with_init_call(
            "init",
            json!({"seller_id":"missing.sandbox","publisher_id":alice.account_id()}),
        )?
        .with_signer(signer.clone())
        .send_to(&net)
        .await?
        .assert_success();
    for (who, value) in [(&keeper, "false"), (&returner, "true")] {
        let wasm = wat::parse_str(format!(
            r#"(module (import "env" "value_return" (func $return (param i64 i64))) (memory (export "memory") 1) (data (i32.const 0) "{}") (func (export "nft_on_transfer") i64.const {} i64.const 0 call $return))"#,
            value,
            value.len()
        ))?;
        near_api::Contract::deploy(who.account_id().clone())
            .use_code(wasm)
            .with_init_call("nft_on_transfer", json!({}))?
            .with_signer(signer.clone())
            .send_to(&net)
            .await?
            .assert_success();
    }
    macro_rules! send {
        ($who:expr,$method:expr,$args:expr,$deposit:expr) => {
            contract
                .call_function($method, $args)
                .transaction()
                .deposit(NearToken::from_yoctonear($deposit))
                .gas(NearGas::from_tgas(200))
                .with_signer($who.account_id().clone(), signer.clone())
                .send_to(&net)
                .await?
        };
    }
    macro_rules! read {
        ($method:expr,$args:expr) => {
            contract
                .call_function($method, $args)
                .read_only()
                .fetch_from(&net)
                .await?
                .data
        };
    }
    let expiry = ((std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)?
        .as_secs()
        + 3600)
        * 1_000_000_000)
        .to_string();
    // Each independent receiver case gets a fresh storage-funded entitlement.
    for (index, (receiver, expected)) in [
        (&returner, alice.account_id()),
        (&keeper, keeper.account_id()),
        (&bob, alice.account_id()),
    ]
    .into_iter()
    .enumerate()
    {
        send!(
            &alice,
            "create_purchase_pass",
            json!({"service_id":"private-extraction-v1","expires_at_ns":expiry}),
            PRICE + 30_000_000_000_000_000_000_000
        )
        .assert_success();
        let token = format!("pass-{}", index + 1);
        let _out = send!(
            &alice,
            "nft_transfer_call",
            json!({"token_id":token,"receiver_id":receiver.account_id(),"approval_id":null,"memo":null,"msg":""}),
            1
        );
        let p: Value = read!("get_pass", json!({"token_id":token}));
        assert_eq!(p["owner_id"].as_str(), Some(expected.as_str()));
        assert_eq!(p["transfer_pending"], false);
        assert_eq!(p["price_yocto"], PRICE.to_string());
        let owner = if expected == keeper.account_id() {
            &keeper
        } else {
            &alice
        };
        send!(
            owner,
            "cancel_and_refund",
            json!({"token_id":token,"expected_revision":p["authorization_revision"]}),
            1
        )
        .assert_success();
        let p: Value = read!("get_pass", json!({"token_id":token}));
        assert_eq!(p["phase"], "Refunded");
    }
    send!(
        &alice,
        "create_purchase_pass",
        json!({"service_id":"private-extraction-v1","expires_at_ns":expiry}),
        PRICE + 30_000_000_000_000_000_000_000
    )
    .assert_success();
    let token = "pass-4";
    let order = format!("{token}-order");
    send!(
        &alice,
        "nft_transfer",
        json!({"token_id":token,"receiver_id":bob.account_id(),"approval_id":null,"memo":null}),
        1
    )
    .assert_success();
    send!(
        &alice,
        "cancel_and_refund",
        json!({"token_id":token,"expected_revision":1}),
        1
    )
    .assert_failure();
    send!(
        &bob,
        "assign_agent",
        json!({"token_id":token,"expected_revision":1,"agent_id":bob.account_id()}),
        1
    )
    .assert_success();
    send!(
        &bob,
        "reserve_order",
        json!({"token_id":token,"expected_revision":2,"request_commitment":"a".repeat(64)}),
        0
    )
    .assert_success();
    send!(&alice,"publish_delivery",json!({"order_id":order,"request_commitment":"a".repeat(64),"response_commitment":"b".repeat(64),"evidence_commitment":"c".repeat(64),"model_id":"Qwen/Qwen3.8-27B","policy_id":"near-tee-ecdsa-v1","signature_kind":"provider_tee"}),0).assert_success();
    let _failed_transfer = send!(
        &bob,
        "approve_and_pay",
        json!({"order_id":order,"expected_delivery_commitment":"c".repeat(64)}),
        1
    );
    let o: Value = read!("get_order", json!({"order_id":order}));
    assert_eq!(o["phase"], "TransferFailed");
    send!(
        &bob,
        "cancel_and_refund",
        json!({"token_id":token,"expected_revision":2}),
        1
    )
    .assert_success();
    let o: Value = read!("get_order", json!({"order_id":order}));
    assert_eq!(o["phase"], "Refunded");
    send!(
        &bob,
        "retry_failed_payment",
        json!({"order_id":order,"expected_attempt_nonce":1}),
        1
    )
    .assert_failure();

    // Manual default, custom signer restrictions, automatic failed transfer and refund exit.
    for (mode, expected_phase) in [("Manual", "Delivered"), ("Automatic", "TransferFailed")] {
        send!(&bob,"create_purchase_pass",json!({"service_id":"private-extraction-v1","expires_at_ns":expiry,"payment_mode":mode}),PRICE+30_000_000_000_000_000_000_000).assert_success();
        let token = if mode == "Manual" { "pass-5" } else { "pass-6" };
        let order = format!("{token}-order");
        send!(&alice,"assign_agent",json!({"token_id":token,"expected_revision":0,"agent_id":alice.account_id(),"payment_mode":"Automatic"}),1).assert_failure();
        send!(&bob,"assign_agent",json!({"token_id":token,"expected_revision":0,"agent_id":alice.account_id(),"payment_mode":mode}),1).assert_success();
        send!(
            &bob,
            "reserve_order",
            json!({"token_id":token,"expected_revision":1,"request_commitment":"a".repeat(64)}),
            0
        )
        .assert_failure();
        send!(
            &alice,
            "reserve_order",
            json!({"token_id":token,"expected_revision":1,"request_commitment":"a".repeat(64)}),
            0
        )
        .assert_success();
        send!(&bob,"assign_agent",json!({"token_id":token,"expected_revision":1,"agent_id":bob.account_id(),"payment_mode":"Automatic"}),1).assert_failure();
        send!(
            &bob,
            "nft_transfer",
            json!({"token_id":token,"receiver_id":alice.account_id()}),
            1
        )
        .assert_failure();
        send!(&bob,"publish_delivery",json!({"order_id":order,"request_commitment":"a".repeat(64),"response_commitment":"b".repeat(64),"evidence_commitment":"c".repeat(64),"model_id":"Qwen/Qwen3.8-27B","policy_id":"near-tee-ecdsa-v1","signature_kind":"provider_tee"}),0).assert_failure();
        send!(&alice,"publish_delivery",json!({"order_id":order,"request_commitment":"d".repeat(64),"response_commitment":"b".repeat(64),"evidence_commitment":"c".repeat(64),"model_id":"Qwen/Qwen3.8-27B","policy_id":"near-tee-ecdsa-v1","signature_kind":"provider_tee"}),0).assert_failure();
        // Seller is deliberately missing: automatic payout must end TransferFailed, never Paid.
        let _delivery = send!(
            &alice,
            "publish_delivery",
            json!({"order_id":order,"request_commitment":"a".repeat(64),"response_commitment":"b".repeat(64),"evidence_commitment":"c".repeat(64),"model_id":"Qwen/Qwen3.8-27B","policy_id":"near-tee-ecdsa-v1","signature_kind":"provider_tee"}),
            0
        );
        let o: Value = read!("get_order", json!({"order_id":order}));
        assert_eq!(o["phase"], expected_phase);
        let p: Value = read!("get_pass", json!({"token_id":token}));
        assert_eq!(p["owner_id"], bob.account_id().as_str());
        assert_eq!(p["payment_mode"], mode);
        send!(
            &alice,
            "approve_and_pay",
            json!({"order_id":order,"expected_delivery_commitment":"c".repeat(64)}),
            1
        )
        .assert_failure();
        send!(
            &alice,
            "on_payment_result",
            json!({"order_id":order,"attempt":1}),
            0
        )
        .assert_failure();
        send!(
            &bob,
            "cancel_and_refund",
            json!({"token_id":token,"expected_revision":1}),
            1
        )
        .assert_success();
        let refunded: Value = read!("get_order", json!({"order_id":order}));
        assert_eq!(refunded["phase"], "Refunded");
    }
    // A real existing seller demonstrates successful automatic settlement without an owner pay call.
    let deployed2 = account(&s, "autopay.sandbox").await?;
    let contract2 = deployed2.as_contract();
    near_api::Contract::deploy(contract2.account_id().clone())
        .use_code(std::fs::read(match std::env::var("PROOFBILL_WASM") {
            Ok(p) => std::path::PathBuf::from(p),
            Err(_) => cargo_near_build::build_with_cli(Default::default())?.into(),
        })?)
        .with_init_call(
            "init",
            json!({"seller_id":alice.account_id(),"publisher_id":alice.account_id()}),
        )?
        .with_signer(signer.clone())
        .send_to(&net)
        .await?
        .assert_success();
    macro_rules! send2 {
        ($who:expr,$method:expr,$args:expr,$deposit:expr) => {
            contract2
                .call_function($method, $args)
                .transaction()
                .deposit(NearToken::from_yoctonear($deposit))
                .gas(NearGas::from_tgas(200))
                .with_signer($who.account_id().clone(), signer.clone())
                .send_to(&net)
                .await?
        };
    }
    send2!(&bob,"create_purchase_pass",json!({"service_id":"private-extraction-v1","expires_at_ns":expiry,"payment_mode":"Automatic"}),PRICE+30_000_000_000_000_000_000_000).assert_success();
    send2!(
        &bob,
        "assign_agent",
        json!({"token_id":"pass-1","expected_revision":0,"agent_id":alice.account_id()}),
        1
    )
    .assert_success();
    send2!(
        &alice,
        "reserve_order",
        json!({"token_id":"pass-1","expected_revision":1,"request_commitment":"a".repeat(64)}),
        0
    )
    .assert_success();
    let publication = json!({"order_id":"pass-1-order","request_commitment":"a".repeat(64),"response_commitment":"b".repeat(64),"evidence_commitment":"c".repeat(64),"model_id":"Qwen/Qwen3.8-27B","policy_id":"near-tee-ecdsa-v1","signature_kind":"provider_tee"});
    send2!(&alice, "publish_delivery", publication.clone(), 0).assert_success();
    let paid: Value = contract2
        .call_function("get_order", json!({"order_id":"pass-1-order"}))
        .read_only()
        .fetch_from(&net)
        .await?
        .data;
    assert_eq!(paid["phase"], "Paid");
    assert_eq!(paid["attempt"], 1);
    assert_eq!(paid["buyer_id"], bob.account_id().as_str());
    send2!(&alice, "publish_delivery", publication, 0).assert_failure();
    send2!(
        &bob,
        "approve_and_pay",
        json!({"order_id":"pass-1-order","expected_delivery_commitment":"c".repeat(64)}),
        1
    )
    .assert_failure();
    Ok(())
}

#[tokio::test]
async fn repeated_async_storage_credit() -> testresult::TestResult<()> {
    let s = near_sandbox::Sandbox::start_sandbox().await?;
    let net = near_api::NetworkConfig::from_rpc_url("sandbox", s.rpc_addr.parse()?);
    let alice = account(&s, "alice.sandbox").await?;
    let bob = account(&s, "bob.sandbox").await?;
    let returner = account(&s, "returner.sandbox").await?;
    let keeper = account(&s, "keeper.sandbox").await?;
    let deployed = account(&s, "storagecheck.sandbox").await?;
    let contract = deployed.as_contract();
    let signer = near_api::Signer::from_secret_key(
        near_sandbox::config::DEFAULT_GENESIS_ACCOUNT_PRIVATE_KEY.parse()?,
    )?;
    let wasm = std::fs::read(std::env::var("PROOFBILL_WASM")?)?;
    near_api::Contract::deploy(contract.account_id().clone())
        .use_code(wasm)
        .with_init_call(
            "init",
            json!({"seller_id":"missing.sandbox","publisher_id":alice.account_id()}),
        )?
        .with_signer(signer.clone())
        .send_to(&net)
        .await?
        .assert_success();
    for (who, value) in [(&returner, "true"), (&keeper, "false"), (&alice, "false")] {
        let wasm = wat::parse_str(format!(
            r#"(module (import "env" "value_return" (func $return (param i64 i64))) (memory (export "memory") 1) (data (i32.const 0) "{}") (func (export "nft_on_transfer") i64.const {} i64.const 0 call $return))"#,
            value,
            value.len()
        ))?;
        near_api::Contract::deploy(who.account_id().clone())
            .use_code(wasm)
            .with_init_call("nft_on_transfer", json!({}))?
            .with_signer(signer.clone())
            .send_to(&net)
            .await?
            .assert_success();
    }
    macro_rules! send {
        ($who:expr,$method:expr,$args:expr,$deposit:expr) => {
            contract
                .call_function($method, $args)
                .transaction()
                .deposit(NearToken::from_yoctonear($deposit))
                .gas(NearGas::from_tgas(200))
                .with_signer($who.account_id().clone(), signer.clone())
                .send_to(&net)
                .await?
        };
    }
    macro_rules! read {
        ($method:expr,$args:expr) => {
            contract
                .call_function($method, $args)
                .read_only()
                .fetch_from(&net)
                .await?
                .data
        };
    }
    let expiry = ((std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)?
        .as_secs()
        + 3600)
        * 1_000_000_000)
        .to_string();
    send!(
        &alice,
        "create_purchase_pass",
        json!({"service_id":"private-extraction-v1","expires_at_ns":expiry}),
        PRICE + 30_000_000_000_000_000_000_000
    )
    .assert_success();
    let initial: Value = read!("get_pass", json!({"token_id":"pass-1"}));
    let initial_credit = initial["storage_credit_yocto"]
        .as_str()
        .unwrap()
        .parse::<u128>()?;
    // Repeated refusal/failure must not consume a fixed rollback reserve or block the third attempt.
    for receiver in [&returner, &returner, &returner, &bob, &bob, &bob] {
        let before: Value = read!("get_pass", json!({"token_id":"pass-1"}));
        let _out = send!(
            &alice,
            "nft_transfer_call",
            json!({"token_id":"pass-1","receiver_id":receiver.account_id(),"msg":""}),
            1
        );
        let after: Value = read!("get_pass", json!({"token_id":"pass-1"}));
        println!(
            "async return/failure credit: {} -> {}",
            before["storage_credit_yocto"], after["storage_credit_yocto"]
        );
        assert_eq!(
            after["authorization_revision"].as_u64(),
            Some(before["authorization_revision"].as_u64().unwrap() + 1),
            "asynchronous transfer did not complete"
        );
        assert_eq!(after["owner_id"], alice.account_id().as_str());
        assert_eq!(after["transfer_pending"], false);
    }
    let after_returns: Value = read!("get_pass", json!({"token_id":"pass-1"}));
    assert_eq!(
        after_returns["storage_credit_yocto"]
            .as_str()
            .unwrap()
            .parse::<u128>()?,
        initial_credit
    );
    for _ in 0..4 {
        send!(
            &alice,
            "nft_transfer_call",
            json!({"token_id":"pass-1","receiver_id":keeper.account_id(),"msg":""}),
            1
        )
        .assert_success();
        send!(
            &keeper,
            "nft_transfer_call",
            json!({"token_id":"pass-1","receiver_id":alice.account_id(),"msg":""}),
            1
        )
        .assert_success();
    }
    let final_pass: Value = read!("get_pass", json!({"token_id":"pass-1"}));
    assert_eq!(final_pass["owner_id"], alice.account_id().as_str());
    assert_eq!(final_pass["transfer_pending"], false);
    assert_eq!(
        final_pass["storage_credit_yocto"]
            .as_str()
            .unwrap()
            .parse::<u128>()?,
        initial_credit
    );
    // Long account IDs and repeated keep/return paths share the same funded token.
    let longest = account(&s, &"k".repeat(64)).await?;
    let keep_wasm = wat::parse_str(
        r#"(module (import "env" "value_return" (func $return (param i64 i64))) (memory (export "memory") 1) (data (i32.const 0) "false") (func (export "nft_on_transfer") i64.const 5 i64.const 0 call $return))"#,
    )?;
    near_api::Contract::deploy(longest.account_id().clone())
        .use_code(keep_wasm)
        .with_init_call("nft_on_transfer", json!({}))?
        .with_signer(signer.clone())
        .send_to(&net)
        .await?
        .assert_success();
    for _ in 0..2 {
        send!(
            &alice,
            "nft_transfer_call",
            json!({"token_id":"pass-1","receiver_id":longest.account_id(),"msg":""}),
            1
        )
        .assert_success();
        send!(
            &longest,
            "nft_transfer_call",
            json!({"token_id":"pass-1","receiver_id":alice.account_id(),"msg":""}),
            1
        )
        .assert_success();
    }
    let before_interleave: Value = read!("get_pass", json!({"token_id":"pass-1"}));
    assert_eq!(
        before_interleave["storage_credit_yocto"]
            .as_str()
            .unwrap()
            .parse::<u128>()?,
        initial_credit
    );
    // The receiver mints another funded NFT before resolving this transfer. Charging a global
    // before/after across receipts would wrongly charge that mint to the transferred pass.
    let interleaver = account(&s, "interleaver.sandbox").await?;
    let encode = |bytes: &[u8]| {
        bytes
            .iter()
            .map(|b| format!("\\{:02x}", b))
            .collect::<String>()
    };
    let root_name = contract.account_id().as_str();
    let method = "create_purchase_pass";
    let args = near_sdk::serde_json::to_string(
        &json!({"service_id":"private-extraction-v1","expires_at_ns":expiry}),
    )?;
    let deposit = (PRICE + 30_000_000_000_000_000_000_000).to_le_bytes();
    let reentrant = wat::parse_str(format!(
        r#"(module
      (import "env" "promise_batch_create" (func $create (param i64 i64) (result i64)))
      (import "env" "promise_batch_action_function_call" (func $call (param i64 i64 i64 i64 i64 i64 i64)))
      (import "env" "promise_return" (func $return (param i64)))
      (memory (export "memory") 1)
      (data (i32.const 0) "{}") (data (i32.const 128) "{}")
      (data (i32.const 256) "{}") (data (i32.const 1024) "{}")
      (func (export "nft_on_transfer") (local $p i64)
        i64.const {} i64.const 0 call $create local.set $p
        local.get $p i64.const {} i64.const 128 i64.const {} i64.const 256 i64.const 1024 i64.const 20000000000000 call $call
        local.get $p call $return))"#,
        encode(root_name.as_bytes()),
        encode(method.as_bytes()),
        encode(args.as_bytes()),
        encode(&deposit),
        root_name.len(),
        method.len(),
        args.len()
    ))?;
    near_api::Contract::deploy(interleaver.account_id().clone())
        .use_code(reentrant)
        .without_init_call()
        .with_signer(signer.clone())
        .send_to(&net)
        .await?
        .assert_success();
    let usage_before = deployed.view().fetch_from(&net).await?.data.storage_usage;
    let _interleaved = send!(
        &alice,
        "nft_transfer_call",
        json!({"token_id":"pass-1","receiver_id":interleaver.account_id(),"msg":""}),
        1
    );
    let usage_after = deployed.view().fetch_from(&net).await?.data.storage_usage;
    let final_pass: Value = read!("get_pass", json!({"token_id":"pass-1"}));
    let minted: Value = read!("get_pass", json!({"token_id":"pass-2"}));
    assert_eq!(final_pass["owner_id"], alice.account_id().as_str());
    assert_eq!(final_pass["transfer_pending"], false);
    assert_eq!(minted["owner_id"], interleaver.account_id().as_str());
    let p1_delta = i128::try_from(initial_credit)?
        - i128::try_from(
            final_pass["storage_credit_yocto"]
                .as_str()
                .unwrap()
                .parse::<u128>()?,
        )?;
    let p2_delta = i128::try_from(30_000_000_000_000_000_000_000_u128)?
        - i128::try_from(
            minted["storage_credit_yocto"]
                .as_str()
                .unwrap()
                .parse::<u128>()?,
        )?;
    assert_eq!(
        p1_delta + p2_delta,
        (i128::from(usage_after) - i128::from(usage_before)) * 10_000_000_000_000_000_000_i128,
        "each receipt must charge its own actual storage change"
    );
    send!(&alice,"assign_agent",json!({"token_id":"pass-1","expected_revision":final_pass["authorization_revision"],"agent_id":bob.account_id()}),1).assert_success();
    let assigned: Value = read!("get_pass", json!({"token_id":"pass-1"}));
    send!(&alice,"assign_agent",json!({"token_id":"pass-1","expected_revision":assigned["authorization_revision"],"agent_id":bob.account_id(),"payment_mode":"Automatic"}),1).assert_success();
    let _returned = send!(
        &alice,
        "nft_transfer_call",
        json!({"token_id":"pass-1","receiver_id":returner.account_id(),"msg":""}),
        1
    );
    let reset: Value = read!("get_pass", json!({"token_id":"pass-1"}));
    assert_eq!(reset["agent_id"], Value::Null);
    assert_eq!(reset["payment_mode"], "Manual");
    assert_eq!(reset["transfer_pending"], false);
    send!(&alice,"assign_agent",json!({"token_id":"pass-1","expected_revision":reset["authorization_revision"],"agent_id":bob.account_id()}),1).assert_success();
    let stable: Value = read!("get_pass", json!({"token_id":"pass-1"}));
    for who in [&alice, &deployed] {
        send!(who,"nft_resolve_transfer",json!({"token_id":"pass-1","previous_owner_id":alice.account_id(),"receiver_id":returner.account_id(),"approved_account_ids":null}),0).assert_failure();
    }
    let unchanged: Value = read!("get_pass", json!({"token_id":"pass-1"}));
    assert_eq!(
        unchanged, stable,
        "a stale/forged resolver must not release credit twice"
    );
    let authorized: Value = read!("get_pass", json!({"token_id":"pass-1"}));
    send!(&bob,"reserve_order",json!({"token_id":"pass-1","expected_revision":authorized["authorization_revision"],"request_commitment":"a".repeat(64)}),0).assert_success();
    send!(
        &alice,
        "cancel_and_refund",
        json!({"token_id":"pass-1","expected_revision":authorized["authorization_revision"]}),
        1
    )
    .assert_success();
    let refunded: Value = read!("get_pass", json!({"token_id":"pass-1"}));
    assert_eq!(refunded["phase"], "Refunded");
    Ok(())
}
