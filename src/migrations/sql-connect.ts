import type { Workspace } from "@/domain/models";

export interface SqlMigrationIssue {
  level: "warning" | "error";
  entity: string;
  legacyId?: string;
  message: string;
}

export interface SqlMigrationPlan {
  version: 1;
  firebaseUid: string;
  workspace: {
    legacyId: string;
    name: string;
    slug: string;
    kind: "personal";
    currency: string;
    timezone: string;
  };
  user: {
    uid: string;
    email: string;
    displayName: string;
    timezone: string;
  };
  projects: Array<Record<string, unknown>>;
  milestones: Array<Record<string, unknown>>;
  tasks: Array<Record<string, unknown>>;
  dependencies: Array<Record<string, unknown>>;
  inbox: Array<Record<string, unknown>>;
  ideas: Array<Record<string, unknown>>;
  ideaProjects: Array<Record<string, unknown>>;
  goals: Array<Record<string, unknown>>;
  goalProjects: Array<Record<string, unknown>>;
  goalMilestones: Array<Record<string, unknown>>;
  contacts: Array<Record<string, unknown>>;
  transactions: Array<Record<string, unknown>>;
  financialGoals: Array<Record<string, unknown>>;
  calendarEvents: Array<Record<string, unknown>>;
  flowSessions: Array<Record<string, unknown>>;
  knowledge: Array<Record<string, unknown>>;
  attachments: Array<Record<string, unknown>>;
  notifications: Array<Record<string, unknown>>;
  activity: Array<Record<string, unknown>>;
  aiMessages: Array<Record<string, unknown>>;
  aiMemories: Array<Record<string, unknown>>;
  aiUsage: Array<Record<string, unknown>>;
  dailyPlans: Array<Record<string, unknown>>;
  issues: SqlMigrationIssue[];
}

function toIsoTimestamp(epochMs: number, entity: string, legacyId: string, issues: SqlMigrationIssue[]) {
  if (!Number.isFinite(epochMs)) {
    issues.push({
      level: "error",
      entity,
      legacyId,
      message: "Marca de tiempo inválida; el registro no debe escribirse hasta corregirla.",
    });
    return undefined;
  }
  return new Date(epochMs).toISOString();
}

export function usdToMinorUnits(amount: number, label = "importe") {
  if (!Number.isFinite(amount))
    throw new Error(`${label}: importe no finito.`);
  const cents = Math.round(amount * 100);
  if (!Number.isSafeInteger(cents))
    throw new Error(`${label}: importe fuera del rango seguro.`);
  return cents;
}

function safeSlug(value: string) {
  const normalized = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return normalized || "personal";
}

