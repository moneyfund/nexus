"use client";
import { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowUpRight,
  Check,
  Play,
  Plus,
  Clock3,
  Paperclip,
  Users,
  GitBranch,
  Orbit,
} from "lucide-react";
import { useNexus } from "./nexus-provider";
import {
  Badge,
  Button,
  DataMetric,
  Empty,
  Label,
  Modal,
  ProgressRing,
  SectionHeading,
  Tabs,
} from "./ui/primitives";
import { money, projectFinance } from "@/domain/selectors";
import { entity } from "@/domain/seed";
import type { Project, ProjectStatus } from "@/domain/models";
function ProjectEditor({
  project,
  close,
}: {
  project: Project;
  close: () => void;
}) {
  const n = useNexus();
  const [draft, setDraft] = useState(project);
  return (
    <form
      className="stack"
      onSubmit={(e) => {
        e.preventDefault();
        n.run(() => {
          n.actions.updateProject(project.id, {
            name: draft.name.trim(),
            description: draft.description,
            priority: draft.priority,
            dueDate: draft.dueDate,
            value: draft.value,
          });
          close();
        }, "Proyecto actualizado.");
      }}
    >
      <label className="field">
        Nombre
        <input
          required
          value={draft.name}
          onChange={(e) => setDraft({ ...draft, name: e.target.value })}
        />
      </label>
      <label className="field">
        Descripción
        <textarea
          value={draft.description}
          onChange={(e) => setDraft({ ...draft, description: e.target.value })}
        />
      </label>
      <div className="form-grid">
        <label className="field">
          Fecha de entrega
          <input
            type="date"
            value={draft.dueDate ?? ""}
            onChange={(e) =>
              setDraft({ ...draft, dueDate: e.target.value || undefined })
            }
          />
        </label>
        <label className="field">
          Valor del proyecto · USD
          <input
            type="number"
            min="0"
            step=".01"
            value={draft.value ?? ""}
            onChange={(e) =>
              setDraft({
                ...draft,
                value: e.target.value ? Number(e.target.value) : undefined,
              })
            }
          />
        </label>
      </div>
      <label className="field">
        Prioridad
        <select
          value={draft.priority}
          onChange={(e) =>
            setDraft({
              ...draft,
              priority: e.target.value as Project["priority"],
            })
          }
        >
          <option value="critical">Crítica</option>
          <option value="high">Alta</option>
          <option value="medium">Media</option>
          <option value="low">Baja</option>
        </select>
      </label>
      <Button type="submit">Guardar cambios</Button>
    </form>
  );
}
export function ProjectDetail({ id }: { id: string }) {
  const n = useNexus();
  const p = n.projects.find((p) => p.id === id);
  const [tab, setTab] = useState("overview");
  const [edit, setEdit] = useState(false);
  const [milestoneTitle, setMilestoneTitle] = useState("");
  if (!p)
    return (
      <Empty
        title="Este proyecto no está en tu espacio."
        text="Vuelve al portfolio o crea un nuevo frente."
        onAction={() => n.openCapture("project")}
        action="Crear proyecto"
      />
    );
  const task = p.tasks.find((t) => !t.completed);
  const finance = projectFinance(n.data, p);
  const items = n.data.knowledge.filter((k) => k.projectId === p.id);
  const activity = n.data.activity.filter((a) => a.projectId === p.id);
  const sessions = n.data.flows.filter((f) => f.projectId === p.id);
  return (
    <div>
      <Link href="/projects" className="inline-arrow">
        <ArrowLeft size={15} />
        Portfolio
      </Link>
      <header className="project-command-heading">
        <div>
          <Label>PROJECT COMMAND / {p.area}</Label>
          <h1>{p.name}</h1>
          <p>{p.description}</p>
          <div className="row wrap">
            <Badge active>{p.priority.toUpperCase()}</Badge>
            {p.source === "demo" && <Badge>DATOS DEMO</Badge>}
            <Button variant="ghost" onClick={() => setEdit(true)}>
              Editar proyecto
              <ArrowUpRight size={14} />
            </Button>
          </div>
        </div>
        <ProgressRing value={p.progress} size={150} caption="PROGRESS" />
      </header>
      <div className="project-command-bar">
        <label className="field">
          <span className="sr-only">Estado del proyecto</span>
          <select
            aria-label="Estado del proyecto"
            value={p.status}
            onChange={(e) =>
              n.run(() =>
                n.actions.setStatus(p.id, e.target.value as ProjectStatus),
              )
            }
          >
            <option value="active">Activo</option>
            <option value="backlog">Backlog</option>
            <option value="waiting">En espera</option>
            <option value="completed">Completado</option>
          </select>
        </label>
        <span className="small muted">
          <Clock3 size={14} style={{ display: "inline", marginRight: 6 }} />
          {p.dueDate ?? "Sin fecha de entrega"}
        </span>
        <Button
          onClick={() => task && n.startFlow(p.id, task.id)}
          disabled={!task || p.status !== "active"}
        >
          <Play size={14} />
          Iniciar Flow
        </Button>
      </div>
      <div className="data-band">
        <DataMetric
          label="Tiempo acumulado"
          value={p.hours.toFixed(1) + " h"}
          meta={`${sessions.length} sesiones registradas`}
        />
        <DataMetric
          label="Valor acordado"
          value={money(p.value ?? 0)}
          meta="USD · valor del proyecto"
        />
        <DataMetric
          label="Cobrado / Pendiente"
          value={money(finance.paid)}
          meta={`${money(finance.receivable)} por cobrar`}
        />
        <DataMetric
          label="Valor por hora"
          value={money(finance.contractedHour)}
          meta="Valor acordado ÷ horas"
        />
      </div>
      <Tabs
        value={tab}
        onChange={setTab}
        items={[
          { value: "overview", label: "Overview" },
          { value: "tasks", label: "Tareas" },
          { value: "knowledge", label: "Archivos y notas" },
          { value: "activity", label: "Actividad" },
          { value: "people", label: "Personas y dependencias" },
        ]}
      />
      {tab === "overview" && (
        <>
          <section className="section">
            <SectionHeading
              label="MILESTONE MAP"
              title="Una ruta. Un resultado."
            />
            <div className="milestone-map">
              {p.milestones.map((m, i) => (
                <div className="milestone" key={m.id}>
                  <span
                    className={
                      "milestone-dot " + (m.progress >= 100 ? "done" : "")
                    }
                  >
                    {m.progress >= 100 ? (
                      <Check size={12} />
                    ) : (
                      String(i + 1).padStart(2, "0")
                    )}
                  </span>
                  <h3>{m.title}</h3>
                  <span className="accent">{m.progress}%</span>
                  <small>Peso {m.weight}%</small>
                </div>
              ))}
            </div>
            {!p.milestones.length && (
              <p className="muted">
                Define los hitos que llevarán este proyecto a su entrega.
              </p>
            )}
            <form
              className="row wrap"
              style={{ marginTop: 22 }}
              onSubmit={(e) => {
                e.preventDefault();
                if (!milestoneTitle.trim()) return;
                n.update((w) => {
                  const pr = w.projects.find((x) => x.id === p.id)!;
                  pr.milestones.push({
                    ...entity(crypto.randomUUID(), "user", w.user.id),
                    projectId: p.id,
                    title: milestoneTitle.trim(),
                    weight: 1,
                    progress: 0,
                  });
                });
                setMilestoneTitle("");
              }}
            >
              <input
                style={{ maxWidth: 300 }}
                aria-label="Nombre del nuevo hito"
                placeholder="Añadir un hito…"
                value={milestoneTitle}
                onChange={(e) => setMilestoneTitle(e.target.value)}
              />
              <Button variant="secondary" type="submit">
                <Plus size={15} />
                Añadir hito
              </Button>
            </form>
          </section>
          <section className="directive-band section">
            <div className="directive-copy">
              <Label>NEXT ACTION</Label>
              <h2>{task?.title ?? p.nextAction}</h2>
              <p>
                {task
                  ? `${task.estimatedMinutes} minutos estimados · ${task.milestone}`
                  : "Define una tarea para avanzar."}
              </p>
            </div>
            <Button
              variant="secondary"
              onClick={() => n.openCapture("task", p.id)}
            >
              <Plus size={15} />
              Crear tarea
            </Button>
          </section>
          <div className="split section">
            <div>
              <SectionHeading
                label="FINANCIAL CONTEXT"
                title="El trabajo y su valor."
              />
              <div className="signal-row">
                <p>Gastos vinculados</p>
                <strong>{money(finance.expenses)}</strong>
              </div>
              <div className="signal-row">
                <p>Resultado cobrado menos gastos</p>
                <strong>{money(finance.profit)}</strong>
              </div>
              <div className="row wrap" style={{ marginTop: 18 }}>
                <Button
                  variant="secondary"
                  onClick={() => n.openCapture("income", p.id)}
                >
                  Registrar cobro
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => n.openCapture("expense", p.id)}
                >
                  Registrar gasto
                </Button>
              </div>
            </div>
            <Link href="/ai" className="surface">
              <Label>
                <Orbit size={15} />
                AI INSIGHT / PREPARADO
              </Label>
              <h3 style={{ margin: "20px 0 12px" }}>
                Una segunda perspectiva.
              </h3>
              <p className="small">
                Explora el contexto de {p.name} en la simulación de NEXUS AI.
                OpenAI todavía no está conectado.
              </p>
              <span className="inline-arrow" style={{ marginTop: 20 }}>
                Abrir NEXUS AI
                <ArrowUpRight size={15} />
              </span>
            </Link>
          </div>
        </>
      )}
      {tab === "tasks" && (
        <section className="section">
          <SectionHeading
            label="EXECUTION"
            title={`${p.tasks.filter((t) => t.completed).length} / ${p.tasks.length} completadas`}
            action={
              <Button onClick={() => n.openCapture("task", p.id)}>
                <Plus size={15} />
                Tarea
              </Button>
            }
          />
          {p.tasks.map((t) => (
            <div key={t.id} className="task-row">
              <button
                className={"task-check " + (t.completed ? "checked" : "")}
                aria-label={(t.completed ? "Reabrir " : "Completar ") + t.title}
                aria-pressed={t.completed}
                onClick={() => n.toggleTask(p.id, t.id)}
              >
                {t.completed && <Check size={13} />}
              </button>
              <div>
                <h3
                  style={{
                    textDecoration: t.completed ? "line-through" : undefined,
                  }}
                >
                  {t.title}
                </h3>
                <span className="small muted">
                  {t.milestone} · {t.estimatedMinutes} min · {t.priority}
                </span>
                <div className="task-dependencies">
                  {n.data.dependencies
                    .filter((d) => d.taskId === t.id)
                    .map((d) => (
                      <Badge key={d.id}>
                        Depende de:{" "}
                        {
                          n.projects
                            .flatMap((p) => p.tasks)
                            .find((t) => t.id === d.dependsOnTaskId)?.title
                        }
                      </Badge>
                    ))}
                </div>
              </div>
              <button
                className="icon-button"
                aria-label={"Iniciar Flow: " + t.title}
                disabled={t.completed || p.status !== "active"}
                onClick={() => n.startFlow(p.id, t.id)}
              >
                <Play size={15} />
              </button>
            </div>
          ))}
          {!p.tasks.length && (
            <Empty
              title="La próxima acción empieza aquí."
              text="Crea una tarea concreta para este proyecto."
              onAction={() => n.openCapture("task", p.id)}
            />
          )}
        </section>
      )}
      {tab === "knowledge" && (
        <div className="split section">
          <section>
            <SectionHeading
              label="CONNECTED KNOWLEDGE"
              title="Archivos y referencias."
              action={
                <Button
                  variant="secondary"
                  onClick={() => n.openCapture("file", p.id)}
                >
                  <Paperclip size={15} />
                  Vincular
                </Button>
              }
            />
            {items.map((k) => (
              <Link
                href={"/knowledge?item=" + k.id}
                className="knowledge-row"
                key={k.id}
              >
                <Paperclip size={17} />
                <div>
                  <h3>{k.title}</h3>
                  <span className="small muted">{k.type}</span>
                </div>
                <ArrowUpRight size={15} />
              </Link>
            ))}
            {!items.length && (
              <Empty
                text="Conecta notas, enlaces y referencias a tus archivos."
                onAction={() => n.openCapture("note", p.id)}
                action="Crear nota"
              />
            )}
          </section>
          <section>
            <SectionHeading label="PROJECT MEMORY" title="Notas de trabajo." />
            <textarea
              aria-label="Notas del proyecto"
              defaultValue={p.notes ?? ""}
              key={p.id}
              rows={10}
              placeholder="Decisiones, contexto, cosas que no debes olvidar…"
              onBlur={(e) => {
                if (e.target.value !== (p.notes ?? ""))
                  n.run(
                    () =>
                      n.actions.updateProject(p.id, { notes: e.target.value }),
                    "Notas guardadas.",
                  );
              }}
            />
            <p className="form-note">Se guarda al salir del campo.</p>
          </section>
        </div>
      )}
      {tab === "activity" && (
        <section className="section">
          <SectionHeading
            label="ACTIVITY LOG"
            title="Lo que has hecho avanzar."
          />
          {activity.map((a) => (
            <div key={a.id} className="activity-row">
              <span className="small muted">
                {new Date(a.createdAt).toLocaleString("es-NI")}
              </span>
              <p>{a.title}</p>
            </div>
          ))}
          {!activity.length && (
            <Empty
              title="La historia está por escribirse."
              text="Los cambios de estado, las tareas y las sesiones Flow se registrarán aquí."
            />
          )}
        </section>
      )}
      {tab === "people" && (
        <div className="split section">
          <section>
            <SectionHeading
              label="PEOPLE"
              title="Personas conectadas."
              action={<Users size={20} className="accent" />}
            />
            {n.data.contacts.map((c) => (
              <label key={c.id} className="contact-row">
                <input
                  type="checkbox"
                  checked={(p.contactIds ?? []).includes(c.id)}
                  onChange={(e) =>
                    n.run(() =>
                      n.actions.updateProject(p.id, {
                        contactIds: e.target.checked
                          ? [...(p.contactIds ?? []), c.id]
                          : p.contactIds?.filter((id) => id !== c.id),
                      }),
                    )
                  }
                />
                <div>
                  <h3>{c.name}</h3>
                  <p className="small">{c.company ?? "Contacto"}</p>
                </div>
              </label>
            ))}
            <Button
              variant="secondary"
              onClick={() => n.openCapture("contact", p.id)}
            >
              <Plus size={15} />
              Crear contacto
            </Button>
          </section>
          <section>
            <SectionHeading
              label="DEPENDENCIES"
              title="Qué necesita qué."
              action={<GitBranch size={20} className="accent" />}
            />
            {p.tasks.map((t) => (
              <label key={t.id} className="field" style={{ marginBottom: 18 }}>
                {t.title}
                <select
                  value=""
                  onChange={(e) => {
                    if (e.target.value)
                      n.run(
                        () => n.actions.addDependency(t, e.target.value),
                        "Dependencia añadida.",
                      );
                  }}
                >
                  <option value="">Añadir dependencia…</option>
                  {n.projects
                    .flatMap((pr) => pr.tasks)
                    .filter((other) => other.id !== t.id)
                    .map((other) => (
                      <option key={other.id} value={other.id}>
                        {other.title}
                      </option>
                    ))}
                </select>
              </label>
            ))}
            {!p.tasks.length && (
              <p className="muted">
                Crea tareas antes de definir sus dependencias.
              </p>
            )}
          </section>
        </div>
      )}
      <Modal open={edit} onClose={() => setEdit(false)} title="Editar proyecto">
        <ProjectEditor project={p} close={() => setEdit(false)} />
      </Modal>
    </div>
  );
}
