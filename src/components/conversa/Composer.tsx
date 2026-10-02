import { useMemo, useRef, useState, type ComponentType } from "react";
import { AlertTriangle, Ban, Paperclip, Send, Sparkles } from "lucide-react";
import { Button, Cluster, Spinner } from "@l4-web/ui";
import { BLUE_AI_ICON_SRC } from "@l4-web/ui/shell";
import type { Janela } from "../../features/atendimento/tipos";
import { useJanela } from "../../lib/useJanela";

export interface Macro {
  id: string;
  titulo: string;
  corpo: string;
  variaveis: string[];
}

/**
 * Bola de ação do campo, só com ícone. O rótulo vive no `title` e no `aria-label`,
 * que é o que dá a dica no hover e o nome para o leitor de tela ao mesmo tempo.
 */
const BOTAO_ICONE =
  "l4-pressable flex h-[30px] w-[30px] items-center justify-center rounded-full text-text-strong transition-colors hover:bg-[var(--l4-fill-3)] disabled:opacity-35";

/**
 * Botão de ícone do campo, limpo dentro da cápsula do DS. O vidro é do `Cluster`;
 * dar vidro a cada botão é o erro que o próprio DS documenta.
 */
function BotaoIcone({
  icon: Icon,
  rotulo,
  disabled,
  ativo,
  onClick,
}: {
  icon: ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  rotulo: string;
  disabled?: boolean;
  ativo?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={rotulo}
      aria-pressed={ativo}
      title={rotulo}
      className={[BOTAO_ICONE, ativo ? "bg-[var(--l4-fill-2)]" : ""].join(" ")}
    >
      <Icon className="h-4 w-4" aria-hidden />
    </button>
  );
}

/** O veredito da régua de compliance sobre o que está escrito. */
type Veredito =
  | { nivel: "ok" }
  | { nivel: "revisao"; termos: string[] }
  | { nivel: "bloqueio"; termos: string[] };

/**
 * Valida o texto contra a régua da PRAÇA, na digitação. É a peça que o protótipo
 * testa com "investimento" e "imposto", e ela existe porque num produto
 * fiscalizado pela SUSEP a hora de pegar o problema é antes do envio, não no
 * relatório do mês seguinte.
 *
 * Bloqueio impede o envio. Revisão só avisa: `jogar` e `aposta` são legítimos em
 * contexto (a etapa 8 da jornada se chama Jogar), e bloquear quebraria o produto.
 */
function validar(
  texto: string,
  bloqueio: string[],
  revisao: string[],
): Veredito {
  const t = texto.toLowerCase();
  const achar = (lista: string[]) =>
    lista.filter((termo) => termo && t.includes(termo.toLowerCase()));

  const duros = achar(bloqueio);
  if (duros.length) return { nivel: "bloqueio", termos: duros };
  const moles = achar(revisao);
  if (moles.length) return { nivel: "revisao", termos: moles };
  return { nivel: "ok" };
}

/**
 * O campo de resposta, com tudo que cerca o envio: régua de compliance na
 * digitação, resposta pronta, anexo, e o trilho da janela de 24h.
 *
 * O trilho da janela mora AQUI, e não num cabeçalho: ele restringe o que pode ser
 * enviado, então pertence ao lugar onde a pessoa envia. Solto no topo ele era
 * informação sem consequência visível.
 */
/**
 * O rascunho de cada conversa, guardado POR conversa.
 *
 * Sem isto o texto vazava de uma pessoa para outra: o campo é estado interno do
 * composer, o composer não remonta ao trocar de thread, e o que foi escrito para
 * a Ana continuava na caixa ao abrir a conversa do Tiago. Com a janela de 24h
 * aberta, bastava um Enviar para o dado de um cliente ir para outro, que é
 * exatamente o vazamento que este módulo existe para não deixar acontecer.
 *
 * Remontar por `key` também isolaria, mas jogaria o rascunho fora a cada olhada em
 * outra thread, e trocar de thread é o que mais se faz num inbox. Guardar por id
 * resolve os dois: isolado E preservado.
 *
 * Mora no módulo e não em estado do React porque é rascunho de trabalho, não dado
 * de servidor: não deve disparar renderização de ninguém nem ir para o Redux, e
 * morre com o refresh da página, que é o comportamento certo para texto não
 * enviado.
 */
