import {
  correrReplicasAsincronas,
  ReplicasCanceladasError,
} from "./replicas.js";

function validarCantidad(cantidad) {
  if (!Number.isInteger(cantidad) || cantidad < 1 || cantidad > 1000) {
    throw new RangeError("El número de réplicas debe estar entre 1 y 1.000.");
  }
}

function evaluarCriterio(resumen, criterio) {
  const porcentajePermitido = 100 * criterio.proporcion_permitida;
  return (
    resumen.Wq.media <= criterio.meta &&
    resumen.porcentaje_espera_mayor_tolerable.media <= porcentajePermitido
  );
}

function resumirEscenario(escenario, resultado) {
  return {
    nombre: escenario.nombre,
    resumen: resultado.resumen,
    cantidad: resultado.cantidad,
    semillas: resultado.semillas,
    cumple: evaluarCriterio(resultado.resumen, escenario.criterio),
  };
}

export function escalarConfiguracionDemanda(configuracion, factor) {
  if (!Number.isFinite(factor) || factor < 1 || factor > 2) {
    throw new RangeError("El factor del barrido debe estar entre 1 y 2.");
  }
  const copia = {
    ...configuracion,
    llegadas: { ...configuracion.llegadas },
  };
  const llegadas = copia.llegadas;
  if (llegadas.modo === "poisson") {
    const propiedad = llegadas.tasas_por_minuto ? "tasas_por_minuto" : "tasas";
    if (llegadas[propiedad]) {
      llegadas[propiedad] = Object.fromEntries(
        Object.entries(llegadas[propiedad]).map(([tipo, tasa]) => [
          tipo,
          tasa * factor,
        ]),
      );
    } else if (Number.isFinite(llegadas.tasa_por_minuto)) {
      llegadas.tasa_por_minuto *= factor;
    } else if (Number.isFinite(llegadas.lambda)) {
      llegadas.lambda *= factor;
    } else {
      throw new TypeError("El escenario Poisson no contiene tasas escalables.");
    }
  } else if (
    llegadas.modo === "intervalos" &&
    llegadas.tiempos_entre_llegadas
  ) {
    llegadas.tiempos_entre_llegadas = Object.fromEntries(
      Object.entries(llegadas.tiempos_entre_llegadas).map(([tipo, intervalos]) => [
        tipo,
        intervalos.map((intervalo) => intervalo / factor),
      ]),
    );
  } else if (
    llegadas.modo === "intervalos" &&
    Array.isArray(llegadas.tiempos_llegada)
  ) {
    llegadas.tiempos_llegada = llegadas.tiempos_llegada.map((paciente) =>
      typeof paciente === "number"
        ? paciente / factor
        : {
            ...paciente,
            ...(paciente.llegada === undefined
              ? { llegada_min: paciente.llegada_min / factor }
              : { llegada: paciente.llegada / factor }),
          },
    );
  } else if (
    (llegadas.modo === "conteos" || llegadas.modo === "conteos_uniformes") &&
    Array.isArray(llegadas.intervalos ?? llegadas.conteos)
  ) {
    const propiedad = llegadas.intervalos ? "intervalos" : "conteos";
    const intervalos = llegadas[propiedad];
    const escalados = intervalos.map((intervalo) => {
      const exacto = (intervalo.llegadas ?? intervalo.cantidad ?? intervalo.conteo) * factor;
      return { ...intervalo, cantidadEscalada: exacto };
    });
    const total = Math.round(
      escalados.reduce((suma, intervalo) => suma + intervalo.cantidadEscalada, 0),
    );
    let restante = total;
    const partes = escalados.map((intervalo, indice) => {
      const cantidad = Math.floor(intervalo.cantidadEscalada);
      restante -= cantidad;
      return { ...intervalo, indice, cantidad };
    });
    [...partes]
      .sort((primero, segundo) =>
        (segundo.cantidadEscalada - Math.floor(segundo.cantidadEscalada)) -
        (primero.cantidadEscalada - Math.floor(primero.cantidadEscalada)),
      )
      .slice(0, restante)
      .forEach((intervalo) => (intervalo.cantidad += 1));
    llegadas[propiedad] = partes.sort((primero, segundo) =>
      primero.indice - segundo.indice,
    ).map((intervalo) => {
      const { cantidadEscalada, ...resto } = intervalo;
      if ("llegadas" in resto) resto.llegadas = intervalo.cantidad;
      else if ("cantidad" in resto) resto.cantidad = intervalo.cantidad;
      else resto.conteo = intervalo.cantidad;
      delete resto.indice;
      return resto;
    });
  } else if (llegadas.modo === "csv" && Array.isArray(llegadas.pacientes)) {
    llegadas.pacientes = llegadas.pacientes.map((paciente) => ({
      ...paciente,
      llegada: paciente.llegada / factor,
    }));
  } else {
    throw new RangeError(`El modo de llegadas «${llegadas.modo}» no admite barrido.`);
  }
  return copia;
}

