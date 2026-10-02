import { CornerDownRight } from "lucide-react";
import { Badge } from "@l4-web/ui";
import { dataHora } from "../conversa/util";

export interface RespostaDaThread {
  id: string;
  autor: string | null;
  texto: string;
  publicado_em: string;
  nosso: boolean;
}

/**
 * O que já foi respondido embaixo deste comentário, na rede.
 *
 * Existe porque o módulo só conhecia o comentário RAIZ: quem responde pelo aplicativo
 * do Instagram, que é como se responde na prática, não chegava aqui, e a tela dizia
 * "novo" em comentário que o time já tinha respondido cinco dias antes. Quem abria a
 * tela para trabalhar a fila de reputação ia responder de novo.
 *
 * A resposta da própria praça vem marcada, e isso não é enfeite: o card serve para
 * decidir se ainda falta fazer alguma coisa, e "alguém respondeu" e "NÓS respondemos"
 * levam a decisões diferentes.
 */
export function ThreadDoComentario({ respostas }: { respostas: RespostaDaThread[] }) {
  if (respostas.length === 0) return null;

  return (
    <ul className="mt-2 flex flex-col gap-1.5 border-l-[1.5px] border-[var(--l4-surface-borda)] pl-3">
      {respostas.map((r) => (
        <li key={r.id} className="flex items-start gap-2">
          <CornerDownRight
            className="mt-[3px] size-3 flex-none text-text-secondary"
            aria-hidden
          />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] font-medium text-text-strong">
                {r.autor ?? "autor não identificado"}
              </span>
              {r.nosso && (
                <Badge size="xs" variant="info">
                  Nossa resposta
                </Badge>
              )}
              <span className="text-[10.5px] tabular-nums text-text-secondary">
                {dataHora(r.publicado_em)}
              </span>
            </div>
            <p className="text-[12.5px] leading-relaxed text-text-strong">{r.texto}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}
