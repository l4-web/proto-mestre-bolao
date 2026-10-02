import { api } from "../../store/api";
import type {
  Atendente,
  Consulta,
  CsatPorAtendente,
  CsatResumo,
  ConversaDetalhe,
  Edicao,
  EmRisco,
  Equipe,
  EtapaMotivo,
  FichaEncaminhamento,
  Fila,
  ListaConversas,
  Praca,
  ProntidaoBot,
  RascunhoBlue,
  RespostaAtual,
  Sentimento,
  TurnoBot,
  Visao,
  LinkDeMidia,
} from "./tipos";

/**
 * Endpoints do módulo. Os caminhos são `v1/...` porque o prefixo do serviço vem da
 * `VITE_API_URL` (`/atendeai-api` atrás do LB), e o `API_PREFIX` da API é o MESMO
 * `atendeai-api`. O GCLB não reescreve path, então os dois precisam casar 1:1.
 *
 * O prefixo da API NÃO pode ser `atendeai`: esse é o path do front no LB, e as
 * duas regras colidiriam no url_map.
 */
/** Um tema da escuta, como a API o devolve dentro do envelope `{ janela, temas }`. */
export interface EscutaTema {
  id: string;
  rotulo: string;
  volume: number;
  variacao: number | null;
  motivo: { id: string; caminho: string } | null;
  abertasNoMotivo: number | null;
  termos: { termo: string; frequencia: number }[];
  /**
   * De onde saiu `variacao`. Enquanto for `agregado_externo`, ela NAO e tendencia
   * calculada: `atd_tema.volume` e `atd_tema.variacao` vem prontos da tabela e nenhum
   * codigo os calcula (o unico escritor e o seed de demonstracao). A tela nao deve
   * chamar isso de tendencia.
   */
  variacaoFonte?: "agregado_externo";
}

