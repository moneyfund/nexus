"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Search,
  Plus,
  FileText,
  Layers3,
  Lightbulb,
  ArrowUpRight,
} from "lucide-react";
import { useNexus } from "./nexus-provider";
import { navigation } from "@/config/navigation";
import { Modal, Empty, Button, Label } from "./ui/primitives";
export function CommandPalette() {
  const n = useNexus();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState(0);
  useEffect(() => {
    const handle = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const editing = target.closest(
        'input, textarea, select, [contenteditable="true"]',
      );
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        n.setCommandOpen((v) => !v);
      } else if (
        !editing &&
        !document.querySelector("dialog[open]") &&
        !e.metaKey &&
        !e.ctrlKey &&
        !e.altKey &&
        e.key.toLowerCase() === "c"
      ) {
        e.preventDefault();
        n.openCapture();
      } else if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.code === "Space") {
        e.preventDefault();
        n.openCapture();
      }
    };
    window.addEventListener("keydown", handle);
    return () => window.removeEventListener("keydown", handle);
  }, [n]);
  const go = (href: string) => {
    n.setCommandOpen(false);
    router.push(href);
  };
  const commands = [
    ...navigation.map((i) => ({
      id: i.href,
      title: i.label,
      type: "Módulo",
      icon: i.icon,
      run: () => go(i.href),
    })),
    ...(["idea", "task", "project", "note"] as const).map((type) => ({
      id: "capture-" + type,
      title: {
        idea: "Capture idea · Capturar idea",
        task: "Crear tarea",
        project: "Crear proyecto",
        note: "Crear nota",
      }[type],
      type: "Acción",
      icon: Plus,
      run: () => {
        n.setCommandOpen(false);
        n.openCapture(type);
      },
    })),
    {
      id: "start-flow",
      title: "Start Flow · Iniciar enfoque",
      type: "Acción",
      icon: Layers3,
      run: () => go("/flow"),
    },
    ...n.projects.map((p) => ({
      id: p.id,
      title: p.name,
      type: "Proyecto",
      icon: Layers3,
      run: () => go("/projects/" + p.id),
    })),
    ...n.data.ideas
      .filter((i) => i.status !== "archived")
      .map((i) => ({
        id: i.id,
        title: i.title,
        type: "Idea",
        icon: Lightbulb,
        run: () => {
          n.setCommandOpen(false);
          n.setSelectedIdeaId(i.id);
        },
      })),
    ...n.data.knowledge.map((k) => ({
      id: k.id,
      title: k.title,
      type: "Conocimiento",
      icon: FileText,
      run: () => go("/knowledge?item=" + k.id),
    })),
  ]
    .filter((i) =>
      (i.title + " " + i.type)
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .includes(
          query
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, ""),
        ),
    )
    .slice(0, 25);
  const active = Math.min(index, commands.length - 1);
  return (
    <Modal
      open={n.commandOpen}
      onClose={() => n.setCommandOpen(false)}
      title="¿Qué quieres hacer?"
    >
      <div className="row">
        <Search size={22} className="accent" />
        <input
          autoFocus
          aria-label="Buscar comando, proyecto o documento"
          className="command-search"
          placeholder="Un proyecto, una idea, una acción…"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIndex(0);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setIndex((i) => Math.min(i + 1, commands.length - 1));
            }
            if (e.key === "ArrowUp") {
              e.preventDefault();
              setIndex((i) => Math.max(0, i - 1));
            }
            if (e.key === "Enter") commands[active]?.run();
          }}
        />
      </div>
      <div className="command-list">
        {commands.map((item, i) => (
          <button
            key={item.type + item.id}
            className={"command-item " + (i === active ? "active" : "")}
            onClick={item.run}
            onMouseEnter={() => setIndex(i)}
          >
            <item.icon size={17} />
            <span>{item.title}</span>
            <small>{item.type}</small>
          </button>
        ))}
        {!commands.length && (
          <Empty
            title="Todavía no está en tu universo."
            text="Prueba con otra palabra o crea una captura."
            onAction={() => {
              n.setCommandOpen(false);
              n.openCapture();
            }}
          />
        )}
      </div>
      <div className="form-note" style={{ marginTop: 20 }}>
        ↑ ↓ Navegar · Enter Abrir · Esc Volver · C Capturar
      </div>
    </Modal>
  );
}
export function NotificationCenter() {
  const n = useNexus();
  return (
    <Modal
      open={n.notificationOpen}
      onClose={() => n.setNotificationOpen(false)}
      title="System signals"
    >
      <div className="row between">
        <Label>
          {n.data.notifications.filter((i) => !i.read).length} SIN LEER
        </Label>
        <Button
          variant="ghost"
          onClick={() => n.run(() => n.actions.readNotifications())}
        >
          Marcar leídas
        </Button>
      </div>
      {n.data.notifications.map((item) => (
        <Link
          key={item.id}
          href={item.href}
          className={"notification-row " + (!item.read ? "unread" : "")}
          onClick={() => {
            n.run(() => n.actions.readNotifications(item.id));
            n.setNotificationOpen(false);
          }}
        >
          <div className="row between">
            <h3>{item.title}</h3>
            <ArrowUpRight size={16} />
          </div>
          <p>{item.body}</p>
          <span className="small muted">
            {item.source === "demo" ? "Demostración · " : ""}
            {new Date(item.createdAt).toLocaleDateString("es-NI")}
          </span>
        </Link>
      ))}
      {!n.data.notifications.length && (
        <Empty
          title="Todo en calma."
          text="Las señales de tu sistema aparecerán aquí."
        />
      )}
    </Modal>
  );
}
