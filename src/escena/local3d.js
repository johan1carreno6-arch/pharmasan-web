import * as THREE from "../../vendor/three/three.module.js";
import { OrbitControls } from "../../vendor/three/OrbitControls.js";
import { crearCamaraEscena } from "./camara.js";
import {
  crearTransformacionesPersona,
  establecerInstanciaPersona,
} from "./instancias-personas.js";
import { crearControlPersonas } from "./personas.js";

const PALETA = {
  piso: 0xe9e6de,
  pared: 0xf3f1ea,
  borde: 0xd5d0c4,
  madera: 0x806a56,
  maderaClara: 0xa4896d,
  maderaOscura: 0x55483b,
  verde: 0x27664b,
  verdeOscuro: 0x174b37,
  general: 0x397d65,
  preferencial: 0xc07b43,
  dorado: 0xd4ad63,
  blanco: 0xffffff,
  gris: 0x6a7772,
  libro1: 0x4a8292,
  libro2: 0xc7795c,
  libro3: 0xd5b45d,
  libro4: 0x78966d,
};

const GEOMETRIA_LOCAL = { ancho: 20, fondo: 14, x: 10, z: 7 };
export const CAPACIDAD_FILAS = 60;
export const UMBRAL_CALIDAD_REDUCIDA = 120;
export const FPS_OBJETIVO = 30;

export function requiereCalidadReducida(cantidadPersonas) {
  if (!Number.isInteger(cantidadPersonas) || cantidadPersonas < 0) {
    throw new RangeError("La cantidad de personas debe ser un entero no negativo.");
  }
  return cantidadPersonas >= UMBRAL_CALIDAD_REDUCIDA;
}

function crearGeometrias() {
  const caja = new Map();
  const estandar = new Map();

  function geometriaCaja(ancho, alto, fondo) {
    const clave = `${ancho}|${alto}|${fondo}`;
    if (!caja.has(clave)) {
      caja.set(clave, new THREE.BoxGeometry(ancho, alto, fondo));
    }
    return caja.get(clave);
  }

  function material(color, opciones = {}) {
    const clave = `${color}|${JSON.stringify(opciones)}`;
    if (!estandar.has(clave)) {
      estandar.set(
        clave,
        new THREE.MeshStandardMaterial({
          color,
          roughness: 0.78,
          metalness: 0.02,
          ...opciones,
        }),
      );
    }
    return estandar.get(clave);
  }

  return { geometriaCaja, material, caja, materiales: estandar };
}

function crearCartel(texto, opciones = {}) {
  const ancho = opciones.ancho ?? 768;
  const alto = opciones.alto ?? 192;
  const canvas = document.createElement("canvas");
  canvas.width = ancho;
  canvas.height = alto;
  const contexto = canvas.getContext("2d");
  if (!contexto) {
    throw new Error("No se pudo preparar el rótulo de la maqueta.");
  }

  contexto.fillStyle = opciones.fondo ?? "#174b37";
  contexto.fillRect(0, 0, ancho, alto);
  contexto.fillStyle = opciones.acento ?? "#d4ad63";
  contexto.fillRect(0, alto - 13, ancho, 13);
  contexto.fillStyle = "#ffffff";
  contexto.textAlign = "center";
  contexto.textBaseline = "middle";
  contexto.font = `700 ${opciones.tamano ?? 58}px system-ui, sans-serif`;
  contexto.fillText(texto, ancho / 2, alto / 2 - 5, ancho - 48);

  const textura = new THREE.CanvasTexture(canvas);
  textura.colorSpace = THREE.SRGBColorSpace;
  return textura;
}

function agregarCartel(escena, texto, posicion, dimensiones, opciones = {}) {
  const textura = crearCartel(texto, opciones);
  const geometria = new THREE.PlaneGeometry(...dimensiones);
  const material = new THREE.MeshBasicMaterial({
    map: textura,
    toneMapped: false,
  });
  const cartel = new THREE.Mesh(geometria, material);
  cartel.position.set(...posicion);
  if (opciones.rotacionX) {
    cartel.rotation.x = opciones.rotacionX;
  }
  escena.add(cartel);
  return cartel;
}

function agregarCaja(escena, geometriaCaja, material, dimensiones, posicion, rotacionY = 0) {
  const malla = new THREE.Mesh(
    geometriaCaja(...dimensiones),
    material,
  );
  malla.position.set(...posicion);
  malla.rotation.y = rotacionY;
  malla.castShadow = true;
  malla.receiveShadow = true;
  escena.add(malla);
  return malla;
}

function transformarInstancia(malla, indice, posicion, escala, rotacionY = 0) {
  const matriz = new THREE.Matrix4();
  const cuaternion = new THREE.Quaternion().setFromEuler(
    new THREE.Euler(0, rotacionY, 0),
  );
  matriz.compose(
    new THREE.Vector3(...posicion),
    cuaternion,
    new THREE.Vector3(...escala),
  );
  malla.setMatrixAt(indice, matriz);
}

