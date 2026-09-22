"use client";
import { useState } from "react";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Plus,
  Clock3,
  Trash2,
  WandSparkles,
} from "lucide-react";
import { useNexus } from "../nexus-provider";
import {
  Button,
  Empty,
  Modal,
  ModuleFrame,
  Tabs,
  Badge,
  Label,
} from "../ui/primitives";
import type { CalendarEvent, TimeCategory } from "@/domain/models";
import { entity } from "@/domain/seed";
import { dateKey } from "@/domain/selectors";
import { addDays, localInput, zonedISO } from "@/lib/time";
const categories: { value: TimeCategory; label: string }[] = [
  { value: "focus", label: "Deep Work / Flow" },
  { value: "meeting", label: "Meetings" },
  { value: "admin", label: "Admin" },
  { value: "client", label: "Client Work" },
  { value: "university", label: "University" },
  { value: "personal", label: "Personal" },
  { value: "deadline", label: "Deadline" },
];
function EventEditor({
  event,
  date,
  close,
}: {
  event?: CalendarEvent;
  date: string;
  close: () => void;
}) {
  const n = useNexus();
  const timezone = n.data.user.preferences.timezone;
  const [title, setTitle] = useState(event?.title ?? "");
  const [start, setStart] = useState(
    event ? localInput(event.start, timezone) : date + "T09:00",
  );
  const [end, setEnd] = useState(
    event ? localInput(event.end, timezone) : date + "T10:00",
  );
  const [category, setCategory] = useState<TimeCategory>(
    event?.category ?? "focus",
  );
  const [projectId, setProjectId] = useState(event?.projectId ?? "");
  const [error, setError] = useState("");
  const [deleting, setDeleting] = useState(false);
  const conflicts =
    start && end
      ? n.data.events.filter(
          (e) =>
            e.id !== event?.id &&
            +new Date(e.start) < +new Date(zonedISO(end, timezone)) &&
            +new Date(e.end) > +new Date(zonedISO(start, timezone)),
        )
      : [];
  async function findSlot() {
    try {
      const slots = await n.services.calendar.findAvailability(
        n.data.user.id,
        zonedISO(date + "T09:00", timezone),
        zonedISO(date + "T18:00", timezone),
        60,
      );
      if (slots[0]) {
        setStart(localInput(slots[0].start, timezone));
        setEnd(localInput(slots[0].end, timezone));
        setError("");
      } else setError("No hay una hora libre entre las 09:00 y las 18:00.");
    } catch (e) {
      setError(String(e));
    }
  }
  return (
    <form
      className="stack"
      onSubmit={(e) => {
        e.preventDefault();
        try {
          n.actions.saveEvent({
            ...(event ?? entity(crypto.randomUUID(), "user", n.data.user.id)),
            title: title.trim(),
            start: zonedISO(start, timezone),
            end: zonedISO(end, timezone),
            category,
            projectId: projectId || undefined,
          });
          close();
          n.notify("Bloque guardado.");
        } catch (e) {
          setError(e instanceof Error ? e.message : "No se pudo guardar.");
        }
      }}
    >
      <label className="field">
        Resultado o evento
        <input
          autoFocus
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="¿A qué le darás tu tiempo?"
        />
      </label>
      <div className="form-grid">
        <label className="field">
          Inicio
          <input
            type="datetime-local"
            required
            value={start}
            onChange={(e) => setStart(e.target.value)}
          />
        </label>
        <label className="field">
          Fin
          <input
            type="datetime-local"
            required
            value={end}
            onChange={(e) => setEnd(e.target.value)}
          />
        </label>
      </div>
      <div className="form-grid">
        <label className="field">
          Tipo de energía
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as TimeCategory)}
          >
            {categories.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          Proyecto
          <select
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
          >
            <option value="">Personal / sin proyecto</option>
            {n.projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <Button type="button" variant="secondary" onClick={findSlot}>
        <WandSparkles size={15} />
        Buscar una hora libre
      </Button>
      {conflicts.length > 0 && (
        <p className="form-note">
          Coincide con {conflicts.map((e) => e.title).join(", ")}. Puedes
          conservar la coincidencia si es intencional.
        </p>
      )}
      {error && (
        <p role="alert" className="accent">
          {error}
        </p>
      )}
      <div className="form-note">
        Hora de {timezone}. Google Calendar no está conectado.
      </div>
      <div className="row between">
        <Button type="submit">Guardar bloque</Button>
        {event && (
          <Button
            type="button"
            variant="danger"
            onClick={() => {
              if (!deleting) setDeleting(true);
              else {
                n.run(
                  () => n.actions.deleteEvent(event.id),
                  "Bloque eliminado.",
                );
                close();
              }
            }}
          >
            <Trash2 size={14} />
            {deleting ? "Confirmar eliminación" : "Eliminar"}
          </Button>
        )}
      </div>
    </form>
  );
}
export function CalendarView() {
  const n = useNexus();
  const [view, setView] = useState("week");
  const [anchor, setAnchor] = useState(() => dateKey());
  const [filter, setFilter] = useState("all");
  const [edit, setEdit] = useState<CalendarEvent | null | undefined>(undefined);
  const [selectedDate, setSelectedDate] = useState(anchor);
  const day = new Date(anchor + "T12:00:00Z");
  const weekday = (day.getUTCDay() + 6) % 7;
  const weekStart = addDays(anchor, -weekday);
  const monthStart = anchor.slice(0, 7) + "-01";
  const gridStart = addDays(
    monthStart,
    -((new Date(monthStart + "T12:00:00Z").getUTCDay() + 6) % 7),
  );
  const days =
    view === "today"
      ? [anchor]
      : view === "month"
        ? Array.from({ length: 42 }, (_, i) => addDays(gridStart, i))
        : Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const events = n.data.events
    .filter((e) => filter === "all" || e.category === filter)
    .sort((a, b) => +new Date(a.start) - +new Date(b.start));
  const dayEvents = (date: string) =>
    events.filter(
      (e) =>
        dateKey(new Date(e.start), n.data.user.preferences.timezone) <= date &&
        dateKey(new Date(e.end), n.data.user.preferences.timezone) >= date,
    );
  const open = (date: string) => {
    setSelectedDate(date);
    setEdit(null);
  };
  function move(dir: number) {
    if (view === "month") {
      const date = new Date(monthStart + "T12:00:00Z");
      date.setUTCMonth(date.getUTCMonth() + dir);
      setAnchor(date.toISOString().slice(0, 10));
    } else setAnchor(addDays(anchor, dir * (view === "today" ? 1 : 7)));
  }
  const periodEvents = events.filter((e) =>
    days.includes(dateKey(new Date(e.start), n.data.user.preferences.timezone)),
  );
  return (
    <ModuleFrame
      eyebrow="Time architecture / 03"
      title="Calendar"
      description="Diseña tu tiempo alrededor de lo que importa."
      action={
        <Button onClick={() => open(anchor)}>
          <Plus size={15} />
          Reservar tiempo
        </Button>
      }
    >
      <div className="toolbar">
        <Tabs
          value={view}
          onChange={setView}
          items={[
            { value: "today", label: "Today" },
            { value: "week", label: "Week" },
            { value: "month", label: "Month" },
            { value: "timeline", label: "Timeline" },
          ]}
        />
        <div className="row">
          <button
            className="icon-button"
            aria-label="Periodo anterior"
            onClick={() => move(-1)}
          >
            <ChevronLeft size={16} />
          </button>
          <span className="calendar-period">
            {new Intl.DateTimeFormat("es-NI", {
              month: "long",
              year: "numeric",
              timeZone: "UTC",
            }).format(day)}
          </span>
          <button
            className="icon-button"
            aria-label="Periodo siguiente"
            onClick={() => move(1)}
          >
            <ChevronRight size={16} />
          </button>
          <Button variant="ghost" onClick={() => setAnchor(dateKey())}>
            Hoy
          </Button>
        </div>
      </div>
      <div className="filter-chips">
        <button
          className={filter === "all" ? "active" : ""}
          onClick={() => setFilter("all")}
        >
          Todo
        </button>
        {categories.map((c) => (
          <button
            key={c.value}
            className={filter === c.value ? "active" : ""}
            onClick={() => setFilter(c.value)}
          >
            {c.label}
          </button>
        ))}
      </div>
      <div className="calendar-meta">
        <span>
          <Clock3 size={14} />
          {(
            periodEvents.reduce(
              (s, e) => s + (+new Date(e.end) - +new Date(e.start)),
              0,
            ) / 3600000
          ).toFixed(1)}{" "}
          h reservadas en el periodo
        </span>
        <Badge>GOOGLE CALENDAR · NOT CONNECTED</Badge>
      </div>
      {view === "timeline" ? (
        <div className="calendar-timeline">
          {days.map((date) => (
            <div key={date} className="calendar-timeline-day">
              <Label>
                {new Date(date + "T12:00:00Z").toLocaleDateString("es-NI", {
                  weekday: "long",
                  day: "numeric",
                  timeZone: "UTC",
                })}
              </Label>
              <div>
                {dayEvents(date).map((e) => (
                  <button
                    key={e.id}
                    className="time-unit"
                    onClick={() => setEdit(e)}
                  >
                    <span>
                      {localInput(
                        e.start,
                        n.data.user.preferences.timezone,
                      ).slice(11)}{" "}
                      —{" "}
                      {localInput(
                        e.end,
                        n.data.user.preferences.timezone,
                      ).slice(11)}
                    </span>
                    <h3>{e.title}</h3>
                    <small>
                      {e.category} · {e.source === "demo" ? "Demo" : "Local"}
                    </small>
                  </button>
                ))}
                {!dayEvents(date).length && (
                  <button className="calendar-add" onClick={() => open(date)}>
                    <Plus size={14} />
                    Reservar un bloque
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="calendar-scroll">
          <div className={"calendar-grid calendar-" + view}>
            {days.map((date) => (
              <section
                key={date}
                className={
                  "calendar-day " +
                  (date === dateKey() ? "is-today" : "") +
                  (view === "month" && date.slice(0, 7) !== anchor.slice(0, 7)
                    ? "outside-month"
                    : "")
                }
              >
                <button
                  className="calendar-day-head"
                  onClick={() => open(date)}
                >
                  <span>
                    {new Date(date + "T12:00:00Z")
                      .toLocaleDateString("es-NI", {
                        weekday: "short",
                        timeZone: "UTC",
                      })
                      .toUpperCase()}
                  </span>
                  <strong>{Number(date.slice(8))}</strong>
                  <Plus size={13} />
                </button>
                <div className="calendar-day-events">
                  {dayEvents(date).map((e) => (
                    <button
                      key={e.id}
                      className={"time-unit time-" + e.category}
                      onClick={() => setEdit(e)}
                    >
                      <span>
                        {localInput(
                          e.start,
                          n.data.user.preferences.timezone,
                        ).slice(11)}
                      </span>
                      <h3>{e.title}</h3>
                      <small>
                        {n.projects.find((p) => p.id === e.projectId)?.name ??
                          categories.find((c) => c.value === e.category)?.label}
                        {e.source === "demo" ? " · Demo" : ""}
                      </small>
                    </button>
                  ))}
                </div>
                {view === "today" && !dayEvents(date).length && (
                  <Empty
                    title="Un día por diseñar."
                    text="Protege una hora para tu siguiente avance."
                    onAction={() => open(date)}
                    action="Reservar tiempo"
                  />
                )}
              </section>
            ))}
          </div>
        </div>
      )}
      <div className="calendar-deadlines">
        <Label>
          <CalendarDays size={14} />
          DEADLINES
        </Label>
        {n.projects
          .filter((p) => p.dueDate && p.status !== "completed")
          .map((p) => (
            <button
              key={p.id}
              className="badge"
              onClick={() => {
                setAnchor(p.dueDate!);
                setView("today");
              }}
            >
              {p.name} · {p.dueDate}
            </button>
          ))}
      </div>
      <Modal
        open={edit !== undefined}
        onClose={() => setEdit(undefined)}
        title={edit ? "Editar bloque" : "Proteger tiempo"}
      >
        {edit !== undefined && (
          <EventEditor
            key={edit?.id ?? selectedDate}
            event={edit ?? undefined}
            date={selectedDate}
            close={() => setEdit(undefined)}
          />
        )}
      </Modal>
    </ModuleFrame>
  );
}
