# Progreso

## 2026-11-09 — Fase 6: laboratorio

- **Hecho:** completados los faltantes del Prompt 6. Se añadió la importación
  de CSV por texto o archivo, con autodetección de `,`/`;`, BOM, decimales con
  coma, encabezados de la exportación española, validación en español y límite
  de **500 filas**. `atencion_min` por paciente prevalece sobre la distribución
  configurada. El laboratorio ejecuta entre **1 y 1.000 réplicas** y presenta
  medias e IC 95 % para Wq, Lq, rho y porcentaje de espera sobre el máximo;
  una sola réplica informa que no se puede estimar el intervalo. Se agregaron
  descargar/cargar JSON versión 1 y copiar/abrir enlaces con escenario en el
  hash, incluidos errores claros y retorno a observados ante un hash inválido.
- **Navegador:** Playwright, **1366×768** y **390×844**, sin errores de consola.
  La corrida observada del laboratorio produjo **22 pacientes y Wq = 0,103
  min**. Un CSV con estructura exportada por la app (pegado) y un CSV propio
  (archivo) mostraron **2 filas válidas**; un CSV inválido señaló **línea 3**
  y deshabilitó la simulación.
  Las dos filas importadas simularon con **Wq = 0 min** y **W = 2,875 min**.
  Dos réplicas completaron con progreso **100 %** (Wq medio **0,051 min**,
  IC 95 % **[−0,600; 0,703]**); con una réplica se mostró el aviso de IC no
  estimable. Se inspeccionó el Blob JSON (versión **1**, 2 filas), se cargó el
  archivo y se abrió el hash válido (**1.419 caracteres** para el preajuste
  observado); un hash corrupto inició `observados`.
  Ancho de documento: **1366 px** en escritorio y **375 px** en móvil, sin
  desbordamiento horizontal en ninguno.
- **Archivos:** `index.html`, `src/ui/laboratorio.js`,
  `src/ui/estilos.css`, `src/engine/simulador.js`,
  `src/engine/replicas.js`, `tests/laboratorio.test.js`,
  `tests/simulador.test.js`, `tests/replicas.test.js`, `docs/PLAN.md`,
  `docs/PROGRESO.md` y `docs/DECISIONES.md`.
- **Pruebas:** `node --test`: **54 aprobadas, 0 fallidas**; incluye CSV propio
  y exportado, línea exacta y límite, ida/vuelta JSON/hash, límites y
  determinismo de réplicas. `node --check` y `git diff --check`: sin errores.
- **Pendientes:** fase 7: comparación de escenarios y traslado de las réplicas
  a Web Worker; las demás fases siguen abiertas.

## 2026-11-09 — Verificación previa a la fase 6 y perfilado

- **Hecho:** servido el sitio con `python -m http.server 8000` y probado en
  Playwright a **1366×768** y **390×844**. Los cuatro preajustes completaron
  simulación en ambos tamaños, sin errores de consola ni errores en la
  interfaz. Duplicar/quitar ventanilla cambió la lista de **3→4→3**. «Volver
  a los datos observados» restauró hora pico con **71 filas**, **7 esperas** y
  **Wq = 0,155 min**. No se añadieron botones porque ya existían y funcionaban.
- **Rendimiento:** `perfil_rendimiento.js`, 131 pacientes/262 eventos:
  recorrido **17,03 ms**, 500 frames **7,41 ms** (**0,0148 ms/frame**) y
  búsqueda binaria **0,17 ms** frente a **1,38 ms** lineal. Se cambiaron las
  instancias para actualizar solo pacientes visibles y los colores solo cuando
  cambian; las etiquetas se dibujan una vez por frame y su canvas usa la
  resolución del renderizador. En el mismo recorrido a 30×, antes se midieron
  **22–23 fps** (7 muestras) y después **21–22 fps** en las seis muestras
  estables; no se sostiene la meta de 30 fps. Un perfil CPU de 5 s no mostró
  una función JavaScript dominante (≈**85 %** de muestras ociosas). Probar
  pixel ratio 0,4 no elevó los fps y se revirtió a 0,5.
