import assert from "node:assert/strict";
import test from "node:test";
import {
  CAPACIDAD_FILAS,
  FPS_OBJETIVO,
  UMBRAL_CALIDAD_REDUCIDA,
  requiereCalidadReducida,
} from "../src/escena/local3d.js";
import {
  PARTES_POR_PERSONA,
  crearTransformacionesPersona,
  establecerInstanciaPersona,
  obtenerColoresPersona,
} from "../src/escena/instancias-personas.js";
import * as THREE from "../vendor/three/three.module.js";

test("la maqueta reserva 60 posiciones por grupo y limita el render a 30 fps", () => {
  assert.equal(CAPACIDAD_FILAS, 120);
  assert.equal(FPS_OBJETIVO, 30);
});

test("activa calidad reducida desde 120 personas", () => {
  assert.equal(UMBRAL_CALIDAD_REDUCIDA, 120);
  assert.equal(requiereCalidadReducida(119), false);
  assert.equal(requiereCalidadReducida(120), true);
  assert.equal(requiereCalidadReducida(121), true);
});

test("rechaza cantidades de personas que no son enteros no negativos", () => {
  for (const cantidad of [-1, 1.5, Number.NaN]) {
    assert.throws(() => requiereCalidadReducida(cantidad), RangeError);
  }
});

test("las instancias visibles conservan mallas, colores y posiciones alineadas", () => {
  const cantidad = 71;
  const crearMalla = (geometria, capacidad) =>
    new THREE.InstancedMesh(
      geometria,
      new THREE.MeshBasicMaterial({ color: 0xffffff }),
      capacidad,
    );
  const mallas = [
    crearMalla(
      new THREE.IcosahedronGeometry(1, 0),
      cantidad * PARTES_POR_PERSONA,
    ),
    crearMalla(new THREE.RingGeometry(0.29, 0.37, 16), cantidad),
  ];
  const coloresAsignados = mallas.map(() => []);
  const colores = new Map();
  const obtenerColor = (valor) => {
    if (!colores.has(valor)) colores.set(valor, new THREE.Color(valor));
    return colores.get(valor);
  };
  const objetoTemporal = new THREE.Object3D();

  for (let indice = 0; indice < cantidad; indice += 1) {
    const x = indice - 35;
    const persona = {
      id: `Paciente ${indice + 1}`,
      tipo: indice % 2 === 0 ? "General" : "Preferencial",
      posicion: [x, 0, 0.43],
      orientacion: 0,
      caminando: indice % 3 === 0,
      faseMarcha: indice / 4,
    };
    const partes = crearTransformacionesPersona(persona, 2);
    const tonos = obtenerColoresPersona(persona.id, persona.tipo);
    partes.slice(0, PARTES_POR_PERSONA).forEach((parte, indiceParte) =>
      establecerInstanciaPersona(
        objetoTemporal,
        mallas[0],
        indice * PARTES_POR_PERSONA + indiceParte,
        parte,
        tonos[indiceParte],
        coloresAsignados[0],
        obtenerColor,
      ),
    );
    establecerInstanciaPersona(
      objetoTemporal,
      mallas[1],
      indice,
      partes[PARTES_POR_PERSONA],
      0x55a86a,
      coloresAsignados[1], obtenerColor,
    );
  }
  for (const malla of mallas) {
    malla.instanceMatrix.needsUpdate = true;
    malla.instanceColor.needsUpdate = true;
  }

  assert.deepEqual(mallas.map((malla) => malla.count), [71 * 12, 71]);
  const matriz = new THREE.Matrix4();
  for (let indice = 0; indice < cantidad; indice += 1) {
    const indiceCuerpo = indice * PARTES_POR_PERSONA;
    mallas[0].getMatrixAt(indiceCuerpo, matriz);
    const posicionCuerpo = new THREE.Vector3().setFromMatrixPosition(matriz);
    const posicion = [indice - 35, 0, 0.43];
    const persona = {
      id: `Paciente ${indice + 1}`,
      tipo: indice % 2 === 0 ? "General" : "Preferencial",
      posicion,
      caminando: indice % 3 === 0,
      faseMarcha: indice / 4,
    };
    const partes = crearTransformacionesPersona(persona, 2);
    const matrizAnillo = new THREE.Matrix4();
    mallas[1].getMatrixAt(indice, matrizAnillo);
    const posicionAnillo = new THREE.Vector3().setFromMatrixPosition(matrizAnillo);
    for (let parte = 0; parte < PARTES_POR_PERSONA; parte += 1) {
      const instancia = indice * PARTES_POR_PERSONA + parte;
      mallas[0].getMatrixAt(instancia, matriz);
      assert.ok([...matriz.elements].every(Number.isFinite));
      const canales = mallas[0].instanceColor.array.slice(
        instancia * 3,
        instancia * 3 + 3,
      );
      assert.ok([...canales].every(Number.isFinite));
      assert.ok([...canales].some((canal) => canal > 0));
    }
    mallas[1].getMatrixAt(indice, matriz);
    assert.ok([...matriz.elements].every(Number.isFinite));
    assert.ok(posicionCuerpo.distanceTo(posicionAnillo) > 0);
    assert.ok(Math.abs(posicionCuerpo.x - posicionAnillo.x) < 1e-6);
    assert.ok(Math.abs(posicionCuerpo.z - posicionAnillo.z) < 1e-6);
    assert.ok(partes[0].escala[1] > partes[0].escala[0]);
  }
});
