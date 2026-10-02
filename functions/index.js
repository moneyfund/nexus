import { createHash } from "node:crypto";
import { initializeApp } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import { setGlobalOptions } from "firebase-functions/v2/options";

initializeApp();
setGlobalOptions({
  region: "us-east4",
  memory: "512MiB",
  timeoutSeconds: 60,
  maxInstances: 3,
});

const OPENAI_API_KEY = defineSecret("OPENAI_API_KEY");
const DEFAULT_MODEL = "gpt-6-luna";
const AI_BACKEND_REVISION = "2026-10-02-luna-actions-v3";
const AI_HOURLY_LIMIT = 30;
const AI_DAILY_LIMIT = 60;
const AI_MONTHLY_LIMIT = 600;

const ACTION_TYPES = [
  "complete_task",
  "create_project",
  "create_task",
  "update_task",
  "delete_task",
  "record_income",
  "record_expense",
  "create_debt",
  "update_debt",
  "pay_debt",
  "mark_debt_paid",
  "update_transaction",
  "delete_transaction",
  "update_project_status",
  "update_project_value",
  "update_project",
  "log_project_activity",
  "create_event",
  "update_event",
  "delete_event",
  "create_idea",
  "update_idea",
  "delete_idea",
  "add_memory",
  "update_memory",
  "delete_memory",
  "device_open_app",
  "device_set_volume",
  "device_adjust_volume",
  "device_toggle_mute",
  "device_take_screenshot",
  "device_lock",
  "none",
];

const responseSchema = {
  type: "object",
  properties: {
    answer: { type: "string" },
    actions: {
      type: "array",
      maxItems: 8,
      items: {
        type: "object",
        properties: {
          type: { type: "string", enum: ACTION_TYPES },
          targetId: { type: ["string", "null"] },
          projectId: { type: ["string", "null"] },
          taskId: { type: ["string", "null"] },
          transactionKind: {
            type: ["string", "null"],
            enum: ["income", "expense", null],
          },
          currency: {
            type: ["string", "null"],
            enum: ["USD", "NIO", null],
          },
          accountId: { type: ["string", "null"] },
          debtId: { type: ["string", "null"] },
          creditor: { type: ["string", "null"] },
          title: { type: ["string", "null"] },
          milestone: { type: ["string", "null"] },
          amount: { type: ["number", "null"] },
          balance: { type: ["number", "null"] },
          value: { type: ["number", "null"] },
          status: {
            type: ["string", "null"],
            enum: ["active", "waiting", "backlog", "completed", null],
          },
          priority: {
            type: ["string", "null"],
            enum: ["critical", "high", "medium", "low", null],
          },
          estimatedMinutes: { type: ["number", "null"] },
          date: { type: ["string", "null"] },
          dueDate: { type: ["string", "null"] },
          start: { type: ["string", "null"] },
          end: { type: ["string", "null"] },
          category: {
            type: ["string", "null"],
            enum: [
              "focus",
              "meeting",
              "admin",
              "client",
              "university",
              "personal",
              "deadline",
              null
            ],
          },
          itemCategory: { type: ["string", "null"] },
          description: { type: ["string", "null"] },
          content: { type: ["string", "null"] },
          notes: { type: ["string", "null"] },
          area: { type: ["string", "null"] },
          client: { type: ["string", "null"] },
          deviceApp: {
            type: ["string", "null"],
            enum: ["notepad", "calculator", "files", "settings", null],
          },
          deviceValue: { type: ["number", "null"] },
          reason: { type: "string" },
        },
        required: [
          "type",
          "targetId",
          "projectId",
          "taskId",
          "transactionKind",
          "currency",
          "accountId",
          "debtId",
          "creditor",
          "title",
          "milestone",
          "amount",
          "balance",
          "value",
          "status",
          "priority",
          "estimatedMinutes",
          "date",
          "dueDate",
          "start",
          "end",
          "category",
          "itemCategory",
          "description",
          "content",
          "notes",
          "area",
          "client",
          "deviceApp",
          "deviceValue",
          "reason",
        ],
        additionalProperties: false,
      },
    },
  },
  required: ["answer", "actions"],
  additionalProperties: false,
};

function safetyIdentifier(uid) {
  return createHash("sha256").update("nexus:" + uid).digest("hex");
}

function estimateCost(model, usage) {
  const pricing = {
    "gpt-6-astra": { input: 10, output: 50 },
    "gpt-6-sol": { input: 2, output: 10 },
    "gpt-6-luna": { input: 0.1, output: 0.5 },
  };
  const price = pricing[model] || pricing[DEFAULT_MODEL];
  return (
    ((usage.inputTokens || 0) * price.input +
      (usage.outputTokens || 0) * price.output) /
    1_000_000
  );
}

