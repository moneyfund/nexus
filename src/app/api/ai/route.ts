import { NextResponse } from "next/server";

export const runtime = "nodejs";

const FIREBASE_API_KEY = "AIzaSyBJpy4DFBSaD4d4weknjHxfxwn_uMY5mS4";
const DEFAULT_MODEL = "gpt-5.6-terra";

async function verifyFirebaseToken(token: string) {
  const response = await fetch(
    "https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=" +
      FIREBASE_API_KEY,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken: token }),
      cache: "no-store",
    },
  );

  if (!response.ok) return null;
  const body = (await response.json()) as {
    users?: Array<{ localId?: string; email?: string }>;
  };
  return body.users?.[0] ?? null;
}

function extractBearer(request: Request) {
  const header = request.headers.get("authorization") ?? "";
  return header.startsWith("Bearer ") ? header.slice(7).trim() : "";
}

export async function GET() {
  return NextResponse.json({
    configured: Boolean(process.env.OPENAI_API_KEY),
    model: process.env.OPENAI_MODEL || DEFAULT_MODEL,
  });
}

export async function POST(request: Request) {
  const bearer = extractBearer(request);
  if (!bearer)
    return NextResponse.json(
      { error: "Sesión Firebase requerida." },
      { status: 401 },
    );

  const user = await verifyFirebaseToken(bearer);
  if (!user?.localId)
    return NextResponse.json(
      { error: "La sesión Firebase no es válida." },
      { status: 401 },
    );

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey)
    return NextResponse.json(
      {
        code: "OPENAI_NOT_CONFIGURED",
        error:
          "NEXUS AI está preparado, pero falta OPENAI_API_KEY en las variables de entorno de Vercel.",
      },
      { status: 503 },
    );

  let body: { prompt?: unknown; context?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });
  }

  const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
  if (!prompt || prompt.length > 6000)
    return NextResponse.json(
      { error: "Escribe una consulta de hasta 6000 caracteres." },
      { status: 400 },
    );

  const context = body.context ?? {};
  const model = process.env.OPENAI_MODEL || DEFAULT_MODEL;

  const schema = {
    type: "object",
    properties: {
      answer: { type: "string" },
      actions: {
        type: "array",
        maxItems: 8,
        items: {
          type: "object",
          properties: {
            type: {
              type: "string",
              enum: [
                "complete_task",
                "create_task",
                "record_income",
                "record_expense",
                "update_project_status",
                "update_project_value",
                "none",
              ],
            },
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

  const openAIResponse = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      store: false,
      reasoning: { effort: "low" },
      max_output_tokens: 1800,
      instructions:
        "Eres NEXUS, asistente operativo personal. Responde en español claro y conciso. " +
        "Usa exclusivamente el contexto suministrado para IDs, proyectos, tareas y datos financieros. " +
        "No afirmes que modificaste datos: cualquier cambio debe ir como acción propuesta para confirmación humana. " +
        "Si el usuario reporta una tarea terminada y existe una coincidencia razonable, propón complete_task. " +
        "Si reporta un pago o gasto con importe, propón record_income o record_expense. " +
        "Si pide crear una tarea, propón create_task. No inventes importes, fechas ni IDs. " +
        "Si no hay suficiente información para una acción segura, explica qué falta y devuelve actions vacío.",
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
          schema,
        },
      },
    }),
    cache: "no-store",
  });

  const payload = (await openAIResponse.json()) as {
    output_text?: string;
    error?: { message?: string };
    usage?: { input_tokens?: number; output_tokens?: number };
  };

  if (!openAIResponse.ok) {
    return NextResponse.json(
      {
        error:
          payload.error?.message ??
          "OpenAI rechazó la solicitud de NEXUS AI.",
      },
      { status: openAIResponse.status },
    );
  }

  let result: unknown;
  try {
    result = JSON.parse(payload.output_text ?? "");
  } catch {
    return NextResponse.json(
      { error: "La IA devolvió una respuesta que NEXUS no pudo interpretar." },
      { status: 502 },
    );
  }

  return NextResponse.json({
    result,
    model,
    usage: {
      inputTokens: payload.usage?.input_tokens ?? 0,
      outputTokens: payload.usage?.output_tokens ?? 0,
    },
  });
}
