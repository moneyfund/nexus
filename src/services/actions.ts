import { WorkspaceStore } from "@/repositories/workspace";
import { entity } from "@/domain/seed";
import { flowElapsed } from "@/domain/selectors";
import { zonedISO } from "@/lib/time";
import { SYSTEM } from "@/config/system";
import type {
  CaptureInput,
  Project,
  ProjectStatus,
  Idea,
  Workspace,
  Task,
  CalendarEvent,
  UserPreferences,
  Milestone,
  MoneyRecord,
  Debt,
  AIMessage,
} from "@/domain/models";
const id = () => crypto.randomUUID();
const log = (
  w: Workspace,
  title: string,
  kind: string,
  projectId?: string,
  metadata?: Record<string, string | number | boolean>,
) => {
  w.activity.unshift({
    ...entity(id(), "user", w.user.id),
    title,
    kind,
    projectId,
    metadata,
  });
};
const clampProgress = (value: number) =>
  Math.max(0, Math.min(100, Math.round(value)));

function recomputeMilestone(project: Project, milestone: Milestone) {
  const related = project.tasks.filter(
    (task) => task.milestone === milestone.title,
  );
  const completed = related.filter((task) => task.completed).length;
  const ratio = related.length ? completed / related.length : 0;

  if (milestone.baselineProgress == null) {
    const inferred =
      related.length && ratio < 1
        ? (milestone.progress - 100 * ratio) / (1 - ratio)
        : milestone.progress;
    milestone.baselineProgress = clampProgress(inferred);
  }

  if (related.length) {
    milestone.progress = clampProgress(
      milestone.baselineProgress +
        (100 - milestone.baselineProgress) * ratio,
    );
  } else {
    milestone.progress = clampProgress(milestone.baselineProgress);
  }

  milestone.updatedAt = Date.now();
}
function recomputeProject(project: Project) {
  project.milestones.forEach((milestone) =>
    recomputeMilestone(project, milestone),
  );

  const totalWeight = project.milestones.reduce(
    (sum, milestone) => sum + Math.max(0, milestone.weight),
    0,
  );

  project.progress = totalWeight
    ? clampProgress(
        project.milestones.reduce(
          (sum, milestone) =>
            sum + milestone.progress * Math.max(0, milestone.weight),
          0,
        ) / totalWeight,
      )
    : project.tasks.length
      ? clampProgress(
          (project.tasks.filter((task) => task.completed).length /
            project.tasks.length) *
            100,
        )
      : 0;

  project.nextAction =
    project.tasks.find((task) => !task.completed)?.title ??
    (project.progress >= 100
      ? "Proyecto completado"
      : "Definir la siguiente acción");
  project.updatedAt = Date.now();
}

