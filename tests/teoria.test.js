import assert from "node:assert/strict";
import test from "node:test";
import { calcularMMc } from "../src/engine/teoria.js";
import { correrReplicas } from "../src/engine/replicas.js";

function configuracionMM(tasaLlegada, servidores, semilla) {
  return {
    ventanillas: Array.from({ length: servidores }, (_, indice) => ({
      id: indice + 1,
      nombre: `V${indice + 1}`,
      atiende: ["General"],
    })),
    llegadas: {
      modo: "poisson",
      tasas_por_minuto: { General: tasaLlegada },
    },
    atencion: { General: { media: 1 } },
    disciplina: "FIFO",
    colas: "separadas",
    asignacion_libres: "primera_libre",
    cantidad_pacientes: 500,
    semilla,
  };
}

test("M/M/1 coincide con Wq y Lq analíticos dentro del IC 95 %", () => {
  const teórico = calcularMMc(0.55, 1, 1);
  const simulación = correrReplicas(configuracionMM(0.55, 1, 20261109), 60);
  assert.ok(
    simulación.resumen.Wq.ic95.inferior <= teórico.Wq &&
      teórico.Wq <= simulación.resumen.Wq.ic95.superior,
    `Wq teórico=${teórico.Wq}; IC=${JSON.stringify(simulación.resumen.Wq.ic95)}`,
  );
  assert.ok(
    simulación.resumen.Lq.ic95.inferior <= teórico.Lq &&
      teórico.Lq <= simulación.resumen.Lq.ic95.superior,
    `Lq teórico=${teórico.Lq}; IC=${JSON.stringify(simulación.resumen.Lq.ic95)}`,
  );
});

test("M/M/2 coincide con Wq y Lq analíticos dentro del IC 95 %", () => {
  const teórico = calcularMMc(1.2, 1, 2);
  const simulación = correrReplicas(configuracionMM(1.2, 2, 20261110), 60);
  assert.ok(
    simulación.resumen.Wq.ic95.inferior <= teórico.Wq &&
      teórico.Wq <= simulación.resumen.Wq.ic95.superior,
    `Wq teórico=${teórico.Wq}; IC=${JSON.stringify(simulación.resumen.Wq.ic95)}`,
  );
  assert.ok(
    simulación.resumen.Lq.ic95.inferior <= teórico.Lq &&
      teórico.Lq <= simulación.resumen.Lq.ic95.superior,
    `Lq teórico=${teórico.Lq}; IC=${JSON.stringify(simulación.resumen.Lq.ic95)}`,
  );
});
