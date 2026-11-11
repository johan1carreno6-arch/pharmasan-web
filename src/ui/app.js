import { simular } from "../engine/simulador.js";
import { correrReplicas } from "../engine/replicas.js";
import { crearLocal3D } from "../escena/local3d.js";
import { crearConfiguracionBase } from "./observados.js";
import { iniciarLaboratorio } from "./laboratorio.js";
import {
  crearCsvPacientes,
  nombreCsvReproduccion,
} from "./exportar-csv.js";
import {
  compararReproduccionObservada,
  crearConfiguracionesReproduccion,
  cifrasVerificadas,
  formatoHoraObservada,
} from "./reproduccion-observados.js";

const botonBase = document.querySelector("#simular-observados");
const botonReplay = document.querySelector("#reproducir-observado");
const estado = document.querySelector("#estado");
const estadoReplay = document.querySelector("#estado-replay");
const resultados = document.querySelector("#resultados");
const resultadosReplay = document.querySelector("#resultados-replay");
const resumenFinalReplay = document.querySelector("#resumen-final-replay");
const resumenFinalPacientes = document.querySelector("#resumen-final-pacientes");
const resumenFinalEsperaron = document.querySelector("#resumen-final-esperaron");
const resumenFinalWq = document.querySelector("#resumen-final-wq");
const botonCsv = document.querySelector("#descargar-csv");
const estadoCsv = document.querySelector("#estado-csv");
const valorWq = document.querySelector("#wq-simulado");
const intervaloWqSimulado = document.querySelector("#ic-wq-simulado");
const selectorDia = document.querySelector("#dia-observado");
const selectorTramo = document.querySelector("#tramo-observado");
const tablaComparacion = document.querySelector("#tabla-comparacion");
const tablaPacientes = document.querySelector("#tabla-pacientes");
const listaCifras = document.querySelector("#lista-cifras");
const resumenSeleccion = document.querySelector("#resumen-seleccion");
const estadoComparacion = document.querySelector("#estado-comparacion");
const lineaTiempo = document.querySelector("#linea-tiempo");
const contenedorEscena = document.querySelector("#escena-local");
const estadoEscena = document.querySelector("#estado-escena");
const dialogoAyuda = document.querySelector("#dialogo-ayuda");
const avisoAplicacion = document.querySelector("#aviso-aplicacion");
const hud = {
  reloj: document.querySelector("#hud-reloj"),
  llegados: document.querySelector("#hud-llegados"),
  atendidos: document.querySelector("#hud-atendidos"),
  esperaron: document.querySelector("#hud-esperaron"),
  filas: document.querySelector("#hud-filas"),
  wq: document.querySelector("#hud-wq"),
  preferenciales: document.querySelector("#hud-preferenciales"),
  enServicio: document.querySelector("#hud-en-servicio"),
  colaMaxima: document.querySelector("#hud-cola-maxima"),
  posicion: document.querySelector("#posicion-reproduccion"),
  alternar: document.querySelector("#alternar-reproduccion"),
  anterior: document.querySelector("#saltar-anterior"),
  siguiente: document.querySelector("#saltar-siguiente"),
  reiniciar: document.querySelector("#reiniciar-reproduccion"),
  velocidad: document.querySelector("#velocidad-reproduccion"),
  valorVelocidad: document.querySelector("#valor-velocidad"),
  estado: document.querySelector("#estado-reproduccion"),
};
const numeroReplicas = 500;
const formatoMinutos = new Intl.NumberFormat("es-CO", {
  minimumFractionDigits: 3,
  maximumFractionDigits: 3,
});
let comparacionParaCsv;
let seleccionParaCsv;
let datosParaCsv;

const pasosRecorrido = [
  {
    titulo: "Modo A: datos observados",
    texto:
      "Selecciona un día y un tramo para reproducir los registros reales. " +
      "La tabla compara los resultados con las cifras verificadas.",
  },
  {
    titulo: "Modo B: laboratorio",
    texto:
      "Ajusta ventanillas, llegadas y atención. Simula el escenario y ejecuta " +
      "réplicas para ver promedios e intervalos de confianza.",
  },
  {
    titulo: "Reproducción y atajos",
    texto:
      "Usa los controles de reproducción o el teclado: espacio reproduce o " +
      "pausa, las flechas saltan entre instantes y 1/2/3 cambia la vista.",
  },
  {
    titulo: "Resultados y configuraciones",
    texto:
      "Consulta tablas, descarga los datos CSV, guarda configuraciones y " +
      "compara hasta cuatro escenarios.",
  },
];
let pasoRecorrido = 0;
let contenidoDialogo = "recorrido";

