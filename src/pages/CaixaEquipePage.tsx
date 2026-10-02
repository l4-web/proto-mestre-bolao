import { useEffect, useState } from "react";
import {
  ChevronLeft,
  CreditCard,
  Hand,
  Inbox,
  Lock,
  Undo2,
  Wrench,
} from "lucide-react";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Eyebrow,
  Modal,
  ModalActions,
  ModalBody,
  ModalContent,
  ModalHead,
  PageContainer,
  PageHeader,
  PageLoading,
  Tabs,
  Textarea,
} from "@l4-web/ui";
import {
  useEquipeQuery,
  usePegarEncaminhamentoMutation,
  useResponderEncaminhamentoMutation,
  useSoltarEncaminhamentoMutation,
} from "../features/atendimento/atendimento.api";
import { LinhaBlue } from "../components/comum/LinhaBlue";
import { Vazio } from "../components/comum/Vazio";
import {
  CORES_GRAVIDADE,
  ROTULO_GRAVIDADE,
  dataHora,
  prazo,
} from "../components/conversa/util";
import { ALTURA_COLUNA, useGradeDeTrabalho } from "../lib/useGradeTrabalho";
import { plural } from "../lib/plural";

const ROTULO_ESTADO: Record<
  string,
  { texto: string; cor: "error" | "warn" | "info" | "success" }
> = {
  aberto: { texto: "Aberto", cor: "error" },
  em_analise: { texto: "Em análise", cor: "warn" },
  devolvido: { texto: "Devolvido ao CX", cor: "info" },
  resolvido: { texto: "Resolvido", cor: "success" },
};

/** As quatro pilhas da caixa. Ver o comentário de `PILHAS`. */
type Pilha = "pegar" | "meus" | "time" | "respondidos";

/**
 * A CAIXA É UMA FILA, e por isso ela é lida em pilhas e não como uma lista só.
 *
 * O usuário encaminhou um caso para a caixa técnica e mediu que nada acontecia dos
 * dois lados. Metade do conserto é da API (avisar a equipe, tirar a conversa da fila
 * de quem encaminhou); esta metade é a tela dizer o que fazer agora: o que está solto
 * para alguém pegar, o que é meu, o que um colega já pegou, e o que já foi respondido.
 *
 * "Com o time" existe porque sem ele a caixa mentiria: item pego por um colega sumiria
 * das outras três pilhas, e uma caixa que esconde trabalho em andamento é pior do que o
 * mural que ela era antes.
 *
 * O protótipo pedia um cluster `Aberto` / `Em análise`. Ele virou isto: com a
 * reivindicação, "em análise" é consequência de alguém ter pegado o item, não uma
 * escolha à parte. Um controle que troca o estado à mão ao lado de um botão que já o
 * troca seria a mesma coisa duas vezes, e as duas discordariam.
 */
const PILHAS: { id: Pilha; label: string; titulo: string; vazio: string }[] = [
  {
    id: "pegar",
    label: "Para pegar",
    titulo: "Nada solto",
    vazio: "Todo caso desta caixa já tem alguém.",
  },
  {
    id: "meus",
    label: "Meus",
    titulo: "Você não pegou nenhum",
    vazio: "Pegue um caso em Para pegar e ele aparece aqui.",
  },
  {
    id: "time",
    label: "Com o time",
    titulo: "Ninguém pegou nada",
    vazio: "Os casos que seus colegas pegaram aparecem aqui.",
  },
  {
    id: "respondidos",
    label: "Respondidos",
    titulo: "Nada respondido",
    vazio: "O que a equipe devolver ou resolver fica registrado aqui.",
  },
];

/** Item que ainda espera a equipe. Os outros dois estados são história. */
function emAberto(estado: string): boolean {
  return estado === "aberto" || estado === "em_analise";
}

