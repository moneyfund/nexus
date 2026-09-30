"use client";
import { useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowUpRight,
  Play,
  Check,
  Plus,
  Orbit,
  Wallet,
  CalendarDays,
  Inbox,
  Layers3,
} from "lucide-react";
import { useNexus } from "./nexus-provider";
import {
  Badge,
  Button,
  Empty,
  Label,
  SectionHeading,
  Tabs,
} from "./ui/primitives";
import {
  amountToUSD,
  dateKey,
  money,
  projectFinance,
} from "@/domain/selectors";
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
  const [context, setContext] = useState("today");
  const active = n.projects.filter((p) => p.status === "active");
  const ranked = [...active].sort(
    (a, b) =>
      ({ critical: 0, high: 1, medium: 2, low: 3 })[a.priority] -
      { critical: 0, high: 1, medium: 2, low: 3 }[b.priority],
  );
  const project = ranked.find((p) => p.tasks.some((t) => !t.completed));
  const task = project?.tasks.find((t) => !t.completed);
  const outcomes = ranked.slice(0, 3).flatMap((p) => {
    const t = p.tasks.find((t) => !t.completed);
    return t ? [{ p, t }] : [];
  });
  const timezone = n.data.user.preferences.timezone;
  const today = dateKey(new Date(), timezone);
  const blocks = n.data.events
    .filter((e) => dateKey(new Date(e.start), timezone) === today)
    .sort((a, b) => +new Date(a.start) - +new Date(b.start));
  const ideas = n.data.ideas.filter((i) => i.status !== "archived");
  const inbox = n.inbox.filter((i) => !i.processed);
  const receivable = n.projects.reduce(
    (sum, p) => sum + projectFinance(n.data, p).receivable,
    0,
  );
  const accounts = n.data.financialAccounts ?? [];
  const liquidity = accounts.reduce(
    (sum, a) => sum + amountToUSD(n.data, a.balance, a.currency),
    0,
  );
  return (
    <div className="today-view spatial-dashboard">
      <section className="universe-stage" aria-label="Tu universo de proyectos">
        <div className="universe-hud">
          <Label>
            PERSONAL INTELLIGENCE / {n.data.user.name.split(" ")[0]}
          </Label>
          <NexusNetworkClock />
        </div>
        <div className="universe-layout">
          <div className="universe-copy">
            <span className="universe-edition">
              NEXUS OS <span>01 — CORE</span>
            </span>
            <h1>
              Todo conecta.
              <br />
              <em>Tú diriges.</em>
            </h1>
            <p>
              Un espacio para pensar.
              <br />
              Una dirección para avanzar.
            </p>
            <div className="universe-actions">
              <Button onClick={() => router.push("/ai")}>
                <Orbit size={16} />
                Hablar con NEXUS
              </Button>
              <Button variant="ghost" onClick={() => n.openCapture()}>
                <Plus size={16} />
                Capturar
              </Button>
            </div>
            <div className="universe-readout">
              <Link href="/projects">
                <strong>{String(active.length).padStart(2, "0")}</strong>
                <span>EN ÓRBITA ACTIVA</span>
              </Link>
              <Link href="/ideas">
                <strong>{String(ideas.length).padStart(2, "0")}</strong>
                <span>IDEAS</span>
              </Link>
            </div>
            <div className="universe-legend">
              <span>
                <i />
                Activo
              </span>
              <span>
                <i />
                Espera
              </span>
              <span>
                <i />
                Backlog
              </span>
              <span>
                <i />
                Completo
              </span>
            </div>
          </div>
          <div className="universe-scene">
            <Galaxy />
          </div>
        </div>
      </section>
      <section className="directive-band spatial-directive">
        <div className="directive-marker">
          <span />
          <Label>
            NEXT
            <br />
            ACTION
          </Label>
        </div>
        <div className="directive-copy">
          <span className="small accent">
            {project?.name ?? "Tu siguiente paso"}
          </span>
          <h2>
            {task?.title ??
              (n.projects.length
                ? "Dale una próxima acción a tu proyecto."
                : "Empieza tu primera misión.")}
          </h2>
          <p>
            {task
              ? `${task.estimatedMinutes} min · ${project?.priority === "critical" ? "Prioridad crítica" : "Concentración"}`
              : "Un proyecto. Una tarea. Un avance."}
          </p>
        </div>
        {task && project ? (
          <Button onClick={() => n.startFlow(project.id, task.id)}>
            <Play size={14} fill="currentColor" />
            Iniciar Flow
          </Button>
        ) : (
          <Button
            onClick={() =>
              n.openCapture(n.projects.length ? "task" : "project")
            }
          >
            <Plus size={15} />
            {n.projects.length ? "Crear tarea" : "Crear proyecto"}
          </Button>
        )}
      </section>
      <div className="overview-strip" aria-label="Resumen de tu espacio">
        <Link href="/finance">
          <Wallet size={17} />
          <div>
            <span>LIQUIDEZ REGISTRADA</span>
            <strong>{accounts.length ? money(liquidity) : "Sin saldo"}</strong>
          </div>
          <small>
            {accounts.length
              ? `${accounts.length} cuentas · USD equivalente`
              : "Registra tus cuentas"}
          </small>
        </Link>
        <Link href="/finance">
          <span className="overview-glyph">↗</span>
          <div>
            <span>POR COBRAR</span>
            <strong>{money(receivable)}</strong>
          </div>
          <small>En tus proyectos</small>
        </Link>
        <button onClick={() => setContext("inbox")}>
          <Inbox size={17} />
          <div>
            <span>POR ORGANIZAR</span>
            <strong>{String(inbox.length).padStart(2, "0")}</strong>
          </div>
          <small>Capturas pendientes</small>
        </button>
      </div>
      <section className="context-deck">
        <div className="context-deck-heading">
          <Label>YOUR WORKSPACE</Label>
          <Tabs
            value={context}
            onChange={setContext}
            label="Contexto del inicio"
            items={[
              {
                value: "today",
                label: "Hoy",
                icon: <CalendarDays size={15} />,
              },
              {
                value: "projects",
                label: "Misiones",
                icon: <Layers3 size={15} />,
              },
              {
                value: "inbox",
                label: `Inbox · ${inbox.length}`,
                icon: <Inbox size={15} />,
              },
            ]}
          />
        </div>
        {context === "today" && (
          <div className="split dashboard-today">
            <section>
              <SectionHeading
                label="PRIORIDADES"
                title="Lo que mueve tu día."
              />
              <div className="outcome-list">
                {outcomes.map(({ p, t }, index) => (
                  <div key={p.id} className="outcome-row">
                    <span className="outcome-number">0{index + 1}</span>
                    <div>
                      <Link
                        href={"/project?id=" + encodeURIComponent(p.id)}
                        className="small muted"
                      >
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
                  title="Espacio para avanzar."
                  text="Agrega una tarea a uno de tus proyectos activos."
                  onAction={() => n.openCapture("task")}
                />
              )}
            </section>
            <section>
              <SectionHeading
                label="TIEMPO"
                title="Tu trayectoria de hoy."
                action={
                  <Link href="/calendar" className="inline-arrow">
                    Calendario
                    <ArrowUpRight size={15} />
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
                        timeZone: timezone,
                      })}
                    </div>
                    <div className={"timeline-axis " + (!i ? "current" : "")}>
                      <span />
                    </div>
                    <div className="day-block-content">
                      <h3>{b.title}</h3>
                      <span className="small muted">
                        {Math.round(
                          (+new Date(b.end) - +new Date(b.start)) / 60000,
                        )}{" "}
                        min ·{" "}
                        {n.projects.find((p) => p.id === b.projectId)?.name ??
                          b.category}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
              {!blocks.length && (
                <Empty
                  title="Tu tiempo está abierto."
                  text="Reserva un bloque para tu próxima acción."
                  onAction={() => router.push("/calendar")}
                  action="Planificar"
                />
              )}
            </section>
          </div>
        )}
        {context === "projects" && (
          <section>
            <SectionHeading
              label="MISSION CONTROL"
              title="Frentes en movimiento."
              action={
                <Link href="/projects" className="inline-arrow">
                  Todos los proyectos
                  <ArrowUpRight size={15} />
                </Link>
              }
            />
            <div className="project-ledger">
              {active.map((p, index) => (
                <Link
                  key={p.id}
                  href={"/project?id=" + encodeURIComponent(p.id)}
                  className="ledger-row"
                >
                  <span className="ledger-index">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <div>
                    <h3>{p.name}</h3>
                    <span className="small muted">
                      {p.nextAction || p.area}
                    </span>
                  </div>
                  <div className="ledger-progress">
                    <span style={{ width: p.progress + "%" }} />
                  </div>
                  <span className="ledger-percent">{p.progress}%</span>
                  <span className="ledger-deadline">{p.deadline}</span>
                  <ArrowUpRight size={16} />
                </Link>
              ))}
            </div>
            <div className="capacity-note">
              <Badge active>{active.length}/5 ACTIVOS</Badge>
              <p>
                {active.length >= 5
                  ? "Capacidad completa. Protege lo que ya empezaste."
                  : `${5 - active.length} espacios para nuevos frentes.`}
              </p>
            </div>
            {!active.length && (
              <Empty
                text="Tus proyectos activos aparecerán aquí."
                onAction={() => n.openCapture("project")}
              />
            )}
          </section>
        )}
        {context === "inbox" && (
          <section>
            <SectionHeading
              label="CAPTURE STREAM"
              title="Nada se pierde."
              action={
                <Link href="/ideas" className="inline-arrow">
                  Abrir Ideas
                  <ArrowUpRight size={15} />
                </Link>
              }
            />
            {inbox.map((item) => (
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
              <Empty
                title="Todo en su lugar."
                text="Captura una idea sin interrumpir lo que estás haciendo."
                onAction={() => n.openCapture()}
              />
            )}
          </section>
        )}
      </section>
    </div>
  );
}
