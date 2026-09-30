"use client";

import {
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { usePathname } from "next/navigation";
import {
  ExternalLink,
  GripHorizontal,
  Pause,
  Play,
  RadioTower,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { NEXUS_AUDIO_TRACKS } from "@/config/audio";

type YouTubeVideoData = {
  title?: string;
  author?: string;
};

type YouTubePlayerEvent = {
  target: YouTubePlayer;
  data: number;
};

type YouTubePlayer = {
  playVideo(): void;
  pauseVideo(): void;
  cueVideoById(videoId: string): void;
  loadVideoById(videoId: string): void;
  seekTo(seconds: number, allowSeekAhead?: boolean): void;
  setVolume(volume: number): void;
  mute(): void;
  unMute(): void;
  isMuted(): boolean;
  getCurrentTime(): number;
  getDuration(): number;
  getVideoData(): YouTubeVideoData;
  destroy(): void;
};

type YouTubeNamespace = {
  Player: new (
    element: HTMLElement,
    options: {
      width: number;
      height: number;
      videoId: string;
      playerVars: Record<string, string | number>;
      events: {
        onReady: (event: YouTubePlayerEvent) => void;
        onStateChange: (event: YouTubePlayerEvent) => void;
        onError: (event: YouTubePlayerEvent) => void;
      };
    },
  ) => YouTubePlayer;
  PlayerState: {
    ENDED: number;
    PLAYING: number;
    PAUSED: number;
  };
};

declare global {
  interface Window {
    YT?: YouTubeNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let youtubeApiPromise: Promise<YouTubeNamespace> | null = null;

const AUDIO_POSITION_KEY = "nexus-audio-position-v1";

function loadYouTubeApi() {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("YouTube requiere un navegador."));
  }
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (youtubeApiPromise) return youtubeApiPromise;

  youtubeApiPromise = new Promise<YouTubeNamespace>((resolve, reject) => {
    const existing = document.getElementById("nexus-youtube-iframe-api");
    const previousReady = window.onYouTubeIframeAPIReady;

    window.onYouTubeIframeAPIReady = () => {
      previousReady?.();
      if (window.YT?.Player) resolve(window.YT);
      else reject(new Error("YouTube Player API no estuvo disponible."));
    };

    if (existing) return;

    const script = document.createElement("script");
    script.id = "nexus-youtube-iframe-api";
    script.src = "https://www.youtube.com/iframe_api";
    script.async = true;
    script.onerror = () =>
      reject(new Error("No se pudo cargar YouTube Player API."));
    document.head.appendChild(script);
  });

  return youtubeApiPromise;
}

function clampIndex(index: number) {
  const total = NEXUS_AUDIO_TRACKS.length;
  return ((index % total) + total) % total;
}

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const whole = Math.floor(seconds);
  const minutes = Math.floor(whole / 60);
  return minutes + ":" + String(whole % 60).padStart(2, "0");
}

function initialTrackIndex() {
  if (typeof window === "undefined") return 0;
  try {
    const saved = Number(window.localStorage.getItem("nexus-audio-track"));
    return Number.isInteger(saved) ? clampIndex(saved) : 0;
  } catch {
    return 0;
  }
}

function initialVolume() {
  if (typeof window === "undefined") return 72;
  try {
    const saved = Number(window.localStorage.getItem("nexus-audio-volume"));
    return Number.isFinite(saved) && saved >= 0 && saved <= 100 ? saved : 72;
  } catch {
    return 72;
  }
}

export function NexusAudioPlayer() {
  const pathname = usePathname();
  const isMusicPage = pathname.startsWith("/music");
  const panelRef = useRef<HTMLElement>(null);
  const playerMount = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YouTubePlayer | null>(null);
  const dragRef = useRef({
    active: false,
    pointerId: -1,
    offsetX: 0,
    offsetY: 0,
  });

  const [engineActive, setEngineActive] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [trackIndex, setTrackIndex] = useState(initialTrackIndex);
  const indexRef = useRef(trackIndex);
  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(initialVolume);
  const startupRef = useRef({ trackIndex, volume });
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [title, setTitle] = useState("NEXUS SIGNAL 01");
  const [author, setAuthor] = useState("YouTube");
  const [error, setError] = useState("");
  const currentTrack = NEXUS_AUDIO_TRACKS[trackIndex];
  const showPanel = isMusicPage && panelOpen;

  useEffect(() => {
    if (!showPanel) return;

    const panel = panelRef.current;
    if (!panel) return;

    const applySavedPosition = () => {
      try {
        const raw = window.localStorage.getItem(AUDIO_POSITION_KEY);
        if (!raw) return;
        const saved = JSON.parse(raw) as { x?: number; y?: number };
        if (typeof saved.x !== "number" || typeof saved.y !== "number") return;

        const rect = panel.getBoundingClientRect();
        const maxX = Math.max(8, window.innerWidth - rect.width - 8);
        const maxY = Math.max(8, window.innerHeight - rect.height - 8);
        const x = Math.max(8, Math.min(saved.x, maxX));
        const y = Math.max(8, Math.min(saved.y, maxY));

        panel.style.left = x + "px";
        panel.style.top = y + "px";
        panel.style.right = "auto";
        panel.style.bottom = "auto";
      } catch {
        // Keep the default position when local storage is unavailable.
      }
    };

    const frame = window.requestAnimationFrame(applySavedPosition);
    return () => window.cancelAnimationFrame(frame);
  }, [showPanel]);

  useEffect(() => {
    if (!engineActive) return;

    const nextIndex = indexRef.current;
    const nextVolume = startupRef.current.volume;
    let disposed = false;

    void loadYouTubeApi()
      .then((YT) => {
        if (disposed || !playerMount.current) return;

        const player = new YT.Player(playerMount.current, {
          width: 224,
          height: 224,
          videoId: NEXUS_AUDIO_TRACKS[nextIndex].videoId,
          playerVars: {
            controls: 1,
            playsinline: 1,
            rel: 0,
            fs: 0,
            iv_load_policy: 3,
            origin: window.location.origin,
          },
          events: {
            onReady: (event) => {
              if (disposed) return;
              playerRef.current = event.target;
              event.target.setVolume(nextVolume);
              setReady(true);
              setError("");
              const data = event.target.getVideoData();
              setTitle(
                data.title ||
                  "NEXUS SIGNAL " + String(nextIndex + 1).padStart(2, "0"),
              );
              setAuthor(data.author || "YouTube");
            },
            onStateChange: (event) => {
              if (disposed) return;

              if (event.data === YT.PlayerState.PLAYING) {
                setPlaying(true);
                setPanelOpen(true);
                const data = event.target.getVideoData();
                setTitle(
                  data.title ||
                    "NEXUS SIGNAL " +
                      String(indexRef.current + 1).padStart(2, "0"),
                );
                setAuthor(data.author || "YouTube");
              } else if (event.data === YT.PlayerState.PAUSED) {
                setPlaying(false);
                setPanelOpen(false);
              } else if (event.data === YT.PlayerState.ENDED) {
                const next = clampIndex(indexRef.current + 1);
                indexRef.current = next;
                setTrackIndex(next);
                window.localStorage.setItem("nexus-audio-track", String(next));
                event.target.loadVideoById(NEXUS_AUDIO_TRACKS[next].videoId);
              }
            },
            onError: () => {
              setPlaying(false);
              setError("Esta señal de YouTube no pudo reproducirse.");
            },
          },
        });

        playerRef.current = player;
      })
      .catch((cause) => {
        if (disposed) return;
        setError(
          cause instanceof Error
            ? cause.message
            : "No se pudo iniciar NEXUS Audio.",
        );
      });

    return () => {
      disposed = true;
      playerRef.current?.destroy();
      playerRef.current = null;
    };
  }, [engineActive]);

  useEffect(() => {
    if (!ready || !engineActive) return;
    const timer = window.setInterval(() => {
      const player = playerRef.current;
      if (!player) return;
      try {
        setCurrentTime(player.getCurrentTime() || 0);
        setDuration(player.getDuration() || 0);
      } catch {
        // YouTube can briefly be between tracks.
      }
    }, 500);
    return () => window.clearInterval(timer);
  }, [ready, engineActive]);

  function openPlayer() {
    setError("");
    setPanelOpen(true);
    if (!engineActive) setEngineActive(true);
  }

  function switchTrack(delta: number) {
    const player = playerRef.current;
    const next = clampIndex(indexRef.current + delta);
    indexRef.current = next;
    setTrackIndex(next);
    setCurrentTime(0);
    setDuration(0);
    setTitle("NEXUS SIGNAL " + String(next + 1).padStart(2, "0"));
    setAuthor("YouTube");
    setError("");
    window.localStorage.setItem("nexus-audio-track", String(next));

    if (!player) return;
    if (playing) player.loadVideoById(NEXUS_AUDIO_TRACKS[next].videoId);
    else player.cueVideoById(NEXUS_AUDIO_TRACKS[next].videoId);
  }

  function togglePlayback() {
    const player = playerRef.current;
    if (!player || !ready) return;
    if (playing) player.pauseVideo();
    else player.playVideo();
  }

  function updateVolume(next: number) {
    const value = Math.max(0, Math.min(100, next));
    setVolume(value);
    startupRef.current.volume = value;
    playerRef.current?.setVolume(value);
    if (value > 0 && playerRef.current?.isMuted()) {
      playerRef.current.unMute();
      setMuted(false);
    }
    window.localStorage.setItem("nexus-audio-volume", String(value));
  }

  function toggleMute() {
    const player = playerRef.current;
    if (!player) return;
    if (player.isMuted()) {
      player.unMute();
      setMuted(false);
    } else {
      player.mute();
      setMuted(true);
    }
  }

  function closePlayer() {
    playerRef.current?.pauseVideo();
    setPlaying(false);
    setPanelOpen(false);
  }

  function startDrag(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    if ((event.target as HTMLElement).closest("button, a, input")) return;

    const panel = panelRef.current;
    if (!panel) return;

    const rect = panel.getBoundingClientRect();
    dragRef.current = {
      active: true,
      pointerId: event.pointerId,
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top,
    };

    panel.style.left = rect.left + "px";
    panel.style.top = rect.top + "px";
    panel.style.right = "auto";
    panel.style.bottom = "auto";
    panel.classList.add("is-dragging");
    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
  }

  function moveDrag(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    const panel = panelRef.current;
    if (!drag.active || drag.pointerId !== event.pointerId || !panel) return;

    const rect = panel.getBoundingClientRect();
    const maxX = Math.max(8, window.innerWidth - rect.width - 8);
    const maxY = Math.max(8, window.innerHeight - rect.height - 8);
    const x = Math.max(8, Math.min(event.clientX - drag.offsetX, maxX));
    const y = Math.max(8, Math.min(event.clientY - drag.offsetY, maxY));

    panel.style.left = x + "px";
    panel.style.top = y + "px";
  }

  function finishDrag(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    const panel = panelRef.current;
    if (!drag.active || drag.pointerId !== event.pointerId || !panel) return;

    dragRef.current.active = false;
    panel.classList.remove("is-dragging");

    try {
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
      const rect = panel.getBoundingClientRect();
      window.localStorage.setItem(
        AUDIO_POSITION_KEY,
        JSON.stringify({
          x: Math.round(rect.left),
          y: Math.round(rect.top),
        }),
      );
    } catch {
      // Position persistence is optional.
    }
  }

  if (!NEXUS_AUDIO_TRACKS.length) return null;

  return (
    <>
      {isMusicPage && !showPanel && (
        <button
          type="button"
          className="nexus-audio-launcher nexus-audio-music-launcher"
          onClick={openPlayer}
          aria-label="Abrir NEXUS Audio"
          title="Abrir NEXUS Audio"
        >
          <span className="nexus-audio-launcher-orbit" aria-hidden="true" />
          <RadioTower size={17} />
          <span>
            NEXUS AUDIO
            <small>{playing ? "NOW PLAYING" : "OPEN SIGNAL"}</small>
          </span>
        </button>
      )}

      {engineActive && (
        <aside
          ref={panelRef}
          className={
            "nexus-audio-player nexus-audio-floating " +
            (showPanel ? "nexus-audio-visible " : "nexus-audio-engine-only ") +
            (playing ? "is-playing" : "is-paused")
          }
          aria-label="NEXUS Audio"
          aria-hidden={!showPanel}
        >
          <div
            className="nexus-audio-head nexus-audio-drag-handle"
            onPointerDown={startDrag}
            onPointerMove={moveDrag}
            onPointerUp={finishDrag}
            onPointerCancel={finishDrag}
          >
            <span>
              <GripHorizontal size={13} />
              <i />
              NEXUS AUDIO
            </span>
            <span>
              SIGNAL {String(trackIndex + 1).padStart(2, "0")} /{" "}
              {String(NEXUS_AUDIO_TRACKS.length).padStart(2, "0")}
            </span>
            <button
              type="button"
              className="nexus-audio-close"
              onClick={closePlayer}
              aria-label="Cerrar NEXUS Audio"
              title="Cerrar reproductor"
              tabIndex={showPanel ? 0 : -1}
            >
              <X size={13} />
            </button>
          </div>

          <div className="nexus-audio-grid">
            <div className="nexus-audio-visual">
              <div className="nexus-audio-corner nexus-audio-corner-a" />
              <div className="nexus-audio-corner nexus-audio-corner-b" />
              <div className="nexus-audio-youtube" ref={playerMount} />
              <span className="nexus-audio-feed-label">
                VISUAL FEED / YOUTUBE
              </span>
            </div>

            <div className="nexus-audio-console">
              <div className="nexus-audio-track-copy">
                <span>NOW TRANSMITTING</span>
                <strong title={title}>{title}</strong>
                <small>{author}</small>
              </div>

              <div
                className="nexus-audio-spectrum"
                aria-hidden="true"
                data-playing={playing ? "true" : "false"}
              >
                {Array.from({ length: 14 }, (_, index) => (
                  <i
                    key={index}
                    style={{
                      height: 5 + ((index * 7) % 13),
                      animationDelay: index * -0.055 + "s",
                    }}
                  />
                ))}
              </div>

              <div className="nexus-audio-progress">
                <input
                  aria-label="Posición de reproducción"
                  type="range"
                  min={0}
                  max={Math.max(duration, 1)}
                  step={1}
                  value={Math.min(currentTime, Math.max(duration, 1))}
                  tabIndex={showPanel ? 0 : -1}
                  onChange={(event) => {
                    const seconds = Number(event.target.value);
                    setCurrentTime(seconds);
                    playerRef.current?.seekTo(seconds, true);
                  }}
                />
                <div>
                  <span>{formatTime(currentTime)}</span>
                  <span>{formatTime(duration)}</span>
                </div>
              </div>

              <div className="nexus-audio-controls">
                <button
                  type="button"
                  onClick={() => switchTrack(-1)}
                  aria-label="Canción anterior"
                  tabIndex={showPanel ? 0 : -1}
                >
                  <SkipBack size={16} />
                </button>
                <button
                  type="button"
                  className="nexus-audio-play"
                  onClick={togglePlayback}
                  aria-label={playing ? "Pausar" : "Reproducir"}
                  disabled={!ready}
                  tabIndex={showPanel ? 0 : -1}
                >
                  {playing ? (
                    <Pause size={17} fill="currentColor" />
                  ) : (
                    <Play size={17} fill="currentColor" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => switchTrack(1)}
                  aria-label="Canción siguiente"
                  tabIndex={showPanel ? 0 : -1}
                >
                  <SkipForward size={16} />
                </button>
                <button
                  type="button"
                  onClick={toggleMute}
                  aria-label={muted ? "Activar sonido" : "Silenciar"}
                  tabIndex={showPanel ? 0 : -1}
                >
                  {muted ? <VolumeX size={15} /> : <Volume2 size={15} />}
                </button>
                <input
                  className="nexus-audio-volume"
                  aria-label="Volumen"
                  type="range"
                  min={0}
                  max={100}
                  value={volume}
                  tabIndex={showPanel ? 0 : -1}
                  onChange={(event) => updateVolume(Number(event.target.value))}
                />
                <a
                  href={currentTrack.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  aria-label="Abrir canción en YouTube"
                  tabIndex={showPanel ? 0 : -1}
                >
                  <ExternalLink size={14} />
                </a>
              </div>

              {error ? (
                <p className="nexus-audio-error">{error}</p>
              ) : (
                <p className="nexus-audio-status">
                  {playing
                    ? "AUDIO LINK STABLE · seguirá sonando al navegar por NEXUS"
                    : ready
                      ? "STANDBY · reproduce una señal"
                      : "LINKING YOUTUBE SIGNAL…"}
                </p>
              )}
            </div>
          </div>
        </aside>
      )}
    </>
  );
}
