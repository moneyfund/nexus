"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Minus,
  Plus,
  Pause,
  Play,
  RotateCcw,
  Move,
  Maximize2,
} from "lucide-react";
import { useNexus } from "./nexus-provider";
import { IconButton } from "./ui/primitives";
type Point = {
  x: number;
  y: number;
  z: number;
  size: number;
  tint: number;
  alpha: number;
};
type Node = {
  id: string;
  label: string;
  category: string;
  kind: "idea" | "project";
  status?: "active" | "waiting" | "backlog" | "completed";
  angle: number;
  radius: number;
  speed: number;
  fresh: boolean;
};
function stars(count: number) {
  let seed = 67391;
  const random = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
  return Array.from({ length: count }, () => {
    const r = Math.pow(random(), 0.68) * 6.8;
    const arm = Math.floor(random() * 4);
    const a = (arm * Math.PI) / 2 + r * 0.68 + (random() - 0.5) * 0.48;
    return {
      x: Math.cos(a) * r,
      y: (random() - 0.5) * (0.18 + r * 0.1),
      z: Math.sin(a) * r,
      size: 0.35 + random() * 1.35,
      tint: random(),
      alpha: 0.3 + random() * 0.7,
    };
  });
}
const particles = stars(1600);
export function NexusGalaxy({ compact = false }: { compact?: boolean }) {
  const n = useNexus();
  const router = useRouter();
  const canvas = useRef<HTMLCanvasElement>(null);
  const shell = useRef<HTMLDivElement>(null);
  const nodeRefs = useRef(new Map<string, HTMLButtonElement>());
  const view = useRef({
    yaw: 0.25,
    targetYaw: 0.25,
    pitch: 0.6,
    targetPitch: 0.6,
    zoom: 1,
    targetZoom: 1,
    px: 0,
    py: 0,
    tx: 0,
    ty: 0,
  });
  const drag = useRef({ active: false, x: 0, y: 0 });
  const renderRef = useRef<() => void>(() => {});
  const [paused, setPaused] = useState(false);
  const [orbit, setOrbit] = useState("all");
  const quality = n.data.user.preferences.quality;
  const reduce = n.reduceMotion;
  const nodes = useMemo<Node[]>(() => {
    const ideas = n.data.ideas.filter(
      (i) => i.status !== "archived" && i.status !== "converted",
    );
    const statusRadius = {
      active: 2.05,
      waiting: 3.35,
      backlog: 4.55,
      completed: 5.65,
    } as const;
    const projects = n.projects;
    return [
      ...projects.map((p, index) => {
        const sameStatus = projects.filter((item) => item.status === p.status);
        const statusIndex = sameStatus.findIndex((item) => item.id === p.id);
        const radius =
          statusRadius[p.status] +
          (statusIndex % 3) * 0.16 +
          Math.floor(statusIndex / 3) * 0.09;
        return {
          id: p.id,
          label: p.name,
          category: "Projects",
          kind: "project" as const,
          status: p.status,
          angle:
            (statusIndex / Math.max(sameStatus.length, 1)) * Math.PI * 2 +
            index * 0.17 +
            0.8,
          radius,
          speed:
            p.status === "active"
              ? 0.000032
              : p.status === "waiting"
                ? 0.000021
                : p.status === "backlog"
                  ? 0.000014
                  : 0.000009,
          fresh: false,
        };
      }),
      ...ideas.slice(0, 18).map((i, index) => ({
        id: i.id,
        label: i.title,
        category: i.category,
        kind: "idea" as const,
        angle: index * 2.399 + 0.2,
        radius: 6.25 + (index % 4) * 0.17,
        speed: 0.000007,
        fresh: false,
      })),
    ];
  }, [n.data.ideas, n.projects]);
  const filtered = useMemo(
    () => nodes.filter((p) => orbit === "all" || p.category === orbit),
    [nodes, orbit],
  );
  useEffect(() => {
    const el = canvas.current;
    const container = shell.current;
    if (!el || !container) return;
    const ctx = el.getContext("2d");
    if (!ctx) return;
    let width = 1,
      height = 1,
      raf = 0,
      visible = true,
      last = 0,
      frameCost = 0,
      frames = 0;
    let count = quality === "low" ? 380 : 1400;
    const sprite = document.createElement("canvas");
    sprite.width = sprite.height = 32;
    const sc = sprite.getContext("2d")!;
    const g = sc.createRadialGradient(16, 16, 0, 16, 16, 16);
    g.addColorStop(0, "#fff");
    g.addColorStop(0.13, "#f4c1ff");
    g.addColorStop(0.35, "#d64aec70");
    g.addColorStop(1, "#ad40e000");
    sc.fillStyle = g;
    sc.fillRect(0, 0, 32, 32);
    const project = (p: { x: number; y: number; z: number }) => {
      const v = view.current;
      const cy = Math.cos(v.yaw),
        sy = Math.sin(v.yaw);
      const x = p.x * cy - p.z * sy;
      const z = p.x * sy + p.z * cy;
      const y = p.y * Math.cos(v.pitch) - z * Math.sin(v.pitch);
      const depth = p.y * Math.sin(v.pitch) + z * Math.cos(v.pitch);
      const perspective = 18 / (18 + depth);
      const scale = Math.min(width * 0.071, height * 0.125) * v.zoom;
      return {
        x: width / 2 + (x + v.px * 0.12) * scale * perspective,
        y: height * 0.48 + (y + v.py * 0.12) * scale * perspective,
        depth,
        perspective,
      };
    };
    function draw(now = performance.now()) {
      raf = 0;
      if (!visible || document.hidden) return;
      const started = performance.now();
      const delta = Math.min(32, now - (last || now));
      last = now;
      const v = view.current;
      if (!reduce && !paused && !drag.current.active)
        v.targetYaw += delta * 0.000021;
      const smoothing = reduce ? 1 : 0.09;
      v.yaw += (v.targetYaw - v.yaw) * smoothing;
      v.pitch += (v.targetPitch - v.pitch) * smoothing;
      v.zoom += (v.targetZoom - v.zoom) * smoothing;
      v.px += (v.tx - v.px) * smoothing;
      v.py += (v.ty - v.py) * smoothing;
      ctx!.clearRect(0, 0, width, height);
      // Deep, stationary star field; the knowledge disk moves through its own 3D coordinates.
      for (let i = 0; i < 70; i++) {
        const x = (((i * 277.3) % 1000) / 1000) * width;
        const y = (((i * 137.7) % 1000) / 1000) * height;
        ctx!.fillStyle = `rgba(222,199,244,${0.1 + (i % 4) * 0.055})`;
        ctx!.fillRect(x, y, i % 11 === 0 ? 1.8 : 1, 1);
      }
      const cx = width / 2,
        cy = height * 0.48;
      const radius = Math.min(width, height) * 0.4;
      const nebula = ctx!.createRadialGradient(cx, cy, 0, cx, cy, radius);
      nebula.addColorStop(0, "#d83fcc20");
      nebula.addColorStop(0.35, "#901dab12");
      nebula.addColorStop(1, "#00000000");
      ctx!.fillStyle = nebula;
      ctx!.fillRect(0, 0, width, height);

      // Cinematic nucleus: layered accretion light gives the hero real depth
      // without adding a heavy WebGL dependency to the static GitHub Pages build.
      ctx!.save();
      ctx!.translate(cx, cy);
      ctx!.rotate(v.yaw * 0.18);
      for (let ring = 0; ring < 5; ring++) {
        ctx!.beginPath();
        ctx!.ellipse(
          0,
          0,
          radius * (0.2 + ring * 0.075),
          radius * (0.045 + ring * 0.012),
          0,
          0,
          Math.PI * 2,
        );
        ctx!.strokeStyle =
          ring === 0
            ? "rgba(255,232,255,.42)"
            : `rgba(221,82,237,${0.2 - ring * 0.026})`;
        ctx!.lineWidth = ring === 0 ? 1.4 : 0.8;
        ctx!.stroke();
      }
      const horizon = ctx!.createRadialGradient(0, 0, 0, 0, 0, radius * 0.23);
      horizon.addColorStop(0, "rgba(255,255,255,.95)");
      horizon.addColorStop(0.12, "rgba(252,218,255,.8)");
      horizon.addColorStop(0.28, "rgba(226,92,241,.46)");
      horizon.addColorStop(0.56, "rgba(133,39,170,.18)");
      horizon.addColorStop(1, "rgba(70,18,92,0)");
      ctx!.fillStyle = horizon;
      ctx!.beginPath();
      ctx!.arc(0, 0, radius * 0.23, 0, Math.PI * 2);
      ctx!.fill();
      ctx!.restore();

      // Orbit tracks encode project state: active projects live closest to the core.
      for (const r of [2.05, 3.35, 4.55, 5.65, 6.25]) {
        ctx!.beginPath();
        for (let i = 0; i <= 120; i++) {
          const a = (i / 120) * Math.PI * 2;
          const p = project({ x: Math.cos(a) * r, y: 0, z: Math.sin(a) * r });
          if (!i) ctx!.moveTo(p.x, p.y);
          else ctx!.lineTo(p.x, p.y);
        }
        ctx!.strokeStyle =
          r === 2.05
            ? "#f4a8ff3d"
            : r === 3.35
              ? "#c783ff25"
              : "#c677f016";
        ctx!.lineWidth = 0.8;
        ctx!.stroke();
      }
      ctx!.globalCompositeOperation = "screen";
      for (let i = 0; i < count; i++) {
        const star = particles[i];
        const p = project(star);
        const size = star.size * 3.7 * p.perspective;
        ctx!.globalAlpha = star.alpha * 0.65;
        ctx!.drawImage(sprite, p.x - size / 2, p.y - size / 2, size, size);
      }
      ctx!.globalAlpha = 1;
      const coreSize = Math.min(width, height) * 0.135 * v.zoom;
      const core = ctx!.createRadialGradient(cx, cy, 0, cx, cy, coreSize * 2.1);
      core.addColorStop(0, "#fff6ff");
      core.addColorStop(0.08, "#f8cbfc");
      core.addColorStop(0.2, "#f18dea99");
      core.addColorStop(0.5, "#a631c737");
      core.addColorStop(1, "#7625b000");
      ctx!.fillStyle = core;
      ctx!.beginPath();
      ctx!.arc(cx, cy, coreSize * 2.1, 0, Math.PI * 2);
      ctx!.fill();
      ctx!.globalCompositeOperation = "source-over";
      const labelPositions: { x: number; y: number }[] = [];
      for (const node of filtered) {
        const orbitAngle =
          node.angle +
          (!reduce && !paused ? now * node.speed : 0);
        const p = project({
          x: Math.cos(orbitAngle) * node.radius,
          y:
            node.kind === "idea"
              ? 0.34
              : node.status === "active"
                ? Math.sin(orbitAngle * 1.7) * 0.08
                : 0,
          z: Math.sin(orbitAngle) * node.radius,
        });
        const button = nodeRefs.current.get(node.id);
        if (button) {
          button.style.transform = `translate3d(${p.x}px,${p.y}px,0) translate(-50%,-50%) scale(${Math.max(0.8, Math.min(1.05, p.perspective))})`;
          button.style.zIndex = String(Math.round(30 - p.depth));
          button.style.opacity = String(
            Math.max(0.6, Math.min(1, 1 - p.depth * 0.045)),
          );
          const overlaps = labelPositions.some(
            (q) => Math.abs(q.x - p.x) < 128 && Math.abs(q.y - p.y) < 66,
          );
          button.style.setProperty("--label-opacity", overlaps ? "0" : "1");
          if (!overlaps) labelPositions.push(p);
        }
      }
      frames++;
      frameCost += performance.now() - started;
      if (quality === "auto" && frames === 90 && frameCost / frames > 15)
        count = Math.max(300, Math.floor(count * 0.55));
      if (!reduce && visible && !document.hidden)
        raf = requestAnimationFrame(draw);
    }
    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(draw);
    };
    renderRef.current = schedule;
    const resize = () => {
      const rect = container.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      const dpr = Math.min(devicePixelRatio || 1, quality === "high" ? 2 : 1.5);
      count = quality === "low" || width < 500 ? 380 : 1400;
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
      if (visible) {
        last = 0;
        schedule();
      } else {
        cancelAnimationFrame(raf);
        raf = 0;
      }
    });
    io.observe(container);
    const visibility = () => {
      if (document.hidden) {
        cancelAnimationFrame(raf);
        raf = 0;
      } else {
        last = 0;
        schedule();
      }
    };
    document.addEventListener("visibilitychange", visibility);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [filtered, quality, reduce, paused]);
  function select(node: Node) {
    view.current.targetYaw = -node.angle + 0.7;
    view.current.targetZoom = 1.12;
    renderRef.current();
    if (node.kind === "idea") n.setSelectedIdeaId(node.id);
    else router.push("/project?id=" + encodeURIComponent(node.id));
  }
  return (
    <div className={"galaxy-wrapper " + (compact ? "galaxy-compact" : "")}>
      <div className="galaxy-category">
        <span className="status-tick" />
        <span>NEXUS PROJECT GALAXY</span>
        <select
          value={orbit}
          aria-label="Filtrar órbita"
          onChange={(e) => setOrbit(e.target.value)}
        >
          <option value="all">Todas las órbitas</option>
          <option value="Projects">Todos los proyectos</option>
          {Array.from(
            new Set(
              nodes
                .filter((node) => node.kind === "idea")
                .map((node) => node.category),
            ),
          ).map((category) => (
            <option key={category}>{category}</option>
          ))}
        </select>
      </div>
      <div
        className="galaxy-canvas"
        ref={shell}
        role="group"
        aria-label="Galaxia interactiva. Arrastra o usa las flechas para rotar. Tab para explorar nodos."
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.target !== e.currentTarget) return;
          if (e.key.startsWith("Arrow")) {
            e.preventDefault();
            if (e.key === "ArrowLeft") view.current.targetYaw -= 0.15;
            if (e.key === "ArrowRight") view.current.targetYaw += 0.15;
            if (e.key === "ArrowUp")
              view.current.targetPitch = Math.min(
                1.3,
                view.current.targetPitch + 0.1,
              );
            if (e.key === "ArrowDown")
              view.current.targetPitch = Math.max(
                0.2,
                view.current.targetPitch - 0.1,
              );
            renderRef.current();
          }
        }}
        onPointerDown={(e) => {
          if ((e.target as HTMLElement).closest("button")) return;
          drag.current = { active: true, x: e.clientX, y: e.clientY };
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          view.current.tx = (e.clientX - r.left) / r.width - 0.5;
          view.current.ty = (e.clientY - r.top) / r.height - 0.5;
          if (drag.current.active) {
            view.current.targetYaw += (e.clientX - drag.current.x) * 0.007;
            view.current.targetPitch = Math.max(
              0.2,
              Math.min(
                1.3,
                view.current.targetPitch + (e.clientY - drag.current.y) * 0.004,
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
        }}
        onPointerCancel={() => {
          drag.current.active = false;
        }}
      >
        <canvas ref={canvas} aria-hidden="true" />
        <div className="galaxy-core-label" aria-hidden="true">
          <span>N</span>
          <small>NEXUS CORE</small>
        </div>
        {filtered.map((node) => (
          <button
            key={node.id}
            ref={(el) => {
              if (el) nodeRefs.current.set(node.id, el);
              else nodeRefs.current.delete(node.id);
            }}
            onClick={() => select(node)}
            className={
              "galaxy-node " +
              node.kind +
              (node.status ? " status-" + node.status : "")
            }
            aria-label={`${node.kind === "idea" ? "Abrir idea" : "Abrir proyecto"}: ${node.label}`}
            title={node.label}
          >
            <span className="node-dot" />
            <span className="node-label">
              {node.label}
              <small>
                {node.kind === "idea"
                  ? node.category
                  : node.status === "active"
                    ? "ACTIVE · INNER ORBIT"
                    : (node.status ?? "PROJECT").toUpperCase()}
              </small>
            </span>
          </button>
        ))}
        {!nodes.length && (
          <div className="galaxy-empty">
            <p>Tu universo todavía está en silencio.</p>
            <button
              className="button button-secondary"
              onClick={() => n.openCapture()}
            >
              Captura tu primera idea
            </button>
          </div>
        )}
        <span className="galaxy-coordinate galaxy-coordinate-left">
          α 00.24
          <br />N / {String(nodes.length).padStart(2, "0")}
        </span>
        <span className="galaxy-coordinate galaxy-coordinate-right">
          PROJECT FIELD
          <br />
          {n.projects.filter((p) => p.status === "active").length} INNER / {n.projects.length} TOTAL
        </span>
      </div>
      <div className="galaxy-controls">
        <span>
          <Move size={12} />
          Arrastra para explorar
        </span>
        <div className="row" style={{ gap: 5 }}>
          <IconButton
            label="Alejar galaxia"
            onClick={() => {
              view.current.targetZoom = Math.max(
                0.65,
                view.current.targetZoom - 0.15,
              );
              renderRef.current();
            }}
          >
            <Minus size={14} />
          </IconButton>
          <IconButton
            label="Acercar galaxia"
            onClick={() => {
              view.current.targetZoom = Math.min(
                1.5,
                view.current.targetZoom + 0.15,
              );
              renderRef.current();
            }}
          >
            <Plus size={14} />
          </IconButton>
          <IconButton
            label={paused ? "Animar galaxia" : "Pausar galaxia"}
            onClick={() => setPaused(!paused)}
          >
            {paused ? <Play size={13} /> : <Pause size={13} />}
          </IconButton>
          <IconButton
            label="Restablecer vista"
            onClick={() => {
              view.current.targetZoom = 1;
              view.current.targetPitch = 0.6;
              view.current.targetYaw = 0.25;
              renderRef.current();
            }}
          >
            <RotateCcw size={13} />
          </IconButton>
          {!compact && (
            <IconButton
              label="Abrir universo de ideas"
              onClick={() => router.push("/ideas")}
            >
              <Maximize2 size={13} />
            </IconButton>
          )}
        </div>
      </div>
    </div>
  );
}
