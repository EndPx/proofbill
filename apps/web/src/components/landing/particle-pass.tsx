"use client";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";
import type { ParticleEngine } from "./particle-engine";
import styles from "@/app/home.module.css";

const labels = ["Purchase Pass", "Private result", "Payment record"];
export function ParticlePass() {
  const stage = useRef<HTMLDivElement>(null),
    canvas = useRef<HTMLCanvasElement>(null);
  const engine = useRef<ParticleEngine | null>(null),
    phase = useRef(0),
    paused = useRef(false);
  const [selected, setSelected] = useState(0),
    [isPaused, setPaused] = useState(false);
  useEffect(() => {
    const element = stage.current,
      surface = canvas.current;
    if (!element || !surface) return;
    let disposed = false,
      visible = true,
      generation = 0,
      stop = () => {};
    const motion = matchMedia("(prefers-reduced-motion: reduce)");
    const pointer: [number, number] = [0, 0];
    const lost = (event: Event) => {
      event.preventDefault();
      generation++;
      stop();
      stop = () => {};
    };
    const restored = () => {
      if (!motion.matches) void setup();
    };
    surface.addEventListener("webglcontextlost", lost);
    surface.addEventListener("webglcontextrestored", restored);
    async function setup() {
      const version = ++generation;
      if (motion.matches) return;
      const [{ createParticleEngine }, { gsap }] = await Promise.all([
        import("./particle-engine"),
        import("gsap"),
      ]);
      if (disposed || motion.matches || version !== generation) return;
      const renderer = createParticleEngine(surface!);
      if (!renderer) return;
      engine.current = renderer;
      element!.dataset.webgl = "ready";
      const tick = (time: number) => {
        if (visible && !document.hidden && !paused.current)
          renderer.draw(time, phase.current, pointer, true);
      };
      const enter = (event: PointerEvent) => {
        if (event.pointerType !== "mouse") return;
        const rect = element!.getBoundingClientRect();
        pointer[0] = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        pointer[1] = ((event.clientY - rect.top) / rect.height) * 2 - 1;
      };
      const leave = () => {
        pointer[0] = pointer[1] = 0;
      };
      const resize = new ResizeObserver(() => renderer.resize());
      resize.observe(element!);
      const visibility = new IntersectionObserver((entries) => {
        visible = entries[0].isIntersecting;
      });
      visibility.observe(element!);
      element!.addEventListener("pointermove", enter);
      element!.addEventListener("pointerleave", leave);
      gsap.ticker.add(tick);
      renderer.draw(0, phase.current, pointer, false);
      stop = () => {
        gsap.ticker.remove(tick);
        resize.disconnect();
        visibility.disconnect();
        element!.removeEventListener("pointermove", enter);
        element!.removeEventListener("pointerleave", leave);
        renderer.dispose();
        engine.current = null;
        delete element!.dataset.webgl;
      };
    }
    const preference = () => {
      generation++;
      stop();
      stop = () => {};
      if (!motion.matches) void setup();
    };
    motion.addEventListener("change", preference);
    void setup();
    return () => {
      disposed = true;
      generation++;
      motion.removeEventListener("change", preference);
      surface.removeEventListener("webglcontextlost", lost);
      surface.removeEventListener("webglcontextrestored", restored);
      stop();
    };
  }, []);
  function select(index: number) {
    phase.current = index;
    setSelected(index);
    if (paused.current) engine.current?.draw(0, index, [0, 0], false);
  }
  function pause() {
    paused.current = !paused.current;
    setPaused(paused.current);
  }
  return (
    <div
      className={styles.particleStage}
      ref={stage}
      aria-label="Interactive 3D purchase lifecycle illustration"
    >
      <div className={styles.particleFallback}>
        <Image
          src="/art/purchase-pass.webp"
          alt=""
          width={1200}
          height={800}
          sizes="(max-width:760px) 90vw,45vw"
          priority
        />
      </div>
      <canvas
        ref={canvas}
        className={styles.particleCanvas}
        aria-hidden="true"
      />
      <div className={styles.particleCaption}>
        <span>
          0{selected + 1} / {labels[selected]}
        </span>
        <p>
          {
            [
              "One permission, fixed before your agent orders.",
              "Your result is opened with a signed buyer session.",
              "Your policy authorizes. The chain confirms.",
            ][selected]
          }
        </p>
        <small>Lifecycle illustration · NEAR testnet</small>
      </div>
      <div
        className={styles.particleControls}
        role="group"
        aria-label="3D illustration stages"
      >
        {labels.map((label, index) => (
          <button
            key={label}
            aria-label={
              index === 2
                ? "Show payment receipt"
                : `Show ${label.toLowerCase()}`
            }
            title={label}
            aria-pressed={selected === index}
            onClick={() => select(index)}
          >
            <span />
            {["Pass", "Private", "Receipt"][index]}
          </button>
        ))}
        <button
          className={styles.pauseMotion}
          onClick={pause}
          aria-label={isPaused ? "Play 3D motion" : "Pause 3D motion"}
        >
          {isPaused ? <Play size={13} /> : <Pause size={13} />}
        </button>
      </div>
    </div>
  );
}
