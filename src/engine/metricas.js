function promedio(valores) {
  return valores.length === 0
    ? 0
    : valores.reduce((suma, valor) => suma + valor, 0) / valores.length;
}

export function calcularMetricas(resultado, opciones = {}) {
  if (!resultado || !Array.isArray(resultado.pacientes) || !Array.isArray(resultado.eventos)) {
    throw new TypeError("El resultado debe incluir pacientes y eventos.");
  }

  const duracion = resultado.duracion_min;
  if (!Number.isFinite(duracion) || duracion < 0) {
    throw new RangeError("La duración de la simulación no es válida.");
  }

  const pacientes = resultado.pacientes;
  const n = pacientes.length;
  const esperas = pacientes.map((paciente) => paciente.espera);
  const permanencias = pacientes.map((paciente) => paciente.fin - paciente.llegada);
  const meta = opciones.meta ?? 2;
  const maximoTolerable = opciones.maximo_tolerable ?? 5;
  const proporcionPermitida = opciones.proporcion_permitida ?? 0.05;
  if (
    !Number.isFinite(meta) ||
    !Number.isFinite(maximoTolerable) ||
    !Number.isFinite(proporcionPermitida) ||
    proporcionPermitida < 0 ||
    proporcionPermitida > 1
  ) {
    throw new RangeError("Los parámetros del criterio de servicio no son válidos.");
  }

  let cola = 0;
  let ocupadas = 0;
  let anterior = 0;
  let areaCola = 0;
  let areaSistema = 0;
  const ocupacion = new Map(
    (resultado.ventanillas ?? []).map((ventanilla) => [String(ventanilla.id), 0]),
  );
  const colaPorGrupo = { General: 0, Preferencial: 0 };
  const areaColaPorGrupo = { General: 0, Preferencial: 0 };
  const tipoPorPaciente = new Map(
    pacientes.map((paciente) => [String(paciente.id), paciente.tipo]),
  );
  const pacienteEnServicio = new Map(
    (resultado.ventanillas ?? []).map((ventanilla) => [String(ventanilla.id), null]),
  );
  let colaMaxima = 0;

  for (const evento of resultado.eventos) {
    const transcurrido = evento.tiempo - anterior;
    areaCola += cola * transcurrido;
    areaSistema += (cola + ocupadas) * transcurrido;
    for (const tipo of Object.keys(colaPorGrupo)) {
      areaColaPorGrupo[tipo] += colaPorGrupo[tipo] * transcurrido;
    }
    for (const [id, paciente] of pacienteEnServicio) {
      if (paciente) {
        ocupacion.set(id, ocupacion.get(id) + transcurrido);
      }
    }

    const estado = evento.estado;
    if (!estado || !estado.filas || !Array.isArray(estado.ventanillas)) {
      throw new TypeError("Cada evento debe registrar las filas y las ventanillas.");
    }
    cola = Object.values(estado.filas).reduce((suma, fila) => suma + fila.length, 0);
    colaPorGrupo.General = 0;
    colaPorGrupo.Preferencial = 0;
    for (const id of Object.values(estado.filas).flat()) {
      const tipo = tipoPorPaciente.get(String(id));
      if (tipo in colaPorGrupo) colaPorGrupo[tipo] += 1;
    }
    ocupadas = estado.ventanillas.filter((ventanilla) => ventanilla.ocupada).length;
    colaMaxima = Math.max(colaMaxima, cola);
    anterior = evento.tiempo;

    for (const ventanilla of estado.ventanillas) {
      pacienteEnServicio.set(
        String(ventanilla.id),
        ventanilla.ocupada ? ventanilla.paciente : null,
      );
    }
  }

  const colaFinal = Math.max(0, duracion - anterior);
  areaCola += cola * colaFinal;
  areaSistema += (cola + ocupadas) * colaFinal;
  for (const tipo of Object.keys(colaPorGrupo)) {
    areaColaPorGrupo[tipo] += colaPorGrupo[tipo] * colaFinal;
  }
  for (const [id, paciente] of pacienteEnServicio) {
    if (paciente) {
      ocupacion.set(id, ocupacion.get(id) + colaFinal);
    }
  }

  const rhoPorVentanilla = Object.fromEntries(
    (resultado.ventanillas ?? []).map((ventanilla) => [
      ventanilla.id,
      duracion > 0 ? (ocupacion.get(String(ventanilla.id)) ?? 0) / duracion : 0,
    ]),
  );
  const rhoGlobal =
    duracion > 0 && Object.keys(rhoPorVentanilla).length > 0
      ? Object.values(rhoPorVentanilla).reduce((suma, rho) => suma + rho, 0) /
        Object.keys(rhoPorVentanilla).length
      : 0;
  const pacientesEsperaron = esperas.filter((espera) => espera > 0).length;
  const pacientesSobreTolerancia = esperas.filter(
    (espera) => espera > maximoTolerable,
  ).length;
  const proporciónSobreTolerancia = n === 0 ? 0 : pacientesSobreTolerancia / n;
  const porGrupo = Object.fromEntries(
    ["General", "Preferencial"].map((tipo) => {
      const grupo = pacientes.filter((paciente) => paciente.tipo === tipo);
      return [
        tipo,
        {
          n: grupo.length,
          Wq: promedio(grupo.map((paciente) => paciente.espera)),
          W: promedio(grupo.map((paciente) => paciente.fin - paciente.llegada)),
          Lq: duracion > 0 ? areaColaPorGrupo[tipo] / duracion : 0,
          P_esperar:
            grupo.length === 0
              ? 0
              : grupo.filter((paciente) => paciente.espera > 0).length / grupo.length,
        },
      ];
    }),
  );
  const Wq = promedio(esperas);
  const W = promedio(permanencias);

  return {
    n,
    rho_global: rhoGlobal,
    rho_por_ventanilla: rhoPorVentanilla,
    Lq: duracion > 0 ? areaCola / duracion : 0,
    L: duracion > 0 ? areaSistema / duracion : 0,
    Wq,
    W,
    por_grupo: porGrupo,
    porcentaje_espera_mayor_tolerable:
      n === 0 ? 0 : (100 * pacientesSobreTolerancia) / n,
    proporcion_espera_mayor_tolerable: proporciónSobreTolerancia,
    P_esperar: n === 0 ? 0 : pacientesEsperaron / n,
    cola_maxima: Math.max(resultado.cola_maxima ?? 0, colaMaxima),
    criterio: {
      meta,
      maximo_tolerable: maximoTolerable,
      proporcion_permitida: proporcionPermitida,
      cumple: Wq <= meta && proporciónSobreTolerancia <= proporcionPermitida,
    },
  };
}
