import { useEffect, useRef, useState } from "react";
import {
  Card,
  ControleLinha,
  Eyebrow,
  KPICard,
  KpiGrade,
  PageContainer,
  PageHeader,
  PageLoading,
  PainelControles,
  SelectPill,
} from "@l4-web/ui";
import {
  useEdicoesQuery,
  useLacunasQuery,
  useProntidaoBotQuery,
  useProntidaoQuery,
} from "../features/atendimento/atendimento.api";
import { usePracaAtual } from "../features/atendimento/usePracaAtual";
import { GestaoEdicoes } from "../components/base/GestaoEdicoes";
import { SituacoesDoBot, type SubFiltro } from "../components/base/SituacoesDoBot";
import { TestarBot } from "../components/base/TestarBot";
import { useAbility } from "../lib/ability";
import { MODULE_ID } from "../nav";
import { dataHora } from "../components/conversa/util";

/**
 * A BASE DE CONHECIMENTO, que agora inclui o que era a aba "Bot" de Configurações.
 *
 * As duas telas escreviam e liam a MESMA tabela: a aba Bot gravava em `atd_artigo` +
 * `atd_artigo_versao` por `POST /motivos/:id/resposta`, que é exatamente o que esta
 * página lia em `GET /base/artigos`. Não eram dois assuntos, eram duas janelas para o
 * mesmo, com dois seletores de edição, oito indicadores e duas permissões diferentes.
 *
 * O corte que sobrou é o que separa CONTEÚDO de OPERAÇÃO: taxonomia, resposta e artigo
 * são o que o bot DIZ ao cliente, e ficam aqui; canal, alocação, compliance e
 * expediente são COMO o módulo opera, e ficam em Configurações.
 *
 * O que veio de lá e o que aconteceu com cada peça:
 *  • o seletor "Escrevendo para" FUNDIU com o seletor de edição desta página (eram a
 *    mesma pergunta: ninguém lê uma edição enquanto escreve para outra);
 *  • os quatro indicadores do bot mais os quatro daqui viraram quatro, escolhidos por
 *    serem os que alguém precisa levar a zero;
 *  • o aviso amarelo "N sem frase de reconhecimento" virou indicador, porque era uma
 *    faixa tingida dizendo um número que a grade já sabia mostrar;
 *  • a lista de itens do cartão de prontidão saiu: ela repetia, título por título, os
 *    artigos `por_edicao` que a lista de artigos logo abaixo já mostrava com o texto,
 *    o escopo e o histórico. Sobrou a barra, que é o que a lista não dava.
 *
 * ── A SITUAÇÃO É O ÚNICO OBJETO, e a LISTA DE ARTIGOS SAIU ────────────────────
 * A unificação acima deixou a página com DUAS listas lendo a mesma linha do banco: as
 * situações e os artigos. Não era coincidência, era a mesma coisa: o passo "Resposta"
 * da situação grava em `atd_artigo` reaproveitando a linha existente, então cada
 * situação tem no máximo um artigo, e o bot o lê por `motivo_id`. A resposta É o artigo.
 *
 * A lista de artigos foi embora, e com ela a rota `GET /base/artigos`. O que ela
 * mostrava e ninguém mais mostrava virou campo da SITUAÇÃO (escopo, se sai na FAQ
 * pública, estado da versão, a edição da versão, a pendência e o histórico), e a barra
 * de prontidão foi para o cartão da edição, que é o que ela mede.
 *
 * O único dado que ela mostrava e que nenhuma tela mostra hoje é o artigo ÓRFÃO
 * (`motivo_id` nulo): esse o bot NUNCA diz, porque procura por `motivo_id`. Ele é
 * resíduo de seed, e a conta dele saiu da tela para `scripts/orfaos-artigo.mjs`, na
 * API: uma lista na tela convidaria a tratar resíduo como conteúdo.
 *
 * ── E DIZER QUAL É A EDIÇÃO VIGENTE ───────────────────────────────────────────
 * O cartão `GestaoEdicoes` é novo e responde a pergunta que a página não respondia:
 * qual edição está no ar, e como se troca. Ele fica logo abaixo do seletor porque é a
 * mesma edição, e antes dos indicadores de conteúdo porque é o recorte deles.
 */