- **CSV:** Playwright no emitió `download` con `page.waitForEvent('download')`,
  ni para una descarga CSV independiente de control; el entorno integrado no
  produjo archivo. Sí se comprobó el Blob preparado por la aplicación: UTF-8
  con BOM, **132 líneas** (encabezado + **131 pacientes**) y sus nueve campos
  coinciden con las **131 filas** de la tabla. La recepción del archivo real
  queda pendiente de un navegador que permita descargas.
- **Archivos:** `src/escena/local3d.js`, `README.md`, `docs/PROGRESO.md` y
  `docs/DECISIONES.md`.
- **Pruebas:** `node --test`: **48 aprobadas, 0 fallidas**; `node --check` y
  `git diff --check`: sin errores.
- **Pendientes:** verificar el evento/archivo descargado en un navegador con
  descargas habilitadas; el render no alcanza 30 fps en este entorno. Fases
  6–9 siguen abiertas.

## Estado actual para transferencia

- **Completas:** fases **0 a 5** (esqueleto e inicio de git; exportación de
  datos; motor; modo observados; escena 3D; animación/HUD, incluidas las
  Entregas A y B).
- **Abiertas:** fases **6 a 9** (laboratorio; réplicas y comparación; pulido;
  despliegue en GitHub Pages). No se inicia trabajo de esas fases en esta
  transferencia.

## Pendientes antes de la fase 6

- **Rendimiento:** tras optimizar la escena, con 131 pacientes se midieron
  **21–22 fps** estables; no se afirma que alcance 30 fps.
- **CSV:** contenido preparado y contrastado con la tabla, pero falta verificar
  el evento y la recepción del archivo en un navegador con descargas habilitadas.
- **Cambio de `src/engine/simulador.js` en la Entrega A:** se añadió el campo
  `paciente_tipo: paciente.tipo` al objeto de cada evento. Es un dato aditivo
  del registro para identificar el grupo en la escena; no altera el calendario
  ni las métricas.

## 2026-11-09 — Entrega B: resumen final y exportación CSV

- **Hecho:** añadido un resumen que aparece al terminar toda la selección y
  muestra los pacientes, quienes esperaron y Wq desde la comparación ya
  calculada, sin recomputar métricas. El botón permite descargar una fila por
  paciente en CSV UTF-8, con encabezados en español, separador `;` y decimales
  locales. Los errores al preparar datos o exportar se muestran en la interfaz.
- **Archivos:** `index.html`, `src/ui/app.js`, `src/ui/estilos.css`,
  `src/ui/exportar-csv.js`, `tests/exportar_csv.test.js`, `README.md`,
  `docs/PLAN.md`, `docs/PROGRESO.md` y `docs/DECISIONES.md`.
- **Resultados:** `node --test`: **38 aprobadas, 0 fallidas**; `node --check`
  para los módulos modificados y `git diff --check`: sin errores. En Playwright,
  «Los tres» y hora pico mostró al finalizar **71 pacientes**, **7 esperas** y
  **Wq = 0,155 min**; el panel se ocultó antes del final y se habilitó al
  completarlo. El manejador preparó
  `pharmasan-reproduccion-los-tres-hora-pico.csv`.
- **Pendiente:** verificar la recepción real del archivo descargado; las fases
  6–9 siguen abiertas.

## 2026-11-09 — Entrega A: animación de pacientes desde eventos

- **Hecho:** añadidos pacientes low-poly instanciados con identificador y color
  por grupo; recorridos de entrada, fila, ventanilla y salida interpolados desde
  el registro de eventos. Los anillos muestran el umbral de espera, las
  ventanillas cambian de estado y presentan progreso de servicio. Los controles
  existentes ahora reproducen los eventos por día, incluyen velocidad de
  0,5×–30× y reinicio con liberación de mallas y materiales dinámicos. La
  animación no consulta la tabla de pacientes ni modifica métricas; Wq final
  procede del resumen ya calculado de la comparación observada.
- **Archivos:** `index.html`, `src/engine/simulador.js`,
  `src/escena/local3d.js`, `src/escena/personas.js`, `src/ui/app.js`,
  `src/ui/estilos.css`, `src/ui/reproduccion-observados.js`,
  `tests/personas.test.js`, `tests/reproduccion_observados.test.js`,
  `tests/simulador.test.js`, `docs/PLAN.md`, `docs/PROGRESO.md`,
  `docs/DECISIONES.md` y `README.md`.
