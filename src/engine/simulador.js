import { crearGeneradorServicio } from "./distribuciones.js";
import { MonticuloMinimo } from "./heap.js";
import { crearFlujoAleatorio } from "./prng.js";

const TIPOS = ["General", "Preferencial"];

function validarConfiguracion(configuracion) {
  if (!configuracion || typeof configuracion !== "object") {
    throw new TypeError("La configuración debe ser un objeto.");
  }
  if (!Number.isInteger(configuracion.semilla)) {
    throw new TypeError("La configuración requiere una semilla entera explícita.");
  }
  if (!Array.isArray(configuracion.ventanillas) || configuracion.ventanillas.length === 0) {
    throw new RangeError("Debe configurarse al menos una ventanilla.");
  }

  const ids = new Set();
  for (const ventanilla of configuracion.ventanillas) {
    if (ventanilla.id === undefined || ids.has(String(ventanilla.id))) {
      throw new RangeError("Cada ventanilla debe tener un identificador único.");
    }
    ids.add(String(ventanilla.id));
    if (
      !Array.isArray(ventanilla.atiende) ||
      ventanilla.atiende.length === 0 ||
      new Set(ventanilla.atiende).size !== ventanilla.atiende.length ||
      ventanilla.atiende.some((tipo) => !TIPOS.includes(tipo))
    ) {
      throw new RangeError(
        `La lista de atención de la ventanilla ${ventanilla.id} no es válida.`,
      );
    }
  }

  if (!configuracion.llegadas || typeof configuracion.llegadas.modo !== "string") {
    throw new TypeError("Debe especificarse un modo de llegadas.");
  }
  if (
    configuracion.disciplina !== undefined &&
    !["FIFO", "prioridad_preferencial"].includes(configuracion.disciplina)
  ) {
    throw new RangeError(`Disciplina desconocida: ${configuracion.disciplina}.`);
  }
  if (
    configuracion.colas !== undefined &&
    !["separadas", "compartida"].includes(configuracion.colas)
  ) {
    throw new RangeError(`Tipo de colas desconocido: ${configuracion.colas}.`);
  }
  if (
    configuracion.asignacion_libres !== undefined &&
    !["aleatoria", "primera_libre"].includes(configuracion.asignacion_libres)
  ) {
    throw new RangeError(
      `Regla de asignación de ventanillas desconocida: ${configuracion.asignacion_libres}.`,
    );
  }

  const cantidad = configuracion.cantidad_pacientes;
  if (cantidad !== undefined && (!Number.isInteger(cantidad) || cantidad < 0)) {
    throw new RangeError("La cantidad de pacientes debe ser un entero no negativo.");
  }
  const horizonte = configuracion.horizonte_min;
  if (horizonte !== undefined && (!Number.isFinite(horizonte) || horizonte < 0)) {
    throw new RangeError("El horizonte debe ser finito y no negativo.");
  }
  if (!["poisson", "replay"].includes(configuracion.llegadas.modo)) {
    throw new RangeError(
      `Modo de llegadas desconocido: ${configuracion.llegadas.modo}.`,
    );
  }
  if (
    configuracion.llegadas.modo === "poisson" &&
    cantidad === undefined &&
    horizonte === undefined
  ) {
    throw new RangeError(
      "El modo de llegadas requiere cantidad_pacientes o horizonte_min para limitar la corrida.",
    );
  }

}