function marcarRecorridoVisto() {
  try {
    window.localStorage.setItem("pharmasan-recorrido-visto", "si");
  } catch {
    return;
  }
}

function actualizarPasoRecorrido() {
  const paso = pasosRecorrido[pasoRecorrido];
  document.querySelector("#numero-paso-recorrido").textContent =
    `Paso ${pasoRecorrido + 1} de ${pasosRecorrido.length}`;
  document.querySelector("#titulo-paso-recorrido").textContent = paso.titulo;
  document.querySelector("#texto-paso-recorrido").textContent = paso.texto;
  document.querySelector("#paso-anterior-recorrido").disabled = pasoRecorrido === 0;
  document.querySelector("#siguiente-recorrido").textContent =
    pasoRecorrido === pasosRecorrido.length - 1 ? "Terminar" : "Siguiente";
}

function mostrarDialogo(contenido) {
  contenidoDialogo = contenido;
  document.querySelector("#contenido-recorrido").hidden =
    contenido !== "recorrido";
  document.querySelector("#contenido-acerca").hidden = contenido !== "acerca";
  document.querySelector("#titulo-dialogo-ayuda").textContent =
    contenido === "recorrido" ? "Recorrido de la aplicación" : "Acerca de";
  if (contenido === "recorrido") actualizarPasoRecorrido();
  if (!dialogoAyuda.open) dialogoAyuda.showModal();
}

function finalizarRecorrido() {
  marcarRecorridoVisto();
  if (dialogoAyuda.open) dialogoAyuda.close();
}

document.querySelector("#abrir-recorrido").addEventListener("click", () => {
  pasoRecorrido = 0;
  mostrarDialogo("recorrido");
});
document.querySelector("#abrir-acerca").addEventListener("click", () => {
  mostrarDialogo("acerca");
});
document.querySelector("#cerrar-dialogo-ayuda").addEventListener("click", () => {
  if (contenidoDialogo === "recorrido") marcarRecorridoVisto();
  dialogoAyuda.close();
});
document.querySelector("#paso-anterior-recorrido").addEventListener("click", () => {
  pasoRecorrido = Math.max(0, pasoRecorrido - 1);
  actualizarPasoRecorrido();
});
document.querySelector("#siguiente-recorrido").addEventListener("click", () => {
  if (pasoRecorrido === pasosRecorrido.length - 1) {
    finalizarRecorrido();
  } else {
    pasoRecorrido += 1;
    actualizarPasoRecorrido();
  }
});
document.querySelector("#saltar-recorrido").addEventListener("click", finalizarRecorrido);
dialogoAyuda.addEventListener("close", () => {
  if (contenidoDialogo === "recorrido") marcarRecorridoVisto();
});
document.querySelector("#alternar-panel-lateral").addEventListener("click", (evento) => {
  const plegado = document.body.classList.toggle("panel-lateral-plegado");
  evento.currentTarget.setAttribute("aria-expanded", String(!plegado));
  evento.currentTarget.textContent = plegado
    ? "Mostrar panel lateral"
    : "Ocultar panel lateral";
});
document
  .querySelector("#alternar-presentacion")
  .addEventListener("click", (evento) => {
    const activa = document.body.classList.toggle("modo-presentacion");
    evento.currentTarget.setAttribute("aria-pressed", String(activa));
    evento.currentTarget.textContent = activa
      ? "Salir de presentación"
      : "Modo presentación";
  });

function mostrarError(elemento, error, boton) {
  elemento.textContent = `No fue posible ejecutar la operación: ${error.message}`;
  elemento.className = "estado estado-error";
  boton.disabled = false;
}

async function cargarDatosObservados() {
  const respuesta = await fetch("data/observados.json");
  if (!respuesta.ok) {
    throw new Error(
      `No se pudieron cargar los datos observados (HTTP ${respuesta.status}).`,
    );
  }
  return respuesta.json();
}

function presentarResultadosBase(resumen) {
  const wq = resumen.resumen.Wq.media;
  valorWq.textContent = `${formatoMinutos.format(wq)} min`;
  intervaloWqSimulado.textContent = resumen.resumen.Wq.ic95
    ? `${formatoMinutos.format(resumen.resumen.Wq.ic95.inferior)}–` +
      `${formatoMinutos.format(resumen.resumen.Wq.ic95.superior)} min`
    : "No estimable";
  resultados.hidden = false;
}

