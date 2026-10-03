import { useEffect, useMemo, useState } from "react";
import {
  Badge,
  Button,
  Input,
  Modal,
  ModalActions,
  ModalBody,
  ModalContent,
  ModalHead,
  SelectPill,
  Textarea,
} from "@l4-web/ui";
import { Search } from "lucide-react";
import { arteBolao, linkRastreado, type ModeloArte } from "../../features/bolao/arte";
import { MEU_CODIGO, MINHA_NOME, enviarArte, useLoja } from "../../features/bolao/loja";

/* ── Cria Aí ─────────────────────────────────────────────────────────────── */

const MODELOS: { id: ModeloArte | "ia"; titulo: string; texto: string; v2?: boolean }[] = [
  { id: "padrao", titulo: "Padrão da modalidade", texto: "Cor e selo da loteria, dados do canhoto" },
  { id: "especial", titulo: "Especial", texto: "Para datas como Independência e Virada" },
  { id: "ia", titulo: "Gerada por IA", texto: "Arte nova a partir do design system", v2: true },
];

/**
 * O Cria Aí aberto DENTRO da conversa. A arte nasce dos dados do bolão (o canhoto
 * lido), sem campo digitado, e já leva o link rastreado com o código da vendedora.
 */
export function ModalCriaAi({
  aberto,
  bolaoInicial,
  conversaId,
  onFechar,
}: {
  aberto: boolean;
  bolaoInicial?: string | null;
  conversaId: string;
  onFechar: () => void;
}) {
  const { boloes } = useLoja();
  const [bolaoId, setBolaoId] = useState("");
  const [modelo, setModelo] = useState<ModeloArte>("padrao");
  useEffect(() => {
    if (aberto) {
      setBolaoId(bolaoInicial ?? boloes[0]?.id ?? "");
      setModelo("padrao");
    }
  }, [aberto, bolaoInicial, boloes]);
  const bolao = boloes.find((b) => b.id === bolaoId);
  const arte = useMemo(() => (bolao ? arteBolao(bolao, modelo, MEU_CODIGO) : null), [bolao, modelo]);

  return (
    <Modal open={aberto} onOpenChange={(v) => !v && onFechar()}>
      <ModalContent size="xl">
        <ModalHead eyebrow="Cria Aí" title="Arte do bolão" description="Aberto dentro da conversa. Os dados vêm do canhoto lido, nenhum campo é digitado à mão." />
        <ModalBody>
          <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1">
                <span className="text-[12px] font-medium text-text-secondary">Bolão</span>
                <SelectPill
                  value={bolaoId}
                  onChange={setBolaoId}
                  options={boloes.map((b) => ({ value: b.id, label: `${b.modalidade} ${b.concurso} · ${b.loterica}` }))}
                  block
                />
              </div>
              <span className="text-[12px] font-medium text-text-secondary">Modelo</span>
              <div className="flex flex-col gap-2">
                {MODELOS.map((m) => {
                  const ativo = m.id === modelo;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      disabled={m.v2}
                      onClick={() => m.id !== "ia" && setModelo(m.id)}
                      className={[
                        "l4-pressable rounded-[14px] px-3 py-2.5 text-left transition",
                        ativo ? "bg-brand/10 ring-2 ring-brand" : "bg-[var(--l4-fill-5)] hover:bg-[var(--l4-fill-4)]",
                        m.v2 ? "opacity-50" : "",
                      ].join(" ")}
                    >
                      <span className="flex items-center gap-2 text-[13px] font-semibold text-text-strong">
                        {m.titulo}
                        {m.v2 && <Badge size="xs" variant="warn">V2</Badge>}
                      </span>
                      <span className="text-[12px] text-text-secondary">{m.texto}</span>
                    </button>
                  );
                })}
              </div>
              {bolao && (
                <div className="rounded-[14px] bg-[var(--l4-fill-5)] px-3 py-2.5">
                  <p className="text-[12px] font-semibold text-text-strong">Link na arte</p>
                  <code className="block break-all font-mono text-[11.5px] text-text-secondary">{linkRastreado(bolao, MEU_CODIGO)}</code>
                  <p className="mt-1 text-[11.5px] text-text-secondary">Cada clique e cada venda ficam registrados para a {MINHA_NOME.split(" ")[0]}.</p>
                </div>
              )}
            </div>
            <div className="flex items-start justify-center rounded-[18px] bg-[var(--l4-fill-5)] p-3">
              {arte && <img src={arte} alt="Prévia da arte" className="max-h-[440px] w-auto rounded-[14px] shadow-[var(--l4-sh-rest)]" />}
            </div>
          </div>
        </ModalBody>
        <ModalActions
          secundarias={
            arte
              ? [
                  {
                    label: "Baixar",
                    onClick: () => {
                      const a = document.createElement("a");
                      a.href = arte;
                      a.download = `bolao-${bolaoId}.svg`;
                      a.click();
                    },
                  },
                ]
              : []
          }
          cancelar={{ onClick: onFechar }}
          primaria={{
            label: "Enviar na conversa",
            disabled: !bolao,
            onClick: () => {
              enviarArte(conversaId, bolaoId, modelo);
              onFechar();
            },
          }}
        />
      </ModalContent>
    </Modal>
  );
}