export function BasePage() {
  const { praca, isLoading: carregandoPraca } = usePracaAtual();
  const produtos = praca?.produtos.filter((p) => p.ativo) ?? [];
  /**
   * O produto é um SELETOR, e antes era o primeiro ativo, escolhido em silêncio.
   *
   * A aba Bot desenhava um bloco por produto de propósito, para o segundo produto sem
   * cenário nenhum não passar despercebido. Aqui isso não cabe: a página carrega
   * indicadores, caixa de teste, situações, artigos e lacunas, e repetir tudo por
   * produto dobraria uma tela que já é longa. Um seletor mostra que existe mais de um,
   * que é a parte que o silêncio de hoje não mostra, e só aparece quando há mais de um.
   */
  const [produtoEscolhido, setProdutoEscolhido] = useState("");
  const produto =
    produtos.find((p) => p.produto_slug === produtoEscolhido)?.produto_slug ??
    produtos[0]?.produto_slug ??
    "";

  const { data: edicoes } = useEdicoesQuery({ produto }, { skip: !produto });
  const [edicaoId, setEdicaoId] = useState("");
  /**
   * O INDICADOR CLICADO. Ele contava e nao levava a lugar nenhum, e a pergunta que
   * sobrava era "quais sao?": ler "3 sem frase" e ter que caçar as tres na lista de
   * 137 e o que faz o numero parecer inutil.
   */
  const [subFiltro, setSubFiltro] = useState<SubFiltro>(null);
  const listaRef = useRef<HTMLDivElement | null>(null);

  function filtrarPor(v: SubFiltro) {
    // Clicar de novo no mesmo cartao DESLIGA, senao o unico jeito de voltar seria
    // achar a pilula, e o cartao viraria uma porta de mao unica.
    setSubFiltro((atual) => (atual === v ? null : v));
    // A lista fica abaixo dos indicadores e da caixa de teste: sem rolar, o clique
    // parece nao ter feito nada em tela de laptop.
    requestAnimationFrame(() => listaRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }

  // A edição vigente é o recorte padrão: é a que está no ar e a que trava campanha.
  //
  // A edição escolhida é DE UM PRODUTO, então trocar de praça (ou de produto) a
  // invalida: sem limpar, a tela pediria os artigos do produto novo com o `edicaoId` do
  // antigo e voltaria vazia, que é indistinguível de "esta edição não tem artigo".
  useEffect(() => {
    if (edicaoId && !edicoes?.some((e) => e.id === edicaoId)) {
      setEdicaoId("");
      return;
    }
    if (!edicaoId && edicoes?.length) {
      setEdicaoId((edicoes.find((e) => e.vigente) ?? edicoes[0]).id);
    }
  }, [edicoes, edicaoId]);

  const { data: prontidao } = useProntidaoQuery(
    { produto, edicaoId },
    { skip: !produto || !edicaoId },
  );
  /**
   * A prontidão do bot passou a ser POR EDIÇÃO, e os indicadores junto.
   *
   * Sem o recorte, a API resolvia a resposta pela versão mais nova de qualquer edição:
   * "Falta a resposta" ficava em zero depois da virada mesmo com o bot escalando todos
   * os assuntos `por_edicao`, porque o texto da edição anterior ainda existia.
   */
  const { data: bot, isFetching } = useProntidaoBotQuery(
    { produto, edicaoId: edicaoId || undefined },
    { skip: !produto },
  );
  const { data: lacunas } = useLacunasQuery();
  const ability = useAbility();
  const podeGerenciar =
    ability?.can(`${MODULE_ID}:base.gerenciar`, "view", { default: false }) ?? false;

  if (carregandoPraca) return <PageLoading label="Carregando a base" />;

  const edicao = edicoes?.find((e) => e.id === edicaoId);
  const abertas = (lacunas ?? []).filter((l) => !l.resolvido);
  const pctBot = bot ? Math.round((bot.respondeSozinho / Math.max(1, bot.total)) * 100) : 0;
  /**
   * Escrever para a edição QUE JÁ ESTÁ NO AR é escrever a regra geral; escrever para
   * uma que ainda não virou é, por definição, escrever só para ela.
   *
   * O padrão importa: resposta amarrada a uma edição para de ser dita na virada, e o
   * bot fica mudo naquele assunto sem ninguém mexer em nada. Por isso o padrão seguro é
   * `global`, e `por_edicao` só quando a pessoa escolheu deliberadamente uma edição que
   * não é a vigente. O passo da resposta mostra o valor e deixa trocar.
   */
  const escopoPadrao = edicao && !edicao.vigente ? "por_edicao" : "global";

  return (
    <PageContainer>
      {/*
        SEM subtítulo, e ele era uma `LinhaBlue`.

        A etiqueta do Blue creditava a IA por uma frase montada aqui em JavaScript, a
        partir dos números da própria tela. Saiu das outras telas do módulo pela mesma
        razão (commit "a linha do Blue sai do titulo"), e esta ficou de fora só porque
        estava sendo reescrita ao mesmo tempo. O que a frase dizia continua na tela, e
        agora nos indicadores, que é onde o número já mora.
      */}
      <PageHeader title="Base de conhecimento" busy={isFetching} />

      {/*
        O recorte da página vai para o `PainelControles` e não para o `tools` do
        cabeçalho: ele estava lá com `hidden md:inline-flex`, ou seja, no celular a
        edição simplesmente não existia, e é ela que decide o que a tela lê E para onde
        vai o que se escreve. No painel ele vira uma folha de baixo com rótulo, em vez
        de sumir.
      */}
      <PainelControles
        agrupamento="por-controle"
        titulo="Recorte da base"
        descricao="Vale para os artigos, a prontidão e o que você escrever agora."
      >
        {produtos.length > 1 && (
          <ControleLinha rotulo="Produto">
            <SelectPill
              value={produto}
              onChange={setProdutoEscolhido}
              size="sm"
              minWidth={160}
              options={produtos.map((p) => ({
                value: p.produto_slug,
                label: p.produto_slug,
              }))}
            />
          </ControleLinha>
        )}
        <ControleLinha rotulo="Edição">
          <SelectPill
            value={edicaoId}
            onChange={setEdicaoId}
            size="sm"
            minWidth={180}
            options={(edicoes ?? []).map((e) => ({
              value: e.id,
              label: e.vigente ? `${e.nome} · vigente` : e.nome,
            }))}
            placeholder="Escolha a edição"
          />
        </ControleLinha>
      </PainelControles>

      {/*
        QUATRO indicadores, e antes eram oito somando as duas telas.

        Os que saíram e por quê: "Situações" e "Chama uma pessoa" são o total menos o
        que já está no primeiro cartão, e as abas da lista mostram os dois recortes;
        "Prontidão da edição" virou a barra do cartão da edição, junto do que ela mede;
        "Artigos no total" era o tamanho de uma lista que não existe mais; "Pendentes de
        definição" está no cartão da edição, ao lado da barra que ele explica.

        Sobraram os quatro que alguém precisa levar a zero (ou manter no alto), e nenhum
        deles repete o número de outro.
      */}
      <KpiGrade>
        <KPICard
          eyebrow="O bot responde"
          value={bot ? `${bot.respondeSozinho}/${bot.total}` : "-"}
          description={`${pctBot}% das situações, sem fila`}
          color="success"
        />
        {/*
          O número que a tela existe para mostrar: situação em que o bot responderia e
          o texto não existe. O bot assume a conversa e entrega vazio.
        */}
        {/*
          CLICAR NO INDICADOR FILTRA A LISTA, e a interacao e adicionada por prop no
          `KPICard` do DS (ele estende HTMLAttributes) em vez de cartao feito a mao: o
          desenho continua sendo do DS. Se isto se repetir noutra tela, vira prop de
          verdade no DS em vez de copia.
        */}
        <KPICard
          eyebrow="Falta a resposta"
          value={bot?.semResposta ?? "-"}
          description="o bot responderia, mas não há texto"
          color={(bot?.semResposta ?? 0) > 0 ? "error" : "success"}
          role="button"
          tabIndex={0}
          aria-pressed={subFiltro === "sem-resposta"}
          onClick={() => filtrarPor("sem-resposta")}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              filtrarPor("sem-resposta");
            }
          }}
          className={`cursor-pointer transition-shadow focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-brand/25 ${
            subFiltro === "sem-resposta" ? "ring-[1.5px] ring-brand" : "hover:shadow-[var(--l4-sh-raised)]"
          }`}
        />
        {/*
          "Sem frase" e não "Sem frase de reconhecimento": na grade de 2 colunas do
          celular o rótulo longo cortava ("Sem frase de reco…"), e a descrição abaixo
          já diz o que a falta causa. Foi o mesmo corte que "Pendentes de definição"
          sofria antes.
        */}
        <KPICard
          eyebrow="Sem frase"
          value={bot?.semGatilho ?? "-"}
          description="o bot não reconhece, e cai na fila"
          color={(bot?.semGatilho ?? 0) > 0 ? "warn" : "neutral"}
          role="button"
          tabIndex={0}
          aria-pressed={subFiltro === "sem-frase"}
          onClick={() => filtrarPor("sem-frase")}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              filtrarPor("sem-frase");
            }
          }}
          className={`cursor-pointer transition-shadow focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-brand/25 ${
            subFiltro === "sem-frase" ? "ring-[1.5px] ring-brand" : "hover:shadow-[var(--l4-sh-raised)]"
          }`}
        />
        <KPICard
          eyebrow="Lacunas abertas"
          value={abertas.length}
          description="marcadas por bot ou atendente"
          color={abertas.length > 0 ? "info" : "neutral"}
        />
      </KpiGrade>

      {produto ? (
        <>
          {/*
            QUAL EDIÇÃO ESTÁ NO AR, e como se troca. Fica logo abaixo do seletor porque
            é a mesma edição: o seletor escolhe qual se lê e para qual se escreve, e o
            cartão diz o que ela é e permite trocar a que vale.
          */}
          <GestaoEdicoes
            produto={produto}
            edicoes={edicoes ?? []}
            edicao={edicao}
            prontidao={prontidao}
            podeGerenciar={podeGerenciar}
          />

          {/*
            O teste vem ANTES da lista, e não depois.

            A pergunta que traz alguém a esta tela é "o bot está respondendo direito?", e
            a lista é o que se usa para CORRIGIR o que o teste mostrou. Na ordem inversa,
            a pessoa edita no escuro e só descobre o efeito rolando até o fim.
          */}
          <TestarBot produto={produto} />

          <div ref={listaRef}>
            <SituacoesDoBot
              produto={produto}
              edicaoTrabalho={edicaoId}
              escopoPadrao={escopoPadrao}
              subFiltro={subFiltro}
              onSubFiltro={setSubFiltro}
            />
          </div>
        </>
      ) : (
        <Card className="p-4">
          <p className="text-[12px] text-text-secondary">
            A praça não tem produto ativo, e a base é por produto.
          </p>
        </Card>
      )}

      {/*
        A LISTA DE ARTIGOS SAIU DESTE LUGAR, e com ela a grade de duas colunas.

        Ela era a mesma linha do banco que a lista de situações logo acima, lida por
        outra rota: o passo "Resposta" da situação grava em `atd_artigo` reaproveitando
        a linha existente, e o bot procura por `motivo_id`. Duas listas para um objeto.

        Onde foi parar cada coisa que só ela mostrava:
         • estado da versão, escopo, `publico`, edição da versão, pendência e histórico
           viraram campo da SITUAÇÃO (`prontidao-bot`), e aparecem na linha e no
           formulário dela;
         • o corpo da resposta já estava no passo "A resposta" do formulário, inteiro e
           editável, em vez de duas linhas cortadas;
         • a barra de prontidão foi para o cartão da edição, que é o que ela mede;
         • o artigo ÓRFÃO (sem `motivo_id`) não tem mais tela, e é de propósito: ele é o
           artigo que o bot NUNCA diz, e mostrá-lo convidava a escrever ali achando que
           estava configurando o bot. A conta dele é `scripts/orfaos-artigo.mjs`, na API.
      */}
      <Card className="p-4">
        <Eyebrow>Lacunas marcadas</Eyebrow>
        <p className="mt-1.5 text-[11px] leading-snug text-text-secondary">
          O cenário 17.3 virando mecanismo: quando bot ou atendente não acha
          resposta, a lacuna entra nesta fila. É o que faz a base melhorar em vez
          de envelhecer.
        </p>
        {(lacunas ?? []).length === 0 ? (
          <p className="mt-3 text-[11.5px] text-text-secondary">
            Nenhuma lacuna marcada.
          </p>
        ) : (
          /*
            Duas colunas a partir do `md`, e antes era uma só.

            O cartão morava numa coluna estreita ao lado da lista de artigos; com a
            lista fora, ele ocupa a largura inteira, e uma pilha de frases curtas na
            largura de um monitor lê como lista inacabada.
          */
          <div className="mt-3 grid gap-1.5 md:grid-cols-2">
            {(lacunas ?? []).map((l) => (
              <div
                key={l.id}
                className="rounded-[12px] bg-[var(--l4-fill-5)] px-2.5 py-2"
              >
                <p
                  className={[
                    "text-[12px] leading-snug",
                    l.resolvido
                      ? "text-text-secondary line-through"
                      : "text-text-strong",
                  ].join(" ")}
                >
                  {l.pergunta}
                </p>
                <span className="mt-0.5 block text-[10.5px] text-text-secondary">
                  {l.marcado_por} · {dataHora(l.created_at)}
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </PageContainer>
  );
}
