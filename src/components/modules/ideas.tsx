"use client";
import { useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { Plus, ArrowUpRight, Lightbulb, Check, Orbit } from "lucide-react";
import { useNexus } from "../nexus-provider";
import {
  ModuleFrame,
  Button,
  Tabs,
  Label,
  Badge,
  Empty,
} from "../ui/primitives";
const Galaxy = dynamic(
  () => import("../nexus-galaxy").then((m) => m.NexusGalaxy),
  { ssr: false },
);
export function IdeasView() {
  const n = useNexus();
  const [view, setView] = useState("galaxy");
  const [filter, setFilter] = useState("all");
  const ideas = n.data.ideas.filter((i) =>
    filter === "all" ? i.status !== "archived" : i.status === filter,
  );
  const inbox = n.inbox.filter((i) => !i.processed);
  return (
    <ModuleFrame
      eyebrow="Opportunity universe / 05"
      title="Ideas"
      description="No todas las ideas necesitan una fecha. Todas merecen un lugar."
      action={
        <Button onClick={() => n.openCapture("idea")}>
          <Plus size={16} />
          Nueva idea
        </Button>
      }
    >
      <div className="toolbar">
        <Tabs
          value={view}
          onChange={setView}
          items={[
            { value: "galaxy", label: "Galaxy", icon: <Orbit size={15} /> },
            { value: "list", label: "Ideas" },
            { value: "inbox", label: `Inbox · ${inbox.length}` },
          ]}
        />
        <Badge>
          {n.data.ideas.filter((i) => i.status === "converted").length} IDEAS →
          PROYECTOS
        </Badge>
      </div>
      {view === "galaxy" && (
        <div className="ideas-galaxy">
          <Galaxy compact />
        </div>
      )}
      {view !== "inbox" && (
        <>
          <div className="filter-chips" style={{ marginTop: 25 }}>
            {[
              { id: "all", label: "En órbita" },
              { id: "review", label: "En revisión" },
              { id: "converted", label: "Convertidas" },
              { id: "archived", label: "Archivadas" },
            ].map((s) => (
              <button
                className={filter === s.id ? "active" : ""}
                key={s.id}
                onClick={() => setFilter(s.id)}
              >
                {s.label}
              </button>
            ))}
          </div>
          <div className="idea-list">
            {ideas.map((i) => (
              <button
                className="idea-row"
                key={i.id}
                onClick={() => n.setSelectedIdeaId(i.id)}
              >
                <span className="idea-orb">
                  <Lightbulb size={18} strokeWidth={1.3} />
                </span>
                <div>
                  <Label>
                    {i.category} / {i.potential}
                  </Label>
                  <h3>{i.title}</h3>
                  {i.reviewDate && (
                    <span className="small muted">
                      Revisión · {i.reviewDate}
                    </span>
                  )}
                </div>
                <Badge>
                  {i.status === "converted"
                    ? "PROJECT"
                    : i.status.toUpperCase()}
                </Badge>
                <ArrowUpRight size={16} />
              </button>
            ))}
          </div>
          {!ideas.length && (
            <Empty
              title="Tu universo todavía está en silencio."
              text="Una idea pequeña puede ser el comienzo de tu siguiente proyecto."
              onAction={() => n.openCapture("idea")}
              action="Capturar idea"
            />
          )}
        </>
      )}
      {view === "inbox" && (
        <div className="section">
          {inbox.map((i) => {
            const href =
              i.type === "project"
                ? "/projects/" + i.targetId
                : ["note", "link", "file"].includes(i.type)
                  ? "/knowledge?item=" + i.targetId
                  : ["income", "expense"].includes(i.type)
                    ? "/finance"
                    : "/projects";
            return (
              <div className="inbox-row" key={i.id}>
                <Badge>{i.type}</Badge>
                <p>{i.content}</p>
                {i.type === "idea" ? (
                  <button
                    className="icon-button"
                    onClick={() => n.setSelectedIdeaId(i.targetId ?? i.id)}
                    aria-label={"Abrir " + i.content}
                  >
                    <ArrowUpRight size={15} />
                  </button>
                ) : (
                  <Link
                    href={href}
                    className="icon-button"
                    aria-label={"Abrir " + i.content}
                  >
                    <ArrowUpRight size={15} />
                  </Link>
                )}
                <button
                  className="icon-button"
                  aria-label={"Procesar " + i.content}
                  onClick={() =>
                    n.run(
                      () => n.actions.processInbox(i.id),
                      "Entrada procesada.",
                    )
                  }
                >
                  <Check size={16} />
                </button>
              </div>
            );
          })}
          {!inbox.length && (
            <Empty
              title="La bandeja está en calma."
              text="Las nuevas capturas aparecerán aquí, sin interrumpir lo que estás haciendo."
              onAction={() => n.openCapture()}
            />
          )}
        </div>
      )}
    </ModuleFrame>
  );
}
