import { useState } from "react";
import { AlertTriangle, CalendarRange, Pencil, Plus } from "lucide-react";
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
  useConfirm,
} from "@l4-web/ui";
import {
  useCriarEdicaoMutation,
  useDefinirEdicaoVigenteMutation,
  useEditarEdicaoMutation,
} from "../../features/atendimento/atendimento.api";
import type { Edicao } from "../../features/atendimento/tipos";
import { Barra } from "../comum/Barra";
import { plural } from "../../lib/plural";

/**
 * QUAL É A EDIÇÃO VIGENTE, e como se troca.
 *
 * ── Por que mora na Base, e não em Configurações ───────────────────────────────
 * Configurações é COMO o módulo opera (canal, alocação, compliance, expediente). A
 * edição é O QUE o bot diz: ela decide qual versão de resposta `por_edicao` (valor do
 * título, prazo do Pix, data do sorteio) o cliente ouve. Além disso a edição já é o
 * eixo do seletor no topo desta página, e a ação de trocar precisa estar ao lado do
 * recorte que ela muda, e não a duas telas de distância.
 *
 * ── Por que este cartão existe ────────────────────────────────────────────────
 * A API tinha as três rotas (criar, editar, definir vigente) desde sempre, e o front
 * só sabia LER. Não era "falta uma tela", era degradação agendada: no dia em que a
 * edição atual termina, todo artigo `por_edicao` para de ser respondido e o bot passa a
 * escalar caso que sabia resolver. O conserto dependia de alguém rodar script no banco
 * de produção.
 *
 * ── Por que a barra de prontidão está AQUI ────────────────────────────────────
 * Ela media a lista de artigos, que saiu da página. E é bem o lugar dela: prontidão é
 * propriedade DA EDIÇÃO ("quanto desta promoção já dá para responder"), não de uma
 * lista. Junto da identidade da edição, ela responde a pergunta inteira num cartão só.
 *
 * ── Por que trocar a vigente passa por confirmação ────────────────────────────
 * É a ação mais consequente da tela e a mais rara: o bot resolve a edição atual por
 * `vigente: true`, então trocar muda na hora o que o cliente ouve, e o que sobra sem
 * resposta publicada vira escalada. Um interruptor solto numa lista faria isso
 * acontecer por engano de clique. A confirmação diz o que muda, com o número: quantos
 * assuntos o bot vai passar a escalar.
 */
