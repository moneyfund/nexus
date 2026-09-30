"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import {
  ExternalLink,
  Pause,
  Play,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  X,
  RadioTower,
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

export function NexusAudioPlayer() {
  const pathname = usePathname();
  const playerMount = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YouTubePlayer | null>(null);
  const indexRef = useRef(0);
  const [trackIndex, setTrackIndex] = useState(0);
  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(72);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [title, setTitle] = useState("NEXUS SIGNAL 01");
  const [author, setAuthor] = useState("YouTube");
  const [collapsed, setCollapsed] = useState(false);
  const [error, setError] = useState("");
  const currentTrack = NEXUS_AUDIO_TRACKS[trackIndex];

  const positionClass = useMemo(
    () => (pathname === "/" ? "nexus-audio-home" : "nexus-audio-docked"),
    [pathname],
  );

  useEffect(() => {
    const savedIndex = Number(window.localStorage.getItem("nexus-audio-track"));
    const savedVolume = Number(window.localStorage.getItem("nexus-audio-volume"));
    const savedCollapsed =
      window.localStorage.getItem("nexus-audio-collapsed") === "true";

    const nextIndex = Number.isInteger(savedIndex)
      ? clampIndex(savedIndex)
      : 0;
    const nextVolume =
      Number.isFinite(savedVolume) && savedVolume >= 0 && savedVolume <= 100
        ? savedVolume
        : 72;

    indexRef.current = nextIndex;
    setTrackIndex(nextIndex);
    setVolume(nextVolume);
    setCollapsed(savedCollapsed);

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
              setTitle(data.title || "NEXUS SIGNAL 01");
              setAuthor(data.author || "YouTube");
            },
            onStateChange: (event) => {
              if (disposed) return;
              if (event.data === YT.PlayerState.PLAYING) {
                setPlaying(true);
                const data = event.target.getVideoData();
                setTitle(
                  data.title ||
                    "NEXUS SIGNAL " +
                      String(indexRef.current + 1).padStart(2, "0"),
                );
                setAuthor(data.author || "YouTube");
              } else if (event.data === YT.PlayerState.PAUSED) {
                setPlaying(false);
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
  }, []);

  useEffect(() => {
    if (!ready || collapsed) return;
    const timer = window.setInterval(() => {
      const player = playerRef.current;
      if (!player) return;
      try {
        setCurrentTime(player.getCurrentTime() || 0);
        setDuration(player.getDuration() || 0);
      } catch {
        // The iframe can be between tracks for a fraction of a second.
      }
    }, 500);
    return () => window.clearInterval(timer);
  }, [ready, collapsed]);

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
    else {
      setCollapsed(false);
      window.localStorage.setItem("nexus-audio-collapsed", "false");
      player.playVideo();
    }
  }

  function updateVolume(next: number) {
    const value = Math.max(0, Math.min(100, next));
    setVolume(value);
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

  function collapsePlayer() {
    playerRef.current?.pauseVideo();
    setPlaying(false);
    setCollapsed(true);
    window.localStorage.setItem("nexus-audio-collapsed", "true");
  }

  function expandPlayer() {
    setCollapsed(false);
    window.localStorage.setItem("nexus-audio-collapsed", "false");
  }

  if (!NEXUS_AUDIO_TRACKS.length) return null;

  if (collapsed) {
    return (
      <button
        className={"nexus-audio-mini " + positionClass}
        onClick={expandPlayer}
        aria-label="Abrir NEXUS Audio"
      >
        <span className="nexus-audio-mini-orbit" />
        <RadioTower size={16} />
        <span>
          NEXUS AUDIO
          <small>SIGNAL {String(trackIndex + 1).padStart(2, "0")}</small>
        </span>
      </button>
    );
  }

  return (
    <aside
      className={
        "nexus-audio-player " +
        positionClass +
        (playing ? " is-playing" : " is-paused")
      }
      aria-label="NEXUS Audio"
    >
      <div className="nexus-audio-head">
        <span>
          <i />
          NEXUS AUDIO
        </span>
        <span>
          SIGNAL {String(trackIndex + 1).padStart(2, "0")} /{" "}
          {String(NEXUS_AUDIO_TRACKS.length).padStart(2, "0")}
        </span>
        <button
          onClick={collapsePlayer}
          className="nexus-audio-close"
          aria-label="Minimizar reproductor"
        >
          <X size={13} />
        </button>
      </div>

      <div className="nexus-audio-grid">
        <div className="nexus-audio-visual">
          <div className="nexus-audio-corner nexus-audio-corner-a" />
          <div className="nexus-audio-corner nexus-audio-corner-b" />
          <div className="nexus-audio-youtube" ref={playerMount} />
          <span className="nexus-audio-feed-label">VISUAL FEED / YOUTUBE</span>
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
              <i key={index} style={{ "--bar": index } as React.CSSProperties} />
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
              onClick={() => switchTrack(-1)}
              aria-label="Canción anterior"
            >
              <SkipBack size={16} />
            </button>
            <button
              className="nexus-audio-play"
              onClick={togglePlayback}
              aria-label={playing ? "Pausar" : "Reproducir"}
              disabled={!ready}
            >
              {playing ? (
                <Pause size={17} fill="currentColor" />
              ) : (
                <Play size={17} fill="currentColor" />
              )}
            </button>
            <button
              onClick={() => switchTrack(1)}
              aria-label="Canción siguiente"
            >
              <SkipForward size={16} />
            </button>
            <button onClick={toggleMute} aria-label={muted ? "Activar sonido" : "Silenciar"}>
              {muted ? <VolumeX size={15} /> : <Volume2 size={15} />}
            </button>
            <input
              className="nexus-audio-volume"
              aria-label="Volumen"
              type="range"
              min={0}
              max={100}
              value={volume}
              onChange={(event) => updateVolume(Number(event.target.value))}
            />
            <a
              href={currentTrack.sourceUrl}
              target="_blank"
              rel="noreferrer"
              aria-label="Abrir canción en YouTube"
            >
              <ExternalLink size={14} />
            </a>
          </div>

          {error ? (
            <p className="nexus-audio-error">{error}</p>
          ) : (
            <p className="nexus-audio-status">
              {playing
                ? "AUDIO LINK STABLE · reproducción activa"
                : ready
                  ? "PAUSED · inicia la señal cuando quieras"
                  : "LINKING YOUTUBE SIGNAL…"}
            </p>
          )}
        </div>
      </div>
    </aside>
  );
}