function crearEstanteria(escena, recursos) {
  const { geometriaCaja, material } = recursos;
  const ancho = 12.6;
  const z = -5.75;
  const verde = material(PALETA.verdeOscuro);
  const madera = material(PALETA.madera);
  const cajas = new Map([
    [PALETA.libro1, []],
    [PALETA.libro2, []],
    [PALETA.libro3, []],
    [PALETA.libro4, []],
  ]);

  agregarCaja(escena, geometriaCaja, verde, [ancho, 0.12, 0.15], [0, 0.68, z]);
  agregarCaja(escena, geometriaCaja, verde, [ancho, 0.12, 0.15], [0, 1.53, z]);
  agregarCaja(escena, geometriaCaja, verde, [ancho, 0.12, 0.15], [0, 2.38, z]);
  agregarCaja(escena, geometriaCaja, verde, [ancho, 0.12, 0.15], [0, 3.23, z]);

  for (const x of [-6.25, -2.1, 2.1, 6.25]) {
    agregarCaja(
      escena,
      geometriaCaja,
      madera,
      [0.12, 2.72, 0.22],
      [x, 1.96, z],
    );
  }

  for (let fila = 0; fila < 3; fila += 1) {
    const y = 0.98 + fila * 0.85;
    for (let columna = 0; columna < 20; columna += 1) {
      const x = -5.88 + columna * 0.61;
      const color = [PALETA.libro1, PALETA.libro2, PALETA.libro3, PALETA.libro4][
        (columna * 7 + fila * 3) % 4
      ];
      cajas.get(color).push([x, y, z + 0.22]);
    }
  }

  for (const [color, posiciones] of cajas) {
    const malla = new THREE.InstancedMesh(
      geometriaCaja(0.39, 0.52, 0.35),
      material(color, { roughness: 0.64 }),
      posiciones.length,
    );
    posiciones.forEach((posicion, indice) =>
      transformarInstancia(malla, indice, posicion, [1, 1, 1]),
    );
    malla.castShadow = true;
    escena.add(malla);
  }
}

function crearVentanillas(escena, recursos) {
  const { geometriaCaja, material } = recursos;
  const madera = material(PALETA.madera);
  const tablero = material(PALETA.maderaOscura);
  const centros = [-4.65, -0.5, 4.35];
  const rotulos = [
    { texto: "V1 · GENERAL", fondo: "#27664b" },
    { texto: "V2 · GENERAL", fondo: "#27664b" },
    { texto: "V3 · ADULTO MAYOR", fondo: "#a65f31", tamano: 48 },
  ];

  agregarCaja(
    escena,
    geometriaCaja,
    madera,
    [15, 1.06, 1.05],
    [0, 0.57, -1.72],
  );
  agregarCaja(
    escena,
    geometriaCaja,
    tablero,
    [15.25, 0.15, 1.25],
    [0, 1.15, -1.72],
  );

  for (let indice = 0; indice < centros.length; indice += 1) {
    const centro = centros[indice];
    agregarCaja(
      escena,
      geometriaCaja,
      material(indice === 2 ? PALETA.preferencial : PALETA.general),
      [3.45, 0.1, 0.08],
      [centro, 1.24, -1.05],
    );
    agregarCartel(
      escena,
      rotulos[indice].texto,
      [centro, 2.05, -1.11],
      [3.4, 0.76],
      { fondo: rotulos[indice].fondo, tamano: rotulos[indice].tamano },
    );
  }

  agregarCartel(
    escena,
    "ATENCIÓN PREFERENCIAL · ADULTO MAYOR",
    [5.4, 2.82, -4.95],
    [5.7, 0.82],
    { fondo: "#a65f31", tamano: 42, acento: "#f0d7b1" },
  );
}

function crearPostesYCintas(escena, recursos) {
  const { material } = recursos;
  const postes = [];
  const cintas = [];
  const zonas = [
    { x0: -7.05, x1: -0.35, z0: -0.12, z1: 5.85 },
    { x0: 0.4, x1: 7.1, z0: -0.12, z1: 5.85 },
  ];

  for (const zona of zonas) {
    const xs = [zona.x0, (zona.x0 + zona.x1) / 2, zona.x1];
    const zs = [zona.z0, (zona.z0 + zona.z1) / 2, zona.z1];
    for (const x of xs) {
      postes.push([x, 0, zona.z0], [x, 0, zona.z1]);
    }
    for (const z of zs) {
      postes.push([zona.x0, 0, z], [zona.x1, 0, z]);
    }

    cintas.push(
      [[zona.x0, 0.86, zona.z0], [zona.x1, 0.86, zona.z0]],
      [[zona.x0, 0.86, zona.z1], [zona.x1, 0.86, zona.z1]],
      [[zona.x0, 0.86, zona.z0], [zona.x0, 0.86, zona.z1]],
      [[zona.x1, 0.86, zona.z0], [zona.x1, 0.86, zona.z1]],
    );
  }

  const base = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(0.18, 0.2, 0.12, 16),
    material(0xa6a59f, { metalness: 0.42, roughness: 0.38 }),
    postes.length,
  );
  const tubo = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(0.047, 0.055, 0.86, 12),
    material(PALETA.maderaOscura, { metalness: 0.22, roughness: 0.42 }),
    postes.length,
  );

  postes.forEach((posicion, indice) => {
    transformarInstancia(base, indice, [posicion[0], 0.07, posicion[2]], [1, 1, 1]);
    transformarInstancia(tubo, indice, [posicion[0], 0.53, posicion[2]], [1, 1, 1]);
  });
  base.castShadow = true;
  tubo.castShadow = true;
  escena.add(base, tubo);

  const cintasMalla = new THREE.InstancedMesh(
    new THREE.BoxGeometry(1, 1, 1),
    material(PALETA.verde, { roughness: 0.55 }),
    cintas.length,
  );
  cintas.forEach(([inicio, fin], indice) => {
    const dx = fin[0] - inicio[0];
    const dz = fin[2] - inicio[2];
    const longitud = Math.hypot(dx, dz);
    const angulo = Math.atan2(-dz, dx);
    transformarInstancia(
      cintasMalla,
      indice,
      [(inicio[0] + fin[0]) / 2, inicio[1], (inicio[2] + fin[2]) / 2],
      [longitud, 0.045, 0.045],
      angulo,
    );
  });
  escena.add(cintasMalla);

  const espaciosPorZona = [];
  const columnasPorFila = 5;
  const filasPorZona = CAPACIDAD_FILAS / (zonas.length * columnasPorFila);
  for (const zona of zonas) {
    const espacios = [];
    for (let fila = 0; fila < filasPorZona; fila += 1) {
      for (let columna = 0; columna < columnasPorFila; columna += 1) {
        espacios.push([
          zona.x0 + 0.72 + columna * 1.31,
          0.035,
          zona.z0 + 0.55 + fila * 0.98,
        ]);
      }
    }
    espaciosPorZona.push(espacios);
  }
  const geometriaMarca = new THREE.CylinderGeometry(0.105, 0.105, 0.025, 16);
  espaciosPorZona.forEach((espacios, indiceZona) => {
    const marcas = new THREE.InstancedMesh(
      geometriaMarca,
      material(
        indiceZona === 0 ? PALETA.general : PALETA.preferencial,
        { roughness: 0.88 },
      ),
      espacios.length,
    );
    espacios.forEach((posicion, indice) =>
      transformarInstancia(marcas, indice, posicion, [1, 1, 1]),
    );
    escena.add(marcas);
  });

  agregarCartel(
    escena,
    "GENERAL · 30 ESPACIOS",
    [-3.7, 0.025, 0.35],
    [4.8, 0.62],
    { rotacionX: -Math.PI / 2, fondo: "#27664b", tamano: 50 },
  );
  agregarCartel(
    escena,
    "PREFERENCIAL · 30 ESPACIOS",
    [3.75, 0.025, 0.35],
    [5.2, 0.62],
    { rotacionX: -Math.PI / 2, fondo: "#a65f31", tamano: 48 },
  );

  return espaciosPorZona.flat().length;
}

