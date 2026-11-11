# Plan del proyecto

- [x] 0. Crear esqueleto del proyecto e iniciar git
- [x] 1. Exportar datos
- [x] 2. Implementar el motor
- [x] 3. Crear el modo observados (selección de día/tramo, replay, cifras y vistas)
- [x] 4. Crear la escena 3D
- [x] 5. Añadir animación de pacientes y HUD (Entregas A y B completadas)
- [x] 6. Crear el laboratorio (datos propios, réplicas y configuración compartible)
- [x] 7. Implementar comparación de escenarios y ejecución en Web Worker
- [x] 8. Pulir la aplicación
- [x] 9. Desplegar en GitHub Pages

## Cierre de correcciones — 2026-11-11

- [x] Completar trayectorias continuas de entrada, filas, servicio y salida.
- [x] Limitar el modelo aleatorio a Poisson y servicio exponencial, conservando
  la reproducción observada y sus cifras verificadas.
- [x] Renombrar la sección visible como «Simular aleatoriamente».
- [x] Rediseñar las figuras low-poly y su animación determinista; medir
  rendimiento con 71 y 300 pacientes y comprobar recursos tras 20 recargas.
- [x] Verificar la escena en 1366×768 y 390×844, incluyendo el prefijo local
  `/pharmasan-web/`.
- [x] Ejecutar `node --test` completo antes del commit final: 58 aprobadas,
  0 fallidas.
- [x] Revisar el workflow: instala dependencias y Chromium, y ejecuta
  `node --test`.
- [ ] Obtener una ejecución remota nueva de GitHub Actions; requiere push y no
  se hizo en esta tarea.
