"use client";

import { useState } from "react";
import { ArrowRight, RotateCcw, Ticket, UserRound } from "lucide-react";
import styles from "@/app/home.module.css";

export function PassHandover() {
  const [transferred, setTransferred] = useState(false);
  return (
    <div className={styles.handover}>
      <span className={styles.diagramLabel}>Illustrative handover</span>
      <div className={styles.handoverDiagram} data-transferred={transferred}>
        <div className={styles.handoverPerson}>
          <UserRound size={25} />
          <span>You</span>
        </div>
        <div className={styles.handoverPath}>
          <span />
          <div>
            <Ticket size={35} />
            <span>Purchase Pass</span>
          </div>
          <ArrowRight size={22} />
        </div>
        <div className={styles.handoverPerson}>
          <UserRound size={25} />
          <span>Teammate</span>
        </div>
      </div>
      <p className={styles.handoverStatus} aria-live="polite">
        {transferred
          ? "Teammate holds the rights. Previous agent cleared."
          : "You hold the use and refund rights."}
      </p>
      <button
        className={styles.handoverButton}
        onClick={() => setTransferred(!transferred)}
      >
        {transferred ? (
          <>
            <RotateCcw size={14} /> Reset preview
          </>
        ) : (
          <>
            Preview a handover <ArrowRight size={15} />
          </>
        )}
      </button>
    </div>
  );
}
