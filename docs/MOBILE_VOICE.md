# NEXUS Mobile + Voice architecture

## Goal

Keep one NEXUS product across desktop, PWA, iOS and Android. All clients share
Firebase Authentication, SQL Connect/PostgreSQL, Firebase Storage and the same
NEXUS AI tool/approval model.

## Stage 1 — PWA (current branch)

The existing Next.js application remains the product shell.

Mobile priorities:
- Today
- Projects
- Finance
- NEXUS AI
- Capture
- NEXUS Voice

The mobile navigation therefore keeps Finance and AI one tap away. Capture stays
central and the new voice orb floats above the mobile navigation.

### Push-to-talk path

The first voice path uses browser speech recognition where available:

1. User taps the NEXUS Voice orb.
2. Browser requests microphone permission.
3. Speech is transcribed locally/by the browser speech service.
4. The transcript is handed to NEXUS AI.
5. NEXUS AI may answer and propose tools/actions.
6. Sensitive actions still require explicit confirmation.

This gives us a low-cost first version before turning on paid realtime audio.

## Stage 2 — Realtime speech-to-speech

The branch also contains the secure server and browser transport groundwork for
full-duplex voice.

Security model:
- Browser authenticates with Firebase.
- `/api/voice/session` verifies the Firebase ID token.
- Server mints a short-lived OpenAI Realtime client secret.
- The normal OpenAI API key never reaches the browser.
- Browser negotiates audio with WebRTC.
- Actions remain routed through NEXUS tools/approvals rather than letting the
  voice model mutate data directly.

Environment variables:
- `OPENAI_API_KEY`
- `NEXUS_OWNER_UID`
- `OPENAI_REALTIME_MODEL` (default currently configured in .env.example)
- `OPENAI_REALTIME_VOICE`

## Stage 3 — native shell

A later native/hybrid shell can add:
- deeper background notifications
- share-to-NEXUS
- native shortcuts/widgets
- camera/document scanning
- richer microphone/background lifecycle
- platform-specific wake/assistant integrations where permitted

The native apps must not fork business data or business logic. They consume the
same NEXUS backend and permissions.

## Database telemetry

PostgreSQL already has a `VoiceSession` model for durable usage/cost telemetry.
Audio itself is not stored there. The table records session metadata such as
input/output audio duration, model/provider and estimated cost.

## Safety rule

Voice is an interface, not a privileged bypass. A spoken command that would
modify finances, send something externally, delete data, or perform another
sensitive action must pass through the same confirmation/audit path as text AI.
