import type { ReactNode } from "react";
import { AlertTriangle, ChevronRight, History, Lock } from "lucide-react";
import { Badge, Eyebrow } from "@l4-web/ui";
import type { Consulta, ConversaDetalhe } from "../../features/atendimento/tipos";
import { BlocoConsulta } from "./BlocoConsulta";
import { BlocoAvaliacao } from "./Avaliacao";
import { temAvaliacao } from "./avaliacao-leitura";
import { CORES_GRAVIDADE, ROTULO_GRAVIDADE, dataHora } from "./util";

/** Cartão agrupado, raio concêntrico: 18 por fora, 12 nas linhas de dentro. */
export function Grupo({
  titulo,
  origem,
  children,
}: {
  titulo: string;
  origem?: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-[18px] bg-surface p-2.5 shadow-[var(--l4-sh-rest)]">
      <div className="flex items-center justify-between gap-2 px-1 pb-1.5">
        <Eyebrow>{titulo}</Eyebrow>
        {origem && (
          <span className="rounded-full bg-[var(--l4-fill-4)] px-1.5 py-px font-mono text-[9.5px] text-text-secondary">
            {origem}
          </span>
        )}
      </div>
      <div className="flex flex-col gap-px">{children}</div>
    </section>
  );
}

/**
 * A coluna de contexto, espelhando o protótipo: identidade e ações no topo, e
 * abaixo os blocos de consulta mínima, relacionamento, lead e base.
 *
 * Os dados do participante vêm ABERTOS aqui, e não atrás de um clique: quem atende
 * confere CPF e telefone antes de falar, e esconder isso num painel que precisa
 * abrir custa um clique em cada conversa do dia.
 *
 * Quando o papel não tem `contato.pessoais` a API devolve `oculto` com os campos
 * em `null`, e aqui isso vira aviso explicando a regra. Campo vazio parece defeito.
 */
