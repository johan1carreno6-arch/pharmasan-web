export const UMBRAL_META_ESPERA = 2;
export const UMBRAL_MAXIMO_ESPERA = 5;

const VELOCIDAD_MAXIMA = 28;
const POSICION_EXTERIOR = [-10.8, 0, 6.52];
const POSICION_PUERTA = [-9.05, 0, 5.85];
const POSICION_SALIDA = [-10.8, 0, 6.52];
const POSICIONES_VENTANILLAS = {
  1: [-4.65, 0, -0.75],
  2: [-0.5, 0, -0.75],
  3: [4.35, 0, -0.75],
};

function clonarPosicion(posicion) {
  return [...posicion];
}

function distancia(primera, segunda) {
  return Math.hypot(
    segunda[0] - primera[0],
    segunda[1] - primera[1],
    segunda[2] - primera[2],
  );
}

function duracionMovimiento(desde, hasta) {
  return distancia(desde, hasta) / VELOCIDAD_MAXIMA;
}

function interpolar(inicio, fin, progreso) {
  const fraccion = Math.max(0, Math.min(1, progreso));
  return inicio.map((coordenada, indice) =>
    coordenada + (fin[indice] - coordenada) * fraccion,
  );
}

function posicionFila(tipo, indice) {
  if (!Number.isInteger(indice) || indice < 0) {
    throw new RangeError("La posición de fila debe ser un entero no negativo.");
  }
  const columna = indice % 30;
  const bloque = Math.floor(indice / 30);
  const fila = Math.floor(columna / 5);
  const lugar = columna % 5;
  if (bloque === 0) {
    const x = tipo === "Preferencial" ? 1.12 : -6.33;
    return [x + lugar * 1.31, 0, 0.43 + fila * 0.98];
  }
  if (bloque === 1) {
    const x = tipo === "Preferencial" ? 2.97 : -7.83;
    return [
      x + lugar * 1.22,
      0,
      -0.35 - fila * 0.85,
    ];
  }
  const lado = tipo === "Preferencial" ? 1 : -1;
  const extension = bloque - 1;
  return [
    lado * (2.97 + extension * 0.72 + lugar * 1.22),
    0,
    -0.35 - fila * 0.85,
  ];
}

function crearPosiciones(estado) {
  const posiciones = new Map();
  const tipos = estado.tipos ?? {};

  for (const [nombreFila, ids] of Object.entries(estado.filas ?? {})) {
    ids.forEach((id, indice) => {
      const tipo = tipos[id] ?? nombreFila;
      posiciones.set(id, {
        id,
        tipo,
        estado: "fila",
        posicion: posicionFila(tipo, indice),
        ventanilla: null,
      });
    });
  }

  for (const ventanilla of estado.ventanillas ?? []) {
    if (!ventanilla.ocupada || ventanilla.paciente === null) {
      continue;
    }
    const numero = Number(ventanilla.id);
    posiciones.set(ventanilla.paciente, {
      id: ventanilla.paciente,
      tipo: ventanilla.tipo ?? tipos[ventanilla.paciente] ?? "General",
      estado: "servicio",
      posicion:
        POSICIONES_VENTANILLAS[ventanilla.id] ??
        [(Number.isFinite(numero) ? numero : 1) * 2, 0, -0.75],
      ventanilla: ventanilla.id,
    });
  }
  return posiciones;
}

function validarEventos(eventos) {
  if (!Array.isArray(eventos)) {
    throw new TypeError("La animación requiere el registro de eventos del motor.");
  }
  for (const evento of eventos) {
    if (
      !Number.isFinite(evento.tiempo) ||
      !evento.estado ||
      !Array.isArray(evento.estado.ventanillas) ||
      !evento.estado.filas ||
      typeof evento.paciente_id !== "string"
    ) {
      throw new TypeError("El registro de eventos no tiene el formato esperado.");
    }
  }
}

function posicionEnTrayectoria(trayectoria, tiempo) {
  if (trayectoria.length === 0) {
    return clonarPosicion(POSICION_EXTERIOR);
  }
  for (const tramo of trayectoria) {
    if (tiempo < tramo.inicio) {
      return clonarPosicion(tramo.desde);
    }
    if (tiempo <= tramo.fin) {
      const duracion = tramo.fin - tramo.inicio;
      return duracion === 0
        ? clonarPosicion(tramo.hasta)
        : interpolar(tramo.desde, tramo.hasta, (tiempo - tramo.inicio) / duracion);
    }
  }
  return clonarPosicion(trayectoria.at(-1).hasta);
}

function terminarTrayectoriaEn(trayectoria, tiempo) {
  const actual = posicionEnTrayectoria(trayectoria, tiempo);
  const conservados = [];
  for (const tramo of trayectoria) {
    if (tramo.fin <= tiempo) {
      conservados.push(tramo);
    } else if (tramo.inicio < tiempo) {
      conservados.push({
        desde: tramo.desde,
        hasta: clonarPosicion(actual),
        inicio: tramo.inicio,
        fin: tiempo,
      });
      break;
    } else {
      break;
    }
  }
  trayectoria.splice(0, trayectoria.length, ...conservados);
  return actual;
}

