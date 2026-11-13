"use client";
import { useEffect } from "react";

export function LandingMotion() {
  useEffect(() => {
    const root = document.getElementById("proofbill-home");
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (!root) return;
    const scope = root;
    let disposed = false;
    let generation = 0;
    let cleanup = () => {};
    async function start() {
      const version = ++generation;
      if (motion.matches) return;
      const [{ gsap }, { ScrollTrigger }, { default: Lenis }] =
        await Promise.all([
          import("gsap"),
          import("gsap/ScrollTrigger"),
          import("lenis"),
        ]);
      if (disposed || motion.matches || version !== generation) return;
      gsap.registerPlugin(ScrollTrigger);
      const lenis = new Lenis({ duration: 0.8, anchors: true });
      lenis.on("scroll", ScrollTrigger.update);
      const tick = (time: number) => lenis.raf(time * 1000);
      gsap.ticker.add(tick);
      const context = gsap.context(() => {
        gsap.from("[data-intro]", {
          y: 18,
          duration: 0.65,
          stagger: 0.07,
          ease: "power3.out",
          clearProps: "all",
        });
        gsap.from("[data-product-preview]", {
          y: 55,
          rotationX: 12,
          transformPerspective: 1400,
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
      generation++;
      cleanup();
      cleanup = () => {};
      if (!motion.matches) void start();
    };
    motion.addEventListener("change", onPreferenceChange);
    void start();
    return () => {
      disposed = true;
      generation++;
      motion.removeEventListener("change", onPreferenceChange);
      cleanup();
    };
  }, []);
  return null;
}
