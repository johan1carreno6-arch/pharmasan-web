import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { correrReplicas } from "../src/engine/replicas.js";
import { simular } from "../src/engine/simulador.js";
import { crearConfiguracionBase } from "../src/ui/observados.js";

const atencionConstante = {
  General: { dist: "constante", media: 3 },
  Preferencial: { dist: "constante", media: 3 },
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
        atencion: atencionConstante,
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
    atencion: atencionConstante,
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

async function leerDatos() {
  return JSON.parse(await readFile(new URL("../data/observados.json", import.meta.url), "utf8"));
}

function referencia(datos, nombre) {
  const fila = datos.referencia_python.escenarios.find((x) => x.escenario === nombre);
  assert.ok(fila, `Falta la referencia ${nombre}`);
  return fila;
}

test("la política flexible reproduce la referencia de Python (500 réplicas)", async () => {
  const datos = await leerDatos();
  const configuracion = crearConfiguracionBase(datos, datos.meta.semilla_usada);
  configuracion.ventanillas[2].atiende = ["Preferencial", "General"];
  const wq = correrReplicas(configuracion, 500).resumen.Wq;
  const ref = referencia(datos, "flexible");
  // La media de Python debe caer dentro del IC 95 % del motor web.
  assert.ok(
    ref.wq_min >= wq.ic95.inferior && ref.wq_min <= wq.ic95.superior,
    `Wq flexible web ${wq.media.toFixed(4)} IC [${wq.ic95.inferior.toFixed(4)}; ${wq.ic95.superior.toFixed(4)}] vs Python ${ref.wq_min.toFixed(4)}`,
  );
});

test("la cola compartida con prioridad reproduce la referencia pooled de Python (500 réplicas)", async () => {
  const datos = await leerDatos();
  const configuracion = crearConfiguracionBase(datos, datos.meta.semilla_usada);
  configuracion.ventanillas.forEach((ventanilla) => {
    ventanilla.atiende = ["Preferencial", "General"];
  });
  configuracion.colas = "compartida";
  configuracion.disciplina = "prioridad_preferencial";
  const wq = correrReplicas(configuracion, 500).resumen.Wq;
  const ref = referencia(datos, "pooled_prioridad");
  assert.ok(
    ref.wq_min >= wq.ic95.inferior && ref.wq_min <= wq.ic95.superior,
    `Wq pooled web ${wq.media.toFixed(4)} IC [${wq.ic95.inferior.toFixed(4)}; ${wq.ic95.superior.toFixed(4)}] vs Python ${ref.wq_min.toFixed(4)}`,
  );
});
