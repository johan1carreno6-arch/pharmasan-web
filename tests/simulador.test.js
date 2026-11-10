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
      General: { dist: "constante", media: 2 },
      Preferencial: { dist: "constante", media: 2 },
    },
    disciplina: "FIFO",
    colas: "separadas",
    asignacion_libres: "primera_libre",
    semilla: 106,
    ...cambios,
  };
}

test("la simulación es reproducible con la misma semilla", () => {
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

test("atiende a todos, respeta las filas FIFO y no ocupa una ventanilla dos veces", () => {
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
  assert.deepEqual(
    resultado.pacientes.map((paciente) => paciente.inicio),
    [0, 2, 4, 6],
  );
});

test("fin de servicio ocurre antes que llegada en el mismo instante", () => {
  const resultado = simular(
    configuracionBase(
      {
        modo: "replay",
        pacientes: [
          { id: "G1", tipo: "General", llegada_min: 0 },
          { id: "G2", tipo: "General", llegada_min: 2 },
        ],
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

test("los modos conteos, intervalos y CSV producen llegadas válidas", () => {
  const conteos = simular(
    configuracionBase(
      {
        modo: "conteos",
        dia: "Lunes",
        intervalos: [
          { dia: "Lunes", tipo: "General", inicio_min: 0, fin_min: 5, llegadas: 3 },
        ],
      },
      { horizonte_min: 5 },
    ),
  );
  assert.equal(conteos.pacientes.length, 3);
  assert.ok(conteos.pacientes.every((paciente) => paciente.llegada >= 0 && paciente.llegada < 5));

  const intervalos = simular(
    configuracionBase(
      { modo: "intervalos", tiempos_entre_llegadas: { General: [2, 3] } },
      { horizonte_min: 10 },
    ),
  );
  assert.ok(intervalos.pacientes.every((paciente) => paciente.tipo === "General"));

  const csv = simular(
    configuracionBase(
      {
        modo: "csv",
        contenido: 'id,tipo,llegada_min\n"G,1",General,1\nG2,General,2',
      },
    ),
  );
  assert.deepEqual(
    csv.pacientes.map((paciente) => paciente.id),
    ["G,1", "G2"],
  );
});

test("el servicio indicado por fila CSV prevalece sobre la distribución", () => {
  const resultado = simular(
    configuracionBase(
      {
        modo: "csv",
        pacientes: [
          { id: "G1", tipo: "General", llegada_min: 0, atencion_min: 3 },
          { id: "G2", tipo: "General", llegada_min: 0, atencion_min: 5 },
        ],
      },
      {
        ventanillas: [{ id: "G", nombre: "General", atiende: ["General"] }],
        atencion: { General: { dist: "constante", media: 100 } },
      },
    ),
  );
  assert.deepEqual(
    resultado.pacientes.map((paciente) => paciente.fin - paciente.inicio),
    [3, 5],
  );
});

test("los procesos sin fin requieren horizonte o cantidad de pacientes", () => {
  const configuracion = configuracionBase({
    modo: "poisson",
    tasas_por_minuto: { General: 0.3 },
  });
  assert.throws(() => simular(configuracion), /requiere cantidad_pacientes o horizonte_min/);
  assert.throws(
    () =>
      simular(
        configuracionBase(
          {
            modo: "poisson",
            tasas_por_minuto: {
              General: Number.MAX_VALUE,
              Preferencial: Number.MAX_VALUE,
            },
          },
          { horizonte_min: 1 },
        ),
      ),
    /tasa total de llegada debe ser finita/,
  );
});

test("replay observado conserva llegadas, ventanillas y tiempos registrados", async () => {
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

test("la configuración base de 500 réplicas se contrasta con referencia_python", async () => {
  const datos = JSON.parse(
    await readFile(new URL("../data/observados.json", import.meta.url), "utf8"),
  );
  const referencia = datos.referencia_python.escenarios.find(
    (escenario) => escenario.escenario === "base",
  );
  const { correrReplicas } = await import("../src/engine/replicas.js");
  const configuracion = crearConfiguracionBase(datos);
  const resumen = correrReplicas(configuracion, 500);

  assert.equal(resumen.semillas.length, 500);
  assert.equal(configuracion.asignacion_libres, "aleatoria");
  assert.equal(configuracion.llegadas.modo, "intervalos");
  assert.equal(configuracion.llegadas.tiempos_entre_llegadas.General.length, 44);
  assert.equal(
    configuracion.llegadas.tiempos_entre_llegadas.Preferencial.length,
    21,
  );
  assert.equal(configuracion.atencion.General.k, datos.atencion.General.erlang.forma);
  assert.equal(
    configuracion.atencion.Preferencial.k,
    datos.atencion.Preferencial.erlang.forma,
  );
  for (const tipo of ["General", "Preferencial"]) {
    assert.equal(configuracion.atencion[tipo].dist, "erlang");
    assert.equal(
      configuracion.atencion[tipo].media,
      datos.atencion[tipo].erlang.forma / datos.atencion[tipo].erlang.tasa,
    );
  }
  assert.ok(
    resumen.resumen.Wq.media >= referencia.wq_ic95_inferior &&
      resumen.resumen.Wq.media <= referencia.wq_ic95_superior,
    `Wq base=${resumen.resumen.Wq.media}; IC Python=[${referencia.wq_ic95_inferior}, ${referencia.wq_ic95_superior}]`,
  );
});

test("las llegadas uniformes de conteos siguen disponibles con nombre explícito", () => {
  const resultado = simular(
    configuracionBase(
      {
        modo: "conteos_uniformes",
        dia: "Lunes",
        intervalos: [
          { dia: "Lunes", tipo: "General", inicio_min: 0, fin_min: 5, llegadas: 3 },
        ],
      },
      { horizonte_min: 5 },
    ),
  );
  assert.equal(resultado.pacientes.length, 3);
  assert.ok(
    resultado.pacientes.every(
      (paciente) => paciente.llegada >= 0 && paciente.llegada < 5,
    ),
  );
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
  assert.equal(resultado.pacientes[0].inicio, 0);
  assert.equal(resultado.pacientes.find((paciente) => paciente.id === "P1").inicio, 2);
  assert.equal(resultado.pacientes.find((paciente) => paciente.id === "G2").inicio, 4);
});
