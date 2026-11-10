import assert from "node:assert/strict";
import test from "node:test";
import {
  correrReplicas,
  correrReplicasAsincronas,
  valorCriticoT,
} from "../src/engine/replicas.js";

test("corre réplicas con semillas consecutivas y devuelve IC t del 95 %", () => {
  const resultado = correrReplicas(
    {
      ventanillas: [{ id: 1, nombre: "General", atiende: ["General"] }],
      llegadas: {
        modo: "poisson",
        tasas_por_minuto: { General: 0.3 },
      },
      atencion: { General: { dist: "exponencial", media: 2 } },
      horizonte_min: 40,
      semilla: 100,
      asignacion_libres: "primera_libre",
    },
    10,
  );

  assert.deepEqual(resultado.semillas, [100, 101, 102, 103, 104, 105, 106, 107, 108, 109]);
  assert.equal(resultado.replicas.length, 10);
  assert.ok(resultado.resumen.Wq.ic95.inferior <= resultado.resumen.Wq.media);
  assert.ok(resultado.resumen.Wq.media <= resultado.resumen.Wq.ic95.superior);
  assert.ok(Math.abs(valorCriticoT(9) - 2.262157) < 1e-5);
});

test("rechaza menos de dos réplicas", () => {
  assert.throws(
    () => correrReplicas({ semilla: 1 }, 1),
    /al menos dos réplicas/,
  );
});

test("las réplicas asíncronas son reproducibles y notifican el progreso", async () => {
  const configuracion = {
    ventanillas: [{ id: 1, nombre: "General", atiende: ["General"] }],
    llegadas: { modo: "poisson", tasas_por_minuto: { General: 0.3 } },
    atencion: { General: { dist: "exponencial", media: 2 } },
    horizonte_min: 40,
    semilla: 100,
    asignacion_libres: "primera_libre",
  };
  const avances = [];
  const asincrono = await correrReplicasAsincronas(configuracion, 5, {
    lote: 2,
    alProgreso: (completadas, total) => avances.push([completadas, total]),
  });
  assert.deepEqual(asincrono, correrReplicas(configuracion, 5));
  assert.deepEqual(avances, [
    [2, 5],
    [4, 5],
    [5, 5],
  ]);
});
