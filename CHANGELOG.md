# Changelog

Cambios relevantes del front. Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/);
versiones según [SemVer](https://semver.org/lang/es/) (en 0.x, una versión menor puede romper compatibilidad).

## [Sin publicar]

### Agregado

- **Pantalla de inicio:** elegir entre Jugar (Casual), Practicar y Ajustes. Jugar muestra si
  hay una partida en curso con su saldo y la continúa; sin cuenta, abre el login. Debajo, el
  top 3 de la semana. Cada pantalla tiene su dirección (`#/jugar`, `#/practicar`): recargar
  deja al usuario donde estaba y Atrás vuelve al inicio.
- **Ajustes:** efectos de sonido, volumen (con una ficha de muestra), animaciones reducidas
  aunque el sistema no lo pida, y la lista de atajos de teclado. Se guardan en el navegador.
- **Modo Casual (fase 3):** se entra desde el inicio. Partidas de 500 fichas contra el
  servidor, que reparte, valida y liquida; se retoma la ronda activa al volver; liquidación
  animada; ayudas del motor con la composición que manda el servidor; retirarse; ranking semanal
  y récords. Pide nombre elegido antes de jugar.
- **Vincular Google pide la contraseña:** primero se confirma en un diálogo
  (`POST /auth/google/link-intent`) y después se navega a Google. Si la prueba falta, venció o
  ya se gastó, la vuelta (`reauth_required`) reabre el diálogo.
- **Desvincular Google** desde el perfil, con confirmación y contraseña. Cierra la sesión en los
  demás dispositivos y lo avisa. Vincular y desvincular solo se muestran si la cuenta tiene
  contraseña.

### Cambiado

- La cabecera de la mesa vuelve al inicio con el botón de la izquierda y muestra dónde estás
  (Práctica o Jugar). El selector Práctica | Casual desaparece: se elige en el inicio.
- Cabecera en móvil y en escritorio estrecho: las herramientas van en su propia fila y las
  reglas se recortan en vez de montarse sobre los selectores. En móvil, «Entrar» es solo el
  icono y el silencio rápido está en Ajustes.
- Cliente HTTP compartido (`src/api/http.ts`) para cuentas y Casual.
- Pila y bandeja de fichas presentacionales, reutilizadas por Práctica y Casual. La ayuda de la
  bandeja muestra el tope real de la apuesta.

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
