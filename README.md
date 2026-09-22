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