export function GestaoEdicoes({
  produto,
  edicoes,
  edicao,
  prontidao,
  podeGerenciar,
}: {
  produto: string;
  edicoes: Edicao[];
  /** A edição ESCOLHIDA no seletor da página, que é sobre a qual este cartão age. */
  edicao: Edicao | undefined;
  prontidao: { total: number; publicados: number; pendentesDeDefinicao: number } | undefined;
  podeGerenciar: boolean;
}) {
  const confirm = useConfirm();
  const [criar, { isLoading: criando }] = useCriarEdicaoMutation();
  const [editar, { isLoading: editando }] = useEditarEdicaoMutation();
  const [definirVigente, { isLoading: trocando }] = useDefinirEdicaoVigenteMutation();

  const [form, setForm] = useState<Form | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const vigente = edicoes.find((e) => e.vigente);
  const pct = prontidao && prontidao.total > 0 ? (prontidao.publicados / prontidao.total) * 100 : 0;
  const faltando = prontidao ? prontidao.total - prontidao.publicados : 0;

  async function salvar() {
    if (!form) return;
    setErro(null);
    try {
      if (form.id) {
        await editar({
          produto,
          id: form.id,
          nome: form.nome.trim(),
          inicio: form.inicio,
          // Campo vazio é "não mexi", e não "apague a data": `PATCH` com `fim: ""`
          // seria data inválida, e a API recusaria o salvamento inteiro por causa de um
          // campo que a pessoa nem tocou.
          ...(form.fim ? { fim: form.fim } : {}),
        }).unwrap();
      } else {
        await criar({
          produto,
          id_ion: form.id_ion.trim(),
          nome: form.nome.trim(),
          inicio: form.inicio,
          ...(form.fim ? { fim: form.fim } : {}),
        }).unwrap();
      }
      setForm(null);
    } catch (e) {
      setErro(mensagem(e) ?? "Não deu para salvar a edição.");
    }
  }

  async function porNoAr() {
    if (!edicao) return;
    await confirm({
      title: `Colocar "${edicao.nome}" no ar?`,
      description: (
        <span className="flex flex-col gap-1.5">
          <span>
            O bot passa a responder pela {edicao.nome} imediatamente.
            {vigente
              ? ` A ${vigente.nome} sai do ar e continua guardada como histórico: quem comprou nela tem direito à regra dela.`
              : " Este produto não tem edição no ar hoje."}
          </span>
          {prontidao && prontidao.total > 0 && faltando > 0 ? (
            <span className="text-warn-text">
              {plural(faltando, "resposta", "respostas")} por edição de {prontidao.total} ainda
              sem publicação na {edicao.nome}: o bot vai ESCALAR esses assuntos até alguém
              publicar.
            </span>
          ) : prontidao && prontidao.total > 0 ? (
            <span className="text-success-text">
              As {prontidao.total} respostas por edição já estão publicadas nesta edição.
            </span>
          ) : null}
        </span>
      ),
      confirmLabel: "Colocar no ar",
      // Não é `danger`: trocar a edição na virada é o caminho NORMAL do produto, e
      // pintar de vermelho a única coisa que mantém o bot correto ensina a hesitar na
      // hora errada. O que segura o clique acidental é a confirmação com o número.
      onConfirm: async () => {
        try {
          await definirVigente({ produto, id: edicao.id }).unwrap();
        } catch (e) {
          // O erro sobe para o diálogo, que o mostra inline e fica aberto para nova
          // tentativa, em vez de fechar como se tivesse dado certo.
          throw new Error(mensagem(e) ?? "Não deu para trocar a edição vigente.");
        }
      },
    });
  }

  return (
    <>
      <Card className="p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-1">
            <Eyebrow>A edição</Eyebrow>
            {edicao ? (
              <>
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[15px] font-semibold text-text-strong">{edicao.nome}</span>
                  {edicao.vigente ? (
                    <Badge size="xs" variant="success">
                      no ar
                    </Badge>
                  ) : (
                    <Badge size="xs" variant="neutral">
                      fora do ar
                    </Badge>
                  )}
                </div>
                <span className="flex flex-wrap items-center gap-x-3 text-[11.5px] text-text-secondary">
                  <span className="inline-flex items-center gap-1">
                    <CalendarRange className="size-3" aria-hidden />
                    {periodo(edicao)}
                  </span>
                  <span title="O identificador da promoção no iOn. É por ele que a regra respondida se amarra à promoção certa.">
                    promoção {edicao.id_ion} no iOn
                  </span>
                </span>
              </>
            ) : (
              <span className="text-[12.5px] text-text-secondary">
                Este produto não tem edição cadastrada. Sem edição, resposta por edição
                (valor, prazo, data) não pode ser publicada e o bot escala esses assuntos.
              </span>
            )}
          </div>

          {podeGerenciar && (
            <div className="flex flex-none flex-wrap items-center gap-2">
              {edicao && (
                <Button size="sm" variant="ghost" onClick={() => setForm(doEdicao(edicao))}>
                  <Pencil className="size-3.5" aria-hidden />
                  Editar
                </Button>
              )}
              <Button size="sm" variant="ghost" onClick={() => setForm(NOVA)}>
                <Plus className="size-3.5" aria-hidden />
                Nova edição
              </Button>
              {edicao && !edicao.vigente && (
                <Button size="sm" variant="filled" loading={trocando} onClick={porNoAr}>
                  Colocar no ar
                </Button>
              )}
            </div>
          )}
        </div>

        {/*
          A BARRA DE PRONTIDÃO, que era um cartão só dela em cima da lista de artigos.
          Ela mede a EDIÇÃO ("quanto desta promoção já dá para responder"), então mora
          junto do nome da edição que ela mede, e não junto de uma lista que saiu.
        */}
        {prontidao && prontidao.total > 0 && (
          <div className="mt-3">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-[11.5px] text-text-secondary">
                {prontidao.publicados} de {prontidao.total} respostas por edição publicadas
              </span>
              <span className="text-[11px] text-text-secondary">{Math.round(pct)}%</span>
            </div>
            <div className="mt-1.5">
              <Barra pct={pct} titulo={`${prontidao.publicados} de ${prontidao.total} publicados`} />
            </div>
            {prontidao.pendentesDeDefinicao > 0 && (
              <p className="mt-1.5 flex items-start gap-1 text-[11px] leading-snug text-warn-text">
                <AlertTriangle className="mt-px size-3 flex-none" aria-hidden />
                {plural(prontidao.pendentesDeDefinicao, "resposta", "respostas")} sem definição:
                o bot escala essas perguntas em vez de responder.
              </p>
            )}
          </div>
        )}

        {/*
          Escrever para uma edição que não está no ar é legítimo (é assim que se prepara
          a virada), mas quem faz isso precisa saber que o bot ainda não usa esse texto.
          Sem o aviso, a pessoa publica, testa, vê o bot escalar e conclui que quebrou.
        */}
        {edicao && !edicao.vigente && (
          <p className="mt-3 rounded-[12px] bg-[var(--l4-fill-5)] px-3 py-2 text-[11.5px] leading-relaxed text-text-secondary">
            Esta edição não está no ar.{" "}
            {vigente
              ? `O bot responde hoje pela ${vigente.nome}.`
              : "Nenhuma edição deste produto está no ar, então o bot escala tudo que é por edição."}{" "}
            O que você escrever aqui só vale quando ela for colocada no ar.
          </p>
        )}
      </Card>

      <ModalEdicao
        form={form}
        setForm={setForm}
        salvando={criando || editando}
        erro={erro}
        onFechar={() => {
          setForm(null);
          setErro(null);
        }}
        onSalvar={salvar}
      />
    </>
  );
}