function complete(
  w: Workspace,
  projectId: string,
  taskId: string,
  value?: boolean,
) {
  const p = w.projects.find((p) => p.id === projectId);
  const task = p?.tasks.find((t) => t.id === taskId);
  if (!p || !task) return;
  const blocked = w.dependencies
    .filter((d) => d.taskId === taskId)
    .some(
      (d) =>
        !w.projects
          .flatMap((p) => p.tasks)
          .find((t) => t.id === d.dependsOnTaskId)?.completed,
    );
  if ((value ?? !task.completed) && blocked)
    throw new Error("Completa primero las tareas de las que depende.");
  task.completed = value ?? !task.completed;
  task.completedAt = task.completed ? Date.now() : undefined;
  task.updatedAt = Date.now();
  recomputeProject(p);
  log(
    w,
    (task.completed ? "Completada: " : "Reabierta: ") + task.title,
    "task",
    p.id,
  );
}
function newProject(name: string, userId: string, description = ""): Project {
  return {
    ...entity(id(), "user", userId),
    name,
    description,
    area: "Personal",
    progress: 0,
    status: "backlog",
    priority: "medium",
    deadline: "SIN FECHA",
    accent: "#d946ef",
    tasks: [],
    milestones: [],
    nextAction: "Definir la primera acción",
    hours: 0,
    stage: "discovery",
  };
}
export class NexusActions {
  constructor(private store: WorkspaceStore) {}
  capture = (input: CaptureInput) => {
    const content = input.content.trim();
    if (!content) throw new Error("Escribe algo antes de capturar.");
    if (
      (input.type === "income" || input.type === "expense") &&
      (!Number.isFinite(input.amount) || (input.amount ?? 0) <= 0)
    )
      throw new Error("Introduce un importe mayor que cero.");
    if (input.type === "link") {
      const url = new URL(input.url || content);
      if (!["http:", "https:"].includes(url.protocol))
        throw new Error("Usa un enlace HTTP o HTTPS.");
    }
    if (input.type === "task" && !input.projectId)
      throw new Error("Elige un proyecto para esta tarea.");
    const targetId = id();
    this.store.update((w) => {
      const base = entity(targetId, "user", w.user.id);
      if (input.projectId && !w.projects.some((p) => p.id === input.projectId))
        throw new Error("Proyecto no encontrado.");
      switch (input.type) {
        case "idea":
          w.ideas.unshift({
            ...base,
            title: content,
            description: "",
            category: input.category ?? "Ideas",
            status: "captured",
            potential: "explore",
            projectIds: input.projectId ? [input.projectId] : [],
            notes: "",
          });
          break;
        case "project": {
          const project = {
            ...newProject(content, w.user.id),
            id: targetId,
          };
          project.area = input.category?.trim() || "General";
          w.projects.unshift(project);
          break;
        }
        case "task": {
          const p = w.projects.find((p) => p.id === input.projectId);
          if (p) {
            p.tasks.push({
              ...base,
              projectId: p.id,
              title: content,
              completed: false,
              estimatedMinutes: 25,
              priority: "medium",
              milestone: p.milestones[0]?.title ?? "Ejecución",
            });
            recomputeProject(p);
          }
          break;
        }
        case "income":
        case "expense": {
          const currency = input.currency ?? "USD";
          const account = input.accountId
            ? (w.financialAccounts ?? []).find(
                (item) => item.id === input.accountId,
              )
            : undefined;
          if (input.accountId && !account)
            throw new Error("Cuenta financiera no encontrada.");
          if (account && account.currency !== currency)
            throw new Error("La moneda del movimiento no coincide con la cuenta.");
          const amount = Math.round(input.amount! * 100) / 100;
          const record = {
            ...base,
            title: content,
            amount,
            currency,
            date: new Intl.DateTimeFormat("en-CA", {
              timeZone: w.user.preferences.timezone,
            }).format(new Date()),
            projectId: input.projectId || undefined,
            category: input.category ?? "General",
            accountId: account?.id,
          };
          w[input.type === "income" ? "incomes" : "expenses"].unshift(record);
          if (account) {
            if (input.type === "expense" && account.balance < amount)
              throw new Error("La cuenta no tiene saldo suficiente.");
            account.balance = Math.round(
              (account.balance + (input.type === "income" ? amount : -amount)) *
                100,
            ) / 100;
            account.updatedAt = Date.now();
          }
          break;
        }
        case "contact":
          w.contacts.unshift({ ...base, name: content });
          break;
        case "file": {
          if (!input.file) throw new Error("Selecciona un archivo.");
          w.attachments.push({
            ...base,
            name: input.file.name,
            mimeType: input.file.type,
            size: input.file.size,
            provider: "mock",
            projectId: input.projectId,
          });
          w.knowledge.unshift({
            ...base,
            title: content,
            content:
              "Preparando archivo para Firebase Storage.",
            type: input.file.type === "application/pdf" ? "pdf" : "document",
            category: input.category ?? "Personal",
            tags: [],
            projectId: input.projectId,
            attachmentId: targetId,
          });
          break;
        }
        default:
          w.knowledge.unshift({
            ...base,
            title: content.split("\n")[0],
            content,
            type: input.type === "link" ? "link" : "note",
            url: input.type === "link" ? input.url || content : undefined,
            category: input.category ?? "Personal",
            projectId: input.projectId,
            tags: [],
          });
      }
      w.inbox.unshift({
        ...entity(id(), "user", w.user.id),
        type: input.type,
        content,
        targetId,
      });
      if (input.type === "income" || input.type === "expense") {
        const record = (
          input.type === "income" ? w.incomes : w.expenses
        ).find((item) => item.id === targetId);
        log(
          w,
          (input.type === "income" ? "Ingreso registrado: " : "Gasto registrado: ") +
            content,
          "finance",
          input.projectId,
          record
            ? {
                financeEvent: true,
                financeType: input.type,
                referenceId: record.id,
                amount: record.amount,
                currency: record.currency,
                date: record.date,
                cashImpact:
                  record.accountId
                    ? input.type === "income"
                      ? record.amount
                      : -record.amount
                    : 0,
                ...(record.accountId ? { accountId: record.accountId } : {}),
              }
            : undefined,
        );
      } else {
        log(w, "Capturado: " + content, "capture", input.projectId);
      }
    });
    return targetId;
  };
  toggleTask = (projectId: string, taskId: string) =>
    this.store.update((w) => complete(w, projectId, taskId));
  setStatus = (projectId: string, status: ProjectStatus) =>
    this.store.update((w) => {
      const p = w.projects.find((p) => p.id === projectId);
      if (!p) throw new Error("Proyecto no encontrado.");
      if (
        status === "active" &&
        p.status !== "active" &&
        w.projects.filter((p) => p.status === "active").length >=
          SYSTEM.wipLimit
      )
        throw new Error(
          "Tu capacidad activa está completa. Pausa o termina un proyecto para abrir este frente.",
        );
      p.status = status;
      p.updatedAt = Date.now();
      log(w, p.name + " → " + status, "project", p.id);
    });
  updateProject = (
    projectId: string,
    patch: Partial<
      Pick<
        Project,
        | "name"
        | "description"
        | "notes"
        | "priority"
        | "dueDate"
        | "value"
        | "area"
        | "client"
        | "stage"
        | "dependsOn"
        | "contactIds"
      >
    >,
  ) =>
    this.store.update((w) => {
      const p = w.projects.find((p) => p.id === projectId);
      if (!p) throw new Error("Proyecto no encontrado.");
      Object.assign(p, patch, { updatedAt: Date.now() });
      if ("dueDate" in patch)
        p.deadline = patch.dueDate
          ? new Intl.DateTimeFormat("es-NI", {
              day: "2-digit",
              month: "short",
              timeZone: "UTC",
            }).format(new Date(patch.dueDate + "T12:00:00Z"))
          : "SIN FECHA";
      log(w, "Proyecto actualizado: " + p.name, "project", p.id);
    });

  addMilestone = (
    projectId: string,
    title: string,
    weight = 10,
    baselineProgress = 0,
  ) =>
    this.store.update((w) => {
      const p = w.projects.find((project) => project.id === projectId);
      if (!p) throw new Error("Proyecto no encontrado.");
      const clean = title.trim();
      if (!clean) throw new Error("Escribe un nombre para el hito.");
      if (p.milestones.some((milestone) => milestone.title === clean))
        throw new Error("Ya existe un hito con ese nombre.");
      p.milestones.push({
        ...entity(id(), "user", w.user.id),
        projectId,
        title: clean,
        weight: Math.max(0, weight),
        progress: clampProgress(baselineProgress),
        baselineProgress: clampProgress(baselineProgress),
      });
      recomputeProject(p);
      log(w, "Hito creado: " + clean, "milestone", projectId);
    });