export const atendimentoApi = api.injectEndpoints({
  endpoints: (b) => ({
    praca: b.query<Praca[], void>({
      query: () => "v1/praca",
      providesTags: ["Praca"],
    }),

    conversas: b.query<
      ListaConversas,
      {
        visao: Visao;
        /** O produto da barra lateral: escopo do módulo, não filtro da tela. */
        produto?: string;
        filaId?: string;
        busca?: string;
        /**
         * Histórico de UM contato. A API IGNORA a visão quando ele vem: metade do
         * histórico está resolvida, e filtrar contato dentro da fila aberta
         * esconderia justamente o que a pessoa abriu o atalho para ler.
         */
        contatoId?: string;
        cursor?: string;
        sentimento?: Sentimento;
        tema?: string;
        tag?: string;
        gravidade?: "critico" | "alto" | "medio";
        atrasadas?: boolean;
      }
    >({
      query: ({
        visao,
        filaId,
        busca,
        contatoId,
        cursor,
        sentimento,
        tema,
        tag,
        gravidade,
        atrasadas,
      }) => ({
        url: "v1/conversas",
        params: {
          visao,
          ...(filaId && { filaId }),
          ...(busca && { busca }),
          ...(contatoId && { contatoId }),
          ...(cursor && { cursor }),
          ...(sentimento && { sentimento }),
          ...(tema && { tema }),
          ...(tag && { tag }),
          ...(gravidade && { gravidade }),
          ...(atrasadas && { atrasadas: "true" }),
        },
      }),
      providesTags: ["Conversa"],
    }),

    /**
     * Classifica nos três eixos. Invalida a conversa E a lista: mudar sentimento
     * muda o que o filtro devolve, e sem invalidar a lista a linha some ou aparece
     * só no próximo refetch.
     */
    classificar: b.mutation<
      { ok: boolean },
      {
        empresaId: string;
        conversaId: string;
        sentimento?: Sentimento;
        temas?: string[];
        tags?: string[];
      }
    >({
      query: ({ empresaId, conversaId, ...resto }) => ({
        url: `v1/conversas/${conversaId}/classificar`,
        method: "POST",
        body: { empresa_id: empresaId, ...resto },
      }),
      invalidatesTags: ["Conversa"],
    }),

    /**
     * O link do anexo de UMA mensagem, buscado só quando a bolha aparece.
     *
     * Separado da conversa de propósito: a URL é ASSINADA e vale 5 minutos. Se
     * viesse junto com a thread, um caso aberto há dez minutos já traria links
     * mortos, e a pessoa veria imagem quebrada sem entender por quê.
     *
     * Sem `providesTags`: link temporário não é dado a invalidar, é a pedir de novo.
     */
    midia: b.query<LinkDeMidia, string>({
      query: (mensagemId) => `v1/midias/${mensagemId}`,
      keepUnusedDataFor: 120,
    }),

    conversa: b.query<ConversaDetalhe, string>({
      query: (id) => `v1/conversas/${id}`,
      providesTags: (_r, _e, id) => [{ type: "Conversa" as const, id }],
    }),

    /**
     * A consulta mínima, em requisição SEPARADA da conversa.
     *
     * A thread tem que abrir na hora, e esta consulta depende de duas APIs de
     * terceiro: embutir uma na outra faria a leitura da mensagem esperar o iOn. Cada
     * coluna preenche quando chega, e a de contexto pode chegar depois.
     */
    consulta: b.query<Consulta, string>({
      query: (id) => `v1/conversas/${id}/consulta`,
      providesTags: (_r, _e, id) => [{ type: "Conversa" as const, id: `consulta:${id}` }],
    }),

    /**
     * A árvore do bot para o backoffice: cada cenário com o que o bot faz e se tem
     * resposta publicada.
     */
    /**
     * `edicaoId` é o recorte da Base, e a lista MUDA com ele.
     *
     * Sem ele a API resolve a resposta pela versão mais nova de qualquer edição, e
     * situação `por_edicao` continuava marcada como pronta depois da virada enquanto o
     * bot escalava aquele assunto. Com ele, a lista diz o que o bot faz HOJE.
     */
    prontidaoBot: b.query<ProntidaoBot, { produto: string; edicaoId?: string }>({
      query: ({ produto, edicaoId }) => ({
        url: "v1/motivos/prontidao-bot",
        params: { produto, ...(edicaoId && { edicaoId }) },
      }),
      providesTags: ["Motivo"],
    }),

    configurarCenario: b.mutation<
      { ok: true },
      { produto: string; id: string } & Partial<{
        gravidade_padrao: string;
        codigo_tratamento: string;
        gatilhos: string[];
        resposta_restrita: boolean;
        ativo: boolean;
      }>
    >({
      query: ({ produto, id, ...corpo }) => ({
        url: `v1/motivos/${id}`,
        method: "PATCH",
        params: { produto },
        body: corpo,
      }),
      // Invalida a taxonomia inteira: mudar tratamento de um cenário muda o que o
      // bot faz, e o número de "sem resposta" do painel depende disso.
      invalidatesTags: ["Motivo"],
    }),

    criarCenario: b.mutation<
      { ok: true; id: string; slug: string },
      { produto: string; etapa_id: string; cenario: string; gravidade_padrao?: string; codigo_tratamento?: string }
    >({
      query: ({ produto, ...corpo }) => ({ url: "v1/motivos", method: "POST", params: { produto }, body: corpo }),
      invalidatesTags: ["Motivo"],
    }),

    escreverResposta: b.mutation<
      { ok: true; versao: number },
      {
        produto: string;
        id: string;
        corpo: string;
        publicar: boolean;
        publico?: boolean;
        /** `por_edicao` amarra a resposta a uma edição; `global` vale em todas. */
        escopo?: "global" | "por_edicao";
        /**
         * A edição da versão. Só faz sentido com `escopo: "por_edicao"`.
         *
         * Sem isto a API cai na edição VIGENTE. Mandar explicitamente é o que permite
         * escrever a resposta da PRÓXIMA edição antes de ela virar.
         */
        edicao_id?: string;
      }
    >({
      query: ({ produto, id, ...corpo }) => ({
        url: `v1/motivos/${id}/resposta`,
        method: "POST",
        params: { produto },
        body: corpo,
      }),
      invalidatesTags: ["Motivo"],
    }),

    simularBot: b.mutation<
      TurnoBot,
      { produto: string; texto: string; estado?: TurnoBot["estado"]; escolhaId?: string }
    >({
      query: ({ produto, ...corpo }) => ({
        url: "v1/bot/simular",
        method: "POST",
        params: { produto },
        body: corpo,
      }),
    }),

    /**
     * A resposta que já existe, DA EDIÇÃO que a tela está mostrando.
     *
     * Sem `edicaoId` a API devolve a versão mais nova de qualquer edição: quem estava
     * preparando a edição seguinte abria o formulário com o texto da edição no ar,
     * concluía que já tinha escrito, e ao salvar copiava o valor velho para a nova.
     */
    respostaAtual: b.query<RespostaAtual, { produto: string; id: string; edicaoId?: string }>({
      query: ({ produto, id, edicaoId }) => ({
        url: `v1/motivos/${id}/resposta`,
        params: { produto, ...(edicaoId && { edicaoId }) },
      }),
      providesTags: (_r, _e, a) => [
        { type: "Motivo" as const, id: `resposta:${a.id}:${a.edicaoId ?? "-"}` },
      ],
    }),

    configurarPraca: b.mutation<
      { ok: true },
      { empresaId: string } & Partial<{
        nome: string;
        fuso: string;
        expediente: Record<string, unknown>;
        auto_fechar_conversa_horas: number;
        auto_offline_atendente_min: number;
        espera_texto_inicial: string;
        lembrete_espera_horas: number;
        lembrete_espera_textos: string[];
        bot_ativo: boolean;
        envio_ativo: boolean;
        ia_ativa: boolean;
        auto_resposta_ativa: boolean;
        auto_resposta_modelo: string;
        teto_reais_mes: number;
        teto_alerta_pct: number;
        teto_acao: string;
      }>
    >({
      query: ({ empresaId, ...corpo }) => ({ url: `v1/praca/${empresaId}`, method: "PATCH", body: corpo }),
      invalidatesTags: ["Praca"],
    }),

    /**
     * Cadastra um canal. O TOKEN não passa por aqui: só o nome do secret.
     *
     * Token num corpo de requisição do navegador vira token no log de acesso, no
     * devtools e no histórico do formulário, e é vazamento que ninguém percebe.
     */
    /**
     * Quantas conversas em cada visão. Existe para a pessoa DECIDIR antes de clicar.
     */
    contagemConversas: b.query<
      {
        minhas: number;
        naoAtribuidas: number;
        fila: number;
        comBot: number;
        /** Abertas paradas esperando a caixa técnica ou a financeira. */
        aguardandoEquipe: number;
      },
      { produto?: string } | void
    >({
      // A contagem segue o MESMO recorte da lista: aba dizendo 12 com a lista
      // mostrando 4 é pior que não ter aba.
      query: (a) => ({
        url: "v1/conversas/contagem",
        params: a?.produto ? { produto: a.produto } : {},
      }),
      providesTags: ["Conversa"],
    }),

    /**
     * Abre um caso (atendimento) na conversa.
     *
     * A rota existia na API desde o começo e a tela NUNCA a chamava. O efeito era
     * duplo e silencioso: o botão de encaminhar prometia "Abrir o caso e
     * encaminhar" e não abria nada, e o modal de encerrar mandava a pessoa
     * escolher entre 119 motivos para depois não fazer requisição nenhuma, porque
     * a tela desistia sozinha por falta de `atendimentoId`.
     *
     * O `motivoId` vai junto quando já se sabe: abrir com motivo carimba a
     * gravidade e o prazo regulatório do cenário, e abrir sem ele deixaria o caso
     * nascer "medio" para logo em seguida ser encerrado com outro motivo.
     */
    abrirAtendimento: b.mutation<
      { id: string },
      { empresaId: string; conversaId: string; motivoId?: string }
    >({
      query: ({ empresaId, conversaId, motivoId }) => ({
        url: `v1/atendimentos/conversas/${conversaId}`,
        method: "POST",
        body: { empresa_id: empresaId, ...(motivoId && { motivoId }) },
      }),
      invalidatesTags: ["Conversa", "Atendimento"],
    }),

    assumirConversa: b.mutation<{ ok: true }, { empresaId: string; conversaId: string }>({
      query: ({ empresaId, conversaId }) => ({
        url: `v1/atendimentos/conversas/${conversaId}/assumir`,
        method: "POST",
        body: { empresa_id: empresaId },
      }),
      invalidatesTags: ["Conversa", "Fila"],
    }),

    soltarConversa: b.mutation<{ ok: true }, { empresaId: string; conversaId: string }>({
      query: ({ empresaId, conversaId }) => ({
        url: `v1/atendimentos/conversas/${conversaId}/soltar`,
        method: "POST",
        body: { empresa_id: empresaId },
      }),
      invalidatesTags: ["Conversa", "Fila"],
    }),

    /**
     * Cadastra um canal, com o TOKEN quando a pessoa o digitou.
     *
     * O token vai no corpo desta requisição e mais nada: a API o entrega ao Secret
     * Manager e nunca mais o devolve. Nenhuma tela guarda esse valor em estado que
     * sobreviva ao modal, e nenhuma consulta o traz de volta (ver
     * `statusDoTokenDoCanal`, que responde "configurado" e a data, nunca o valor).
     */
    cadastrarCanal: b.mutation<
      { ok: true; id: string; status: string },
      {
        empresaId: string;
        tipo: "whatsapp" | "instagram" | "facebook";
        external_id: string;
        waba_id?: string;
        rotulo: string;
        token?: string;
        secret_nome?: string;
      }
    >({
      query: ({ empresaId, ...corpo }) => ({
        url: `v1/praca/${empresaId}/canais`,
        method: "POST",
        body: corpo,
      }),
      invalidatesTags: ["Praca", "TokenCanal"],
    }),

    atualizarCanal: b.mutation<
      { ok: true },
      { empresaId: string; canalId: string } & Partial<{
        rotulo: string;
        /** Token NOVO. Substitui a credencial do canal no cofre. */
        token: string;
        secret_nome: string;
        status: "ativo" | "degradado" | "fora" | "suspenso";
      }>
    >({
      query: ({ empresaId, canalId, ...corpo }) => ({
        url: `v1/praca/${empresaId}/canais/${canalId}`,
        method: "PATCH",
        body: corpo,
      }),
      invalidatesTags: ["Praca", "TokenCanal"],
    }),

    /**
     * O ESTADO DO TOKEN de um canal: configurado ou não, e desde quando.
     *
     * Consulta separada e SOB DEMANDA (o modal do canal a dispara ao abrir), e não um
     * campo de `GET v1/praca`: responder isto na listagem seria uma ida ao Secret
     * Manager por canal em toda abertura das Configurações, e a resposta só interessa
     * quando alguém vai mexer naquele canal.
     *
     * `updatedAt` pode vir nulo e isso NÃO significa "não configurado": a data depende
     * de uma permissão à parte no cofre. A tela precisa dizer "configurado, data
     * desconhecida" nesse caso, e não esconder o "configurado".
     */
    statusDoTokenDoCanal: b.query<
      {
        ok: true;
        secret_nome: string | null;
        /** O canal aponta para o segredo que a regra deriva, ou para um nome digitado antes. */
        derivado: boolean;
        configured: boolean;
        updatedAt: string | null;
      },
      { canalId: string }
    >({
      query: ({ canalId }) => `v1/canais/${canalId}/token`,
      providesTags: ["TokenCanal"],
    }),

    /**
     * O PRODUTO DO NÚMERO, em rota própria (`PATCH v1/canais/:id`).
     *
     * Separada do `atualizarCanal` porque o produto não é atributo de apresentação
     * como o rótulo: ele decide a árvore do bot, os artigos e a taxonomia da
     * conversa, e a API valida o slug contra os produtos ATIVOS da praça. O modal
     * chama as duas quando as duas mudaram, e só a segunda quando só o produto mudou.
     *
     * `null` desaponta o canal. Numa praça com mais de um produto ativo isso o tira
     * do ar (a API recusa atender sem saber o produto), e é decisão deliberada:
     * responder HiperXCAP com o conteúdo do APCAP é pior do que não responder.
     */
    definirProdutoDoCanal: b.mutation<
      { ok: true },
      { canalId: string; produto_slug: string | null }
    >({
      query: ({ canalId, produto_slug }) => ({
        url: `v1/canais/${canalId}`,
        method: "PATCH",
        body: { produto_slug },
      }),
      invalidatesTags: ["Praca"],
    }),

    configurarCompliance: b.mutation<
      { ok: true },
      { empresaId: string; produtoSlug: string } & Partial<{
        bloqueio_duro: string[];
        termos_revisao: string[];
        mencoes_obrigatorias: string[];
        idade_minima: number;
        script_sac: string;
      }>
    >({
      query: ({ empresaId, produtoSlug, ...corpo }) => ({
        url: `v1/praca/${empresaId}/compliance/${produtoSlug}`,
        method: "PATCH",
        body: corpo,
      }),
      invalidatesTags: ["Praca"],
    }),

    /**
     * Como o produto se chama do lado do iOn.
     *
     * Existia so como coluna no banco: a rota da API ja estava pronta e nenhuma tela
     * a chamava, entao trocar a marca exigia entrar no Postgres. Foi assim que o
     * APCAP ficou consultando o iOn como `hiperxcap`, sobra de um teste, e toda
     * consulta voltava vazia sem ninguem entender por que.
     */
    configurarProdutoDaPraca: b.mutation<
      { ok: true },
      { empresaId: string; produtoSlug: string; ion_marca: string }
    >({
      query: ({ empresaId, produtoSlug, ...corpo }) => ({
        url: `v1/praca/${empresaId}/produtos/${produtoSlug}`,
        method: "PATCH",
        body: corpo,
      }),
      invalidatesTags: ["Praca"],
    }),

    filas: b.query<Fila[], void>({
      query: () => "v1/filas",
      providesTags: ["Fila"],
    }),

    atendentes: b.query<Atendente[], { filaId?: string } | void>({
      query: (arg) => ({
        url: "v1/filas/atendentes",
        params: arg && arg.filaId ? { filaId: arg.filaId } : undefined,
      }),
      providesTags: ["Fila"],
    }),

    /**
     * Os atendentes COM as habilidades de produto, para a tela de alocação.
     *
     * Consulta separada da de cima, e não a mesma com um campo a mais, porque as duas
     * respondem a perguntas diferentes e vivem em rotas diferentes: `v1/filas/atendentes`
     * é a foto de turno que a supervisão e o inbox já consomem, e `v1/atendentes` é a
     * lista administrativa que carrega `produtos`. Apontar a primeira para a segunda
     * derrubaria a supervisão e o inbox se a rota nova ainda não estivesse no ar, e
     * essas duas telas não têm nada a ver com esta configuração.
     */
    atendentesAlocacao: b.query<Atendente[], void>({
      query: () => "v1/atendentes",
      providesTags: ["Fila"],
    }),

    /**
     * Substitui o conjunto de habilidades de uma pessoa (PUT, não PATCH: o corpo é a
     * lista inteira, e desmarcar é a operação mais comum aqui).
     *
     * Lista VAZIA não é "não atende nada": é atende tudo. Ver `Atendente.produtos`.
     */
    definirProdutosDoAtendente: b.mutation<
      { ok: true },
      { userId: string; produtos: string[] }
    >({
      query: ({ userId, produtos }) => ({
        url: `v1/atendentes/${userId}/produtos`,
        method: "PUT",
        body: { produtos },
      }),
      invalidatesTags: ["Fila"],
    }),

    /** Respostas prontas do motivo aberto, mais as gerais. */
    macros: b.query<
      { id: string; titulo: string; corpo: string; variaveis: string[] }[],
      { motivoId?: string }
    >({
      query: ({ motivoId }) => ({
        url: "v1/motivos/macros",
        params: motivoId ? { motivoId } : undefined,
      }),
      providesTags: ["Motivo"],
    }),

    taxonomia: b.query<EtapaMotivo[], string>({
      query: (produto) => ({ url: "v1/motivos", params: { produto } }),
      providesTags: ["Motivo"],
    }),

    emRisco: b.query<EmRisco[], { empresaId: string; minutos?: number }>({
      query: ({ empresaId, minutos }) => ({
        url: "v1/atendimentos/em-risco",
        params: { empresa_id: empresaId, ...(minutos && { minutos }) },
      }),
      providesTags: ["Atendimento"],
    }),

    // ── Supervisão ─────────────────────────────────────────────────────────
    supervisao: b.query<
      {
        aguardando: { total: number; semDonoHa15min: number };
        slaEmRisco: { total: number; criticos: number };
        resolvidasHoje: number;
        atendimentosTotal: number;
        escalonamentoBot: number | null;
        premissaEscalonamento: number;
        atendentes: Atendente[];
        encaminhamentosAbertos: { equipe: string; total: number }[];
        gatilhosHoje: {
          id: string;
          /** A conversa, para o item da lista virar link em vez de beco. */
          conversa_id: string;
          ref: string;
          em: string;
          motivo: string;
          gatilhos: string[];
        }[];
        /** A nota do cliente no mesmo dia dos outros cartões. */
        csat?: CsatResumo;
      },
      void
    >({
      query: () => "v1/supervisao/resumo",
      providesTags: ["Atendimento", "Fila"],
    }),

    /**
     * O CSAT por atendente, em consulta SEPARADA do resumo de propósito.
     *
     * O painel se recarrega a cada 8 segundos e este corte varre 30 dias no banco.
     * Junto do resumo, seriam 450 varreduras por hora de painel aberto na parede para
     * um número que muda em escala de dias. A tela busca esta rota num intervalo bem
     * mais folgado.
     */
    csatPorAtendente: b.query<CsatPorAtendente, void>({
      query: () => "v1/supervisao/csat/atendentes",
      providesTags: ["Atendimento"],
    }),

    integracoes: b.query<
      {
        id: string;
        tipo: string;
        rotulo: string;
        status: string;
        quality_rating: string | null;
        subscribed_apps_ok: boolean;
        token_expira_em: string | null;
        ultimo_evento_em: string | null;
      }[],
      void
    >({
      query: () => "v1/supervisao/integracoes",
      providesTags: ["Praca"],
    }),

    // ── Escuta ─────────────────────────────────────────────────────────────
    escutaResumo: b.query<
      {
        comentarios: number;
        negativos: number;
        pctNegativo: number;
        viraramCaso: number;
        pctViraramCaso: number;
        suspeitaGolpe: number;
        ocultados: number;
      },
      { produto?: string } | void
    >({
      query: (a) => ({
        url: "v1/escuta/resumo",
        params: a?.produto ? { produto: a.produto } : {},
      }),
      providesTags: ["Conversa"],
    }),

    escutaTemas: b.query<EscutaTema[], { produto?: string } | void>({
      query: (a) => ({
        url: "v1/escuta/temas",
        params: a?.produto ? { produto: a.produto } : {},
      }),
      /**
       * A API passou a devolver `{ janela, temas: [...] }` em vez de um array cru,
       * para carregar a janela e a procedencia da variacao. Sem este `transformResponse`
       * a tela quebrava com "(o ?? []).flatMap is not a function", que e o preco de o
       * front tratar o corpo inteiro como se fosse a lista.
       *
       * O desempacotamento fica AQUI e nao na pagina: assim existe UM lugar que conhece
       * o envelope, e as duas telas que consomem temas nao precisam concordar entre si.
       */
      transformResponse: (r: unknown): EscutaTema[] => {
        if (Array.isArray(r)) return r as EscutaTema[];
        const lista = (r as { temas?: unknown } | null)?.temas;
        return Array.isArray(lista) ? (lista as EscutaTema[]) : [];
      },
      providesTags: ["Motivo"],
    }),

    escutaCanais: b.query<{ rede: string; comentarios: number }[], void>({
      query: () => "v1/escuta/canais",
      // Mesmo envelope de `temas`: a API passou a devolver `{ janela, canais: [...] }`.
      // Desempacotar aqui evita a segunda cópia do mesmo erro na página.
      transformResponse: (r: unknown): { rede: string; comentarios: number }[] => {
        if (Array.isArray(r)) return r as { rede: string; comentarios: number }[];
        const lista = (r as { canais?: unknown } | null)?.canais;
        return Array.isArray(lista) ? (lista as { rede: string; comentarios: number }[]) : [];
      },
      providesTags: ["Conversa"],
    }),

    comentarios: b.query<
      {
        id: string;
        rede: string;
        origem: string;
        campanha: string | null;
        autor_handle: string | null;
        texto: string;
        publicado_em: string;
        sentimento: string;
        temas: string[];
        suspeita_golpe: boolean;
        estado: string;
        gravidade: string | null;
        /**
         * A rede OBEDECEU, ou não. É o par que impede a tela de mentir: `estado`
         * responde o que a nossa operação registrou, e isto responde se a Meta aceitou.
         * Desenhar "ocultado" a partir do 200 foi um defeito real deste módulo.
         */
        rede_pendente: boolean;
        rede_pendente_motivo: string | null;
        /** A resposta saiu sozinha, sem ninguém ler. A tela precisa dizer isso. */
        respondido_auto: boolean;
        /**
         * A ação pedida que ainda não voltou da Meta ("responder" ou "ocultar").
         *
         * Existe porque escrever na Graph API leva de 5 a 20 segundos: a rota registra
         * a intenção e devolve, e é isto que faz o card dizer "enviando" em vez de
         * prender quem modera esperando.
         */
        acao_em_curso: string | null;
        /**
         * As respostas da thread, como a rede as mostra.
         *
         * Existe porque quem responde pelo aplicativo do Instagram, que é como se
         * responde na prática, não aparecia aqui: a tela dizia "novo" em comentário
         * que já tinha sido respondido.
         */
        respostas:
          | { id: string; autor: string | null; texto: string; publicado_em: string; nosso: boolean }[]
          | null;
        /** Preenchido quando o comentário já virou caso na fila. */
        conversa_id: string | null;
        motivo: { label: string } | null;
      }[],
      {
        /** O produto da barra lateral: escopo do módulo, não filtro da tela. */
        produto?: string;
        rede?: string;
        tema?: string;
        estado?: string;
        origem?: string;
        sentimento?: string;
        golpe?: boolean;
        /** Janela em dias. Sem isto a tela mostra 30 e a base inteira fica escondida. */
        dias?: number;
        limite?: number;
      }
    >({
      query: (f) => ({ url: "v1/escuta/comentarios", params: { ...f } }),
      providesTags: ["Comentario"],
    }),

    /**
     * As TAGS existentes na janela, para montar o filtro.
     *
     * Rota própria e não derivada da lista: montar as opções a partir do resultado
     * filtrado faz todas as outras sumirem assim que uma é escolhida.
     */
    /**
     * A URL de autorização do login do Instagram.
     *
     * Existe porque hoje o token de cada canal é colado à mão: funciona para uma
     * praça e não funciona para a segunda. A Meta aprova o APLICATIVO, não o cliente,
     * então o desenho é um app só com N empresas autorizando por OAuth, que é como as
     * ferramentas de mercado fazem.
     *
     * `configurado: false` quando o ambiente não tem as credenciais: a tela esconde o
     * botão em vez de oferecer um clique que dá erro.
     */
    instagramAutorizar: b.query<
      { configurado: boolean; url: string | null },
      { empresaId: string; produtoSlug?: string }
    >({
      // O produto entra DENTRO do `state` assinado pelo servidor: assinatura não se
      // edita no cliente, então pedir a URL de novo é o único jeito de levar a escolha.
      query: ({ empresaId, produtoSlug }) => ({
        url: "v1/instagram/autorizar",
        params: { empresaId, ...(produtoSlug ? { produtoSlug } : {}) },
      }),
    }),

    comentarioTags: b.query<
      { tema: string; label: string; comentarios: number }[],
      { dias?: number; produto?: string } | void
    >({
      // As tags seguem a MESMA janela da lista: com períodos diferentes, o filtro
      // ofereceria tag que não existe no recorte que a tela está mostrando.
      query: (a) => ({
        url: "v1/escuta/comentarios/tags",
        params: { dias: a?.dias, ...(a?.produto ? { produto: a.produto } : {}) },
      }),
      transformResponse: (r: unknown) => {
        const lista = (r as { tags?: unknown } | null)?.tags;
        return Array.isArray(lista)
          ? (lista as { tema: string; label: string; comentarios: number }[])
          : [];
      },
      providesTags: ["Comentario"],
    }),

    /**
     * As três AÇÕES sobre o comentário público, que existiam na API desde o começo e
     * a tela nunca chamou: dava para ver o comentário e não dava para fazer nada com
     * ele, o que transformava a escuta numa tela de leitura sobre um problema que
     * pede reação.
     *
     * As três devolvem `redeFeita`, e a tela LÊ isso: `ok: false` com
     * `redePendenteMotivo` significa que a rede recusou e o estado continua o que era.
     */
    responderComentario: b.mutation<
      {
        ok: boolean;
        estado: string;
        redeFeita: boolean;
        redePendenteMotivo?: string;
        /** A ação PODE ter acontecido na rede (timeout), e não é o mesmo que recusa. */
        incerto?: boolean;
        /** Aceita e a caminho da Meta. Não é sucesso nem falha: é "aguarde". */
        emCurso?: boolean;
        compliance?: { nivel: string; bloqueios: string[]; revisar: string[]; faltando: string[] };
      },
      { id: string; texto: string }
    >({
      query: ({ id, texto }) => ({
        url: `v1/escuta/comentarios/${id}/responder`,
        method: "POST",
        body: { texto },
      }),
      invalidatesTags: ["Comentario"],
    }),

    ocultarComentario: b.mutation<
      {
        ok: boolean;
        estado: string;
        redeFeita: boolean;
        redePendenteMotivo?: string;
        incerto?: boolean;
        emCurso?: boolean;
      },
      { id: string }
    >({
      query: ({ id }) => ({ url: `v1/escuta/comentarios/${id}/ocultar`, method: "POST" }),
      invalidatesTags: ["Comentario"],
    }),

    virarCasoComentario: b.mutation<
      { ok: boolean; estado: string; redeFeita: boolean; redePendenteMotivo?: string },
      { id: string; motivoId?: string }
    >({
      query: ({ id, motivoId }) => ({
        url: `v1/escuta/comentarios/${id}/virar-caso`,
        method: "POST",
        body: motivoId ? { motivoId } : {},
      }),
      // Nasce uma conversa e um ticket: a fila e a contagem mudam junto.
      invalidatesTags: ["Comentario", "Conversa"],
    }),

    /**
     * O rascunho do Blue para o comentário PÚBLICO.
     *
     * Rota própria e não a mesma da conversa: o que muda não é a fonte do texto, é a
     * régua do que pode ser dito em público (não confirmar nada sobre a conta de
     * quem comentou, levar para o privado, duas frases). Não publica nada.
     */
    rascunhoComentario: b.mutation<
      {
        texto: string;
        modelo: string;
        compliance: { nivel: string; bloqueios: string[]; revisar: string[]; faltando: string[] };
      },
      { id: string }
    >({
      query: ({ id }) => ({ url: `v1/blue/comentarios/${id}/rascunho`, method: "POST" }),
    }),

    // ── Equipes internas ───────────────────────────────────────────────────
    equipe: b.query<
      {
        id: string;
        titulo: string;
        estado: string;
        gravidade: string;
        abertoPor: string | null;
        abertoEm: string;
        /**
         * QUEM DA EQUIPE PEGOU o item, e se sou eu.
         *
         * A caixa virou fila e não mural: item chega, alguém pega, trabalha e devolve.
         * Sem isto ninguém sabia o que já estava sendo olhado, e dois devs investigavam
         * o mesmo defeito. `meu` vem calculado da API porque o front não recebe o `sub`
         * do token em lugar nenhum, e a caixa técnica é justamente a tela que abre sem
         * identidade.
         */
        responsavel: string | null;
        meu: boolean;
        pegoEm: string | null;
        /** O que a equipe apurou, para o próprio time reler sem abrir o caso do CX. */
        resposta: string | null;
        respondidoPor: string | null;
        respondidoEm: string | null;
        demandaRef: string | null;
        ref: string;
        motivo: string | null;
        slaComercial: string | null;
        slaRegulatorio: string | null;
        slaRegTipo: string | null;
        /**
         * A UNIÃO É REAL, e o tipo antigo mentia.
         *
         * Sem `contato.pessoais` a API devolve `{ total, ocultas: true }` no lugar da
         * lista, porque nota interna é onde o atendente escreve nome e CPF por extenso.
         * O tipo dizia que era sempre array, então a tela fazia `.map` num objeto: a
         * caixa técnica quebrava em branco exatamente para o papel `dev`, que é o único
         * que a abre sem permissão de dado pessoal.
         */
        notas:
          | {
              id: string;
              autor: string;
              texto: string;
              created_at: string;
            }[]
          | { total: number; ocultas: true };
        coleta: Record<string, string>;
        contato: {
          nome: string | null;
          cpf_mascarado: string | null;
          telefone_mascarado: string | null;
        } | null;
        trabalhaPorReferencia: boolean;
      }[],
      { equipe: "dev" | "pagamentos" }
    >({
      query: ({ equipe }) => `v1/equipes/${equipe}`,
      providesTags: ["Atendimento"],
    }),

    // ── Base de conhecimento ───────────────────────────────────────────────
    edicoes: b.query<Edicao[], { produto: string }>({
      query: ({ produto }) => ({ url: "v1/base/edicoes", params: { produto } }),
      providesTags: ["Motivo"],
    }),

    /**
     * NÃO EXISTE MAIS `artigos`, e a rota `GET v1/base/artigos` saiu junto.
     *
     * O artigo não é objeto próprio: ele é a resposta da situação, criada pelo passo
     * "Resposta" (`escreverResposta`), que reaproveita a linha existente. A lista de
     * artigos era uma segunda janela para a mesma linha, com nome diferente. O que só
     * ela mostrava (escopo, se sai na FAQ pública, estado da versão, a edição da
     * versão, a pendência e o histórico) veio para os itens de `prontidaoBot`.
     */

    /**
     * ESCRITA das edições, e o front não chamava nenhuma das três.
     *
     * As rotas existiam desde sempre e a tela só sabia LER (`edicoes`). O efeito era
     * degradação agendada: no dia em que a edição atual termina, todo artigo
     * `por_edicao` para de ser respondido e o bot passa a escalar caso que sabia
     * resolver, e o conserto dependia de alguém rodar script no banco de produção.
     *
     * As três invalidam `Motivo`, que é a tag de TUDO que depende de edição: a lista de
     * edições, a prontidão, a lista de situações e a resposta atual de cada uma. Trocar
     * a vigente e invalidar só a lista de edições deixaria a tela mostrando com
     * confiança a prontidão da edição antiga.
     */
    criarEdicao: b.mutation<
      { ok: true; id: string; vigente: boolean },
      {
        produto: string;
        id_ion: string;
        nome: string;
        inicio: string;
        fim?: string;
        vigente?: boolean;
      }
    >({
      query: ({ produto, ...corpo }) => ({
        url: "v1/base/edicoes",
        method: "POST",
        params: { produto },
        body: corpo,
      }),
      invalidatesTags: ["Motivo"],
    }),

    editarEdicao: b.mutation<
      { ok: true },
      { produto: string; id: string; nome?: string; inicio?: string; fim?: string }
    >({
      query: ({ produto, id, ...corpo }) => ({
        url: `v1/base/edicoes/${id}`,
        method: "PATCH",
        params: { produto },
        body: corpo,
      }),
      invalidatesTags: ["Motivo"],
    }),

    /**
     * Troca qual edição VALE hoje. `PUT` porque é idempotente, e a troca inteira
     * (desmarcar a anterior, marcar a nova) é UMA transação no servidor.
     *
     * O front não pode ter um caminho paralelo com dois PATCH: entre um e outro o
     * produto ficaria sem vigente nenhuma, que é exatamente o estado em que o bot
     * escala tudo que é `por_edicao`.
     *
     * A resposta traz a PRONTIDÃO da edição que passou a valer, para a tela dizer na
     * hora quantos assuntos o bot começou a escalar.
     */
    definirEdicaoVigente: b.mutation<
      {
        ok: true;
        id: string;
        nome: string;
        prontidao: { total: number; publicados: number; pendentesDeDefinicao: number };
      },
      { produto: string; id: string }
    >({
      query: ({ produto, id }) => ({
        url: `v1/base/edicoes/${id}/vigente`,
        method: "PUT",
        params: { produto },
      }),
      invalidatesTags: ["Motivo"],
    }),

    prontidao: b.query<
      {
        total: number;
        publicados: number;
        pendentesDeDefinicao: number;
        itens: {
          id: string;
          titulo: string;
          estado: string;
          motivoPendencia: string | null;
        }[];
      },
      { produto: string; edicaoId: string }
    >({
      query: ({ produto, edicaoId }) => ({
        url: "v1/base/prontidao",
        params: { produto, edicaoId },
      }),
      providesTags: ["Motivo"],
    }),

    lacunas: b.query<
      {
        id: string;
        pergunta: string;
        marcado_por: string;
        resolvido: boolean;
        created_at: string;
      }[],
      void
    >({
      query: () => "v1/base/lacunas",
      providesTags: ["Motivo"],
    }),

    // ── Consumo ────────────────────────────────────────────────────────────
    consumo: b.query<
      {
        praca: string | null;
        mensagensNoMes: number;
        porCategoria: { categoria: string; qtd: number; reais: number }[];
        custoHojeReais: number;
        projecaoReais: number;
        cobrancaComeca: string;
        jaCobra: boolean;
        resolvidosNoMes: number;
        mensagensPorResolvido: number | null;
        metaMensagensPorResolvido: number;
        teto: {
          reais: number;
          alertaPct: number;
          acao: string;
          usoPct: number;
        } | null;
        tarifa: {
          reais: number;
          vigenteDe: string;
          fonte: string | null;
        } | null;
      },
      void
    >({
      query: () => "v1/consumo/resumo",
      providesTags: ["Praca"],
    }),

    consumoSerie: b.query<
      { dia: string; qtd: number; reais: number }[],
      { dias?: number }
    >({
      query: ({ dias }) => ({
        url: "v1/consumo/serie",
        params: dias ? { dias } : undefined,
      }),
      providesTags: ["Praca"],
    }),

    meuStatus: b.mutation<
      { ok: boolean },
      { empresaId: string; status: Atendente["status"] }
    >({
      query: ({ empresaId, status }) => ({
        url: "v1/filas/meu-status",
        method: "POST",
        body: { empresa_id: empresaId, status },
      }),
      invalidatesTags: ["Fila"],
    }),

    /**
     * Encerrar exige motivo, e a validação de verdade é da API. O front manda o
     * motivo escolhido e trata o 400 como erro de negócio, não como bug.
     */
    encerrar: b.mutation<
      { id: string },
      {
        empresaId: string;
        atendimentoId: string;
        motivoId: string;
        resolucao?: string;
      }
    >({
      query: ({ empresaId, atendimentoId, motivoId, resolucao }) => ({
        url: `v1/atendimentos/${atendimentoId}/encerrar`,
        method: "POST",
        body: { empresa_id: empresaId, motivoId, resolucao },
      }),
      invalidatesTags: ["Conversa", "Atendimento", "Fila"],
    }),

    transferir: b.mutation<
      { id: string },
      {
        empresaId: string;
        conversaId: string;
        paraUserId?: string;
        paraFilaId?: string;
        motivo: string;
      }
    >({
      query: ({ empresaId, conversaId, ...resto }) => ({
        url: `v1/atendimentos/conversas/${conversaId}/transferir`,
        method: "POST",
        body: { empresa_id: empresaId, ...resto },
      }),
      invalidatesTags: ["Conversa", "Atendimento", "Fila"],
    }),
    /**
     * A ficha de encaminhamento deste caso: as duas equipes, os campos de cada
     * uma, o que cada uma recebe e qual o motivo sugere. Vem da API porque a
     * lista de campos é a fronteira de dado pessoal, e fronteira que mora na tela
     * não é fronteira.
     */
    fichaEncaminhamento: b.query<
      FichaEncaminhamento,
      { atendimentoId: string }
    >({
      query: ({ atendimentoId }) =>
        `v1/atendimentos/${atendimentoId}/encaminhamento`,
      providesTags: ["Atendimento"],
    }),

    encaminhar: b.mutation<
      { ok: boolean; dado: { id: string; equipe: Equipe; estado: string } },
      { atendimentoId: string; equipe: Equipe; coleta: Record<string, string> }
    >({
      query: ({ atendimentoId, equipe, coleta }) => ({
        url: `v1/atendimentos/${atendimentoId}/encaminhar`,
        method: "POST",
        body: { equipe, coleta },
      }),
      invalidatesTags: ["Atendimento", "Conversa"],
    }),

    /** Se o Blue está ligado nesta instalação. Sem isso o botão não aparece. */
    blueEstado: b.query<{ ligado: boolean }, void>({
      query: () => "v1/blue/estado",
    }),

    /**
     * Rascunho do Blue para esta conversa. Mutation e não query porque cada
     * chamada custa e gera texto novo: não é leitura cacheável.
     */
    /**
     * Resumo do Blue sobre a conversa. Mutation pelo mesmo motivo do rascunho: cada
     * chamada custa e o texto muda com a conversa, então não é leitura cacheável.
     */
    /**
     * Envia a resposta do atendente.
     *
     * A `idemKey` é gerada pelo CLIENTE, uma por tentativa: dois cliques no botão
     * viram a mesma chave e a mensagem sai uma vez só. É por isso que ela não é
     * gerada no servidor, onde os dois cliques seriam duas requisições distintas.
     */
    enviarMensagem: b.mutation<
      { ok: true; id: string; estado?: string },
      { conversaId: string; texto: string; idemKey: string }
    >({
      query: ({ conversaId, texto, idemKey }) => ({
        url: `v1/envio/conversas/${conversaId}`,
        method: "POST",
        body: { texto, idemKey },
      }),
      invalidatesTags: ["Conversa"],
    }),

    /**
     * Envia ANEXO. `FormData` cru e sem `Content-Type`: o navegador precisa pôr o
     * cabeçalho ele mesmo, porque só ele sabe o `boundary` do multipart. Declarar
     * `multipart/form-data` na mão manda um cabeçalho SEM boundary, e o servidor
     * responde 400 sem dizer por quê.
     */
    enviarAnexo: b.mutation<
      { ok: true; id: string; estado?: string },
      { conversaId: string; arquivo: File; texto: string; idemKey: string }
    >({
      query: ({ conversaId, arquivo, texto, idemKey }) => {
        const form = new FormData();
        form.append("arquivo", arquivo);
        if (texto.trim()) form.append("texto", texto);
        form.append("idemKey", idemKey);
        return { url: `v1/envio/conversas/${conversaId}/anexo`, method: "POST", body: form };
      },
      invalidatesTags: ["Conversa"],
    }),

    blueResumo: b.mutation<{ texto: string; modelo: string | null }, { conversaId: string }>({
      query: ({ conversaId }) => ({
        url: `v1/blue/conversas/${conversaId}/resumo`,
        method: "POST",
      }),
    }),

    blueRascunho: b.mutation<RascunhoBlue, { conversaId: string }>({
      query: ({ conversaId }) => ({
        url: `v1/blue/conversas/${conversaId}/rascunho`,
        method: "POST",
      }),
    }),

    /**
     * O palpite do Blue para o motivo do encerramento.
     *
     * `motivoId` vem `null` quando ele não se compromete, e aí a tela não mostra
     * atalho nenhum: sugestão fraca disfarçada de sugestão é pior que nenhuma,
     * porque quem encerra confia e para de ler.
     *
     * Mutation e não query pelo mesmo motivo do rascunho e do resumo: cada
     * chamada custa modelo, e a resposta muda com a conversa, então não é leitura
     * cacheável. Chamar no `open` do modal também evita gastar em toda conversa
     * aberta, que é a maioria das que ninguém encerra naquele momento.
     */
    blueMotivoSugerido: b.mutation<
      {
        motivoId: string | null;
        label: string | null;
        confianca: "alta" | "media" | "baixa";
        porque: string;
      },
      { conversaId: string }
    >({
      query: ({ conversaId }) => ({
        url: `v1/blue/conversas/${conversaId}/motivo-sugerido`,
        method: "POST",
      }),
    }),

    /**
     * A equipe interna responde o encaminhamento: devolve ao CX ou marca resolvido.
     *
     * A rota existe na API (`POST /equipes/:equipe/encaminhamentos/:id/responder`)
     * e a caixa técnica e a financeira eram 100% leitura: dava para ver o caso, o
     * prazo estourando e as notas, e não dava para responder nada. O time saía da
     * tela para responder por outro canal, e o CX ficava sem o registro.
     */
    responderEncaminhamento: b.mutation<
      { ok: boolean },
      {
        equipe: "dev" | "pagamentos";
        id: string;
        estado: "devolvido" | "resolvido";
        resposta: string;
      }
    >({
      query: ({ equipe, id, estado, resposta }) => ({
        url: `v1/equipes/${equipe}/encaminhamentos/${id}/responder`,
        method: "POST",
        body: { estado, resposta },
      }),
      invalidatesTags: ["Atendimento", "Conversa"],
    }),

    /**
     * PEGAR e SOLTAR o item da caixa da equipe.
     *
     * `atd_encaminhamento` não tinha responsável, então a caixa era um mural: todo mundo
     * via tudo e ninguém sabia o que já estava sendo olhado. A reivindicação é atômica
     * do lado do servidor (a condição vai no `where`), então o segundo clique simultâneo
     * recebe 400 com a frase pronta em vez de sobrescrever o primeiro em silêncio.
     *
     * As duas invalidam `Conversa` junto: pegar não mexe na conversa, mas responder mexe,
     * e a tela do CX precisa ver o caso voltar para a fila. Manter as duas iguais evita
     * a próxima pessoa descobrir por que só uma atualiza.
     */
    pegarEncaminhamento: b.mutation<
      { ok: boolean },
      { equipe: "dev" | "pagamentos"; id: string }
    >({
      query: ({ equipe, id }) => ({
        url: `v1/equipes/${equipe}/encaminhamentos/${id}/pegar`,
        method: "POST",
      }),
      invalidatesTags: ["Atendimento", "Conversa"],
    }),

    soltarEncaminhamento: b.mutation<
      { ok: boolean },
      { equipe: "dev" | "pagamentos"; id: string }
    >({
      query: ({ equipe, id }) => ({
        url: `v1/equipes/${equipe}/encaminhamentos/${id}/soltar`,
        method: "POST",
      }),
      invalidatesTags: ["Atendimento", "Conversa"],
    }),
  }),
});