function agregarTramo(trayectoria, desde, hasta, inicio) {
  const duracion = duracionMovimiento(desde, hasta);
  trayectoria.push({
    desde: clonarPosicion(desde),
    hasta: clonarPosicion(hasta),
    inicio,
    fin: inicio + duracion,
  });
  return inicio + duracion;
}

function agregarRutaDeLlegada(trayectoria, destino, tiempo) {
  let siguiente = agregarTramo(
    trayectoria,
    POSICION_EXTERIOR,
    POSICION_PUERTA,
    tiempo,
  );
  siguiente = agregarTramo(trayectoria, POSICION_PUERTA, destino, siguiente);
  return siguiente;
}

function agregarRutaDeSalida(trayectoria, origen, tiempo) {
  let siguiente = agregarTramo(trayectoria, origen, POSICION_PUERTA, tiempo);
  agregarTramo(trayectoria, POSICION_PUERTA, POSICION_SALIDA, siguiente);
}

function posicionesIguales(primera, segunda) {
  return primera.every((valor, indice) => Math.abs(valor - segunda[indice]) < 1e-8);
}

export function crearRecorridoDesdeEventos(eventos) {
  validarEventos(eventos);
  const fotogramas = [];
  const tipos = new Map();
  const llegadas = new Map();
  const inicios = new Map();
  const finales = new Map();
  const salidas = new Map();
  const trayectorias = new Map();
  let posicionesAnteriores = new Map();
  let ventanillasAnteriores = [];

  for (const evento of eventos) {
    if (evento.tipo === "llegada") {
      llegadas.set(evento.paciente_id, evento.tiempo);
      if (evento.paciente_tipo) {
        tipos.set(evento.paciente_id, evento.paciente_tipo);
      }
    }
    if (evento.tipo === "fin_servicio") {
      finales.set(evento.paciente_id, evento.tiempo);
      salidas.set(evento.paciente_id, evento.tiempo);
    }

    const posiciones = crearPosiciones(evento.estado);
    for (const [id, persona] of posiciones) {
      if (persona.tipo === "General" || persona.tipo === "Preferencial") {
        tipos.set(id, persona.tipo);
      }
    }

    for (const ventanilla of evento.estado.ventanillas) {
      if (!ventanilla.ocupada || ventanilla.paciente === null) {
        continue;
      }
      const anterior = ventanillasAnteriores.find(
        (elemento) => String(elemento.id) === String(ventanilla.id),
      );
      if (!anterior?.ocupada || anterior.paciente !== ventanilla.paciente) {
        inicios.set(ventanilla.paciente, evento.tiempo);
      }
    }

    for (const [id, objetivo] of posiciones) {
      const trayectoria = trayectorias.get(id) ?? [];
      const llegada = evento.tipo === "llegada" && id === evento.paciente_id;
      if (llegada && trayectoria.length === 0) {
        trayectorias.set(id, trayectoria);
        const tipoFila = objetivo.tipo;
        const cola = evento.estado.filas[tipoFila] ?? [];
        const indiceCola = cola.indexOf(id);
        const posicionInicial = posicionFila(tipoFila, Math.max(0, indiceCola));
        const finEntrada = agregarRutaDeLlegada(
          trayectoria,
          posicionInicial,
          evento.tiempo,
        );
        if (objetivo.estado === "servicio") {
          agregarTramo(trayectoria, posicionInicial, objetivo.posicion, finEntrada);
        }
        continue;
      }

      trayectorias.set(id, trayectoria);
      const anterior = posicionesAnteriores.get(id);
      if (!anterior || posicionesIguales(anterior.posicion, objetivo.posicion)) {
        continue;
      }

      const posicionActual = terminarTrayectoriaEn(trayectoria, evento.tiempo);
      const inicioMovimiento =
        objetivo.estado === "servicio" && trayectoria.length > 0
          ? Math.max(evento.tiempo, trayectoria.at(-1).fin)
          : evento.tiempo;
      agregarTramo(trayectoria, posicionActual, objetivo.posicion, inicioMovimiento);
    }

    if (evento.tipo === "fin_servicio") {
      const trayectoria = trayectorias.get(evento.paciente_id) ?? [];
      const origen = posicionEnTrayectoria(trayectoria, evento.tiempo);
      terminarTrayectoriaEn(trayectoria, evento.tiempo);
      agregarRutaDeSalida(trayectoria, origen, evento.tiempo);
      trayectorias.set(evento.paciente_id, trayectoria);
      const personaAnterior = posicionesAnteriores.get(evento.paciente_id);
      posiciones.set(evento.paciente_id, {
        id: evento.paciente_id,
        tipo: tipos.get(evento.paciente_id) ?? personaAnterior?.tipo ?? "General",
        estado: "salida",
        posicion: POSICION_SALIDA,
        ventanilla: null,
      });
    }

    for (const [id, salida] of salidas) {
      const trayectoria = trayectorias.get(id);
      if (
        evento.tiempo - salida < (trayectoria?.at(-1)?.fin ?? salida) - salida &&
        !posiciones.has(id)
      ) {
        posiciones.set(id, {
          id,
          tipo: tipos.get(id) ?? "General",
          estado: "salida",
          posicion: POSICION_SALIDA,
          ventanilla: null,
        });
      }
    }

    fotogramas.push({
      tiempo: evento.tiempo,
      posiciones: new Map(posiciones),
      ventanillas: evento.estado.ventanillas.map((ventanilla) => ({
        id: ventanilla.id,
        ocupada: Boolean(ventanilla.ocupada),
        paciente: ventanilla.paciente,
      })),
      filas: Object.fromEntries(
        Object.entries(evento.estado.filas).map(([nombre, idsFila]) => [
          nombre,
          [...idsFila],
        ]),
      ),
    });
    posicionesAnteriores = new Map(posiciones);
    ventanillasAnteriores = evento.estado.ventanillas;
  }

  return {
    fotogramas,
    tipos,
    llegadas,
    inicios,
    finales,
    salidas,
    trayectorias,
    inicio: fotogramas[0]?.tiempo ?? 0,
    fin: fotogramas.at(-1)?.tiempo ?? 0,
  };
}

