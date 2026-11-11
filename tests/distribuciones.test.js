import assert from "node:assert/strict";
import test from "node:test";
import { crearGeneradorServicio } from "../src/engine/distribuciones.js";
import { crearFlujoAleatorio } from "../src/engine/prng.js";

test("el servicio exponencial es positivo y reproducible con semilla", () => {
  const generar = crearGeneradorServicio(3, crearFlujoAleatorio(19, "servicio"));
  const repetir = crearGeneradorServicio(3, crearFlujoAleatorio(19, "servicio"));
  const muestras = Array.from({ length: 100 }, generar);

  assert.ok(muestras.every((valor) => Number.isFinite(valor) && valor > 0));
  assert.deepEqual(
    muestras,
    Array.from({ length: 100 }, repetir),
  );
});

test("el servicio exponencial rechaza media o generador no válidos", () => {
  assert.throws(() => crearGeneradorServicio(0, () => 0.5), /positivo y finito/);
  assert.throws(() => crearGeneradorServicio(-1, () => 0.5), /positivo y finito/);
  assert.throws(() => crearGeneradorServicio(2, null), /generador aleatorio/);
});
