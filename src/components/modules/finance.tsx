"use client";
import { useState } from "react";
import Link from "next/link";
import {
  Plus,
  ArrowUpRight,
  TrendingUp,
  ArrowDownLeft,
  ArrowUpRight as Out,
} from "lucide-react";
import { useNexus } from "../nexus-provider";
import {
  ModuleFrame,
  Button,
  Badge,
  DataMetric,
  SectionHeading,
  Label,
  Modal,
  Empty,
} from "../ui/primitives";
import { CashflowChart } from "../ui/charts";
import {
  dateKey,
  financialScope,
  money,
  projectFinance,
} from "@/domain/selectors";
import { entity } from "@/domain/seed";
export function FinanceView() {
  const n = useNexus();
  const [scope, setScope] = useState<"all" | "user">("all");
  const [goalOpen, setGoalOpen] = useState(false);
  const [goalName, setGoalName] = useState("");
  const [goalTarget, setGoalTarget] = useState("");
  const [goalKind, setGoalKind] = useState<"savings" | "investment">("savings");
  const scoped = financialScope(n.data, scope);
  const { incomes, expenses, projects, financialGoals } = scoped;
  const income = incomes.reduce((s, i) => s + i.amount, 0);
  const expense = expenses.reduce((s, i) => s + i.amount, 0);
  const receivable = projects.reduce(
    (s, p) => s + projectFinance(scoped, p).receivable,
    0,
  );
  const savings = financialGoals.reduce((s, g) => s + g.saved, 0);
  const currentMonth = dateKey().slice(0, 7);
  const [baseMonth] = useState(() => currentMonth);
  const values = Array.from({ length: 6 }, (_, i) => {
    const date = new Date(baseMonth + "-01T12:00:00Z");
    date.setUTCMonth(date.getUTCMonth() - 5 + i);
    const key = date.toISOString().slice(0, 7);
    return {
      label: date
        .toLocaleDateString("es-NI", { month: "short", timeZone: "UTC" })
        .toUpperCase(),
      income: incomes
        .filter((r) => r.date.startsWith(key))
        .reduce((s, r) => s + r.amount, 0),
      expense: expenses
        .filter((r) => r.date.startsWith(key))
        .reduce((s, r) => s + r.amount, 0),
    };
  });
  const records = [
    ...incomes.map((i) => ({ ...i, kind: "income" })),
    ...expenses.map((i) => ({ ...i, kind: "expense" })),
  ].sort((a, b) => b.date.localeCompare(a.date));
  return (
    <ModuleFrame
      eyebrow="Financial command center / 07"
      title="Finance"
      description="Entiende qué produce tu trabajo y hacia dónde va tu capital."
      action={
        <div className="row">
          <Button variant="secondary" onClick={() => n.openCapture("expense")}>
            Gasto
          </Button>
          <Button onClick={() => n.openCapture("income")}>
            <Plus size={15} />
            Ingreso
          </Button>
        </div>
      }
    >
      <div className="finance-headline">
        <div>
          <Label>CASHFLOW / ACUMULADO</Label>
          <div className="finance-net">
            {money(income - expense)}
            <span>USD</span>
          </div>
          <p>Ingresos registrados menos gastos registrados.</p>
        </div>
        <label className="field">
          Origen de datos
          <select
            value={scope}
            onChange={(e) => setScope(e.target.value as "all" | "user")}
          >
            <option value="all">Todo · incluye demostración</option>
            <option value="user">Solo mis registros</option>
          </select>
        </label>
      </div>
      <div className="data-band">
        <DataMetric
          label="Ingresos"
          value={money(income)}
          meta={`${incomes.length} cobros registrados`}
        />
        <DataMetric
          label="Por cobrar"
          value={money(receivable)}
          meta="Valor acordado menos cobrado"
        />
        <DataMetric
          label="Gastos"
          value={money(expense)}
          meta={`${expenses.length} movimientos`}
        />
        <DataMetric
          label="Capital disponible"
          value={money(income - expense - savings)}
          meta="Flujo neto menos reservas declaradas"
        />
      </div>
      <section className="section">
        <SectionHeading
          label="MONTHLY PERFORMANCE"
          title="El movimiento de tu dinero."
          action={<Badge>ÚLTIMOS 6 MESES</Badge>}
        />
        <CashflowChart values={values} />
      </section>
      <section className="section">
        <SectionHeading
          label="INCOME BY PROJECT"
          title="El valor de cada frente."
        />
        <div className="finance-table-scroll">
          <table className="finance-table">
            <thead>
              <tr>
                <th>Proyecto</th>
                <th>Valor</th>
                <th>Horas</th>
                <th>Valor / h</th>
                <th>Cobrado</th>
                <th>Pendiente</th>
                <th>Margen cobrado</th>
              </tr>
            </thead>
            <tbody>
              {projects
                .filter(
                  (p) => p.value || records.some((i) => i.projectId === p.id),
                )
                .map((p) => {
                  const f = projectFinance(scoped, p);
                  return (
                    <tr key={p.id}>
                      <td>
                        <Link href={"/projects/" + p.id}>
                          {p.name}
                          <ArrowUpRight size={12} />
                        </Link>
                        {p.source === "demo" && <small>DEMO</small>}
                      </td>
                      <td>{p.value == null ? "—" : money(p.value)}</td>
                      <td>{p.hours.toFixed(1)}</td>
                      <td>
                        {p.value == null || !p.hours
                          ? "—"
                          : money(f.contractedHour)}
                      </td>
                      <td>{money(f.paid)}</td>
                      <td className="accent">{money(f.receivable)}</td>
                      <td>{money(f.profit)}</td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
        <p className="form-note" style={{ marginTop: 14 }}>
          Valor / h = valor acordado ÷ horas acumuladas. El margen usa lo
          cobrado menos los gastos del proyecto; no es una previsión fiscal.
          {scope === "user" &&
            " Los valores y horas de demostración se excluyen; tus movimientos vinculados a esos proyectos se conservan."}
        </p>
      </section>
      <div className="split section">
        <section>
          <SectionHeading
            label="CAPITAL & GOALS"
            title="Construye lo que sigue."
            action={
              <Button variant="ghost" onClick={() => setGoalOpen(true)}>
                <Plus size={15} />
                Meta
              </Button>
            }
          />
          {financialGoals.map((g) => (
            <div key={g.id} className="financial-goal">
              <div className="row between">
                <h3>{g.title}</h3>
                <Badge>{g.kind === "savings" ? "AHORRO" : "INVERSIÓN"}</Badge>
              </div>
              <div className="goal-track">
                <span
                  style={{
                    width: Math.min(100, (g.saved / g.target) * 100) + "%",
                  }}
                />
              </div>
              <div className="row between">
                <span className="small muted">
                  {money(g.saved)} / {money(g.target)}
                </span>
                <label className="field">
                  <span className="sr-only">
                    Capital reservado para {g.title}
                  </span>
                  <input
                    type="number"
                    min="0"
                    step=".01"
                    defaultValue={g.saved}
                    style={{ width: 100 }}
                    onBlur={(e) => {
                      const value = Number(e.target.value);
                      if (Number.isFinite(value) && value >= 0)
                        n.update((w) => {
                          const goal = w.financialGoals.find(
                            (x) => x.id === g.id,
                          )!;
                          goal.saved = value;
                          goal.updatedAt = Date.now();
                        });
                    }}
                  />
                </label>
              </div>
            </div>
          ))}
          {!financialGoals.length && (
            <Empty
              title="Dale una dirección al capital."
              text="Define una reserva de ahorro o una meta de inversión."
              onAction={() => setGoalOpen(true)}
              action="Crear meta"
            />
          )}
        </section>
        <section className="forecast-panel">
          <TrendingUp size={28} strokeWidth={1} />
          <Label>FORECAST / PREPARADO</Label>
          <h3>El futuro necesita una base.</h3>
          <p>
            Las proyecciones se habilitarán cuando exista historial suficiente y
            un modelo definido. Por ahora, NEXUS muestra los movimientos
            registrados.
          </p>
          <Badge>PROYECCIÓN NO DISPONIBLE</Badge>
        </section>
      </div>
      <section className="section">
        <SectionHeading
          label="TRANSACTION STREAM"
          title="Cada movimiento cuenta."
        />
        {records.slice(0, 30).map((r) => (
          <div key={r.id} className="transaction-row">
            <span className="transaction-icon">
              {r.kind === "income" ? (
                <ArrowDownLeft size={18} />
              ) : (
                <Out size={18} />
              )}
            </span>
            <div>
              <h3>{r.title}</h3>
              <span className="small muted">
                {r.date} ·{" "}
                {n.projects.find((p) => p.id === r.projectId)?.name ??
                  r.category}
                {r.source === "demo" ? " · Demo" : ""}
              </span>
            </div>
            <strong>
              {r.kind === "expense" ? "−" : "+"}
              {money(r.amount)}
            </strong>
          </div>
        ))}
        {!records.length && (
          <Empty
            title="Tu historia financiera empieza aquí."
            text="Registra un ingreso o un gasto para comenzar."
            onAction={() => n.openCapture("income")}
          />
        )}
      </section>
      <Modal
        open={goalOpen}
        onClose={() => setGoalOpen(false)}
        title="Una meta para tu capital"
      >
        <form
          className="stack"
          onSubmit={(e) => {
            e.preventDefault();
            const target = Number(goalTarget);
            if (!(target > 0) || !goalName.trim()) return;
            const saved = n.update((w) => {
              w.financialGoals.push({
                ...entity(crypto.randomUUID(), "user", w.user.id),
                title: goalName.trim(),
                target,
                saved: 0,
                kind: goalKind,
              });
            });
            if (!saved) return;
            setGoalOpen(false);
            setGoalName("");
            setGoalTarget("");
          }}
        >
          <label className="field">
            Nombre
            <input
              required
              value={goalName}
              onChange={(e) => setGoalName(e.target.value)}
            />
          </label>
          <label className="field">
            Objetivo USD
            <input
              type="number"
              min="1"
              step=".01"
              required
              value={goalTarget}
              onChange={(e) => setGoalTarget(e.target.value)}
            />
          </label>
          <label className="field">
            Tipo
            <select
              value={goalKind}
              onChange={(e) => setGoalKind(e.target.value as typeof goalKind)}
            >
              <option value="savings">Ahorro</option>
              <option value="investment">Inversión</option>
            </select>
          </label>
          <Button type="submit">Crear meta</Button>
        </form>
      </Modal>
    </ModuleFrame>
  );
}
