"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Wifi } from "lucide-react";
import { useNexus } from "./nexus-provider";

export function NexusNetworkClock() {
  const n = useNexus();
  const [now, setNow] = useState(() => new Date());
  const networkOffset = useRef(0);
  const [networkSynced, setNetworkSynced] = useState(false);
  const formatter = useMemo(
    () =>
      new Intl.DateTimeFormat("es-NI", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hourCycle: "h23",
        timeZone: n.data.user.preferences.timezone,
      }),
    [n.data.user.preferences.timezone],
  );
  const dateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat("es-NI", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        timeZone: n.data.user.preferences.timezone,
      }),
    [n.data.user.preferences.timezone],
  );

  useEffect(() => {
    let active = true;
    const syncNetworkTime = async () => {
      try {
        if (document.hidden) return;
        const started = Date.now();
        const response = await fetch(window.location.href, {
          method: "HEAD",
          cache: "no-store",
          signal: AbortSignal.timeout(8000),
        });
        const finished = Date.now();
        const header = response.headers.get("date");
        if (!active) return;
        if (!response.ok || !header) {
          networkOffset.current = 0;
          setNetworkSynced(false);
          return;
        }
        const server = new Date(header).getTime();
        if (!Number.isFinite(server)) {
          networkOffset.current = 0;
          setNetworkSynced(false);
          return;
        }
        const midpoint = started + (finished - started) / 2;
        networkOffset.current = server - midpoint;
        setNow(new Date(Date.now() + networkOffset.current));
        setNetworkSynced(true);
      } catch {
        if (active) {
          networkOffset.current = 0;
          setNetworkSynced(false);
        }
        // Device time remains a safe fallback when the network is unavailable.
      }
    };
    void syncNetworkTime();
    const timer = window.setInterval(() => {
      if (!document.hidden)
        setNow(new Date(Date.now() + networkOffset.current));
    }, 1000);
    const visibility = () => {
      if (!document.hidden) {
        setNow(new Date(Date.now() + networkOffset.current));
        void syncNetworkTime();
      }
    };
    const offline = () => {
      networkOffset.current = 0;
      setNetworkSynced(false);
    };
    document.addEventListener("visibilitychange", visibility);
    window.addEventListener("offline", offline);
    window.addEventListener("online", visibility);
    const resync = window.setInterval(() => void syncNetworkTime(), 5 * 60_000);
    return () => {
      active = false;
      window.clearInterval(timer);
      window.clearInterval(resync);
      document.removeEventListener("visibilitychange", visibility);
      window.removeEventListener("offline", offline);
      window.removeEventListener("online", visibility);
    };
  }, []);

  return (
    <div className="network-clock" aria-label="Hora actual">
      <div className="network-clock-status">
        <span className="network-clock-pulse" />
        <Wifi size={12} />
        {networkSynced ? "NETWORK SYNC" : "DEVICE TIME"}
      </div>
      <time dateTime={now.toISOString()} suppressHydrationWarning>
        {formatter.format(now)}
      </time>
      <small title={dateFormatter.format(now)}>
        {n.data.user.preferences.timezone.replace("/", " / ").toUpperCase()}
      </small>
    </div>
  );
}