- **Resultados:** «Los tres», hora pico: **71 pacientes**, **7 esperaron** y
  **Wq = 0,155 min**, iguales a la tabla. Jornada completa: **131 pacientes**;
  las corridas por día se mantienen separadas y el máximo simultáneo registrado
  es **4**. `node --test`: **35 aprobadas, 0 fallidas**. Playwright:
  **1366×768** y **390×844**, sin scroll horizontal; a 390 px la escena mide
  aproximadamente **45 svh**. Con la carga de 131 pacientes y cuatro visibles,
  el navegador de prueba midió **23–28 fps** en cuatro muestras consecutivas;
  no se sostuvo la meta de 30 fps en ese navegador.
- **Pendiente:** optimizar el rendimiento para alcanzar la meta de 30 fps; las
  mediciones registradas para 131 pacientes están entre 21 y 28 fps.

## 2026-11-09 — Diseño adaptable prioritario para PC y controles HUD

- **Hecho:** reorganizada la página para usar una escena amplia y columna
  lateral fija desde 1280 px; en móvil la escena va primero y ocupa 45 svh,
  seguida por controles/HUD apilados. El HUD compacto presenta reloj, llegados,
  atendidos, filas y Wq; las métricas secundarias quedan plegadas. Añadidos
  controles de reproducción/pausa, saltos y barra temporal, con atajos espacio,
  flechas y 1/2/3 para vistas. En ancho móvil la escena reduce automáticamente
  resolución y desactiva sombras, independiente de la cantidad de personas.
- **Archivos:** `index.html`, `src/ui/estilos.css`, `src/ui/app.js`,
  `src/escena/local3d.js`, `docs/PLAN.md`, `docs/PROGRESO.md` y
  `docs/DECISIONES.md`.
- **Resultados Playwright:** 1366×768: escena **936×528 px**, columna lateral
  **370 px**, control de carga visible, sin scroll de página ni desbordamiento
  horizontal; la escena y la columna no se superponen. 390×844: canvas
  **336×378 px** (45 svh), HUD debajo de la escena, calidad reducida activa,
  botones desde **44 px**, scroll horizontal **no**. Se verificaron la carga
  de reproducción, actualización del HUD, pausa/continuación, salto con flecha
  y vista cenital con tecla 1. `node --test`: **32 aprobadas, 0 fallidas**.
- **Pendiente:** fase 5 sigue abierta para animación de pacientes, que no se
  implementa en esta tarea.

## 2026-11-09 — Maqueta arquitectónica 3D del local

- **Hecho:** solicitadas fotos/medidas y distribución antes de modelar. El
  usuario no tiene fotos ni medidas e indicó la puerta a la izquierda de las
  ventanillas y la espera al frente; se rotuló la escena como
  «Representación esquemática, no a escala». Construida planta Three.js con
  entrada, paredes bajas, mostrador y V1/V2 General, V3 Adulto Mayor,
  estantería, señal preferencial, dos filas delimitadas por postes/cintas con
  30 posiciones cada una y sillas instanciadas. Se añadieron iluminación,
  sombras, fondo degradado CSS, cámara orbital adaptable y vistas cenital,
  isométrica, frontal y «Ver fila». La escena no incluye personas.
- **Archivos:** `src/escena/local3d.js`, `src/escena/camara.js`, `src/ui/app.js`,
  `src/ui/estilos.css`, `index.html`, `tests/escena.test.js`, `README.md`,
  `docs/PLAN.md`, `docs/PROGRESO.md` y `docs/DECISIONES.md`.
- **Resultados:** **60** posiciones de fila, **12** sillas instanciadas,
  estantería por instancias; render limitado a **30 fps** y calidad reducida
  desde **120 personas**. `node --test`: **32 aprobadas, 0 fallidas**; escena
  servida localmente y revisada en navegador. Capturas de las vistas cenital,
  isométrica y frontal entregadas para revisión.
