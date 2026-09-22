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

La versión se integró mediante PR #1 y se publicó en https://nexus-rust-eight-76.vercel.app. Se inspeccionaron Today y el formulario Capture en escritorio. Esa inspección detectó un desajuste de hidratación en los portales de diálogo: se corrigió conservando la misma salida inicial en servidor y cliente. Se añadió ocultación de etiquetas coincidentes en la galaxia, con nombre completo accesible por foco/hover.

El registro final de despliegue y comprobaciones está en https://github.com/moneyfund/nexus/pull/1. No se modificó la protección del preview. La revisión móvil sigue limitada a código responsive; no se afirma haberla verificado en un dispositivo real.
