# Pharmasan Web

Esqueleto de una aplicación web estática para simular la atención de la
droguería Pharmasan (Bochalema). La interfaz está escrita en español y no usa
frameworks ni requiere un paso de compilación.

## Ejecución

Sirve este directorio con cualquier servidor estático y abre la dirección local
que indique. Por ejemplo:

```powershell
python -m http.server 8000
```

Después visita `http://localhost:8000`. La aplicación y Three.js se cargarán
desde archivos locales.

## Estructura

- `src/engine/`: módulos del motor.
- `src/escena/`: módulos de la escena 3D.
- `src/ui/`: interfaz.
- `data/observados.json`: datos y referencias exportados desde `pharmasan-sim`.
- `vendor/three/`: dependencias locales con versiones fijas.
- `tests/`: pruebas del motor con `node --test`.
- `docs/`: progreso, decisiones y fases del proyecto.

Consulta [AGENTS.md](AGENTS.md) para las reglas de desarrollo.

## Motor de eventos

Los módulos de `src/engine/` exponen `simular(configuracion)`,
`calcularMetricas(resultado, opciones)` y
`correrReplicas(configuracion, cantidad, opciones)`. La configuración es un
objeto serializable, requiere una semilla entera y admite los modos de llegada
`replay`, `conteos`, `poisson`, `intervalos` y `csv`. Las tasas y los tiempos se
expresan en minutos; los conteos de observaciones con varios días eligen un día
observado por réplica y ubican cada llegada dentro de su intervalo de cinco
minutos. `replay` acepta los registros de `data/observados.json`; para repetir
también el horario y la ventanilla observados, usa
`llegadas.ventanilla_observada: true`.

Los resultados incluyen pacientes y el estado de las filas y ventanillas tras
cada evento. Las métricas contienen utilización, promedios de cola y sistema,
espera y permanencia, probabilidad de esperar y evaluación del criterio de
servicio. Las réplicas usan semillas consecutivas e intervalos t de Student
bilaterales del 95 %.

`crearConfiguracionBase(datos)` en `src/ui/observados.js` crea el caso base
desde los datos observados: remuestrea por separado las interllegadas positivas
de cada grupo y día, usa los ajustes Erlang exportados, asignación aleatoria y
horizonte de 60 minutos. El muestreo uniforme dentro de los conteos sigue
disponible mediante `modo: "conteos_uniformes"` (también se acepta el alias
anterior `modo: "conteos"`).

En la interfaz, «Volver a simular con las llegadas observadas» ejecuta 500
réplicas del caso base. El panel compara el Wq medio con la referencia base de
Python y muestra en verde si cae dentro del IC 95 % exportado. La primera tanda
usa la semilla exportada y las siguientes tandas continúan con bloques de 500
semillas consecutivas.

«Reproducir lo observado» permite elegir Lunes, Martes, Viernes o los tres, y
la hora pico (08:02–09:02, con extremos incluidos) o la jornada completa.
Reproduce las llegadas, ventanillas e inicios y duraciones de atención
registrados; al elegir los tres días, cada día se ejecuta por separado. La
comparación muestra pacientes, pacientes que esperaron y Wq frente a los
registros verificados, junto con su diferencia. También presenta las cifras
exportadas, una tabla por paciente y una línea de tiempo por día y ventanilla.

## Maqueta 3D

La escena usa Three.js r160 desde `vendor/three/`. Por falta de fotos y medidas,
se muestra el aviso permanente «Representación esquemática, no a escala»; la
planta considera la entrada a la izquierda, las ventanillas al fondo y las
filas al frente. Incluye zonas General y Preferencial delimitadas con espacio
para 30 personas cada una, estantería instanciada y asientos. Los controles
ofrecen vistas cenital, isométrica, frontal y «Ver fila», además de órbita con
ratón o gestos táctiles. El render se limita a 30 fps y reduce resolución y
sombras automáticamente al registrar 120 o más personas.

La interfaz prioriza escritorio (escena amplia y columna lateral fija desde
1280 px) y apila escena/HUD en móvil. El HUD de móvil muestra reloj, llegados,
atendidos, filas y Wq; las métricas adicionales quedan plegadas. Durante la
reproducción, espacio alterna pausa, ←/→ salta entre instantes y 1/2/3 cambia
entre las vistas cenital, isométrica y frontal. En móvil se activa calidad
reducida y se deshabilitan las sombras.

La Entrega A anima personas low-poly desde los eventos: entrada, fila,
ventanilla y salida; el tipo determina su color y un anillo indica la espera
frente a las metas de 2 y 5 minutos. Los estados de las ventanillas y sus barras
de servicio siguen las marcas de inicio y fin del registro, sin recalcular
métricas. Los controles existentes incluyen reinicio y velocidad de 0,5× a
30×. Los días seleccionados se reproducen por separado y, al cierre de cada
corrida, el HUD muestra el resumen ya comparado con la tabla.

Al finalizar toda la selección aparece un resumen con pacientes, pacientes que
esperaron y Wq, usando el resultado calculado de la comparación. Desde allí se
puede descargar un CSV con una fila por paciente y sus día, grupo, llegada,
ventanilla, inicio, tiempo de atención, espera y fin. El archivo usa UTF-8,
separador `;` y formato decimal local.

La aplicación mide los fps del render y los presenta en el estado de la escena.
En Playwright a 1366×768, con 131 pacientes y reproducción a 30×, antes de la
optimización se midieron 22–23 fps; después, 21–22 fps en las seis muestras
estables. La meta de 30 fps no se sostuvo y no se presenta como rendimiento
garantizado. El perfilado de `perfil_rendimiento.js` midió 0,0148 ms/frame para
la preparación de animación de los 131 pacientes.

El navegador integrado no expuso el evento `download` de Playwright, incluso
con una descarga CSV independiente. El Blob generado por la interfaz sí se
contrastó con la tabla: encabezado más 131 filas, BOM UTF-8 y coincidencia de
los nueve campos en todos los registros. La recepción del archivo en un
navegador con descargas habilitadas queda pendiente.

Ejecuta todas las pruebas con:

```powershell
node --test
```
