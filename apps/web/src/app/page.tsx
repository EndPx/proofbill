import Link from "next/link";
import {
  ArrowUpRight,
  ArrowRight,
  Check,
  ReceiptText,
  KeyRound,
  ShieldCheck,
} from "lucide-react";
export default function Home() {
  return (
    <div className="landing">
      <nav className="landing-nav">
        <Link className="brand" href="/">
          <img src="/brand/icon.png" alt="" />
          ProofBill
        </Link>
        <div>
          <a
            href="https://github.com/EndPx/proofbill"
            target="_blank"
            rel="noreferrer"
          >
            GitHub <ArrowUpRight size={15} />
          </a>
          <Link className="button light" href="/app/purchases">
            Open app <ArrowRight size={16} />
          </Link>
        </div>
      </nav>
      <main className="landing-sheet">
        <div className="landing-hero">
          <div>
            <span className="badge neutral">Built on NEAR testnet</span>
            <h1>
              Give your agent a budget.
              <br />
              Know what it bought.
            </h1>
            <p>
              A Purchase Pass puts clear limits around an AI service purchase.
              Review the private result, inspect its evidence, and approve the
              exact payment.
            </p>
            <Link className="button primary" href="/app/passes/new">
              Create a Purchase Pass <ArrowRight size={18} />
            </Link>
            <span className="hero-note">
              Test funds. One service. One clear receipt.
            </span>
          </div>
          <div className="hero-receipt receipt">
            <div className="receipt-top">
              <ReceiptText size={26} />
              <span>How a purchase works</span>
            </div>
            <h2>Private brief extraction</h2>
            <p>Turn a purchase brief into structured details.</p>
            <div className="receipt-rule" />
            <div className="flow-row">
              <span>1</span>
              <div>
                <strong>Fund a pass</strong>
                <small>Set the service and spending limit.</small>
              </div>
            </div>
            <div className="flow-row">
              <span>2</span>
              <div>
                <strong>Let your agent order</strong>
                <small>Receive the result and inspect its evidence.</small>
              </div>
            </div>
            <div className="flow-row">
              <span>3</span>
              <div>
                <strong>Review, then pay</strong>
                <small>Your wallet approves the exact seller payment.</small>
              </div>
            </div>
            <div className="receipt-rule" />
            <div className="trust-line">
              <Check size={17} /> Payment status follows the chain.
            </div>
          </div>
        </div>
        <section className="landing-features">
          <article>
            <KeyRound />
            <h2>A pass with a purpose</h2>
            <p>
              Transfer an unused pass to a teammate. Its purchasing and refund
              rights follow the new holder.
            </p>
          </article>
          <article>
            <ShieldCheck />
            <h2>Evidence you can inspect</h2>
            <p>
              See the response signature and model preflight checks alongside
              the actual result.
            </p>
          </article>
          <article>
            <ReceiptText />
            <h2>A record that adds up</h2>
            <p>
              Follow the order from reservation to payment. Keep a receipt for
              exactly what you approved.
            </p>
          </article>
        </section>
        <footer>
          <span>ProofBill · Private results, clear purchases.</span>
          <Link href="/app/purchases">
            Explore the workspace <ArrowRight size={16} />
          </Link>
        </footer>
      </main>
    </div>
  );
}
