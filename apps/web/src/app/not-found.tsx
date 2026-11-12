import Link from "next/link";
import { ArrowLeft, ReceiptText } from "lucide-react";
import styles from "./home.module.css";

export default function NotFound() {
  return (
    <div className={styles.home}>
      <main className={styles.missing}>
        <ReceiptText size={44} strokeWidth={1.3} />
        <span>404 / No record here</span>
        <h1>
          This page isn't
          <br />
          on the record.
        </h1>
        <p>
          The link may have changed. Head back to ProofBill to find your next
          purchase.
        </p>
        <Link className={styles.cta} href="/">
          <ArrowLeft size={17} /> Back to ProofBill
        </Link>
      </main>
    </div>
  );
}
