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
  Pencil,
  Trash2,
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
import type {
  Project,
  ProjectStatus,
  Task,
  Milestone,
} from "@/domain/models";
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
            area: draft.area,
            client: draft.client,
            stage: draft.stage,
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
      <div className="form-grid">
        <label className="field">
          Área
          <input
            value={draft.area}
            onChange={(e) => setDraft({ ...draft, area: e.target.value })}
          />
        </label>
        <label className="field">
          Cliente
          <input
            value={draft.client ?? ""}
            onChange={(e) =>
              setDraft({ ...draft, client: e.target.value || undefined })
            }
          />
        </label>
      </div>
      <div className="form-grid">
        <label className="field">
          Etapa
          <select
            value={draft.stage ?? "execution"}
            onChange={(e) =>
              setDraft({
                ...draft,
                stage: e.target.value as Project["stage"],
              })
            }
          >
            <option value="discovery">Descubrimiento</option>
            <option value="planning">Planificación</option>
            <option value="execution">Ejecución</option>
            <option value="delivery">Entrega</option>
          </select>
        </label>
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
      </div>
      <Button type="submit">Guardar cambios</Button>
    </form>
  );
}

function MilestoneEditor({
  project,
  milestone,
  close,
}: {
  project: Project;
  milestone: Milestone;
  close: () => void;
}) {
  const n = useNexus();
  const [title, setTitle] = useState(milestone.title);
  const [weight, setWeight] = useState(String(milestone.weight));
  const [baseline, setBaseline] = useState(
    String(milestone.baselineProgress ?? milestone.progress),
  );
  const [deleting, setDeleting] = useState(false);

  return (
    <form
      className="stack"
      onSubmit={(e) => {
        e.preventDefault();
        n.run(() => {
          n.actions.updateMilestone(project.id, milestone.id, {
            title,
            weight: Number(weight),
            baselineProgress: Number(baseline),
          });
          close();
        }, "Hito actualizado.");
      }}
    >
      <label className="field">
        Nombre del hito
        <input value={title} onChange={(e) => setTitle(e.target.value)} required />
      </label>
      <div className="form-grid">
        <label className="field">
          Peso en el proyecto · %
          <input
            type="number"
            min="0"
            step="1"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
          />
        </label>
        <label className="field">
          Avance base comprobado · %
          <input
            type="number"
            min="0"
            max="100"
            step="1"
            value={baseline}
            onChange={(e) => setBaseline(e.target.value)}
          />
        </label>
      </div>
      <p className="form-note">
        El avance base representa trabajo ya realizado. Las tareas de este hito
        completarán automáticamente el porcentaje restante hasta 100%.
      </p>
      <div className="row between">
        <Button type="submit">Guardar hito</Button>
        <Button
          type="button"
          variant="danger"
          onClick={() => {
            if (!deleting) {
              setDeleting(true);
              return;
            }
            const result = n.run(
              () => n.actions.deleteMilestone(project.id, milestone.id),
              "Hito eliminado.",
            );
            if (result !== undefined) close();
          }}
        >
          <Trash2 size={14} />
          {deleting ? "Confirmar eliminación" : "Eliminar"}
        </Button>
      </div>
    </form>
  );
}

function TaskEditor({
  project,
  task,
  close,
}: {
  project: Project;
  task: Task;
  close: () => void;
}) {
  const n = useNexus();
  const [title, setTitle] = useState(task.title);
  const [minutes, setMinutes] = useState(String(task.estimatedMinutes));
  const [priority, setPriority] = useState(task.priority);
  const [milestone, setMilestone] = useState(task.milestone);
  const [deleting, setDeleting] = useState(false);

  return (
    <form
      className="stack"
      onSubmit={(e) => {
        e.preventDefault();
        n.run(() => {
          n.actions.updateTask(project.id, task.id, {
            title,
            estimatedMinutes: Number(minutes),
            priority,
            milestone,
          });
          close();
        }, "Tarea actualizada.");
      }}
    >
      <label className="field">
        Tarea
        <input value={title} onChange={(e) => setTitle(e.target.value)} required />
      </label>
      <div className="form-grid">
        <label className="field">
          Hito
          <select value={milestone} onChange={(e) => setMilestone(e.target.value)}>
            {project.milestones.map((item) => (
              <option key={item.id} value={item.title}>
                {item.title}
              </option>
            ))}
            {!project.milestones.length && <option value="Ejecución">Ejecución</option>}
          </select>
        </label>
        <label className="field">
          Tiempo estimado · min
          <input
            type="number"
            min="1"
            value={minutes}
            onChange={(e) => setMinutes(e.target.value)}
          />
        </label>
      </div>
      <label className="field">
        Prioridad
        <select
          value={priority}
          onChange={(e) => setPriority(e.target.value as Task["priority"])}
        >
          <option value="critical">Crítica</option>
          <option value="high">Alta</option>
          <option value="medium">Media</option>
          <option value="low">Baja</option>
        </select>
      </label>
      <div className="row between">
        <Button type="submit">Guardar tarea</Button>
        <Button
          type="button"
          variant="danger"
          onClick={() => {
            if (!deleting) {
              setDeleting(true);
              return;
            }
            n.run(
              () => n.actions.deleteTask(project.id, task.id),
              "Tarea eliminada.",
            );
            close();
          }}
        >
          <Trash2 size={14} />
          {deleting ? "Confirmar eliminación" : "Eliminar"}
        </Button>
      </div>
    </form>
  );
}

