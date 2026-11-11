import { calcularMetricas } from "../engine/metricas.js";
import { crearClienteReplicasWorker } from "../engine/replicas-worker-client.js";
import { simular } from "../engine/simulador.js";
import { calcularMMc } from "../engine/teoria.js";
import { crearConfiguracionBase } from "./observados.js";

const TIPOS = ["General", "Preferencial"];
const MAXIMO_PACIENTES = 500;
const MAXIMO_VENTANILLAS = 8;
export const VERSION_CONFIGURACION_LABORATORIO = 2;
const formatoLocal = new Intl.NumberFormat("es-CO", {
  maximumFractionDigits: 3,
});
const ADVERTENCIA_CONFIGURACION_ANTIGUA =
  "La configuración contiene campos del formato anterior; se iniciaron los valores por defecto.";

export function serializarConfiguracionLaboratorio(entrada, datos) {
  exigirDatos(datos);
  const validacion = validarEntradaLaboratorio(entrada, datos);
  if (validacion.errores.length) {
    throw new RangeError(validacion.errores[0].mensaje);
  }
  return JSON.stringify(
    { version: VERSION_CONFIGURACION_LABORATORIO, configuracion: entrada },
    null,
    2,
  );
}

function configuracionPorDefectoAntigua(datos) {
  const configuracion = crearPreajusteLaboratorio(
    "Actual (2 generales + 1 preferencial)",
    datos,
    datos.meta.semilla_usada,
  );
  Object.defineProperty(configuracion, "advertencia", {
    value: ADVERTENCIA_CONFIGURACION_ANTIGUA,
  });
  return configuracion;
}

export function cargarConfiguracionLaboratorio(texto, datos) {
  exigirDatos(datos);
  let archivo;
  try {
    archivo = JSON.parse(texto);
  } catch {
    throw new SyntaxError("El archivo de configuración no contiene JSON válido.");
  }
  if (!archivo || typeof archivo !== "object" || Array.isArray(archivo)) {
    throw new TypeError("El archivo JSON debe contener una configuración.");
  }
  if (archivo.version === 1) {
    return configuracionPorDefectoAntigua(datos);
  }
  if (archivo.version !== VERSION_CONFIGURACION_LABORATORIO) {
    throw new RangeError(
      `La versión de configuración no es compatible; se requiere la versión ${VERSION_CONFIGURACION_LABORATORIO}.`,
    );
  }
  const entrada = archivo.configuracion;
  if (!entrada || typeof entrada !== "object" || Array.isArray(entrada)) {
    throw new TypeError("El JSON debe incluir un objeto «configuracion».");
  }
  const camposEliminados = [
    "contenidoDatosPropios",
    "conteos",
    "diaConteos",
    "factorDemanda",
    "intervaloDesviacion",
    "intervaloMedia",
    "proporcionPreferencial",
  ];
  const distribucionesEliminadas = Object.values(entrada.atencion ?? {}).some(
    (parametros) =>
      parametros &&
      (parametros.dist !== undefined ||
        parametros.sd !== undefined ||
        parametros.k !== undefined),
  );
  if (
    Object.prototype.hasOwnProperty.call(entrada, "modoLlegadas") ||
    camposEliminados.some((campo) =>
      Object.prototype.hasOwnProperty.call(entrada, campo),
    ) ||
    distribucionesEliminadas
  ) {
    return configuracionPorDefectoAntigua(datos);
  }
  const validacion = validarEntradaLaboratorio(entrada, datos);
  if (validacion.errores.length) {
    throw new RangeError(`Configuración no válida: ${validacion.errores[0].mensaje}`);
  }
  return entrada;
}

export function crearHashConfiguracionLaboratorio(entrada, datos) {
  const serializada = serializarConfiguracionLaboratorio(entrada, datos);
  return `#laboratorio=${encodeURIComponent(
    JSON.stringify(JSON.parse(serializada)),
  )}`;
}

export function leerHashConfiguracionLaboratorio(hash, datos) {
  if (!hash?.startsWith("#laboratorio=")) return null;
  let contenido;
  try {
    contenido = decodeURIComponent(hash.slice("#laboratorio=".length));
  } catch {
    throw new SyntaxError("El enlace tiene una configuración codificada no válida.");
  }
  return cargarConfiguracionLaboratorio(contenido, datos);
}

function exigirDatos(datos) {
  if (
    !datos ||
    !Array.isArray(datos.pacientes) ||
    !Array.isArray(datos.pico) ||
    !datos.atencion ||
    !Number.isInteger(datos.meta?.semilla_usada)
  ) {
    throw new TypeError(
      "El laboratorio requiere pacientes, pico, medias de atención y semilla observados.",
    );
  }
}

function crearConfiguracionVentanasPreajuste(nombre) {
  const ventanillas = [
    { id: 1, nombre: "Ventanilla 1", atiende: ["General"] },
    { id: 2, nombre: "Ventanilla 2", atiende: ["General"] },
    { id: 3, nombre: "Ventanilla 3", atiende: ["Preferencial"] },
  ];
  switch (nombre) {
    case "Actual (2 generales + 1 preferencial)":
      break;
    case "Con apoyo":
      ventanillas[2].atiende = ["Preferencial", "General"];
      break;
    case "Una sola cola compartida":
      ventanillas.forEach(
        (ventanilla) => (ventanilla.atiende = ["Preferencial", "General"]),
      );
      break;
    case "Cuarta ventanilla":
      ventanillas.push({
        id: 4,
        nombre: "Ventanilla 4",
        atiende: ["General"],
      });
      break;
    default:
      throw new RangeError(`No existe el preajuste «${nombre}».`);
  }
  return ventanillas;
}

export function crearPreajusteLaboratorio(nombre, datos, semilla) {
  exigirDatos(datos);
  if (!Number.isInteger(semilla)) {
    throw new TypeError("La semilla debe ser un número entero.");
  }
  const configuracionBase = crearConfiguracionBase(datos, semilla);
  return {
    nombre,
    ventanillas: crearConfiguracionVentanasPreajuste(nombre),
    cantidadReplicas: 100,
    tasaGeneralHora: configuracionBase.llegadas.tasas_por_minuto.General * 60,
    tasaPreferencialHora:
      configuracionBase.llegadas.tasas_por_minuto.Preferencial * 60,
    modoLimite: "duracion",
    cantidadPacientes: datos.pico.length,
    duracionMin: 60,
    atencion: configuracionBase.atencion,
    disciplina: "FIFO",
    colas: nombre === "Una sola cola compartida" ? "compartida" : "separadas",
    asignacion_libres: "aleatoria",
    meta: 2,
    maximoTolerable: 5,
    proporcionPermitida: 5,
    semilla,
  };
}

function numeroFinito(valor) {
  return Number.isFinite(valor);
}

function agregarError(errores, campo, mensaje) {
  errores.push({ campo, mensaje });
}

function tasaPorGrupo(entrada) {
  return Object.fromEntries(
    TIPOS.map((tipo) => [tipo, entrada[`tasa${tipo}Hora`] / 60]),
  );
}

function mediaAtencion(entrada, tipo) {
  return entrada.atencion?.[tipo]?.media ?? 0;
}

