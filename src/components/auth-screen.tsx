"use client";
import { useState } from "react";
import { Orbit, LockKeyhole, ArrowRight } from "lucide-react";
import { useNexus } from "./nexus-provider";

export function AuthScreen() {
  const n = useNexus();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  return (
    <main
      style={{
        minHeight: "100dvh",
        display: "grid",
        placeItems: "center",
        padding: 24,
        background: "radial-gradient(circle at 50% 30%, rgba(217,70,239,.15), transparent 35%), #020203",
      }}
    >
      <section className="surface" style={{ width: "min(460px, 100%)", padding: 32 }}>
        <div className="brand" style={{ marginBottom: 28 }}>
          <span className="brand-symbol"><Orbit size={24} /></span>
          <span>
            <span className="brand-name">NEXUS</span>
            <div className="brand-subtitle">PRIVATE INTELLIGENCE</div>
          </span>
        </div>
        <div className="row" style={{ gap: 10, marginBottom: 18 }}>
          <LockKeyhole size={18} className="accent" />
          <strong>{mode === "signin" ? "Accede a tu universo" : "Crea tu acceso privado"}</strong>
        </div>
        <p className="muted" style={{ marginBottom: 22 }}>
          Tus proyectos, ideas, finanzas y conocimiento se sincronizan de forma privada con Firebase.
        </p>
        <form
          className="stack"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError("");
            try {
              if (mode === "signin") await n.signIn(email, password);
              else await n.signUp(email, password);
            } catch (err) {
              setError(err instanceof Error ? err.message : "No se pudo iniciar sesión.");
            } finally {
              setBusy(false);
            }
          }}
        >
          <label className="field">
            Correo
            <input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <label className="field">
            Contraseña
            <input type="password" minLength={6} autoComplete={mode === "signin" ? "current-password" : "new-password"} required value={password} onChange={(e) => setPassword(e.target.value)} />
          </label>
          {error && <p className="accent" role="alert">{error}</p>}
          <button className="button button-primary" type="submit" disabled={busy}>
            {busy ? "Conectando…" : mode === "signin" ? "Entrar a NEXUS" : "Crear cuenta"}
            {!busy && <ArrowRight size={16} />}
          </button>
        </form>
        <button
          type="button"
          className="button button-ghost"
          style={{ width: "100%", marginTop: 12 }}
          onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); setError(""); }}
        >
          {mode === "signin" ? "Primera vez · crear cuenta" : "Ya tengo cuenta · iniciar sesión"}
        </button>
      </section>
    </main>
  );
}
