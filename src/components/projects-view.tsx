"use client";
import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import {
  ArrowUpRight,
  Plus,
  Search,
  LayoutList,
  Orbit,
  CalendarRange,
  Columns3,
  Grid2X2,
} from "lucide-react";
import { useNexus } from "./nexus-provider";
import {
  ModuleFrame,
  Badge,
  Button,
  Tabs,
  Empty,
  ProgressRing,
  Label,
} from "./ui/primitives";
import { ProjectCard } from "./project-card";
import type { ProjectStatus } from "@/domain/models";
const Galaxy = dynamic(
  () => import("./nexus-galaxy").then((m) => m.NexusGalaxy),
  { ssr: false },
);
const statuses: { value: ProjectStatus; label: string }[] = [
  { value: "active", label: "Activos" },
  { value: "backlog", label: "Backlog" },
  { value: "waiting", label: "En espera" },
  { value: "completed", label: "Completados" },
];
export function ProjectsView() {
  const n = useNexus();
  const [view, setView] = useState("map");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const projects = n.projects;
  const visible = useMemo(
    () =>
      projects.filter(
        (p) =>
          (filter === "all" || p.status === filter) &&
          (p.name + p.area).toLowerCase().includes(query.toLowerCase()),
      ),
    [projects, filter, query],
  );
  const visibleIds = useMemo(() => visible.map((p) => p.id), [visible]);
  const active = n.projects.filter((p) => p.status === "active").length;
  return (
    <ModuleFrame
      eyebrow="Mission control / 02"
      title="Tus misiones"
      description="Prioriza, enfoca y haz avanzar cada frente."
      action={
        <Button onClick={() => n.openCapture("project")}>
          <Plus size={16} />
          Nuevo proyecto
        </Button>
      }
    >
      <div className="capacity-band">
        <div>
          <Label>ACTIVE CAPACITY</Label>
          <strong>
            {active}
            <span> / 5</span>
          </strong>
        </div>
        <div className="capacity-slots">
          {Array.from({ length: 5 }, (_, i) => (
            <span key={i} className={i < active ? "filled" : ""} />
          ))}
        </div>
        <p>
          {active >= 5
            ? "Capacidad completa. Termina o pausa un frente antes de abrir otro."
            : `${5 - active} espacios disponibles para lo que viene.`}
        </p>
      </div>
      <div className="toolbar">
        <Tabs
          value={view}
          onChange={setView}
          items={[
            { value: "map", label: "Universo", icon: <Orbit size={14} /> },
            { value: "list", label: "Lista", icon: <LayoutList size={14} /> },
            { value: "grid", label: "Paneles", icon: <Grid2X2 size={14} /> },
            {
              value: "timeline",
              label: "Cronología",
              icon: <CalendarRange size={14} />,
            },
            { value: "status", label: "Estados", icon: <Columns3 size={14} /> },
          ]}
        />
        <div className="search-field">
          <Search size={16} className="muted" />
          <input
            aria-label="Buscar proyecto"
            placeholder="Buscar proyecto…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>
      <div className="filter-chips">
        <button
          className={filter === "all" ? "active" : ""}
          onClick={() => setFilter("all")}
        >
          Todos
        </button>
        {statuses.map((s) => (
          <button
            key={s.value}
            className={filter === s.value ? "active" : ""}
            onClick={() => setFilter(s.value)}
          >
            {s.label}
          </button>
        ))}
      </div>
      {!visible.length ? (
        <Empty
          title="Espacio para un nuevo frente."
          text="No hay proyectos con este filtro."
          onAction={() => n.openCapture("project")}
          action="Crear proyecto"
        />
      ) : view === "map" ? (
        <div className="mission-map">
          <Galaxy compact projectIds={visibleIds} includeIdeas={false} />
          <div className="mission-directory" aria-label="Lista de misiones">
            {visible.map((p) => (
              <Link
                key={p.id}
                href={"/project?id=" + encodeURIComponent(p.id)}
                className="mission-entry"
              >
                <ProgressRing value={p.progress} size={44} />
                <div>
                  <Badge active={p.status === "active"}>
                    {statuses.find((s) => s.value === p.status)?.label}
                  </Badge>
                  <h3>{p.name}</h3>
                  <p>
                    {p.tasks.find((t) => !t.completed)?.title || p.nextAction}
                  </p>
                  <div className="mission-meta">
                    <span>
                      {
                        {
                          critical: "Crítica",
                          high: "Alta",
                          medium: "Media",
                          low: "Baja",
                        }[p.priority]
                      }
                    </span>
                    <span>
                      {p.metadata?.hoursBasis === "flow-only" && p.hours === 0
                        ? "Sin medir"
                        : p.hours.toFixed(1) + " h"}
                    </span>
                    <span>{p.dueDate ?? "Sin fecha"}</span>
                  </div>
                </div>
                <ArrowUpRight size={15} />
              </Link>
            ))}
          </div>
        </div>
      ) : view === "grid" ? (
        <div className="project-grid">
          {visible.map((p) => (
            <ProjectCard key={p.id} project={p} />
          ))}
        </div>
      ) : view === "status" ? (
        <div className="status-board">
          {statuses.map((s) => (
            <section key={s.value}>
              <Label>
                {s.label} / {visible.filter((p) => p.status === s.value).length}
              </Label>
              {visible
                .filter((p) => p.status === s.value)
                .map((p) => (
                  <div className="status-project" key={p.id}>
                    <Link href={"/project?id=" + encodeURIComponent(p.id)}>
                      <h3>{p.name}</h3>
                      <p>{p.nextAction}</p>
                    </Link>
                    <label className="field">
                      <span className="sr-only">Estado de {p.name}</span>
                      <select
                        value={p.status}
                        onChange={(e) =>
                          n.run(() =>
                            n.actions.setStatus(
                              p.id,
                              e.target.value as ProjectStatus,
                            ),
                          )
                        }
                      >
                        {statuses.map((s) => (
                          <option key={s.value} value={s.value}>
                            {s.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                ))}
            </section>
          ))}
        </div>
      ) : (
        <div className="project-ledger section">
          {[...visible]
            .sort((a, b) =>
              view === "timeline"
                ? (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999")
                : 0,
            )
            .map((p) => (
              <Link
                key={p.id}
                href={"/project?id=" + encodeURIComponent(p.id)}
                className="ledger-row"
              >
                <span className="ledger-index">
                  {view === "timeline" ? (
                    <CalendarRange size={18} />
                  ) : (
                    <Orbit size={18} />
                  )}
                </span>
                <div>
                  <h3>{p.name}</h3>
                  <span className="small muted">{p.area}</span>
                </div>
                <div className="ledger-progress">
                  <span style={{ width: p.progress + "%" }} />
                </div>
                <span className="ledger-percent">{p.progress}%</span>
                <span className="ledger-deadline">
                  {p.dueDate ?? "Sin fecha"}
                </span>
                <ArrowUpRight size={16} />
              </Link>
            ))}
        </div>
      )}
    </ModuleFrame>
  );
}
