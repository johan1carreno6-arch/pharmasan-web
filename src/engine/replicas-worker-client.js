import { ReplicasCanceladasError } from "./replicas.js";

export function crearClienteReplicasWorker() {
  if (typeof Worker !== "function") {
    throw new Error("Este navegador no permite ejecutar réplicas en Web Worker.");
  }
  const worker = new Worker(new URL("./replicas-worker.js", import.meta.url), {
    type: "module",
  });
  let siguienteId = 0;
  const pendientes = new Map();

  function rechazarPendientes(error) {
    for (const pendiente of pendientes.values()) {
      pendiente.rechazar(error);
    }
    pendientes.clear();
  }

  worker.addEventListener("message", ({ data }) => {
    const pendiente = pendientes.get(data?.id);
    if (!pendiente) return;
    if (data.tipo === "progreso") {
      pendiente.alProgreso?.(data.completadas, data.total, data.detalle);
      return;
    }
    pendientes.delete(data.id);
    if (data.tipo === "resultado") {
      pendiente.resolver(data.resultado);
    } else if (data.tipo === "cancelado") {
      pendiente.rechazar(new ReplicasCanceladasError());
    } else if (data.tipo === "error") {
      const error = new Error(data.mensaje);
      error.name = data.nombre || "Error";
      pendiente.rechazar(error);
    }
  });
  worker.addEventListener("error", (evento) => {
    rechazarPendientes(
      new Error(`El Web Worker falló: ${evento.message || "error desconocido"}.`),
    );
  });
  worker.addEventListener("messageerror", () => {
    rechazarPendientes(new Error("No se pudo leer la respuesta del Web Worker."));
  });

  return {
    ejecutar(trabajo, { alProgreso } = {}) {
      const id = ++siguienteId;
      let resolver;
      let rechazar;
      const resultado = new Promise((resolve, reject) => {
        resolver = resolve;
        rechazar = reject;
      });
      pendientes.set(id, { resolver, rechazar, alProgreso });
      worker.postMessage({ tipo: "ejecutar", id, trabajo });
      return {
        resultado,
        cancelar() {
          if (pendientes.has(id)) worker.postMessage({ tipo: "cancelar", id });
        },
      };
    },
    cerrar() {
      worker.terminate();
      rechazarPendientes(new Error("El Web Worker se cerró antes de completar la corrida."));
    },
  };
}
