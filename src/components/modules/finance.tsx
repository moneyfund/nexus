"use client";
import { useState } from "react";
import Link from "next/link";
import {
  Plus,
  ArrowUpRight,
  TrendingUp,
  ArrowDownLeft,
  ArrowUpRight as Out,
  Pencil,
  Trash2,
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
  amountToNIO,
  amountToUSD,
  dateKey,
  exchangeRate,
  financialScope,
  money,
  projectFinance,
} from "@/domain/selectors";
import { entity } from "@/domain/seed";
import type { Currency, MoneyRecord } from "@/domain/models";

type EditableRecord = MoneyRecord & { kind: "income" | "expense" };

function TransactionEditor({
  record,
  close,
}: {
  record: EditableRecord;
  close: () => void;
}) {
  const n = useNexus();
  const [title, setTitle] = useState(record.title);
  const [amount, setAmount] = useState(String(record.amount));
  const [date, setDate] = useState(record.date);
  const [projectId, setProjectId] = useState(record.projectId ?? "");
  const [category, setCategory] = useState(record.category);
  const [deleting, setDeleting] = useState(false);

  return (
    <form
      className="stack"
      onSubmit={(e) => {
        e.preventDefault();
        n.run(() => {
          n.actions.updateMoneyRecord(record.kind, record.id, {
            title,
            amount: Number(amount),
            date,
            projectId: projectId || undefined,
            category,
          });
          close();
        }, "Movimiento actualizado.");
      }}
    >
      <label className="field">
        Concepto
        <input value={title} onChange={(e) => setTitle(e.target.value)} required />
      </label>
      <div className="form-grid">
        <label className="field">
          Importe {record.currency}
          <input
            type="number"
            min=".01"
            step=".01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
          />
        </label>
        <label className="field">
          Fecha
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
      </div>
      <div className="form-grid">
        <label className="field">
          Proyecto
          <select value={projectId} onChange={(e) => setProjectId(e.target.value)}>
            <option value="">Sin proyecto</option>
            {n.projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          Categoría
          <input value={category} onChange={(e) => setCategory(e.target.value)} />
        </label>
      </div>
      <div className="row between">
        <Button type="submit">Guardar movimiento</Button>
        <Button
          type="button"
          variant="danger"
          onClick={() => {
            if (!deleting) {
              setDeleting(true);
              return;
            }
            n.run(
              () => n.actions.deleteMoneyRecord(record.kind, record.id),
              "Movimiento eliminado.",
            );
            close();
          }}
        >
          <Trash2 size={14} />
          {deleting ? "Confirmar eliminación" : "Eliminar"}
        </Button>
      </div>
    </form>
  );
}
export function FinanceView() {
  const n = useNexus();
  const [scope, setScope] = useState<"all" | "user">("user");
  const [goalOpen, setGoalOpen] = useState(false);
  const [goalName, setGoalName] = useState("");
  const [goalTarget, setGoalTarget] = useState("");
  const [goalKind, setGoalKind] = useState<"savings" | "investment">("savings");
  const [editingRecord, setEditingRecord] = useState<EditableRecord | null>(null);
  const scoped = financialScope(n.data, scope);
  const { incomes, expenses, projects, financialGoals } = scoped;
  const rate = exchangeRate(n.data);
  const accounts = n.data.financialAccounts ?? [];
  const debts = n.data.debts ?? [];
  const income = incomes.reduce(
    (s, i) => s + amountToUSD(n.data, i.amount, i.currency),
    0,
  );
  const historicalIncome = incomes
    .filter((i) => i.metadata?.cutoverHistorical === true)
    .reduce((s, i) => s + amountToUSD(n.data, i.amount, i.currency), 0);
  const currentIncomes = incomes.filter(
    (i) => i.metadata?.cutoverHistorical !== true,
  );
  const currentIncome = currentIncomes.reduce(
    (s, i) => s + amountToUSD(n.data, i.amount, i.currency),
    0,
  );
  const expense = expenses.reduce(
    (s, i) => s + amountToUSD(n.data, i.amount, i.currency),
    0,
  );
  const receivable = projects.reduce(
    (s, p) => s + projectFinance(scoped, p).receivable,
    0,
  );
  const savings = financialGoals.reduce((s, g) => s + g.saved, 0);
  const cutoverDate =
    typeof n.data.user.metadata?.financeCutoverDate === "string"
      ? n.data.user.metadata.financeCutoverDate
      : "";
  const cashAccount = accounts.find(
    (item) => item.kind === "cash" && item.currency === "NIO",
  );
  const cardAccount = accounts.find(
    (item) =>
      (item.kind === "card" || item.kind === "bank") &&
      item.currency === "USD",
  );
  const cashNIO =
    cashAccount?.balance ??
    (typeof n.data.user.metadata?.cashNIO === "number"
      ? n.data.user.metadata.cashNIO
      : null);
  const cardUSD =
    cardAccount?.balance ??
    (typeof n.data.user.metadata?.cardUSD === "number"
      ? n.data.user.metadata.cardUSD
      : null);
  const historyReconciled =
    n.data.user.metadata?.financeHistoryReconciled === true;
  const cordobas = (amount: number) =>
    new Intl.NumberFormat("es-NI", {
      style: "currency",
      currency: "NIO",
      maximumFractionDigits: 2,
    }).format(amount);
  const formatNative = (amount: number, currency: Currency) =>
    currency === "USD" ? money(amount) : cordobas(amount);
  const pendingDebts = debts.filter(
    (debt) => debt.status === "pending" && debt.balance > 0,
  );
  const debtUSD = pendingDebts.reduce(
    (sum, debt) => sum + amountToUSD(n.data, debt.balance, debt.currency),
    0,
  );
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
      income: currentIncomes
        .filter((r) => r.date.startsWith(key))
        .reduce(
          (s, r) => s + amountToUSD(n.data, r.amount, r.currency),
          0,
        ),
      expense: expenses
        .filter((r) => r.date.startsWith(key))
        .reduce(
          (s, r) => s + amountToUSD(n.data, r.amount, r.currency),
          0,
        ),
    };
  });
  const records: EditableRecord[] = [
    ...incomes.map((i) => ({ ...i, kind: "income" as const })),
    ...expenses.map((i) => ({ ...i, kind: "expense" as const })),
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
          <Label>CASHFLOW / DESDE EL CORTE</Label>
          <div className="finance-net">
            {money(currentIncome - expense)}
            <span>USD</span>
          </div>
          <p>
            Movimientos posteriores al corte. Los cobros históricos confirmados
            no se mezclan con el dinero disponible actual.
          </p>
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
      {(cashNIO != null || cardUSD != null) && (
        <section className="section">
          <SectionHeading
            label="LIQUIDEZ REAL"
            title="Dinero disponible al corte."
            action={cutoverDate ? <Badge>CORTE {cutoverDate}</Badge> : undefined}
          />
          <div className="data-band">
            <DataMetric
              label={cashAccount?.name ?? "Efectivo"}
              value={cashNIO == null ? "—" : cordobas(cashNIO)}
              meta={
                cashNIO == null
                  ? "Saldo no definido"
                  : "≈ " + money(cashNIO / rate) + " · tipo oficial BCN"
              }
            />
            <DataMetric
              label={cardAccount?.name ?? "Tarjeta / banco"}
              value={cardUSD == null ? "—" : money(cardUSD)}
              meta={
                cardUSD == null
                  ? "Saldo no definido"
                  : "≈ " + cordobas(cardUSD * rate) + " · tipo oficial BCN"
              }
            />
            <DataMetric
              label="Histórico"
              value={historyReconciled ? "Conciliado" : "Desde el corte"}
              meta={
                historyReconciled
                  ? "Movimientos históricos verificados"
                  : "No reconstruye gastos anteriores sin importe confirmado"
              }
            />
          </div>
        </section>
      )}
      <section className="section">
        <SectionHeading
          label="DEUDAS"
          title="Obligaciones pendientes."
          action={<Badge>{pendingDebts.length} ABIERTA{pendingDebts.length === 1 ? "" : "S"}</Badge>}
        />
        {pendingDebts.length ? (
          <>
            <div className="data-band">
              <DataMetric
                label="Deuda total"
                value={money(debtUSD)}
                meta={"≈ " + cordobas(debtUSD * rate) + " al tipo oficial"}
              />
              {pendingDebts.slice(0, 3).map((debt) => (
                <DataMetric
                  key={debt.id}
                  label={debt.creditor}
                  value={formatNative(debt.balance, debt.currency)}
                  meta={
                    (debt.currency === "USD"
                      ? "≈ " + cordobas(amountToNIO(n.data, debt.balance, debt.currency))
                      : "≈ " + money(amountToUSD(n.data, debt.balance, debt.currency))) +
                    (debt.dueDate ? " · vence " + debt.dueDate : "")
                  }
                />
              ))}
            </div>
            {pendingDebts.length > 3 && (
              <p className="form-note">
                +{pendingDebts.length - 3} deuda{pendingDebts.length - 3 === 1 ? "" : "s"} adicional{pendingDebts.length - 3 === 1 ? "" : "es"}.
              </p>
            )}
          </>
        ) : (
          <Empty
            title="Sin deudas pendientes."
            text="Cuando registres una obligación aparecerá aquí."
          />
        )}
      </section>
      <div className="data-band">
        <DataMetric
          label="Cobrado confirmado"
          value={money(income)}
          meta={
            historicalIncome
              ? money(historicalIncome) + " del histórico confirmado"
              : `${incomes.length} cobros registrados`
          }
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
          label="Flujo desde corte"
          value={money(currentIncome - expense - savings)}
          meta="Movimientos nuevos; la liquidez real se muestra arriba"
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
                <th>Vencido</th>
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
                        <Link href={"/project?id=" + encodeURIComponent(p.id)}>
                          {p.name}
                          <ArrowUpRight size={12} />
                        </Link>
                        {p.source === "demo" && <small>DEMO</small>}
                      </td>
                      <td>{p.value == null ? "—" : money(p.value)}</td>
                      <td>
                        {p.metadata?.hoursBasis === "flow-only" && p.hours === 0
                          ? "Sin medir"
                          : p.hours.toFixed(1)}
                      </td>
                      <td>
                        {p.value == null || !p.hours
                          ? "—"
                          : money(f.contractedHour)}
                      </td>
                      <td>{money(f.paid)}</td>
                      <td className="accent">{money(f.receivable)}</td>
              <td>{f.overdue ? money(f.overdue) : "—"}</td>
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
              {formatNative(r.amount, r.currency)}
            </strong>
            <button
              className="icon-button"
              aria-label={"Editar movimiento " + r.title}
              onClick={() => setEditingRecord(r)}
            >
              <Pencil size={14} />
            </button>
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
        open={!!editingRecord}
        onClose={() => setEditingRecord(null)}
        title="Editar movimiento"
      >
        {editingRecord && (
          <TransactionEditor
            key={editingRecord.id + editingRecord.kind}
            record={editingRecord}
            close={() => setEditingRecord(null)}
          />
        )}
      </Modal>
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
