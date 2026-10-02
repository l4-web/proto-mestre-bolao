import { useMemo, useState } from "react";
import { Bot, Plus, UserRound, X } from "lucide-react";
import {
  Badge,
  Button,
  Input,
  Modal,
  ModalActions,
  ModalBody,
  ModalContent,
  ModalHead,
  PageAction,
  SearchBar,
  SelectPill,
  TabbedForm,
  Tabs,
  Textarea,
} from "@l4-web/ui";
import {
  useConfigurarCenarioMutation,
  useCriarCenarioMutation,
  useEscreverRespostaMutation,
  useEdicoesQuery,
  useProntidaoBotQuery,
  useRespostaAtualQuery,
} from "../../features/atendimento/atendimento.api";
import type { CenarioBot } from "../../features/atendimento/tipos";
import { plural } from "../../lib/plural";

/**
 * O que o bot faz em cada situação que o cliente traz.
 *
 * Quem mexe aqui é quem atende, não quem programa, e a revisão desta tela saiu disso.
 * O que mudou, e por quê:
 *
 * 1. A LISTA É LEITURA. Antes cada situação trazia dois segmentados e as frases
 *    abertos ao mesmo tempo: 118 formulários empilhados, e a pessoa precisava decidir
 *    onde clicar antes de entender o que estava vendo. Agora a linha diz o essencial
 *    (quem responde, e se falta algo) e a edição abre num lugar só.
 * 2. LINHA E NÃO CARTÃO. Cartão dentro de cartão desenha moldura dentro de moldura, e
 *    118 molduras fazem 118 itens parecerem 118 assuntos sem relação. Uma superfície,
 *    linhas separadas por fio.
 * 3. A PERGUNTA É BINÁRIA. `cq`, `df`, `faq`, `tc` são a taxonomia do documento, não a
 *    pergunta de quem configura. A pergunta é "o bot responde ou chama uma pessoa?", e
 *    o COMO vem depois, em português.
 * 4. CRIAR E EDITAR SÃO O MESMO FLUXO, em passos. Eram duas telas separadas, e era por
 *    isso que dava para criar uma situação marcada como respondida sem resposta
 *    escrita: o passo da resposta ficava para depois, e depois não vinha.
 *
 * ── Por que isto saiu de Configurações ────────────────────────────────────────
 * Era a aba "Bot" e escrevia em `atd_artigo`/`atd_artigo_versao` pela rota
 * `POST /motivos/:id/resposta`, que é exatamente a tabela que a Base de conhecimento
 * lia em `GET /base/artigos`: duas telas, duas permissões, uma tabela. Taxonomia e
 * resposta são o que o bot DIZ ao cliente, ou seja conteúdo, e não como o módulo
 * opera (canal, alocação, compliance, expediente). Por isso mora na Base.
 *
 * Os indicadores, o seletor de edição e a caixa de teste ficaram na PÁGINA: eles
 * valem para a base inteira e não só para esta lista, e repeti-los aqui era o que
 * fazia a soma das duas telas ter oito indicadores e dois seletores de edição.
 *
 * ── E A LISTA DE ARTIGOS TAMBÉM SAIU ──────────────────────────────────────────
 * Ela era esta mesma linha do banco por outra rota (o passo "A resposta" grava em
 * `atd_artigo` reaproveitando a linha existente, e o bot procura por `motivo_id`), então
 * a situação virou o único objeto da Base. O que só a lista de artigos mostrava está
 * agora AQUI: o estado da versão e o escopo na linha, e a visibilidade na FAQ, a edição
 * da versão, a pendência e o tamanho do histórico no formulário.
 *
 * TUDO É POR EDIÇÃO. A lista e o formulário leem com o `edicaoTrabalho`, e a API resolve
 * a resposta com a mesma regra do bot: artigo `por_edicao` só conta quando existe versão
 * daquela edição. Sem isso a lista dizia "pronta" depois da virada enquanto o bot
 * escalava, e o formulário abria com o texto da edição errada.
 */

/**
 * As saídas que a tela OFERECE, e não as oito do documento.
 *
 * Do lado do bot o documento tem cinco códigos (`faq`, `interno`, `rg`, `tc`,
 * `direto`) e todos passam pelo mesmo caminho: busca a resposta publicada e manda. A
 * única distinção com consequência é se a resposta também sai na FAQ pública do site,
 * que é o que separa `faq` de `interno`. Oferecer cinco botões para uma decisão de duas
 * é pior que oferecer dois: a pessoa acredita que decidiu algo e não decidiu.
 *
 * Os outros três continuam existindo no DADO (vêm do mapeamento e servem para relatório
 * e para a revisão de conteúdo), e a tela mostra o que a situação é hoje sem convidar a
 * trocar por outro que faria o mesmo.
 */
