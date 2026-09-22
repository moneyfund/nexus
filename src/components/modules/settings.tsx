"use client";
import { useRef, useState } from "react";
import {
  Download,
  Upload,
  PlugZap,
  SlidersHorizontal,
  UserRound,
  Volume2,
  ShieldCheck,
  Database,
  BrainCircuit,
  Bell,
  Code2,
  Palette,
  Smartphone,
} from "lucide-react";
import { useNexus } from "../nexus-provider";
import { ModuleFrame, Button, Label, Badge } from "../ui/primitives";
import { INTEGRATIONS, SYSTEM } from "@/config/system";
const sections = [
  { id: "profile", label: "Profile", icon: UserRound },
  { id: "appearance", label: "Appearance", icon: Palette },
  { id: "motion", label: "Motion", icon: SlidersHorizontal },
  { id: "sounds", label: "Sounds", icon: Volume2 },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "integrations", label: "Integrations", icon: PlugZap },
  { id: "ai", label: "AI", icon: BrainCircuit },
  { id: "data", label: "Data", icon: Database },
  { id: "privacy", label: "Privacy", icon: ShieldCheck },
  { id: "developer", label: "Developer", icon: Code2 },
];
export function SettingsView() {
  const n = useNexus();
  const [section, setSection] = useState("profile");
  const [profileDraft, setProfileDraft] = useState<{
    name: string;
    email: string;
  } | null>(null);
  const name = profileDraft?.name ?? n.data.user.name;
  const email = profileDraft?.email ?? n.data.user.email;
  const [pendingImport, setPendingImport] = useState<unknown>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const prefs = n.data.user.preferences;
  function exportData() {
    const blob = new Blob([JSON.stringify(n.data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download =
      "nexus-backup-" + new Date().toISOString().slice(0, 10) + ".json";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <ModuleFrame
      eyebrow="System preferences / 11"
      title="Tu NEXUS"
      description="Ajusta el espacio a tu forma de pensar y trabajar."
    >
      <div className="settings-layout">
        <nav className="settings-nav" aria-label="Secciones de ajustes">
          {sections.map((s) => (
            <button
              key={s.id}
              className={section === s.id ? "active" : ""}
              onClick={() => setSection(s.id)}
            >
              <s.icon size={16} />
              {s.label}
            </button>
          ))}
        </nav>
        <section className="settings-content">
          <Label>SYSTEM / {section.toUpperCase()}</Label>
          {section === "profile" && (
            <>
              <h2>Tu espacio empieza contigo.</h2>
              <form
                className="stack"
                onSubmit={(e) => {
                  e.preventDefault();
                  n.run(() => {
                    n.actions.updateProfile(name, email);
                    setProfileDraft(null);
                  }, "Perfil actualizado.");
                }}
              >
                <label className="field">
                  Nombre
                  <input
                    value={name}
                    required
                    onChange={(e) =>
                      setProfileDraft({ name: e.target.value, email })
                    }
                  />
                </label>
                <label className="field">
                  Correo de referencia
                  <input
                    type="email"
                    value={email}
                    onChange={(e) =>
                      setProfileDraft({ name, email: e.target.value })
                    }
                  />
                </label>
                <label className="field">
                  Zona horaria
                  <select
                    value={prefs.timezone}
                    onChange={(e) =>
                      n.run(() =>
                        n.actions.updatePreferences({
                          timezone: e.target.value,
                        }),
                      )
                    }
                  >
                    <option value="America/Managua">
                      Nicaragua · America/Managua
                    </option>
                    <option value="UTC">UTC</option>
                  </select>
                </label>
                <Button type="submit">Guardar perfil</Button>
              </form>
              <p className="form-note">
                Perfil local. El correo no inicia una sesión. Google Login se
                habilitará al conectar Firebase Auth.
              </p>
            </>
          )}
          {section === "appearance" && (
            <>
              <h2>Una misma identidad. Tu matiz.</h2>
              <p>Negro profundo, información clara y luz para lo importante.</p>
              <div className="accent-options">
                <button
                  className={prefs.accent === "fuchsia" ? "selected" : ""}
                  onClick={() =>
                    n.run(() =>
                      n.actions.updatePreferences({ accent: "fuchsia" }),
                    )
                  }
                >
                  <span style={{ background: "#dc52ed" }} />
                  Fuchsia
                </button>
                <button
                  className={prefs.accent === "violet" ? "selected" : ""}
                  onClick={() =>
                    n.run(() =>
                      n.actions.updatePreferences({ accent: "violet" }),
                    )
                  }
                >
                  <span style={{ background: "#a77bfa" }} />
                  Violet
                </button>
              </div>
              <div className="surface">
                <Label>
                  <Smartphone size={15} />
                  INSTALAR NEXUS
                </Label>
                <p style={{ marginTop: 14 }}>
                  Usa la opción «Instalar aplicación» del navegador. En iPhone:
                  Compartir → Añadir a la pantalla de inicio.
                </p>
              </div>
            </>
          )}
          {section === "motion" && (
            <>
              <h2>Movimiento a tu ritmo.</h2>
              <label className="field">
                Animaciones
                <select
                  value={prefs.motion}
                  onChange={(e) =>
                    n.run(() =>
                      n.actions.updatePreferences({
                        motion: e.target.value as typeof prefs.motion,
                      }),
                    )
                  }
                >
                  <option value="full">Completo</option>
                  <option value="reduced">Reducido</option>
                  <option value="off">Desactivado</option>
                </select>
              </label>
              <label className="field">
                Calidad de la galaxia
                <select
                  value={prefs.quality}
                  onChange={(e) =>
                    n.run(() =>
                      n.actions.updatePreferences({
                        quality: e.target.value as typeof prefs.quality,
                      }),
                    )
                  }
                >
                  <option value="auto">Automática · según dispositivo</option>
                  <option value="low">Ligera · menos partículas</option>
                  <option value="high">Alta</option>
                </select>
              </label>
              <p>
                La preferencia de movimiento reducido de tu sistema tiene
                prioridad. La galaxia se pausa cuando está fuera de pantalla.
              </p>
            </>
          )}
          {section === "sounds" && (
            <>
              <h2>Una señal, cuando tú quieras.</h2>
              <Toggle
                label="Interface sounds"
                detail="Tonos breves al capturar, iniciar y terminar Flow. Sin música."
                checked={prefs.sounds}
                onChange={(value) =>
                  n.run(() => n.actions.updatePreferences({ sounds: value }))
                }
              />
              <p className="form-note">
                Desactivado por defecto. Solo se reproduce sonido después de una
                acción tuya.
              </p>
            </>
          )}
          {section === "notifications" && (
            <>
              <h2>Solo lo que merece atención.</h2>
              <Toggle
                label="Indicador de notificaciones"
                detail="Mostrar señales sin leer en la barra de NEXUS."
                checked={prefs.notifications}
                onChange={(value) =>
                  n.run(() =>
                    n.actions.updatePreferences({ notifications: value }),
                  )
                }
              />
              <p>
                Deadlines, calendario, cobros, inactividad, Flow, metas e
                insights tienen contratos preparados. Las notificaciones del
                navegador y los envíos automáticos todavía no están conectados.
              </p>
            </>
          )}
          {section === "integrations" && (
            <>
              <h2>Listo para conectar.</h2>
              <p>
                Los proveedores actuales son locales o simulados. No hay
                credenciales ni llamadas a estas APIs.
              </p>
              {INTEGRATIONS.map((name) => (
                <div className="integration-row" key={name}>
                  <span>
                    <PlugZap size={18} />
                    {name}
                  </span>
                  <Badge>NOT CONNECTED</Badge>
                </div>
              ))}
            </>
          )}
          {section === "ai" && (
            <>
              <h2>El contexto está bajo tu control.</h2>
              <p>
                Estos permisos filtran el contexto de la simulación y serán la
                base del futuro asistente.
              </p>
              {(
                Object.keys(prefs.aiContext) as (keyof typeof prefs.aiContext)[]
              ).map((key) => (
                <Toggle
                  key={key}
                  label={
                    {
                      projects: "Proyectos",
                      calendar: "Calendario",
                      finance: "Finanzas",
                      knowledge: "Conocimiento",
                    }[key]
                  }
                  checked={prefs.aiContext[key]}
                  onChange={(value) =>
                    n.run(() =>
                      n.actions.updatePreferences({
                        aiContext: { ...prefs.aiContext, [key]: value },
                      }),
                    )
                  }
                />
              ))}
              <div className="surface">
                <Label>USAGE / MOCK</Label>
                <p>
                  {n.data.aiUsage.length} respuestas simuladas · $0 de uso API.
                </p>
              </div>
            </>
          )}
          {section === "data" && (
            <>
              <h2>Tu información sigue siendo tuya.</h2>
              <p>
                Los cambios viven en este navegador. Exporta una copia antes de
                cambiar de equipo o limpiar los datos del sitio.
              </p>
              <div className="row wrap">
                <Button onClick={exportData}>
                  <Download size={16} />
                  Exportar respaldo
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => fileRef.current?.click()}
                >
                  <Upload size={16} />
                  Importar respaldo
                </Button>
                <input
                  ref={fileRef}
                  type="file"
                  accept="application/json,.json"
                  className="sr-only"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    try {
                      setPendingImport(JSON.parse(await file.text()));
                    } catch {
                      n.notify("El archivo no contiene JSON válido.", true);
                    }
                    e.target.value = "";
                  }}
                />
              </div>
              {pendingImport && (
                <div className="system-alert">
                  <p>
                    La importación reemplazará el espacio local completo por
                    este respaldo. Exporta primero si quieres conservar el
                    estado actual.
                  </p>
                  <div className="row wrap" style={{ marginTop: 15 }}>
                    <Button
                      onClick={() =>
                        n.run(() => {
                          n.store.import(pendingImport);
                          setProfileDraft(null);
                          setPendingImport(null);
                        }, "Respaldo importado.")
                      }
                    >
                      Reemplazar con este respaldo
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() => setPendingImport(null)}
                    >
                      Cancelar
                    </Button>
                  </div>
                </div>
              )}
              <div className="integration-row">
                <span>Esquema</span>
                <Badge>V{n.data.schemaVersion}</Badge>
              </div>
              <div className="integration-row">
                <span>Proyectos / Ideas / Conocimiento</span>
                <span>
                  {n.projects.length} / {n.data.ideas.length} /{" "}
                  {n.data.knowledge.length}
                </span>
              </div>
              <p className="form-note">
                La migración conserva la clave original de la versión anterior.
                Los archivos adjuntos solo guardan metadatos. No incluyen sus
                bytes en el respaldo.
              </p>
            </>
          )}
          {section === "privacy" && (
            <>
              <h2>Un espacio local.</h2>
              <p>
                NEXUS todavía no sincroniza datos con Firebase, Google u OpenAI.
                El perfil local organiza tus datos, pero no constituye
                autenticación ni una barrera de seguridad frente a otra persona
                que use este navegador.
              </p>
              <div className="surface">
                <Label>PRÓXIMA CONEXIÓN</Label>
                <p>
                  La activación multiusuario requerirá Firebase Auth, reglas de
                  acceso por usuario y verificación de propietarios antes de
                  sincronizar.
                </p>
              </div>
              <p>
                La caché offline solo conserva la pantalla de conexión y los
                iconos. No almacena conversaciones ni documentos en el service
                worker.
              </p>
            </>
          )}
          {section === "developer" && (
            <>
              <h2>System diagnostics.</h2>
              {[
                ["NEXUS", SYSTEM.version],
                ["Data adapter", "BrowserWorkspaceStorage"],
                ["User ID", n.data.user.id],
                ["Auth session", "Local · no autenticada"],
                ["Calendar", "MockCalendarProvider"],
                ["AI", "MockAIProvider"],
                ["Storage", "MockStorageProvider"],
                [
                  "Persistence",
                  n.storageError || (n.ready ? "Ready" : "Loading"),
                ],
              ].map(([key, value]) => (
                <div className="integration-row" key={key}>
                  <span>{key}</span>
                  <code>{value}</code>
                </div>
              ))}
              <p className="form-note">
                Contratos, migración e integraciones documentados en el
                repositorio. Nunca pegues claves API en estos ajustes.
              </p>
            </>
          )}
        </section>
      </div>
    </ModuleFrame>
  );
}
function Toggle({
  label,
  detail,
  checked,
  onChange,
}: {
  label: string;
  detail?: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="settings-toggle">
      <span>
        <strong>{label}</strong>
        {detail && <small>{detail}</small>}
      </span>
      <input
        type="checkbox"
        role="switch"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
    </label>
  );
}
