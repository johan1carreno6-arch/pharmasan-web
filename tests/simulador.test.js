import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { calcularMetricas } from "../src/engine/metricas.js";
import { simular } from "../src/engine/simulador.js";
import { crearConfiguracionBase } from "../src/ui/observados.js";

function configuracionBase(llegadas, cambios = {}) {
  return {
    ventanillas: [
      { id: 1, nombre: "General", atiende: ["General"] },
      { id: 2, nombre: "Preferencial", atiende: ["Preferencial"] },
    ],
    llegadas,
    atencion: {
      General: { media: 2 },
      Preferencial: { media: 2 },
    },
    disciplina: "FIFO",
    colas: "separadas",
    asignacion_libres: "primera_libre",
    semilla: 106,
    ...cambios,
  };
}

test("Poisson y servicio exponencial son reproducibles con la misma semilla", () => {
  const configuracion = configuracionBase(
    { modo: "poisson", tasas_por_minuto: { General: 0.4, Preferencial: 0.1 } },
    { horizonte_min: 30 },
  );
  assert.deepEqual(simular(configuracion), simular(configuracion));
  assert.notDeepEqual(
    simular(configuracion),
    simular({ ...configuracion, semilla: configuracion.semilla + 1 }),
  );
});

test("atiende a todos en orden FIFO sin ocupar una ventanilla dos veces", () => {
  const resultado = simular(
    configuracionBase(
      {
        modo: "replay",
        pacientes: [0, 0.5, 0.75, 1].map((llegada, indice) => ({
          id: `G${indice + 1}`,
          tipo: "General",
          llegada_min: llegada,
        })),
      },
      {
        ventanillas: [{ id: "G", nombre: "General", atiende: ["General"] }],
      },
    ),
  );
  assert.equal(resultado.pacientes.length, 4);
  assert.ok(
    resultado.pacientes.every(
      (paciente) =>
        paciente.fin > paciente.inicio && paciente.inicio >= paciente.llegada,
    ),
  );
  const porVentanilla = resultado.pacientes.toSorted(
    (a, b) => a.inicio - b.inicio,
  );
  for (let indice = 1; indice < porVentanilla.length; indice += 1) {
    assert.ok(porVentanilla[indice].inicio >= porVentanilla[indice - 1].fin);
    assert.ok(porVentanilla[indice].llegada >= porVentanilla[indice - 1].llegada);
  }
  assert.deepEqual(
    resultado.pacientes.map((paciente) => paciente.id),
    ["G1", "G2", "G3", "G4"],
  );
});

test("fin de servicio ocurre antes que llegada en el mismo instante", () => {
  const resultado = simular(
    configuracionBase(
      {
        modo: "replay",
        pacientes: [
          {
            id: "G1",
            tipo: "General",
            llegada_min: 0,
            inicio_min: 0,
            atencion_min: 2,
            ventanilla: "G",
          },
          {
            id: "G2",
            tipo: "General",
            llegada_min: 2,
            inicio_min: 2,
            atencion_min: 1,
            ventanilla: "G",
          },
        ],
        ventanilla_observada: true,
      },
      {
        ventanillas: [{ id: "G", nombre: "General", atiende: ["General"] }],
      },
    ),
  );
  const eventosEnDos = resultado.eventos.filter((evento) => evento.tiempo === 2);
  assert.deepEqual(
    eventosEnDos.map((evento) => evento.tipo),
    ["fin_servicio", "llegada"],
  );
  assert.equal(resultado.pacientes[1].espera, 0);
});

test("solo acepta llegadas Poisson o replay exacto", () => {
  const poisson = simular(
    configuracionBase(
      { modo: "poisson", tasas_por_minuto: { General: 0.1, Preferencial: 0 } },
      { horizonte_min: 10 },
    ),
  );
  assert.ok(
    poisson.pacientes.every(
      (paciente) => Number.isFinite(paciente.atencion) && paciente.atencion > 0,
    ),
  );
  assert.throws(
    () =>
      simular(
        configuracionBase(
          { modo: "no_soportado" },
          { horizonte_min: 10 },
        ),
      ),
    /Modo de llegadas desconocido/,
  );
});

