import { useEffect, useMemo, useState } from "react";
import { Sparkles } from "lucide-react";
import {
  Badge,
  Button,
  Input,
  Modal,
  ModalActions,
  ModalBody,
  ModalContent,
  ModalHead,
  SegmentedControl,
  SelectPill,
  Spinner,
  Textarea,
} from "@l4-web/ui";
import type {
  Equipe,
  EtapaMotivo,
  FichaEncaminhamento,
} from "../../features/atendimento/tipos";

export type AcaoAberta = "transferir" | "encaminhar" | "encerrar" | null;

/** O palpite do Blue para o motivo. Contrato fechado com a API. */
export interface MotivoSugerido {
  motivoId: string | null;
  label: string | null;
  confianca: "alta" | "media" | "baixa";
  porque: string;
}

/**
 * A linha que diz por que a ação não passou.
 *
 * Fica ACIMA do rodapé, junto do botão que falhou, porque erro longe do gatilho é
 * erro que não se lê. O texto vem do servidor: ele já responde em português e
 * explica o caso ("Este caso já tem um encaminhamento aberto para pagamentos."),
 * e traduzir isso na tela só criaria uma segunda versão da regra.
 */
function AvisoErro({ erro }: { erro?: string | null }) {
  if (!erro) return null;
  return (
    <p
      role="alert"
      className="rounded-[12px] border-[0.5px] border-error-border bg-error-bg px-3 py-2 text-[11.5px] leading-relaxed text-error-text"
    >
      {erro}
    </p>
  );
}

const ROTULO_CONFIANCA = {
  alta: { texto: "confiança alta", cor: "success" as const },
  media: { texto: "confiança média", cor: "warn" as const },
  baixa: { texto: "confiança baixa", cor: "neutral" as const },
};

/**
 * Encerramento. **Motivo é obrigatório**, e a trava não é de tela: a API recusa o
 * encerramento sem motivo válido da taxonomia. Aqui o botão só habilita com motivo
 * escolhido, para a pessoa não descobrir a regra por um 400.
 *
 * A escolha é em DOIS PASSOS, etapa e depois cenário, e isso não é preciosismo de
 * organização: o seletor único era a árvore achatada em `etapa › cenário` e a
 * operação recebia **119 linhas de 4233px dentro de uma caixa de 279px** (medido),
 * sem digitar para filtrar, porque nenhum componente do DS tem busca hoje. Quinze
 * telas de rolagem para classificar um caso é o que fazia a pessoa escolher a
 * primeira linha plausível, e é assim que a métrica de motivo nasce mentindo.
 * Com a etapa antes, a segunda lista tem no máximo doze linhas.
 *
 * A alternativa certa é um `Combobox` com busca no DS, e ela está proposta: aqui
 * não se inventa combobox na tela, que seria a peça caseira que o padrão proíbe.
 *
 * A sugestão do Blue entra como ATALHO, nunca como escolha: o botão preenche os
 * dois seletores e a pessoa vê o que foi preenchido antes de confirmar. Quem
 * encerra responde pelo motivo, e uma sugestão aplicada sozinha transfere a
 * responsabilidade para quem não pode assinar embaixo.
 */
