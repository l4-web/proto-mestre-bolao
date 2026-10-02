import { Info, Radar } from "lucide-react";
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
  useEscutaCanaisQuery,
  useEscutaResumoQuery,
  useEscutaTemasQuery,
} from "../features/atendimento/atendimento.api";
import { Vazio } from "../components/comum/Vazio";
import { useProduto } from "../lib/produto-contexto";
import { palavra, plural } from "../lib/plural";

const ROTULO_REDE: Record<string, string> = {
  instagram: "Instagram",
  facebook: "Facebook",
  tiktok: "TikTok",
};

/**
 * Nuvem de termos. Tamanho por frequência, e é justamente aí que está a ressalva
 * de método que o protótipo escreve: a nuvem ordena por FREQUÊNCIA, não por
 * importância, então ela é a porta de entrada visual e quem decide é a tabela de
 * temas ao lado.
 *
 * Sem lista de palavras ignoradas ela viraria uma lista de preposições com o nome
 * da marca no meio; por isso os termos vêm já clusterizados por tema, não do texto
 * cru dos comentários.
 */
function Nuvem({
  termos,
}: {
  termos: { termo: string; frequencia: number; negativo: boolean }[];
}) {
  if (termos.length === 0) {
    return (
      <p className="px-1 py-6 text-center text-[12px] text-text-secondary">
        Nenhum termo no período.
      </p>
    );
  }
  const max = Math.max(...termos.map((t) => t.frequencia));
  const min = Math.min(...termos.map((t) => t.frequencia));
  const escala = (f: number) => {
    if (max === min) return 22;
    return 13 + Math.round(((f - min) / (max - min)) * 20);
  };

  return (
    <div className="flex flex-wrap items-baseline justify-center gap-x-3 gap-y-1.5 px-3 py-4">
      {termos.map((t) => (
        <span
          key={t.termo}
          title={`${t.termo}: ${t.frequencia} menções`}
          className={
            t.negativo ? "font-semibold text-error-text" : "text-text-secondary"
          }
          style={{ fontSize: escala(t.frequencia), lineHeight: 1.1 }}
        >
          {t.termo}
        </span>
      ))}
    </div>
  );
}