const SAIDAS = {
  bot: [
    { id: "faq", label: "Responde e publica na FAQ", ajuda: "O texto também aparece na FAQ do site" },
    { id: "interno", label: "Responde só no atendimento", ajuda: "Não vai para a FAQ pública" },
  ],
  pessoa: [
    { id: "cq", label: "Pede os dados e passa para a fila", ajuda: "Entra na fila com prioridade pela urgência" },
    { id: "df", label: "É problema no app", ajuda: "Coleta print, aparelho e horário. Não promete prazo" },
    { id: "especial", label: "Caso delicado", ajuda: "Procon, LGPD ou dado de outra pessoa: tem trilha própria" },
  ],
} as const;

/**
 * Os cinco códigos que significam "o bot responde".
 *
 * NÃO sai de `SAIDAS.bot`, que agora tem só dois: uma situação classificada como `rg`,
 * `tc` ou `direto` no mapeamento continua sendo respondida pelo bot, e derivar esta
 * lista da tela faria essas 18 situações aparecerem como "chama uma pessoa", que é
 * mentira sobre o que o bot faz.
 */
const RESPONDE = new Set<string>(["faq", "interno", "rg", "tc", "direto"]);

/** Rótulo em português dos códigos que a tela não oferece, mas mostra. */
const OUTRAS_SAIDAS: Record<string, string> = {
  rg: "Explica a regra",
  tc: "Orienta a resolver fora do app",
  direto: "Resposta curta",
};

/**
 * O ESTADO DA VERSÃO, que era coluna da lista de artigos.
 *
 * A distinção não é decorativa: `publicado` é o único estado que o bot serve. Rascunho é
 * texto que alguém começou, e `pendente_definicao` é texto que depende de decisão de
 * fora (a AV1 do produto, por exemplo). Nos dois o bot ESCALA, e sem o rótulo a linha
 * só sabia dizer "falta a resposta", o que mandava a pessoa reescrever do zero o que o
 * colega já tinha deixado pela metade.
 */
const ESTADO: Record<
  string,
  { texto: string; cor: "success" | "warn" | "error" | "info" | "neutral" }
> = {
  publicado: { texto: "Publicada", cor: "success" },
  em_revisao: { texto: "Em revisão", cor: "info" },
  rascunho: { texto: "Rascunho", cor: "neutral" },
  pendente_definicao: { texto: "Sem definição", cor: "warn" },
  arquivado: { texto: "Arquivada", cor: "neutral" },
};

const GRAVIDADES = [
  { value: "critico", label: "Crítico" },
  { value: "alto", label: "Alto" },
  { value: "medio", label: "Médio" },
];

type Recorte = "pendentes" | "bot" | "pessoa" | "todos";

/**
 * O RECORTE QUE VEM DE FORA, quando alguem clica num indicador da pagina.
 *
 * "Falta a resposta" e "Sem frase" nao viraram abas: eles sao as duas METADES de
 * "Pendentes", e seis abas na mesma faixa era o que o usuario pediu para diminuir.
 * Entao o clique no cartao seleciona Pendentes e acrescenta este sub-filtro, que
 * aparece como uma pilula removivel ao lado da busca. Assim a relacao entre o
 * indicador e a aba fica visivel em vez de virar um estado escondido.
 */
export type SubFiltro = "sem-resposta" | "sem-frase" | null;

/** O formulário dos passos, o mesmo para criar e para editar. */
interface Form {
  etapa_id: string;
  cenario: string;
  gravidade: string;
  saida: string;
  gatilhos: string[];
  novoGatilho: string;
  resposta: string;
  /**
   * `por_edicao` amarra a resposta a UMA edição; `global` vale em todas.
   *
   * Existe na tela porque sem isso não havia como marcar a resposta que muda a cada
   * edição (valor, prazo, percentual, data), e o bot serve artigo `por_edicao` só
   * quando existe versão da edição VIGENTE.
   */
  escopo: "global" | "por_edicao";
  /** Vazio = a edição vigente, que é o que quase sempre se quer ao escrever agora. */
  edicao_id: string;
}

const VAZIO: Form = {
  etapa_id: "",
  cenario: "",
  gravidade: "medio",
  saida: "cq",
  gatilhos: [],
  novoGatilho: "",
  resposta: "",
  escopo: "global",
  edicao_id: "",
};

/**
 * A EDIÇÃO EM QUE SE ESTÁ TRABALHANDO vem da PÁGINA, e é a mesma que recorta a leitura.
 *
 * Eram dois seletores: um na Base ("qual edição estou lendo") e outro aqui
 * ("Escrevendo para"). São a mesma pergunta na prática, porque ninguém lê uma edição
 * enquanto escreve para outra, e ter os dois na mesma tela era metade da confusão que
 * motivou a unificação.
 *
 * `escopoPadrao` traduz esse recorte em "onde a resposta vale":
 * escrever para a edição QUE JÁ ESTÁ NO AR é, quase sempre, escrever a regra geral
 * (`global`), e escrever para uma edição que ainda não virou é, por definição, escrever
 * só para ela (`por_edicao`). A regra não fica escondida: o passo da resposta mostra o
 * valor escolhido e a consequência dele, e deixa trocar.
 */
