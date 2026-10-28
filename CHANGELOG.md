# Changelog

Cambios relevantes del front. Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/);
versiones según [SemVer](https://semver.org/lang/es/) (en 0.x, una versión menor puede romper compatibilidad).

## [0.2.0] - 2026-10-28

### Agregado

- **Cuentas (fase 1):** registro, login y logout con nombre visible; perfil para cambiar el
  nombre, vincular Google y cerrar sesión en todos los dispositivos; vuelta de Google con avisos
  por código; nombre provisional. Práctica sigue funcionando sin cuenta ni servidor.
- **Fichas en Práctica:** apuesta con fichas de 10, 50, 100 y 500 que viajan a la mesa; dos
  bancas (la tuya y la de la casa en modo dealer); hasta 10 fichas y 500 por apuesta, tope de
  1.000.000 por banca; doblar y dividir solo si el saldo lo cubre.
- **Modo dealer:** cámara 3D detrás del repartidor y jugador automático que juega la acción de
  mayor EV del motor.
- **Sonidos** sintetizados con Web Audio para cartas, fichas y resultados, con botón de silencio.

### Corregido

- Con peek y blackjack del dealer, la ronda ya no se liquida al instante: la oculta se revela a
  la vista y un mensaje explica por qué no hubo decisión.

### Infraestructura

- Proxy de `/api` hacia el backend en `npm run dev` y `npm run preview`.

## [0.1.0]

Versión inicial: análisis exacto de EV y probabilidades con el motor WASM, modos jugador y
dealer, simulación y entrada manual.
