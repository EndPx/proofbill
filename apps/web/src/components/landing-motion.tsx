"use client";
import { useEffect } from "react";

export function LandingMotion() {
  useEffect(() => {
    const root = document.getElementById("proofbill-home");
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (!root) return;
    const scope = root;
    let disposed = false;
    let cleanup = () => {};
    async function start() {
      if (motion.matches) return;
      const [{ gsap }, { ScrollTrigger }, { default: Lenis }] =
        await Promise.all([
          import("gsap"),
          import("gsap/ScrollTrigger"),
          import("lenis"),
        ]);
      if (disposed || motion.matches) return;
      gsap.registerPlugin(ScrollTrigger);
      const lenis = new Lenis({ duration: 0.8, anchors: true });
      lenis.on("scroll", ScrollTrigger.update);
      const tick = (time: number) => lenis.raf(time * 1000);
      gsap.ticker.add(tick);
      const context = gsap.context(() => {
        gsap.from("[data-intro]", {
          y: 18,
          opacity: 0.35,
          duration: 0.65,
          stagger: 0.07,
          ease: "power3.out",
          clearProps: "all",
        });
        gsap.to("[data-pass-art]", {
          y: -24,
          rotation: -2,
          ease: "none",
          scrollTrigger: {
            trigger: "[data-pass-art]",
            start: "top 15%",
            end: "bottom top",
            scrub: 0.6,
          },
        });
        gsap.from("[data-product-preview]", {
          y: 32,
          scale: 0.975,
          ease: "none",
          scrollTrigger: {
            trigger: "[data-product-preview]",
            start: "top 95%",
            end: "top 40%",
            scrub: 0.6,
          },
        });
      }, scope);
      cleanup = () => {
        gsap.ticker.remove(tick);
        lenis.destroy();
        context.revert();
      };
    }
    const onPreferenceChange = () => {
      cleanup();
      cleanup = () => {};
      if (!motion.matches) void start();
    };
    motion.addEventListener("change", onPreferenceChange);
    void start();
    return () => {
      disposed = true;
      motion.removeEventListener("change", onPreferenceChange);
      cleanup();
    };
  }, []);
  return null;
}
