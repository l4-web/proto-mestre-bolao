import { useEffect, useMemo, useState } from "react";
import { Badge, Button, Eyebrow, Input, SelectPill, Tabs, useToast } from "@l4-web/ui";
import { CheckCircle2, Clock, Copy, Lock, Trash2, XCircle } from "lucide-react";
import type { Consulta, ConversaDetalhe } from "../../features/atendimento/tipos";
import { Grupo, PainelContexto } from "../conversa/PainelContexto";
import { CardBolao } from "./CardBolao";
import { useAgora } from "./useAgora";
import { recursosDe, type PainelId } from "../../features/bolao/recursos";
import {
  adicionarAoCarrinho,
  bolaoPorId,
  clienteDe,
  definirCpf,
  enviarBoloes,
  garantirSemente,
  gerarPix,
  removerDoCarrinho,
  simularExpiracao,
  simularPagamento,
  totalDoCarrinho,
  useLoja,
} from "../../features/bolao/loja";
import { brl, mmss } from "../../features/bolao/formato";

const ROTULO_PAINEL: Record<PainelId, string> = {
  catalogo: "Bolões do dia",
  carrinho: "Carrinho",
  cliente: "Cliente",
  consulta: "Consulta",
};

/**
 * O painel lateral montado pela CONFIGURAÇÃO DO PRODUTO.
 *
 * Produto com um painel só (APCAP VIP) cai no `PainelContexto` de sempre, intacto.
 * Produto com vários vira abas. A aba é controlada de fora porque os botões abaixo
 * da caixa de mensagem ("Carrinho", "Cliente") abrem a aba certa.
 */
export function PainelProduto({
  conversa,
  consulta,
  veFinanceiro,
  onVerHistorico,
  aba,
  onAba,
  onArte,
}: {
  conversa: ConversaDetalhe;
  consulta?: Consulta;
  veFinanceiro: boolean;
  onVerHistorico?: (contatoId: string, nome: string) => void;
  aba: PainelId;
  onAba: (p: PainelId) => void;
  onArte: (bolaoId: string) => void;
}) {
  const r = recursosDe(conversa.produto_slug);
  useEffect(() => garantirSemente(conversa.id, conversa.contato.nome), [conversa.id, conversa.contato.nome]);
  const loja = useLoja();
  const nCarrinho = (loja.carrinhos[conversa.id] ?? []).reduce((s, i) => s + i.cotas, 0);

  if (r.paineis.length <= 1) {
    return (
      <PainelContexto
        conversa={conversa}
        consulta={consulta}
        veFinanceiro={veFinanceiro}
        onVerHistorico={onVerHistorico}
      />
    );
  }

  const abaAtual = r.paineis.includes(aba) ? aba : r.paineis[0];

  return (
    <div className="flex flex-col gap-2.5">
      <Tabs
        tabs={r.paineis.map((p) => ({
          id: p,
          label: ROTULO_PAINEL[p],
          badge: p === "carrinho" && nCarrinho > 0 ? nCarrinho : undefined,
        }))}
        activeTab={abaAtual}
        onChange={onAba}
      />
      {abaAtual === "catalogo" && (
        <AbaCatalogo conversaId={conversa.id} fonte={r.provedorCatalogo?.nome} onArte={onArte} onAdicionou={() => onAba("carrinho")} />
      )}
      {abaAtual === "carrinho" && <AbaCarrinho conversa={conversa} fonte={r.provedorCobranca?.nome} />}
      {abaAtual === "cliente" && (
        <>
          <AbaCliente conversa={conversa} fonte={r.fonteCliente} />
          <PainelContexto
            conversa={conversa}
            consulta={consulta}
            veFinanceiro={veFinanceiro}
            onVerHistorico={onVerHistorico}
            semConsulta
          />
        </>
      )}
    </div>
  );
}

