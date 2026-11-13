"use client";

import { useState } from "react";
import {
  ArrowRight,
  Check,
  KeyRound,
  RotateCcw,
  Ticket,
  UserRound,
} from "lucide-react";
import styles from "./pass-handover.module.css";

export function PassHandover() {
  const [transferred, setTransferred] = useState(false);
  return (
    <div
      className={styles.scene}
      data-transferred={transferred}
      role="region"
      aria-label="Purchase Pass handover preview"
    >
      <div className={styles.header}>
        <span>Illustrative handover</span>
        <span className={styles.previewTag}>Interactive preview</span>
      </div>
      <div className={styles.track}>
        <div className={styles.route} aria-hidden="true">
          <div className={styles.progress} />
        </div>
        <div className={styles.passLane} aria-hidden="true">
          <div className={styles.pass} data-handover-pass>
            <div className={styles.passTop}>
              <span>PROOFBILL</span>
              <Ticket size={18} />
            </div>
            <strong>
              Purchase
              <br />
              Pass
            </strong>
            <span className={styles.passMark}>
              <Check size={12} /> UNUSED
            </span>
            <div className={styles.passFoot}>USE + REFUND RIGHTS</div>
          </div>
        </div>
        <div
          className={styles.person}
          data-current={!transferred}
          role="group"
          aria-label="You"
        >
          <div className={styles.avatar}>
            <UserRound size={25} />
          </div>
          <strong>You</strong>
          <span>{transferred ? "Previous holder" : "Current holder"}</span>
        </div>
        <div
          className={styles.person}
          data-current={transferred}
          role="group"
          aria-label="Teammate"
        >
          <div className={styles.avatar}>
            <UserRound size={25} />
          </div>
          <strong>Teammate</strong>
          <span>{transferred ? "Current holder" : "Next holder"}</span>
        </div>
      </div>
      <dl className={styles.rights}>
        <div>
          <dt>
            <KeyRound size={13} /> Use + refund rights
          </dt>
          <dd>{transferred ? "Teammate" : "You"}</dd>
        </div>
        <div>
          <dt>
            <RotateCcw size={13} /> Agent assignment
          </dt>
          <dd data-cleared={transferred}>
            {transferred ? (
              <>
                <Check size={12} /> Cleared
              </>
            ) : (
              "Existing assignment"
            )}
          </dd>
        </div>
      </dl>
      <p className={styles.status} aria-live="polite">
        {transferred
          ? "Teammate holds the rights. Previous agent cleared."
          : "You hold the use and refund rights."}
      </p>
      <div className={styles.footer}>
        <button
          type="button"
          className={styles.button}
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
        <p className={styles.note}>Preview only. No wallet action.</p>
      </div>
    </div>
  );
}