function formatoValor(indicador, valor) {
  return indicador === "Wq"
    ? `${formatoMinutos.format(valor)} min`
    : new Intl.NumberFormat("es-CO").format(valor);
}

function formatoDiferencia(indicador, valor) {
  const diferencia = Math.abs(valor) < 1e-9 ? 0 : valor;
  const signo = diferencia > 0 ? "+" : "";
  return indicador === "Wq"
    ? `${signo}${formatoMinutos.format(diferencia)} min`
    : `${signo}${new Intl.NumberFormat("es-CO").format(diferencia)}`;
}

function agregarCelda(fila, texto, etiqueta = "td") {
  const celda = document.createElement(etiqueta);
  celda.textContent = texto;
  fila.append(celda);
  return celda;
}

function mostrarComparacion(comparacion) {
  tablaComparacion.replaceChildren();
  for (const filaResultado of comparacion.filas) {
    const fila = document.createElement("tr");
    agregarCelda(fila, filaResultado.indicador);
    const referencia = agregarCelda(
      fila,
      formatoValor(filaResultado.indicador, filaResultado.referencia),
    );
    const fuente = document.createElement("small");
    fuente.textContent = filaResultado.fuente;
    referencia.append(fuente);
    agregarCelda(
      fila,
      formatoValor(filaResultado.indicador, filaResultado.corrida),
    );
    agregarCelda(
      fila,
      formatoDiferencia(filaResultado.indicador, filaResultado.diferencia),
    );
    tablaComparacion.append(fila);
  }

  estadoComparacion.textContent = comparacion.frase;
  estadoComparacion.className = comparacion.coincide
    ? "comparacion comparacion-correcta"
    : "comparacion comparacion-diferente";
}

function mostrarCifras(datos) {
  listaCifras.replaceChildren();
  for (const [nombre, valor] of cifrasVerificadas(datos)) {
    const termino = document.createElement("dt");
    termino.textContent = nombre;
    const descripcion = document.createElement("dd");
    descripcion.textContent = valor;
    listaCifras.append(termino, descripcion);
  }
}

function mostrarTablaPacientes(pacientes, datos) {
  const registros = new Map(datos.pacientes.map((paciente) => [paciente.id, paciente]));
  tablaPacientes.replaceChildren();
  for (const paciente of pacientes) {
    const registro = registros.get(paciente.id);
    const fila = document.createElement("tr");
    [
      paciente.id,
      registro.dia,
      paciente.tipo,
      formatoHoraObservada(paciente.llegada),
      `V${paciente.ventanilla}`,
      formatoHoraObservada(paciente.inicio),
      formatoValor("Wq", paciente.atencion).replace("Wq", ""),
      formatoValor("Wq", paciente.espera),
      formatoHoraObservada(paciente.fin),
    ].forEach((valor) => agregarCelda(fila, valor));
    tablaPacientes.append(fila);
  }
}

function actualizarResumenFinal(visible, comparacion) {
  resumenFinalReplay.hidden = !visible;
  botonCsv.disabled = !visible;
  if (!visible || !comparacion) {
    estadoCsv.textContent = "";
    estadoCsv.className = "estado";
    return;
  }

  resumenFinalPacientes.textContent = String(comparacion.resultados.pacientes);
  resumenFinalEsperaron.textContent = String(comparacion.resultados.esperaron);
  resumenFinalWq.textContent =
    `${formatoMinutos.format(comparacion.resultados.Wq)} min`;
  estadoCsv.textContent =
    "Resumen de la selección completada. Las cifras se toman de la comparación ya calculada.";
  estadoCsv.className = "estado";
}

function crearCarril(dia, ventanilla, pacientes, maximo) {
  const contenedor = document.createElement("div");
  contenedor.className = "carril-tiempo";
  const etiqueta = document.createElement("span");
  etiqueta.className = "nombre-carril";
  etiqueta.textContent = `${dia} · Ventanilla ${ventanilla}`;
  const pista = document.createElement("div");
  pista.className = "pista-tiempo";

  for (const paciente of pacientes) {
    const barra = document.createElement("span");
    const inicio = Math.max(0, paciente.inicio);
    const fin = Math.max(inicio, paciente.fin);
    barra.className = "barra-servicio";
    barra.style.left = `${(100 * inicio) / maximo}%`;
    barra.style.width = `${Math.max((100 * (fin - inicio)) / maximo, 0.4)}%`;
    barra.title =
      `${paciente.id}: ${formatoHoraObservada(paciente.inicio)}–` +
      `${formatoHoraObservada(paciente.fin)}`;
    barra.setAttribute("aria-label", barra.title);
    pista.append(barra);
  }

  contenedor.append(etiqueta, pista);
  return contenedor;
}