function AbaCatalogo({
  conversaId,
  fonte,
  onArte,
  onAdicionou,
}: {
  conversaId: string;
  fonte?: string;
  onArte: (id: string) => void;
  onAdicionou: () => void;
}) {
  const { boloes } = useLoja();
  const [modalidade, setModalidade] = useState("");
  const [marcados, setMarcados] = useState<string[]>([]);
  const { toast } = useToast();
  // Trocar de conversa limpa a seleção: marcar bolões para um cliente e mandar para
  // o próximo seria o pior engano possível aqui.
  useEffect(() => setMarcados([]), [conversaId]);
  const modalidades = useMemo(() => [...new Set(boloes.map((b) => b.modalidade))], [boloes]);
  const lista = boloes.filter((b) => !modalidade || b.modalidade === modalidade);
  const alternar = (id: string) =>
    setMarcados((m) => (m.includes(id) ? m.filter((x) => x !== id) : [...m, id]));

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2 px-1">
        <Eyebrow>Estoque em tempo real</Eyebrow>
        {fonte && <Origem>{fonte}</Origem>}
      </div>
      <SelectPill
        value={modalidade}
        onChange={setModalidade}
        options={[{ value: "", label: "Todas as modalidades" }, ...modalidades.map((m) => ({ value: m, label: m }))]}
        block
      />
      {lista.map((b) => (
        <CardBolao
          key={b.id}
          bolao={b}
          selecionado={marcados.includes(b.id)}
          onSelecionar={() => alternar(b.id)}
          onArte={() => onArte(b.id)}
          onCarrinho={() => {
            if (adicionarAoCarrinho(conversaId, b.id)) {
              toast({ title: "Cota reservada por 30 min", description: `${b.modalidade} ${b.concurso} saiu da vitrine de todas as vendedoras.` });
              onAdicionou();
            }
          }}
        />
      ))}
      {/* A ação do lote fica GRUDADA no fim da coluna enquanto há seleção: rolar até o
          último card para achar o botão faria a vendedora perder a conta do que marcou. */}
      <div className="sticky bottom-0 rounded-[18px] bg-surface p-1 shadow-[var(--l4-sh-rest)]">
        <Button
          variant="filled"
          className="w-full"
          disabled={marcados.length === 0}
          onClick={() => {
            enviarBoloes(conversaId, marcados);
            toast({ title: marcados.length > 1 ? `${marcados.length} bolões enviados` : "Bolão enviado", description: "Cada um com a arte e o botão Quero minha cota." });
            setMarcados([]);
          }}
        >
          {marcados.length === 0
            ? "Marque os bolões para enviar"
            : marcados.length === 1
              ? "Enviar 1 bolão na conversa"
              : `Enviar ${marcados.length} bolões na conversa`}
        </Button>
      </div>
    </div>
  );
}