export function validarEntradaLaboratorio(entrada, datos) {
  const errores = [];
  const advertencias = [];
  if (!entrada || typeof entrada !== "object") {
    return {
      errores: [
        {
          campo: "formulario",
          mensaje: "Completa la configuración del laboratorio.",
        },
      ],
      advertencias,
      rhoEstimado: 0,
    };
  }

  if (
    typeof entrada.nombre !== "string" ||
    !PREAJUSTES_LABORATORIO.includes(entrada.nombre)
  ) {
    agregarError(errores, "nombre_preajuste", "Selecciona un preajuste válido.");
  }
  if (
    !Array.isArray(entrada.ventanillas) ||
    entrada.ventanillas.length < 1 ||
    entrada.ventanillas.length > MAXIMO_VENTANILLAS
  ) {
    agregarError(
      errores,
      "ventanillas",
      `Configura entre 1 y ${MAXIMO_VENTANILLAS} ventanillas.`,
    );
  } else {
    entrada.ventanillas.forEach((ventanilla, indice) => {
      if (
        typeof ventanilla.nombre !== "string" ||
        ventanilla.nombre.trim().length === 0 ||
        ventanilla.nombre.length > 40
      ) {
        agregarError(
          errores,
          `ventanillas.${indice}.nombre`,
          "Escribe un nombre de hasta 40 caracteres.",
        );
      }
      if (
        !Array.isArray(ventanilla.atiende) ||
        ventanilla.atiende.length === 0 ||
        new Set(ventanilla.atiende).size !== ventanilla.atiende.length ||
        ventanilla.atiende.some((tipo) => !TIPOS.includes(tipo))
      ) {
        agregarError(
          errores,
          `ventanillas.${indice}.atiende`,
          "Elige al menos un grupo y no repitas opciones.",
        );
      }
    });
    for (const tipo of TIPOS) {
      if (!entrada.ventanillas.some((ventanilla) => ventanilla.atiende.includes(tipo))) {
        agregarError(
          errores,
          "ventanillas",
          `Ninguna ventanilla puede atender al grupo ${tipo}.`,
        );
      }
    }
  }

  for (const [campo, valor] of [
    ["tasaGeneralHora", entrada.tasaGeneralHora],
    ["tasaPreferencialHora", entrada.tasaPreferencialHora],
  ]) {
    if (!numeroFinito(valor) || valor < 0 || valor > 3000) {
      agregarError(
        errores,
        campo,
        "La tasa debe estar entre 0 y 3.000 pacientes por hora.",
      );
    }
  }
  if (
    numeroFinito(entrada.tasaGeneralHora) &&
    numeroFinito(entrada.tasaPreferencialHora) &&
    entrada.tasaGeneralHora + entrada.tasaPreferencialHora === 0
  ) {
    agregarError(
      errores,
      "tasaGeneralHora",
      "Al menos un grupo debe tener tasa positiva.",
    );
  }
  if (!["cantidad", "duracion"].includes(entrada.modoLimite)) {
    agregarError(errores, "modoLimite", "Elige limitar por pacientes o duración.");
  } else if (entrada.modoLimite === "cantidad") {
    if (
      !Number.isInteger(entrada.cantidadPacientes) ||
      entrada.cantidadPacientes < 1 ||
      entrada.cantidadPacientes > MAXIMO_PACIENTES
    ) {
      agregarError(
        errores,
        "cantidadPacientes",
        `La cantidad debe estar entre 1 y ${MAXIMO_PACIENTES} pacientes.`,
      );
    }
  } else if (
    !numeroFinito(entrada.duracionMin) ||
    entrada.duracionMin <= 0 ||
    entrada.duracionMin > 1440
  ) {
    agregarError(
      errores,
      "duracionMin",
      "La duración debe ser mayor que 0 y no superar 1.440 min.",
    );
  }
  if (
    !Number.isInteger(entrada.cantidadReplicas) ||
    entrada.cantidadReplicas < 1 ||
    entrada.cantidadReplicas > 1000
  ) {
    agregarError(
      errores,
      "cantidadReplicas",
      "El número de réplicas debe ser un entero entre 1 y 1.000.",
    );
  }
  for (const tipo of TIPOS) {
    const parametros = entrada.atencion?.[tipo];
    if (!parametros) {
      agregarError(
        errores,
        `atencion.${tipo}.media`,
        `Falta el tiempo medio de atención para ${tipo}.`,
      );
      continue;
    }
    if (!numeroFinito(parametros.media) || parametros.media <= 0 || parametros.media > 1440) {
      agregarError(
        errores,
        `atencion.${tipo}.media`,
        `La media de ${tipo} debe estar entre 0 y 1.440 min.`,
      );
    }
  }

  if (!["FIFO", "prioridad_preferencial"].includes(entrada.disciplina)) {
    agregarError(errores, "disciplina", "Selecciona FIFO o prioridad preferencial.");
  }
  if (!["separadas", "compartida"].includes(entrada.colas)) {
    agregarError(errores, "colas", "Selecciona filas separadas o una fila compartida.");
  }
  if (!["aleatoria", "primera_libre"].includes(entrada.asignacion_libres)) {
    agregarError(errores, "asignacion_libres", "Selecciona una regla de asignación válida.");
  }
  if (
    !Number.isInteger(entrada.semilla) ||
    entrada.semilla < 0 ||
    entrada.semilla > 2147483647
  ) {
    agregarError(
      errores,
      "semilla",
      "La semilla debe ser un entero entre 0 y 2.147.483.647.",
    );
  }
  if (!numeroFinito(entrada.meta) || entrada.meta < 0 || entrada.meta > 1440) {
    agregarError(errores, "meta", "La meta debe estar entre 0 y 1.440 min.");
  }
  if (
    !numeroFinito(entrada.maximoTolerable) ||
    entrada.maximoTolerable < entrada.meta ||
    entrada.maximoTolerable > 1440
  ) {
    agregarError(
      errores,
      "maximoTolerable",
      "El máximo tolerable debe ser al menos la meta y no superar 1.440 min.",
    );
  }
  if (
    !numeroFinito(entrada.proporcionPermitida) ||
    entrada.proporcionPermitida < 0 ||
    entrada.proporcionPermitida > 100
  ) {
    agregarError(
      errores,
      "proporcionPermitida",
      "La proporción permitida debe estar entre 0 % y 100 %.",
    );
  }

  let rhoEstimado = 0;
  if (errores.length === 0 && datos) {
    const tasas = tasaPorGrupo(entrada);
    const cargaTotal = TIPOS.reduce(
      (suma, tipo) => suma + tasas[tipo] * mediaAtencion(entrada, tipo),
      0,
    );
    const cargaPorGrupo = TIPOS.map((tipo) => {
      const compatibles = entrada.ventanillas.filter((ventanilla) =>
        ventanilla.atiende.includes(tipo),
      ).length;
      return (tasas[tipo] * mediaAtencion(entrada, tipo)) / compatibles;
    });
    rhoEstimado = Math.max(
      ...cargaPorGrupo,
      cargaTotal / entrada.ventanillas.length,
    );
    if (rhoEstimado >= 1) {
      advertencias.push(
        `La carga estimada es rho ≈ ${formatoLocal.format(rhoEstimado)} (≥ 1); la cola puede crecer sin estabilizarse. Puedes simular de todas formas.`,
      );
    }
    const estimado =
      entrada.modoLimite === "cantidad"
        ? entrada.cantidadPacientes
        : Object.values(tasas).reduce((suma, valor) => suma + valor, 0) *
          entrada.duracionMin;
    if (numeroFinito(estimado) && estimado > MAXIMO_PACIENTES) {
      advertencias.push(
        `La demanda estimada supera ${MAXIMO_PACIENTES} pacientes; la corrida se limitará a ese máximo.`,
      );
    }
  }
  return { errores, advertencias, rhoEstimado };
}