export async function ejecutarTrabajoReplicas(
  trabajo,
  { alProgreso = () => {}, estaCancelado = () => false } = {},
) {
  if (!trabajo || typeof trabajo !== "object") {
    throw new TypeError("El trabajo de réplicas no tiene un formato válido.");
  }
  validarCantidad(trabajo.cantidad);
  if (trabajo.tipo === "replicas") {
    const resultado = await correrReplicasAsincronas(
      trabajo.configuracion,
      trabajo.cantidad,
      { ...trabajo.opciones, alProgreso, estaCancelado },
    );
    return { tipo: "replicas", resultado };
  }
  if (trabajo.tipo !== "comparar") {
    throw new RangeError("El tipo de trabajo del worker no es compatible.");
  }
  if (
    !Array.isArray(trabajo.escenarios) ||
    trabajo.escenarios.length < 1 ||
    trabajo.escenarios.length > 4
  ) {
    throw new RangeError("Se requiere guardar entre uno y cuatro escenarios.");
  }
  const semillaComun = trabajo.semillaComun;
  if (!Number.isInteger(semillaComun)) {
    throw new TypeError("La comparación requiere una semilla común entera.");
  }
  const barridoEscenarios = trabajo.barridoDemanda ?? [];
  const tareas = [
    ...trabajo.escenarios.map((escenario) => ({
      tipo: "escenario",
      escenario,
      configuracion: escenario.configuracion,
    })),
    ...barridoEscenarios.flatMap((escenario) =>
      Array.from({ length: 10 }, (_, indice) => {
        const factor = (indice + 11) / 10;
        return {
          tipo: "barrido",
          escenario,
          factor,
          configuracion: escalarConfiguracionDemanda(
            escenario.configuracion,
            factor,
          ),
        };
      }),
    ),
  ];
  if (
    tareas.some(
      (tarea) =>
        !tarea.escenario?.criterio ||
        !Number.isInteger(tarea.configuracion?.semilla),
    )
  ) {
    throw new TypeError("Cada escenario debe incluir configuración y criterio válidos.");
  }

  const total = tareas.length * trabajo.cantidad;
  let completadas = 0;
  const escenarios = [];
  const resultadosBarrido = new Map();
  for (const escenario of barridoEscenarios) {
    resultadosBarrido.set(escenario.nombre, [
      {
        factor: 1,
        cumple: undefined,
        resumen: undefined,
      },
    ]);
  }
  for (const tarea of tareas) {
    const configuracion = { ...tarea.configuracion, semilla: semillaComun };
    const resultado = await correrReplicasAsincronas(
      configuracion,
      trabajo.cantidad,
      {
        ...tarea.escenario.criterio,
        estaCancelado,
        alProgreso: (hechas) => {
          alProgreso(completadas + hechas, total, {
            tarea: tarea.tipo,
            nombre: tarea.escenario.nombre,
            factor: tarea.factor,
          });
        },
      },
    );
    completadas += trabajo.cantidad;
    const resumen = resumirEscenario(tarea.escenario, resultado);
    if (tarea.tipo === "escenario") {
      escenarios.push(resumen);
    } else {
      resultadosBarrido.get(tarea.escenario.nombre).push({
        factor: tarea.factor,
        cumple: resumen.cumple,
        resumen: resumen.resumen,
      });
    }
  }

  for (const escenario of trabajo.escenarios) {
    if (!resultadosBarrido.has(escenario.nombre)) continue;
    resultadosBarrido.get(escenario.nombre)[0] = {
      factor: 1,
      cumple: escenarios.find((resultado) => resultado.nombre === escenario.nombre)
        ?.cumple,
      resumen: escenarios.find((resultado) => resultado.nombre === escenario.nombre)
        ?.resumen,
    };
  }
  return {
    tipo: "comparacion",
    semillaComun,
    cantidad: trabajo.cantidad,
    escenarios,
    barridos: [...resultadosBarrido].map(([nombre, puntos]) => ({
      nombre,
      puntos,
      primerFactorIncumple: puntos.find((punto) => !punto.cumple)?.factor ?? null,
    })),
  };
}

if (typeof self !== "undefined" && typeof self.addEventListener === "function") {
  const trabajosCancelados = new Set();
  self.addEventListener("message", async ({ data }) => {
    if (data?.tipo === "cancelar") {
      trabajosCancelados.add(data.id);
      return;
    }
    if (data?.tipo !== "ejecutar" || !Number.isInteger(data.id)) return;
    const estaCancelado = () => trabajosCancelados.has(data.id);
    try {
      const resultado = await ejecutarTrabajoReplicas(data.trabajo, {
        estaCancelado,
        alProgreso: (completadas, total, detalle) =>
          self.postMessage({
            id: data.id,
            tipo: "progreso",
            completadas,
            total,
            detalle,
          }),
      });
      if (estaCancelado()) {
        self.postMessage({ id: data.id, tipo: "cancelado" });
      } else {
        self.postMessage({ id: data.id, tipo: "resultado", resultado });
      }
    } catch (error) {
      if (error instanceof ReplicasCanceladasError || estaCancelado()) {
        self.postMessage({ id: data.id, tipo: "cancelado" });
      } else {
        self.postMessage({
          id: data.id,
          tipo: "error",
          nombre: error.name,
          mensaje: error.message,
        });
      }
    } finally {
      trabajosCancelados.delete(data.id);
    }
  });
}
