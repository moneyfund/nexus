"use client";
import { useState } from "react";
import { Orbit, LockKeyhole, ArrowRight, Chrome } from "lucide-react";
import { useNexus } from "./nexus-provider";

export function AuthScreen() {
  const n = useNexus();
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
        cause instanceof Error
          ? cause.message
          : "No se pudo iniciar sesión.",
      );
    } finally {
      setBusy(null);
    }
  }

  return (
    <main
      style={{
        minHeight: "100dvh",
        display: "grid",
        placeItems: "center",
        padding: 24,
        background:
          "radial-gradient(circle at 50% 30%, rgba(217,70,239,.15), transparent 35%), #020203",
      }}
    >
      <section
        className="surface"
        style={{ width: "min(460px, 100%)", padding: 32 }}
      >
        <div className="brand" style={{ marginBottom: 28 }}>
          <span className="brand-symbol">
            <Orbit size={24} />
          </span>
          <span>
            <span className="brand-name">NEXUS</span>
            <div className="brand-subtitle">PRIVATE INTELLIGENCE</div>
          </span>
        </div>

        <div className="row" style={{ gap: 10, marginBottom: 18 }}>
          <LockKeyhole size={18} className="accent" />
          <strong>Accede a tu universo</strong>
        </div>

        <p className="muted" style={{ marginBottom: 22 }}>
          Tus proyectos, ideas, finanzas y conocimiento se sincronizan de forma
          privada con Firebase.
        </p>

        <button
          className="button button-primary"
          type="button"
          style={{ width: "100%", justifyContent: "center" }}
          disabled={busy !== null}
          onClick={() => void runAuth("google")}
        >
          <Chrome size={17} />
          {busy === "google" ? "Conectando con Google…" : "Continuar con Google"}
          {busy !== "google" && <ArrowRight size={16} />}
        </button>

        <div
          className="row muted"
          aria-hidden="true"
          style={{ gap: 12, margin: "20px 0", fontSize: 12 }}
        >
          <span style={{ height: 1, flex: 1, background: "currentColor", opacity: 0.16 }} />
          <span>O CON CORREO</span>
          <span style={{ height: 1, flex: 1, background: "currentColor", opacity: 0.16 }} />
        </div>

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
      </section>
    </main>
  );
}
