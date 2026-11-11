# Progreso

## 2026-11-11 — Mejora la figura y la animación de las personas

- **Figura y movimiento:** se reemplazaron las formas rígidas por una figura
  low-poly redondeada con torso, cuello, cabeza y cabello, brazos, piernas,
  zapatos y bastón para Preferencial. Piel, cabello y ropa varían de forma
  determinista por identificador; General conserva el acento verde y
  Preferencial el naranja. El balanceo se deriva de la distancia recorrida, y
  la quietud/gesto de atención del estado y tiempo del evento.
- **Rendimiento:** en Chromium headless con ANGLE/SwiftShader, a 1366×768 y con
  semilla 20261111, se compararon tres muestras de corridas reproducibles con
  71 y 300 pacientes. Antes/después: 71 pacientes **2, 1, 2 / 2, 1, 2 fps**
  (media **1,67 / 1,67 fps**); 300 pacientes **3, 4, 4 / 4, 3, 3 fps**
  (media **3,67 / 3,33 fps**, descenso del **9,1 %**). El entorno usa
  renderizado por software y no representa una GPU física; no se promete
  alcanzar 30 fps. Para contener el coste se usa geometría icosaédrica low-poly
  y solo se dibujan las instancias activas.
- **Recursos y pruebas de escena:** Playwright comprobó píxeles de personas en
  **1366×768** y **390×844**, `count` coherente, matrices finitas, colores,
  `frustumCulled=false` y veinte recargas. El máximo y valor final fue de
  **40 geometrías/10 texturas** en escritorio y **36/8** en móvil, sin
  crecimiento acumulado.
- **Teoría:** la referencia M/M/c también se suprime si una configuración de
  filas separadas mezcla ventanillas dedicadas y flexibles; ese sistema no
  cumple la hipótesis de dos colas independientes.
- **Pruebas:** `node --test`: **58 aprobadas, 0 fallidas**. Playwright aprobó
  la escena en **1366×768** y **390×844**, verificó datos y Three.js bajo
  `/pharmasan-web/` y comprobó veinte recargas en cada tamaño. Las pruebas de
  replay mantienen **71 pacientes, 7 esperas y Wq = 0,155 min** en hora pico
  y **131 pacientes** en jornada completa. Se generaron cinco capturas de la
  corrida reproducible: entrada, fila de 60 personas, camino a ventanilla y
  salida en escritorio, más la fila en móvil.
- **Archivos:** `src/escena/instancias-personas.js`,
  `src/escena/personas.js`, `src/escena/local3d.js`,
  `src/ui/laboratorio.js`, `tests/personas.test.js`, `tests/escena.test.js`,
  `tests/escena-browser.test.js`, `tests/laboratorio.test.js`,
  `docs/PROGRESO.md` y `docs/DECISIONES.md`.
- **Pendientes:** no se hizo push, por lo que GitHub Actions no tiene una nueva
  ejecución remota de estos commits; su workflow sí quedó revisado y ejecuta
  `npm ci`, instala Chromium y corre `node --test`.

## 2026-11-11 — Renombra a Simular aleatoriamente

- **Hecho:** el título de la sección, su pestaña, la descripción accesible del
  conjunto de pestañas y el paso correspondiente del recorrido inicial ahora
  dicen «Simular aleatoriamente». README, mensajes de error, nombres de descarga
  y etiquetas de la reproducción también usan el nombre nuevo. Se mantienen
  IDs y nombres de módulos internos para no romper referencias.
- **Accesibilidad y navegador:** Playwright verificó el nombre del encabezado,
  pestaña y tablist accesible, el texto del recorrido, «Acerca de» y que no haya
  menciones visibles a «Laboratorio para la docente» o «docente». La escena
  conservó la prueba visual en **1366×768** y **390×844**.
- **Pruebas:** `node --test`: **55 aprobadas, 0 fallidas**; `git diff --check`
  sin errores.
- **Archivos:** `index.html`, `README.md`, `src/ui/app.js`,
  `src/ui/exportar-csv.js`, `src/ui/laboratorio.js`,
  `tests/escena-browser.test.js`, `tests/exportar_csv.test.js`,
  `docs/PROGRESO.md` y `docs/DECISIONES.md`.
