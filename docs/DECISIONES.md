# Decisiones

- Las rutas visuales de los pacientes se construyen una sola vez desde los
  estados y tiempos del motor, y el fotograma se calcula directamente para el
  instante solicitado. Se limita la velocidad a **28 unidades de escena por
  minuto**, se inicia fuera de la puerta y solo se elimina a la persona cuando
  ha terminado su recorrido al exterior. Así, la reproducción no depende de
  los pasos de render ni cambia métricas. Cada grupo conserva sus primeras 30
  posiciones y suma otras 30 en un segundo tramo delimitado.
- Las mallas instanciadas de cuerpo, cabeza, piernas y anillo usan
  `frustumCulled = false`: Three.js r160 conservaba una `boundingSphere`
  calculada con todas las instancias ocultas en `y=-100`, y `setMatrixAt()` no
  la invalida al mover pacientes. Se prefiere desactivar el recorte de estos
  cuatro objetos pequeños a recalcular la esfera en cada actualización. La
  prueba Playwright compara píxeles con el recorte activado/desactivado y
  verifica que General y Preferencial aparecen en Observados y Laboratorio.
- La optimización de matrices/colores de `bc61d78` no introdujo la esfera
  obsoleta: su commit padre también trasladaba las instancias y dejaba las
  inactivas en `y=-100` sin invalidar la esfera. Matrices, colores, índices,
  materiales y orden de dibujo se verifican en navegador; la etiqueta y las
  mallas ahora comparten la misma posición visual durante el servicio.
- Three.js expone `BufferAttribute.needsUpdate` como setter; la inspección
  automatizada comprueba el incremento de `instanceMatrix.version` y
  `instanceColor.version`, junto con valores finitos y píxeles renderizados.
  La prueba de navegador confirma además que el SHA-256 del módulo recibido
  coincide con el archivo local, por lo que la caché no explica la regresión
  reproducida.
- El diagnóstico queda accesible solo con `?depurar-personas=1`; en ese modo
  se conserva el búfer para capturas y se permite alternar el recorte en
  pruebas. La ejecución normal no activa esa instrumentación.
- La aplicación se entrega como archivos estáticos y módulos ES nativos, sin
  framework ni compilación.
- Three.js se fija en r160 y se conserva en `vendor/three/`; la ejecución no
  debe depender de una red o CDN.
- `OrbitControls.js` importa `three.module.js` mediante una ruta relativa para
  que funcione como módulo ES local sin resolución de paquetes ni CDN.
- El esqueleto no contiene lógica de simulación ni datos observados inventados.
- Se usarán un PRNG propio con semilla explícita y pruebas de Node.js para cada
  módulo del motor cuando se implemente.
- El plan define nueve fases ordenadas; el despliegue de GitHub Pages queda para
  la última fase.
- GitHub Pages publica desde `main` con Actions. El workflow primero ejecuta
  `node --test` en Node 20 y solo despliega tras aprobar; la publicación manual
  desde otra rama no despliega. Un grupo de concurrencia global evita
  despliegues simultáneos y los permisos se limitan a lectura del contenido en
  pruebas y escritura de Pages/ID token en publicación. Se usan las versiones
  mayores vigentes verificadas de checkout v7, setup-node v7, configure-pages
  v6, upload-pages-artifact v5 y deploy-pages v5.
- El artefacto de Pages es explícitamente una lista permitida: `index.html`,
  `src/`, `data/`, `vendor/` y `.nojekyll`. Se incluye el archivo oculto
  `.nojekyll`; documentación, pruebas y herramientas de perfilado quedan fuera.
  Las rutas de ejecución permanecen relativas para soportar el prefijo del
  repositorio en GitHub Pages.
- `origin` (`https://github.com/Johan09CD/pharmasan-web.git`) es el remoto
  canónico documentado para publicar `main`. El flujo no hace push por sí mismo
  desde esta tarea.
- La interfaz mantiene un tema claro de alto contraste: los pares de texto y
  fondo principales/sutiles, botones y errores se midieron sobre **4,5:1**;
  el foco usa contorno verde oscuro. Los botones no bajan de **44 px**. El
  panel lateral se puede plegar; el modo presentación conserva escena completa
  y un HUD flotante. Las pestañas del laboratorio usan flechas y tabulación
  roving.
