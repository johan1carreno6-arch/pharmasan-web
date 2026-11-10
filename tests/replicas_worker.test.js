import assert from "node:assert/strict";
import test from "node:test";
import {
  ejecutarTrabajoReplicas,
  escalarConfiguracionDemanda,
} from "../src/engine/replicas-worker.js";
import {
  correrReplicas,
  ReplicasCanceladasError,
} from "../src/engine/replicas.js";

function configuracionBase() {
  return {
    ventanillas: [
      { id: 1, nombre: "General", atiende: ["General"] },
      { id: 2, nombre: "Preferencial", atiende: ["Preferencial"] },
    ],
    llegadas: {
      modo: "poisson",
      tasas_por_minuto: { General: 0.3, Preferencial: 0.1 },
    },
    atencion: {
      General: { dist: "exponencial", media: 2 },
      Preferencial: { dist: "exponencial", media: 2.5 },
    },
    horizonte_min: 40,
    cantidad_pacientes: 500,
    semilla: 20261109,
    asignacion_libres: "primera_libre",
  };
}

const criterio = {
  meta: 2,
  maximo_tolerable: 5,
  proporcion_permitida: 0.05,
};

test("el núcleo del Web Worker coincide con las réplicas síncronas", async () => {
  const configuracion = configuracionBase();
  const esperado = correrReplicas(configuracion, 8, criterio);
  const obtenido = await ejecutarTrabajoReplicas({
    tipo: "replicas",
    configuracion,
    cantidad: 8,
    opciones: criterio,
  });

  assert.deepEqual(obtenido, { tipo: "replicas", resultado: esperado });
  assert.deepEqual(
    Object.keys(obtenido.resultado.resumen.rho_por_ventanilla),
    ["1", "2"],
  );
});

test("una réplica en el worker informa medias sin inventar intervalos", async () => {
  const obtenido = await ejecutarTrabajoReplicas({
    tipo: "replicas",
    configuracion: configuracionBase(),
    cantidad: 1,
    opciones: criterio,
  });

  assert.equal(obtenido.resultado.cantidad, 1);
  assert.equal(obtenido.resultado.resumen.Wq.ic95, undefined);
  assert.equal(
    obtenido.resultado.resumen.rho_por_ventanilla["1"].ic95,
    undefined,
  );
});

test("cancelar réplicas no devuelve un resultado parcial", async () => {
  let cancelado = false;
  let resultadoParcial;
  const promesa = ejecutarTrabajoReplicas(
    {
      tipo: "replicas",
      configuracion: configuracionBase(),
      cantidad: 100,
      opciones: criterio,
    },
    {
      estaCancelado: () => cancelado,
      alProgreso: (completadas) => {
        if (completadas >= 10) cancelado = true;
      },
    },
  ).then((resultado) => {
    resultadoParcial = resultado;
  });

  await assert.rejects(promesa, ReplicasCanceladasError);
  assert.equal(resultadoParcial, undefined);
});

test("la comparación reutiliza semillas y barre once factores de demanda", async () => {
  const configuracion = configuracionBase();
  const escenario = { nombre: "Base", configuracion, criterio };
  const avances = [];
  const resultado = await ejecutarTrabajoReplicas({
    tipo: "comparar",
    escenarios: [escenario],
    barridoDemanda: [escenario],
    cantidad: 4,
    semillaComun: configuracion.semilla,
  }, {
    alProgreso: (_completadas, _total, detalle) => avances.push(detalle),
  });

  assert.deepEqual(resultado.escenarios[0].semillas, [
    configuracion.semilla,
    configuracion.semilla + 1,
    configuracion.semilla + 2,
    configuracion.semilla + 3,
  ]);
  assert.equal(resultado.barridos[0].puntos.length, 11);
  assert.equal(resultado.barridos[0].puntos[0].factor, 1);
  assert.equal(resultado.barridos[0].puntos.at(-1).factor, 2);
  assert.ok(
    avances.some(
      (avance) => avance.tarea === "barrido" && avance.factor === 1.1,
    ),
  );
});

test("el barrido duplica tasas y acorta intervalos sin mutar el original", () => {
  const original = {
    semilla: 10,
    llegadas: {
      modo: "intervalos",
      tiempos_entre_llegadas: { General: [2, 4], Preferencial: [6] },
    },
  };
  const escalada = escalarConfiguracionDemanda(original, 2);

  assert.deepEqual(escalada.llegadas.tiempos_entre_llegadas, {
    General: [1, 2],
    Preferencial: [3],
  });
  assert.deepEqual(original.llegadas.tiempos_entre_llegadas, {
    General: [2, 4],
    Preferencial: [6],
  });
});
