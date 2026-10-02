/**
 * Plural de verdade, para o front parar de escrever "(s)".
 *
 * "6 conversa(s) sem dono", "1 caso(s) aberto(s)", "2 rede(s) conectada(s)": é
 * texto de sistema, não de gente. Num painel que se lê de relance o parêntese
 * rouba a atenção do número, e em "1 caso(s)" ele chega a ficar errado, porque
 * anuncia uma dúvida que o dado já resolveu.
 *
 * Ficou em `lib` e não em cada página porque eram doze lugares em cinco telas, e
 * a próxima tela também vai precisar.
 */
export function plural(n: number, singular: string, plural_: string): string {
  return `${n} ${n === 1 ? singular : plural_}`;
}

/** Só a palavra, quando o número já está escrito à parte (dentro de um `<b>`). */
export function palavra(n: number, singular: string, plural_: string): string {
  return n === 1 ? singular : plural_;
}

/** Concorda o verbo com o número: "1 crítico VENCE", "4 críticos VENCEM". */
export function verbo(n: number, singular: string, plural_: string): string {
  return n === 1 ? singular : plural_;
}
