import { Badge } from "@l4-web/ui";
import type { BadgeProps } from "@l4-web/ui";
import type { Avaliacao, ConversaDetalhe } from "../../features/atendimento/tipos";
import { lerAvaliacao } from "./avaliacao-leitura";

/**
 * Os DESENHOS da nota do cliente. Os rótulos e a leitura dos quatro estados moram em
 * `avaliacao.ts`, ao lado do `util.ts` desta pasta: arquivo de componente que também
 * exporta função pura quebra o hot reload do Vite, e a fila importa a leitura sem
 * precisar do componente.
 */

/**
 * O selo compacto, para a linha da fila e para o cabeçalho da thread.
 *
 * Devolve `null` no caso em aberto e quando a API ainda não manda o campo (front e
 * API sobem separados): melhor a linha não ter selo que ter um selo mentindo.
 */
export function SeloAvaliacao({
  avaliacao,
  size = "xs",
}: {
  avaliacao?: Avaliacao;
  size?: BadgeProps["size"];
}) {
  const l = avaliacao && lerAvaliacao(avaliacao);
  if (!l) return null;
  return (
    <Badge
      size={size}
      variant={l.variante}
      className="flex-none"
      title={[l.longo, l.porque].filter(Boolean).join(" ")}
    >
      {l.curto}
    </Badge>
  );
}

/**
 * O bloco da coluna de contexto: a avaliação de cada caso da thread.
 *
 * Uma linha por caso, e não uma nota só da conversa: a nota é POR ATENDIMENTO
 * (`atendimento_id` é único em `atd_avaliacao`), e uma thread de WhatsApp carrega
 * vários assuntos. Mostrar só o último esconderia um "Ruim" de um caso anterior, que
 * é exatamente a linha que alguém precisa ver.
 */
export function BlocoAvaliacao({ conversa }: { conversa: ConversaDetalhe }) {
  const comLeitura = conversa.atendimentos.flatMap((a) => {
    // `flatMap` com lista vazia no lugar de `filter` mais `map`: é o que estreita o
    // tipo sem asserção. `avaliacao` é opcional no contrato de propósito (a API pode
    // ainda não mandar), e um `!` aqui viraria erro em runtime no dia do deploy torto.
    const leitura = a.avaliacao ? lerAvaliacao(a.avaliacao) : null;
    return leitura ? [{ ref: a.ref, leitura }] : [];
  });

  if (comLeitura.length === 0) {
    return (
      <p className="px-1 py-1 text-[11.5px] leading-snug text-text-secondary">
        A pesquisa de satisfação é enviada ao cliente quando o caso é encerrado.
        Ainda não há nada para mostrar aqui.
      </p>
    );
  }

  return (
    <>
      {comLeitura.map(({ ref, leitura }) => (
        <div
          key={ref}
          className="flex flex-col gap-1 rounded-[12px] bg-[var(--l4-fill-5)] px-2.5 py-2"
        >
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-[11.5px] font-medium text-text-strong">
              {ref}
            </span>
            <Badge size="xs" variant={leitura.variante}>
              {leitura.curto}
            </Badge>
          </div>
          <span className="text-[11.5px] leading-snug text-text-strong">
            {leitura.longo}
          </span>
          {leitura.porque && (
            <span className="text-[11px] leading-snug text-text-secondary">
              {leitura.porque}
            </span>
          )}
        </div>
      ))}
    </>
  );
}
