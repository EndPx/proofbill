use near_contract_standards::non_fungible_token::core::{
    NonFungibleTokenCore, NonFungibleTokenResolver,
};
use near_contract_standards::non_fungible_token::enumeration::NonFungibleTokenEnumeration;
use near_contract_standards::non_fungible_token::events::NftMint;
use near_contract_standards::non_fungible_token::metadata::{
    NFT_METADATA_SPEC, NFTContractMetadata, TokenMetadata,
};
use near_contract_standards::non_fungible_token::{NonFungibleToken, Token, TokenId};
use near_sdk::collections::UnorderedMap;
use near_sdk::json_types::{U64, U128};
use near_sdk::{
    AccountId, Gas, NearToken, PanicOnDefault, Promise, PromiseOrValue, assert_one_yocto, env,
    near, require,
};
use std::collections::HashMap;
const PRICE: u128 = 10_000_000_000_000_000_000_000;
const STORAGE: u128 = 30_000_000_000_000_000_000_000;
const SERVICE: &str = "private-extraction-v1";
const MODEL: &str = "Qwen/Qwen3.8-27B";
const POLICY: &str = "near-tee-ecdsa-v1";

#[near(serializers=[json,borsh])]
#[derive(Clone, PartialEq, Debug)]
pub enum PassPhase {
    Available,
    InUse,
    Completed,
    RefundPending,
    Refunded,
    RefundFailed,
}
#[near(serializers=[json,borsh])]
#[derive(Clone, PartialEq, Debug)]
pub enum OrderPhase {
    Reserved,
    Delivered,
    PaymentPending,
    Paid,
    TransferFailed,
    RefundPending,
    Refunded,
    RefundFailed,
}
#[near(serializers=[json,borsh])]
#[derive(Clone)]
pub struct PurchasePass {
    pub token_id: String,
    pub owner_id: AccountId,
    pub seller_id: AccountId,
    pub model_id: String,
    pub price_yocto: U128,
    pub expires_at_ns: U64,
    pub authorization_revision: u32,
    pub agent_id: Option<AccountId>,
    pub phase: PassPhase,
    pub order_id: Option<String>,
    pub storage_credit_yocto: U128,
    pub transfer_pending: bool,
    pub attempt: u32,
    pub refund_receiver: Option<AccountId>,
}
#[near(serializers=[json,borsh])]
#[derive(Clone)]
pub struct PurchaseOrder {
    pub order_id: String,
    pub token_id: String,
    pub buyer_id: AccountId,
    pub agent_id: AccountId,
    pub seller_id: AccountId,
    pub price_yocto: U128,
    pub revision: u32,
    pub request_commitment: String,
    pub response_commitment: Option<String>,
    pub evidence_commitment: Option<String>,
    pub policy_id: Option<String>,
    pub phase: OrderPhase,
    pub attempt: u32,
    pub created_at_ns: U64,
}
// Additional policy storage leaves the original Borsh pass/order layouts readable.
#[near(serializers=[json])]
#[derive(Clone, PartialEq, Debug, Default)]
pub enum PaymentMode {
    #[default]
    Manual,
    Automatic,
}
#[near(serializers=[json])]
pub struct PassView {
    #[serde(flatten)]
    pub pass: PurchasePass,
    pub payment_mode: PaymentMode,
}
#[near(contract_state)]
#[derive(PanicOnDefault)]
pub struct Contract {
    tokens: NonFungibleToken,
    passes: UnorderedMap<String, PurchasePass>,
    orders: UnorderedMap<String, PurchaseOrder>,
    seller: AccountId,
    publisher: AccountId,
    sequence: u64,
}
fn commitment(s: &str) {
    require!(
        s.len() == 64
            && s.bytes()
                .all(|c| c.is_ascii_digit() || (b'a'..=b'f').contains(&c)),
        "INVALID_COMMITMENT"
    );
}
fn event(name: &str, data: near_sdk::serde_json::Value) {
    env::log_str(&format!(
        "EVENT_JSON:{}",
        near_sdk::serde_json::json!({"standard":"proofbill","version":"1.0.0","event":name,"data":[data]})
    ));
}