- El recorrido inicial se recuerda mediante `localStorage` dentro de
  `try/catch`, pero siempre se puede volver a abrir. «Acerca de» consume
  fuente, fecha y versión desde `data/observados.json.meta`; el campo
  `fuente_datos` identifica `pharmasan-sim`, coherente con el proceso de
  exportación documentado. Sin WebGL se desactivan solo las vistas 3D y siguen
  disponibles las herramientas de datos. Un error de carga de observaciones
  se anuncia en español sin dejar una pantalla vacía.
- Al reiniciar la animación o cargar eventos de otro modo se retiran y
  disponen las geometrías y materiales dinámicos de pacientes; los recursos
  estáticos de la escena viven hasta `dispose()` del renderer. En 20 corridas
  alternadas el conteo del renderer se mantuvo en **37 geometrías y 10
  texturas**. El heap observado fluctúa con la recolección automática, por lo
  que se reportan lecturas, no una cota fija.
- `data/observados.json` se genera en `pharmasan-sim` desde el CSV procesado y
  las tablas de análisis/escenarios existentes; la web consume ese artefacto
  sin mantener una copia manual de las cifras.
- El calendario procesa `fin_servicio` antes que `llegada` en empates; las
  réplicas usan Mulberry32 y flujos separados para llegadas, servicio por grupo
  y asignación de ventanillas.
- `conteos` elige un día entre los registros observados disponibles y genera
  tiempos dentro de cada intervalo de cinco minutos. `replay` puede reproducir
  horarios y ventanillas observados si se activa esa opción explícitamente.
- El caso base del simulador Python remuestrea interllegadas positivas por tipo
  y día, usa servicios Erlang, horizonte de 60 min y la regla de asignación
  elegida por `ejecutar_experimentos`. La fila exportada del escenario base
  confirma 500 réplicas y asignación `aleatoria`.
- El caso base web reproduce la generación de interllegadas Python a partir de
  pacientes pico, separadas por grupo y día; no remuestrea los 68 intervalos
  globales mezclados (incluyen un intervalo cero y saltos entre grupos que
  Python excluye). Los ajustes Erlang y el horizonte proceden de los datos y el
  código Python. `conteos_uniformes` se conserva como alternativa explícita.
- En las pruebas de 500 réplicas con semillas 20261101–20261600, Wq fue
  0,256980 min para llegadas uniformes, 0,874050 min para los 68 intervalos
  globales mezclados y 0,152560 min para interllegadas separadas por grupo.
  Cambiar `primera_libre` por `aleatoria` no cambió Wq en estas corridas. La
  referencia Python es 0,153536 min con IC 95 % [0,137024; 0,170048] min.
  La diferencia se explica por la estructura de llegadas por grupo, no por el
  servicio ni por la asignación.
- Evidencia del código Python: `pharmasan-sim/src/pharmasan_sim/simulador.py`
  (generación empírica por grupo y día, Erlang, horizonte y despacho) y
  `pharmasan-sim/src/pharmasan_sim/experimentos.py` (selección de la regla de
  asignación). La media y el IC Python se contrastaron además ejecutando 500
  réplicas sin guardar archivos y coinciden con `outputs/tablas/escenarios.csv`.
- Los límites del IC 95 % de Wq de cada escenario en `data/observados.json`
  provienen de `wq_media_ic95_inferior` y `wq_media_ic95_superior` en
  `pharmasan-sim/outputs/tablas/escenarios.csv`; el exportador Python es la
  única fuente del JSON y no se mantienen valores manuales.
- El modo «Volver a simular con las llegadas observadas» construye cada tanda
  con `crearConfiguracionBase(datos)` y corre 500 réplicas; no usa los 68
  intervalos globales. La primera tanda parte de `meta.semilla_usada` y cada
  nueva tanda avanza 500 semillas. El panel compara el promedio Wq con el
  escenario base de `referencia_python.escenarios` y sus límites exportados
  `wq_ic95_inferior`/`wq_ic95_superior`; solo el resultado dentro del intervalo
  se marca en verde. No se editaron manualmente los datos exportados.
- «Reproducir lo observado» filtra por día y por los IDs de `pico` exportados
  (o muestra la jornada completa) y conserva para cada paciente llegada,
  ventanilla, inicio y atención reales mediante el modo `replay` existente.
  Cuando se seleccionan los tres días, cada uno se simula en una corrida aparte
  para no tratar como simultáneos eventos de jornadas distintas. La referencia
  seleccionada se calcula desde los registros observados; sus agregados
  coinciden con `cifras_verificadas` para la selección de los tres días.
  Diferencias nulas se indican en verde; si la corrida no coincide, se muestra
  el valor de diferencia en ámbar y una explicación. La tabla de pacientes y
  la línea de tiempo usan la salida de replay, con carriles separados por día
  y ventanilla. `data/observados.json` y los módulos del motor no se editan.
