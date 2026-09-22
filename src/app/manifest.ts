import type { MetadataRoute } from "next";
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "NEXUS OS · Personal Intelligence",
    short_name: "NEXUS",
    description: "Tu conocimiento, proyectos y tiempo en un espacio conectado.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#020203",
    theme_color: "#020203",
    lang: "es",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-maskable.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    shortcuts: [
      { name: "Flow", url: "/flow" },
      { name: "Ideas", url: "/ideas" },
      { name: "Projects", url: "/projects" },
    ],
  };
}
