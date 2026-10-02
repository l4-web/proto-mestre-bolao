/**
 * "há 12 min", "há 3 h", "há 2 d".
 *
 * Arredonda para baixo e para na unidade: turno não é cronômetro de precisão, e
 * "há 1 h 47 min 12 s" ocupa a barra inteira para dizer o que "há 1 h" já disse.
 */
export function haQuantoTempo(iso: string): string {
  const min = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 1) return "instantes";
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} h`;
  return `${Math.floor(h / 24)} d`;
}
