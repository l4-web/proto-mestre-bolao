import { Facebook, Instagram, MessageCircle } from "lucide-react";
import { Avatar, Badge } from "@l4-web/ui";
import type { ConversaItem, Gravidade } from "../../features/atendimento/tipos";
import { produtoDaConversa } from "../../features/atendimento/produtos";
import { SeloAvaliacao } from "./Avaliacao";
import { lerAvaliacao } from "./avaliacao-leitura";
import { ROTULO_GRAVIDADE, hora, nomeVisivel, prazo } from "./util";

/** Cor do ponto de gravidade. Variável do DS, então acompanha o modo. */
const PONTO: Record<Gravidade, string> = {
  critico: "var(--l4-error-text)",
  alto: "var(--l4-warn-text)",
  medio: "var(--atd-text-3)",
};

/**
 * Uma linha da fila, em quatro faixas: quem é, o motivo, a prévia, o prazo.
 *
 * A gravidade é um PONTO e não um selo. Dentro do AppShell esta coluna tem ~250px,
 * e um selo com a palavra "Crítico" comia o espaço do motivo até sobrar
 * "Pix compensado sem e...", que é justamente o que a pessoa precisa ler para
 * decidir se abre. O ponto custa 6px e a cor continua sendo dele, não do texto.
 */
/**
 * O desenho de cada canal. `whatsapp` é o padrão de quem não veio com tipo: é a
 * origem da esmagadora maioria da fila, e errar para o lado comum é melhor que
 * desenhar um ícone genérico que não diz nada.
 */
/**
 * Os estados em que a conversa está FECHADA.
 *
 * Duas e não uma desde que o fechamento pelo relógio deixou de mentir: `resolvida` é
 * alguém ter fechado, `expirada` é ela ter morrido de inatividade. As duas saem da
 * fila e as duas usam o selo neutro, mas o rótulo tem que dizer qual foi.
 */
const FECHADAS = new Set(["resolvida", "expirada"]);

const CANAL = {
  whatsapp: { icone: MessageCircle, rotulo: "WhatsApp" },
  instagram: { icone: Instagram, rotulo: "Instagram" },
  facebook: { icone: Facebook, rotulo: "Facebook" },
} as const;