export function PainelContexto({
  conversa,
  consulta,
  veFinanceiro,
  onVerHistorico,
  semConsulta,
}: {
  /** Produto que traz o cliente por outra aba (ex.: Mestre do Bolão, cliente do iON). */
  semConsulta?: boolean;
  conversa: ConversaDetalhe;
  /**
   * Abre a lista com TODAS as conversas deste contato, em qualquer situação.
   *
   * Mora aqui porque é aqui que a pessoa está quando a pergunta aparece: ela está
   * lendo o caso e quer saber se já falou com a gente antes. Opcional porque o
   * painel também é montado em lugar que não tem lista para filtrar.
   */
  onVerHistorico?: (contatoId: string, nome: string) => void;
  /**
   * A consulta mínima, que chega em requisição própria e depois da thread. Ausente
   * enquanto carrega, e o bloco mostra isso em vez de campo vazio.
   */
  consulta?: Consulta;
  /**
   * `contato.financeiro`. O protótipo esconde o bloco de consulta inteiro de quem
   * não tem, e está certo: transação, carteira e saque são dado financeiro do
   * cliente, e o Dev que trata defeito não precisa nem deve ver.
   */
  veFinanceiro: boolean;
}) {
  const abertos = conversa.atendimentos.filter((a) => !a.resolvido_em);
  const c = conversa.contato;

  return (
    <div className="flex flex-col gap-2.5">
      {/*
        A AVALIAÇÃO DO CLIENTE ABRE A COLUNA, e ela ocupa o lugar em que ficava um
        seletor de "sentimento" com três carinhas.

        Aquele seletor era o ATENDENTE julgando o próprio atendimento, e quem avalia é
        o participante. Fora isso, ele escrevia numa coluna que nenhuma tela, nenhum
        indicador e nenhum relatório do módulo lê: as únicas leituras de `sentimento`
        em toda a API são sobre `atd_comentario`, que é a escuta social, outra tabela.

        A `origem` no cabeçalho do grupo não é enfeite: ela é quem diz de QUEM é o
        julgamento. Sem isso, uma nota na coluna de contexto lê como avaliação interna,
        e "bem avaliado" viraria a nossa opinião sobre nós mesmos.
      */}
      {/* Some inteiro no ambiente cuja API ainda não manda o campo (front e API sobem
          separados): cabeçalho de grupo com o corpo vazio parece defeito de dado. */}
      {temAvaliacao(conversa) && (
        <Grupo titulo="Avaliação do cliente" origem="quem foi atendido">
          <BlocoAvaliacao conversa={conversa} />
        </Grupo>
      )}

      {/*
        O ATALHO DO HISTÓRICO vem antes dos dados do contato, e aparece mesmo para
        quem trabalha por referência do caso: a lista que ele abre continua passando
        pelo mesmo recorte de permissão e pela mesma máscara, então não é porta
        lateral. Esconder dele seria tirar contexto de quem mais precisa, já que é
        justamente quem não vê nome nem CPF para procurar à mão.
      */}
      {onVerHistorico && (
        <button
          type="button"
          onClick={() => onVerHistorico(c.id, c.nome ?? "este contato")}
          className="flex w-full items-center justify-between gap-2 rounded-[14px] bg-surface-chip px-3 py-2 text-left text-[12px] text-text-strong transition hover:brightness-95"
        >
          <span className="flex items-center gap-2">
            <History size={14} className="flex-none text-text-secondary" />
            Ver todas as conversas deste contato
          </span>
          <ChevronRight size={14} className="flex-none text-text-secondary" />
        </button>
      )}

      {c.oculto ? (
        <div className="flex gap-2.5 rounded-[18px] bg-info-bg p-3">
          <Lock className="mt-px size-3.5 flex-none text-info-text" />
          <p className="text-[11.5px] leading-snug text-text-strong">
            Seu perfil trabalha por <b>referência do caso</b>. Nome, CPF e
            telefone não são exibidos.
          </p>
        </div>
      ) : (
        <Grupo titulo="Etiquetas do contato">
          <div className="flex flex-wrap gap-1.5 px-1 py-1">
            {(c.tags ?? []).map((t) => (
              <Badge key={t} size="xs" variant="neutral">
                {t}
              </Badge>
            ))}
          </div>
        </Grupo>
      )}

      <Grupo titulo="Casos nesta conversa">
        {abertos.length === 0 ? (
          <p className="px-1 py-1 text-[11.5px] leading-snug text-text-secondary">
            Nenhum caso aberto. Uma thread pode ter mais de um assunto, e cada
            um vira um caso com motivo e prazo próprios.
          </p>
        ) : (
          abertos.map((a) => (
            <div
              key={a.id}
              className="flex flex-col gap-1 rounded-[12px] bg-[var(--l4-fill-5)] px-2.5 py-2"
            >
              <div className="flex items-center gap-2">
                <span className="font-mono text-[11.5px] font-medium text-text-strong">
                  {a.ref}
                </span>
                <Badge variant={CORES_GRAVIDADE[a.gravidade]} size="xs">
                  {ROTULO_GRAVIDADE[a.gravidade]}
                </Badge>
              </div>
              <span className="text-[11.5px] leading-snug text-text-secondary">
                {a.motivo?.label ?? "Sem motivo definido"}
              </span>
              {a.sla_reg_prazo_em && (
                <span className="flex items-center gap-1 text-[10.5px] font-semibold text-warn-text">
                  <AlertTriangle className="size-3" />
                  Prazo regulatório: {dataHora(a.sla_reg_prazo_em)}
                </span>
              )}
            </div>
          ))
        )}
      </Grupo>

      {/*
        SAÍRAM DAQUI os blocos "Relacionamento" (Dispara Aí) e "Base de
        conhecimento", que eram cartaz.

        Os dois desenhavam um cartão com título, selo de origem e um texto do que
        VIRIA, fechado com "Chega na v1.1" e "Chega na F4". Isso servia enquanto a
        coluna era protótipo e a estrutura é que estava em validação. Com cliente
        real do outro lado, são duas caixas ocupando a coluna que quem atende lê
        em toda conversa, dizendo o nome de uma fase interna que não significa
        nada para ela, e empurrando para baixo o que tem dado de verdade.

        Nenhum dos dois é conserto de tela: o relacionamento não tem endpoint no
        módulo, e a base só devolve o motivo do artigo como RÓTULO, não como id,
        então amarrar ao caso aberto dependeria de casar nome com nome. As duas
        pendências estão registradas para a API.
      */}
      {!semConsulta && (
      <Grupo titulo="Consulta mínima" origem="iOn · APCAP VIP">
        {veFinanceiro ? (
          <BlocoConsulta consulta={consulta} />
        ) : (
          <p className="px-1 py-1 text-[11.5px] leading-snug text-text-secondary">
            Seu perfil não tem acesso aos dados financeiros deste contato.
          </p>
        )}
      </Grupo>
      )}

    </div>
  );
}
