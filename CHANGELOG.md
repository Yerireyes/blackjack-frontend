# Changelog

Cambios relevantes del front. Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/);
versiones según [SemVer](https://semver.org/lang/es/) (en 0.x, una versión menor puede romper compatibilidad).

## [Sin publicar]

### Agregado

- **Seguro y dinero par:** con un As visible, Casual, Ranked, el reto diario y las salas
  preguntan «¿Seguro?» (o «¿Dinero par?» con blackjack propio) antes del peek; solo «No» si
  no alcanzan las fichas. En las salas deciden todos a la vez, con temporizador. Al liquidar,
  el neto del seguro aparte. Con ayudas (Práctica, Casual y salas con ayudas), el EV del
  seguro según el motor y la opción recomendada; nunca en Ranked ni en el reto.
- **Salas Casual multijugador:** mesas de 5 a 7 jugadores contra el dealer en tiempo real
  (WebSocket). Lobby con las salas públicas, entrar con el código o el enlace
  (`#/salas/CÓDIGO`) y crear sala con nombre, visibilidad, asientos, reglas (presets o las de
  Práctica) y ayudas. En la mesa: sentarse, apostar con fichas, turnos de 20 s con temporizador,
  revelación del dealer, recompra, reacciones, ranking de la sala y quién mira; el anfitrión
  puede sacar a alguien. Con ayudas, el EV y la recomendada en tu turno; sin ayudas, nada del
  motor. Reconecta sola si se corta la conexión.
- **Títulos en los rankings:** el título que cada jugador lleva puesto aparece tras su nombre
  («Ana · Cabeza fría») en el ranking semanal de Casual, el de Ranked, el del reto diario y el
  top 3 del inicio.
- **Logros (fase 5):** al terminar de verse cada ronda, un aviso por cada logro nuevo que
  otorga el servidor (sin repetirlo si la respuesta llega dos veces), con el cosmético que
  desbloquea. Pantalla de logros (`#/logros`, desde el inicio o tu cuenta): los 10 con su
  fecha o bloqueados, y la racha de decisiones óptimas (también junto a la revisión en Ranked
  y el reto).
- **Cosméticos (fase 5):** paño (verde, azul, rojo, negro), dorso (clásico, dorado,
  medianoche), fichas (clásicas, neón, doradas) y título, desbloqueados por logros. Se eligen
  en la pantalla de logros con una vista previa, se guardan en tu cuenta y se ven en todos los
  modos, también en Práctica. Solo apariencia; sin sesión, lo de serie.
- **Reto diario (fase 5):** el mismo zapato para todos cada día (UTC), 500 fichas y 30 manos,
  un solo intento. Antes de empezar, las reglas y el aviso del intento único; durante, el
  contador «mano N de 30», sin ayudas y con la revisión al terminar cada mano; al final, el
  saldo final, la posición y cuánto falta para el próximo reto. Ranking de hoy y de ayer, y tus
  retos. Si cambia el día con el intento a medias, avisa y ofrece el de hoy.
- **Ranked (fase 4):** temporadas mensuales con reglas fijas de Las Vegas y sin ayudas durante
  la mano (ni EV ni recomendada; no se le pide nada al motor). Al terminar, la revisión de
  cada decisión contra la óptima con el EV perdido, y el acumulado de la sesión. Saldo y neto de
  la temporada, manos para clasificar (200), recarga a 100 con la hora en que estará
  disponible (la mesa se actualiza sola), ranking de la temporada actual y la anterior con
  medallas, y tus temporadas cerradas.
- **Una mano a la vez:** si la mano en juego es de otro modo, la mesa lo avisa y lleva a
  terminarla allí.
- **Pantalla de inicio:** elegir entre Casual, Ranked, Reto diario, Practicar y Ajustes.
  Casual muestra si hay una partida en curso con su saldo y la continúa; Ranked, tu neto y tus
  manos de la temporada; el reto, si está por empezar, en juego o terminado; sin cuenta, abren
  el login. Debajo, el top 3 de Casual de la semana. Cada pantalla tiene su dirección
  (`#/casual`, `#/ranked`, `#/reto`, `#/practicar`): recargar deja al usuario donde estaba
  y Atrás vuelve al inicio.
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

- La mecánica de la ronda contra el servidor (repartir, actuar, revelar, fichas) vive en
  `src/play/` y la comparten Casual, Ranked y el reto (también la revisión de decisiones).
- La cabecera de la mesa vuelve al inicio con el botón de la izquierda y muestra dónde estás
  (Práctica, Casual o Ranked). El selector Práctica | Casual desaparece: se elige en el inicio.
- Cabecera en móvil y en escritorio estrecho: las herramientas van en su propia fila y las
  reglas se recortan en vez de montarse sobre los selectores. En móvil, «Entrar» es solo el
  icono y el silencio rápido está en Ajustes.
- Cliente HTTP compartido (`src/api/http.ts`) para cuentas y Casual.
- Pila y bandeja de fichas presentacionales, reutilizadas por Práctica y Casual. La ayuda de la
  bandeja muestra el tope real de la apuesta.

### Corregido

- `npm run dev` no servía el WASM del motor (403: el paquete se enlaza desde el backend, fuera
  de la carpeta del front) y no había análisis en Práctica ni en Casual.

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
