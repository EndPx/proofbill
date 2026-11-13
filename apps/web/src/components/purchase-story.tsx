"use client";
import { useEffect, useRef, useState } from "react";
import { ArrowDownRight } from "lucide-react";
import { landing } from "@/data/landing";
import { PurchaseObject } from "./landing/purchase-object";
import styles from "@/app/home.module.css";

export function PurchaseStory() {
  const [selected, setSelected] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const mobileJump = useRef<number | null>(null);
  useEffect(() => {
    if (mobileJump.current === null) return;
    document
      .getElementById(`purchase-mobile-detail-${mobileJump.current}`)
      ?.scrollIntoView({ block: "nearest", behavior: "instant" });
    mobileJump.current = null;
  }, [selected]);
  useEffect(() => {
    let disposed = false,
      cleanup = () => {};
    async function start() {
      const [{ gsap }, { ScrollTrigger }] = await Promise.all([
        import("gsap"),
        import("gsap/ScrollTrigger"),
      ]);
      if (disposed || !root.current) return;
      gsap.registerPlugin(ScrollTrigger);
      const media = gsap.matchMedia();
      media.add(
        "(min-width: 901px) and (prefers-reduced-motion: no-preference)",
        () => {
          const context = gsap.context(() => {
            root
              .current!.querySelectorAll<HTMLElement>("[data-story-beat]")
              .forEach((beat, index) => {
                ScrollTrigger.create({
                  trigger: beat,
                  start: "top 52%",
                  end: "bottom 52%",
                  onEnter: () => setSelected(index),
                  onEnterBack: () => setSelected(index),
                });
              });
            gsap.from("[data-desktop-object] [data-story-object]", {
              rotationX: 13,
              rotationY: -14,
              rotationZ: -4,
              ease: "none",
              scrollTrigger: {
                trigger: root.current,
                start: "top 75%",
                end: "bottom 75%",
                scrub: 0.6,
              },
            });
          }, root.current!);
          return () => context.revert();
        },
      );
      cleanup = () => media.revert();
    }
    void start();
    return () => {
      disposed = true;
      cleanup();
    };
  }, []);
  function choose(index: number) {
    if (matchMedia("(max-width: 900px)").matches) {
      mobileJump.current = index;
      if (selected === index) {
        document
          .getElementById(`purchase-mobile-detail-${index}`)
          ?.scrollIntoView({ block: "nearest", behavior: "instant" });
        mobileJump.current = null;
      }
    }
    setSelected(index);
  }
  return (
    <div className={styles.story} ref={root}>
      <div
        className={styles.steps}
        role="group"
        aria-label="Purchase workflow steps"
      >
        {landing.steps.map((step, index) => (
          <div
            className={styles.storyBeat}
            data-story-beat
            key={step.title}
            data-active={selected === index}
          >
            <button
              aria-pressed={selected === index}
              onClick={() => choose(index)}
            >
              <span className={styles.stepNumber}>0{index + 1}</span>
              <span>{step.title}</span>
              <ArrowDownRight size={21} />
            </button>
            <p>{step.body}</p>
            <span className={styles.beatDetail}>{step.detail}</span>
            <div
              className={styles.mobileStoryDetail}
              id={`purchase-mobile-detail-${index}`}
              role="region"
              aria-label={`${step.title} illustration`}
              hidden={selected !== index}
            >
              {selected === index && <PurchaseObject phase={index} />}
            </div>
          </div>
        ))}
      </div>
      <div
        className={styles.stepDetail}
        data-desktop-object
        id="purchase-step-detail"
        role="region"
        aria-label="Purchase lifecycle illustration"
      >
        <PurchaseObject phase={selected} />
        <div className={styles.stageRail}>
          {["Permission", "Private result", "Receipt"].map((label, index) => (
            <span key={label} data-active={selected >= index}>
              <i />
              {label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
