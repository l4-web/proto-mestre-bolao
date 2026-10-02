import { ChevronRight, ChevronLeft } from "lucide-react";
import { Avatar, Badge } from "@l4-web/ui";
import type {
  Contato,
  ProdutoDaConversa,
} from "../../features/atendimento/tipos";
import { nomeVisivel } from "./util";

/**
 * Cabeçalho da thread, na estrutura do Messages: avatar por cima, e abaixo dele
 * uma cápsula de vidro com o nome e uma segunda linha de contexto.
 *
 * A segunda linha carrega os DADOS do participante (CPF e telefone), no lugar que
 * no Messages é a localização, e o selo do PRODUTO na frente deles.
 *
 * O produto entra na linha de baixo, e não na do nome, porque a do nome é a que
 * trunca: no modo compacto ela divide 375px com o voltar, o avatar e as ações, e um
 * selo ali comia justamente o nome. Na linha de baixo o selo é `flex-none` e o que
 * cede é o texto de CPF e telefone, que já vive truncado e tem o painel de contexto
 * como destino completo. É informação de primeira classe porque o produto decide a
 * árvore do bot e os artigos: responder APCAP numa conversa de HiperXCAP é errar o
 * conteúdo inteiro, e até agora a tela não dizia de qual produto era a conversa.
 *
 * Três coisas saíram dela de propósito:
 *
 * - **O canal.** Este chat é sempre WhatsApp, então escrever "whatsapp" em cada
 *   conversa é ruído que não distingue nada. O produto é o oposto: cada produto tem
 *   o seu número, e é ele que muda a resposta certa.
 * - **A janela de 24h.** Ela já vive no trilho do campo de resposta, que é onde
 *   ela tem consequência. Repetir aqui era a mesma informação em dois lugares.
 * - **Ícone de telefone.** O módulo NÃO liga: o escopo é explícito em que ligar é
 *   ação humana fora do sistema, e o Atende Aí entrega o número, não faz a
 *   chamada. Botão que não pode agir é promessa falsa.
 *
 * A cápsula é clicável quando existe painel para abrir, igual clicar no nome no
 * Messages. Em tela larga o painel já está aberto ao lado, então ela não é botão.
 */
