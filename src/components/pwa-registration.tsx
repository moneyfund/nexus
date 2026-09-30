"use client";

import { useEffect } from "react";

export function PwaRegistration() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator))
      return;

    const base =
      process.env.NEXT_PUBLIC_DEPLOY_TARGET === "github-pages" ? "/nexus" : "";

    navigator.serviceWorker
      .register(base + "/sw.js", { scope: base + "/" })
      .catch(() => {
        /* App remains fully usable if installation is unavailable. */
      });
  }, []);

  return null;
}
