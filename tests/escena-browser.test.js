import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { chromium } from "playwright";

const raiz = resolve(fileURLToPath(new URL("../", import.meta.url)));
const tiposContenido = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
};

function crearServidor() {
  return createServer(async (solicitud, respuesta) => {
    try {
      const ruta = decodeURIComponent(
        new URL(solicitud.url, "http://127.0.0.1").pathname,
      );
      const archivo = resolve(raiz, `.${ruta === "/" ? "/index.html" : ruta}`);
      if (archivo !== raiz && !archivo.startsWith(`${raiz}${sep}`)) {
        respuesta.writeHead(403).end();
        return;
      }
      const contenido = await readFile(archivo);
      respuesta.writeHead(200, {
        "content-type": tiposContenido[extname(archivo)] ?? "application/octet-stream",
      });
      respuesta.end(contenido);
    } catch (error) {
      respuesta.writeHead(error.code === "ENOENT" ? 404 : 500);
      respuesta.end(error.code === "ENOENT" ? "No existe" : error.message);
    }
  });
}

async function contarPixelesDePersona(pagina, capturaBase, capturaVisible, personas) {
  return pagina.evaluate(
    async ({ capturaBase, capturaVisible, personas }) => {
      async function leerImagen(contenido) {
        const imagen = new Image();
        imagen.src = `data:image/png;base64,${contenido}`;
        await imagen.decode();
        const lienzo = document.createElement("canvas");
        lienzo.width = imagen.width;
        lienzo.height = imagen.height;
        const contexto = lienzo.getContext("2d");
        contexto.drawImage(imagen, 0, 0);
        return {
          ancho: imagen.width,
          alto: imagen.height,
          pixeles: contexto.getImageData(0, 0, imagen.width, imagen.height).data,
        };
      }

      const base = await leerImagen(capturaBase);
      const visible = await leerImagen(capturaVisible);
      const escalaX =
        visible.ancho / document.querySelector("#escena-local").clientWidth;
      const escalaY =
        visible.alto / document.querySelector("#escena-local").clientHeight;

      return personas.map((persona) => {
        const centroX = Math.round(persona.centroCuerpo.x * escalaX);
        const centroY = Math.round(persona.centroCuerpo.y * escalaY);
        let distintos = 0;
        for (let dy = -10; dy <= 10; dy += 1) {
          for (let dx = -8; dx <= 8; dx += 1) {
            const x = centroX + dx;
            const y = centroY + dy;
            if (x < 0 || y < 0 || x >= visible.ancho || y >= visible.alto) {
              continue;
            }
            const indice = (y * visible.ancho + x) * 4;
            const diferencia =
              Math.abs(base.pixeles[indice] - visible.pixeles[indice]) +
              Math.abs(base.pixeles[indice + 1] - visible.pixeles[indice + 1]) +
              Math.abs(base.pixeles[indice + 2] - visible.pixeles[indice + 2]);
            if (diferencia > 30) distintos += 1;
          }
        }
        return { id: persona.id, tipo: persona.tipo, pixeles: distintos };
      });
    },
    { capturaBase, capturaVisible, personas },
  );
}

