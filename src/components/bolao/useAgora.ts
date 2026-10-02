import { useEffect, useState } from "react";

/** Relógio que bate a cada `ms`, para contagens regressivas de reserva e de Pix. */
export function useAgora(ms = 1000) {
  const [agora, setAgora] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setAgora(Date.now()), ms);
    return () => window.clearInterval(id);
  }, [ms]);
  return agora;
}
