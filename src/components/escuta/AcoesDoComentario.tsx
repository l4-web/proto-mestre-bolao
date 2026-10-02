import { useState } from "react";
import { AlertTriangle, EyeOff, HelpCircle, MessageSquarePlus, Reply } from "lucide-react";
import { BLUE_AI_ICON_SRC } from "@l4-web/ui/shell";
import { Button, Spinner, Textarea } from "@l4-web/ui";
import {
  useOcultarComentarioMutation,
  useRascunhoComentarioMutation,
  useResponderComentarioMutation,
} from "../../features/atendimento/atendimento.api";

export interface ComentarioAcionavel {
  id: string;
  estado: string;
  conversa_id: string | null;
  rede_pendente: boolean;
  rede_pendente_motivo: string | null;
  /** "responder" ou "ocultar" a caminho da Meta, nulo quando não há nada em curso. */
  acao_em_curso: string | null;
}

/**
 * As três ações sobre o comentário público, e o rascunho do Blue.
 *
 * Existiam na API desde o começo e a tela NUNCA as chamou: dava para ler o
 * comentário e não dava para fazer nada com ele, o que é o pior formato possível para
 * uma tela de reputação (mostra o problema e não deixa reagir).
 *
 * Fica em componente próprio e não solto no `map` da página por um motivo de estado:
 * a caixa de resposta, o texto digitado e o erro da rede são de UM comentário, e em
 * estado da página virariam ou uma variável por card ou um único campo compartilhado
 * que troca de dono quando a pessoa abre o segundo.
 */
