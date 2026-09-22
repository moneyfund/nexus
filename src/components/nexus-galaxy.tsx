"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { BrainCircuit, Lightbulb, Maximize2, Sparkles, X } from "lucide-react";
import { useNexus } from "@/components/nexus-provider";

type Star = {
  x: number;
  y: number;
  z: number;
  size: number;
  alpha: number;
  hue: number;
};

function seededStars(count: number): Star[] {
  let seed = 918273;
  const rand = () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };

  return Array.from({ length: count }, () => {
    const arm = Math.floor(rand() * 5);
    const radius = Math.pow(rand(), 0.62);
    const angle = arm * ((Math.PI * 2) / 5) + radius * 5.6 + (rand() - 0.5) * 0.85;
    return {
      x: Math.cos(angle) * radius * 6.8 + (rand() - 0.5) * 0.6,
      y: (rand() - 0.5) * (0.42 + radius * 0.8),
      z: Math.sin(angle) * radius * 6.8 + (rand() - 0.5) * 0.6,
      size: 0.55 + rand() * 1.8,
      alpha: 0.24 + rand() * 0.76,
      hue: rand() > 0.7 ? 322 : rand() > 0.45 ? 292 : 270,
    };
  });
}

const fallbackIdeas = [
  "Sistema automático de presupuestos",
  "Automatizar seguimiento de clientes",
  "Mapa inteligente de oportunidades",
  "Asistente de inversión personal",
];