const RASCUNHOS = new Map<string, string>();

export function Composer({
  janela,
  rede = "whatsapp",
  macros,
  bloqueioDuro,
  termosRevisao,
  podeEnviar,
  motivoIndisponivel,
  erro,
  onEnviar,
  onEnviarAnexo,
  conversaId,
  gerarRascunho,
  nomeDoContato,
}: {
  janela: Janela;
  /**
   * De qual rede é esta conversa.
   *
   * O trilho inteiro estava escrito como se o WhatsApp fosse o único canal: "24h" e
   * "só template aprovado". Num caso aberto a partir de um comentário do Instagram
   * isso mente duas vezes, porque lá são 7 dias e template aprovado não existe. A
   * saída, passado o prazo, é responder publicamente no comentário.
   */
  rede?: "whatsapp" | "instagram" | "facebook";
  macros: Macro[];
  bloqueioDuro: string[];
  termosRevisao: string[];
  podeEnviar: boolean;
  /** Por que o envio está desligado, quando está. Vira `title` do botão. */
  motivoIndisponivel?: string;
  /**
   * O que o servidor respondeu quando a última tentativa falhou.
   *
   * Fica AQUI, junto do botão que falhou, e não num aviso de página: envio que
   * recusa em silêncio é indistinguível de envio que deu certo, e a pessoa segue
   * achando que respondeu o cliente.
   */
  erro?: string | null;
  /** Para preencher `{{nome}}` das macros. */
  nomeDoContato?: string | null;
  /** De qual conversa é este rascunho. */
  conversaId: string;
  /**
   * Envia e responde SE DEU CERTO.
   *
   * O retorno importa: o campo só se limpa com `true`. Limpar sempre jogaria fora
   * a resposta escrita quando a régua da Meta, a permissão ou a rede recusassem, e
   * a pessoa teria que reescrever o que já tinha escrito. Sem retorno nenhum, que
   * era o desenho anterior, o texto ficava na caixa depois de enviado e o segundo
   * clique mandava a mesma mensagem de novo.
   */
  onEnviar?: (texto: string) => Promise<boolean>;
  /**
   * Envia ANEXO com a legenda que estiver escrita. Ausente = clipe desligado, que é
   * o estado de quem monta o Composer sem essa capacidade.
   */
  onEnviarAnexo?: (arquivo: File, legenda: string) => Promise<boolean>;
  /**
   * Pede um rascunho ao Blue e devolve o texto, ou `null` se não deu.
   *
   * Volta como TEXTO em vez de o Blue escrever direto no campo por um motivo: o
   * campo é da pessoa. O rascunho entra como ponto de partida editável, e é ela
   * que decide enviar. Ausente = o Blue não está ligado nesta instalação, e o
   * botão nem aparece (botão que sempre falha ensina a desconfiar da tela).
   */
  gerarRascunho?: () => Promise<string | null>;
}) {
  const [texto, definirTexto] = useState(() => RASCUNHOS.get(conversaId) ?? "");

  // Toda escrita passa por aqui: o estado da tela e o rascunho da conversa andam
  // juntos, então trocar de thread e voltar reencontra o que estava escrito.
  const setTexto = (valor: string) => {
    definirTexto(valor);
    RASCUNHOS.set(conversaId, valor);
  };

  // Trocar de conversa carrega o rascunho DELA. Sem isto o texto anterior fica na
  // caixa da conversa nova, que é como o dado de um cliente ia para outro.
  const [ultimaConversa, setUltimaConversa] = useState(conversaId);
  const campoArquivo = useRef<HTMLInputElement>(null);
  const [anexando, setAnexando] = useState(false);
  if (ultimaConversa !== conversaId) {
    setUltimaConversa(conversaId);
    definirTexto(RASCUNHOS.get(conversaId) ?? "");
  }
  const [abrirMacros, setAbrirMacros] = useState(false);
  const [gerando, setGerando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const campo = useRef<HTMLTextAreaElement>(null);

  const veredito = useMemo(
    () => validar(texto, bloqueioDuro, termosRevisao),
    [texto, bloqueioDuro, termosRevisao],
  );

  const {
    fechada: janelaFechada,
    texto: restaTexto,
    pct: restante,
    apertado,
  } = useJanela(janela);
  const bloqueado = veredito.nivel === "bloqueio";
  const vazio = texto.trim().length === 0;

  const ehWhats = rede === "whatsapp";
  const prazo = ehWhats ? "24h" : "7 dias";
  const saidaFechada = ehWhats
    ? "só template aprovado"
    : "responda publicamente no comentário";

  // Quanto sobrou da janela, em porcentagem, para o trilho. 24h = 1440min.

  async function pedirAoBlue() {
    if (!gerarRascunho || gerando) return;
    setGerando(true);
    try {
      const rascunho = await gerarRascunho();
      // SUBSTITUI em vez de concatenar: o rascunho é a resposta inteira do caso,
      // não um trecho. Emendar no que já estava escrito produz texto repetido.
      if (rascunho) setTexto(rascunho);
      campo.current?.focus();
    } finally {
      setGerando(false);
    }
  }

  /**
   * Envia uma vez e limpa o campo se saiu.
   *
   * `enviando` é a trava de verdade contra o clique duplo. A chave de idempotência
   * sozinha não resolvia: ela nasce de um relógio, e dois cliques com 300ms de
   * distância geram chaves DIFERENTES, então o servidor via duas mensagens
   * legítimas e o cliente recebia a resposta duas vezes. Trancar o botão enquanto
   * a requisição está viva é o que impede a segunda tentativa de existir.
   */
  async function enviar() {
    if (!onEnviar || enviando || vazio || bloqueado || janelaFechada) return;
    setEnviando(true);
    try {
      if (await onEnviar(texto)) setTexto("");
    } finally {
      setEnviando(false);
    }
  }

  function inserir(macro: Macro) {
    const corpo = preencher(macro.corpo, nomeDoContato);
    setTexto(texto ? `${texto}\n\n${corpo}` : corpo);
    setAbrirMacros(false);
    campo.current?.focus();
  }

  return (
    <div className="flex flex-col gap-2 border-t-[0.5px] border-border-muted p-3">
      {/* Trilho da janela de 24h. Fica acima do campo porque é o que limita o campo. */}
      <div
        className="flex items-center gap-2 text-[10.5px]"
        title={
          janelaFechada
            ? `Passaram-se mais de ${prazo} desde a última mensagem do cliente, e a Meta não aceita mais resposta livre: ${saidaFechada}.`
            : `Tempo restante da janela de ${prazo} da Meta. Depois dela, ${saidaFechada}.`
        }
      >
        <span
          className={
            janelaFechada ? "font-medium text-warn-text" : "text-text-secondary"
          }
        >
          {janelaFechada ? (
            `Janela fechada, ${saidaFechada}`
          ) : (
            <>
              Janela de atendimento ·{" "}
              <span className="tabular-nums">{restaTexto}</span>
            </>
          )}
        </span>
        <span className="h-1 flex-1 overflow-hidden rounded-full bg-[var(--l4-fill-3)]">
          <span
            className={`block h-full rounded-full transition-[width] duration-500 ${
              janelaFechada || apertado ? "bg-warn-accent" : "bg-brand"
            }`}
            style={{ width: `${janelaFechada ? 100 : restante}%` }}
          />
        </span>
      </div>

      <textarea
        ref={campo}
        rows={3}
        value={texto}
        onChange={(e) => setTexto(e.currentTarget.value)}
        disabled={janelaFechada}
        placeholder={
          janelaFechada
            ? `A janela de ${prazo} fechou. Agora ${saidaFechada}.`
            : "Escreva a resposta"
        }
        title={
          janelaFechada
            ? `A janela de ${prazo} fechou: ${saidaFechada}`
            : "Campo de resposta. A régua de compliance da praça valida enquanto você digita"
        }
        className="w-full resize-none rounded-[14px] border-[0.5px] border-border-muted bg-surface-muted px-3 py-2.5 text-[13.5px] leading-relaxed text-text-strong placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-brand/30 disabled:opacity-60"
      />

      {/* A régua só aparece quando tem o que dizer. Linha vazia permanente vira ruído. */}
      {veredito.nivel !== "ok" && (
        <p
          className={`flex items-start gap-1.5 rounded-[10px] px-2.5 py-1.5 text-[11.5px] leading-snug ${
            bloqueado
              ? "bg-error-bg text-error-text"
              : "bg-warn-bg text-warn-text"
          }`}
        >
          {bloqueado ? (
            <Ban className="mt-px size-3.5 flex-none" />
          ) : (
            <AlertTriangle className="mt-px size-3.5 flex-none" />
          )}
          <span>
            {bloqueado ? (
              <>
                <b>Não pode enviar.</b> A régua desta praça bloqueia{" "}
                {veredito.termos.map((t) => `"${t}"`).join(", ")}.
              </>
            ) : (
              <>
                <b>Confira antes de enviar.</b>{" "}
                {veredito.termos.map((t) => `"${t}"`).join(", ")} exige cuidado
                de contexto, mas não está proibido.
              </>
            )}
          </span>
        </p>
      )}

      {erro && (
        <p
          role="alert"
          className="flex items-start gap-1.5 rounded-[10px] bg-error-bg px-2.5 py-1.5 text-[11.5px] leading-snug text-error-text"
        >
          <Ban className="mt-px size-3.5 flex-none" aria-hidden />
          <span>{erro}</span>
        </p>
      )}

      <div className="relative flex items-center gap-2">
        <Cluster>
          {gerarRascunho && (
            <button
              type="button"
              onClick={pedirAoBlue}
              disabled={janelaFechada || gerando}
              aria-label="Pedir um rascunho de resposta ao Blue"
              title={
                janelaFechada
                  ? "Janela de 24h fechada: só template aprovado"
                  : "Pedir um rascunho de resposta ao Blue"
              }
              className={BOTAO_ICONE}
            >
              {gerando ? (
                <Spinner size={16} />
              ) : (
                <img src={BLUE_AI_ICON_SRC} alt="" className="h-4 w-4" />
              )}
            </button>
          )}
          <BotaoIcone
            icon={Sparkles}
            rotulo={
              macros.length === 0
                ? "Nenhuma resposta pronta cadastrada para este motivo"
                : `Resposta pronta (${macros.length})`
            }
            disabled={janelaFechada || macros.length === 0}
            onClick={() => setAbrirMacros((v) => !v)}
            ativo={abrirMacros}
          />
          {/*
            O ANEXO LIGOU. Ele passou meses desligado dizendo, por um tempo, o motivo
            errado (culpava o canal do WhatsApp, que funcionava). O que faltava era a
            rota: a Meta endereça mídia pelo id DELA, então enviar exige subir o
            arquivo antes, e sem isso o botão não tinha para onde mandar nada.

            O `input` fica escondido e o botão o aciona: o seletor nativo do sistema
            é feio dentro da barra e não aceita as medidas do DS, e reimplementá-lo
            seria trocar acessibilidade de graça por aparência.

            O `value` é limpo no fim de propósito: sem isso, escolher o MESMO arquivo
            duas vezes seguidas não dispara `change`, e a segunda tentativa não faz
            nada sem dizer por quê.
          */}
          <input
            ref={campoArquivo}
            type="file"
            accept="image/jpeg,image/png,application/pdf"
            className="hidden"
            onChange={async (e) => {
              const f = e.currentTarget.files?.[0];
              e.currentTarget.value = "";
              if (!f || !onEnviarAnexo) return;
              setAnexando(true);
              try {
                if (await onEnviarAnexo(f, texto)) setTexto("");
              } finally {
                setAnexando(false);
              }
            }}
          />
          <BotaoIcone
            icon={Paperclip}
            rotulo={
              janelaFechada
                ? "Anexar arquivo: a janela de 24h fechou"
                : "Anexar imagem ou PDF. O que estiver escrito vira legenda."
            }
            disabled={!onEnviarAnexo || janelaFechada || bloqueado || anexando}
            onClick={() => campoArquivo.current?.click()}
          />
        </Cluster>

        <span className="flex-1" />

        <Button
          size="sm"
          loading={enviando}
          disabled={!podeEnviar || vazio || bloqueado || janelaFechada}
          /**
           * O título diz o motivo DE VERDADE, na ordem em que ele manda.
           *
           * Era sempre o `motivoIndisponivel`, então com a janela fechada ou com
           * bloqueio de compliance o botão continuava dizendo "o envio chega com o
           * canal do WhatsApp". Quem responde ficava sem saber o que fazer: mudar
           * o texto? esperar? pedir template? Um só impedimento aparece por vez, e
           * o mais específico ganha, porque é o que a pessoa pode resolver.
           */
          title={
            janelaFechada
              ? "A janela de 24h fechou: só template aprovado pela Meta"
              : bloqueado
                ? "O texto tem dado que não pode sair: ajuste antes de enviar"
                : vazio
                  ? "Escreva a resposta"
                  : (motivoIndisponivel ?? "Enviar a resposta")
          }
          onClick={() => void enviar()}
        >
          <Send className="size-3.5" />
          Enviar
        </Button>

        {abrirMacros && macros.length > 0 && (
          <div className="absolute bottom-11 left-0 z-20 flex max-h-[240px] w-[320px] flex-col gap-px overflow-y-auto rounded-[16px] border-[0.5px] border-border-muted bg-surface p-1.5 shadow-[var(--l4-sh-raised)]">
            {macros.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => inserir(m)}
                className="flex flex-col gap-0.5 rounded-[11px] px-2.5 py-2 text-left hover:bg-[var(--l4-fill-4)]"
              >
                <span className="text-[12.5px] font-semibold text-text-strong">
                  {m.titulo}
                </span>
                <span className="line-clamp-2 text-[11.5px] leading-snug text-text-secondary">
                  {m.corpo}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Troca os campos da macro pelo que a tela já sabe.
 *
 * A macro é escrita com `{{nome}}` e chegava assim no rascunho, então ou o atendente
 * apagava na mão ou o cliente recebia "Oi {{nome}}". O dado está na mesma tela, a duas
 * linhas de distância: deixar a substituição para a pessoa é criar um jeito de errar
 * em público.
 *
 * Usa o PRIMEIRO nome: macro de atendimento é conversa, e "Oi, Maria" soa como gente
 * enquanto "Oi, Maria Aparecida da Silva" soa como cobrança.
 *
 * Sem nome, o campo some junto com o espaço que sobraria: "Oi , tudo bem?" é pior que
 * "Oi, tudo bem?". Campo que a tela não sabe preencher fica como está, para a ausência
 * ficar visível para quem escreve em vez de virar buraco na mensagem do cliente.
 */
function preencher(corpo: string, nome?: string | null): string {
  const primeiro = nome?.trim().split(/\s+/)[0];
  if (!primeiro) return corpo.replace(/,?\s*\{\{\s*nome\s*\}\}/gi, "");
  return corpo.replace(/\{\{\s*nome\s*\}\}/gi, primeiro);
}