export function CabecalhoThread({
  contato,
  ref_,
  produto,
  onAbrirContexto,
  onVoltar,
  compacto,
  acoes,
}: {
  contato: Contato;
  ref_?: string | null;
  /** O produto da conversa, com o rótulo da API. `null` = a API não sabe. */
  produto?: ProdutoDaConversa | null;
  onAbrirContexto?: () => void;
  /**
   * Voltar para a lista. Só existe quando a tela mostra uma coluna por vez.
   *
   * Sem ele, abrir uma conversa no celular deixava a lista inalcançável: não havia
   * nada na tela que voltasse, e o gesto de voltar do navegador sai do módulo.
   */
  onVoltar?: () => void;
  /** Barra em linha, para telefone. Ver a nota na desestruturação. */
  compacto?: boolean;
  /** As ações do caso, na ponta direita da mesma faixa. */
  acoes?: React.ReactNode;
}) {
  const nome = nomeVisivel(contato, ref_);

  // Sem permissão de dado pessoal a linha de baixo diz a REGRA, não fica vazia.
  const dados = contato.oculto
    ? "dados pessoais ocultos para o seu perfil"
    : [contato.cpf, contato.telefone].filter(Boolean).join(" · ") ||
      "sem CPF e telefone no cadastro";

  if (compacto) {
    return (
      /*
        `sticky` e com fundo próprio: a barra vive DENTRO do rolador das mensagens
        (ver a nota da raiz larga), então sem `bg-surface` as bolhas apareceriam
        através dela ao rolar. O fundo é o mesmo da coluna, então o desenho é o de
        antes, e a barra segue colada no topo como estava.
      */
      <div className="sticky top-0 z-10 flex items-center gap-2 border-b-[0.5px] border-border-muted bg-surface px-2 py-2">
        {onVoltar && (
          <button
            type="button"
            onClick={onVoltar}
            aria-label="Voltar para a lista"
            className="l4-pressable flex size-9 flex-none items-center justify-center rounded-full text-text-strong hover:bg-[var(--l4-fill-4)]"
          >
            <ChevronLeft className="size-5" aria-hidden />
          </button>
        )}

        <Avatar nome={contato.oculto ? "?" : nome} size={34} />

        {/*
          O nome é BOTÃO quando existe painel para abrir, igual tocar no nome no
          WhatsApp abre os dados do contato. `min-w-0` é o que faz o `truncate`
          funcionar dentro do flex: sem ele o nome empurra as ações para fora da tela,
          que foi o que aconteceu no print.
        */}
        <button
          type="button"
          onClick={onAbrirContexto}
          disabled={!onAbrirContexto}
          className="l4-pressable flex min-w-0 flex-1 flex-col items-start text-left disabled:cursor-default"
        >
          <span className="w-full truncate text-[13.5px] font-semibold leading-tight text-text-strong">
            {nome}
          </span>
          {/* O selo é `flex-none` e o texto de dados é quem trunca: em 375px o que
              não pode desaparecer é de qual produto é a conversa. */}
          <span className="flex w-full min-w-0 items-center gap-1.5">
            {produto && (
              <Badge size="xs" variant="neutral" className="flex-none">
                {produto.rotulo}
              </Badge>
            )}
            <span className="min-w-0 truncate text-[11px] leading-tight text-text-secondary">
              {dados}
            </span>
          </span>
        </button>

        <span className="flex flex-none items-center">{acoes}</span>
      </div>
    );
  }

  return (
    /*
      `sticky` DENTRO do rolador das mensagens, e não `absolute` sobre ele.
      ─────────────────────────────────────────────────────────────────────
      Era `absolute inset-x-0 top-0`, e o vizinho compensava com `pt-[104px]` na
      área de rolagem. O padrão custou um bug visível em produção: quem
      acrescentou a faixa "Resumir com o Blue" a pôs em fluxo normal ANTES do
      rolador, o padding do rolador não a empurrava, e o cabeçalho era desenhado
      por cima dela (o avatar cobria o texto do resumo e o card do nome flutuava
      sobre os botões). O número mágico já estava errado por outro motivo também:
      o selo do produto levou o cabeçalho a 107px.

      `sticky` resolve a CLASSE do problema, não o sintoma: o elemento ocupa a
      própria altura no fluxo, então ninguém precisa saber quanto ele mede, e ao
      mesmo tempo continua colado no topo com as bolhas passando POR BAIXO, que é
      o que faz o vidro da cápsula ser vidro. Para isso ele precisa morar dentro
      do elemento que rola, e não ser irmão dele: `sticky` se ancora no rolador
      mais próximo, e como irmão do rolador ele não tem onde grudar.

      O `pointer-events-none` FICA. Em fluxo ele não precisa mais deixar clique
      passar para as mensagens de trás, mas os vãos deste cabeçalho (o espaçador
      da esquerda e a volta da cápsula) seguem sendo área morta de propósito, e os
      filhos reabilitam o ponteiro um por um.
    */
    <div className="pointer-events-none sticky top-0 z-10 flex items-start justify-between gap-2 px-3 pb-1 pt-2.5">
      {/* Espaçador espelho das ações: com os dois lados em `flex-1`, o bloco do
          meio fica centrado de verdade e as bolas nunca invadem o centro. */}
      <span className="flex flex-1 items-center">
        {onVoltar && (
          <button
            type="button"
            onClick={onVoltar}
            aria-label="Voltar para a lista"
            title="Voltar para a lista"
            className="l4-pressable pointer-events-auto flex size-[34px] items-center justify-center rounded-full bg-surface text-text-strong shadow-[var(--l4-sh-rest)]"
          >
            <ChevronLeft className="size-4" aria-hidden />
          </button>
        )}
      </span>

      {/*
        A CÁPSULA CEDE, e as ações não.

        Ela era `flex-none`, então ficava nos 320px do `max-w` e empurrava as ações
        para fora: dentro do AppShell esta coluna tem ~515px, e 320 de cápsula mais
        ~240 de botões davam 584. Antes isso vazava por cima da coluna de contexto (o
        cabeçalho era absoluto e a seção não corta), e com ele em fluxo passaria a
        virar rolagem horizontal, que é pior: o Encerrar sai da tela.

        `min-w-0 shrink` deixa a cápsula encolher, e ela já foi feita para isso (o
        nome e a linha de dados truncam). As ações mantêm o tamanho porque `flex-1`
        com `min-width: auto` não encolhe abaixo do conteúdo, e são elas que precisam
        ser clicáveis. O selo do produto é `flex-none`, então quem cede é o CPF e o
        telefone, que têm o painel de contexto como destino completo.
      */}
      <div className="flex min-w-0 max-w-[320px] shrink flex-col items-center gap-1.5">
        <Avatar nome={contato.oculto ? "?" : nome} size={44} />

        {onAbrirContexto ? (
          <button type="button" onClick={onAbrirContexto} className={CAPSULA}>
            <Miolo nome={nome} dados={dados} produto={produto} comChevron />
          </button>
        ) : (
          <div className={CAPSULA}>
            <Miolo nome={nome} dados={dados} produto={produto} />
          </div>
        )}
      </div>

      <span className="pointer-events-auto flex flex-1 justify-end">
        {acoes}
      </span>
    </div>
  );
}

