import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { FlaskConical, Hand, Inbox, MessageSquare, Plus, Trophy } from "lucide-react";
import {
  Button,
  MenuSuspenso,
  useToast,
  ControleLinha,
  PageContainer,
  PageHeader,
  PageLoading,
  PainelControles,
  SearchBar,
  Tabs,
  Sheet,
  SheetBody,
  SheetContent,
  SheetHeader,
  SelectPill,
  Spinner,
} from "@l4-web/ui";
import { Vazio } from "../components/comum/Vazio";
import { MeuTurno } from "../components/comum/MeuTurno";
import { useAbility, useMeuId } from "../lib/ability";
import { useProduto } from "../lib/produto-contexto";
import { ALTURA_COLUNA, useGradeDeTrabalho } from "../lib/useGradeTrabalho";
import { useIntervaloPolling } from "../lib/usePolling";
import { MODULE_ID } from "../nav";
import {
  useBlueEstadoQuery,
  useBlueRascunhoMutation,
  useConversaQuery,
  useAtendentesQuery,
  useConversasQuery,
  useContagemConversasQuery,
  useAbrirAtendimentoMutation,
  useAssumirConversaMutation,
  useBlueMotivoSugeridoMutation,
  useEnviarMensagemMutation,
  useEnviarAnexoMutation,
  useSoltarConversaMutation,
  useConsultaQuery,
  useEncaminharMutation,
  useFichaEncaminhamentoQuery,
  useFilasQuery,
  useEncerrarMutation,
  useMacrosQuery,
  useMeuStatusMutation,
  useTaxonomiaQuery,
  useTransferirMutation,
} from "../features/atendimento/atendimento.api";
import { usePracaAtual } from "../features/atendimento/usePracaAtual";
import { produtoDaConversa } from "../features/atendimento/produtos";
import type { Visao } from "../features/atendimento/tipos";
import { ItemConversa } from "../components/conversa/ItemConversa";
import { Bolha } from "../components/conversa/Bolha";
import { PainelProduto } from "../components/bolao/PainelProduto";
import { AcoesProduto } from "../components/bolao/AcoesProduto";
import {
  ModalCriaAi,
  ModalNovaConversa,
  ModalRespostaCliente,
} from "../components/bolao/ModaisBolao";
import { recursosDe, type PainelId } from "../features/bolao/recursos";
import {
  bolaoPorId,
  registrarDisparo,
  simularRespostaCliente,
  simularResultado,
  simularToqueCota,
  useLoja,
} from "../features/bolao/loja";
import { clienteRespondeDisparo, novoLeadDaLanding } from "../features/bolao/ponte";
import { CabecalhoThread } from "../components/conversa/CabecalhoThread";
import { AcoesThread } from "../components/conversa/AcoesThread";
import { Composer } from "../components/conversa/Composer";
import {
  ModalEncaminhar,
  ModalEncerrar,
  ModalTransferir,
  type MotivoSugerido,
} from "../components/conversa/ModaisAcao";
import { agrupar } from "../components/conversa/util";
import { ResumoBlue } from "../components/conversa/ResumoBlue";

/**
 * Texto do vazio POR VISÃO. Vazio genérico é o pior estado de uma fila: a pessoa
 * não distingue "não tem dado no módulo" de "não tem dado NESTE recorte", e conclui
 * a primeira coisa.
 */
const VAZIO: Record<Visao, { titulo: string; descricao: string }> = {
  minhas: {
    titulo: "Nenhuma conversa sua",
    descricao:
      "Nada atribuído a você agora. Veja Não atribuídas ou Todas da fila.",
  },
  "nao-atribuidas": {
    titulo: "Fila limpa",
    descricao: "Toda conversa aberta já tem dono.",
  },
  fila: {
    titulo: "Nenhuma conversa aberta",
    descricao: "A praça não tem conversa em andamento neste momento.",
  },
  resolvidas: {
    titulo: "Nada encerrado ainda",
    // A visão mostra as duas formas de fechar, e a frase diz as duas: sem isso, a
    // conversa que o relógio expirou aparece aqui sob um texto que promete motivo.
    descricao: "Os atendimentos encerrados com motivo, e os que expiraram por inatividade, aparecem aqui.",
  },
  "aguardando-equipe": {
    titulo: "Nada esperando outra equipe",
    descricao:
      "O que você encaminhar para a caixa técnica ou a financeira fica aqui até a equipe responder.",
  },
};

/**
 * Altura das colunas de trabalho. Fixa e independente do conteúdo: antes as duas
 * colunas viviam na mesma grade com `max-h`, então a thread esticava até a altura
 * da lista de conversas. O scroll é SEMPRE interno a cada coluna.
 *
 * Os 268px descontados são o cabeçalho da página mais a barra de filtros mais o
 * respiro do shell. Medido, não estimado.
 */
/** Os três recortes rápidos da fila, no cabeçalho da coluna. */
const RECORTES = [
  {
    id: "todas" as const,
    label: "Todas",
    rotulo: "na fila",
    dica: "Tudo do recorte da visão atual",
  },
  {
    id: "criticas" as const,
    label: "Críticas",
    rotulo: "críticas",
    dica: "Só gravidade crítica: dinheiro parado ou resultado sumido",
  },
  {
    id: "atrasadas" as const,
    label: "Atrasadas",
    rotulo: "atrasadas",
    dica: "Prazo já estourado, comercial ou regulatório",
  },
];


const VISOES: { id: Visao; label: string; curto: string; dica: string }[] = [
  {
    id: "minhas",
    label: "Minhas",
    curto: "Minhas",
    dica: "Conversas abertas atribuídas a você",
  },
  {
    id: "nao-atribuidas",
    label: "Não atribuídas",
    curto: "Sem dono",
    dica: "Abertas e ainda sem dono, esperando distribuição",
  },
  {
    id: "fila",
    label: "Todas da fila",
    curto: "Todas",
    dica: "Todas as abertas da praça, dentro do que seu perfil pode ler",
  },
  /**
   * A VISÃO QUE FALTAVA, e ela é o par do estado `aguardando_equipe`.
   *
   * Caso encaminhado sai de "Minhas" porque deixou de ser cobrança de quem
   * encaminhou, e é essa a queixa que o estado conserta. Sem esta aba, porém, ele
   * sairia da fila e não apareceria em lugar nenhum, e trocar "ocupa a fila de quem
   * não tem o que fazer" por "sumiu" seria pior do que o defeito original.
   */
  {
    id: "aguardando-equipe",
    label: "Com outra equipe",
    curto: "Equipes",
    dica: "Encaminhadas e paradas até a caixa técnica ou a financeira responder",
  },
  {
    id: "resolvidas",
    /**
     * "Encerradas" e não "Resolvidas".
     *
     * A visão passou a mostrar duas coisas: o que alguém fechou com motivo e o que o
     * relógio expirou por inatividade. Chamar as duas de resolvidas é a mesma
     * afirmação falsa que o estado `expirada` veio corrigir, só que no menu.
     */
    label: "Encerradas",
    curto: "Fechadas",
    dica: "Encerradas com motivo, ou expiradas por inatividade",
  },
];