- **Pendientes:** no se hizo push ni se verificó GitHub Actions; faltan la
  verificación final bajo el subdirectorio `/pharmasan-web/` y las pruebas de
  las mejoras visuales de las personas.

## 2026-11-11 — Deja solo llegadas Poisson y servicio exponencial

- **Modelo:** el laboratorio y la simulación aleatoria del pico ahora usan
  únicamente llegadas Poisson por grupo y servicio exponencial. Las tasas
  predeterminadas se calculan desde el pico observado: **47 General/h** y
  **24 Preferencial/h**; las medias de servicio calculadas desde el JSON son
  **4,1236 min** y **5,0238 min**, respectivamente. Se retiraron los modos
  adicionales de llegadas, distribuciones de servicio y carga CSV propia.
- **Datos observados:** la reproducción exacta permanece separada y mantiene
  **131 pacientes** en la jornada completa y **71 pacientes, 7 esperas,
  Wq = 0,155 min** en la hora pico. «Volver a simular» genera ahora datos
  aleatorios con tasas estimadas; ya no compara con la referencia Python del
  modelo Erlang anterior.
- **Resultados teóricos:** el panel presenta Wq y Lq simulados, teóricos y sus
  diferencias en escenarios M/M/c estables y compatibles con las hipótesis.
  Las pruebas M/M/1 y M/M/2 cotejan ambos indicadores con las fórmulas
  analíticas. La advertencia de inestabilidad permite ejecutar la simulación.
- **Configuración:** JSON y hash pasan a versión **2**; las configuraciones
  anteriores o con campos retirados muestran un aviso y cargan valores
  predeterminados derivados de las observaciones.
- **Pruebas:** `node --test`: **55 aprobadas, 0 fallidas**. Playwright verificó
  el panel teórico y la escena en **1366×768** y **390×844**. La prueba de replay
  confirma las cifras de pico y la preservación de los 131 registros.
- **Archivos:** `index.html`, `README.md`, `src/engine/distribuciones.js`,
  `src/engine/metricas.js`, `src/engine/replicas-worker.js`,
  `src/engine/simulador.js`, `src/engine/teoria.js`, `src/ui/app.js`,
  `src/ui/laboratorio.js`, `src/ui/observados.js`, pruebas de motor,
  laboratorio, métricas, réplicas, worker, teoría y escena, además de
  `docs/PROGRESO.md` y `docs/DECISIONES.md`.
- **Pendientes:** no se hizo push ni se verificó una ejecución remota de GitHub
  Actions; faltan las verificaciones finales bajo `/pharmasan-web/` y las
  correcciones visuales restantes del encargo.

## 2026-11-11 — Anima el recorrido completo de los pacientes

- **Hecho:** cada paciente aparece en el exterior, cruza la puerta, llega a
  su posición de fila, camina cuando la fila cambia, se desplaza a la
  ventanilla desde el inicio de servicio y sale por la puerta después del fin.
  Las trayectorias se consultan directamente por tiempo, por lo que avanzar,
  retroceder y saltar no depende del fotograma anterior ni altera el motor.
- **Filas:** se mantuvieron las primeras 30 posiciones y se agregó un segundo
  tramo separado, delimitado por postes y cintas; quedan **60 posiciones por
  grupo (120 en total)**. Una prueba con **61 personas General** confirma que
  sus posiciones no se repiten y permanecen dentro del local.
- **Continuidad:** la velocidad está acotada a **28 unidades de escena/minuto**.
  La prueba recorre una corrida en pasos de **0,01 min**, comprueba
  desplazamientos de hasta **0,281 unidades**, el estado al saltar hacia
  delante y atrás y la entrada desde el exterior.
- **Verificación:** `node --test`: **65 aprobadas, 0 fallidas**. Playwright
  mantuvo la prueba de píxeles en **1366×768** y **390×844**, sin fallos.
- **Archivos:** `src/escena/personas.js`, `src/escena/local3d.js`,
  `tests/personas.test.js`, `tests/escena.test.js`, `docs/PROGRESO.md` y
  `docs/DECISIONES.md`.
- **Pendientes:** el límite visual soportado de fila se amplía de 30 a 60
  posiciones por grupo; no se midió rendimiento en esta corrección.

## 2026-11-10 — Corrige el recorte de personas en la escena 3D

