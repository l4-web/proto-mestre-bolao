import { useState } from "react";
import { Instagram, Lock, OctagonAlert, Plus, ShieldCheck } from "lucide-react";
import {
  Badge,
  Button,
  Card,
  Eyebrow,
  Input,
  Modal,
  ModalActions,
  ModalBody,
  ModalContent,
  ModalHead,
  SelectPill,
} from "@l4-web/ui";
import {
  useAtendentesAlocacaoQuery,
  useAtualizarCanalMutation,
  useCadastrarCanalMutation,
  useDefinirProdutoDoCanalMutation,
  useInstagramAutorizarQuery,
  useLazyInstagramAutorizarQuery,
  useStatusDoTokenDoCanalQuery,
} from "../../features/atendimento/atendimento.api";
import {
  canaisSemProduto,
  produtosAtivos,
  produtosComNumeroESemNinguem,
  quemAtendeOProduto,
  rotuloDoProduto,
} from "../../features/atendimento/produtos";
import type { ProdutoAtivo } from "../../features/atendimento/produtos";
import { plural, verbo } from "../../lib/plural";
import type { Atendente, Praca } from "../../features/atendimento/tipos";
import { useCatalogoDeProdutos } from "../../lib/authz/produtoCatalogo";

type Canal = Praca["canais"][number];

/** Valor do seletor quando o canal não tem produto. `""` porque o SelectPill é string. */
const SEM_PRODUTO = "";

/**
 * Os canais da praça, com cadastro.
 *
 * Esta aba dizia que não havia nada a preencher porque a conexão era OAuth na
 * Business Manager. O número precisa ser registrado aqui de algum jeito: sem isso o
 * único canal que existia era o de demonstração, e conectar de verdade dependia de
 * alguém escrever na tabela por túnel, o que não é operação que se pede a quem
 * administra a praça.
 *
 * ── E o TOKEN passou a ser digitado aqui ─────────────────────────────────────
 * O campo pedia o NOME de um secret criado com `gcloud`, e essa é a ferramenta que
 * quem administra a praça justamente não tem: o cadastro travava no penúltimo campo. O
 * token agora é digitado, atravessa a API uma vez e vai para o Secret Manager num
 * segredo cujo nome é DERIVADO do canal. O que a tela sabe daí em diante é só
 * "configurado" e a data: o valor não volta por consulta nenhuma.
 *
 * ── A corrente inteira: número → produto → quem atende ───────────────────────
 * Esta tela terminava no produto e a de Alocação começava nele, então o estado "número
 * no ar apontando para produto que ninguém atende" não aparecia em lugar nenhum. É o
 * pior de todos porque está tudo tecnicamente certo: a conversa entra, nasce
 * classificada e fica parada. O alarme está no topo e a contagem, ao lado do seletor de
 * produto, no instante da escolha.
 */