export function ConversasPage() {
  const intervalo = useIntervaloPolling();
  const ability = useAbility();
  // O produto da barra lateral recorta a fila inteira: é escopo do módulo.
  const { produto } = useProduto();
  const podeResponder =
    ability?.can(`${MODULE_ID}:conversas.responder`, "view", {
      default: false,
    }) ?? false;
  const podeLerTodas =
    ability?.can(`${MODULE_ID}:conversas.ler-todas`, "view", {
      default: false,
    }) ?? false;
  const podeEncerrar =
    ability?.can(`${MODULE_ID}:conversas.encerrar`, "view", {
      default: false,
    }) ?? false;
  const podeReatribuir =
    ability?.can(`${MODULE_ID}:fila.reatribuir`, "view", { default: false }) ??
    false;
  const podeEncaminhar =
    ability?.can(`${MODULE_ID}:encaminhar.criar`, "view", { default: false }) ??
    false;
  const veFinanceiro =
    ability?.can(`${MODULE_ID}:contato.financeiro`, "view", {
      default: false,
    }) ?? false;

  // Supervisor e admin abrem na fila inteira; atendente abre nas dele. Sem isto o
  // gestor abre o módulo numa lista vazia e conclui que não tem dado nenhum.
  const [visao, definirVisao] = useState<Visao>(podeLerTodas ? "fila" : "minhas");


  const [filaId, setFilaId] = useState("");
  const [busca, setBusca] = useState("");
  /**
   * O histórico de UM contato, aberto pelo atalho da coluna de contexto.
   *
   * Guarda o nome junto do id só para a faixa poder dizer de quem é a lista. Sem o
   * nome, a pessoa veria a fila trocar de conteúdo sem entender o que aconteceu, e
   * o caminho de volta seria recarregar a página.
   */
  const [historico, setHistorico] = useState<{ id: string; nome: string } | null>(null);
  /**
   * Recorte rápido da fila, no cabeçalho da própria coluna, como no protótipo.
   * Fica AQUI e não no painel de filtros porque é o gesto mais repetido de quem
   * triaga: "me mostra o que está pegando fogo" é o primeiro clique do turno.
   */
  const [recorte, setRecorte] = useState<string>("todas");
  // Peças do produto (Mestre do Bolão): a aba do painel, os modais do bolão e a
  // simulação. A aba sobe para cá porque os botões da caixa de mensagem a abrem.
  const [abaPainel, setAbaPainel] = useState<PainelId>("catalogo");
  const [modalBolao, setModalBolao] = useState<"arte" | "nova" | "resposta" | null>(null);
  const loja = useLoja();
  const { toast } = useToast();
  const [arteBolaoId, setArteBolaoId] = useState<string | null>(null);
  /**
   * A conversa também pode vir pela URL (`/conversas?conversa=<id>`).
   *
   * Existe para a Supervisão poder LINKAR: a lista de gatilhos disparados mostrava
   * que houve um caso de LGPD ou de Procon e não levava a lugar nenhum, então o
   * supervisor tinha que procurar a conversa na mão. O parâmetro é lido uma vez, na
   * montagem, e não amarra a seleção depois: clicar em outra conversa não precisa
   * reescrever a URL.
   */
  const [paramsUrl] = useSearchParams();
  const [selecionada, setSelecionada] = useState<string | null>(
    () => paramsUrl.get("conversa"),
  );
  const [enviarMensagem] = useEnviarMensagemMutation();
  const [enviarAnexo] = useEnviarAnexoMutation();
  const [assumir, { isLoading: assumindo }] = useAssumirConversaMutation();
  const [soltar, { isLoading: soltando }] = useSoltarConversaMutation();

  // Os números de cada visão. Acompanham o mesmo polling da lista: contador parado
  // ao lado de lista que atualiza é pior que contador nenhum.
  const { data: contagem } = useContagemConversasQuery({ produto: produto || undefined }, {
    pollingInterval: intervalo,
  });

  /**
   * A legenda diz o ESTADO DA OPERAÇÃO, não uma máxima sobre atendimento.
   *
   * A frase anterior ("toda conversa tem dono, tem prazo e termina com um motivo
   * registrado") descrevia uma intenção de projeto para quem abre a tela dez vezes
   * por dia e precisa saber o que mudou desde a última. Aqui vai o que muda.
   */
  /**
   * A legenda diz só o que as ABAS não dizem.
   *
   * Elas já carregam minhas, sem dono e a fila inteira. Repetir os mesmos números
   * aqui foi exatamente a duplicação que a operação apontou: "não tem sentido o 1 na
   * fila e ter o 1 aberto e 1 com você". Sobra o que não tem aba, que é o que o bot
   * está segurando: conversa viva que ainda não é trabalho de ninguém.
   */
  const legenda = !contagem
    ? "Carregando a caixa de entrada"
    : contagem.comBot > 0
      ? `${contagem.comBot} ${contagem.comBot === 1 ? "conversa" : "conversas"} com o bot, fora da fila até ele encaminhar`
      : "O bot atende primeiro. Só chega aqui o que ele encaminha.";

  /**
   * Trocar de visão FECHA a conversa aberta.
   *
   * Antes a thread continuava no centro depois de mudar a visão, e ela quase nunca
   * pertencia à lista nova: a pessoa via "Não atribuídas" à esquerda e uma conversa
   * que é dela à direita, o que faz duvidar do que a tela está mostrando. Trocar de
   * visão é mudar de assunto, e mudar de assunto tem que limpar a mesa.
   */
  const trocarVisao = useCallback((v: Visao) => {
    definirVisao(v);
    setSelecionada(null);
  }, []);
  // Os dados do participante. Em tela larga viram a terceira coluna; abaixo disso
  // abrem numa folha, pelo toque no cabeçalho, igual clicar no nome no Messages.
  const [contextoAberto, setContextoAberto] = useState(false);
  /**
   * A grade é decidida pela largura DO CONTEÚDO, medida, não pela viewport.
   *
   * Os números são o mínimo em que cada coluna ainda serve: 258 para a fila caber
   * nome e prazo, 380 para a bolha da thread ter régua de leitura em vez de uma
   * palavra por linha, 240 para o contexto mostrar rótulo e valor na mesma linha.
   * Somando os vãos, o contexto só entra a partir de 900, e a segunda coluna a
   * partir de 620. Abaixo disso a thread abre por cima, pelo mesmo gatilho que já
   * existia no mobile.
   */
  /**
   * A consulta mínima do iOn, pedida SÓ quando o perfil pode ver dado financeiro.
   *
   * O `skip` não é economia de rede: sem `contato.financeiro` a rota responde 403, e
   * disparar a chamada de qualquer jeito enche o console de erro e o log de auditoria
   * de acesso negado para quem não fez nada errado.
   */
  const { data: consulta } = useConsultaQuery(selecionada ?? "", {
    skip: !selecionada || !veFinanceiro,
  });

  /**
   * O que deu errado na última ação, para a tela DIZER.
   *
   * As três ações chamavam `.unwrap()` com `await` solto dentro de handler async:
   * `unwrap` lança, a rejeição não tinha quem pegasse e morria em silêncio. O
   * efeito era o pior possível para quem usa: o modal continuava aberto, o botão
   * não dava sinal, e clicar de novo repetia o nada. A API responde frase pronta e
   * em português (por exemplo "Este caso já tem um encaminhamento aberto para
   * pagamentos."), e essa frase é exatamente o que faltava na tela.
   */
  const [erroAcao, setErroAcao] = useState<string | null>(null);

  /**
   * O erro do ENVIO é outro estado, e não o `erroAcao` dos modais.
   *
   * O `erroAcao` só é desenhado dentro dos modais de ação, então uma recusa do
   * envio (janela, régua, permissão) não aparecia em lugar nenhum: o campo
   * continuava com o texto e nada dizia que a mensagem não saiu.
   */
  const [erroEnvio, setErroEnvio] = useState<string | null>(null);

  /**
   * Roda a ação e, se ela falhar, guarda a mensagem do servidor.
   *
   * `data.message` é onde o filtro de exceções da API põe o texto. O texto genérico
   * só entra quando não veio nada legível, porque "algo deu errado" não ajuda
   * ninguém a decidir o que fazer em seguida.
   */
  const comErro = async (acao: () => Promise<unknown>, aoDarCerto: () => void) => {
    setErroAcao(null);
    try {
      await acao();
      aoDarCerto();
    } catch (e) {
      const corpo = (e as { data?: { message?: string } }).data;
      setErroAcao(corpo?.message ?? "Não deu para concluir a ação. Tente de novo.");
    }
  };

  /** Qual modal de ação está aberto. Um estado só: nunca há dois ao mesmo tempo. */
  const [modal, setModal] = useState<
    "transferir" | "encaminhar" | "encerrar" | null
  >(null);

  /**
   * O palpite do Blue para o motivo do encerramento.
   *
   * Pedido só quando o modal ABRE, e não junto da conversa: cada chamada custa
   * modelo, e a maioria das conversas abertas no dia não é encerrada naquele
   * momento. Falhar aqui não pode derrubar nada, então o erro vira "sem sugestão"
   * e o modal segue com os dois seletores: o endpoint pode nem existir ainda no
   * ambiente em que a tela roda.
   */
  const [sugestao, setSugestao] = useState<MotivoSugerido | null>(null);
  const [pedirMotivoSugerido, { isLoading: sugerindo }] =
    useBlueMotivoSugeridoMutation();

  const { data: filas } = useFilasQuery();
  const { praca } = usePracaAtual();
  // A régua é POR PRODUTO. Sem produto resolvido na conversa ainda, cai na régua do
  // primeiro produto habilitado, que é o comportamento seguro: valida algo em vez
  // de não validar nada.

  // `isFetching` e não `isLoading`: o conteúdo FICA na tela ao trocar de visão e o
  // indicador pequeno acende ao lado do título. Apagar a tela para repintar
  // transforma troca de filtro em recarregamento.
  const {
    data: lista,
    isLoading,
    isFetching,
  } = useConversasQuery(
    {
      visao,
      produto: produto || undefined,
      filaId: filaId || undefined,
      busca: busca || undefined,
      contatoId: historico?.id,
      gravidade: recorte === "criticas" ? "critico" : undefined,
      atrasadas: recorte === "atrasadas" || undefined,
    },
    // A fila recarrega sozinha. Sem isto a mensagem do cliente só aparecia quando
    // o atendente trocava de aba, e `skipPollingIfUnfocused` evita pagar requisição
    // por aba que ninguém está olhando.
    { pollingInterval: intervalo, skipPollingIfUnfocused: true },
  );
  const { data: conversa, isFetching: carregandoThread } = useConversaQuery(
    selecionada!,
    {
      // A thread ABERTA recarrega junto: é onde a pessoa está olhando, e ver a
      // lista atualizar enquanto a conversa aberta congela é pior que as duas
      // paradas, porque sugere que a conversa acabou.
      pollingInterval: intervalo,
      skipPollingIfUnfocused: true,
      skip: !selecionada,
    },
  );

  const conversaProduto = conversa?.produto_slug ?? null;

  // A thread desce até a última mensagem ao abrir e quando chega mensagem nova: no
  // wireframe as respostas das integrações (Pix, canhoto, arte) caem no fim, e sem
  // isso elas ficavam abaixo da dobra parecendo que nada aconteceu.
  const refRolador = useRef<HTMLDivElement>(null);
  const nMensagens = conversa?.mensagens.length ?? 0;
  useEffect(() => {
    const el = refRolador.current;
    if (!el) return;
    // Duas vezes: a imagem do anexo chega depois e cresce a thread.
    el.scrollTo({ top: el.scrollHeight });
    const t = window.setTimeout(() => el.scrollTo({ top: el.scrollHeight, behavior: "smooth" }), 400);
    return () => window.clearTimeout(t);
  }, [conversa?.id, nMensagens]);

  /**
   * A GEOMETRIA DAS TRÊS COLUNAS saiu daqui e virou `useGradeDeTrabalho`.
   *
   * Ela era só desta tela até a caixa das equipes precisar da MESMA (pedido do
   * usuário: "o mesmo padrão de layout do atendimento"). Duas cópias dos mesmos
   * `clamp` e `minmax` ficam diferentes na primeira correção, e o sintoma é uma tela
   * abrir a terceira coluna e a outra não, na mesma janela.
   *
   * As decisões que estavam escritas aqui (uma tela por vez no celular, lista de
   * largura fixa como régua de leitura, medir o elemento e não a viewport) foram
   * inteiras para o comentário do hook.
   */
  const {
    ref: refGrade,
    umaColunaSo,
    cabeContexto,
    mostrarLista,
    mostrarItem: mostrarThread,
    mostrarContexto,
    colunas,
  } = useGradeDeTrabalho({
    temSelecao: Boolean(selecionada),
    temContexto: Boolean(conversa),
  });
  const motivoAberto = conversa?.atendimentos.find((a) => !a.resolvido_em)
    ?.motivo?.id;
  const { data: macros } = useMacrosQuery({ motivoId: motivoAberto });
  const empresaId = praca?.empresa_id;
  const { data: taxonomia } = useTaxonomiaQuery(conversaProduto ?? "", {
    skip: !conversaProduto,
  });
  const [abrirAtendimento, { isLoading: abrindoCaso }] =
    useAbrirAtendimentoMutation();
  const [encerrar, { isLoading: encerrando }] = useEncerrarMutation();
  const [transferir, { isLoading: transferindo }] = useTransferirMutation();
  const [encaminhar, { isLoading: encaminhando }] = useEncaminharMutation();
  const [trocarTurno, { isLoading: trocandoTurno }] = useMeuStatusMutation();
  // Quem sou eu na fila: o próprio registro de atendente, para o controle de turno
  // mostrar o estado ATUAL em vez de um interruptor que sempre parece desligado.
  const { data: atendentes } = useAtendentesQuery(undefined, {
    skip: !podeResponder,
  });
  const meuId = useMeuId();
  const eu = atendentes?.find((a) => a.user_id === meuId);
  const meuTurno = eu?.status;
  const [pedirRascunho] = useBlueRascunhoMutation();
  const { data: blue } = useBlueEstadoQuery();

  // O atendimento ABERTO da conversa: é a ele que se encaminha. Conversa sem
  // atendimento aberto não tem o que encaminhar, e o modal nem carrega ficha.
  const atendimentoAberto =
    conversa?.atendimentos.find((a) => !a.resolvido_em)?.id ?? null;

  const { data: ficha, isFetching: fichaCarregando } =
    useFichaEncaminhamentoQuery(
      { atendimentoId: atendimentoAberto ?? "" },
      { skip: modal !== "encaminhar" || !atendimentoAberto },
    );

  const regua = useMemo(() => {
    const alvo =
      praca?.produtos.find((x) => x.produto_slug === conversaProduto) ??
      praca?.produtos[0];
    return {
      bloqueio: alvo?.compliance?.bloqueio_duro ?? [],
      revisao: alvo?.compliance?.termos_revisao ?? [],
    };
  }, [praca, conversaProduto]);

  // Quem não pode ler todas não recebe a visão da fila inteira: o botão sai da
  // tela, e a API recorta de novo do lado dela.
  const visoes = useMemo(
    () =>
      VISOES.filter(
        (v) => podeLerTodas || (v.id !== "fila" && v.id !== "nao-atribuidas"),
      ),
    [podeLerTodas],
  );

  /**
   * As abas com o número de cada visão.
   *
   * O número é o que faz a pessoa decidir ANTES de clicar: "4 sem dono e eu já com 6"
   * responde se ela pega mais um ou deixa para o time. Sem ele, escolher a visão era
   * abrir e ver, e aí a decisão já foi tomada pela curiosidade.
   *
   * `Resolvidas` não leva número: seria um contador que só cresce, e crescer não é
   * notícia. O que importa medir é o que está em aberto.
   */
  const abas = useMemo(
    () =>
      visoes.map((v) => ({
        id: v.id,
        /*
          Rótulo CURTO quando só cabe uma coluna. "Não atribuídas" e "Todas da fila"
          não cabem em 375px, e a aba rolava por dentro escondendo as últimas: a
          pessoa não via que existiam quatro. Encurtar é melhor que esconder.
        */
        label: umaColunaSo ? v.curto : v.label,
        badge:
          !contagem || v.id === "resolvidas"
            ? undefined
            : v.id === "minhas"
              ? contagem.minhas
              : v.id === "nao-atribuidas"
                ? contagem.naoAtribuidas
                : v.id === "aguardando-equipe"
                  ? contagem.aguardandoEquipe
                  : contagem.fila,
      })),
    [visoes, contagem, umaColunaSo],
  );

  // Setas navegam, Enter abre. `ignorarSeDigitando` existe porque a busca é um
  // input na mesma tela: sem isso, digitar "j" no campo pularia de conversa.
  // Os recortes por ETIQUETA vêm da configuração do produto e filtram aqui. No real
  // seria um parâmetro da busca; no wireframe a lista inteira já está em memória.
  const recursosDoProduto = recursosDe(produto || "mestre_do_bolao");
  const recortesTela = useMemo(
    () => [
      { id: "todas", label: "Todas" },
      ...(recursosDoProduto.recortesPorEtiqueta.length > 0
        ? recursosDoProduto.recortesPorEtiqueta.map(({ id, label }) => ({ id, label }))
        : RECORTES.slice(1).map(({ id, label }) => ({ id, label }))),
    ],
    [recursosDoProduto],
  );
  const etiquetaDoRecorte = recursosDoProduto.recortesPorEtiqueta.find((r) => r.id === recorte)?.etiqueta;
  const itens = useMemo(
    () =>
      (lista?.itens ?? []).filter(
        (c) => !etiquetaDoRecorte || (c.tags ?? []).some((t) => t.startsWith(etiquetaDoRecorte)),
      ),
    [lista, etiquetaDoRecorte],
  );
  const listaRef = useRef<HTMLElement>(null);

  const mover = useCallback(
    (passo: number) => {
      if (itens.length === 0) return;
      const atual = itens.findIndex((c) => c.id === selecionada);
      const proximo =
        atual === -1
          ? 0
          : Math.min(Math.max(atual + passo, 0), itens.length - 1);
      setSelecionada(itens[proximo].id);
      listaRef.current
        ?.querySelector(`[data-conversa="${itens[proximo].id}"]`)
        ?.scrollIntoView({ block: "nearest" });
    },
    [itens, selecionada],
  );

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const alvo = e.target as HTMLElement | null;
      const digitando =
        alvo &&
        (alvo.tagName === "INPUT" ||
          alvo.tagName === "TEXTAREA" ||
          alvo.isContentEditable);
      if (digitando) return;
      /**
       * Com modal aberto, o teclado é DELE.
       *
       * O `Escape` era ouvido aqui também, então fechar o modal de encerrar
       * fechava a conversa junto: o modal sumia e a thread sumia atrás dele, e
       * quem só queria desistir do encerramento tinha que achar a conversa de
       * novo na lista. As setas tinham o mesmo problema, trocando a conversa por
       * baixo do modal aberto.
       */
      if (modal) return;

      if (e.key === "ArrowDown" || e.key === "j") {
        e.preventDefault();
        mover(1);
      } else if (e.key === "ArrowUp" || e.key === "k") {
        e.preventDefault();
        mover(-1);
      } else if (e.key === "Escape") {
        setSelecionada(null);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mover, modal]);

  const opcoesFila = [
    { value: "", label: "Todas as filas" },
    ...(filas ?? []).map((f) => ({ value: f.id, label: f.nome })),
  ];
  /**
   * Com UMA fila só, o filtro escolhe entre "todas" e a única: tudo e a mesma coisa.
   *
   * É o caso de hoje (`cx-geral`, criada pelo seed) e o módulo nem tem rota para
   * criar outra. Escondido nos DOIS tamanhos, não só no desktop: controle que não
   * decide nada ensina a ignorar a faixa inteira, e é ali que moram os filtros que
   * decidem. Volta sozinho quando a segunda fila existir.
   */
  const temMaisDeUmaFila = (filas ?? []).length > 1;

  const ativos = (filaId ? 1 : 0) + (busca ? 1 : 0) + (historico ? 1 : 0);

  if (isLoading) return <PageLoading label="Carregando a caixa de entrada" />;

  return (
    <PageContainer>
      <PageHeader
        title="Conversas"
        subtitle={legenda}
        busy={isFetching}
        actions={
          <>
            <MenuSuspenso
              ariaLabel="Simular integrações"
              align="end"
              itens={[
                {
                  id: "lead",
                  label: "Chega lead novo pela landing page",
                  icon: Inbox,
                  onSelect: () => {
                    novoLeadDaLanding();
                    definirVisao("nao-atribuidas");
                  },
                },
                ...loja.disparos.map((d) => ({
                  id: `dsp-${d.id}`,
                  label: `${d.nome.split(" ")[0]} responde à chamada do Dispara Aí`,
                  icon: MessageSquare,
                  onSelect: () => {
                    const id = clienteRespondeDisparo(d.id, "Oi! Quero sim, me manda os bolões");
                    if (id) {
                      definirVisao("minhas");
                      setSelecionada(id);
                    }
                  },
                })),
                ...(conversa
                  ? [
                      ...(loja.ofertas[conversa.id] ?? []).map((bid) => {
                        const b = bolaoPorId(bid);
                        return {
                          id: `toque-${bid}`,
                          label: `Cliente toca em Quero minha cota · ${b?.modalidade} ${b?.concurso}`,
                          icon: Hand,
                          onSelect: () => {
                            if (simularToqueCota(conversa.id, bid)) setAbaPainel("carrinho");
                          },
                        };
                      }),
                      { id: "resp", label: "Cliente responde nesta conversa", icon: MessageSquare, onSelect: () => setModalBolao("resposta") },
                      { id: "prem", label: "Sai resultado: cliente premiado", icon: Trophy, onSelect: () => simularResultado(conversa.id, true) },
                      { id: "nprem", label: "Sai resultado: sem prêmio", icon: Trophy, onSelect: () => simularResultado(conversa.id, false) },
                    ]
                  : []),
              ]}
              gatilho={
                <Button size="sm" variant="outline" title="Dispara os eventos que, no real, viriam do WhatsApp, da Idea e do módulo do bolão">
                  <FlaskConical className="size-3.5" aria-hidden />
                  Simular
                </Button>
              }
            />
            <Button size="sm" variant="filled" onClick={() => setModalBolao("nova")}>
              <Plus className="size-3.5" aria-hidden />
              Nova conversa
            </Button>
          </>
        }
        // A VISÃO é a navegação do inbox, não filtro de recorte, e era o único
        // controle visível em linha: painel em volta de um controle que já traz
        // cápsula própria é o comprimido longo que o DS alerta, e foi o que
        // apareceu como faixa larga na tela. Na faixa do título ela também
        // sobrevive à rolagem, sobre o vidro da BarraFixa. Fila e busca ficam no
        // painel, que é onde filtro mora.
        tools={
          /*
            `flex-wrap` e `min-w-0` porque as abas MAIS o controle de turno não cabem
            na coluna de ferramentas em tela estreita: sem eles as abas eram cortadas
            pela esquerda e "Não atribuídas" aparecia como "atribuídas", que é pior que
            quebrar linha. O `PageHeader` já garante o piso da coluna do título.
          */
          <span className="flex min-w-0 flex-wrap items-center justify-end gap-2">
            {/*
              A VISÃO fica na faixa do título no DESKTOP, que é onde o DS põe navegação
              de tela, e vai para uma faixa própria no celular.
              O `PageHeader` é uma grade de duas colunas fixas
              (`minmax(9rem,1fr) minmax(0,auto)`), então em 375px sobram 171px para as
              ferramentas: as quatro abas ficavam espremidas e roladas por dentro, e
              "Não atribuídas" aparecia cortado. Navegação que não dá para ler é
              navegação pela metade.
              O conserto de raiz é a grade colapsar para uma coluna abaixo de `md`, e
              ele é do DS, porque vale para toda tela de módulo com ferramentas. Aqui
              fica a versão da tela até lá.
            */}
            <span className="hidden md:flex">
              <Tabs tabs={abas} activeTab={visao} onChange={trocarVisao} />
            </span>
            {/*
              O CONTADOR SAIU DAQUI: agora ele vive nas abas.
              Ele já tinha existido duas vezes antes (um no cabeçalho e um no topo da
              coluna) e o comentário que estava neste lugar dizia "vive aqui e em
              nenhum outro". As abas passaram a levar o número de cada visão, e manter
              o selo aqui recriava a mesma duplicação: "1 na fila" ao lado de uma aba
              escrita "Todas da fila 1".
            */}
            {/* A visão saiu daqui: virou o SeletorVisao, embaixo do cabeçalho, com
                os números de cada uma. Um segmentado de 30px não cabia o contador, e
                o contador é o que faz a pessoa decidir antes de abrir. */}
            {podeResponder && empresaId && (
              <MeuTurno
                status={meuTurno}
                desde={eu?.status_desde}
                salvando={trocandoTurno}
                onTrocar={(status) => {
                  void trocarTurno({ empresaId, status });
                }}
              />
            )}
          </span>
        }
      />

      {/*
        No celular a navegação e o botão de filtro dividem UMA linha.
        Antes o filtro ficava sozinho numa faixa própria, uma bolinha de 38px perdida
        no meio do respiro, e as abas noutra: duas linhas para dois controles que a
        pessoa usa junto. O `[&>*]:contents` faz o painel entregar o gatilho direto
        nesta linha em vez de embrulhá-lo num bloco de largura cheia.
      */}
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1 overflow-x-auto md:hidden">
          <Tabs tabs={abas} activeTab={visao} onChange={trocarVisao} />
        </div>

        {/*
          `flex-none` no celular e `flex-1` no desktop: no telefone o painel é só o
          botão de 38px e divide a linha com as abas; na tela larga ele volta a ocupar
          a faixa inteira, que é onde os controles ficam em linha.
        */}
        {/*
          O PAINEL INTEIRO SÓ EXISTE SE TIVER CONTROLE DENTRO.
          Com a busca no topo da lista e uma fila só, ele ficaria vazio: cápsula sem
          nada no desktop e, pior, um botão de filtro no celular que abre uma folha
          em branco. Moldura anunciando conteúdo que não existe é o mesmo defeito que
          o DS alerta em `Card` volta de seletor.
        */}
        {temMaisDeUmaFila && (
          <div className="min-w-0 flex-none md:flex-1">
            <PainelControles
              agrupamento="por-controle"
              ativos={ativos}
              descricao="Valem para a lista inteira."
              onLimpar={() => {
                setFilaId("");
                setBusca("");
                setHistorico(null);
              }}
            >
              <ControleLinha rotulo="Fila">
                <SelectPill
                  value={filaId}
                  onChange={setFilaId}
                  options={opcoesFila}
                  size="sm"
                  minWidth={150}
                />
              </ControleLinha>
            </PainelControles>
          </div>
        )}
      </div>

      {/*
        A FAIXA DO HISTÓRICO, e ela existe porque o atalho troca o SIGNIFICADO da
        lista, não só o conteúdo.
        Sem ela, clicar em "ver todas as conversas" faria a fila virar outra coisa
        sem aviso: some o que estava ali, aparece conversa resolvida de meses atrás,
        e a única saída seria recarregar a página. A faixa diz de quem é a lista e
        carrega o caminho de volta.
      */}
      {historico && (
        <div className="mb-2.5 flex items-center justify-between gap-3 rounded-[14px] bg-info-bg px-3 py-2">
          <span className="min-w-0 truncate text-[12.5px] text-text-strong">
            Histórico de <b>{historico.nome}</b>, em qualquer situação
          </span>
          <Button size="sm" variant="ghost" onClick={() => setHistorico(null)}>
            Voltar para a fila
          </Button>
        </div>
      )}

      {/*
        Três colunas no desktop, uma no celular. A lista tem largura fixa porque é
        régua de leitura: coluna de fila que estica vira linha longa e o olho perde
        o começo do nome. A thread é quem ganha o espaço que sobra.
      */}
      <div
        ref={refGrade}
        className="grid items-start gap-3"
        style={{ gridTemplateColumns: colunas }}
      >
        {mostrarLista && (
        <section
          ref={listaRef}
          aria-label="Fila de conversas"
          style={{ height: ALTURA_COLUNA }}
          className="flex flex-col gap-1 overflow-y-auto rounded-[20px] border-[0.5px] border-border-muted bg-surface p-2 shadow-[var(--l4-sh-rest)]"
        >
          {/*
            O recorte usa `Tabs`, a MESMA peça da visão logo acima.
            Eram dois controles de escolha um ao lado do outro com desenhos
            diferentes (segmentado aqui, abas lá em cima), e nada distinguia os dois
            gestos: os dois trocam o que a lista mostra. Peça igual para gesto igual
            é o que faz a tela parecer uma coisa só.
          */}
          {/*
            A BUSCA ABRE A LISTA, e não é preciosismo de lugar.
            Ela estava dentro da cápsula de filtros, ao lado de pílulas de escolha, e
            ali lia como mais um filtro entre outros: campo de digitar largo no meio
            de controles de 30px de altura, sem dizer sobre o que buscava. Caixa de
            entrada procura DENTRO da lista, então o campo mora onde a lista começa,
            que é onde todo inbox o põe e onde o olho vai sozinho.
          */}
          <div className="px-1 pt-1">
            <SearchBar
              placeholder="Nome, CPF, telefone ou ATD-0000"
              value={busca}
              debounceMs={350}
              onChange={(e) => setBusca(e.currentTarget.value)}
              onClear={() => setBusca("")}
            />
            {/*
              A ABA FICA MENTINDO ENQUANTO SE PROCURA, e por isso esta linha existe.
              Procurar atravessa as visões: o resultado traz conversa de outra pessoa
              e conversa já resolvida, mesmo com "Minhas" selecionada em cima. Sem
              dizer isso, a pessoa lê a lista como se fosse a aba e conclui que a
              contagem está errada.
            */}
            {busca && (
              <p className="px-1 pt-1.5 text-[11px] text-text-secondary">
                Procurando em <b>todas</b> as conversas, inclusive resolvidas e de
                outras pessoas.
              </p>
            )}
          </div>
          <div className="px-1 pb-2 pt-1">
            <Tabs
              tabs={recortesTela}
              activeTab={recorte}
              onChange={setRecorte}
            />
          </div>

          {!lista || itens.length === 0 ? (
            <Vazio
              icone={Inbox}
              titulo={VAZIO[visao].titulo}
              descricao={VAZIO[visao].descricao}
            />
          ) : (
            itens.map((c) => (
              <ItemConversa
                key={c.id}
                conversa={c}
                ativo={c.id === selecionada}
                onSelecionar={setSelecionada}
                /* Procurar atravessa as abas, então o resultado vem de qualquer
                   lugar: sem dizer onde, a pessoa abre sem saber se a conversa é
                   dela, de outra pessoa ou já encerrada. Fora da busca isso seria
                   ruído, porque a aba já respondeu. */
                mostrarOnde={Boolean(busca)}
              />
            ))
          )}
        </section>

        )}

        {mostrarThread && (
        <section
          aria-label="Conversa"
          style={{ height: ALTURA_COLUNA }}
          className={[
            "relative flex min-w-0 flex-col",
            // Superfície só quando há thread. Vazia, a coluna é o próprio fundo.
            selecionada
              ? "rounded-[20px] border-[0.5px] border-border-muted bg-surface shadow-[var(--l4-sh-rest)]"
              : "",
          ].join(" ")}
        >
          {!selecionada ? (
            <SemSelecao total={itens.length} />
          ) : !conversa ? (
            <div className="grid flex-1 place-items-center">
              <Spinner />
            </div>
          ) : (
            <>
              {/*
                CABEÇALHO, RESUMO E MENSAGENS NO MESMO ROLADOR.
                ──────────────────────────────────────────────
                Os três eram irmãos, o cabeçalho era `absolute` e o rolador
                compensava com `pt-[104px]`. O resumo, que entrou depois e em fluxo
                normal, não era empurrado por esse padding e ficava DEBAIXO do
                cabeçalho: o avatar cobria o texto e a cápsula do nome flutuava sobre
                os botões de ação (bug visto em produção).

                Com o cabeçalho `sticky` dentro do rolador, ele ocupa a própria
                altura no fluxo e o número mágico deixa de existir: ninguém mais
                precisa saber quanto o cabeçalho mede, o que também resolve o fato de
                ele ter crescido para 107px com o selo do produto.
              */}
              <div ref={refRolador} className="flex flex-1 flex-col overflow-y-auto pb-3">
                <CabecalhoThread
                  contato={conversa.contato}
                  ref_={conversa.atendimentos[0]?.ref}
                  produto={produtoDaConversa(conversa)}
                  onAbrirContexto={
                    cabeContexto ? undefined : () => setContextoAberto(true)
                  }
                  // Só quando a lista não está na tela: com as duas colunas visíveis,
                  // um botão de voltar não volta para lugar nenhum.
                  onVoltar={umaColunaSo ? () => setSelecionada(null) : undefined}
                  // Barra em linha no telefone, como no WhatsApp; o desenho centralizado
                  // do Messages fica para a tela larga, onde há altura sobrando.
                  compacto={umaColunaSo}
                  acoes={
                    <AcoesThread
                      rotuloEncerrar={recursosDe(conversa.produto_slug).rotuloEncerrar}
                      podeTransferir={podeReatribuir}
                      podeEncaminhar={podeEncaminhar && recursosDe(conversa.produto_slug).encaminhar}
                      podeEncerrar={podeEncerrar}
                      temCasoAberto={Boolean(atendimentoAberto)}
                      ehMinha={conversa.responsavel === meuId}
                      temDono={Boolean(conversa.responsavel)}
                      ocupado={assumindo || soltando}
                      // No telefone só a ação principal fica visível: as quatro lado a
                      // lado não cabem em 375px, e o que sobrava cortado era o Encerrar.
                      compacto={umaColunaSo}
                      onAssumir={() => {
                        if (!empresaId) return;
                        void comErro(
                          () => assumir({ empresaId, conversaId: conversa.id }).unwrap(),
                          // Assumir já muda o cabeçalho e a lista pela invalidação da
                          // tag; não há nada a fechar nem a limpar depois.
                          () => {},
                        );
                      }}
                      onSoltar={() => {
                        if (!empresaId) return;
                        void comErro(
                          () => soltar({ empresaId, conversaId: conversa.id }).unwrap(),
                          // Soltar tira a conversa da visão "Minhas": fechar a thread
                          // evita a pessoa continuar olhando um caso que já não é dela.
                          () => setSelecionada(null),
                        );
                      }}
                      onTransferir={() => setModal("transferir")}
                      /**
                       * O caso abre ANTES do modal quando não existe.
                       *
                       * O rótulo já dizia "Abrir o caso e encaminhar" e ninguém
                       * abria: o modal subia, a busca da ficha era pulada por falta
                       * de id, e o corpo dizia "Não deu para carregar a ficha do
                       * caso. Abra o caso nesta conversa", sem oferecer onde abrir.
                       * Abrindo aqui, a ficha chega e o formulário existe.
                       */
                      onEncaminhar={() => {
                        if (atendimentoAberto || !empresaId) {
                          setModal("encaminhar");
                          return;
                        }
                        void comErro(
                          () =>
                            abrirAtendimento({
                              empresaId,
                              conversaId: conversa.id,
                            }).unwrap(),
                          () => setModal("encaminhar"),
                        );
                      }}
                      onEncerrar={() => {
                        setSugestao(null);
                        setModal("encerrar");
                        // Só pede quando o Blue está ligado nesta instalação: sem
                        // chave de provedor a rota responde erro e a tela mostraria
                        // um "lendo a conversa" que nunca vira sugestão.
                        if (!blue?.ligado) return;
                        void pedirMotivoSugerido({ conversaId: conversa.id })
                          .unwrap()
                          .then(setSugestao)
                          .catch(() => setSugestao(null));
                      }}
                    />
                  }
                />

                {/*
                  O resumo aparece em TODA conversa, com dono ou sem.

                  Estava restrito a conversa sem dono, com o argumento de que serve para
                  DECIDIR se pega e que depois a pessoa lê a thread. O argumento estava
                  errado, e o usuário viu isso usando: quem acabou de assumir é justamente
                  quem ainda não leu nada, e some exatamente no momento em que ele mais
                  serve. Além disso a conversa transferida chega para o próximo com o
                  mesmo problema, e ele tem dono.

                  Custa zero mostrar sempre: o resumo é sob DEMANDA (um botão), então a
                  chamada ao modelo só acontece se alguém clicar. Se fosse automático,
                  aparecer em toda conversa seria conta de IA em cada abertura de thread.

                  Fica DEPOIS do cabeçalho e no mesmo rolador. Era irmão dele, em fluxo
                  normal, e o cabeçalho absoluto era desenhado por cima.
                */}
                <ResumoBlue conversaId={conversa.id} />

                {agrupar(conversa.mensagens).map((item) => (
                  <Bolha
                    key={item.mensagem.id}
                    item={item}
                    corpoOculto={conversa.corpoOculto}
                  />
                ))}
                {carregandoThread && (
                  <div className="flex justify-center py-2">
                    <Spinner size={16} />
                  </div>
                )}
              </div>

              {/*
                O campo só existe para quem pode responder. O gestor da praça lê a
                fila inteira e NÃO responde, e esconder o campo é mais honesto que
                deixá-lo lá para dar 403 no envio.
              */}
              {podeResponder && (
                <AcoesProduto
                  produtoSlug={conversa.produto_slug}
                  conversaId={conversa.id}
                  nomeCliente={conversa.contato?.nome ?? "Cliente"}
                  onAbrirPainel={mostrarContexto ? undefined : () => setContextoAberto(true)}
                />
              )}
              {podeResponder ? (
                <Composer
                  conversaId={conversa.id}
                  nomeDoContato={conversa.contato?.nome}
                  janela={conversa.janela}
                  // O trilho fala a língua da rede: no Instagram são 7 dias e não
                  // existe template aprovado.
                  rede={conversa.canal?.tipo}
                  macros={macros ?? []}
                  bloqueioDuro={regua.bloqueio}
                  termosRevisao={regua.revisao}
                  /**
                   * ISTO ERA `false` FIXO, com a mensagem "o envio chega com o canal
                   * do WhatsApp (F1)".
                   *
                   * Foi escrito quando não havia canal. O canal existe, o despachante
                   * fala com a Meta e o bot já responde por ele há dias, e o campo do
                   * atendente continuava pregado: dava para ver a conversa, dava para
                   * escrever, e o botão nunca ligava.
                   *
                   * As travas de verdade são do servidor (permissão, janela de 24h,
                   * régua, idempotência). Aqui só se antecipa a que a pessoa pode
                   * consertar sozinha, que é a janela fechada.
                   */
                  podeEnviar={conversa.janela?.aberta ?? false}
                  motivoIndisponivel={
                    conversa.janela?.aberta
                      ? undefined
                      : "Janela de 24h fechada: só passa template aprovado."
                  }
                  /**
                   * Envia e diz se saiu, para o campo limpar só quando saiu.
                   *
                   * A chave de idempotência é uma POR TENTATIVA e continua vinda
                   * do cliente, mas ela não é o que impede o clique duplo: dois
                   * cliques em instantes diferentes gerariam chaves diferentes. A
                   * trava do duplo é o botão travado enquanto a requisição vive,
                   * dentro do Composer. A chave cobre o outro caso, que é a
                   * resposta se perder na rede e a pessoa tentar de novo.
                   */
                  erro={erroEnvio}
                  onEnviar={async (texto) => {
                    setErroEnvio(null);
                    try {
                      await enviarMensagem({
                        conversaId: conversa.id,
                        texto,
                        idemKey: `web:${conversa.id}:${Date.now()}`,
                      }).unwrap();
                      return true;
                    } catch (e) {
                      const corpo = (e as { data?: { message?: string | string[] } })
                        .data;
                      const msg = Array.isArray(corpo?.message)
                        ? corpo?.message[0]
                        : corpo?.message;
                      setErroEnvio(msg ?? "Não deu para enviar. Tente de novo.");
                      return false;
                    }
                  }}
                  /**
                   * O anexo repete o MESMO tratamento de erro do texto, e isso é
                   * deliberado: a API recusa por tipo, por tamanho e pela régua de
                   * compliance, e as três mensagens são para a pessoa ler. Um
                   * "não deu" genérico aqui faria ela tentar de novo o mesmo arquivo.
                   */
                  onEnviarAnexo={async (arquivo, legenda) => {
                    setErroEnvio(null);
                    try {
                      await enviarAnexo({
                        conversaId: conversa.id,
                        arquivo,
                        texto: legenda,
                        idemKey: `web:${conversa.id}:anexo:${Date.now()}`,
                      }).unwrap();
                      return true;
                    } catch (e) {
                      const corpo = (e as { data?: { message?: string | string[] } })
                        .data;
                      const msg = Array.isArray(corpo?.message)
                        ? corpo?.message[0]
                        : corpo?.message;
                      setErroEnvio(msg ?? "Não deu para enviar o anexo. Tente de novo.");
                      return false;
                    }
                  }}
                  // Só passa a função quando o Blue está ligado: sem chave de
                  // provedor o botão não existe, em vez de existir e falhar.
                  gerarRascunho={
                    blue?.ligado && selecionada
                      ? async () => {
                          try {
                            const r = await pedirRascunho({
                              conversaId: selecionada,
                            }).unwrap();
                            // Bloqueio duro devolve o texto mesmo assim, para a
                            // pessoa ver o que o Blue tentou dizer. A régua do
                            // campo reavalia e tranca o envio.
                            return r.texto;
                          } catch {
                            return null;
                          }
                        }
                      : undefined
                  }
                />
              ) : (
                <p className="border-t-[0.5px] border-border-muted px-4 py-3 text-[12px] text-text-secondary">
                  Seu perfil enxerga a conversa mas não responde cliente.
                </p>
              )}
            </>
          )}
        </section>
        )}

        {/* A coluna de contexto só existe com conversa aberta. Vazia ela era um
            parágrafo solto ocupando 276px de largura sem dizer nada.

            `selecionada` entra na condição junto com `conversa`: o RTK Query
            guarda o último resultado, então fechar a thread deixava a terceira
            coluna mostrando CPF, telefone e caso da conversa anterior ao lado de
            um "Escolha uma conversa". Dado pessoal de alguém que já não está na
            tela é o pior lugar para um cache sobreviver. */}
        {mostrarContexto && conversa && (
          <aside
            aria-label="Contexto"
            className="min-w-0 overflow-y-auto"
            style={{ height: ALTURA_COLUNA }}
          >
            <PainelProduto
              onVerHistorico={(id, nome) => setHistorico({ id, nome })}
              conversa={conversa}
              consulta={consulta}
              veFinanceiro={veFinanceiro}
              aba={abaPainel}
              onAba={setAbaPainel}
              onArte={(id) => {
                setArteBolaoId(id);
                setModalBolao("arte");
              }}
            />
          </aside>
        )}
      </div>

      {/*
        Mesma informação da terceira coluna, em folha, para quando a tela não tem
        largura para ela. `xl:hidden` no gatilho não dá: o gatilho é o cabeçalho,
        que existe sempre. Então a folha existe sempre e em tela larga ela
        simplesmente não é acionada, porque a coluna já mostra tudo.
      */}
      <ModalEncerrar
        aberto={modal === "encerrar"}
        taxonomia={taxonomia ?? []}
        salvando={encerrando || abrindoCaso}
        sugestao={sugestao}
        sugerindo={sugerindo}
        onFechar={() => {
          setModal(null);
          setErroAcao(null);
        }}
        erro={erroAcao}
        /**
         * ISTO NÃO SALVAVA, e o jeito de não salvar era o pior possível.
         *
         * O corpo era `if (!empresaId || !atendimentoId) return;`, e conversa sem
         * caso aberto cai exatamente nesse `return`. Medido na bancada: escolher o
         * motivo e clicar em "Encerrar com este motivo" não disparava requisição
         * NENHUMA (zero linhas no log da API), o modal continuava aberto, o botão
         * não dava sinal, e clicar de novo repetia o nada. O botão "Encerrar" nem
         * era escondido nesse caso, então nada avisava antes.
         *
         * A suspeita de `motivo_id` em snake_case não se confirmou: a mutation já
         * mandava `motivoId`, igual ao `EncerrarDto`, e com caso aberto o
         * encerramento sempre funcionou.
         *
         * O conserto é o mesmo raciocínio que o encaminhar já usava: exigir caso
         * aberto é sequência de passos, não impedimento, e sequência de passos a
         * tela resolve sozinha. Abrir com o motivo escolhido (e não sem motivo)
         * porque é ele que carimba gravidade e prazo regulatório do cenário.
         */
        onConfirmar={async (motivoId, resolucao) => {
          if (!empresaId || !conversa) {
            setErroAcao(
              "A praça ainda não carregou. Recarregue a página e tente de novo.",
            );
            return;
          }
          await comErro(
            async () => {
              const atendimentoId =
                conversa.atendimentos.find((a) => !a.resolvido_em)?.id ??
                (
                  await abrirAtendimento({
                    empresaId,
                    conversaId: conversa.id,
                    motivoId,
                  }).unwrap()
                ).id;
              return encerrar({
                empresaId,
                atendimentoId,
                motivoId,
                resolucao,
              }).unwrap();
            },
            () => {
              setModal(null);
              // A conversa fecha, então sai da visão aberta: soltar a seleção
              // evita a thread ficar na tela apontando para um caso que já não
              // existe ali.
              setSelecionada(null);
            },
          );
        }}
      />

      <ModalTransferir
        aberto={modal === "transferir"}
        filas={filas ?? []}
        pessoas={(atendentes ?? [])
          .filter((a) => a.user_id !== meuId)
          .map((a) => ({ id: a.user_id, nome: a.nome, status: a.status }))}
        salvando={transferindo}
        onFechar={() => {
          setModal(null);
          setErroAcao(null);
        }}
        erro={erroAcao}
        onConfirmar={async (destino, motivo) => {
          if (!empresaId || !selecionada) return;
          await comErro(
            () =>
              transferir({
                empresaId,
                conversaId: selecionada,
                ...destino,
                motivo,
              }).unwrap(),
            () => {
              setModal(null);
              setSelecionada(null);
            },
          );
        }}
      />

      <ModalEncaminhar
        aberto={modal === "encaminhar"}
        ficha={ficha}
        carregando={fichaCarregando}
        salvando={encaminhando}
        onFechar={() => {
          setModal(null);
          setErroAcao(null);
        }}
        erro={erroAcao}
        onLimparErro={() => setErroAcao(null)}
        onConfirmar={async (equipe, coleta) => {
          if (!empresaId || !conversa) {
            setErroAcao(
              "A praça ainda não carregou. Recarregue a página e tente de novo.",
            );
            return;
          }
          await comErro(
            async () => {
              // Mesmo `return` mudo do encerrar: sem caso aberto a tela desistia
              // em silêncio, enquanto o próprio botão prometia "Abrir o caso e
              // encaminhar". Agora abre de verdade e segue.
              const atendimentoId =
                atendimentoAberto ??
                (
                  await abrirAtendimento({
                    empresaId,
                    conversaId: conversa.id,
                  }).unwrap()
                ).id;
              return encaminhar({ atendimentoId, equipe, coleta }).unwrap();
            },
            () => setModal(null),
          );
        }}
      />

      {conversa && (
        <>
          <ModalCriaAi
            aberto={modalBolao === "arte"}
            bolaoInicial={arteBolaoId}
            conversaId={conversa.id}
            onFechar={() => setModalBolao(null)}
          />
          <ModalRespostaCliente
            aberto={modalBolao === "resposta"}
            onFechar={() => setModalBolao(null)}
            onEnviar={(t) => simularRespostaCliente(conversa.id, t)}
          />
        </>
      )}
      <ModalNovaConversa
        aberto={modalBolao === "nova"}
        onFechar={() => setModalBolao(null)}
        onCriar={({ nome, telefone, texto }) => {
          registrarDisparo({ nome, telefone, texto });
          setModalBolao(null);
          toast({
            title: `Enviado pelo Dispara Aí para ${nome.split(" ")[0]}`,
            description: "A conversa entra na sua fila quando o cliente responder. Simule em Simular.",
          });
        }}
      />

      <Sheet open={contextoAberto} onOpenChange={setContextoAberto}>
        <SheetContent side="right" size="sm">
          <SheetHeader>{conversa && recursosDe(conversa.produto_slug).paineis.length > 1 ? "Bolões, carrinho e cliente" : "Dados do participante"}</SheetHeader>
          <SheetBody>
            {conversa && (
              <PainelProduto
                onVerHistorico={(id, nome) => setHistorico({ id, nome })}
                conversa={conversa}
                consulta={consulta}
                veFinanceiro={veFinanceiro}
                aba={abaPainel}
                onAba={setAbaPainel}
                onArte={(id) => {
                  setContextoAberto(false);
                  setArteBolaoId(id);
                  setModalBolao("arte");
                }}
              />
            )}
          </SheetBody>
        </SheetContent>
      </Sheet>
    </PageContainer>
  );
}