- **Causa confirmada:** Three.js r160 calculaba la `boundingSphere` de las
  mallas instanciadas cuando todas las personas estaban ocultas en `y=-100`.
  `setMatrixAt()` no invalida esa esfera; al avanzar, `frustumCulled` seguía
  activo y recortaba los cuerpos, cabezas, piernas y anillos ya trasladados.
  Se desactivó el recorte por objeto para esas cuatro mallas y se unificó la
  posición visual del cuerpo y su etiqueta durante el servicio.
- **Comparación histórica:** la misma inicialización y falta de invalidación
  aparecen en `bc61d78^`; ese commit optimizó las escrituras de matrices y
  colores, pero no introdujo la esfera obsoleta. `count`, índices, matrices,
  colores y materiales se mantuvieron válidos. La respuesta de red de
  `local3d.js` en la prueba local coincide por SHA-256 con el archivo fuente.
- **Prueba visual:** Playwright comparó capturas con el recorte activado y
  desactivado, y leyó los píxeles en la posición proyectada de cada paciente.
  En Chromium con Intel Iris Xe aparecieron **344 píxeles General y 343
  Preferencial**; no hubo errores de consola. En Chromium/SwiftShader, a
  **1366×768**, Observados mostró **338 General y 357 Preferencial**; Laboratorio,
  **328 y 338 General y 357 Preferencial**. A **390×844**, Observados mostró
  **247, 259 y 258 General y 277 Preferencial**; Laboratorio, **257 General y
  276 Preferencial**.
  Las cuatro mallas tuvieron matrices y colores finitos, cuenta coherente y
  `frustumCulled=false`; tres reinicios por tamaño y el cambio Laboratorio ↔
  Observados terminaron sin errores.
- **Rendimiento medido:** con 71 pacientes en Intel Iris Xe, la escena dio
  **22–23 fps**, frente a los **21–22 fps** medidos antes. En SwiftShader dio
  **7 fps** con recorte desactivado y **6–7 fps** al reactivarlo; el navegador
  por software es más lento y no representa el rendimiento con GPU.
- **Pruebas:** `node --test`: **63 aprobadas, 0 fallidas**. La prueba Playwright
  cubre ambos tamaños, modos, colores de grupo, estado de mallas, píxeles,
  hash del módulo servido, reinicios y cambio de modo.
- **Pendiente:** la URL publicada no se pudo comprobar porque la solicitud
  conserva el marcador `[pon aquí: enlace publicado / local]`; se verificó la
  aplicación servida desde el repositorio local.
- **Archivos:** `src/escena/local3d.js`, `tests/escena-browser.test.js`,
  `package.json`, `package-lock.json`, `.github/workflows/pages.yml`,
  `docs/PROGRESO.md` y `docs/DECISIONES.md`.

## 2026-11-10 — Fase 9: despliegue en GitHub Pages

- **Hecho:** se reemplazó el marcador del workflow por publicación en cada
  `push` a `main` y ejecución manual. El despliegue solo se ejecuta desde
  `main`, espera el trabajo de pruebas y usa concurrencia para evitar
  publicaciones simultáneas. Se fijaron permisos mínimos por trabajo, Node 20
  y las acciones oficiales `checkout@v7`, `setup-node@v7`,
  `configure-pages@v6`, `upload-pages-artifact@v5` y `deploy-pages@v5`.
- **Artefacto:** el workflow copia únicamente `index.html`, `src/`, `data/`,
  `vendor/` y `.nojekyll` a `dist`; la carga incluye archivos ocultos. Se
  añadieron `.nojekyll` y las instrucciones de ejecución, pruebas, actualización
  de datos y publicación en `README.md`.
- **Rutas y subdirectorio:** no se encontraron rutas de aplicación que
  empiecen por `/` ni referencias a `http://localhost` en `index.html` y
  `src/`. Servida desde el directorio padre bajo `/pharmasan-web/`, la página
  cargó `data/observados.json`, Three.js local y
  `src/engine/replicas-worker.js`. A **1366×768** y **390×844** no hubo scroll
  horizontal ni errores de consola/página.