function exigirEntradaValida(entrada, datos) {
  const validacion = validarEntradaLaboratorio(entrada, datos);
  if (validacion.errores.length) {
    throw new RangeError(validacion.errores[0].mensaje);
  }
  return validacion;
}

function crearLlegadasLaboratorio(entrada) {
  return {
    modo: "poisson",
    tasas_por_minuto: Object.fromEntries(
      TIPOS.map((tipo) => [tipo, entrada[`tasa${tipo}Hora`] / 60]),
    ),
  };
}

export function crearConfiguracionLaboratorio(entrada, datos) {
  exigirDatos(datos);
  const validacion = exigirEntradaValida(entrada, datos);
  const configuracion = {
    ventanillas: entrada.ventanillas.map((ventanilla, indice) => ({
      id: indice + 1,
      nombre: ventanilla.nombre.trim(),
      atiende: [...ventanilla.atiende],
    })),
    llegadas: crearLlegadasLaboratorio(entrada),
    atencion: Object.fromEntries(
      TIPOS.map((tipo) => {
        return [tipo, { media: entrada.atencion[tipo].media }];
      }),
    ),
    disciplina: entrada.disciplina,
    colas: entrada.colas,
    asignacion_libres: entrada.asignacion_libres,
    semilla: entrada.semilla,
  };
  if (entrada.modoLimite === "cantidad") {
    configuracion.cantidad_pacientes = entrada.cantidadPacientes;
  } else {
    configuracion.horizonte_min = entrada.duracionMin;
    configuracion.cantidad_pacientes = MAXIMO_PACIENTES;
  }
  return {
    configuracion,
    criterio: {
      meta: entrada.meta,
      maximo_tolerable: entrada.maximoTolerable,
      proporcion_permitida: entrada.proporcionPermitida / 100,
    },
    rhoEstimado: validacion.rhoEstimado,
    advertencias: validacion.advertencias,
  };
}

function nodo(etiqueta, atributos = {}) {
  const elemento = document.createElement(etiqueta);
  for (const [nombre, valor] of Object.entries(atributos)) {
    if (nombre === "texto") elemento.textContent = valor;
    else if (nombre === "clase") elemento.className = valor;
    else elemento.setAttribute(nombre, valor);
  }
  return elemento;
}

function control(formulario, nombre) {
  return formulario.elements.namedItem(nombre);
}

function entradaCampo(etiqueta, nombre, tipo, valor, ayuda, opciones = {}) {
  const envoltura = nodo("label", { clase: "campo-laboratorio" });
  const titulo = nodo("span", { texto: etiqueta });
  const campo =
    tipo === "select" ? document.createElement("select") : nodo("input", { type: tipo });
  campo.name = nombre;
  if (tipo !== "select") campo.value = String(valor ?? "");
  if (tipo === "number") {
    campo.step = opciones.step ?? "any";
    if (opciones.min !== undefined) campo.min = String(opciones.min);
    if (opciones.max !== undefined) campo.max = String(opciones.max);
  }
  for (const opcion of opciones.opciones ?? []) {
    campo.append(nodo("option", { value: opcion.valor, texto: opcion.texto }));
  }
  if (tipo === "select") campo.value = String(valor);
  envoltura.append(titulo, campo, nodo("small", { texto: ayuda }));
  return { envoltura, campo };
}

function numero(formulario, nombre) {
  return control(formulario, nombre)?.valueAsNumber ?? Number.NaN;
}

function leerEntrada(formulario) {
  const ventanillas = [
    ...formulario.querySelectorAll(".ventanilla-laboratorio"),
  ].map((tarjeta) => {
    const orden = tarjeta.querySelector('select[name$=".atiende"]').value;
    return {
      nombre: tarjeta.querySelector('input[name$=".nombre"]').value,
      atiende:
        orden === "General primero"
          ? ["General", "Preferencial"]
          : orden === "Preferencial primero"
            ? ["Preferencial", "General"]
            : [orden],
    };
  });
  return {
    nombre: control(formulario, "nombre_preajuste").value,
    ventanillas,
    cantidadReplicas: numero(formulario, "cantidadReplicas"),
    tasaGeneralHora: numero(formulario, "tasaGeneralHora"),
    tasaPreferencialHora: numero(formulario, "tasaPreferencialHora"),
    modoLimite: control(formulario, "modoLimite").value,
    cantidadPacientes: numero(formulario, "cantidadPacientes"),
    duracionMin: numero(formulario, "duracionMin"),
    atencion: Object.fromEntries(
      TIPOS.map((tipo) => [
        tipo,
        { media: numero(formulario, `atencion.${tipo}.media`) },
      ]),
    ),
    disciplina: control(formulario, "disciplina").value,
    colas: control(formulario, "colas").value,
    asignacion_libres: control(formulario, "asignacion_libres").value,
    meta: numero(formulario, "meta"),
    maximoTolerable: numero(formulario, "maximoTolerable"),
    proporcionPermitida: numero(formulario, "proporcionPermitida"),
    semilla: numero(formulario, "semilla"),
  };
}

function renderizarVentanillas(formulario, ventanillas) {
  const contenedor = formulario.querySelector("#laboratorio-ventanillas");
  contenedor.replaceChildren();
  for (const [indice, ventanilla] of ventanillas.entries()) {
    const tarjeta = nodo("fieldset", {
      clase: "ventanilla-laboratorio",
      "data-indice": String(indice),
    });
    tarjeta.append(nodo("legend", { texto: `Ventanilla ${indice + 1}` }));
    const nombre = entradaCampo(
      "Nombre",
      `ventanillas.${indice}.nombre`,
      "text",
      ventanilla.nombre,
      "Identifica esta ventanilla en la escena.",
    );
    nombre.campo.maxLength = 40;
    const modo =
      ventanilla.atiende.length === 1
        ? ventanilla.atiende[0]
        : ventanilla.atiende[0] === "Preferencial"
          ? "Preferencial primero"
          : "General primero";
    const atiende = entradaCampo(
      "Atiende",
      `ventanillas.${indice}.atiende`,
      "select",
      modo,
      "El orden en “ambos” define la prioridad de esta ventanilla.",
      {
        opciones: [
          { valor: "General", texto: "General" },
          { valor: "Preferencial", texto: "Adulto mayor" },
          { valor: "General primero", texto: "Ambos · General primero" },
          {
            valor: "Preferencial primero",
            texto: "Ambos · Adulto mayor primero",
          },
        ],
      },
    );
    tarjeta.append(nombre.envoltura, atiende.envoltura);
    const acciones = nodo("div", { clase: "acciones-ventanilla" });
    const duplicar = nodo("button", {
      type: "button",
      "data-accion-ventanilla": "duplicar",
      texto: "Duplicar",
    });
    duplicar.disabled = ventanillas.length >= MAXIMO_VENTANILLAS;
    const quitar = nodo("button", {
      type: "button",
      "data-accion-ventanilla": "quitar",
      texto: "Quitar",
    });
    quitar.disabled = ventanillas.length <= 1;
    acciones.append(duplicar, quitar);
    tarjeta.append(acciones);
    contenedor.append(tarjeta);
  }
}