/** O formulário. `id` vazio é criação; preenchido é correção da edição existente. */
interface Form {
  id: string;
  id_ion: string;
  nome: string;
  inicio: string;
  fim: string;
}

const NOVA: Form = { id: "", id_ion: "", nome: "", inicio: "", fim: "" };

const doEdicao = (e: Edicao): Form => ({
  id: e.id,
  id_ion: e.id_ion,
  nome: e.nome,
  inicio: dia(e.inicio),
  fim: e.fim ? dia(e.fim) : "",
});

/**
 * Criar e corrigir no mesmo formulário, com dois campos travados na correção.
 *
 * `id_ion` não é editável de propósito, e a regra é da API: ele é a chave de correlação
 * com a promoção do iOn e já está gravado nas versões de resposta que apontam para esta
 * edição. Reapontá-lo faria a regra que o cliente leu na promoção 119 passar a se
 * chamar 120, sem nada no histórico dizendo que aconteceu.
 *
 * A EDIÇÃO NOVA NASCE FORA DO AR, e não há caixa de "já entra valendo" aqui. A API
 * aceita, mas oferecer isso no formulário juntaria duas decisões diferentes: cadastrar
 * a promoção seguinte é preparação, e colocar no ar é a ação consequente que precisa
 * dizer quantos assuntos o bot vai escalar. E na hora do cadastro esse número nem
 * existe, porque a edição ainda não tem resposta nenhuma.
 */
function ModalEdicao({
  form,
  setForm,
  salvando,
  erro,
  onFechar,
  onSalvar,
}: {
  form: Form | null;
  setForm: React.Dispatch<React.SetStateAction<Form | null>>;
  salvando: boolean;
  erro: string | null;
  onFechar: () => void;
  onSalvar: () => void;
}) {
  const novo = !form?.id;
  const set = (campo: keyof Form, valor: string) =>
    setForm((a) => (a ? { ...a, [campo]: valor } : a));

  const valido =
    Boolean(form) &&
    form!.nome.trim().length >= 3 &&
    Boolean(form!.inicio) &&
    (!novo || form!.id_ion.trim().length > 0) &&
    // Fim antes do início é recusado pela API, e deixar o botão ativo faria a pessoa
    // descobrir isso depois de um ida e volta de rede.
    (!form!.fim || form!.fim > form!.inicio);

  return (
    <Modal open={Boolean(form)} onOpenChange={(v) => !v && onFechar()}>
      <ModalContent size="sm">
        <ModalHead
          eyebrow={novo ? "Nova edição" : "Edição"}
          title={novo ? "Cadastrar a próxima promoção" : (form?.nome ?? "")}
          description={
            novo
              ? "Ela nasce fora do ar. Colocar no ar é um passo à parte, porque muda o que o bot responde."
              : "Rótulo e datas. Trocar qual está no ar é a ação do cartão."
          }
        />
        <ModalBody>
          <div className="flex flex-col gap-3">
            <Input
              label="Promoção no iOn"
              value={form?.id_ion ?? ""}
              disabled={!novo}
              placeholder="120"
              helper={
                novo
                  ? "O identificador da promoção lá. É por ele que a regra respondida se amarra à promoção certa."
                  : "Não muda: as respostas já publicadas apontam para esta promoção."
              }
              onChange={(e) => set("id_ion", e.currentTarget.value)}
            />
            <Input
              label="Nome"
              value={form?.nome ?? ""}
              placeholder="Edição 120"
              helper="É o que aparece no seletor desta página."
              onChange={(e) => set("nome", e.currentTarget.value)}
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <Input
                label="Começa em"
                type="date"
                value={form?.inicio ?? ""}
                onChange={(e) => set("inicio", e.currentTarget.value)}
              />
              <Input
                label="Termina em"
                type="date"
                value={form?.fim ?? ""}
                helper="Deixe vazio se ainda não tem data."
                error={
                  form?.fim && form.inicio && form.fim <= form.inicio
                    ? "O fim tem que ser depois do início."
                    : undefined
                }
                onChange={(e) => set("fim", e.currentTarget.value)}
              />
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
            label: novo ? "Cadastrar" : "Salvar",
            loading: salvando,
            disabled: !valido,
            onClick: onSalvar,
          }}
        />
      </ModalContent>
    </Modal>
  );
}

/** ISO da API para o `YYYY-MM-DD` que o `type="date"` entende. */
function dia(iso: string): string {
  return iso.slice(0, 10);
}

function periodo(e: Edicao): string {
  const de = new Date(e.inicio).toLocaleDateString("pt-BR");
  return e.fim ? `${de} a ${new Date(e.fim).toLocaleDateString("pt-BR")}` : `desde ${de}`;
}

/** A mensagem de negócio da API, que é a que diz o que fazer. */
function mensagem(e: unknown): string | undefined {
  const corpo = (e as { data?: { message?: string | string[] } }).data;
  return Array.isArray(corpo?.message) ? corpo?.message[0] : corpo?.message;
}
