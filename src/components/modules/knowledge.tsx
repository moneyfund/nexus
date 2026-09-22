"use client";
import { useState } from "react";
import {
  Search,
  FileText,
  Link2,
  NotebookPen,
  Paperclip,
  ArrowUpRight,
  Plus,
  BookOpen,
  Trash2,
} from "lucide-react";
import { useNexus } from "../nexus-provider";
import {
  ModuleFrame,
  Button,
  Label,
  Badge,
  Empty,
  Modal,
} from "../ui/primitives";
import type { KnowledgeItem } from "@/domain/models";
import { CATEGORIES } from "@/config/system";
const icons = {
  note: NotebookPen,
  link: Link2,
  document: FileText,
  pdf: FileText,
  research: BookOpen,
  memory: NotebookPen,
};
function KnowledgeEditor({
  item,
  close,
}: {
  item: KnowledgeItem;
  close: () => void;
}) {
  const n = useNexus();
  const [draft, setDraft] = useState(item);
  const [deleting, setDeleting] = useState(false);
  const attachment = n.data.attachments.find((a) => a.id === item.attachmentId);
  return (
    <div className="stack">
      <div className="row wrap">
        <Badge>{item.type.toUpperCase()}</Badge>
        <span className="small muted">
          {new Date(item.createdAt).toLocaleDateString("es-NI")}
          {item.source === "demo" ? " · Demo" : ""}
        </span>
      </div>
      <label className="field">
        Título
        <input
          value={draft.title}
          onChange={(e) => setDraft({ ...draft, title: e.target.value })}
        />
      </label>
      <label className="field">
        Contenido
        <textarea
          rows={8}
          value={draft.content}
          onChange={(e) => setDraft({ ...draft, content: e.target.value })}
        />
      </label>
      <div className="form-grid">
        <label className="field">
          Categoría
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
          Proyecto
          <select
            value={draft.projectId ?? ""}
            onChange={(e) =>
              setDraft({ ...draft, projectId: e.target.value || undefined })
            }
          >
            <option value="">Sin proyecto</option>
            {n.projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="field">
        Etiquetas · separadas por coma
        <input
          value={draft.tags.join(", ")}
          onChange={(e) =>
            setDraft({
              ...draft,
              tags: e.target.value.split(",").map((t) => t.trim()),
            })
          }
        />
      </label>
      {draft.url && (
        <a
          className="inline-arrow"
          href={/^https?:\/\//.test(draft.url) ? draft.url : undefined}
          target="_blank"
          rel="noopener noreferrer"
        >
          Abrir enlace
          <ArrowUpRight size={15} />
        </a>
      )}
      {attachment && (
        <div className="surface">
          <Label>
            <Paperclip size={14} />
            ARCHIVO REFERENCIADO
          </Label>
          <h3 style={{ margin: "12px 0" }}>{attachment.name}</h3>
          <p className="small">
            {(attachment.size / 1024).toFixed(1)} KB ·{" "}
            {attachment.mimeType || "Archivo"}
            <br />
            Solo metadatos. El archivo no está almacenado; Drive y Firebase
            Storage no están conectados.
          </p>
        </div>
      )}
      <div className="row between">
        <Button
          onClick={() => {
            if (!draft.title.trim()) return;
            n.update((w) => {
              const i = w.knowledge.findIndex((k) => k.id === item.id);
              w.knowledge[i] = {
                ...draft,
                title: draft.title.trim(),
                tags: draft.tags.filter(Boolean),
                updatedAt: Date.now(),
              };
            });
            n.notify("Conocimiento actualizado.");
            close();
          }}
        >
          Guardar cambios
        </Button>
        <Button
          variant="danger"
          onClick={() => {
            if (!deleting) setDeleting(true);
            else {
              n.update((w) => {
                w.knowledge = w.knowledge.filter((k) => k.id !== item.id);
                w.inbox = w.inbox.filter((i) => i.targetId !== item.id);
                w.attachments = w.attachments.filter(
                  (a) => a.id !== item.attachmentId,
                );
              });
              close();
            }
          }}
        >
          <Trash2 size={14} />
          {deleting ? "Confirmar eliminación" : "Eliminar"}
        </Button>
      </div>
    </div>
  );
}
export function KnowledgeView({
  initialItemId = "",
}: {
  initialItemId?: string;
}) {
  const n = useNexus();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [selected, setSelected] = useState(initialItemId);
  const items = n.data.knowledge.filter(
    (k) =>
      (category === "all" || k.category === category) &&
      (k.title + k.content + k.tags.join(" "))
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  const item = n.data.knowledge.find((k) => k.id === selected);
  return (
    <ModuleFrame
      eyebrow="Knowledge core / 09"
      title="Knowledge"
      description="El contexto que hace valiosas tus ideas. Siempre a mano."
      action={
        <Button onClick={() => n.openCapture("note")}>
          <Plus size={16} />
          Añadir conocimiento
        </Button>
      }
    >
      <div className="knowledge-index">
        <div>
          <Label>MEMORY INDEX</Label>
          <strong>
            {String(n.data.knowledge.length).padStart(2, "0")}
            <span>referencias conectadas</span>
          </strong>
        </div>
        <div className="row wrap">
          <Button variant="secondary" onClick={() => n.openCapture("link")}>
            <Link2 size={15} />
            Enlace
          </Button>
          <Button variant="secondary" onClick={() => n.openCapture("file")}>
            <Paperclip size={15} />
            Archivo
          </Button>
        </div>
      </div>
      <div className="toolbar">
        <div className="filter-chips">
          <button
            className={category === "all" ? "active" : ""}
            onClick={() => setCategory("all")}
          >
            Todo
          </button>
          {[
            ...new Set([
              ...n.data.knowledge.map((k) => k.category),
              "Universidad",
              "Clientes",
              "Personal",
            ]),
          ].map((c) => (
            <button
              key={c}
              className={category === c ? "active" : ""}
              onClick={() => setCategory(c)}
            >
              {c}
            </button>
          ))}
        </div>
        <div className="search-field">
          <Search size={16} className="muted" />
          <input
            aria-label="Buscar conocimiento"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar en tu memoria…"
          />
        </div>
      </div>
      <div className="knowledge-items">
        {items.map((k) => {
          const Icon = icons[k.type];
          return (
            <button
              key={k.id}
              className="knowledge-item"
              onClick={() => setSelected(k.id)}
            >
              <div className="knowledge-type-icon">
                <Icon size={22} strokeWidth={1.2} />
              </div>
              <div>
                <Label>
                  {k.type} / {k.category}
                </Label>
                <h3>{k.title}</h3>
                <p>{k.content.slice(0, 130)}</p>
                <div className="row wrap">
                  {k.tags.map((t) => (
                    <span key={t} className="knowledge-tag">
                      #{t}
                    </span>
                  ))}
                </div>
              </div>
              <ArrowUpRight size={17} />
            </button>
          );
        })}
      </div>
      {!items.length && (
        <Empty
          title="Aquí vive lo que aprendes."
          text="Guarda una nota, una investigación o una referencia para encontrarla cuando la necesites."
          onAction={() => n.openCapture("note")}
          action="Crear nota"
        />
      )}
      <Modal
        open={!!item}
        onClose={() => setSelected("")}
        title="Knowledge / contexto"
        wide
      >
        {item && (
          <KnowledgeEditor
            key={item.id}
            item={item}
            close={() => setSelected("")}
          />
        )}
      </Modal>
    </ModuleFrame>
  );
}