export function SecaoCanais({ praca }: { praca: Praca }) {
  const [abrindo, setAbrindo] = useState<"novo" | Canal | null>(null);
  /*
    A EQUIPE é consultada aqui para fechar a corrente número → produto → quem atende.
    Não é uma requisição a mais: a página de Configurações e a aba de Alocação leem a
    mesma consulta, e o RTK Query compartilha o cache das três.
  */
  const { data: atendentes } = useAtendentesAlocacaoQuery();
  const ativos = produtosAtivos(praca);
  const mudos = canaisSemProduto(praca);
  const { data: instagram } = useInstagramAutorizarQuery({ empresaId: praca.empresa_id });
  /**
   * O nome do produto vem do CATÁLOGO GLOBAL, e não do `rotulo` local.
   *
   * O slug é global e existe um só por produto no OS inteiro; o que o Atende Aí guarda
   * localmente é o opt-in (quais produtos esta praça atende) e a configuração de régua.
   * Ler o rótulo local aqui faria o mesmo produto aparecer com um nome no Reporta e
   * outro aqui, e o primeiro a divergir ninguém percebe.
   */
  const { nomeDe } = useCatalogoDeProdutos();
  const [escolhendoProduto, setEscolhendoProduto] = useState(false);
  const [produtoDoIg, setProdutoDoIg] = useState("");
  const [pedirAutorizacao] = useLazyInstagramAutorizarQuery();

  /**
   * Pede a URL de novo, agora COM o produto dentro do `state`.
   *
   * O produto viaja assinado, e assinatura não se edita no cliente: pendurar
   * `&produtoSlug=` na URL que já veio mandaria à Meta um parâmetro que ela ignora, e
   * a escolha se perderia em silêncio, com o canal nascendo mudo depois de a pessoa
   * ter respondido a pergunta. Quem assina é o servidor.
   */
  async function pedirUrlComProduto(slug: string) {
    const r = await pedirAutorizacao({ empresaId: praca.empresa_id, produtoSlug: slug }).unwrap();
    if (r.url) window.location.href = r.url;
  }
  const orfaos = produtosComNumeroESemNinguem(praca, atendentes ?? []);

  return (
    <div className="flex flex-col gap-3">
      {/*
        NÚMERO NO AR E NINGUÉM PARA ATENDER, que é o pior estado desta tela.

        Diferente do canal sem produto (que a API recusa, e o aviso abaixo cobre), aqui
        está tudo tecnicamente certo: o número entrega, o produto está apontado, a
        conversa entra e nasce classificada. Ela só nunca chega em ninguém, e nada em
        log, estado ou tela acusa. O alarme é aqui em cima com o nome do número porque
        quem for investigar "a fila não anda" não tem por onde começar.

        Só produto com canal ATIVO entra: produto sem ninguém e sem número no ar é
        cadastro pela metade, e cadastro pela metade é normal no meio da configuração.
      */}
      {orfaos.length > 0 && (
        <div
          role="alert"
          className="grid gap-2.5 rounded-[16px] border-[0.5px] border-error-border bg-error-bg px-3.5 py-3"
        >
          <div className="flex min-w-0 items-start gap-2.5">
            <OctagonAlert className="mt-0.5 size-4 flex-none text-error-text" aria-hidden />
            <div className="min-w-0">
              <p className="text-[12.5px] font-semibold text-error-text">
                {plural(orfaos.length, "número no ar", "números no ar")} sem ninguém para
                atender
              </p>
              <p className="text-[11.5px] leading-snug text-text-strong">
                {orfaos
                  .map((o) => `${o.canais.map((c) => c.rotulo).join(", ")} (${o.produto.rotulo})`)
                  .join("; ")}
                . A conversa que entrar por{" "}
                {verbo(orfaos.length, "esse número fica parada", "esses números fica parada")},
                sem dono. Marque o produto para alguém em <b>Alocação</b>.
              </p>
            </div>
          </div>
        </div>
      )}
      {/*
        O AVISO DE CANAL MUDO, e não um selo discreto na linha.

        Canal sem produto numa praça com dois ou mais produtos ativos não atende, e é
        a API que recusa: sem saber o produto ela não sabe qual árvore percorrer nem
        de qual base tirar o artigo, e responder HiperXCAP com o conteúdo do APCAP é
        pior do que não responder. O sintoma disso é a fila vazia, que é o mesmo
        sintoma do token vencido e do App não assinado, e nenhum dos três se explica
        sozinho: por isso o aviso é aqui em cima, com o número, e não só na linha.

        Em GRADE e sem `Card`, pelas duas armadilhas já pagas neste app: o
        `l4-surface` do `Card` carrega depois e apaga o `bg-error-bg`, e o `.flex-col`
        do `styles.css` do DS vence o `.sm:flex-row` do app.
      */}
      {mudos.length > 0 && (
        <div
          role="alert"
          className="grid gap-2.5 rounded-[16px] border-[0.5px] border-error-border bg-error-bg px-3.5 py-3"
        >
          <div className="flex min-w-0 items-start gap-2.5">
            <OctagonAlert
              className="mt-0.5 size-4 flex-none text-error-text"
              aria-hidden
            />
            <div className="min-w-0">
              <p className="text-[12.5px] font-semibold text-error-text">
                {plural(mudos.length, "canal sem produto", "canais sem produto")}, e
                por isso sem atender
              </p>
              <p className="text-[11.5px] leading-snug text-text-strong">
                {mudos.map((c) => c.rotulo).join("; ")}. A praça vende{" "}
                {plural(ativos.length, "produto", "produtos")}, então a API não tem
                como escolher a árvore do bot sozinha e recusa a mensagem. Abra o canal
                e diga de qual produto é o número.
              </p>
            </div>
          </div>
        </div>
      )}
      {/*
        ESTA FAIXA DIZIA O CONTRÁRIO, e o contrário travava o cadastro.

        Ela explicava que o token não se cola aqui e que o campo pedia o NOME de um
        secret. A proteção era real, mas quem administra a praça não tem `gcloud`: o
        cadastro parava no penúltimo campo e o número simplesmente não entrava. O texto
        agora diz o que de fato acontece, que é o que a pessoa precisa saber antes de
        colar uma credencial num navegador.
      */}
      <div className="flex items-start gap-2.5 rounded-[16px] bg-info-bg px-3.5 py-2.5">
        <ShieldCheck className="mt-0.5 size-3.5 flex-none text-info-text" aria-hidden />
        <p className="text-[12px] leading-relaxed text-text-strong">
          <b>O token é digitado aqui e vai direto para o cofre.</b> Ele passa uma vez,
          não é guardado no banco e <b>não volta por consulta nenhuma</b>: daqui em
          diante esta tela só sabe dizer se está configurado e desde quando. Para trocar
          a credencial, digite a nova.
        </p>
      </div>

      <Card className="p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Eyebrow>Canais conectados</Eyebrow>
          <div className="flex flex-wrap items-center gap-2">
            {/*
              CONECTAR INSTAGRAM é outro ato que cadastrar canal, e por isso é outro
              botão. No WhatsApp alguém digita ids e cola um token; aqui a pessoa
              autoriza na Meta e o token nunca passa por mão nenhuma.

              Fica ANTES do cadastro manual porque é o caminho que deve ser escolhido
              quando serve: botão secundário, e não o principal, porque a maior parte
              da fila ainda é WhatsApp.
            */}
            {instagram?.configurado && instagram.url && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  /**
                   * Com DOIS ou mais produtos, pergunta antes de sair.
                   *
                   * O produto é do canal e decide a árvore do bot, os artigos, a
                   * taxonomia e a régua. Canal sem produto é canal MUDO, e esta tela já
                   * tem um aviso inteiro para esse estado: conectar e cair nele seria
                   * criar o problema que o aviso denuncia.
                   *
                   * Com um produto só não há escolha a fazer, e perguntar seria um
                   * passo a mais para uma resposta única: o servidor resolve na volta.
                   */
                  if (ativos.length > 1) return setEscolhendoProduto(true);
                  window.location.href = instagram.url!;
                }}
                title="Autoriza o app na conta do Instagram. O token não passa por aqui."
              >
                <Instagram className="size-3.5" aria-hidden />
                Conectar Instagram
              </Button>
            )}
            <Button size="sm" variant="filled" onClick={() => setAbrindo("novo")}>
              <Plus className="size-3.5" aria-hidden />
              Cadastrar canal
            </Button>
          </div>
        </div>

        {/*
          A regra do produto explicada UMA VEZ, aqui, e não em cada linha da lista.

          Cada produto de capitalização tem o seu próprio número por decisão de
          produto, e é o produto que decide a árvore do bot, os artigos e a taxonomia.
          Quem cadastra o número precisa saber disso antes de abrir o formulário, e não
          depois de o canal ficar mudo.
        */}
        <p className="mt-1 text-[11.5px] leading-snug text-text-secondary">
          Cada produto tem o seu próprio número, e o <b>produto é do número</b>: ele
          decide a árvore do bot, os artigos e a taxonomia da conversa.
        </p>

        {praca.canais.length === 0 ? (
          <p className="mt-2 text-[11.5px] text-text-secondary">
            Nenhum canal. Cadastre o número com o <b>Phone Number ID</b> e o{" "}
            <b>WABA ID</b> que aparecem no Gerenciador do WhatsApp.
          </p>
        ) : (
          <div className="mt-2 flex flex-col gap-1.5">
            {praca.canais.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setAbrindo(c)}
                className="l4-pressable rounded-[14px] bg-[var(--l4-fill-5)] px-3 py-2.5 text-left hover:bg-[var(--l4-fill-4)]"
              >
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-text-strong">
                    {c.rotulo}
                  </span>
                  {/*
                    O produto ANTES da rede e da situação: entre "de qual produto é
                    este número" e "é WhatsApp", só a primeira muda o que o bot
                    responde.

                    QUEM CARREGA O ALERTA É A PALAVRA, não a cor: o `Badge` do DS não
                    pinta no `xs` de propósito, então o selo diz "não atende" por
                    extenso e o vermelho fica na faixa do topo, que é onde cabe. Com um
                    produto ativo só o texto encurta, porque aí não há ambiguidade e o
                    canal em branco segue atendendo.
                  */}
                  <Badge
                    size="xs"
                    variant={
                      c.produto_slug
                        ? "info"
                        : ativos.length > 1
                          ? "error"
                          : "neutral"
                    }
                  >
                    {c.produto_slug
                      ? rotuloDoProduto(c.produto_slug, ativos)
                      : ativos.length > 1
                        ? "sem produto: não atende"
                        : "sem produto"}
                  </Badge>
                  <Badge size="xs" variant="neutral">
                    {c.tipo}
                  </Badge>
                  <Badge size="xs" variant={c.status === "ativo" ? "success" : "warn"}>
                    {c.status}
                  </Badge>
                </div>
                <div className="mt-1 flex flex-col gap-px">
                  <Linha rotulo="Phone Number ID" valor={c.external_id} />
                  {c.waba_id && <Linha rotulo="WABA ID" valor={c.waba_id} />}
                  {/*
                    A lista diz SE existe credencial, e não desde quando: a data mora no
                    cofre e sai de uma consulta por canal, que aqui viraria uma ida ao
                    Secret Manager por linha em toda abertura da tela. Quem quer a data
                    abre o canal, que é o único momento em que ela interessa.
                  */}
                  <Linha
                    rotulo="Token"
                    valor={
                      c.secret_nome ? (
                        "configurado"
                      ) : (
                        <span className="text-warn-text">sem token: não envia</span>
                      )
                    }
                  />
                  {/*
                    Linha própria porque é a falha SILENCIOSA da Meta: WABA sem App
                    assinado para de entregar sem devolver erro, e a fila só fica
                    vazia. Sem dizer isso aqui, a operação conclui que o dia foi fraco.
                  */}
                  <Linha
                    rotulo="App assinado"
                    valor={
                      c.subscribed_apps_ok ? (
                        "ok"
                      ) : (
                        <span className="text-error-text">
                          sem App assinado: nada chega
                        </span>
                      )
                    }
                  />
                  {/*
                    A VALIDADE DO TOKEN vive aqui, e não numa aba própria.

                    O campo `token_expira_em` já vinha da API e não era desenhado
                    em lugar nenhum: existia uma aba "Credenciais" inteira que só
                    PROMETIA o alarme de expiração, sem mostrar a data que estava
                    na mão. É a mesma falha silenciosa do App não assinado: token
                    de página da Meta vence e os comentários param de chegar sem
                    erro visível, então a fila só fica vazia e a operação conclui
                    que o dia foi fraco.
                  */}
                  <Linha
                    rotulo="Token expira em"
                    valor={
                      c.token_expira_em ? (
                        dataHora(c.token_expira_em)
                      ) : (
                        <span className="text-text-secondary">
                          sem validade informada
                        </span>
                      )
                    }
                  />
                  <Linha
                    rotulo="Último evento"
                    valor={c.ultimo_evento_em ? dataHora(c.ultimo_evento_em) : "nunca"}
                  />
                </div>
              </button>
            ))}
          </div>
        )}
      </Card>

      {/*
        A ESCOLHA DO PRODUTO, antes de sair para a Meta.

        Separada do cadastro manual de canal de propósito: ali a pessoa preenche ids e
        cola token, aqui ela só responde a UMA pergunta e é levada embora. Um modal com
        um campo é mais honesto que abrir o formulário inteiro com tudo desabilitado
        menos uma linha.

        Os nomes vêm do catálogo GLOBAL: o mesmo produto tem o mesmo nome aqui, no
        Reporta e em qualquer outro módulo, porque o slug é um só no OS inteiro.
      */}
      <Modal open={escolhendoProduto} onOpenChange={setEscolhendoProduto}>
        <ModalContent size="sm">
          <ModalHead
            eyebrow="Conectar Instagram"
            title="De qual produto é esta conta?"
            description="O produto decide a árvore do bot, os artigos e a taxonomia da conversa. Sem ele o canal entra mudo."
          />
          <ModalBody>
            <SelectPill
              value={produtoDoIg}
              onChange={setProdutoDoIg}
              size="sm"
              minWidth={220}
              options={[
                { value: "", label: "Escolha o produto" },
                // O VALOR é o slug global; o RÓTULO vem do catálogo global, com o
                // rótulo local só como último recurso dentro de `nomeDe`.
                ...ativos.map((p) => ({ value: p.slug, label: nomeDe(p.slug) })),
              ]}
            />
          </ModalBody>
          <ModalActions
            cancelar={{ onClick: () => setEscolhendoProduto(false) }}
            primaria={{
              label: "Continuar na Meta",
              disabled: !produtoDoIg,
              onClick: () => {
                // A URL já vem assinada do servidor; o produto entra como parâmetro e
                // o servidor o confere contra a praça na volta, porque entre o clique e
                // o retorno ele pode ter sido desativado.
                /**
                 * Pede a URL de novo COM o produto, em vez de pendurar o parâmetro na
                 * que já veio.
                 *
                 * O produto viaja DENTRO do `state` assinado, e `state` assinado não
                 * se edita no cliente: acrescentar `&produtoSlug=` aqui mandaria a
                 * Meta um parâmetro que ela ignora, e a escolha se perderia em
                 * silêncio. Quem assina é o servidor.
                 */
                void pedirUrlComProduto(produtoDoIg);
              },
            }}
          />
        </ModalContent>
      </Modal>

      <ModalCanal
        aberto={abrindo !== null}
        empresaId={praca.empresa_id}
        ativos={ativos}
        atendentes={atendentes ?? []}
        canal={abrindo === "novo" ? null : abrindo}
        onFechar={() => setAbrindo(null)}
      />
    </div>
  );
}