function mostrarLineaTiempo(pacientes, datos) {
  const registros = new Map(datos.pacientes.map((paciente) => [paciente.id, paciente]));
  const dias = [...new Set(pacientes.map((paciente) => registros.get(paciente.id).dia))];
  const maximo = Math.max(1, ...pacientes.map((paciente) => paciente.fin));
  const carriles = new Map();
  for (const paciente of pacientes) {
    const dia = registros.get(paciente.id).dia;
    const clave = `${dia}|${paciente.ventanilla}`;
    if (!carriles.has(clave)) {
      carriles.set(clave, []);
    }
    carriles.get(clave).push(paciente);
  }

  lineaTiempo.replaceChildren();
  for (const dia of dias) {
    for (const ventanilla of [1, 2, 3]) {
      const pacientesCarril = carriles.get(`${dia}|${ventanilla}`);
      if (pacientesCarril?.length) {
        lineaTiempo.append(
          crearCarril(dia, ventanilla, pacientesCarril, maximo),
        );
      }
    }
  }

  const eje = document.createElement("div");
  eje.className = "eje-tiempo";
  for (let indice = 0; indice <= 4; indice += 1) {
    const etiqueta = document.createElement("span");
    etiqueta.textContent = formatoHoraObservada((maximo * indice) / 4);
    eje.append(etiqueta);
  }
  lineaTiempo.append(eje);
}

