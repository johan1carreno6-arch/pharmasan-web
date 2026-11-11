const TIPOS = ["General", "Preferencial"];

export function crearConfiguracionBase(datos, semilla = datos?.meta?.semilla_usada) {
  if (!datos || !Array.isArray(datos.pacientes) || !Array.isArray(datos.pico)) {
    throw new TypeError("Los datos observados deben incluir pacientes y el pico.");
  }
  if (!Number.isInteger(semilla)) {
    throw new TypeError("La configuración base requiere una semilla entera.");
  }

  const idsPico = new Set(datos.pico);
  const pacientesPico = datos.pacientes.filter((paciente) =>
    idsPico.has(paciente.id),
  );
  if (pacientesPico.length === 0) {
    throw new RangeError("No hay pacientes observados en el pico.");
  }
  const inicioPico = Math.min(...pacientesPico.map((paciente) => paciente.llegada_min));
  const finPico = Math.max(...pacientesPico.map((paciente) => paciente.llegada_min));
  const duracionPicoMin = finPico - inicioPico;
  if (!Number.isFinite(duracionPicoMin) || duracionPicoMin <= 0) {
    throw new RangeError("El intervalo observado del pico debe tener duración positiva.");
  }

  const tasasPorHora = Object.fromEntries(
    TIPOS.map((tipo) => [
      tipo,
      (pacientesPico.filter((paciente) => paciente.tipo === tipo).length * 60) /
        duracionPicoMin,
    ]),
  );
  const atencion = Object.fromEntries(
    TIPOS.map((tipo) => {
      const media = datos.atencion?.[tipo]?.media_min;
      if (!Number.isFinite(media) || media <= 0) {
        throw new RangeError(`Falta la media de atención observada para ${tipo}.`);
      }
      return [tipo, { media }];
    }),
  );

  return {
    ventanillas: [
      { id: 1, nombre: "Ventanilla 1", atiende: ["General"] },
      { id: 2, nombre: "Ventanilla 2", atiende: ["General"] },
      { id: 3, nombre: "Ventanilla 3", atiende: ["Preferencial"] },
    ],
    llegadas: {
      modo: "poisson",
      tasas_por_minuto: Object.fromEntries(
        TIPOS.map((tipo) => [tipo, tasasPorHora[tipo] / 60]),
      ),
    },
    atencion,
    disciplina: "FIFO",
    colas: "separadas",
    asignacion_libres: "aleatoria",
    horizonte_min: 60,
    semilla,
  };
}
