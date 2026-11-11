import assert from "node:assert/strict";
import test from "node:test";
import {
  CAPACIDAD_FILAS,
  FPS_OBJETIVO,
  UMBRAL_CALIDAD_REDUCIDA,
  requiereCalidadReducida,
} from "../src/escena/local3d.js";
import {
  crearTransformacionesPersona,
  establecerInstanciaPersona,
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
    crearMalla(new THREE.CylinderGeometry(0.22, 0.3, 0.78, 6), cantidad),
    crearMalla(new THREE.IcosahedronGeometry(0.22, 0), cantidad),
    crearMalla(new THREE.BoxGeometry(0.16, 0.42, 0.18), cantidad * 2),
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
    const posicion = [x, 0, 0.43];
    const partes = crearTransformacionesPersona(posicion);
    const tono = indice % 2 === 0 ? 0x397d65 : 0xc07b43;
    establecerInstanciaPersona(
      objetoTemporal, mallas[0], indice, partes.cuerpo, tono,
      coloresAsignados[0], obtenerColor,
    );
    establecerInstanciaPersona(
      objetoTemporal, mallas[1], indice, partes.cabeza, 0xe5bd96,
      coloresAsignados[1], obtenerColor,
    );
    partes.piernas.forEach((pierna, lado) =>
      establecerInstanciaPersona(
        objetoTemporal, mallas[2], indice * 2 + lado, pierna, 0x34433d,
        coloresAsignados[2], obtenerColor,
      ),
    );
    establecerInstanciaPersona(
      objetoTemporal, mallas[3], indice, partes.anillo, 0x55a86a,
      coloresAsignados[3], obtenerColor,
    );
  }
  for (const malla of mallas) {
    malla.instanceMatrix.needsUpdate = true;
    malla.instanceColor.needsUpdate = true;
  }

  assert.deepEqual(mallas.map((malla) => malla.count), [71, 71, 142, 71]);
  const matriz = new THREE.Matrix4();
  for (let indice = 0; indice < cantidad; indice += 1) {
    mallas[0].getMatrixAt(indice, matriz);
    const matrizCuerpo = matriz.clone();
    const posicion = [indice - 35, 0, 0.43];
    const partes = crearTransformacionesPersona(posicion);
    const matrizAnillo = new THREE.Matrix4();
    mallas[3].getMatrixAt(indice, matrizAnillo);
    const posicionCuerpo = new THREE.Vector3().setFromMatrixPosition(matrizCuerpo);
    const posicionAnillo = new THREE.Vector3().setFromMatrixPosition(matrizAnillo);
    for (const [mallaIndice, instancia] of [
      [0, indice],
      [1, indice],
      [2, indice * 2],
      [2, indice * 2 + 1],
      [3, indice],
    ]) {
      const instanciaMalla = mallas[mallaIndice];
      instanciaMalla.getMatrixAt(instancia, matriz);
      assert.ok([...matriz.elements].every(Number.isFinite));
      const canales = instanciaMalla.instanceColor.array.slice(
        instancia * 3,
        instancia * 3 + 3,
      );
      assert.ok([...canales].every(Number.isFinite));
      assert.ok([...canales].some((canal) => canal > 0));
    }
    assert.ok(posicionCuerpo.distanceTo(posicionAnillo) > 0);
    assert.ok(Math.abs(posicionCuerpo.x - posicionAnillo.x) < 1e-6);
    assert.ok(Math.abs(posicionCuerpo.z - posicionAnillo.z) < 1e-6);
    assert.ok(partes.cuerpo.escala[1] > 1);
  }
});