function crearControlReproduccion() {
  let corridas = [];
  let resumen = null;
  let instantes = [];
  let duracionTotal = 0;
  let tiempoGlobal = 0;
  let corridaActual = -1;
  let corridaEnPausa = null;
  let temporizador;
  let ultimaMarca;
  let notificarFin = () => {};
  let resumenFinalVisible = false;

  function detener() {
    if (temporizador !== undefined) {
      window.clearInterval(temporizador);
      temporizador = undefined;
    }
    hud.alternar.textContent = "Reproducir";
    ultimaMarca = undefined;
  }

  function mostrarTiempo() {
    if (corridas.length === 0) {
      return;
    }

    tiempoGlobal = Math.max(0, Math.min(duracionTotal, tiempoGlobal));
    let indiceCorrida =
      corridaEnPausa ??
      corridas.findIndex(
        (corrida, indice) =>
          tiempoGlobal < corrida.inicio + corrida.duracion ||
          indice === corridas.length - 1,
      );
    if (indiceCorrida < 0) {
      indiceCorrida = corridas.length - 1;
    }
    const corrida = corridas[indiceCorrida];
    if (corridaActual !== indiceCorrida) {
      escenaLocal?.actualizarCalidad(resumen.resultados.pacientes);
      escenaLocal?.cargarEventos(corrida.eventos);
      corridaActual = indiceCorrida;
    }
    const tiempoLocal = Math.max(
      0,
      Math.min(corrida.duracion, tiempoGlobal - corrida.inicio),
    );
    const eventos = corrida.eventos.filter(
      (evento) => evento.tiempo <= tiempoLocal,
    );
    const eventosPrevios = corridas
      .slice(0, indiceCorrida)
      .flatMap((elemento) => elemento.eventos);
    const llegadasPrevias = eventosPrevios
      .filter((evento) => evento.tipo === "llegada");
    const finalesPrevios = eventosPrevios
      .filter((evento) => evento.tipo === "fin_servicio");
    const llegadasActuales = eventos.filter((evento) => evento.tipo === "llegada");
    const finalesActuales = eventos.filter((evento) => evento.tipo === "fin_servicio");
    const estadoActual = eventos.at(-1)?.estado;
    const filas = estadoActual?.filas ?? {};
    const colaGeneral = (filas.General ?? []).length;
    const colaPreferencial = (filas.Preferencial ?? []).length;
    const enServicio = (estadoActual?.ventanillas ?? []).filter(
      (ventanilla) => ventanilla.ocupada,
    ).length;
    const preferenciales = [...llegadasPrevias, ...llegadasActuales].filter(
      (evento) => evento.paciente_tipo === "Preferencial",
    ).length;
    const esperaronEnEventos = [...llegadasPrevias, ...llegadasActuales].filter(
      (llegada) =>
        Object.values(llegada.estado.filas).some((ids) =>
          ids.includes(llegada.paciente_id),
        ),
    ).length;
    const colaMaxima = [...eventosPrevios, ...eventos].reduce(
      (maximo, evento) =>
        Math.max(
          maximo,
          Object.values(evento.estado.filas).reduce(
            (total, ids) => total + ids.length,
            0,
          ),
        ),
      0,
    );
    const alFinal = tiempoLocal >= corrida.duracion;
    const llegados = llegadasPrevias.length + llegadasActuales.length;
    const atendidos = finalesPrevios.length + finalesActuales.length;
    escenaLocal?.actualizarTiempo(tiempoLocal);

    hud.reloj.textContent = formatoHoraObservada(tiempoLocal);
    hud.llegados.textContent = String(alFinal ? resumen.resultados.pacientes : llegados);
    hud.atendidos.textContent = String(alFinal ? resumen.resultados.pacientes : atendidos);
    hud.esperaron.textContent = String(
      alFinal ? resumen.resultados.esperaron : esperaronEnEventos,
    );
    hud.filas.textContent = `${colaGeneral} / ${colaPreferencial}`;
    hud.wq.textContent = alFinal
      ? `${formatoMinutos.format(resumen.resultados.Wq)} min`
      : "—";
    hud.preferenciales.textContent = String(preferenciales);
    hud.enServicio.textContent = String(enServicio);
    hud.colaMaxima.textContent = String(colaMaxima);
    hud.posicion.value = String(Math.round(tiempoGlobal * 100));
    hud.estado.textContent =
      `${temporizador ? "Reproduciendo" : "Pausada"} · ` +
      `${corrida.dia} · ${formatoHoraObservada(tiempoLocal)}.`;
    const seleccionCompletada =
      duracionTotal > 0 && tiempoGlobal >= duracionTotal;
    if (seleccionCompletada !== resumenFinalVisible) {
      resumenFinalVisible = seleccionCompletada;
      notificarFin(seleccionCompletada, resumen);
    }
  }

  function saltar(cantidad) {
    if (instantes.length === 0) {
      return;
    }
    detener();
    if (corridaEnPausa !== null) {
      corridaEnPausa = null;
      corridaActual = -1;
      mostrarTiempo();
    }
    const siguiente =
      cantidad > 0
        ? instantes.find((instante) => instante > tiempoGlobal + 1e-6)
        : [...instantes].reverse().find((instante) => instante < tiempoGlobal - 1e-6);
    tiempoGlobal =
      siguiente ?? (cantidad > 0 ? duracionTotal : 0);
    corridaActual = -1;
    mostrarTiempo();
  }

  function alternar() {
    if (corridas.length === 0) {
      return;
    }
    if (temporizador !== undefined) {
      detener();
      mostrarTiempo();
      return;
    }
    if (corridaEnPausa !== null) {
      corridaEnPausa = null;
      corridaActual = -1;
      mostrarTiempo();
    }
    if (corridaActual < 0) {
      mostrarTiempo();
    }
    if (tiempoGlobal >= duracionTotal) {
      tiempoGlobal = 0;
      corridaActual = -1;
      mostrarTiempo();
    }
    hud.alternar.textContent = "Pausar";
    ultimaMarca = performance.now();
    temporizador = window.setInterval(() => {
      const ahora = performance.now();
      const incremento =
        ((ahora - ultimaMarca) / 1000) * Number(hud.velocidad.value);
      ultimaMarca = ahora;
      const corrida = corridas[corridaActual];
      const finDia = corrida?.inicio + corrida?.duracion;
      if (
        corrida &&
        corridaActual < corridas.length - 1 &&
        tiempoGlobal + incremento >= finDia
      ) {
        tiempoGlobal = finDia;
        corridaEnPausa = corridaActual;
        detener();
        mostrarTiempo();
        return;
      }
      tiempoGlobal += incremento;
      if (tiempoGlobal >= duracionTotal) {
        tiempoGlobal = duracionTotal;
        detener();
      }
      mostrarTiempo();
    }, 32);
  }

  function reiniciar() {
    detener();
    escenaLocal?.reiniciarAnimacion();
    corridaActual = -1;
    corridaEnPausa = null;
    tiempoGlobal = 0;
    resumenFinalVisible = false;
    notificarFin(false, resumen);
    hud.reloj.textContent = "08:00";
    hud.llegados.textContent = "0";
    hud.atendidos.textContent = "0";
    hud.esperaron.textContent = "0";
    hud.filas.textContent = "0 / 0";
    hud.wq.textContent = "—";
    hud.preferenciales.textContent = "0";
    hud.enServicio.textContent = "0";
    hud.colaMaxima.textContent = "—";
    hud.posicion.value = "0";
    hud.estado.textContent = "Pausada · Reproducción reiniciada.";
  }

  function cargar(corridasNuevas, resumenNuevo, callbackFinal) {
    detener();
    corridas = [];
    resumen = resumenNuevo;
    notificarFin = callbackFinal ?? (() => {});
    resumenFinalVisible = false;
    notificarFin(false, resumen);
    duracionTotal = 0;
    instantes = [];
    for (const [indice, corrida] of corridasNuevas.entries()) {
      const duracion = Math.max(0, ...corrida.eventos.map((evento) => evento.tiempo));
      corridas.push({
        ...corrida,
        dia: corrida.dia ?? `Día ${indice + 1}`,
        inicio: duracionTotal,
        duracion,
      });
      for (const evento of corrida.eventos) {
        instantes.push(duracionTotal + evento.tiempo);
      }
      duracionTotal += duracion;
    }
    instantes = [...new Set(instantes)].sort((a, b) => a - b);
    tiempoGlobal = 0;
    corridaActual = -1;
    corridaEnPausa = null;
    hud.posicion.min = "0";
    hud.posicion.max = String(Math.max(0, Math.ceil(duracionTotal * 100)));
    hud.posicion.value = "0";
    hud.posicion.disabled = instantes.length === 0;
    hud.alternar.disabled = instantes.length === 0;
    hud.anterior.disabled = instantes.length === 0;
    hud.siguiente.disabled = instantes.length === 0;
    hud.reiniciar.disabled = instantes.length === 0;
    hud.velocidad.disabled = instantes.length === 0;
    mostrarTiempo();
    detener();
    mostrarTiempo();
  }

  hud.alternar.addEventListener("click", alternar);
  hud.anterior.addEventListener("click", () => saltar(-1));
  hud.siguiente.addEventListener("click", () => saltar(1));
  hud.reiniciar.addEventListener("click", reiniciar);
  hud.velocidad.addEventListener("input", () => {
    hud.valorVelocidad.value = `${hud.velocidad.value}×`;
  });
  hud.posicion.addEventListener("input", () => {
    detener();
    corridaEnPausa = null;
    corridaActual = -1;
    tiempoGlobal = Number(hud.posicion.value) / 100;
    mostrarTiempo();
  });

  return {
    alternar,
    cargar,
    saltar,
    reiniciar,
  };
}

