const PARTES_POR_PERSONA = 12;

function hashIdentificador(identificador) {
  let hash = 2166136261;
  for (const caracter of String(identificador)) {
    hash = Math.imul(hash ^ caracter.charCodeAt(0), 16777619);
  }
  return hash >>> 0;
}

function ubicarParte(
  x,
  z,
  giro,
  dx,
  dy,
  dz,
  escala,
  rotacionZ = 0,
  rotacionX = 0,
) {
  const coseno = Math.cos(giro);
  const seno = Math.sin(giro);
  return {
    posicion: [x + dx * coseno + dz * seno, dy, z - dx * seno + dz * coseno],
    escala,
    rotacionX,
    rotacionY: giro,
    rotacionZ,
  };
}

export function obtenerColoresPersona(id, tipo) {
  const identificador = hashIdentificador(id);
  const ropaGeneral = [0x397d65, 0x478971, 0x2f705a, 0x53967b];
  const ropaPreferencial = [0xc07b43, 0xae693b, 0xd08b53, 0x9f6138];
  const tonosPiel = [0xf0c9a8, 0xd9aa82, 0xb97954, 0x8e5a40, 0xe7bd98];
  const tonosCabello = [0x30231c, 0x4c352a, 0x70523b, 0x3e3730, 0x99978f];
  const ropa = tipo === "Preferencial" ? ropaPreferencial : ropaGeneral;
  const tonoPiel = tonosPiel[(identificador >>> 5) % tonosPiel.length];
  const tonoCabello =
    tipo === "Preferencial" && (identificador >>> 10) % 3 === 0
      ? tonosCabello[4]
      : tonosCabello[(identificador >>> 12) % 4];

  return [
    ropa[identificador % ropa.length],
    tonoPiel,
    tonoPiel,
    tonoCabello,
    tonoPiel,
    tonoPiel,
    0x414b48,
    0x414b48,
    0x302a27,
    0x302a27,
    0x765638,
    0x765638,
  ];
}

export function crearTransformacionesPersona(persona, tiempo = 0) {
  const [x, , z] = persona.posicion;
  const giro = Number.isFinite(persona.orientacion) ? persona.orientacion : 0;
  const caminando = Boolean(persona.caminando);
  const fase = Number.isFinite(persona.faseMarcha)
    ? persona.faseMarcha
    : tiempo * 2.8;
  const oscilacion = caminando
    ? Math.sin(fase)
    : Math.sin(tiempo * 2.8 + (persona.fase ?? 0)) * 0.045;
  const rebote = caminando ? Math.abs(Math.sin(fase * 2)) * 0.035 : oscilacion * 0.012;
  const gesto = Math.max(0, Math.min(1, persona.gesto ?? 0));
  const brazoIzquierdo = caminando ? oscilacion * 0.42 : gesto * -0.75;
  const brazoDerecho = caminando ? -oscilacion * 0.42 : gesto * 0.38;
  const piernaIzquierda = caminando ? -oscilacion * 0.5 : 0;
  const piernaDerecha = caminando ? oscilacion * 0.5 : 0;
  const elevarPierna = (angulo) => Math.abs(Math.sin(angulo)) * 0.065;
  const baston = persona.tipo === "Preferencial";
  const y = (altura) => altura + rebote;

  return [
    ubicarParte(x, z, giro, 0, y(0.99), 0, [0.29, 0.43, 0.19]),
    ubicarParte(x, z, giro, 0, y(1.43), 0, [0.085, 0.12, 0.08]),
    ubicarParte(x, z, giro, 0, y(1.68), 0, [0.22, 0.245, 0.205]),
    ubicarParte(x, z, giro, 0, y(1.87), -0.005, [0.235, 0.095, 0.22]),
    ubicarParte(x, z, giro, -0.3 + Math.sin(brazoIzquierdo) * 0.1, y(1.13), 0, [0.075, 0.25, 0.075], brazoIzquierdo),
    ubicarParte(x, z, giro, 0.3 + Math.sin(brazoDerecho) * 0.1, y(1.13), 0, [0.075, 0.25, 0.075], brazoDerecho),
    ubicarParte(x, z, giro, -0.12, 0.43 + elevarPierna(piernaIzquierda), Math.sin(piernaIzquierda) * 0.09, [0.09, 0.29, 0.095], piernaIzquierda),
    ubicarParte(x, z, giro, 0.12, 0.43 + elevarPierna(piernaDerecha), Math.sin(piernaDerecha) * 0.09, [0.09, 0.29, 0.095], piernaDerecha),
    ubicarParte(x, z, giro, -0.12, 0.12, 0.045 + Math.sin(piernaIzquierda) * 0.11, [0.13, 0.065, 0.18]),
    ubicarParte(x, z, giro, 0.12, 0.12, 0.045 + Math.sin(piernaDerecha) * 0.11, [0.13, 0.065, 0.18]),
    ubicarParte(x, z, giro, baston ? 0.43 : 0, baston ? 0.47 : -100, 0, [0.026, 0.46, 0.026]),
    ubicarParte(x, z, giro, baston ? 0.43 : 0, baston ? 0.91 : -100, 0, [0.075, 0.025, 0.025]),
    ubicarParte(x, z, giro, 0, 0.06, 0, [1.15, 1.15, 1.15], 0, -Math.PI / 2),
  ];
}

export function establecerInstanciaPersona(
  objetoTemporal,
  malla,
  indice,
  transformacion,
  color,
  coloresAsignados,
  obtenerColor,
) {
  objetoTemporal.position.set(...transformacion.posicion);
  objetoTemporal.rotation.set(
    transformacion.rotacionX ?? 0,
    transformacion.rotacionY ?? 0,
    transformacion.rotacionZ ?? 0,
  );
  objetoTemporal.scale.set(...transformacion.escala);
  objetoTemporal.updateMatrix();
  malla.setMatrixAt(indice, objetoTemporal.matrix);
  if (coloresAsignados[indice] === color) {
    return false;
  }
  malla.setColorAt(indice, obtenerColor(color));
  coloresAsignados[indice] = color;
  return true;
}

export { PARTES_POR_PERSONA };