  updateMilestone = (
    projectId: string,
    milestoneId: string,
    patch: Partial<
      Pick<Milestone, "title" | "weight" | "baselineProgress">
    >,
  ) =>
    this.store.update((w) => {
      const p = w.projects.find((project) => project.id === projectId);
      const milestone = p?.milestones.find((item) => item.id === milestoneId);
      if (!p || !milestone) throw new Error("Hito no encontrado.");

      const previousTitle = milestone.title;
      if (patch.title != null) {
        const clean = patch.title.trim();
        if (!clean) throw new Error("El hito necesita un nombre.");
        if (
          p.milestones.some(
            (item) => item.id !== milestoneId && item.title === clean,
          )
        )
          throw new Error("Ya existe un hito con ese nombre.");
        milestone.title = clean;
        p.tasks
          .filter((task) => task.milestone === previousTitle)
          .forEach((task) => {
            task.milestone = clean;
            task.updatedAt = Date.now();
          });
      }
      if (patch.weight != null) milestone.weight = Math.max(0, patch.weight);
      if (patch.baselineProgress != null)
        milestone.baselineProgress = clampProgress(patch.baselineProgress);

      recomputeProject(p);
      log(w, "Hito actualizado: " + milestone.title, "milestone", projectId);
    });

  deleteMilestone = (projectId: string, milestoneId: string) =>
    this.store.update((w) => {
      const p = w.projects.find((project) => project.id === projectId);
      const milestone = p?.milestones.find((item) => item.id === milestoneId);
      if (!p || !milestone) throw new Error("Hito no encontrado.");
      if (p.tasks.some((task) => task.milestone === milestone.title))
        throw new Error(
          "Mueve o elimina primero las tareas asociadas a este hito.",
        );
      p.milestones = p.milestones.filter((item) => item.id !== milestoneId);
      recomputeProject(p);
      log(w, "Hito eliminado: " + milestone.title, "milestone", projectId);
    });

  updateTask = (
    projectId: string,
    taskId: string,
    patch: Partial<
      Pick<Task, "title" | "estimatedMinutes" | "priority" | "milestone">
    >,
  ) =>
    this.store.update((w) => {
      const p = w.projects.find((project) => project.id === projectId);
      const task = p?.tasks.find((item) => item.id === taskId);
      if (!p || !task) throw new Error("Tarea no encontrada.");
      const previousMilestone = task.milestone;

      if (patch.title != null) {
        const clean = patch.title.trim();
        if (!clean) throw new Error("La tarea necesita un título.");
        task.title = clean;
      }
      if (patch.estimatedMinutes != null)
        task.estimatedMinutes = Math.max(1, Math.round(patch.estimatedMinutes));
      if (patch.priority != null) task.priority = patch.priority;
      if (patch.milestone != null) {
        if (
          patch.milestone &&
          !p.milestones.some((milestone) => milestone.title === patch.milestone)
        )
          throw new Error("El hito seleccionado no existe.");
        task.milestone = patch.milestone || "Ejecución";
      }

      task.updatedAt = Date.now();
      if (previousMilestone !== task.milestone) {
        const previous = p.milestones.find(
          (milestone) => milestone.title === previousMilestone,
        );
        if (previous) recomputeMilestone(p, previous);
      }
      recomputeProject(p);
      log(w, "Tarea actualizada: " + task.title, "task", projectId);
    });

  deleteTask = (projectId: string, taskId: string) =>
    this.store.update((w) => {
      const p = w.projects.find((project) => project.id === projectId);
      const task = p?.tasks.find((item) => item.id === taskId);
      if (!p || !task) throw new Error("Tarea no encontrada.");
      p.tasks = p.tasks.filter((item) => item.id !== taskId);
      w.dependencies = w.dependencies.filter(
        (dependency) =>
          dependency.taskId !== taskId &&
          dependency.dependsOnTaskId !== taskId,
      );
      if (w.activeFlow?.taskId === taskId) w.activeFlow = null;
      recomputeProject(p);
      log(w, "Tarea eliminada: " + task.title, "task", projectId);
    });

