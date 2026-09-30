import type { FlowSession, Workspace, Project } from "./models";
export function flowElapsed(flow: FlowSession, now = Date.now()) {
  return Math.max(
    0,
    Math.floor(
      ((flow.endedAt ?? flow.pausedAt ?? now) -
        flow.startedAt -
        flow.pausedMs) /
        1000,
    ),
  );
}
export const money = (amount: number) =>
  new Intl.NumberFormat("es-NI", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(amount);
export const dateKey = (
  date: Date | number = new Date(),
  timezone = "America/Managua",
) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
export function exchangeRate(w: Workspace) {
  return typeof w.user.metadata?.exchangeRateNIOPerUSD === "number"
    ? w.user.metadata.exchangeRateNIOPerUSD
    : 36.6243;
}
export function amountToUSD(
  w: Workspace,
  amount: number,
  currency: "USD" | "NIO",
) {
  return currency === "USD" ? amount : amount / exchangeRate(w);
}
export function amountToNIO(
  w: Workspace,
  amount: number,
  currency: "USD" | "NIO",
) {
  return currency === "NIO" ? amount : amount * exchangeRate(w);
}

export function availableBalanceUSD(w: Workspace) {
  const accounts = w.financialAccounts ?? [];
  if (accounts.length) {
    return accounts.reduce(
      (sum, account) => sum + amountToUSD(w, account.balance, account.currency),
      0,
    );
  }

  const cashNIO =
    typeof w.user.metadata?.cashNIO === "number"
      ? w.user.metadata.cashNIO
      : 0;
  const cardUSD =
    typeof w.user.metadata?.cardUSD === "number"
      ? w.user.metadata.cardUSD
      : 0;
  return cardUSD + cashNIO / exchangeRate(w);
}

export function financeCutDate(
  w: Workspace,
  now: Date | number = new Date(),
) {
  const monthStart =
    dateKey(now, w.user.preferences.timezone).slice(0, 7) + "-01";
  const migrationCut =
    typeof w.user.metadata?.financeCutoverDate === "string"
      ? w.user.metadata.financeCutoverDate
      : "";
  return migrationCut && migrationCut > monthStart ? migrationCut : monthStart;
}

export function accountNetMovementUSD(
  w: Workspace,
  fromDate: string,
  toDate?: string,
) {
  const inRange = (date: string) =>
    date >= fromDate && (!toDate || date <= toDate);

  const income = w.incomes
    .filter((record) => !!record.accountId && inRange(record.date))
    .reduce(
      (sum, record) => sum + amountToUSD(w, record.amount, record.currency),
      0,
    );
  const expense = w.expenses
    .filter((record) => !!record.accountId && inRange(record.date))
    .reduce(
      (sum, record) => sum + amountToUSD(w, record.amount, record.currency),
      0,
    );
  return income - expense;
}

export function financeCutSummary(
  w: Workspace,
  now: Date | number = new Date(),
) {
  const currentAvailableUSD = availableBalanceUSD(w);
  const cutDate = financeCutDate(w, now);
  const changeSinceCutUSD = accountNetMovementUSD(w, cutDate);
  return {
    cutDate,
    currentAvailableUSD,
    lastCutAvailableUSD: currentAvailableUSD - changeSinceCutUSD,
    changeSinceCutUSD,
  };
}

export function monthlyFinanceSeries(
  w: Workspace,
  months = 6,
  now: Date | number = new Date(),
) {
  const currentAvailableUSD = availableBalanceUSD(w);
  const today = dateKey(now, w.user.preferences.timezone);
  const currentMonth = today.slice(0, 7);
  const migrationCut =
    typeof w.user.metadata?.financeCutoverDate === "string"
      ? w.user.metadata.financeCutoverDate
      : "";

  return Array.from({ length: months }, (_, index) => {
    const cursor = new Date(currentMonth + "-01T12:00:00Z");
    cursor.setUTCMonth(cursor.getUTCMonth() - (months - 1 - index));
    const key = cursor.toISOString().slice(0, 7);
    const monthEndDate = new Date(cursor);
    monthEndDate.setUTCMonth(monthEndDate.getUTCMonth() + 1);
    monthEndDate.setUTCDate(0);
    const monthEnd = monthEndDate.toISOString().slice(0, 10);
    const effectiveEnd = monthEnd > today ? today : monthEnd;

    const income = w.incomes
      .filter((record) => record.date.startsWith(key))
      .reduce(
        (sum, record) => sum + amountToUSD(w, record.amount, record.currency),
        0,
      );
    const expense = w.expenses
      .filter((record) => record.date.startsWith(key))
      .reduce(
        (sum, record) => sum + amountToUSD(w, record.amount, record.currency),
        0,
      );

    const available =
      migrationCut && effectiveEnd < migrationCut
        ? undefined
        : currentAvailableUSD -
          accountNetMovementUSD(
            w,
            new Date(effectiveEnd + "T12:00:00Z").getTime() >=
              new Date(today + "T12:00:00Z").getTime()
              ? "9999-12-31"
              : (() => {
                  const next = new Date(effectiveEnd + "T12:00:00Z");
                  next.setUTCDate(next.getUTCDate() + 1);
                  return next.toISOString().slice(0, 10);
                })(),
            today,
          );

    return {
      key,
      label: cursor
        .toLocaleDateString("es-NI", { month: "short", timeZone: "UTC" })
        .toUpperCase(),
      income,
      expense,
      available,
      net: income - expense,
    };
  });
}

export function projectPaid(w: Workspace, projectId: string) {
  return w.incomes
    .filter((i) => i.projectId === projectId)
    .reduce((sum, i) => sum + amountToUSD(w, i.amount, i.currency), 0);
}
export function projectFinance(w: Workspace, p: Project) {
  const paid = projectPaid(w, p.id);
  const expenses = w.expenses
    .filter((e) => e.projectId === p.id)
    .reduce((s, e) => s + amountToUSD(w, e.amount, e.currency), 0);
  const explicitReceivable =
    typeof p.metadata?.receivableUSD === "number"
      ? p.metadata.receivableUSD
      : undefined;
  const receivable =
    explicitReceivable ?? Math.max(0, (p.value ?? 0) - paid);
  return {
    paid,
    expenses,
    receivable,
    overdue:
      typeof p.metadata?.overdueUSD === "number"
        ? p.metadata.overdueUSD
        : 0,
    profit: paid - expenses,
    revenueHour: p.hours ? paid / p.hours : 0,
    contractedHour: p.hours && p.value ? p.value / p.hours : 0,
  };
}
export function financialScope(w: Workspace, scope: "all" | "user") {
  if (scope === "all") return w;
  const incomes = w.incomes.filter((i) => i.source === "user");
  const expenses = w.expenses.filter((e) => e.source === "user");
  const linked = new Set([...incomes, ...expenses].map((r) => r.projectId));
  return {
    ...w,
    incomes,
    expenses,
    financialGoals: w.financialGoals.filter((g) => g.source === "user"),
    projects: w.projects
      .filter((p) => p.source === "user" || linked.has(p.id))
      .map((p) =>
        p.source === "user"
          ? p
          : {
              ...p,
              value: undefined,
              hours:
                w.flows
                  .filter((f) => f.source === "user" && f.projectId === p.id)
                  .reduce((sum, f) => sum + (f.elapsedSeconds ?? 0), 0) / 3600,
            },
      ),
  };
}
export function analytics(w: Workspace) {
  const tasks = w.projects.flatMap((p) => p.tasks);
  const completed = tasks.filter((t) => t.completed).length;
  const seconds = w.flows.reduce((s, f) => s + (f.elapsedSeconds ?? 0), 0);
  const converted = w.ideas.filter((i) => i.status === "converted").length;
  const completion = tasks.length
    ? Math.round((completed / tasks.length) * 100)
    : 0;
  const delivery = w.projects.length
    ? Math.round(
        (w.projects.filter((p) => p.status === "completed").length /
          w.projects.length) *
          100,
      )
    : 0;
  const days = [
    ...new Set(
      w.flows
        .filter((f) => (f.elapsedSeconds ?? 0) >= 60)
        .map((f) => dateKey(f.startedAt)),
    ),
  ];
  let streak = 0;
  const cursor = new Date();
  if (!days.includes(dateKey(cursor))) cursor.setDate(cursor.getDate() - 1);
  while (days.includes(dateKey(cursor))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return {
    completion,
    delivery,
    seconds,
    converted,
    ideaRate: w.ideas.length
      ? Math.round((converted / w.ideas.length) * 100)
      : 0,
    streak,
    score: Math.round(completion * 0.6 + delivery * 0.4),
    completed,
    totalTasks: tasks.length,
  };
}