function crearSillasInstanciadas(escena, recursos) {
  const { geometriaCaja, material } = recursos;
  const sillas = [];
  for (let indice = 0; indice < 6; indice += 1) {
    sillas.push([-9.05, 0.45, -1.2 + indice * 1.35]);
    sillas.push([9.05, 0.45, -1.2 + indice * 1.35]);
  }

  const componentes = [
    {
      geometria: geometriaCaja(0.68, 0.13, 0.62),
      material: material(PALETA.verdeOscuro),
      posicion: (silla) => [silla[0], silla[1], silla[2]],
      escala: [1, 1, 1],
    },
    {
      geometria: geometriaCaja(0.68, 0.67, 0.12),
      material: material(PALETA.maderaClara),
      posicion: (silla) => [silla[0], silla[1] + 0.4, silla[2] + 0.26],
      escala: [1, 1, 1],
    },
    {
      geometria: geometriaCaja(0.09, 0.42, 0.09),
      material: material(PALETA.maderaOscura),
      posicion: (silla) => [silla[0] - 0.25, silla[1] - 0.23, silla[2] - 0.22],
      escala: [1, 1, 1],
    },
    {
      geometria: geometriaCaja(0.09, 0.42, 0.09),
      material: material(PALETA.maderaOscura),
      posicion: (silla) => [silla[0] + 0.25, silla[1] - 0.23, silla[2] - 0.22],
      escala: [1, 1, 1],
    },
    {
      geometria: geometriaCaja(0.09, 0.42, 0.09),
      material: material(PALETA.maderaOscura),
      posicion: (silla) => [silla[0] - 0.25, silla[1] - 0.23, silla[2] + 0.22],
      escala: [1, 1, 1],
    },
    {
      geometria: geometriaCaja(0.09, 0.42, 0.09),
      material: material(PALETA.maderaOscura),
      posicion: (silla) => [silla[0] + 0.25, silla[1] - 0.23, silla[2] + 0.22],
      escala: [1, 1, 1],
    },
  ];

  for (const componente of componentes) {
    const instancias = new THREE.InstancedMesh(
      componente.geometria,
      componente.material,
      sillas.length,
    );
    sillas.forEach((silla, indice) =>
      transformarInstancia(
        instancias,
        indice,
        componente.posicion(silla),
        componente.escala,
      ),
    );
    instancias.castShadow = true;
    instancias.receiveShadow = true;
    escena.add(instancias);
  }
  return sillas.length;
}

