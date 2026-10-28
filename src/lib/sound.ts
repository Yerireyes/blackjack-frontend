// Efectos de sonido sintetizados con Web Audio: sin archivos que descargar ni licencias.
// El AudioContext se crea en el primer sonido, que siempre sigue a un gesto del usuario
// (repartir, pedir…), así que la política de autoplay del navegador no lo bloquea.

export type Sound = 'card' | 'flip' | 'chip' | 'chipOff' | 'win' | 'blackjack' | 'push' | 'lose';

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let noise: AudioBuffer | null = null;
/** Ganancia general: el volumen al cuadrado, que se oye más parejo a lo largo del control. */
let gain = 0.49;

/** Volumen de 0 a 1. Se aplica también a los sonidos que ya están sonando. */
export function setVolume(volume: number) {
  gain = volume * volume;
  master?.gain.setTargetAtTime(gain, ctx!.currentTime, 0.02);
}

function audio(): AudioContext | null {
  if (ctx) return ctx;
  const Ctor = globalThis.AudioContext;
  if (!Ctor) return null; // jsdom, navegadores sin Web Audio
  ctx = new Ctor();
  master = ctx.createGain();
  master.gain.value = gain;
  master.connect(ctx.destination);
  // Medio segundo de ruido blanco, reutilizado por los sonidos de carta.
  noise = ctx.createBuffer(1, ctx.sampleRate / 2, ctx.sampleRate);
  const data = noise.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return ctx;
}

/** Ráfaga de ruido filtrado: el roce de una carta sobre el paño. */
function swish(t: number, freq: number, dur: number, gain: number) {
  const c = ctx!;
  const src = c.createBufferSource();
  src.buffer = noise;
  src.playbackRate.value = 0.9 + Math.random() * 0.2;
  const filter = c.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.setValueAtTime(freq * 1.4, t);
  filter.frequency.exponentialRampToValueAtTime(freq, t + dur);
  filter.Q.value = 0.9;
  const env = c.createGain();
  env.gain.setValueAtTime(0.0001, t);
  env.gain.exponentialRampToValueAtTime(gain, t + 0.006);
  env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(filter).connect(env).connect(master!);
  src.start(t, Math.random() * 0.3);
  src.stop(t + dur + 0.02);
}

function tone(t: number, freq: number, dur: number, gain: number, type: OscillatorType) {
  const c = ctx!;
  const osc = c.createOscillator();
  osc.type = type;
  osc.frequency.value = freq;
  const env = c.createGain();
  env.gain.setValueAtTime(0.0001, t);
  env.gain.exponentialRampToValueAtTime(gain, t + 0.015);
  env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(env).connect(master!);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

const notes = (
  t: number,
  freqs: number[],
  step: number,
  dur: number,
  gain: number,
  type: OscillatorType,
) => freqs.forEach((f, i) => tone(t + i * step, f, dur, gain, type));

const SOUNDS: Record<Sound, (t: number) => void> = {
  card: (t) => swish(t, 2600 + Math.random() * 600, 0.07, 0.6),
  flip: (t) => {
    swish(t, 1800, 0.05, 0.45);
    swish(t + 0.06, 3200, 0.06, 0.5);
  },
  // Ficha de arcilla cayendo sobre la pila: dos golpes secos y agudos casi juntos.
  chip: (t) => {
    swish(t, 5200, 0.025, 0.7);
    tone(t, 3400 + Math.random() * 300, 0.05, 0.05, 'sine');
    swish(t + 0.035, 6000, 0.02, 0.35);
  },
  chipOff: (t) => swish(t, 4200, 0.03, 0.35),
  win: (t) => notes(t, [523.25, 659.25, 783.99], 0.09, 0.35, 0.18, 'triangle'),
  blackjack: (t) => {
    notes(t, [523.25, 659.25, 783.99, 1046.5], 0.08, 0.5, 0.18, 'triangle');
    notes(t + 0.34, [1318.5, 1568], 0.07, 0.6, 0.07, 'sine');
  },
  push: (t) => notes(t, [587.33, 587.33], 0.16, 0.22, 0.13, 'sine'),
  lose: (t) => notes(t, [392, 311.13, 261.63], 0.14, 0.4, 0.14, 'triangle'),
};

/** Reproduce un sonido dentro de `delay` segundos. No hace nada si no hay Web Audio. */
export function playSound(sound: Sound, delay = 0) {
  const c = audio();
  if (!c) return;
  if (c.state === 'suspended') void c.resume();
  SOUNDS[sound](c.currentTime + 0.01 + delay);
}