function renderizarAtencion(formulario, estado) {
  const contenedor = formulario.querySelector("#atencion-laboratorio");
  contenedor.replaceChildren();
  for (const tipo of TIPOS) {
    const tarjeta = nodo("fieldset", {
      clase: "atencion-laboratorio",
      "data-atencion": tipo,
    });
    tarjeta.append(
      nodo("legend", {
        texto: tipo === "Preferencial" ? "Adulto mayor" : "General",
      }),
    );
    tarjeta.append(
      entradaCampo(
        "Tiempo medio de atención (min)",
        `atencion.${tipo}.media`,
        "number",
        estado.atencion[tipo].media,
        "El servicio se modela con distribución exponencial y esta media observada.",
        { min: 0.001, max: 1440 },
      ).envoltura,
    );
    contenedor.append(tarjeta);
  }
}

function aplicarEstado(formulario, estado) {
  for (const [nombre, valor] of Object.entries({
    cantidadReplicas: estado.cantidadReplicas ?? 100,
    tasaGeneralHora: estado.tasaGeneralHora,
    tasaPreferencialHora: estado.tasaPreferencialHora,
    modoLimite: estado.modoLimite,
    cantidadPacientes: estado.cantidadPacientes,
    duracionMin: estado.duracionMin,
    disciplina: estado.disciplina,
    colas: estado.colas,
    asignacion_libres: estado.asignacion_libres,
    meta: estado.meta,
    maximoTolerable: estado.maximoTolerable,
    proporcionPermitida: estado.proporcionPermitida,
    semilla: estado.semilla,
  })) {
    control(formulario, nombre).value = String(valor ?? "");
  }
  control(formulario, "nombre_preajuste").value = estado.nombre;
  formulario.querySelector("#archivo-configuracion").value = "";
  renderizarVentanillas(formulario, estado.ventanillas);
  renderizarAtencion(formulario, estado);
  actualizarVisibilidad(formulario);
}

function actualizarVisibilidad(formulario) {
  const modoLimite = control(formulario, "modoLimite").value;
  formulario.querySelector('[name="cantidadPacientes"]').closest("label").hidden =
    modoLimite !== "cantidad";
  formulario.querySelector('[name="duracionMin"]').closest("label").hidden =
    modoLimite !== "duracion";
}

function limpiarErrores(formulario) {
  formulario.querySelectorAll("[aria-invalid]").forEach((campo) =>
    campo.removeAttribute("aria-invalid"),
  );
  formulario.querySelectorAll(".campo-con-error").forEach((campo) =>
    campo.classList.remove("campo-con-error"),
  );
  formulario.querySelectorAll(".error-campo").forEach((texto) => texto.remove());
}

function mostrarErrores(formulario, errores) {
  limpiarErrores(formulario);
  for (const error of errores) {
    const campo = formulario.querySelector(`[name="${error.campo}"]`);
    const destino =
      campo?.closest("label, fieldset") ??
      (error.campo.startsWith("ventanillas")
        ? formulario.querySelector("#laboratorio-ventanillas")
        : formulario.querySelector("#laboratorio-configuracion"));
    campo?.setAttribute("aria-invalid", "true");
    destino?.classList.add("campo-con-error");
    if (destino) {
      destino.append(nodo("small", { clase: "error-campo", texto: error.mensaje }));
    }
  }
}

export function calcularReferenciasMMc(configuracion) {
  const ventanillas = configuracion.ventanillas;
  const tasas = configuracion.llegadas.tasas_por_minuto;
  if (configuracion.colas === "compartida") {
    const medias = TIPOS.map((tipo) => configuracion.atencion[tipo].media);
    const mediaComun = medias[0];
    if (
      configuracion.disciplina !== "FIFO" ||
      ventanillas.some((ventanilla) =>
        TIPOS.some((tipo) => !ventanilla.atiende.includes(tipo)),
      ) ||
      medias.some((media) => Math.abs(media - mediaComun) > 1e-12)
    ) {
      return null;
    }
    const tasaLlegada = Object.values(tasas).reduce(
      (suma, tasa) => suma + tasa,
      0,
    );
    const tasaServicio = 1 / mediaComun;
    const rho = tasaLlegada / (ventanillas.length * tasaServicio);
    return rho < 1
      ? [
          {
            nombre: "Total",
            rho,
            teorico: calcularMMc(tasaLlegada, tasaServicio, ventanillas.length),
          },
        ]
      : null;
  }

  if (configuracion.colas !== "separadas") return null;
  const resultados = TIPOS.map((tipo) => {
    const servidores = ventanillas.filter(
      (ventanilla) =>
        ventanilla.atiende.length === 1 && ventanilla.atiende[0] === tipo,
    );
    if (servidores.length === 0) return null;
    const tasaServicio = 1 / configuracion.atencion[tipo].media;
    const rho = tasas[tipo] / (servidores.length * tasaServicio);
    if (rho >= 1) return null;
    return {
      nombre: tipo === "Preferencial" ? "Adulto mayor" : tipo,
      tipo,
      rho,
      teorico: calcularMMc(tasas[tipo], tasaServicio, servidores.length),
    };
  });
  return resultados.every(Boolean) ? resultados : null;
}

function mostrarMetricas(
  contenedor,
  metricas,
  rhoEstimado,
  advertencias,
  configuracion,
) {
  contenedor.replaceChildren();
  contenedor.append(nodo("h3", { texto: "Medidas de esta corrida" }));
  const lista = nodo("dl", { clase: "medidas" });
  const medidas = [
    ["Pacientes", String(metricas.n)],
    ["Wq", `${formatoLocal.format(metricas.Wq)} min`],
    ["W", `${formatoLocal.format(metricas.W)} min`],
    ["Lq", formatoLocal.format(metricas.Lq)],
    ["L", formatoLocal.format(metricas.L)],
    ["Utilización global", `${formatoLocal.format(100 * metricas.rho_global)} %`],
    ["Probabilidad de esperar", `${formatoLocal.format(100 * metricas.P_esperar)} %`],
    [
      "Sobre máximo tolerable",
      `${formatoLocal.format(metricas.porcentaje_espera_mayor_tolerable)} %`,
    ],
    ["Cola máxima", String(metricas.cola_maxima)],
    ["Criterio", metricas.criterio.cumple ? "Cumple" : "No cumple"],
  ];
  for (const [nombre, valor] of medidas) {
    const bloque = nodo("div");
    bloque.append(nodo("dt", { texto: nombre }), nodo("dd", { texto: valor }));
    lista.append(bloque);
  }
  contenedor.append(lista);
  const teoria = calcularReferenciasMMc(configuracion);
  if (teoria) {
    const referencia = nodo("section", { clase: "referencia-teorica" });
    referencia.append(
      nodo("h3", { texto: "Referencia teórica M/M/c" }),
      nodo("p", {
        texto: "Solo se muestra cuando las condiciones del modelo M/M/c se cumplen y rho < 1. Diferencia = simulado − teórico.",
      }),
    );
    for (const fila of teoria) {
      const listaTeorica = nodo("dl", { clase: "medidas" });
      const metricasSimuladas = fila.tipo
        ? metricas.por_grupo[fila.tipo]
        : metricas;
      referencia.append(
        nodo("h4", {
          texto: `${fila.nombre} · M/M/${configuracion.colas === "compartida" ? configuracion.ventanillas.length : configuracion.ventanillas.filter((ventanilla) => ventanilla.atiende.length === 1 && ventanilla.atiende[0] === fila.tipo).length}`,
        }),
        nodo("p", {
          texto: `rho = ${formatoLocal.format(fila.rho)}.`,
        }),
      );
      for (const [nombre, simulado, teorico, unidad] of [
        ["Wq", metricasSimuladas.Wq, fila.teorico.Wq, "min"],
        ["Lq", metricasSimuladas.Lq, fila.teorico.Lq, ""],
      ]) {
        for (const [etiqueta, valor] of [
          [`${nombre} simulado`, simulado],
          [`${nombre} teórico`, teorico],
          [`Diferencia de ${nombre}`, simulado - teorico],
        ]) {
          const bloque = nodo("div");
          bloque.append(
            nodo("dt", { texto: etiqueta }),
            nodo("dd", {
              texto: `${formatoLocal.format(valor)}${unidad ? ` ${unidad}` : ""}`,
            }),
          );
          listaTeorica.append(bloque);
        }
      }
      referencia.append(listaTeorica);
    }
    contenedor.append(referencia);
  }
  if (rhoEstimado >= 1) {
    contenedor.append(
      nodo("p", {
        clase: "estado estado-advertencia",
        texto:
          advertencias.find((mensaje) => mensaje.includes("rho")) ??
          `La carga estimada es rho ≈ ${formatoLocal.format(rhoEstimado)}; interpreta el resultado con cautela.`,
      }),
    );
  }
}

