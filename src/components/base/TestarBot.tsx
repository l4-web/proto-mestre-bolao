import { useState } from "react";
import { Bot, RotateCcw, Send, UserRound } from "lucide-react";
import { Badge, Button, Input } from "@l4-web/ui";
import { useSimularBotMutation } from "../../features/atendimento/atendimento.api";
import type { TurnoBot } from "../../features/atendimento/tipos";

/**
 * Conversar com o bot sem WhatsApp.
 *
 * Existe porque a pergunta "o bot está bom?" não pode esperar a conta da Meta. O canal
 * é o último elo: classificar, decidir e escolher o texto acontecem antes dele, e são
 * justamente a parte que se erra.
 *
 * A tela mostra a conversa E o porquê, lado a lado. Sem o porquê, quem configura vê o
 * bot errar e não tem o que fazer com a informação: com o escore e os candidatos, o
 * erro vira uma frase para acrescentar na situação certa, que é a ação que arruma.
 *
 * Nada aqui é gravado. A simulação não cria conversa, atendimento nem mensagem, então
 * a fila do supervisor e o relatório do gestor não enxergam este teste.
 */
interface Fala {
  de: "cliente" | "bot";
  texto: string;
  turno?: TurnoBot;
}

export function TestarBot({ produto }: { produto: string }) {
  const [simular, { isLoading }] = useSimularBotMutation();
  const [conversa, setConversa] = useState<Fala[]>([]);
  const [texto, setTexto] = useState("");
  const [estado, setEstado] = useState<TurnoBot["estado"] | undefined>();
  const [erro, setErro] = useState<string | null>(null);

  /**
   * `escolhaId` vai junto quando a mensagem saiu de um BOTAO.
   *
   * O texto continua sendo o numero, porque e o que a pessoa manda no WhatsApp e a
   * transcricao precisa parecer com a real. Mas casar por posicao depende de a lista
   * ter chegado na mesma ordem, e a ordem vem de um escore: o slug diz QUAL cenario
   * foi tocado, nao em que lugar ele estava.
   */
  async function mandar(mensagem: string, escolhaId?: string) {
    const limpo = mensagem.trim();
    if (!limpo) return;
    setErro(null);
    setTexto("");
    setConversa((c) => [...c, { de: "cliente", texto: limpo }]);
    try {
      const turno = await simular({ produto, texto: limpo, estado, escolhaId }).unwrap();
      setEstado(turno.estado);
      setConversa((c) => [...c, { de: "bot", texto: turno.fala, turno }]);
    } catch (e) {
      const corpo = (e as { data?: { message?: string | string[] } }).data;
      const msg = Array.isArray(corpo?.message) ? corpo?.message[0] : corpo?.message;
      setErro(msg ?? "Não deu para simular agora.");
    }
  }

  function recomecar() {
    setConversa([]);
    setEstado(undefined);
    setErro(null);
  }

  return (
    <div className="overflow-hidden rounded-[20px] border-[0.5px] border-border-muted bg-surface shadow-[var(--l4-sh-rest)]">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b-[0.5px] border-border-muted px-3.5 py-2.5">
        <div className="flex min-w-0 flex-col">
          <span className="text-[12.5px] font-medium text-text-strong">Testar o bot</span>
          <span className="text-[11px] text-text-muted">
            Escreva como o cliente escreveria. Nada aqui é gravado nem entra na fila.
          </span>
        </div>
        {conversa.length > 0 && (
          <Button size="sm" variant="ghost" onClick={recomecar}>
            <RotateCcw className="size-3.5" aria-hidden />
            Começar de novo
          </Button>
        )}
      </div>

      <div className="flex flex-col gap-2 px-3.5 py-3">
        {conversa.length === 0 ? (
          <div className="flex flex-col gap-2 py-2">
            <p className="text-[12px] text-text-secondary">
              Comece por uma dessas, ou escreva a sua:
            </p>
            <div className="flex flex-wrap gap-1.5">
              {SUGESTOES.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => void mandar(s)}
                  className="l4-pressable rounded-full bg-[var(--l4-fill-4)] px-2.5 py-1 text-[11.5px] text-text-strong"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          conversa.map((f, i) => (
            <div key={i} className="flex flex-col gap-1">
              <div className={f.de === "cliente" ? "flex justify-end" : "flex justify-start"}>
                <span
                  className={[
                    "max-w-[80%] rounded-[16px] px-3 py-2 text-[12.5px] leading-relaxed",
                    f.de === "cliente"
                      ? "bg-brand-primary text-white"
                      : "bg-[var(--l4-fill-4)] text-text-strong",
                  ].join(" ")}
                >
                  {f.texto}
                </span>
              </div>

              {f.turno && <PorQue turno={f.turno} onEscolher={(t, slug) => void mandar(t, slug)} />}
            </div>
          ))
        )}

        {erro && (
          <p role="alert" className="rounded-[12px] bg-error-bg px-3 py-2 text-[11.5px] text-error-text">
            {erro}
          </p>
        )}

        <div className="mt-1 flex items-center gap-2">
          <Input
            value={texto}
            placeholder="paguei o pix e não recebi nada"
            onChange={(e) => {
              const v = e.currentTarget.value;
              setTexto(v);
            }}
            onKeyDown={(e) => {
              if (e.key !== "Enter") return;
              e.preventDefault();
              void mandar(texto);
            }}
          />
          <Button size="sm" variant="filled" loading={isLoading} onClick={() => void mandar(texto)}>
            <Send className="size-3.5" aria-hidden />
            Enviar
          </Button>
        </div>
      </div>
    </div>
  );
}