export function EscutaPage() {
  // O produto da barra lateral recorta a escuta inteira, igual ao resto do módulo.
  const { produto } = useProduto();
  const { data: resumo, isLoading } = useEscutaResumoQuery({ produto: produto || undefined });
  const { data: temas, isFetching } = useEscutaTemasQuery({ produto: produto || undefined });
  const { data: canais } = useEscutaCanaisQuery();

  if (isLoading || !resumo) return <PageLoading label="Carregando a escuta" />;

  const termos = (temas ?? []).flatMap((t) =>
    t.termos.map((x) => ({
      termo: x.termo,
      frequencia: x.frequencia,
      /**
       * A cor saiu junto com a coluna de variação, e pelo mesmo motivo.
       *
       * Ela vinha de `variacao > 50`, que sobre base de uma a três menções é ruído de
       * amostra. Esconder o número na tabela e continuar pintando a nuvem com ele
       * deixaria o mesmo erro no lugar onde ninguém consegue conferir de onde veio.
       */
      negativo: false,
    })),
  );


  return (
    <PageContainer>
      <PageHeader
        title="Escuta"
        
        busy={isFetching}
        /*
          O SELETOR DE 7/30 DIAS SAIU DAQUI, e não foi por desenho.

          Ele era um segmentado feito à mão (o DS tem `SegmentedControl`, que já
          resolve isso) ligado a um `useState` que NENHUMA das três consultas
          desta tela recebia: `/escuta/resumo`, `/escuta/temas` e `/escuta/canais`
          não aceitam período. Clicar em "30 dias" acendia o botão e não mudava
          número nenhum, então o gestor lia os mesmos 19% de negativo como se
          fossem de dois recortes diferentes. Controle que mente sobre o dado é
          pior que não ter recorte.

          O recorte de período volta quando a API aceitar `dias`, e aí como
          `SegmentedControl` do DS. A pendência está no relatório.
        */
      />

      {/* O escopo tem que estar na tela, não só no documento: prometer escuta
          completa sem provedor contratado é prometer o que a API da Meta não dá. */}
      <div className="flex items-start gap-2.5 rounded-[16px] bg-info-bg px-3.5 py-2.5">
        <Info
          className="mt-0.5 size-3.5 flex-none text-info-text"
          aria-hidden
        />
        <p className="text-[12px] leading-relaxed text-text-strong">
          <b>Escopo da escuta.</b> Os dados vêm dos <b>canais próprios</b>,
          comentários e DMs de perfis que a praça administra, entregues pela API
          da Meta. Menção à marca fora deles, post de terceiro, grupo, Reclame
          Aqui, a Meta não entrega: exige ferramenta de listening contratada.
        </p>
      </div>

      {/* O DENOMINADOR aparece em todo cartão, e não é preciosismo de redação.
          "Sentimento negativo 20%" lê como 20% do que o público acha da marca, e é
          20% dos comentários que ESTE módulo coletou nos canais próprios da praça.
          Percentual sem denominador numa tela de escuta é a métrica mais fácil de
          citar errado numa reunião, porque ela parece pesquisa de opinião. */}
      <KpiGrade>
        <KPICard
          // "coletados" cortava o rótulo na grade de 4 colunas, e o número já vem
          // com "nos canais próprios" logo abaixo dizendo o que foi coletado.
          eyebrow="Comentários"
          value={resumo.comentarios}
          description={`nos canais próprios, ${plural((canais ?? []).length, "rede", "redes")} ${palavra((canais ?? []).length, "conectada", "conectadas")}`}
        />
        <KPICard
          eyebrow="Sentimento negativo"
          value={`${resumo.pctNegativo}%`}
          description={`${resumo.negativos} dos ${resumo.comentarios} coletados`}
          color={resumo.pctNegativo > 20 ? "warn" : "neutral"}
        />
        <KPICard
          eyebrow="Viraram atendimento"
          value={resumo.viraramCaso}
          description={`${resumo.pctViraramCaso}% dos coletados`}
          color="info"
        />
        {/* Perfil falso é problema de segurança, não de CX: enquanto o golpe está
            no ar, cada resposta oficial no post dá credibilidade ao thread. */}
        <KPICard
          eyebrow="Suspeita de golpe"
          value={resumo.suspeitaGolpe}
          description={`${plural(resumo.ocultados, "ocultado", "ocultados")}`}
          color={resumo.suspeitaGolpe > 0 ? "error" : "neutral"}
        />
      </KpiGrade>

      {/*
        `min-w-0` nas duas colunas, e isto conserta rolagem lateral REAL em 375px.

        A tabela de temas tem `min-w-[520px]` dentro do próprio `overflow-x-auto`,
        que é o certo. O que não era certo é a coluna da grade: sem piso zero, a
        faixa implícita do celular é `auto`, ou seja, `max-content`, então os 520px
        da tabela esticavam a coluna e o `main` inteiro passava de 365px. Medido: a
        nuvem de termos e o cartão de temas saíam pela direita e a página ganhava
        barra de rolagem horizontal. O `minmax(0,...)` já existia, mas só a partir
        de `lg`, que é onde o problema não acontece.
      */}
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-3">
          <Card className="p-4">
            <Eyebrow>O que estão falando</Eyebrow>
            <Nuvem termos={termos} />
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t-[0.5px] border-border-muted pt-2 text-[10.5px] text-text-secondary">
              <span className="flex items-center gap-1.5">
                <span className="size-2 rounded-sm bg-error-accent" /> em alta
              </span>
              <span className="flex items-center gap-1.5">
                <span className="size-2 rounded-sm bg-[var(--atd-text-3)]" />{" "}
                estável
              </span>
              <span>tamanho = frequência</span>
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2 pb-2">
              <Eyebrow>Temas</Eyebrow>
              <span className="text-[11px] text-text-secondary">
                clusterizados e ligados à taxonomia da fila
              </span>
            </div>

            {!temas || temas.length === 0 ? (
              <Vazio
                icone={Radar}
                titulo="Nenhum tema no período"
                descricao="Os temas aparecem quando houver comentário coletado."
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[520px] text-[12.5px]">
                  <thead>
                    <tr className="border-b-[0.5px] border-border-muted text-[10.5px] uppercase tracking-wide text-text-secondary">
                      <th className="py-1.5 text-left font-semibold">Tema</th>
                      <th className="py-1.5 text-left font-semibold">
                        Motivo correspondente
                      </th>
                      <th className="py-1.5 text-right font-semibold">
                        Menções
                      </th>
                      {/*
                        A VARIAÇÃO SAIU DA TELA, por ora.

                        Ela é percentual sobre base minúscula: com 93 comentários na
                        janela e temas de 1 a 3 menções, "+200%" é uma menção virando
                        três e "-71%" é ruído de amostra. Número que parece preciso e
                        não é vale menos que número nenhum, porque alguém decide em
                        cima dele.

                        Volta quando houver volume que sustente a comparação, e aí com
                        piso de base (não comparar percentual abaixo de N menções).
                      */}
                      <th className="py-1.5 text-right font-semibold">
                        Na fila
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {temas.map((t) => (
                      <tr
                        key={t.id}
                        className="border-b-[0.5px] border-border-muted last:border-0"
                      >
                        <td className="py-2 pr-2 font-medium text-text-strong">
                          {t.rotulo}
                        </td>
                        <td className="py-2 pr-2 text-text-secondary">
                          {t.motivo ? (
                            t.motivo.caminho
                          ) : (
                            <span
                              className="text-text-muted"
                              title="Tema sem motivo amarrado: a escuta não conversa com a fila aqui"
                            >
                              sem amarração
                            </span>
                          )}
                        </td>
                        <td className="py-2 text-right tabular-nums text-text-strong">
                          {t.volume}
                        </td>
                        <td className="py-2 text-right tabular-nums">
                          {t.abertasNoMotivo === null ? (
                            <span className="text-text-muted">-</span>
                          ) : (
                            <Badge
                              size="xs"
                              variant={
                                t.abertasNoMotivo > 0 ? "warn" : "neutral"
                              }
                            >
                              {t.abertasNoMotivo}
                            </Badge>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>

        <div className="flex min-w-0 flex-col gap-3">
          <Card className="p-4">
            <Eyebrow>Canais monitorados</Eyebrow>
            <div className="mt-2 flex flex-col gap-1.5">
              {(canais ?? []).length === 0 ? (
                <p className="text-[11.5px] text-text-secondary">
                  Nenhum canal social conectado.
                </p>
              ) : (
                (canais ?? []).map((c) => (
                  <div
                    key={c.rede}
                    className="flex items-center justify-between gap-2 rounded-[12px] bg-[var(--l4-fill-5)] px-2.5 py-2"
                  >
                    <span className="text-[12px] text-text-strong">
                      {ROTULO_REDE[c.rede] ?? c.rede}
                    </span>
                    <span className="text-[12px] font-semibold tabular-nums text-text-secondary">
                      {c.comentarios}
                    </span>
                  </div>
                ))
              )}
            </div>
          </Card>

          <Card className="p-4">
            <Eyebrow>Ressalva do método</Eyebrow>
            <p className="mt-2 text-[11.5px] leading-relaxed text-text-secondary">
              A nuvem ordena por <b>frequência</b>, não por importância: uma
              palavra rara pode valer mais que uma comum. Use a nuvem para
              entrar no assunto e a tabela de temas para decidir.
            </p>
          </Card>
        </div>
      </div>
    </PageContainer>
  );
}
