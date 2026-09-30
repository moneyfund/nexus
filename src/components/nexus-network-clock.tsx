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
        hour12: false,
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
        const started = Date.now();
        const response = await fetch(window.location.href, {
          method: "HEAD",
          cache: "no-store",
        });
        const finished = Date.now();
        const header = response.headers.get("date");
        if (!header || !active) return;
        const server = new Date(header).getTime();
        if (!Number.isFinite(server)) return;
        const midpoint = started + (finished - started) / 2;
        networkOffset.current = server - midpoint;
        setNow(new Date(Date.now() + networkOffset.current));
        setNetworkSynced(true);
      } catch {
        // Device time remains a safe fallback when the network is unavailable.
      }
    };
    void syncNetworkTime();
    const timer = window.setInterval(
      () => setNow(new Date(Date.now() + networkOffset.current)),
      1000,
    );
    const resync = window.setInterval(() => void syncNetworkTime(), 5 * 60_000);
    return () => {
      active = false;
      window.clearInterval(timer);
      window.clearInterval(resync);
    };
  }, []);

  return (
    <div className="network-clock" aria-label="Hora actual">
      <div className="network-clock-status">
        <span className="network-clock-pulse" />
        <Wifi size={12} />
        {networkSynced ? "NETWORK SYNC" : "LOCAL FALLBACK"} / {n.data.user.preferences.timezone}
      </div>
      <time dateTime={now.toISOString()} suppressHydrationWarning>
        {formatter.format(now)}
      </time>
      <small suppressHydrationWarning>{dateFormatter.format(now).toUpperCase()}</small>
    </div>
  );
}