function textoResumen(medida, porcentaje = false, yaPorcentaje = false) {
  const formatear = (valor) =>
    formatoLocal.format(porcentaje ? 100 * valor : valor);
  const sufijo = porcentaje || yaPorcentaje ? " %" : "";
  const media = `${formatear(medida.media)}${sufijo}`;
  if (!medida.ic95) return `${media} · IC 95 % no estimable`;
  return (
    `${media} · [${formatear(medida.ic95.inferior)}; ` +
    `${formatear(medida.ic95.superior)}]${sufijo}`
  );
}

function nodoSvg(etiqueta, atributos = {}) {
  const elemento = document.createElementNS("http://www.w3.org/2000/svg", etiqueta);
  for (const [nombre, valor] of Object.entries(atributos)) {
    if (nombre === "texto") elemento.textContent = valor;
    else if (nombre === "clase") elemento.setAttribute("class", valor);
    else elemento.setAttribute(nombre, valor);
  }
  return elemento;
}

function renderizarTablaEscenarios(contenedor, escenarios) {
  const tabla = nodo("table");
  tabla.append(nodo("caption", { texto: "Medias e intervalos de confianza del 95 %" }));
  const cabeza = nodo("thead");
  const filaCabeza = nodo("tr");
  for (const texto of [
    "Escenario",
    "Wq (min)",
    "Lq",
    "rho por ventanilla",
    "Espera > máximo",
    "Criterio",
  ]) {
    filaCabeza.append(nodo("th", { scope: "col", texto }));
  }
  cabeza.append(filaCabeza);
  const cuerpo = nodo("tbody");
  for (const escenario of escenarios) {
    const fila = nodo("tr");
    fila.append(
      nodo("th", { scope: "row", texto: escenario.nombre }),
      nodo("td", { texto: textoResumen(escenario.resumen.Wq) }),
      nodo("td", { texto: textoResumen(escenario.resumen.Lq) }),
    );
    const rho = nodo("td");
    for (const [id, medida] of Object.entries(
      escenario.resumen.rho_por_ventanilla,
    )) {
      rho.append(
        nodo("span", {
          clase: "rho-ventanilla",
          texto: `V${id}: ${textoResumen(medida, true)}`,
        }),
      );
    }
    fila.append(
      rho,
      nodo("td", {
        texto: textoResumen(
          escenario.resumen.porcentaje_espera_mayor_tolerable,
          false,
          true,
        ),
      }),
      nodo("td", {
        clase: escenario.cumple ? "criterio-cumple" : "criterio-incumple",
        texto: escenario.cumple ? "Cumple" : "No cumple",
      }),
    );
    cuerpo.append(fila);
  }
  tabla.append(cabeza, cuerpo);
  contenedor.replaceChildren(tabla);
}

function crearGraficoWq(escenarios) {
  const ancho = 760;
  const alto = Math.max(100, 54 + escenarios.length * 44);
  const svg = nodoSvg("svg", {
    viewBox: `0 0 ${ancho} ${alto}`,
    role: "img",
    "aria-labelledby": "titulo-grafico-wq descripcion-grafico-wq",
  });
  svg.append(
    nodoSvg("title", {
      id: "titulo-grafico-wq",
      texto: "Media de Wq e intervalo de confianza del 95 %",
    }),
    nodoSvg("desc", {
      id: "descripcion-grafico-wq",
      texto: "Una barra por escenario y una línea horizontal para su intervalo.",
    }),
  );
  const maximo = Math.max(
    0.1,
    ...escenarios.map((escenario) =>
      Math.max(
        escenario.resumen.Wq.media,
        escenario.resumen.Wq.ic95?.superior ?? escenario.resumen.Wq.media,
      ),
    ),
  );
  const x = (valor) => 180 + (430 * Math.max(0, valor)) / maximo;
  const linea = (x1, y1, x2, y2, clase) => {
    const elemento = nodoSvg("line", { x1, y1, x2, y2, clase });
    svg.append(elemento);
  };
  linea(180, 34, 180, alto - 16, "eje-grafico");
  for (const [indice, escenario] of escenarios.entries()) {
    const y = 52 + indice * 44;
    const medida = escenario.resumen.Wq;
    const intervalo = medida.ic95 ?? {
      inferior: medida.media,
      superior: medida.media,
    };
    svg.append(
      nodoSvg("text", {
        x: "8",
        y: String(y + 4),
        clase: "etiqueta-grafico",
        texto: escenario.nombre,
      }),
      nodoSvg("rect", {
        x: "180",
        y: String(y - 8),
        width: String(Math.max(0, x(medida.media) - 180)),
        height: "16",
        rx: "4",
        clase: escenario.cumple ? "barra-grafico cumple" : "barra-grafico",
      }),
      nodoSvg("text", {
        x: "625",
        y: String(y + 4),
        clase: "valor-grafico",
        texto: `${formatoLocal.format(medida.media)} min`,
      }),
    );
    linea(x(intervalo.inferior), y, x(intervalo.superior), y, "intervalo-grafico");
    linea(x(intervalo.inferior), y - 5, x(intervalo.inferior), y + 5, "intervalo-grafico");
    linea(x(intervalo.superior), y - 5, x(intervalo.superior), y + 5, "intervalo-grafico");
  }
  return svg;
}

