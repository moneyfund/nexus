export const SYSTEM = {
  name: "NEXUS",
  version: "0.2.0",
  localUserId: "local-norvin",
  wipLimit: 5,
  currency: "USD",
  timezone: "America/Managua",
} as const;
export const CATEGORIES = [
  "Ideas",
  "Software",
  "Inversión",
  "Clientes",
  "XARCON",
  "Bienes raíces",
  "Construcción",
  "Universidad",
  "Personal",
];
export const MOTION = { duration: 0.38, ease: [0.22, 1, 0.36, 1] as const };
export const INTEGRATIONS = [
  "Firebase",
  "Google Calendar",
  "Google Drive",
  "OpenAI",
  "MCP",
] as const;
