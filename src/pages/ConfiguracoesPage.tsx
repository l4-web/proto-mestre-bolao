import { useEffect, useState } from "react";
import { OctagonAlert } from "lucide-react";
import {
  Button,
  Card,
  Eyebrow,
  PageContainer,
  PageHeader,
  PageLoading,
  Tabs,
} from "@l4-web/ui";
import { usePracaAtual } from "../features/atendimento/usePracaAtual";
import { useAtendentesAlocacaoQuery } from "../features/atendimento/atendimento.api";
import {
  produtosAtivos,
  produtosSemDistribuicao,
} from "../features/atendimento/produtos";
import { SecaoCompliance } from "../components/config/SecaoCompliance";
import { MarcaNoIon } from "../components/config/MarcaNoIon";
import { SecaoOperacao } from "../components/config/SecaoOperacao";
import { SecaoRespostaAutomatica } from "../components/config/SecaoRespostaAutomatica";
import { SecaoCanais } from "../components/config/SecaoCanais";
import { SecaoAtendentes } from "../components/config/SecaoAtendentes";
import { FreiosDeMao } from "../components/config/FreiosDeMao";
import { FREIOS, freiosPuxados } from "../components/config/freios";
import { plural } from "../lib/plural";

type Aba = "canais" | "atendentes" | "compliance" | "operacao";

/**
 * A ABA "CREDENCIAIS" SAIU, e não sobrou nada dela para migrar de função.
 *
 * Ela não tinha um só controle: eram dois parágrafos dizendo que campo de segredo
 * "chega junto da contratação do provedor" e que o alarme de expiração "vai para o
 * Pulso". Uma aba é navegação, e navegação promete conteúdo: quem administra a
 * praça clicava procurando onde trocar o token e encontrava um aviso sobre planos.
 *
 * O que ali era verdadeiro e acionável já mora em Canais: o nome do secret se
 * cadastra por canal, e a validade do token passou a aparecer na linha do canal,
 * lida do campo `token_expira_em` que a API já mandava e ninguém desenhava.
 *
 * E continua sem poder voltar: a API não tem rota nenhuma sobre credencial. A
 * tabela `atd_credencial` existe no schema (com rótulo, últimos 4, validade e quem
 * cadastrou), e não há service nem controller que a leia ou escreva. Aba de
 * credenciais aqui só poderia mostrar dado inventado.
 *
 * ── A ABA "BOT" TAMBÉM SAIU, e essa foi para a Base de conhecimento ───────────
 * Ela não era configuração: gravava em `atd_artigo`/`atd_artigo_versao` pela rota
 * `POST /motivos/:id/resposta`, que é a mesma tabela que a Base lia. Taxonomia e
 * resposta são o que o bot DIZ ao cliente, ou seja conteúdo; esta página é sobre
 * COMO o módulo opera (canal, alocação, compliance, expediente). Era por isso que
 * as duas telas pareciam a mesma coisa para quem usava.
 */

