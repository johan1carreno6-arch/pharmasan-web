import { calcularMetricas } from "./metricas.js";
import { simular } from "./simulador.js";

function logGamma(valor) {
  const coeficientes = [
    676.5203681218851,
    -1259.1392167224028,
    771.3234287776531,
    -176.6150291621406,
    12.507343278686905,
    -0.13857109526572012,
    9.9843695780195716e-6,
    1.5056327351493116e-7,
  ];
  let z = valor - 1;
  let suma = 0.99999999999980993;
  for (let indice = 0; indice < coeficientes.length; indice += 1) {
    suma += coeficientes[indice] / (z + indice + 1);
  }
  const t = z + coeficientes.length - 0.5;
  return (
    0.9189385332046727 +
    (z + 0.5) * Math.log(t) -
    t +
    Math.log(suma)
  );
}

function fraccionContinuaBeta(a, b, x) {
  const maxIteraciones = 200;
  const tolerancia = 3e-14;
  const minimo = 1e-300;
  const suma = a + b;
  const aMasUno = a + 1;
  const aMenosUno = a - 1;
  let c = 1;
  let d = 1 - (suma * x) / aMasUno;
  if (Math.abs(d) < minimo) {
    d = minimo;
  }
  d = 1 / d;
  let resultado = d;

  for (let iteracion = 1; iteracion <= maxIteraciones; iteracion += 1) {
    const dosIteracion = 2 * iteracion;
    let coeficiente =
      (iteracion * (b - iteracion) * x) /
      ((aMenosUno + dosIteracion) * (a + dosIteracion));
    d = 1 + coeficiente * d;
    if (Math.abs(d) < minimo) {
      d = minimo;
    }
    c = 1 + coeficiente / c;
    if (Math.abs(c) < minimo) {
      c = minimo;
    }
    d = 1 / d;
    resultado *= d * c;

    coeficiente =
      (-(a + iteracion) * (suma + iteracion) * x) /
      ((a + dosIteracion) * (aMasUno + dosIteracion));
    d = 1 + coeficiente * d;
    if (Math.abs(d) < minimo) {
      d = minimo;
    }
    c = 1 + coeficiente / c;
    if (Math.abs(c) < minimo) {
      c = minimo;
    }
    d = 1 / d;
    const cambio = d * c;
    resultado *= cambio;
    if (Math.abs(cambio - 1) < tolerancia) {
      break;
    }
  }

  return resultado;
}

function betaRegularizada(a, b, x) {
  if (x <= 0) {
    return 0;
  }
  if (x >= 1) {
    return 1;
  }
  const factor = Math.exp(
    logGamma(a + b) -
      logGamma(a) -
      logGamma(b) +
      a * Math.log(x) +
      b * Math.log1p(-x),
  );
  if (x < (a + 1) / (a + b + 2)) {
    return (factor * fraccionContinuaBeta(a, b, x)) / a;
  }
  return 1 - (factor * fraccionContinuaBeta(b, a, 1 - x)) / b;
}

function distribucionT(valor, gradosLibertad) {
  if (valor === 0) {
    return 0.5;
  }
  const x = gradosLibertad / (gradosLibertad + valor * valor);
  const cola = 0.5 * betaRegularizada(gradosLibertad / 2, 0.5, x);
  return valor > 0 ? 1 - cola : cola;
}

export function valorCriticoT(gradosLibertad, nivel = 0.95) {
  if (!Number.isInteger(gradosLibertad) || gradosLibertad < 1) {
    throw new RangeError("Los grados de libertad deben ser un entero positivo.");
  }
  if (!Number.isFinite(nivel) || nivel <= 0 || nivel >= 1) {
    throw new RangeError("El nivel de confianza debe estar entre cero y uno.");
  }

  const objetivo = (1 + nivel) / 2;
  let inferior = 0;
  let superior = 1;
  while (distribucionT(superior, gradosLibertad) < objetivo) {
    superior *= 2;
  }
  for (let iteracion = 0; iteracion < 80; iteracion += 1) {
    const medio = (inferior + superior) / 2;
    if (distribucionT(medio, gradosLibertad) < objetivo) {
      inferior = medio;
    } else {
      superior = medio;
    }
  }
  return (inferior + superior) / 2;
}