let datosObservados;
let numeroCorrida = 0;
let escenaLocal;
const formularioLaboratorio = document.querySelector("#formulario-laboratorio");
const controlReproduccion = crearControlReproduccion();

try {
  escenaLocal = crearLocal3D(contenedorEscena);
  escenaLocal.actualizarCalidad(0);
  estadoEscena.textContent = escenaLocal.obtenerEstado().calidadReducida
    ? "Calidad reducida automáticamente para este dispositivo."
    : "Maqueta lista: 60 espacios de fila, 12 sillas y controles orbitales.";
  document.querySelectorAll("[data-vista]").forEach((boton) => {
    boton.addEventListener("click", () => {
      try {
        escenaLocal.establecerVista(boton.dataset.vista);
        document
          .querySelectorAll("[data-vista]")
          .forEach((elemento) => elemento.setAttribute("aria-pressed", "false"));
        boton.setAttribute("aria-pressed", "true");
      } catch (error) {
        estadoEscena.textContent = `No fue posible cambiar la vista: ${error.message}`;
        estadoEscena.className = "estado estado-error";
      }
    });
  });
  contenedorEscena.addEventListener("calidadescena", (evento) => {
    estadoEscena.textContent = evento.detail.reducida
      ? `Calidad reducida automáticamente para ${evento.detail.cantidadPersonas} personas.`
      : "Maqueta lista: 60 espacios de fila, 12 sillas y controles orbitales.";
  });
  contenedorEscena.addEventListener("rendimientoescena", (evento) => {
    contenedorEscena.dataset.geometriasRenderer =
      String(evento.detail.geometriasRenderer);
    contenedorEscena.dataset.texturasRenderer =
      String(evento.detail.texturasRenderer);
    if (evento.detail.cantidadPersonas > 0) {
      estadoEscena.textContent =
        `Escena: ${evento.detail.fps} fps medidos con carga de ` +
        `${evento.detail.cantidadPersonas} pacientes; ` +
        `${evento.detail.personasVisibles} visibles en este instante.`;
    }
  });
  document
    .querySelector('[data-vista="isometrica"]')
    .setAttribute("aria-pressed", "true");
  document.addEventListener("keydown", (evento) => {
    const objetivo = evento.target;
    if (
      objetivo instanceof HTMLElement &&
      (objetivo.isContentEditable ||
        ["INPUT", "SELECT", "TEXTAREA", "BUTTON", "SUMMARY"].includes(
          objetivo.tagName,
        ))
    ) {
      return;
    }

    if (evento.code === "Space") {
      evento.preventDefault();
      controlReproduccion.alternar();
    } else if (evento.key === "ArrowLeft") {
      evento.preventDefault();
      controlReproduccion.saltar(-1);
    } else if (evento.key === "ArrowRight") {
      evento.preventDefault();
      controlReproduccion.saltar(1);
    } else if (["1", "2", "3"].includes(evento.key)) {
      const vista = { "1": "cenital", "2": "isometrica", "3": "frontal" }[
        evento.key
      ];
      escenaLocal?.establecerVista(vista);
      document
        .querySelectorAll("[data-vista]")
        .forEach((boton) =>
          boton.setAttribute(
            "aria-pressed",
            String(boton.dataset.vista === vista),
          ),
        );
    }
  });
} catch (error) {
  const detalle = error.message.replace(/[.\s]+$/, "");
  document.body.classList.add("sin-webgl");
  contenedorEscena.replaceChildren(
    Object.assign(document.createElement("p"), {
      className: "aviso-webgl",
      textContent:
        "La visualización 3D no está disponible en este navegador. " +
        "Puedes seguir usando los controles, resultados y tablas.",
    }),
  );
  document.querySelectorAll("[data-vista]").forEach((boton) => {
    boton.disabled = true;
  });
  estadoEscena.textContent =
    `Visualización 3D no disponible: ${detalle}. ` +
    "Los controles, resultados y tablas siguen disponibles.";
  estadoEscena.className = "estado estado-error";
}

