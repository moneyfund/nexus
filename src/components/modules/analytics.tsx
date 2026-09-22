"use client";
import { useState } from "react";
import { useNexus } from "../nexus-provider";
import {
  ModuleFrame,
  ProgressRing,
  Label,
  DataMetric,
  SectionHeading,
  Badge,
  Empty,
} from "../ui/primitives";
import { ComparisonBars } from "../ui/charts";
import { analytics, dateKey, money } from "@/domain/selectors";
import { addDays } from "@/lib/time";
export function AnalyticsView() {
  const n = useNexus();
  const a = analytics(n.data);
  const [now] = useState(() => Date.now());
  const today = dateKey(now);
  const days = Array.from({ length: 28 }, (_, i) => addDays(today, i - 27));
  const income = n.data.incomes.reduce((s, i) => s + i.amount, 0);
  const hours = n.projects.reduce((s, p) => s + p.hours, 0);
  const distribution = n.projects
    .map((p) => ({
      p,
      seconds: n.data.flows
        .filter((f) => f.projectId === p.id)
        .reduce((s, f) => s + (f.elapsedSeconds ?? 0), 0),
    }))
    .filter((p) => p.seconds > 0);
  return (
    <ModuleFrame
      eyebrow="Personal intelligence / 08"
      title="Analytics"
      description="El registro de lo que haces. La perspectiva de lo que puedes mejorar."
    >
      <div className="analytics-core">
        <div className="execution-score">
          <ProgressRing
            value={a.score}
            size={235}
            label={String(a.score)}
            caption="EXECUTION SCORE"
          />
          <div>
            <Label>EXECUTION SIGNAL</Label>
            <h2>Tu avance tiene forma.</h2>
            <p>
              {a.completed} de {a.totalTasks} tareas completadas.
              <br />
              {n.data.flows.length} sesiones de enfoque registradas.
            </p>
            <span className="form-note">
              Score = 60% tareas completadas + 40% proyectos entregados. Incluye
              proyectos demo.
            </span>
          </div>
        </div>
        <div className="analytics-orbits">
          <div>
            <ProgressRing value={a.completion} size={90} />
            <span>Completion rate</span>
          </div>
          <div>
            <ProgressRing value={a.delivery} size={90} />
            <span>Delivery rate</span>
          </div>
          <div>
            <ProgressRing value={a.ideaRate} size={90} />
            <span>Idea → Execution</span>
          </div>
        </div>
      </div>
      <div className="data-band">
        <DataMetric
          label="Deep Work"
          value={(a.seconds / 3600).toFixed(1) + " h"}
          meta="Tiempo de Flow registrado"
        />
        <DataMetric
          label="Focus streak"
          value={a.streak + " días"}
          meta="Días consecutivos con ≥ 1 min de Flow"
        />
        <DataMetric
          label="Revenue / hour"
          value={money(hours ? income / hours : 0)}
          meta="Cobrado ÷ horas; incluye demo"
        />
        <DataMetric
          label="Ideas ejecutadas"
          value={a.converted}
          meta="Ideas convertidas a proyecto"
        />
      </div>
      <div className="split section">
        <section>
          <SectionHeading
            label="FOCUS CONSTELLATION"
            title="La constancia deja huella."
            action={<Badge>28 DÍAS</Badge>}
          />
          <div className="focus-heatmap">
            {days.map((date) => {
              const seconds = n.data.flows
                .filter((f) => dateKey(f.startedAt) === date)
                .reduce((s, f) => s + (f.elapsedSeconds ?? 0), 0);
              return (
                <div
                  key={date}
                  tabIndex={0}
                  aria-label={`${date}: ${Math.round(seconds / 60)} minutos`}
                  title={`${date}: ${Math.round(seconds / 60)} min`}
                  className={seconds > 0 ? "lit" : ""}
                  style={{
                    opacity:
                      seconds > 0 ? 0.4 + Math.min(seconds / 7200, 0.6) : 1,
                  }}
                >
                  <span>{Number(date.slice(8))}</span>
                </div>
              );
            })}
          </div>
          <div className="row between small muted" style={{ marginTop: 18 }}>
            <span>{days[0]}</span>
            <span>{today}</span>
          </div>
          <p className="form-note" style={{ marginTop: 18 }}>
            La intensidad refleja minutos de Flow. Un día vacío significa que no
            hay sesiones registradas.
          </p>
        </section>
        <section>
          <SectionHeading
            label="ESTIMATED VS ACTUAL"
            title="Lo planeado y lo real."
          />
          {n.data.flows.length ? (
            <>
              <ComparisonBars
                rows={n.data.flows
                  .slice(0, 5)
                  .map((f) => ({
                    label: f.title,
                    estimated: f.durationMinutes,
                    actual: (f.elapsedSeconds ?? 0) / 60,
                  }))}
              />
              <p className="form-note">
                Barra tenue: estimado · barra violeta: tiempo real.
              </p>
            </>
          ) : (
            <Empty
              title="Primero, una sesión."
              text="Al terminar Flow podrás comparar el tiempo planificado con el que necesitaste."
            />
          )}
        </section>
      </div>
      <div className="split section">
        <section>
          <SectionHeading
            label="TIME DISTRIBUTION"
            title="Dónde vive tu atención."
          />
          <div className="distribution-ribbon">
            {distribution.map(({ p, seconds }, i) => (
              <span
                key={p.id}
                style={{
                  flex: seconds,
                  background: `hsl(${280 + i * 8} 55% ${45 + i * 6}%)`,
                }}
                title={`${p.name}: ${(seconds / 3600).toFixed(1)} h`}
              />
            ))}
          </div>
          {distribution.map(({ p, seconds }) => (
            <div key={p.id} className="signal-row">
              <p>{p.name}</p>
              <strong>{(seconds / 3600).toFixed(2)} h</strong>
            </div>
          ))}
          {!distribution.length && (
            <p className="muted">
              Todavía no hay tiempo de Flow para distribuir.
            </p>
          )}
        </section>
        <section>
          <SectionHeading
            label="PROJECT VELOCITY & AGING"
            title="Qué avanza. Qué espera."
          />
          {n.projects
            .filter((p) => p.status !== "completed")
            .map((p) => {
              const count = p.tasks.filter(
                (t) => t.completedAt && now - t.completedAt <= 7 * 86400000,
              ).length;
              const age = Math.max(
                0,
                Math.floor((now - p.createdAt) / 86400000),
              );
              return (
                <div className="velocity-row" key={p.id}>
                  <div>
                    <h3>{p.name}</h3>
                    <span className="small muted">
                      {age} días desde su registro
                      {p.source === "demo" ? " · Demo" : ""}
                    </span>
                  </div>
                  <strong>
                    {count}
                    <small>tareas / 7 días</small>
                  </strong>
                </div>
              );
            })}
        </section>
      </div>
    </ModuleFrame>
  );
}