- La maqueta 3D es esquemática, no a escala: no se recibieron fotos/medidas;
  la distribución acordada ubica la puerta a la izquierda de las ventanillas
  y la espera al frente. El mostrador queda al fondo, con V1/V2 General y V3
  Adulto Mayor. Se reservan 30 marcas de fila por grupo, separadas por postes
  y cintas, y 12 sillas fuera de las filas. Las cuatro vistas predefinidas
  comparten OrbitControls; geometrías, materiales, estantería, postes, marcas y
  sillas usan caché o instancing. El render se limita a 30 fps; a partir de
  120 personas se reduce el pixel ratio y se desactivan sombras. No se animan
  personas en esta fase. Los 30 fps son solo el límite superior configurado;
  la velocidad alcanzada debe medirse y comunicarse, no darse por garantizada.
- El diseño pasa a priorizar PC: a partir de 1280 px usa una cuadrícula de
  escena principal y columna lateral fija; el panel lateral puede desplazarse
  internamente cuando hay resultados extensos, sin desplazar la escena ni la
  página. Bajo 768 px se apila la interfaz, el canvas ocupa 45 svh, se oculta
  el scroll horizontal del documento y los botones táctiles miden al menos
  44 px. Los indicadores esenciales del HUD quedan visibles y los secundarios
  van en un desplegable.
- Los controles de reproducción avanzan por los instantes observados de
  llegada, inicio y fin; espacio alterna reproducir/pausar, flechas saltan un
  instante y 1/2/3 cambian las vistas cenital/isométrica/frontal. El modo
  móvil impone calidad reducida (pixel ratio limitado a 0,7 y sombras
  desactivadas), además del umbral de carga de 120 personas; no hay sombras ni
  animación de pacientes. En Playwright se verificó el encuadre 1366×768 y
  390×844: sin solapamiento de escena/HUD y sin overflow horizontal. El
  límite configurado de 30 fps es un techo, no una garantía de velocidad.
- Los eventos del motor incluyen `paciente_tipo` como dato aditivo para
  etiquetar y colorear las personas que esperan; la adición no participa en el
  calendario ni altera resultados o métricas. `src/escena/personas.js` deriva
  fotogramas, ventanillas, filas y transiciones únicamente de esos eventos.
  Los recorridos interpolan entrada, cambios de fila/ventanilla y salida en
  ventanas visuales de 0,12, 0,12 y 0,35 minutos a partir de las marcas de
  evento; son constantes de animación, no tiempos de atención observados. Las
  esperas y el Wq no se recalculan en la animación. El Wq que aparece al cierre
  proviene del resumen ya generado por la comparación observada.
- La escena representa personas low-poly con instancias compartidas, ID en
  etiquetas superpuestas y anillos de espera verde/amarillo/rojo según los
  umbrales de 2 y 5 minutos. Cada ventanilla cambia su indicador de libre a
  ocupada y su barra refleja el avance entre el inicio y fin registrados. El
  servicio no altera la posición de una persona hasta que el evento registra
  su inicio; al reiniciar se desmontan y liberan las geometrías y materiales
  dinámicos, dejando el estado inicial sin personas.
- Los controles ya existentes se conectan a la reproducción de eventos e
  incorporan reinicio y velocidad de 0,5× a 30×. Los días se reproducen como
  corridas separadas; al cerrar cada una, el HUD presenta el agregado ya
  comparado con la tabla y la reproducción se pausa antes del siguiente día.
  En la selección «Los tres», hora pico, se conserva la referencia de 71
  pacientes, 7 esperas y Wq de 0,155 min.
- La Entrega B presenta el resumen final solo cuando termina toda la selección;
  reutiliza los resultados de la comparación ya calculada y no vuelve a
  calcular métricas. El CSV exporta una fila por paciente observado con grupo,
  día, llegada, ventanilla, inicio, atención, espera y fin; usa UTF-8 con BOM,
  separador `;`, decimales con coma y escape de campos según CSV. El nombre
  incluye día y tramo. La habilitación del panel y la conversión de datos se
  prueban en navegador y Node, respectivamente.