function crearLlegadas(configuracion, aleatorio) {
  const parametros = configuracion.llegadas;
  let llegadas;

  if (parametros.modo === "replay") {
    const registros =
      parametros.pacientes ??
      parametros.replay ??
      parametros.registros ??
      configuracion.pacientes;
    if (!Array.isArray(registros)) {
      throw new TypeError("El modo replay requiere una lista de pacientes.");
    }
    const idsPermitidos = parametros.ids ? new Set(parametros.ids) : undefined;
    llegadas = registros
      .filter(
        (registro) =>
          (parametros.dia === undefined || registro.dia === parametros.dia) &&
          (!idsPermitidos || idsPermitidos.has(registro.id)),
      )
      .map((registro, indice) => ({
        id: registro.id ?? `Paciente ${indice + 1}`,
        tipo: registro.tipo,
        llegada: registro.llegada ?? registro.llegada_min,
        _orden: indice,
        _registro: registro,
      }));
  } else if (parametros.modo === "poisson") {
    const tasas = parametros.tasas_por_minuto;
    if (!tasas || typeof tasas !== "object") {
      throw new TypeError("Poisson requiere tasas por grupo.");
    }
    const tasaGeneral = tasas.General ?? 0;
    const tasaPreferencial = tasas.Preferencial ?? 0;
    if (
      !Number.isFinite(tasaGeneral) ||
      !Number.isFinite(tasaPreferencial) ||
      tasaGeneral < 0 ||
      tasaPreferencial < 0
    ) {
      throw new RangeError("Las tasas de llegada deben ser finitas y no negativas.");
    }
    const tasaTotal = tasaGeneral + tasaPreferencial;
    if (!Number.isFinite(tasaTotal)) {
      throw new RangeError("La tasa total de llegada debe ser finita.");
    }
    llegadas = [];
    if (tasaTotal > 0) {
      const limite = configuracion.horizonte_min ?? Infinity;
      const cantidad = configuracion.cantidad_pacientes ?? Infinity;
      let tiempo = 0;
      while (llegadas.length < cantidad) {
        tiempo -= Math.log(Math.max(aleatorio(), Number.MIN_VALUE)) / tasaTotal;
        if (tiempo > limite) break;
        llegadas.push({
          tipo:
            aleatorio() * tasaTotal < tasaGeneral
              ? "General"
              : "Preferencial",
          llegada: tiempo,
          _orden: llegadas.length,
        });
      }
    }
  } else {
    throw new RangeError(`Modo de llegadas desconocido: ${parametros.modo}.`);
  }

  for (const paciente of llegadas) {
    if (!TIPOS.includes(paciente.tipo)) {
      throw new RangeError(`Tipo de paciente desconocido: ${paciente.tipo}.`);
    }
    if (!Number.isFinite(paciente.llegada) || paciente.llegada < 0) {
      throw new RangeError("Cada llegada debe ser un tiempo finito no negativo.");
    }
  }

  llegadas.sort((a, b) => a.llegada - b.llegada || a._orden - b._orden);
  const horizonte = configuracion.horizonte_min;
  if (horizonte !== undefined) {
    llegadas = llegadas.filter((paciente) => paciente.llegada <= horizonte);
  }
  if (configuracion.cantidad_pacientes !== undefined) {
    llegadas = llegadas.slice(0, configuracion.cantidad_pacientes);
  }

  return llegadas.map((paciente, indice) => ({
    ...paciente,
    id: paciente.id ?? `Paciente ${indice + 1}`,
    _orden: indice,
  }));
}

function ordenarFila(a, b, disciplina) {
  if (disciplina === "prioridad_preferencial" && a.tipo !== b.tipo) {
    return a.tipo === "Preferencial" ? -1 : 1;
  }
  return a.llegada - b.llegada || a._orden - b._orden;
}

function copiarEstado(filas, ventanillas) {
  return {
    filas: Object.fromEntries(
      Object.entries(filas).map(([nombre, pacientes]) => [
        nombre,
        pacientes.map((paciente) => paciente.id),
      ]),
    ),
    ventanillas: ventanillas.map((ventanilla) => ({
      id: ventanilla.id,
      ocupada: Boolean(ventanilla.paciente),
      paciente: ventanilla.paciente?.id ?? null,
      tipo: ventanilla.paciente?.tipo ?? null,
    })),
  };
}

function seleccionarDeFila(
  filas,
  ventanilla,
  disciplina,
  esObservada,
  tiempo,
  compartida,
) {
  const cola = compartida
    ? filas
    : ventanilla.atiende.flatMap((tipo) => filas[tipo]);
  const candidatos = cola
    .filter(
      (paciente) =>
        ventanilla.atiende.includes(paciente.tipo) &&
        (!esObservada ||
          String(paciente._ventanilla_observada) === String(ventanilla.id)),
    )
    .sort((a, b) => ordenarFila(a, b, disciplina));
  for (const paciente of candidatos) {
    if (esObservada && paciente._inicio_observado > tiempo) {
      continue;
    }
    if (esObservada && paciente._inicio_observado < tiempo) {
      throw new RangeError(
        `El inicio observado de ${paciente.id} precede la liberación de su ventanilla.`,
      );
    }
    const filaOrigen = compartida ? filas : filas[paciente.tipo];
    filaOrigen.splice(filaOrigen.indexOf(paciente), 1);
    return paciente;
  }
  return undefined;
}