export function AcoesDoComentario({
  c,
  podeResponder,
  podeOcultar,
}: {
  c: ComentarioAcionavel;
  podeResponder: boolean;
  podeOcultar: boolean;
}) {
  const [aberto, setAberto] = useState(false);
  const [texto, setTexto] = useState("");
  const [aviso, setAviso] = useState<string | null>(null);
  /** O aviso é dúvida (pode ter dado certo), e não falha. Muda a cor e o que oferecer. */
  const [duvida, setDuvida] = useState(false);

  const [responder, respondendo] = useResponderComentarioMutation();
  const [ocultar, ocultando] = useOcultarComentarioMutation();
  // `virar caso` está desligado na tela (ver o comentário na fila de botões). A
  // mutação continua existindo no client para quando ele voltar.
  const [pedirRascunho, rascunhando] = useRascunhoComentarioMutation();

  /**
   * A ação já foi PEDIDA e está a caminho da Meta.
   *
   * Vem do servidor e não do estado local de propósito: quem modera trabalha em lote e
   * sai do card assim que clica, então o "enviando" precisa sobreviver a recarregar a
   * página e a abrir a tela em outro computador. Estado local morreria no primeiro F5,
   * e a pessoa concluiria que não tinha clicado.
   */
  const emCurso = c.acao_em_curso;
  const ocupado =
    respondendo.isLoading || ocultando.isLoading || Boolean(emCurso);

  /**
   * Toda ação passa por aqui, e o que decide sucesso DEPENDE da ação.
   *
   * `responder` e `ocultar` falam com a Meta, e para elas o 200 não basta: a API
   * devolve `ok: false` com `redePendenteMotivo` quando a rede recusou, e o comentário
   * continua no ar ou a resposta não está na thread. Ler só o status HTTP foi o defeito
   * que este módulo já pagou, quando a tela dizia "ocultado" e o perfil falso seguia
   * respondendo cliente nosso.
   *
   * `virar caso` NÃO fala com a rede: ela abre conversa e ticket aqui dentro, e por
   * isso devolve `redeFeita: false` por construção. Julgar as três pelo mesmo campo
   * fazia a tela dizer "a rede social não confirmou a ação" logo abaixo do estado
   * `virou_caso` que ela mesma acabou de mostrar, ou seja o erro exatamente inverso ao
   * que o campo existe para evitar.
   */
  async function agir(
    executar: () => Promise<{
      ok: boolean;
      redeFeita: boolean;
      redePendenteMotivo?: string;
      incerto?: boolean;
    }>,
    opcoes: { exigeRede: boolean; aoDarCerto?: () => void },
  ) {
    setAviso(null);
    setDuvida(false);
    try {
      const r = await executar();
      const deuCerto = opcoes.exigeRede ? r.redeFeita : r.ok;
      if (!deuCerto) {
        /**
         * TIMEOUT NÃO É FRACASSO, É DÚVIDA.
         *
         * Aconteceu em produção: a resposta FOI publicada no Instagram e a tela disse
         * que a Meta não respondeu em 10s. Quem lê isso clica de novo, e clicar de
         * novo publica a mesma frase duas vezes na thread, à vista do público. Então a
         * caixa muda de cor e o botão de publicar some: a saída é conferir na rede,
         * não tentar de novo.
         */
        setDuvida(r.incerto === true);
        setAviso(
          r.redePendenteMotivo ??
            (opcoes.exigeRede
              ? "A rede social não confirmou a ação."
              : "Não deu para concluir a ação."),
        );
        if (r.incerto !== true) return;
        // Na dúvida, a caixa de resposta fecha: o texto continua no campo seria um
        // convite a mandar de novo.
        setAberto(false);
        return;
      }
      opcoes.aoDarCerto?.();
    } catch (e) {
      const corpo = (e as { data?: { message?: string } }).data?.message;
      setAviso(corpo ?? "Não deu para falar com a API agora.");
    }
  }

  async function pedirAoBlue() {
    setAviso(null);
    try {
      const r = await pedirRascunho({ id: c.id }).unwrap();
      // SUBSTITUI o que estiver escrito: o rascunho é a resposta inteira, e concatenar
      // produziria duas respostas emendadas na frente do público.
      setTexto(r.texto);
      if (r.compliance?.nivel === "bloqueio") {
        setAviso(
          `O Blue escreveu algo que a régua do produto bloqueia (${r.compliance.bloqueios.join(", ")}). Reescreva antes de publicar.`,
        );
      }
    } catch (e) {
      const corpo = (e as { data?: { message?: string } }).data?.message;
      setAviso(corpo ?? "O Blue não respondeu agora.");
    }
  }

  return (
    <div className="mt-2.5 flex flex-col gap-2">
      {/* A pendência da rede vem ANTES dos botões: é o estado que decide se vale
          clicar de novo ou se alguém precisa entrar no aplicativo da Meta. */}
      {/*
        ENVIANDO vem antes de tudo, e substitui os botões.
        
        Enquanto a Meta não responde, oferecer "responder" de novo é oferecer o clique
        duplo, que na resposta pública publica a mesma frase duas vezes à vista de
        todos. O servidor recusa a segunda chamada de qualquer jeito, mas botão que
        existe para dar erro é botão que ensina a desconfiar da tela.
      */}
      {emCurso && (
        <p className="flex items-center gap-2 rounded-[12px] bg-info-bg px-2.5 py-2 text-[11.5px] leading-snug text-info-text">
          <Spinner size={13} />
          <span>
            {emCurso === "ocultar" ? "Ocultando" : "Publicando a resposta"} na rede. Pode
            seguir para o próximo, isto atualiza sozinho.
          </span>
        </p>
      )}

      {!emCurso && (c.rede_pendente || aviso) && (
        <p
          className={[
            "flex items-start gap-2 rounded-[12px] px-2.5 py-2 text-[11.5px] leading-snug",
            // Dúvida não é erro: fundo de informação, não de aviso. Pintar de alerta o
            // que talvez tenha dado certo empurra para a tentativa repetida.
            duvida ? "bg-info-bg text-info-text" : "bg-warn-bg text-warn-text",
          ].join(" ")}
        >
          {duvida ? (
            <HelpCircle className="mt-px size-3.5 flex-none" aria-hidden />
          ) : (
            <AlertTriangle className="mt-px size-3.5 flex-none" aria-hidden />
          )}
          <span>{aviso ?? c.rede_pendente_motivo ?? "A rede não confirmou a última ação."}</span>
        </p>
      )}

      {aberto && !emCurso && (
        <div className="flex flex-col gap-2">
          <Textarea
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            rows={3}
            placeholder="Resposta pública, em duas frases. O que for da conta da pessoa vai para o direto."
            aria-label="Resposta pública ao comentário"
          />
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant="secondary"
              onClick={pedirAoBlue}
              disabled={rascunhando.isLoading}
              title="Pedir um rascunho ao Blue. Ele não publica nada."
            >
              {rascunhando.isLoading ? (
                <Spinner size={14} />
              ) : (
                <img src={BLUE_AI_ICON_SRC} alt="" className="h-4 w-4" />
              )}
              Sugerir com o Blue
            </Button>
            <Button
              size="sm"
              onClick={() =>
                agir(() => responder({ id: c.id, texto: texto.trim() }).unwrap(), {
                  // `exigeRede: false` porque a rota agora ENFILEIRA: ela devolve
                  // `redeFeita: false` com `emCurso`, e ler isso como falha faria a
                  // tela desmentir um pedido que foi aceito.
                  exigeRede: false,
                  aoDarCerto: () => {
                    setTexto("");
                    setAberto(false);
                  },
                })
              }
              disabled={!texto.trim() || ocupado}
              loading={respondendo.isLoading}
            >
              Publicar resposta
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setAberto(false);
                setAviso(null);
              }}
            >
              Cancelar
            </Button>
          </div>
        </div>
      )}

      {!emCurso && (
      <div className="flex flex-wrap items-center gap-2">
        {podeResponder && !aberto && (
          <Button size="sm" variant="secondary" onClick={() => setAberto(true)}>
            <Reply className="size-3.5" aria-hidden />
            Responder
          </Button>
        )}
        {podeOcultar && c.estado !== "oculto" && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => agir(() => ocultar({ id: c.id }).unwrap(), { exigeRede: false })}
            disabled={ocupado}
            loading={ocultando.isLoading}
            title="Tira o comentário do ar na rede social"
          >
            <EyeOff className="size-3.5" aria-hidden />
            Ocultar
          </Button>
        )}
        {/*
          VIRAR CASO ESTÁ DESLIGADO POR ORA, e a razão é o que vem depois dele.

          Ele funciona: abre conversa e ticket na fila, com a fala do cliente dentro. O
          problema é o passo seguinte. A conversa nasce no Instagram, e a Meta ainda não
          libera a nossa mensagem privada (`(#3) Application does not have the
          capability`, enquanto a conta não é conectada pelo login do Instagram). Ou
          seja, o caso entra na fila de alguém que não consegue respondê-lo ali.

          Fila com caso que não anda é pior que não ter o botão: ela deixa de ser a
          lista do que falta fazer. Enquanto isso, o caminho é responder no próprio
          comentário e pedir que a pessoa chame no direct, que é ela quem inicia.

          O BOTÃO SÓ SOME DA TELA. A rota continua existindo, testada e no ar, e o link
          abaixo continua levando ao caso de quem já virou antes de isto ser desligado.
        */}
        {podeResponder && c.conversa_id && (
          <a
            href={`/atendeai/conversas?conversa=${c.conversa_id}`}
            className="inline-flex h-[30px] items-center gap-1.5 rounded-full px-3 text-[12px] font-medium text-brand-text hover:bg-fill-2"
          >
            <MessageSquarePlus className="size-3.5" aria-hidden />
            Abrir a conversa
          </a>
        )}
      </div>
      )}
    </div>
  );
}