export function NexusGalaxy() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const shellRef = useRef<HTMLDivElement | null>(null);
  const pointer = useRef({ x: 0, y: 0, tx: 0, ty: 0 });
  const drag = useRef({ active: false, x: 0, y: 0 });
  const rotation = useRef({ x: -0.18, y: 0.4, targetX: -0.18, targetY: 0.4 });
  const [selectedIdea, setSelectedIdea] = useState<{ id: string; content: string; type: string; createdAt?: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const { inbox } = useNexus();

  const stars = useMemo(() => seededStars(920), []);
  const ideas = useMemo(() => {
    const real = inbox
      .filter((item) => item.type === "idea")
      .slice(0, 7)
      .map((item) => ({ id: item.id, content: item.content, type: item.type, createdAt: item.createdAt }));

    if (real.length >= 4) return real;

    return [
      ...real,
      ...fallbackIdeas.slice(0, 4 - real.length).map((content, index) => ({
        id: "fallback-" + index,
        content,
        type: "idea",
      })),
    ];
  }, [inbox]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const shell = shellRef.current;
    if (!canvas || !shell) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let frame = 0;
    let animationFrame = 0;
    let width = 1;
    let height = 1;
    let dpr = 1;

    const resize = () => {
      const rect = shell.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 1.7);
      width = Math.max(1, rect.width);
      height = Math.max(1, rect.height);
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = width + "px";
      canvas.style.height = height + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const observer = new ResizeObserver(resize);
    observer.observe(shell);
    resize();

    const render = () => {
      frame += 0.0048;
      pointer.current.x += (pointer.current.tx - pointer.current.x) * 0.055;
      pointer.current.y += (pointer.current.ty - pointer.current.y) * 0.055;
      rotation.current.x += (rotation.current.targetX - rotation.current.x) * 0.05;
      rotation.current.y += (rotation.current.targetY - rotation.current.y) * 0.05;

      ctx.clearRect(0, 0, width, height);

      const centerX = width * 0.5;
      const centerY = height * 0.5;
      const scale = Math.min(width, height) * 0.082;

      const bg = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, Math.max(width, height) * 0.52);
      bg.addColorStop(0, "rgba(255, 57, 214, .11)");
      bg.addColorStop(0.24, "rgba(183, 64, 255, .075)");
      bg.addColorStop(0.58, "rgba(104, 32, 205, .026)");
      bg.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, width, height);

      const rx = rotation.current.x + pointer.current.y * 0.22;
      const ry = rotation.current.y + pointer.current.x * 0.32 + frame;
      const cosX = Math.cos(rx);
      const sinX = Math.sin(rx);
      const cosY = Math.cos(ry);
      const sinY = Math.sin(ry);

      const projected: Array<{ sx: number; sy: number; z: number; star: Star }> = [];
      for (const star of stars) {
        let x = star.x;
        let y = star.y;
        let z = star.z;

        const x1 = x * cosY - z * sinY;
        const z1 = x * sinY + z * cosY;
        const y1 = y * cosX - z1 * sinX;
        const z2 = y * sinX + z1 * cosX;

        const perspective = 13 / (13 + z2);
        projected.push({
          sx: centerX + x1 * scale * perspective,
          sy: centerY + y1 * scale * perspective,
          z: z2,
          star,
        });
      }

      projected.sort((a, b) => a.z - b.z);

      for (const point of projected) {
        const depth = Math.max(0.2, Math.min(1.4, (point.z + 7) / 10));
        const alpha = point.star.alpha * (0.35 + depth * 0.65);
        const size = point.star.size * (0.55 + depth * 0.75);

        ctx.beginPath();
        ctx.arc(point.sx, point.sy, size, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${point.star.hue}, 95%, ${point.star.hue > 310 ? 72 : 78}%, ${alpha})`;
        ctx.shadowBlur = size > 1.4 ? 10 : 4;
        ctx.shadowColor = point.star.hue > 310 ? "rgba(255,63,210,.68)" : "rgba(177,94,255,.62)";
        ctx.fill();
      }

      ctx.shadowBlur = 0;

      const coreRadius = Math.min(width, height) * 0.105;
      const core = ctx.createRadialGradient(centerX - coreRadius * 0.22, centerY - coreRadius * 0.28, 0, centerX, centerY, coreRadius * 1.45);
      core.addColorStop(0, "rgba(255,255,255,.96)");
      core.addColorStop(0.08, "rgba(255,184,246,.92)");
      core.addColorStop(0.24, "rgba(255,55,205,.68)");
      core.addColorStop(0.48, "rgba(174,54,255,.36)");
      core.addColorStop(0.72, "rgba(86,19,160,.14)");
      core.addColorStop(1, "rgba(0,0,0,0)");

      ctx.fillStyle = core;
      ctx.beginPath();
      ctx.arc(centerX, centerY, coreRadius * 1.45, 0, Math.PI * 2);
      ctx.fill();

      for (let ring = 0; ring < 3; ring++) {
        ctx.save();
        ctx.translate(centerX, centerY);
        ctx.rotate(frame * (ring % 2 ? -1.6 : 1.15) + ring);
        ctx.scale(1, 0.28 + ring * 0.09);
        ctx.strokeStyle = ring === 0 ? "rgba(255,91,214,.34)" : "rgba(181,92,255,.2)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.ellipse(0, 0, coreRadius * (1.55 + ring * 0.55), coreRadius * (1.55 + ring * 0.55), 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      animationFrame = requestAnimationFrame(render);
    };

    animationFrame = requestAnimationFrame(render);
    return () => {
      cancelAnimationFrame(animationFrame);
      observer.disconnect();
    };
  }, [stars]);

  function onPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const nx = ((event.clientX - rect.left) / rect.width - 0.5) * 2;
    const ny = ((event.clientY - rect.top) / rect.height - 0.5) * 2;

    pointer.current.tx = nx;
    pointer.current.ty = ny;

    if (drag.current.active) {
      const dx = event.clientX - drag.current.x;
      const dy = event.clientY - drag.current.y;
      drag.current.x = event.clientX;
      drag.current.y = event.clientY;
      rotation.current.targetY += dx * 0.007;
      rotation.current.targetX += dy * 0.005;
      rotation.current.targetX = Math.max(-0.75, Math.min(0.5, rotation.current.targetX));
    }
  }

  function onPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    drag.current = { active: true, x: event.clientX, y: event.clientY };
    setIsDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function endDrag(event: React.PointerEvent<HTMLDivElement>) {
    drag.current.active = false;
    setIsDragging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  return (
    <>
      <div
        ref={shellRef}
        onPointerMove={onPointerMove}
        onPointerDown={onPointerDown}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        className={"relative h-[430px] w-full select-none overflow-hidden rounded-[32px] border border-fuchsia-300/10 bg-black/20 [touch-action:none] sm:h-[520px] " + (isDragging ? "cursor-grabbing" : "cursor-grab")}
      >
        <canvas ref={canvasRef} className="absolute inset-0" />

        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,transparent_43%,rgba(3,3,6,.18)_67%,rgba(3,3,6,.78)_100%)]" />
        <div className="pointer-events-none absolute left-5 top-5 z-20 flex items-center gap-2 rounded-full border border-white/[.07] bg-black/40 px-3 py-2 text-[9px] font-semibold uppercase tracking-[.18em] text-[#a99dad] backdrop-blur-xl">
          <Maximize2 size={12} className="text-fuchsia-300" />
          Arrastra para orbitar
        </div>

        <div className="pointer-events-none absolute inset-0">
          <div className="absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2 text-center">
            <motion.div
              animate={{ scale: [1, 1.05, 1], opacity: [.88, 1, .88] }}
              transition={{ repeat: Infinity, duration: 3.6, ease: "easeInOut" }}
              className="mx-auto grid h-16 w-16 place-items-center rounded-full border border-fuchsia-200/25 bg-black/25 shadow-[0_0_55px_rgba(255,63,210,.32)] backdrop-blur-sm"
            >
              <BrainCircuit size={25} className="text-white" />
            </motion.div>
            <div className="mt-4 text-[10px] font-semibold uppercase tracking-[.26em] text-fuchsia-100/60">Nexus Core</div>
          </div>
        </div>

        <div className="absolute inset-0 z-30">
          {ideas.map((idea, index) => {
            const angle = (index / Math.max(ideas.length, 1)) * Math.PI * 2;
            const radiusX = 35 + (index % 2) * 8;
            const radiusY = 25 + ((index + 1) % 2) * 7;
            const left = 50 + Math.cos(angle) * radiusX;
            const top = 50 + Math.sin(angle) * radiusY;

            return (
              <motion.button
                key={idea.id}
                type="button"
                onPointerDown={(event) => event.stopPropagation()}
                onClick={() => setSelectedIdea(idea)}
                animate={{ y: [0, -8 - (index % 3) * 2, 0], rotate: [0, index % 2 ? 2 : -2, 0] }}
                transition={{ duration: 4.8 + index * .55, repeat: Infinity, ease: "easeInOut", delay: index * .18 }}
                whileHover={{ scale: 1.08, zIndex: 50 }}
                className="absolute max-w-[150px] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-fuchsia-300/20 bg-[#100813]/70 px-3 py-2.5 text-left shadow-[0_12px_34px_rgba(0,0,0,.35),0_0_24px_rgba(232,67,255,.08)] backdrop-blur-xl"
                style={{ left: left + "%", top: top + "%" }}
              >
                <div className="flex items-center gap-2">
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-xl border border-fuchsia-200/15 bg-fuchsia-400/[.08]">
                    <Lightbulb size={13} className="text-fuchsia-200" />
                  </span>
                  <span className="line-clamp-2 text-[10px] font-medium leading-4 text-white/90">{idea.content}</span>
                </div>
              </motion.button>
            );
          })}
        </div>

        <div className="pointer-events-none absolute bottom-5 left-1/2 z-20 -translate-x-1/2 rounded-full border border-white/[.06] bg-black/35 px-4 py-2 text-[9px] uppercase tracking-[.16em] text-[#817583] backdrop-blur-xl">
          Tus ideas orbitan fuera de la prioridad actual
        </div>
      </div>

      <AnimatePresence>
        {selectedIdea && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[110] flex items-center justify-center bg-black/70 p-4 backdrop-blur-md"
            onMouseDown={(event) => event.target === event.currentTarget && setSelectedIdea(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: .94, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: .96, y: 10 }}
              className="relative w-full max-w-lg overflow-hidden rounded-[30px] border border-fuchsia-300/20 bg-[#09050d]/95 p-6 shadow-[0_30px_100px_rgba(0,0,0,.65),0_0_70px_rgba(219,39,119,.12)]"
            >
              <div className="absolute right-[-80px] top-[-100px] h-56 w-56 rounded-full bg-fuchsia-500/15 blur-[75px]" />
              <div className="relative">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[.2em] text-fuchsia-200/70">
                      <Sparkles size={13} /> Idea node
                    </div>
                    <h3 className="mt-4 text-2xl font-semibold tracking-[-.03em] text-white">{selectedIdea.content}</h3>
                  </div>
                  <button onClick={() => setSelectedIdea(null)} className="rounded-full border border-white/10 p-2 text-white/50 hover:text-white"><X size={16} /></button>
                </div>
                <div className="mt-6 grid grid-cols-2 gap-3">
                  <div className="rounded-2xl border border-white/[.06] bg-white/[.025] p-4">
                    <div className="text-[9px] uppercase tracking-[.16em] text-white/40">Estado</div>
                    <div className="mt-2 text-sm text-white/85">En Idea Vault</div>
                  </div>
                  <div className="rounded-2xl border border-white/[.06] bg-white/[.025] p-4">
                    <div className="text-[9px] uppercase tracking-[.16em] text-white/40">Prioridad</div>
                    <div className="mt-2 text-sm text-white/85">Sin asignar</div>
                  </div>
                </div>
                <p className="mt-5 text-sm leading-6 text-white/55">
                  Esta idea existe en NEXUS pero todavía no compite con tus proyectos activos. Más adelante podremos convertirla en oportunidad, proyecto o descartarla desde aquí.
                </p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
