import { useEffect, useMemo, useState } from "react";
import {
  Badge,
  Checkbox,
  Input,
  Modal,
  ModalActions,
  ModalBody,
  ModalContent,
  ModalHead,
  SelectPill,
  Textarea,
} from "@l4-web/ui";
import { AlertTriangle, CheckCircle2, Search } from "lucide-react";
import { arteBolao, linkRastreado, type ModeloArte } from "../../features/bolao/arte";
import { MEU_CODIGO, MINHA_NOME, enviarArte, enviarBoloes, useLoja } from "../../features/bolao/loja";
import { brl } from "../../features/bolao/formato";

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

/* ── Enviar bolões ───────────────────────────────────────────────────────── */

export function ModalEnviarBoloes({
  aberto,
  conversaId,
  onFechar,
}: {
  aberto: boolean;
  conversaId: string;
  onFechar: () => void;
}) {
  const { boloes } = useLoja();
  const disponiveis = boloes.filter((b) => b.cotasLivres > 0);
  const [marcados, setMarcados] = useState<string[]>([]);
  useEffect(() => {
    if (aberto) setMarcados([]);
  }, [aberto]);
  const alternar = (id: string) =>
    setMarcados((m) => (m.includes(id) ? m.filter((x) => x !== id) : [...m, id]));

  return (
    <Modal open={aberto} onOpenChange={(v) => !v && onFechar()}>
      <ModalContent size="md">
        <ModalHead
          eyebrow="Enviar bolões"
          title="Quais bolões mandar?"
          description="Vai a arte padrão de cada um e um texto com preço, cotas livres e o seu link rastreado. Esgotados não aparecem."
        />
        <ModalBody>
          <div className="flex flex-col gap-1.5">
            {disponiveis.map((b) => (
              <label
                key={b.id}
                className="flex cursor-pointer items-center gap-3 rounded-[14px] bg-[var(--l4-fill-5)] px-3 py-2.5"
              >
                <Checkbox checked={marcados.includes(b.id)} onCheckedChange={() => alternar(b.id)} />
                <span className="h-8 w-1 flex-none rounded-full" style={{ background: b.cor }} />
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] font-semibold text-text-strong">
                    {b.modalidade} {b.concurso} {b.selo && <Badge size="xs" variant="warn">{b.selo}</Badge>}
                  </span>
                  <span className="block text-[11.5px] text-text-secondary">
                    {b.sorteio} · {b.cotasLivres} de {b.cotasTotal} livres · {b.loterica}
                  </span>
                </span>
                <span className="text-[13px] font-semibold tabular-nums">{brl(b.precoCota)}</span>
              </label>
            ))}
          </div>
        </ModalBody>
        <ModalActions
          cancelar={{ onClick: onFechar }}
          primaria={{
            label: marcados.length > 1 ? `Enviar ${marcados.length} bolões` : "Enviar",
            disabled: marcados.length === 0,
            onClick: () => {
              enviarBoloes(conversaId, marcados);
              onFechar();
            },
          }}
        />
      </ModalContent>
    </Modal>
  );
}

/* ── Nova conversa por template ──────────────────────────────────────────── */

const TEMPLATES = [
  {
    id: "boloes_do_dia",
    nome: "boloes_do_dia",
    categoria: "Marketing",
    custo: "R$ 0,35",
    corpo: "Oi, {{nome}}! Aqui é a {{vendedora}}, do Mestre do Bolão. Hoje tem Lotofácil da Independência com prêmio de R$ 5,5 milhões e cotas a partir de R$ 48,50. Quer que eu te mande os bolões? {{link}}",
  },
  {
    id: "reativacao",
    nome: "sentimos_sua_falta",
    categoria: "Marketing",
    custo: "R$ 0,35",
    corpo: "Oi, {{nome}}! Faz tempo que você não entra num bolão com a gente. Separei uma cota da Mega acumulada pra você, quer ver? {{link}}",
  },
  {
    id: "pos_venda",
    nome: "comprovante_disponivel",
    categoria: "Utilidade",
    custo: "R$ 0,04",
    corpo: "Oi, {{nome}}! O comprovante da sua cota já está disponível. Responda esta mensagem para receber.",
  },
];

/** Contatos que o iON "acha" pelo nome ou telefone. */
const NO_ION = [
  { nome: "Beatriz Lopes", telefone: "(67) 99812-3344", optOut: false, ultima: "Lotofácil 3480 · set/2026" },
  { nome: "Roberto Nunes", telefone: "(67) 99155-7721", optOut: true, ultima: "Mega-Sena 2900 · jun/2026" },
  { nome: "Juliana Prado", telefone: "(67) 98877-1020", optOut: false, ultima: "Quina 6800 · ago/2026" },
];

