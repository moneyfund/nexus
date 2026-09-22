import { Orbit } from "lucide-react";
export default function Loading() {
  return (
    <div className="loading-core" role="status">
      <Orbit size={35} strokeWidth={1} />
      <div className="hud-label">NEXUS / LOADING CONTEXT</div>
    </div>
  );
}
