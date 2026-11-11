import assert from "node:assert/strict";
import test from "node:test";
import {
  crearCsvPacientes,
  nombreCsvReproduccion,
} from "../src/ui/exportar-csv.js";

test("exporta la reproducción con encabezados en español y decimales locales", () => {
  const pacientes = [
    {
      id: 'P;"1',
      tipo: "General",
      llegada: 1.5,
      ventanilla: 2,
      inicio: 2,
      atencion: 3.25,
      espera: 0.5,
      fin: 5.25,
    },
  ];
  const datos = {
    pacientes: [{ id: 'P;"1', dia: "Viernes" }],
  };

  assert.equal(
    crearCsvPacientes(pacientes, datos),
    "\uFEFF" +
      '"Paciente";"Día";"Grupo";"Llegada (min)";"Ventanilla";"Inicio (min)";' +
      '"Atención (min)";"Espera (min)";"Fin (min)"\r\n' +
      '"P;""1";"Viernes";"General";1,5;"2";2;3,25;0,5;5,25\r\n',
  );
});

test("crea nombres de archivo para cada selección disponible", () => {
  assert.equal(
    nombreCsvReproduccion({ dia: "Los tres", tramo: "hora_pico" }),
    "pharmasan-reproduccion-los-tres-hora-pico.csv",
  );
  assert.equal(
    nombreCsvReproduccion({ dia: "Martes", tramo: "jornada_completa" }),
    "pharmasan-reproduccion-martes-jornada-completa.csv",
  );
  assert.equal(
    nombreCsvReproduccion({
      dia: "Simulación",
      tramo: "simular_aleatoriamente",
    }),
    "pharmasan-reproduccion-simulacion-simular-aleatoriamente.csv",
  );
});

test("rechaza datos incompletos al preparar la descarga", () => {
  assert.throws(() => crearCsvPacientes([], {}), TypeError);
  assert.throws(
    () =>
      crearCsvPacientes(
        [{ id: "P1", llegada: Number.POSITIVE_INFINITY }],
        { pacientes: [{ id: "P1", dia: "Lunes" }] },
      ),
    /llegada debe ser un número finito/,
  );
  assert.throws(
    () => crearCsvPacientes([{ id: "P2" }], { pacientes: [] }),
    /No se encontró el día observado/,
  );
  assert.throws(
    () => nombreCsvReproduccion({ dia: "Miércoles", tramo: "hora_pico" }),
    RangeError,
  );
});