botonBase.addEventListener("click", async () => {
  if (!datosObservados) {
    return;
  }

  botonBase.disabled = true;
  estado.textContent = `Ejecutando ${numeroReplicas} réplicas Poisson/exponenciales con las tasas estimadas del pico…`;
  estado.className = "estado";
  await new Promise((resolver) => setTimeout(resolver, 0));

  try {
    const semilla =
      datosObservados.meta.semilla_usada + numeroCorrida * numeroReplicas;
    const configuracion = crearConfiguracionBase(datosObservados, semilla);
    const resumen = correrReplicas(configuracion, numeroReplicas);
    presentarResultadosBase(resumen);
    numeroCorrida += 1;
    estado.textContent =
      `Simulación completada: ${numeroReplicas} réplicas, semillas ` +
      `${resumen.semillas[0]}–${resumen.semillas.at(-1)}.`;
    estado.className = "estado estado-correcto";
  } catch (error) {
    mostrarError(estado, error, botonBase);
  } finally {
    botonBase.disabled = false;
  }
});

botonReplay.addEventListener("click", async () => {
  if (!datosObservados) {
    return;
  }

  botonReplay.disabled = true;
  estadoReplay.textContent = "Reproduciendo los registros observados…";
  estadoReplay.className = "estado";
  actualizarResumenFinal(false, comparacionParaCsv);
  await new Promise((resolver) => setTimeout(resolver, 0));

  try {
    const seleccion = {
      dia: selectorDia.value,
      tramo: selectorTramo.value,
    };
    const configuraciones = crearConfiguracionesReproduccion(
      datosObservados,
      seleccion,
    );
    const corridasReproducidas = configuraciones.map((configuracion) =>
      simular(configuracion),
    );
    const pacientesReproducidos = corridasReproducidas.flatMap(
      (corrida) => corrida.pacientes,
    );
    const comparacion = compararReproduccionObservada(
      datosObservados,
      seleccion,
      pacientesReproducidos,
    );
    const tramo =
      seleccion.tramo === "hora_pico"
        ? "hora pico (08:02–09:02)"
        : "jornada completa";

    mostrarComparacion(comparacion);
    mostrarCifras(datosObservados);
    mostrarTablaPacientes(comparacion.pacientes, datosObservados);
    mostrarLineaTiempo(comparacion.pacientes, datosObservados);
    escenaLocal?.actualizarCalidad(comparacion.pacientes.length);
    comparacionParaCsv = comparacion;
    seleccionParaCsv = seleccion;
    datosParaCsv = datosObservados;
    controlReproduccion.cargar(
      corridasReproducidas.map((corrida, indice) => ({
        eventos: corrida.eventos,
        dia:
          configuraciones[indice].llegadas.pacientes[0]?.dia ??
          (seleccion.dia === "Los tres" ? `Día ${indice + 1}` : seleccion.dia),
      })),
      comparacion,
      actualizarResumenFinal,
    );
    resumenSeleccion.textContent =
      `${seleccion.dia} · ${tramo} · ${comparacion.resultados.pacientes} pacientes.`;
    resultadosReplay.hidden = false;
    estadoReplay.textContent =
      `Reproducción completada para ${seleccion.dia.toLowerCase()}: ` +
      `${comparacion.resultados.pacientes} pacientes.`;
    estadoReplay.className = "estado estado-correcto";
  } catch (error) {
    mostrarError(estadoReplay, error, botonReplay);
  } finally {
    botonReplay.disabled = false;
  }
});