/* ── Nova conversa (chamada ativa pelo Dispara Aí) ───────────────────────── */

interface CampoTemplate {
  id: "nome" | "bolao";
  rotulo: string;
}

/**
 * Templates aprovados na Meta. O CORPO é fixo (a Meta aprova o texto inteiro); o que
 * muda por envio são as variáveis. Por isso a vendedora edita CAMPOS, não o texto:
 * uma caixa livre prometeria algo que a Meta recusa no envio.
 */
const TEMPLATES: { id: string; nome: string; partes: (string | CampoTemplate["id"] | "vendedora" | "link")[]; campos: CampoTemplate[] }[] = [
  {
    id: "boloes_do_dia",
    nome: "Bolões do dia",
    partes: ["Oi, ", "nome", "! Aqui é a ", "vendedora", ", do Mestre do Bolão. Hoje tem ", "bolao", " e ainda dá tempo de entrar. Quer que eu te mande os bolões? ", "link"],
    campos: [
      { id: "nome", rotulo: "Como chamar o cliente" },
      { id: "bolao", rotulo: "Bolão em destaque" },
    ],
  },
  {
    id: "reativacao",
    nome: "Sentimos sua falta",
    partes: ["Oi, ", "nome", "! Faz tempo que você não entra num bolão com a gente. Separei uma cota de ", "bolao", " pra você, quer ver? ", "link"],
    campos: [
      { id: "nome", rotulo: "Como chamar o cliente" },
      { id: "bolao", rotulo: "Bolão oferecido" },
    ],
  },
  {
    id: "resultado",
    nome: "Resultado saiu",
    partes: ["Oi, ", "nome", "! Saiu o resultado de ", "bolao", ". Quer conferir o seu e ver os bolões da próxima? ", "link"],
    campos: [
      { id: "nome", rotulo: "Como chamar o cliente" },
      { id: "bolao", rotulo: "Concurso" },
    ],
  },
];

/** Clientes que o iON "acha". Só dá para chamar quem existe lá. */
const NO_ION = [
  { nome: "Beatriz Lopes", telefone: "(67) 99812-3344", optOut: false, ultima: "Lotofácil 3480 · set/2026" },
  { nome: "Roberto Nunes", telefone: "(67) 99155-7721", optOut: true, ultima: "Mega-Sena 2900 · jun/2026" },
  { nome: "Juliana Prado", telefone: "(67) 98877-1020", optOut: false, ultima: "Quina 6800 · ago/2026" },
  { nome: "Sérgio Almeida", telefone: "(67) 99230-5566", optOut: false, ultima: "+Milionária 280 · jul/2026" },
];

/**
 * Chamar quem NUNCA falou com a vendedora.
 *
 * O contato vem OBRIGATORIAMENTE do iON: nada de digitar nome e telefone, que é
 * como nasce cliente duplicado e número errado. Quem envia é o Dispara Aí (que já
 * cuida de template, custo, opt-out e limite), e a conversa só aparece no Atende Aí
 * quando o cliente responde, já com esta vendedora como dona.
 */
