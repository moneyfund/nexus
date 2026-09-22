"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Pause,
  Play,
  Plus,
  ArrowUpRight,
  Check,
  AudioLines,
} from "lucide-react";
import { useNexus } from "./nexus-provider";
import {
  Button,
  Badge,
  Modal,
  ProgressRing,
  ModuleFrame,
  Label,
  Empty,
} from "./ui/primitives";
import { flowElapsed } from "@/domain/selectors";
import type { FlowSession } from "@/domain/models";
export function formatTime(seconds: number) {
  const s = Math.max(0, Math.floor(seconds));
  return [Math.floor(s / 3600), Math.floor((s % 3600) / 60), s % 60]
    .map((v) => String(v).padStart(2, "0"))
    .join(":");
}
function FocusEnvironment({ flow }: { flow: FlowSession }) {
  const n = useNexus();
  const [now, setNow] = useState(() => Date.now());
  const [done, setDone] = useState(false);
  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(interval);
  }, []);
  const seconds = flowElapsed(flow, now);
  const remaining = flow.durationMinutes * 60 - seconds;
  const percent = Math.min(100, (seconds / (flow.durationMinutes * 60)) * 100);
  const p = n.projects.find((p) => p.id === flow.projectId);
  return (
    <div className={"focus-environment " + (flow.pausedAt ? "is-paused" : "")}>
      <div className="focus-project">
        <Badge active>
          {flow.pausedAt
            ? "EN PAUSA"
            : remaining <= 0
              ? "TIEMPO PLANIFICADO ALCANZADO"
              : "SESIÓN PROTEGIDA"}
        </Badge>
        <span>{flow.projectName}</span>
        <h2>{flow.title}</h2>
      </div>
      <div className="focus-clock">
        <div className="focus-aura" aria-hidden="true" />
        <svg viewBox="0 0 320 320" aria-hidden="true">
          <circle cx="160" cy="160" r="148" className="ring-track" />
          <circle
            cx="160"
            cy="160"
            r="148"
            className="ring-value"
            pathLength="100"
            strokeDasharray={`${percent} 100`}
          />
        </svg>
        <div className="focus-time">
          <Label>
            {remaining >= 0 ? "TIEMPO RESTANTE" : "TIEMPO ADICIONAL"}
          </Label>
          <time>{formatTime(Math.abs(remaining))}</time>
          <span>
            {Math.round(percent)}% del bloque · {flow.durationMinutes} min
          </span>
        </div>
      </div>
      <label className="focus-check">
        <input
          type="checkbox"
          checked={done}
          onChange={(e) => setDone(e.target.checked)}
        />
        <span>Conseguí el resultado de esta tarea</span>
      </label>
      <div className="focus-actions">
        <Button variant="secondary" onClick={() => n.openCapture("idea")}>
          <Plus size={16} />
          Capture
        </Button>
        <Button variant="secondary" onClick={() => n.run(n.actions.pauseFlow)}>
          {flow.pausedAt ? <Play size={16} /> : <Pause size={16} />}
          {flow.pausedAt ? "Continuar" : "Pausar"}
        </Button>
        <Button onClick={() => n.endFlow(done)}>
          <Check size={16} />
          Terminar sesión
        </Button>
      </div>
      <div className="focus-foot">
        <span>Solo esta tarea. Todo lo demás puede esperar.</span>
        <span>
          {p?.tasks.filter((t) => t.completed).length ?? 0} /{" "}
          {p?.tasks.length ?? 0} tareas del proyecto
        </span>
      </div>
    </div>
  );
}
export function FlowFocus() {
  const n = useNexus();
  return (
    <>
      <Modal
        open={!!n.activeFlow}
        onClose={() => n.endFlow(false)}
        title="NEXUS FLOW"
        full
      >
        {n.activeFlow && (
          <FocusEnvironment key={n.activeFlow.id} flow={n.activeFlow} />
        )}
      </Modal>
      <Modal
        open={!!n.flowResult}
        onClose={() => n.setFlowResult(null)}
        title="Una sesión. Un avance."
      >
        {n.flowResult && (
          <div className="flow-result">
            <ProgressRing
              value={
                n.flowResult.completed
                  ? 100
                  : Math.min(
                      100,
                      ((n.flowResult.elapsedSeconds ?? 0) /
                        (n.flowResult.durationMinutes * 60)) *
                        100,
                    )
              }
              size={150}
              caption={n.flowResult.completed ? "COMPLETADA" : "REGISTRADA"}
            />
            <h3>{n.flowResult.title}</h3>
            <div className="result-times">
              <div>
                <Label>REAL</Label>
                <strong>{formatTime(n.flowResult.elapsedSeconds ?? 0)}</strong>
              </div>
              <div>
                <Label>ESTIMADO</Label>
                <strong>{n.flowResult.durationMinutes} min</strong>
              </div>
            </div>
            <p>
              {n.flowResult.completed
                ? "Tarea completada y tiempo añadido al proyecto."
                : "Tiempo registrado. La tarea sigue pendiente."}
            </p>
            <Link
              href={"/projects/" + n.flowResult.projectId}
              className="button button-secondary"
              onClick={() => n.setFlowResult(null)}
            >
              Ver siguiente acción
              <ArrowUpRight size={16} />
            </Link>
            <Button onClick={() => n.setFlowResult(null)}>
              Volver a NEXUS
            </Button>
          </div>
        )}
      </Modal>
    </>
  );
}
export function FlowView() {
  const n = useNexus();
  const [minutes, setMinutes] = useState(25);
  const tasks = n.projects
    .filter((p) => p.status === "active")
    .flatMap((p) => p.tasks.filter((t) => !t.completed).map((t) => ({ p, t })));
  return (
    <ModuleFrame
      eyebrow="Focus environment / 04"
      title="Flow"
      description="Cierra el ruido. Abre espacio para una sola cosa."
    >
      <div className="flow-launch">
        <AudioLines size={45} strokeWidth={1} />
        <h2>Elige tu próximo avance.</h2>
        <div className="row wrap">
          {[25, 50, 90].map((m) => (
            <button
              className={
                "button " +
                (minutes === m ? "button-primary" : "button-secondary")
              }
              key={m}
              onClick={() => setMinutes(m)}
            >
              {m} min
            </button>
          ))}
        </div>
      </div>
      <div className="flow-task-list">
        {tasks.map(({ p, t }) => (
          <button
            key={t.id}
            className="flow-task"
            onClick={() => n.startFlow(p.id, t.id, minutes)}
          >
            <div>
              <Label>{p.name}</Label>
              <h3>{t.title}</h3>
              <span className="small muted">
                {t.estimatedMinutes} min estimados
              </span>
            </div>
            <Play size={20} />
          </button>
        ))}
      </div>
      {!tasks.length && (
        <Empty
          title="Un momento para decidir."
          text="Agrega una tarea a un proyecto activo antes de entrar en Flow."
          onAction={() => n.openCapture("task")}
        />
      )}
      <section className="section">
        <Label>SESIONES RECIENTES</Label>
        {n.data.flows.slice(0, 10).map((f) => (
          <div className="activity-row" key={f.id}>
            <div>
              <h3>{f.title}</h3>
              <span className="small muted">
                {f.projectName} ·{" "}
                {new Date(f.startedAt).toLocaleDateString("es-NI")}
              </span>
            </div>
            <span className="accent mono">
              {formatTime(f.elapsedSeconds ?? 0)}
            </span>
          </div>
        ))}
        {!n.data.flows.length && (
          <p className="muted" style={{ marginTop: 20 }}>
            Tu primera sesión marcará el comienzo del registro.
          </p>
        )}
      </section>
    </ModuleFrame>
  );
}
