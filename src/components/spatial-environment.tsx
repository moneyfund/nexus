"use client";

import { useEffect, useRef } from "react";
import { useNexus } from "./nexus-provider";

export type SpatialZone =
  | "core"
  | "projects"
  | "finance"
  | "calendar"
  | "flow"
  | "ai"
  | "ideas"
  | "knowledge"
  | "settings";

export function spatialZone(path: string): SpatialZone {
  if (path.startsWith("/project") || path.startsWith("/goals"))
    return "projects";
  if (path.startsWith("/analytics")) return "finance";
  return (
    (
      [
        "finance",
        "calendar",
        "flow",
        "ai",
        "ideas",
        "knowledge",
        "settings",
      ] as const
    ).find((zone) => path.startsWith("/" + zone)) ?? "core"
  );
}

/** One persistent ambient layer. Route changes move the light, not the workspace. */
export function SpatialEnvironment({
  variant = "core",
}: {
  variant?: SpatialZone;
}) {
  const n = useNexus();
  const root = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const quality = n.data.user.preferences.quality;

  useEffect(() => {
    const container = root.current;
    const el = canvas.current;
    const ctx = el?.getContext("2d");
    if (!container || !el || !ctx) return;
    function paint() {
      if (!el || !ctx || !container) return;
      const { width, height } = container.getBoundingClientRect();
      const dpr = Math.min(
        window.devicePixelRatio || 1,
        quality === "high" ? 2 : 1,
      );
      el.width = width * dpr;
      el.height = height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      let seed = 18217;
      const random = () =>
        ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
      const count = quality === "low" ? 50 : width < 700 ? 85 : 180;
      for (let i = 0; i < count; i++) {
        const x = random() * width,
          y = random() * height;
        const radius = random() > 0.96 ? 1.3 : 0.6;
        ctx.fillStyle = `rgba(214,214,255,${0.14 + random() * 0.4})`;
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    const observer = new ResizeObserver(paint);
    observer.observe(container);
    paint();
    return () => observer.disconnect();
  }, [quality]);

  useEffect(() => {
    const container = root.current;
    if (!container) return;
    const visible = () => {
      document.documentElement.dataset.pageVisible = String(!document.hidden);
      container.dataset.running = String(
        !document.hidden && !n.reduceMotion && quality !== "low",
      );
    };
    visible();
    document.addEventListener("visibilitychange", visible);
    return () => document.removeEventListener("visibilitychange", visible);
  }, [n.reduceMotion, quality]);

  return (
    <div
      ref={root}
      className="spatial-environment"
      data-zone={variant}
      aria-hidden="true"
    >
      <div className="spatial-light spatial-light-primary" />
      <div className="spatial-light spatial-light-secondary" />
      <canvas ref={canvas} className="spatial-stars" />
      <div className="spatial-grid" />
      <svg
        className="spatial-topography"
        viewBox="0 0 1440 1000"
        preserveAspectRatio="xMidYMid slice"
      >
        {Array.from({ length: 8 }, (_, i) => (
          <path
            key={i}
            d={`M${-200 + i * 30} 1100 C${300 + i * 40} ${340 - i * 25}, ${800 - i * 50} ${1120 - i * 40}, 1600 ${80 + i * 42}`}
          />
        ))}
        <ellipse
          cx="1150"
          cy="250"
          rx="410"
          ry="150"
          transform="rotate(-28 1150 250)"
        />
        <ellipse
          cx="1150"
          cy="250"
          rx="520"
          ry="215"
          transform="rotate(-28 1150 250)"
        />
      </svg>
      <div className="spatial-vignette" />
    </div>
  );
}

/** A quiet, reusable intelligence indicator; animations only run in view. */
export function IntelligenceCore({
  busy = false,
  className = "",
}: {
  busy?: boolean;
  className?: string;
}) {
  const n = useNexus();
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    let inView = true;
    const update = () => {
      el.dataset.running = String(
        inView &&
          !document.hidden &&
          !n.reduceMotion &&
          n.data.user.preferences.quality !== "low",
      );
    };
    const observer = new IntersectionObserver(([entry]) => {
      inView = entry.isIntersecting;
      update();
    });
    observer.observe(el);
    document.addEventListener("visibilitychange", update);
    update();
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", update);
    };
  }, [n.reduceMotion, n.data.user.preferences.quality]);
  return (
    <div
      ref={root}
      className={`intelligence-core ${busy ? "is-thinking" : ""} ${className}`}
      aria-hidden="true"
    >
      <span className="intelligence-halo" />
      <span className="intelligence-orbit orbit-a" />
      <span className="intelligence-orbit orbit-b" />
      <span className="intelligence-orbit orbit-c" />
      <span className="intelligence-sphere" />
    </div>
  );
}
