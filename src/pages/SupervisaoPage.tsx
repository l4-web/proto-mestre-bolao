import { Link } from "react-router-dom";
import { AlertTriangle, MessageSquareHeart, Users } from "lucide-react";
import {
  Badge,
  BandRow,
  Card,
  Eyebrow,
  KPICard,
  KpiGrade,
  KpiPillRow,
  PageContainer,
  PageHeader,
  PageLoading,
} from "@l4-web/ui";
import type { CsatAtendente, CsatResumo } from "../features/atendimento/tipos";
import {
  useCsatPorAtendenteQuery,
  useEmRiscoQuery,
  useIntegracoesQuery,
  useSupervisaoQuery,
} from "../features/atendimento/atendimento.api";
import { usePracaAtual } from "../features/atendimento/usePracaAtual";
import { useIntervaloPolling } from "../lib/usePolling";
import { Vazio } from "../components/comum/Vazio";
import { Barra } from "../components/comum/Barra";
import {
  CORES_GRAVIDADE,
  COR_STATUS,
  ROTULO_GRAVIDADE,
  ROTULO_STATUS,
  hora,
  prazo,
} from "../components/conversa/util";
import { haQuantoTempo } from "../components/comum/tempo";

/** Rótulo humano do gatilho. `dpo` e `reputacao` são quem sai do CX. */
const ROTULO_GATILHO: Record<
  string,
  { texto: string; cor: "purple" | "error" | "neutral" }
> = {
  reputacao: { texto: "Reputação", cor: "purple" },
  dpo: { texto: "DPO", cor: "error" },
};