  updateMoneyRecord = (
    kind: "income" | "expense",
    recordId: string,
    patch: Partial<
      Pick<
        MoneyRecord,
        "title" | "amount" | "date" | "projectId" | "category" | "accountId"
      >
    >,
  ) =>
    this.store.update((w) => {
      const collection = kind === "income" ? w.incomes : w.expenses;
      const record = collection.find((item) => item.id === recordId);
      if (!record) throw new Error("Movimiento no encontrado.");

      const previous = {
        title: record.title,
        amount: record.amount,
        date: record.date,
        projectId: record.projectId,
        category: record.category,
        accountId: record.accountId,
      };

      const nextAmount =
        patch.amount != null
          ? Math.round(patch.amount * 100) / 100
          : record.amount;
      if (!Number.isFinite(nextAmount) || nextAmount <= 0)
        throw new Error("El importe debe ser mayor que cero.");

      const accountWasPatched = Object.prototype.hasOwnProperty.call(
        patch,
        "accountId",
      );
      const nextAccountId = accountWasPatched
        ? patch.accountId || undefined
        : record.accountId;
      const accounts = w.financialAccounts ?? [];
      const previousAccount = record.accountId
        ? accounts.find((item) => item.id === record.accountId)
        : undefined;
      const nextAccount = nextAccountId
        ? accounts.find((item) => item.id === nextAccountId)
        : undefined;

      if (nextAccountId && !nextAccount)
        throw new Error("Cuenta financiera no encontrada.");
      if (nextAccount && nextAccount.currency !== record.currency)
        throw new Error("La moneda del movimiento no coincide con la cuenta.");

      const moneyChanged =
        nextAmount !== record.amount || nextAccountId !== record.accountId;

      if (moneyChanged) {
        const projectedBalances = new Map(
          accounts.map((account) => [account.id, account.balance]),
        );

        if (previousAccount) {
          const reversed =
            (projectedBalances.get(previousAccount.id) ?? previousAccount.balance) +
            (kind === "income" ? -record.amount : record.amount);
          projectedBalances.set(
            previousAccount.id,
            Math.round(reversed * 100) / 100,
          );
        }

        if (nextAccount) {
          const applied =
            (projectedBalances.get(nextAccount.id) ?? nextAccount.balance) +
            (kind === "income" ? nextAmount : -nextAmount);
          projectedBalances.set(nextAccount.id, Math.round(applied * 100) / 100);
        }

        for (const account of [previousAccount, nextAccount]) {
          if (!account) continue;
          const projected = projectedBalances.get(account.id);
          if (projected != null && projected < 0)
            throw new Error(
              "La cuenta " + account.name + " no tiene saldo suficiente.",
            );
        }

        for (const account of [previousAccount, nextAccount]) {
          if (!account) continue;
          const projected = projectedBalances.get(account.id);
          if (projected == null || projected === account.balance) continue;
          account.balance = projected;
          account.updatedAt = Date.now();
        }

        record.amount = nextAmount;
        record.accountId = nextAccountId;
      }

      if (patch.title != null) {
        const clean = patch.title.trim();
        if (!clean) throw new Error("El movimiento necesita un título.");
        record.title = clean;
      }
      if (patch.date != null) record.date = patch.date;
      if ("projectId" in patch) {
        if (
          patch.projectId &&
          !w.projects.some((project) => project.id === patch.projectId)
        )
          throw new Error("Proyecto no encontrado.");
        record.projectId = patch.projectId || undefined;
      }
      if (patch.category != null)
        record.category = patch.category.trim() || "General";

      const changed =
        previous.title !== record.title ||
        previous.amount !== record.amount ||
        previous.date !== record.date ||
        previous.projectId !== record.projectId ||
        previous.category !== record.category ||
        previous.accountId !== record.accountId;

      if (!changed) return;

      record.updatedAt = Date.now();
      log(
        w,
        "Movimiento actualizado: " + record.title,
        "finance",
        record.projectId,
        {
          financeEvent: true,
          financeType: kind + "_updated",
          referenceId: record.id,
          amount: record.amount,
          currency: record.currency,
          date: record.date,
          cashImpact:
            previous.accountId !== record.accountId
              ? record.accountId
                ? kind === "income"
                  ? record.amount
                  : -record.amount
                : 0
              : previous.amount !== record.amount && record.accountId
                ? (record.amount - previous.amount) *
                  (kind === "income" ? 1 : -1)
                : 0,
          ...(record.accountId ? { accountId: record.accountId } : {}),
          ...(previous.accountId
            ? { previousAccountId: previous.accountId }
            : {}),
          accountChanged: previous.accountId !== record.accountId,
        },
      );
    });

  deleteMoneyRecord = (kind: "income" | "expense", recordId: string) =>
    this.store.update((w) => {
      const collection = kind === "income" ? w.incomes : w.expenses;
      const record = collection.find((item) => item.id === recordId);
      if (!record) throw new Error("Movimiento no encontrado.");
      const account = record.accountId
        ? (w.financialAccounts ?? []).find(
            (item) => item.id === record.accountId,
          )
        : undefined;
      if (account) {
        account.balance =
          Math.round(
            (account.balance + (kind === "income" ? -record.amount : record.amount)) *
              100,
          ) / 100;
        account.updatedAt = Date.now();
      }
      if (kind === "income")
        w.incomes = w.incomes.filter((item) => item.id !== recordId);
      else w.expenses = w.expenses.filter((item) => item.id !== recordId);
      log(
        w,
        "Movimiento eliminado: " + record.title,
        "finance",
        record.projectId,
        {
          financeEvent: true,
          financeType: kind + "_deleted",
          referenceId: record.id,
          amount: record.amount,
          currency: record.currency,
          date: record.date,
          cashImpact: 0,
          ...(record.accountId ? { accountId: record.accountId } : {}),
        },
      );
    });


  purgeMoneyRecord = (kind: "income" | "expense", recordId: string) =>
    this.store.update((w) => {
      const collection = kind === "income" ? w.incomes : w.expenses;
      const record = collection.find((item) => item.id === recordId);
      if (!record) throw new Error("Movimiento no encontrado.");

      const account = record.accountId
        ? (w.financialAccounts ?? []).find(
            (item) => item.id === record.accountId,
          )
        : undefined;

      if (account) {
        account.balance =
          Math.round(
            (account.balance + (kind === "income" ? -record.amount : record.amount)) *
              100,
          ) / 100;
        account.updatedAt = Date.now();
      }

      const debtId =
        typeof record.metadata?.debtId === "string"
          ? record.metadata.debtId
          : undefined;
      if (kind === "expense" && debtId) {
        const debt = (w.debts ?? []).find((item) => item.id === debtId);
        if (debt) {
          debt.balance =
            Math.round(
              Math.min(debt.originalAmount, debt.balance + record.amount) * 100,
            ) / 100;
          debt.status = debt.balance <= 0 ? "paid" : "pending";
          debt.updatedAt = Date.now();
        }
      }

      if (kind === "income")
        w.incomes = w.incomes.filter((item) => item.id !== recordId);
      else w.expenses = w.expenses.filter((item) => item.id !== recordId);

      // A permanent history cleanup is intentionally different from the
      // auditable deleteMoneyRecord path. It removes capture and finance
      // audit traces tied to the same movement so false/test records disappear.
      w.inbox = w.inbox.filter((item) => item.targetId !== recordId);
      w.activity = w.activity.filter(
        (item) =>
          !(
            item.metadata?.financeEvent === true &&
            item.metadata?.referenceId === recordId
          ),
      );
    });

