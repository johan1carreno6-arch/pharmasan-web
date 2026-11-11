import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { correrReplicas } from "../src/engine/replicas.js";
import {
  cargarConfiguracionLaboratorio,
  crearHashConfiguracionLaboratorio,
  calcularReferenciasMMc,
  crearPreajusteLaboratorio,
  crearConfiguracionLaboratorio,
  leerHashConfiguracionLaboratorio,
  serializarConfiguracionLaboratorio,
  validarEntradaLaboratorio,
  PREAJUSTES_LABORATORIO,
  VERSION_CONFIGURACION_LABORATORIO,
} from "../src/ui/laboratorio.js";

const datos = JSON.parse(
  await readFile(new URL("../data/observados.json", import.meta.url), "utf8"),
);
const semilla = datos.meta.semilla_usada;

function estadoActual() {
  return crearPreajusteLaboratorio(
    "Actual (2 generales + 1 preferencial)",
    datos,
    semilla,
  );
}

test("estima las tasas del pico y las medias de servicio desde observaciones", () => {
  const entrada = estadoActual();
  assert.equal(entrada.tasaGeneralHora, 47);
  assert.equal(entrada.tasaPreferencialHora, 24);
  for (const tipo of ["General", "Preferencial"]) {
    assert.equal(entrada.atencion[tipo].media, datos.atencion[tipo].media_min);
  }
});

test("cada preajuste usa Poisson y servicio exponencial", () => {
  for (const nombre of PREAJUSTES_LABORATORIO) {
    const entrada = crearPreajusteLaboratorio(nombre, datos, semilla);
    const { configuracion } = crearConfiguracionLaboratorio(entrada, datos);
    assert.equal(configuracion.llegadas.modo, "poisson");
    assert.deepEqual(
      Object.keys(configuracion.llegadas.tasas_por_minuto).sort(),
      ["General", "Preferencial"],
    );
    assert.deepEqual(Object.keys(configuracion.atencion.General), ["media"]);
    assert.deepEqual(Object.keys(configuracion.atencion.Preferencial), ["media"]);
    assert.doesNotThrow(() => JSON.stringify(configuracion));
  }
});

test("calcula referencias M/M/c solo para topologías homogéneas y estables", () => {
  const entrada = {
    ...estadoActual(),
    tasaGeneralHora: 2,
    tasaPreferencialHora: 2,
  };
  const separadas = crearConfiguracionLaboratorio(entrada, datos).configuracion;
  assert.deepEqual(
    calcularReferenciasMMc(separadas).map(({ nombre, rho }) => ({
      nombre,
      estable: rho < 1,
    })),
    [
      { nombre: "General", estable: true },
      { nombre: "Adulto mayor", estable: true },
    ],
  );
  const ventanillaFlexible = {
    ...separadas,
    ventanillas: [
      ...separadas.ventanillas,
      {
        id: 4,
        nombre: "Ventanilla flexible",
        atiende: ["General", "Preferencial"],
      },
    ],
  };
  assert.equal(calcularReferenciasMMc(ventanillaFlexible), null);

  const compartidas = {
    ...separadas,
    colas: "compartida",
    ventanillas: separadas.ventanillas.map((ventanilla) => ({
      ...ventanilla,
      atiende: ["General", "Preferencial"],
    })),
    atencion: {
      General: { media: 3 },
      Preferencial: { media: 3 },
    },
  };
  assert.equal(calcularReferenciasMMc(compartidas).length, 1);
  assert.equal(
    calcularReferenciasMMc({ ...compartidas, llegadas: { modo: "poisson", tasas_por_minuto: { General: 10, Preferencial: 10 } } }),
    null,
  );
});

test("valida límites y permite simular una carga inestable", () => {
  const entrada = estadoActual();
  assert.deepEqual(validarEntradaLaboratorio(entrada, datos).errores, []);

  const cantidadExcesiva = {
    ...entrada,
    modoLimite: "cantidad",
    cantidadPacientes: 501,
  };
  assert.ok(
    validarEntradaLaboratorio(cantidadExcesiva, datos).errores.some(
      (error) => error.campo === "cantidadPacientes",
    ),
  );

  const mediaInvalida = {
    ...entrada,
    atencion: { ...entrada.atencion, General: { media: 0 } },
  };
  assert.ok(
    validarEntradaLaboratorio(mediaInvalida, datos).errores.some(
      (error) => error.campo === "atencion.General.media",
    ),
  );

  const inestable = {
    ...entrada,
    tasaGeneralHora: 300,
    tasaPreferencialHora: 0,
  };
  const validacion = validarEntradaLaboratorio(inestable, datos);
  assert.deepEqual(validacion.errores, []);
  assert.ok(validacion.rhoEstimado >= 1);
  assert.match(validacion.advertencias[0], /Puedes simular de todas formas/);
  assert.doesNotThrow(() => crearConfiguracionLaboratorio(inestable, datos));
});

test("serializa y carga configuración v2 y el enlace con ida y vuelta", () => {
  const entrada = {
    ...estadoActual(),
    modoLimite: "cantidad",
    cantidadPacientes: 20,
  };
  const json = serializarConfiguracionLaboratorio(entrada, datos);
  const archivo = JSON.parse(json);
  assert.equal(archivo.version, VERSION_CONFIGURACION_LABORATORIO);
  assert.equal("modoLlegadas" in archivo.configuracion, false);
  assert.deepEqual(cargarConfiguracionLaboratorio(json, datos), entrada);
  const hash = crearHashConfiguracionLaboratorio(entrada, datos);
  assert.deepEqual(leerHashConfiguracionLaboratorio(hash, datos), entrada);
});

test("las configuraciones antiguas usan valores por defecto con aviso", () => {
  const entrada = estadoActual();
  for (const archivo of [
    { version: 1, configuracion: { ...entrada, modoLlegadas: "anterior" } },
    {
      version: VERSION_CONFIGURACION_LABORATORIO,
      configuracion: { ...entrada, conteos: [] },
    },
  ]) {
    const cargada = cargarConfiguracionLaboratorio(
      JSON.stringify(archivo),
      datos,
    );
    assert.equal(
      cargada.advertencia,
      "La configuración contiene campos del formato anterior; se iniciaron los valores por defecto.",
    );
    assert.equal(cargada.tasaGeneralHora, 47);
    assert.equal("conteos" in cargada, false);
  }
});

test("rechaza configuraciones incompatibles o inválidas con error explícito", () => {
  const entrada = estadoActual();
  assert.throws(
    () =>
      cargarConfiguracionLaboratorio(
        JSON.stringify({ version: 99, configuracion: entrada }),
        datos,
      ),
    /versión de configuración no es compatible/,
  );
  const inválida = {
    ...entrada,
    nombre: "No existe",
  };
  assert.throws(
    () =>
      cargarConfiguracionLaboratorio(
        JSON.stringify({
          version: VERSION_CONFIGURACION_LABORATORIO,
          configuracion: inválida,
        }),
        datos,
      ),
    /preajuste válido/,
  );
  assert.throws(
    () => leerHashConfiguracionLaboratorio("#laboratorio=%ZZ", datos),
    /configuración codificada no válida/,
  );
});

test("las réplicas son reproducibles con la misma semilla", () => {
  const configuracion = crearConfiguracionLaboratorio(
    estadoActual(),
    datos,
  ).configuracion;
  assert.deepEqual(
    correrReplicas(configuracion, 5),
    correrReplicas(configuracion, 5),
  );
});