function buscarFotograma(fotogramas, tiempo) {
  let lo = 0;
  let hi = fotogramas.length - 1;
  let resultado = null;
  while (lo <= hi) {
    const mid = (lo + hi) >>> 1;
    if (fotogramas[mid].tiempo <= tiempo) {
      resultado = fotogramas[mid];
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return resultado;
}

export function obtenerFrameDesdeEventos(recorrido, tiempo) {
  if (!recorrido || !Array.isArray(recorrido.fotogramas)) {
    throw new TypeError("Se requiere un recorrido construido desde eventos.");
  }
  if (!Number.isFinite(tiempo)) {
    throw new RangeError("El instante de animación debe ser finito.");
  }

  const fotograma = buscarFotograma(recorrido.fotogramas, tiempo);
  if (!fotograma) {
    return { tiempo, personas: [], ventanillas: [], filas: {} };
  }
  const personas = [];
  for (const [id, persona] of fotograma.posiciones) {
    const llegada = recorrido.llegadas.get(id);
    const salida = recorrido.salidas.get(id);
    const trayectoria = recorrido.trayectorias.get(id) ?? [];
    if (
      llegada === undefined ||
      tiempo < llegada ||
      (salida !== undefined && tiempo >= (trayectoria.at(-1)?.fin ?? salida))
    ) {
      continue;
    }
    const posicion = posicionEnTrayectoria(trayectoria, tiempo);
    const inicio = recorrido.inicios.get(id);
    const espera =
      inicio === undefined
        ? Math.max(0, tiempo - llegada)
        : Math.min(Math.max(0, inicio - llegada), Math.max(0, tiempo - llegada));
    personas.push({
      id,
      tipo: recorrido.tipos.get(id) ?? persona.tipo ?? "General",
      estado: persona.estado,
      ventanilla: persona.ventanilla,
      posicion,
      colorEspera:
        espera <= UMBRAL_META_ESPERA
          ? "verde"
          : espera <= UMBRAL_MAXIMO_ESPERA
            ? "amarillo"
            : "rojo",
    });
  }

  return {
    tiempo,
    personas,
    ventanillas: fotograma.ventanillas.map((ventanilla) => {
      const inicio = recorrido.inicios.get(ventanilla.paciente);
      const fin = recorrido.finales.get(ventanilla.paciente);
      return {
        ...ventanilla,
        progreso:
          ventanilla.ocupada && inicio !== undefined && fin > inicio
            ? Math.max(0, Math.min(1, (tiempo - inicio) / (fin - inicio)))
            : 0,
      };
    }),
    filas: fotograma.filas,
  };
}

export function crearControlPersonas() {
  let recorrido = crearRecorridoDesdeEventos([]);
  let tiempo = 0;

  function obtenerEstado() {
    return obtenerFrameDesdeEventos(recorrido, tiempo);
  }

  return {
    cargar(eventos) {
      recorrido = crearRecorridoDesdeEventos(eventos);
      tiempo = recorrido.inicio;
      return obtenerEstado();
    },
    actualizar(nuevoTiempo) {
      const estado = obtenerFrameDesdeEventos(recorrido, nuevoTiempo);
      tiempo = nuevoTiempo;
      return estado;
    },
    reiniciar() {
      recorrido = crearRecorridoDesdeEventos([]);
      tiempo = 0;
      return obtenerEstado();
    },
    obtenerEstado,
    obtenerCantidad() {
      return recorrido.llegadas.size;
    },
  };
}
