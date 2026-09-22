"use client";
import { useRef, useState } from "react";
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
} from "lucide-react";
import { useNexus } from "../nexus-provider";
import { ModuleFrame, Badge, Label, Button } from "../ui/primitives";
import { entity } from "@/domain/seed";
import { NexusToolRegistry } from "@/services/providers";
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
  const endRef = useRef<HTMLDivElement>(null);
  const requestRef = useRef(false);
  const context = n.services.context.build(n.data);
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
      simulated: true,
    };
    try {
      n.store.update((w) => {
        w.messages.push(message);
      });
      setPrompt("");
      const answer = await n.services.ai.respond(text, context);
      n.store.update((w) => {
        w.messages.push(answer);
        w.aiUsage.push({
          ...entity(crypto.randomUUID(), "user", w.user.id),
          provider: "mock",
          inputTokens: 0,
          outputTokens: 0,
          costUSD: 0,
        });
      });
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
      action={<Badge active>SIMULACIÓN LOCAL · SIN IA CONECTADA</Badge>}
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
              Esta vista prueba el flujo con respuestas predeterminadas basadas
              en tus prioridades. No realiza llamadas a OpenAI.
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
                    ? "NEXUS · RESPUESTA SIMULADA"
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
                <span>Preparando contexto local…</span>
              </div>
            )}
            <div ref={endRef} />
          </div>
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
            acciones automáticamente.
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
              Guarda aquí el contexto que querrás compartir con el futuro
              asistente. La simulación actual no lo analiza.
            </p>
          )}
          <form
            className="memory-form"
            onSubmit={(e) => {
              e.preventDefault();
              if (!memory.trim()) return;
              n.update((w) => {
                w.memories.push({
                  ...entity(crypto.randomUUID(), "user", w.user.id),
                  content: memory.trim(),
                  projectIds: [],
                });
              });
              setMemory("");
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
