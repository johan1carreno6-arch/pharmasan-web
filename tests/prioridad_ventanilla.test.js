import assert from "node:assert/strict";
import test from "node:test";
import { simular } from "../src/engine/simulador.js";

const atencionExponencial = {
  General: { media: 3 },
  Preferencial: { media: 3 },
};

test("un paciente prefiere la ventanilla donde su grupo es la primera opción", () => {
  // V1 atiende General; V3 atiende Preferencial y, si no hay, General.
  // Con ambas libres, un General debe ir siempre a V1 y un Preferencial a V3,
  // sea cual sea la semilla y la regla de asignación.
  for (const asignacion of ["aleatoria", "primera_libre"]) {
    for (let semilla = 1; semilla <= 40; semilla += 1) {
      const resultado = simular({
        ventanillas: [
          { id: 1, nombre: "V1", atiende: ["General"] },
          { id: 3, nombre: "V3", atiende: ["Preferencial", "General"] },
        ],
        llegadas: {
          modo: "replay",
          pacientes: [
            { id: "g", tipo: "General", llegada_min: 0 },
            { id: "p", tipo: "Preferencial", llegada_min: 100 },
          ],
        },
        atencion: atencionExponencial,
        disciplina: "FIFO",
        colas: "separadas",
        asignacion_libres: asignacion,
        semilla,
      });
      const porId = Object.fromEntries(
        resultado.pacientes.map((paciente) => [paciente.id, paciente]),
      );
      assert.equal(porId.g.ventanilla, 1, `General fue a V3 (semilla ${semilla})`);
      assert.equal(porId.p.ventanilla, 3);
    }
  }
});

test("un general solo usa la ventanilla de apoyo cuando las suyas están ocupadas", () => {
  const resultado = simular({
    ventanillas: [
      { id: 1, nombre: "V1", atiende: ["General"] },
      { id: 3, nombre: "V3", atiende: ["Preferencial", "General"] },
    ],
    llegadas: {
      modo: "replay",
      pacientes: [
        { id: "g1", tipo: "General", llegada_min: 0 },
        { id: "g2", tipo: "General", llegada_min: 1 },
      ],
    },
    atencion: atencionExponencial,
    disciplina: "FIFO",
    colas: "separadas",
    asignacion_libres: "aleatoria",
    semilla: 7,
  });
  const porId = Object.fromEntries(
    resultado.pacientes.map((paciente) => [paciente.id, paciente]),
  );
  assert.equal(porId.g1.ventanilla, 1);
  assert.equal(porId.g2.ventanilla, 3);
  assert.equal(porId.g2.espera, 0);
});
