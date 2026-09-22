"use client";
import { Button } from "@/components/ui/primitives";
export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="empty-state">
      <h2>Este módulo necesita un reinicio.</h2>
      <p>Tu información guardada sigue en su lugar.</p>
      <Button onClick={reset}>Volver a intentarlo</Button>
    </div>
  );
}