interface Form {
  tipo: "whatsapp" | "instagram" | "facebook";
  external_id: string;
  waba_id: string;
  rotulo: string;
  /** O TOKEN em si, só enquanto o modal está aberto. Nunca é lido de volta da API. */
  token: string;
  produto_slug: string;
  status: "ativo" | "degradado" | "fora" | "suspenso";
}

function ModalCanal({
  aberto,
  empresaId,
  ativos,
  atendentes,
  canal,
  onFechar,
}: {
  aberto: boolean;
  empresaId: string;
  /** Produtos ATIVOS da praça: os únicos slugs que a API aceita. */
  ativos: ProdutoAtivo[];
  /** A equipe, para responder quem recebe o que este número mandar. */
  atendentes: Atendente[];
  canal: Canal | null;
  onFechar: () => void;
}) {
  const novo = !canal;
  const [cadastrar, { isLoading: criando }] = useCadastrarCanalMutation();
  const [atualizar, { isLoading: salvando }] = useAtualizarCanalMutation();
  const [definirProduto, { isLoading: apontando }] =
    useDefinirProdutoDoCanalMutation();
  const [erro, setErro] = useState<string | null>(null);

  /**
   * O estado do token vem do servidor e SÓ com o modal aberto num canal existente.
   *
   * `skip` não é otimização: sem ele o canal novo dispararia `GET /canais/undefined/token`
   * e a tela abriria com um erro que não quer dizer nada. E a consulta é aqui, e não na
   * lista, porque cada resposta é uma ida ao Secret Manager.
   */
  const { data: token, isFetching: lendoToken } = useStatusDoTokenDoCanalQuery(
    { canalId: canal?.id ?? "" },
    { skip: !aberto || !canal },
  );

  const inicial: Form = {
    tipo: (canal?.tipo as Form["tipo"]) ?? "whatsapp",
    external_id: canal?.external_id ?? "",
    waba_id: canal?.waba_id ?? "",
    rotulo: canal?.rotulo ?? "",
    token: "",
    produto_slug: canal?.produto_slug ?? SEM_PRODUTO,
    status: (canal?.status as Form["status"]) ?? "ativo",
  };
  const [form, setForm] = useState<Form>(inicial);
  const [chave, setChave] = useState("");
  /**
   * O campo de token de um canal que JÁ TEM credencial nasce fechado, atrás do botão
   * de substituir.
   *
   * Não é enfeite: um campo de senha aberto e vazio ao lado de "configurado" convida a
   * digitar, e digitar aqui TROCA a credencial de um canal que está funcionando. O
   * caminho normal desta tela é mexer no rótulo e no produto, e a troca de token é o
   * ato raro, então ela pede um clique a mais.
   */
  const [trocando, setTrocando] = useState(false);

  // Remontar o formulário quando troca o canal aberto, sem useEffect: a chave do
  // canal aberto muda, e o estado inicial é recalculado na mesma renderização.
  const chaveAtual = `${canal?.id ?? "novo"}:${aberto}`;
  if (chave !== chaveAtual) {
    setChave(chaveAtual);
    setForm(inicial);
    setErro(null);
    setTrocando(false);
  }

  const idOk = /^[A-Za-z0-9_-]{5,64}$/.test(form.external_id.trim());
  /*
    O mesmo piso da API (20 caracteres), e pela mesma razão: o engano frequente é colar
    o NOME do secret no campo do token. Conferir aqui não substitui a API, adianta a
    recusa para antes do clique.
  */
  const tokenDigitado = form.token.trim();
  const tokenCurto = tokenDigitado.length > 0 && tokenDigitado.length < 20;
  const podeSalvar =
    !tokenCurto &&
    (novo ? idOk && form.rotulo.trim().length >= 2 : form.rotulo.trim().length >= 2);

  async function confirmar() {
    setErro(null);
    try {
      if (novo) {
        const criado = await cadastrar({
          empresaId,
          tipo: form.tipo,
          external_id: form.external_id.trim(),
          waba_id: form.waba_id.trim() || undefined,
          rotulo: form.rotulo.trim(),
          token: tokenDigitado || undefined,
        }).unwrap();
        // O produto vai numa segunda chamada porque a rota de cadastro não o aceita:
        // ele é apontado por `PATCH v1/canais/:id`, que é onde a API valida o slug
        // contra os produtos ativos. Falhar aqui deixa o canal criado e sem produto,
        // e é exatamente o estado que o aviso da lista sabe explicar.
        if (form.produto_slug)
          await definirProduto({
            canalId: criado.id,
            produto_slug: form.produto_slug,
          }).unwrap();
      } else {
        await atualizar({
          empresaId,
          canalId: canal.id,
          rotulo: form.rotulo.trim(),
          // Só quando a pessoa digitou: mandar string vazia seria pedir para gravar
          // uma credencial em branco, e a API recusaria o corpo inteiro.
          ...(tokenDigitado ? { token: tokenDigitado } : {}),
          /*
            A SITUAÇÃO SÓ VAI QUANDO MUDOU, e isto não é economia de bytes.

            Na API, estado informado explicitamente GANHA da reavaliação (desligar um
            canal é decisão de quem opera, não conclusão nossa). Mandar `status` a cada
            Salvar transformava esse acerto em armadilha: quem digitasse o token novo
            num canal `degradado` reenviava "degradado" junto, e o canal continuava
            degradado com a credencial certa no cofre. O sintoma seria exatamente o que
            a pessoa acabou de tentar consertar.
          */
          ...(form.status !== canal.status ? { status: form.status } : {}),
        }).unwrap();
        // Só quando mudou: o produto tem rota própria, e mandá-lo a cada Salvar
        // gravaria de volta o valor que ninguém tocou.
        if ((canal.produto_slug ?? SEM_PRODUTO) !== form.produto_slug)
          await definirProduto({
            canalId: canal.id,
            produto_slug: form.produto_slug || null,
          }).unwrap();
      }
      onFechar();
    } catch (e) {
      const corpo = (e as { data?: { message?: string | string[] } }).data;
      const msg = Array.isArray(corpo?.message) ? corpo?.message[0] : corpo?.message;
      setErro(msg ?? "Não deu para salvar o canal.");
    }
  }

  return (
    <Modal open={aberto} onOpenChange={(v) => !v && onFechar()}>
      <ModalContent size="md">
        <ModalHead
          eyebrow={novo ? "Novo canal" : "Canal"}
          title={novo ? "Conectar um canal" : canal.rotulo}
          description={
            novo
              ? "Os IDs saem do Gerenciador do WhatsApp, na engrenagem do número. Não é o telefone."
              : "O ID do canal não muda: se o número mudou, cadastre o novo e ponha este em fora."
          }
        />
        <ModalBody>
          <div className="flex flex-col gap-3">
            {novo && (
              <label className="flex flex-col gap-1">
                <span className="text-[11.5px] text-text-secondary">Rede</span>
                <SelectPill
                  value={form.tipo}
                  onChange={(v) => setForm((a) => ({ ...a, tipo: v as Form["tipo"] }))}
                  options={[
                    { value: "whatsapp", label: "WhatsApp" },
                    { value: "instagram", label: "Instagram" },
                    { value: "facebook", label: "Facebook" },
                  ]}
                />
              </label>
            )}

            {/*
              O PRODUTO fica no alto, junto da rede, porque é a mesma pergunta ("que
              número é este") e é a única resposta aqui que muda o que o cliente lê:
              ela escolhe a árvore do bot, os artigos e a taxonomia.
            */}
            <div className="flex flex-col gap-1">
              <span className="text-[11.5px] text-text-secondary">Produto</span>
              <SelectPill
                value={form.produto_slug}
                onChange={(v) => setForm((a) => ({ ...a, produto_slug: v }))}
                disabled={criando || salvando || apontando}
                options={[
                  { value: SEM_PRODUTO, label: "Sem produto" },
                  ...ativos.map((p) => ({ value: p.slug, label: p.rotulo })),
                ]}
              />
              {ativos.length === 0 ? (
                <p className="text-[11px] leading-snug text-warn-text">
                  A praça não tem produto ativo, então não há slug válido para apontar.
                  Habilite o produto na praça antes de ligar o número.
                </p>
              ) : !form.produto_slug && ativos.length > 1 ? (
                /*
                  O aviso é in loco e não só na lista: aqui é o único instante em que a
                  pessoa pode consertar sem sair da tela, e a consequência (canal que
                  não atende) não é adivinhável a partir de um campo em branco.
                */
                <p className="text-[11px] leading-snug text-error-text">
                  Sem produto este canal <b>não vai atender</b>: a praça vende{" "}
                  {plural(ativos.length, "produto", "produtos")} e a API não escolhe a
                  árvore por conta, porque responder um produto com o conteúdo do outro
                  é pior do que não responder.
                </p>
              ) : (
                <p className="text-[11px] leading-snug text-text-secondary">
                  O produto é do número. Se um segundo produto ganhar número próprio,
                  cadastre outro canal, não troque este.
                </p>
              )}

              {/*
                O ELO QUE FALTAVA: número → produto → QUEM ATENDE.

                Esta tela terminava no produto, e a de Alocação começava nele: ninguém
                via a corrente inteira. O estado que isso escondia é o pior de todos,
                que é apontar um número no ar para um produto que nenhuma pessoa atende:
                a conversa entra, ninguém pega, e não há erro em lugar nenhum. Por isso
                a resposta aparece AQUI, no instante da escolha, e não só numa aba ao
                lado.
              */}
              {form.produto_slug && <QuemRecebe slug={form.produto_slug} atendentes={atendentes} />}
            </div>

            <Input
              label="Nome que aparece na tela"
              placeholder="Apcap da Sorte Gold"
              value={form.rotulo}
              disabled={criando || salvando}
              onChange={(e) => {
                const v = e.currentTarget.value;
                setForm((a) => ({ ...a, rotulo: v }));
              }}
            />

            {novo ? (
              <>
                <Input
                  label={
                    form.tipo === "whatsapp"
                      ? "Phone Number ID"
                      : form.tipo === "instagram"
                        ? "ID da conta profissional"
                        : "ID da página"
                  }
                  placeholder="1262811906913848"
                  value={form.external_id}
                  error={
                    form.external_id.trim() && !idOk
                      ? "Só números e letras. Se você colou o telefone, é o outro campo do Gerenciador."
                      : undefined
                  }
                  disabled={criando}
                  onChange={(e) => {
                    const v = e.currentTarget.value;
                    setForm((a) => ({ ...a, external_id: v }));
                  }}
                />
                {form.tipo === "whatsapp" && (
                  <Input
                    label="WABA ID"
                    placeholder="1065599566205487"
                    value={form.waba_id}
                    disabled={criando}
                    onChange={(e) => {
                      const v = e.currentTarget.value;
                      setForm((a) => ({ ...a, waba_id: v }));
                    }}
                  />
                )}
              </>
            ) : (
              <div className="flex flex-col gap-1">
                <span className="text-[11.5px] text-text-secondary">Situação</span>
                <SelectPill
                  value={form.status}
                  onChange={(v) => setForm((a) => ({ ...a, status: v as Form["status"] }))}
                  options={[
                    { value: "ativo", label: "Ativo" },
                    { value: "degradado", label: "Degradado" },
                    { value: "fora", label: "Fora" },
                    { value: "suspenso", label: "Suspenso" },
                  ]}
                />
              </div>
            )}

            {/*
              O TOKEN, que antes era o NOME de um secret que alguém tinha que criar
              com `gcloud`. O campo de nome saiu da tela: ele existia para quem tem
              acesso ao console do Google, e a pessoa que administra a praça não tem.
              A API continua aceitando `secret_nome` para quem provisiona por fora.
            */}
            <div className="flex flex-col gap-1.5">
              <span className="text-[11.5px] font-semibold text-text-secondary">
                Token permanente
              </span>

              {/*
                O estado ANTES do campo: o que a pessoa precisa saber para decidir se
                vai digitar alguma coisa é se já existe credencial ali.
              */}
              {!novo &&
                (lendoToken ? (
                  <p className="text-[11.5px] text-text-secondary">
                    Consultando o cofre…
                  </p>
                ) : token?.configured ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge size="sm" variant="success">
                      Configurado
                    </Badge>
                    <span className="text-[11.5px] text-text-secondary">
                      {token.updatedAt ? (
                        <>atualizado em {dataHora(token.updatedAt)}</>
                      ) : (
                        /*
                          Data desconhecida NÃO é "não configurado": ela depende de uma
                          permissão à parte no cofre. Esconder o "configurado" porque a
                          data faltou responderia errado a pergunta que trouxe a pessoa
                          até aqui.
                        */
                        <>data da última troca indisponível</>
                      )}
                    </span>
                    {!trocando && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setTrocando(true)}
                      >
                        Substituir token
                      </Button>
                    )}
                  </div>
                ) : (
                  <Badge size="sm" variant="error">
                    Sem token: este canal não envia
                  </Badge>
                ))}

              {(novo || trocando || (!lendoToken && !token?.configured)) && (
                <Input
                  type="password"
                  /*
                    `new-password` e não `off`: o Chrome ignora `off` em campo de senha
                    e oferece salvar no gerenciador, e um token de canal salvo como
                    senha do navegador de quem configurou é o vazamento que esta tela
                    inteira existe para evitar.
                  */
                  autoComplete="new-password"
                  placeholder="Cole aqui o token permanente do canal"
                  value={form.token}
                  disabled={criando || salvando}
                  error={
                    tokenCurto
                      ? "Curto demais para ser um token. Se você colou o nome de um secret, é o token que vai aqui."
                      : undefined
                  }
                  helper={
                    novo
                      ? "Opcional agora: sem token o canal nasce degradado e você volta aqui depois."
                      : undefined
                  }
                  onChange={(e) => {
                    const v = e.currentTarget.value;
                    setForm((a) => ({ ...a, token: v }));
                  }}
                />
              )}

              {/*
                O AVISO DE MIGRAÇÃO DE SEGREDO.

                Canal cadastrado antes disto aponta para um nome que alguém digitou, e
                esse nome pode estar sendo usado por outro canal ou por outro sistema.
                Digitar um token aqui NÃO grava naquele nome: grava num segredo próprio
                deste canal e repõe o vínculo. É consequência boa e invisível, e o tipo
                de coisa que precisa ser dita antes e não descoberta depois.
              */}
              {!novo && token && !token.derivado && token.secret_nome && (
                <p className="text-[11px] leading-snug text-text-secondary">
                  Hoje este canal aponta para o segredo{" "}
                  <span className="font-mono text-[10.5px]">{token.secret_nome}</span>,
                  cadastrado à mão. Ao digitar um token novo, ele passa a ter{" "}
                  <b>segredo próprio</b> e o antigo fica intacto para quem mais o usar.
                </p>
              )}

              <div className="flex items-start gap-2 rounded-[12px] bg-warn-bg px-3 py-2">
                <Lock className="mt-0.5 size-3.5 flex-none text-warn-text" aria-hidden />
                <p className="text-[11.5px] leading-relaxed text-text-strong">
                  Sem token, o canal fica <b>degradado</b> e nada sai. É de propósito:
                  canal que não entrega mas aparece como ativo faz a fila ficar vazia
                  sem ninguém entender por quê.
                </p>
              </div>
            </div>

            {erro && (
              <p
                role="alert"
                className="rounded-[12px] border-[0.5px] border-error-border bg-error-bg px-3 py-2 text-[11.5px] text-error-text"
              >
                {erro}
              </p>
            )}
          </div>
        </ModalBody>
        <ModalActions
          cancelar={{ onClick: onFechar }}
          primaria={{
            label: novo ? "Cadastrar canal" : "Salvar",
            onClick: confirmar,
            loading: criando || salvando || apontando,
            disabled: !podeSalvar,
          }}
        />
      </ModalContent>
    </Modal>
  );
}

