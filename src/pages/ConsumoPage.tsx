import { AlertTriangle, TrendingUp } from "lucide-react";
import {
  Badge,
  Card,
  Eyebrow,
  KPICard,
  KpiGrade,
  PageContainer,
  PageHeader,
  PageLoading,
} from "@l4-web/ui";
import {
  useConsumoQuery,
  useConsumoSerieQuery,
} from "../features/atendimento/atendimento.api";
import { Barra } from "../components/comum/Barra";

const reais = (v: number) =>
  v.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
  });

/**
 * A data da virada por extenso. Lida em UTC (`timeZone: "UTC"`) porque o instante
 * que a API manda é meia-noite UTC: no fuso de Brasília, deixar o navegador
 * converter faz `2026-10-01T00:00:00Z` virar 30 de setembro na tela.
 */
const dataDaCobranca = (iso: string) =>
  new Date(iso).toLocaleDateString("pt-BR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });

/** Só o mês, para a legenda e o rótulo do indicador. Mesma razão do fuso. */
const mesDaCobranca = (iso: string) =>
  new Date(iso).toLocaleDateString("pt-BR", { month: "long", timeZone: "UTC" });

const ROTULO_CATEGORIA: Record<string, string> = {
  service: "Serviço",
  utility: "Utilidade",
  authentication: "Autenticação",
  marketing: "Marketing",
  nenhuma: "Sem cobrança",
};

export function ConsumoPage() {
  const { data: c, isLoading, isFetching } = useConsumoQuery();
  const { data: serie } = useConsumoSerieQuery({ dias: 14 });

  if (isLoading || !c) return <PageLoading label="Carregando o consumo" />;

  const maxQtd = Math.max(1, ...(serie ?? []).map((d) => d.qtd));

  return (
    <PageContainer>
      <PageHeader
        title="Consumo e custo"
        
        busy={isFetching}
      />
      {/* O marco que manda no módulo. Fica no topo porque muda decisão de produto,
          não só de fatura: cada passo do menu do bot passa a ter preço. */}
      <div className="flex items-start gap-2.5 rounded-[16px] bg-warn-bg px-3.5 py-2.5">
        <AlertTriangle
          className="mt-0.5 size-3.5 flex-none text-warn-text"
          aria-hidden
        />
        <p className="text-[12px] leading-relaxed text-text-strong">
          {/*
            A DATA VEM DA API (`cobrancaComeca`), e não escrita aqui.

            Ela estava fixa no texto como "1º de outubro de 2026", enquanto o
            mesmo endpoint que alimenta este cartão já devolvia o instante e o
            `jaCobra` calculado a partir dele. Data de virada de cobrança escrita
            na tela é a que ninguém lembra de mudar: adiada uma semana pela Meta,
            o módulo passaria a anunciar um prazo que não existe mais, e a
            projeção ao lado continuaria certa, o que é pior que as duas erradas.
          */}
          <b>{dataDaCobranca(c.cobrancaComeca)}.</b> Mensagens de serviço deixam
          de ser gratuitas e passam a ser cobradas por mensagem,{" "}
          <b>sem desconto por volume</b>. Os valores abaixo usam{" "}
          {c.tarifa ? <b>{reais(c.tarifa.reais)}</b> : "a estimativa"} por
          mensagem e precisam ser reconfirmados antes de virar proposta
          comercial.
          {c.tarifa?.fonte && (
            <span className="mt-0.5 block text-[11px] text-text-secondary">
              Fonte da tarifa: {c.tarifa.fonte}
            </span>
          )}
        </p>
      </div>

      <KpiGrade>
        <KPICard
          eyebrow="Mensagens no mês"
          value={c.mensagensNoMes.toLocaleString("pt-BR")}
          description="entrada e respostas"
        />
        <KPICard
          eyebrow="Custo hoje"
          value={reais(c.custoHojeReais)}
          description={c.jaCobra ? "já cobrado" : "janela gratuita"}
          color={c.jaCobra ? "warn" : "success"}
        />
        <KPICard
          eyebrow={`Projeção de ${mesDaCobranca(c.cobrancaComeca)}`}
          value={reais(c.projecaoReais)}
          description="à tarifa estimada"
          color="warn"
        />
        <KPICard
          eyebrow="Msgs por resolvido"
          value={c.mensagensPorResolvido ?? "sem dado"}
          description={`meta: ${c.metaMensagensPorResolvido}`}
          color={
            c.mensagensPorResolvido !== null &&
            c.mensagensPorResolvido > c.metaMensagensPorResolvido
              ? "warn"
              : "neutral"
          }
        />
      </KpiGrade>

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Card className="p-4">
          <div className="flex items-baseline justify-between gap-2 pb-3">
            <Eyebrow>Últimos 14 dias</Eyebrow>
            <span className="flex items-center gap-1 text-[11px] text-text-secondary">
              <TrendingUp className="size-3" aria-hidden /> mensagens por dia
            </span>
          </div>

          {/* Barras em vez de linha: o dado é contagem diária, e volume por dia lê
              como comparação entre dias, não como tendência contínua. */}
          <div className="flex h-[140px] items-end gap-1">
            {(serie ?? []).map((d) => (
              <div
                key={d.dia}
                className="group flex min-w-0 flex-1 flex-col items-center justify-end gap-1"
                title={`${new Date(d.dia).toLocaleDateString("pt-BR")}: ${d.qtd} mensagens · ${reais(d.reais)}`}
              >
                <span
                  className="w-full rounded-t-[4px] bg-brand/70 transition-colors group-hover:bg-brand"
                  style={{ height: `${Math.max(3, (d.qtd / maxQtd) * 118)}px` }}
                />
                <span className="w-full truncate text-center text-[9px] tabular-nums text-text-muted">
                  {new Date(d.dia).getUTCDate()}
                </span>
              </div>
            ))}
          </div>
        </Card>

        <div className="flex flex-col gap-3">
          <Card className="p-4">
            <Eyebrow>Por categoria de cobrança</Eyebrow>
            <div className="mt-2 flex flex-col gap-px">
              {c.porCategoria.length === 0 ? (
                <p className="text-[11.5px] text-text-secondary">
                  Nenhuma mensagem no mês.
                </p>
              ) : (
                c.porCategoria.map((k) => (
                  <div
                    key={k.categoria}
                    className="flex items-baseline justify-between gap-3 rounded-[12px] bg-[var(--l4-fill-5)] px-2.5 py-2"
                  >
                    <span className="text-[12px] text-text-secondary">
                      {ROTULO_CATEGORIA[k.categoria] ?? k.categoria}
                    </span>
                    <span className="text-right">
                      <span className="block text-[12.5px] font-semibold tabular-nums text-text-strong">
                        {reais(k.reais)}
                      </span>
                      <span className="block text-[10.5px] tabular-nums text-text-secondary">
                        {k.qtd.toLocaleString("pt-BR")} msgs
                      </span>
                    </span>
                  </div>
                ))
              )}
            </div>
          </Card>

          <Card className="p-4">
            <Eyebrow>Teto de consumo</Eyebrow>
            {!c.teto ? (
              <p className="mt-2 text-[11.5px] leading-snug text-text-secondary">
                Sem teto configurado. Depois de 1º de outubro isto passa a ser a
                única proteção contra a conta escalar sem ninguém ver.
              </p>
            ) : (
              <>
                <div className="mt-2 flex items-baseline justify-between gap-2">
                  <span className="text-[12px] text-text-secondary">
                    {reais(c.projecaoReais)} de {reais(c.teto.reais)}
                  </span>
                  <Badge
                    size="xs"
                    variant={
                      c.teto.usoPct >= 100
                        ? "error"
                        : c.teto.usoPct >= c.teto.alertaPct
                          ? "warn"
                          : "success"
                    }
                  >
                    {c.teto.usoPct}%
                  </Badge>
                </div>
                <div className="mt-1.5">
                  <Barra
                    pct={c.teto.usoPct}
                    titulo={`${c.teto.usoPct}% do teto do mês`}
                  />
                </div>
                <p className="mt-2 text-[11px] leading-snug text-text-secondary">
                  Alerta em {c.teto.alertaPct}%. Ao estourar, a ação configurada
                  é <b>{c.teto.acao}</b>.
                </p>
              </>
            )}
          </Card>

          <Card className="p-4">
            <Eyebrow>Por que isto não aparece para quem atende</Eyebrow>
            <p className="mt-2 text-[11.5px] leading-relaxed text-text-secondary">
              Número de custo ao lado do campo de resposta faz a pessoa escolher
              entre resolver bem e gastar pouco, e essa decisão não é dela.
              Consumo é assunto de gestão e vive só aqui.
            </p>
          </Card>
        </div>
      </div>
    </PageContainer>
  );
}
