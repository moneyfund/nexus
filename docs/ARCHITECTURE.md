# NEXUS OS 0.2

## Límites del sistema

Aplicación Next.js App Router con UI React, Motion, Canvas 2D con proyección tridimensional y CSS. El Canvas solo se carga en Today e Ideas mediante import dinámico. Los nodos son botones HTML accesibles, proyectados con la misma cámara que las partículas. Calidad automática, DPR acotado, pausa fuera de pantalla y pestaña oculta, teclado y movimiento reducido.

## Datos

`domain/models.ts` define entidades, IDs, propietarios y procedencia. Fechas de entidad: epoch ms; calendario: ISO con zona; importes: USD con dos decimales. `domain/seed.ts` conserva los proyectos existentes como demostración; no representa una verificación de importes, horas, avance o fechas del usuario.

`WorkspaceStore` mantiene una instantánea consistente, transacciones y suscripción para React. `BrowserWorkspaceStorage` es el único punto de acceso a localStorage. La clave nueva es `nexus-os-v02:{userId}`. Solo el perfil local original puede migrar `nexus-os-v01`, que se conserva. La validación y las escrituras suceden antes de publicar el nuevo estado; un error de cuota no sobrescribe el último estado válido. Los datos corruptos no se sobrescriben de forma automática.

Las interfaces ProjectRepository, TaskRepository, IdeaRepository, FinanceRepository, CalendarRepository, KnowledgeRepository, GoalRepository y NotificationRepository desacoplan el almacenamiento. Los repositorios locales comparten la misma unidad de trabajo. Las operaciones de varias entidades —captura, conversión de ideas, finalización de Flow— viven en `services/actions.ts`.

El perfil local no es autenticación. La futura conexión a Firestore requiere documentos bajo `users/{uid}/...`, reglas que exijan `request.auth.uid == uid`, comprobación del propietario de relaciones, índices y pruebas en emulador. No conectar un adapter sin ese control. Los contratos están listos; no se afirma que las clases abstractas sean integraciones completas.

## Funciones reales locales

Captura de 9 tipos; Inbox; ideas editables con revisión, archivo y conversión idempotente; WIP 5; proyectos, hitos y dependencias de tareas sin ciclos; completar/reabrir; Flow con pausas, restauración, historial y horas reales; calendario CRUD y búsqueda de disponibilidad; cobros/gastos por proyecto; metas; notas, enlaces y metadatos de archivos; notificaciones y búsqueda global; preferencias y respaldos validados.

El avance de un hito con tareas se actualiza con las tareas de ese hito; el avance total pondera los pesos registrados. Los hitos demo sin tareas conservan su progreso inicial hasta edición posterior.

Finanzas usa registros de cobros/gastos, nunca extrae cantidades de texto libre antiguo. Analytics deriva indicadores de tareas/proyectos/Flow; muestra definiciones, distingue tiempo de sesión de las horas iniciales demo y no inventa tendencias. El Execution Score es una heurística explícita: 60% completion + 40% delivery.

## Integraciones desconectadas

- AuthProvider / FirebaseAuthProvider: contrato; no hay login activo.
- CalendarProvider / MockCalendarProvider / GoogleCalendarProvider: CRUD, disponibilidad y bloques; Google es contrato abstracto.
- StorageProvider / MockStorageProvider / DriveStorageProvider / FirebaseStorageProvider: se guardan metadatos; no hay almacenamiento ni descarga de bytes.
- AIProvider / MockAIProvider / OpenAIProvider: respuestas deterministas, marcadas como simulación. ContextBuilder filtra permisos de contexto; ToolRegistry describe herramientas futuras, UsageTracker conserva costo cero para mock. Memorias locales preparadas, aún no usadas para inferencia.
- NotificationService: centro local; los tipos de señal existen pero no hay cron, notificaciones push ni correo.
- MCP: estado de integración preparado, sin servidor conectado.

Las futuras credenciales deben permanecer en servidor, nunca en componentes ni variables NEXT_PUBLIC sensibles. Las acciones de escritura sugeridas por IA deberán mostrar la propuesta y requerir confirmación explícita en la UI.

## PWA

Manifest, iconos provisionales, metadata móvil y service worker de shell. Offline muestra una pantalla explicativa; no promete trabajar con módulos no cargados. Caché limitada a offline.html e iconos; nunca conversaciones, documentos o APIs. Datos del usuario en el almacenamiento local, separados de la caché. No hay sincronización entre dispositivos todavía.

## Verificación

`npm test`: migración, WIP, conversión idempotente, progreso reversible, reloj Flow y restauración, finanzas sin escrituras parciales, errores de persistencia, propietarios, disponibilidad, dependencias y contexto de IA. `npm run typecheck`, `npm run lint`, `npm run build` son los demás gates.
