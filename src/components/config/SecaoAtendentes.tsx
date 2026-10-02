import { useState } from "react";
import { Layers, OctagonAlert, Phone, Users } from "lucide-react";
import {
  Badge,
  BandRow,
  Card,
  Checkbox,
  DataTable,
  Eyebrow,
  Modal,
  ModalActions,
  ModalBody,
  ModalContent,
  ModalHead,
  SegmentedControl,
  Spinner,
  getInitials,
  type DataTableColumn,
} from "@l4-web/ui";
import {
  useAtendentesAlocacaoQuery,
  useDefinirProdutosDoAtendenteMutation,
} from "../../features/atendimento/atendimento.api";
import {
  atendeTudo,
  canaisDoProduto,
  coberturaDoProduto,
  habilidades,
  produtosAtivos,
  produtosComNumeroESemNinguem,
  produtosSemDistribuicao,
  rotuloDoProduto,
  type ProdutoAtivo,
} from "../../features/atendimento/produtos";
import { COR_STATUS, ROTULO_STATUS } from "../conversa/util";
import { Vazio } from "../comum/Vazio";
import { plural, verbo } from "../../lib/plural";
import type { Atendente, Praca } from "../../features/atendimento/tipos";

type Visao = "pessoa" | "produto";

const VISOES = [
  { id: "pessoa" as const, label: "Por pessoa" },
  { id: "produto" as const, label: "Por produto" },
];

/**
 * QUEM ATENDE O QUÊ, e a leitura inversa: quem atende cada produto.
 *
 * O pedido do cliente foi literal: "fulano recebe atendimentos do apcap e hiperxcap e
 * valecap, esse somente apcap". Só que a pergunta que descobre problema é a de trás
 * para frente: uma tela que lista as habilidades de cada pessoa mostra tudo certo
 * enquanto o HiperXCAP não tem ninguém, porque a ausência não aparece numa lista de
 * presenças. Daí as DUAS visões da mesma alocação, e o alarme só na segunda.
 *
 * A alocação vive nas Configurações, com as outras decisões de praça, e não numa rota
 * própria: a navegação do módulo é montada a partir das telas que o papel enxerga
 * (`nav.ts`), e uma tela nova precisaria de uma chave no catálogo de authz que ninguém
 * teria concedido ainda. O item apareceria para zero pessoas. Aqui ela herda a
 * permissão de `config`, que é justamente quem administra a praça.
 */
