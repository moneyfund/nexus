import type { DailyBlock, Project } from "@/lib/types";

export const initialProjects: Project[] = [
  {
    id: "criscasa",
    name: "CRISCASA",
    area: "Cliente · Ingeniería",
    client: "Luis Alfredo Castillo",
    description: "Diseño arquitectónico, fachada y desarrollo técnico del edificio comercial de cuatro niveles.",
    progress: 72,
    status: "active",
    priority: "critical",
    deadline: "28 SEP",
    value: 800,
    paid: 400,
    accent: "#8b5cf6",
    nextAction: "Corregir estructura de escalera y losa del segundo piso",
    hours: 18.4,
    milestones: [
      { id: "c1", title: "Diseño base", weight: 15, progress: 100 },
      { id: "c2", title: "Fachada", weight: 20, progress: 95 },
      { id: "c3", title: "Distribución", weight: 20, progress: 80 },
      { id: "c4", title: "Estructura", weight: 25, progress: 58 },
      { id: "c5", title: "Entrega", weight: 20, progress: 20 }
    ],
    tasks: [
      { id: "ct1", title: "Corregir estructura de escalera", completed: false, estimatedMinutes: 90, priority: "critical", milestone: "Estructura" },
      { id: "ct2", title: "Ajustar losa segundo piso", completed: false, estimatedMinutes: 55, priority: "high", milestone: "Estructura" },
      { id: "ct3", title: "Exportar revisión final", completed: false, estimatedMinutes: 30, priority: "medium", milestone: "Entrega" }
    ]
  },
  {
    id: "tesis-civil",
    name: "Tesis Ingeniería Civil",
    area: "Académico",
    description: "Estudio de seguridad vial, km 284–288, tramo El Jícaro–Jalapa.",
    progress: 63,
    status: "active",
    priority: "high",
    deadline: "15 OCT",
    accent: "#a78bfa",
    nextAction: "Cerrar metodología y preparar instrumentos de campo",
    hours: 46.2,
    milestones: [
      { id: "t1", title: "Protocolo", weight: 15, progress: 100 },
      { id: "t2", title: "Marco teórico", weight: 15, progress: 90 },
      { id: "t3", title: "Trabajo de campo", weight: 20, progress: 60 },
      { id: "t4", title: "Análisis", weight: 25, progress: 45 },
      { id: "t5", title: "Documento final", weight: 15, progress: 40 },
      { id: "t6", title: "Defensa", weight: 10, progress: 0 }
    ],
    tasks: [
      { id: "tt1", title: "Completar metodología", completed: false, estimatedMinutes: 60, priority: "high", milestone: "Documento final" },
      { id: "tt2", title: "Revisar marco legal", completed: false, estimatedMinutes: 45, priority: "medium", milestone: "Marco teórico" }
    ]
  },
  {
    id: "dolce",
    name: "Tesis Mercadeo · DOLCE",
    area: "Académico",
    description: "Análisis del marketing en el posicionamiento comercial de Repostería DOLCE.",
    progress: 78,
    status: "active",
    priority: "medium",
    deadline: "09 OCT",
    accent: "#c084fc",
    nextAction: "Depurar presentación final y conclusiones",
    hours: 27.6,
    milestones: [
      { id: "d1", title: "Investigación", weight: 40, progress: 100 },
      { id: "d2", title: "Análisis", weight: 30, progress: 82 },
      { id: "d3", title: "Presentación", weight: 30, progress: 45 }
    ],
    tasks: [
      { id: "dt1", title: "Revisar conclusiones", completed: false, estimatedMinutes: 40, priority: "medium", milestone: "Análisis" }
    ]
  },
  {
    id: "pequenos-escritores",
    name: "Pequeños Escritores",
    area: "Software · Cliente",
    description: "Plataforma educativa infantil con retos, trazos, grupos y progreso.",
    progress: 58,
    status: "active",
    priority: "high",
    deadline: "02 OCT",
    accent: "#7c3aed",
    nextAction: "Implementar puntuación de precisión en trazos",
    hours: 31.8,
    milestones: [
      { id: "p1", title: "Core", weight: 35, progress: 90 },
      { id: "p2", title: "Retos", weight: 35, progress: 55 },
      { id: "p3", title: "Pulido", weight: 30, progress: 25 }
    ],
    tasks: [
      { id: "pt1", title: "Scoring de trazos", completed: false, estimatedMinutes: 90, priority: "high", milestone: "Retos" },
      { id: "pt2", title: "Guía de mano animada", completed: false, estimatedMinutes: 55, priority: "medium", milestone: "Retos" }
    ]
  },
  {
    id: "xarcon-creative",
    name: "XARCON Creative",
    area: "Empresa",
    description: "Consolidación de marca, portafolio y sistema comercial de la agencia.",
    progress: 44,
    status: "active",
    priority: "medium",
    deadline: "31 OCT",
    accent: "#9333ea",
    nextAction: "Organizar portfolio y casos de estudio",
    hours: 22.1,
    milestones: [
      { id: "x1", title: "Brand", weight: 25, progress: 85 },
      { id: "x2", title: "Web", weight: 35, progress: 65 },
      { id: "x3", title: "Ventas", weight: 40, progress: 10 }
    ],
    tasks: [
      { id: "xt1", title: "Curar casos de estudio", completed: false, estimatedMinutes: 60, priority: "medium", milestone: "Web" }
    ]
  },
  {
    id: "nicasa",
    name: "NICASA",
    area: "Software",
    description: "Mapa público y publicación de propiedades.",
    progress: 32,
    status: "backlog",
    priority: "low",
    deadline: "SIN FECHA",
    accent: "#6d28d9",
    nextAction: "Resolver escritura de documentos en Firestore",
    hours: 14.8,
    milestones: [{ id: "n1", title: "MVP", weight: 100, progress: 32 }],
    tasks: [{ id: "nt1", title: "Revisar publicación Firestore", completed: false, estimatedMinutes: 60, priority: "low", milestone: "MVP" }]
  }
];

export const todayBlocks: DailyBlock[] = [
  { time: "12:30", end: "14:00", projectId: "criscasa", title: "Correcciones estructurales", type: "focus" },
  { time: "14:30", end: "15:30", projectId: "tesis-civil", title: "Metodología", type: "focus" },
  { time: "16:00", end: "17:30", projectId: "pequenos-escritores", title: "Scoring de trazos", type: "focus" },
  { time: "18:00", end: "18:30", projectId: "xarcon-creative", title: "Revisión administrativa", type: "admin" }
];
