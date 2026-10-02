"use client";

import { useEffect, useState } from "react";
import {
  BatteryMedium,
  Calculator,
  Camera,
  FolderOpen,
  Laptop,
  LockKeyhole,
  Minus,
  MonitorCog,
  Plus,
  Settings,
  SquareTerminal,
  StickyNote,
  Volume2,
  VolumeX,
  Wifi,
  WifiOff,
} from "lucide-react";
import { Badge, Button, Label, ModuleFrame } from "../ui/primitives";
import {
  deviceBridge,
  type DeviceStatus,
  type DeviceSystemSnapshot,
  type KnownDesktopApp,
} from "@/lib/device-bridge";

const apps: Array<{
  id: KnownDesktopApp;
  label: string;
  icon: typeof StickyNote;
}> = [
  { id: "notepad", label: "Bloc de notas", icon: StickyNote },
  { id: "calculator", label: "Calculadora", icon: Calculator },
  { id: "files", label: "Explorador", icon: FolderOpen },
  { id: "settings", label: "Configuración", icon: Settings },
  { id: "terminal", label: "Terminal", icon: SquareTerminal },
];

export function DeviceView() {
  const [status, setStatus] = useState<DeviceStatus | null>(null);
  const [snapshot, setSnapshot] = useState<DeviceSystemSnapshot | null>(null);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [lastScreenshot, setLastScreenshot] = useState("");

  async function refresh() {
    setError("");
    try {
      const nextStatus = await deviceBridge.status();
      setStatus(nextStatus);
      if (nextStatus.connected)
        setSnapshot(await deviceBridge.systemSnapshot());
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "No se pudo comprobar el dispositivo.",
      );
    }
  }

  useEffect(() => {
    let active = true;
    void deviceBridge
      .status()
      .then(async (next) => {
        if (!active) return;
        setStatus(next);
        if (next.connected) {
          const metrics = await deviceBridge.systemSnapshot();
          if (active) setSnapshot(metrics);
        }
      })
      .catch((cause) => {
        if (!active) return;
        setError(
          cause instanceof Error
            ? cause.message
            : "No se pudo comprobar el dispositivo.",
        );
      });
    return () => {
      active = false;
    };
  }, []);

  async function run(label: string, action: () => Promise<unknown>) {
    setBusy(label);
    setError("");
    try {
      return await action();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "No se pudo ejecutar la acción.",
      );
      return undefined;
    } finally {
      setBusy("");
    }
  }

  const native = status?.connected === true;

  return (
    <ModuleFrame
      eyebrow="Device bridge / Stage 02"
      title="NEXUS Device"
      description="Herramientas nativas concretas para que NEXUS pueda actuar en Windows sin entregar acceso libre al sistema."
      action={
        <Badge active={native}>
          {native ? "COMPANION CONNECTED" : "PWA MODE"}
        </Badge>
      }
    >
      <div className="device-overview-grid">
        <section className="surface device-status-card">
          <Label>RUNTIME</Label>
          <div className="device-runtime">
            <span className="device-runtime-icon">
              {native ? <MonitorCog size={30} /> : <Laptop size={30} />}
            </span>
            <div>
              <h2>{native ? "NEXUS Companion" : "NEXUS PWA"}</h2>
              <p>
                {native
                  ? "Esta instancia tiene acceso a las herramientas nativas permitidas."
                  : "La interfaz web funciona normalmente, pero el navegador aísla el sistema operativo."}
              </p>
            </div>
          </div>
          <div className="integration-row">
            <span>Dispositivo</span>
            <strong>{status?.deviceName ?? "Comprobando…"}</strong>
          </div>
          <div className="integration-row">
            <span>Plataforma</span>
            <strong>{status?.platform ?? "—"}</strong>
          </div>
          <div className="integration-row">
            <span>Runtime</span>
            <strong>{status?.appVersion ?? "—"}</strong>
          </div>
          <Button variant="secondary" onClick={() => void refresh()}>
            Volver a comprobar
          </Button>
        </section>

        <section className="surface device-status-card">
          <Label>SYSTEM SNAPSHOT</Label>
          <h2>Estado local del equipo.</h2>
          <div className="integration-row">
            <span>
              <BatteryMedium size={17} /> Batería
            </span>
            <strong>
              {snapshot?.batteryPercent == null
                ? "No reportada"
                : snapshot.batteryPercent + "%"}
            </strong>
          </div>
          <div className="integration-row">
            <span>
              {snapshot?.networkConnected ? (
                <Wifi size={17} />
              ) : (
                <WifiOff size={17} />
              )}{" "}
              Red
            </span>
            <strong>
              {snapshot == null
                ? "Comprobando…"
                : snapshot.networkConnected
                  ? "Conectada"
                  : "Sin conexión detectada"}
            </strong>
          </div>
          <p className="form-note">
            Estos datos permanecen locales salvo que una función futura pida
            utilizarlos como contexto de NEXUS AI.
          </p>
        </section>
      </div>

      <section className="surface device-actions-section">
        <div className="row between wrap">
          <div>
            <Label>NATIVE TOOLS / WINDOWS</Label>
            <h2>Aplicaciones autorizadas.</h2>
          </div>
          <Badge active={native}>{native ? "READY" : "INSTALL REQUIRED"}</Badge>
        </div>

        <div className="device-action-grid">
          {apps.map((app) => (
            <Button
              key={app.id}
              variant="secondary"
              disabled={!native || !!busy}
              onClick={() =>
                void run(app.label, () => deviceBridge.openApp(app.id))
              }
            >
              <app.icon size={16} />
              {busy === app.label ? "Abriendo…" : app.label}
            </Button>
          ))}
        </div>
      </section>

      <section className="surface device-actions-section">
        <div className="row between wrap">
          <div>
            <Label>AUDIO / WINDOWS</Label>
            <h2>Control de volumen.</h2>
          </div>
          <Volume2 size={20} />
        </div>

        <div className="device-action-grid">
          <Button
            variant="secondary"
            disabled={!native || !!busy}
            onClick={() =>
              void run("volume-down", () => deviceBridge.adjustVolume(-10))
            }
          >
            <Minus size={16} /> 10%
          </Button>
          <Button
            variant="secondary"
            disabled={!native || !!busy}
            onClick={() =>
              void run("volume-up", () => deviceBridge.adjustVolume(10))
            }
          >
            <Plus size={16} /> 10%
          </Button>
          {[25, 50, 75, 100].map((value) => (
            <Button
              key={value}
              variant="secondary"
              disabled={!native || !!busy}
              onClick={() =>
                void run("volume-" + value, () => deviceBridge.setVolume(value))
              }
            >
              {value}%
            </Button>
          ))}
          <Button
            variant="secondary"
            disabled={!native || !!busy}
            onClick={() => void run("mute", () => deviceBridge.toggleMute())}
          >
            <VolumeX size={16} /> Mute
          </Button>
        </div>
        <p className="form-note">
          En esta beta el ajuste usa los controles multimedia nativos de Windows,
          por lo que el nivel puede quedar cuantizado en pasos pequeños.
        </p>
      </section>

      <section className="surface device-actions-section">
        <div className="row between wrap">
          <div>
            <Label>SCREEN / EXPLICIT ACCESS</Label>
            <h2>Captura autorizada de pantalla.</h2>
          </div>
          <Badge>CONFIRMABLE</Badge>
        </div>

        <div className="device-danger-row">
          <div>
            <strong>Guardar captura local</strong>
            <span>
              La imagen se guarda en Imágenes/NEXUS. NEXUS AI no la recibe
              automáticamente.
            </span>
            {lastScreenshot && <small>{lastScreenshot}</small>}
          </div>
          <Button
            variant="secondary"
            disabled={!native || !!busy}
            onClick={() => {
              if (!window.confirm("¿Capturar la pantalla visible ahora?")) return;
              void run("screenshot", async () => {
                const path = await deviceBridge.takeScreenshot();
                setLastScreenshot(path);
              });
            }}
          >
            <Camera size={16} />
            Capturar
          </Button>
        </div>

        <div className="device-danger-row">
          <div>
            <strong>Bloquear Windows</strong>
            <span>
              Acción sensible. NEXUS exige confirmación explícita antes de
              ejecutarla.
            </span>
          </div>
          <Button
            variant="danger"
            disabled={!native || !!busy}
            onClick={() => {
              if (!window.confirm("¿Bloquear este equipo ahora?")) return;
              void run("lock", () => deviceBridge.lockDevice());
            }}
          >
            <LockKeyhole size={16} />
            Bloquear equipo
          </Button>
        </div>

        {!native && (
          <div className="system-alert">
            Estas herramientas solo funcionan dentro de NEXUS Companion. La PWA
            conserva la misma cuenta y el mismo workspace, pero no recibe
            permisos del sistema operativo.
          </div>
        )}
        {error && (
          <div className="system-alert" role="alert">
            {error}
          </div>
        )}
      </section>
    </ModuleFrame>
  );
}
