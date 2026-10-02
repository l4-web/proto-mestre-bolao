/** Contratos da API do módulo. Espelham o que o backend serializa, e só isso. */

export type Gravidade = "critico" | "alto" | "medio";
export type EstadoConversa =
  | "nova"
  | "em_atendimento"
  | "aguardando_cliente"
  /**
   * PARADA esperando outra equipe. A conversa continua sendo do atendente (é ele
   * quem fala com o cliente), mas sai da cobrança dele enquanto a caixa técnica ou a
   * financeira não responde: é a queixa de "encaminhei e o caso ficou na minha fila".
   */
  | "aguardando_equipe"
  | "resolvida"
  /**
   * Fechada pelo RELÓGIO, não por alguém ter resolvido.
   *
   * O fechamento automático marcava `resolvida`, que afirma que o problema do cliente
   * acabou. Conversa que morre de inatividade não acabou, foi abandonada, e contar as
   * duas juntas envenena taxa de resolução, base de CSAT e taxonomia de motivo.
   */
  | "expirada"
  | "reaberta";
export type Visao =
  | "minhas"
  | "nao-atribuidas"
  | "fila"
  | "resolvidas"
  /** O par obrigatório do estado acima: sem onde vê-las, elas sumiriam da tela. */
  | "aguardando-equipe";
/** Sentimento nos três eixos de classificação. */
export type Sentimento =
  | "negativo"
  | "neutro"
  | "positivo"
  | "nao_classificado";

export type CodigoTratamento =
  | "cq"
  | "df"
  | "faq"
  | "interno"
  | "rg"
  | "tc"
  | "direto"
  | "especial";

/**
 * O contato como a API devolve. `nome`, `cpf` e `telefone` vêm `null` e
 * `oculto: true` quando o papel não tem `contato.pessoais`, e é por isso que a
 * tela nunca decide mascarar: ela só desenha o que recebeu.
 */
export interface Contato {
  id: string;
  nome: string | null;
  /**
   * O @ da rede social, quando a pessoa chegou por comentário.
   *
   * Nulo no WhatsApp e nulo para quem não pode ver dado pessoal, porque o handle
   * identifica tanto quanto o nome. Existe para a fila parar de dizer "Sem nome" no
   * caso que nasceu de um comentário: ali `nome` é nulo de propósito.
   */
  handle?: string | null;
  cpf: string | null;
  telefone: string | null;
  oculto: boolean;
  tags?: string[];
}

export interface Canal {
  id: string;
  tipo: "whatsapp" | "instagram" | "facebook";
  rotulo: string;
  status?: string;
}

export interface MotivoResumo {
  id: string;
  label: string;
  codigo_tratamento: CodigoTratamento;
}

/**
 * OS QUATRO ESTADOS DA AVALIAÇÃO DO CLIENTE (CSAT), como a API os entrega.
 *
 * Quem decide o estado é a API, e não a tela: a distinção mora em três colunas de
 * `atd_avaliacao` (mais a ausência da linha inteira), e reconstruir essa lógica aqui
 * seria uma segunda versão da verdade que diverge na primeira correção.
 *
 * São QUATRO e não três porque `sem_resposta` e `nao_perguntado` exigem ações opostas:
 * um é o cliente que não voltou, o outro é a janela de 24h da Meta que fechou antes de
 * o caso ser encerrado. Colapsados num "não avaliado" só, o time cobra o atendente
 * pelo segundo, que não é falha de ninguém.
 */
export type EstadoAvaliacao =
  | "avaliado"
  | "sem_resposta"
  | "nao_perguntado"
  | "em_aberto";

export interface Avaliacao {
  estado: EstadoAvaliacao;
  /** 5, 3 ou 1. Só existe em `avaliado`. */
  nota: number | null;
  /** "Ótimo", "Regular" ou "Ruim", resolvido pela API. A tela nunca traduz nota. */
  rotulo: string | null;
  pedidoEm: string | null;
  respondidoEm: string | null;
}