export function ItemConversa({
  conversa,
  ativo,
  onSelecionar,
  mostrarOnde,
}: {
  conversa: ConversaItem;
  ativo: boolean;
  onSelecionar: (id: string) => void;
  /**
   * Diz ONDE esta conversa está: "sua", "sem dono", "com Fulano", "resolvida".
   *
   * Só aparece quando a lista é resultado de BUSCA, e aí é indispensável: procurar
   * atravessa as abas, então o resultado vem de qualquer lugar e sem isso a pessoa
   * abre a conversa sem saber se ela é dela, de outra pessoa ou já encerrada. Nas
   * abas normais seria ruído, porque a aba já respondeu isso.
   */
  mostrarOnde?: boolean;
}) {
  const at = conversa.atendimento;
  const nome = nomeVisivel(conversa.contato, at?.ref);
  const p = prazo(at?.sla_com_resolucao_em ?? null, at?.resolvido_em ?? null);
  const semDono = !conversa.responsavel;
  const produto = produtoDaConversa(conversa);
  const canal = CANAL[conversa.canal?.tipo ?? "whatsapp"] ?? CANAL.whatsapp;
  // A leitura da avaliação também alimenta o `title`: na linha o selo é uma palavra
  // ("Sem pesquisa"), e é no hover que ela diz por quê.
  const nota = conversa.avaliacao ? lerAvaliacao(conversa.avaliacao) : null;

  return (
    <button
      type="button"
      onClick={() => onSelecionar(conversa.id)}
      data-conversa={conversa.id}
      title={[
        nome,
        produto && `Produto: ${produto.rotulo}`,
        at?.motivo?.label,
        at &&
          `${ROTULO_GRAVIDADE[at.gravidade]}${p ? ` · SLA ${p.texto}` : ""}`,
        semDono
          ? "Sem dono"
          : conversa.responsavel
            ? `Com ${conversa.responsavel}`
            : undefined,
        nota && [nota.longo, nota.porque].filter(Boolean).join(" "),
        conversa.previa?.conteudo,
      ]
        .filter(Boolean)
        .join("\n")}
      aria-current={ativo ? "true" : undefined}
      className={[
        "flex w-full items-start gap-2.5 rounded-[14px] px-2.5 py-2.5 text-left transition-colors",
        ativo ? "bg-[var(--l4-fill-3)]" : "hover:bg-[var(--l4-fill-4)]",
      ].join(" ")}
    >
      <span
        className={[
          "relative flex-none rounded-full",
          // Aro tracejado = sem dono. É a mesma informação que era pílula de texto,
          // mas em forma, que não disputa a largura da linha com o prazo.
          semDono
            ? "ring-1 ring-dashed ring-[var(--l4-border-strong)] ring-offset-2 ring-offset-[rgb(var(--l4-surface))]"
            : "",
        ].join(" ")}
      >
        <Avatar nome={conversa.contato.oculto ? "?" : nome} size={32} />
        {at && (
          <span
            aria-label={ROTULO_GRAVIDADE[at.gravidade]}
            title={ROTULO_GRAVIDADE[at.gravidade]}
            className="absolute -right-0.5 -top-0.5 size-[9px] rounded-full ring-2 ring-[rgb(var(--l4-surface))]"
            style={{ background: PONTO[at.gravidade] }}
          />
        )}
      </span>

      {/* min-w-0 no filho flex: sem ele o truncate não corta, vaza. */}
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex items-baseline gap-2">
          <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-text-strong">
            {nome}
          </span>
          <span className="flex-none text-[11px] tabular-nums text-text-secondary">
            {hora(conversa.ultimo_evento_em)}
          </span>
        </span>

        {/*
          O PRODUTO ABRE A LINHA DO MOTIVO, e não a linha do prazo.

          A fila é mista por desenho (cada produto tem o seu número e todos caem na
          mesma caixa), e antes disto nada na tela dizia de qual produto era cada
          conversa: o atendente abria e descobria pelo conteúdo.

          Ficou aqui porque na linha de baixo ele comia o prazo: dentro do AppShell
          esta coluna tem ~250px, e com o selo na frente do "ATD-2042" o
          "estourou há 3h" saía cortado em "estourou h…" (visto na tela, em 1440).
          Prazo é o que decide se abre agora; o motivo já trunca por construção e não
          perde nada em ceder o começo da linha.
        */}
        {(produto || at?.motivo || mostrarOnde) && (
          <span className="flex min-w-0 items-center gap-1.5">
            {/*
              DE QUAL CANAL VEIO, e isso deixou de ser detalhe quando a fila passou a
              misturar WhatsApp com comentário do Instagram virado caso. Muda o que a
              pessoa pode fazer: no WhatsApp a janela é de 24h e existe template
              aprovado depois dela; nas redes são 7 dias e não existe template.

              Ícone e não selo: a linha já tem estado, produto e motivo disputando
              largura numa coluna de ~250px, e um quarto selo empurraria o motivo para
              fora. O `title` dá o nome para quem não reconhece o desenho.
            */}
            <canal.icone
              className="size-3 flex-none text-text-secondary"
              aria-hidden
            />
            <span className="sr-only">{canal.rotulo}</span>
            {mostrarOnde && (
              <Badge
                size="xs"
                variant={
                  FECHADAS.has(conversa.estado)
                    ? "neutral"
                    : semDono
                      ? "warn"
                      : "info"
                }
                className="flex-none"
              >
                {/*
                  "Expirada" e "Resolvida" são selos DIFERENTES de propósito: a
                  primeira morreu de inatividade e a segunda alguém fechou. Mostrar as
                  duas como "Resolvida" era o que fazia a fila afirmar um trabalho que
                  não houve.
                */}
                {conversa.estado === "expirada"
                  ? "Expirada"
                  : conversa.estado === "resolvida"
                    ? "Resolvida"
                    : semDono
                    ? "Sem dono"
                    : /* A API resolve o NOME, não o id, então o rótulo diz de quem
                         é em vez de "sua". A pessoa reconhece o próprio nome, e
                         devolver o id só para escrever "sua" seria mudar o
                         contrato por causa de uma palavra. */
                        `Com ${conversa.responsavel}`}
              </Badge>
            )}
            {produto && (
              <Badge size="xs" variant="neutral" className="flex-none">
                {produto.rotulo}
              </Badge>
            )}
            {at?.motivo && (
              <span className="min-w-0 truncate text-[11.5px] font-medium text-text-secondary">
                {at.motivo.label}
              </span>
            )}
          </span>
        )}

        {conversa.previa?.conteudo && (
          <span className="line-clamp-2 text-[12px] leading-snug text-text-secondary">
            {conversa.previa.conteudo}
          </span>
        )}

        {/* Etiquetas de venda (Pix pendente, Premiada, Pago) na própria linha: são
            elas que fazem a vendedora decidir quem chamar primeiro. */}
        {(conversa.tags ?? []).length > 0 && (
          <span className="flex flex-wrap gap-1">
            {conversa.tags.map((t) => (
              <Badge
                key={t}
                size="xs"
                variant={
                  t.startsWith("Premiada") || t === "Pago"
                    ? "success"
                    : t === "Pix pendente"
                      ? "warn"
                      : t === "Pix expirado"
                        ? "error"
                        : "info"
                }
              >
                {t}
              </Badge>
            ))}
          </span>
        )}

        <span className="mt-0.5 flex min-w-0 items-baseline gap-1.5 overflow-hidden whitespace-nowrap text-[10.5px]">
          {at?.ref && (
            <span className="flex-none font-mono text-text-secondary">
              {at.ref}
            </span>
          )}
          {p && (
            <>
              <span className="flex-none text-text-muted">·</span>
              <span
                className={[
                  "truncate",
                  p.estourado
                    ? "font-semibold text-error-text"
                    : "text-text-secondary",
                ].join(" ")}
              >
                {p.texto}
              </span>
            </>
          )}
          {/*
            A NOTA DO CLIENTE FICA NA FAIXA DA REF, e DEPOIS do prazo.

            Na faixa do motivo ela competiria com o texto que a pessoa lê para
            decidir se abre, e dentro do AppShell esta coluna tem ~250px. Aqui é a
            faixa que sobra vazia na visão "Resolvidas", que é justamente onde se
            olha para a nota: sem caso aberto não há `ref` nem prazo.

            Depois do prazo porque a faixa é `overflow-hidden`: numa conversa reaberta
            os dois convivem, e o que tem que sobreviver ao aperto é o prazo, que é o
            que decide se abre AGORA. Antes dele, o selo empurrava o "estourou há 3h"
            para fora.
          */}
          <SeloAvaliacao avaliacao={conversa.avaliacao} />
        </span>
      </span>
    </button>
  );
}
