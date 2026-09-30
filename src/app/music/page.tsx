import { Disc3, Headphones, RadioTower } from "lucide-react";
import { NEXUS_AUDIO_TRACKS } from "@/config/audio";

export default function MusicPage() {
  return (
    <div className="music-page">
      <section className="music-hero">
        <div className="music-hero-copy">
          <span className="music-eyebrow">NEXUS AUDIO / ENVIRONMENT</span>
          <h1>
            Tu espacio.
            <br />
            <em>Tu frecuencia.</em>
          </h1>
          <p>
            Abre NEXUS Audio cuando quieras escuchar. Si sales de Music mientras
            una canción está activa, seguirá sonando en el resto de NEXUS sin
            mostrar la ventana del reproductor.
          </p>

          <div className="music-readout">
            <span>
              <Headphones size={17} />
              <strong>{String(NEXUS_AUDIO_TRACKS.length).padStart(2, "0")}</strong>
              <small>SEÑALES CARGADAS</small>
            </span>
            <span>
              <RadioTower size={17} />
              <strong>LIVE</strong>
              <small>AUDIO PERSISTENTE</small>
            </span>
          </div>
        </div>

        <div className="music-orbit" aria-hidden="true">
          <span className="music-orbit-ring music-orbit-ring-a" />
          <span className="music-orbit-ring music-orbit-ring-b" />
          <span className="music-orbit-core">
            <Disc3 size={54} strokeWidth={1} />
          </span>
          <small>NEXUS / SIGNAL ARRAY</small>
        </div>
      </section>

      <section className="music-signal-deck">
        <div className="music-section-heading">
          <span>PLAYLIST / CURRENT ARRAY</span>
          <strong>{NEXUS_AUDIO_TRACKS.length} señales disponibles</strong>
        </div>

        <div className="music-signal-grid">
          {NEXUS_AUDIO_TRACKS.map((track, index) => (
            <div className="music-signal-card" key={track.id}>
              <span className="music-signal-index">
                {String(index + 1).padStart(2, "0")}
              </span>
              <div>
                <strong>SIGNAL {String(index + 1).padStart(2, "0")}</strong>
                <small>{track.videoId}</small>
              </div>
              <span className="music-signal-status">READY</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
