export const dynamic = "force-static";

import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  const base = process.env.GITHUB_PAGES === "true" ? "/nexus" : "";
  const path = (value: string) => base + value;

  return {
    id: path("/"),
    name: "NEXUS OS · Personal Intelligence",
    short_name: "NEXUS",
    description: "Tu conocimiento, proyectos y tiempo en un espacio conectado.",
    start_url: path("/"),
    scope: path("/"),
    display: "standalone",
    background_color: "#020203",
    theme_color: "#020203",
    lang: "es",
    icons: [
      {
        src: path("/icons/icon-192.png"),
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: path("/icons/icon-512.png"),
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: path("/icons/icon-maskable.png"),
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    shortcuts: [
      { name: "Flow", url: path("/flow") },
      { name: "Ideas", url: path("/ideas") },
      { name: "Projects", url: path("/projects") },
    ],
  };
}
