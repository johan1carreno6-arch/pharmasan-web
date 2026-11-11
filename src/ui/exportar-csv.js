const DIAS = new Map([
  ["Lunes", "lunes"],
  ["Martes", "martes"],
  ["Viernes", "viernes"],
  ["Los tres", "los-tres"],
  ["Simulación", "simulacion"],
]);

const TRAMOS = new Map([
  ["hora_pico", "hora-pico"],
  ["jornada_completa", "jornada-completa"],
  ["simular_aleatoriamente", "simular-aleatoriamente"],
]);

function citar(valor) {
  return `"${String(valor).replaceAll('"', '""')}"`;
}

function decimal(valor, campo) {
  if (!Number.isFinite(valor)) {
    throw new TypeError(`El campo ${campo} debe ser un número finito.`);
  }
  return String(valor).replace(".", ",");
}

export function crearCsvPacientes(pacientes, datos) {
  if (!Array.isArray(pacientes) || !Array.isArray(datos?.pacientes)) {
    throw new TypeError("El CSV requiere pacientes de la corrida y datos observados.");
  }
  const observadosPorId = new Map(
    datos.pacientes.map((paciente) => [paciente.id, paciente]),
  );
  const filas = [
    [
      "Paciente",
      "Día",
      "Grupo",
      "Llegada (min)",
      "Ventanilla",
      "Inicio (min)",
      "Atención (min)",
      "Espera (min)",
      "Fin (min)",
    ].map(citar),
  ];

  for (const paciente of pacientes) {
    const observado = observadosPorId.get(paciente.id);
    if (!observado) {
      throw new RangeError(`No se encontró el día observado de ${paciente.id}.`);
    }
    filas.push([
      citar(paciente.id),
      citar(observado.dia),
      citar(paciente.tipo),
      decimal(paciente.llegada, "llegada"),
      citar(paciente.ventanilla),
      decimal(paciente.inicio, "inicio"),
      decimal(paciente.atencion, "atención"),
      decimal(paciente.espera, "espera"),
      decimal(paciente.fin, "fin"),
    ]);
  }

  return `\uFEFF${filas.map((fila) => fila.join(";")).join("\r\n")}\r\n`;
}

export function nombreCsvReproduccion(seleccion) {
  const dia = DIAS.get(seleccion?.dia);
  const tramo = TRAMOS.get(seleccion?.tramo);
  if (!dia || !tramo) {
    throw new RangeError("El día o el tramo de la reproducción no es válido.");
  }
  return `pharmasan-reproduccion-${dia}-${tramo}.csv`;
}