  deleteFinanceHistoryEvent = (activityId: string) =>
    this.store.update((w) => {
      const event = w.activity.find((item) => item.id === activityId);
      if (!event || event.metadata?.financeEvent !== true)
        throw new Error("Registro financiero de historial no encontrado.");
      if (event.source !== "user")
        throw new Error("Los registros de demostración no se pueden eliminar.");
      w.activity = w.activity.filter((item) => item.id !== activityId);
    });


  createDebt = (input: {
    creditor: string;
    title?: string;
    amount: number;
    balance?: number;
    currency: Debt["currency"];
    dueDate?: string;
    notes?: string;
    projectId?: string;
  }) => {
    const debtId = id();
    this.store.update((w) => {
      const creditor = input.creditor.trim();
      const title = input.title?.trim() || creditor || "Deuda";
      if (!creditor) throw new Error("La deuda necesita un acreedor.");
      if (!Number.isFinite(input.amount) || input.amount <= 0)
        throw new Error("El importe de la deuda debe ser mayor que cero.");
      if (
        input.balance != null &&
        (!Number.isFinite(input.balance) || input.balance < 0)
      )
        throw new Error("El saldo pendiente no puede ser negativo.");
      if (
        input.projectId &&
        !w.projects.some((project) => project.id === input.projectId)
      )
        throw new Error("Proyecto no encontrado.");

      const originalAmount = Math.round(input.amount * 100) / 100;
      const balance =
        input.balance == null
          ? originalAmount
          : Math.round(input.balance * 100) / 100;

      w.debts ??= [];
      w.debts.unshift({
        ...entity(debtId, "user", w.user.id),
        creditor,
        title,
        projectId: input.projectId || undefined,
        originalAmount,
        balance,
        currency: input.currency,
        dueDate: input.dueDate || undefined,
        status: balance <= 0 ? "paid" : "pending",
        notes: input.notes?.trim() || undefined,
      });
      log(
        w,
        "Deuda registrada: " + creditor + " · " + balance + " " + input.currency,
        "debt",
        input.projectId,
        {
          financeEvent: true,
          financeType: "debt_created",
          referenceId: debtId,
          debtId,
          amount: originalAmount,
          balance,
          currency: input.currency,
          date: new Intl.DateTimeFormat("en-CA", {
            timeZone: w.user.preferences.timezone,
          }).format(new Date()),
          cashImpact: 0,
        },
      );
    });
    return debtId;
  };

  updateDebt = (
    debtId: string,
    patch: Partial<
      Pick<
        Debt,
        | "creditor"
        | "title"
        | "projectId"
        | "originalAmount"
        | "balance"
        | "dueDate"
        | "notes"
      >
    >,
  ) =>
    this.store.update((w) => {
      const debt = (w.debts ?? []).find((item) => item.id === debtId);
      if (!debt) throw new Error("Deuda no encontrada.");

      if (patch.creditor != null) {
        const creditor = patch.creditor.trim();
        if (!creditor) throw new Error("La deuda necesita un acreedor.");
        debt.creditor = creditor;
      }
      if (patch.title != null) {
        const title = patch.title.trim();
        if (!title) throw new Error("La deuda necesita un concepto.");
        debt.title = title;
      }
      if (patch.originalAmount != null) {
        if (!Number.isFinite(patch.originalAmount) || patch.originalAmount <= 0)
          throw new Error("El importe original debe ser mayor que cero.");
        debt.originalAmount = Math.round(patch.originalAmount * 100) / 100;
      }
      if (patch.balance != null) {
        if (!Number.isFinite(patch.balance) || patch.balance < 0)
          throw new Error("El saldo pendiente no puede ser negativo.");
        debt.balance = Math.round(patch.balance * 100) / 100;
        debt.status = debt.balance <= 0 ? "paid" : "pending";
      }
      if ("projectId" in patch) {
        if (
          patch.projectId &&
          !w.projects.some((project) => project.id === patch.projectId)
        )
          throw new Error("Proyecto no encontrado.");
        debt.projectId = patch.projectId || undefined;
      }
      if ("dueDate" in patch) debt.dueDate = patch.dueDate || undefined;
      if ("notes" in patch) debt.notes = patch.notes?.trim() || undefined;
      debt.updatedAt = Date.now();
      log(
        w,
        "Deuda actualizada: " + debt.creditor,
        "debt",
        debt.projectId,
        {
          financeEvent: true,
          financeType: "debt_updated",
          referenceId: debt.id,
          debtId: debt.id,
          amount: debt.originalAmount,
          balance: debt.balance,
          currency: debt.currency,
          date: new Intl.DateTimeFormat("en-CA", {
            timeZone: w.user.preferences.timezone,
          }).format(new Date()),
          cashImpact: 0,
        },
      );
    });