export function iniciarLaboratorio({
  formulario,
  datos,
  alSimular,
  alVolverObservados,
}) {
  exigirDatos(datos);
  if (
    !formulario ||
    typeof alSimular !== "function" ||
    typeof alVolverObservados !== "function"
  ) {
    throw new TypeError("Faltan elementos o acciones para iniciar el laboratorio.");
  }
  const estado = formulario.querySelector("#estado-laboratorio");
  const botonSimular = formulario.querySelector("#simular-laboratorio");
  const botonPreajuste = formulario.querySelector("#aplicar-preajuste");
  const botonNuevaSemilla = formulario.querySelector("#nueva-semilla");
  const botonObservados = formulario.querySelector("#volver-observados");
  const resultados = formulario.querySelector("#resultados-laboratorio");
  const advertencias = formulario.querySelector("#advertencias-laboratorio");
  const panelLaboratorio = formulario.closest(".panel-laboratorio");
  const pestanaAjustar = panelLaboratorio.querySelector("#pestana-ajustar");
  const pestanaComparar = panelLaboratorio.querySelector("#pestana-comparar");
  const panelComparar = panelLaboratorio.querySelector(
    "#panel-laboratorio-comparar",
  );
  const listaEscenarios = panelComparar.querySelector("#lista-escenarios");
  const botonGuardarEscenario = panelComparar.querySelector("#guardar-escenario");
  const botonComparar = panelComparar.querySelector("#correr-comparacion");
  const botonCancelarComparacion = panelComparar.querySelector(
    "#cancelar-comparacion",
  );
  const progresoComparacion = panelComparar.querySelector("#progreso-comparacion");
  const estadoComparacion = panelComparar.querySelector(
    "#estado-comparacion-laboratorio",
  );
  const salidaComparacion = panelComparar.querySelector(
    "#resultados-comparacion-laboratorio",
  );
  let escenariosGuardados = [];
  let clienteWorker;
  let trabajoActivo;
  let inicial = crearPreajusteLaboratorio(
    "Actual (2 generales + 1 preferencial)",
    datos,
    datos.meta.semilla_usada,
  );
  const estadoConfiguracion = formulario.querySelector("#estado-configuracion");
  let avisoHash = "";
  if (window.location.hash) {
    try {
      const cargada = leerHashConfiguracionLaboratorio(window.location.hash, datos);
      if (!cargada) {
        throw new RangeError("El enlace no contiene una configuración del laboratorio.");
      }
      inicial = cargada;
      avisoHash =
        cargada.advertencia ?? "Configuración cargada desde el enlace.";
    } catch (error) {
      avisoHash = `Enlace inválido; se iniciaron los datos observados. ${error.message}`;
    }
  }
  aplicarEstado(formulario, inicial);
  if (avisoHash) {
    estadoConfiguracion.textContent = avisoHash;
    estadoConfiguracion.className = avisoHash.startsWith("Configuración")
      ? "estado estado-correcto"
      : "estado estado-error";
  }

  function obtenerClienteWorker() {
    clienteWorker ??= crearClienteReplicasWorker();
    return clienteWorker;
  }

  function cambiarPestana(comparar) {
    formulario.hidden = comparar;
    panelComparar.hidden = !comparar;
    pestanaAjustar.setAttribute("aria-selected", String(!comparar));
    pestanaComparar.setAttribute("aria-selected", String(comparar));
    pestanaAjustar.tabIndex = comparar ? -1 : 0;
    pestanaComparar.tabIndex = comparar ? 0 : -1;
  }

  pestanaAjustar.addEventListener("click", () => cambiarPestana(false));
  pestanaComparar.addEventListener("click", () => cambiarPestana(true));
  for (const [indice, pestana] of [
    pestanaAjustar,
    pestanaComparar,
  ].entries()) {
    pestana.addEventListener("keydown", (evento) => {
      if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(evento.key)) {
        return;
      }
      evento.preventDefault();
      const destino =
        evento.key === "Home"
          ? 0
          : evento.key === "End"
            ? 1
            : (indice + 1) % 2;
      const pestanaDestino = [pestanaAjustar, pestanaComparar][destino];
      cambiarPestana(destino === 1);
      pestanaDestino.focus();
    });
  }
  cambiarPestana(false);

  function renderizarListaEscenarios() {
    listaEscenarios.replaceChildren();
    for (const [indice, escenario] of escenariosGuardados.entries()) {
      const elemento = nodo("li");
      elemento.append(
        nodo("span", {
          texto: `${escenario.nombre} · ${escenario.configuracion.ventanillas.length} ventanillas`,
        }),
      );
      elemento.append(
        nodo("button", {
          type: "button",
          "data-quitar-escenario": String(indice),
          "aria-label": `Quitar escenario ${escenario.nombre}`,
          texto: "Quitar",
        }),
      );
      listaEscenarios.append(elemento);
    }
    botonGuardarEscenario.disabled = escenariosGuardados.length >= 4;
    botonComparar.disabled = escenariosGuardados.length === 0;
  }

  renderizarListaEscenarios();

  panelComparar.addEventListener("click", async (evento) => {
    const boton = evento.target.closest("button");
    if (!boton) return;
    if (boton.dataset.quitarEscenario !== undefined) {
      escenariosGuardados.splice(Number(boton.dataset.quitarEscenario), 1);
      renderizarListaEscenarios();
      return;
    }
    if (boton.id === "guardar-escenario") {
      const estadoGuardar = estadoComparacion;
      try {
        if (escenariosGuardados.length >= 4) {
          throw new RangeError("Solo se pueden guardar cuatro escenarios.");
        }
        const nombre = panelComparar
          .querySelector("#nombre-escenario")
          .value.trim();
        if (!nombre) throw new RangeError("Escribe un nombre para el escenario.");
        if (
          escenariosGuardados.some(
            (escenario) => escenario.nombre.toLocaleLowerCase() === nombre.toLocaleLowerCase(),
          )
        ) {
          throw new RangeError("Ya existe un escenario con ese nombre.");
        }
        const entrada = leerEntrada(formulario);
        const validacion = validarEntradaLaboratorio(entrada, datos);
        if (validacion.errores.length) {
          mostrarErrores(formulario, validacion.errores);
          throw new RangeError(validacion.errores[0].mensaje);
        }
        crearConfiguracionLaboratorio(entrada, datos);
        escenariosGuardados.push({
          nombre,
          configuracion: JSON.parse(JSON.stringify(entrada)),
        });
        renderizarListaEscenarios();
        panelComparar.querySelector("#nombre-escenario").value = "";
        estadoGuardar.textContent = `Escenario «${nombre}» guardado.`;
        estadoGuardar.className = "estado estado-correcto";
      } catch (error) {
        estadoGuardar.textContent = `No fue posible guardar el escenario: ${error.message}`;
        estadoGuardar.className = "estado estado-error";
      }
      return;
    }
    if (boton.id === "cancelar-comparacion") {
      trabajoActivo?.cancelar();
      return;
    }
    if (boton.id !== "correr-comparacion") return;

    botonComparar.disabled = true;
    botonGuardarEscenario.disabled = true;
    formulario.querySelector("#correr-replicas").disabled = true;
    botonCancelarComparacion.hidden = false;
    progresoComparacion.hidden = false;
    progresoComparacion.value = 0;
    estadoComparacion.textContent = "Preparando escenarios con una semilla común…";
    estadoComparacion.className = "estado";
    try {
      const entradaActiva = leerEntrada(formulario);
      const validacion = validarEntradaLaboratorio(entradaActiva, datos);
      if (validacion.errores.length) {
        mostrarErrores(formulario, validacion.errores);
        throw new RangeError(validacion.errores[0].mensaje);
      }
      const cantidad = entradaActiva.cantidadReplicas;
      const semillaComun = entradaActiva.semilla;
      const escenarios = escenariosGuardados.map((guardado) => {
        const entrada = {
          ...guardado.configuracion,
          semilla: semillaComun,
          cantidadReplicas: cantidad,
        };
        const armado = crearConfiguracionLaboratorio(entrada, datos);
        return {
          nombre: guardado.nombre,
          configuracion: armado.configuracion,
          criterio: armado.criterio,
        };
      });
      const barridoDemanda = panelComparar.querySelector(
        "#activar-barrido-demanda",
      ).checked
        ? escenarios
        : [];
      trabajoActivo = obtenerClienteWorker().ejecutar(
        {
          tipo: "comparar",
          escenarios,
          barridoDemanda,
          cantidad,
          semillaComun,
        },
        {
          alProgreso: (completadas, total, detalle) => {
            progresoComparacion.value = (100 * completadas) / total;
            const fase =
              detalle.tarea === "barrido"
                ? `, demanda ×${formatoLocal.format(detalle.factor)}`
                : "";
            estadoComparacion.textContent =
              `Progreso: ${completadas} de ${total} réplicas · ` +
              `${detalle.nombre}${fase}.`;
          },
        },
      );
      const resultado = await trabajoActivo.resultado;
      renderizarTablaEscenarios(
        panelComparar.querySelector("#tabla-escenarios"),
        resultado.escenarios,
      );
      panelComparar
        .querySelector("#grafico-escenarios")
        .replaceChildren(crearGraficoWq(resultado.escenarios));
      const salidaBarrido = panelComparar.querySelector("#resultados-barrido");
      salidaBarrido.replaceChildren();
      if (resultado.barridos.length) {
        const lista = nodo("ul", { clase: "lista-escenarios" });
        for (const barrido of resultado.barridos) {
          lista.append(
            nodo("li", {
              texto:
                barrido.primerFactorIncumple === null
                  ? `${barrido.nombre}: cumple de ×1,0 a ×2,0.`
                  : `${barrido.nombre}: deja de cumplir desde ×${formatoLocal.format(barrido.primerFactorIncumple)}.`,
            }),
          );
        }
        salidaBarrido.append(
          nodo("h3", { texto: "Barrido de demanda" }),
          lista,
        );
      }
      salidaComparacion.hidden = false;
      estadoComparacion.textContent =
        `${resultado.escenarios.length} escenarios, ${cantidad} réplicas cada uno; ` +
        `semillas comunes desde ${semillaComun}.`;
      estadoComparacion.className = "estado estado-correcto";
    } catch (error) {
      if (error.name === "ReplicasCanceladasError") {
        estadoComparacion.textContent =
          "Comparación cancelada; no se aplicaron resultados parciales.";
        estadoComparacion.className = "estado";
        progresoComparacion.hidden = true;
        progresoComparacion.value = 0;
      } else {
        estadoComparacion.textContent =
          `No fue posible comparar los escenarios: ${error.message}`;
        estadoComparacion.className = "estado estado-error";
      }
    } finally {
      trabajoActivo = undefined;
      botonComparar.disabled = escenariosGuardados.length === 0;
      botonGuardarEscenario.disabled = escenariosGuardados.length >= 4;
      formulario.querySelector("#correr-replicas").disabled = false;
      botonCancelarComparacion.hidden = true;
    }
  });

  function refrescarValidacion() {
    const validacion = validarEntradaLaboratorio(
      leerEntrada(formulario),
      datos,
    );
    mostrarErrores(formulario, validacion.errores);
    advertencias.replaceChildren(
      ...validacion.advertencias.map((mensaje) =>
        nodo("p", { clase: "estado estado-advertencia", texto: mensaje }),
      ),
    );
    botonSimular.disabled = validacion.errores.length > 0;
  }

  formulario.addEventListener("click", async (evento) => {
    const boton = evento.target.closest("button");
    if (!boton) return;
    const accion = boton.dataset.accionVentanilla;
    if (accion) {
      const entrada = leerEntrada(formulario);
      const indice = Number(boton.closest("fieldset").dataset.indice);
      if (accion === "duplicar" && entrada.ventanillas.length < MAXIMO_VENTANILLAS) {
        const original = entrada.ventanillas[indice];
        entrada.ventanillas.splice(indice + 1, 0, {
          nombre: `${original.nombre} copia`.slice(0, 40),
          atiende: [...original.atiende],
        });
      } else if (accion === "quitar" && entrada.ventanillas.length > 1) {
        entrada.ventanillas.splice(indice, 1);
      }
      renderizarVentanillas(formulario, entrada.ventanillas);
      refrescarValidacion();
      return;
    }
    if (boton.id === "agregar-ventanilla") {
      const entrada = leerEntrada(formulario);
      if (entrada.ventanillas.length < MAXIMO_VENTANILLAS) {
        entrada.ventanillas.push({
          nombre: `Ventanilla ${entrada.ventanillas.length + 1}`,
          atiende: ["General"],
        });
        renderizarVentanillas(formulario, entrada.ventanillas);
        refrescarValidacion();
      }
      return;
    }
    if (boton.id === "aplicar-preajuste") {
      const entrada = leerEntrada(formulario);
      const nuevo = crearPreajusteLaboratorio(
        control(formulario, "nombre_preajuste").value,
        datos,
        entrada.semilla,
      );
      aplicarEstado(formulario, nuevo);
      refrescarValidacion();
      return;
    }
    if (boton.id === "nueva-semilla") {
      const semilla = numero(formulario, "semilla");
      control(formulario, "semilla").value = String(
        Number.isInteger(semilla) && semilla < 2147483647 ? semilla + 1 : 1,
      );
      refrescarValidacion();
      return;
    }
    if (boton.id === "descargar-configuracion") {
      try {
        const entrada = leerEntrada(formulario);
        const contenido = serializarConfiguracionLaboratorio(entrada, datos);
        const archivo = new Blob([contenido], {
          type: "application/json;charset=utf-8",
        });
        const url = URL.createObjectURL(archivo);
        const enlace = nodo("a", {
          href: url,
          download: "configuracion-laboratorio.json",
        });
        document.body.append(enlace);
        enlace.click();
        enlace.remove();
        setTimeout(() => URL.revokeObjectURL(url), 0);
        estadoConfiguracion.textContent = "Configuración JSON preparada para descargar.";
        estadoConfiguracion.className = "estado estado-correcto";
      } catch (error) {
        estadoConfiguracion.textContent = `No fue posible guardar la configuración: ${error.message}`;
        estadoConfiguracion.className = "estado estado-error";
      }
      return;
    }
    if (boton.id === "copiar-enlace-configuracion") {
      try {
        const entrada = leerEntrada(formulario);
        const hash = crearHashConfiguracionLaboratorio(entrada, datos);
        const url = `${window.location.origin}${window.location.pathname}${window.location.search}${hash}`;
        if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(url);
        } else {
          const auxiliar = nodo("textarea", { texto: url });
          auxiliar.style.position = "fixed";
          auxiliar.style.opacity = "0";
          document.body.append(auxiliar);
          auxiliar.select();
          const copiado = document.execCommand("copy");
          auxiliar.remove();
          if (!copiado) throw new Error("el navegador no permitió copiar el enlace");
        }
        const enlaceLargo = url.length > 2000;
        estadoConfiguracion.textContent = enlaceLargo
          ? `Enlace copiado: ${url.length} caracteres. Supera los 2.000; usa «Descargar configuración (JSON)» como alternativa.`
          : `Enlace con esta configuración copiado (${url.length} caracteres).`;
        estadoConfiguracion.className = enlaceLargo
          ? "estado estado-advertencia"
          : "estado estado-correcto";
      } catch (error) {
        estadoConfiguracion.textContent = `No fue posible copiar el enlace: ${error.message}`;
        estadoConfiguracion.className = "estado estado-error";
      }
      return;
    }
    if (boton.id === "correr-replicas") {
      const botonReplicas = boton;
      const estadoReplicas = formulario.querySelector("#estado-replicas");
      const barraProgreso = formulario.querySelector("#progreso-replicas");
      const salidaReplicas = formulario.querySelector("#resultados-replicas");
      const botonCancelar = formulario.querySelector("#cancelar-replicas");
      botonReplicas.disabled = true;
      formulario.querySelector("#simular-laboratorio").disabled = true;
      panelComparar.querySelector("#correr-comparacion").disabled = true;
      botonCancelar.hidden = false;
      barraProgreso.hidden = false;
      barraProgreso.value = 0;
      estadoReplicas.textContent = "Ejecutando réplicas…";
      estadoReplicas.className = "estado";
      try {
        const entrada = leerEntrada(formulario);
        const armado = crearConfiguracionLaboratorio(entrada, datos);
        const opciones = {
          meta: armado.criterio.meta,
          maximo_tolerable: armado.criterio.maximo_tolerable,
          proporcion_permitida: armado.criterio.proporcion_permitida,
        };
        trabajoActivo = obtenerClienteWorker().ejecutar(
          {
            tipo: "replicas",
            configuracion: armado.configuracion,
            cantidad: entrada.cantidadReplicas,
            opciones,
          },
          {
            alProgreso: (completadas, total) => {
              barraProgreso.value = (100 * completadas) / total;
              estadoReplicas.textContent = `Réplicas: ${completadas} de ${total}.`;
            },
          },
        );
        const resultadoWorker = await trabajoActivo.resultado;
        const resumen = resultadoWorker.resultado;
        salidaReplicas.replaceChildren();
        const lista = nodo("dl", { clase: "medidas" });
        for (const [clave, etiqueta] of [
          ["Wq", "Wq (min)"],
          ["Lq", "Lq"],
          ["rho_global", "rho global"],
          ["porcentaje_espera_mayor_tolerable", "Espera > máximo (%)"],
        ]) {
          const medida = resumen.resumen[clave];
          const valor = nodo("dd", {
            texto: textoResumen(
              medida,
              false,
              clave === "porcentaje_espera_mayor_tolerable",
            ),
          });
          lista.append(nodo("dt", { texto: etiqueta }), valor);
        }
        for (const [id, medida] of Object.entries(
          resumen.resumen.rho_por_ventanilla,
        )) {
          lista.append(
            nodo("dt", { texto: `rho ventanilla ${id}` }),
            nodo("dd", { texto: textoResumen(medida, true) }),
          );
        }
        salidaReplicas.append(
          nodo("h3", { texto: "Resumen de réplicas" }),
          lista,
        );
        salidaReplicas.hidden = false;
        estadoReplicas.textContent = `Cálculo completado: ${resumen.cantidad} réplica${resumen.cantidad === 1 ? "" : "s"}.`;
        estadoReplicas.className = "estado estado-correcto";
      } catch (error) {
        if (error.name === "ReplicasCanceladasError") {
          estadoReplicas.textContent =
            "Corrida cancelada; no se aplicaron resultados parciales.";
          estadoReplicas.className = "estado";
          barraProgreso.value = 0;
          barraProgreso.hidden = true;
        } else {
          estadoReplicas.textContent =
            `No fue posible correr las réplicas: ${error.message}`;
          estadoReplicas.className = "estado estado-error";
        }
      } finally {
        trabajoActivo = undefined;
        botonReplicas.disabled = false;
        formulario.querySelector("#simular-laboratorio").disabled = false;
        panelComparar.querySelector("#correr-comparacion").disabled =
          escenariosGuardados.length === 0;
        botonCancelar.hidden = true;
      }
      return;
    }
    if (boton.id === "cancelar-replicas") {
      trabajoActivo?.cancelar();
      return;
    }
    if (boton.id === "volver-observados") {
      resultados.hidden = true;
      estado.textContent = "Reproduciendo de nuevo los datos observados.";
      estado.className = "estado";
      alVolverObservados();
      return;
    }
    if (boton.id !== "simular-laboratorio") return;

    botonSimular.disabled = true;
    estado.textContent = "Validando y ejecutando la simulación…";
    estado.className = "estado";
    await new Promise((resolver) => setTimeout(resolver, 0));
    try {
      const entrada = leerEntrada(formulario);
      const armado = crearConfiguracionLaboratorio(entrada, datos);
      const corrida = simular(armado.configuracion);
      const metricas = calcularMetricas(corrida, armado.criterio);
      mostrarMetricas(
        resultados,
        metricas,
        armado.rhoEstimado,
        armado.advertencias,
        armado.configuracion,
      );
      resultados.hidden = false;
      estado.textContent =
        `Corrida completada: ${metricas.n} pacientes; Wq ${formatoLocal.format(metricas.Wq)} min.`;
      estado.className = "estado estado-correcto";
      await alSimular({
        corrida,
        metricas,
        configuracion: armado.configuracion,
        criterio: armado.criterio,
        rhoEstimado: armado.rhoEstimado,
        advertencias: armado.advertencias,
      });
    } catch (error) {
      const validacion = validarEntradaLaboratorio(
        leerEntrada(formulario),
        datos,
      );
      if (validacion.errores.length) {
        mostrarErrores(formulario, validacion.errores);
        estado.textContent = validacion.errores[0].mensaje;
      } else {
        estado.textContent = `No fue posible simular: ${error.message}`;
      }
      estado.className = "estado estado-error";
    } finally {
      botonSimular.disabled = false;
    }
  });

  formulario.addEventListener("input", () => {
    refrescarValidacion();
  });
  formulario.addEventListener("change", (evento) => {
    if (evento.target.id === "archivo-configuracion" && evento.target.files?.[0]) {
      evento.target.files[0]
        .text()
        .then((texto) => {
          const configuracion = cargarConfiguracionLaboratorio(texto, datos);
          aplicarEstado(formulario, configuracion);
          estadoConfiguracion.textContent =
            configuracion.advertencia ?? "Configuración cargada correctamente.";
          estadoConfiguracion.className = configuracion.advertencia
            ? "estado estado-advertencia"
            : "estado estado-correcto";
          refrescarValidacion();
        })
        .catch((error) => {
          estadoConfiguracion.textContent = `No fue posible cargar la configuración: ${error.message}`;
          estadoConfiguracion.className = "estado estado-error";
        })
        .finally(() => {
          evento.target.value = "";
        });
      return;
    }
    actualizarVisibilidad(formulario);
    refrescarValidacion();
  });
  botonPreajuste.type = "button";
  botonNuevaSemilla.type = "button";
  botonObservados.type = "button";
  refrescarValidacion();
}

export const MAX_PACIENTES_LABORATORIO = MAXIMO_PACIENTES;
export const PREAJUSTES_LABORATORIO = [
  "Actual (2 generales + 1 preferencial)",
  "Con apoyo",
  "Una sola cola compartida",
  "Cuarta ventanilla",
];