export const {
  usePracaQuery,
  useConversasQuery,
  useClassificarMutation,
  useCsatPorAtendenteQuery,
  useBlueResumoMutation,
  useEnviarMensagemMutation,
  useEnviarAnexoMutation,
  useConversaQuery,
  useMidiaQuery,
  useConsultaQuery,
  useProntidaoBotQuery,
  useConfigurarCenarioMutation,
  useCriarCenarioMutation,
  useEscreverRespostaMutation,
  useSimularBotMutation,
  useConfigurarPracaMutation,
  useContagemConversasQuery,
  useAbrirAtendimentoMutation,
  useAssumirConversaMutation,
  useSoltarConversaMutation,
  useCadastrarCanalMutation,
  useAtualizarCanalMutation,
  useStatusDoTokenDoCanalQuery,
  useDefinirProdutoDoCanalMutation,
  useConfigurarComplianceMutation,
  useConfigurarProdutoDaPracaMutation,
  useRespostaAtualQuery,
  useFilasQuery,
  useAtendentesQuery,
  useAtendentesAlocacaoQuery,
  useDefinirProdutosDoAtendenteMutation,
  useTaxonomiaQuery,
  useMacrosQuery,
  useEmRiscoQuery,
  useSupervisaoQuery,
  useIntegracoesQuery,
  useEscutaResumoQuery,
  useEscutaTemasQuery,
  useEscutaCanaisQuery,
  useComentariosQuery,
  useComentarioTagsQuery,
  useInstagramAutorizarQuery,
  useLazyInstagramAutorizarQuery,
  useResponderComentarioMutation,
  useOcultarComentarioMutation,
  useVirarCasoComentarioMutation,
  useRascunhoComentarioMutation,
  useEquipeQuery,
  useEdicoesQuery,
  useCriarEdicaoMutation,
  useEditarEdicaoMutation,
  useDefinirEdicaoVigenteMutation,
  useProntidaoQuery,
  useLacunasQuery,
  useConsumoQuery,
  useConsumoSerieQuery,
  useMeuStatusMutation,
  useEncerrarMutation,
  useTransferirMutation,
  useFichaEncaminhamentoQuery,
  useEncaminharMutation,
  useBlueEstadoQuery,
  useBlueRascunhoMutation,
  useBlueMotivoSugeridoMutation,
  useResponderEncaminhamentoMutation,
  usePegarEncaminhamentoMutation,
  useSoltarEncaminhamentoMutation,
} = atendimentoApi;