export function SupervisaoPage() {
  /**
   * A supervisão RECARREGA sozinha, no mesmo intervalo da caixa de entrada.
   *
   * Ela era a única tela viva do módulo sem polling: o supervisor deixava o painel
   * aberto na parede e via "1 conversa sem dono há mais de 15 minutos" congelado no
   * instante em que abriu a página. Painel de prazo que não se atualiza é pior que
   * painel nenhum, porque parece que nada está acontecendo justamente quando está.
   *
   * Aqui NÃO entra `skipPollingIfUnfocused`, e a diferença é de propósito: esta é a
   * tela que fica num segundo monitor sem foco justamente para ser olhada de longe,
   * e parar de atualizar por falta de foco é o defeito que se está consertando. A
   * economia já vem do `useIntervaloPolling`, que cai de 8s para 60s com a aba
   * escondida.
   */
  const intervalo = useIntervaloPolling();
  const { praca, isLoading: carregandoPraca } = usePracaAtual();
  const empresaId = praca?.empresa_id;

  const { data: s, isFetching } = useSupervisaoQuery(undefined, {
    pollingInterval: intervalo,
  });
  const { data: integracoes } = useIntegracoesQuery(undefined, {
    pollingInterval: intervalo,
  });
  const { data: emRisco } = useEmRiscoQuery(
    { empresaId: empresaId! },
    { skip: !empresaId, pollingInterval: intervalo },
  );
  /**
   * O corte de CSAT por atendente NÃO acompanha o polling do painel.
   *
   * O resto da tela se recarrega a cada 8 segundos porque fila e prazo mudam em
   * segundos. Este corte é de 30 dias e varre atendimento resolvido no banco: no
   * mesmo intervalo, seriam 450 varreduras por hora de painel aberto na parede para
   * um número que muda em escala de dias.
   */
  const { data: csatEquipe } = useCsatPorAtendenteQuery(undefined, {
    pollingInterval: 5 * 60_000,
  });

  /**
   * Quantos da lista já passaram do prazo, comercial ou regulatório.
   *
   * Sai do mesmo `prazo()` que a linha usa, para o título e as linhas nunca
   * discordarem sobre o que é atraso.
   */
  const estourados = (emRisco ?? []).filter(
    (a) =>
      prazo(a.sla_com_resolucao_em)?.estourado ||
      prazo(a.sla_reg_prazo_em)?.estourado,
  ).length;

  if (carregandoPraca || !s)
    return <PageLoading label="Carregando a supervisão" />;

  const online = s.atendentes.filter((a) => a.status === "online");
  const capacidade = online.reduce((t, a) => t + a.capacidade, 0);
  const carga = online.reduce((t, a) => t + a.carga, 0);

  return (
    <PageContainer>
      <PageHeader
        title="Supervisão"
        
        busy={isFetching}
      />

      <KpiGrade colunas={5}>
        <KPICard
          eyebrow="Aguardando"
          value={s.aguardando.total}
          description={`${s.aguardando.semDonoHa15min} sem dono há +15min`}
          color={s.aguardando.semDonoHa15min > 0 ? "error" : "neutral"}
        />
        <KPICard
          eyebrow="SLA em risco"
          value={s.slaEmRisco.total}
          description={`${s.slaEmRisco.criticos} críticos`}
          color={s.slaEmRisco.total > 0 ? "warn" : "neutral"}
        />
        <KPICard
          eyebrow="Ocupação"
          value={
            capacidade > 0
              ? `${Math.round((carga / capacidade) * 100)}%`
              : "sem capacidade"
          }
          description={`${carga} de ${capacidade} vagas ocupadas`}
          color={capacidade > 0 && carga / capacidade > 0.85 ? "warn" : "info"}
        />
        <KPICard
          eyebrow="Resolvidas hoje"
          value={s.resolvidasHoje}
          description={`${s.atendimentosTotal} casos no total`}
          color="success"
        />
        {/* `null` e não 0%: sem sessão de bot ainda, zero por cento pareceria
            medição e é ausência de dado. */}
        <KPICard
          // "do bot" cortava o rótulo ("Escalonament...") na grade de 5 colunas, e
          // rótulo truncado num KPI é o pior lugar para economizar espaço: é o
          // único texto que diz o que o número significa.
          eyebrow="Escalonamento"
          value={
            s.escalonamentoBot === null ? "sem dado" : `${s.escalonamentoBot}%`
          }
          description={`premissa: ${s.premissaEscalonamento}%`}
          color={
            s.escalonamentoBot !== null &&
            s.escalonamentoBot > s.premissaEscalonamento
              ? "warn"
              : "neutral"
          }
        />
      </KpiGrade>

      <Card className="p-4">
        {/*
          O título fala de ESTOURADO primeiro porque a lista é isso.

          O endpoint devolve prazo `<= agora + 30min`, e prazo no passado também
          satisfaz isso: a maior parte da lista costuma ser caso que JÁ venceu. Um
          título que só promete "próximos 30 minutos" faz o supervisor ler atraso
          acumulado como aviso de coisa que vai acontecer, e some com a única
          informação que muda a decisão dele, que é quantos já passaram do prazo.
        */}
        <Eyebrow>
          {estourados > 0
            ? `Prazo estourado (${estourados}) ou vencendo em 30 minutos`
            : "Prazo vencendo nos próximos 30 minutos"}
        </Eyebrow>
        {!emRisco || emRisco.length === 0 ? (
          <Vazio
            icone={AlertTriangle}
            titulo="Nenhum prazo em risco"
            descricao="Os dois relógios estão folgados: comercial e regulatório."
          />
        ) : (
          <ul className="mt-1 flex flex-col divide-y-[0.5px] divide-[var(--l4-surface-borda)]">
            {emRisco.map((a) => {
              const com = prazo(a.sla_com_resolucao_em);
              const reg = prazo(a.sla_reg_prazo_em);
              return (
                <li
                  key={a.id}
                  className="flex items-center justify-between gap-3 py-2.5"
                >
                  <span className="flex min-w-0 flex-col">
                    <span className="flex items-center gap-2">
                      <span className="font-mono text-[12px] font-medium text-text-strong">
                        {a.ref}
                      </span>
                      <Badge variant={CORES_GRAVIDADE[a.gravidade]} size="xs">
                        {ROTULO_GRAVIDADE[a.gravidade]}
                      </Badge>
                      {a.responsavel && (
                        <span className="truncate text-[11px] text-text-secondary">
                          {a.responsavel}
                        </span>
                      )}
                    </span>
                    <span className="min-w-0 truncate text-[12px] text-text-secondary">
                      {a.motivo?.label ?? "Sem motivo"}
                    </span>
                  </span>
                  <span className="flex flex-none flex-col items-end">
                    {com && (
                      <span
                        className={[
                          "text-[11.5px]",
                          com.estourado
                            ? "font-semibold text-error-text"
                            : "text-text-secondary",
                        ].join(" ")}
                      >
                        comercial {com.texto}
                      </span>
                    )}
                    {/* O regulatório em destaque separado: um é acordo de serviço,
                        o outro tem consequência legal. */}
                    {reg && (
                      <span className="text-[11.5px] font-semibold text-error-text">
                        {a.sla_reg_tipo} {reg.texto}
                      </span>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <CartaoCsat csat={s.csat} equipe={csatEquipe?.itens} dias={csatEquipe?.dias} />

      {/*
        `min-w-0` nas duas colunas: a tabela de atendentes tem `min-w-[420px]` e,
        sem piso zero, a faixa implícita da grade no celular é `max-content`, então
        a tabela esticava a coluna e a página inteira rolava para o lado em 375px.
        O `minmax(0,...)` só valia de `lg` para cima, que é onde não fazia falta.
      */}
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Card className="min-w-0 p-4">
          <div className="flex items-center justify-between gap-2 pb-2">
            <Eyebrow>Atendentes</Eyebrow>
            <Badge
              variant={online.length > 0 ? "success" : "neutral"}
              size="xs"
            >
              {online.length} disponível(is)
            </Badge>
          </div>

          {s.atendentes.length === 0 ? (
            <Vazio
              icone={Users}
              titulo="Nenhum atendente na praça"
              descricao="Quem entra em turno aparece aqui com a carga atual."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[420px] text-[12.5px]">
                <thead>
                  <tr className="border-b-[0.5px] border-border-muted text-[10.5px] uppercase tracking-wide text-text-secondary">
                    <th className="py-1.5 text-left font-semibold">Pessoa</th>
                    <th className="py-1.5 text-left font-semibold">Situação</th>
                    <th className="py-1.5 text-left font-semibold">Carga</th>
                    <th className="py-1.5 text-right font-semibold tabular-nums">
                      Vagas
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {s.atendentes.map((a) => (
                    <tr
                      key={a.id}
                      className="border-b-[0.5px] border-border-muted last:border-0"
                    >
                      <td className="py-2 pr-2">
                        <span
                          className="block truncate font-medium text-text-strong"
                          title={a.nome}
                        >
                          {a.nome}
                        </span>
                      </td>
                      <td className="py-2 pr-2">
                        {/*
                          O HÁ QUANTO TEMPO ao lado da situação.
                          "Online" sozinho não distingue quem entrou agora de quem
                          está esquecido em turno desde ontem, e é a segunda que o
                          supervisor precisa ver: pessoa marcada online e ausente
                          recebe caso da distribuição e ele fica parado.
                        */}
                        <span className="flex flex-wrap items-center gap-1">
                          <Badge variant={COR_STATUS[a.status]} size="xs">
                            {ROTULO_STATUS[a.status]}
                          </Badge>
                          {a.status_desde && (
                            <span className="text-[11px] text-text-secondary">
                              há {haQuantoTempo(a.status_desde)}
                            </span>
                          )}
                        </span>
                      </td>
                      <td className="w-[34%] py-2 pr-3">
                        <Barra
                          pct={
                            a.capacidade > 0
                              ? (a.carga / a.capacidade) * 100
                              : 0
                          }
                          titulo={`${a.carga} de ${a.capacidade} conversas`}
                        />
                      </td>
                      <td className="py-2 text-right tabular-nums text-text-secondary">
                        {a.carga}/{a.capacidade}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <div className="flex min-w-0 flex-col gap-3">
          <Card className="p-4">
            <Eyebrow>Integrações</Eyebrow>
            <div className="mt-2 flex flex-col gap-1.5">
              {(integracoes ?? []).length === 0 ? (
                <p className="text-[11.5px] text-text-secondary">
                  Nenhum canal conectado ainda.
                </p>
              ) : (
                (integracoes ?? []).map((i) => (
                  <div
                    key={i.id}
                    className="flex items-center justify-between gap-2 rounded-[12px] bg-[var(--l4-fill-5)] px-2.5 py-2"
                    title={
                      i.subscribed_apps_ok
                        ? `Último evento: ${i.ultimo_evento_em ? hora(i.ultimo_evento_em) : "nunca"}`
                        : "WABA sem App assinado em subscribed_apps: as mensagens somem em silêncio"
                    }
                  >
                    <span className="min-w-0 truncate text-[12px] text-text-strong">
                      {i.rotulo}
                    </span>
                    <Badge
                      size="xs"
                      variant={
                        i.status === "ativo" && i.subscribed_apps_ok
                          ? "success"
                          : "error"
                      }
                    >
                      {i.subscribed_apps_ok ? i.status : "sem App"}
                    </Badge>
                  </div>
                ))
              )}
            </div>
          </Card>

          <Card className="p-4">
            <Eyebrow>Encaminhamentos abertos</Eyebrow>
            <div className="mt-2 flex flex-col gap-1.5">
              {s.encaminhamentosAbertos.length === 0 ? (
                <p className="text-[11.5px] text-text-secondary">
                  Nenhum caso com equipe interna.
                </p>
              ) : (
                s.encaminhamentosAbertos.map((e) => (
                  <div
                    key={e.equipe}
                    className="flex items-baseline justify-between gap-2 rounded-[12px] bg-[var(--l4-fill-5)] px-2.5 py-2"
                  >
                    <span className="text-[12px] text-text-secondary">
                      {e.equipe === "dev"
                        ? "Caixa técnica"
                        : "Caixa financeira"}
                    </span>
                    <span className="text-[14px] font-semibold tabular-nums text-text-strong">
                      {e.total}
                    </span>
                  </div>
                ))
              )}
            </div>
          </Card>

          <Card className="p-4">
            <Eyebrow>Gatilhos disparados hoje</Eyebrow>
            {/*
              ROLA, e cada item LEVA À CONVERSA.
              A lista crescia sem teto e empurrava o resto do painel, e era um beco:
              mostrava que houve um caso de LGPD ou de Procon e não levava a lugar
              nenhum, então o supervisor procurava a conversa na mão justamente no
              caso que tem prazo legal correndo.
            */}
            <div className="mt-2 flex max-h-[260px] flex-col gap-1.5 overflow-y-auto">
              {s.gatilhosHoje.length === 0 ? (
                <p className="text-[11.5px] leading-snug text-text-secondary">
                  Nenhum. Gatilho é o motivo que notifica gente de fora do CX:
                  DPO em privacidade, reputação em Procon e Reclame Aqui.
                </p>
              ) : (
                s.gatilhosHoje.map((g) => (
                  <Link
                    key={g.id}
                    to={`../conversas?conversa=${g.conversa_id}`}
                    className="l4-pressable block rounded-[12px] bg-[var(--l4-fill-5)] px-2.5 py-2 text-left transition-colors hover:bg-[var(--l4-fill-4)]"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex flex-wrap gap-1">
                        {g.gatilhos.map((x) => (
                          <Badge
                            key={x}
                            size="xs"
                            variant={ROTULO_GATILHO[x]?.cor ?? "neutral"}
                          >
                            {ROTULO_GATILHO[x]?.texto ?? x}
                          </Badge>
                        ))}
                      </span>
                      <span className="flex-none text-[10.5px] tabular-nums text-text-secondary">
                        {hora(g.em)}
                      </span>
                    </div>
                    <p className="mt-1 text-[11.5px] leading-snug text-text-strong">
                      {g.motivo} · <span className="font-mono">{g.ref}</span>
                    </p>
                  </Link>
                ))
              )}
            </div>
          </Card>
        </div>
      </div>
    </PageContainer>
  );
}

/**
 * Tom da média de satisfação. Os cortes são da escala de três pontos que o WhatsApp
 * permite (5 Ótimo, 3 Regular, 1 Ruim), e não de uma régua de 0 a 10 emprestada de
 * outro lugar: numa escala assim, 3,0 é literalmente "regular na média".
 */
function tomDaMedia(media: number | null): "success" | "warn" | "error" | "neutral" {
  if (media === null) return "neutral";
  if (media < 3) return "error";
  if (media < 4.2) return "warn";
  return "success";
}

/**
 * A NOTA DO CLIENTE NO PAINEL, nos quatro estados e com o corte por pessoa.
 *
 * O módulo coletava CSAT e não mostrava em lugar nenhum, e para quem usa isso é
 * indistinguível de não coletar. Este cartão é a leitura da supervisão.
 *
 * SÃO QUATRO PILARES E NÃO TRÊS, e é a razão de o cartão existir desse jeito:
 * "perguntamos e ninguém respondeu" e "não chegamos a perguntar" viram um balde só
 * de "não avaliado" quando alguém tenta simplificar, e é nesse balde que o time
 * cobra o atendente por janela de 24h fechada, que é regra da Meta.
 *
 * `csat` é opcional porque front e API sobem separados: sem o campo, o cartão não
 * aparece, em vez de desenhar quatro zeros que pareceriam medição.
 */
function CartaoCsat({
  csat,
  equipe,
  dias,
}: {
  csat?: CsatResumo;
  equipe?: CsatAtendente[];
  dias?: number;
}) {
  if (!csat) return null;

  const maiorFatia = Math.max(1, ...csat.distribuicao.map((d) => d.total));

  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-center justify-between gap-2 pb-2">
        <Eyebrow>Satisfação do cliente (CSAT)</Eyebrow>
        {/*
          DE QUEM É O JULGAMENTO, escrito.

          O selo não é enfeite: sem ele, um número de satisfação num painel interno lê
          como avaliação nossa sobre nós mesmos. Esta nota é a do participante,
          respondida por botão no WhatsApp depois do encerramento.
        */}
        <Badge size="xs" variant="neutral">
          respondido pelo cliente
        </Badge>
      </div>

      {csat.resolvidos === 0 ? (
        <Vazio
          icone={MessageSquareHeart}
          titulo="Nenhum caso encerrado hoje"
          descricao="A pesquisa de satisfação sai no encerramento, então ainda não há o que medir."
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div className="flex min-w-0 flex-col gap-3">
            {/*
              Os QUATRO estados como pílulas, e não como um "não avaliado" único.

              `layout="grid"` com duas colunas no celular: em 375px, quatro pílulas em
              carrossel esconderiam metade da informação atrás de uma rolagem que
              ninguém descobre.
            */}
            <KpiPillRow
              layout="grid"
              cols={4}
              items={[
                {
                  label: "Avaliaram",
                  value: csat.avaliados,
                  tone: "success",
                  hint:
                    csat.taxaResposta === null
                      ? "ninguém foi perguntado"
                      : `${csat.taxaResposta}% de quem foi perguntado`,
                  subdued: csat.avaliados === 0,
                },
                {
                  label: "Média",
                  // `null` e não 0: sem resposta nenhuma, zero pareceria "todo mundo
                  // odiou", que é o oposto de ausência de dado.
                  value: csat.media === null ? "sem dado" : csat.media.toFixed(1),
                  tone: tomDaMedia(csat.media),
                  hint: "de 1 a 5",
                  subdued: csat.media === null,
                },
                {
                  label: "Sem resposta",
                  value: csat.semResposta,
                  tone: "neutral",
                  hint: "perguntamos e não voltou",
                  subdued: csat.semResposta === 0,
                },
                {
                  label: "Sem pesquisa",
                  value: csat.semPergunta,
                  tone: "neutral",
                  // O PORQUÊ vai junto do número, e não num rodapé.
                  // "Sem pesquisa" sozinho ao lado de "sem resposta" lê como a mesma
                  // coisa, e a diferença é justamente que aqui não houve falha de
                  // ninguém: a janela de 24h da Meta fechou antes do encerramento.
                  hint: "janela de 24h fechada",
                  subdued: csat.semPergunta === 0,
                },
              ]}
            />

            <div className="flex flex-col gap-1.5">
              {csat.distribuicao.map((d) => (
                <BandRow
                  key={d.nota}
                  label={d.rotulo}
                  ratio={d.total / maiorFatia}
                  value={d.total}
                  tone={tomDaMedia(d.nota)}
                  labelWidth={72}
                  title={`${d.total} de ${csat.avaliados} respostas foram "${d.rotulo}"`}
                />
              ))}
            </div>

            <p className="text-[11px] leading-snug text-text-muted">
              {csat.resolvidos} caso(s) encerrado(s) hoje. A pesquisa sai no
              encerramento e vale por caso, não por conversa.
            </p>
          </div>

          <div className="flex min-w-0 flex-col gap-2">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <Eyebrow>Por atendente</Eyebrow>
              {/*
                A JANELA ESCRITA, porque ela é OUTRA.

                Os números da esquerda são do dia. Este corte é de 30 dias porque num
                único dia quase ninguém junta amostra para uma média significar coisa
                alguma, e a coluna inteira nasceria "sem amostra". Sem o texto, o
                supervisor lê como "hoje" e conclui a coisa errada sobre a pessoa.
              */}
              <span className="text-[11px] text-text-secondary">
                últimos {dias ?? 30} dias
              </span>
            </div>

            {!equipe || equipe.length === 0 ? (
              <Vazio
                icone={Users}
                titulo="Nenhum caso encerrado no período"
                descricao="A nota aparece aqui assim que os primeiros casos forem encerrados."
              />
            ) : (
              <div className="flex flex-col gap-1.5">
                {equipe.map((a) => (
                  <BandRow
                    key={a.user_id ?? "sem-dono"}
                    label={a.nome}
                    description={
                      // O N SEMPRE AO LADO. Média de CSAT com três respostas não é
                      // indicador, é ruído: um "Ruim" derruba mais de um ponto inteiro
                      // numa escala de 1 a 5.
                      a.media === null
                        ? `${a.avaliados} de ${a.resolvidos} avaliadas, amostra abaixo de ${a.minimoParaMedia}`
                        : `${a.avaliados} de ${a.resolvidos} avaliadas · ${a.semResposta} sem resposta · ${a.semPergunta} sem pesquisa`
                    }
                    ratio={a.media === null ? 0 : a.media / 5}
                    // Abaixo do piso de amostra a tela NÃO desenha número: mostra o
                    // tamanho da amostra, que é a informação honesta que existe.
                    value={
                      a.media === null ? (
                        <span className="text-[11px] text-text-muted">
                          {a.avaliados} resp.
                        </span>
                      ) : (
                        a.media.toFixed(1)
                      )
                    }
                    tone={tomDaMedia(a.media)}
                    labelWidth={104}
                    title={[
                      a.nome,
                      a.media === null
                        ? `Sem média: ${a.avaliados} resposta(s), o mínimo é ${a.minimoParaMedia}.`
                        : `Média ${a.media.toFixed(1)} em ${a.avaliados} respostas.`,
                      ...a.distribuicao.map((d) => `${d.rotulo}: ${d.total}`),
                      `${a.semPergunta} caso(s) sem pesquisa (janela de 24h fechada, não é falha do atendimento).`,
                    ].join("\n")}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}