- **Pendiente:** revisar la maqueta con el usuario; ajustar la planta si aporta
  medidas/fotos y continuar fase 5 (animación/HUD), sin animar personas en esta
  tarea.

## 2026-11-09 — Selector y reproducción de observaciones

- **Hecho:** comparado el Prompt 3 con lo implementado. El motor y su prueba
  cubrían replay, pero faltaban selectores de día/tramo, la opción visible de
  reproducir las atenciones reales, la comparación y las vistas para usuarios.
  Añadidos selector Lunes/Martes/Viernes/Los tres, tramo hora pico/jornada,
  panel de cifras verificadas, comparación con diferencias y estados verde o
  ámbar con explicación, tabla y línea de tiempo por día/ventanilla.
- **Archivos:** `index.html`, `src/ui/app.js`, `src/ui/estilos.css`,
  `src/ui/reproduccion-observados.js`, `tests/reproduccion_observados.test.js`,
  `README.md`, `docs/PLAN.md`, `docs/PROGRESO.md` y `docs/DECISIONES.md`.
- **Resultados:** Los tres días, hora pico: **71 pacientes**, **7 esperaron**,
  Wq **0,155 min**; diferencias contra cifras verificadas: **0, 0 y 0**.
  Jornada completa en los tres días: **131 pacientes**, **15 esperaron**.
  `node --test`: **29 pruebas aprobadas, 0 fallidas**; validación en navegador
  de los controles, comparación y reproducción de Lunes jornada completa (**47
  pacientes**). `data/observados.json` y `src/engine/` no se modificaron.
- **Pendiente:** fase 4, crear la escena 3D.

## 2026-11-09 — Simulación observada y comparación Python en la interfaz

- **Hecho:** conectado el botón «Volver a simular con las llegadas observadas»
  a `crearConfiguracionBase(datos)` y a 500 réplicas. El panel compara el Wq
  promedio con la referencia base exportada y resalta en verde los resultados
  dentro de su IC 95 %. No se usaron los 68 intervalos globales ni se modificó
  `data/observados.json`.
- **Archivos:** `index.html`, `src/ui/app.js`, `src/ui/estilos.css`,
  `README.md`, `docs/PLAN.md`, `docs/PROGRESO.md` y `docs/DECISIONES.md`.
- **Resultados:** semillas 20261101–20261600; Wq simulado **0,152560 min**,
  referencia Python **0,153536 min**, IC 95 % **[0,137024; 0,170048] min**.
  La interfaz mostró «Dentro del IC 95 % de Python». `node --test`: **24
  pruebas aprobadas, 0 fallidas**; sintaxis JS y `git diff --check` correctos.
- **Pendiente:** fase 4, crear la escena 3D.

## 2026-11-09 — Sincronización de intervalos de confianza de Wq

- **Hecho:** actualizado `data/observados.json` desde el exportador del
  repositorio `pharmasan-sim`, con los límites del IC 95 % del Wq medio en
  todos los escenarios, sin añadir cifras manualmente.
- **Archivos:** `data/observados.json`, `docs/PROGRESO.md` y
  `docs/DECISIONES.md`.
- **Resultados:** los intervalos del escenario base son
  `[0.137023803739987, 0.1700480084692139]`; las copias de ambos proyectos
  coinciden byte por byte. La suite Python completa pasó 71 pruebas.
- **Pendiente:** ninguno para la exportación; continuar la fase activa del plan.

## 2026-11-09 — Diagnóstico y corrección del caso base

- **Hecho:** trazada la implementación Python; aisladas las hipótesis de
  llegadas y asignación con 500 réplicas; añadido un constructor de caso base
  por grupo y una prueba estricta contra el IC 95 % Python. Se conservó la
  alternativa de conteos uniformes como `conteos_uniformes`.
- **Archivos:** `src/ui/observados.js`, `src/engine/simulador.js`,
  `tests/diagnostico_base.test.js`, `tests/simulador.test.js`,
  `data/observados.json`, `README.md`, `docs/DECISIONES.md` y
  `docs/PROGRESO.md`.