export function ModalEncerrar({
  aberto,
  taxonomia,
  salvando,
  erro,
  sugestao,
  sugerindo,
  onFechar,
  onConfirmar,
}: {
  aberto: boolean;
  taxonomia: EtapaMotivo[];
  salvando?: boolean;
  /** Motivo da última falha, quando houve. */
  erro?: string | null;
  /** Palpite do Blue. Ausente = não pediram, não chegou, ou ele não se comprometeu. */
  sugestao?: MotivoSugerido | null;
  sugerindo?: boolean;
  onFechar: () => void;
  onConfirmar: (motivoId: string, resolucao: string) => void;
}) {
  const [etapaId, setEtapaId] = useState("");
  const [motivoId, setMotivoId] = useState("");
  const [resolucao, setResolucao] = useState("");

  /**
   * Abrir o modal ZERA a escolha anterior.
   *
   * Sem isto o estado sobrevivia entre aberturas (o `Modal` do DS não desmonta o
   * corpo), e o motivo escolhido para a conversa anterior aparecia já selecionado
   * na próxima, com o botão habilitado. Um clique distraído carimbava o caso do
   * Tiago com o motivo da Ana, e o relatório da praça engolia isso sem reclamar.
   */
  useEffect(() => {
    if (aberto) {
      setEtapaId("");
      setMotivoId("");
      setResolucao("");
    }
  }, [aberto]);

  const etapaDoMotivo = useMemo(() => {
    const mapa = new Map<string, string>();
    for (const etapa of taxonomia) {
      for (const f of etapa.filhos) mapa.set(f.id, etapa.id);
    }
    return mapa;
  }, [taxonomia]);

  const cenarios = taxonomia.find((e) => e.id === etapaId)?.filhos ?? [];

  // A sugestão só vira atalho se o motivo dela existir NESTA taxonomia: id que a
  // tela não sabe posicionar preencheria a etapa com vazio e o cenário com nada.
  const sugestaoUsavel =
    sugestao?.motivoId && etapaDoMotivo.has(sugestao.motivoId)
      ? sugestao
      : null;

  const aplicarSugestao = () => {
    if (!sugestaoUsavel?.motivoId) return;
    setEtapaId(etapaDoMotivo.get(sugestaoUsavel.motivoId) ?? "");
    setMotivoId(sugestaoUsavel.motivoId);
  };

  return (
    <Modal open={aberto} onOpenChange={(v) => !v && onFechar()}>
      <ModalContent size="md">
        <ModalHead
          eyebrow="Encerrar atendimento"
          title="Qual foi o motivo?"
          description="O motivo é obrigatório e alimenta o relatório da praça. Sem ele, a métrica de atendimento classificado nasce inútil."
        />
        <ModalBody>
          <div className="flex flex-col gap-3">
            {sugerindo && (
              <p className="flex items-center gap-2 text-[11.5px] text-text-secondary">
                <Spinner size={14} /> O Blue está lendo a conversa
              </p>
            )}

            {sugestaoUsavel && (
              <div className="flex flex-col gap-2 rounded-[14px] bg-info-bg px-3 py-2.5">
                <div className="flex flex-wrap items-center gap-1.5">
                  <Sparkles
                    className="size-3.5 flex-none text-info-text"
                    aria-hidden
                  />
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-info-text">
                    O Blue sugere
                  </span>
                  <Badge
                    size="xs"
                    variant={ROTULO_CONFIANCA[sugestaoUsavel.confianca].cor}
                  >
                    {ROTULO_CONFIANCA[sugestaoUsavel.confianca].texto}
                  </Badge>
                </div>
                <p className="text-[12.5px] font-semibold leading-snug text-text-strong">
                  {sugestaoUsavel.label}
                </p>
                {/* O PORQUÊ fica visível sem clique: sugestão sem justificativa é
                    palpite, e palpite não se confere. */}
                <p className="text-[11.5px] leading-relaxed text-text-secondary">
                  {sugestaoUsavel.porque}
                </p>
                <div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={aplicarSugestao}
                    disabled={motivoId === sugestaoUsavel.motivoId}
                  >
                    {motivoId === sugestaoUsavel.motivoId
                      ? "Motivo preenchido"
                      : "Usar este motivo"}
                  </Button>
                </div>
              </div>
            )}

            {/*
              Etapa primeiro, cenário depois: é a hierarquia real da taxonomia e o
              único jeito de a segunda lista caber na tela.
            */}
            <SelectPill
              value={etapaId}
              onChange={(v) => {
                setEtapaId(v);
                // Trocar de etapa derruba o cenário: manter o antigo deixaria o
                // rótulo dizendo uma etapa e o valor pertencendo a outra.
                setMotivoId("");
              }}
              options={[
                { value: "", label: "Etapa da jornada" },
                ...taxonomia.map((e) => ({
                  value: e.id,
                  label: `${e.label} (${e.filhos.length})`,
                })),
              ]}
              block
              placeholder="Etapa da jornada"
            />
            <SelectPill
              value={motivoId}
              onChange={setMotivoId}
              options={[
                {
                  value: "",
                  label: etapaId
                    ? "O que o cliente trouxe"
                    : "Escolha a etapa primeiro",
                },
                ...cenarios.map((f) => ({ value: f.id, label: f.label })),
              ]}
              disabled={!etapaId}
              block
              placeholder="O que o cliente trouxe"
            />
            <Textarea
              rows={4}
              value={resolucao}
              onChange={(e) => setResolucao(e.currentTarget.value)}
              placeholder="O que foi feito (opcional, mas é o que ajuda quem reabrir o caso)"
            />
          </div>
          <AvisoErro erro={erro} />
        </ModalBody>
        <ModalActions
          cancelar={{ onClick: onFechar }}
          primaria={{
            label: "Encerrar com este motivo",
            disabled: !motivoId,
            loading: salvando,
            onClick: () => onConfirmar(motivoId, resolucao),
          }}
        />
      </ModalContent>
    </Modal>
  );
}