export function ConfiguracoesPage() {
  const [aba, setAba] = useState<Aba>("canais");

  /**
   * O RETORNO DA META, lido da URL uma vez só.
   *
   * O callback do OAuth é rota pública e termina em redirect para cá, com o resultado
   * na query: do outro lado tem uma pessoa olhando a aba do navegador, e devolver JSON
   * na cara dela terminaria o fluxo num beco.
   *
   * Lido no primeiro render e APAGADO da URL em seguida: deixar `?instagram=ok` no
   * endereço faz o aviso voltar a cada recarregamento, anunciando uma conexão que
   * aconteceu há meia hora.
   */
  const [retornoIg, setRetornoIg] = useState<{ tipo: string; texto: string } | null>(null);
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const r = p.get("instagram");
    if (!r) return;
    setRetornoIg(
      r === "ok"
        ? { tipo: "ok", texto: `Instagram @${p.get("conta") ?? ""} conectado.` }
        : r === "cancelado"
          ? { tipo: "aviso", texto: "Conexão cancelada na tela da Meta. Nada mudou." }
          : { tipo: "erro", texto: p.get("motivo") ?? "A conexão com o Instagram falhou." },
    );
    p.delete("instagram");
    p.delete("conta");
    p.delete("motivo");
    const busca = p.toString();
    window.history.replaceState({}, "", busca ? `?${busca}` : window.location.pathname);
  }, []);
  const { praca, isLoading, isFetching } = usePracaAtual();
  /**
   * A alocação é consultada NA PÁGINA, e não só dentro da aba, para o contador do
   * produto sem ninguém existir antes de alguém abrir a aba.
   *
   * É a mesma razão do contador dos interruptores: um produto sem distribuição é fila
   * que não anda, e quem for investigar não sabe que existe uma aba para procurar. O
   * RTK Query compartilha o cache com a seção, então não são duas requisições.
   */
  const { data: atendentes } = useAtendentesAlocacaoQuery();

  const puxados = freiosPuxados(praca);
  const semDistribuicao = produtosSemDistribuicao(
    produtosAtivos(praca),
    atendentes ?? [],
  );

  if (isLoading) return <PageLoading label="Carregando as configurações" />;

  const produtos = praca?.produtos.filter((p) => p.ativo) ?? [];

  const abas = [
    { id: "canais" as const, label: "Canais" },
    {
      id: "atendentes" as const,
      label: "Alocação",
      badge: semDistribuicao.length || undefined,
    },
    // A aba renderiza UM CARTAO POR PRODUTO, e agora carrega duas coisas do produto
    // (a marca no iOn e a regua de linguagem), entao o nome dela e o produto.
    { id: "compliance" as const, label: "Produtos" },
    {
      id: "operacao" as const,
      label: "Operação",
      // O contador na aba é o que faz o freio ser encontrado a partir do aviso: o
      // aviso diz que algo está parado, e a aba diz ONDE religar sem procurar.
      badge: puxados.length || undefined,
    },
  ];

  return (
    <PageContainer>
      <PageHeader
        title="Configurações"
        subtitle="Canais e conexões, quem atende cada produto, compliance por produto, e a operação da praça. O que o bot responde ao cliente fica na Base de conhecimento."
        busy={isFetching}
      />

      {/*
        O AVISO FICA ACIMA DAS ABAS, e não dentro da aba do controle.

        Um freio puxado e esquecido é um módulo mudo sem ninguém entender por quê, e
        quem vai investigar não sabe que existe um interruptor para procurar. Aqui
        ele é a primeira coisa depois do título, em qualquer aba, e some sozinho
        quando os três voltam ao normal.
      */}
      {/*
        SEM `Card` em volta, e em GRADE em vez de `flex-col sm:flex-row`: o
        `styles.css` do DS entra depois do CSS do app, então o `l4-surface` dele
        apagava o `bg-error-bg` da tela (aviso saía branco e sem borda) e o
        `.flex-col` dele vencia o `.sm:flex-row` daqui (mesma especificidade, ele é
        o último), deixando a faixa empilhada no desktop. O aviso tingido é o mesmo
        desenho do bloco de Canais e dos erros de formulário do módulo.
      */}
      {puxados.length > 0 && (
        <div
          role="alert"
          className="grid gap-2.5 rounded-[16px] border-[0.5px] border-error-border bg-error-bg px-3.5 py-3 sm:grid-cols-[1fr_auto] sm:items-center"
        >
          <div className="flex min-w-0 items-start gap-2.5">
            <OctagonAlert className="mt-0.5 size-4 flex-none text-error-text" aria-hidden />
            <div className="min-w-0">
              <p className="text-[12.5px] font-semibold text-error-text">
                {plural(puxados.length, "interruptor desligado", "interruptores desligados")}{" "}
                nesta praça
              </p>
              <p className="text-[11.5px] leading-snug text-text-strong">
                {puxados.map((c) => `${FREIOS[c].rotulo} (${FREIOS[c].avisoCurto})`).join("; ")}.
              </p>
            </div>
          </div>
          {aba !== "operacao" && (
            <Button size="sm" variant="outline" onClick={() => setAba("operacao")}>
              Ver os interruptores
            </Button>
          )}
        </div>
      )}

      {/*
        Aba de seção é `Tabs`, e não `SegmentedControl` na faixa do título.

        As duas coisas parecem iguais e respondem perguntas diferentes: segmentado é
        CONTROLE, muda o recorte do mesmo conteúdo (visão da fila, período), e por isso
        mora junto do título, pequeno. Aba é NAVEGAÇÃO, troca o conteúdo inteiro da
        página, e por isso é alta, larga e fica na frente do conteúdo que ela comanda.
        No título, com a altura de controle de 30, a aba lia como um ajuste secundário e
        ninguém achava a seção.
      */}
      {/*
        `self-start` porque o `PageContainer` é `flex flex-col`, e num flex de coluna o
        `align-items: stretch` padrão estica o filho na horizontal: ele anulava o
        `inline-flex` com que o DS define as abas, e a cápsula virava uma faixa branca
        de ponta a ponta com cinco palavras perdidas dentro.
        O alinhamento é responsabilidade de quem monta a tela, e o próprio comentário
        do componente no DS diz isso.
      */}
      {retornoIg && (
        <p
          className={[
            "flex items-start gap-2 rounded-[16px] px-3.5 py-2.5 text-[12px] leading-relaxed",
            retornoIg.tipo === "ok"
              ? "bg-success-bg text-success-text"
              : retornoIg.tipo === "aviso"
                ? "bg-[var(--l4-fill-5)] text-text-secondary"
                : "bg-error-bg text-error-text",
          ].join(" ")}
        >
          {retornoIg.texto}
        </p>
      )}

      <Tabs className="self-start" tabs={abas} activeTab={aba} onChange={setAba} />

      {aba === "canais" && praca && <SecaoCanais praca={praca} />}

      {aba === "atendentes" && praca && <SecaoAtendentes praca={praca} />}

      {aba === "compliance" && (
        <div className="flex flex-col gap-3">
          {produtos.length === 0 ? (
            <Card className="p-4">
              <p className="text-[12px] text-text-secondary">
                Nenhum produto habilitado nesta praça.
              </p>
            </Card>
          ) : (
            produtos.map((p) => (
              <Card key={p.id} className="flex flex-col gap-3 p-4">
                <div className="flex items-center justify-between gap-2">
                  <Eyebrow>{p.rotulo || p.produto_slug}</Eyebrow>
                  <span className="rounded-full bg-[var(--l4-fill-4)] px-2 py-px font-mono text-[10px] text-text-secondary">
                    {p.produto_slug}
                  </span>
                </div>
                {/*
                  A marca do iOn vem ANTES da régua, e é de propósito: ela decide se o
                  atendente abre a conversa com o histórico de compra do cliente ou com
                  a coluna vazia, e é a única configuração deste cartão que alguém
                  procura com pressa. A régua é conjunto que se lê inteiro antes de
                  mexer, e ficar embaixo não a esconde.
                */}
                <MarcaNoIon
                  empresaId={praca!.empresa_id}
                  produtoSlug={p.produto_slug}
                  atual={p.ion_marca}
                />
                <div className="h-px bg-[var(--l4-surface-borda)]" />
                <SecaoCompliance
                  empresaId={praca!.empresa_id}
                  produtoSlug={p.produto_slug}
                  atual={p.compliance}
                />
              </Card>
            ))
          )}
        </div>
      )}

      {aba === "operacao" && (
        <Card className="flex flex-col gap-5 p-4">
          {praca ? (
            <>
              {/*
                Os interruptores vêm ANTES do expediente: são a única coisa desta
                seção que alguém abre com pressa, e o resto é configuração que se
                revisa sentado.
              */}
              <FreiosDeMao praca={praca} />
              {/* Logo abaixo dos freios porque é da mesma família (comportamento que
                  liga e desliga sem deploy) e é o único que COMEÇA algo: quem acabou de
                  ler os três que param precisa ver o que fala sozinho. */}
              <SecaoRespostaAutomatica praca={praca} />
              <SecaoOperacao praca={praca} />
            </>
          ) : (
            <p className="text-[12px] text-text-secondary">Praça não configurada.</p>
          )}
        </Card>
      )}
    </PageContainer>
  );
}
