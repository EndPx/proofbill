"use client";
import type { PointerEvent } from "react";
import {
  ArrowUpRight,
  Check,
  Fingerprint,
  KeyRound,
  Ticket,
} from "lucide-react";
import { formatNear, SERVICE_PRICE, STORAGE_BUDGET } from "@proofbill/shared";
import { landing } from "@/data/landing";
import styles from "@/app/home.module.css";

export function PurchaseObject({ phase }: { phase: number }) {
  function tilt(event: PointerEvent<HTMLDivElement>) {
    if (
      event.pointerType !== "mouse" ||
      matchMedia("(prefers-reduced-motion: reduce)").matches
    )
      return;
    const rect = event.currentTarget.getBoundingClientRect();
    event.currentTarget.style.setProperty(
      "--tilt-y",
      `${((event.clientX - rect.left) / rect.width - 0.5) * 16}deg`,
    );
    event.currentTarget.style.setProperty(
      "--tilt-x",
      `${(0.5 - (event.clientY - rect.top) / rect.height) * 12}deg`,
    );
  }
  function reset(event: PointerEvent<HTMLDivElement>) {
    event.currentTarget.style.setProperty("--tilt-x", "0deg");
    event.currentTarget.style.setProperty("--tilt-y", "0deg");
  }
  return (
    <div
      className={styles.objectStage}
      onPointerMove={tilt}
      onPointerLeave={reset}
      data-object-stage={phase}
    >
      <div className={styles.objectFloat} data-story-object>
        <div className={styles.objectCard} data-stage={phase}>
          <div className={styles.objectEdge} />
          <div className={styles.objectTop}>
            <span>PROOFBILL</span>
            <span>0{phase + 1} / 03</span>
          </div>
          <div className={styles.objectBrand}>
            {phase === 1 ? (
              <Fingerprint size={43} strokeWidth={1.3} />
            ) : (
              <Ticket size={43} strokeWidth={1.3} />
            )}
            <span>
              {
                ["PURCHASE PERMISSION", "PRIVATE DELIVERY", "PAYMENT RECEIPT"][
                  phase
                ]
              }
            </span>
          </div>
          {phase === 0 ? (
            <>
              <span className={styles.diagramLabel}>Purchase Pass rules</span>
              <h3>
                One pass.
                <br />
                One purchase.
              </h3>
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
              <div className={styles.objectStamps}>
                <span>
                  <Check size={13} /> Fixed seller
                </span>
                <span>
                  <KeyRound size={13} /> You approve
                </span>
              </div>
            </>
          ) : phase === 1 ? (
            <>
              <span className={styles.diagramLabel}>
                Illustrative extraction example
              </span>
              <h3>
                Your brief.
                <br />
                Your result.
              </h3>
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
              <div className={styles.objectStamps}>
                <span>
                  <KeyRound size={13} /> Buyer session
                </span>
                <span>Review first</span>
              </div>
            </>
          ) : (
            <>
              <span className={styles.diagramLabel}>
                Recorded testnet payment
              </span>
              <h3>
                A receipt.
                <br />
                On the record.
              </h3>
              <div className={styles.paymentAmount}>
                {formatNear(SERVICE_PRICE)}
                <span>native testnet NEAR</span>
              </div>
              <dl>
                <div>
                  <dt>Order</dt>
                  <dd>pass-2-order</dd>
                </div>
                <div>
                  <dt>Outcome</dt>
                  <dd>Paid</dd>
                </div>
              </dl>
              <a
                href={landing.payment}
                target="_blank"
                rel="noopener noreferrer"
              >
                View transaction <ArrowUpRight size={14} />
              </a>
            </>
          )}
          <div className={styles.objectBarcode} aria-hidden="true">
            {Array.from({ length: 53 }, (_, index) => (
              <i key={index} style={{ width: `${1 + ((index * 7) % 3)}px` }} />
            ))}
          </div>
          <p className={styles.objectFoot}>
            {phase === 2 ? "RECORDED TESTNET EXAMPLE" : "WORKFLOW ILLUSTRATION"}
          </p>
        </div>
      </div>
    </div>
  );
}