/**
 * Transferência. **Motivo obrigatório também**, e por uma razão diferente do
 * encerramento: sem ele, transferir vira o jeito silencioso de tirar caso difícil
 * da própria fila, e o supervisor nunca vê o padrão.
 */
export function ModalTransferir({
  aberto,
  filas,
  pessoas = [],
  salvando,
  erro,
  onFechar,
  onConfirmar,
}: {
  aberto: boolean;
  filas: { id: string; nome: string }[];
  /**
   * Para quem dá para passar direto. A API sempre aceitou `paraUserId`, e o modal
   * só listava fila: a vendedora que quer passar o cliente para a colega tinha que
   * jogar na fila e torcer para a colega pegar.
   */
  pessoas?: { id: string; nome: string; status?: string }[];
  salvando?: boolean;
  /** Motivo da última falha, quando houve. */
  erro?: string | null;
  onFechar: () => void;
  onConfirmar: (destino: { paraUserId?: string; paraFilaId?: string }, motivo: string) => void;
}) {
  const [tipo, setTipo] = useState<"pessoa" | "fila">("pessoa");
  const [alvo, setAlvo] = useState("");
  const [motivo, setMotivo] = useState("");

  // Mesma razão do encerrar: o corpo do modal não desmonta, então sem isto a fila
  // e o texto da transferência anterior reapareciam já preenchidos no caso seguinte.
  useEffect(() => {
    if (aberto) {
      setTipo(pessoas.length > 0 ? "pessoa" : "fila");
      setAlvo("");
      setMotivo("");
    }
  }, [aberto, pessoas.length]);

  const opcoes =
    tipo === "pessoa"
      ? pessoas.map((p) => ({ value: p.id, label: p.status ? `${p.nome} · ${p.status}` : p.nome }))
      : filas.map((f) => ({ value: f.id, label: f.nome }));

  return (
    <Modal open={aberto} onOpenChange={(v) => !v && onFechar()}>
      <ModalContent size="md">
        <ModalHead
          eyebrow="Transferir"
          title="Para quem vai a conversa?"
          description="Direto para uma pessoa, ou de volta para uma fila. O motivo fica registrado como nota interna."
        />
        <ModalBody>
          <div className="flex flex-col gap-3">
            {pessoas.length > 0 && (
              <SegmentedControl
                options={[
                  { id: "pessoa", label: "Pessoa" },
                  { id: "fila", label: "Fila" },
                ]}
                value={tipo}
                onChange={(v) => {
                  setTipo(v as "pessoa" | "fila");
                  setAlvo("");
                }}
              />
            )}
            <SelectPill
              value={alvo}
              onChange={setAlvo}
              options={[
                { value: "", label: tipo === "pessoa" ? "Escolha a pessoa" : "Escolha a fila" },
                ...opcoes,
              ]}
              block
              placeholder={tipo === "pessoa" ? "Escolha a pessoa" : "Escolha a fila"}
            />
            <Textarea
              rows={3}
              value={motivo}
              onChange={(e) => setMotivo(e.currentTarget.value)}
              placeholder="Por que está transferindo (obrigatório)"
            />
          </div>
          <AvisoErro erro={erro} />
        </ModalBody>
        <ModalActions
          cancelar={{ onClick: onFechar }}
          primaria={{
            label: "Transferir",
            disabled: !alvo || motivo.trim().length < 3,
            loading: salvando,
            onClick: () =>
              onConfirmar(tipo === "pessoa" ? { paraUserId: alvo } : { paraFilaId: alvo }, motivo),
          }}
        />
      </ModalContent>
    </Modal>
  );
}