export function ProjectDetail({ id }: { id: string }) {
  const n = useNexus();
  const p = n.projects.find((p) => p.id === id);
  const [tab, setTab] = useState("overview");
  const [edit, setEdit] = useState(false);
  const [milestoneTitle, setMilestoneTitle] = useState("");
  const [milestoneWeight, setMilestoneWeight] = useState("10");
  const [editingMilestone, setEditingMilestone] = useState<Milestone | null>(null);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
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
                  <small>
                    Peso {m.weight}% · base {m.baselineProgress ?? m.progress}%
                  </small>
                  <button
                    className="icon-button"
                    aria-label={"Editar hito " + m.title}
                    onClick={() => setEditingMilestone(m)}
                    style={{ marginTop: 10 }}
                  >
                    <Pencil size={13} />
                  </button>
                </div>
              ))}
            </div>
            {!p.milestones.length && (
              <p className="muted">
                Define los hitos que llevarán este proyecto a su entrega.
              </p>
            )}
            <p className="form-note" style={{ marginTop: 16 }}>
              Progreso automático = avance base del hito + proporción de tareas
              completadas sobre el tramo pendiente. El proyecto pondera cada hito
              según su peso.
            </p>
            <form
              className="row wrap"
              style={{ marginTop: 22 }}
              onSubmit={(e) => {
                e.preventDefault();
                if (!milestoneTitle.trim()) return;
                n.run(
                  () =>
                    n.actions.addMilestone(
                      p.id,
                      milestoneTitle,
                      Number(milestoneWeight) || 0,
                      0,
                    ),
                  "Hito añadido.",
                );
                setMilestoneTitle("");
                setMilestoneWeight("10");
              }}
            >
              <input
                style={{ maxWidth: 300 }}
                aria-label="Nombre del nuevo hito"
                placeholder="Añadir un hito…"
                value={milestoneTitle}
                onChange={(e) => setMilestoneTitle(e.target.value)}
              />
              <input
                style={{ width: 110 }}
                type="number"
                min="0"
                aria-label="Peso del nuevo hito"
                value={milestoneWeight}
                onChange={(e) => setMilestoneWeight(e.target.value)}
                placeholder="Peso %"
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
              <div className="row">
                <button
                  className="icon-button"
                  aria-label={"Editar " + t.title}
                  onClick={() => setEditingTask(t)}
                >
                  <Pencil size={15} />
                </button>
                <button
                  className="icon-button"
                  aria-label={"Iniciar Flow: " + t.title}
                  disabled={t.completed || p.status !== "active"}
                  onClick={() => n.startFlow(p.id, t.id)}
                >
                  <Play size={15} />
                </button>
              </div>
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
      <Modal
        open={!!editingMilestone}
        onClose={() => setEditingMilestone(null)}
        title="Editar hito"
      >
        {editingMilestone && (
          <MilestoneEditor
            key={editingMilestone.id}
            project={p}
            milestone={editingMilestone}
            close={() => setEditingMilestone(null)}
          />
        )}
      </Modal>
      <Modal
        open={!!editingTask}
        onClose={() => setEditingTask(null)}
        title="Editar tarea"
      >
        {editingTask && (
          <TaskEditor
            key={editingTask.id}
            project={p}
            task={editingTask}
            close={() => setEditingTask(null)}
          />
        )}
      </Modal>
    </div>
  );
}
