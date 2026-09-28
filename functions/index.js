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
const DEFAULT_MODEL = "gpt-5.6-terra";

const ACTION_TYPES = [
  "complete_task",
  "create_task",
  "record_income",
  "record_expense",
  "update_project_status",
  "update_project_value",
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
          projectId: { type: ["string", "null"] },
          taskId: { type: ["string", "null"] },
          title: { type: ["string", "null"] },
          milestone: { type: ["string", "null"] },
          amount: { type: ["number", "null"] },
          value: { type: ["number", "null"] },
          status: {
            type: ["string", "null"],
            enum: ["active", "waiting", "backlog", "completed", null],
          },
          reason: { type: "string" },
        },
        required: [
          "type",
          "projectId",
          "taskId",
          "title",
          "milestone",
          "amount",
          "value",
          "status",
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
    "gpt-5.6-sol": { input: 4, output: 20 },
    "gpt-5.6": { input: 4, output: 20 },
    "gpt-5.6-terra": { input: 2, output: 12 },
    "gpt-5.6-luna": { input: 0.2, output: 1.2 },
  };
  const price = pricing[model] || pricing[DEFAULT_MODEL];
  return (
    ((usage.inputTokens || 0) * price.input +
      (usage.outputTokens || 0) * price.output) /
    1_000_000
  );
}

async function enforceSoftRateLimit(uid) {
  const db = getFirestore();
  const now = Date.now();
  const hour = new Date(now).toISOString().slice(0, 13);
  const ref = db.collection("nexus_ai_limits").doc(uid + ":" + hour);

  await db.runTransaction(async (tx) => {
    const snapshot = await tx.get(ref);
    const count = Number(snapshot.data()?.count || 0);
    if (count >= 60) {
      throw new HttpsError(
        "resource-exhausted",
        "Has alcanzado el límite temporal de NEXUS AI. Inténtalo nuevamente en unos minutos.",
      );
    }
    tx.set(
      ref,
      {
        uid,
        hour,
        count: count + 1,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
  });
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

    return {
      configured: Boolean(OPENAI_API_KEY.value()),
      model: DEFAULT_MODEL,
      provider: "openai",
      mode: "realtime-context",
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
    await enforceSoftRateLimit(request.auth.uid);

    const model =
      request.data?.model === "gpt-5.6-sol" ||
      request.data?.model === "gpt-5.6-luna" ||
      request.data?.model === "gpt-5.6-terra"
        ? request.data.model
        : DEFAULT_MODEL;

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
        reasoning: { effort: model === "gpt-5.6-luna" ? "low" : "medium" },
        max_output_tokens: 2400,
        instructions:
          "Eres NEXUS AI, el núcleo inteligente de un sistema operativo personal. " +
          "Habla en español claro, natural y directo salvo que el usuario pida otro idioma. " +
          "Puedes razonar con conocimiento general, pero toda afirmación sobre los proyectos, dinero, agenda, documentos, recuerdos o tareas personales del usuario debe estar respaldada por el CONTEXTO NEXUS recibido. " +
          "Nunca inventes importes, pagos, fechas, IDs, tareas o estados. Si falta un dato personal, dilo. " +
          "Cuando el usuario solo pide análisis, explicación, priorización o una respuesta, responde sin proponer cambios innecesarios. " +
          "Cuando el usuario expresa intención de cambiar NEXUS, devuelve la modificación como una acción propuesta; nunca digas que ya la ejecutaste. " +
          "Usa complete_task si confirma que una tarea existente terminó. Usa create_task si pide crear una tarea. " +
          "Usa record_income o record_expense únicamente si existe un importe explícito o inequívoco. " +
          "Usa update_project_status o update_project_value solo cuando el proyecto y el nuevo valor/estado sean claros. " +
          "Si hay ambigüedad entre proyectos o tareas, pregunta antes de proponer la acción. " +
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

    return {
      result,
      model,
      provider: "openai",
      usage,
      costUSD: estimateCost(model, usage),
    };
  },
);
