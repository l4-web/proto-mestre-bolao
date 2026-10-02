import { useEffect, useState } from "react";
import { AlertTriangle, MessageSquare, ShieldAlert } from "lucide-react";
import {
  Badge,
  Button,
  Card,
  ControleLinha,
  EmptyState,
  PageContainer,
  PageHeader,
  PageLoading,
  PainelControles,
  SegmentedControl,
  SelectPill,
} from "@l4-web/ui";
import {
  useComentarioTagsQuery,
  useComentariosQuery,
} from "../features/atendimento/atendimento.api";
import { dataHora } from "../components/conversa/util";
import { AcoesDoComentario } from "../components/escuta/AcoesDoComentario";
import { ThreadDoComentario } from "../components/escuta/ThreadDoComentario";
import { useAbility } from "../lib/ability";
import { useProduto } from "../lib/produto-contexto";
import { MODULE_ID } from "../nav";

const ROTULO_ORIGEM: Record<string, string> = {
  organico: "Orgânico",
  dark_post: "Dark post",
  impulsionado: "Impulsionado",
};

const COR_SENTIMENTO: Record<string, "error" | "warn" | "success" | "neutral"> =
  {
    negativo: "error",
    neutro: "neutral",
    positivo: "success",
    nao_classificado: "neutral",
  };

const ESTADOS = [
  { id: "", label: "Todos" },
  { id: "novo", label: "Novos" },
  { id: "respondido", label: "Respondidos" },
  { id: "oculto", label: "Ocultos" },
];