/** Uma tecla desenhada, para o atalho parecer o que é. */
function Tecla({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex min-w-[20px] items-center justify-center rounded-[6px] bg-[var(--l4-fill-3)] px-1.5 py-0.5 font-sans text-[10.5px] font-semibold text-text-secondary">
      {children}
    </kbd>
  );
}

/**
 * A coluna da thread sem conversa aberta. Três decisões:
 *
 * 1. **Sem cartão.** O painel já era um cartão e o EmptyState do DS desenha outro
 *    por dentro: moldura dentro de moldura, e cartão vazio anuncia conteúdo onde
 *    não há nenhum. Aqui a coluna é o próprio fundo da página.
 * 2. **Não repete o óbvio.** "Escolha uma conversa" ao lado de uma lista de
 *    conversas não informa nada. O que a pessoa não sabe é que dá para percorrer a
 *    fila sem sair do teclado, e é isso que o vazio ensina.
 * 3. **Fala o tamanho da fila.** Quem abre a tela quer saber quanto tem para fazer
 *    antes de abrir a primeira.
 */
function SemSelecao({ total }: { total: number }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-10 text-center">
      <div className="grid size-14 place-items-center rounded-full bg-[var(--l4-fill-4)]">
        <MessageSquare className="size-6 text-text-secondary" />
      </div>

      {/*
        Sem o NÚMERO: ele já está na aba ("Todas da fila 3") e repeti-lo aqui era a
        quarta vez que a mesma contagem aparecia na tela. Este espaço responde outra
        pergunta, que é "e agora, o que eu faço?".
      */}
      <p className="text-[15px] font-semibold tracking-[-0.01em] text-text-strong">
        {total === 0 ? "Nada por aqui" : "Escolha uma conversa"}
      </p>
      {total === 0 && (
        <p className="max-w-[34ch] text-[12.5px] leading-relaxed text-text-secondary">
          O bot atende primeiro e só encaminha o que ele não resolve.
        </p>
      )}

      {/*
        As teclas somem no celular, e por dois motivos que apontam para o mesmo lado:
        elas eram o único elemento que vazava a largura do `main` em 375px (medido),
        e num telefone não existe seta nem esc. Ensinar atalho de teclado a quem não
        tem teclado é ruído ocupando a única tela que já é estreita.
      */}
      {total > 0 && (
        <div className="hidden flex-wrap items-center justify-center gap-x-3 gap-y-1.5 text-[12px] text-text-secondary md:flex">
          <span className="flex items-center gap-1.5">
            <Tecla>↑</Tecla>
            <Tecla>↓</Tecla>
            percorrer
          </span>
          <span className="flex items-center gap-1.5">
            <Tecla>esc</Tecla>
            fechar
          </span>
        </div>
      )}
    </div>
  );
}
