"use client";

import { useEffect, useMemo, useState } from "react";
import { Wifi } from "lucide-react";
import { useNexus } from "./nexus-provider";

export function NexusNetworkClock() {
  const n = useNexus();
  const [now, setNow] = useState(() => new Date());
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
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <div className="network-clock" aria-label="Hora actual">
      <div className="network-clock-status">
        <span className="network-clock-pulse" />
        <Wifi size={12} />
        ONLINE / {n.data.user.preferences.timezone}
      </div>
      <time dateTime={now.toISOString()} suppressHydrationWarning>
        {formatter.format(now)}
      </time>
      <small suppressHydrationWarning>{dateFormatter.format(now).toUpperCase()}</small>
    </div>
  );
}