/**
 * Encaminhamento às equipes internas: Pagamentos ou Dev.
 *
 * Duas coisas vêm da API e não daqui: os CAMPOS de cada equipe e o aviso do que
 * ela recebe. A lista de campos é a fronteira de dado pessoal (a caixa técnica
 * trabalha por referência do caso, sem nome nem CPF), e fronteira que mora na
 * tela não é fronteira: bastaria um campo novo aqui para vazar identidade a uma
 * equipe que não deve ter. O servidor descarta o que não está na ficha dele.
 *
 * A equipe vem PRÉ-ESCOLHIDA pelo motivo quando a taxonomia sabe qual é: quem
 * classificou "Paguei o Pix e não recebi" já disse que é caso de Pagamentos.
 * Quando não sabe, nenhuma vem marcada, porque chutar equipe é pior que perguntar.
 */
export function ModalEncaminhar({
  aberto,
  onLimparErro,
  ficha,
  carregando,
  salvando,
  erro,
  onFechar,
  onConfirmar,
}: {
  aberto: boolean;
  ficha?: FichaEncaminhamento;
  carregando?: boolean;
  salvando?: boolean;
  /** Motivo da última falha, quando houve. */
  erro?: string | null;
  /** Chamado quando a escolha muda e o erro anterior deixa de valer. */
  onLimparErro?: () => void;
  onFechar: () => void;
  onConfirmar: (equipe: Equipe, coleta: Record<string, string>) => void;
}) {
  const [equipe, setEquipe] = useState<Equipe | "">("");
  const [coleta, setColeta] = useState<Record<string, string>>({});

  /**
   * Abrir zera a ficha, e aqui isso é mais grave que comodidade.
   *
   * O corpo do modal não desmonta ao fechar, então a `coleta` do caso ANTERIOR
   * continuava nos campos: o E2E do Pix de um cliente ficava preenchido no
   * formulário do caso de outro, pronto para ser enviado à equipe interna. Não é
   * campo sujo, é dado financeiro de uma pessoa viajando para o caso de outra.
   */
  useEffect(() => {
    if (aberto) {
      setEquipe("");
      setColeta({});
    }
  }, [aberto]);

  // A sugestão do motivo entra quando a ficha chega, e só enquanto ninguém
  // escolheu: reaplicar depois sobrescreveria a escolha da pessoa a cada refetch.
  useEffect(() => {
    if (aberto && ficha?.sugerida && !equipe) setEquipe(ficha.sugerida);
  }, [aberto, ficha?.sugerida, equipe]);

  // Trocar de equipe zera a ficha: os campos são outros, e valor digitado para
  // Pagamentos aparecendo em campo de Dev é como se manda E2E de Pix como
  // "versão do app".
  const trocarEquipe = (nova: string) => {
    setEquipe(nova as Equipe);
    setColeta({});
    // O erro anterior sai junto: ele fala da equipe ANTERIOR. Ficava na tela um
    // "já tem encaminhamento aberto para pagamentos" embaixo do formulário da Dev,
    // acusando um impedimento que não vale para a equipe agora escolhida.
    onLimparErro?.();
  };

  const atual = ficha?.equipes.find((e) => e.equipe === equipe);
  const preenchidos = atual
    ? atual.campos.filter((c) => (coleta[c] ?? "").trim()).length
    : 0;

  return (
    <Modal open={aberto} onOpenChange={(v) => !v && onFechar()}>
      <ModalContent size="md">
        <ModalHead
          eyebrow="Encaminhar"
          title="Para qual equipe vai o caso?"
          description="O caso entra na caixa da equipe e continua sendo seu com o cliente. Não prometa prazo."
        />
        <ModalBody>
          {carregando ? (
            <div className="flex items-center gap-2 py-6 text-[13px] text-text-secondary">
              <Spinner size={16} /> Carregando a ficha do caso
            </div>
          ) : !ficha ? (
            /**
             * Sem ficha e sem carregamento em curso, a tela DIZ o que houve.
             *
             * O spinner cobria os dois casos e por isso mentia: quando a ficha não
             * vinha (conversa sem caso aberto, ou a busca falhando), a pessoa ficava
             * olhando "Carregando" para sempre. Espera sem fim é o pior estado de
             * tela que existe, porque não dá nem para saber se é lento ou quebrado.
             */
            <p className="py-6 text-[13px] text-text-secondary">
              Não deu para carregar a ficha do caso. Abra o caso nesta conversa e
              tente de novo.
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              <SegmentedControl
                options={ficha.equipes.map((e) => ({
                  id: e.equipe,
                  label: e.equipe === "dev" ? "Dev" : "Pagamentos",
                }))}
                value={equipe}
                onChange={trocarEquipe}
                size="sm"
              />

              {ficha.motivo && (
                <p className="text-[11.5px] text-text-secondary">
                  {ficha.sugerida
                    ? "Sugerido pelo motivo "
                    : "Motivo classificado: "}
                  <b className="text-text-strong">{ficha.motivo}</b>
                  {ficha.ref ? (
                    <>
                      {" "}
                      · referência{" "}
                      <span className="font-mono">{ficha.ref}</span>
                    </>
                  ) : null}
                </p>
              )}

              {atual && (
                <>
                  <div className="flex flex-col gap-2">
                    {atual.campos.map((campo) => (
                      <Input
                        key={campo}
                        label={campo}
                        value={coleta[campo] ?? ""}
                        onChange={(e) => {
                          // O valor é lido AQUI, e não lá dentro.
                          //
                          // `currentTarget` só existe enquanto o evento está sendo
                          // despachado, e o updater de `setState` roda depois, na
                          // renderização. Ler ele lá dentro dava
                          // "Cannot read properties of null (reading 'value')" e
                          // derrubava o app inteiro para tela BRANCA na primeira
                          // tecla digitada em qualquer campo da equipe. Como o
                          // formulário só aparece com um caso aberto e a equipe
                          // escolhida, era fácil não chegar aqui em teste de clique.
                          const valor = e.currentTarget.value;
                          setColeta((p) => ({ ...p, [campo]: valor }));
                        }}
                      />
                    ))}
                  </div>
                  <p className="rounded-[12px] bg-info-bg px-3 py-2 text-[11.5px] leading-relaxed text-text-strong">
                    {atual.aviso}
                  </p>
                </>
              )}
            </div>
          )}
          <AvisoErro erro={erro} />
        </ModalBody>
        <ModalActions
          cancelar={{ onClick: onFechar }}
          primaria={{
            label: "Encaminhar",
            // Pelo menos um campo preenchido: ficha vazia obriga a equipe a voltar
            // pedindo o básico, e o caso perde um turno inteiro nisso.
            disabled: !equipe || preenchidos === 0,
            loading: salvando,
            onClick: () => equipe && onConfirmar(equipe, coleta),
          }}
        />
      </ModalContent>
    </Modal>
  );
}