/**
 * `l4-glass-surface` é o vidro DO DS: gradiente, borda, sombra e
 * `blur(24px) saturate(1.8) brightness(1.04)` num pacote só. A versão anterior
 * disto montava o efeito à mão sobre `--l4-cluster-bg`, que é um branco chapado
 * de 68%: sobre a área clara da thread aquilo lia como cápsula opaca, sem vidro
 * nenhum. O `saturate`/`brightness` do DS é justamente o que faz o vidro
 * aparecer quando o que está atrás é quase branco.
 */
/*
 * O TETO DE LARGURA SAIU DAQUI e foi para o embrulho, e aqui ficou `max-w-full`.
 *
 * Com `max-w-[320px]` a cápsula não acompanhava o encolhimento: ela é item flex de um
 * `flex-col` com `items-center`, então a largura dela é `fit-content(disponível)`, e o
 * "disponível" do embrulho só fica definido DEPOIS de o flex da linha de cima
 * encolhê-lo. O resultado media 281px dentro de um embrulho de 200 e vazava 40 para
 * cada lado, por cima do botão de voltar e das ações.
 *
 * `max-w-full` é porcentagem da largura JÁ resolvida do embrulho, que é definida
 * porque vem do algoritmo flex. O teto de 320 continua existindo, uma vez só, no
 * embrulho.
 */
const CAPSULA =
  "l4-glass-surface pointer-events-auto flex max-w-full flex-col items-center rounded-[16px] border-[0.5px] px-3.5 py-1.5 transition-transform duration-150 active:scale-[0.98]";

function Miolo({
  nome,
  dados,
  produto,
  comChevron,
}: {
  nome: string;
  dados: string;
  produto?: ProdutoDaConversa | null;
  comChevron?: boolean;
}) {
  return (
    <>
      <span className="flex min-w-0 max-w-full items-center gap-1">
        <span className="min-w-0 truncate text-[13.5px] font-semibold leading-tight text-text-strong">
          {nome}
        </span>
        {comChevron && (
          <ChevronRight className="size-3 flex-none text-text-muted" />
        )}
      </span>
      {/* Mesma ordem do modo compacto, para a leitura não trocar de lugar entre
          telefone e desktop: selo do produto, depois os dados do participante. */}
      <span className="flex min-w-0 max-w-full items-center gap-1.5">
        {produto && (
          <Badge size="xs" variant="neutral" className="flex-none">
            {produto.rotulo}
          </Badge>
        )}
        <span className="min-w-0 truncate text-[11px] leading-tight text-text-secondary">
          {dados}
        </span>
      </span>
    </>
  );
}