export interface AtendimentoResumo {
  id: string;
  ref: string;
  gravidade: Gravidade;
  /** Quando o caso fechou. Congela o prazo: ver `prazo()` em components/conversa/util. */
  resolvido_em: string | null;
  sla_com_resolucao_em: string | null;
  sla_com_estourado: boolean;
  sla_reg_prazo_em: string | null;
  sla_reg_estourado: boolean;
  motivo: MotivoResumo | null;
}

/** O link temporário do anexo, como `GET v1/midias/:mensagemId` devolve. */
export interface LinkDeMidia {
  url: string;
  mime: string | null;
  nome: string | null;
  bytes: number | null;
}

export interface Mensagem {
  id: string;
  direcao: "inbound" | "outbound";
  autor: "cliente" | "bot" | "atendente" | "sistema";
  tipo: string;
  conteudo: string | null;
  midia_gcs: string | null;
  status_entrega: string | null;
  origem_resposta: "arvore" | "ia" | "humano" | null;
  created_at: string;
}

/**
 * O produto da conversa, com o rótulo JÁ resolvido pela API.
 *
 * O rótulo vem de lá e a tela nunca inventa um. A empresa vende vários produtos de
 * capitalização e os slugs não são apresentáveis (`hipercap_brasil` é HiperXCAP
 * depois de 27/06, e era outra coisa antes): um de-para escrito no front seria uma
 * segunda versão da verdade, que diverge da primeira no dia em que o produto for
 * renomeado e ninguém lembrar que existia uma cópia aqui.
 */
export interface ProdutoDaConversa {
  slug: string;
  rotulo: string;
}

export interface ConversaItem {
  id: string;
  estado: EstadoConversa;
  sentimento: Sentimento;
  /** Taxonomia de negócio (Elogio, Dúvida, Reclamação). */
  temas: string[];
  /** Texto livre, criado na hora. Não polui a árvore de motivos que define SLA. */
  tags: string[];
  canal: Canal;
  responsavel: string | null;
  produto_slug: string | null;
  /**
   * O produto com rótulo legível. Opcional porque front e API sobem separados:
   * campo novo declarado obrigatório derruba a tela até a API alcançar, e já
   * derrubou (ver a nota em `ProntidaoBot.etapas`). Sem ele a tela cai no
   * `produto_slug`, que sempre existiu.
   */
  produto?: ProdutoDaConversa | null;
  janela_expira_em: string | null;
  ultimo_evento_em: string;
  contato: Contato;
  atendimento: AtendimentoResumo | null;
  /**
   * A nota do cliente no ÚLTIMO caso da thread. Opcional porque front e API sobem
   * separados: campo novo declarado obrigatório derruba a tela até a API alcançar.
   */
  avaliacao?: Avaliacao;
  previa: { conteudo: string | null; autor: string; created_at: string } | null;
}

export interface ListaConversas {
  itens: ConversaItem[];
  proximoCursor: string | null;
}

/** O que a janela de 24h libera. `template` = só HSM aprovado. */
export interface Janela {
  aberta: boolean;
  restaMinutos: number;
  /**
   * Instante de expiração, ISO. É o que deixa a tela contar sozinha: com só
   * `restaMinutos` o relógio congela no valor da última resposta da API.
   */
  expiraEm: string | null;
  permite: "livre" | "template";
}

/**
 * `true` quando a transcrição veio SEM texto por falta de permissão, e não porque
 * as mensagens são mídia. A distinção importa: sem ela a tela diz "anexo de texto"
 * em toda bolha do gestor, o que é uma mentira que parece defeito de dado.
 */
export interface ConversaDetalhe extends Omit<
  ConversaItem,
  "atendimento" | "previa"
> {
  corpoOculto?: boolean;
  atendimentos: (AtendimentoResumo & {
    resolvido_em: string | null;
    resolucao: string | null;
    /** A nota daquele CASO. Opcional enquanto a API do ambiente não alcança. */
    avaliacao?: Avaliacao;
  })[];
  mensagens: Mensagem[];
  janela: Janela;
}

export interface Fila {
  id: string;
  slug: string;
  nome: string;
  ativa: boolean;
  ordem: number;
}

