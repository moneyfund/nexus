# NEXUS OS

Personal Intelligence Operating System. Ideas, proyectos, tiempo y conocimiento en un espacio conectado: negro profundo, luz violeta/fucsia y una galaxia interactiva.

## Desarrollo

```sh
npm ci
npm run dev
```

Node.js 24 · Next.js 16.3.3 · React 19 · TypeScript 6 · Tailwind 4 · Motion · Lucide. TypeScript 6 mantiene compatibilidad con la API de typescript-eslint; TS 7 se retiró porque impedía ejecutar ESLint. Lockfile incluido para instalaciones reproducibles.

## Verificar

```sh
npm test
npm run typecheck
npm run lint
npm run build
```

## Módulos

Today / NEXUS Core, Projects, Calendar, Flow, Ideas / Inbox, Goals, Finance, Analytics, Knowledge, Nexus AI y System. `Ctrl/Cmd+K` abre comandos y búsqueda global. `C` abre Capture fuera de campos; también `Ctrl/Cmd+Shift+Space`.

Los seis proyectos iniciales y sus importes, fechas, horas y avances se conservan como **demostración**. Tus capturas se identifican como registros propios. Firebase, Auth, Google Calendar, Drive, OpenAI y MCP permanecen **desconectados**. NEXUS AI usa respuestas simuladas. Los archivos guardan únicamente metadatos hasta conectar Storage.

Los datos de `nexus-os-v01` se migran sin borrar la clave anterior. Los datos nuevos se guardan por perfil en este navegador. Exporta/importa respaldos desde System → Data. El perfil local no es autenticación; no hay sincronización multiusuario aún.

Ver [auditoría inicial](docs/AUDIT.md), [arquitectura y límites](docs/ARCHITECTURE.md) y [verificación](docs/QA.md).


## Integraciones reales

### Google Workspace

NEXUS reutiliza la sesión de Google de Firebase y solicita permisos adicionales
solo cuando el usuario pulsa **Conectar Calendar + Drive**.

Permisos utilizados:

- `calendar.events`: leer y gestionar eventos del calendario principal.
- `drive.readonly`: buscar archivos existentes y conectar referencias a Knowledge.

Para que Google acepte esos permisos, habilita **Google Calendar API** y
**Google Drive API** en el mismo proyecto de Google Cloud/Firebase y declara los
scopes en la pantalla de consentimiento OAuth. El token de acceso se conserva
solo en `sessionStorage` y nunca se escribe en Firestore.

### NEXUS AI

La ruta `/api/ai` usa OpenAI Responses API desde el servidor. No expongas la
clave en el cliente. Configura en Vercel:

```bash
OPENAI_API_KEY=...
NEXUS_OWNER_UID=...
OPENAI_MODEL=gpt-5.6-terra
```

`NEXUS_OWNER_UID` debe ser el UID de Firebase del propietario y evita que otra
cuenta autenticada pueda consumir la clave de OpenAI. El modelo puede cambiarse
sin modificar código. Las acciones que propone la IA requieren confirmación
explícita en la interfaz antes de modificar proyectos o finanzas.
