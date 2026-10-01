"use client";

import { useEffect, useState } from "react";
import {
  Calculator,
  FolderOpen,
  Laptop,
  LockKeyhole,
  MonitorCog,
  Settings,
  SquareTerminal,
  StickyNote,
} from "lucide-react";
import { Badge, Button, Label, ModuleFrame } from "../ui/primitives";
import {
  deviceBridge,
  type DeviceStatus,
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
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  async function refresh() {
    setError("");
    try {
      setStatus(await deviceBridge.status());
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "No se pudo comprobar el dispositivo.",
      );
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function run(label: string, action: () => Promise<unknown>) {
    setBusy(label);
    setError("");
    try {
      await action();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "No se pudo ejecutar la acción.",
      );
    } finally {
      setBusy("");
    }
  }

  const native = status?.connected === true;

  return (
    <ModuleFrame
      eyebrow="Device bridge / Stage 01"
      title="NEXUS Device"
      description="La capa que conecta tu inteligencia personal con el sistema operativo."
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
            <span>Arquitectura</span>
            <strong>{status?.arch ?? "—"}</strong>
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
          <Label>PERMISSION MODEL</Label>
          <h2>Acceso explícito, no terminal libre.</h2>
          <p>
            NEXUS solo recibe herramientas concretas. La IA no obtiene un
            PowerShell ilimitado ni permisos administrativos generales.
          </p>
          <div className="device-capability-list">
            <span>
              <i /> Abrir aplicaciones aprobadas
            </span>
            <span>
              <i /> Consultar identidad del dispositivo
            </span>
            <span>
              <i /> Bloquear el equipo con confirmación
            </span>
          </div>
          <p className="form-note">
            Próxima etapa: archivos autorizados, audio del sistema,
            notificaciones, captura de pantalla y automatización con niveles de
            riesgo.
          </p>
        </section>
      </div>

      <section className="surface device-actions-section">
        <div className="row between wrap">
          <div>
            <Label>NATIVE TOOLS / WINDOWS</Label>
            <h2>Primeras acciones del Companion.</h2>
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

        <div className="device-danger-row">
          <div>
            <strong>Bloquear Windows</strong>
            <span>
              Acción sensible. NEXUS exige una confirmación explícita antes de
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
            La PWA seguirá siendo el centro visual. Para estas funciones
            instalaremos NEXUS Companion Desktop en Windows; usará la misma
            cuenta y el mismo workspace.
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