- **Verificación funcional:** el modo observado mostró **71 pacientes**,
  **7 de 71** con espera y **Wq = 0,155 min** en la hora pico; la jornada
  completa indica **131 pacientes**. En laboratorio se completaron una
  simulación de **22 pacientes**, **2 réplicas** y una comparación de un
  escenario con **2 réplicas**. El enlace compartido midió **1.431 caracteres**;
  al abrirlo de nuevo cargó la configuración y mostró «Configuración cargada
  desde el enlace». En la carga de 71 pacientes se midieron **21–23 fps** en
  esta sesión; no se promete 30 fps.
- **Pruebas:** `node --test`: **60 aprobadas, 0 fallidas**. `git diff --check`
  y la inspección de la lista de archivos versionados no encontraron errores
  ni archivos locales, credenciales o perfiles generados.
- **Publicación pendiente:** no se hizo `git push`. Por ello todavía no se
  verificó la ejecución real de GitHub Actions ni la URL pública; la fuente de
  Pages debe configurarse como GitHub Actions.
- **Archivos:** `.github/workflows/pages.yml`, `.nojekyll`, `README.md`,
  `docs/PLAN.md`, `docs/PROGRESO.md` y `docs/DECISIONES.md`.

## 2026-11-10 — Fase 8: pulido, accesibilidad y gestión de recursos

- **Hecho:** se ajustó la jerarquía tipográfica y el foco visible, se agregó
  plegado del panel lateral y modo presentación con escena a pantalla completa
  y HUD superpuesto. Se incorporaron recorrido inicial de cuatro pasos,
  reapertura desde la interfaz, «Acerca de» con metadatos de
  `data/observados.json`, atajos documentados y avisos para WebGL/datos no
  disponibles. La lectura y escritura de `localStorage` están protegidas.
  Reiniciar y cambiar de corrida liberan geometrías y materiales de pacientes;
  el render informa sus conteos de geometrías y texturas.
- **Diseño y accesibilidad:** antes, los botones de vista medían **40 px** y
  el foco verde claro tenía contraste **1,90:1**. Ahora todos los botones
  visibles miden al menos **44 px** y el foco oscuro alcanza **8,31:1**.
  Ratios calculados: texto principal **12,27:1**, texto secundario **6,62:1**,
  botón primario **7,17:1**, secundario **8,60:1** y error **7,51:1**; todos
  superan el mínimo AA de **4,5:1** para texto normal. Las entradas visibles
  tienen etiqueta. Las pestañas admiten flechas y conservan un único punto
  de tabulación.
- **Responsive:** a **1366×768**, **1920×1080**, **768×1024** y **390×844** no
  hubo scroll horizontal. La escena midió respectivamente **936×523**,
  **1490×834**, **383×674** y **338×380 px** en modo normal. El panel plegado
  amplió la escena a **1316 px**; presentación ocupó **1366×768** y, en móvil,
  **390×844**, sin overflow.
- **Memoria y rendimiento:** tras **20 corridas alternadas** (10 observadas,
  10 de laboratorio), el renderer se mantuvo en **37 geometrías y 10
  texturas**. El heap JS observado pasó de **11.038.793** a **12.994.800
  bytes**, con muestras intermedias no monótonas de **12.410.324** a
  **15.486.205 bytes**; no hubo crecimiento sostenido de recursos GPU. Con
  71 pacientes se midieron **21 fps** (muestras de corrida, **20–23 fps**);
  no se promete 30 fps.
- **Fallos comprobados:** al forzar WebGL no disponible, se mostró el aviso y
  funcionaron la reproducción de **71 pacientes** y la simulación de
  laboratorio de **22 pacientes**. Una respuesta HTTP **404** para el JSON
  dejó la página visible, indicó el error y mantuvo deshabilitados los modos
  observados. El recorrido se pudo omitir y volver a abrir; tampoco falló con
  `localStorage` bloqueado.
- **Archivos:** `index.html`, `data/observados.json`, `src/ui/app.js`,
  `src/ui/estilos.css`, `src/ui/laboratorio.js`, `src/escena/local3d.js`,
  `docs/PLAN.md`, `docs/PROGRESO.md` y `docs/DECISIONES.md`.
- **Pruebas:** `node --test`: **60 aprobadas, 0 fallidas**; `node --check` y
  `git diff --check`: sin errores.
- **Pendientes:** completar fase 9 y repetir la validación en equipo/navegador
  real antes de la entrega.