function aplanarMetricas(medidas) {
  return {
    n: medidas.n,
    rho_global: medidas.rho_global,
    rho_por_ventanilla: medidas.rho_por_ventanilla,
    Lq: medidas.Lq,
    L: medidas.L,
    Wq: medidas.Wq,
    W: medidas.W,
    P_esperar: medidas.P_esperar,
    porcentaje_espera_mayor_tolerable: medidas.porcentaje_espera_mayor_tolerable,
  };
}

export class ReplicasCanceladasError extends Error {
  constructor() {
    super("La corrida de réplicas fue cancelada.");
    this.name = "ReplicasCanceladasError";
  }
}

export function correrReplicas(configuracion, cantidad, opciones = {}) {
  if (!Number.isInteger(cantidad) || cantidad < 2) {
    throw new RangeError("Se requieren al menos dos réplicas.");
  }
  if (!Number.isInteger(configuracion?.semilla)) {
    throw new TypeError("La configuración requiere una semilla entera explícita.");
  }

  const semillas = [];
  const valores = [];
  for (let indice = 0; indice < cantidad; indice += 1) {
    const semilla = configuracion.semilla + indice;
    if (!Number.isSafeInteger(semilla)) {
      throw new RangeError("La secuencia de semillas excede el rango seguro de enteros.");
    }
    semillas.push(semilla);
    const resultado = simular({ ...configuracion, semilla });
    valores.push(aplanarMetricas(calcularMetricas(resultado, opciones)));
  }

  return resumirMuestra(valores, semillas);
}

function resumirMuestra(valores, semillas) {
  const cantidad = valores.length;
  const resumirValores = (muestra) => {
    const media = muestra.reduce((suma, valor) => suma + valor, 0) / cantidad;
    if (cantidad === 1) return { media };
    const varianza =
      muestra.reduce((suma, valor) => suma + (valor - media) ** 2, 0) /
      (cantidad - 1);
    const margen = valorCriticoT(cantidad - 1) * Math.sqrt(varianza / cantidad);
    return {
      media,
      desviacion: Math.sqrt(varianza),
      ic95: { inferior: media - margen, superior: media + margen },
    };
  };
  const nombres = Object.keys(valores[0]).filter(
    (nombre) => nombre !== "rho_por_ventanilla",
  );
  const resumen = Object.fromEntries(
    nombres.map((nombre) => [
      nombre,
      resumirValores(valores.map((replica) => replica[nombre])),
    ]),
  );
  const idsVentanillas = Object.keys(valores[0].rho_por_ventanilla ?? {});
  resumen.rho_por_ventanilla = Object.fromEntries(
    idsVentanillas.map((id) => [
      id,
      resumirValores(
        valores.map((replica) => replica.rho_por_ventanilla[id]),
      ),
    ]),
  );

  return {
    cantidad,
    semillas: [...semillas],
    replicas: valores,
    resumen,
  };
}

export async function correrReplicasAsincronas(
  configuracion,
  cantidad,
  opciones = {},
) {
  if (!Number.isInteger(cantidad) || cantidad < 1) {
    throw new RangeError("Se requiere al menos una réplica.");
  }
  if (!Number.isInteger(configuracion?.semilla)) {
    throw new TypeError("La configuración requiere una semilla entera explícita.");
  }

  const semillas = [];
  const valores = [];
  const lote = Math.max(1, opciones.lote ?? 10);
  for (let indice = 0; indice < cantidad; indice += 1) {
    if (opciones.estaCancelado?.()) {
      throw new ReplicasCanceladasError();
    }
    const semilla = configuracion.semilla + indice;
    if (!Number.isSafeInteger(semilla)) {
      throw new RangeError("La secuencia de semillas excede el rango seguro de enteros.");
    }
    semillas.push(semilla);
    const resultado = simular({ ...configuracion, semilla });
    valores.push(aplanarMetricas(calcularMetricas(resultado, opciones)));
    if ((indice + 1) % lote === 0 || indice + 1 === cantidad) {
      opciones.alProgreso?.(indice + 1, cantidad);
      await new Promise((resolver) => setTimeout(resolver, 0));
      if (opciones.estaCancelado?.()) {
        throw new ReplicasCanceladasError();
      }
    }
  }

  return resumirMuestra(valores, semillas);
}