function AbaCarrinho({ conversa, fonte }: { conversa: ConversaDetalhe; fonte?: string }) {
  const loja = useLoja();
  const agora = useAgora();
  const { toast } = useToast();
  const id = conversa.id;
  const itens = loja.carrinhos[id] ?? [];
  const cob = loja.cobrancas[id];
  const cliente = clienteDe(conversa.contato.nome, conversa.contato.telefone, id);
  const [cpf, setCpf] = useState(cliente.cpf ?? "");
  const cpfOk = cpf.replace(/\D/g, "").length === 11;

  return (
    <div className="flex flex-col gap-2.5">
      {cob && (
        <Grupo titulo="Cobrança" origem={fonte}>
          <div className="flex flex-col gap-2 rounded-[12px] bg-[var(--l4-fill-5)] p-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[15px] font-bold tabular-nums text-text-strong">{brl(cob.valor)}</span>
              {cob.status === "pendente" && <Badge variant="warn" size="xs">Aguardando pagamento</Badge>}
              {cob.status === "paga" && <Badge variant="success" size="xs">Pago</Badge>}
              {cob.status === "expirada" && <Badge variant="error" size="xs">Expirado</Badge>}
            </div>
            {cob.status === "pendente" && (
              <>
                <span className="flex items-center gap-1.5 text-[12px] text-warn-text">
                  <Clock className="size-3.5" /> vence em {mmss(cob.venceEm - agora)}
                </span>
                <code className="block truncate rounded-[8px] bg-surface px-2 py-1 font-mono text-[10.5px] text-text-secondary">
                  {cob.copiaECola}
                </code>
                <div className="flex flex-wrap gap-1.5">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      void navigator.clipboard?.writeText(cob.copiaECola);
                      toast({ title: "Código Pix copiado" });
                    }}
                  >
                    <Copy className="size-3.5" /> Copiar
                  </Button>
                </div>
                <div className="mt-1 flex flex-col gap-1.5 border-t-[0.5px] border-border-muted pt-2">
                  <span className="text-[10.5px] font-medium uppercase tracking-wide text-text-secondary">
                    Simular retorno da Idea
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    <Button size="sm" variant="success" onClick={() => simularPagamento(id, cliente.nome)}>
                      <CheckCircle2 className="size-3.5" /> Cliente pagou
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => simularExpiracao(id)}>
                      <XCircle className="size-3.5" /> Pix expirou
                    </Button>
                  </div>
                </div>
              </>
            )}
            {cob.status === "paga" && (
              <p className="text-[11.5px] leading-snug text-text-secondary">
                Pago. Estoque baixado, cotas no CPF e venda atribuída a <b>{cob.vendedora}</b>. O canhoto endossado chega na conversa sozinho.
              </p>
            )}
            {cob.status === "expirada" && (
              <p className="text-[11.5px] leading-snug text-text-secondary">
                Expirou sem pagamento e as cotas voltaram ao estoque. Monte o carrinho de novo para gerar outro Pix.
              </p>
            )}
            <ul className="flex flex-col gap-0.5">
              {cob.itens.map((i) => {
                const b = bolaoPorId(i.bolaoId);
                return (
                  <li key={i.bolaoId} className="text-[11.5px] text-text-secondary">
                    {i.cotas}× {b?.modalidade} {b?.concurso}
                  </li>
                );
              })}
            </ul>
          </div>
        </Grupo>
      )}

      <Grupo titulo="Carrinho desta conversa" origem="API Mestre do Bolão">
        {itens.length === 0 ? (
          <p className="px-1 py-1 text-[11.5px] leading-snug text-text-secondary">
            Vazio. Adicione cotas pela aba Bolões do dia: cada cota fica segura por 30 minutos e some da vitrine das outras vendedoras.
          </p>
        ) : (
          itens.map((i) => {
            const b = bolaoPorId(i.bolaoId);
            if (!b) return null;
            return (
              <div key={i.bolaoId} className="flex items-center gap-2 rounded-[12px] bg-[var(--l4-fill-5)] px-2.5 py-2">
                <span className="size-2 flex-none rounded-full" style={{ background: b.cor }} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[12.5px] font-semibold text-text-strong">
                    {i.cotas}× {b.modalidade} {b.concurso}
                  </p>
                  <p className="flex items-center gap-1 text-[10.5px] text-text-secondary">
                    <Lock className="size-3" /> segura por {mmss(i.reservadaAte - agora)}
                  </p>
                </div>
                <span className="text-[12.5px] font-semibold tabular-nums text-text-strong">{brl(b.precoCota * i.cotas)}</span>
                <button
                  type="button"
                  aria-label="Tirar do carrinho e devolver a cota"
                  title="Tirar do carrinho e devolver a cota"
                  onClick={() => removerDoCarrinho(id, i.bolaoId)}
                  className="l4-pressable flex size-7 items-center justify-center rounded-full text-text-secondary hover:bg-[var(--l4-fill-3)]"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            );
          })
        )}
      </Grupo>

      {itens.length > 0 && (
        <Grupo titulo="Fechar a venda">
          <div className="flex flex-col gap-2 px-1 py-1">
            <Input
              label="CPF do comprador"
              value={cpf}
              onChange={(e) => setCpf(e.currentTarget.value)}
              placeholder="000.000.000-00"
              helper="A cota fica no CPF, e o prêmio pequeno é pago por Pix nessa chave."
              error={cpf && !cpfOk ? "CPF incompleto" : undefined}
            />
            <div className="flex items-center justify-between">
              <span className="text-[12px] text-text-secondary">Total</span>
              <span className="text-[17px] font-bold tabular-nums text-text-strong">{brl(totalDoCarrinho(id))}</span>
            </div>
            <Button
              variant="filled"
              disabled={!cpfOk || cob?.status === "pendente"}
              title={cob?.status === "pendente" ? "Já existe um Pix aguardando nesta conversa" : undefined}
              onClick={() => {
                definirCpf(id, cpf);
                gerarPix(id);
              }}
            >
              Gerar Pix e enviar na conversa
            </Button>
            <p className="text-[10.5px] leading-snug text-text-secondary">
              O Atende Aí pede a cobrança ao módulo do bolão, que gera o Pix na Idea. A confirmação volta por evento.
            </p>
          </div>
        </Grupo>
      )}
    </div>
  );
}

