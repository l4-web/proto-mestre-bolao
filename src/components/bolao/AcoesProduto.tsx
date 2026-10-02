import { useEffect, type ComponentType } from "react";
import { Button } from "@l4-web/ui";
import { ImagePlus, LayoutGrid, ShoppingCart, UserRound, Clock } from "lucide-react";
import { recursosDe, type AcaoId } from "../../features/bolao/recursos";
import { garantirSemente, simularPagamento, useLoja } from "../../features/bolao/loja";
import { brl, mmss } from "../../features/bolao/formato";
import { useAgora } from "./useAgora";

const ACOES: Record<AcaoId, { label: string; icon: ComponentType<{ className?: string }> }> = {
  enviar_catalogo: { label: "Enviar bolões", icon: LayoutGrid },
  criar_arte: { label: "Criar arte", icon: ImagePlus },
  carrinho: { label: "Carrinho", icon: ShoppingCart },
  cliente: { label: "Cliente", icon: UserRound },
};

/**
 * A faixa entre a thread e a caixa de mensagem: a cobrança aberta (quando há) e os
 * botões que o PRODUTO pediu. Produto sem ações (APCAP VIP) não desenha nada.
 */
export function AcoesProduto({
  produtoSlug,
  conversaId,
  nomeCliente,
  onAcao,
}: {
  produtoSlug: string | null;
  conversaId: string;
  nomeCliente: string;
  onAcao: (a: AcaoId) => void;
}) {
  const r = recursosDe(produtoSlug);
  // A semente também nasce aqui: no celular o painel lateral fica numa folha
  // fechada, e a cobrança aberta do Paulo sumia da faixa até alguém abrir a folha.
  useEffect(() => garantirSemente(conversaId, nomeCliente), [conversaId, nomeCliente]);
  const loja = useLoja();
  const agora = useAgora();
  const cob = loja.cobrancas[conversaId];
  if (r.acoes.length === 0) return null;
  const nCarrinho = (loja.carrinhos[conversaId] ?? []).reduce((s, i) => s + i.cotas, 0);

  return (
    <div className="flex flex-col gap-2 border-t-[0.5px] border-border-muted px-3 pt-2.5">
      {cob?.status === "pendente" && (
        <div className="flex items-center justify-between gap-2 rounded-[14px] bg-warn-bg py-1.5 pl-3 pr-1.5">
          <span className="flex min-w-0 items-center gap-1.5 text-[12.5px] text-text-strong">
            <Clock className="size-4 flex-none text-warn-text" />
            <span className="truncate">
              <b>Pix</b> <span className="tabular-nums">{brl(cob.valor)} · {mmss(cob.venceEm - agora)}</span>
            </span>
          </span>
          <Button size="sm" variant="success" className="flex-none" onClick={() => simularPagamento(conversaId, nomeCliente)} title="Simula o evento `paga` que o módulo do bolão manda depois do webhook da Idea">
            Simular pago
          </Button>
        </div>
      )}
      {/* Uma linha só, rolando de lado no celular: em duas linhas os botões comiam a
          altura da thread, que é o que a vendedora precisa ler. */}
      <div className="-mx-3 flex gap-1.5 overflow-x-auto px-3 pb-0.5 [scrollbar-width:none]">
        {r.acoes.map((a) => {
          const { label, icon: Icon } = ACOES[a];
          return (
            <Button key={a} size="sm" variant="outline" className="flex-none" onClick={() => onAcao(a)}>
              <Icon className="size-3.5" aria-hidden />
              {label}
              {a === "carrinho" && nCarrinho > 0 && <span className="tabular-nums">({nCarrinho})</span>}
            </Button>
          );
        })}
      </div>
    </div>
  );
}