/**
 * Quem recebe o que este número mandar, contado na hora.
 *
 * Nomes e não só o número: "3 pessoas" é estatística, e a pergunta de quem está
 * cadastrando um canal é operacional ("isso cai em quem?"). O `title` carrega a lista
 * inteira quando ela não cabe na linha.
 *
 * ⚠️ Conta quem atende TUDO junto, porque essas pessoas recebem de verdade. É a mesma
 * regra do fail-open da alocação: cobertura por curinga é cobertura, e some no instante
 * em que alguém declarar a primeira habilidade.
 */
function QuemRecebe({ slug, atendentes }: { slug: string; atendentes: Atendente[] }) {
  const recebem = quemAtendeOProduto(slug, atendentes);

  if (recebem.length === 0) {
    return (
      <p role="alert" className="text-[11px] leading-snug text-error-text">
        <b>Ninguém atende este produto.</b> A conversa que entrar por este número fica
        parada, sem dono, e nada acusa. Marque o produto para alguém na aba{" "}
        <b>Alocação</b> antes de pôr o número no ar.
      </p>
    );
  }

  const nomes = recebem.map((a) => a.nome);
  return (
    <p
      className="text-[11px] leading-snug text-text-secondary"
      title={`Recebem conversa deste produto: ${nomes.join(", ")}.`}
    >
      Cai em {plural(recebem.length, "pessoa", "pessoas")}:{" "}
      <span className="text-text-strong">{nomes.slice(0, 3).join(", ")}</span>
      {nomes.length > 3 && <> e mais {nomes.length - 3}</>}.
    </p>
  );
}

function Linha({ rotulo, valor }: { rotulo: string; valor: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="text-[11px] text-text-secondary">{rotulo}</span>
      <span className="min-w-0 truncate text-[11.5px] text-text-strong">{valor}</span>
    </div>
  );
}

function dataHora(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}
