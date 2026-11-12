"use client";
import { useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  KeyRound,
  ReceiptText,
  Ticket,
} from "lucide-react";
import { formatNear, SERVICE_PRICE, STORAGE_BUDGET } from "@proofbill/shared";
import { landing } from "@/data/landing";
import styles from "@/app/home.module.css";

export function PurchaseStory() {
  const [selected, setSelected] = useState(0);
  return (
    <div className={styles.story}>
      <div
        className={styles.steps}
        role="group"
        aria-label="Purchase workflow steps"
      >
        {landing.steps.map((step, index) => (
          <button
            key={step.title}
            aria-pressed={selected === index}
            aria-controls="purchase-step-detail"
            onClick={() => setSelected(index)}
          >
            <span className={styles.stepNumber}>{index + 1}</span>
            <span>
              <strong>{step.title}</strong>
              <span className={styles.stepBody}>{step.body}</span>
            </span>
            <ArrowRight size={18} />
          </button>
        ))}
      </div>
      <div
        className={styles.stepDetail}
        id="purchase-step-detail"
        aria-live="polite"
        aria-atomic="true"
      >
        <div
          className={styles.storyPass}
          data-stage={selected}
          aria-hidden="true"
        >
          <Ticket size={23} />
          <span>Purchase Pass</span>
          <span>{selected + 1} / 3</span>
        </div>
        {selected === 0 ? (
          <div className={styles.passFigure}>
            <span className={styles.diagramLabel}>Purchase Pass rules</span>
            <Ticket size={53} strokeWidth={1.3} />
            <h3>One pass. One purchase.</h3>
            <dl>
              <div>
                <dt>Service allocation</dt>
                <dd>{formatNear(SERVICE_PRICE)} NEAR</dd>
              </div>
              <div>
                <dt>Separate storage budget</dt>
                <dd>{formatNear(STORAGE_BUDGET)} NEAR</dd>
              </div>
              <div>
                <dt>Service</dt>
                <dd>Private brief extraction</dd>
              </div>
            </dl>
            <p>{landing.steps[0].detail}</p>
          </div>
        ) : selected === 1 ? (
          <div className={styles.exampleFigure}>
            <span className={styles.diagramLabel}>
              Illustrative extraction example
            </span>
            <KeyRound size={33} />
            <h3>A brief becomes useful details.</h3>
            <p className={styles.exampleInput}>
              “Order 12 notebooks for Maya.”
            </p>
            <dl>
              <div>
                <dt>Item</dt>
                <dd>notebooks</dd>
              </div>
              <div>
                <dt>Quantity</dt>
                <dd>12</dd>
              </div>
              <div>
                <dt>Requested by</dt>
                <dd>Maya</dd>
              </div>
            </dl>
            <p>{landing.steps[1].detail}</p>
          </div>
        ) : (
          <div className={styles.paymentFigure}>
            <span className={styles.diagramLabel}>
              Recorded testnet payment
            </span>
            <ReceiptText size={40} />
            <h3>A receipt with a real reference.</h3>
            <div className={styles.paymentAmount}>
              {formatNear(SERVICE_PRICE)}
              <span>testnet NEAR</span>
            </div>
            <span className={styles.paymentPaid}>
              <Check size={16} /> Confirmed seller payment
            </span>
            <a href={landing.payment} target="_blank" rel="noreferrer">
              View transaction <ArrowUpRight size={16} />
            </a>
            <p>{landing.steps[2].detail}</p>
          </div>
        )}
      </div>
    </div>
  );
}