  markDebtPaid = (debtId: string, accountId?: string) =>
    this.store.update((w) => {
      const debt = (w.debts ?? []).find((item) => item.id === debtId);
      if (!debt) throw new Error("Deuda no encontrada.");

      const remaining = Math.max(0, Math.round(debt.balance * 100) / 100);
      const account = accountId
        ? (w.financialAccounts ?? []).find((item) => item.id === accountId)
        : undefined;

      if (accountId && !account)
        throw new Error("Cuenta financiera no encontrada.");
      if (account && account.currency !== debt.currency)
        throw new Error("La moneda de la cuenta no coincide con la deuda.");
      if (account && account.balance < remaining)
        throw new Error("La cuenta no tiene saldo suficiente.");

      let paymentRecordId = "";
      if (account && remaining > 0) {
        account.balance =
          Math.round((account.balance - remaining) * 100) / 100;
        account.updatedAt = Date.now();
        paymentRecordId = id();
        w.expenses.unshift({
          ...entity(paymentRecordId, "user", w.user.id),
          title: "Pago de deuda · " + debt.creditor,
          amount: remaining,
          currency: debt.currency,
          date: new Intl.DateTimeFormat("en-CA", {
            timeZone: w.user.preferences.timezone,
          }).format(new Date()),
          projectId: debt.projectId,
          category: "Pago de deuda",
          accountId: account.id,
          metadata: {
            debtId: debt.id,
            financeType: "debt_payment",
          },
        });
      }

      debt.balance = 0;
      debt.status = "paid";
      debt.updatedAt = Date.now();
      log(
        w,
        "Deuda marcada como pagada: " +
          debt.creditor +
          (account ? " · desde " + account.name : " · conciliación manual"),
        "debt",
        debt.projectId,
        {
          financeEvent: true,
          financeType: account ? "debt_settled" : "debt_reconciled",
          referenceId: paymentRecordId || debt.id,
          debtId: debt.id,
          amount: remaining,
          balance: 0,
          currency: debt.currency,
          date: new Intl.DateTimeFormat("en-CA", {
            timeZone: w.user.preferences.timezone,
          }).format(new Date()),
          cashImpact: account ? -remaining : 0,
          ...(account ? { accountId: account.id } : {}),
        },
      );
    });

  payDebt = (
    debtId: string,
    amount: number,
    accountId?: string,
  ) =>
    this.store.update((w) => {
      const debt = (w.debts ?? []).find((item) => item.id === debtId);
      if (!debt) throw new Error("Deuda no encontrada.");
      if (!Number.isFinite(amount) || amount <= 0)
        throw new Error("El pago debe ser mayor que cero.");
      const applied = Math.min(
        Math.round(amount * 100) / 100,
        debt.balance,
      );
      const account = accountId
        ? (w.financialAccounts ?? []).find((item) => item.id === accountId)
        : undefined;
      if (accountId && !account)
        throw new Error("Cuenta financiera no encontrada.");
      if (account && account.currency !== debt.currency)
        throw new Error("La moneda de la cuenta no coincide con la deuda.");
      if (account) {
        if (account.balance < applied)
          throw new Error("La cuenta no tiene saldo suficiente.");
        account.balance =
          Math.round((account.balance - applied) * 100) / 100;
        account.updatedAt = Date.now();
      }
      debt.balance = Math.round((debt.balance - applied) * 100) / 100;
      debt.status = debt.balance <= 0 ? "paid" : "pending";
      debt.updatedAt = Date.now();
      const paymentRecordId = id();
      const paymentDate = new Intl.DateTimeFormat("en-CA", {
        timeZone: w.user.preferences.timezone,
      }).format(new Date());
      w.expenses.unshift({
        ...entity(paymentRecordId, "user", w.user.id),
        title: "Pago de deuda · " + debt.creditor,
        amount: applied,
        currency: debt.currency,
        date: paymentDate,
        projectId: debt.projectId,
        category: "Pago de deuda",
        accountId: account?.id,
        metadata: {
          debtId: debt.id,
          financeType: "debt_payment",
        },
      });
      log(
        w,
        "Pago de deuda: " + debt.creditor + " · " + applied + " " + debt.currency,
        "debt",
        debt.projectId,
        {
          financeEvent: true,
          financeType: "debt_payment",
          referenceId: paymentRecordId,
          debtId: debt.id,
          amount: applied,
          balance: debt.balance,
          currency: debt.currency,
          date: paymentDate,
          cashImpact: account ? -applied : 0,
          ...(account ? { accountId: account.id } : {}),
        },
      );
    });