export interface Atendente {
  id: string;
  user_id: string;
  /** Nome de exibição resolvido no CORE pela API. O banco guarda só o `user_id`. */
  nome: string;
  fila_id: string | null;
  status: "online" | "pausa" | "offline";
  /** Desde quando neste status. Não é `updated_at`: aquele muda com a carga. */
  status_desde?: string | null;
  capacidade: number;
  carga: number;
  /**
   * Os produtos que esta pessoa atende. **LISTA VAZIA ATENDE TUDO**, e não "não
   * atende nada".
   *
   * É fail-open na API de propósito: a migration que criou a coluna entra com todo
   * mundo em branco, e se vazio significasse "nenhum produto" a fila do módulo
   * inteiro pararia de distribuir no dia em que ela subisse. Toda leitura na tela
   * precisa dizer isso em texto, porque a lista aparece vazia e a conclusão natural
   * de quem configura é o contrário da verdade.
   *
   * Opcional porque a API pode ainda não mandar o campo (front e API sobem
   * separados), e `undefined` cai no mesmo lugar que `[]`: atende tudo.
   */
  produtos?: string[];
}

export interface EmRisco {
  id: string;
  ref: string;
  gravidade: Gravidade;
  responsavel: string | null;
  sla_com_resolucao_em: string | null;
  sla_reg_tipo: string | null;
  sla_reg_prazo_em: string | null;
  motivo: { label: string } | null;
}

export interface MotivoNo {
  id: string;
  slug: string;
  label: string;
  gravidade_padrao: Gravidade;
  codigo_tratamento: CodigoTratamento;
  gatilhos: string[];
  resposta_restrita: boolean;
  sla_reg_tipo: string | null;
}

export interface EtapaMotivo {
  id: string;
  slug: string;
  label: string;
  filhos: MotivoNo[];
}

export interface ProdutoDaPraca {
  id: string;
  produto_slug: string;
  /** Rótulo legível, quando a API o resolve. Sem ele a tela mostra o slug cru. */
  rotulo?: string | null;
  ativo: boolean;
  /**
   * Como este produto se chama NO iON. Vazio ou nulo = nao consulta o iOn.
   *
   * Hoje coincide com o `produto_slug` em `apcap`, e isso e coincidencia: a
   * taxonomia do iOn e dele, e ele ja recusou com 400 um slug nosso que nao conhecia.
   * Por isso a coluna existe em vez de a consulta reusar o slug de casa.
   */
  ion_marca?: string | null;
  compliance: {
    bloqueio_duro: string[];
    termos_revisao: string[];
    idade_minima: number;
  } | null;
}

/**
 * Um freio de mão da praça, como a API serializa.
 *
 * NULO É LIGADO, e não "não sei". A coluna é `Boolean?` no banco porque nasceu numa
 * migration anterior ao código que a lê, e a praça que ninguém configurou tem que
 * seguir se comportando como se comportava: enviando. Só `false` desliga.
 *
 * Por isso a leitura na tela é `flag !== false`, nunca `flag ?? false` nem `!flag`:
 * as duas últimas mostram "desligado" para toda praça que ninguém tocou, e no
 * primeiro Salvar gravam esse `false` de volta, desligando de verdade um freio que
 * ninguém puxou.
 */
export type FreioDeMao = boolean | null;