/**
 * O bastidor do turno.
 *
 * Fica junto da fala do bot e não numa aba separada: a pergunta "por que ele respondeu
 * isso?" nasce no instante em que se lê a resposta, e separar as duas coisas obriga a
 * guardar a dúvida na cabeça enquanto procura.
 */
function PorQue({
  turno,
  onEscolher,
}: {
  turno: TurnoBot;
  onEscolher: (texto: string, escolhaId?: string) => void;
}) {
  const d = turno.diagnostico;
  const r = turno.regua;
  return (
    <div className="ml-1 flex flex-col gap-1.5 border-l-2 border-[var(--l4-fill-3)] pl-2.5">
      {/*
        O QUE A RÉGUA DE COMPLIANCE FARIA com esta fala.
        A caixa mostrava o texto e não que a régua o barraria: quem testava concluía
        que o cenário estava pronto e, no atendimento real, o cliente ficava sem
        resposta. Aconteceu com o artigo do app antigo, que termina em "onde prefere
        jogar" e bate em `jogar` nos termos de revisão.
        Só aparece quando NÃO está ok: um selo verde a cada teste vira ruído e ensina
        a ignorar o aviso justamente quando ele importa.
      */}
      {r && r.nivel !== "ok" && (
        <div className="rounded-[10px] bg-warn-bg px-2.5 py-2">
          <p className="text-[11.5px] leading-snug text-text-strong">
            <b>
              {r.nivel === "bloqueado"
                ? "A régua BLOQUEIA esta resposta."
                : "A régua manda revisar esta resposta."}
            </b>{" "}
            No atendimento real o bot não envia este texto: ele encaminha para uma pessoa.
          </p>
          {(r.bloqueios.length > 0 || r.revisar.length > 0) && (
            <p className="mt-1 text-[11px] leading-snug text-text-secondary">
              Por causa de{" "}
              {[...r.bloqueios, ...r.revisar].map((t) => `"${t}"`).join(", ")}. Reescreva o
              texto sem esses termos para o bot poder responder sozinho.
            </p>
          )}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-1.5">
        {turno.escalar ? (
          <Badge variant="info" size="xs">
            <UserRound className="size-2.5" aria-hidden /> chamou uma pessoa
          </Badge>
        ) : (
          <Badge variant="success" size="xs">
            <Bot className="size-2.5" aria-hidden /> respondeu sozinho
          </Badge>
        )}
        {d.decisao === "ambiguo" && (
          <Badge variant="warn" size="xs">
            ficou em dúvida
          </Badge>
        )}
        {d.decisao === "sem_ideia" && (
          <Badge variant="warn" size="xs">
            não entendeu
          </Badge>
        )}
        {/*
          Este selo é o que liga a simulação à tela de configuração: o bot escalou não
          porque a situação pede humano, mas porque ninguém escreveu a resposta.
        */}
        {d.semResposta && (
          <Badge variant="error" size="xs">
            escalou por falta de resposta
          </Badge>
        )}
      </div>

      {d.escolhido && (
        <p className="text-[11px] leading-snug text-text-secondary">
          Entendeu como <b className="text-text-strong">{d.escolhido.cenario}</b>{" "}
          <span className="font-mono text-[10px] text-text-muted">
            ({d.escolhido.escore})
          </span>
          {d.artigo && (
            <>
              {" "}
              e respondeu com <span className="font-mono text-[10px]">{d.artigo}</span>
            </>
          )}
        </p>
      )}

      {turno.opcoes?.length ? (
        <div className="flex flex-wrap gap-1">
          {turno.opcoes.map((o, i) => (
            <button
              key={o.id}
              type="button"
              onClick={() => onEscolher(String(i + 1), o.slug)}
              className="l4-pressable rounded-full bg-[var(--l4-fill-4)] px-2 py-0.5 text-[11px] text-text-strong"
            >
              {i + 1}. {o.cenario}
            </button>
          ))}
        </div>
      ) : d.candidatos?.length ? (
        <p className="text-[10.5px] leading-snug text-text-muted">
          Chegou perto de: {d.candidatos.map((c) => `${c.cenario} (${c.escore})`).join(", ")}
        </p>
      ) : null}
    </div>
  );
}

/**
 * As sugestões são os casos GRAVES, não os fáceis.
 *
 * Quem abre esta caixa quer saber se o bot aguenta o que dói: Pix sem cupom, saldo
 * sumido, pedido de LGPD. Sugerir "bom dia" faria a ferramenta parecer boa sem provar
 * nada.
 */
const SUGESTOES = [
  "paguei o pix e nao recebi nada",
  "meu dinheiro sumiu da carteira",
  "quero excluir meus dados da base de voces",
  "quanto tempo demora pro saque cair",
  "o app fica girando e nao abre",
];