  updateIdea = (
    ideaId: string,
    patch: Partial<
      Pick<
        Idea,
        | "title"
        | "description"
        | "notes"
        | "category"
        | "potential"
        | "status"
        | "projectIds"
        | "reviewDate"
      >
    >,
  ) =>
    this.store.update((w) => {
      const idea = w.ideas.find((i) => i.id === ideaId);
      if (!idea) throw new Error("Idea no encontrada.");
      Object.assign(idea, patch, { updatedAt: Date.now() });
      log(w, "Idea actualizada: " + idea.title, "idea", idea.projectIds[0]);
    });
  convertIdea = (ideaId: string) => {
    let projectId = "";
    this.store.update((w) => {
      const idea = w.ideas.find((i) => i.id === ideaId);
      if (!idea) throw new Error("Idea no encontrada.");
      if (idea.status === "converted") {
        projectId = idea.projectIds[0] ?? "";
        return;
      }
      const p = newProject(idea.title, w.user.id, idea.description);
      p.area = idea.category;
      p.notes = idea.notes;
      w.projects.unshift(p);
      projectId = p.id;
      idea.status = "converted";
      idea.projectIds.unshift(p.id);
      idea.updatedAt = Date.now();
      log(w, "Idea convertida en proyecto: " + idea.title, "conversion", p.id);
    });
    return projectId;
  };
  deleteIdea = (ideaId: string) =>
    this.store.update((w) => {
      const idea = w.ideas.find((item) => item.id === ideaId);
      if (!idea) throw new Error("Idea no encontrada.");
      w.ideas = w.ideas.filter((i) => i.id !== ideaId);
      w.inbox = w.inbox.filter((i) => i.targetId !== ideaId);
      log(w, "Idea eliminada: " + idea.title, "idea", idea.projectIds[0]);
    });
  scheduleReview = (ideaId: string, date: string) =>
    this.store.update((w) => {
      const idea = w.ideas.find((i) => i.id === ideaId);
      if (!idea || !date) throw new Error("Selecciona una fecha.");
      idea.reviewDate = date;
      idea.status = "review";
      idea.updatedAt = Date.now();
      const start = new Date(
        zonedISO(date + "T09:00", w.user.preferences.timezone),
      );
      const existing = w.events.find((e) => e.metadata?.ideaId === ideaId);
      const event: CalendarEvent = {
        ...entity(existing?.id ?? id(), "user", w.user.id),
        title: "Revisar: " + idea.title,
        start: start.toISOString(),
        end: new Date(+start + 30 * 60000).toISOString(),
        category: "admin",
        metadata: { ideaId },
      };
      if (existing) Object.assign(existing, event);
      else w.events.push(event);
    });
  startFlow = (projectId: string, taskId: string, duration?: number) =>
    this.store.update((w) => {
      if (w.activeFlow)
        throw new Error(
          "Ya hay una sesión abierta. Termínala antes de iniciar otra.",
        );
      const p = w.projects.find((p) => p.id === projectId);
      const task = p?.tasks.find((t) => t.id === taskId);
      if (!p || !task || task.completed)
        throw new Error("Selecciona una tarea pendiente.");
      if (p.status !== "active")
        throw new Error("Activa el proyecto antes de iniciar Flow.");
      w.activeFlow = {
        ...entity(id(), "user", w.user.id),
        projectId,
        taskId,
        title: task.title,
        projectName: p.name,
        startedAt: Date.now(),
        durationMinutes: Math.max(
          1,
          Math.min(480, duration ?? task.estimatedMinutes),
        ),
        pausedMs: 0,
      };
    });
  pauseFlow = () =>
    this.store.update((w) => {
      if (!w.activeFlow) return;
      const f = w.activeFlow;
      if (f.pausedAt) {
        f.pausedMs += Date.now() - f.pausedAt;
        delete f.pausedAt;
      } else f.pausedAt = Date.now();
      f.updatedAt = Date.now();
    });
  endFlow = (completeTask = false) => {
    let result = this.store.getSnapshot().activeFlow;
    this.store.update((w) => {
      const f = w.activeFlow;
      if (!f) return;
      f.elapsedSeconds = flowElapsed(f);
      f.endedAt = f.pausedAt ?? Date.now();
      f.updatedAt = Date.now();
      f.completed = completeTask;
      if (completeTask) complete(w, f.projectId, f.taskId, true);
      const p = w.projects.find((p) => p.id === f.projectId);
      if (p) {
        p.hours += f.elapsedSeconds / 3600;
        p.updatedAt = Date.now();
      }
      w.flows.unshift(f);
      log(
        w,
        `Flow · ${Math.round(f.elapsedSeconds / 60)} min · ${f.title}`,
        "flow",
        f.projectId,
      );
      result = f;
      w.activeFlow = null;
    });
    return result;
  };
  saveEvent = (event: CalendarEvent) =>
    this.store.update((w) => {
      if (
        event.userId !== w.user.id ||
        !event.title.trim() ||
        !Number.isFinite(+new Date(event.start)) ||
        +new Date(event.end) <= +new Date(event.start)
      )
        throw new Error("Revisa el título y las horas del bloque.");
      const i = w.events.findIndex((e) => e.id === event.id);
      const created = i < 0;
      if (created) w.events.push(event);
      else w.events[i] = { ...event, updatedAt: Date.now() };
      log(
        w,
        (created ? "Evento creado: " : "Evento actualizado: ") + event.title,
        "calendar",
        event.projectId,
      );
    });
  deleteEvent = (eventId: string) =>
    this.store.update((w) => {
      const event = w.events.find((item) => item.id === eventId);
      if (!event) throw new Error("Evento no encontrado.");
      w.events = w.events.filter((e) => e.id !== eventId);
      log(w, "Evento eliminado: " + event.title, "calendar", event.projectId);
    });

  addMemory = (content: string, projectId?: string) => {
    const memoryId = id();
    this.store.update((w) => {
      const clean = content.trim();
      if (!clean) throw new Error("La memoria no puede quedar vacía.");
      if (projectId && !w.projects.some((project) => project.id === projectId))
        throw new Error("Proyecto no encontrado.");
      w.memories.push({
        ...entity(memoryId, "user", w.user.id),
        content: clean,
        projectIds: projectId ? [projectId] : [],
      });
      log(w, "Memoria guardada", "memory", projectId);
    });
    return memoryId;
  };

  updateMemory = (memoryId: string, content: string, projectId?: string) =>
    this.store.update((w) => {
      const memory = w.memories.find((item) => item.id === memoryId);
      if (!memory) throw new Error("Memoria no encontrada.");
      const clean = content.trim();
      if (!clean) throw new Error("La memoria no puede quedar vacía.");
      if (projectId && !w.projects.some((project) => project.id === projectId))
        throw new Error("Proyecto no encontrado.");
      memory.content = clean;
      memory.projectIds = projectId ? [projectId] : memory.projectIds;
      memory.updatedAt = Date.now();
      log(w, "Memoria actualizada", "memory", projectId);
    });

  deleteMemory = (memoryId: string) =>
    this.store.update((w) => {
      const memory = w.memories.find((item) => item.id === memoryId);
      if (!memory) throw new Error("Memoria no encontrada.");
      w.memories = w.memories.filter((item) => item.id !== memoryId);
      log(w, "Memoria eliminada", "memory", memory.projectIds[0]);
    });