export function simular(configuracion) {
  validarConfiguracion(configuracion);

  const aleatorioLlegadas = crearFlujoAleatorio(configuracion.semilla, "llegadas");
  const aleatorioAsignacion = crearFlujoAleatorio(configuracion.semilla, "asignacion");
  const aleatoriosServicio = Object.fromEntries(
    TIPOS.map((tipo) => [
      tipo,
      crearFlujoAleatorio(configuracion.semilla, `servicio:${tipo}`),
    ]),
  );
  const llegadas = crearLlegadas(configuracion, aleatorioLlegadas);
  const esObservada = Boolean(configuracion.llegadas.ventanilla_observada);
  for (const tipo of new Set(llegadas.map((paciente) => paciente.tipo))) {
    if (!configuracion.ventanillas.some((ventanilla) => ventanilla.atiende.includes(tipo))) {
      throw new RangeError(`No hay una ventanilla que pueda atender a ${tipo}.`);
    }
    if (!esObservada && !configuracion.atencion?.[tipo]) {
      throw new TypeError(`Faltan parámetros de atención para ${tipo}.`);
    }
  }
  const generadoresServicio = Object.fromEntries(
    TIPOS.map((tipo) => {
      const parametros = configuracion.atencion?.[tipo];
      return [
        tipo,
        parametros
            ? crearGeneradorServicio(parametros.media, aleatoriosServicio[tipo])
          : undefined,
      ];
    }),
  );
  const ventanillas = configuracion.ventanillas.map((ventanilla) => ({
    ...ventanilla,
    atiende: [...ventanilla.atiende],
    paciente: null,
  }));
  const filas = configuracion.colas === "compartida"
    ? { compartida: [] }
    : { General: [], Preferencial: [] };
  const filaEspera = () =>
    configuracion.colas === "compartida"
      ? filas.compartida
      : [...filas.General, ...filas.Preferencial];
  const calendario = new MonticuloMinimo();
  const pacientesFinales = [];
  const pacientesRegistrados = new Set();
  const eventos = [];
  const disciplina = configuracion.disciplina ?? "FIFO";
  const asignacion = configuracion.asignacion_libres ?? "aleatoria";
  let ordenEvento = 0;
  let colaMaxima = 0;
  let tiempoFinal = 0;

  function registrar(tipo, tiempo, paciente) {
    tiempoFinal = Math.max(tiempoFinal, tiempo);
    eventos.push({
      tipo,
      tiempo,
      paciente_id: paciente.id,
      paciente_tipo: paciente.tipo,
      estado: copiarEstado(filas, ventanillas),
    });
  }

  function iniciarServicio(ventanilla, paciente, tiempo) {
    if (ventanilla.paciente) {
      throw new Error(`La ventanilla ${ventanilla.id} ya está ocupada.`);
    }
    const inicio = esObservada ? paciente._inicio_observado : tiempo;
    const servicio = esObservada
      ? paciente._atencion_observada
      : generadoresServicio[paciente.tipo]?.();
    if (!Number.isFinite(servicio) || servicio <= 0) {
      throw new RangeError(`La duración de servicio de ${paciente.id} no es válida.`);
    }

    paciente.inicio = inicio;
    paciente.atencion = servicio;
    paciente.espera = inicio - paciente.llegada;
    paciente.ventanilla = ventanilla.id;
    paciente.fin = inicio + servicio;
    ventanilla.paciente = paciente;
    calendario.insertar({
      tipo: "fin_servicio",
      tiempo: paciente.fin,
      paciente,
      ventanilla,
      orden: ordenEvento++,
    });
  }

  function atenderFila(ventanilla, tiempo) {
    const paciente = seleccionarDeFila(
      configuracion.colas === "compartida" ? filas.compartida : filas,
      ventanilla,
      disciplina,
      esObservada,
      tiempo,
      configuracion.colas === "compartida",
    );
    if (paciente) {
      iniciarServicio(ventanilla, paciente, tiempo);
    }
  }

  for (const paciente of llegadas) {
    const registro = paciente._registro;
    if (esObservada) {
      if (
        !Number.isFinite(registro?.inicio_min) ||
        !Number.isFinite(registro?.atencion_min) ||
        registro.atencion_min <= 0 ||
        registro.ventanilla === undefined
      ) {
        throw new RangeError(
          "La ventanilla observada requiere llegada, inicio, servicio y ventanilla del registro.",
        );
      }
      paciente._inicio_observado = registro.inicio_min;
      paciente._atencion_observada = registro.atencion_min;
      paciente._ventanilla_observada = registro.ventanilla;
      if (Math.abs(paciente._inicio_observado - paciente.llegada) < 1e-10) {
        paciente._inicio_observado = paciente.llegada;
      }
    }
    calendario.insertar({
      tipo: "llegada",
      tiempo: paciente.llegada,
      paciente,
      orden: ordenEvento++,
    });
  }

  while (calendario.longitud > 0) {
    const evento = calendario.extraerMinimo();
    tiempoFinal = Math.max(tiempoFinal, evento.tiempo);
    if (evento.tipo === "llegada") {
      const paciente = evento.paciente;
      pacientesFinales.push(paciente);
      pacientesRegistrados.add(paciente);
      if (esObservada) {
        const ventanilla = ventanillas.find(
          (elemento) =>
            String(elemento.id) === String(paciente._ventanilla_observada),
        );
        if (!ventanilla) {
          throw new RangeError(`La ventanilla observada ${paciente._ventanilla_observada} no existe.`);
        }
        if (
          paciente._inicio_observado === evento.tiempo &&
          !ventanilla.paciente
        ) {
          iniciarServicio(ventanilla, paciente, evento.tiempo);
        } else {
          if (paciente._inicio_observado === evento.tiempo) {
            throw new RangeError(
              `La ventanilla observada ${ventanilla.id} está ocupada al iniciar ${paciente.id}.`,
            );
          }
          filas[configuracion.colas === "compartida" ? "compartida" : paciente.tipo].push(
            paciente,
          );
          filas[configuracion.colas === "compartida" ? "compartida" : paciente.tipo].sort(
            (a, b) => ordenarFila(a, b, disciplina),
          );
          colaMaxima = Math.max(colaMaxima, filaEspera().length);
        }
      } else {
        const libres = ventanillas.filter((ventanilla) => ventanilla.atiende.includes(paciente.tipo));
        const libresCompatibles = libres.filter((ventanilla) => !ventanilla.paciente);

        if (libresCompatibles.length > 0) {
          // Prioridad de la ventanilla: se prefieren las que tienen al grupo del
          // paciente como primera opción de su lista "atiende" (como en Python).
          const rango = (ventanilla) => ventanilla.atiende.indexOf(paciente.tipo);
          const mejorRango = Math.min(...libresCompatibles.map(rango));
          const candidatas = libresCompatibles.filter(
            (ventanilla) => rango(ventanilla) === mejorRango,
          );
          const indice =
            asignacion === "primera_libre"
              ? 0
              : Math.floor(aleatorioAsignacion() * candidatas.length);
          iniciarServicio(candidatas[indice], paciente, evento.tiempo);
        } else {
          filas[configuracion.colas === "compartida" ? "compartida" : paciente.tipo].push(
            paciente,
          );
          filas[configuracion.colas === "compartida" ? "compartida" : paciente.tipo].sort(
            (a, b) => ordenarFila(a, b, disciplina),
          );
          colaMaxima = Math.max(colaMaxima, filaEspera().length);
        }
      }
      registrar("llegada", evento.tiempo, paciente);
    } else {
      const paciente = evento.paciente;
      evento.ventanilla.paciente = null;
      paciente.fin = evento.tiempo;
      if (!pacientesRegistrados.has(paciente)) {
        throw new Error(`Terminó el servicio de un paciente no registrado: ${paciente.id}.`);
      }
      atenderFila(evento.ventanilla, evento.tiempo);
      registrar("fin_servicio", evento.tiempo, paciente);
    }
  }

  if (pacientesFinales.some((paciente) => !Number.isFinite(paciente.fin))) {
    const pendientes = pacientesFinales
      .filter((paciente) => !Number.isFinite(paciente.fin))
      .map((paciente) => paciente.id);
    throw new Error(`Quedaron pacientes sin atender: ${pendientes.join(", ")}.`);
  }

  return {
    pacientes: pacientesFinales.map((paciente) => ({
      id: paciente.id,
      tipo: paciente.tipo,
      llegada: paciente.llegada,
      inicio: paciente.inicio,
      fin: paciente.fin,
      ventanilla: paciente.ventanilla,
      espera: paciente.espera,
      atencion: paciente.atencion,
    })),
    eventos,
    ventanillas: configuracion.ventanillas.map(({ id, nombre, atiende }) => ({
      id,
      nombre,
      atiende: [...atiende],
    })),
    duracion_min: Math.max(tiempoFinal, configuracion.horizonte_min ?? 0),
    cola_maxima: colaMaxima,
  };
}
