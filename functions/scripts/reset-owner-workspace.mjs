import { writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { createInterface } from "node:readline/promises";
import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

const PROJECT_ID = "nexus-96795";
const CUTOVER_DATE = "2026-09-29";

initializeApp({
  credential: applicationDefault(),
  projectId: PROJECT_ID,
});

const auth = getAuth();
const db = getFirestore();

const args = Object.fromEntries(
  process.argv.slice(2).map((arg) => {
    const [key, ...rest] = arg.replace(/^--/, "").split("=");
    return [key, rest.length ? rest.join("=") : true];
  }),
);

function nowEntity(userId, metadata = {}) {
  const now = Date.now();
  return {
    id: randomUUID(),
    userId,
    createdAt: now,
    updatedAt: now,
    source: "user",
    metadata,
  };
}

function findProject(workspace, id) {
  const project = workspace.projects.find((item) => item.id === id);
  if (!project) throw new Error("No se encontró el proyecto " + id);
  return project;
}

function upsertTask(project, userId, title, patch = {}) {
  let task = project.tasks.find(
    (item) => item.title.trim().toLowerCase() === title.trim().toLowerCase(),
  );
  if (!task) {
    task = {
      ...nowEntity(userId, { realDataCutover: CUTOVER_DATE }),
      projectId: project.id,
      title,
      completed: false,
      estimatedMinutes: 45,
      priority: "medium",
      milestone: project.milestones?.[0]?.title || "Ejecución",
    };
    project.tasks.push(task);
  }
  Object.assign(task, patch, {
    userId,
    source: "user",
    updatedAt: Date.now(),
  });
  if (task.completed && !task.completedAt) task.completedAt = Date.now();
  if (!task.completed) delete task.completedAt;
  return task;
}

function setProject(project, patch, estimated = true) {
  Object.assign(project, patch, {
    source: "user",
    updatedAt: Date.now(),
    metadata: {
      ...(project.metadata || {}),
      realDataCutover: CUTOVER_DATE,
      progressBasis: estimated ? "estimated-from-known-status" : "confirmed",
    },
  });
}

function recordedHours(workspace, projectId) {
  return Math.round(
    workspace.flows
      .filter((flow) => flow.projectId === projectId)
      .reduce((sum, flow) => {
        if (Number.isFinite(flow.elapsedSeconds))
          return sum + flow.elapsedSeconds / 3600;
        if (
          Number.isFinite(flow.startedAt) &&
          Number.isFinite(flow.endedAt) &&
          Number.isFinite(flow.pausedMs)
        )
          return (
            sum +
            Math.max(
              0,
              flow.endedAt - flow.startedAt - flow.pausedMs,
            ) /
              3_600_000
          );
        return sum;
      }, 0) * 100,
  ) / 100;
}

function cleanFinancialMetadata(project) {
  const metadata = { ...(project.metadata || {}) };
  delete metadata.receivableUSD;
  delete metadata.overdueUSD;
  delete metadata.receivableStatus;
  project.metadata = metadata;
  delete project.value;
  delete project.paid;
}

function prepareWorkspace(original, user) {
  const workspace = structuredClone(original);
  const userId = user.uid;

  workspace.user.id = userId;
  workspace.user.userId = userId;
  workspace.user.email = user.email || workspace.user.email || "";
  workspace.user.name =
    user.displayName?.trim() || workspace.user.name || "Mi espacio";
  workspace.user.source = "user";
  workspace.user.updatedAt = Date.now();
  workspace.user.metadata = {
    ...(workspace.user.metadata || {}),
    financeCutoverDate: CUTOVER_DATE,
    cashNIO: 2500,
    cardUSD: 103,
    financeHistoryReconciled: false,
    financeCutoverReason:
      "Inicio de registro financiero real; histórico previo incompleto no reconstruido.",
  };

  for (const project of workspace.projects) {
    project.userId = userId;
    project.source = "user";
    cleanFinancialMetadata(project);
    project.hours = recordedHours(workspace, project.id);
    project.metadata = {
      ...(project.metadata || {}),
      hoursBasis: "flow-only",
    };
    for (const task of project.tasks || []) {
      task.userId = userId;
      task.source = "user";
    }
    for (const milestone of project.milestones || []) {
      milestone.userId = userId;
      milestone.source = "user";
    }
  }

  const updates = {
    "pequenos-escritores": {
      progress: 75,
      status: "active",
      priority: "critical",
      stage: "execution",
      nextAction:
        "Cerrar progresión por niveles, sílabas, fonética y pulido para exposición.",
    },
    "tesis-civil": {
      progress: 92,
      status: "active",
      priority: "critical",
      stage: "delivery",
      dueDate: "2026-10-19",
      deadline: "DEFENSA FINAL",
      nextAction:
        "Aplicar correcciones menores de predefensa y preparar defensa final.",
    },
    "dolce": {
      progress: 55,
      status: "active",
      priority: "high",
      stage: "execution",
      nextAction:
        "Continuar documento, resultados, conclusiones y preparación de defensa.",
    },
    nexus: {
      progress: 75,
      status: "active",
      priority: "critical",
      stage: "execution",
      nextAction:
        "Validar multiusuario con Oliver y consolidar finanzas con datos reales.",
    },
    "xarcon-creative": {
      progress: 70,
      status: "active",
      priority: "high",
      stage: "execution",
      nextAction:
        "Consolidar portafolio, casos de estudio y oferta comercial.",
    },
    "amy-blandon": {
      progress: 98,
      status: "waiting",
      priority: "high",
      stage: "delivery",
      nextAction: "Subir las 6 propiedades adicionales solicitadas por Amy.",
    },
    "drg-web": {
      progress: 90,
      status: "waiting",
      priority: "high",
      stage: "delivery",
      nextAction:
        "Mantener sistema y retomar mejoras cuando corresponda; seguimiento de cobros pendiente.",
    },
    "avaluos-drg": {
      progress: 85,
      status: "waiting",
      priority: "medium",
      stage: "execution",
      nextAction: "Continuar calibración, historial y mejoras administrativas.",
    },
    "web-norvin": {
      progress: 90,
      status: "waiting",
      priority: "medium",
      stage: "delivery",
      nextAction: "Mantener propiedades y contenido comercial actualizado.",
    },
    criscasa: {
      progress: 100,
      status: "completed",
      priority: "medium",
      stage: "delivery",
      nextAction: "Etapa 1 entregada; esperar nueva fase.",
    },
    "casa-propia": {
      progress: 78,
      status: "waiting",
      priority: "medium",
      stage: "planning",
      nextAction: "Retomar cuando vuelva a ser prioridad.",
    },
    nicasa: {
      progress: 34,
      status: "backlog",
      priority: "low",
      stage: "planning",
      nextAction: "Proyecto pausado; redefinir alcance antes de retomarlo.",
    },
    "xarcon-realty": {
      progress: 28,
      status: "backlog",
      priority: "medium",
      stage: "planning",
      nextAction: "Mantener en preparación hasta operar la marca por cuenta propia.",
    },
    "xarcon-construcciones": {
      progress: 24,
      status: "backlog",
      priority: "medium",
      stage: "planning",
      nextAction: "Mantener estructura base para lanzamiento futuro.",
    },
    "recoleccion-uni": {
      progress: 100,
      status: "completed",
      priority: "low",
      stage: "delivery",
      nextAction: "Proyecto cerrado.",
    },
    "rally-germina": {
      progress: 100,
      status: "completed",
      priority: "low",
      stage: "delivery",
      nextAction: "Proyecto cerrado.",
    },
  };

  for (const [id, patch] of Object.entries(updates)) {
    const project = findProject(workspace, id);
    const confirmed =
      patch.progress === 100 ||
      id === "criscasa" ||
      id === "recoleccion-uni" ||
      id === "rally-germina";
    setProject(project, patch, !confirmed);
  }

  const thesis = findProject(workspace, "tesis-civil");
  for (const milestone of thesis.milestones || []) {
    if (/Correcciones y predefensa/i.test(milestone.title)) {
      milestone.progress = 100;
      milestone.baselineProgress = 100;
    }
    if (/Defensa final/i.test(milestone.title)) {
      milestone.progress = 20;
      milestone.baselineProgress = 20;
    }
    milestone.updatedAt = Date.now();
  }
  for (const task of thesis.tasks) {
    if (
      /predefensa|observaciones del primer documento/i.test(task.title)
    ) {
      task.completed = true;
      task.completedAt = task.completedAt || Date.now();
      task.updatedAt = Date.now();
    }
  }
  upsertTask(
    thesis,
    userId,
    "Aplicar correcciones menores de la predefensa",
    {
      completed: false,
      priority: "critical",
      estimatedMinutes: 90,
      milestone: "Defensa final",
    },
  );
  upsertTask(thesis, userId, "Actualizar documento para defensa final", {
    completed: false,
    priority: "high",
    estimatedMinutes: 120,
    milestone: "Defensa final",
  });
  upsertTask(thesis, userId, "Preparar presentación y defensa final", {
    completed: false,
    priority: "high",
    estimatedMinutes: 120,
    milestone: "Defensa final",
  });

  const amy = findProject(workspace, "amy-blandon");
  for (const milestone of amy.milestones || []) {
    if (/Identidad|Web comercial|Funciones y contenido/i.test(milestone.title)) {
      milestone.progress = 100;
      milestone.baselineProgress = 100;
    }
    if (/Cierre/i.test(milestone.title)) {
      milestone.progress = 80;
      milestone.baselineProgress = 80;
    }
    milestone.updatedAt = Date.now();
  }
  for (const task of amy.tasks) {
    if (/esperar revisión final/i.test(task.title)) {
      task.completed = true;
      task.completedAt = task.completedAt || Date.now();
    }
  }
  upsertTask(amy, userId, "Subir 6 propiedades nuevas a la web", {
    completed: false,
    priority: "high",
    estimatedMinutes: 90,
    milestone: amy.milestones?.at(-1)?.title || "Cierre",
  });

  const nexus = findProject(workspace, "nexus");
  for (const milestone of nexus.milestones || []) {
    if (/Sistema visual y navegación/i.test(milestone.title)) {
      milestone.progress = 100;
      milestone.baselineProgress = 100;
    }
    if (/Firebase y persistencia/i.test(milestone.title)) {
      milestone.progress = 100;
      milestone.baselineProgress = 100;
    }
    if (/Datos y automatización/i.test(milestone.title)) {
      milestone.progress = 70;
      milestone.baselineProgress = 70;
    }
    if (/IA e integraciones/i.test(milestone.title)) {
      milestone.progress = 30;
      milestone.baselineProgress = 30;
    }
    milestone.updatedAt = Date.now();
  }
  upsertTask(nexus, userId, "Validar cuenta multiusuario con Oliver", {
    completed: false,
    priority: "high",
    estimatedMinutes: 45,
    milestone: nexus.milestones?.at(-1)?.title || "IA e integraciones",
  });
  upsertTask(nexus, userId, "Operar Finanzas desde el corte real 29/09/2026", {
    completed: true,
    priority: "high",
    estimatedMinutes: 45,
    milestone: "Datos y automatización",
  });

  // Financial reset: previous mock / partial history is deliberately discarded.
  workspace.incomes = [];
  workspace.expenses = [];
  workspace.financialGoals = [];

  const income = (projectId, title, amount, metadata = {}) => ({
    ...nowEntity(userId, {
      cutoverHistorical: true,
      ...metadata,
    }),
    title,
    amount,
    currency: "USD",
    date: CUTOVER_DATE,
    projectId,
    category: "Cobrado antes del corte",
  });

  workspace.incomes.push(
    income(
      "amy-blandon",
      "Cobrado acumulado confirmado · Amy Blandón",
      460,
      { breakdown: "300+150+10" },
    ),
    income(
      "drg-web",
      "Cobrado acumulado confirmado · Diamantes Realty Group",
      200,
    ),
    income(
      "dolce",
      "Cobrado acumulado confirmado · DOLCE",
      30,
    ),
  );

  const amyProject = findProject(workspace, "amy-blandon");
  amyProject.value = 460;
  amyProject.paid = 460;
  amyProject.metadata = {
    ...(amyProject.metadata || {}),
    receivableUSD: 0,
  };

  const drg = findProject(workspace, "drg-web");
  drg.value = 2000;
  drg.paid = 200;
  drg.metadata = {
    ...(drg.metadata || {}),
    receivableUSD: 1800,
    overdueUSD: 400,
  };

  const criscasa = findProject(workspace, "criscasa");
  criscasa.metadata = {
    ...(criscasa.metadata || {}),
    receivableUSD: 50,
    receivableStatus: "pending-confirmed",
  };

  const pequenos = findProject(workspace, "pequenos-escritores");
  pequenos.metadata = {
    ...(pequenos.metadata || {}),
    receivableStatus: "pending-amount-unknown",
  };

  // Preserve a factual cutover note for NEXUS AI without inventing old expenses.
  const cutoverMemory =
    "Corte financiero 29/09/2026: efectivo disponible C$2,500 y tarjeta/banco US$103. " +
    "Los gastos anteriores al corte no se reconstruyen porque no existe desglose confiable. " +
    "Cobros acumulados confirmados registrados al corte: Amy US$460, DRG US$200 y DOLCE US$30. " +
    "Pendientes confirmados: DRG US$1,800 contractual (US$400 reportados como atrasados) y CRISCASA US$50. " +
    "Pequeños Escritores tiene cobro pendiente con monto aún no confirmado.";

  if (
    !workspace.memories.some((item) =>
      item.content?.includes("Corte financiero 29/09/2026"),
    )
  ) {
    workspace.memories.push({
      ...nowEntity(userId, { realDataCutover: CUTOVER_DATE }),
      content: cutoverMemory,
      projectIds: [],
    });
  }

  workspace.activity.unshift({
    ...nowEntity(userId, { realDataCutover: CUTOVER_DATE }),
    kind: "finance-cutover",
    title:
      "NEXUS pasó a datos reales desde el 29/09/2026; histórico financiero no confiable fue reemplazado por saldos y cobros confirmados.",
  });

  return workspace;
}

async function getUsers() {
  let pageToken;
  const users = [];
  do {
    const result = await auth.listUsers(1000, pageToken);
    users.push(...result.users);
    pageToken = result.pageToken;
  } while (pageToken);
  return users;
}

async function listUsers() {
  const users = await getUsers();
  console.table(
    users.map((user, index) => ({
      option: index + 1,
      email: user.email || "",
      displayName: user.displayName || "",
      uid: user.uid,
    })),
  );
  return users;
}

async function resolveUser() {
  if (typeof args.uid === "string") return auth.getUser(args.uid);
  if (typeof args.email === "string") return auth.getUserByEmail(args.email);

  const users = await listUsers();
  if (!users.length) throw new Error("No hay usuarios en Firebase Auth.");

  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  const answer = await rl.question(
    "\nEscribe el número de TU cuenta principal de NEXUS y presiona Enter: ",
  );
  rl.close();

  const index = Number(answer) - 1;
  if (!Number.isInteger(index) || index < 0 || index >= users.length)
    throw new Error("Selección inválida. No se modificó ninguna cuenta.");

  const selected = users[index];
  console.log(
    "\nSeleccionaste:",
    selected.email || "(sin correo)",
    selected.uid,
  );
  return selected;
}

if (args["list-users"]) {
  await listUsers();
  process.exit(0);
}

const user = await resolveUser();
const ref = db.collection("users").doc(user.uid);
const snapshot = await ref.get();
if (!snapshot.exists)
  throw new Error(
    "La cuenta existe en Firebase Auth, pero todavía no tiene workspace en Firestore.",
  );

const docData = snapshot.data();
const original = docData?.workspace;
if (!original || !Array.isArray(original.projects))
  throw new Error("El documento no contiene un workspace NEXUS válido.");

const prepared = prepareWorkspace(original, user);
const backupName =
  "nexus-owner-backup-" +
  user.uid +
  "-" +
  new Date().toISOString().replace(/[:.]/g, "-") +
  ".json";
writeFileSync(
  backupName,
  JSON.stringify(
    {
      uid: user.uid,
      email: user.email || "",
      backedUpAt: new Date().toISOString(),
      document: docData,
    },
    null,
    2,
  ),
);

const active = prepared.projects.filter((p) => p.status === "active");
const summary = prepared.projects.map((project) => ({
  project: project.name,
  progress: project.progress + "%",
  status: project.status,
  hours: project.hours,
  paidUSD: prepared.incomes
    .filter((item) => item.projectId === project.id)
    .reduce((sum, item) => sum + item.amount, 0),
  receivableUSD:
    typeof project.metadata?.receivableUSD === "number"
      ? project.metadata.receivableUSD
      : project.value
        ? Math.max(
            0,
            project.value -
              prepared.incomes
                .filter((item) => item.projectId === project.id)
                .reduce((sum, item) => sum + item.amount, 0),
          )
        : "",
  overdueUSD:
    typeof project.metadata?.overdueUSD === "number"
      ? project.metadata.overdueUSD
      : "",
}));

console.log("\nCuenta seleccionada:");
console.log(user.email || "(sin correo)", user.uid);
console.log("\nBackup local creado:", backupName);
console.log("\nVista previa:");
console.table(summary);
console.log(
  "\nLiquidez al corte: C$2,500 efectivo | US$103 tarjeta/banco",
);
console.log(
  "Proyectos activos:",
  active.map((project) => project.name).join(", "),
);
console.log(
  "Horas: únicamente sesiones Flow realmente registradas. No se inventaron horas históricas.",
);
console.log(
  "Gastos anteriores: eliminados del registro operativo; no se reconstruyeron sin importes confirmados.",
);

if (!args.apply) {
  console.log(
    "\nDRY RUN: no se modificó Firestore. Repite el comando con --apply cuando la vista previa sea correcta.",
  );
  process.exit(0);
}

await ref.set(
  {
    ...docData,
    workspace: prepared,
    schemaVersion: prepared.schemaVersion,
    updatedAt: Date.now(),
    realDataCutoverAt: CUTOVER_DATE,
  },
  { merge: false },
);

console.log("\nAPLICADO: workspace actualizado únicamente para", user.email || user.uid);
console.log("Los demás usuarios y el onboarding vacío no fueron modificados.");