#[near]
impl Contract {
    #[init]
    pub fn init(seller_id: AccountId, publisher_id: AccountId) -> Self {
        Self {
            tokens: NonFungibleToken::new(
                b"n".to_vec(),
                env::current_account_id(),
                Some(b"m".to_vec()),
                Some(b"e".to_vec()),
                None::<Vec<u8>>,
            ),
            passes: UnorderedMap::new(b"p"),
            orders: UnorderedMap::new(b"o"),
            seller: seller_id,
            publisher: publisher_id,
            sequence: 0,
        }
    }
    pub fn get_config(&self) -> near_sdk::serde_json::Value {
        near_sdk::serde_json::json!({"service_id":SERVICE,"model_id":MODEL,"policy_id":POLICY,"price_yocto":PRICE.to_string(),"storage_budget_yocto":STORAGE.to_string(),"seller_id":self.seller,"publisher_id":self.publisher,"network":"testnet","version":2,"agent_modes":true,"payment_modes":["Manual","Automatic"]})
    }
    #[payable]
    pub fn create_purchase_pass(
        &mut self,
        service_id: String,
        expires_at_ns: U64,
        payment_mode: Option<PaymentMode>,
    ) -> PurchasePass {
        require!(service_id == SERVICE, "UNSUPPORTED_SERVICE");
        let now = env::block_timestamp();
        require!(
            expires_at_ns.0 > now && expires_at_ns.0 <= now + 30 * 24 * 60 * 60 * 1_000_000_000,
            "INVALID_EXPIRY"
        );
        let deposit = env::attached_deposit().as_yoctonear();
        require!(
            deposit >= PRICE + STORAGE,
            "INSUFFICIENT_FUNDING_AND_STORAGE"
        );
        let before = env::storage_usage();
        self.sequence += 1;
        let id = format!("pass-{}", self.sequence);
        let owner = env::predecessor_account_id();
        self.tokens.internal_mint_with_refund(
            id.clone(),
            owner.clone(),
            Some(TokenMetadata {
                title: Some(format!("ProofBill Purchase Pass #{}", self.sequence)),
                description: Some("One private AI service purchase on NEAR testnet".into()),
                copies: Some(1),
                ..Default::default()
            }),
            None,
        );
        let mut p = PurchasePass {
            token_id: id.clone(),
            owner_id: owner.clone(),
            seller_id: self.seller.clone(),
            model_id: MODEL.into(),
            price_yocto: U128(PRICE),
            expires_at_ns,
            authorization_revision: 0,
            agent_id: None,
            phase: PassPhase::Available,
            order_id: None,
            storage_credit_yocto: U128(deposit - PRICE),
            transfer_pending: false,
            attempt: 0,
            refund_receiver: None,
        };
        self.write_payment_mode(&id, &payment_mode.unwrap_or_default());
        self.store_charged(&mut p, before);
        NftMint {
            owner_id: &owner,
            token_ids: &[&id],
            memo: Some("Funded purchase entitlement"),
        }
        .emit();
        event(
            "pass_created",
            near_sdk::serde_json::json!({"token_id":id,"owner_id":owner}),
        );
        p
    }
    #[payable]
    pub fn assign_agent(
        &mut self,
        token_id: String,
        expected_revision: u32,
        agent_id: AccountId,
        payment_mode: Option<PaymentMode>,
    ) -> PurchasePass {
        assert_one_yocto();
        let mut p = self.holder(&token_id, expected_revision);
        self.available(&p);
        let before = env::storage_usage();
        p.agent_id = Some(agent_id);
        if let Some(mode) = payment_mode {
            self.write_payment_mode(&token_id, &mode);
        }
        p.authorization_revision = p
            .authorization_revision
            .checked_add(1)
            .expect("REVISION_OVERFLOW");
        event(
            "pass_authorized",
            near_sdk::serde_json::json!({"token_id":token_id,"owner_id":p.owner_id,"agent_id":p.agent_id,"revision":p.authorization_revision,"payment_mode":self.payment_mode(&token_id)}),
        );
        self.store_charged(&mut p, before);
        p
    }
    pub fn reserve_order(
        &mut self,
        token_id: String,
        expected_revision: u32,
        request_commitment: String,
    ) -> PurchaseOrder {
        commitment(&request_commitment);
        let mut p = self.pass(&token_id);
        self.available(&p);
        require!(
            p.authorization_revision == expected_revision,
            "STALE_REVISION"
        );
        require!(
            p.agent_id.as_ref() == Some(&env::predecessor_account_id()),
            "AGENT_NOT_AUTHORIZED"
        );
        let before = env::storage_usage();
        let id = format!("{}-order", token_id);
        require!(self.orders.get(&id).is_none(), "ORDER_ALREADY_EXISTS");
        let o = PurchaseOrder {
            order_id: id.clone(),
            token_id: token_id.clone(),
            buyer_id: p.owner_id.clone(),
            agent_id: env::predecessor_account_id(),
            seller_id: p.seller_id.clone(),
            price_yocto: p.price_yocto,
            revision: p.authorization_revision,
            request_commitment,
            response_commitment: None,
            evidence_commitment: None,
            policy_id: None,
            phase: OrderPhase::Reserved,
            attempt: 0,
            created_at_ns: U64(env::block_timestamp()),
        };
        p.phase = PassPhase::InUse;
        p.order_id = Some(id.clone());
        self.orders.insert(&id, &o);
        self.store_charged(&mut p, before);
        event(
            "order_reserved",
            near_sdk::serde_json::json!({"order_id":id}),
        );
        o
    }
    pub fn publish_delivery(
        &mut self,
        order_id: String,
        request_commitment: String,
        response_commitment: String,
        evidence_commitment: String,
        model_id: String,
        policy_id: String,
        signature_kind: String,
    ) -> PromiseOrValue<PurchaseOrder> {
        require!(
            env::predecessor_account_id() == self.publisher,
            "PUBLISHER_ONLY"
        );
        commitment(&response_commitment);
        commitment(&evidence_commitment);
        let mut o = self.order(&order_id);
        let mut p = self.pass(&o.token_id);
        require!(
            p.phase == PassPhase::InUse && !p.transfer_pending,
            "PASS_NOT_ACTIVE"
        );
        require!(
            o.phase == OrderPhase::Reserved,
            "DELIVERY_ALREADY_PUBLISHED"
        );
        require!(
            request_commitment == o.request_commitment,
            "REQUEST_MISMATCH"
        );
        require!(
            model_id == p.model_id && policy_id == POLICY && signature_kind == "provider_tee",
            "POLICY_MISMATCH"
        );
        require!(
            p.owner_id == o.buyer_id
                && p.authorization_revision == o.revision
                && p.agent_id.as_ref() == Some(&o.agent_id),
            "ORDER_AUTHORIZATION_MISMATCH"
        );
        let automatic = self.payment_mode(&p.token_id) == PaymentMode::Automatic;
        if automatic {
            require!(env::block_timestamp() < p.expires_at_ns.0, "PASS_EXPIRED");
        }
        let before = env::storage_usage();
        o.response_commitment = Some(response_commitment);
        o.evidence_commitment = Some(evidence_commitment);
        o.policy_id = Some(policy_id);
        o.phase = OrderPhase::Delivered;
        self.orders.insert(&order_id, &o);
        self.store_charged(&mut p, before);
        event(
            "delivery_published",
            near_sdk::serde_json::json!({"order_id":order_id}),
        );
        if automatic {
            PromiseOrValue::Promise(self.start_payment(&p, &mut o))
        } else {
            PromiseOrValue::Value(o)
        }
    }
    #[payable]
    pub fn approve_and_pay(
        &mut self,
        order_id: String,
        expected_delivery_commitment: String,
    ) -> Promise {
        assert_one_yocto();
        let mut o = self.order(&order_id);
        let p = self.pass(&o.token_id);
        require!(
            env::predecessor_account_id() == p.owner_id && p.owner_id == o.buyer_id,
            "HOLDER_ONLY"
        );
        require!(env::block_timestamp() < p.expires_at_ns.0, "PASS_EXPIRED");
        require!(o.phase == OrderPhase::Delivered, "ORDER_NOT_PAYABLE");
        require!(
            o.evidence_commitment.as_ref() == Some(&expected_delivery_commitment),
            "DELIVERY_MISMATCH"
        );
        self.start_payment(&p, &mut o)
    }
    #[payable]
    pub fn retry_failed_payment(
        &mut self,
        order_id: String,
        expected_attempt_nonce: u32,
    ) -> Promise {
        assert_one_yocto();
        let mut o = self.order(&order_id);
        let p = self.pass(&o.token_id);
        require!(
            env::predecessor_account_id() == o.buyer_id && p.owner_id == o.buyer_id,
            "HOLDER_ONLY"
        );
        require!(
            o.phase == OrderPhase::TransferFailed && o.attempt == expected_attempt_nonce,
            "NO_FAILED_ATTEMPT"
        );
        self.start_payment(&p, &mut o)
    }
    #[private]
    pub fn on_payment_result(&mut self, order_id: String, attempt: u32) -> bool {
        let mut o = self.order(&order_id);
        require!(
            o.phase == OrderPhase::PaymentPending && o.attempt == attempt,
            "STALE_CALLBACK"
        );
        let mut p = self.pass(&o.token_id);
        let ok = env::promise_result_checked(0, 32).is_ok();
        if ok {
            o.phase = OrderPhase::Paid;
            p.phase = PassPhase::Completed;
        } else {
            o.phase = OrderPhase::TransferFailed;
        }
        self.orders.insert(&order_id, &o);
        self.passes.insert(&p.token_id, &p);
        self.metadata_event(&p.token_id);
        event(
            if ok {
                "payment_succeeded"
            } else {
                "payment_failed"
            },
            near_sdk::serde_json::json!({"order_id":order_id,"attempt":attempt,"amount_yocto":o.price_yocto}),
        );
        ok
    }
    #[payable]
    pub fn cancel_and_refund(&mut self, token_id: String, expected_revision: u32) -> Promise {
        assert_one_yocto();
        let mut p = self.holder(&token_id, expected_revision);
        require!(!p.transfer_pending, "TRANSFER_PENDING");
        require!(
            p.phase == PassPhase::Available || p.phase == PassPhase::InUse,
            "REFUND_NOT_AVAILABLE"
        );
        if let Some(id) = &p.order_id {
            let o = self.order(id);
            require!(
                matches!(
                    o.phase,
                    OrderPhase::Reserved | OrderPhase::Delivered | OrderPhase::TransferFailed
                ),
                "PAYMENT_IN_FLIGHT_OR_PAID"
            );
        }
        p.refund_receiver = Some(p.owner_id.clone());
        self.start_refund(&mut p)
    }
    #[payable]
    pub fn retry_failed_refund(
        &mut self,
        token_id: String,
        expected_attempt_nonce: u32,
    ) -> Promise {
        assert_one_yocto();
        let mut p = self.pass(&token_id);
        require!(
            p.phase == PassPhase::RefundFailed && p.attempt == expected_attempt_nonce,
            "NO_FAILED_REFUND"
        );
        require!(
            p.refund_receiver.as_ref() == Some(&env::predecessor_account_id()),
            "BENEFICIARY_ONLY"
        );
        self.start_refund(&mut p)
    }
    #[private]
    pub fn on_refund_result(&mut self, token_id: String, attempt: u32) -> bool {
        let mut p = self.pass(&token_id);
        require!(
            p.phase == PassPhase::RefundPending && p.attempt == attempt,
            "STALE_CALLBACK"
        );
        let ok = env::promise_result_checked(0, 32).is_ok();
        p.phase = if ok {
            PassPhase::Refunded
        } else {
            PassPhase::RefundFailed
        };
        if let Some(id) = &p.order_id {
            let mut o = self.order(id);
            o.phase = if ok {
                OrderPhase::Refunded
            } else {
                OrderPhase::RefundFailed
            };
            self.orders.insert(id, &o);
        }
        self.passes.insert(&token_id, &p);
        self.metadata_event(&token_id);
        event(
            if ok {
                "refund_succeeded"
            } else {
                "refund_failed"
            },
            near_sdk::serde_json::json!({"token_id":token_id,"attempt":attempt}),
        );
        ok
    }
    pub fn get_pass(&self, token_id: String) -> Option<PassView> {
        self.passes.get(&token_id).map(|pass| self.pass_view(pass))
    }
    pub fn get_order(&self, order_id: String) -> Option<PurchaseOrder> {
        self.orders.get(&order_id)
    }
    pub fn list_passes(
        &self,
        owner_id: Option<AccountId>,
        from_index: Option<u64>,
        limit: Option<u64>,
    ) -> Vec<PassView> {
        self.passes
            .values()
            .filter(|p| owner_id.as_ref().is_none_or(|a| &p.owner_id == a))
            .skip(from_index.unwrap_or(0) as usize)
            .take(limit.unwrap_or(50).min(100) as usize)
            .map(|p| self.pass_view(p))
            .collect()
    }
    pub fn list_orders(
        &self,
        buyer_id: Option<AccountId>,
        from_index: Option<u64>,
        limit: Option<u64>,
    ) -> Vec<PurchaseOrder> {
        self.orders
            .values()
            .filter(|o| buyer_id.as_ref().is_none_or(|a| &o.buyer_id == a))
            .skip(from_index.unwrap_or(0) as usize)
            .take(limit.unwrap_or(50).min(100) as usize)
            .collect()
    }
    pub fn nft_metadata(&self) -> NFTContractMetadata {
        NFTContractMetadata {
            spec: NFT_METADATA_SPEC.into(),
            name: "ProofBill Purchase Pass".into(),
            symbol: "PBILL".into(),
            icon: None,
            base_uri: None,
            reference: None,
            reference_hash: None,
        }
    }
}
impl Contract {
    fn payment_key(id: &str) -> Vec<u8> {
        [b"pb:payment:".as_slice(), id.as_bytes()].concat()
    }
    fn payment_mode(&self, id: &str) -> PaymentMode {
        match env::storage_read(&Self::payment_key(id)) {
            None => PaymentMode::Manual,
            Some(value) if value == [1] => PaymentMode::Automatic,
            Some(_) => env::panic_str("INVALID_PAYMENT_POLICY"),
        }
    }
    fn write_payment_mode(&self, id: &str, mode: &PaymentMode) {
        let key = Self::payment_key(id);
        match mode {
            PaymentMode::Manual => {
                env::storage_remove(&key);
            }
            PaymentMode::Automatic => {
                env::storage_write(&key, &[1]);
            }
        }
    }
    fn pass_view(&self, pass: PurchasePass) -> PassView {
        PassView {
            payment_mode: self.payment_mode(&pass.token_id),
            pass,
        }
    }
    fn pass(&self, id: &String) -> PurchasePass {
        self.passes.get(id).expect("PASS_NOT_FOUND")
    }
    fn order(&self, id: &String) -> PurchaseOrder {
        self.orders.get(id).expect("ORDER_NOT_FOUND")
    }
    fn holder(&self, id: &String, revision: u32) -> PurchasePass {
        let p = self.pass(id);
        require!(p.owner_id == env::predecessor_account_id(), "HOLDER_ONLY");
        require!(p.authorization_revision == revision, "STALE_REVISION");
        p
    }
    fn available(&self, p: &PurchasePass) {
        require!(
            p.phase == PassPhase::Available && !p.transfer_pending,
            "PASS_NOT_AVAILABLE"
        );
        require!(env::block_timestamp() < p.expires_at_ns.0, "PASS_EXPIRED");
    }
    fn store_charged(&mut self, p: &mut PurchasePass, before: u64) {
        self.passes.insert(&p.token_id, p);
        let cost = u128::from(env::storage_usage().saturating_sub(before))
            * env::storage_byte_cost().as_yoctonear();
        require!(p.storage_credit_yocto.0 >= cost, "STORAGE_CREDIT_EXHAUSTED");
        p.storage_credit_yocto.0 -= cost;
        self.passes.insert(&p.token_id, p);
    }
    fn start_payment(&mut self, p: &PurchasePass, o: &mut PurchaseOrder) -> Promise {
        require!(
            p.phase == PassPhase::InUse && !p.transfer_pending,
            "PASS_LOCKED"
        );
        o.phase = OrderPhase::PaymentPending;
        o.attempt += 1;
        self.orders.insert(&o.order_id, o);
        event(
            "payment_started",
            near_sdk::serde_json::json!({"order_id":o.order_id,"attempt":o.attempt}),
        );
        Promise::new(o.seller_id.clone())
            .transfer(NearToken::from_yoctonear(o.price_yocto.0))
            .then(
                Promise::new(env::current_account_id()).function_call(
                    "on_payment_result",
                    near_sdk::serde_json::to_vec(
                        &near_sdk::serde_json::json!({"order_id":o.order_id,"attempt":o.attempt}),
                    )
                    .unwrap(),
                    NearToken::from_yoctonear(0),
                    Gas::from_tgas(30),
                ),
            )
    }
    fn start_refund(&mut self, p: &mut PurchasePass) -> Promise {
        p.phase = PassPhase::RefundPending;
        p.attempt += 1;
        if let Some(id) = &p.order_id {
            let mut o = self.order(id);
            o.phase = OrderPhase::RefundPending;
            self.orders.insert(id, &o);
        }
        self.passes.insert(&p.token_id, p);
        Promise::new(p.refund_receiver.clone().expect("NO_BENEFICIARY"))
            .transfer(NearToken::from_yoctonear(p.price_yocto.0))
            .then(
                Promise::new(env::current_account_id()).function_call(
                    "on_refund_result",
                    near_sdk::serde_json::to_vec(
                        &near_sdk::serde_json::json!({"token_id":p.token_id,"attempt":p.attempt}),
                    )
                    .unwrap(),
                    NearToken::from_yoctonear(0),
                    Gas::from_tgas(30),
                ),
            )
    }
    fn metadata_event(&self, id: &str) {
        env::log_str(&format!(
            "EVENT_JSON:{}",
            near_sdk::serde_json::json!({"standard":"nep171","version":"1.2.0","event":"nft_metadata_update","data":[{"token_ids":[id]}]})
        ));
    }
    fn transfer_storage_key(id: &str) -> Vec<u8> {
        [b"pb:nft-transfer:".as_slice(), id.as_bytes()].concat()
    }
    fn transfer_reserve(pending: bool) -> u128 {
        (if pending { 1024_u128 } else { 256_u128 }) * env::storage_byte_cost().as_yoctonear()
    }
    fn reconcile_transfer_storage(&mut self, p: &mut PurchasePass, before: u64, release: u128) {
        let after = env::storage_usage();
        let available = p
            .storage_credit_yocto
            .0
            .checked_add(release)
            .expect("STORAGE_CREDIT_OVERFLOW");
        let price = env::storage_byte_cost().as_yoctonear();
        p.storage_credit_yocto = U128(if after >= before {
            let cost = u128::from(after - before)
                .checked_mul(price)
                .expect("STORAGE_COST_OVERFLOW");
            require!(available >= cost, "TRANSFER_STORAGE_REQUIRED");
            available - cost
        } else {
            available
                .checked_add(
                    u128::from(before - after)
                        .checked_mul(price)
                        .expect("STORAGE_COST_OVERFLOW"),
                )
                .expect("STORAGE_CREDIT_OVERFLOW")
        });
        self.passes.insert(&p.token_id, p);
    }
    fn begin_transfer(&mut self, id: &String, receiver: &AccountId, pending: bool) -> PurchasePass {
        let mut p = self.pass(id);
        require!(p.owner_id == env::predecessor_account_id(), "HOLDER_ONLY");
        require!(!p.transfer_pending, "TRANSFER_PENDING");
        require!(
            (p.phase == PassPhase::Available && env::block_timestamp() < p.expires_at_ns.0)
                || p.phase == PassPhase::Completed
                || p.phase == PassPhase::Refunded,
            "ACTIVE_PASS_LOCKED"
        );
        p.agent_id = None;
        if p.phase == PassPhase::Available {
            self.write_payment_mode(id, &PaymentMode::Manual);
        }
        p.authorization_revision = p
            .authorization_revision
            .checked_add(1)
            .expect("REVISION_OVERFLOW");
        p.owner_id = receiver.clone();
        p.transfer_pending = pending;
        let cost = Self::transfer_reserve(pending);
        require!(
            p.storage_credit_yocto.0 >= cost,
            "TRANSFER_STORAGE_REQUIRED"
        );
        p.storage_credit_yocto.0 -= cost;
        self.passes.insert(id, &p);
        p
    }
}
#[near]
impl NonFungibleTokenCore for Contract {
    #[payable]
    fn nft_transfer(
        &mut self,
        receiver_id: AccountId,
        token_id: TokenId,
        approval_id: Option<u64>,
        memo: Option<String>,
    ) {
        let before = env::storage_usage();
        let mut p = self.begin_transfer(&token_id, &receiver_id, false);
        self.tokens
            .nft_transfer(receiver_id, token_id.clone(), approval_id, memo);
        let cost = u128::from(env::storage_usage().saturating_sub(before))
            * env::storage_byte_cost().as_yoctonear();
        require!(
            cost <= 256 * env::storage_byte_cost().as_yoctonear(),
            "TRANSFER_STORAGE_LIMIT"
        );
        p.storage_credit_yocto.0 += 256 * env::storage_byte_cost().as_yoctonear() - cost;
        self.passes.insert(&token_id, &p);
    }
    #[payable]
    fn nft_transfer_call(
        &mut self,
        receiver_id: AccountId,
        token_id: TokenId,
        approval_id: Option<u64>,
        memo: Option<String>,
        msg: String,
    ) -> PromiseOrValue<bool> {
        require!(msg.len() <= 4096, "MESSAGE_TOO_LARGE");
        require!(env::prepaid_gas().as_tgas() >= 100, "TRANSFER_GAS_REQUIRED");
        let previous_owner_id = self.pass(&token_id).owner_id;
        let before = env::storage_usage();
        let mut pass = self.begin_transfer(&token_id, &receiver_id, true);
        self.tokens
            .nft_transfer(receiver_id.clone(), token_id.clone(), approval_id, memo);
        env::storage_write(
            &Self::transfer_storage_key(&token_id),
            &Self::transfer_reserve(true).to_le_bytes(),
        );
        // Charge this receipt only. Unrelated calls may change global storage before resolution.
        self.reconcile_transfer_storage(&mut pass, before, 0);
        let args = near_sdk::serde_json::json!({"sender_id":env::predecessor_account_id(),"previous_owner_id":previous_owner_id,"token_id":token_id,"msg":msg});
        let resolve = near_sdk::serde_json::json!({"previous_owner_id":previous_owner_id,"receiver_id":receiver_id,"token_id":token_id,"approved_account_ids":null});
        PromiseOrValue::Promise(
            Promise::new(receiver_id)
                .function_call(
                    "nft_on_transfer",
                    near_sdk::serde_json::to_vec(&args).unwrap(),
                    NearToken::from_yoctonear(0),
                    Gas::from_tgas(40),
                )
                .then(Promise::new(env::current_account_id()).function_call(
                    "nft_resolve_transfer",
                    near_sdk::serde_json::to_vec(&resolve).unwrap(),
                    NearToken::from_yoctonear(0),
                    Gas::from_tgas(30),
                )),
        )
    }
    fn nft_token(&self, token_id: TokenId) -> Option<Token> {
        self.tokens.nft_token(token_id.clone()).map(|mut t| {
            if let Some(ref mut m) = t.metadata {
                m.extra = Some(
                    near_sdk::serde_json::to_string(&self.pass_view(self.pass(&token_id))).unwrap(),
                );
            }
            t
        })
    }
}
#[near]
impl NonFungibleTokenResolver for Contract {
    #[private]
    fn nft_resolve_transfer(
        &mut self,
        previous_owner_id: AccountId,
        receiver_id: AccountId,
        token_id: TokenId,
        approved_account_ids: Option<HashMap<AccountId, u64>>,
    ) -> bool {
        require!(self.pass(&token_id).transfer_pending, "NO_PENDING_TRANSFER");
        let before = env::storage_usage();
        let key = Self::transfer_storage_key(&token_id);
        let reserved = env::storage_read(&key).map(|bytes| {
            u128::from_le_bytes(bytes.try_into().expect("INVALID_TRANSFER_STORAGE_RECORD"))
        });
        let result = self.tokens.nft_resolve_transfer(
            previous_owner_id,
            receiver_id,
            token_id.clone(),
            approved_account_ids,
        );
        let mut p = self.pass(&token_id);
        p.owner_id = self
            .tokens
            .owner_by_id
            .get(&token_id)
            .expect("TOKEN_MISSING");
        p.transfer_pending = false;
        self.passes.insert(&token_id, &p);
        if let Some(reserved) = reserved {
            env::storage_remove(&key);
            self.reconcile_transfer_storage(&mut p, before, reserved);
        }
        // An already-pending legacy transfer has no marker; finish it without guessing a refund.
        result
    }
}
#[near]
impl NonFungibleTokenEnumeration for Contract {
    fn nft_total_supply(&self) -> U128 {
        self.tokens.nft_total_supply()
    }
    fn nft_tokens(&self, from_index: Option<U128>, limit: Option<u64>) -> Vec<Token> {
        self.tokens
            .nft_tokens(from_index, limit)
            .into_iter()
            .filter_map(|t| self.nft_token(t.token_id))
            .collect()
    }
    fn nft_supply_for_owner(&self, account_id: AccountId) -> U128 {
        self.tokens.nft_supply_for_owner(account_id)
    }
    fn nft_tokens_for_owner(
        &self,
        account_id: AccountId,
        from_index: Option<U128>,
        limit: Option<u64>,
    ) -> Vec<Token> {
        self.tokens
            .nft_tokens_for_owner(account_id, from_index, limit)
            .into_iter()
            .filter_map(|t| self.nft_token(t.token_id))
            .collect()
    }
}
#[cfg(test)]
mod tests {
    use super::*;
    use near_sdk::{test_utils::VMContextBuilder, testing_env};
    fn ctx(who: &str, deposit: u128) {
        let mut b = VMContextBuilder::new();
        b.current_account_id("proofbill.testnet".parse().unwrap())
            .predecessor_account_id(who.parse().unwrap())
            .attached_deposit(NearToken::from_yoctonear(deposit))
            .account_balance(NearToken::from_near(20))
            .block_timestamp(100);
        testing_env!(b.build());
    }
    fn setup() -> Contract {
        ctx("alice.testnet", PRICE + STORAGE);
        Contract::init(
            "seller.testnet".parse().unwrap(),
            "publisher.testnet".parse().unwrap(),
        )
    }
    #[test]
    fn transfer_moves_entitlement() {
        let mut c = setup();
        c.create_purchase_pass(SERVICE.into(), U64(1_000_000), None);
        ctx("alice.testnet", 1);
        c.assign_agent("pass-1".into(), 0, "agent.testnet".parse().unwrap(), None);
        c.nft_transfer("bob.testnet".parse().unwrap(), "pass-1".into(), None, None);
        let p = c.pass(&"pass-1".into());
        assert_eq!(p.owner_id, "bob.testnet");
        assert!(p.agent_id.is_none());
        assert_eq!(p.price_yocto.0, PRICE);
        assert_eq!(p.authorization_revision, 2);
    }
    #[test]
    #[should_panic(expected = "HOLDER_ONLY")]
    fn old_owner_rejected() {
        let mut c = setup();
        c.create_purchase_pass(SERVICE.into(), U64(1_000_000), None);
        ctx("alice.testnet", 1);
        c.nft_transfer("bob.testnet".parse().unwrap(), "pass-1".into(), None, None);
        c.cancel_and_refund("pass-1".into(), 1);
    }
    #[test]
    #[should_panic(expected = "PASS_NOT_AVAILABLE")]
    fn single_order() {
        let mut c = setup();
        c.create_purchase_pass(SERVICE.into(), U64(1_000_000), None);
        ctx("alice.testnet", 1);
        c.assign_agent("pass-1".into(), 0, "agent.testnet".parse().unwrap(), None);
        ctx("agent.testnet", 0);
        c.reserve_order("pass-1".into(), 1, "a".repeat(64));
        c.reserve_order("pass-1".into(), 1, "b".repeat(64));
    }
    #[test]
    fn legacy_pass_defaults_manual_and_policy_does_not_change_stored_layout() {
        let mut c = setup();
        let p = c.create_purchase_pass(SERVICE.into(), U64(1_000_000), None);
        let original = near_sdk::borsh::to_vec(&p).unwrap();
        assert_eq!(c.payment_mode(&p.token_id), PaymentMode::Manual);
        ctx("alice.testnet", 1);
        c.assign_agent(
            p.token_id.clone(),
            0,
            "custom.testnet".parse().unwrap(),
            Some(PaymentMode::Automatic),
        );
        assert_eq!(c.payment_mode(&p.token_id), PaymentMode::Automatic);
        let restored: PurchasePass = near_sdk::borsh::from_slice(&original).unwrap();
        assert_eq!(restored.owner_id, "alice.testnet");
        c.nft_transfer(
            "bob.testnet".parse().unwrap(),
            p.token_id.clone(),
            None,
            None,
        );
        assert_eq!(c.payment_mode(&p.token_id), PaymentMode::Manual);
        assert!(c.pass(&p.token_id).agent_id.is_none());
    }
    #[test]
    #[should_panic(expected = "HOLDER_ONLY")]
    fn agent_cannot_enable_automatic_payment() {
        let mut c = setup();
        c.create_purchase_pass(SERVICE.into(), U64(1_000_000), None);
        ctx("custom.testnet", 1);
        c.assign_agent(
            "pass-1".into(),
            0,
            "custom.testnet".parse().unwrap(),
            Some(PaymentMode::Automatic),
        );
    }
    #[test]
    fn automatic_delivery_starts_only_the_fixed_seller_payment() {
        let mut c = setup();
        c.create_purchase_pass(SERVICE.into(), U64(1_000_000), Some(PaymentMode::Automatic));
        ctx("alice.testnet", 1);
        c.assign_agent("pass-1".into(), 0, "custom.testnet".parse().unwrap(), None);
        ctx("custom.testnet", 0);
        c.reserve_order("pass-1".into(), 1, "a".repeat(64));
        ctx("publisher.testnet", 0);
        let result = c.publish_delivery(
            "pass-1-order".into(),
            "a".repeat(64),
            "b".repeat(64),
            "c".repeat(64),
            MODEL.into(),
            POLICY.into(),
            "provider_tee".into(),
        );
        assert!(matches!(result, PromiseOrValue::Promise(_)));
        let o = c.order(&"pass-1-order".into());
        assert_eq!(o.phase, OrderPhase::PaymentPending);
        assert_eq!(o.seller_id, "seller.testnet");
        assert_eq!(o.price_yocto.0, PRICE);
        assert_eq!(c.pass(&"pass-1".into()).owner_id, "alice.testnet");
    }
    #[test]
    #[should_panic(expected = "PUBLISHER_ONLY")]
    fn custom_agent_cannot_fabricate_delivery_or_payment() {
        let mut c = setup();
        c.create_purchase_pass(SERVICE.into(), U64(1_000_000), Some(PaymentMode::Automatic));
        ctx("alice.testnet", 1);
        c.assign_agent("pass-1".into(), 0, "custom.testnet".parse().unwrap(), None);
        ctx("custom.testnet", 0);
        c.reserve_order("pass-1".into(), 1, "a".repeat(64));
        c.publish_delivery(
            "pass-1-order".into(),
            "a".repeat(64),
            "b".repeat(64),
            "c".repeat(64),
            MODEL.into(),
            POLICY.into(),
            "provider_tee".into(),
        );
    }
    #[test]
    #[allow(deprecated)]
    fn repeated_async_return_does_not_consume_credit() {
        let mut c = setup();
        c.create_purchase_pass(SERVICE.into(), U64(1_000_000), None);
        let original = c.pass(&"pass-1".into()).storage_credit_yocto;
        for _ in 0..4 {
            ctx("alice.testnet", 1);
            c.nft_transfer_call(
                "returner.testnet".parse().unwrap(),
                "pass-1".into(),
                None,
                None,
                String::new(),
            );
            let mut b = VMContextBuilder::new();
            b.current_account_id("proofbill.testnet".parse().unwrap())
                .predecessor_account_id("proofbill.testnet".parse().unwrap())
                .account_balance(NearToken::from_near(20))
                .block_timestamp(100);
            near_sdk::test_utils::testing_env_with_promise_results(
                b.build(),
                near_sdk::PromiseResult::Successful(b"true".to_vec()),
            );
            c.nft_resolve_transfer(
                "alice.testnet".parse().unwrap(),
                "returner.testnet".parse().unwrap(),
                "pass-1".into(),
                None,
            );
            let p = c.pass(&"pass-1".into());
            assert_eq!(p.owner_id, "alice.testnet");
            assert!(!p.transfer_pending);
            assert_eq!(
                p.storage_credit_yocto, original,
                "unused asynchronous reserve must be returned"
            );
        }
    }
}
