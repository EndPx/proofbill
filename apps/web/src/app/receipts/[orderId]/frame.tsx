import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowUpRight } from "lucide-react";
import styles from "./receipt.module.css";
export function ReceiptFrame({ children }: { children: ReactNode }) {
  return (
    <div className={styles.frame}>
      <main className={styles.sheet}>
        <nav className={styles.nav} aria-label="Receipt navigation">
        <Link className={`brand ${styles.brand}`} href="/" prefetch={false}>
            <img src="/brand/icon.png" alt="" />
            ProofBill
          </Link>
          <Link
            className="button secondary"
            href="/app/purchases"
            prefetch={false}
          >
            Open workspace <ArrowUpRight size={16} aria-hidden="true" />
          </Link>
        </nav>
        {children}
        <footer className={styles.footer}>
          <span>NEAR testnet · Test funds only</span>
        <Link href="/" prefetch={false}>About ProofBill</Link>
        </footer>
      </main>
    </div>
  );
}
