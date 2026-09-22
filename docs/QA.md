# Verificación

## Gates locales

- TypeScript: correcto.
- ESLint: sin errores ni advertencias.
- Producción Next.js: compilación correcta, 14 rutas incluyendo manifest.
- 13 pruebas de dominio: correctas. Cubren migración, WIP, conversión, tareas, Flow, finanzas, propietarios, respaldos, disponibilidad, dependencias y permisos de contexto.

## Navegador y despliegue

Pendientes de revisión en el preview de Vercel. El navegador remoto no puede acceder al servidor local y el Chromium local no inicia en este entorno. Se realizará la revisión en el preview antes de promover a main.