function quotaKeys() {
  const iso = new Date().toISOString();
  return {
    hour: iso.slice(0, 13),
    day: iso.slice(0, 10),
    month: iso.slice(0, 7),
  };
}

async function getAiQuota(uid) {
  const db = getFirestore();
  const { day, month } = quotaKeys();
  const [daily, monthly] = await Promise.all([
    db.collection("nexus_ai_quota_daily").doc(uid + ":" + day).get(),
    db.collection("nexus_ai_quota_monthly").doc(uid + ":" + month).get(),
  ]);
  return {
    dailyUsed: Number(daily.data()?.requests || 0),
    dailyLimit: AI_DAILY_LIMIT,
    monthlyUsed: Number(monthly.data()?.requests || 0),
    monthlyLimit: AI_MONTHLY_LIMIT,
    monthCostUSD: Number(monthly.data()?.costMicrosUsd || 0) / 1_000_000,
  };
}

async function reserveAiRequest(uid) {
  const db = getFirestore();
  const { hour, day, month } = quotaKeys();
  const hourlyRef = db.collection("nexus_ai_limits").doc(uid + ":" + hour);
  const dailyRef = db.collection("nexus_ai_quota_daily").doc(uid + ":" + day);
  const monthlyRef = db
    .collection("nexus_ai_quota_monthly")
    .doc(uid + ":" + month);

  await db.runTransaction(async (tx) => {
    const [hourly, daily, monthly] = await Promise.all([
      tx.get(hourlyRef),
      tx.get(dailyRef),
      tx.get(monthlyRef),
    ]);

    const hourlyCount = Number(hourly.data()?.count || 0);
    const dailyCount = Number(daily.data()?.requests || 0);
    const monthlyCount = Number(monthly.data()?.requests || 0);

    if (hourlyCount >= AI_HOURLY_LIMIT)
      throw new HttpsError(
        "resource-exhausted",
        "Has alcanzado el límite horario de NEXUS AI. Inténtalo más tarde.",
      );
    if (dailyCount >= AI_DAILY_LIMIT)
      throw new HttpsError(
        "resource-exhausted",
        "Has alcanzado el límite beta de " +
          AI_DAILY_LIMIT +
          " consultas diarias de NEXUS AI.",
      );
    if (monthlyCount >= AI_MONTHLY_LIMIT)
      throw new HttpsError(
        "resource-exhausted",
        "Has alcanzado el límite beta mensual de NEXUS AI.",
      );

    const now = FieldValue.serverTimestamp();
    tx.set(
      hourlyRef,
      { uid, hour, count: hourlyCount + 1, updatedAt: now },
      { merge: true },
    );
    tx.set(
      dailyRef,
      {
        uid,
        day,
        requests: dailyCount + 1,
        updatedAt: now,
      },
      { merge: true },
    );
    tx.set(
      monthlyRef,
      {
        uid,
        month,
        requests: monthlyCount + 1,
        updatedAt: now,
      },
      { merge: true },
    );
  });
}

