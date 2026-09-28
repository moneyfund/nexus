import { createHash } from "node:crypto";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const FIREBASE_API_KEY = "AIzaSyBJpy4DFBSaD4d4weknjHxfxwn_uMY5mS4";
const DEFAULT_REALTIME_MODEL = "gpt-realtime-2.1";
const DEFAULT_VOICE = "marin";

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

function safetyIdentifier(uid: string) {
  return createHash("sha256")
    .update("nexus:" + uid)
    .digest("hex");
}

export async function GET() {
  return NextResponse.json({
    configured: Boolean(
      process.env.OPENAI_API_KEY && process.env.NEXUS_OWNER_UID,
    ),
    model: process.env.OPENAI_REALTIME_MODEL || DEFAULT_REALTIME_MODEL,
    voice: process.env.OPENAI_REALTIME_VOICE || DEFAULT_VOICE,
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

  const ownerUid = process.env.NEXUS_OWNER_UID;
  if (!ownerUid)
    return NextResponse.json(
      { error: "NEXUS_OWNER_UID no está configurado." },
      { status: 503 },
    );

  if (user.localId !== ownerUid)
    return NextResponse.json(
      { error: "Esta cuenta no tiene acceso a NEXUS Voice." },
      { status: 403 },
    );

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey)
    return NextResponse.json(
      { error: "OPENAI_API_KEY no está configurada." },
      { status: 503 },
    );

  const model = process.env.OPENAI_REALTIME_MODEL || DEFAULT_REALTIME_MODEL;
  const voice = process.env.OPENAI_REALTIME_VOICE || DEFAULT_VOICE;

  const response = await fetch(
    "https://api.openai.com/v1/realtime/client_secrets",
    {
      method: "POST",
      headers: {
        Authorization: "Bearer " + apiKey,
        "Content-Type": "application/json",
        "OpenAI-Safety-Identifier": safetyIdentifier(user.localId),
      },
      body: JSON.stringify({
        session: {
          type: "realtime",
          model,
          instructions:
            "Eres NEXUS Voice, la interfaz hablada del sistema NEXUS. " +
            "Responde en español claro, natural y conciso. " +
            "No afirmes que modificaste proyectos, finanzas, calendario o archivos " +
            "si la aplicación no confirmó la acción. Las acciones sensibles deben " +
            "pasar por las herramientas y confirmaciones de NEXUS.",
          audio: {
            output: {
              voice,
            },
          },
        },
      }),
      cache: "no-store",
    },
  );

  const payload = (await response.json()) as {
    value?: string;
    expires_at?: number;
    session?: unknown;
    error?: { message?: string };
  };

  if (!response.ok || !payload.value) {
    return NextResponse.json(
      {
        error:
          payload.error?.message ??
          "No se pudo crear una sesión efímera de NEXUS Voice.",
      },
      { status: response.ok ? 502 : response.status },
    );
  }

  // Only the short-lived client secret reaches the browser.
  return NextResponse.json({
    value: payload.value,
    expiresAt: payload.expires_at,
    model,
    voice,
  });
}
