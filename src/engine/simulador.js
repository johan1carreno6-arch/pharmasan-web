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
  const requiereLimite =
    configuracion.llegadas.modo === "poisson" ||
    (configuracion.llegadas.modo === "intervalos" &&
      !Array.isArray(configuracion.llegadas.tiempos_llegada));
  if (requiereLimite && cantidad === undefined && horizonte === undefined) {
    throw new RangeError(
      "El modo de llegadas requiere cantidad_pacientes o horizonte_min para limitar la corrida.",
    );
  }

}

function crearLlegadas(configuracion, aleatorio) {
  const parametros = configuracion.llegadas;
  const modo = parametros.modo;
  let llegadas;

  if (modo === "replay") {
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
  } else if (modo === "csv") {
    if (Array.isArray(parametros.pacientes)) {
      llegadas = parametros.pacientes.map((registro, indice) => ({
        id: registro.id ?? `Paciente ${indice + 1}`,
        tipo: registro.tipo,
        llegada: registro.llegada ?? registro.llegada_min,
        _atencion_csv: registro.atencion_min,
        _orden: indice,
        _registro: registro,
      }));
    } else if (typeof parametros.contenido === "string") {
      llegadas = parsearCsvLlegadas(parametros.contenido).map((registro, indice) => ({
        ...registro,
        _orden: indice,
        _registro: registro,
      }));
    } else {
      throw new TypeError("El modo csv requiere el texto CSV en «contenido».");
    }
  } else if (modo === "conteos" || modo === "conteos_uniformes") {
    llegadas = crearLlegadasPorConteos(parametros, aleatorio);
  } else if (modo === "poisson") {
    llegadas = crearLlegadasPoisson(parametros, configuracion, aleatorio);
  } else if (modo === "intervalos") {
    llegadas = crearLlegadasPorIntervalos(parametros, configuracion, aleatorio);
  } else {
    throw new RangeError(`Modo de llegadas desconocido: ${modo}.`);
  }

  for (const paciente of llegadas) {
    if (!TIPOS.includes(paciente.tipo)) {
      throw new RangeError(`Tipo de paciente desconocido: ${paciente.tipo}.`);
    }
    if (!Number.isFinite(paciente.llegada) || paciente.llegada < 0) {
      throw new RangeError("Cada llegada debe ser un tiempo finito no negativo.");
    }
    if (
      paciente._atencion_csv !== undefined &&
      (!Number.isFinite(paciente._atencion_csv) || paciente._atencion_csv <= 0)
    ) {
      throw new RangeError(`La duración de atención de ${paciente.id} no es válida.`);
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

function cantidadDeConteo(registro) {
  const cantidad = registro.llegadas ?? registro.cantidad ?? registro.conteo;
  if (!Number.isInteger(cantidad) || cantidad < 0) {
    throw new RangeError("Cada intervalo de conteo requiere un entero no negativo.");
  }
  return cantidad;
}

function crearLlegadasPorConteos(parametros, aleatorio) {
  const intervalos = parametros.intervalos ?? parametros.conteos;
  if (!Array.isArray(intervalos)) {
    throw new TypeError("El modo conteos requiere «intervalos» con cantidades observadas.");
  }
  const dias = [...new Set(intervalos.map((registro) => registro.dia).filter(Boolean))];
  const dia = parametros.dia ?? (dias.length ? dias[Math.floor(aleatorio() * dias.length)] : undefined);
  const seleccionados = intervalos.filter(
    (registro) => dia === undefined || registro.dia === dia,
  );
  const pacientes = [];

  for (const intervalo of seleccionados) {
    const inicio = intervalo.inicio_min ?? intervalo.inicio;
    const fin = intervalo.fin_min ?? intervalo.fin;
    if (!Number.isFinite(inicio) || !Number.isFinite(fin) || fin <= inicio) {
      throw new RangeError("Cada intervalo de conteo requiere inicio y fin válidos.");
    }
    const cantidad = cantidadDeConteo(intervalo);
    for (let indice = 0; indice < cantidad; indice += 1) {
      let tipo = intervalo.tipo;
      if (tipo === undefined) {
        const proporcion = parametros.proporcion_preferencial ?? 0.5;
        if (!Number.isFinite(proporcion) || proporcion < 0 || proporcion > 1) {
          throw new RangeError("La proporción preferencial debe estar entre cero y uno.");
        }
        tipo = aleatorio() < proporcion ? "Preferencial" : "General";
      }
      pacientes.push({
        tipo,
        llegada: inicio + aleatorio() * (fin - inicio),
        dia,
        _orden: pacientes.length,
      });
    }
  }

  return pacientes;
}

function tasasPorTipo(parametros) {
  if (parametros.tasas_por_minuto) {
    return parametros.tasas_por_minuto;
  }
  if (parametros.tasas) {
    return parametros.tasas;
  }
  const total = parametros.tasa_por_minuto ?? parametros.lambda;
  if (Number.isFinite(total)) {
    const proporcion = parametros.proporcion_preferencial ?? 0.5;
    if (!Number.isFinite(proporcion) || proporcion < 0 || proporcion > 1) {
      throw new RangeError("La proporción preferencial debe estar entre cero y uno.");
    }
    return {
      General: total * (1 - proporcion),
      Preferencial: total * proporcion,
    };
  }
  throw new TypeError("Poisson requiere tasas por grupo o una tasa total.");
}

function crearLlegadasPoisson(parametros, configuracion, aleatorio) {
  const tasas = tasasPorTipo(parametros);
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
  if (tasaTotal === 0) {
    return [];
  }

  const limite = configuracion.horizonte_min ?? Infinity;
  const cantidad = configuracion.cantidad_pacientes ?? Infinity;
  const pacientes = [];
  let tiempo = 0;

  while (pacientes.length < cantidad) {
    tiempo -= Math.log(Math.max(aleatorio(), Number.MIN_VALUE)) / tasaTotal;
    if (tiempo > limite) {
      break;
    }
    const tipo = aleatorio() * tasaTotal < tasaGeneral ? "General" : "Preferencial";
    pacientes.push({ tipo, llegada: tiempo, _orden: pacientes.length });
  }

  return pacientes;
}

function crearLlegadasPorIntervalos(parametros, configuracion, aleatorio) {
  if (Array.isArray(parametros.tiempos_llegada)) {
    return parametros.tiempos_llegada.map((paciente, indice) =>
      typeof paciente === "number"
        ? {
            tipo: tipoAleatorio(parametros, aleatorio),
            llegada: paciente,
            _orden: indice,
          }
        : { ...paciente, llegada: paciente.llegada ?? paciente.llegada_min, _orden: indice },
    );
  }

  if (Array.isArray(parametros.intervalos_min)) {
    const intervalos = parametros.intervalos_min;
    if (
      intervalos.length === 0 ||
      intervalos.some((valor) => !Number.isFinite(valor) || valor < 0) ||
      !intervalos.some((valor) => valor > 0)
    ) {
      throw new RangeError(
        "Los intervalos globales deben ser finitos, no negativos y contener alguno positivo.",
      );
    }
    const limite = configuracion.horizonte_min ?? Infinity;
    const cantidad = configuracion.cantidad_pacientes ?? Infinity;
    const pacientes = [];
    let tiempo = 0;
    while (pacientes.length < cantidad) {
      tiempo += intervalos[Math.floor(aleatorio() * intervalos.length)];
      if (tiempo >= limite) {
        break;
      }
      pacientes.push({
        tipo: tipoAleatorio(parametros, aleatorio),
        llegada: tiempo,
        _orden: pacientes.length,
      });
    }
    return pacientes;
  }

  const valores =
    parametros.por_grupo ??
    parametros.tiempos_entre_llegadas ??
    parametros.valores_por_grupo;
  if (!valores || typeof valores !== "object") {
    throw new TypeError(
      "El modo intervalos requiere tiempos_llegada o tiempos_entre_llegadas por grupo.",
    );
  }
  const limite = configuracion.horizonte_min ?? Infinity;
  const cantidad = configuracion.cantidad_pacientes ?? Infinity;
  const pacientes = [];

  for (const tipo of TIPOS) {
    const lista = valores[tipo] ?? [];
    if (!Array.isArray(lista) || lista.some((valor) => !Number.isFinite(valor) || valor <= 0)) {
      throw new RangeError(`Los intervalos entre llegadas de ${tipo} deben ser positivos.`);
    }
    let tiempo = 0;
    let generadas = 0;
    while (lista.length > 0 && generadas < cantidad) {
      const intervalo = lista[Math.floor(aleatorio() * lista.length)];
      tiempo += intervalo;
      if (tiempo > limite) {
        break;
      }
      pacientes.push({ tipo, llegada: tiempo, _orden: pacientes.length });
      generadas += 1;
    }
  }

  return pacientes;
}

function tipoAleatorio(parametros, aleatorio) {
  const proporcion = parametros.proporcion_preferencial ?? 0.5;
  if (!Number.isFinite(proporcion) || proporcion < 0 || proporcion > 1) {
    throw new RangeError("La proporción preferencial debe estar entre cero y uno.");
  }
  return aleatorio() < proporcion ? "Preferencial" : "General";
}

export function parsearCsvLlegadas(texto) {
  const filas = texto.trim().split(/\r?\n/).filter((fila) => fila.trim() !== "");
  if (filas.length < 2) {
    throw new RangeError("El CSV debe tener encabezado y al menos una llegada.");
  }
  const separarColumnas = (fila) => {
    const columnas = [];
    let valor = "";
    let entreComillas = false;
    for (let indice = 0; indice < fila.length; indice += 1) {
      const caracter = fila[indice];
      if (caracter === '"' && fila[indice + 1] === '"' && entreComillas) {
        valor += '"';
        indice += 1;
      } else if (caracter === '"') {
        entreComillas = !entreComillas;
      } else if (caracter === "," && !entreComillas) {
        columnas.push(valor.trim());
        valor = "";
      } else {
        valor += caracter;
      }
    }
    if (entreComillas) {
      throw new RangeError("El CSV contiene una comilla sin cerrar.");
    }
    columnas.push(valor.trim());
    return columnas;
  };
  const encabezados = separarColumnas(filas[0]).map((valor, indice) =>
    indice === 0 ? valor.replace(/^\uFEFF/, "") : valor,
  );
  const indiceTipo = encabezados.indexOf("tipo");
  const indiceLlegada = encabezados.indexOf("llegada_min");
  const indiceId = encabezados.indexOf("id");
  if (indiceTipo < 0 || indiceLlegada < 0) {
    throw new RangeError("El CSV requiere las columnas tipo y llegada_min.");
  }

  return filas.slice(1).map((fila, indice) => {
    const columnas = separarColumnas(fila);
    const llegada = Number(columnas[indiceLlegada]);
    if (!Number.isFinite(llegada)) {
      throw new RangeError(`Llegada CSV no válida en la fila ${indice + 2}.`);
    }
    return {
      id: indiceId < 0 ? undefined : columnas[indiceId],
      tipo: columnas[indiceTipo],
      llegada,
    };
  });
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
  for (const tipo of ventanilla.atiende) {
    const filaOrigen = compartida ? filas : filas[tipo];
    const fila = filaOrigen.filter(
      (paciente) =>
        paciente.tipo === tipo &&
        (!esObservada ||
          String(paciente._ventanilla_observada) === String(ventanilla.id)),
    );
    fila.sort((a, b) => ordenarFila(a, b, disciplina));
    const paciente = fila[0];
    if (!paciente) {
      continue;
    }
    if (esObservada && paciente._inicio_observado > tiempo) {
      continue;
    }
    if (esObservada && paciente._inicio_observado < tiempo) {
      throw new RangeError(
        `El inicio observado de ${paciente.id} precede la liberación de su ventanilla.`,
      );
    }
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
          ? crearGeneradorServicio(parametros.dist, parametros, aleatoriosServicio[tipo])
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
      : (paciente._atencion_csv ?? generadoresServicio[paciente.tipo]?.());
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
