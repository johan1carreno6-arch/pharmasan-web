function factorial(numero) {
  let resultado = 1;
  for (let factor = 2; factor <= numero; factor += 1) {
    resultado *= factor;
  }
  return resultado;
}

export function calcularMMc(tasaLlegada, tasaServicio, servidores) {
  if (!Number.isFinite(tasaLlegada) || tasaLlegada < 0) {
    throw new RangeError("La tasa de llegada debe ser finita y no negativa.");
  }
  if (!Number.isFinite(tasaServicio) || tasaServicio <= 0) {
    throw new RangeError("La tasa de servicio debe ser finita y positiva.");
  }
  if (!Number.isInteger(servidores) || servidores < 1) {
    throw new RangeError("El número de servidores debe ser un entero positivo.");
  }

  const carga = tasaLlegada / tasaServicio;
  const rho = carga / servidores;
  if (rho >= 1) {
    throw new RangeError("El sistema M/M/c no es estable cuando rho >= 1.");
  }

  let suma = 0;
  for (let estado = 0; estado < servidores; estado += 1) {
    suma += carga ** estado / factorial(estado);
  }
  const terminoCola =
    (carga ** servidores / factorial(servidores)) / (1 - rho);
  const probabilidadVacio = 1 / (suma + terminoCola);
  const probabilidadEspera = terminoCola * probabilidadVacio;
  const Wq = probabilidadEspera / (servidores * tasaServicio - tasaLlegada);

  return {
    rho,
    P_esperar: probabilidadEspera,
    Wq,
    Lq: tasaLlegada * Wq,
  };
}