  createAIConversation = (projectId?: string, title?: string) => {
    const snapshot = this.store.getSnapshot();
    if (projectId) {
      const existing = snapshot.conversations.find(
        (conversation) =>
          conversation.kind === "project" &&
          conversation.projectId === projectId,
      );
      if (existing) return existing.id;
    }
    const conversationId = id();
    this.store.update((w) => {
      const project = projectId
        ? w.projects.find((item) => item.id === projectId)
        : undefined;
      if (projectId && !project) throw new Error("Proyecto no encontrado.");
      w.conversations.unshift({
        ...entity(conversationId, "user", w.user.id),
        title:
          title?.trim() ||
          project?.name ||
          "Nueva conversación",
        kind: project ? "project" : "general",
        projectId: project?.id,
        messageIds: [],
      });
    });
    return conversationId;
  };

  appendAIMessage = (conversationId: string, message: AIMessage) =>
    this.store.update((w) => {
      const conversation = w.conversations.find(
        (item) => item.id === conversationId,
      );
      if (!conversation) throw new Error("Conversación no encontrada.");
      const clean = message.content.trim();
      if (!clean) throw new Error("El mensaje no puede quedar vacío.");
      const owned: AIMessage = {
        ...message,
        userId: w.user.id,
        source: "user",
        conversationId,
        content: clean,
        updatedAt: Date.now(),
      };
      w.messages.push(owned);
      if (!conversation.messageIds.includes(owned.id))
        conversation.messageIds.push(owned.id);
      if (
        conversation.kind === "general" &&
        conversation.title === "Nueva conversación" &&
        owned.role === "user"
      ) {
        conversation.title =
          clean.length > 54 ? clean.slice(0, 51).trimEnd() + "…" : clean;
      }
      conversation.updatedAt = Date.now();
    });

  deleteAIMessage = (messageId: string) =>
    this.store.update((w) => {
      const message = w.messages.find((item) => item.id === messageId);
      if (!message) throw new Error("Mensaje no encontrado.");
      w.messages = w.messages.filter((item) => item.id !== messageId);
      const conversation = w.conversations.find(
        (item) => item.id === message.conversationId,
      );
      if (conversation) {
        conversation.messageIds = conversation.messageIds.filter(
          (id) => id !== messageId,
        );
        conversation.updatedAt = Date.now();
      }
    });

  deleteAIConversation = (conversationId: string) =>
    this.store.update((w) => {
      const conversation = w.conversations.find(
        (item) => item.id === conversationId,
      );
      if (!conversation) throw new Error("Conversación no encontrada.");
      w.messages = w.messages.filter(
        (message) => message.conversationId !== conversationId,
      );
      w.conversations = w.conversations.filter(
        (item) => item.id !== conversationId,
      );
    });

  logProjectActivity = (projectId: string, content: string) =>
    this.store.update((w) => {
      const project = w.projects.find((item) => item.id === projectId);
      if (!project) throw new Error("Proyecto no encontrado.");
      const clean = content.trim();
      if (!clean) throw new Error("Describe el avance realizado.");
      const date = new Intl.DateTimeFormat("en-CA", {
        timeZone: w.user.preferences.timezone,
      }).format(new Date());
      const line = "[" + date + "] " + clean;
      project.notes = project.notes?.trim()
        ? project.notes.trimEnd() + "\n" + line
        : line;
      project.updatedAt = Date.now();
      log(w, "Avance: " + clean, "project-activity", projectId);
    });

  updatePreferences = (patch: Partial<UserPreferences>) =>
    this.store.update((w) => {
      Object.assign(w.user.preferences, patch);
      w.user.updatedAt = Date.now();
    });
  updateProfile = (name: string, email: string) =>
    this.store.update((w) => {
      if (!name.trim()) throw new Error("Introduce tu nombre.");
      w.user.name = name.trim();
      w.user.email = email;
      w.user.initials = name
        .split(" ")
        .filter(Boolean)
        .slice(0, 2)
        .map((n) => n[0])
        .join("")
        .toUpperCase();
    });
  readNotifications = (notificationId?: string) =>
    this.store.update((w) => {
      w.notifications.forEach((n) => {
        if (!notificationId || n.id === notificationId) n.read = true;
      });
    });
  processInbox = (inboxId: string) =>
    this.store.update((w) => {
      const item = w.inbox.find((i) => i.id === inboxId);
      if (item) item.processed = true;
    });
  toggleGoal = (goalId: string, milestoneId: string) =>
    this.store.update((w) => {
      const g = w.goals.find((g) => g.id === goalId);
      const m = g?.milestones.find((m) => m.id === milestoneId);
      if (m) {
        m.completed = !m.completed;
        m.updatedAt = Date.now();
      }
    });
  addDependency = (task: Task, dependsOnTaskId: string) =>
    this.store.update((w) => {
      if (
        task.id === dependsOnTaskId ||
        !w.projects
          .flatMap((p) => p.tasks)
          .some((t) => t.id === dependsOnTaskId)
      )
        throw new Error("Dependencia inválida.");
      const visited = new Set<string>();
      const cycle = (current: string): boolean => {
        if (current === task.id) return true;
        if (visited.has(current)) return false;
        visited.add(current);
        return w.dependencies
          .filter((d) => d.taskId === current)
          .some((d) => cycle(d.dependsOnTaskId));
      };
      if (cycle(dependsOnTaskId))
        throw new Error("Esta dependencia crearía un ciclo.");
      if (
        !w.dependencies.some(
          (d) => d.taskId === task.id && d.dependsOnTaskId === dependsOnTaskId,
        )
      )
        w.dependencies.push({
          ...entity(id(), "user", w.user.id),
          taskId: task.id,
          dependsOnTaskId,
        });
    });
}
