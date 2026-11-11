import assert from "node:assert/strict";
import test from "node:test";
import {
  crearControlPersonas,
  crearRecorridoDesdeEventos,
  obtenerFrameDesdeEventos,
} from "../src/escena/personas.js";

const POSICION_EXTERIOR = [-10.8, 0, 6.52];

function crearEventosPrueba() {
  const estado = (fila, ocupado) => ({
    filas: { General: fila, Preferencial: [] },
    ventanillas: [
      {
        id: 1,
        ocupada: Boolean(ocupado),
        paciente: ocupado ?? null,
        tipo: ocupado ? "General" : null,
      },
    ],
  });
  return [
    {
      tipo: "llegada",
      tiempo: 0,
      paciente_id: "G1",
      paciente_tipo: "General",
      estado: estado([], "G1"),
    },
    {
      tipo: "llegada",
      tiempo: 0.5,
      paciente_id: "G2",
      paciente_tipo: "General",
      estado: estado(["G2"], "G1"),
    },
    {
      tipo: "fin_servicio",
      tiempo: 2,
      paciente_id: "G1",
      paciente_tipo: "General",
      estado: estado([], "G2"),
    },
    {
      tipo: "fin_servicio",
      tiempo: 4,
      paciente_id: "G2",
      paciente_tipo: "General",
      estado: estado([], null),
    },
  ];
}

function congelarProfundo(valor) {
  if (valor && typeof valor === "object" && !Object.isFrozen(valor)) {
    Object.freeze(valor);
    Object.values(valor).forEach(congelarProfundo);
  }
  return valor;
}

test("la animación de personas no modifica el registro ni las métricas", () => {
  const eventos = congelarProfundo(crearEventosPrueba());
  const metricas = congelarProfundo({ n: 2, Wq: 0.75, Lq: 0.2 });
  const control = crearControlPersonas();
  const metricasAntes = structuredClone(metricas);

  control.cargar(eventos);
  for (const tiempo of [0.06, 0.25, 1, 2.1, 3.5, 4.1]) {
    control.actualizar(tiempo);
  }

  assert.deepEqual(metricas, metricasAntes);
  assert.equal(eventos.length, 4);
});

test("cada paciente entra, espera, llega a servicio y sale por la puerta", () => {
  const control = crearControlPersonas();
  control.cargar(crearEventosPrueba());

  const antesDeLlegar = control.actualizar(-0.1);
  assert.deepEqual(antesDeLlegar.personas, []);

  const entrando = control.actualizar(0.06);
  assert.equal(entrando.personas.length, 1);
  assert.equal(entrando.personas[0].id, "G1");
  assert.ok(entrando.personas[0].posicion[0] < -9);

  const enFila = control.actualizar(1);
  const pacienteEnFila = enFila.personas.find((persona) => persona.id === "G2");
  assert.deepEqual(pacienteEnFila.posicion, [-6.33, 0, 0.43]);

  const inicioServicio = control.actualizar(2);
  const atendido = inicioServicio.personas.find((persona) => persona.id === "G2");
  assert.deepEqual(atendido.posicion, [-6.33, 0, 0.43]);
  assert.equal(atendido.estado, "servicio");

  const saliendo = control.actualizar(2.1);
  const pacienteQueSale = saliendo.personas.find((persona) => persona.id === "G1");
  assert.equal(pacienteQueSale.estado, "salida");
  assert.notDeepEqual(pacienteQueSale.posicion, POSICION_EXTERIOR);

  const afuera = control.actualizar(2.6);
  assert.ok(!afuera.personas.some((persona) => persona.id === "G1"));
});

test("las trayectorias no saltan y los saltos temporales son reversibles", () => {
  const eventos = crearEventosPrueba();
  const recorrido = crearRecorridoDesdeEventos(eventos);
  const llegadas = new Map(
    eventos
      .filter((evento) => evento.tipo === "llegada")
      .map((evento) => [evento.paciente_id, evento.tiempo]),
  );
  const posicionesPorId = new Map();
  for (let tiempo = -0.1; tiempo <= 4.5; tiempo += 0.01) {
    const frame = obtenerFrameDesdeEventos(recorrido, tiempo);
    for (const persona of frame.personas) {
      const anterior = posicionesPorId.get(persona.id);
      if (anterior) {
        const distancia = Math.hypot(
          persona.posicion[0] - anterior[0],
          persona.posicion[1] - anterior[1],
          persona.posicion[2] - anterior[2],
        );
        assert.ok(distancia <= 0.281, `${persona.id} se desplazó ${distancia} en 0,01 min`);
      } else {
        const distanciaDesdeEntrada = Math.hypot(
          persona.posicion[0] - POSICION_EXTERIOR[0],
          persona.posicion[1] - POSICION_EXTERIOR[1],
          persona.posicion[2] - POSICION_EXTERIOR[2],
        );
        assert.ok(
          distanciaDesdeEntrada <= 28 * (tiempo - llegadas.get(persona.id)) + 0.01,
          `${persona.id} no inicia fuera del local`,
        );
      }
      posicionesPorId.set(persona.id, persona.posicion);
    }
  }

  const adelantado = obtenerFrameDesdeEventos(recorrido, 3.2);
  const retrocedido = obtenerFrameDesdeEventos(recorrido, 0.25);
  assert.deepEqual(
    obtenerFrameDesdeEventos(recorrido, 3.2),
    adelantado,
  );
  assert.deepEqual(
    obtenerFrameDesdeEventos(recorrido, 0.25),
    retrocedido,
  );
  assert.deepEqual(
    obtenerFrameDesdeEventos(recorrido, 3.2),
    adelantado,
    "volver atrás no debe alterar un instante consultado previamente",
  );
});

test("una fila de 61 personas usa la extensión sin superponerlas", () => {
  const eventos = [];
  const ids = [];
  for (let indice = 0; indice < 61; indice += 1) {
    const id = `G${indice + 1}`;
    ids.push(id);
    eventos.push({
      tipo: "llegada",
      tiempo: indice * 2,
      paciente_id: id,
      paciente_tipo: "General",
      estado: {
        filas: { General: [...ids], Preferencial: [] },
        ventanillas: [{ id: 1, ocupada: false, paciente: null }],
      },
    });
  }
  const frame = crearControlPersonas().cargar(eventos);
  const final = crearControlPersonas();
  final.cargar(eventos);
  const personas = final.actualizar(121);
  assert.equal(personas.personas.length, 61);
  const posiciones = personas.personas.map(({ posicion }) => posicion);
  assert.equal(new Set(posiciones.map((posicion) => posicion.join(","))).size, 61);
  assert.ok(posiciones.every(([x, , z]) => x >= -9 && x <= 9 && z >= -6 && z <= 6));
  assert.equal(frame.personas.length, 1);
});

test("reiniciar devuelve el estado de personas al inicio", () => {
  const control = crearControlPersonas();
  const estadoInicial = control.obtenerEstado();
  control.cargar(crearEventosPrueba());
  control.actualizar(3.2);

  assert.deepEqual(control.reiniciar(), estadoInicial);
  assert.equal(control.obtenerCantidad(), 0);
});
