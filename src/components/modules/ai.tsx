"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Orbit,
  ArrowUp,
  ArrowUpRight,
  Layers3,
  CalendarDays,
  Wallet,
  Library,
  Plus,
  Check,
  Zap,
} from "lucide-react";
import { useNexus } from "../nexus-provider";
import { ModuleFrame, Badge, Label, Button } from "../ui/primitives";
import { entity } from "@/domain/seed";
import { NexusToolRegistry } from "@/services/providers";
import type { NexusAIAction } from "@/services/openai";
const prompts = [
  "¿Qué debería priorizar mañana?",
  "¿Qué proyectos están activos?",
  "¿Qué cobros tengo pendientes?",
];
const contextOptions = [
  { id: "projects", label: "Proyectos", icon: Layers3 },
  { id: "calendar", label: "Calendario", icon: CalendarDays },
  { id: "finance", label: "Finanzas", icon: Wallet },
  { id: "knowledge", label: "Conocimiento", icon: Library },
] as const;
export function AIView() {
  const n = useNexus();
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [memory, setMemory] = useState("");
  const [aiStatus, setAIStatus] = useState<{
    configured: boolean;
    model: string;
    error?: string;
  } | null>(null);
  const [pendingActions, setPendingActions] = useState<
    Array<{ id: string; action: NexusAIAction }>
  >([]);
  const endRef = useRef<HTMLDivElement>(null);
  const requestRef = useRef(false);
  const context = n.services.context.build(n.data);

  useEffect(() => {
    let active = true;
    void n.services.ai
      .status()
      .then((status) => {
        if (active) setAIStatus(status);
      })
      .catch((error) => {
        if (active)
          setAIStatus({
            configured: false,
            model: "",
            error:
              error instanceof Error
                ? error.message
                : "No se pudo comprobar NEXUS AI.",
          });
      });
    return () => {
      active = false;
    };
  }, [n.services.ai]);

  function actionLabel(action: NexusAIAction) {
    const project = n.projects.find((item) => item.id === action.projectId);
    const projectName = project?.name ?? "Proyecto";
    switch (action.type) {
      case "complete_task":
        return "Completar · " + (action.title ?? "tarea") + " · " + projectName;
      case "create_task":
        return "Crear tarea · " + (action.title ?? "Nueva tarea") + " · " + projectName;
      case "record_income":
        return "Registrar ingreso · $" + (action.amount ?? 0) + " · " + projectName;
      case "record_expense":
        return "Registrar gasto · $" + (action.amount ?? 0) + " · " + projectName;
      case "update_project_status":
        return "Cambiar estado · " + projectName + " → " + (action.status ?? "");
      case "update_project_value":
        return "Actualizar valor · " + projectName + " → $" + (action.value ?? 0);
    }
  }

  function applyAction(id: string, action: NexusAIAction) {
    const applied = n.run(() => {
      switch (action.type) {
        case "complete_task": {
          if (!action.projectId || !action.taskId)
            throw new Error("La IA no identificó una tarea válida.");
          const task = n.projects
            .find((project) => project.id === action.projectId)
            ?.tasks.find((item) => item.id === action.taskId);
          if (!task) throw new Error("La tarea propuesta ya no existe.");
          if (!task.completed)
            n.actions.toggleTask(action.projectId, action.taskId);
          break;
        }
        case "create_task": {
          if (!action.projectId || !action.title?.trim())
            throw new Error("Falta proyecto o título para crear la tarea.");
          const taskId = n.actions.capture({
            type: "task",
            content: action.title,
            projectId: action.projectId,
          });
          const project = n.projects.find(
            (item) => item.id === action.projectId,
          );
          if (
            action.milestone &&
            project?.milestones.some(
              (milestone) => milestone.title === action.milestone,
            )
          )
            n.actions.updateTask(action.projectId, taskId, {
              milestone: action.milestone,
            });
          break;
        }
        case "record_income":
        case "record_expense": {
          if (!action.amount || action.amount <= 0)
            throw new Error("La propuesta no contiene un importe válido.");
          n.actions.capture({
            type: action.type === "record_income" ? "income" : "expense",
            content:
              action.title?.trim() ||
              (action.type === "record_income" ? "Ingreso" : "Gasto"),
            amount: action.amount,
            projectId: action.projectId || undefined,
          });
          break;
        }
        case "update_project_status":
          if (!action.projectId || !action.status)
            throw new Error("Falta proyecto o estado.");
          n.actions.setStatus(action.projectId, action.status);
          break;
        case "update_project_value":
          if (!action.projectId || action.value == null || action.value < 0)
            throw new Error("Falta un valor válido para el proyecto.");
          n.actions.updateProject(action.projectId, { value: action.value });
          break;
      }
      return true;
    }, "Acción aplicada en NEXUS.");

    if (applied)
      setPendingActions((items) => items.filter((item) => item.id !== id));
  }
  async function send(text: string) {
    if (!text.trim() || requestRef.current) return;
    requestRef.current = true;
    setBusy(true);
    const message = {
      ...entity(crypto.randomUUID(), "user", n.data.user.id),
      conversationId: "local-conversation",
      role: "user" as const,
      content: text.trim(),
      contextIds: [],
      simulated: false,
    };
    try {
      n.store.update((w) => {
        w.messages.push(message);
      });
      setPrompt("");
      const result = await n.services.ai.respondDetailed(text, context);
      n.store.update((w) => {
        w.messages.push(result.message);
        w.aiUsage.push({
          ...entity(crypto.randomUUID(), "user", w.user.id),
          provider: "openai",
          inputTokens: result.usage.inputTokens,
          outputTokens: result.usage.outputTokens,
          costUSD: 0,
          metadata: { model: result.model },
        });
      });
      setAIStatus({ configured: true, model: result.model });
      setPendingActions((items) => [
        ...items,
        ...result.actions.map((action) => ({
          id: crypto.randomUUID(),
          action,
        })),
      ]);
      requestAnimationFrame(() =>
        endRef.current?.scrollIntoView({
          behavior: n.reduceMotion ? "instant" : "smooth",
          block: "nearest",
        }),
      );
    } catch (e) {
      n.notify(
        e instanceof Error ? e.message : "No se pudo preparar la respuesta.",
        true,
      );
    } finally {
      requestRef.current = false;
      setBusy(false);
    }
  }
  return (
    <ModuleFrame
      eyebrow="Nexus intelligence / 10"
      title="Piensa en voz alta"
      description="Tus proyectos, tu tiempo y tu conocimiento en una conversación."
      action={
        <Badge active={!!aiStatus?.configured}>
          {aiStatus?.configured
            ? "OPENAI · " + aiStatus.model.toUpperCase()
            : aiStatus
              ? "OPENAI · CONFIGURACIÓN PENDIENTE"
              : "OPENAI · COMPROBANDO"}
        </Badge>
      }
    >
      <div className="ai-workspace">
        <section className="ai-conversation">
          <div className="ai-core">
            <div className="ai-orb">
              <Orbit size={41} strokeWidth={1} />
            </div>
            <Label>NEXUS / CONTEXT AWARE INTERFACE</Label>
            <h2>
              Todo conectado.
              <br />
              <span className="accent">Una perspectiva más clara.</span>
            </h2>
            <p>
              NEXUS puede razonar sobre tus proyectos, calendario, finanzas y
              conocimiento. Los cambios sensibles se presentan como propuestas
              y solo se ejecutan cuando tú los confirmas.
            </p>
          </div>
          {!n.data.messages.length && (
            <div className="ai-prompts">
              {prompts.map((p) => (
                <button key={p} onClick={() => send(p)}>
                  {p}
                  <ArrowUpRight size={15} />
                </button>
              ))}
            </div>
          )}
          <div
            className="ai-messages"
            role="log"
            aria-label="Conversación con NEXUS"
          >
            {n.data.messages.map((m) => (
              <article className={"ai-message " + m.role} key={m.id}>
                <Label>
                  {m.role === "assistant"
                    ? "NEXUS · OPENAI"
                    : n.data.user.name.toUpperCase()}
                </Label>
                <p>{m.content}</p>
                {m.role === "assistant" && (
                  <div className="ai-citations">
                    {m.contextIds.slice(0, 4).map((id) => {
                      const p = n.projects.find((p) => p.id === id);
                      return p ? (
                        <Link key={id} href={"/projects/" + id}>
                          {p.name}
                          <ArrowUpRight size={11} />
                        </Link>
                      ) : null;
                    })}
                  </div>
                )}
              </article>
            ))}
            {busy && (
              <div className="ai-processing" role="status">
                <Orbit size={16} />
                <span>Analizando tu contexto con NEXUS AI…</span>
              </div>
            )}
            <div ref={endRef} />
          </div>
          {pendingActions.length > 0 && (
            <section className="ai-actions">
              <div className="ai-side-heading">
                <Label>
                  <Zap size={13} />
                  ACTIONS / REQUIEREN CONFIRMACIÓN
                </Label>
                <h3>NEXUS entendió acciones posibles.</h3>
              </div>
              {pendingActions.map(({ id, action }) => (
                <div className="ai-action-card" key={id}>
                  <div>
                    <strong>{actionLabel(action)}</strong>
                    <p>{action.reason}</p>
                  </div>
                  <div className="row">
                    <Button
                      variant="ghost"
                      onClick={() =>
                        setPendingActions((items) =>
                          items.filter((item) => item.id !== id),
                        )
                      }
                    >
                      Descartar
                    </Button>
                    <Button onClick={() => applyAction(id, action)}>
                      <Check size={14} />
                      Aplicar
                    </Button>
                  </div>
                </div>
              ))}
            </section>
          )}
          {aiStatus && !aiStatus.configured && (
            <div className="system-alert" style={{ marginBottom: 22 }}>
              <strong>NEXUS AI está preparado, pero aún no tiene credencial.</strong>
              <p style={{ marginTop: 8 }}>
                Añade OPENAI_API_KEY en las variables de entorno de Vercel para
                activar respuestas reales. El resto del sistema sigue funcionando
                sin esa clave.
              </p>
            </div>
          )}
          <form
            className="ai-composer"
            onSubmit={(e) => {
              e.preventDefault();
              void send(prompt);
            }}
          >
            <textarea
              aria-label="Mensaje para NEXUS"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Conecta tus ideas. Encuentra el siguiente paso…"
              rows={2}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void send(prompt);
                }
              }}
            />
            <button
              className="button button-primary"
              aria-label="Enviar mensaje"
              disabled={busy || !prompt.trim()}
            >
              <ArrowUp size={20} />
            </button>
          </form>
          <div className="form-note">
            Enter para enviar · Shift + Enter para nueva línea · No se ejecutan
            acciones sin tu confirmación.
          </div>
        </section>
        <aside className="ai-context">
          <Section label="CONTEXT WINDOW" title="Tú decides qué comparte." />
          {contextOptions.map((option) => (
            <label key={option.id} className="ai-context-option">
              <option.icon size={16} />
              <span>{option.label}</span>
              <input
                type="checkbox"
                checked={n.data.user.preferences.aiContext[option.id]}
                onChange={(e) =>
                  n.run(() =>
                    n.actions.updatePreferences({
                      aiContext: {
                        ...n.data.user.preferences.aiContext,
                        [option.id]: e.target.checked,
                      },
                    }),
                  )
                }
              />
            </label>
          ))}
          <div className="context-counts">
            <span>{context.projects.length} proyectos</span>
            <span>{context.events.length} bloques</span>
            <span>{context.knowledge.length} referencias</span>
            <span>{context.memories.length} memorias</span>
          </div>
          <Section label="TOOLS" title="Acciones preparadas." />
          {new NexusToolRegistry().tools.map((t) => (
            <div className="tool-registry-row" key={t.id}>
              <span>{t.label}</span>
              <small>{t.access === "read" ? "CONSULTA" : "CONFIRMACIÓN"}</small>
            </div>
          ))}
          <div className="row wrap" style={{ marginTop: 18 }}>
            <Button variant="secondary" onClick={() => n.openCapture("task")}>
              Crear tarea
            </Button>
            <Link href="/calendar" className="inline-arrow">
              Planificar
              <ArrowUpRight size={14} />
            </Link>
          </div>
          <Section label="MEMORY" title="Contexto que permanece." />
          {n.data.memories.map((m) => (
            <p key={m.id} className="memory-item">
              {m.content}
            </p>
          ))}
          {!n.data.memories.length && (
            <p className="form-note">
              Guarda aquí contexto estable que NEXUS AI debe considerar en
              conversaciones futuras cuando Conocimiento esté habilitado.
            </p>
          )}
          <form
            className="memory-form"
            onSubmit={(e) => {
              e.preventDefault();
              if (!memory.trim()) return;
              const saved = n.update((w) => {
                w.memories.push({
                  ...entity(crypto.randomUUID(), "user", w.user.id),
                  content: memory.trim(),
                  projectIds: [],
                });
              });
              if (saved) setMemory("");
            }}
          >
            <input
              aria-label="Nueva memoria"
              placeholder="Añadir contexto…"
              value={memory}
              onChange={(e) => setMemory(e.target.value)}
            />
            <button className="icon-button" aria-label="Guardar memoria">
              <Plus size={15} />
            </button>
          </form>
        </aside>
      </div>
    </ModuleFrame>
  );
}
function Section({ label, title }: { label: string; title: string }) {
  return (
    <div className="ai-side-heading">
      <Label>{label}</Label>
      <h3>{title}</h3>
    </div>
  );
}
