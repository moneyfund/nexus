"use client";

import { useEffect, useState } from "react";
import { DownloadCloud, RefreshCw, X } from "lucide-react";
import {
  desktopUpdater,
  type DesktopUpdateInfo,
  type DesktopUpdateProgress,
} from "@/lib/desktop-updater";
import { deviceBridge } from "@/lib/device-bridge";

function progressPercent(progress: DesktopUpdateProgress | null) {
  if (
    !progress ||
    progress.stage !== "progress" ||
    !progress.totalBytes ||
    progress.totalBytes <= 0
  )
    return null;

  return Math.min(
    100,
    Math.round((progress.downloadedBytes / progress.totalBytes) * 100),
  );
}

export function NexusDesktopUpdater() {
  const [update, setUpdate] = useState<DesktopUpdateInfo | null>(null);
  const [checking, setChecking] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [progress, setProgress] = useState<DesktopUpdateProgress | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!deviceBridge.isNativeRuntime()) return;

    let active = true;
    const timer = window.setTimeout(() => {
      setChecking(true);
      void desktopUpdater
        .check()
        .then((next) => {
          if (active && next) setUpdate(next);
        })
        .catch((cause) => {
          if (active)
            setError(
              cause instanceof Error
                ? cause.message
                : "No se pudo comprobar la actualización.",
            );
        })
        .finally(() => {
          if (active) setChecking(false);
        });
    }, 5000);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, []);

  if (!deviceBridge.isNativeRuntime() || dismissed || (!update && !error))
    return null;

  const percent = progressPercent(progress);

  return (
    <aside className="nexus-update-toast" role="status" aria-live="polite">
      <div className="nexus-update-head">
        <span className="nexus-update-icon">
          {installing ? <RefreshCw size={18} /> : <DownloadCloud size={18} />}
        </span>
        <div>
          <strong>
            {update
              ? `NEXUS ${update.version} disponible`
              : "No se pudo comprobar NEXUS Update"}
          </strong>
          <span>
            {update
              ? `Versión actual ${update.currentVersion}`
              : error}
          </span>
        </div>
        {!installing && (
          <button
            aria-label="Cerrar actualización"
            onClick={() => setDismissed(true)}
          >
            <X size={16} />
          </button>
        )}
      </div>

      {update?.notes && <p>{update.notes}</p>}

      {installing && (
        <div className="nexus-update-progress">
          <span style={{ width: percent == null ? "18%" : `${percent}%` }} />
        </div>
      )}

      {update && (
        <button
          className="button button-primary"
          disabled={checking || installing}
          onClick={() => {
            setInstalling(true);
            setError("");
            void desktopUpdater
              .installLatest(setProgress)
              .catch((cause) => {
                setInstalling(false);
                setError(
                  cause instanceof Error
                    ? cause.message
                    : "No se pudo instalar la actualización.",
                );
              });
          }}
        >
          {installing
            ? percent == null
              ? "Descargando actualización…"
              : `Descargando · ${percent}%`
            : "Actualizar y reiniciar"}
        </button>
      )}
    </aside>
  );
}
