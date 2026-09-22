"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowUpRight, Archive, Trash2, CalendarClock } from "lucide-react";
import { useNexus } from "./nexus-provider";
import { Button, Modal, Badge } from "./ui/primitives";
import { CATEGORIES } from "@/config/system";
import type { Idea } from "@/domain/models";
function IdeaEditor({ idea }: { idea: Idea }) {
  const n = useNexus();
  const router = useRouter();
  const [draft, setDraft] = useState(idea);
  const [reviewDate, setReviewDate] = useState(idea.reviewDate ?? "");
  const [confirmDelete, setConfirmDelete] = useState(false);
  return (
    <div className="stack">
      <div className="row wrap">
        <Badge active>{idea.status.toUpperCase()}</Badge>
        <span className="small muted">
          {new Date(idea.createdAt).toLocaleDateString("es-NI")}
          {idea.source === "demo" ? " · Demo" : ""}
        </span>
      </div>
      <label className="field">
        Nombre
        <input
          value={draft.title}
          onChange={(e) => setDraft({ ...draft, title: e.target.value })}
        />
      </label>
      <div className="form-grid">
        <label className="field">
          Órbita
          <select
            value={draft.category}
            onChange={(e) => setDraft({ ...draft, category: e.target.value })}
          >
            {CATEGORIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <label className="field">
          Potencial
          <select
            value={draft.potential}
            onChange={(e) =>
              setDraft({
                ...draft,
                potential: e.target.value as Idea["potential"],
              })
            }
          >
            <option value="explore">Por explorar</option>
            <option value="promising">Prometedor</option>
            <option value="high">Alto</option>
          </select>
        </label>
      </div>
      <label className="field">
        Descripción
        <textarea
          value={draft.description}
          onChange={(e) => setDraft({ ...draft, description: e.target.value })}
        />
      </label>
      <label className="field">
        Notas
        <textarea
          value={draft.notes}
          onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
        />
      </label>
      <div className="row wrap">
        {idea.projectIds.map((id) => (
          <Link
            key={id}
            href={"/projects/" + id}
            onClick={() => n.setSelectedIdeaId(null)}
            className="inline-arrow"
          >
            {n.projects.find((p) => p.id === id)?.name ?? "Proyecto"}
            <ArrowUpRight size={15} />
          </Link>
        ))}
      </div>
      <Button
        onClick={() => {
          if (!draft.title.trim())
            return n.notify("El nombre no puede quedar vacío.", true);
          n.run(
            () =>
              n.actions.updateIdea(idea.id, {
                title: draft.title.trim(),
                category: draft.category,
                potential: draft.potential,
                description: draft.description,
                notes: draft.notes,
              }),
            "Idea actualizada.",
          );
        }}
      >
        Guardar cambios
      </Button>
      <div className="form-grid">
        <label className="field">
          Programar revisión
          <input
            type="date"
            value={reviewDate}
            onChange={(e) => setReviewDate(e.target.value)}
          />
        </label>
        <Button
          variant="secondary"
          style={{ alignSelf: "end" }}
          onClick={() =>
            n.run(
              () => n.actions.scheduleReview(idea.id, reviewDate),
              "Revisión añadida al calendario.",
            )
          }
        >
          <CalendarClock size={16} />
          Programar
        </Button>
      </div>
      <div className="row wrap">
        {idea.status !== "converted" && (
          <Button
            variant="secondary"
            onClick={() => {
              const id = n.run(() => n.actions.convertIdea(idea.id));
              if (id) {
                n.setSelectedIdeaId(null);
                router.push("/projects/" + id);
                n.notify("Tu idea ahora es un proyecto en Backlog.");
              }
            }}
          >
            Convertir en proyecto
            <ArrowUpRight size={15} />
          </Button>
        )}
        <Button
          variant="ghost"
          onClick={() => {
            n.run(
              () =>
                n.actions.updateIdea(idea.id, {
                  status: idea.status === "archived" ? "captured" : "archived",
                }),
              idea.status === "archived"
                ? "Idea restaurada."
                : "Idea archivada.",
            );
            n.setSelectedIdeaId(null);
          }}
        >
          <Archive size={15} />
          {idea.status === "archived" ? "Restaurar" : "Archivar"}
        </Button>
        <Button variant="danger" onClick={() => setConfirmDelete(true)}>
          <Trash2 size={15} />
          Eliminar
        </Button>
      </div>
      {confirmDelete && (
        <div className="system-alert">
          <p>
            ¿Eliminar esta idea y su entrada del Inbox? Los proyectos derivados
            se conservan.
          </p>
          <div className="row wrap" style={{ marginTop: 15 }}>
            <Button
              variant="danger"
              onClick={() => {
                n.run(() => n.actions.deleteIdea(idea.id), "Idea eliminada.");
                n.setSelectedIdeaId(null);
              }}
            >
              Sí, eliminar idea
            </Button>
            <Button variant="ghost" onClick={() => setConfirmDelete(false)}>
              Cancelar
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
export function IdeaPanel() {
  const n = useNexus();
  const idea = n.data.ideas.find((i) => i.id === n.selectedIdeaId);
  return (
    <Modal
      open={!!idea}
      onClose={() => n.setSelectedIdeaId(null)}
      title="Idea / contexto"
    >
      {idea && <IdeaEditor key={idea.id} idea={idea} />}
    </Modal>
  );
}