/**
 * Chamar quem NUNCA falou com a vendedora. Só sai template aprovado pela Meta, e as
 * travas ficam à vista: opt-out, custo por mensagem e o limite do dia, para o número
 * não ser banido por excesso.
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
  const [busca, setBusca] = useState("");
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [template, setTemplate] = useState(TEMPLATES[0].id);
  useEffect(() => {
    if (aberto) {
      setBusca("");
      setNome("");
      setTelefone("");
      setTemplate(TEMPLATES[0].id);
    }
  }, [aberto]);

  const achados = busca.length >= 2 ? NO_ION.filter((c) => (c.nome + c.telefone).toLowerCase().includes(busca.toLowerCase())) : [];
  const escolhido = NO_ION.find((c) => c.nome === nome);
  const t = TEMPLATES.find((x) => x.id === template)!;
  const texto = t.corpo
    .replace("{{nome}}", nome.split(" ")[0] || "{{nome}}")
    .replace("{{vendedora}}", MINHA_NOME.split(" ")[0])
    .replace("{{link}}", `mestredobolao.com.br/b?v=${MEU_CODIGO}`);
  const telOk = telefone.replace(/\D/g, "").length >= 10;
  const bloqueado = escolhido?.optOut;

  return (
    <Modal open={aberto} onOpenChange={(v) => !v && onFechar()}>
      <ModalContent size="lg">
        <ModalHead
          eyebrow="Nova conversa"
          title="Chamar um cliente no WhatsApp"
          description="Fora da janela de 24h a Meta só aceita template aprovado. A resposta do cliente cai na sua fila."
        />
        <ModalBody>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="flex flex-col gap-3">
              <div className="relative">
                <Input
                  label="Buscar no iON"
                  value={busca}
                  onChange={(e) => setBusca(e.currentTarget.value)}
                  placeholder="Nome ou telefone"
                />
                <Search className="pointer-events-none absolute right-3 top-[34px] size-4 text-text-secondary" />
              </div>
              {achados.map((c) => (
                <button
                  key={c.nome}
                  type="button"
                  onClick={() => {
                    setNome(c.nome);
                    setTelefone(c.telefone);
                    setBusca("");
                  }}
                  className="l4-pressable flex items-center justify-between rounded-[12px] bg-[var(--l4-fill-5)] px-3 py-2 text-left hover:bg-[var(--l4-fill-4)]"
                >
                  <span>
                    <span className="block text-[13px] font-semibold text-text-strong">{c.nome}</span>
                    <span className="block text-[11.5px] text-text-secondary">{c.telefone} · última: {c.ultima}</span>
                  </span>
                  {c.optOut && <Badge size="xs" variant="error">opt-out</Badge>}
                </button>
              ))}
              <Input label="Nome" value={nome} onChange={(e) => setNome(e.currentTarget.value)} />
              <Input label="Telefone (WhatsApp)" value={telefone} onChange={(e) => setTelefone(e.currentTarget.value)} placeholder="(67) 99999-9999" />
              <div className="flex flex-col gap-1">
                <span className="text-[12px] font-medium text-text-secondary">Template aprovado</span>
                <SelectPill
                  value={template}
                  onChange={setTemplate}
                  options={TEMPLATES.map((x) => ({ value: x.id, label: `${x.nome} · ${x.categoria}` }))}
                  block
                />
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <span className="text-[12px] font-medium text-text-secondary">Prévia</span>
              <div className="rounded-[18px] bg-[var(--l4-fill-5)] p-3">
                <div className="ml-auto max-w-[90%] whitespace-pre-wrap rounded-[19px] rounded-br-[5px] bg-brand px-3.5 py-2 text-[13.5px] leading-[1.4] text-white">
                  {texto}
                </div>
              </div>
              <ul className="flex flex-col gap-1.5 text-[12px]">
                <li className="flex items-center gap-2 text-text-strong">
                  {bloqueado ? <AlertTriangle className="size-4 text-error-text" /> : <CheckCircle2 className="size-4 text-success-text" />}
                  {bloqueado ? "Cliente pediu para não receber mensagens (opt-out no iON)" : "Sem opt-out no iON"}
                </li>
                <li className="flex items-center gap-2 text-text-strong">
                  <CheckCircle2 className="size-4 text-success-text" /> Template {t.categoria.toLowerCase()} · custo Meta {t.custo} por mensagem
                </li>
                <li className="flex items-center gap-2 text-text-strong">
                  <CheckCircle2 className="size-4 text-success-text" /> Seu limite de hoje: 12 de 50 chamadas
                </li>
              </ul>
            </div>
          </div>
        </ModalBody>
        <ModalActions
          cancelar={{ onClick: onFechar }}
          primaria={{
            label: "Enviar template e abrir conversa",
            disabled: !nome.trim() || !telOk || bloqueado,
            title: bloqueado ? "Opt-out: este cliente não pode receber" : undefined,
            onClick: () => onCriar({ nome: nome.trim(), telefone, texto }),
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