export function ModalNovaConversa({
  aberto,
  onFechar,
  onCriar,
}: {
  aberto: boolean;
  onFechar: () => void;
  onCriar: (dados: { nome: string; telefone: string; texto: string }) => void;
}) {
  const { boloes } = useLoja();
  const [busca, setBusca] = useState("");
  const [cliente, setCliente] = useState<(typeof NO_ION)[number] | null>(null);
  const [templateId, setTemplateId] = useState(TEMPLATES[0].id);
  const [nome, setNome] = useState("");
  const [bolaoId, setBolaoId] = useState("");
  useEffect(() => {
    if (aberto) {
      setBusca("");
      setCliente(null);
      setTemplateId(TEMPLATES[0].id);
      setNome("");
      setBolaoId(boloes.find((b) => b.cotasLivres > 0)?.id ?? "");
    }
  }, [aberto, boloes]);

  const achados = busca.trim().length >= 2
    ? NO_ION.filter((c) => (c.nome + c.telefone).toLowerCase().includes(busca.trim().toLowerCase()))
    : [];
  const t = TEMPLATES.find((x) => x.id === templateId)!;
  const b = boloes.find((x) => x.id === bolaoId);
  const valor = (parte: string) =>
    parte === "nome"
      ? nome || "{{nome}}"
      : parte === "bolao"
        ? b
          ? `${b.modalidade} ${b.concurso}${b.selo ? ` (${b.selo})` : ""}`
          : "{{bolão}}"
        : parte === "vendedora"
          ? MINHA_NOME.split(" ")[0]
          : parte === "link"
            ? `mestredobolao.com.br/b/${b?.id ?? ""}?v=${MEU_CODIGO}`
            : parte;
  const variavel = (parte: string) => ["nome", "bolao", "vendedora", "link"].includes(parte);
  const texto = t.partes.map(valor).join("");

  return (
    <Modal open={aberto} onOpenChange={(v) => !v && onFechar()}>
      <ModalContent size="lg">
        <ModalHead
          eyebrow="Nova conversa"
          title="Chamar um cliente no WhatsApp"
          description="O envio sai pelo Dispara Aí. Quando o cliente responder, a conversa entra na sua fila."
        />
        <ModalBody>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="flex flex-col gap-3">
              {cliente ? (
                <div className="flex items-center justify-between gap-2 rounded-[14px] bg-[var(--l4-fill-5)] px-3 py-2.5">
                  <span className="min-w-0">
                    <span className="block text-[13px] font-semibold text-text-strong">{cliente.nome}</span>
                    <span className="block text-[11.5px] text-text-secondary">{cliente.telefone} · última: {cliente.ultima}</span>
                  </span>
                  <Button size="sm" variant="plain" onClick={() => setCliente(null)}>
                    Trocar
                  </Button>
                </div>
              ) : (
                <>
                  <div className="relative">
                    <Input
                      label="Cliente no iON"
                      value={busca}
                      onChange={(e) => setBusca(e.currentTarget.value)}
                      placeholder="Busque por nome ou telefone"
                      autoFocus
                    />
                    <Search className="pointer-events-none absolute right-3 top-[34px] size-4 text-text-secondary" />
                  </div>
                  {busca.trim().length >= 2 && achados.length === 0 && (
                    <p className="px-1 text-[12px] text-text-secondary">Ninguém com esse nome ou telefone no iON.</p>
                  )}
                  {achados.map((c) => (
                    <button
                      key={c.nome}
                      type="button"
                      disabled={c.optOut}
                      title={c.optOut ? "O cliente pediu para não receber mensagens" : undefined}
                      onClick={() => {
                        setCliente(c);
                        setNome(c.nome.split(" ")[0]);
                        setBusca("");
                      }}
                      className="l4-pressable flex items-center justify-between gap-2 rounded-[12px] bg-[var(--l4-fill-5)] px-3 py-2 text-left hover:bg-[var(--l4-fill-4)] disabled:opacity-50"
                    >
                      <span className="min-w-0">
                        <span className="block text-[13px] font-semibold text-text-strong">{c.nome}</span>
                        <span className="block text-[11.5px] text-text-secondary">{c.telefone} · última: {c.ultima}</span>
                      </span>
                      {c.optOut && <Badge size="xs" variant="neutral">não recebe mensagens</Badge>}
                    </button>
                  ))}
                </>
              )}

              <div className="flex flex-col gap-1">
                <span className="text-[12px] font-medium text-text-secondary">Mensagem</span>
                <SelectPill
                  value={templateId}
                  onChange={setTemplateId}
                  options={TEMPLATES.map((x) => ({ value: x.id, label: x.nome }))}
                  block
                />
              </div>
              {t.campos.map((c) =>
                c.id === "nome" ? (
                  <Input key={c.id} label={c.rotulo} value={nome} onChange={(e) => setNome(e.currentTarget.value)} disabled={!cliente} />
                ) : (
                  <div key={c.id} className="flex flex-col gap-1">
                    <span className="text-[12px] font-medium text-text-secondary">{c.rotulo}</span>
                    <SelectPill
                      value={bolaoId}
                      onChange={setBolaoId}
                      options={boloes.filter((x) => x.cotasLivres > 0).map((x) => ({ value: x.id, label: `${x.modalidade} ${x.concurso}` }))}
                      block
                    />
                  </div>
                ),
              )}
            </div>

            <div className="flex flex-col gap-2">
              <span className="text-[12px] font-medium text-text-secondary">Prévia</span>
              <div className="rounded-[18px] bg-[var(--l4-fill-5)] p-3">
                <div className="ml-auto max-w-[92%] whitespace-pre-wrap rounded-[19px] rounded-br-[5px] bg-brand px-3.5 py-2 text-[13.5px] leading-[1.45] text-white [overflow-wrap:anywhere]">
                  {t.partes.map((p, i) =>
                    variavel(p) ? (
                      <b key={i} className="rounded-[4px] bg-white/20 px-0.5 font-semibold">
                        {valor(p)}
                      </b>
                    ) : (
                      <span key={i}>{p}</span>
                    ),
                  )}
                </div>
              </div>
              <p className="px-1 text-[11.5px] leading-snug text-text-secondary">
                O texto é o aprovado pela Meta. O que está em destaque muda a cada envio.
              </p>
            </div>
          </div>
        </ModalBody>
        <ModalActions
          cancelar={{ onClick: onFechar }}
          primaria={{
            label: "Enviar pelo Dispara Aí",
            disabled: !cliente || !nome.trim() || !b,
            title: !cliente ? "Escolha o cliente no iON" : undefined,
            onClick: () => cliente && onCriar({ nome: cliente.nome, telefone: cliente.telefone, texto }),
          }}
        />
      </ModalContent>
    </Modal>
  );
}

/* ── Simular cliente respondendo ─────────────────────────────────────────── */

export function ModalRespostaCliente({
  aberto,
  onFechar,
  onEnviar,
}: {
  aberto: boolean;
  onFechar: () => void;
  onEnviar: (texto: string) => void;
}) {
  const [texto, setTexto] = useState("");
  useEffect(() => {
    if (aberto) setTexto("Quero 2 cotas da Lotofácil, como pago?");
  }, [aberto]);
  return (
    <Modal open={aberto} onOpenChange={(v) => !v && onFechar()}>
      <ModalContent size="sm">
        <ModalHead eyebrow="Simulação" title="O cliente responde" description="Como se a mensagem chegasse pelo WhatsApp." />
        <ModalBody>
          <Textarea rows={3} value={texto} onChange={(e) => setTexto(e.currentTarget.value)} />
        </ModalBody>
        <ModalActions
          cancelar={{ onClick: onFechar }}
          primaria={{
            label: "Chegar mensagem",
            disabled: !texto.trim(),
            onClick: () => {
              onEnviar(texto.trim());
              onFechar();
            },
          }}
        />
      </ModalContent>
    </Modal>
  );
}
