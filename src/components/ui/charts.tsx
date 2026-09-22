"use client";
import { useId, useState } from "react";
import { money } from "@/domain/selectors";
export function CashflowChart({
  values,
}: {
  values: { label: string; income: number; expense: number }[];
}) {
  const id = useId();
  const [selected, setSelected] = useState(values.length - 1);
  const max = Math.max(100, ...values.flatMap((v) => [v.income, v.expense]));
  const width = 720,
    height = 210,
    gap = width / Math.max(1, values.length - 1);
  const points = values
    .map((v, i) => `${i * gap},${height - (v.income / max) * (height - 20)}`)
    .join(" ");
  const expenses = values
    .map((v, i) => `${i * gap},${height - (v.expense / max) * (height - 20)}`)
    .join(" ");
  const current = values[selected];
  return (
    <div className="cashflow-chart">
      <div className="chart-legend">
        <span>
          <i />
          Ingresos
        </span>
        <span>
          <i className="expense" />
          Gastos
        </span>
        <strong>
          {current?.label}:{" "}
          {money((current?.income ?? 0) - (current?.expense ?? 0))} neto
        </strong>
      </div>
      <div className="chart-body">
        <div className="chart-y-labels">
          {[max, max / 2, 0].map((v) => (
            <span key={v}>{money(v)}</span>
          ))}
        </div>
        <svg
          viewBox={`0 0 ${width} ${height + 10}`}
          role="img"
          aria-label="Ingresos y gastos por mes; los valores exactos se pueden consultar debajo."
        >
          <defs>
            <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#d946ef" stopOpacity=".2" />
              <stop offset="100%" stopColor="#d946ef" stopOpacity="0" />
            </linearGradient>
          </defs>
          {[10, height / 2, height].map((y) => (
            <line
              key={y}
              x1="0"
              y1={y}
              x2={width}
              y2={y}
              stroke="#ffffff0c"
              strokeDasharray="3 5"
            />
          ))}
          <polygon
            points={`0,${height} ${points} ${width},${height}`}
            fill={`url(#${id})`}
          />
          <polyline
            points={points}
            fill="none"
            stroke="#df78ec"
            strokeWidth="2"
            vectorEffect="non-scaling-stroke"
          />
          <polyline
            points={expenses}
            fill="none"
            stroke="#8a7297"
            strokeWidth="1.5"
            strokeDasharray="5 5"
            vectorEffect="non-scaling-stroke"
          />
          {values.map((v, i) => (
            <circle
              key={i}
              cx={i * gap}
              cy={height - (v.income / max) * (height - 20)}
              r={i === selected ? 5 : 3}
              fill={i === selected ? "#fff" : "#df78ec"}
            />
          ))}
        </svg>
      </div>
      <div className="chart-x-labels">
        {values.map((v, i) => (
          <button
            key={i}
            className={selected === i ? "selected" : ""}
            onClick={() => setSelected(i)}
            aria-label={`${v.label}: ingresos ${money(v.income)}, gastos ${money(v.expense)}`}
          >
            {v.label}
          </button>
        ))}
      </div>
    </div>
  );
}
export function ComparisonBars({
  rows,
}: {
  rows: { label: string; estimated: number; actual: number }[];
}) {
  const max = Math.max(1, ...rows.flatMap((r) => [r.estimated, r.actual]));
  return (
    <div className="comparison-bars">
      {rows.map((r, i) => (
        <div key={i} className="comparison-row">
          <div className="row between">
            <span>{r.label}</span>
            <small>
              {r.actual.toFixed(1)} / {r.estimated} min
            </small>
          </div>
          <div className="compare-track">
            <span
              className="compare-estimated"
              style={{ width: (r.estimated / max) * 100 + "%" }}
            />
            <span
              className="compare-actual"
              style={{ width: (r.actual / max) * 100 + "%" }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
