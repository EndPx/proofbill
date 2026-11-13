import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowUpRight,
  LockKeyhole,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { loadPublicReceipt } from "@proofbill/server/receipts";
import {
  formatReceiptNear,
  humanPhase,
  type OrderPhase,
  type PublicReceipt,
} from "@proofbill/shared";
import { ReceiptRefresh } from "@/components/receipt-refresh";
import { ReceiptFrame } from "./frame";
import styles from "./receipt.module.css";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Public receipt",
  description: "Public onchain payment facts. Buyer results remain private.",
  robots: { index: false, follow: false },
};
const states: Record<
  OrderPhase,
  { title: string; detail: string; tone: string }
> = {
  Paid: {
    title: "Seller payment confirmed",
    detail: "The contract recorded a successful seller-transfer callback.",
    tone: "success",
  },
  Reserved: {
    title: "Service allocation reserved",
    detail: "The order is reserved. A seller payment has not been confirmed.",
    tone: "warning",
  },
  Delivered: {
    title: "Delivery recorded",
    detail:
      "The delivery commitment is onchain. A seller payment has not been confirmed.",
    tone: "warning",
  },
  PaymentPending: {
    title: "Payment pending",
    detail:
      "The seller-transfer outcome is still pending. This is not a confirmed payment.",
    tone: "warning",
  },
  TransferFailed: {
    title: "Seller transfer failed",
    detail:
      "The transfer failed. The buyer can review permitted retry or refund actions in the workspace.",
    tone: "error",
  },
  RefundPending: {
    title: "Refund pending",
    detail: "The refund outcome is still pending.",
    tone: "warning",
  },
  Refunded: {
    title: "Service allocation refunded",
    detail: "The contract recorded a successful refund to the buyer.",
    tone: "neutral",
  },
  RefundFailed: {
    title: "Refund transfer failed",
    detail:
      "The beneficiary can review the permitted refund retry in the workspace.",
    tone: "error",
  },
};
const actionLabels: Record<string, string> = {
  reserve_order: "Order reservation",
  publish_delivery: "Delivery publication",
  approve_and_pay: "Buyer-approved payment",
  retry_failed_payment: "Payment retry",
  cancel_and_refund: "Refund request",
  retry_failed_refund: "Refund retry",
  nft_transfer: "NFT handover",
  nft_transfer_call: "Asynchronous NFT handover",
  assign_agent: "Agent authorization",
  create_purchase_pass: "Pass funding",
};
const address = (id: string) =>
  `https://testnet.nearblocks.io/address/${encodeURIComponent(id)}`;
function Account({ id }: { id: string }) {
  return (
    <a href={address(id)} target="_blank" rel="noreferrer">
      {id}
    </a>
  );
}
function created(ns: string) {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Jakarta",
  }).format(new Date(Number(BigInt(ns) / 1000000n)));
}

