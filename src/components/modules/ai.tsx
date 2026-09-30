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
  Trash2,
} from "lucide-react";
import { IntelligenceCore } from "../spatial-environment";
import { useNexus } from "../nexus-provider";
import { ModuleFrame, Badge, Label, Button } from "../ui/primitives";
import { entity } from "@/domain/seed";
import { NexusToolRegistry } from "@/services/providers";
import type { NexusAIAction } from "@/services/openai";
import { AIConversationNav } from "../ai-conversation-nav";
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
    quota?: {
      dailyUsed: number;
      dailyLimit: number;
      monthlyUsed: number;
      monthlyLimit: number;
      monthCostUSD: number;
    };
    error?: string;
  } | null>(null);
  const [pendingActions, setPendingActions] = useState<
    Array<{ id: string; action: NexusAIAction }>
  >([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(
    null,
  );
  const endRef = useRef<HTMLDivElement>(null);
  const requestRef = useRef(false);
  const voiceBootRef = useRef(false);
  const activeConversation = n.data.conversations.find(
    (conversation) => conversation.id === activeConversationId,
  );
  const activeMessages = activeConversationId
    ? n.data.messages.filter(
        (message) => message.conversationId === activeConversationId,
      )
    : [];
  const activeProject = activeConversation?.projectId
    ? n.projects.find((project) => project.id === activeConversation.projectId)
    : undefined;
  const context = n.services.context.build(n.data, {
    conversationId: activeConversationId ?? undefined,
    projectId: activeConversation?.projectId,
  });

  useEffect(() => {
    if (
      activeConversationId &&
      n.data.conversations.some(
        (conversation) => conversation.id === activeConversationId,
      )
    )
      return;
    const latest = [...n.data.conversations].sort(
      (a, b) => b.updatedAt - a.updatedAt,
    )[0];
    setActiveConversationId(latest?.id ?? null);
  }, [activeConversationId, n.data.conversations]);

  useEffect(() => {
    if (voiceBootRef.current || typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const voicePrompt = params.get("q")?.trim();
    if (!voicePrompt) return;

    voiceBootRef.current = true;
    const shouldSend = params.get("send") === "1";
    window.history.replaceState({}, "", window.location.pathname);

    const timer = window.setTimeout(() => {
      setPrompt(voicePrompt);
      if (shouldSend) void send(voicePrompt);
    }, 0);

    return () => window.clearTimeout(timer);
    // The one-shot voice handoff is intentionally guarded by voiceBootRef.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  function isDestructive(action: NexusAIAction) {
    return action.type.startsWith("delete_");
  }

  function actionLabel(action: NexusAIAction) {
    const project = n.projects.find((item) => item.id === action.projectId);
    const projectName = project?.name ?? "Proyecto";
    const transaction =
      action.targetId && action.transactionKind
        ? (action.transactionKind === "income"
            ? n.data.incomes
            : n.data.expenses
          ).find((item) => item.id === action.targetId)
        : undefined;
    const event = action.targetId
      ? n.data.events.find((item) => item.id === action.targetId)
      : undefined;
    const idea = action.targetId
      ? n.data.ideas.find((item) => item.id === action.targetId)
      : undefined;
    const memory = action.targetId
      ? n.data.memories.find((item) => item.id === action.targetId)
      : undefined;
    const debt = action.debtId
      ? (n.data.debts ?? []).find((item) => item.id === action.debtId)
      : undefined;
    const task =
      action.projectId && action.taskId
        ? n.projects
            .find((item) => item.id === action.projectId)
            ?.tasks.find((item) => item.id === action.taskId)
        : undefined;

    switch (action.type) {
      case "complete_task":
        return "Completar · " + (task?.title ?? action.title ?? "tarea") + " · " + projectName;
      case "create_project":
        return "Crear proyecto · " + (action.title ?? "Nuevo proyecto");
      case "create_task":
        return "Crear tarea · " + (action.title ?? "Nueva tarea") + " · " + projectName;
      case "update_task":
        return "Editar tarea · " + (task?.title ?? action.title ?? "tarea") + " · " + projectName;
      case "delete_task":
        return "Eliminar tarea · " + (task?.title ?? action.title ?? "tarea") + " · " + projectName;
      case "record_income":
        return "Registrar ingreso · " + (action.currency ?? "USD") + " " + (action.amount ?? 0) + " · " + projectName;
      case "record_expense":
        return "Registrar gasto · " + (action.currency ?? "USD") + " " + (action.amount ?? 0) + " · " + projectName;
      case "pay_debt":
        return "Pagar deuda · " + (debt?.creditor ?? "Deuda") + " · " + (action.currency ?? debt?.currency ?? "USD") + " " + (action.amount ?? 0);
      case "update_transaction":
        return "Editar " + (action.transactionKind === "income" ? "ingreso" : "gasto") + " · " + (transaction?.title ?? action.title ?? "movimiento");
      case "delete_transaction":
        return "Eliminar " + (action.transactionKind === "income" ? "ingreso" : "gasto") + " · " + (transaction?.title ?? action.title ?? "movimiento");
      case "update_project_status":
        return "Cambiar estado · " + projectName + " → " + (action.status ?? "");
      case "update_project_value":
        return "Actualizar valor · " + projectName + " → $" + (action.value ?? 0);
      case "update_project":
        return "Editar proyecto · " + projectName;
      case "log_project_activity":
        return "Registrar avance · " + projectName + " · " + (action.content ?? "actividad");
      case "create_event":
        return "Crear evento · " + (action.title ?? "Evento");
      case "update_event":
        return "Editar evento · " + (event?.title ?? action.title ?? "Evento");
      case "delete_event":
        return "Eliminar evento · " + (event?.title ?? action.title ?? "Evento");
      case "create_idea":
        return "Guardar idea · " + (action.title ?? action.content ?? "Nueva idea");
      case "update_idea":
        return "Editar idea · " + (idea?.title ?? action.title ?? "Idea");
      case "delete_idea":
        return "Eliminar idea · " + (idea?.title ?? action.title ?? "Idea");
      case "add_memory":
        return "Guardar memoria · " + (action.content ?? "Contexto");
      case "update_memory":
        return "Editar memoria · " + (memory?.content ?? action.content ?? "Contexto");
      case "delete_memory":
        return "Eliminar memoria · " + (memory?.content ?? "Contexto");
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
        case "create_project": {
          if (!action.title?.trim())
            throw new Error("Falta el nombre del proyecto.");
          const projectId = n.actions.capture({
            type: "project",
            content: action.title.trim(),
            category: action.area?.trim() || action.itemCategory?.trim() || "General",
          });
          n.actions.updateProject(projectId, {
            ...(action.description != null
              ? { description: action.description }
              : {}),
            ...(action.priority ? { priority: action.priority } : {}),
            ...(action.dueDate ? { dueDate: action.dueDate } : {}),
            ...(action.value != null ? { value: action.value } : {}),
            ...(action.area?.trim() ? { area: action.area.trim() } : {}),
            ...(action.client?.trim() ? { client: action.client.trim() } : {}),
          });
          if (action.status && action.status !== "backlog")
            n.actions.setStatus(projectId, action.status);
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
          n.actions.updateTask(action.projectId, taskId, {
            ...(action.milestone ? { milestone: action.milestone } : {}),
            ...(action.priority ? { priority: action.priority } : {}),
            ...(action.estimatedMinutes != null
              ? { estimatedMinutes: action.estimatedMinutes }
              : {}),
          });
          break;
        }
        case "update_task": {
          if (!action.projectId || !action.taskId)
            throw new Error("La IA no identificó la tarea que debe editarse.");
          n.actions.updateTask(action.projectId, action.taskId, {
            ...(action.title?.trim() ? { title: action.title.trim() } : {}),
            ...(action.milestone ? { milestone: action.milestone } : {}),
            ...(action.priority ? { priority: action.priority } : {}),
            ...(action.estimatedMinutes != null
              ? { estimatedMinutes: action.estimatedMinutes }
              : {}),
          });
          break;
        }
        case "delete_task":
          if (!action.projectId || !action.taskId)
            throw new Error("La IA no identificó la tarea que debe eliminarse.");
          n.actions.deleteTask(action.projectId, action.taskId);
          break;
        case "record_income":
        case "record_expense": {
          if (!action.amount || action.amount <= 0)
            throw new Error("La propuesta no contiene un importe válido.");
          const kind =
            action.type === "record_income" ? "income" : "expense";
          const recordId = n.actions.capture({
            type: kind,
            content:
              action.title?.trim() ||
              (kind === "income" ? "Ingreso" : "Gasto"),
            amount: action.amount,
            currency: action.currency ?? "USD",
            accountId: action.accountId || undefined,
            projectId: action.projectId || undefined,
            category: action.itemCategory || undefined,
          });
          if (action.date || action.itemCategory) {
            n.actions.updateMoneyRecord(kind, recordId, {
              ...(action.date ? { date: action.date } : {}),
              ...(action.itemCategory
                ? { category: action.itemCategory }
                : {}),
            });
          }
          break;
        }
        case "pay_debt": {
          if (!action.debtId || !action.amount || action.amount <= 0)
            throw new Error("Falta una deuda o un importe válido.");
          n.actions.payDebt(
            action.debtId,
            action.amount,
            action.accountId || undefined,
          );
          break;
        }
        case "update_transaction": {
          if (!action.targetId || !action.transactionKind)
            throw new Error("La IA no identificó el movimiento que debe editarse.");
          n.actions.updateMoneyRecord(action.transactionKind, action.targetId, {
            ...(action.title?.trim() ? { title: action.title.trim() } : {}),
            ...(action.amount != null ? { amount: action.amount } : {}),
            ...(action.date ? { date: action.date } : {}),
            ...(action.projectId ? { projectId: action.projectId } : {}),
            ...(action.itemCategory
              ? { category: action.itemCategory }
              : {}),
          });
          break;
        }
        case "delete_transaction":
          if (!action.targetId || !action.transactionKind)
            throw new Error("La IA no identificó el movimiento que debe eliminarse.");
          n.actions.deleteMoneyRecord(action.transactionKind, action.targetId);
          break;
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
        case "update_project":
          if (!action.projectId)
            throw new Error("La IA no identificó el proyecto que debe editarse.");
          n.actions.updateProject(action.projectId, {
            ...(action.title?.trim() ? { name: action.title.trim() } : {}),
            ...(action.description != null
              ? { description: action.description }
              : {}),
            ...(action.notes != null ? { notes: action.notes } : {}),
            ...(action.priority ? { priority: action.priority } : {}),
            ...(action.dueDate ? { dueDate: action.dueDate } : {}),
            ...(action.value != null ? { value: action.value } : {}),
            ...(action.area?.trim() ? { area: action.area.trim() } : {}),
            ...(action.client?.trim() ? { client: action.client.trim() } : {}),
          });
          break;
        case "log_project_activity":
          if (!action.projectId || !action.content?.trim())
            throw new Error("Falta proyecto o descripción del avance.");
          n.actions.logProjectActivity(action.projectId, action.content);
          break;
        case "create_event": {
          if (!action.title?.trim() || !action.start || !action.end)
            throw new Error("Faltan título, inicio o fin para el evento.");
          const start = new Date(action.start);
          const end = new Date(action.end);
          if (
            !Number.isFinite(+start) ||
            !Number.isFinite(+end) ||
            +end <= +start
          )
            throw new Error("El horario propuesto para el evento no es válido.");
          n.actions.saveEvent({
            ...entity(crypto.randomUUID(), "user", n.data.user.id),
            title: action.title.trim(),
            start: start.toISOString(),
            end: end.toISOString(),
            category: action.category ?? "personal",
            projectId: action.projectId || undefined,
            description: action.description || undefined,
          });
          break;
        }
        case "update_event": {
          if (!action.targetId)
            throw new Error("La IA no identificó el evento que debe editarse.");
          const current = n.data.events.find(
            (item) => item.id === action.targetId,
          );
          if (!current) throw new Error("El evento propuesto ya no existe.");
          const nextStart = action.start
            ? new Date(action.start).toISOString()
            : current.start;
          const nextEnd = action.end
            ? new Date(action.end).toISOString()
            : current.end;
          n.actions.saveEvent({
            ...current,
            title: action.title?.trim() || current.title,
            start: nextStart,
            end: nextEnd,
            category: action.category ?? current.category,
            projectId: action.projectId || current.projectId,
            description:
              action.description != null
                ? action.description
                : current.description,
          });
          break;
        }
        case "delete_event":
          if (!action.targetId)
            throw new Error("La IA no identificó el evento que debe eliminarse.");
          n.actions.deleteEvent(action.targetId);
          break;
        case "create_idea": {
          const content = action.content?.trim() || action.title?.trim();
          if (!content) throw new Error("La idea propuesta está vacía.");
          const ideaId = n.actions.capture({
            type: "idea",
            content,
            projectId: action.projectId || undefined,
            category: action.itemCategory || undefined,
          });
          if (
            action.description != null ||
            action.notes != null ||
            action.itemCategory
          )
            n.actions.updateIdea(ideaId, {
              ...(action.description != null
                ? { description: action.description }
                : {}),
              ...(action.notes != null ? { notes: action.notes } : {}),
              ...(action.itemCategory
                ? { category: action.itemCategory }
                : {}),
            });
          break;
        }
        case "update_idea":
          if (!action.targetId)
            throw new Error("La IA no identificó la idea que debe editarse.");
          n.actions.updateIdea(action.targetId, {
            ...(action.title?.trim() ? { title: action.title.trim() } : {}),
            ...(action.description != null
              ? { description: action.description }
              : {}),
            ...(action.notes != null ? { notes: action.notes } : {}),
            ...(action.itemCategory
              ? { category: action.itemCategory }
              : {}),
            ...(action.dueDate ? { reviewDate: action.dueDate } : {}),
          });
          break;
        case "delete_idea":
          if (!action.targetId)
            throw new Error("La IA no identificó la idea que debe eliminarse.");
          n.actions.deleteIdea(action.targetId);
          break;
        case "add_memory": {
          const content = action.content?.trim();
          if (!content) throw new Error("La memoria propuesta está vacía.");
          n.actions.addMemory(
            content,
            action.projectId || undefined,
          );
          break;
        }
        case "update_memory":
          if (!action.targetId || !action.content?.trim())
            throw new Error("Falta memoria o contenido actualizado.");
          n.actions.updateMemory(
            action.targetId,
            action.content,
            action.projectId || undefined,
          );
          break;
        case "delete_memory":
          if (!action.targetId)
            throw new Error("La IA no identificó la memoria que debe eliminarse.");
          n.actions.deleteMemory(action.targetId);
          break;
      }
      return true;
    }, "Acción aplicada en NEXUS.");

    if (applied)
      setPendingActions((items) => items.filter((item) => item.id !== id));
  }

  function selectConversation(conversationId: string) {
    setActiveConversationId(conversationId);
    setPendingActions([]);
  }

  function newConversation() {
    const conversationId = n.actions.createAIConversation();
    selectConversation(conversationId);
    setPrompt("");
  }

  function openProjectConversation(projectId: string) {
    const project = n.projects.find((item) => item.id === projectId);
    if (!project) return;
    const conversationId = n.actions.createAIConversation(
      projectId,
      project.name,
    );
    selectConversation(conversationId);
    setPrompt("");
  }

  function deleteConversation(conversationId: string) {
    const conversation = n.data.conversations.find(
      (item) => item.id === conversationId,
    );
    if (!conversation) return;
    if (
      typeof window !== "undefined" &&
      !window.confirm(
        `¿Eliminar "${conversation.title}" y todos sus mensajes? Esta acción también se sincronizará con Firestore.`,
      )
    )
      return;
    const removed = n.run(
      () => n.actions.deleteAIConversation(conversationId),
      "Conversación eliminada de NEXUS.",
    );
    if (!removed) return;
    if (activeConversationId === conversationId) {
      const next = [...n.store.getSnapshot().conversations].sort(
        (a, b) => b.updatedAt - a.updatedAt,
      )[0];
      setActiveConversationId(next?.id ?? null);
    }
    setPendingActions([]);
  }

  function deleteMessage(messageId: string) {
    if (
      typeof window !== "undefined" &&
      !window.confirm(
        "¿Eliminar este mensaje? Se quitará de esta conversación y de tu workspace sincronizado.",
      )
    )
      return;
    n.run(
      () => n.actions.deleteAIMessage(messageId),
      "Mensaje eliminado de NEXUS.",
    );
  }

  async function send(text: string) {
    if (!text.trim() || requestRef.current) return;
    requestRef.current = true;
    setBusy(true);
    try {
      let conversationId = activeConversationId;
      if (
        !conversationId ||
        !n.store
          .getSnapshot()
          .conversations.some((conversation) => conversation.id === conversationId)
      ) {
        conversationId = n.actions.createAIConversation();
        setActiveConversationId(conversationId);
      }

      const snapshot = n.store.getSnapshot();
      const conversation = snapshot.conversations.find(
        (item) => item.id === conversationId,
      );
      if (!conversation) throw new Error("No se pudo abrir la conversación.");

      const scopedContext = n.services.context.build(snapshot, {
        conversationId,
        projectId: conversation.projectId,
      });
      const message = {
        ...entity(crypto.randomUUID(), "user", snapshot.user.id),
        conversationId,
        role: "user" as const,
        content: text.trim(),
        contextIds: [],
        simulated: false,
      };

      n.actions.appendAIMessage(conversationId, message);
      setPrompt("");

      const result = await n.services.ai.respondDetailed(text, scopedContext);
      n.actions.appendAIMessage(conversationId, {
        ...result.message,
        conversationId,
      });
      n.store.update((w) => {
        w.aiUsage.push({
          ...entity(crypto.randomUUID(), "user", w.user.id),
          provider: "openai",
          inputTokens: result.usage.inputTokens,
          outputTokens: result.usage.outputTokens,
          costUSD: result.costUSD,
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
      title="NEXUS AI"
      description="Piensa con todo tu contexto."
      action={
        <Badge active={!!aiStatus?.configured}>
          {aiStatus?.configured
            ? "OPENAI · " + aiStatus.model.toUpperCase() + " · LIVE"
            : aiStatus
              ? "OPENAI · CONFIGURACIÓN PENDIENTE"
              : "OPENAI · COMPROBANDO"}
        </Badge>
      }
    >
      <div
        className={`ai-workspace ${activeMessages.length ? "has-history" : ""} ${busy ? "is-thinking" : ""}`}
      >
        <AIConversationNav
          activeConversationId={activeConversationId}
          onSelect={selectConversation}
          onNew={newConversation}
          onProject={openProjectConversation}
          onDelete={deleteConversation}
        />
        <section className="ai-conversation">
          <div className="ai-thread-head">
            <div>
              <Label>
                {activeProject ? "PROJECT CHAT" : "CONVERSATION"}
              </Label>
              <strong>
                {activeConversation?.title ?? "Nueva conversación"}
              </strong>
              {activeProject && (
                <span className="ai-thread-scope">
                  Contexto principal · {activeProject.name}
                </span>
              )}
            </div>
            {activeConversation && (
              <button
                className="ai-thread-head-delete"
                aria-label="Eliminar conversación actual"
                onClick={() => deleteConversation(activeConversation.id)}
              >
                <Trash2 size={14} />
              </button>
            )}
          </div>
          <div className="ai-core">
            <IntelligenceCore busy={busy} />
            <Label>INTELLIGENCE CORE</Label>
            <h2>
              Todo conectado.
              <br />
              <span className="accent">Una perspectiva más clara.</span>
            </h2>
            <p>
              Encuentra claridad. Decide el siguiente paso. Tú confirmas cada
              acción.
            </p>
          </div>
          <div
            className="ai-messages"
            role="log"
            aria-label="Conversación con NEXUS"
          >
            {activeMessages.map((m) => (
              <article className={"ai-message " + m.role} key={m.id}>
                <button
                  className="ai-message-delete"
                  aria-label="Eliminar mensaje"
                  onClick={() => deleteMessage(m.id)}
                >
                  <Trash2 size={12} />
                </button>
                <Label>
                  {m.role === "assistant"
                    ? m.simulated
                      ? "NEXUS · LOCAL"
                      : "NEXUS · OPENAI"
                    : n.data.user.name.toUpperCase()}
                </Label>
                <p>{m.content}</p>
                {m.role === "assistant" && (
                  <div className="ai-citations">
                    {m.contextIds.slice(0, 4).map((id) => {
                      const p = n.projects.find((p) => p.id === id);
                      return p ? (
                        <Link
                          key={id}
                          href={"/project?id=" + encodeURIComponent(id)}
                        >
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
                    <div className="row wrap">
                      <strong>{actionLabel(action)}</strong>
                      {isDestructive(action) && <Badge>ELIMINACIÓN</Badge>}
                    </div>
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
                    <Button
                      variant={isDestructive(action) ? "danger" : "primary"}
                      onClick={() => applyAction(id, action)}
                    >
                      <Check size={14} />
                      {isDestructive(action) ? "Eliminar" : "Aplicar"}
                    </Button>
                  </div>
                </div>
              ))}
            </section>
          )}
          {aiStatus && !aiStatus.configured && (
            <div className="system-alert" style={{ marginBottom: 22 }}>
              <strong>NEXUS AI todavía no puede conectar con OpenAI.</strong>
              <p style={{ marginTop: 8 }}>
                {aiStatus.error ||
                  "Revisa el estado de la conexión en System e inténtalo de nuevo."}
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
          {!activeMessages.length && (
            <div className="ai-prompts">
              {prompts.map((p) => (
                <button key={p} onClick={() => send(p)}>
                  {p}
                  <ArrowUpRight size={15} />
                </button>
              ))}
            </div>
          )}
        </section>
        <aside className="ai-context">
          <details open>
            <summary>Contexto y consumo</summary>
            <Section label="CONTEXT WINDOW" title="Tú decides qué compartes." />
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
            {aiStatus?.quota && (
              <div className="context-counts">
                <span>
                  IA hoy {aiStatus.quota.dailyUsed}/{aiStatus.quota.dailyLimit}
                </span>
                <span>
                  Mes {aiStatus.quota.monthlyUsed}/{aiStatus.quota.monthlyLimit}
                </span>
                <span>Costo mes ${aiStatus.quota.monthCostUSD.toFixed(4)}</span>
              </div>
            )}
            <div className="context-counts">
              <span>{context.projects.length} proyectos</span>
              <span>{context.events.length} bloques</span>
              <span>{context.transactions.length} movimientos</span>
              <span>{context.ideas.length} ideas</span>
              <span>{context.knowledge.length} referencias</span>
              <span>{context.memories.length} memorias</span>
            </div>
          </details>
          <details>
            <summary>Herramientas y acciones</summary>
            <Section label="TOOLS" title="Acciones preparadas." />
            {new NexusToolRegistry().tools.map((t) => (
              <div className="tool-registry-row" key={t.id}>
                <span>{t.label}</span>
                <small>
                  {t.access === "read" ? "CONSULTA" : "CONFIRMACIÓN"}
                </small>
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
          </details>
          <details>
            <summary>Memoria · {n.data.memories.length}</summary>
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
          </details>
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