export interface Praca {
  id: string;
  empresa_id: string;
  nome: string;
  fuso: string;
  /** Horário de funcionamento, por dia da semana (`{ dias: { "1": [["09:00","18:00"]] } }`). */
  expediente: { dias?: Record<string, [string, string][]> } | null;
  auto_fechar_conversa_horas: number;
  auto_offline_atendente_min: number;
  /**
   * De quanto em quanto tempo quem está na fila sem dono ouve que continua nela.
   *
   * Zero DESLIGA o lembrete, e é o único jeito de desligar: apagar os textos NÃO
   * desliga, volta aos padrões (ver `lembrete_espera_textos`).
   *
   * O relógio sozinho não decide a hora: o lembrete só sai dentro do `expediente`, e
   * é de lá que sai o corte da tarde.
   */
  /** O primeiro aviso da espera. Nulo ou vazio usa `espera_texto_inicial_padrao`. */
  espera_texto_inicial: string | null;
  /** O texto de fábrica do primeiro aviso, para a tela mostrar como placeholder. */
  espera_texto_inicial_padrao?: string | null;
  lembrete_espera_horas: number;
  /**
   * Os textos dos lembretes, NA ORDEM em que saem: o primeiro lembrete usa o
   * primeiro. Nulo ou vazio cai nos textos padrão da API, nunca em silêncio.
   */
  lembrete_espera_textos: string[] | null;
  /**
   * Os textos de FÁBRICA, que a API manda junto e a tela usa de `placeholder`.
   *
   * Leitura só: não existe coluna para eles. Vêm da API em vez de morarem numa
   * constante daqui porque uma segunda cópia das oito frases divergiria da que sai de
   * verdade, e o sintoma seria a tela mostrando uma coisa e o cliente lendo outra.
   */
  lembrete_espera_padroes?: string[];
  /** Desligado, toda mensagem que chega vai direto para gente. */
  bot_ativo: FreioDeMao;
  /** Desligado, nenhuma mensagem sai da praça (nem do bot, nem do atendente). */
  envio_ativo: FreioDeMao;
  /** Desligado, corta a chamada ao modelo de IA. O resto do Blue segue. */
  ia_ativa: FreioDeMao;
  /**
   * A praça responde SOZINHA ao comentário elogioso.
   *
   * `boolean` e não `FreioDeMao`, e a diferença é o oposto do que parece detalhe: nos
   * três acima nulo é LIGADO (a coluna nasceu depois do comportamento). Aqui a coluna
   * é `NOT NULL DEFAULT false`, porque publicar em nome da marca sem ninguém ler é o
   * que precisa ser ligado por alguém, nunca herdado por omissão.
   */
  auto_resposta_ativa: boolean;
  /** O texto que sai. Vazio desliga na prática: não existe frase de fábrica. */
  auto_resposta_modelo: string | null;
  /** BigInt serializado como STRING pela API, para não perder precisão acima de 2^53. */
  teto_micros_mes: string | null;
  teto_alerta_pct: number;
  teto_acao: "avisar" | "restringir" | "bloquear";
  canais: (Canal & {
    external_id: string;
    waba_id: string | null;
    /** NOME do secret com o token, nunca o token. Nulo = canal sem token. */
    secret_nome: string | null;
    /**
     * O produto DESTE NÚMERO. Cada produto de capitalização tem o seu número, e é o
     * produto que decide a árvore do bot, os artigos e a taxonomia da conversa.
     *
     * Nulo numa praça com mais de um produto ativo é canal que NÃO ATENDE: a API
     * recusa em vez de escolher, porque responder HiperXCAP com o conteúdo do APCAP
     * é pior do que não responder. Opcional aqui enquanto a API não manda o campo.
     */
    produto_slug?: string | null;
    quality_rating: string | null;
    subscribed_apps_ok: boolean;
    token_expira_em: string | null;
    ultimo_evento_em: string | null;
  })[];
  produtos: ProdutoDaPraca[];
}

export type Equipe = "dev" | "pagamentos";

/** A ficha de encaminhamento, montada pela API. */
export interface FichaEncaminhamento {
  ref: string;
  motivo: string | null;
  /** Equipe que o MOTIVO sugere. `null` = a taxonomia não sabe, quem encaminha escolhe. */
  sugerida: Equipe | null;
  equipes: { equipe: Equipe; campos: string[]; aviso: string }[];
}

export type NivelCompliance = "ok" | "revisao" | "bloqueio";

/** Rascunho do Blue, já passado pela régua de linguagem do produto. */
export interface RascunhoBlue {
  texto: string;
  modelo: string;
  compliance: {
    nivel: NivelCompliance;
    bloqueios: string[];
    revisar: string[];
    faltando: string[];
  };
}

/**
 * A consulta mínima do painel de contexto, como a API entrega.
 *
 * Cada linha traz o próprio estado porque as seis falham por motivos diferentes, e
 * a tela precisa dizer QUAL: não ter fonte (o saldo, que é do APCAP VIP e não existe
 * hoje) é diferente de não ter dado para esta pessoa, que é diferente de a fonte não
 * ter respondido agora.
 */
