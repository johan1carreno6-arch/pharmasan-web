export function crearTransformacionesPersona(posicion) {
  const [x, , z] = posicion;
  return {
    cuerpo: {
      posicion: [x, 0.98, z],
      escala: [1.3, 1.7, 1.3],
    },
    cabeza: {
      posicion: [x, 1.85, z],
      escala: [1.4, 1.4, 1.4],
    },
    piernas: [
      {
        posicion: [x - 0.17, 0.34, z],
        escala: [1.35, 1.5, 1.35],
      },
      {
        posicion: [x + 0.17, 0.34, z],
        escala: [1.35, 1.5, 1.35],
      },
    ],
    anillo: {
      posicion: [x, 0.06, z],
      escala: [1.15, 1.15, 1.15],
      rotacionX: -Math.PI / 2,
    },
  };
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
  objetoTemporal.rotation.set(transformacion.rotacionX ?? 0, 0, 0);
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
