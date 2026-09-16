# App de Dibujo Colaborativo en Pareja — Notas de Brainstorming

## Concepto

Aplicación web para que dos personas dibujen juntas en tiempo real, viendo el
cursor y los trazos del otro en vivo. No es un producto comercial: es un
proyecto **open source**, pensado para descargarse, desplegarse en una
computadora local (o servidor propio) y que dos personas se conecten a esa
instancia para dibujar juntas.

## Decisiones ya tomadas

- **Tipo de app**: Web (no móvil nativa, por ahora).
- **Modelo**: Open source, self-hosted. Sin cuentas, sin pagos, sin
  necesidad de escalar a muchos usuarios — solo 2 personas por sesión.
- **Herramienta de dibujo base**: [Klecks](https://github.com/kleki-app/klecks)
  (también conocida como Kleki), un editor de dibujo standalone en JS/TS,
  con capas, pinceles, filtros WebGL, etc. Se puede correr con Docker
  (`docker-compose up -d`, expuesto en `http://localhost:5050`).
- **Meta inmediata**: Construir un **prototipo simple**, no un producto
  pulido.

## Decisión técnica clave: WebSockets, no WebRTC

Se descartó WebRTC porque:
- Es peer-to-peer, pensado para audio/video o transferencia directa.
- Añade complejidad innecesaria (NAT traversal, signaling server).

Se eligió **WebSockets** porque:
- Ya se va a tener un servidor local corriendo (el que se despliega).
- El servidor puede actuar como intermediario simple: recibe eventos de
  un cliente y los reenvía al otro.
- Con solo 2 personas por sesión, no hace falta un sistema complejo de
  salas: una sesión = 2 sockets conectados, todo lo que llega de uno se
  reenvía al otro.

## Qué sincronizar/

1. **Cursor remoto**
   - Eventos frecuentes pero ligeros: `{x, y, color, nombre}`.
   - No se guardan, solo se retransmiten en vivo.
   - Throttle recomendado: ~30–60 eventos/segundo.

2. **Contenido del dibujo**
   - Klecks **no** tiene sistema de colaboración integrado (no usa CRDT,
     no tiene noción de "sesión compartida"). Es solo un canvas potente
     que corre en el navegador.
   - Por lo tanto, toda la capa de sincronización se debe construir
     **por fuera** de Klecks.

## Dos estrategias de sincronización del dibujo

### Opción A — Snapshots del canvas (recomendada para el prototipo)
- En cada `pointerup` (fin de trazo) o cada X segundos, exportar el canvas
  actual como imagen (PNG/blob).
- Enviar esa imagen por WebSocket al otro cliente.
- El otro cliente la recibe y la pinta sobre su lienzo.
- **Ventaja**: no requiere entender la arquitectura interna de Klecks.
- **Desventaja**: más pesado en datos; es "ver fotos actualizadas del
  lienzo del otro" más que colaboración real trazo a trazo.

### Opción B — Interceptar y replicar eventos de dibujo (más avanzada)
- Engancharse al sistema interno de historial/comandos de Klecks (tipo
  `KlHistory`) para capturar cada acción (trazo, color, nueva capa) como
  evento estructurado.
- Enviar ese evento por WebSocket y "reproducirlo" en el otro cliente.
- **Ventaja**: mucho más liviano en datos, sincronización más fiel.
- **Desventaja**: requiere explorar el código fuente de Klecks para
  encontrar dónde engancharse, y replicar el estado interno (capas,
  historial) de forma exacta puede ser complejo.

**Conclusión**: empezar con la Opción A por ser más simple y menos frágil
para un prototipo.

## Arquitectura propuesta del prototipo

```
[Cliente A: Klecks + JS de sync] <--WebSocket--> [Servidor Node.js] <--WebSocket--> [Cliente B: Klecks + JS de sync]
```

- El servidor es simple: no entiende de dibujo, solo reenvía mensajes
  entre los dos únicos clientes conectados a una sesión.
- Tipos de mensajes por socket:
  - `cursor`: `{x, y}` en cada `mousemove`, throttleado.
  - `canvas-update`: imagen/blob del canvas, enviado en `pointerup` o
    periódicamente.
- En el cliente se necesita agregar:
  - Un overlay transparente (div/canvas) sobre Klecks para dibujar el
    cursor remoto.
  - Un listener que capture el canvas de Klecks y lo envíe cuando
    corresponda.
  - Un listener que reciba el canvas remoto y lo pinte.

## Ideas adicionales exploradas (para fases futuras, no del prototipo)

- Modo eco: uno dibuja una línea y el otro la continúa sin ver el
  original hasta terminar.
- Galería de recuerdos: guardar cada sesión como un "momento" con fecha.
- Notificaciones tipo "tu pareja empezó a dibujar, ¿te unes?".
- Plantillas de actividades ("dibuja cómo te sientes hoy", "completa el
  retrato del otro sin verlo").
- Reacciones en vivo (emojis, aplausos) mientras el otro dibuja.
- Modo video + dibujo combinado.

## Próximos pasos sugeridos

1. Clonar y correr Klecks localmente (Docker o `npm run start`).
2. Explorar `src/app` para ver si expone funciones tipo `getCanvas()` /
   `exportAsImage()`, o algún sistema de eventos al que engancharse.
3. Construir el servidor Node.js + WebSocket como punto de partida
   (reenvío simple de mensajes entre 2 clientes).
4. Implementar overlay de cursor remoto.
5. Implementar sincronización de canvas vía snapshots (Opción A).
6. Si el prototipo funciona bien, evaluar migrar a la Opción B para
   mejorar rendimiento y fidelidad.
