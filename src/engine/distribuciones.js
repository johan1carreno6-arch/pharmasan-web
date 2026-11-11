function numeroPositivo(valor, nombre) {
  if (!Number.isFinite(valor) || valor <= 0) {
    throw new RangeError(`${nombre} debe ser positivo y finito.`);
  }
  return valor;
}

export function crearGeneradorServicio(media, aleatorio) {
  const mediaValidada = numeroPositivo(media, "La media de servicio");
  if (typeof aleatorio !== "function") {
    throw new TypeError("El servicio exponencial requiere un generador aleatorio.");
  }
  return () =>
    -mediaValidada * Math.log(Math.max(aleatorio(), Number.MIN_VALUE));
}
