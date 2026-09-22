import { initialProjects, todayBlocks } from "@/lib/mock-data";
import { SYSTEM } from "@/config/system";
import type { Entity, Workspace } from "./models";
export function entity(
  id: string,
  source: "demo" | "user" = "user",
  userId: string = SYSTEM.localUserId,
  now = Date.now(),
): Entity {
  return { id, userId, createdAt: now, updatedAt: now, source };
}
export function seedWorkspace(): Workspace {
  const date = "2026-09-22";
  const base = (id: string) =>
    entity(id, "demo", SYSTEM.localUserId, Date.UTC(2026, 8, 22, 12));
  return {
    schemaVersion: 2,
    user: {
      ...base(SYSTEM.localUserId),
      name: "Norvin García",
      initials: "NG",
      email: "",
      preferences: {
        motion: "full",
        quality: "auto",
        sounds: false,
        notifications: true,
        timezone: SYSTEM.timezone,
        accent: "fuchsia",
        aiContext: {
          projects: true,
          calendar: true,
          finance: false,
          knowledge: true,
        },
      },
    },
    projects: structuredClone(initialProjects),
    inbox: [
      {
        ...base("seed-1"),
        type: "idea",
        content: "Sistema automático de presupuestos de construcción",
        targetId: "seed-1",
      },
    ],
    ideas: [
      {
        ...base("seed-1"),
        title: "Presupuestos inteligentes",
        description: "Sistema automático de presupuestos de construcción",
        category: "Construcción",
        status: "captured",
        potential: "promising",
        projectIds: [],
        notes: "",
      },
    ],
    events: todayBlocks.map((b, i) => ({
      ...base("event-" + i),
      title: b.title,
      start: `${date}T${b.time}:00-06:00`,
      end: `${date}T${b.end}:00-06:00`,
      category: b.type,
      projectId: b.projectId,
    })),
    flows: [],
    activeFlow: null,
    goals: [
      {
        ...base("g-xarcon"),
        title: "Lanzar XARCON formalmente",
        targetDate: "2027-03-01",
        projectIds: ["xarcon-creative"],
        milestones: ["Portafolio", "Marca", "Estructura comercial"].map(
          (title, i) => ({
            ...base("gx-" + i),
            goalId: "g-xarcon",
            title,
            completed: false,
          }),
        ),
      },
      {
        ...base("g-civil"),
        title: "Completar Ingeniería Civil",
        targetDate: "2026-12-20",
        projectIds: ["tesis-civil"],
        milestones: ["Tesis", "Defensa", "Titulación"].map((title, i) => ({
          ...base("gc-" + i),
          goalId: "g-civil",
          title,
          completed: false,
        })),
      },
      {
        ...base("g-nexus"),
        title: "Construir NEXUS OS",
        targetDate: "2026-12-31",
        projectIds: [],
        milestones: ["Execution Core", "Integraciones", "Inteligencia"].map(
          (title, i) => ({
            ...base("gn-" + i),
            goalId: "g-nexus",
            title,
            completed: i === 0,
          }),
        ),
      },
    ],
    incomes: [
      {
        ...base("income-criscasa"),
        title: "Anticipo CRISCASA",
        amount: 400,
        currency: "USD",
        date,
        projectId: "criscasa",
        category: "Cliente",
      },
    ],
    expenses: [],
    financialGoals: [],
    contacts: [
      {
        ...base("client-criscasa"),
        name: "Luis Alfredo Castillo",
        company: "CRISCASA",
      },
    ],
    knowledge: [
      {
        ...base("knowledge-civil"),
        title: "Seguridad vial · El Carrizal",
        type: "note",
        content:
          "Estudio de seguridad vial de 4 km, km 284–288, tramo El Jícaro–Jalapa. Comunidad El Carrizal, Nueva Segovia.",
        category: "Universidad",
        projectId: "tesis-civil",
        tags: ["tesis", "ingeniería", "seguridad vial"],
      },
    ],
    attachments: [],
    notifications: [
      {
        ...base("notice-wip"),
        kind: "inactivity",
        title: "Tu capacidad activa está completa",
        body: "Cinco proyectos comparten tu atención. Pausa o termina uno antes de activar otro.",
        href: "/projects",
        read: false,
      },
      {
        ...base("notice-receivable"),
        kind: "receivable",
        title: "CRISCASA · saldo por cobrar",
        body: "$400 en los datos de demostración.",
        href: "/finance",
        read: false,
      },
    ],
    activity: [],
    messages: [],
    memories: [],
    aiUsage: [],
    dailyPlans: [],
    dependencies: [],
  };
}
