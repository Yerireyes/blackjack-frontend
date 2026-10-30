import { useEffect, useState } from 'react';
import { useRoomsStore } from './roomsStore';

/** Lo que queda del temporizador del último `state`, contado desde que llegó. */
export function useCountdown(): number | null {
  const timerMs = useRoomsStore((s) => s.room?.timerMs ?? null);
  const receivedAt = useRoomsStore((s) => s.receivedAt);
  const [now, setNow] = useState(() => performance.now());
  useEffect(() => {
    if (timerMs === null) return;
    const id = setInterval(() => setNow(performance.now()), 250);
    return () => clearInterval(id);
  }, [timerMs, receivedAt]);
  if (timerMs === null) return null;
  // Justo al llegar un estado, `now` puede ser de antes: nunca más que lo que dijo el servidor.
  return Math.max(0, Math.min(timerMs, timerMs - (now - receivedAt)));
}

export const seconds = (ms: number) => Math.ceil(ms / 1000);