function crearLocal(escena, recursos) {
  const { geometriaCaja, material } = recursos;
  const piso = material(PALETA.piso, { roughness: 0.94 });
  const paredes = material(PALETA.pared);
  const borde = material(PALETA.borde);
  const madera = material(PALETA.madera);

  agregarCaja(
    escena,
    geometriaCaja,
    piso,
    [GEOMETRIA_LOCAL.ancho, 0.3, GEOMETRIA_LOCAL.fondo],
    [0, -0.2, 0],
  );
  agregarCaja(
    escena,
    geometriaCaja,
    borde,
    [GEOMETRIA_LOCAL.ancho + 0.5, 0.16, GEOMETRIA_LOCAL.fondo + 0.5],
    [0, -0.39, 0],
  );

  agregarCaja(escena, geometriaCaja, paredes, [0.28, 1.65, 14], [-9.86, 0.72, 0]);
  agregarCaja(escena, geometriaCaja, paredes, [0.28, 1.65, 14], [9.86, 0.72, 0]);
  agregarCaja(escena, geometriaCaja, paredes, [20, 1.65, 0.28], [0, 0.72, -6.86]);
  agregarCaja(escena, geometriaCaja, paredes, [0.9, 0.8, 0.28], [-9.55, 0.3, 6.86]);
  agregarCaja(escena, geometriaCaja, paredes, [17, 0.8, 0.28], [1.5, 0.3, 6.86]);
  agregarCaja(escena, geometriaCaja, madera, [0.12, 0.13, 14], [-9.65, 1.58, 0]);
  agregarCaja(escena, geometriaCaja, madera, [0.12, 0.13, 14], [9.65, 1.58, 0]);

  agregarCaja(escena, geometriaCaja, borde, [2.1, 0.16, 0.28], [-8.05, 2.68, 6.86]);
  agregarCaja(escena, geometriaCaja, material(PALETA.maderaClara), [0.14, 2.65, 0.2], [-9.05, 1.32, 6.52]);
  agregarCaja(escena, geometriaCaja, material(PALETA.maderaClara), [0.14, 2.65, 0.2], [-7.05, 1.32, 6.52]);
  const puerta = new THREE.Group();
  puerta.position.set(-9.05, 0, 6.52);
  puerta.rotation.y = Math.PI / 2;
  const hojaPuerta = new THREE.Mesh(
    geometriaCaja(2, 2.55, 0.12),
    borde,
  );
  hojaPuerta.position.set(1, 1.28, 0);
  hojaPuerta.castShadow = true;
  hojaPuerta.receiveShadow = true;
  puerta.add(hojaPuerta);
  const manija = new THREE.Mesh(
    geometriaCaja(0.055, 0.23, 0.055),
    material(PALETA.dorado, { metalness: 0.5, roughness: 0.35 }),
  );
  manija.position.set(0.82, 1.35, -0.095);
  puerta.add(manija);
  escena.add(puerta);
  agregarCartel(
    escena,
    "ENTRADA",
    [-8.05, 3.05, 6.55],
    [1.75, 0.52],
    { fondo: "#55483b", tamano: 54 },
  );

  agregarCartel(
    escena,
    "Droguería Pharmasan",
    [0, 4.15, -6.62],
    [8.6, 1.22],
    { tamano: 66 },
  );

  const grid = new THREE.GridHelper(19.8, 22, 0xd6d2c9, 0xdedbd4);
  grid.position.y = -0.045;
  grid.material.transparent = true;
  grid.material.opacity = 0.23;
  escena.add(grid);

  crearEstanteria(escena, recursos);
  crearVentanillas(escena, recursos);

  agregarCartel(
    escena,
    "ACCESO A SALA DE ESPERA",
    [-3.55, 0.025, 6.1],
    [4.8, 0.48],
    { rotacionX: -Math.PI / 2, fondo: "#777c77", tamano: 44 },
  );
}

function crearFondo(escena) {
  escena.background = null;
  escena.fog = new THREE.Fog(0xdce9e7, 38, 78);

  const sueloExterior = new THREE.Mesh(
    new THREE.PlaneGeometry(200, 200),
    new THREE.MeshStandardMaterial({
      color: 0xd8e3df,
      roughness: 1,
      metalness: 0,
    }),
  );
  sueloExterior.rotation.x = -Math.PI / 2;
  sueloExterior.position.y = -0.52;
  sueloExterior.receiveShadow = true;
  escena.add(sueloExterior);

  const luzAmbiente = new THREE.HemisphereLight(0xf6f7f3, 0x8e9b91, 2.15);
  escena.add(luzAmbiente);
  const luzSol = new THREE.DirectionalLight(0xfff4df, 3.1);
  luzSol.position.set(-11, 19, 13);
  luzSol.castShadow = true;
  luzSol.shadow.mapSize.set(2048, 2048);
  luzSol.shadow.camera.left = -17;
  luzSol.shadow.camera.right = 17;
  luzSol.shadow.camera.top = 17;
  luzSol.shadow.camera.bottom = -17;
  luzSol.shadow.normalBias = 0.035;
  luzSol.shadow.radius = 5;
  escena.add(luzSol);
}

function colorGrupo(tipo) {
  return tipo === "Preferencial" ? PALETA.preferencial : PALETA.general;
}

function colorEspera(color) {
  return { verde: 0x55a86a, amarillo: 0xe7b83f, rojo: 0xd9534f }[color];
}

