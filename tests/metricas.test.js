import assert from "node:assert/strict";
import test from "node:test";
import { calcularMetricas } from "../src/engine/metricas.js";
import { simular } from "../src/engine/simulador.js";

test("calcula métricas por paciente, tiempo, ventanilla y grupo", () => {
  const resultado = simular({
    ventanillas: [{ id: 1, nombre: "General", atiende: ["General"] }],
    llegadas: {
      modo: "replay",
      pacientes: [
        {
          id: "G1",
          tipo: "General",
          llegada_min: 0,
          inicio_min: 0,
          atencion_min: 3,
          ventanilla: 1,
        },
        {
          id: "G2",
          tipo: "General",
          llegada_min: 1,
          inicio_min: 3,
          atencion_min: 3,
          ventanilla: 1,
        },
      ],
      ventanilla_observada: true,
    },
    semilla: 3,
    asignacion_libres: "primera_libre",
  });
  const metricas = calcularMetricas(resultado, {
    meta: 1,
    maximo_tolerable: 1,
    proporcion_permitida: 0.5,
  });

  assert.equal(metricas.n, 2);
  assert.equal(metricas.Wq, 1);
  assert.equal(metricas.W, 4);
  assert.equal(metricas.Lq, 1 / 3);
  assert.equal(metricas.L, 4 / 3);
  assert.equal(metricas.rho_global, 1);
  assert.equal(metricas.rho_por_ventanilla[1], 1);
  assert.equal(metricas.por_grupo.General.Wq, 1);
  assert.equal(metricas.por_grupo.General.Lq, 1 / 3);
  assert.equal(metricas.P_esperar, 0.5);
  assert.equal(metricas.porcentaje_espera_mayor_tolerable, 50);
  assert.equal(metricas.cola_maxima, 1);
  assert.equal(metricas.criterio.cumple, true);
});

test("usa los criterios predeterminados y rechaza resultados incompletos", () => {
  const resultado = simular({
    ventanillas: [{ id: 1, nombre: "General", atiende: ["General"] }],
    llegadas: { modo: "replay", pacientes: [] },
    semilla: 5,
    horizonte_min: 8,
  });
  const metricas = calcularMetricas(resultado);
  assert.deepEqual(metricas.criterio, {
    meta: 2,
    maximo_tolerable: 5,
    proporcion_permitida: 0.05,
    cumple: true,
  });
  assert.equal(metricas.rho_global, 0);
  assert.throws(() => calcularMetricas({ pacientes: [], eventos: [] }), /duración/);
});