- La carga de jornada completa reúne 131 pacientes en las tres corridas, no
  simultáneos: los snapshots observados alcanzan un máximo de 4 personas en
  sistema. A partir de 120 pacientes se activa calidad reducida y sombras
  apagadas; el pixel ratio de escritorio se limita a 0,5 y el antialiasing WebGL
  se desactiva para priorizar fluidez. En Playwright 1366×768, con carga de 131
  pacientes y cuatro visibles, se midieron 23–28 fps en cuatro muestras
  consecutivas. El objetivo de 30 fps no se sostuvo en ese navegador de prueba;
  se debe comunicar este límite y no presentarlo como rendimiento garantizado.
- La actualización de la escena recorre solo las personas visibles y oculta
  las que salen; los colores de instancias se transfieren solo si cambian y las
  etiquetas se dibujan una vez por frame. El canvas de etiquetas usa el pixel
  ratio real del renderizador. En el perfil de 131 pacientes, la preparación de
  500 frames tomó 7,41 ms en total (0,0148 ms/frame); en navegador, antes y
  después se midieron 22–23 y 21–22 fps estables, respectivamente. Bajar el
  pixel ratio a 0,4 no mejoró la medición, por lo que se conserva 0,5. El
  render sigue limitado a 30 fps como máximo, sin prometer alcanzarlos.
- La descarga CSV genera el Blob correcto: se compararon sus 131 registros y
  nueve columnas con la tabla, incluida la marca BOM UTF-8. `page.waitForEvent`
  no recibió ningún evento de descarga en el navegador integrado, tampoco con
  un enlace CSV de control. No se cambió la exportación que prepara el Blob;
  falta repetir la recepción nativa en un navegador con descargas habilitadas.
- Los datos propios requieren `llegada_min` y `tipo`; se reconocen también
  `Llegada (min)` y `Grupo` para aceptar la exportación de la aplicación. El
  separador se detecta entre coma y punto y coma, y solo con punto y coma se
  interpreta la coma decimal. Se rechazan errores con el número de línea y
  más de 500 filas. Si una fila incluye `atencion_min`, esa duración observada
  sustituye al muestreo de servicio; las filas sin valor explícito usan la
  distribución elegida.
- El campo de réplicas admite 1–1.000. Una réplica muestra su media, pero no
  inventa un IC; desde dos réplicas se calcula el IC t de 95 %. Las semillas
  son consecutivas a partir de la semilla del escenario. En fase 7 las
  réplicas y comparaciones se ejecutan en un Web Worker de módulo, cargado con
  una URL relativa al módulo para funcionar bajo el prefijo de GitHub Pages.
  El worker informa progreso cada 10 réplicas y revisa cancelación en esos
  límites; solo entrega el resumen completo, nunca un resultado parcial.
- La configuración JSON lleva versión 1 y se valida antes de aplicarse. El
  enlace codifica el JSON compacto en `#laboratorio=` para no enviar datos al
  servidor; si los conteos observados no cambiaron y no son el modo activo, se
  reconstruyen desde `data/observados.json` al cargar para no inflar el hash.
  La descarga mantiene JSON indentado para lectura. Un hash inválido informa
  el problema y deja activo el preajuste de datos observados. Los enlaces de
  más de 2.000 caracteres muestran el largo exacto y recomiendan
  «Descargar configuración (JSON)».
- La pestaña Comparar conserva hasta cuatro escenarios nombrados. Todas las
  configuraciones usan la misma semilla inicial y secuencia consecutiva
  (números aleatorios comunes); la tabla reporta media e IC 95 % por métrica,
  incluida la rho de cada ventanilla. El gráfico compara Wq con sus intervalos.
  El barrido opcional incluye ×1,0 y factores ×1,1–×2,0; el resultado señala
  el primer factor que incumple el criterio.
- La comparación de la escena confirmó que los conteos y atributos GPU de
  cuerpo, cabeza, piernas y anillo eran válidos también antes de `bc61d78`;
  ese commit no originó la ausencia visual. Se aumentó la escala low-poly
  respecto a la maqueta esquemática, se apartaron las etiquetas de la cabeza
  y se conserva la alineación horizontal del anillo con el cuerpo. Los
  pacientes no proyectan sombras. En escritorio el pixel ratio máximo es
  1,25 para mantener **21 fps** medidos con la jornada observada; en móvil
  sigue limitado a 0,7. No se afirma que la escena alcance 30 fps.
