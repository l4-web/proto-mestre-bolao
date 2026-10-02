/**
 * Barra de proporção, a mesma do protótipo na coluna de carga do atendente. Muda
 * de cor por FAIXA e não por valor exato: verde até 70, amarelo até 90, vermelho
 * acima. Carga em número lê como "8 de 10"; em barra lê como "está cheio", que é a
 * pergunta que o supervisor faz.
 */
export function Barra({ pct, titulo }: { pct: number; titulo?: string }) {
  const v = Math.max(0, Math.min(100, Math.round(pct)));
  const cor =
    v >= 90
      ? "bg-error-accent"
      : v >= 70
        ? "bg-warn-accent"
        : "bg-success-accent";
  return (
    <span
      className="block h-1.5 w-full overflow-hidden rounded-full bg-[var(--l4-fill-3)]"
      title={titulo ?? `${v}%`}
      role="img"
      aria-label={titulo ?? `${v}%`}
    >
      <span
        className={`block h-full rounded-full ${cor}`}
        style={{ width: `${v}%` }}
      />
    </span>
  );
}