/**
 * A equipe RESPONDE o caso: devolve ao CX ou marca resolvido.
 *
 * A resposta é obrigatória nas duas saídas, e a API exige o mesmo: devolver sem
 * dizer o que foi apurado obriga o CX a perguntar de novo, e o cliente espera duas
 * rodadas por isso.
 *
 * A ESCOLHA ENTRE AS DUAS SAÍDAS saiu do modal e virou o par de botões do rodapé do
 * caso, como no protótipo. Dentro do modal ela era um segmentado que repetia, em
 * outro desenho, a decisão que a pessoa já tinha tomado ao clicar: ela abria o modal
 * por "Devolver ao CX" e tinha que escolher "Devolver ao CX" de novo.
 */
function ModalResponder({
  aberto,
  caso,
  estado,
  salvando,
  erro,
  onFechar,
  onConfirmar,
}: {
  aberto: boolean;
  caso?: { ref: string; titulo: string };
  estado: "devolvido" | "resolvido";
  salvando?: boolean;
  erro?: string | null;
  onFechar: () => void;
  onConfirmar: (resposta: string) => void;
}) {
  const [resposta, setResposta] = useState("");

  // Abrir zera: sem isto o texto apurado de um caso reaparece no formulário do
  // próximo, e o caso seguinte recebe a conclusão do anterior.
  useEffect(() => {
    if (aberto) setResposta("");
  }, [aberto]);

  return (
    <Modal open={aberto} onOpenChange={(v) => !v && onFechar()}>
      <ModalContent size="md">
        <ModalHead
          eyebrow={caso?.ref}
          title={
            estado === "devolvido"
              ? "Devolver ao CX: o que foi apurado?"
              : "Marcar resolvido: o que foi apurado?"
          }
          description={
            estado === "devolvido"
              ? "O texto vira nota do caso e avisa quem encaminhou. O caso continua vivo no CX, que é quem fala com o cliente."
              : "O texto vira nota do caso e avisa quem encaminhou. A participação da equipe termina aqui."
          }
        />
        <ModalBody>
          <Textarea
            rows={5}
            value={resposta}
            onChange={(e) => setResposta(e.currentTarget.value)}
            placeholder="O que foi apurado, e o que o CX deve dizer ao cliente"
          />
          {erro && (
            <p
              role="alert"
              className="mt-2 rounded-[12px] border-[0.5px] border-error-border bg-error-bg px-3 py-2 text-[11.5px] leading-relaxed text-error-text"
            >
              {erro}
            </p>
          )}
        </ModalBody>
        <ModalActions
          cancelar={{ onClick: onFechar }}
          primaria={{
            label: estado === "devolvido" ? "Devolver ao CX" : "Marcar resolvido",
            // Três caracteres é o piso da API. Travar aqui evita a pessoa
            // escrever, enviar e descobrir a regra por um 400.
            disabled: resposta.trim().length < 3,
            loading: salvando,
            onClick: () => onConfirmar(resposta.trim()),
          }}
        />
      </ModalContent>
    </Modal>
  );
}

/** Uma linha de dado, no formato chave e valor da coleta e do contexto. */
function Dado({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 rounded-[12px] bg-[var(--l4-fill-5)] px-2.5 py-2">
      <span className="flex-none text-[11.5px] text-text-secondary">
        {rotulo}
      </span>
      <span
        className={[
          "min-w-0 text-right text-[12.5px] font-medium",
          // "sem resposta" é o que o CX escreve quando o cliente não respondeu a
          // coleta, e é a linha que decide se dá para investigar: ela não pode ler
          // igual às outras.
          valor.includes("sem resposta") ? "text-error-text" : "text-text-strong",
        ].join(" ")}
      >
        {valor}
      </span>
    </div>
  );
}