botonCsv.addEventListener("click", () => {
  if (!comparacionParaCsv || !seleccionParaCsv || !datosParaCsv) {
    return;
  }
  try {
    const nombre = nombreCsvReproduccion(seleccionParaCsv);
    const contenido = crearCsvPacientes(
      comparacionParaCsv.pacientes,
      datosParaCsv,
    );
    const archivo = new Blob([contenido], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(archivo);
    const enlace = document.createElement("a");
    enlace.href = url;
    enlace.download = nombre;
    enlace.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    estadoCsv.textContent = `Descarga preparada: ${nombre}.`;
    estadoCsv.className = "estado estado-correcto";
  } catch (error) {
    estadoCsv.textContent = `No fue posible exportar el CSV: ${error.message}`;
    estadoCsv.className = "estado estado-error";
  }
});

try {
  datosObservados = await cargarDatosObservados();
  if (!datosObservados.cifras_verificadas) {
    throw new Error(
      "Faltan cifras_verificadas en data/observados.json; deben agregarse desde el exportador de Python.",
    );
  }
  botonBase.disabled = false;
  botonReplay.disabled = false;
  selectorDia.disabled = false;
  selectorTramo.disabled = false;
  estado.textContent =
    "Datos observados cargados. La simulación aleatoria usa Poisson y servicio exponencial con tasas estimadas del pico.";
  estadoReplay.textContent =
    "Elige un día y un tramo para reproducir los registros observados.";
  document.querySelector("#acerca-fuente").textContent =
    datosObservados.meta.fuente_datos ??
    "No especificada en los metadatos exportados.";
  document.querySelector("#acerca-fecha").textContent =
    datosObservados.meta.fecha_exportacion ??
    "No especificada en los metadatos exportados.";
  document.querySelector("#acerca-version").textContent =
    datosObservados.meta.version_codigo ??
    "No especificada en los metadatos exportados.";
  iniciarLaboratorio({
    formulario: formularioLaboratorio,
    datos: datosObservados,
    alVolverObservados: () => botonReplay.click(),
    alSimular: async ({ corrida, metricas }) => {
      resultadosReplay.hidden = true;
      const resumen = {
        pacientes: corrida.pacientes,
        resultados: {
          pacientes: metricas.n,
          esperaron: corrida.pacientes.filter((paciente) => paciente.espera > 0)
            .length,
          Wq: metricas.Wq,
        },
      };
      comparacionParaCsv = resumen;
      seleccionParaCsv = { dia: "Simulación", tramo: "laboratorio" };
      datosParaCsv = {
        pacientes: corrida.pacientes.map((paciente) => ({
          id: paciente.id,
          dia: "Laboratorio",
        })),
      };
      escenaLocal?.actualizarCalidad(metricas.n);
      controlReproduccion.cargar(
        [{ eventos: corrida.eventos, dia: "Laboratorio" }],
        resumen,
        actualizarResumenFinal,
      );
    },
  });
} catch (error) {
  const detalle = error.message.replace(/[.\s]+$/, "");
  const mensaje =
    `No se pudieron cargar o validar los datos observados: ${detalle}. ` +
    "Revisa data/observados.json y recarga la página.";
  avisoAplicacion.textContent =
    `${mensaje} El caso base y la reproducción observada permanecerán deshabilitados.`;
  avisoAplicacion.hidden = false;
  estado.textContent = mensaje;
  estado.className = "estado estado-error";
  estadoReplay.textContent =
    "No se puede iniciar la reproducción porque faltan datos observados válidos.";
  estadoReplay.className = "estado estado-error";
}

let recorridoVisto = false;
try {
  recorridoVisto =
    window.localStorage.getItem("pharmasan-recorrido-visto") === "si";
} catch {
  recorridoVisto = false;
}
if (!recorridoVisto) {
  window.setTimeout(() => mostrarDialogo("recorrido"), 0);
}
