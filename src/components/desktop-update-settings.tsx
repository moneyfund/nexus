"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, DownloadCloud, RefreshCw } from "lucide-react";
import { Badge, Button, Label } from "./ui/primitives";
import {
  desktopUpdater,
  type DesktopUpdateInfo,
  type DesktopUpdaterRuntimeStatus,
  type DesktopUpdateProgress,
} from "@/lib/desktop-updater";
import { deviceBridge } from "@/lib/device-bridge";

function percent(progress: DesktopUpdateProgress | null) {
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

export function DesktopUpdateSettings() {
  const [runtime, setRuntime] =
    useState<DesktopUpdaterRuntimeStatus | null>(null);
  const [update, setUpdate] = useState<DesktopUpdateInfo | null>(null);
  const [checking, setChecking] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [progress, setProgress] = useState<DesktopUpdateProgress | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    void desktopUpdater
      .runtimeStatus()
      .then((status) => {
        if (active) setRuntime(status);
      })
      .catch((cause) => {
        if (active)
          setError(
            cause instanceof Error
              ? cause.message
              : "No se pudo consultar NEXUS Update.",
          );
      });

    return () => {
      active = false;
    };
  }, []);

  async function checkNow() {
    setChecking(true);
    setError("");
    setMessage("");
    try {
      const next = await desktopUpdater.check();
      setUpdate(next);
      setMessage(
        next
          ? `NEXUS ${next.version} está disponible.`
          : "Tu NEXUS está actualizado.",
      );
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "No se pudo comprobar la actualización.",
      );
    } finally {
      setChecking(false);
    }
  }

  async function install() {
    setInstalling(true);
    setError("");
    try {
      await desktopUpdater.installLatest(setProgress);
    } catch (cause) {
      setInstalling(false);
      setError(
        cause instanceof Error
          ? cause.message
          : "No se pudo instalar la actualización.",
      );
    }
  }

  const progressPercent = percent(progress);
  const native = deviceBridge.isNativeRuntime();

  return (
    <>
      <h2>Actualizaciones del Companion.</h2>
      <p>
        NEXUS comprueba versiones publicadas y firmadas antes de instalarlas.
        La PWA se actualiza por separado desde la web.
      </p>

      <div className="surface stack">
        <div className="row between wrap">
          <div>
            <Label>DESKTOP UPDATE CHANNEL</Label>
            <h3 style={{ margin: "12px 0 4px" }}>
              {native ? "NEXUS Companion" : "NEXUS Web / PWA"}
            </h3>
          </div>
          <Badge active={runtime?.configured === true}>
            {!native
              ? "WEB"
              : runtime?.configured
                ? "SIGNED UPDATES"
                : "SETUP REQUIRED"}
          </Badge>
        </div>

        <div className="integration-row">
          <span>Versión actual</span>
          <strong>{runtime?.currentVersion ?? "Comprobando…"}</strong>
        </div>
        <div className="integration-row">
          <span>Canal</span>
          <strong>{runtime?.channel ?? "—"}</strong>
        </div>
        <div className="integration-row">
          <span>Origen</span>
          <strong>{runtime?.endpoint ?? "—"}</strong>
        </div>

        {native && runtime?.configured === false && (
          <div className="system-alert">
            Este build de desarrollo todavía no contiene la clave pública de
            NEXUS Update. Los releases firmados la incorporan automáticamente.
          </div>
        )}

        {!native && (
          <p className="form-note">
            En la PWA no necesitas instaladores: la interfaz web recibe los
            despliegues nuevos al actualizar la aplicación.
          </p>
        )}

        {message && (
          <p className="row" style={{ gap: 8 }}>
            <CheckCircle2 size={16} />
            {message}
          </p>
        )}
        {error && (
          <p className="accent" role="alert">
            {error}
          </p>
        )}

        {native && (
          <div className="row wrap">
            <Button
              type="button"
              variant="secondary"
              disabled={checking || installing || runtime?.configured !== true}
              onClick={() => void checkNow()}
            >
              <RefreshCw size={16} />
              {checking ? "Comprobando…" : "Buscar actualización"}
            </Button>
            {update && (
              <Button
                type="button"
                disabled={installing}
                onClick={() => void install()}
              >
                <DownloadCloud size={16} />
                {installing
                  ? progressPercent == null
                    ? "Descargando…"
                    : `Descargando · ${progressPercent}%`
                  : "Actualizar y reiniciar"}
              </Button>
            )}
          </div>
        )}

        {update?.notes && <p className="form-note">{update.notes}</p>}
      </div>
    </>
  );
}