export function SecaoAtendentes({ praca }: { praca: Praca }) {
  const { data, isLoading } = useAtendentesAlocacaoQuery();
  const [visao, setVisao] = useState<Visao>("pessoa");
  const [editando, setEditando] = useState<Atendente | null>(null);

  const atendentes = data ?? [];
  const ativos = produtosAtivos(praca);
  const curingas = atendentes.filter(atendeTudo);
  const semNinguem = produtosSemDistribuicao(ativos, atendentes);
  // Subconjunto de `semNinguem` que JA recebe mensagem: e a urgencia de verdade.
  const orfaos = produtosComNumeroESemNinguem(praca, atendentes);

  const colunas: DataTableColumn<Atendente>[] = [
    {
      key: "nome",
      header: "Pessoa",
      render: (a) => (
        <span className="block truncate font-medium text-text-strong" title={a.nome}>
          {a.nome}
        </span>
      ),
    },
    {
      key: "status",
      header: "Situação",
      render: (a) => (
        <Badge size="xs" variant={COR_STATUS[a.status]}>
          {ROTULO_STATUS[a.status]}
        </Badge>
      ),
    },
    {
      key: "produtos",
      header: "Atende",
      thClassName: "w-[46%]",
      /*
        A CÉLULA DIZ "TODOS" QUANDO A LISTA ESTÁ VAZIA, e não fica em branco.

        Vazio é fail-open na API (ver `Atendente.produtos`): quem não declarou nada
        recebe tudo. Uma célula vazia aqui diria o oposto exato da verdade, e o
        primeiro reflexo de quem configura seria marcar as caixas de todo mundo para
        "consertar" algo que já funcionava.
      */
      render: (a) =>
        atendeTudo(a) ? (
          /*
            `sm` só aqui, e não nos chips de produto ao lado: o `Badge` do DS não
            pinta no `xs` (naquele tamanho o ponto vira sujeira, e o chip é rótulo de
            origem, não estado). "Atende tudo" É estado, e é o que precisa se destacar
            de uma lista de nomes de produto. Os dois nunca aparecem juntos, então a
            coluna não fica com dois tamanhos na mesma linha.
          */
          <Badge size="sm" variant="info">
            Todos os produtos
          </Badge>
        ) : (
          <span className="flex flex-wrap gap-1">
            {habilidades(a).map((slug) => (
              <Badge key={slug} size="xs" variant="neutral">
                {rotuloDoProduto(slug, ativos)}
              </Badge>
            ))}
          </span>
        ),
    },
    {
      key: "carga",
      header: "Carga",
      align: "right",
      tdClassName: "tabular-nums text-text-secondary",
      render: (a) => `${a.carga}/${a.capacidade}`,
    },
  ];

  return (
    <div className="flex flex-col gap-3">
      {/*
        A REGRA DO VAZIO, em texto, acima de tudo.

        Sem esta faixa a tela mente por omissão: a coluna "Atende" de quem nunca foi
        configurado aparece sem nada, e quem lê conclui que aquela pessoa não recebe
        conversa nenhuma, que é o contrário do que a API faz. O padrão é aberto de
        propósito, para a migration que criou a coluna não esvaziar a fila de todo
        mundo no dia em que subir.

        Faixa tingida sem `Card` e em grade: o `l4-surface` do `Card` carrega depois do
        CSS da tela e apaga o `bg-info-bg`, e o `.flex-col` do `styles.css` do DS vence
        o `.sm:flex-row` do app. As duas armadilhas já foram pagas neste módulo.
      */}
      <div className="grid gap-2.5 rounded-[16px] bg-info-bg px-3.5 py-2.5">
        <div className="flex items-start gap-2.5">
          <Users className="mt-0.5 size-3.5 flex-none text-info-text" aria-hidden />
          <p className="text-[12px] leading-relaxed text-text-strong">
            <b>Quem não tem produto marcado atende TODOS.</b> A lista vazia é permissão
            total, não ausência de permissão: é assim que a distribuição continua
            funcionando para quem nunca foi configurado. Marque produtos só quando a
            pessoa precisar receber <b>menos</b> do que tudo.
          </p>
        </div>
      </div>

      {/*
        O ALARME é só o produto que não tem NINGUÉM, nem declarado nem curinga.

        Com alguém atendendo tudo, o produto está coberto de verdade, e alarme que
        aponta problema onde não há é o jeito mais rápido de ensinar a ignorar alarme.
        Ver `produtosSemDistribuicao`.
      */}
      {semNinguem.length > 0 && (
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
                {plural(semNinguem.length, "produto", "produtos")} sem ninguém para
                atender
              </p>
              <p className="text-[11.5px] leading-snug text-text-strong">
                {semNinguem.map((p) => p.rotulo).join("; ")}. Todo mundo já tem
                habilidade declarada e ninguém marcou{" "}
                {verbo(semNinguem.length, "esse produto", "esses produtos")}, então{" "}
                {verbo(
                  semNinguem.length,
                  "a conversa dele fica",
                  "as conversas deles ficam",
                )}{" "}
                sem distribuição.
              </p>
              {/*
                O TERCEIRO ELO, e é ele que separa urgência de pendência.

                Produto sem ninguém e sem número no ar é cadastro pela metade, coisa
                normal no meio de uma configuração. Produto sem ninguém E com número
                entregando é cliente escrevendo agora para uma conversa que ninguém vai
                pegar. Sem esta linha, os dois usam o mesmo vermelho, e o vermelho que
                às vezes não é urgente é vermelho que se aprende a ignorar.
              */}
              {orfaos.length > 0 && (
                <p className="mt-1 text-[11.5px] font-semibold leading-snug text-error-text">
                  {plural(orfaos.length, "Já tem número no ar", "Já têm números no ar")}:{" "}
                  {orfaos
                    .map((o) => `${o.canais.map((c) => c.rotulo).join(", ")} (${o.produto.rotulo})`)
                    .join("; ")}
                  . Isso é conversa entrando sem ninguém para pegar.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      <Card className="flex min-w-0 flex-col gap-2 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Eyebrow>Alocação por produto</Eyebrow>
          {/*
            Segmentado e não abas: as duas visões são o MESMO conteúdo em outro
            recorte, e não navegação para outro assunto. Aba aqui prometeria uma
            segunda tela.
          */}
          <SegmentedControl
            options={VISOES}
            value={visao}
            onChange={setVisao}
            size="sm"
          />
        </div>

        {isLoading ? (
          <div className="grid place-items-center py-8">
            <Spinner />
          </div>
        ) : atendentes.length === 0 ? (
          <Vazio
            icone={Users}
            titulo="Nenhum atendente na praça"
            descricao="Quem recebe papel de atendimento aparece aqui para receber habilidade."
          />
        ) : ativos.length === 0 ? (
          <Vazio
            icone={Layers}
            titulo="A praça não tem produto ativo"
            descricao="Habilidade é por produto: sem produto ativo, todo mundo atende tudo."
          />
        ) : visao === "pessoa" ? (
          <>
            <DataTable
              columns={colunas}
              rows={atendentes}
              rowKey={(a) => a.user_id}
              minWidth={520}
              onRowClick={setEditando}
            />
            <p className="text-[11px] text-text-secondary">
              Clique numa pessoa para escolher os produtos dela.
            </p>
          </>
        ) : (
          <div className="flex flex-col">
            {ativos.map((p) => (
              <FaixaProduto
                key={p.slug}
                produto={p}
                atendentes={atendentes}
                total={atendentes.length}
              />
            ))}
            {curingas.length > 0 && (
              <p className="mt-1.5 text-[11px] leading-snug text-text-secondary">
                O <b>+N</b> das faixas{" "}
                {verbo(curingas.length, "é a pessoa", "são as pessoas")} sem habilidade
                declarada: {plural(curingas.length, "pessoa", "pessoas")}{" "}
                {verbo(curingas.length, "entra", "entram")} em todos os produtos e{" "}
                {verbo(curingas.length, "sai", "saem")} deles no instante em que alguém
                marcar o primeiro produto na ficha{" "}
                {verbo(curingas.length, "dela", "delas")}.
              </p>
            )}
          </div>
        )}
      </Card>

      <ModalHabilidades
        atendente={editando}
        praca={praca}
        ativos={ativos}
        onFechar={() => setEditando(null)}
      />
    </div>
  );
}

/**
 * Uma faixa da leitura inversa: quem cobre este produto, e por qual motivo.
 *
 * `BandRow` é a peça do DS para "onde está o aperto", que é exatamente a pergunta
 * aqui. A cor separa três situações que uma contagem sozinha embaralha: ninguém
 * (vermelho), só curinga (amarelo, porque a cobertura evapora quando alguém declarar
 * a primeira habilidade) e gente declarada (verde).
 */
function FaixaProduto({
  produto,
  atendentes,
  total,
}: {
  produto: ProdutoAtivo;
  atendentes: Atendente[];
  total: number;
}) {
  const { declarados, curinga } = coberturaDoProduto(produto.slug, atendentes);
  const cobrem = declarados.length + curinga.length;

  /*
    A DESCRIÇÃO É CURTA porque ela mora na coluna do rótulo, que é fixa: frase inteira
    ali sai truncada em "ninguém: sem di…", que é pior que uma palavra. O texto longo
    vive no `title`, e a nuance de "só quem atende tudo" está na cor da barra e na nota
    abaixo da lista.
  */
  const descricao =
    cobrem === 0
      ? "ninguém"
      : declarados.length === 0
        ? "nenhum declarado"
        : `${declarados.length} ${declarados.length === 1 ? "declarado" : "declarados"}` +
          // O "+N" fecha a conta entre a descrição e a figura da direita, que conta os
          // curingas também: sem ele a linha lê "3 declarados" ao lado de um 4.
          (curinga.length > 0 ? `, +${curinga.length}` : "");

  const nomes = [...declarados, ...curinga].map((a) => a.nome);
  const explicacao =
    cobrem === 0
      ? "Ninguém aceita este produto: a conversa dele fica sem distribuição."
      : declarados.length === 0
        ? `Coberto só por quem atende tudo, então a cobertura acaba quando alguém declarar a primeira habilidade: ${nomes.join(", ")}.`
        : `${plural(declarados.length, "pessoa declarada", "pessoas declaradas")}` +
          (curinga.length > 0
            ? ` e ${plural(curinga.length, "que atende tudo", "que atendem tudo")}`
            : "") +
          `: ${nomes.join(", ")}.`;

  return (
    <BandRow
      label={produto.rotulo}
      labelWidth={128}
      description={descricao}
      ratio={total > 0 ? cobrem / total : 0}
      value={cobrem}
      tone={cobrem === 0 ? "error" : declarados.length === 0 ? "warn" : "success"}
      avatars={[...declarados, ...curinga].map((a) => getInitials(a.nome))}
      title={`${produto.rotulo}\n${explicacao}`}
    />
  );
}

/**
 * As habilidades de uma pessoa. `PUT` substitui o conjunto, então o modal edita a
 * lista inteira e só ela.
 *
 * Desmarcar tudo é uma escolha legítima e a mais provável de ser feita sem querer, por
 * isso o rodapé muda de texto quando a seleção fica vazia: o aviso aparece antes do
 * clique, e não como surpresa depois.
 */
function ModalHabilidades({
  atendente,
  praca,
  ativos,
  onFechar,
}: {
  atendente: Atendente | null;
  /** Para responder QUAIS NÚMEROS a seleção atual faz cair nesta pessoa. */
  praca: Praca;
  ativos: ProdutoAtivo[];
  onFechar: () => void;
}) {
  const [salvar, { isLoading }] = useDefinirProdutosDoAtendenteMutation();
  const [erro, setErro] = useState<string | null>(null);
  const [escolhidos, setEscolhidos] = useState<string[]>([]);
  const [chave, setChave] = useState<string | null>(null);

  // Remonta a seleção quando troca a pessoa aberta, sem `useEffect`: a chave muda e o
  // estado é recalculado na mesma renderização. É o padrão já usado no modal de canal.
  const chaveAtual = atendente?.user_id ?? null;
  if (chave !== chaveAtual) {
    setChave(chaveAtual);
    setEscolhidos(atendente ? habilidades(atendente) : []);
    setErro(null);
  }

  function alternar(slug: string) {
    setEscolhidos((a) =>
      a.includes(slug) ? a.filter((s) => s !== slug) : [...a, slug],
    );
  }

  async function confirmar() {
    if (!atendente) return;
    setErro(null);
    try {
      await salvar({ userId: atendente.user_id, produtos: escolhidos }).unwrap();
      onFechar();
    } catch (e) {
      const corpo = (e as { data?: { message?: string | string[] } }).data;
      const msg = Array.isArray(corpo?.message) ? corpo?.message[0] : corpo?.message;
      setErro(msg ?? "Não deu para salvar as habilidades.");
    }
  }

  const tudo = escolhidos.length === 0;

  return (
    <Modal
      open={atendente !== null}
      onOpenChange={(v) => {
        if (!v) onFechar();
      }}
    >
      <ModalContent size="sm">
        <ModalHead
          eyebrow="Habilidades"
          title={atendente?.nome ?? ""}
          description="Escolha os produtos que esta pessoa recebe na distribuição."
          badge={
            atendente && (
              <Badge size="xs" variant={COR_STATUS[atendente.status]}>
                {ROTULO_STATUS[atendente.status]}
              </Badge>
            )
          }
        />
        <ModalBody>
          <div className="flex flex-col gap-1">
            {ativos.map((p) => {
              const marcado = escolhidos.includes(p.slug);
              return (
                /*
                  `div` com `onClick`, e NÃO `label` em volta.

                  Com `label` o toque no texto cancelava a si mesmo: o navegador
                  encaminha a ativação do rótulo para o controle de dentro, então o
                  handler do label alternava e o clique encaminhado no `Checkbox`
                  alternava de volta, e a caixa nunca mudava. Testado na tela, não
                  suposto.

                  Aqui a área grande é conveniência e o `Checkbox` do DS continua sendo
                  o controle de verdade (é ele que tem foco, papel e teclado). Clicar no
                  quadrado alterna uma vez só porque o `Checkbox` chama
                  `stopPropagation`, então o handler da faixa não roda em seguida.
                */
                <div
                  key={p.slug}
                  onClick={() => alternar(p.slug)}
                  className="flex cursor-pointer items-center gap-2.5 rounded-[12px] px-2 py-2.5 hover:bg-[var(--l4-fill-5)]"
                >
                  <Checkbox
                    checked={marcado}
                    onCheckedChange={() => alternar(p.slug)}
                    disabled={isLoading}
                    aria-label={p.rotulo}
                  />
                  {/* Sem selo de "recebe" ao lado: a caixa marcada já diz isso, e
                      repetir o mesmo estado em duas formas na mesma linha só ocupa o
                      lugar do nome do produto em tela estreita. */}
                  <span className="min-w-0 flex-1 truncate text-[13px] text-text-strong">
                    {p.rotulo}
                  </span>
                </div>
              );
            })}

            <p
              className={[
                "mt-1 rounded-[12px] px-3 py-2 text-[11.5px] leading-relaxed",
                tudo ? "bg-info-bg text-text-strong" : "text-text-secondary",
              ].join(" ")}
            >
              {tudo ? (
                <>
                  <b>Nada marcado significa atender TODOS os produtos</b>, inclusive os
                  que a praça habilitar depois. Marcar o primeiro produto{" "}
                  <b>restringe</b>, não amplia.
                </>
              ) : (
                <>
                  Fora desta lista, esta pessoa não recebe nada: produto novo na praça
                  não entra sozinho na ficha dela.
                </>
              )}
            </p>

            {/*
              O OUTRO LADO DA CORRENTE: quais NÚMEROS a seleção atual faz cair aqui.

              Marcar uma caixa chamada "HiperXCAP" não diz nada até a tela responder o
              que muda de verdade, que é qual número para (ou passa) a cair nesta
              pessoa. E o cálculo é da seleção NA TELA, não da salva: a consequência
              aparece antes do clique em Salvar, que é onde ela ainda é reversível.
            */}
            <NumerosQueCaemAqui
              slugs={escolhidos}
              praca={praca}
              ativos={ativos}
              tudo={tudo}
            />

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
          secundarias={
            tudo
              ? []
              : [{ label: "Atender tudo", onClick: () => setEscolhidos([]) }]
          }
          primaria={{
            label: "Salvar habilidades",
            onClick: confirmar,
            loading: isLoading,
          }}
        />
      </ModalContent>
    </Modal>
  );
}

/**
 * Os NÚMEROS que caem nesta pessoa com a seleção que está na tela agora.
 *
 * A corrente do módulo tem três elos (número → produto → quem atende) e cada tela via
 * dois. Aqui é o elo de trás: a habilidade é escolhida em nome de produto, e a
 * consequência real é de qual NÚMERO a conversa vai chegar. Sem isto, marcar caixa é
 * um ato às cegas, e o erro só aparece dias depois como fila que não anda.
 *
 * Dois estados merecem palavra, e não só a lista:
 *
 * - Nada marcado: cai TUDO, inclusive o número que a praça ligar amanhã. É o fail-open,
 *   e é o que faz "marcar o primeiro produto" ser uma restrição disfarçada de escolha.
 * - Marcado um produto que não tem número: a pessoa fica habilitada para algo que não
 *   recebe conversa nenhuma. Não é erro, é configuração adiantada, e dizer isso evita
 *   que alguém passe a tarde procurando por que a fila dela está vazia.
 */
function NumerosQueCaemAqui({
  slugs,
  praca,
  ativos,
  tudo,
}: {
  slugs: string[];
  praca: Praca;
  ativos: ProdutoAtivo[];
  tudo: boolean;
}) {
  const canais = tudo
    ? praca.canais
    : praca.canais.filter((c) =>
        slugs.some((slug) => canaisDoProduto(praca, slug).includes(c)),
      );
  const semNumero = tudo ? [] : slugs.filter((slug) => canaisDoProduto(praca, slug).length === 0);

  return (
    <div className="mt-1 flex flex-col gap-1 rounded-[12px] bg-[var(--l4-fill-5)] px-3 py-2.5">
      <div className="flex items-center gap-1.5">
        <Phone className="size-3 flex-none text-text-secondary" aria-hidden />
        <span className="text-[11px] font-semibold text-text-secondary">
          {tudo ? "Recebe de todos os números" : "Recebe destes números"}
        </span>
      </div>

      {canais.length === 0 ? (
        <p className="text-[11px] leading-snug text-warn-text">
          Nenhum número cadastrado{tudo ? " na praça" : " para os produtos marcados"}.
          Enquanto for assim, esta pessoa não recebe conversa por nenhum canal.
        </p>
      ) : (
        <span className="flex flex-wrap gap-1">
          {canais.map((c) => (
            /*
              O ESTADO DO CANAL vai no selo, e não só o nome: um número `fora` ou
              `degradado` na lista leria como cobertura que não existe, e é justamente
              a leitura que faz alguém concluir que está tudo configurado.
            */
            <Badge
              key={c.id}
              size="xs"
              variant={c.status === "ativo" ? "neutral" : "warn"}
              title={c.status === "ativo" ? undefined : `Este canal está ${c.status}.`}
            >
              {c.rotulo}
              {c.status !== "ativo" && ` (${c.status})`}
            </Badge>
          ))}
        </span>
      )}

      {semNumero.length > 0 && (
        <p className="text-[11px] leading-snug text-text-secondary">
          {plural(semNumero.length, "Produto marcado", "Produtos marcados")} ainda sem
          número próprio: {semNumero.map((s) => rotuloDoProduto(s, ativos)).join(", ")}.
          Não é erro, só não chega conversa por ali até o número existir.
        </p>
      )}
    </div>
  );
}