export type EstadoLinhaConsulta =
  | "ok"
  | "nao_consta"
  | "sem_fonte"
  | "indisponivel"
  | "nao_identificado";

export interface LinhaConsulta {
  chave: string;
  rotulo: string;
  fonte: "ion" | "apcap" | "disparai";
  estado: EstadoLinhaConsulta;
  valor: string | null;
  nota: string | null;
}

export interface Consulta {
  identificacao: {
    resolvido: boolean;
    por: "telefone" | "cpf" | null;
    pedirAoCliente: string | null;
    /**
     * `true` = a consulta ao iOn JÁ foi feita com o CPF e voltou vazia.
     *
     * É a diferença entre "ainda não pedimos o CPF" e "pedimos, consultamos e o iOn
     * não conhece esta pessoa". Sem ela os dois estados chegam aqui como o mesmo
     * "não identificado", e o atendente pede o CPF a quem acabou de mandar.
     */
    consultadoSemResultado: boolean;
  };
  linhas: LinhaConsulta[];
  /** `null` = não deu para avaliar, que NÃO é o mesmo que "não há divergência". */
  divergencia: boolean | null;
  divergenciaNota: string | null;
  optOut: boolean | null;
  leadUrl: string | null;
}

/**
 * Uma EDIÇÃO do produto: o espelho local de uma promoção do iOn.
 *
 * `vigente` é a que está no ar, e há no máximo uma por praça e produto (a trava é do
 * banco, sentinela mais índice único). Ela decide o que o bot diz: artigo `por_edicao`
 * só é respondido quando existe versão publicada amarrada à edição vigente.
 */
export interface Edicao {
  id: string;
  /** O identificador da promoção NO iOn. É a chave que amarra as duas pontas. */
  id_ion: string;
  nome: string;
  inicio: string;
  fim: string | null;
  vigente: boolean;
}

/** Um cenário da árvore do bot, como o backoffice mostra. */
export interface CenarioBot {
  id: string;
  slug: string;
  cenario: string;
  etapa: string | null;
  gravidade: "critico" | "alto" | "medio";
  tratamento: "cq" | "df" | "faq" | "interno" | "rg" | "tc" | "direto" | "especial";
  gatilhos: string[];
  respostaRestrita: boolean;
  /** O bot resolve sozinho (faq, interno, rg, tc, direto) ou aciona humano. */
  respondeSozinho: boolean;
  artigo: string | null;
  estadoResposta: string | null;
  /**
   * ── O QUE VEIO DA LISTA DE ARTIGOS ─────────────────────────────────────────
   * A Base tinha, ao lado da lista de situações, uma lista de ARTIGOS lendo a mesma
   * linha do banco por outra rota. Ela saiu, e estes cinco campos eram o que só ela
   * mostrava. Sem eles a unificação seria perda de informação: não daria para saber se
   * a resposta vale em toda edição, se ela sai na FAQ pública do site, de qual edição é
   * o texto que está na tela, por que está pendente, nem que reescrever guarda a
   * anterior.
   *
   * Todos OPCIONAIS: front e API sobem separados, e campo novo declarado obrigatório
   * derruba a tela até a API alcançar.
   */
  /** `global` vale em toda edição; `por_edicao` só na edição da versão. */
  escopo?: "global" | "por_edicao" | null;
  /** `false` = resposta de uso interno, que não sai na FAQ pública. */
  publico?: boolean | null;
  /** A edição a que a resposta mostrada pertence. Nula em artigo `global`. */
  edicaoDaResposta?: { id: string; nome: string } | null;
  motivoPendencia?: string | null;
  /** Versões anteriores guardadas. Reescrever não apaga o que o cliente leu. */
  historico?: number;
  /**
   * O bot deveria responder e não tem texto publicado. É o pior estado da árvore, e
   * a tela ordena por ele.
   */
  semResposta: boolean;
}

export interface ProntidaoBot {
  /**
   * Etapas da jornada, para o seletor de "onde entra o cenário novo".
   *
   * Opcional porque front e API sobem separados: campo novo declarado como
   * obrigatório derruba a tela até a API alcançar, e derrubou (um `map` em
   * `undefined`). Campo que a API pode ainda não mandar é opcional aqui, sempre.
   */
  etapas?: EtapaJornada[];
  total: number;
  respondeSozinho: number;
  escala: number;
  semResposta: number;
  semGatilho: number;
  itens: CenarioBot[];
}