- **Resultados:** semillas 20261101–20261600, Erlang ajustado y horizonte de
  60 min en todas las variantes. Wq: uniforme + primera libre **0,256980**;
  uniforme + aleatoria **0,256980**; 68 intervalos globales + aleatoria
  **0,874050**; interllegadas Python por grupo (44 General, 21 Preferencial) +
  primera libre **0,152560**; misma configuración + aleatoria **0,152560**.
  Python: media **0,153536**, IC 95 % **[0,137024; 0,170048]**. La causa es
  remuestrear intervalos globales mezclados/uniformes en lugar de los conjuntos
  empíricos positivos independientes por grupo y día; la asignación no explica
  la diferencia observada. `node --test`: **24 pruebas aprobadas, 0 fallidas**.
- **Pendiente:** continuar la fase 3. La prueba comparativa usa el intervalo
  Python exportado y exige que la media JS de 500 réplicas caiga dentro de él.

| Variante (500 réplicas) | Wq medio (min) |
|---|---:|
| Conteos uniformes, primera libre | 0,256980 |
| Conteos uniformes, aleatoria | 0,256980 |
| 68 intervalos mezclados, aleatoria | 0,874050 |
| Interllegadas por grupo Python (44 G + 21 P), primera libre | 0,152560 |
| Interllegadas por grupo Python (44 G + 21 P), aleatoria | 0,152560 |
| Referencia Python (IC 95 %) | 0,153536 [0,137024; 0,170048] |

## 2026-11-09 — Motor de eventos discretos

- **Hecho:** implementados PRNG Mulberry32 con flujos separados, montículo de
  eventos, distribuciones, simulación de colas, métricas y réplicas con IC t de
  Student; añadidas pruebas de reproducibilidad, teoría y replay observado.
- **Archivos:** `src/engine/*.js` (6), `tests/*.js` (8), `README.md`,
  `docs/PLAN.md`, `docs/DECISIONES.md` y `docs/PROGRESO.md`.
- **Resultados:** `node --test`: 22 pruebas aprobadas, 0 fallidas; M/M/1 y M/M/2
  dentro del IC 95 % para Wq y Lq; 131 llegadas reproducidas, 71 en pico,
  Wq pico 0,155 min y 7 esperas. En 500 réplicas base, Wq=0,2570 min frente a
  0,1535 min de referencia (diferencia 0,1034 min).
- **Pendiente:** revisar la diferencia de llegadas entre los conteos uniformes
  por intervalos de cinco minutos y el remuestreo de interllegadas Python; no
  se ajustaron parámetros para forzar la coincidencia. Continuar fase 3.

## 2026-11-09 — Exportación de datos observados

- **Hecho:** recibido desde `pharmasan-sim` el JSON con pacientes observados,
  franja pico, conteos de llegadas, ajustes de atención y referencias Python.
- **Archivos:** `data/observados.json`, `docs/PLAN.md`, `docs/PROGRESO.md` y
  `docs/DECISIONES.md`.
- **Resultados:** 131 registros observados y 71 pacientes en pico; las cifras
  verificadas se calculan desde los datos fuente y coinciden con el contexto.
  La fase 1 de exportación queda completada.
- **Pendiente:** implementar la vista de datos observados de acuerdo con la fase 3.

## 2026-11-09 — Creación del esqueleto inicial

- **Hecho:** creada la estructura estática del proyecto, sus módulos ES vacíos,
  documentación y plan de nueve fases; incorporadas Three.js y OrbitControls
  r160 con importación local.
- **Archivos:** `index.html`, `README.md`, `AGENTS.md`, `.gitignore`,
  `src/engine/*.js` (6), `src/escena/*.js` (4), `src/ui/*` (5),
  `data/observados.json`, `vendor/three/*`, `tests/`, `.github/workflows/pages.yml`
  (marcador pendiente), `docs/PLAN.md`, `docs/PROGRESO.md` y
  `docs/DECISIONES.md`.
- **Resultados:** 9 fases registradas; 6 módulos de motor vacíos; 0 lógica de
  simulación implementada; 3 archivos locales de Three.js (biblioteca,
  OrbitControls y licencia); 16 archivos JavaScript con sintaxis válida y 4/4
  recursos verificados por HTTP local.
- **Pendiente:** exportar datos observados y abordar las fases 1–9 en orden.