export function ComentariosPage() {
  const [estado, setEstado] = useState("");
  /**
   * A JANELA, que era fixa em 30 dias no servidor e invisível na tela.
   *
   * Com 1.094 comentários no banco, a lista mostrava 91 e não dizia por quê: quem
   * abria concluía que a escuta tinha 91 comentários. O período é a primeira pergunta
   * de quem olha reputação ("o que mudou este mês contra o trimestre"), então ele
   * mora na faixa do título, ao lado do estado, e não escondido no painel.
   */
  const [dias, setDias] = useState(30);
  /** Quantos itens pedir. O botão do rodapé sobe de 100 em 100, até o teto da API. */
  const [limite, setLimite] = useState(100);
  /**
   * Existe alguma ação a caminho da Meta nesta lista?
   *
   * Mora em estado e não é calculado direto de `comentarios` porque ele decide o
   * `pollingInterval` da própria consulta que o produz: lê-lo ali seria usar o
   * resultado antes de existir. O efeito abaixo sincroniza os dois a cada resposta.
   */
  const [temEmVoo, setTemEmVoo] = useState(false);
  const [rede, setRede] = useState("");
  const [tema, setTema] = useState("");
  const [origem, setOrigem] = useState("");
  const [sentimento, setSentimento] = useState("");

  /**
   * As duas capacidades são DIFERENTES de propósito, e não uma só de "moderar".
   *
   * O atendente responde comentário e NÃO oculta: tirar do ar é ato de moderação, de
   * supervisor e de reputação. Juntar as duas num gate só daria a quem atende o poder
   * de sumir com uma reclamação pública.
   */
  const ability = useAbility();
  const { produto } = useProduto();
  const podeResponder =
    ability?.can(`${MODULE_ID}:social.responder`, "view", { default: false }) ??
    false;
  const podeOcultar =
    ability?.can(`${MODULE_ID}:social.ocultar`, "view", { default: false }) ??
    false;

  const {
    data: comentarios,
    isLoading,
    isFetching,
  } = useComentariosQuery(
    {
      dias,
      produto: produto || undefined,
      limite,
      rede: rede || undefined,
      tema: tema || undefined,
      estado: estado || undefined,
      origem: origem || undefined,
      sentimento: sentimento || undefined,
    },
    {
      /**
       * SÓ enquanto há ação a caminho da Meta.
       *
       * Moderar deixou de prender a tela: quem clica segue para o próximo e o card
       * fica "enviando" até a Meta responder, o que leva de 5 a 20 segundos. Alguém
       * precisa buscar esse desfecho, e mandar a pessoa recarregar a página seria
       * devolver a ela o trabalho que a fila existe para tirar.
       *
       * Fora disso o intervalo é ZERO, ou seja desligado: uma tela de reputação fica
       * aberta o dia inteiro, e buscar 100 comentários de cinco em cinco segundos sem
       * nada acontecendo é conta de Cloud Run paga para redesenhar o mesmo.
       */
      pollingInterval: temEmVoo ? 4000 : 0,
      skipPollingIfUnfocused: true,
    },
  );

  useEffect(() => {
    setTemEmVoo((comentarios ?? []).some((c) => c.acao_em_curso));
  }, [comentarios]);

  // O catálogo do filtro NÃO sai da lista filtrada: escolhida uma tag, a lista só
  // teria aquela e as outras opções sumiriam do seletor.
  const { data: tags } = useComentarioTagsQuery({ dias, produto: produto || undefined });

  if (isLoading) return <PageLoading label="Carregando os comentários" />;

  const lista = comentarios ?? [];
  const ativos =
    (rede ? 1 : 0) + (tema ? 1 : 0) + (origem ? 1 : 0) + (sentimento ? 1 : 0);

  return (
    <PageContainer>
      <PageHeader
        title="Comentários"
        
        busy={isFetching}
        /**
         * O recorte de estado vive na faixa do título, como nas outras telas.
         *
         * Ele estava dentro do `PainelControles`, e ali um segmentado que já traz
         * cápsula própria fica embrulhado numa segunda cápsula (a faixa larga que já
         * apareceu na tela de conversas). No cabeçalho ele também sobrevive à
         * rolagem, sob o vidro da barra fixa, que é onde a navegação da lista deve
         * ficar. Origem e sentimento seguem no painel, porque são filtro.
         */
        tools={
          <>
            <SelectPill
              value={String(dias)}
              onChange={(v) => {
                setDias(Number(v));
                // Trocar de período recomeça a contagem: manter um limite alto de uma
                // janela larga faria a janela curta rebuscar 500 linhas que não existem.
                setLimite(100);
              }}
              size="sm"
              minWidth={130}
              options={[
                { value: "7", label: "7 dias" },
                { value: "30", label: "30 dias" },
                { value: "90", label: "90 dias" },
                { value: "180", label: "6 meses" },
                { value: "365", label: "1 ano" },
              ]}
            />
            <SegmentedControl
              options={ESTADOS}
              value={estado}
              onChange={setEstado}
              size="sm"
            />
          </>
        }
      />

      {/* A régua do público é mais dura que a do privado, e isso precisa estar na
          tela de quem responde, não só no documento de compliance. */}
      <div className="flex items-start gap-2.5 rounded-[16px] bg-warn-bg px-3.5 py-2.5">
        <AlertTriangle
          className="mt-0.5 size-3.5 flex-none text-warn-text"
          aria-hidden
        />
        <p className="text-[12px] leading-relaxed text-text-strong">
          <b>Dado de pessoa nunca sai em público.</b> CPF, valor de prêmio,
          saldo ou confirmação de que alguém ganhou ficam bloqueados aqui, mesmo
          estando liberados no privado. Se o cliente expõe o próprio CPF no
          comentário, a resposta certa é levar para o privado, não confirmar.
        </p>
      </div>

      <PainelControles
        agrupamento="por-controle"
        ativos={ativos}
        descricao="Valem para a lista inteira."
        onLimpar={() => {
          setRede("");
          setTema("");
          setOrigem("");
          setSentimento("");
        }}
      >
        {/* A rede era só um selo no card: dava para ver que o comentário é do
            Instagram e não dava para ficar só com os do Instagram, que é a pergunta
            de quem cuida de uma conta por vez. */}
        <ControleLinha rotulo="Rede" apenasNoPainel>
          <SelectPill
            value={rede}
            onChange={setRede}
            size="sm"
            minWidth={140}
            options={[
              { value: "", label: "Toda rede" },
              { value: "instagram", label: "Instagram" },
              { value: "facebook", label: "Facebook" },
            ]}
          />
        </ControleLinha>
        {/* A tag já aparecia embaixo de cada comentário e não dava para recortar por
            ela, que é o caminho de "o que estão falando sobre saque". O volume vai no
            rótulo porque escolher tag sem saber o tamanho dela é escolher no escuro. */}
        <ControleLinha rotulo="Tag" apenasNoPainel>
          <SelectPill
            value={tema}
            onChange={setTema}
            size="sm"
            minWidth={190}
            options={[
              { value: "", label: "Toda tag" },
              ...(tags ?? []).map((t) => ({
                value: t.tema,
                label: `${t.label} (${t.comentarios})`,
              })),
            ]}
          />
        </ControleLinha>
        <ControleLinha rotulo="Origem" apenasNoPainel>
          <SelectPill
            value={origem}
            onChange={setOrigem}
            size="sm"
            minWidth={150}
            options={[
              { value: "", label: "Toda origem" },
              { value: "organico", label: "Orgânico" },
              { value: "dark_post", label: "Dark post" },
              { value: "impulsionado", label: "Impulsionado" },
            ]}
          />
        </ControleLinha>
        <ControleLinha rotulo="Sentimento" apenasNoPainel>
          <SelectPill
            value={sentimento}
            onChange={setSentimento}
            size="sm"
            minWidth={140}
            options={[
              { value: "", label: "Todo sentimento" },
              { value: "negativo", label: "Negativo" },
              { value: "neutro", label: "Neutro" },
              { value: "positivo", label: "Positivo" },
            ]}
          />
        </ControleLinha>
      </PainelControles>

      {lista.length === 0 ? (
        <EmptyState
          icon={MessageSquare}
          title="Nenhum comentário no recorte"
          description="Troque o estado ou limpe os filtros."
        />
      ) : (
        <div className="flex flex-col gap-2.5">
          {lista.map((c) => (
            <Card
              key={c.id}
              className={[
                "p-3.5",
                // Suspeita de golpe ganha aro, não fundo colorido: o texto do
                // comentário precisa continuar legível.
                c.suspeita_golpe ? "ring-1 ring-error-accent" : "",
              ].join(" ")}
            >
              <div className="flex flex-wrap items-center gap-1.5">
                <Badge size="xs" variant="neutral">
                  {c.rede === "instagram" ? "Instagram" : "Facebook"}
                </Badge>
                <Badge
                  size="xs"
                  variant={c.origem === "organico" ? "neutral" : "purple"}
                >
                  {ROTULO_ORIGEM[c.origem] ?? c.origem}
                </Badge>
                {c.campanha && (
                  <span
                    className="truncate text-[10.5px] text-text-secondary"
                    title="Peça paga: reclamação aqui é custo por aquisição subindo, não só reputação"
                  >
                    {c.campanha}
                  </span>
                )}
                <Badge
                  size="xs"
                  variant={COR_SENTIMENTO[c.sentimento] ?? "neutral"}
                >
                  {c.sentimento}
                </Badge>
                {c.suspeita_golpe && (
                  <Badge size="xs" variant="error">
                    Suspeita de golpe
                  </Badge>
                )}
                {/* Respondido SOZINHO não é o mesmo que respondido, e a tela precisa
                    dizer qual dos dois foi: "respondido" sobre um texto que ninguém
                    leu afirma uma conferência humana que não houve. */}
                {c.respondido_auto && (
                  <Badge size="xs" variant="purple">
                    Resposta automática
                  </Badge>
                )}
                <span className="ml-auto flex-none text-[10.5px] tabular-nums text-text-secondary">
                  {dataHora(c.publicado_em)}
                </span>
              </div>

              <p className="mt-2 text-[13.5px] leading-relaxed text-text-strong">
                {c.texto}
              </p>

              <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px] text-text-secondary">
                <span>{c.autor_handle ?? "autor não identificado"}</span>
                {c.temas.length > 0 && <span>· {c.temas.join(", ")}</span>}
                <span>· {c.estado}</span>
              </div>

              {c.suspeita_golpe && (
                <p className="mt-2 flex items-start gap-2 rounded-[12px] bg-error-bg px-2.5 py-2 text-[11.5px] leading-snug text-error-text">
                  <ShieldAlert
                    className="mt-px size-3.5 flex-none"
                    aria-hidden
                  />
                  <span>
                    Padrão de perfil falso oferecendo prêmio e pedindo taxa. É
                    problema de segurança, não de CX: ocultar e denunciar (hoje
                    pelo Gerenciador da Meta) vem antes de responder, e nunca
                    confirmar nem negar dado de ganhador em público.
                  </span>
                </p>
              )}

              <ThreadDoComentario respostas={c.respostas ?? []} />

              {(podeResponder || podeOcultar) && (
                <AcoesDoComentario
                  c={c}
                  podeResponder={podeResponder}
                  podeOcultar={podeOcultar}
                />
              )}
            </Card>
          ))}
        </div>
      )}

      {/*
        O botão só aparece quando a lista VEIO CHEIA, que é o único sinal de que pode
        haver mais: dizer "mostrar mais" numa lista que já acabou ensina a pessoa a
        clicar em botão que não faz nada.
      */}
      {lista.length >= limite && limite < 500 && (
        <div className="flex justify-center">
          <Button
            size="sm"
            variant="secondary"
            loading={isFetching}
            onClick={() => setLimite((n) => Math.min(n + 100, 500))}
          >
            Mostrar mais
          </Button>
        </div>
      )}
    </PageContainer>
  );
}