/** Etapa da jornada, para o seletor ao criar cenário. */
export interface EtapaJornada {
  id: string;
  label: string;
}

/** Um candidato do classificador, com o escore que explica a escolha. */
export interface CandidatoBot {
  id: string;
  slug: string;
  cenario: string;
  tratamento: string;
  gravidade: string;
  respostaRestrita: boolean;
  escore: number;
}

/** Um turno da conversa simulada com o bot. */
export interface TurnoBot {
  fala: string;
  /**
   * O veredito da RÉGUA DE COMPLIANCE sobre a fala, na caixa de teste.
   *
   * Existe porque a caixa mentia por omissão: mostrava o texto e não que a régua o
   * barraria, então quem testava concluía que o cenário estava pronto e no atendimento
   * real o cliente ficava sem resposta. `null` quando não há texto para avaliar (o bot
   * escalou sem falar).
   */
  regua?: {
    nivel: "ok" | "revisao" | "bloqueado";
    bloqueios: string[];
    revisar: string[];
    faltando: string[];
  } | null;
  opcoes?: CandidatoBot[];
  escalar: boolean;
  motivoSlug?: string;
  gravidade?: string;
  artigo?: string;
  estado: { aguardando?: CandidatoBot[]; tentativas?: number };
  /** Por que o bot fez isso. É o que a tela mostra ao lado da conversa. */
  diagnostico: {
    decisao?: string;
    escolhido?: CandidatoBot;
    candidatos?: CandidatoBot[];
    semResposta?: boolean;
    artigo?: string;
    tentativas?: number;
  };
}

/** A resposta que existe hoje para um cenário. */
export type RespostaAtual =
  | { existe: false }
  | {
      existe: true;
      artigo: string;
      publico: boolean;
      versao: number;
      estado: string;
      corpo: string;
      publicadoEm: string | null;
      motivoPendencia: string | null;
      /** Onde esta resposta vale. Opcional porque front e API sobem separados. */
      escopo?: "global" | "por_edicao";
      /** A edição desta versão. Nula em artigo `global`. */
      edicao?: { id: string; nome: string } | null;
      /** Quantas versões ficam guardadas atrás desta, no mesmo recorte. */
      historico?: number;
    };

/** Uma barra da distribuição de notas, com o rótulo já resolvido pela API. */
export interface FatiaCsat {
  nota: number;
  rotulo: string;
  total: number;
}

/**
 * O CSAT do dia no painel do supervisor.
 *
 * `media` e `taxaResposta` vêm `null` quando não há resposta nenhuma no período, e
 * não zero: zero por cento pareceria medição e é ausência de dado, que é a mesma
 * régua que o painel já usa no escalonamento do bot.
 */
export interface CsatResumo {
  desde: string;
  /** O denominador: casos encerrados no período. Toda pesquisa sai do encerramento. */
  resolvidos: number;
  avaliados: number;
  semResposta: number;
  semPergunta: number;
  distribuicao: FatiaCsat[];
  taxaResposta: number | null;
  media: number | null;
}

export interface CsatAtendente {
  user_id: string | null;
  nome: string;
  resolvidos: number;
  avaliados: number;
  semResposta: number;
  semPergunta: number;
  distribuicao: FatiaCsat[];
  /** `null` = amostra abaixo de `minimoParaMedia`. NÃO é zero, e a tela diz isso. */
  media: number | null;
  minimoParaMedia: number;
}

/**
 * O corte por atendente, em requisição PRÓPRIA e com janela PRÓPRIA.
 *
 * `dias` vem da API porque a tela precisa dizer a janela em texto: os cartões de cima
 * são do dia, e este recorte é de 30 dias (num único dia quase ninguém junta amostra
 * para uma média significar coisa alguma). Sem o texto, o supervisor lê como "hoje".
 */
export interface CsatPorAtendente {
  desde: string;
  dias: number;
  itens: CsatAtendente[];
}