/**
 * A caixa de uma equipe interna, no MESMO esqueleto da tela de Conversas: lista à
 * esquerda, o caso aberto no meio, contexto à direita, e uma coluna por vez no
 * celular. É o pedido do usuário com essas palavras ("o mesmo padrão de layout do
 * atendimento"), e a geometria vem de `useGradeDeTrabalho` para as duas telas não
 * divergirem na primeira correção.
 *
 * O que NÃO se copia da tela de Conversas: aqui não há composer de WhatsApp nem
 * janela de 24h. Quem fala com o cliente é o CX, e a equipe interna trabalha o caso.
 * O lugar da thread é ocupado pela COLETA, que é o que faz a tela ter utilidade: o
 * dev abre e já tem aparelho, versão do app e passos para reproduzir, sem precisar
 * ler a conversa.
 *
 * A diferença que importa vem da API: quem não tem `contato.pessoais` recebe
 * `contato: null`, `trabalhaPorReferencia: true`, a coleta sem as chaves de dado
 * pessoal e as notas como CONTAGEM em vez de texto. É o que faz o Dev trabalhar por
 * `ATD-0000`: minimização de dado (LGPD art. 6º), imposta na serialização e não aqui.
 */
function Caixa({
  equipe,
  titulo,
  icone,
}: {
  equipe: "dev" | "pagamentos";
  titulo: string;
  icone: typeof Wrench;
}) {
  const { data: casos, isLoading, isFetching } = useEquipeQuery({ equipe });
  const [pilha, setPilha] = useState<Pilha>("pegar");
  const [selecionado, setSelecionado] = useState<string | null>(null);
  const [respondendo, setRespondendo] = useState<
    "devolvido" | "resolvido" | null
  >(null);
  const [erro, setErro] = useState<string | null>(null);
  const [responder, { isLoading: salvando }] =
    useResponderEncaminhamentoMutation();
  const [pegar, { isLoading: pegando }] = usePegarEncaminhamentoMutation();
  const [soltar, { isLoading: soltando }] = useSoltarEncaminhamentoMutation();

  const lista = casos ?? [];
  const naFila = lista.filter((c) => emAberto(c.estado));
  const porPilha: Record<Pilha, typeof lista> = {
    pegar: naFila.filter((c) => !c.responsavel),
    meus: naFila.filter((c) => c.meu),
    time: naFila.filter((c) => c.responsavel && !c.meu),
    respondidos: lista.filter((c) => !emAberto(c.estado)),
  };
  const visiveis = porPilha[pilha];
  /**
   * A seleção vive DENTRO da pilha visível.
   *
   * Sem procurar em `visiveis`, trocar de pilha deixava aberto no meio um caso que a
   * lista da esquerda não mostra mais: a tela exibia um caso que ninguém conseguia
   * apontar, e os botões de ação agiam sobre ele.
   *
   * No celular a seleção precisa ser NULA de início, senão a tela abre direto no
   * primeiro caso e a lista fica escondida atrás de um voltar que a pessoa não pediu.
   */
  const grade = useGradeDeTrabalho({
    temSelecao: Boolean(selecionado),
    // O contexto existe sempre que há caso a mostrar, e no desktop o caso é o
    // primeiro da lista mesmo sem ninguém ter clicado: por `selecionado` a grade
    // ficaria em duas colunas e a terceira entraria numa faixa que não existe.
    temContexto: visiveis.length > 0,
  });
  const escolhido = visiveis.find((c) => c.id === selecionado);
  const aberto = grade.umaColunaSo ? escolhido : (escolhido ?? visiveis[0]);

  const notas = aberto && Array.isArray(aberto.notas) ? aberto.notas : [];
  const notasOcultas =
    aberto && !Array.isArray(aberto.notas) ? aberto.notas.total : null;

  const abas = PILHAS.map((p) => ({
    id: p.id,
    label: p.label,
    badge: porPilha[p.id].length || undefined,
  }));

  const trocarPilha = (id: Pilha) => {
    setPilha(id);
    // A seleção é por pilha: manter o id de outra abriria o meio num caso que a lista
    // ao lado não lista.
    setSelecionado(null);
    setErro(null);
  };

  /**
   * As três ações chamam `.unwrap()`, que LANÇA.
   *
   * Sem este `catch` a rejeição morre em silêncio e o efeito é o pior possível para
   * quem usa: o botão não dá sinal e clicar de novo repete o nada. A API responde
   * frase pronta e em português ("Alguém da equipe pegou este caso agora mesmo."), e é
   * exatamente ela que a tela precisa mostrar.
   */
  const agir = async (acao: () => Promise<unknown>) => {
    setErro(null);
    try {
      await acao();
    } catch (e) {
      const corpo = (e as { data?: { message?: string | string[] } }).data;
      const msg = Array.isArray(corpo?.message)
        ? corpo?.message[0]
        : corpo?.message;
      setErro(msg ?? "Não deu para concluir. Tente de novo.");
    }
  };

  if (isLoading)
    return <PageLoading label={`Carregando a ${titulo.toLowerCase()}`} />;

  const p = aberto ? prazo(aberto.slaComercial) : null;
  const pilhaAtual = PILHAS.find((x) => x.id === pilha);

  return (
    <PageContainer>
      <PageHeader
        title={titulo}
        subtitle={
          <LinhaBlue>
            {naFila.length === 0 ? (
              <>Nada em aberto nesta caixa agora.</>
            ) : (
              <>
                <b>{plural(naFila.length, "caso", "casos")}</b> esperando esta
                equipe
                {porPilha.pegar.length > 0 ? (
                  <>
                    , <b>{porPilha.pegar.length} sem ninguém</b>
                  </>
                ) : null}
                .
                {(() => {
                  const versoes = new Set(
                    lista
                      .map((c) => c.coleta?.["Versão do app"])
                      .filter((v): v is string => Boolean(v)),
                  );
                  return versoes.size === 1 && naFila.length > 1 ? (
                    <>
                      {" "}
                      Todos citam a <b>mesma versão do app</b> (
                      {[...versoes][0]}): vale olhar como um só antes de abrir
                      correções separadas.
                    </>
                  ) : null;
                })()}
              </>
            )}
          </LinhaBlue>
        }
        busy={isFetching}
        /**
         * A PILHA é a navegação da caixa, e fica na faixa do título como a visão na
         * tela de Conversas: ali ela sobrevive à rolagem, sob o vidro da barra fixa.
         * `hidden md:flex` porque em 375px sobram uns 171px para as ferramentas, e
         * quatro abas ali ficam cortadas: no celular elas ganham a faixa própria
         * logo abaixo, igual ao inbox.
         */
        tools={
          <span className="hidden md:flex">
            <Tabs tabs={abas} activeTab={pilha} onChange={trocarPilha} />
          </span>
        }
      />

      <div className="min-w-0 overflow-x-auto md:hidden">
        <Tabs tabs={abas} activeTab={pilha} onChange={trocarPilha} />
      </div>

      <div
        ref={grade.ref}
        className="grid items-start gap-3"
        style={{ gridTemplateColumns: grade.colunas }}
      >
        {grade.mostrarLista && (
          <section
            aria-label={`Fila da ${titulo.toLowerCase()}`}
            style={{ height: ALTURA_COLUNA }}
            className="flex flex-col gap-1 overflow-y-auto rounded-[20px] border-[0.5px] border-border-muted bg-surface p-2 shadow-[var(--l4-sh-rest)]"
          >
            {visiveis.length === 0 ? (
              <Vazio
                icone={icone}
                titulo={
                  lista.length === 0
                    ? "Nada encaminhado"
                    : (pilhaAtual?.titulo ?? "Nada aqui")
                }
                descricao={
                  lista.length === 0
                    ? "Os casos que o CX manda para esta equipe aparecem aqui."
                    : pilhaAtual?.vazio
                }
              />
            ) : (
              visiveis.map((c) => {
                const e = ROTULO_ESTADO[c.estado] ?? {
                  texto: c.estado,
                  cor: "info" as const,
                };
                const pc = prazo(c.slaComercial);
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => {
                      setSelecionado(c.id);
                      setErro(null);
                    }}
                    aria-current={aberto?.id === c.id ? "true" : undefined}
                    title={`${c.ref} · ${c.titulo}`}
                    className={[
                      "flex flex-col gap-1 rounded-[14px] px-2.5 py-2 text-left transition-colors",
                      aberto?.id === c.id
                        ? "bg-[var(--l4-fill-3)]"
                        : "hover:bg-[var(--l4-fill-4)]",
                    ].join(" ")}
                  >
                    <span className="flex items-center gap-2">
                      <span className="font-mono text-[11.5px] font-medium text-text-strong">
                        {c.ref}
                      </span>
                      <Badge size="xs" variant={e.cor}>
                        {e.texto}
                      </Badge>
                      {/*
                        Quem está com o item, na LINHA e não só no painel: a pergunta
                        "isso já é de alguém?" precisa de resposta antes de clicar,
                        senão a pilha volta a ser o mural de antes.
                      */}
                      {c.meu ? (
                        <Badge size="xs" variant="success">
                          Meu
                        </Badge>
                      ) : c.responsavel ? (
                        <Badge size="xs" variant="neutral">
                          {c.responsavel}
                        </Badge>
                      ) : null}
                    </span>
                    <span className="line-clamp-2 text-[12.5px] font-medium leading-snug text-text-strong">
                      {c.titulo}
                    </span>
                    <span className="flex items-baseline gap-1.5 text-[10.5px]">
                      <Badge
                        size="xs"
                        variant={CORES_GRAVIDADE[c.gravidade as "critico"]}
                      >
                        {ROTULO_GRAVIDADE[c.gravidade as "critico"]}
                      </Badge>
                      {pc && (
                        <span
                          className={
                            pc.estourado
                              ? "font-semibold text-error-text"
                              : "text-text-secondary"
                          }
                        >
                          {pc.texto}
                        </span>
                      )}
                    </span>
                  </button>
                );
              })
            )}
          </section>
        )}

        {grade.mostrarItem &&
          (!aberto ? (
            <EmptyState
              className="flex min-h-[280px] flex-col justify-center"
              icon={Inbox}
              title="Escolha um caso"
              description="A coleta, os comentários internos e o prazo aparecem aqui."
            />
          ) : (
            <section
              aria-label="Caso encaminhado"
              style={{ height: ALTURA_COLUNA }}
              className="relative flex min-w-0 flex-col rounded-[20px] border-[0.5px] border-border-muted bg-surface shadow-[var(--l4-sh-rest)]"
            >
              {/*
                Cabeçalho `sticky` DENTRO do rolador, e não irmão dele com padding
                compensando: é a mesma armadilha que a thread já pagou, onde o
                cabeçalho absoluto cobria o primeiro bloco quando crescia.
              */}
              <div className="flex flex-1 flex-col overflow-y-auto">
                <div className="sticky top-0 z-10 flex items-start gap-2 border-b-[0.5px] border-border-muted bg-surface/95 px-4 py-3 backdrop-blur">
                  {/*
                    Voltar só quando a lista não está na tela: com as duas colunas
                    visíveis, um botão de voltar não volta para lugar nenhum.
                  */}
                  {grade.umaColunaSo && (
                    <button
                      type="button"
                      aria-label="Voltar para a fila"
                      onClick={() => setSelecionado(null)}
                      className="-ml-1 mt-0.5 flex-none rounded-full p-1 text-text-secondary transition-colors hover:bg-[var(--l4-fill-4)]"
                    >
                      <ChevronLeft className="size-4" aria-hidden />
                    </button>
                  )}
                  <div className="min-w-0 flex-1">
                    <h2 className="truncate text-[15px] font-semibold tracking-[-0.01em] text-text-strong">
                      {aberto.titulo}
                    </h2>
                    <p className="mt-0.5 text-[11.5px] text-text-secondary">
                      <span className="font-mono">{aberto.ref}</span> · aberto{" "}
                      {dataHora(aberto.abertoEm)} por{" "}
                      {aberto.abertoPor ?? "alguém do CX"}
                    </p>
                  </div>
                  <Badge
                    size="sm"
                    variant={
                      (ROTULO_ESTADO[aberto.estado]?.cor ?? "info") as "info"
                    }
                  >
                    {ROTULO_ESTADO[aberto.estado]?.texto ?? aberto.estado}
                  </Badge>
                </div>

                <div className="flex flex-col gap-3 p-4">
                  {aberto.trabalhaPorReferencia && (
                    <div className="flex items-start gap-2.5 rounded-[16px] bg-info-bg px-3.5 py-2.5">
                      <Lock
                        className="mt-0.5 size-3.5 flex-none text-info-text"
                        aria-hidden
                      />
                      <p className="text-[12px] leading-relaxed text-text-strong">
                        Seu perfil trabalha por <b>referência do caso</b>. Nome,
                        CPF e telefone do cliente não são exibidos, e a coleta
                        chega sem eles. O caso é identificado por{" "}
                        <span className="font-mono">{aberto.ref}</span>.
                      </p>
                    </div>
                  )}

                  {/*
                    A COLETA É O CONTEÚDO PRINCIPAL, e ocupa o lugar que na tela de
                    Conversas é a thread. É ela que faz a caixa ter utilidade: o dev
                    abre e já tem aparelho, sistema, versão do app e os passos para
                    reproduzir, sem precisar ler a conversa do cliente.
                  */}
                  <div>
                    <div className="flex items-center justify-between gap-2 pb-1.5">
                      <Eyebrow>Coleta</Eyebrow>
                      <span className="rounded-full bg-[var(--l4-fill-4)] px-1.5 py-px font-mono text-[9.5px] text-text-secondary">
                        {equipe === "dev" ? "APCAP VIP" : "iOn"}
                      </span>
                    </div>
                    {Object.keys(aberto.coleta ?? {}).length === 0 ? (
                      <p className="text-[11.5px] text-text-secondary">
                        Sem coleta registrada. Quem encaminhou não preencheu a
                        ficha, e sem ela a equipe trabalha no escuro.
                      </p>
                    ) : (
                      <div className="flex flex-col gap-px">
                        {Object.entries(aberto.coleta).map(([k, v]) => (
                          <Dado key={k} rotulo={k} valor={String(v)} />
                        ))}
                      </div>
                    )}
                  </div>

                  {/*
                    A RESPOSTA JÁ DADA, que não tinha onde aparecer.
                    Ela era gravada dentro da coleta (sobrescrevendo o que o CX
                    coletou) e a caixa não a mostrava: quem abrisse o caso depois via
                    "Devolvido ao CX" e nenhuma linha do que foi apurado.
                  */}
                  {aberto.resposta && (
                    <div>
                      <Eyebrow>Resposta da equipe</Eyebrow>
                      <p className="mt-1.5 whitespace-pre-wrap rounded-[12px] bg-[var(--l4-fill-5)] px-2.5 py-2 text-[12.5px] leading-relaxed text-text-strong">
                        {aberto.resposta}
                      </p>
                      <p className="mt-1 text-[10.5px] text-text-secondary">
                        {aberto.respondidoPor ?? "equipe"}
                        {aberto.respondidoEm
                          ? ` · ${dataHora(aberto.respondidoEm)}`
                          : ""}
                      </p>
                    </div>
                  )}

                  <div>
                    <Eyebrow>Comentários internos</Eyebrow>
                    {/*
                      A união É REAL: sem `contato.pessoais` a API devolve
                      `{ total, ocultas }` no lugar da lista, porque nota interna é
                      onde o atendente escreve nome e CPF por extenso. A tela fazia
                      `.map` nesse objeto, então a caixa técnica quebrava em branco
                      justamente para o papel `dev`, que é o único que a abre sem
                      permissão de dado pessoal.
                    */}
                    {notasOcultas !== null ? (
                      <p className="mt-2 text-[11.5px] leading-snug text-text-secondary">
                        {notasOcultas === 0
                          ? "Nenhum comentário."
                          : `${plural(notasOcultas, "comentário", "comentários")} no caso.`}{" "}
                        O texto não é exibido para o seu perfil: nota interna é onde
                        o CX escreve nome e CPF por extenso.
                      </p>
                    ) : notas.length === 0 ? (
                      <p className="mt-2 text-[11.5px] leading-snug text-text-secondary">
                        Nenhum comentário. O que for escrito aqui é interno: o
                        cliente não vê.
                      </p>
                    ) : (
                      <div className="mt-2 flex flex-col gap-2">
                        {notas.map((n) => (
                          <div
                            key={n.id}
                            className="rounded-[12px] bg-[var(--l4-fill-5)] px-2.5 py-2"
                          >
                            <div className="flex items-baseline justify-between gap-2">
                              <span className="text-[11.5px] font-semibold text-text-strong">
                                {n.autor}
                              </span>
                              <span className="text-[10.5px] tabular-nums text-text-secondary">
                                {dataHora(n.created_at)}
                              </span>
                            </div>
                            <p className="mt-0.5 whitespace-pre-wrap text-[12px] leading-snug text-text-strong">
                              {n.texto}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/*
                O RODAPÉ DE AÇÃO, fora do rolador, como no protótipo.

                Três situações e uma ação principal em cada uma. Solto: pegar, porque
                é o que destrava a fila. Meu: as duas saídas do protótipo, devolver ao
                CX (contorno) e marcar resolvido (preenchido), mais soltar de volta.
                De outra pessoa: só soltar, porque a API recusa responder por cima do
                trabalho alheio (duas conclusões diferentes voltariam ao CX e o cliente
                ouviria as duas).

                Caso já devolvido ou resolvido não tem rodapé: a participação da equipe
                acabou, e reabrir é ato do CX.
              */}
              {emAberto(aberto.estado) && (
                <div className="flex flex-none flex-wrap items-center gap-2 border-t-[0.5px] border-border-muted px-4 py-2.5">
                  <span className="min-w-0 flex-1 text-[11.5px] text-text-secondary">
                    {aberto.meu ? (
                      <>
                        <b className="text-text-strong">Você pegou este caso</b>
                        {aberto.pegoEm ? ` em ${dataHora(aberto.pegoEm)}` : ""}.
                      </>
                    ) : aberto.responsavel ? (
                      <>
                        Está com{" "}
                        <b className="text-text-strong">{aberto.responsavel}</b>
                        {aberto.pegoEm
                          ? ` desde ${dataHora(aberto.pegoEm)}`
                          : ""}
                        .
                      </>
                    ) : (
                      <>
                        <b className="text-text-strong">Ninguém pegou</b> este
                        caso ainda.
                      </>
                    )}
                  </span>

                  {!aberto.responsavel && (
                    <Button
                      size="sm"
                      variant="filled"
                      loading={pegando}
                      onClick={() =>
                        void agir(() =>
                          pegar({ equipe, id: aberto.id }).unwrap(),
                        )
                      }
                    >
                      <Hand className="size-3.5" aria-hidden />
                      Pegar
                    </Button>
                  )}

                  {aberto.responsavel && (
                    <Button
                      size="sm"
                      variant="plain"
                      loading={soltando}
                      title={
                        aberto.meu
                          ? "Devolve o caso para a caixa, sem dono."
                          : `Devolve para a caixa o caso que ${aberto.responsavel} pegou.`
                      }
                      onClick={() =>
                        void agir(() =>
                          soltar({ equipe, id: aberto.id }).unwrap(),
                        )
                      }
                    >
                      <Undo2 className="size-3.5" aria-hidden />
                      Soltar
                    </Button>
                  )}

                  {aberto.meu && (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setErro(null);
                          setRespondendo("devolvido");
                        }}
                      >
                        Devolver ao CX
                      </Button>
                      <Button
                        size="sm"
                        variant="filled"
                        onClick={() => {
                          setErro(null);
                          setRespondendo("resolvido");
                        }}
                      >
                        Marcar resolvido
                      </Button>
                    </>
                  )}
                </div>
              )}

              {erro && (
                <p
                  role="alert"
                  className="mx-4 mb-3 rounded-[12px] border-[0.5px] border-error-border bg-error-bg px-3 py-2 text-[11.5px] leading-relaxed text-error-text"
                >
                  {erro}
                </p>
              )}
            </section>
          ))}

        {/*
          A TERCEIRA COLUNA: prazo, gravidade e contato.

          É o que na tela de Conversas é o painel de contexto, e aqui ela existe pelo
          mesmo motivo: são os dados que a pessoa CONSULTA enquanto trabalha, e no meio
          da coluna do caso eles empurrariam a coleta para baixo da dobra.
        */}
        {grade.cabeContexto && aberto && (
          <aside
            aria-label="Contexto do caso"
            className="flex min-w-0 flex-col gap-3 overflow-y-auto"
            style={{ height: ALTURA_COLUNA }}
          >
            <Card className="p-4">
              <Eyebrow>Prazo</Eyebrow>
              <div className="mt-1.5 flex flex-col gap-px">
                <Dado
                  rotulo="Gravidade"
                  valor={ROTULO_GRAVIDADE[aberto.gravidade as "critico"]}
                />
                {aberto.motivo && (
                  <Dado rotulo="Motivo" valor={aberto.motivo} />
                )}
                {p && <Dado rotulo="SLA comercial" valor={p.texto} />}
              </div>
              {aberto.slaRegulatorio && (
                <p className="mt-2 rounded-[12px] bg-warn-bg px-2.5 py-2 text-[11.5px] font-semibold text-warn-text">
                  Prazo regulatório ({aberto.slaRegTipo}):{" "}
                  {dataHora(aberto.slaRegulatorio)}. Este relógio não pausa fora
                  do expediente.
                </p>
              )}
            </Card>

            {aberto.contato && (
              <Card className="p-4">
                <Eyebrow>Contato</Eyebrow>
                <div className="mt-1.5 flex flex-col gap-px">
                  <Dado
                    rotulo="Nome"
                    valor={aberto.contato.nome ?? "Não informado"}
                  />
                  <Dado
                    rotulo="CPF"
                    valor={aberto.contato.cpf_mascarado ?? "Não informado"}
                  />
                  <Dado
                    rotulo="Telefone"
                    valor={aberto.contato.telefone_mascarado ?? "Não informado"}
                  />
                </div>
              </Card>
            )}

            {aberto.demandaRef && (
              <Card className="p-4">
                <Eyebrow>Demanda</Eyebrow>
                <p className="mt-1.5 font-mono text-[12px] text-text-strong">
                  {aberto.demandaRef}
                </p>
              </Card>
            )}
          </aside>
        )}
      </div>

      <ModalResponder
        aberto={respondendo !== null}
        estado={respondendo ?? "devolvido"}
        caso={aberto ? { ref: aberto.ref, titulo: aberto.titulo } : undefined}
        salvando={salvando}
        erro={erro}
        onFechar={() => {
          setRespondendo(null);
          setErro(null);
        }}
        onConfirmar={async (resposta) => {
          if (!aberto || !respondendo) return;
          await agir(async () => {
            await responder({
              equipe,
              id: aberto.id,
              estado: respondendo,
              resposta,
            }).unwrap();
            setRespondendo(null);
          });
        }}
      />
    </PageContainer>
  );
}

export function CaixaTecnicaPage() {
  return <Caixa equipe="dev" titulo="Caixa técnica" icone={Wrench} />;
}

export function CaixaFinanceiraPage() {
  return (
    <Caixa equipe="pagamentos" titulo="Caixa financeira" icone={CreditCard} />
  );
}
