"use client";

import {
  ChevronRight,
  FolderKanban,
  History,
  MessageSquarePlus,
  Trash2,
} from "lucide-react";
import { useNexus } from "./nexus-provider";

export function AIConversationNav({
  activeConversationId,
  onSelect,
  onNew,
  onProject,
  onDelete,
}: {
  activeConversationId: string | null;
  onSelect: (conversationId: string) => void;
  onNew: () => void;
  onProject: (projectId: string) => void;
  onDelete: (conversationId: string) => void;
}) {
  const n = useNexus();
  const conversations = [...n.data.conversations].sort(
    (a, b) => b.updatedAt - a.updatedAt,
  );
  const history = conversations;
  const projectConversation = (projectId: string) =>
    conversations.find(
      (conversation) =>
        conversation.kind === "project" &&
        conversation.projectId === projectId,
    );

  return (
    <aside className="ai-thread-nav" aria-label="Conversaciones de NEXUS AI">
      <button className="ai-new-thread" onClick={onNew}>
        <MessageSquarePlus size={16} />
        <span>Nueva conversación</span>
      </button>

      <details className="ai-thread-group">
        <summary>
          <span>
            <FolderKanban size={15} />
            Proyectos
          </span>
          <ChevronRight size={14} className="ai-thread-chevron" />
        </summary>
        <div className="ai-thread-list">
          {n.projects.map((project) => {
            const conversation = projectConversation(project.id);
            const active = conversation?.id === activeConversationId;
            return (
              <button
                key={project.id}
                className={"ai-thread-row " + (active ? "active" : "")}
                onClick={() => onProject(project.id)}
              >
                <span className="ai-thread-dot" data-status={project.status} />
                <span>
                  <strong>{project.name}</strong>
                  <small>
                    {conversation?.messageIds.length
                      ? conversation.messageIds.length + " mensajes"
                      : "Abrir chat del proyecto"}
                  </small>
                </span>
              </button>
            );
          })}
          {!n.projects.length && (
            <p className="ai-thread-empty">Aún no hay proyectos.</p>
          )}
        </div>
      </details>

      <details className="ai-thread-group">
        <summary>
          <span>
            <History size={15} />
            Historial
          </span>
          <span className="ai-thread-summary-meta">
            {history.length}
            <ChevronRight size={14} className="ai-thread-chevron" />
          </span>
        </summary>
        <div className="ai-thread-list">
          {history.map((conversation) => (
            <div
              key={conversation.id}
              className={
                "ai-thread-history-row " +
                (conversation.id === activeConversationId ? "active" : "")
              }
            >
              <button
                className="ai-thread-history-main"
                onClick={() => onSelect(conversation.id)}
              >
                <strong>{conversation.title}</strong>
                <small>
                  {conversation.kind === "project" ? "Proyecto · " : ""}
                  {conversation.messageIds.length} mensaje
                  {conversation.messageIds.length === 1 ? "" : "s"}
                </small>
              </button>
              <button
                className="ai-thread-delete"
                aria-label={"Eliminar conversación " + conversation.title}
                onClick={() => onDelete(conversation.id)}
              >
                <Trash2 size={13} />
              </button>
            </div>
          ))}
          {!history.length && (
            <p className="ai-thread-empty">
              Tus conversaciones generales aparecerán aquí.
            </p>
          )}
        </div>
      </details>
    </aside>
  );
}
