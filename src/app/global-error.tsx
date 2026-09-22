"use client";
export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="es">
      <body
        style={{
          background: "#020203",
          color: "white",
          fontFamily: "system-ui",
          padding: "10vh 10vw",
        }}
      >
        <p style={{ color: "#f0abfc", letterSpacing: ".2em" }}>NEXUS OS</p>
        <h1>Volvamos a conectar el espacio.</h1>
        <p>No se borraron tus datos locales.</p>
        <button
          onClick={reset}
          style={{
            marginTop: 20,
            padding: "12px 24px",
            background: "#f0abfc",
            color: "#020203",
            border: 0,
            borderRadius: 8,
          }}
        >
          Reintentar
        </button>
      </body>
    </html>
  );
}
