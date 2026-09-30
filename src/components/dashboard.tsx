"use client";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  ArrowUpRight,
  Play,
  Check,
  Plus,
  ArrowDown,
  Orbit,
  Database,
  Mic,
  Wallet,
  ListTodo,
} from "lucide-react";
import { motion } from "motion/react";
import { useNexus } from "./nexus-provider";
import { Badge, Button, Empty, Label, SectionHeading } from "./ui/primitives";
import { dateKey, money, projectFinance } from "@/domain/selectors";
import { NexusNetworkClock } from "./nexus-network-clock";
const Galaxy = dynamic(
  () => import("./nexus-galaxy").then((m) => m.NexusGalaxy),
  {
    ssr: false,
    loading: () => (
      <div className="loading-core">
        <Orbit size={30} />
        <Label>INITIALIZING CORE</Label>
      </div>
    ),
  },
);
export function Dashboard() {
  const n = useNexus();
  const router = useRouter();
  const active = n.projects.filter((p) => p.status === "active");
  const ranked = [...active].sort(
    (a, b) =>
      ({ critical: 0, high: 1, medium: 2, low: 3 })[a.priority] -
      { critical: 0, high: 1, medium: 2, low: 3 }[b.priority],
  );
  const project = ranked.find((p) => p.tasks.some((t) => !t.completed));
  const task = project?.tasks.find((t) => !t.completed);
  const outcomes = ranked.slice(0, 3).flatMap((p) => {
    const t = p.tasks.find((t) => !t.completed) ?? p.tasks[0];
    return t ? [{ p, t }] : [];
  });
  const today = dateKey();
  const blocks = n.data.events
    .filter((e) => dateKey(new Date(e.start)) === today)
    .sort((a, b) => +new Date(a.start) - +new Date(b.start));
  const ideas = n.data.ideas.filter((i) => i.status !== "archived");
  const inbox = n.inbox.filter((i) => !i.processed);
  const receivable = n.projects.reduce(
    (s, p) => s + projectFinance(n.data, p).receivable,
    0,
  );
  const reveal = n.reduceMotion
    ? {}
    : {
        initial: { opacity: 0, y: 18 },
        whileInView: { opacity: 1, y: 0 },
        viewport: { once: true, amount: 0.15 },
        transition: { duration: 0.5 },
      };
  return (
    <div className="today-view">
      <section className="core-stage immersive-core">
        <div className="core-hud-line">
          <span className="hud-label">
            NEXUS // {n.data.user.name.split(" ")[0].toUpperCase()} // PERSONAL OS
          </span>
          <NexusNetworkClock />
        </div>
        <div className="core-copy">
          <div className="core-eyebrow">
            <span className="core-index">01 //</span>
            <Label>INTELLIGENCE CORE</Label>
          </div>
          <h1>
            Tu universo,
            <br />
            <em>en movimiento.</em>
          </h1>
          <p>
            Proyectos, decisiones y capital orbitando un mismo núcleo.
          </p>
          <div className="core-primary-actions">
            <button className="core-capture" onClick={() => n.openCapture()}>
              <Plus size={16} />
              <span>Capturar</span>
            </button>
            <button className="core-capture secondary" onClick={() => router.push("/ai")}>
              <Orbit size={16} />
              <span>Entrar a NEXUS AI</span>
            </button>
          </div>
          <div className="core-stats">
            <span>
              <strong>{String(active.length).padStart(2, "0")}</strong>ACTIVOS
            </span>
            <span>
              <strong>{String(n.projects.length).padStart(2, "0")}</strong>PROYECTOS
            </span>
            <span>
              <strong>{String(ideas.length).padStart(2, "0")}</strong>IDEAS
            </span>
          </div>
        </div>
        <div className="core-space">
          <Galaxy />
        </div>
        <div className="core-bottom-label">
          <span>INNER ORBIT = ACTIVE</span>
          <ArrowDown size={13} />
          <span>DRAG · EXPLORE · OPEN</span>
        </div>
      </section>
      {n.projects.length === 0 && (
        <motion.section {...reveal} className="surface" style={{ margin: "18px 0 26px", padding: 24 }}>
          <div className="row wrap" style={{ justifyContent: "space-between", gap: 18 }}>
            <div style={{ maxWidth: 620 }}>
              <Label>NUEVO WORKSPACE / PRIVADO</Label>
              <h2 style={{ marginTop: 10 }}>Construye tu primer sistema personal.</h2>
              <p className="muted" style={{ marginTop: 8 }}>
                Empieza con un proyecto real. Después NEXUS puede ayudarte a
                organizar tareas, registrar dinero, planificar y razonar con tu contexto.
              </p>
            </div>
            <Button onClick={() => n.openCapture("project")}>
              <Plus size={15} />
              Crear primer proyecto
            </Button>
          </div>
          <div className="row wrap" style={{ gap: 10, marginTop: 18 }}>
            <Badge active>1 · PROYECTO</Badge>
            <Badge>2 · TAREAS Y DINERO</Badge>
            <Badge>3 · NEXUS AI</Badge>
          </div>
        </motion.section>
      )}
      <motion.section {...reveal} className="nexus-action-dock" aria-label="Accesos rápidos">
        <button type="button" onClick={() => n.openCapture()}>
          <Plus size={17} />
          <span>CAPTURE</span>
        </button>
        <button type="button" onClick={() => router.push("/ai")}>
          <Orbit size={17} />
          <span>NEXUS AI</span>
        </button>
        <button type="button" onClick={() => router.push("/projects")}>
          <ListTodo size={17} />
          <span>PROJECTS</span>
        </button>
        <button type="button" onClick={() => router.push("/finance")}>
          <Wallet size={17} />
          <span>FINANCE</span>
        </button>
      </motion.section>
      <motion.section {...reveal} className="directive-band">
        <div className="directive-marker">
          <span />
          <Label>
            CURRENT
            <br />
            DIRECTIVE
          </Label>
        </div>
        <div className="directive-copy">
          <span className="small accent">
            {project?.name ?? "Un nuevo comienzo"}
          </span>
          <h2>{task?.title ?? "Elige qué quieres hacer avanzar hoy."}</h2>
          <p>
            {task
              ? `${task.estimatedMinutes} min estimados · ${project?.priority === "critical" ? "Prioridad crítica" : "Próxima acción"} · Una cosa a la vez`
              : "Captura una tarea y dale un espacio en tu día."}
          </p>
        </div>
        <Button
          disabled={!task || !project}
          onClick={() => project && task && n.startFlow(project.id, task.id)}
        >
          <Play size={14} fill="currentColor" />
          START FLOW
          <ArrowUpRight size={15} />
        </Button>
      </motion.section>
      <div className="split section">
        <motion.section {...reveal}>
          <SectionHeading
            number="02"
            label="TOP 3 OUTCOMES"
            title="Haz que hoy cuente."
          />
          <div className="outcome-list">
            {outcomes.map(({ p, t }, index) => (
              <div key={p.id} className="outcome-row">
                <span className="outcome-number">0{index + 1}</span>
                <div>
                  <Link href={"/project?id=" + encodeURIComponent(p.id)} className="small muted">
                    {p.name}
                  </Link>
                  <h3>{t.title}</h3>
                  <span className="outcome-duration">
                    {t.estimatedMinutes} MIN
                  </span>
                </div>
                <button
                  className={"task-check " + (t.completed ? "checked" : "")}
                  aria-label={"Completar " + t.title}
                  aria-pressed={t.completed}
                  onClick={() => n.toggleTask(p.id, t.id)}
                >
                  {t.completed && <Check size={13} />}
                </button>
              </div>
            ))}
          </div>
          {!outcomes.length && (
            <Empty
              text="Tus próximos resultados aparecerán al agregar tareas a proyectos activos."
              onAction={() => n.openCapture("task")}
            />
          )}
        </motion.section>
        <motion.section {...reveal}>
          <SectionHeading
            number="03"
            label="TIME ARCHITECTURE"
            title="Un día con dirección."
            action={
              <Link href="/calendar">
                <ArrowUpRight size={18} />
              </Link>
            }
          />
          <div className="day-timeline">
            {blocks.map((b, i) => (
              <Link href="/calendar" key={b.id} className="day-block">
                <div className="day-time">
                  {new Date(b.start).toLocaleTimeString("es-NI", {
                    hour: "2-digit",
                    minute: "2-digit",
                    hour12: false,
                    timeZone: n.data.user.preferences.timezone,
                  })}
                </div>
                <div className={"timeline-axis " + (!i ? "current" : "")}>
                  <span />
                </div>
                <div className="day-block-content">
                  <div className="row between">
                    <h3>{b.title}</h3>
                    <span className="small muted">
                      {Math.round(
                        (+new Date(b.end) - +new Date(b.start)) / 60000,
                      )}
                      ′
                    </span>
                  </div>
                  <div className="small muted">
                    {n.projects.find((p) => p.id === b.projectId)?.name ??
                      b.category}{" "}
                    {b.source === "demo" ? "· Demo" : ""}
                  </div>
                </div>
              </Link>
            ))}
          </div>
          {!blocks.length && (
            <Empty
              title="Tu tiempo está abierto."
              text="Reserva un bloque para tu próxima acción."
              onAction={() => {
                router.push("/calendar");
              }}
              action="Planificar hoy"
            />
          )}
        </motion.section>
      </div>
      <motion.section {...reveal} className="section">
        <SectionHeading
          number="04"
          label="CURRENT PROJECTS"
          title="Frentes en movimiento."
          action={
            <Link href="/projects" className="inline-arrow">
              Portfolio
              <ArrowUpRight size={16} />
            </Link>
          }
        />
        <div className="project-ledger">
          {active.map((p, index) => (
            <Link key={p.id} href={"/project?id=" + encodeURIComponent(p.id)} className="ledger-row">
              <span className="ledger-index">0{index + 1}</span>
              <div>
                <h3>{p.name}</h3>
                <span className="small muted">{p.area}</span>
              </div>
              <div className="ledger-progress">
                <span style={{ width: p.progress + "%" }} />
              </div>
              <span className="ledger-percent">
                {p.progress}
                <small>%</small>
              </span>
              <span className="ledger-deadline">{p.deadline}</span>
              <ArrowUpRight size={16} className="muted" />
            </Link>
          ))}
        </div>
      </motion.section>
      <div className="split section">
        <motion.section {...reveal}>
          <SectionHeading
            number="05"
            label="SYSTEM SIGNALS"
            title="Lo que merece atención."
          />
          <div className="signal-row">
            <span className="signal-index">WIP</span>
            <p>
              {active.length >= 5
                ? "Tu capacidad activa está completa. Protege lo que ya empezaste."
                : `Hay ${5 - active.length} espacios para nuevos frentes.`}
            </p>
            <Badge active>{active.length}/5</Badge>
          </div>
          <Link href="/finance" className="signal-row">
            <span className="signal-index">USD</span>
            <p>
              Saldo pendiente en tus proyectos.
              <span className="small muted">
                {" "}
                Incluye datos de demostración.
              </span>
            </p>
            <strong>{money(receivable)}</strong>
          </Link>
          <div className="signal-row nexus-backend-signal">
            <span className="signal-index">
              <Database size={15} />
            </span>
            <p>
              PostgreSQL / SQL Connect
              <span className="small muted">
                {" "}
                {n.sqlReady
                  ? "workspace personal conectado"
                  : n.sqlError
                    ? "pendiente de conexión"
                    : "inicializando"}
              </span>
            </p>
            <Badge active={n.sqlReady}>
              {n.sqlReady ? "LIVE" : "SYNC"}
            </Badge>
          </div>
          <Link href="/ai" className="ai-invitation">
            <Orbit size={25} strokeWidth={1.2} />
            <div>
              <h3>Piensa con NEXUS.</h3>
              <p>Explora el contexto de tu sistema.</p>
            </div>
            <ArrowUpRight size={18} />
          </Link>
          <Link href="/capture" className="ai-invitation">
            <Mic size={25} strokeWidth={1.2} />
            <div>
              <h3>Captura en segundos.</h3>
              <p>Gastos, tareas, ingresos, ideas y notas desde móvil.</p>
            </div>
            <ArrowUpRight size={18} />
          </Link>
        </motion.section>
        <motion.section {...reveal}>
          <SectionHeading
            number="06"
            label="INBOX"
            title="Nada se pierde."
            action={<Badge>{inbox.length} PENDIENTES</Badge>}
          />
          {inbox.slice(0, 3).map((item) => (
            <div key={item.id} className="inbox-row">
              <span className="inbox-type">{item.type}</span>
              <p>{item.content}</p>
              <button
                className="icon-button"
                aria-label={"Procesar " + item.content}
                onClick={() =>
                  n.run(
                    () => n.actions.processInbox(item.id),
                    "Entrada procesada; el registro se conserva.",
                  )
                }
              >
                <Check size={15} />
              </button>
            </div>
          ))}
          {!inbox.length && (
            <p className="muted">
              Tu Inbox está en calma. Captura cuando aparezca la siguiente idea.
            </p>
          )}
          <Link
            href="/ideas"
            className="inline-arrow"
            style={{ marginTop: 20 }}
          >
            Abrir Inbox
            <ArrowRight size={15} />
          </Link>
        </motion.section>
      </div>
    </div>
  );
}
