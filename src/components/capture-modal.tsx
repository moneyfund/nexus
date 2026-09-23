"use client";
import { useState } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Lightbulb,
  ListTodo,
  NotebookPen,
  Layers3,
  UserRound,
  Paperclip,
  Link2,
} from "lucide-react";
import { useNexus } from "./nexus-provider";
import type { CaptureType } from "@/domain/models";
import { CATEGORIES } from "@/config/system";
import { Button, Modal } from "./ui/primitives";
import { interfaceSound } from "@/services/sound";
const options = [
  { type: "idea", label: "Idea", icon: Lightbulb },
  { type: "task", label: "Tarea", icon: ListTodo },
  { type: "note", label: "Nota", icon: NotebookPen },
  { type: "project", label: "Proyecto", icon: Layers3 },
  { type: "income", label: "Ingreso", icon: ArrowDownLeft },
  { type: "expense", label: "Gasto", icon: ArrowUpRight },
  { type: "contact", label: "Contacto", icon: UserRound },
  { type: "file", label: "Archivo", icon: Paperclip },
  { type: "link", label: "Enlace", icon: Link2 },
] as const;
function CaptureForm() {
  const n = useNexus();
  const [type, setType] = useState<CaptureType>(n.captureType);
  const [content, setContent] = useState("");
  const [projectId, setProjectId] = useState(n.captureProject);
  const [category, setCategory] = useState("Ideas");
  const [amount, setAmount] = useState("");
  const [url, setUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (saving) return;
    setSaving(true);
    setError("");
    let uploadedExternalId = "";

    try {
      let uploaded:
        | Awaited<ReturnType<typeof n.services.storage.upload>>
        | undefined;

      if (type === "file" && file && n.firebaseUser) {
        uploaded = await n.services.storage.upload(n.data.user.id, file);
        uploadedExternalId = uploaded.externalId ?? "";
      }

      const targetId = n.actions.capture({
        type,
        content,
        projectId: projectId || undefined,
        category,
        amount: Number(amount),
        url,
        file: file
          ? { name: file.name, type: file.type, size: file.size }
          : undefined,
      });

      if (uploaded && targetId) {
        n.update((w) => {
          const attachment = w.attachments.find((a) => a.id === targetId);
          if (attachment) {
            attachment.provider = "firebase";
            attachment.externalId = uploaded.externalId;
            attachment.mimeType = uploaded.mimeType;
            attachment.size = uploaded.size;
            attachment.updatedAt = Date.now();
          }
          const knowledge = w.knowledge.find(
            (k) => k.attachmentId === targetId,
          );
          if (knowledge) {
            knowledge.content = "Archivo almacenado en Firebase Storage.";
            knowledge.updatedAt = Date.now();
          }
        });
      }

      interfaceSound(n.data.user.preferences.sounds, "capture");
      n.setCaptureOpen(false);
      n.notify(
        type === "idea"
          ? "Una nueva idea se incorporó a tu universo."
          : type === "file" && uploaded
            ? "Archivo guardado en Firebase Storage."
            : "Captura guardada.",
      );
    } catch (e) {
      if (uploadedExternalId) {
        await n.services.storage
          .remove(n.data.user.id, uploadedExternalId)
          .catch(() => undefined);
      }
      setError(e instanceof Error ? e.message : "No se pudo guardar.");
    } finally {
      setSaving(false);
    }
  }
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      onKeyDown={(e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
          e.preventDefault();
          void submit();
        }
      }}
    >
      <div className="capture-types">
        {options.map((o) => (
          <button
            type="button"
            aria-pressed={type === o.type}
            key={o.type}
            onClick={() => {
              setType(o.type);
              setError("");
            }}
            className={type === o.type ? "active" : ""}
          >
            <o.icon size={18} />
            {o.label}
          </button>
        ))}
      </div>
      <div className="stack">
        <label className="field">
          {type === "idea"
            ? "¿Qué acaba de cruzar tu mente?"
            : "Nombre o descripción"}
          <textarea
            autoFocus
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Dale un lugar en NEXUS…"
            required
            maxLength={5000}
          />
        </label>
        <div className="form-grid">
          <label className="field">
            Proyecto {type === "task" ? "" : "(opcional)"}
            <select
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              required={type === "task"}
            >
              <option value="">Sin proyecto</option>
              {n.projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            Órbita / categoría
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              {CATEGORIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
        </div>
        {(type === "income" || type === "expense") && (
          <label className="field">
            Importe en USD
            <input
              type="number"
              min="0.01"
              step="0.01"
              required
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </label>
        )}
        {type === "link" && (
          <label className="field">
            URL
            <input
              type="url"
              required
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://…"
            />
          </label>
        )}
        {type === "file" && (
          <>
            <label className="field">
              Archivo
              <input
                type="file"
                required
                onChange={(e) => {
                  const f = e.target.files?.[0] ?? null;
                  setFile(f);
                  if (f && !content) setContent(f.name);
                }}
              />
            </label>
            <p className="form-note">
              {n.firebaseUser
                ? "El archivo se subirá a Firebase Storage y sus metadatos se sincronizarán con tu espacio."
                : "Sin sesión de Google se guardarán solo los metadatos. Conecta Firebase en System → Integrations para almacenar el archivo real."}
            </p>
          </>
        )}
        {error && (
          <p className="accent" role="alert">
            {error}
          </p>
        )}
      </div>
      <div className="form-actions">
        <span className="form-note">
          Ctrl / ⌘ + Enter
          <br />
{n.firebaseUser ? "Sincronizado con Firebase" : "Guardado en este navegador"}
        </span>
        <Button type="submit" disabled={!content.trim() || saving}>
          {saving ? "Guardando…" : `Capturar ${type === "idea" ? "idea" : ""}`}
          <ArrowUpRight size={16} />
        </Button>
      </div>
    </form>
  );
}
export function CaptureModal() {
  const n = useNexus();
  return (
    <Modal
      open={n.captureOpen}
      onClose={() => n.setCaptureOpen(false)}
      title="Que no se pierda."
    >
      {n.captureOpen && <CaptureForm />}
    </Modal>
  );
}