async function reproducirHastaAmbosGrupos(pagina) {
  await pagina.locator("#velocidad-reproduccion").evaluate((control) => {
    control.value = "30";
    control.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await pagina.locator("#alternar-reproduccion").click();
  await pagina.waitForFunction(
    () => {
      const personas =
        document
          .querySelector("#escena-local")
          ?.__diagnosticoPersonas?.().instancias ?? [];
      const hayAmbosGrupos =
        personas.some((persona) => persona.tipo === "General") &&
        personas.some((persona) => persona.tipo === "Preferencial");
      if (hayAmbosGrupos) {
        document.querySelector("#alternar-reproduccion").click();
      }
      return hayAmbosGrupos;
    },
    null,
    { timeout: 30000 },
  );
  await pagina.waitForFunction(
    () =>
      document.querySelector("#alternar-reproduccion").textContent.trim() ===
      "Reproducir",
    null,
    { timeout: 5000 },
  );
  return pagina.locator("#escena-local").evaluate((elemento) =>
    elemento.__diagnosticoPersonas(),
  );
}

function comprobarEstadoDeMallas(diagnostico) {
  const cantidad = diagnostico.cantidadIds;
  assert.ok(diagnostico.personasVisibles > 0);
  assert.equal(diagnostico.mallas[0].count, cantidad);
  assert.equal(diagnostico.mallas[1].count, cantidad);
  assert.equal(diagnostico.mallas[2].count, cantidad * 2);
  assert.equal(diagnostico.mallas[3].count, cantidad);
  assert.ok(
    diagnostico.mallas.every((malla) => malla.visible && !malla.frustumCulled),
  );
  assert.ok(
    diagnostico.mallas.every(
      (malla) =>
        !malla.material.transparent &&
        malla.material.opacity === 1 &&
        malla.material.depthWrite &&
        malla.material.depthTest &&
        malla.material.renderOrder === 0,
    ),
  );
  assert.ok(
    diagnostico.mallas.every((malla) => malla.instanceMatrixVersion > 0),
  );
  assert.ok(
    diagnostico.mallas.every((malla) => malla.instanceColorVersion > 0),
  );
  assert.ok(
    diagnostico.mallas.every(
      (malla) => malla.boundingSphere?.center[1] === -100,
    ),
  );

  const indices = diagnostico.instancias.map((persona) => persona.indice);
  assert.equal(new Set(indices).size, indices.length);
  for (const persona of diagnostico.instancias) {
    const [cuerpo, cabeza, piernas, anillo] = persona.mallas;
    assert.ok(
      [cuerpo, cabeza, ...piernas.instancias.map(() => piernas), anillo]
        .flatMap((malla) => malla.instancias)
        .every((instancia) =>
          [...instancia.posicion, ...instancia.escala].every(Number.isFinite),
        ),
    );
    assert.ok(
      [cuerpo, cabeza, piernas, anillo].every((malla) =>
        malla.instancias.every(
          (instancia) =>
            instancia.color?.some((canal) => canal > 0) ?? false,
        ),
      ),
    );
    const colorCuerpo = cuerpo.instancias[0].color;
    if (persona.tipo === "Preferencial") {
      assert.ok(colorCuerpo[0] > colorCuerpo[1]);
    } else {
      assert.ok(colorCuerpo[1] > colorCuerpo[0]);
    }
    const posicionCuerpo = cuerpo.instancias[0].posicion;
    const posicionAnillo = anillo.instancias[0].posicion;
    assert.ok(Math.abs(posicionCuerpo[0] - persona.posicion[0]) < 1e-6);
    assert.ok(Math.abs(posicionCuerpo[2] - persona.posicion[2]) < 1e-6);
    assert.ok(Math.abs(posicionCuerpo[0] - posicionAnillo[0]) < 1e-6);
    assert.ok(Math.abs(posicionCuerpo[2] - posicionAnillo[2]) < 1e-6);
    assert.ok(
      Math.abs(persona.posicion[0] - persona.posicionEtiqueta[0]) < 1e-6,
    );
    assert.ok(
      Math.abs(persona.posicion[2] - persona.posicionEtiqueta[2]) < 1e-6,
    );
    assert.ok(persona.etiqueta.y < persona.centroCuerpo.y);
  }
}

async function comprobarPixeles(pagina, contexto, diagnostico, etiqueta) {
  await contexto.evaluate((elemento) =>
    elemento.__diagnosticoPersonas.establecerRecortePersonas(true),
  );
  const capturaBase = await pagina
    .locator("#escena-local canvas")
    .first()
    .screenshot();
  await contexto.evaluate((elemento) =>
    elemento.__diagnosticoPersonas.establecerRecortePersonas(false),
  );
  const capturaVisible = await pagina
    .locator("#escena-local canvas")
    .first()
    .screenshot();
  const pixeles = await contarPixelesDePersona(
    pagina,
    capturaBase.toString("base64"),
    capturaVisible.toString("base64"),
    diagnostico.instancias,
  );
  const regionesVisibles = pixeles.filter((persona) => persona.pixeles > 0);
  assert.ok(
    regionesVisibles.length >= diagnostico.personasVisibles,
    `Solo ${regionesVisibles.length} de ${diagnostico.personasVisibles} personas cambiaron píxeles: ${JSON.stringify(pixeles)}`,
  );
  return `${etiqueta} (${diagnostico.renderer}): ${regionesVisibles.length}/${diagnostico.personasVisibles} regiones; ${pixeles
      .map(({ tipo, pixeles: cantidadPixeles }) => `${tipo}: ${cantidadPixeles}`)
      .join(", ")}`;
}

test("las personas activas se dibujan en la escena observada", async (t) => {
  const servidor = crearServidor();
  await new Promise((resolver) => servidor.listen(0, "127.0.0.1", resolver));
  const { port } = servidor.address();
  let navegador;

  t.after(async () => {
    await navegador?.close();
    await new Promise((resolver, rechazar) =>
      servidor.close((error) => (error ? rechazar(error) : resolver())),
    );
  });

  navegador = await chromium.launch({
    args: [
      "--use-gl=angle",
      "--use-angle=swiftshader",
      "--enable-gpu",
      "--disable-gpu-sandbox",
      "--enable-unsafe-swiftshader",
    ],
  });

  for (const viewport of [
    { width: 1366, height: 768 },
    { width: 390, height: 844 },
  ]) {
    await t.test(`${viewport.width}x${viewport.height}`, async (t) => {
      const contexto = await navegador.newContext({ viewport });
      const pagina = await contexto.newPage();
      const errores = [];
      const hashesModulo = [];
      pagina.on("pageerror", (error) => errores.push(error.message));
      pagina.on("console", (mensaje) => {
        if (mensaje.type() === "error") errores.push(mensaje.text());
      });
      pagina.on("response", (respuesta) => {
        if (new URL(respuesta.url()).pathname.endsWith("/src/escena/local3d.js")) {
          hashesModulo.push(
            respuesta
              .body()
              .then((cuerpo) =>
                createHash("sha256").update(cuerpo).digest("hex"),
              ),
          );
        }
      });
      await pagina.addInitScript(() =>
        localStorage.setItem("pharmasan-recorrido-visto", "si"),
      );
      await pagina.goto(
        `http://127.0.0.1:${port}/?depurar-personas=1`,
        { waitUntil: "networkidle" },
      );
      await pagina.waitForFunction(
        () =>
          document.querySelector("#dia-observado") &&
          !document.querySelector("#dia-observado").disabled,
        null,
        { timeout: 30000 },
      );
      const hashRepositorio = createHash("sha256")
        .update(await readFile(resolve(raiz, "src", "escena", "local3d.js")))
        .digest("hex");
      assert.ok((await Promise.all(hashesModulo)).includes(hashRepositorio));
      await pagina.locator("#dia-observado").selectOption("Lunes");
      await pagina.locator("#tramo-observado").selectOption("hora_pico");
      await pagina.locator("#reproducir-observado").click();
      await pagina.waitForFunction(
        () => !document.querySelector("#alternar-reproduccion").disabled,
        null,
        { timeout: 30000 },
      );
      await pagina.waitForTimeout(300);
      const contenedor = pagina.locator("#escena-local");
      let diagnostico = await reproducirHastaAmbosGrupos(pagina);
      comprobarEstadoDeMallas(diagnostico);
      t.diagnostic(
        await comprobarPixeles(pagina, contenedor, diagnostico, "Observados"),
      );

      for (let reinicio = 0; reinicio < 3; reinicio += 1) {
        await pagina.locator("#reiniciar-reproduccion").click();
        diagnostico = await contenedor.evaluate((elemento) =>
          elemento.__diagnosticoPersonas(),
        );
        assert.equal(diagnostico.personasVisibles, 0);
      }

      await pagina.locator("#simular-laboratorio").click();
      await pagina.waitForFunction(
        () =>
          document
            .querySelector("#estado-laboratorio")
            .textContent.startsWith("Corrida completada:"),
        null,
        { timeout: 30000 },
      );
      diagnostico = await reproducirHastaAmbosGrupos(pagina);
      comprobarEstadoDeMallas(diagnostico);
      t.diagnostic(
        await comprobarPixeles(pagina, contenedor, diagnostico, "Laboratorio"),
      );

      await pagina.locator("#volver-observados").click();
      await pagina.waitForFunction(
        () =>
          document
            .querySelector("#estado-replay")
            .textContent.startsWith("Reproducción completada"),
        null,
        { timeout: 30000 },
      );
      assert.deepEqual(errores, []);
      await contexto.close();
    });
  }
});
