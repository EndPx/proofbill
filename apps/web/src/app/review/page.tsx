import type { Metadata } from "next";
import Link from "next/link";
import { ReceiptFrame } from "../receipts/[orderId]/frame";
import { landing } from "@/data/landing";
import styles from "./review.module.css";

export const metadata: Metadata = {
  title: "Review the working proof",
  description: "Follow a recorded ProofBill testnet budget through two purchases, handover and refund, with public receipts and explicit verification limits.",
  alternates: { canonical: "/review" },
};

const source = `${landing.github}/blob/main`;

export default function ReviewPage() {
  return (
    <ReceiptFrame>
      <header className={styles.intro}>
        <span className="badge neutral">Recorded testnet execution</span>
        <h1>One budget. Two purchases.<br />A record you can follow.</h1>
        <p>An agent can request a paid service without holding its owner's wallet key. ProofBill connects the spending permission, private delivery and confirmed payment. Start with the public facts; no wallet is needed here.</p>
        <div className={styles.actions}>
          <Link className="button primary" href="/receipts/pass-13-order-1" prefetch={false}>Open the Automatic receipt</Link>
          <Link className="button secondary" href="/#workspace-preview">Try the sample workspace</Link>
        </div>
      </header>

      <section className={styles.section} aria-labelledby="review-problem">
        <h2 id="review-problem">A spending instruction needs an execution boundary.</h2>
        <p>The first workflow is repeated private brief extraction for developers operating paid-API agents. It buys the extraction service, not the physical items named in a brief.</p>
        <blockquote>
          <p>“Separate decision-making from execution.”</p>
          <cite><a href="https://cheatsheetseries.owasp.org/cheatsheets/AI_Agent_Security_Cheat_Sheet.html#high-impact-action-integrity-controls">OWASP · AI Agent Security Cheat Sheet</a></cite>
        </blockquote>
        <p>ProofBill applies independent contract checks to the allowed seller, quote, remaining budget, optional ceiling, expiry and assigned agent. Manual requires payment approval after delivery; Automatic uses advance authorization. The source motivates the problem and does not endorse or certify ProofBill.</p>
        <a href={`${source}/docs/planning/PROBLEM-EVIDENCE.md`}>Read the research, alternatives and planned user trial</a>
      </section>

      <section className={styles.section} aria-labelledby="review-execution">
        <h2 id="review-execution">Follow the recorded execution.</h2>
        <p>Project-owned accounts and synthetic briefs, exercised on 14 November 2026. These figures describe that saved run, not a live balance or customer adoption.</p>
        <ol className={styles.timeline}>
          <li>
            <h3>Fund a reusable budget</h3>
            <p><strong>1.2345 NEAR</strong> service funding, plus separate initial storage backing of 0.030 NEAR and wallet gas. The optional per-purchase ceiling started at 0.100 NEAR; the actual service quote was 0.010 NEAR.</p>
          </li>
          <li>
            <h3>Buy with an assigned external agent</h3>
            <p><Link href="/receipts/pass-13-order-1" prefetch={false}>Order 1 · Automatic · 0.010 NEAR</Link> paid under advance authorization. With the per-purchase ceiling set below the 0.010 NEAR service quote, a new order was refused. The owner then removed the ceiling and chose Manual.</p>
          </li>
          <li>
            <h3>Review and pay for another order</h3>
            <p><Link href="/receipts/pass-13-order-2" prefetch={false}>Order 2 · Manual · 0.010 NEAR</Link> paid after buyer approval. Both payments have successful seller-transfer callbacks. Retained history required a separately signed storage top-up before the second reservation.</p>
          </li>
          <li>
            <h3>Hand over and refund what remains</h3>
            <p><strong>1.2345 funded = 0.020 spent + 1.2145 refunded.</strong> Transfer moved the remaining entitlement and cleared agent assignment, ceiling and Automatic permission. The former holder's refund was refused; the new holder refunded the remainder.</p>
          </li>
        </ol>
        <a href={`${source}/docs/evidence/flexible-budget-hosted.md`}>Inspect transactions, refusal checks and private-access test records</a>
      </section>

      <section className={styles.section} aria-labelledby="review-rights">
        <h2 id="review-rights">What the NFT carries—and what it does not.</h2>
        <p>The contract holds the funds under the token ID. An available NFT carries ownership of the remaining spending and refund rights; transfer is locked during an active order. Giving an agent permission does not give it the NFT. The original buyer keeps access to earlier private results after handover.</p>
        <p>A transferable budget record could implement the core rules. NEP-171 provides a standard ownership/transfer representation. The demo proves those rights move; customer demand for handover and external NFT interoperability have not been established.</p>
        <a href={`${source}/docs/agent-integration.md`}>Use your own agent through the SDK</a>
      </section>

      <section className={styles.section} aria-labelledby="review-private">
        <h2 id="review-private">Inspect the proof without publishing the brief.</h2>
        <p>Public receipts expose onchain payment facts and commitments. Private results require the historical buyer's signed session and are encrypted at rest. A buyer can export their own evidence and independently check committed bytes, signed order context and scoped provider TEE evidence.</p>
        <div className={styles.boundary}>
          <h3>The trust boundary stays visible.</h3>
          <p>The app operator processes plaintext. The contract trusts its configured publisher and does not verify hardware evidence onchain. Signature checks do not establish answer quality. The current verifier checks NRAS JWT signatures and claims against NVIDIA's HTTPS signing keys; TLS binding and source-image allowlisting remain unchecked. Older stored deliveries keep their original check labels and scope.</p>
        </div>
        <div className={styles.actions}>
          <a href={`${source}/docs/verify-private-result.md`}>Run buyer-side verification</a>
          <a href={`${source}/docs/evidence/budget-pass-hosted.md`}>Read recorded buyer verification and tamper rejection</a>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="review-next">
        <h2 id="review-next">Choose your next step.</h2>
        <p>The sample workspace is local simulation. The real workspace requires your testnet wallet, with a separate signature for private access. No independent customer pilot or profitable unit economics are claimed.</p>
        <div className={styles.actions}>
          <Link className="button primary" href="/app/purchases" prefetch={false}>Connect to the real workspace</Link>
          <a className="button secondary" href={`${landing.github}/actions/workflows/check.yml`}>Inspect automated checks</a>
        </div>
      </section>
    </ReceiptFrame>
  );
}
