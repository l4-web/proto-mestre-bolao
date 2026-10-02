import { AlertTriangle, ExternalLink, HelpCircle, SearchX } from "lucide-react";
import { Badge } from "@l4-web/ui";
import type { Consulta, LinhaConsulta } from "../../features/atendimento/tipos";

/**
 * A consulta mínima: seis linhas, cada uma com a sua fonte e o seu estado.
 *
 * A regra que manda aqui é a mesma da API: **nunca fingir dado**. Três das seis
 * linhas não têm fonte hoje (saldo e saque dependem de endpoint do APCAP VIP que não
 * existe, pagamento e cupons dependem de campos que o iOn não expõe), e o atendente
 * decide encaminhar ou prometer prazo lendo esta coluna. Preencher com traço, com
 * zero ou com "carregando" seria pior que dizer a verdade: "R$ 0,00" onde não há
 * fonte de saldo é informação falsa que ele repassa ao cliente.
 *
 * Por isso cada estado tem forma própria, e não só cor: dado presente vem em texto
 * forte, ausência vem em texto secundário com a razão, e o que depende de contrato
 * de terceiro vem com selo, porque é pendência de projeto e não falha de momento.
 */
export function BlocoConsulta({ consulta }: { consulta?: Consulta }) {
  if (!consulta) {
    return (
      <p className="px-1 py-1 text-[11.5px] leading-snug text-text-secondary">
        Consultando iOn e APCAP VIP…
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-px">
      {/*
        A identificação vem PRIMEIRO e fora da lista.

        Sem saber quem é a pessoa, nenhuma das seis linhas pode ter dado, e repetir
        "depende de identificar o cliente" seis vezes é ruído. Aqui em cima ela ainda
        diz o que o atendente faz a seguir, que é pedir o CPF.
      */}
      {!consulta.identificacao.resolvido && consulta.identificacao.pedirAoCliente && (
        <div className="mb-1 flex items-start gap-2 rounded-[12px] bg-info-bg px-2.5 py-2">
          <HelpCircle className="mt-px size-3 flex-none text-info-text" aria-hidden />
          <p className="text-[11.5px] leading-snug text-text-strong">
            {consulta.identificacao.pedirAoCliente}
          </p>
        </div>
      )}

      {/*
        JÁ CONSULTAMOS E NÃO ACHAMOS, que é outro estado e não o mesmo de cima.

        O CPF já foi dado pelo cliente e o iOn não conhece essa pessoa. Aqui não há
        nada para o atendente pedir, e mostrar o aviso azul de "peça o CPF" seria
        mandá-lo pedir o que acabou de receber. O tom é neutro de propósito: a lacuna
        é do iOn, não do cliente e não do atendente, e nada disso é motivo de alarme
        vermelho.
      */}
      {!consulta.identificacao.resolvido && consulta.identificacao.consultadoSemResultado && (
        <div className="mb-1 flex items-start gap-2 rounded-[12px] bg-surface-soft px-2.5 py-2">
          <SearchX className="mt-px size-3 flex-none text-text-muted" aria-hidden />
          <p className="text-[11.5px] leading-snug text-text-secondary">
            Não encontramos dados deste participante no iOn.
          </p>
        </div>
      )}

      {/*
        A divergência é o caso crítico da operação: Pix compensado E zero cupons na
        mesma leitura autoriza encaminhar para Pagamentos em vez de prometer prazo.
        Só aparece quando é `true`: `null` significa "não deu para avaliar", e um
        aviso vermelho dizendo isso treinaria o time a ignorar o aviso vermelho.
      */}
      {consulta.divergencia === true && (
        <div className="mb-1 flex items-start gap-2 rounded-[12px] border-[0.5px] border-error-border bg-error-bg px-2.5 py-2">
          <AlertTriangle className="mt-px size-3 flex-none text-error-text" aria-hidden />
          <p className="text-[11.5px] leading-snug text-text-strong">
            <b>iOn e app discordam.</b> Pagamento compensado e nenhum cupom emitido.
            Padrão de defeito: encaminhe antes de prometer prazo.
          </p>
        </div>
      )}

      {consulta.linhas.map((l) => (
        <Linha key={l.chave} linha={l} />
      ))}

      {consulta.optOut === true && (
        <div className="mt-1 flex items-start gap-2 rounded-[12px] bg-warn-bg px-2.5 py-2">
          <AlertTriangle className="mt-px size-3 flex-none text-warn-text" aria-hidden />
          <p className="text-[11.5px] leading-snug text-text-strong">
            <b>Contato pediu para sair.</b> Não prometa novos envios de campanha.
          </p>
        </div>
      )}

      {consulta.leadUrl && (
        <a
          href={consulta.leadUrl}
          target="_blank"
          rel="noreferrer"
          className="l4-pressable mt-1.5 flex items-center justify-center gap-1.5 rounded-[12px] bg-[var(--l4-fill-3)] px-2 py-1.5 text-[11.5px] font-medium text-text-strong"
        >
          Abrir lead no iOn
          <ExternalLink className="size-3" aria-hidden />
        </a>
      )}
    </div>
  );
}

function Linha({ linha }: { linha: LinhaConsulta }) {
  const temDado = linha.estado === "ok" && linha.valor;
  return (
    <div className="flex flex-col gap-px px-1 py-1">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[11.5px] text-text-secondary">{linha.rotulo}</span>
        {temDado ? (
          <span className="text-right text-[11.5px] font-medium text-text-strong">
            {linha.valor}
          </span>
        ) : (
          /*
            O selo diz de QUEM é a pendência, e essa distinção é o ponto: "sem fonte"
            é contrato que não existe (alguém precisa construir), e "indisponível" é
            algo que existe e não respondeu agora (vai voltar sozinho). Tratar os dois
            como "sem dado" faz o time esperar por uma integração que nunca vem.
          */
          <Badge variant={linha.estado === "sem_fonte" ? "neutral" : "warn"} size="xs">
            {ROTULO[linha.estado]}
          </Badge>
        )}
      </div>
      {!temDado && linha.nota && (
        <span className="text-[10.5px] leading-snug text-text-muted">{linha.nota}</span>
      )}
    </div>
  );
}

const ROTULO: Record<LinhaConsulta["estado"], string> = {
  ok: "ok",
  nao_consta: "não consta",
  sem_fonte: "sem fonte",
  indisponivel: "indisponível",
  nao_identificado: "sem identificação",
};