async function recordAiUsage(uid, model, usage, costUSD) {
  const db = getFirestore();
  const { day, month } = quotaKeys();
  const dailyRef = db.collection("nexus_ai_quota_daily").doc(uid + ":" + day);
  const monthlyRef = db
    .collection("nexus_ai_quota_monthly")
    .doc(uid + ":" + month);
  const costMicrosUsd = Math.round(costUSD * 1_000_000);

  await Promise.all([
    dailyRef.set(
      {
        inputTokens: FieldValue.increment(usage.inputTokens || 0),
        outputTokens: FieldValue.increment(usage.outputTokens || 0),
        costMicrosUsd: FieldValue.increment(costMicrosUsd),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    ),
    monthlyRef.set(
      {
        inputTokens: FieldValue.increment(usage.inputTokens || 0),
        outputTokens: FieldValue.increment(usage.outputTokens || 0),
        costMicrosUsd: FieldValue.increment(costMicrosUsd),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    ),
    db.collection("nexus_ai_usage_events").add({
      uid,
      model,
      inputTokens: usage.inputTokens || 0,
      outputTokens: usage.outputTokens || 0,
      costMicrosUsd,
      createdAt: FieldValue.serverTimestamp(),
    }),
  ]);
}

function normalizeContext(value) {
  if (!value || typeof value !== "object") return {};
  const serialized = JSON.stringify(value);
  if (serialized.length > 180_000) {
    throw new HttpsError(
      "invalid-argument",
      "El contexto enviado a NEXUS AI es demasiado grande.",
    );
  }
  return value;
}

export const nexusAIStatus = onCall(
  { secrets: [OPENAI_API_KEY] },
  async (request) => {
    if (!request.auth)
      throw new HttpsError("unauthenticated", "Inicia sesión en NEXUS.");

    const quota = await getAiQuota(request.auth.uid);
    return {
      configured: Boolean(OPENAI_API_KEY.value()),
      model: DEFAULT_MODEL,
      provider: "openai",
      mode: "realtime-context",
      backendRevision: AI_BACKEND_REVISION,
      quota,
    };
  },
);

export const nexusAI = onCall(
  { secrets: [OPENAI_API_KEY] },
  async (request) => {
    if (!request.auth)
      throw new HttpsError("unauthenticated", "Inicia sesión en NEXUS.");

    const apiKey = OPENAI_API_KEY.value();
    if (!apiKey)
      throw new HttpsError(
        "failed-precondition",
        "OPENAI_API_KEY todavía no está configurada.",
      );

    const prompt =
      typeof request.data?.prompt === "string"
        ? request.data.prompt.trim()
        : "";
    if (!prompt || prompt.length > 8000)
      throw new HttpsError(
        "invalid-argument",
        "Escribe una consulta de hasta 8000 caracteres.",
      );

    const context = normalizeContext(request.data?.context);
    await reserveAiRequest(request.auth.uid);

    // Beta accounts are intentionally pinned to Luna so one user cannot
    // escalate model cost by crafting a callable request manually.
    const model = DEFAULT_MODEL;

    const openAIResponse = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: "Bearer " + apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        store: false,
        safety_identifier: safetyIdentifier(request.auth.uid),
        reasoning: { effort: model === "gpt-6-luna" ? "low" : "medium" },
        max_output_tokens: 2400,
        instructions:
          "Eres NEXUS AI, el núcleo inteligente y operativo de un sistema personal. " +
          "Habla en español claro, natural y directo salvo que el usuario pida otro idioma. " +
          "Puedes razonar con conocimiento general, pero toda afirmación sobre proyectos, dinero, agenda, documentos, ideas, recuerdos o tareas personales debe estar respaldada por el CONTEXTO NEXUS recibido. " +
          "Nunca inventes importes, fechas, IDs, pagos, registros, tareas o estados. Si falta un dato personal, dilo. " +
          "Cuando el usuario solo pide análisis, explicación, priorización o una respuesta, responde sin proponer cambios innecesarios. " +
          "Cuando el usuario expresa intención de cambiar NEXUS, devuelve la modificación como una acción propuesta; nunca digas que ya la ejecutaste. " +
          "Para editar o eliminar un registro existente debes usar exactamente su ID del contexto. En tareas usa taskId junto con projectId; en movimientos, eventos, ideas y memorias usa targetId. Si no puedes identificar un único registro, pregunta antes de proponer la acción. " +
          "Usa create_project cuando el usuario pida crear un proyecto nuevo; title es obligatorio y puedes usar description, area, client, priority, dueDate, value y status si fueron dados o se pueden inferir sin ambigüedad. " +
          "Usa complete_task para terminar una tarea existente; update_task para editar título, prioridad, duración o hito; delete_task solo si el usuario pide eliminarla claramente. " +
          "Usa record_income o record_expense para movimientos nuevos. Para corregir un movimiento existente usa update_transaction con targetId y transactionKind; para eliminarlo usa delete_transaction. Si el usuario pide asociar, mover o descontar un movimiento existente desde una cuenta concreta, update_transaction debe incluir accountId. Esa reasignación ajustará el saldo de la cuenta automáticamente y no debes crear un segundo gasto duplicado. " +
          "En movimientos financieros usa amount para importe, currency para USD o NIO, accountId cuando el usuario indique de qué cuenta sale o entra el dinero, date en formato YYYY-MM-DD, itemCategory para categoría y projectId para asociación. Nunca conviertas el importe si el usuario ya dio una moneda explícita. " +
          "financialAccounts contiene IDs exactos, nombres, tipo, moneda y saldo. Si el usuario dice 'efectivo', 'tarjeta', 'banco', 'wallet' o el nombre de una cuenta, resuelve una única cuenta compatible y devuelve su accountId. Si el usuario no especifica moneda pero sí una cuenta única, usa la moneda de esa cuenta; no hagas conversiones. Si 'digital' coincide con más de una cuenta no-cash, pregunta cuál. No inventes cuentas ni IDs. " +
          "Para record_expense y record_income, si el usuario indica una cuenta concreta debes incluir accountId para que NEXUS actualice automáticamente su saldo. Si describe un gasto real pero no indica cuenta y no puede deducirse una única cuenta, pregunta de cuál salió el dinero antes de proponer la acción. " +
          "Usa create_debt cuando el usuario pida registrar una obligación nueva: amount es el importe original, balance el saldo pendiente si difiere, creditor el acreedor, title el concepto, currency la moneda, dueDate el vencimiento, notes las notas y projectId la relación con un proyecto cuando corresponda. " +
          "Usa update_debt para corregir una deuda existente usando debtId exacto; amount cambia el importe original y balance cambia el saldo pendiente. " +
          "Usa pay_debt para pagos parciales de una deuda existente: usa debtId exacto, amount y accountId cuando el usuario indique o se identifique una única cuenta compatible. Esta acción descuenta la cuenta y registra el gasto. " +
          "Usa mark_debt_paid cuando el usuario pida liquidar o marcar completamente pagada una deuda. Si indica una cuenta, incluye accountId: NEXUS descontará todo el saldo pendiente de esa cuenta y registrará el gasto. Si se trata de un pago real y no indica la cuenta, pregunta cuál debe cargarse. Solo deja accountId null cuando el usuario diga explícitamente que es una conciliación externa o que no debe afectar sus saldos. Nunca marques una deuda como pagada sin confirmación explícita. " +
          "Interpreta hoy/ayer usando now y timezone. " +
          "Cuando el usuario diga cosas como 'el gasto de ayer', compara fecha, título, importe, proyecto y categoría de transactions; si hay más de un candidato razonable, pregunta cuál. " +
          "Usa update_project para nombre, descripción, notas, prioridad, fecha, área o cliente; update_project_status y update_project_value para esos campos específicos. " +
          "Si el usuario cuenta un avance realizado en un proyecto pero no corresponde claramente a una tarea existente, usa log_project_activity para conservarlo en el historial y notas del proyecto. " +
          "Usa create_event, update_event o delete_event para agenda. Interpreta fechas relativas usando now y timezone del contexto y devuelve timestamps ISO en start/end. Los eventos confirmados por el usuario se sincronizan con Google Calendar cuando la integración está conectada. " +
          "knowledge puede contener texto indexado desde Google Drive. Úsalo como contexto documental cuando sea relevante y distingue el contenido disponible de cualquier detalle que no aparezca en el contexto. " +
          "Usa create_idea, update_idea o delete_idea para ideas; itemCategory representa la categoría de la idea y dueDate puede representar su fecha de revisión. Usa add_memory, update_memory o delete_memory solo para contexto estable que el usuario quiera conservar. " +
          "Si context.device.connected es true, puedes proponer herramientas del dispositivo cuando el usuario las pida explícitamente: device_open_app abre solo notepad, calculator, files o settings; nunca terminal. device_set_volume usa deviceValue entre 0 y 100. device_adjust_volume usa deviceValue positivo o negativo. device_toggle_mute alterna silencio. device_take_screenshot guarda una captura local y device_lock bloquea Windows. Todas estas acciones requieren confirmación del usuario en la interfaz y no debes fingir que ya se ejecutaron. Si context.device.connected es false o no existe, explica que hace falta NEXUS Companion Desktop y no propongas la acción. " +
          "Las acciones destructivas delete_* requieren intención explícita del usuario; nunca las infieras de frases ambiguas. " +
          "Los campos que no cambian deben devolverse como null. " +
          "Si hay ambigüedad entre proyectos, tareas, movimientos, eventos, ideas, memorias, fechas u horarios, pregunta antes de proponer la acción. " +
          "Prioriza respuestas útiles y concretas. No repitas todo el contexto.",
        input:
          "CONTEXTO NEXUS DEL USUARIO:\n" +
          JSON.stringify(context) +
          "\n\nMENSAJE DEL USUARIO:\n" +
          prompt,
        text: {
          format: {
            type: "json_schema",
            name: "nexus_operational_response",
            strict: true,
            schema: responseSchema,
          },
        },
      }),
    });

    const payload = await openAIResponse.json();
    if (!openAIResponse.ok) {
      throw new HttpsError(
        "internal",
        payload?.error?.message || "OpenAI rechazó la solicitud de NEXUS AI.",
      );
    }

    const outputText =
      payload.output_text ||
      (payload.output || [])
        .flatMap((item) => item.content || [])
        .filter((item) => item.type === "output_text")
        .map((item) => item.text || "")
        .join("");

    let result;
    try {
      result = JSON.parse(outputText);
    } catch {
      throw new HttpsError(
        "internal",
        "NEXUS AI devolvió una respuesta que no se pudo interpretar.",
      );
    }

    const usage = {
      inputTokens: payload.usage?.input_tokens || 0,
      outputTokens: payload.usage?.output_tokens || 0,
    };

    const costUSD = estimateCost(model, usage);
    await recordAiUsage(request.auth.uid, model, usage, costUSD);

    return {
      result,
      model,
      provider: "openai",
      backendRevision: AI_BACKEND_REVISION,
      usage,
      costUSD,
      quota: await getAiQuota(request.auth.uid),
    };
  },
);
