# Pharmasan Web

Simulación web 3D de la atención de la droguería Pharmasan (Bochalema). Es una
aplicación estática (HTML, CSS y JavaScript con módulos ES): no usa frameworks,
no necesita compilar y no requiere servidor propio ni internet para ejecutarse.

- **Repositorio:** https://github.com/johan1carreno6-arch/pharmasan-web
- **Aplicación publicada:** https://johan1carreno6-arch.github.io/pharmasan-web/

## Qué se necesita

| Para... | Se necesita |
|---|---|
| Solo usar la aplicación | Un navegador moderno con WebGL (Chrome, Edge, Firefox o Safari). Abrir el enlace publicado. |
| Ejecutarla en tu equipo | Lo anterior, más Python 3 (solo para el servidor estático local) o cualquier otro servidor estático. |
| Correr las pruebas | Node.js 20 o superior. |

La aplicación **no** funciona abriendo `index.html` con doble clic, porque los
módulos ES y el archivo de datos necesitan servirse por HTTP.

## Cómo iniciarla en local

1. Clona o descarga el repositorio y abre una terminal en la carpeta `pharmasan-web`.
2. Inicia un servidor estático:

   ```powershell
   python -m http.server 8000
   ```

3. Abre `http://localhost:8000` en el navegador.
4. Para detener el servidor, pulsa `Ctrl + C` en la terminal.

Si ves una versión anterior después de un cambio, recarga sin caché con `Ctrl + F5`.

## Cómo usarla

**Modo A, Datos observados.** Reproduce los 131 pacientes reales.
Elige el día (Lunes, Martes, Viernes o Los tres) y el tramo (hora pico
08:02–09:02 o jornada completa). «Reproducir lo observado» usa las llegadas,
ventanillas y tiempos reales; «Volver a simular con las llegadas observadas»
usa el motor con servicio Erlang y una semilla visible. En la hora pico con los
tres días deben aparecer 71 pacientes, 7 que esperaron y Wq = 0,155 min.

**Modo B, Laboratorio.** Permite definir ventanillas y a quién atiende cada una,
llegadas (Poisson, intervalos, conteos, patrones observados o un CSV propio),
tiempos de atención, política de la cola, criterio de desempeño y semilla.
Botones principales: «Simular y ver en 3D», «Correr réplicas», pestaña
«Comparar» (hasta 4 escenarios con las mismas semillas), descargar o cargar la
configuración en JSON y «Copiar enlace con esta configuración».

**Controles de la escena.** Vistas cenital (1), isométrica (2), frontal (3) y
«Ver fila»; espacio pausa o reanuda; las flechas saltan entre instantes;
velocidad de 0,5× a 30×; panel plegable y modo presentación. «Acerca de»
muestra la fuente de los datos, la fecha de exportación y la versión del código.

## Pruebas

```powershell
node --test
```

## Actualizar los datos

Los datos vienen del proyecto Python `pharmasan-sim`. Para actualizarlos,
re-exporta desde ese proyecto y reemplaza `data/observados.json`.

## Publicar un cambio

```powershell
git add -A
git commit -m "Describe el cambio"
git push
```

GitHub Actions corre las pruebas y, si pasan, publica el sitio en GitHub Pages
(Settings > Pages > Source: GitHub Actions). En uno o dos minutos el mismo
enlace muestra la versión nueva.

## Estructura

- `src/engine/`: motor de eventos discretos, métricas, réplicas y Web Worker.
- `src/escena/`: escena 3D con Three.js, personas y cámara.
- `src/ui/`: interfaz, modo observados y laboratorio.
- `data/observados.json`: datos y cifras de referencia exportados.
- `vendor/three/`: Three.js r160 local (sin CDN).
- `tests/`: pruebas con `node --test`.
- `docs/`: progreso, decisiones y plan.

## Limitaciones conocidas

- La escena es una representación esquemática, no a escala: no hubo fotos ni medidas del local.
- Con 131 pacientes se midieron unos 22 fps en el navegador de pruebas; en un equipo con tarjeta gráfica puede ir más fluido. El tope configurado es 30 fps.
- Las cifras de referencia provienen de `pharmasan-sim`; la web debe reproducirlas, no reemplazarlas.