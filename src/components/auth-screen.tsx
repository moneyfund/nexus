"use client";
import { useState, useSyncExternalStore } from "react";
import { Orbit, LockKeyhole, ArrowRight, LogIn } from "lucide-react";
import { IntelligenceCore, SpatialEnvironment } from "./spatial-environment";
import { useNexus } from "./nexus-provider";
import { deviceBridge } from "@/lib/device-bridge";

const subscribeRuntime = () => () => {};

export function AuthScreen() {
  const n = useNexus();
  const nativeRuntime = useSyncExternalStore(
    subscribeRuntime,
    () => deviceBridge.isNativeRuntime(),
    () => false,
  );
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState<"google" | "email" | null>(null);
  const [error, setError] = useState("");

  async function runAuth(action: "google" | "email") {
    setBusy(action);
    setError("");

    try {
      if (action === "google") {
        await n.signInWithGoogle();
      } else if (mode === "signin") {
        await n.signIn(email, password);
      } else {
        await n.signUp(email, password);
      }
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "No se pudo iniciar sesión.",
      );
    } finally {
      setBusy(null);
    }
  }

  return (
    <main className="auth-gateway">
      <SpatialEnvironment variant="core" />
      <div className="auth-identity">
        <IntelligenceCore />
        <h1>
          Tu universo.
          <br />
          <em>Tu dirección.</em>
        </h1>
        <p>Conecta lo que piensas con lo que haces.</p>
      </div>
      <section className="auth-panel">
        <div className="brand" style={{ marginBottom: 28 }}>
          <span className="brand-symbol">
            <Orbit size={24} />
          </span>
          <span>
            <span className="brand-name">NEXUS</span>
            <div className="brand-subtitle">PRIVATE INTELLIGENCE · BETA</div>
          </span>
        </div>

        <div className="row" style={{ gap: 10, marginBottom: 18 }}>
          <LockKeyhole size={18} className="accent" />
          <strong>Accede a tu universo</strong>
        </div>

        <p className="auth-caption">
          Proyectos, ideas y decisiones en tu espacio personal.
        </p>
        {!nativeRuntime ? (
          <>
            <button
              className="button button-primary"
              type="button"
              style={{ width: "100%", justifyContent: "center" }}
              disabled={busy !== null}
              onClick={() => void runAuth("google")}
            >
              <LogIn size={17} />
              {busy === "google"
                ? "Conectando con Google…"
                : "Continuar con Google"}
              {busy !== "google" && <ArrowRight size={16} />}
            </button>

            <div
              className="row muted"
              aria-hidden="true"
              style={{ gap: 12, margin: "20px 0", fontSize: 12 }}
            >
              <span
                style={{
                  height: 1,
                  flex: 1,
                  background: "currentColor",
                  opacity: 0.16,
                }}
              />
              <span>O CON CORREO</span>
              <span
                style={{
                  height: 1,
                  flex: 1,
                  background: "currentColor",
                  opacity: 0.16,
                }}
              />
            </div>
          </>
        ) : (
          <div className="system-alert" style={{ marginBottom: 18 }}>
            NEXUS Companion usa acceso de escritorio para conservar el mismo UID
            de Firebase. Actívalo una vez desde NEXUS Web → System → Profile y
            luego entra aquí con ese correo y contraseña.
          </div>
        )}

        <form
          className="stack"
          onSubmit={(event) => {
            event.preventDefault();
            void runAuth("email");
          }}
        >
          <label className="field">
            Correo
            <input
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>

          <label className="field">
            Contraseña
            <input
              type="password"
              minLength={6}
              autoComplete={
                mode === "signin" ? "current-password" : "new-password"
              }
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>

          {error && (
            <p className="accent" role="alert">
              {error}
            </p>
          )}

          <button
            className="button button-secondary"
            type="submit"
            disabled={busy !== null}
          >
            {busy === "email"
              ? "Conectando…"
              : mode === "signin"
                ? "Entrar con correo"
                : "Crear cuenta con correo"}
            {busy !== "email" && <ArrowRight size={16} />}
          </button>
        </form>

        {!nativeRuntime && (
          <button
            type="button"
            className="button button-ghost"
            style={{ width: "100%", marginTop: 12 }}
            disabled={busy !== null}
            onClick={() => {
              setMode(mode === "signin" ? "signup" : "signin");
              setError("");
            }}
          >
            {mode === "signin"
              ? "Primera vez · crear cuenta con correo"
              : "Ya tengo cuenta · iniciar sesión"}
          </button>
        )}
      </section>
    </main>
  );
}