function finiteOr(value: number | undefined, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function sourceDates(
  record: { createdAt: number; updatedAt: number; id: string },
  entityName: string,
  issues: SqlMigrationIssue[],
) {
  return {
    createdAt: toIsoTimestamp(record.createdAt, entityName, record.id, issues),
    updatedAt: toIsoTimestamp(record.updatedAt, entityName, record.id, issues),
  };
}

/**
 * Creates a loss-aware normalization plan from the current Workspace snapshot.
 *
 * It does not write to SQL Connect. This separation lets us inspect counts and
 * warnings before any production migration runs.
 */
export function buildSqlMigrationPlan(
  workspace: Workspace,
  firebaseUid: string,
): SqlMigrationPlan {
  if (!firebaseUid.trim()) throw new Error("Firebase UID requerido.");

  const issues: SqlMigrationIssue[] = [];
  const timezone = workspace.user.preferences.timezone;
  const workspaceLegacyId = `personal:${firebaseUid}`;
  const workspaceSlug = `personal-${safeSlug(firebaseUid).slice(0, 24)}`;

  const projects = workspace.projects.map((project) => ({
    legacyId: project.id,
    name: project.name,
    area: project.area,
    clientName: project.client,
    description: project.description,
    progress: finiteOr(project.progress, 0),
    status: project.status,
    priority: project.priority,
    stage: project.stage,
    deadline: project.deadline || undefined,
    dueDate: project.dueDate || undefined,
    valueMinor:
      typeof project.value === "number"
        ? usdToMinorUnits(project.value, `Proyecto ${project.id}`)
        : undefined,
    paidMinor:
      typeof project.paid === "number"
        ? usdToMinorUnits(project.paid, `Proyecto ${project.id}`)
        : undefined,
    currency: "USD",
    accent: project.accent,
    nextAction: project.nextAction,
    hours: finiteOr(project.hours, 0),
    notes: project.notes,
    source: project.source,
    metadata: project.metadata,
    archived: project.status === "completed",
    ...sourceDates(project, "Project", issues),
  }));

  const milestones = workspace.projects.flatMap((project) =>
    project.milestones.map((milestone, index) => ({
      legacyId: milestone.id,
      projectLegacyId: project.id,
      title: milestone.title,
      weight: finiteOr(milestone.weight, 0),
      progress: finiteOr(milestone.progress, 0),
      baselineProgress: milestone.baselineProgress,
      sortOrder: index,
      ...sourceDates(milestone, "Milestone", issues),
    })),
  );

  const tasks = workspace.projects.flatMap((project) =>
    project.tasks.map((task, index) => {
      const matchingMilestones = project.milestones.filter(
        (milestone) => milestone.title === task.milestone,
      );
      if (task.milestone && matchingMilestones.length !== 1) {
        issues.push({
          level: "warning",
          entity: "Task",
          legacyId: task.id,
          message:
            "No se enlazó automáticamente el hito porque el nombre no identifica un único hito.",
        });
      }
      return {
        legacyId: task.id,
        projectLegacyId: project.id,
        milestoneLegacyId:
          matchingMilestones.length === 1 ? matchingMilestones[0].id : undefined,
        legacyMilestoneLabel: task.milestone,
        title: task.title,
        completed: task.completed,
        estimatedMinutes: finiteOr(task.estimatedMinutes, 0),
        priority: task.priority,
        completedAt:
          typeof task.completedAt === "number"
            ? toIsoTimestamp(task.completedAt, "Task", task.id, issues)
            : undefined,
        sortOrder: index,
        source: task.source,
        metadata: task.metadata,
        ...sourceDates(task, "Task", issues),
      };
    }),
  );

  const dependencies = workspace.dependencies.map((dependency) => ({
    legacyId: dependency.id,
    taskLegacyId: dependency.taskId,
    dependsOnTaskLegacyId: dependency.dependsOnTaskId,
    ...sourceDates(dependency, "TaskDependency", issues),
  }));

  const inbox = workspace.inbox.map((item) => ({
    legacyId: item.id,
    type: item.type,
    content: item.content,
    targetId: item.targetId,
    processed: item.processed ?? false,
    ...sourceDates(item, "InboxItem", issues),
  }));

  const ideas = workspace.ideas.map((idea) => ({
    legacyId: idea.id,
    title: idea.title,
    category: idea.category,
    description: idea.description,
    status: idea.status,
    potential: idea.potential,
    notes: idea.notes,
    reviewDate: idea.reviewDate,
    ...sourceDates(idea, "Idea", issues),
  }));

  const ideaProjects = workspace.ideas.flatMap((idea) =>
    idea.projectIds.map((projectLegacyId) => ({
      ideaLegacyId: idea.id,
      projectLegacyId,
    })),
  );

  const goals = workspace.goals.map((goal) => ({
    legacyId: goal.id,
    title: goal.title,
    targetDate: goal.targetDate || undefined,
    status: goal.milestones.every((m) => m.completed) ? "completed" : "active",
    ...sourceDates(goal, "Goal", issues),
  }));

  const goalProjects = workspace.goals.flatMap((goal) =>
    goal.projectIds.map((projectLegacyId) => ({
      goalLegacyId: goal.id,
      projectLegacyId,
    })),
  );

  const goalMilestones = workspace.goals.flatMap((goal) =>
    goal.milestones.map((milestone, index) => ({
      legacyId: milestone.id,
      goalLegacyId: goal.id,
      title: milestone.title,
      completed: milestone.completed,
      sortOrder: index,
      ...sourceDates(milestone, "GoalMilestone", issues),
    })),
  );

  const contacts = workspace.contacts.map((contact) => ({
    legacyId: contact.id,
    name: contact.name,
    email: contact.email,
    phone: contact.phone,
    company: contact.company,
    ...sourceDates(contact, "Contact", issues),
  }));

  const transactions = [
    ...workspace.incomes.map((record) => ({
      legacyId: record.id,
      projectLegacyId: record.projectId,
      kind: "income",
      title: record.title,
      amountMinor: usdToMinorUnits(record.amount, `Ingreso ${record.id}`),
      currency: record.currency,
      date: record.date,
      category: record.category,
      status: "posted",
      ...sourceDates(record, "Transaction", issues),
    })),
    ...workspace.expenses.map((record) => ({
      legacyId: record.id,
      projectLegacyId: record.projectId,
      kind: "expense",
      title: record.title,
      amountMinor: usdToMinorUnits(record.amount, `Gasto ${record.id}`),
      currency: record.currency,
      date: record.date,
      category: record.category,
      status: "posted",
      ...sourceDates(record, "Transaction", issues),
    })),
  ];

  const financialGoals = workspace.financialGoals.map((goal) => ({
    legacyId: goal.id,
    title: goal.title,
    targetMinor: usdToMinorUnits(goal.target, `Meta financiera ${goal.id}`),
    savedMinor: usdToMinorUnits(goal.saved, `Meta financiera ${goal.id}`),
    currency: "USD",
    kind: goal.kind,
    ...sourceDates(goal, "FinancialGoal", issues),
  }));

  const calendarEvents = workspace.events.map((event) => ({
    legacyId: event.id,
    projectLegacyId: event.projectId,
    title: event.title,
    start: event.start,
    end: event.end,
    category: event.category,
    description: event.description,
    provider: event.providerId ? "google" : "nexus",
    providerId: event.providerId,
    syncStatus: event.providerId ? "linked" : "local",
    metadata: event.metadata,
    ...sourceDates(event, "CalendarEvent", issues),
  }));

  const flowSessions = workspace.flows.map((flow) => ({
    legacyId: flow.id,
    projectLegacyId: flow.projectId,
    taskLegacyId: flow.taskId,
    title: flow.title,
    projectName: flow.projectName,
    durationMinutes: flow.durationMinutes,
    startedAt: toIsoTimestamp(flow.startedAt, "FlowSession", flow.id, issues),
    pausedAt:
      typeof flow.pausedAt === "number"
        ? toIsoTimestamp(flow.pausedAt, "FlowSession", flow.id, issues)
        : undefined,
    pausedMs: flow.pausedMs,
    endedAt:
      typeof flow.endedAt === "number"
        ? toIsoTimestamp(flow.endedAt, "FlowSession", flow.id, issues)
        : undefined,
    elapsedSeconds: flow.elapsedSeconds,
    completed: flow.completed ?? false,
    ...sourceDates(flow, "FlowSession", issues),
  }));

  const knowledge = workspace.knowledge.map((item) => ({
    legacyId: item.id,
    projectLegacyId: item.projectId,
    title: item.title,
    type: item.type,
    content: item.content,
    url: item.url,
    category: item.category,
    tags: item.tags,
    searchableText: [item.title, item.content, ...item.tags].join(" "),
    ...sourceDates(item, "KnowledgeItem", issues),
  }));

  const attachments = workspace.attachments.map((attachment) => ({
    legacyId: attachment.id,
    projectLegacyId: attachment.projectId,
    name: attachment.name,
    mimeType: attachment.mimeType,
    sizeBytes: attachment.size,
    provider: attachment.provider,
    storagePath:
      attachment.provider === "firebase" ? attachment.externalId : undefined,
    externalId: attachment.externalId,
    ...sourceDates(attachment, "Attachment", issues),
  }));

  const notifications = workspace.notifications.map((notification) => ({
    legacyId: notification.id,
    kind: notification.kind,
    title: notification.title,
    body: notification.body,
    href: notification.href,
    read: notification.read,
    ...sourceDates(notification, "Notification", issues),
  }));

  const activity = workspace.activity.map((event) => ({
    legacyId: event.id,
    projectLegacyId: event.projectId,
    kind: event.kind,
    title: event.title,
    ...sourceDates(event, "ActivityEvent", issues),
  }));

  const aiMessages = workspace.messages.map((message) => ({
    legacyId: message.id,
    conversationLegacyId: message.conversationId,
    role: message.role,
    content: message.content,
    contextIds: message.contextIds,
    simulated: message.simulated,
    ...sourceDates(message, "AIMessage", issues),
  }));

  const aiMemories = workspace.memories.map((memory) => ({
    legacyId: memory.id,
    content: memory.content,
    kind: "legacy",
    importance: 0.5,
    projectIds: memory.projectIds,
    active: true,
    ...sourceDates(memory, "AIMemory", issues),
  }));

  const aiUsage = workspace.aiUsage.map((usage) => ({
    legacyId: usage.id,
    provider: usage.provider,
    model: usage.provider === "mock" ? "mock" : "legacy-openai",
    inputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens,
    costMicrosUsd: Math.round(usage.costUSD * 1_000_000),
    ...sourceDates(usage, "AIUsage", issues),
  }));

  const dailyPlans = workspace.dailyPlans.map((plan) => ({
    legacyId: plan.id,
    date: plan.date,
    directiveProjectLegacyId: plan.directiveProjectId,
    outcomeTaskLegacyIds: plan.outcomeTaskIds,
    ...sourceDates(plan, "DailyPlan", issues),
  }));

  return {
    version: 1,
    firebaseUid,
    workspace: {
      legacyId: workspaceLegacyId,
      name: "Personal",
      slug: workspaceSlug,
      kind: "personal",
      currency: "USD",
      timezone,
    },
    user: {
      uid: firebaseUid,
      email: workspace.user.email,
      displayName: workspace.user.name,
      timezone,
    },
    projects,
    milestones,
    tasks,
    dependencies,
    inbox,
    ideas,
    ideaProjects,
    goals,
    goalProjects,
    goalMilestones,
    contacts,
    transactions,
    financialGoals,
    calendarEvents,
    flowSessions,
    knowledge,
    attachments,
    notifications,
    activity,
    aiMessages,
    aiMemories,
    aiUsage,
    dailyPlans,
    issues,
  };
}

export function summarizeSqlMigrationPlan(plan: SqlMigrationPlan) {
  return {
    projects: plan.projects.length,
    milestones: plan.milestones.length,
    tasks: plan.tasks.length,
    ideas: plan.ideas.length,
    goals: plan.goals.length,
    contacts: plan.contacts.length,
    transactions: plan.transactions.length,
    calendarEvents: plan.calendarEvents.length,
    flowSessions: plan.flowSessions.length,
    knowledge: plan.knowledge.length,
    attachments: plan.attachments.length,
    notifications: plan.notifications.length,
    aiMessages: plan.aiMessages.length,
    aiMemories: plan.aiMemories.length,
    issues: plan.issues.length,
  };
}
