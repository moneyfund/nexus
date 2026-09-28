"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Mic, MicOff, Orbit, X } from "lucide-react";
import { useNexus } from "./nexus-provider";

interface SpeechRecognitionEventLike extends Event {
  results: ArrayLike<{
    isFinal: boolean;
    0: { transcript: string };
  }>;
}

interface SpeechRecognitionErrorEventLike extends Event {
  error: string;
}

interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
}

type RecognitionConstructor = new () => SpeechRecognitionLike;

declare global {
  interface Window {
    SpeechRecognition?: RecognitionConstructor;
    webkitSpeechRecognition?: RecognitionConstructor;
  }
}

function recognitionConstructor() {
  if (typeof window === "undefined") return undefined;
  return window.SpeechRecognition ?? window.webkitSpeechRecognition;
}

/**
 * Mobile-first push-to-talk entry point.
 *
 * This intentionally uses the browser speech-recognition layer as the first
 * zero-infrastructure capture path. The transcript is handed to NEXUS AI,
 * which remains the only component allowed to interpret/execute actions.
 * Realtime voice can replace this transport later without changing the UX.
 */
export function NexusVoiceOrb() {
  const n = useNexus();
  const router = useRouter();
  const pathname = usePathname();
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const transcriptRef = useRef("");
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [transcript, setTranscript] = useState("");

  useEffect(() => {
    setSupported(!!recognitionConstructor());
    return () => recognitionRef.current?.abort();
  }, []);

  function finish(value: string) {
    const clean = value.trim();
    setListening(false);
    recognitionRef.current = null;
    if (!clean) return;

    setTranscript(clean);
    const params = new URLSearchParams({
      q: clean,
      source: "voice",
      send: "1",
    });
    router.push("/ai?" + params.toString());
  }

  function startListening() {
    const Recognition = recognitionConstructor();
    if (!Recognition) {
      n.notify(
        "Este navegador no ofrece dictado web. Puedes escribirle a NEXUS AI o usar Chrome/Edge compatible.",
        true,
      );
      setExpanded(true);
      return;
    }

    recognitionRef.current?.abort();
    transcriptRef.current = "";
    setTranscript("");
    setExpanded(true);

    const recognition = new Recognition();
    recognition.lang = "es-NI";
    recognition.interimResults = true;
    recognition.continuous = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => setListening(true);
    recognition.onresult = (event) => {
      let complete = "";
      let interim = "";
      for (let i = 0; i < event.results.length; i += 1) {
        const result = event.results[i];
        const value = result?.[0]?.transcript ?? "";
        if (result?.isFinal) complete += value;
        else interim += value;
      }
      if (complete) transcriptRef.current += " " + complete;
      setTranscript((transcriptRef.current + " " + interim).trim());
    };
    recognition.onerror = (event) => {
      setListening(false);
      recognitionRef.current = null;
      if (event.error === "not-allowed") {
        n.notify("Activa el permiso del micrófono para hablar con NEXUS.", true);
      } else if (event.error !== "no-speech") {
        n.notify("No pude escuchar con claridad. Inténtalo de nuevo.", true);
      }
    };
    recognition.onend = () => {
      const value = transcriptRef.current || transcript;
      setListening(false);
      recognitionRef.current = null;
      if (value.trim()) finish(value);
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
    } catch {
      n.notify("El micrófono ya está iniciándose.", true);
    }
  }

  function stopListening() {
    recognitionRef.current?.stop();
  }

  // The full AI page already has its own composer; keep the orb less intrusive.
  const compact = pathname.startsWith("/ai");

  if (!n.session) return null;

  return (
    <div className={"nexus-voice-dock " + (compact ? "compact" : "")}>
      {expanded && (
        <div className="nexus-voice-panel" role="status" aria-live="polite">
          <div className="nexus-voice-panel-head">
            <span>
              <Orbit size={14} />
              NEXUS VOICE
            </span>
            <button
              type="button"
              aria-label="Cerrar Nexus Voice"
              onClick={() => {
                recognitionRef.current?.abort();
                setListening(false);
                setExpanded(false);
              }}
            >
              <X size={15} />
            </button>
          </div>
          <strong>
            {listening
              ? "Te escucho…"
              : transcript
                ? transcript
                : supported
                  ? "Pulsa para hablar"
                  : "Dictado no disponible"}
          </strong>
          <small>
            {listening
              ? "Habla natural. Al terminar, enviaré la frase a NEXUS AI."
              : "Las acciones sensibles siguen requiriendo tu confirmación."}
          </small>
        </div>
      )}

      <button
        type="button"
        className={"nexus-voice-orb " + (listening ? "listening" : "")}
        aria-label={listening ? "Detener escucha" : "Hablar con NEXUS"}
        aria-pressed={listening}
        onClick={() => (listening ? stopListening() : startListening())}
      >
        <span className="voice-orb-ring" aria-hidden="true" />
        {listening ? <MicOff size={21} /> : <Mic size={21} />}
      </button>
    </div>
  );
}