## 2026-11-10 — Fase 7: comparación de escenarios en Web Worker

- **Hecho:** se añadió la pestaña Comparar para guardar hasta **4 escenarios
  nombrados**, ejecutar réplicas con semillas comunes, mostrar una tabla con
  medias e IC 95 % de Wq, Lq, rho por ventanilla y esperas sobre el máximo,
  indicar el criterio y graficar Wq con intervalos. El barrido opcional cubre
  demanda ×1,0–×2,0 en pasos de 0,1 e informa el primer factor que incumple.
  La corrida de réplicas del laboratorio y la comparación usan el mismo Web
  Worker de módulo, con progreso cada **10 réplicas** y cancelación sin
  resultados parciales.
- **Navegador:** a 1366×768 y 390×844 no hubo desbordamiento horizontal ni
  errores de consola/página. Una comparación con **2 escenarios × 3 réplicas**
  llegó a **66/66**, mostró el factor de progreso numérico ×1,1, **2 filas**,
  gráfico y resultados del barrido. La corrida de **1.000 réplicas** completó
  mientras la interfaz aceptó cambiar la vista de cámara (el progreso avanzó
  de **70 a 180** durante la interacción); cancelar otra corrida preservó el
  resultado previo y no mostró resultados parciales.
- **Rendimiento del worker:** en el escenario observado, **100 réplicas: 0,208
  s; 1.000 réplicas: 0,792 s**. Una réplica también completó y mostró medias
  sin estimar un IC. Bajo la ruta con prefijo `/pharmasan-web/`, la app cargó y
  el módulo `src/engine/replicas-worker.js` respondió **HTTP 200**; la corrida
  terminó sin errores.
- **Enlaces:** la configuración observada generó **1.397 caracteres**. Un CSV
  válido de **100 filas** generó **3.674 caracteres** y mostró el aviso por
  superar 2.000, recomendando «Descargar configuración (JSON)».
- **Archivos:** `index.html`, `src/ui/estilos.css`,
  `src/ui/laboratorio.js`, `src/engine/replicas.js`,
  `src/engine/replicas-worker.js`, `src/engine/replicas-worker-client.js`,
  `tests/replicas_worker.test.js`, `docs/PLAN.md`, `docs/PROGRESO.md` y
  `docs/DECISIONES.md`.
- **Pruebas:** `node --test`: **60 aprobadas, 0 fallidas**; incluye paridad
  worker/síncrono, réplica única sin IC, semillas comunes, barrido y
  cancelación. `node --check` y `git diff --check`: sin errores.
- **Pendientes:** fases 8 (pulido) y 9 (despliegue en GitHub Pages).

## 2026-11-09 — Corrección visual de pacientes en la escena 3D

- **Hecho:** el fallo también se reproduce en `1633743`, anterior a
  `bc61d78`; por tanto, la optimización de instancias no lo introdujo.
  `count`, matrices y colores eran válidos. La causa era el tamaño aparente
  de los cuerpos frente a la maqueta y el solapamiento de las cabezas con las
  etiquetas. Se separaron y ampliaron las transformaciones de cuerpo, cabeza,
  piernas y anillo; se elevaron las etiquetas. Se desactivaron sombras de
  pacientes y se limitó el pixel ratio de escritorio a 1,25.
- **Navegador:** reproducción observada con **71 pacientes** y **5 visibles**
  en el fotograma validado; Playwright a **1366×768** y **390×844**, sin
  errores de página ni desbordamiento horizontal. Las capturas muestran
  pacientes del grupo General en verde y Preferencial/Adulto Mayor en naranja.
  Rendimiento medido: **21 fps** en escritorio y **21 fps** en móvil, frente
  a los **21–22 fps** medidos antes de la corrección. La meta de 30 fps no se
  sostiene.
- **Archivos:** `src/escena/instancias-personas.js`,
  `src/escena/local3d.js`, `tests/escena.test.js`, `docs/PROGRESO.md` y
  `docs/DECISIONES.md`.
- **Pruebas:** `node --test tests/escena.test.js tests/personas.test.js`:
  **7 aprobadas, 0 fallidas**; `node --check` y `git diff --check`: sin errores.
- **Pendientes:** continuar con la fase 7 después de guardar esta corrección
  en un commit separado.

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
