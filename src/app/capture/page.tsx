"use client";

import {
  ArrowDownLeft,
  ArrowUpRight,
  Lightbulb,
  ListTodo,
  NotebookPen,
  CalendarPlus,
} from "lucide-react";
import { useNexus } from "@/components/nexus-provider";
import { ModuleFrame, Label } from "@/components/ui/primitives";

const quickActions = [
  {
    type: "expense" as const,
    label: "Gasto",
    detail: "Registra un egreso ahora.",
    icon: ArrowUpRight,
  },
  {
    type: "income" as const,
    label: "Ingreso",
    detail: "Registra un cobro o entrada.",
    icon: ArrowDownLeft,
  },
  {
    type: "task" as const,
    label: "Tarea",
    detail: "Captura algo que debes hacer.",
    icon: ListTodo,
  },
  {
    type: "idea" as const,
    label: "Idea",
    detail: "Que no se pierda.",
    icon: Lightbulb,
  },
  {
    type: "note" as const,
    label: "Nota",
    detail: "Guarda contexto rápido.",
    icon: NotebookPen,
  },
] as const;

export default function QuickCapturePage() {
  const n = useNexus();

  return (
    <ModuleFrame
      eyebrow="Mobile capture / instant input"
      title="Captura rápida"
      description="Un toque para registrar lo que acaba de pasar. NEXUS se encarga de darle estructura."
    >
      <section className="mobile-capture-hero">
        <Label>QUICK INPUT / NEXUS</Label>
        <h2>Menos navegación. Más registro.</h2>
        <p>
          En el teléfono, la entrada debe ser inmediata. Elige qué ocurrió y
          completa únicamente los datos necesarios.
        </p>
      </section>

      <div className="mobile-capture-grid">
        {quickActions.map((action) => (
          <button
            key={action.type}
            type="button"
            onClick={() => n.openCapture(action.type)}
          >
            <span>
              <action.icon size={22} strokeWidth={1.5} />
            </span>
            <strong>{action.label}</strong>
            <small>{action.detail}</small>
          </button>
        ))}
        <button type="button" onClick={() => n.setCommandOpen(true)}>
          <span>
            <CalendarPlus size={22} strokeWidth={1.5} />
          </span>
          <strong>Más</strong>
          <small>Busca cualquier módulo o acción.</small>
        </button>
      </div>
    </ModuleFrame>
  );
}
