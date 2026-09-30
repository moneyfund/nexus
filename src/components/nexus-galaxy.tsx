"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  Minus,
  Plus,
  Pause,
  Play,
  RotateCcw,
  Move,
  X,
  List,
  Orbit,
} from "lucide-react";
import { useNexus } from "./nexus-provider";
import { IconButton } from "./ui/primitives";
import type { ProjectStatus } from "@/domain/models";
import {
  galaxyBudget,
  orbitLabels,
  orbitOrder,
  orbitPosition,
  orbitRadii,
} from "@/lib/orbits";

type SpaceNode = {
  id: string;
  label: string;
  category: string;
  kind: "idea" | "project";
  status?: ProjectStatus;
  progress?: number;
  nextAction?: string;
  angle: number;
  radius: number;
  speed: number;
};
function makeParticles(count: number) {
  let seed = 67391;
  const random = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
  return Array.from({ length: count }, () => {
    const radius = 0.65 + Math.pow(random(), 0.72) * 6.1;
    const angle =
      (Math.floor(random() * 3) * Math.PI * 2) / 3 +
      radius * 0.73 +
      (random() - 0.5) * 0.55;
    return {
      x: Math.cos(angle) * radius,
      z: Math.sin(angle) * radius,
      y: (random() - 0.5) * (0.08 + radius * 0.09),
      size: 0.4 + random() * 1.3,
      alpha: 0.15 + random() * 0.75,
    };
  });
}
const particles = makeParticles(2600);

