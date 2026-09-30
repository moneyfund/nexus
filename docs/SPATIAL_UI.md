# NEXUS · Sistema espacial

Rediseño visual sobre la arquitectura existente de `main`. El estado, las acciones y la persistencia siguen perteneciendo a NexusProvider y a las capas de dominio, repositorios y servicios.

## Composición

- `SpatialEnvironment` permanece montado en AppShell y cambia su iluminación y geometría según la ruta: núcleo, Projects, Finance, Calendar, Flow, AI, Ideas, Knowledge y Settings. Las estrellas se dibujan al redimensionar, sin un bucle permanente.
- `spatial.css` concentra la nueva capa de diseño: profundidad atmosférica, superficies abiertas, HUD, navegación, estados de foco y adaptación móvil. Se carga después del estilo existente para conservar los contratos de los componentes.
- Inicio combina Project Universe, una próxima acción concreta, liquidez y contexto desplegable en Hoy, Misiones e Inbox. Los importes y la identidad proceden exclusivamente del workspace activo.
- Projects incorpora un mapa orbital filtrable y una lista de misiones con avance, prioridad, tiempo y siguiente acción. Conserva las vistas de lista, cuadrícula, timeline y estados.
- Finance organiza los mismos cálculos y operaciones en Panorama, Movimientos, Por proyecto y Metas. Conserva cuentas, USD/NIO, conversión, corte, ingresos, gastos, deudas y cuentas por cobrar.
- NEXUS AI incorpora un núcleo reactivo, contexto y herramientas plegables, y un campo de escritura accesible en móvil. Conserva las propuestas y sus confirmaciones antes de ejecutar acciones.
- El acceso, Flow, Calendar, Knowledge, Ideas, Capture y Settings comparten el lenguaje espacial sin cambiar sus handlers ni sus fuentes de datos.

## Universo y presupuesto de renderizado

La escena existente evoluciona con Canvas 2D y proyección de coordenadas tridimensionales. Se evaluó WebGL, pero no es necesario incorporar Three.js/R3F, postprocesado o nuevas dependencias para esta composición: núcleo esférico iluminado, corona, disco de acreción, polvo espiral, órbitas y nodos HTML accesibles.

Las bandas se ordenan por estado: activos, en espera, backlog y completados. Las ideas ocupan la banda exterior; la escena muestra hasta 24 ideas abiertas y el módulo Ideas conserva el acceso a todas. Los proyectos no se recortan. Las etiquetas evitan colisiones y el listado alternativo permite explorar los nodos por teclado.

| Perfil | Partículas | DPR máximo | Objetivo del bucle |
| --- | ---: | ---: | ---: |
| LOW | 420 | 1 | 30 fps |
| AUTO escritorio | 1900 | 1,5 | 60 fps |
| HIGH escritorio | 2600 | 2 | 60 fps |
| Móvil AUTO/HIGH | 760 | 1,25 | 30 fps |

Estos son límites de trabajo, no garantías de rendimiento en todos los dispositivos. La escena reduce partículas si el coste medio de dibujo excede el presupuesto. No actualiza estado React en cada fotograma. ResizeObserver ajusta el lienzo; IntersectionObserver y Page Visibility detienen el bucle fuera de pantalla y en pestañas ocultas. Reduced motion conserva la escena estática y las operaciones explícitas de zoom/rotación. Hay pausa manual, reinicio, controles de teclado y objetivos táctiles de 44 px. El movimiento ambiental y el núcleo de IA también se suspenden según visibilidad, calidad y preferencias.

Se conserva el desplazamiento nativo. No se añaden GSAP, Lenis ni assets 3D remotos.

## Contratos conservados

- Firebase Auth, UID y namespace local por usuario; hidratación y escritura de Firestore desde NexusProvider.
- Bootstrap SQL, shadow sync, Data Connect, esquemas y operaciones.
- Reglas de Firestore/Storage, archivos, Cloud Functions, secretos y servicio de IA.
- Selectores y acciones financieros; historial y conversiones existentes.
- Configuración de Next.js y workflows de despliegue. Los enlaces a proyectos desde AI e Inbox usan `/project?id=…`, compatible con proyectos arbitrarios en static export.

`package.json` no cambia. El lockfile se sincroniza con Firebase 12.19.0, que ya estaba declarado, para que la instalación reproducible incluya su árbol de dependencias.

## Verificación

Comprobaciones locales del cambio:

- `npm test`: 31 pruebas, incluidas las pruebas existentes de dominio, aislamiento, acciones y finanzas, y dos pruebas nuevas del orden de las órbitas y presupuesto móvil.
- `npm run typecheck`, `npm run lint` y `npm run build`: correctos.
- Exportación con `GITHUB_PAGES=true NEXT_PUBLIC_DEPLOY_TARGET=github-pages`, retirando las rutas API solo en una copia de trabajo como hace el workflow: correcta; recursos y rutas bajo `/nexus`.
- Chromium a 1440×1040 y 390×844: Inicio con 0, 3 y 20 proyectos; Projects, Finance y sus cuatro pestañas, AI, Calendar, Knowledge, Ideas, Settings, Flow y acceso. Sin desbordamiento horizontal ni excepciones JavaScript observadas.
- Foco de nodos y detalles por teclado; escena estable con movimiento reducido; pausa manual y suspensión fuera de pantalla; inicio, pausa y cierre de Flow; apertura/cierre y guardado de Capture.
- IA: una acción propuesta mantiene la tarea intacta antes de la confirmación y la actualiza después. En móvil el campo de escritura queda dentro de la primera pantalla.

Las pruebas visuales usaron componentes reales y NexusProvider en un arnés local aislado, con transportes Firebase/SQL/AI simulados y fixtures por UID. El arnés y sus datos no forman parte de la aplicación ni del repositorio. No se realizaron escrituras sobre workspaces de producción ni llamadas reales al proveedor de IA. Por tanto, esta revisión verifica la UI y sus interacciones, pero no vuelve a certificar autenticación, permisos o conectividad cloud en una sesión real.

Una muestra de 60 intervalos requestAnimationFrame en Chromium con renderizado por software y 20 proyectos dio mediana de 16,7 ms y percentil 95 de 33,4 ms. Es una observación del entorno de prueba, no una certificación de 60 fps sostenidos ni de temperatura en teléfonos físicos.