export default async function PublicReceiptPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = await params;
  let receipt: PublicReceipt | null;
  try {
    receipt = await loadPublicReceipt(orderId);
  } catch {
    return (
      <ReceiptFrame>
        <section className={styles.error}>
          <h1>Receipt temporarily unavailable</h1>
          <p>
            The finalized order could not be read. Refresh to try again, or
            inspect the contract on the explorer.
          </p>
          <div className={styles.actions}>
            <ReceiptRefresh />
            <a
              className="button secondary"
              href="https://testnet.nearblocks.io"
              target="_blank"
              rel="noreferrer"
            >
              Open explorer <ArrowUpRight size={16} />
            </a>
          </div>
        </section>
      </ReceiptFrame>
    );
  }
  if (!receipt) notFound();
  const state = states[receipt.order_phase],
    automatic = receipt.payment_mode === "Automatic";
  return (
    <ReceiptFrame>
      <header className={styles.heading}>
        <div>
          <span className="badge neutral">Public record · NEAR testnet</span>
          <h1>Public receipt</h1>
          <p className={styles.id}>{receipt.order_id}</p>
          <p>
            Payment facts are public. The buyer’s result stays in the private
            workspace.
          </p>
        </div>
        <ReceiptRefresh />
      </header>
      <div className={styles.grid}>
        <div className={styles.stack}>
          <section
            className={`receipt ${styles.receipt}`}
            aria-label="Onchain financial record"
          >
            <span className={`badge ${state.tone}`}>{humanPhase(receipt.order_phase)}</span>
            <h2>{state.title}</h2>
            <p>{state.detail}</p>
            <div className={styles.amount}>
              {formatReceiptNear(receipt.price_yocto)}
            </div>
            <div className={styles.unit}>testnet NEAR · Service amount</div>
            <div className="receipt-rule" />
            <dl className={styles.facts}>
              <div>
                <dt>Seller</dt>
                <dd>
                  <Account id={receipt.seller_id} />
                </dd>
              </div>
              <div>
                <dt>Historical buyer</dt>
                <dd>
                  <Account id={receipt.buyer_id} />
                </dd>
              </div>
              <div>
                <dt>Purchasing agent</dt>
                <dd>
                  <Account id={receipt.agent_id} />
                </dd>
              </div>
              <div>
                <dt>Created · UTC+07:00</dt>
                <dd>{created(receipt.created_at_ns)}</dd>
              </div>
            </dl>
            <p className="fine">
              Storage backing and network fees are separate from this service
              amount.
            </p>
          </section>
          <section className={`panel ${styles.card}`}>
            <h2>Recorded transaction references</h2>
            {receipt.observations.length ? (
              <ul className={styles.references}>
                {receipt.observations.map((ref) => (
                  <li key={ref.tx_hash + ref.action}>
                    <a
                      href={`https://testnet.nearblocks.io/txns/${encodeURIComponent(ref.tx_hash)}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {actionLabels[ref.action] ?? "Contract call"}
                      <ArrowUpRight size={16} aria-hidden="true" />
                    </a>
                    <small>Signer: {ref.signer_id}</small>
                    <small className={styles.id}>{ref.tx_hash}</small>
                  </li>
                ))}
              </ul>
            ) : (
              <p>
                {receipt.references_available
                  ? "No transaction references have been recorded for this order yet."
                  : "Transaction references are temporarily unavailable. The finalized order above is still readable."}
              </p>
            )}
          </section>
        </div>
        <div className={styles.stack}>
          <section className={`panel ${styles.card}`}>
            <h2>Payment authorization</h2>
            <div className={styles.mode}>
              {automatic ? <ShieldCheck size={18} /> : <UserRound size={18} />}{" "}
              {receipt.payment_mode}
            </div>
            <p>
              {automatic
                ? "The owner authorized one fixed payment in advance. Matching publisher delivery starts settlement without a final wallet approval."
                : "The buyer approves the exact delivered result and seller payment in the wallet before settlement starts."}
            </p>
            {automatic && (
              <p>
                The configured publisher asserts that the delivery checks
                passed. Evidence does not guarantee answer quality.
              </p>
            )}
          </section>
          <section className={`panel ${styles.card}`}>
            <h2>Purchase Pass</h2>
            <dl className={styles.facts}>
              <div>
                <dt>NFT</dt>
                <dd>{receipt.token_id}</dd>
              </div>
              <div>
                <dt>NFT state</dt>
                <dd>{humanPhase(receipt.nft_phase)}</dd>
              </div>
              <div>
                <dt>Current NFT holder</dt>
                <dd>
                  <Account id={receipt.current_holder} />
                </dd>
              </div>
            </dl>
            <p className="fine">
              NFT ownership and historical buyer access are separate after a
              completed pass changes hands.
            </p>
          </section>
          <section className={`panel ${styles.card}`}>
            <div className={styles.private}>
              <LockKeyhole size={22} aria-hidden="true" />
              <div>
                <h2>Private results stay private</h2>
                <p>
                  Briefs, results and raw verification artifacts are not
                  included here. Buyer access requires a signed session in the
                  workspace.
                </p>
              </div>
            </div>
            <Link
              className="button primary"
              href={`/app/orders/${encodeURIComponent(receipt.order_id)}`}
              prefetch={false}
            >
              Open private workspace{" "}
              <ArrowUpRight size={16} aria-hidden="true" />
            </Link>
          </section>
        </div>
      </div>
      <details className={`panel ${styles.hashes}`}>
        <summary>Onchain commitments and source</summary>
        <dl className={styles.facts}>
          <div>
            <dt>Contract</dt>
            <dd>
              <Account id={receipt.contract_id} />
            </dd>
          </div>
          <div>
            <dt>Finalized block</dt>
            <dd>
              {receipt.block_height} · {receipt.block_hash}
            </dd>
          </div>
          <div>
            <dt>Request commitment</dt>
            <dd>{receipt.request_commitment}</dd>
          </div>
          <div>
            <dt>Response commitment</dt>
            <dd>{receipt.response_commitment ?? "Not recorded"}</dd>
          </div>
          <div>
            <dt>Evidence commitment</dt>
            <dd>{receipt.evidence_commitment ?? "Not recorded"}</dd>
          </div>
          <div>
            <dt>Declared policy</dt>
            <dd>{receipt.policy_id ?? "Not recorded"}</dd>
          </div>
        </dl>
      </details>
    </ReceiptFrame>
  );
}