export function NexusGalaxy({
  compact = false,
  projectIds,
  includeIdeas = true,
}: {
  compact?: boolean;
  projectIds?: string[];
  includeIdeas?: boolean;
}) {
  const n = useNexus();
  const canvas = useRef<HTMLCanvasElement>(null);
  const shell = useRef<HTMLDivElement>(null);
  const nodeRefs = useRef(new Map<string, HTMLButtonElement>());
  const view = useRef({
    yaw: -0.18,
    targetYaw: -0.18,
    pitch: 0.66,
    targetPitch: 0.66,
    zoom: 1,
    targetZoom: 1,
    px: 0,
    py: 0,
    tx: 0,
    ty: 0,
  });
  const drag = useRef({ active: false, x: 0, y: 0 });
  const flightTime = useRef(0);
  const pointerInside = useRef(false);
  const interactionUntil = useRef(0);
  const renderRef = useRef<() => void>(() => {});
  const [paused, setPaused] = useState(false);
  const [orbit, setOrbit] = useState("all");
  const [inspectedId, setInspectedId] = useState<string | null>(null);
  const [listOpen, setListOpen] = useState(false);
  const quality = n.data.user.preferences.quality;
  const reduce = n.reduceMotion;
  const nodes = useMemo<SpaceNode[]>(() => {
    const projects = n.projects.filter(
      (p) => !projectIds || projectIds.includes(p.id),
    );
    return [
      ...projects.map((p) => {
        const group = projects.filter((item) => item.status === p.status);
        return {
          id: p.id,
          label: p.name,
          category: p.area,
          kind: "project" as const,
          status: p.status,
          progress: p.progress,
          nextAction: p.tasks.find((t) => !t.completed)?.title || p.nextAction,
          ...orbitPosition(
            p.status,
            group.findIndex((item) => item.id === p.id),
            group.length,
          ),
        };
      }),
      ...(includeIdeas
        ? n.data.ideas
            .filter((i) => i.status !== "archived" && i.status !== "converted")
            .slice(0, 24)
            .map((i, index) => ({
              id: i.id,
              label: i.title,
              category: i.category,
              kind: "idea" as const,
              angle: index * 2.399 + 0.2,
              radius: 6.5 + (index % 3) * 0.12,
              speed: 0.000006,
            }))
        : []),
    ];
  }, [n.projects, n.data.ideas, projectIds, includeIdeas]);
  const filtered = useMemo(
    () =>
      nodes.filter(
        (p) =>
          orbit === "all" ||
          (orbit === "ideas" ? p.kind === "idea" : p.status === orbit),
      ),
    [nodes, orbit],
  );
  const inspected = filtered.find((p) => p.id === inspectedId);

  useEffect(() => {
    const el = canvas.current,
      container = shell.current;
    const ctx = el?.getContext("2d");
    if (!el || !container || !ctx) return;
    let width = 1,
      height = 1,
      raf = 0,
      visible = true,
      last = 0,
      lastPaint = 0,
      frames = 0,
      cost = 0;
    let budget = galaxyBudget(quality, 800),
      count = budget.particles;
    const sprite = document.createElement("canvas");
    sprite.width = sprite.height = 24;
    const sc = sprite.getContext("2d")!;
    const glow = sc.createRadialGradient(12, 12, 0, 12, 12, 12);
    glow.addColorStop(0, "#fff7ff");
    glow.addColorStop(0.15, "#f4ccff");
    glow.addColorStop(0.4, "#b571d955");
    glow.addColorStop(1, "#78289400");
    sc.fillStyle = glow;
    sc.fillRect(0, 0, 24, 24);
    const project = (x: number, y: number, z: number) => {
      const v = view.current,
        cy = Math.cos(v.yaw),
        sy = Math.sin(v.yaw);
      const rx = x * cy - z * sy,
        rz = x * sy + z * cy;
      const ry = y * Math.cos(v.pitch) - rz * Math.sin(v.pitch);
      const depth = y * Math.sin(v.pitch) + rz * Math.cos(v.pitch);
      const perspective = 20 / (20 + depth);
      const scale = Math.min(width * 0.061, height * 0.125) * v.zoom;
      return {
        x: width / 2 + (rx + v.px * 0.16) * scale * perspective,
        y: height * 0.47 + (ry + v.py * 0.16) * scale * perspective,
        depth,
        perspective,
        scale,
      };
    };
    function draw(now: number) {
      raf = 0;
      if (!visible || document.hidden) return;
      const continuous = !reduce && !paused && !pointerInside.current;
      const interacting = drag.current.active || now < interactionUntil.current;
      const targetFps = interacting ? budget.interactionFps : budget.fps;
      if (continuous && now - lastPaint < 1000 / targetFps - 1) {
        raf = requestAnimationFrame(draw);
        return;
      }
      const started = performance.now(),
        delta = Math.min(50, now - (last || now));
      last = now;
      lastPaint = now;
      const v = view.current;
      if (continuous && !drag.current.active) {
        v.targetYaw += delta * 0.000009;
        flightTime.current += delta;
      }
      const smoothing = reduce ? 1 : 0.075;
      for (const [a, b] of [
        ["yaw", "targetYaw"],
        ["pitch", "targetPitch"],
        ["zoom", "targetZoom"],
        ["px", "tx"],
        ["py", "ty"],
      ] as const)
        v[a] += (v[b] - v[a]) * smoothing;
      ctx!.clearRect(0, 0, width, height);
      const center = project(0, 0, 0);
      const halo = ctx!.createRadialGradient(
        center.x,
        center.y,
        0,
        center.x,
        center.y,
        width * 0.49,
      );
      halo.addColorStop(0, "#b748db28");
      halo.addColorStop(0.42, "#8b30b911");
      halo.addColorStop(1, "#10051800");
      ctx!.fillStyle = halo;
      ctx!.fillRect(0, 0, width, height);
      // Perspective tracks are the same coordinates used by the accessible HTML nodes.
      for (const status of orbitOrder) {
        ctx!.beginPath();
        for (let i = 0; i <= 100; i++) {
          const angle = (i / 100) * Math.PI * 2,
            r = orbitRadii[status];
          const p = project(Math.cos(angle) * r, 0, Math.sin(angle) * r);
          if (!i) ctx!.moveTo(p.x, p.y);
          else ctx!.lineTo(p.x, p.y);
        }
        ctx!.strokeStyle = status === "active" ? "#f8baff50" : "#b6a7e62b";
        ctx!.lineWidth = 0.75;
        ctx!.stroke();
      }
      ctx!.globalCompositeOperation = "screen";
      // Three continuous dust arms provide volume at every quality level.
      for (let arm = 0; arm < 3; arm++) {
        for (const [lineWidth, alpha] of [
          [18, 0.024],
          [7, 0.045],
          [1, 0.18],
        ]) {
          ctx!.beginPath();
          for (let i = 0; i <= budget.armSamples; i++) {
            const r = 0.8 + (i / budget.armSamples) * 5.8,
              a = (arm * Math.PI * 2) / 3 + r * 0.73;
            const p = project(Math.cos(a) * r, 0, Math.sin(a) * r);
            if (!i) ctx!.moveTo(p.x, p.y);
            else ctx!.lineTo(p.x, p.y);
          }
          ctx!.strokeStyle = `rgba(214,147,242,${alpha})`;
          ctx!.lineWidth = lineWidth;
          ctx!.stroke();
        }
      }
      for (let i = 0; i < count; i++) {
        const star = particles[i],
          p = project(star.x, star.y, star.z);
        const size = star.size * 3.7 * p.perspective;
        ctx!.globalAlpha = star.alpha;
        ctx!.drawImage(sprite, p.x - size / 2, p.y - size / 2, size, size);
      }
      ctx!.globalAlpha = 1;
      // Accretion rings in world space, with a bright rim and a shaded spherical core.
      for (let ring = 0; ring < budget.ringCount; ring++) {
        const r = 0.95 + ring * 0.032;
        ctx!.beginPath();
        for (let i = 0; i <= 90; i++) {
          const a = (i / 90) * Math.PI * 2;
          const p = project(
            Math.cos(a) * r,
            Math.sin(a * 3 + ring) * 0.012,
            Math.sin(a) * r,
          );
          if (!i) ctx!.moveTo(p.x, p.y);
          else ctx!.lineTo(p.x, p.y);
        }
        ctx!.strokeStyle =
          ring < 4
            ? "#ffe4fb82"
            : `rgba(217,116,230,${Math.max(0.055, 0.22 - ring * 0.009)})`;
        ctx!.lineWidth = ring < 5 ? 1.3 : 0.8;
        ctx!.stroke();
      }
      const radius = center.scale * 0.82;
      const corona = ctx!.createRadialGradient(
        center.x,
        center.y,
        radius * 0.45,
        center.x,
        center.y,
        radius * 3.6,
      );
      corona.addColorStop(0, "#fff4fbbb");
      corona.addColorStop(0.16, "#fbb6ed70");
      corona.addColorStop(0.4, "#e658ee25");
      corona.addColorStop(1, "#ab39db00");
      ctx!.fillStyle = corona;
      ctx!.beginPath();
      ctx!.arc(center.x, center.y, radius * 3.6, 0, Math.PI * 2);
      ctx!.fill();
      ctx!.globalCompositeOperation = "source-over";
      const sphere = ctx!.createRadialGradient(
        center.x - radius * 0.4,
        center.y - radius * 0.5,
        0,
        center.x,
        center.y,
        radius,
      );
      sphere.addColorStop(0, "#fff6fc");
      sphere.addColorStop(0.23, "#eed5f6");
      sphere.addColorStop(0.48, "#b672d0");
      sphere.addColorStop(0.8, "#402154");
      sphere.addColorStop(1, "#110b23");
      ctx!.fillStyle = sphere;
      ctx!.beginPath();
      ctx!.arc(center.x, center.y, radius, 0, Math.PI * 2);
      ctx!.fill();
      ctx!.strokeStyle = "#ffe7ffad";
      ctx!.lineWidth = 0.85;
      ctx!.stroke();
      const positions: {
        left: number;
        right: number;
        top: number;
        bottom: number;
      }[] = [
        {
          left: center.x - radius * 1.5,
          right: center.x + radius * 1.5,
          top: center.y - radius * 1.5,
          bottom: center.y + radius * 2.2,
        },
      ];
      for (const node of filtered) {
        const a = node.angle + flightTime.current * node.speed;
        const p = project(
          Math.cos(a) * node.radius,
          node.kind === "idea" ? 0.3 : 0,
          Math.sin(a) * node.radius,
        );
        const button = nodeRefs.current.get(node.id);
        if (!button) continue;
        const x = Math.max(24, Math.min(width - 24, p.x)),
          y = Math.max(30, Math.min(height - 40, p.y));
        button.style.transform = `translate3d(${x}px,${y}px,0) translate(-50%,-50%) scale(${Math.max(0.85, Math.min(1.1, p.perspective))})`;
        button.style.zIndex = String(Math.round(30 - p.depth));
        button.style.setProperty(
          "--node-alpha",
          String(Math.max(0.6, Math.min(1, 1 - p.depth * 0.04))),
        );
        const leftSide = x > width * 0.66;
        const bounds = {
          left: leftSide ? x - 180 : x + 27,
          right: leftSide ? x - 27 : x + 180,
          top: y - 22,
          bottom: y + 40,
        };
        const overlaps = positions.some(
          (q) =>
            bounds.left < q.right + 8 &&
            bounds.right > q.left - 8 &&
            bounds.top < q.bottom + 6 &&
            bounds.bottom > q.top - 6,
        );
        // Labels are intentionally hidden at rest. Hover, keyboard focus or
        // an explicit touch/click reveals project identity and progress.
        button.style.setProperty("--label-opacity", "0");
        button.dataset.side = leftSide ? "left" : "right";
        if (!overlaps && button.matches(":hover, :focus-visible")) positions.push(bounds);
      }
      frames++;
      cost += performance.now() - started;
      if (quality === "auto" && frames === 75 && cost / frames > 10) {
        count = Math.max(520, Math.floor(count * 0.68));
        budget.fps = Math.min(budget.fps, 24);
        budget.interactionFps = Math.min(budget.interactionFps, 36);
      }
      const settling =
        Math.abs(v.yaw - v.targetYaw) +
          Math.abs(v.pitch - v.targetPitch) +
          Math.abs(v.zoom - v.targetZoom) +
          Math.abs(v.px - v.tx) +
          Math.abs(v.py - v.ty) >
        0.001;
      if (continuous || (!reduce && settling))
        raf = requestAnimationFrame(draw);
    }
    const schedule = () => {
      if (!raf) {
        last = 0;
        raf = requestAnimationFrame(draw);
      }
    };
    renderRef.current = schedule;
    const resize = () => {
      const rect = container.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      budget = galaxyBudget(quality, width);
      count = budget.particles;
      const dpr = Math.min(window.devicePixelRatio || 1, budget.dpr);
      el.width = width * dpr;
      el.height = height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      schedule();
    };
    const ro = new ResizeObserver(resize);
    ro.observe(container);
    resize();
    const io = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      container.dataset.running = String(
        visible && !document.hidden && !reduce && !paused,
      );
      if (visible) schedule();
      else {
        cancelAnimationFrame(raf);
        raf = 0;
      }
    });
    io.observe(container);
    const visibility = () => {
      container.dataset.running = String(
        visible && !document.hidden && !reduce && !paused,
      );
      if (document.hidden) {
        cancelAnimationFrame(raf);
        raf = 0;
      } else schedule();
    };
    document.addEventListener("visibilitychange", visibility);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      document.removeEventListener("visibilitychange", visibility);
      renderRef.current = () => {};
    };
  }, [filtered, quality, reduce, paused]);

  const inspect = (node: SpaceNode) => {
    setInspectedId(node.id);
    pointerInside.current = true;
    renderRef.current();
  };
  return (
    <div
      className={`galaxy-wrapper universe-galaxy ${compact ? "galaxy-compact" : ""}`}
    >
      <div className="galaxy-category">
        <span className="universe-kicker">PROJECT UNIVERSE</span>
        <select
          value={orbit}
          aria-label="Filtrar órbita"
          onChange={(e) => {
            setOrbit(e.target.value);
            setInspectedId(null);
          }}
        >
          <option value="all">Todas las órbitas</option>
          {orbitOrder.map((status) => (
            <option key={status} value={status}>
              {orbitLabels[status]}
            </option>
          ))}
          {includeIdeas && <option value="ideas">Ideas</option>}
        </select>
      </div>
      <div
        className="galaxy-canvas"
        ref={shell}
        role="group"
        tabIndex={0}
        aria-label="Universo de proyectos. Flechas para rotar; Tab para explorar los nodos."
        onKeyDown={(e) => {
          if (e.target !== e.currentTarget || !e.key.startsWith("Arrow"))
            return;
          e.preventDefault();
          interactionUntil.current = performance.now() + 900;
          if (e.key === "ArrowLeft") view.current.targetYaw -= 0.15;
          if (e.key === "ArrowRight") view.current.targetYaw += 0.15;
          if (e.key === "ArrowUp")
            view.current.targetPitch = Math.min(
              1.25,
              view.current.targetPitch + 0.1,
            );
          if (e.key === "ArrowDown")
            view.current.targetPitch = Math.max(
              0.25,
              view.current.targetPitch - 0.1,
            );
          renderRef.current();
        }}
        onPointerDown={(e) => {
          interactionUntil.current = performance.now() + 1200;
          if ((e.target as HTMLElement).closest("button")) return;
          drag.current = { active: true, x: e.clientX, y: e.clientY };
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          interactionUntil.current = performance.now() + 700;
          const r = e.currentTarget.getBoundingClientRect();
          if (!reduce && e.pointerType === "mouse") {
            view.current.tx = (e.clientX - r.left) / r.width - 0.5;
            view.current.ty = (e.clientY - r.top) / r.height - 0.5;
          }
          if (drag.current.active) {
            view.current.targetYaw += (e.clientX - drag.current.x) * 0.005;
            if (e.pointerType === "mouse")
              view.current.targetPitch = Math.max(
                0.25,
                Math.min(
                  1.25,
                  view.current.targetPitch +
                    (e.clientY - drag.current.y) * 0.003,
                ),
              );
            drag.current.x = e.clientX;
            drag.current.y = e.clientY;
          }
          renderRef.current();
        }}
        onPointerUp={(e) => {
          drag.current.active = false;
          if (e.currentTarget.hasPointerCapture(e.pointerId))
            e.currentTarget.releasePointerCapture(e.pointerId);
          renderRef.current();
        }}
        onPointerCancel={() => {
          drag.current.active = false;
          renderRef.current();
        }}
        onPointerLeave={() => {
          pointerInside.current = false;
          view.current.tx = 0;
          view.current.ty = 0;
          renderRef.current();
        }}
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget)) {
            pointerInside.current = false;
            renderRef.current();
          }
        }}
      >
        <canvas ref={canvas} aria-hidden="true" />
        <div className="universe-core-caption" aria-hidden="true">
          <b>NEXUS</b>
          <span>INTELLIGENCE CORE</span>
        </div>
        {filtered.map((node) => (
          <button
            key={node.id}
            ref={(el) => {
              if (el) nodeRefs.current.set(node.id, el);
              else nodeRefs.current.delete(node.id);
            }}
            onPointerEnter={() => inspect(node)}
            onFocus={() => inspect(node)}
            onClick={() => inspect(node)}
            className={`galaxy-node ${node.kind} status-${node.status ?? "idea"} ${inspected?.id === node.id ? "is-inspected" : ""}`}
            aria-label={`${node.label}${node.status ? `, ${orbitLabels[node.status]}, ${node.progress}%` : ", idea"}. Ver detalles.`}
            aria-pressed={inspected?.id === node.id}
          >
            <span className="node-satellite">
              <span className="node-dot" />
            </span>
            <span className="node-label">
              {node.label}
              <small>
                {node.status
                  ? `${orbitLabels[node.status]} · ${node.progress}%`
                  : node.category}
              </small>
            </span>
          </button>
        ))}
        {!nodes.length && (
          <div className="universe-empty">
            <span>Todo empieza con una idea.</span>
            <button
              className="button button-secondary"
              onClick={() => n.openCapture("project")}
            >
              <Plus size={14} />
              Crear primer proyecto
            </button>
          </div>
        )}
        <div className="universe-coordinate" aria-hidden="true">
          N / {String(filtered.length).padStart(2, "0")}
          <span>ORBITAL FIELD</span>
        </div>
      </div>
      <div className="universe-inspector">
        {inspected ? (
          <>
            <span className="inspector-number">
              {inspected.kind === "project"
                ? String(inspected.progress).padStart(2, "0")
                : "✧"}
              <small>{inspected.kind === "project" ? "%" : "IDEA"}</small>
            </span>
            <div>
              <span className="hud-label">
                {inspected.status
                  ? orbitLabels[inspected.status]
                  : inspected.category}
              </span>
              <strong>{inspected.label}</strong>
              <p>
                {inspected.nextAction ||
                  (inspected.kind === "idea"
                    ? "Explora esta idea y sus conexiones."
                    : "Define la próxima acción.")}
              </p>
            </div>
            {inspected.kind === "project" ? (
              <Link
                className="button button-secondary"
                href={"/project?id=" + encodeURIComponent(inspected.id)}
              >
                Abrir
              </Link>
            ) : (
              <button
                className="button button-secondary"
                onClick={() => n.setSelectedIdeaId(inspected.id)}
              >
                Abrir
              </button>
            )}
            <IconButton
              label="Cerrar detalle orbital"
              onClick={() => {
                setInspectedId(null);
                pointerInside.current = false;
                interactionUntil.current = performance.now() + 900;
                renderRef.current();
              }}
            >
              <X size={14} />
            </IconButton>
          </>
        ) : (
          <>
            <Orbit size={23} strokeWidth={1} />
            <div>
              <strong>Tu atención tiene su propia gravedad.</strong>
              <p>
                Explora un proyecto. Los activos están más cerca del núcleo.
              </p>
            </div>
          </>
        )}
      </div>
      <div className="galaxy-controls">
        <button
          className="universe-list-toggle"
          onClick={() => setListOpen(!listOpen)}
          aria-expanded={listOpen}
        >
          <List size={15} />
          {listOpen ? "Cerrar lista" : `Explorar ${filtered.length} nodos`}
        </button>
        <div className="row" style={{ gap: 3 }}>
          <span className="galaxy-drag-hint">
            <Move size={12} />
            Arrastra
          </span>
          <IconButton
            label="Alejar galaxia"
            onClick={() => {
              view.current.targetZoom = Math.max(
                0.65,
                view.current.targetZoom - 0.15,
              );
              interactionUntil.current = performance.now() + 900;
              renderRef.current();
            }}
          >
            <Minus size={14} />
          </IconButton>
          <IconButton
            label="Acercar galaxia"
            onClick={() => {
              view.current.targetZoom = Math.min(
                1.35,
                view.current.targetZoom + 0.15,
              );
              interactionUntil.current = performance.now() + 900;
              renderRef.current();
            }}
          >
            <Plus size={14} />
          </IconButton>
          <IconButton
            label={paused ? "Animar galaxia" : "Pausar galaxia"}
            aria-pressed={paused}
            onClick={() => setPaused(!paused)}
          >
            {paused ? <Play size={13} /> : <Pause size={13} />}
          </IconButton>
          <IconButton
            label="Restablecer vista"
            onClick={() => {
              view.current.targetZoom = 1;
              view.current.targetPitch = 0.66;
              view.current.targetYaw = -0.18;
              interactionUntil.current = performance.now() + 900;
              renderRef.current();
            }}
          >
            <RotateCcw size={13} />
          </IconButton>
        </div>
      </div>
      {listOpen && (
        <div className="universe-node-list">
          {filtered.map((node) => (
            <button
              key={node.id}
              onClick={() => {
                inspect(node);
                setListOpen(false);
              }}
            >
              <span>{node.label}</span>
              <small>
                {node.status
                  ? `${orbitLabels[node.status]} · ${node.progress}%`
                  : "Idea"}
              </small>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