export function SituacoesDoBot({
  produto,
  edicaoTrabalho,
  escopoPadrao,
  subFiltro = null,
  onSubFiltro,
}: {
  produto: string;
  edicaoTrabalho: string;
  escopoPadrao: Form["escopo"];
  /** Vem do indicador clicado na pagina. Nulo = a aba decide sozinha. */
  subFiltro?: SubFiltro;
  onSubFiltro?: (v: SubFiltro) => void;
}) {
  const { data, isFetching } = useProntidaoBotQuery(
    { produto, edicaoId: edicaoTrabalho || undefined },
    { skip: !produto },
  );
  const [configurar] = useConfigurarCenarioMutation();
  const [criar, { isLoading: criando }] = useCriarCenarioMutation();
  const [escrever, { isLoading: escrevendo }] = useEscreverRespostaMutation();

  const [recorteLocal, setRecorteLocal] = useState<Recorte>("pendentes");
  // Sub-filtro ligado implica Pendentes: os dois cartoes sao subconjuntos dela, e
  // mostrar "sem frase" dentro de "O bot responde" daria uma lista vazia sem explicar.
  const recorte: Recorte = subFiltro ? "pendentes" : recorteLocal;
  const setRecorte = (r: Recorte) => {
    onSubFiltro?.(null);
    setRecorteLocal(r);
  };
  const [busca, setBusca] = useState("");
  const [editando, setEditando] = useState<CenarioBot | null>(null);
  const [criandoNovo, setCriandoNovo] = useState(false);
  const [form, setForm] = useState<Form>(VAZIO);
  const [erro, setErro] = useState<string | null>(null);

  const lista = useMemo(() => {
    const itens = data?.itens ?? [];
    /**
     * A BUSCA, e ela é por TEXTO da situação e das frases de reconhecimento.
     *
     * São 118 cenários: sem busca, achar um é rolar a lista inteira, e quem configura
     * chega aqui sabendo a FRASE do cliente ("meu saldo sumiu"), não a posição dela.
     * Por isso procura também nos gatilhos, que são justamente as frases de
     * reconhecimento: procurar só pelo rótulo faria a busca falhar exatamente para
     * quem lembra do jeito que o cliente fala.
     *
     * Sem acento e em minúsculas nos dois lados, senão "saldo sumiu" não acha
     * "Meu saldo sumiu" e ninguém entende por quê.
     */
    const alvo = normalizar(busca);
    const porTexto = alvo
      ? itens.filter(
          (i) =>
            normalizar(i.cenario).includes(alvo) ||
            i.gatilhos.some((g) => normalizar(g).includes(alvo)),
        )
      : itens;
    const filtrado =
      subFiltro === "sem-resposta"
        ? porTexto.filter((i) => i.semResposta)
        : subFiltro === "sem-frase"
          ? porTexto.filter((i) => !i.gatilhos.length)
          : recorte === "pendentes"
            ? porTexto.filter((i) => i.semResposta || !i.gatilhos.length)
            : recorte === "bot"
              ? porTexto.filter((i) => i.respondeSozinho)
              : recorte === "pessoa"
                ? porTexto.filter((i) => !i.respondeSozinho)
                : porTexto;
    return [...filtrado].sort((a, b) => Number(b.semResposta) - Number(a.semResposta));
  }, [data, recorte, busca, subFiltro]);

  function abrirEdicao(c: CenarioBot) {
    setErro(null);
    setForm({
      etapa_id: "",
      cenario: c.cenario,
      gravidade: c.gravidade,
      saida: c.tratamento,
      gatilhos: c.gatilhos,
      novoGatilho: "",
      resposta: "",
      // O recorte da página entra como PADRÃO da situação que se abre: é o que faz
      // "estou preparando a edição X" valer para tudo que se escreve na sessão.
      escopo: escopoPadrao,
      edicao_id: escopoPadrao === "por_edicao" ? edicaoTrabalho : "",
    });
    setEditando(c);
  }

  function abrirCriacao() {
    setErro(null);
    setForm({
      ...VAZIO,
      escopo: escopoPadrao,
      edicao_id: escopoPadrao === "por_edicao" ? edicaoTrabalho : "",
    });
    setCriandoNovo(true);
  }

  function fechar() {
    setEditando(null);
    setCriandoNovo(false);
    setErro(null);
  }

  /**
   * Salvar é uma coisa só para quem usa, e três chamadas por baixo.
   *
   * Criar a situação, definir quem responde e escrever a resposta são rotas
   * diferentes, e isso é detalhe nosso. Quem preencheu os passos aperta um botão e
   * espera que o que escreveu esteja lá.
   */
  async function salvar() {
    setErro(null);
    try {
      let id = editando?.id;
      if (!id) {
        const r = await criar({
          produto,
          etapa_id: form.etapa_id,
          cenario: form.cenario.trim(),
          gravidade_padrao: form.gravidade,
        }).unwrap();
        id = r.id;
      }
      await configurar({
        produto,
        id,
        codigo_tratamento: form.saida,
        gravidade_padrao: form.gravidade,
        gatilhos: form.gatilhos,
      }).unwrap();
      if (form.resposta.trim().length >= 10) {
        await escrever({
          produto,
          id,
          corpo: form.resposta.trim(),
          publicar: true,
          escopo: form.escopo,
          // Vazio = deixa a API cair na edição vigente, em vez de o front adivinhar
          // qual é ela.
          ...(form.escopo === "por_edicao" && form.edicao_id
            ? { edicao_id: form.edicao_id }
            : {}),
        }).unwrap();
      }
      fechar();
    } catch (e) {
      const corpo = (e as { data?: { message?: string | string[] } }).data;
      const msg = Array.isArray(corpo?.message) ? corpo?.message[0] : corpo?.message;
      setErro(msg ?? "Não deu para salvar. Tente de novo.");
    }
  }

  if (!data) {
    return (
      <p className="px-1 py-2 text-[12.5px] text-text-secondary">
        {isFetching ? "Carregando as situações…" : "Sem situações cadastradas para este produto."}
      </p>
    );
  }

  const etapas = data.etapas ?? [];
  const pendentes = data.itens.filter((i) => i.semResposta || !i.gatilhos.length).length;

  return (
    <div className="flex flex-col gap-4">
      {/*
        "Nova situação" é AÇÃO DE TELA, e por isso vai para a faixa do título pelo
        `PageAction` em vez de morar no cabeçalho da lista.

        Ela estava dentro da superfície, ao lado da busca e das abas, disputando a
        linha com dois controles de leitura: ação e recorte no mesmo lugar obrigam a
        ler botão por botão para descobrir o que faz e o que filtra. Na barra do
        título ela também sobrevive à rolagem, que é onde a única ação da página deve
        ficar.
      */}
      <PageAction>
        <Button size="sm" variant="filled" disabled={!etapas.length} onClick={abrirCriacao}>
          <Plus className="size-3.5" aria-hidden />
          Nova situação
        </Button>
      </PageAction>

      {/*
        UMA superfície com linhas. O raio de fora é 20 e nada aqui dentro repete
        moldura: separação por fio, que é o que faz a lista ler como uma lista.
      */}
      <div className="overflow-hidden rounded-[20px] border-[0.5px] border-border-muted bg-surface shadow-[var(--l4-sh-rest)]">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b-[0.5px] border-border-muted px-3 py-2.5">
          <Tabs
            tabs={[
              { id: "pendentes", label: "Pendentes", badge: pendentes || undefined },
              { id: "bot", label: "O bot responde" },
              { id: "pessoa", label: "Chama uma pessoa" },
              { id: "todos", label: "Todas" },
            ]}
            activeTab={recorte}
            onChange={(id) => setRecorte(id as Recorte)}
          />
          {/*
            A PILULA DIZ QUE O RECORTE VEIO DE FORA, e deixa desfazer.
            Filtro que a pagina liga sem sinal na lista e o mesmo defeito do indicador
            que so conta: a pessoa ve uma lista curta e conclui que sobrou pouco.
          */}
          {subFiltro && (
            <button
              type="button"
              onClick={() => onSubFiltro?.(null)}
              className="l4-pressable inline-flex items-center gap-1.5 rounded-full bg-[var(--l4-fill-4)] px-2.5 py-1 text-[11.5px] text-text-strong"
              title="Remover este filtro e voltar para todas as pendentes"
            >
              {subFiltro === "sem-resposta" ? "só sem resposta" : "só sem frase"}
              <X className="size-3 text-text-secondary" aria-hidden />
              <span className="sr-only">Remover filtro</span>
            </button>
          )}
          <div className="flex min-w-0 flex-1 items-center justify-end">
            {/*
              A busca fica no cabeçalho e ao lado das abas porque ela COMBINA com o
              recorte: procurar "saldo" dentro de "Pendentes" é a pergunta que quem
              configura faz. Largura limitada para não espremer as abas em telas
              estreitas.
            */}
            {/*
              `SearchBar` do DS, e não `Input` com placeholder: ela já traz a lupa, o X
              de limpar e o debounce. Eu tinha usado o Input genérico e ficou fora da
              linguagem do resto do sistema.
              `debounceMs={0}` porque o filtro é LOCAL, sobre uma lista já carregada:
              esperar 300ms para filtrar em memória só faz a tela parecer lenta.
            */}
            <SearchBar
              value={busca}
              onChange={(e) => setBusca(e.currentTarget.value)}
              onClear={() => setBusca("")}
              debounceMs={0}
              placeholder="Buscar situação ou frase do cliente"
              /*
                Largura cheia até `sm` e limitada daí para cima: em 375 as abas
                quebram para a linha de cima e a busca fica sozinha na de baixo, e com
                o teto de 280 ela ficava encolhida na direita com uma sobra à esquerda,
                que lê como controle desalinhado.
              */
              containerClassName="w-full sm:max-w-[280px]"
            />
          </div>
        </div>

        {lista.length === 0 ? (
          <p className="px-3.5 py-6 text-center text-[12.5px] text-text-secondary">
            {busca
              ? `Nenhuma situação com "${busca}". A busca olha o texto da situação e as frases de reconhecimento.`
              : recorte === "pendentes"
              ? "Nada pendente: todas as situações têm frase de reconhecimento, e as que o bot responde têm resposta escrita."
              : "Nenhuma situação neste recorte."}
          </p>
        ) : (
          <ul className="flex flex-col divide-y-[0.5px] divide-[var(--l4-surface-borda)]">
            {lista.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => abrirEdicao(c)}
                  className="l4-pressable flex w-full items-center gap-3 px-3.5 py-2.5 text-left hover:bg-[var(--l4-fill-5)]"
                >
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-[13px] font-medium text-text-strong">{c.cenario}</span>
                    {/*
                      A segunda linha ganhou o ESCOPO e o ESTADO da resposta, que eram
                      colunas da lista de artigos. Sem eles a linha não distinguia a
                      resposta que vale sempre da que muda a cada promoção, que é a
                      diferença entre "o bot vai dizer isso na virada" e "o bot vai
                      escalar isso na virada".
                    */}
                    <span className="flex min-w-0 flex-wrap items-center gap-x-2 text-[11px] text-text-muted">
                      <span className="truncate">{c.etapa}</span>
                      {c.escopo === "por_edicao" && (
                        <span title="A resposta muda a cada edição: o bot só a diz quando existe versão da edição no ar.">
                          por edição
                          {/*
                            O nome da edição só aparece quando ela NÃO é a do recorte.
                            Dentro do recorte ele seria a mesma string repetida 118
                            vezes, e repetição na lista inteira deixa de ser informação.
                            Fora dele (produto sem edição escolhida) é o contrário: é a
                            única pista de a qual promoção aquele texto pertence.
                          */}
                          {c.edicaoDaResposta && c.edicaoDaResposta.id !== edicaoTrabalho
                            ? ` · ${c.edicaoDaResposta.nome}`
                            : ""}
                        </span>
                      )}
                      {c.escopo === "global" && <span>vale sempre</span>}
                      {c.publico === false && (
                        <span title="Não sai na FAQ pública do site. O bot e o atendente sabem a resposta.">
                          uso interno
                        </span>
                      )}
                    </span>
                  </span>

                  {/*
                    Quem responde vem com ÍCONE além da palavra: é a informação que se
                    varre a coluna para achar, e ícone lê antes de texto.
                  */}
                  <span className="flex flex-none items-center gap-1.5 text-[11.5px] text-text-secondary">
                    {c.respondeSozinho ? (
                      <>
                        <Bot className="size-3.5 text-success-text" aria-hidden /> Bot
                      </>
                    ) : (
                      <>
                        <UserRound className="size-3.5 text-info-text" aria-hidden /> Pessoa
                      </>
                    )}
                  </span>

                  <span className="flex w-[116px] flex-none justify-end">
                    {/*
                      Texto começado NÃO é texto ausente, e a lista de artigos sabia
                      dizer a diferença enquanto esta só sabia "falta a resposta". Quem
                      lia isso reescrevia do zero o rascunho do colega, ou ficava
                      procurando um texto que existe e só não foi publicado.
                    */}
                    {c.semResposta && c.estadoResposta && ESTADO[c.estadoResposta] ? (
                      <Badge variant={ESTADO[c.estadoResposta]!.cor} size="xs">
                        {ESTADO[c.estadoResposta]!.texto}
                      </Badge>
                    ) : c.semResposta ? (
                      <Badge variant="error" size="xs">
                        falta a resposta
                      </Badge>
                    ) : !c.gatilhos.length ? (
                      <Badge variant="warn" size="xs">
                        sem frase
                      </Badge>
                    ) : c.respostaRestrita ? (
                      <Badge variant="warn" size="xs">
                        restrita
                      </Badge>
                    ) : null}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <ModalSituacao
        aberto={Boolean(editando) || criandoNovo}
        produto={produto}
        edicaoTrabalho={edicaoTrabalho}
        novo={criandoNovo}
        cenario={editando}
        etapas={etapas}
        form={form}
        setForm={setForm}
        salvando={criando || escrevendo}
        erro={erro}
        onFechar={fechar}
        onSalvar={salvar}
      />
    </div>
  );
}

/**
 * A situação, em passos.
 *
 * Três passos e nesta ordem: o que o cliente diz, quem responde, e a resposta. A ordem
 * importa: perguntar "quem responde" antes de a pessoa escrever o que o cliente diz é
 * perguntar no vazio, e deixar a resposta para o fim é o que fazia situação nascer
 * marcada como respondida sem texto escrito.
 *
 * O passo da resposta só existe quando a escolha é o bot responder. Quem escolheu
 * "chama uma pessoa" não tem texto para escrever, e passo vazio faz a pessoa achar que
 * esqueceu de preencher.
 */
function ModalSituacao({
  aberto,
  produto,
  edicaoTrabalho,
  novo,
  cenario,
  etapas,
  form,
  setForm,
  salvando,
  erro,
  onFechar,
  onSalvar,
}: {
  aberto: boolean;
  produto: string;
  edicaoTrabalho: string;
  novo: boolean;
  cenario: CenarioBot | null;
  etapas: { id: string; label: string }[];
  form: Form;
  setForm: React.Dispatch<React.SetStateAction<Form>>;
  salvando: boolean;
  erro: string | null;
  onFechar: () => void;
  onSalvar: () => void;
}) {
  // As edições do produto, para a resposta por edição poder escolher uma. Lista vazia
  // quando a consulta falha: sem edição a tela ainda deixa escrever e a API cai na
  // vigente, então derrubar o formulário por causa do seletor seria pior.
  const { data: edicoes = [] } = useEdicoesQuery({ produto }, { skip: !produto });

  const botResponde = RESPONDE.has(form.saida);

  /**
   * A resposta que já existe entra na caixa.
   *
   * Sem isto o formulário abria vazio mesmo em cenário com texto publicado, e quem
   * configura concluía que a resposta não existia (ou reescrevia do zero o que já
   * estava certo, criando versão nova sem necessidade).
   */
  const { data: atual } = useRespostaAtualQuery(
    { produto, id: cenario?.id ?? "", edicaoId: edicaoTrabalho || undefined },
    { skip: !cenario?.id || !aberto },
  );
  /**
   * A chave inclui a EDIÇÃO, e não só o cenário.
   *
   * A resposta carregada é a daquela edição: guardar só o id do cenário faria a caixa
   * ficar com o texto da edição anterior ao trocar de edição com o mesmo cenário aberto,
   * que é exatamente o jeito de copiar o valor velho para a promoção nova.
   */
  const chave = `${cenario?.id ?? ""}:${edicaoTrabalho}`;
  const [carregadoDe, setCarregadoDe] = useState<string | null>(null);
  if (atual?.existe && cenario && carregadoDe !== chave) {
    setCarregadoDe(chave);
    setForm((a) => ({ ...a, resposta: atual.corpo }));
  }

  const passos = [
    {
      id: "situacao",
      titulo: "A situação",
      validar: (f: Form) => f.cenario.trim().length >= 6 && (!novo || Boolean(f.etapa_id)),
      render: (f: Form, set: React.Dispatch<React.SetStateAction<Form>>) => (
        <div className="flex flex-col gap-3">
          {novo && (
            <label className="flex flex-col gap-1">
              <span className="text-[11.5px] text-text-secondary">Onde isso acontece</span>
              <SelectPill
                value={f.etapa_id}
                onChange={(v) => set((a) => ({ ...a, etapa_id: v }))}
                options={[
                  { value: "", label: "Escolha o momento da jornada" },
                  ...etapas.map((e) => ({ value: e.id, label: e.label })),
                ]}
              />
            </label>
          )}

          <Input
            label="O que o cliente diz"
            value={f.cenario}
            placeholder="Paguei o Pix e não recebi nada"
            disabled={!novo}
            helper={
              novo
                ? "Escreva na voz dele, como chega no WhatsApp."
                : "O texto vem do mapeamento do atendimento e não muda por aqui."
            }
            onChange={(e) => {
              const v = e.currentTarget.value;
              set((a) => ({ ...a, cenario: v }));
            }}
          />

          <div className="flex flex-col gap-1.5">
            <span className="text-[11.5px] text-text-secondary">
              Outras formas de dizer a mesma coisa
            </span>
            <p className="text-[11px] leading-relaxed text-text-muted">
              É por essas frases que o bot reconhece a situação. Quanto mais parecido com
              o que o cliente escreve de verdade, melhor.
            </p>
            <div className="flex flex-wrap gap-1">
              {f.gatilhos.map((g) => (
                <button
                  key={g}
                  type="button"
                  title="Remover"
                  onClick={() => set((a) => ({ ...a, gatilhos: a.gatilhos.filter((x) => x !== g) }))}
                  className="l4-pressable rounded-full bg-[var(--l4-fill-4)] px-2 py-0.5 text-[11px] text-text-strong"
                >
                  {g} ×
                </button>
              ))}
            </div>
            <Input
              value={f.novoGatilho}
              placeholder="não recebi meus números"
              onChange={(e) => {
                const v = e.currentTarget.value;
                set((a) => ({ ...a, novoGatilho: v }));
              }}
              onKeyDown={(e) => {
                if (e.key !== "Enter") return;
                e.preventDefault();
                const v = f.novoGatilho.trim();
                if (!v) return;
                set((a) => ({ ...a, gatilhos: [...new Set([...a.gatilhos, v])], novoGatilho: "" }));
              }}
            />
          </div>
        </div>
      ),
    },
    {
      id: "quem",
      titulo: "Quem responde",
      validar: () => true,
      render: (f: Form, set: React.Dispatch<React.SetStateAction<Form>>) => (
        <div className="flex flex-col gap-3">
          {/*
            A escolha grande é binária, porque é a única pergunta que quem configura
            realmente tem. Os oito códigos do documento continuam existindo e viram o
            "como", em português, dentro da família escolhida.
          */}
          <div className="grid gap-2 sm:grid-cols-2">
            {(
              [
                { fam: "bot", icone: Bot, titulo: "O bot responde", ajuda: "O cliente é atendido na hora, sem fila" },
                { fam: "pessoa", icone: UserRound, titulo: "Chama uma pessoa", ajuda: "O caso entra na fila do atendimento" },
              ] as const
            ).map(({ fam, icone: Icone, titulo, ajuda }) => {
              const ativo = fam === "bot" ? RESPONDE.has(f.saida) : !RESPONDE.has(f.saida);
              return (
                <button
                  key={fam}
                  type="button"
                  onClick={() => set((a) => ({ ...a, saida: fam === "bot" ? "interno" : "cq" }))}
                  className={[
                    "l4-pressable flex flex-col items-start gap-1 rounded-[16px] border-[0.5px] p-3 text-left",
                    ativo
                      ? "border-brand-primary bg-[var(--l4-fill-5)]"
                      : "border-border-muted hover:bg-[var(--l4-fill-5)]",
                  ].join(" ")}
                >
                  <Icone className="size-4 text-text-strong" aria-hidden />
                  <span className="text-[13px] font-medium text-text-strong">{titulo}</span>
                  <span className="text-[11px] leading-snug text-text-secondary">{ajuda}</span>
                </button>
              );
            })}
          </div>

          <div className="flex flex-col gap-1">
            <span className="text-[11.5px] text-text-secondary">Como</span>
            {OUTRAS_SAIDAS[f.saida] && (
              <p className="rounded-[12px] bg-[var(--l4-fill-5)] px-3 py-2 text-[11.5px] leading-relaxed text-text-secondary">
                Hoje está como <b className="text-text-strong">{OUTRAS_SAIDAS[f.saida]}</b>, que
                vem do mapeamento do atendimento. Para o bot, o efeito é o mesmo das opções
                abaixo: ele manda a resposta publicada. Escolher uma delas troca só se o texto
                também sai na FAQ do site.
              </p>
            )}
            {(RESPONDE.has(f.saida) ? SAIDAS.bot : SAIDAS.pessoa).map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => set((a) => ({ ...a, saida: s.id }))}
                className={[
                  "l4-pressable flex flex-col items-start rounded-[12px] px-3 py-2 text-left",
                  f.saida === s.id ? "bg-[var(--l4-fill-4)]" : "hover:bg-[var(--l4-fill-5)]",
                ].join(" ")}
              >
                <span className="text-[12.5px] font-medium text-text-strong">{s.label}</span>
                <span className="text-[11px] text-text-secondary">{s.ajuda}</span>
              </button>
            ))}
          </div>

          {!RESPONDE.has(f.saida) && (
            <label className="flex flex-col gap-1">
              <span className="text-[11.5px] text-text-secondary">Com que urgência</span>
              <SelectPill
                value={f.gravidade}
                onChange={(v) => set((a) => ({ ...a, gravidade: v }))}
                options={GRAVIDADES}
              />
            </label>
          )}
        </div>
      ),
    },
    ...(botResponde
      ? [
          {
            id: "resposta",
            titulo: "A resposta",
            validar: (f: Form) => !novo || f.resposta.trim().length >= 10,
            render: (f: Form, set: React.Dispatch<React.SetStateAction<Form>>) => (
              <div className="flex flex-col gap-2">
                {cenario?.respostaRestrita && (
                  <p className="rounded-[12px] bg-warn-bg px-3 py-2 text-[11.5px] leading-relaxed text-text-strong">
                    <b>Situação com resposta restrita.</b> Repasse a orientação geral e nunca
                    informe valor nem porcentagem.
                  </p>
                )}
                <Textarea
                  value={f.resposta}
                  rows={7}
                  placeholder="Escreva como você diria ao cliente"
                  onChange={(e) => {
                    const v = e.currentTarget.value;
                    set((a) => ({ ...a, resposta: v }));
                  }}
                />

                {/*
                  ONDE ESTA RESPOSTA VALE, e a escolha ficava só na API.
                  Sem ela na tela não havia como marcar a resposta que muda a cada
                  edição, e o efeito era silencioso: tudo virava `global` e a regra da
                  edição passada continuava sendo respondida na edição nova.

                  O valor já vem preenchido pelo recorte da página (a edição escolhida
                  lá em cima), e a linha de apoio diz a CONSEQUÊNCIA do que está
                  escolhido. Antes essa explicação era uma faixa no topo da tela, longe
                  da caixa de texto: quem chegava aqui pelo modal não a lia, e o padrão
                  virava uma decisão tomada sem ninguém ver.
                */}
                <label className="flex flex-col gap-1">
                  <span className="text-[11.5px] text-text-secondary">Onde esta resposta vale</span>
                  <SelectPill
                    value={f.escopo}
                    onChange={(v) =>
                      set((a) => ({ ...a, escopo: v as Form["escopo"], edicao_id: "" }))
                    }
                    options={[
                      { value: "global", label: "Em todas as edições" },
                      { value: "por_edicao", label: "Só numa edição (valor, prazo, data)" },
                    ]}
                  />
                  {f.escopo === "global" && (
                    <p className="text-[11px] leading-snug text-text-muted">
                      O bot vai dizer este texto em qualquer edição, inclusive nas que
                      ainda vão virar.
                    </p>
                  )}
                </label>

                {f.escopo === "por_edicao" && (
                  <label className="flex flex-col gap-1">
                    <span className="text-[11.5px] text-text-secondary">Edição</span>
                    <SelectPill
                      value={f.edicao_id}
                      onChange={(v) => set((a) => ({ ...a, edicao_id: v }))}
                      options={[
                        { value: "", label: "A edição vigente" },
                        ...edicoes.map((e) => ({
                          value: e.id,
                          label: e.vigente ? `${e.nome} (vigente)` : e.nome,
                        })),
                      ]}
                    />
                    {/*
                      O bot só serve resposta por edição quando existe versão da edição
                      VIGENTE. Escrever para uma edição futura é legítimo (prepara a
                      virada), mas quem faz isso precisa saber que o bot ainda não vai
                      usar esse texto, senão conclui que publicou e não funcionou.
                    */}
                    {f.edicao_id && !edicoes.find((e) => e.id === f.edicao_id)?.vigente && (
                      <p className="text-[11px] leading-snug text-text-muted">
                        Esta edição não é a vigente: o bot só vai usar este texto quando ela
                        virar. Até lá ele encaminha para uma pessoa.
                      </p>
                    )}
                  </label>
                )}
                {/*
                  A PROCEDÊNCIA DO TEXTO QUE ESTÁ NA CAIXA, e ela vinha da lista de
                  artigos: de qual edição é, em que estado está, por que está pendente e
                  quantas versões ficam guardadas atrás dela. Sem isso o formulário
                  mostrava um texto sem dizer de onde ele veio.
                */}
                {atual?.existe && (
                  <div className="flex flex-col gap-1 text-[11px] text-text-muted">
                    <span>
                      Versão {atual.versao} ({ESTADO[atual.estado]?.texto.toLowerCase() ?? atual.estado}
                      {atual.edicao ? `, da ${atual.edicao.nome}` : ""}) em{" "}
                      <span className="font-mono text-[10px]">{atual.artigo}</span>
                      {atual.historico ? (
                        <span title="Versões anteriores viram histórico legítimo: quem comprou na edição passada tem direito à regra dela">
                          {" · "}
                          {plural(atual.historico, "versão", "versões")} no histórico
                        </span>
                      ) : null}
                    </span>
                    {atual.motivoPendencia && (
                      <span className="text-warn-text">{atual.motivoPendencia}</span>
                    )}
                  </div>
                )}
                <p className="text-[11px] leading-relaxed text-text-muted">
                  {cenario && !cenario.semResposta
                    ? "Já existe resposta escrita. O que você escrever aqui entra como versão nova, e a anterior continua guardada."
                    : "Enquanto não houver texto, o bot chama uma pessoa em vez de responder."}
                </p>
              </div>
            ),
          },
        ]
      : []),
  ];

  return (
    <Modal open={aberto} onOpenChange={(v) => !v && onFechar()}>
      <ModalContent size="md">
        <ModalHead
          eyebrow={novo ? "Nova situação" : "Situação"}
          title={novo ? "O que o cliente traz?" : (cenario?.cenario ?? "")}
          description={
            novo
              ? "Três passos: o que ele diz, quem responde e o que responder."
              : (cenario?.etapa ?? undefined)
          }
        />
        <ModalBody>
          {/*
            Sem forçar largura no trilho de passos.
            
            Eu tinha encolhido com `w-fit` porque a régua em largura cheia parecia uma
            faixa atravessando o modal, e o efeito foi pior: a marca azul do
            `TabbedForm` é animada e calcula posição e largura a partir do container, e
            encolher por fora deixou a pílula em cima do texto do primeiro passo.
            Componente do DS com layout forçado por fora quebra assim. O modal já é
            `md`, que é o que reduz a faixa sem mexer no componente; se ainda ficar
            pesado, o lugar de resolver é uma variante compacta NO DS.
          */}
          <TabbedForm passos={passos} form={form} setForm={setForm} hideFooter />
          {erro && (
            <p
              role="alert"
              className="mt-2 rounded-[12px] border-[0.5px] border-error-border bg-error-bg px-3 py-2 text-[11.5px] text-error-text"
            >
              {erro}
            </p>
          )}
        </ModalBody>
        <ModalActions
          cancelar={{ onClick: onFechar }}
          primaria={{
            label: novo ? "Criar situação" : "Salvar",
            loading: salvando,
            disabled: passos.some((p) => p.validar && !p.validar(form)),
            onClick: onSalvar,
          }}
        />
      </ModalContent>
    </Modal>
  );
}

/**
 * Minúsculas e sem acento, dos DOIS lados da comparação.
 *
 * Sem isto "saldo sumiu" não acha "Meu saldo sumiu" e "premio" não acha "prêmio", e
 * quem busca conclui que o cenário não existe em vez de que a busca é literal.
 */
function normalizar(t: string): string {
  return t
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}
