import { firebaseClient } from "@/lib/firebase";

export interface NexusRealtimeEvent {
  type?: string;
  [key: string]: unknown;
}

export interface NexusRealtimeSessionInfo {
  model: string;
  voice: string;
}

interface EphemeralSessionResponse {
  value?: string;
  expiresAt?: number;
  model?: string;
  voice?: string;
  error?: string;
}

type EventListener = (event: NexusRealtimeEvent) => void;

/**
 * Browser WebRTC transport for the future full-duplex NEXUS Voice mode.
 *
 * The standard OpenAI project key never reaches the browser. The client first
 * obtains a short-lived token from /api/voice/session after Firebase auth, then
 * negotiates the WebRTC connection directly with the Realtime API.
 */
export class NexusRealtimeVoiceClient {
  private pc: RTCPeerConnection | null = null;
  private channel: RTCDataChannel | null = null;
  private microphone: MediaStream | null = null;
  private audio: HTMLAudioElement | null = null;
  private listeners = new Set<EventListener>();
  private sessionInfo: NexusRealtimeSessionInfo | null = null;

  get connected() {
    return this.pc?.connectionState === "connected";
  }

  get info() {
    return this.sessionInfo;
  }

  subscribe(listener: EventListener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(event: NexusRealtimeEvent) {
    for (const listener of this.listeners) listener(event);
  }

  private async createEphemeralSession() {
    const idToken = await firebaseClient.getIdToken();
    const response = await fetch("/api/voice/session", {
      method: "POST",
      headers: {
        Authorization: "Bearer " + idToken,
      },
      cache: "no-store",
    });

    const body = (await response.json()) as EphemeralSessionResponse;
    if (!response.ok || !body.value)
      throw new Error(
        body.error || "No se pudo iniciar la sesión segura de NEXUS Voice.",
      );

    return {
      key: body.value,
      expiresAt: body.expiresAt,
      model: body.model || "gpt-realtime-2.1",
      voice: body.voice || "marin",
    };
  }

  async connect() {
    if (typeof window === "undefined")
      throw new Error("NEXUS Voice solo puede iniciarse en el navegador.");

    await this.close();

    const session = await this.createEphemeralSession();
    const pc = new RTCPeerConnection();
    const audio = document.createElement("audio");
    audio.autoplay = true;
    audio.setAttribute("playsinline", "true");

    pc.ontrack = (event) => {
      audio.srcObject = event.streams[0] ?? null;
    };
    pc.onconnectionstatechange = () => {
      this.emit({
        type: "nexus.connection",
        state: pc.connectionState,
      });
    };

    const microphone = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });
    for (const track of microphone.getAudioTracks())
      pc.addTrack(track, microphone);

    const channel = pc.createDataChannel("oai-events");
    channel.onmessage = (message) => {
      try {
        this.emit(JSON.parse(String(message.data)) as NexusRealtimeEvent);
      } catch {
        this.emit({
          type: "nexus.protocol.unparsed",
          data: String(message.data),
        });
      }
    };

    const opened = new Promise<void>((resolve, reject) => {
      const timer = window.setTimeout(
        () => reject(new Error("NEXUS Voice tardó demasiado en conectar.")),
        15_000,
      );
      channel.onopen = () => {
        window.clearTimeout(timer);
        resolve();
      };
      channel.onerror = () => {
        window.clearTimeout(timer);
        reject(new Error("Falló el canal de datos de NEXUS Voice."));
      };
    });

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    const response = await fetch("https://api.openai.com/v1/realtime/calls", {
      method: "POST",
      body: offer.sdp ?? "",
      headers: {
        Authorization: "Bearer " + session.key,
        "Content-Type": "application/sdp",
      },
    });

    if (!response.ok) {
      microphone.getTracks().forEach((track) => track.stop());
      pc.close();
      throw new Error(
        "OpenAI no pudo negociar la conexión de NEXUS Voice.",
      );
    }

    const answerSdp = await response.text();
    await pc.setRemoteDescription({
      type: "answer",
      sdp: answerSdp,
    });
    await opened;

    this.pc = pc;
    this.channel = channel;
    this.microphone = microphone;
    this.audio = audio;
    this.sessionInfo = {
      model: session.model,
      voice: session.voice,
    };

    this.emit({
      type: "nexus.ready",
      model: session.model,
      voice: session.voice,
      expiresAt: session.expiresAt,
    });

    return this.sessionInfo;
  }

  send(event: NexusRealtimeEvent) {
    if (!this.channel || this.channel.readyState !== "open")
      throw new Error("NEXUS Voice todavía no está conectado.");
    this.channel.send(JSON.stringify(event));
  }

  async close() {
    const channel = this.channel;
    if (channel?.readyState === "open") {
      try {
        channel.send(JSON.stringify({ type: "session.close" }));
      } catch {
        // The peer may already be closing.
      }
    }

    this.microphone?.getTracks().forEach((track) => track.stop());
    if (this.audio) this.audio.srcObject = null;
    this.channel?.close();
    this.pc?.close();

    this.pc = null;
    this.channel = null;
    this.microphone = null;
    this.audio = null;
    this.sessionInfo = null;
  }
}
