//! Actual Wasm/Sandbox financial and NFT callback checks. Publisher data here is synthetic.
use near_api::{AccountId, NearGas, NearToken};
use near_sdk::serde_json::{Value, json};
const PRICE: u128 = 10_000_000_000_000_000_000_000;
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
