import Link from "next/link";
export default function NotFound() {
  return (
    <div className="empty-state">
      <span className="hud-label">NEXUS / 404</span>
      <h1>Fuera de órbita.</h1>
      <p>Ese módulo no existe en tu espacio.</p>
      <Link href="/" className="button button-primary">
        Volver a NEXUS Core
      </Link>
    </div>
  );
}