test("replay observado conserva los 131 registros y las cifras de hora pico", async () => {
  const datos = JSON.parse(
    await readFile(new URL("../data/observados.json", import.meta.url), "utf8"),
  );
  const dias = [...new Set(datos.pacientes.map((paciente) => paciente.dia))];
  const resultados = dias.map((dia) =>
    simular({
      ventanillas: [
        { id: 1, nombre: "Ventanilla 1", atiende: ["General"] },
        { id: 2, nombre: "Ventanilla 2", atiende: ["General"] },
        { id: 3, nombre: "Ventanilla 3", atiende: ["Preferencial"] },
      ],
      llegadas: {
        modo: "replay",
        dia,
        pacientes: datos.pacientes,
        ventanilla_observada: true,
      },
      disciplina: "FIFO",
      colas: "separadas",
      semilla: 1,
    }),
  );
  const observados = new Map(
    datos.pacientes.map((paciente) => [paciente.id, paciente]),
  );
  const reproducidos = resultados.flatMap((resultado) => resultado.pacientes);
  assert.equal(reproducidos.length, 131);
  for (const paciente of reproducidos) {
    const origen = observados.get(paciente.id);
    assert.equal(paciente.llegada, origen.llegada_min);
    assert.equal(paciente.inicio, origen.inicio_min);
    assert.equal(paciente.fin, origen.salida_min);
    assert.equal(paciente.ventanilla, origen.ventanilla);
    assert.equal(paciente.espera, origen.espera_min);
  }
  for (const evento of resultados.flatMap((resultado) => resultado.eventos)) {
    assert.equal(evento.paciente_tipo, observados.get(evento.paciente_id).tipo);
  }

  const idsPico = new Set(datos.pico);
  const pacientesPico = reproducidos.filter((paciente) => idsPico.has(paciente.id));
  const metricasPico = calcularMetricas({
    pacientes: pacientesPico,
    eventos: [],
    ventanillas: [],
    duracion_min: 0,
  });
  assert.equal(pacientesPico.length, 71);
  assert.equal(metricasPico.Wq.toFixed(3), "0.155");
  assert.equal(pacientesPico.filter((paciente) => paciente.espera > 0).length, 7);
});

test("la configuración base estima tasas y medias sin remuestrear el registro", async () => {
  const datos = JSON.parse(
    await readFile(new URL("../data/observados.json", import.meta.url), "utf8"),
  );
  const configuracion = crearConfiguracionBase(datos);

  assert.equal(configuracion.llegadas.modo, "poisson");
  assert.equal(configuracion.llegadas.tasas_por_minuto.General, 47 / 60);
  assert.equal(configuracion.llegadas.tasas_por_minuto.Preferencial, 24 / 60);
  for (const tipo of ["General", "Preferencial"]) {
    assert.deepEqual(configuracion.atencion[tipo], {
      media: datos.atencion[tipo].media_min,
    });
  }
});

test("conteo de cola y compatibilidad de ventanillas compartidas", () => {
  const resultado = simular(
    configuracionBase(
      {
        modo: "replay",
        pacientes: [
          { id: "G1", tipo: "General", llegada_min: 0 },
          { id: "G2", tipo: "General", llegada_min: 0.1 },
          { id: "P1", tipo: "Preferencial", llegada_min: 0.2 },
        ],
      },
      {
        ventanillas: [
          { id: "V1", nombre: "Mixta", atiende: ["Preferencial", "General"] },
        ],
        colas: "compartida",
      },
    ),
  );
  const metricas = calcularMetricas(resultado);
  assert.equal(metricas.n, 3);
  assert.equal(metricas.cola_maxima, 2);
  assert.ok(
    resultado.pacientes.find((paciente) => paciente.id === "G2").inicio <
      resultado.pacientes.find((paciente) => paciente.id === "P1").inicio,
  );
});
