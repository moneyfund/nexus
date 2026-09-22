# Verificación

## Gates locales

- TypeScript: correcto.
- ESLint: sin errores ni advertencias.
- Producción Next.js: compilación correcta, 14 rutas incluyendo manifest.
- 14 pruebas de dominio: correctas. Cubren migración, WIP, conversión, tareas, Flow, finanzas, propietarios, respaldos, disponibilidad, dependencias, permisos de contexto y separación de importes demo/propios.
- Guardado fallido: los formularios conservan su contenido y no anuncian éxito.
- Revisión estática de responsive, foco modal, navegación por teclado y movimiento reducido.

## Navegador y despliegue

El preview del commit `157ecfcedb537eed898f8a6edafc5fa9a1d0dfa7` terminó correctamente en Vercel. Los dos jobs de GitHub CI también finalizaron con éxito. El preview exige autenticación de Vercel y la conexión disponible no pudo conceder acceso; no se considera una revisión visual completada. Se retiró la ruta temporal de QA antes de integrar.

La verificación visual e interactiva se realizará en la URL pública declarada por el repositorio, tras el despliegue final. No se modificó la protección del preview.