export function crearLocal3D(contenedor) {
  if (!contenedor) {
    throw new TypeError("Se requiere el contenedor de la maqueta 3D.");
  }

  const mediaMovil = window.matchMedia("(max-width: 767px)");
  const diagnosticosActivados = new URLSearchParams(
    window.location.search,
  ).has("depurar-personas");
  const renderer = new THREE.WebGLRenderer({
    alpha: true,
    antialias: false,
    powerPreference: "high-performance",
    preserveDrawingBuffer: diagnosticosActivados,
  });
  renderer.setPixelRatio(
    Math.min(window.devicePixelRatio || 1, mediaMovil.matches ? 0.7 : 1.25),
  );
  renderer.shadowMap.enabled = !mediaMovil.matches;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;
  renderer.domElement.setAttribute(
    "aria-label",
    "Maqueta tridimensional esquemática de Droguería Pharmasan",
  );
  const etiquetas = document.createElement("canvas");
  etiquetas.className = "etiquetas-personas";
  etiquetas.setAttribute("aria-hidden", "true");
  contenedor.replaceChildren(renderer.domElement, etiquetas);
  const contextoEtiquetas = etiquetas.getContext("2d");
  if (!contextoEtiquetas) {
    renderer.dispose();
    throw new Error("No se pudieron preparar las etiquetas de pacientes.");
  }

  const escena = new THREE.Scene();
  const recursos = crearGeometrias();
  crearFondo(escena);
  crearLocal(escena, recursos);
  const espaciosFila = crearPostesYCintas(escena, recursos);
  const sillas = crearSillasInstanciadas(escena, recursos);
  const camara = crearCamaraEscena(THREE, contenedor, renderer);

  let ultimaActualizacion = 0;
  let comienzoMedicionFps = 0;
  let cuadrosMedidos = 0;
  let fpsMedidos = 0;
  let calidadReducida = mediaMovil.matches;
  let cantidadPersonas = 0;
  const controlPersonas = crearControlPersonas();
  let frameActual = controlPersonas.obtenerEstado();
  let mallasPersonas = [];
  let idsPersonas = [];
  const vectorProyeccion = new THREE.Vector3();
  const objetoTemporal = new THREE.Object3D();
  const coloresInstancia = new Map();
  let indicesPorId = new Map();
  let coloresPorMalla = [];
  let personasVisiblesAnteriores = new Set();
  function colorInstancia(valor) {
    if (!coloresInstancia.has(valor)) {
      coloresInstancia.set(valor, new THREE.Color(valor));
    }
    return coloresInstancia.get(valor);
  }
  function establecerTransformacion(
    malla,
    indice,
    posicion,
    altura,
    anillo = false,
    offsetX = 0,
  ) {
    objetoTemporal.position.set(
      posicion[0] + offsetX,
      altura,
      posicion[2],
    );
    objetoTemporal.rotation.set(anillo ? -Math.PI / 2 : 0, 0, 0);
    objetoTemporal.scale.setScalar(1);
    objetoTemporal.updateMatrix();
    malla.setMatrixAt(indice, objetoTemporal.matrix);
  }
  const materialesIndicadores = {
    libre: recursos.material(0x84a78b, { emissive: 0x18351f }),
    ocupado: recursos.material(0xe4a63b, { emissive: 0x60300d }),
    progreso: recursos.material(0x52a879, { emissive: 0x1b452b }),
  };
  const posicionesIndicadores = [-4.65, -0.5, 4.35, -6.5, -2.6, 1.3, 5.2, 7];
  const indicadores = posicionesIndicadores.map((x, indice) => {
    const luz = new THREE.Mesh(
      recursos.geometriaCaja(0.26, 0.18, 0.08),
      materialesIndicadores.libre,
    );
    luz.position.set(x, 1.57, -1.02);
    const fondoBarra = new THREE.Mesh(
      recursos.geometriaCaja(1.7, 0.09, 0.06),
      recursos.material(0x7d8179),
    );
    fondoBarra.position.set(x, 1.38, -1.02);
    const barra = new THREE.Mesh(
      recursos.geometriaCaja(1.62, 0.055, 0.035),
      materialesIndicadores.progreso,
    );
    barra.position.set(x - 0.81, 1.38, -0.97);
    barra.scale.x = 0;
    barra.visible = false;
    const fondoVisible = indice < 3;
    luz.visible = fondoVisible;
    fondoBarra.visible = fondoVisible;
    escena.add(luz, fondoBarra, barra);
    return { luz, fondoBarra, barra, x };
  });
  function obtenerPosicionVisual(persona) {
    const indiceVentanilla = Number(
      String(persona?.ventanilla ?? "").replace(/\D/g, ""),
    ) - 1;
    const indicadorVentanilla = indicadores[indiceVentanilla];
    return persona?.estado === "servicio" && indicadorVentanilla
      ? [indicadorVentanilla.x, 0, -0.75]
      : persona?.posicion ?? [0, -100, 0];
  }

  function configurarIndicadores(cantidad) {
    const cantidadSegura = Math.max(1, Math.min(8, cantidad));
    const posiciones =
      cantidadSegura === 3
        ? posicionesIndicadores.slice(0, 3)
        : Array.from({ length: cantidadSegura }, (_, indice) =>
            cantidadSegura === 1
              ? 0
              : -6.5 + (13 * indice) / (cantidadSegura - 1),
          );
    for (const [indice, indicador] of indicadores.entries()) {
      const visible = indice < cantidadSegura;
      const x = posiciones[indice] ?? indicador.x;
      indicador.x = x;
      indicador.luz.position.x = x;
      indicador.fondoBarra.position.x = x;
      indicador.barra.position.x = x - 0.81;
      indicador.luz.visible = visible;
      indicador.fondoBarra.visible = visible;
      if (!visible) indicador.barra.visible = false;
    }
  }
  contenedor.dataset.calidad = calidadReducida ? "reducida" : "completa";

  function liberarPersonas() {
    for (const malla of mallasPersonas) {
      escena.remove(malla);
      malla.geometry.dispose();
      malla.material.dispose();
    }
    mallasPersonas = [];
    idsPersonas = [];
    indicesPorId.clear();
    coloresPorMalla = [];
    personasVisiblesAnteriores.clear();
    frameActual = controlPersonas.reiniciar();
    contextoEtiquetas.clearRect(0, 0, etiquetas.width, etiquetas.height);
    for (const indicador of indicadores) {
      indicador.luz.material = materialesIndicadores.libre;
      indicador.barra.scale.x = 0;
      indicador.barra.visible = false;
    }
    configurarIndicadores(3);
  }

  function crearPersonas(eventos) {
    idsPersonas = [...new Set(eventos.map((evento) => evento.paciente_id))];
    indicesPorId = new Map(idsPersonas.map((id, indice) => [id, indice]));
    personasVisiblesAnteriores.clear();
    const capacidad = Math.max(1, idsPersonas.length, cantidadPersonas);
    if (idsPersonas.length === 0 && capacidad === 1) {
      return;
    }
    const materialCuerpo = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.86,
    });
    const materialCabeza = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.9,
    });
    const materialPiernas = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.9,
    });
    const materialAnillos = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      side: THREE.DoubleSide,
    });
    const componentes = [
      new THREE.InstancedMesh(
        new THREE.CylinderGeometry(0.22, 0.3, 0.78, 6),
        materialCuerpo,
        capacidad,
      ),
      new THREE.InstancedMesh(
        new THREE.IcosahedronGeometry(0.22, 0),
        materialCabeza,
        capacidad,
      ),
      new THREE.InstancedMesh(
        new THREE.BoxGeometry(0.16, 0.42, 0.18),
        materialPiernas,
        capacidad * 2,
      ),
      new THREE.InstancedMesh(
        new THREE.RingGeometry(0.29, 0.37, 16),
        materialAnillos,
        capacidad,
      ),
    ];
    for (const malla of componentes) {
      malla.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      malla.castShadow = false;
      malla.frustumCulled = false;
      const limite = malla === componentes[2] ? capacidad * 2 : capacidad;
      for (let indice = 0; indice < limite; indice += 1) {
        objetoTemporal.position.set(0, -100, 0);
        objetoTemporal.scale.setScalar(1);
        objetoTemporal.updateMatrix();
        malla.setMatrixAt(indice, objetoTemporal.matrix);
      }
      malla.instanceMatrix.needsUpdate = true;
      escena.add(malla);
      mallasPersonas.push(malla);
    }
    coloresPorMalla = componentes.map(() => []);
  }

  function dibujarEtiquetas(personas) {
    const escala = renderer.getPixelRatio();
    const ancho = Math.max(1, contenedor.clientWidth);
    const alto = Math.max(1, contenedor.clientHeight);
    if (etiquetas.width !== Math.round(ancho * escala)) {
      etiquetas.width = Math.round(ancho * escala);
    }
    if (etiquetas.height !== Math.round(alto * escala)) {
      etiquetas.height = Math.round(alto * escala);
    }
    contextoEtiquetas.setTransform(escala, 0, 0, escala, 0, 0);
    contextoEtiquetas.clearRect(0, 0, ancho, alto);
    contextoEtiquetas.font = "700 11px system-ui, sans-serif";
    contextoEtiquetas.textAlign = "center";
    contextoEtiquetas.textBaseline = "middle";
    for (const persona of personas) {
      const posicion = obtenerPosicionVisual(persona);
      vectorProyeccion
        .set(posicion[0], posicion[1] + 2.45, posicion[2])
        .project(camara.camara);
      const x = ((vectorProyeccion.x + 1) * ancho) / 2;
      const y = ((1 - vectorProyeccion.y) * alto) / 2;
      if (vectorProyeccion.z < -1 || vectorProyeccion.z > 1) {
        continue;
      }
      const texto = String(persona.id);
      const anchoEtiqueta = contextoEtiquetas.measureText(texto).width + 10;
      contextoEtiquetas.fillStyle =
        persona.tipo === "Preferencial" ? "#8f4e2a" : "#205c45";
      contextoEtiquetas.beginPath();
      contextoEtiquetas.roundRect(x - anchoEtiqueta / 2, y - 9, anchoEtiqueta, 18, 5);
      contextoEtiquetas.fill();
      contextoEtiquetas.fillStyle = "#fff";
      contextoEtiquetas.fillText(texto, x, y, anchoEtiqueta - 4);
    }
  }

  function actualizarPersonas(tiempo) {
    frameActual = controlPersonas.actualizar(tiempo);
    const personasVisibles = new Set();
    const matricesActualizadas = new Set();
    const coloresActualizados = new Set();
    for (const persona of frameActual.personas) {
      const indice = indicesPorId.get(persona.id);
      if (indice === undefined) {
        continue;
      }
      personasVisibles.add(persona.id);
      const posicion = obtenerPosicionVisual(persona);
      const transformaciones = crearTransformacionesPersona(posicion);
      const cuerpoActualizado = establecerInstanciaPersona(
        objetoTemporal,
        mallasPersonas[0],
        indice,
        transformaciones.cuerpo,
        colorGrupo(persona.tipo),
        coloresPorMalla[0],
        colorInstancia,
      );
      matricesActualizadas.add(0);
      if (cuerpoActualizado) coloresActualizados.add(0);
      const cabezaActualizada = establecerInstanciaPersona(
        objetoTemporal,
        mallasPersonas[1],
        indice,
        transformaciones.cabeza,
        0xe5bd96,
        coloresPorMalla[1],
        colorInstancia,
      );
      matricesActualizadas.add(1);
      if (cabezaActualizada) coloresActualizados.add(1);
      const piernaIzquierdaActualizada = establecerInstanciaPersona(
        objetoTemporal,
        mallasPersonas[2],
        indice * 2,
        transformaciones.piernas[0],
        0x34433d,
        coloresPorMalla[2],
        colorInstancia,
      );
      const piernaDerechaActualizada = establecerInstanciaPersona(
        objetoTemporal,
        mallasPersonas[2],
        indice * 2 + 1,
        transformaciones.piernas[1],
        0x34433d,
        coloresPorMalla[2],
        colorInstancia,
      );
      matricesActualizadas.add(2);
      if (piernaIzquierdaActualizada || piernaDerechaActualizada) {
        coloresActualizados.add(2);
      }
      const anilloActualizado = establecerInstanciaPersona(
        objetoTemporal,
        mallasPersonas[3],
        indice,
        transformaciones.anillo,
        colorEspera(persona.colorEspera ?? "verde"),
        coloresPorMalla[3],
        colorInstancia,
      );
      matricesActualizadas.add(3);
      if (anilloActualizado) coloresActualizados.add(3);
    }
    for (const id of personasVisiblesAnteriores) {
      if (personasVisibles.has(id)) {
        continue;
      }
      const indice = indicesPorId.get(id);
      if (indice === undefined) {
        continue;
      }
      establecerTransformacion(mallasPersonas[0], indice, [0, 0, 0], -100);
      establecerTransformacion(mallasPersonas[1], indice, [0, 0, 0], -100);
      establecerTransformacion(mallasPersonas[2], indice * 2, [0, 0, 0], -100);
      establecerTransformacion(mallasPersonas[2], indice * 2 + 1, [0, 0, 0], -100);
      establecerTransformacion(mallasPersonas[3], indice, [0, 0, 0], -100, true);
      for (let malla = 0; malla < mallasPersonas.length; malla += 1) {
        matricesActualizadas.add(malla);
      }
    }
    personasVisiblesAnteriores = personasVisibles;
    for (const indice of matricesActualizadas) {
      mallasPersonas[indice].instanceMatrix.needsUpdate = true;
    }
    for (const indice of coloresActualizados) {
      mallasPersonas[indice].instanceColor.needsUpdate = true;
    }
    for (const ventanilla of frameActual.ventanillas) {
      const indice = Number(String(ventanilla.id).replace(/\D/g, "")) - 1;
      const indicador = indicadores[indice];
      if (!indicador) {
        continue;
      }
      indicador.luz.material = ventanilla.ocupada
        ? materialesIndicadores.ocupado
        : materialesIndicadores.libre;
      indicador.barra.visible = Boolean(ventanilla.ocupada);
      const progreso = Math.max(0, Math.min(1, ventanilla.progreso ?? 0));
      indicador.barra.scale.x = progreso;
      indicador.barra.position.x = indicador.x - 0.81 + 0.81 * progreso;
    }
  }

  function obtenerDiagnosticoPersonas() {
    const nombresMallas = ["cuerpo", "cabeza", "piernas", "anillo"];
    const instancias = frameActual.personas.map((persona) => {
      const indice = indicesPorId.get(persona.id);
      const posicion = obtenerPosicionVisual(persona);
      const vectorEtiqueta = new THREE.Vector3(
        posicion[0],
        posicion[1] + 2.45,
        posicion[2],
      ).project(camara.camara);
      const vectorCuerpo = new THREE.Vector3(
        posicion[0],
        posicion[1] + 0.98,
        posicion[2],
      ).project(camara.camara);
      const ancho = Math.max(1, contenedor.clientWidth);
      const alto = Math.max(1, contenedor.clientHeight);

      return {
        id: persona.id,
        tipo: persona.tipo,
        estado: persona.estado,
        ventanilla: persona.ventanilla,
        posicionOriginal: persona.posicion,
        indice,
        posicion,
        posicionEtiqueta: [posicion[0], posicion[1] + 2.45, posicion[2]],
        centroCuerpo: {
          x: ((vectorCuerpo.x + 1) * ancho) / 2,
          y: ((1 - vectorCuerpo.y) * alto) / 2,
        },
        etiqueta: {
          x: ((vectorEtiqueta.x + 1) * ancho) / 2,
          y: ((1 - vectorEtiqueta.y) * alto) / 2,
        },
        mallas: nombresMallas.map((nombre, indiceMalla) => {
          const malla = mallasPersonas[indiceMalla];
          const indicesInstancia =
            indiceMalla === 2 ? [indice * 2, indice * 2 + 1] : [indice];
          const transformaciones = indicesInstancia.map((indiceInstancia) => {
            const matriz = new THREE.Matrix4();
            const posicionDescompuesta = new THREE.Vector3();
            const escala = new THREE.Vector3();
            if (malla) {
              malla.getMatrixAt(indiceInstancia, matriz);
              matriz.decompose(
                posicionDescompuesta,
                new THREE.Quaternion(),
                escala,
              );
            }
            return {
              indice: indiceInstancia,
              posicion: posicionDescompuesta.toArray(),
              escala: escala.toArray(),
              color: malla?.instanceColor
                ? Array.from(
                    malla.instanceColor.array.slice(
                      indiceInstancia * 3,
                      indiceInstancia * 3 + 3,
                    ),
                  )
                : null,
            };
          });
          return {
            nombre,
            count: malla?.count ?? 0,
            visible: malla?.visible ?? false,
            frustumCulled: malla?.frustumCulled ?? null,
            boundingSphere: malla?.boundingSphere
              ? {
                  center: malla.boundingSphere.center.toArray(),
                  radius: malla.boundingSphere.radius,
                }
              : null,
            instanceMatrixVersion: malla?.instanceMatrix.version ?? null,
            instanceColorVersion: malla?.instanceColor?.version ?? null,
            instanceColorExiste: Boolean(malla?.instanceColor),
            material: malla
              ? {
                  transparent: malla.material.transparent,
                  opacity: malla.material.opacity,
                  depthWrite: malla.material.depthWrite,
                  depthTest: malla.material.depthTest,
                  renderOrder: malla.renderOrder,
                }
              : null,
            instancias: transformaciones,
          };
        }),
      };
    });

    return {
      renderer: renderer.getContext().getExtension("WEBGL_debug_renderer_info")
        ? renderer
            .getContext()
            .getParameter(
              renderer
                .getContext()
                .getExtension("WEBGL_debug_renderer_info")
                .UNMASKED_RENDERER_WEBGL,
            )
        : "No disponible",
      render: { ...renderer.info.render },
      personasVisibles: frameActual.personas.length,
      cantidadIds: idsPersonas.length,
      mallas: nombresMallas.map((nombre, indice) => ({
        nombre,
        count: mallasPersonas[indice]?.count ?? 0,
        visible: mallasPersonas[indice]?.visible ?? false,
        frustumCulled: mallasPersonas[indice]?.frustumCulled ?? null,
        boundingSphere: mallasPersonas[indice]?.boundingSphere
          ? {
              center: mallasPersonas[indice].boundingSphere.center.toArray(),
              radius: mallasPersonas[indice].boundingSphere.radius,
            }
          : null,
        instanceMatrixVersion:
          mallasPersonas[indice]?.instanceMatrix.version ?? null,
        instanceColorVersion:
          mallasPersonas[indice]?.instanceColor?.version ?? null,
        instanceColorExiste: Boolean(mallasPersonas[indice]?.instanceColor),
        material: mallasPersonas[indice]
          ? {
              transparent: mallasPersonas[indice].material.transparent,
              opacity: mallasPersonas[indice].material.opacity,
              depthWrite: mallasPersonas[indice].material.depthWrite,
              depthTest: mallasPersonas[indice].material.depthTest,
              renderOrder: mallasPersonas[indice].renderOrder,
            }
          : null,
      })),
      instancias,
    };
  }

  function cargarEventos(eventos) {
    liberarPersonas();
    const cantidadVentanillas = Math.max(
      0,
      ...eventos.map((evento) => evento.estado?.ventanillas?.length ?? 0),
    );
    configurarIndicadores(cantidadVentanillas || 3);
    frameActual = controlPersonas.cargar(eventos);
    crearPersonas(eventos);
  }

  function actualizarTiempo(tiempo) {
    actualizarPersonas(tiempo);
  }

  function reiniciarAnimacion() {
    liberarPersonas();
    actualizarCalidad(0);
  }

  function actualizarCalidad(cantidad) {
    const reducida =
      mediaMovil.matches || requiereCalidadReducida(cantidad);
    cantidadPersonas = cantidad;
    const cambioCalidad = reducida !== calidadReducida;
    if (!cambioCalidad) {
      return;
    }
    calidadReducida = reducida;
    renderer.setPixelRatio(
      Math.min(
        window.devicePixelRatio || 1,
      mediaMovil.matches ? 0.7 : calidadReducida ? 0.5 : 1.25,
      ),
    );
    renderer.shadowMap.enabled = !calidadReducida;
    renderer.shadowMap.needsUpdate = true;
    for (const malla of mallasPersonas) {
      malla.castShadow = false;
    }
    camara.redimensionar();
    contenedor.dataset.calidad = calidadReducida
      ? "reducida"
      : "completa";
    contenedor.dispatchEvent(
      new CustomEvent("calidadescena", {
        detail: { reducida: calidadReducida, cantidadPersonas },
      }),
    );
  }

  function animar(tiempo) {
    if (tiempo - ultimaActualizacion >= 1000 / FPS_OBJETIVO) {
      camara.controles.update();
      dibujarEtiquetas(frameActual.personas);
      renderer.render(escena, camara.camara);
      ultimaActualizacion = tiempo;
      cuadrosMedidos += 1;
      if (comienzoMedicionFps === 0) {
        comienzoMedicionFps = tiempo;
      } else if (tiempo - comienzoMedicionFps >= 1000) {
        fpsMedidos = (cuadrosMedidos * 1000) / (tiempo - comienzoMedicionFps);
        comienzoMedicionFps = tiempo;
        cuadrosMedidos = 0;
        contenedor.dispatchEvent(
          new CustomEvent("rendimientoescena", {
            detail: {
              fps: Math.round(fpsMedidos),
              cantidadPersonas,
              personasVisibles: frameActual.personas.length,
              geometriasRenderer: renderer.info.memory.geometries,
              texturasRenderer: renderer.info.memory.textures,
            },
          }),
        );
      }
    }
  }

  const observador = new ResizeObserver(camara.redimensionar);
  const alCambiarDispositivo = () => actualizarCalidad(cantidadPersonas);
  mediaMovil.addEventListener("change", alCambiarDispositivo);
  observador.observe(contenedor);
  camara.redimensionar();
  renderer.setAnimationLoop(animar);
  if (diagnosticosActivados) {
    Object.defineProperty(contenedor, "__diagnosticoPersonas", {
      value: Object.assign(obtenerDiagnosticoPersonas, {
        establecerRecortePersonas(activar) {
          for (const malla of mallasPersonas) {
            malla.frustumCulled = activar;
          }
          renderer.render(escena, camara.camara);
        },
      }),
      configurable: true,
    });
  }

  return {
    establecerVista: camara.establecerVista,
    vistas: camara.vistas,
    actualizarCalidad,
    cargarEventos,
    actualizarTiempo,
    reiniciarAnimacion,
    obtenerEstado: () => ({
      calidadReducida,
      cantidadPersonas,
      espaciosFila,
      sillas: sillas,
      fpsObjetivo: FPS_OBJETIVO,
      fpsMedidos,
      personasVisibles: frameActual.personas.length,
      tiempo: frameActual.tiempo ?? 0,
    }),
    dispose() {
      renderer.setAnimationLoop(null);
      observador.disconnect();
      mediaMovil.removeEventListener("change", alCambiarDispositivo);
      camara.controles.dispose();
      liberarPersonas();
      escena.traverse((objeto) => {
        if (objeto.isMesh || objeto.isInstancedMesh) {
          objeto.geometry?.dispose();
          const materiales = Array.isArray(objeto.material)
            ? objeto.material
            : [objeto.material];
          for (const elemento of materiales) {
            elemento?.map?.dispose();
            elemento?.dispose();
          }
        }
      });
      renderer.dispose();
      renderer.domElement.remove();
      etiquetas.remove();
    },
  };
}

export { OrbitControls, THREE };