function AbaCliente({ conversa, fonte }: { conversa: ConversaDetalhe; fonte?: string }) {
  useLoja();
  const c = clienteDe(conversa.contato.nome, conversa.contato.telefone, conversa.id);
  const cpfMascara = c.cpf ? `***.${c.cpf.slice(4, 7)}.${c.cpf.slice(8, 11)}-**` : null;
  const linhas: [string, string | null][] = [
    ["Telefone", c.telefone || null],
    ["CPF", cpfMascara],
    ["Origem do lead", c.origem],
    ["Campanha", c.campanha ?? null],
    ["UTM", c.utm ?? null],
    ["Vendedora", c.vendedora],
    ["Cliente desde", c.desde ?? "primeira compra"],
  ];
  return (
    <>
      <Grupo titulo="Cliente" origem={fonte}>
        <div className="px-1 pb-1">
          <p className="text-[14px] font-semibold text-text-strong">{c.nome}</p>
        </div>
        {linhas.map(([k, v]) => (
          <div key={k} className="flex items-start justify-between gap-3 rounded-[10px] px-1 py-1">
            <span className="flex-none text-[11.5px] text-text-secondary">{k}</span>
            <span className="min-w-0 break-words text-right text-[11.5px] font-medium text-text-strong">
              {v ?? <span className="font-normal italic text-text-secondary">não informado</span>}
            </span>
          </div>
        ))}
      </Grupo>
      <Grupo titulo="Compras" origem={fonte}>
        {c.compras.length === 0 ? (
          <p className="px-1 py-1 text-[11.5px] text-text-secondary">Nenhuma compra no iON ainda.</p>
        ) : (
          c.compras.map((x, i) => (
            <div key={i} className="flex items-center justify-between gap-2 rounded-[12px] bg-[var(--l4-fill-5)] px-2.5 py-1.5">
              <div className="min-w-0">
                <p className="truncate text-[12px] text-text-strong">{x.descricao}</p>
                <p className="text-[10.5px] text-text-secondary">{x.data}</p>
              </div>
              <div className="flex flex-none flex-col items-end gap-0.5">
                <span className="text-[12px] font-semibold tabular-nums">{brl(x.valor)}</span>
                <Badge size="xs" variant={x.status === "premiada" ? "success" : x.status === "pendente" ? "warn" : "neutral"}>
                  {x.status}
                </Badge>
              </div>
            </div>
          ))
        )}
        {c.premios.map((p) => (
          <p key={p.concurso} className="px-1 pt-1 text-[11.5px] font-medium text-success-text">
            Prêmio: {p.concurso} · {brl(p.valor)}
          </p>
        ))}
      </Grupo>
    </>
  );
}

function Origem({ children }: { children: string }) {
  return (
    <span className="rounded-full bg-[var(--l4-fill-4)] px-1.5 py-px font-mono text-[9.5px] text-text-secondary">
      {children}
    </span>
  );
}
