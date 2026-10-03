import { useEffect } from "react";
import { Button } from "@l4-web/ui";
import { Clock, LayoutGrid } from "lucide-react";
import { recursosDe } from "../../features/bolao/recursos";
import { garantirSemente, simularPagamento, useLoja } from "../../features/bolao/loja";
import { brl, mmss } from "../../features/bolao/formato";
import { useAgora } from "./useAgora";

/**
 * A faixa fina entre a thread e a caixa de mensagem.
 *
 * As AÇÕES do produto (enviar bolões, arte, carrinho) moram todas no painel lateral;
 * aqui fica só o que é STATUS e precisa ser visto sem abrir nada: o Pix aguardando.
 * No celular, onde o painel é uma folha fechada, entra também o atalho que a abre:
 * sem ele a vendedora não tinha como chegar nos bolões pelo telefone (o único gatilho
 * era tocar no nome do contato, e nada dizia que aquilo era tocável).
 */
export function AcoesProduto({
  produtoSlug,
  conversaId,
  nomeCliente,
  onAbrirPainel,
}: {
  produtoSlug: string | null;
  conversaId: string;
  nomeCliente: string;
  /** Só quando o painel não está na tela (celular). */
  onAbrirPainel?: () => void;
}) {
  const r = recursosDe(produtoSlug);
  // A semente nasce aqui também: no celular o painel fica fechado, e a cobrança
  // aberta do Paulo sumia da faixa até alguém abrir a folha.
  useEffect(() => garantirSemente(conversaId, nomeCliente), [conversaId, nomeCliente]);
  const loja = useLoja();
  const agora = useAgora();
  if (r.paineis.length <= 1) return null;

  const cob = loja.cobrancas[conversaId];
  const pendente = cob?.status === "pendente";
  const nCarrinho = (loja.carrinhos[conversaId] ?? []).reduce((s, i) => s + i.cotas, 0);
  if (!pendente && !onAbrirPainel) return null;

  return (
    <div className="flex items-center gap-2 border-t-[0.5px] border-border-muted px-3 pt-2.5">
      {onAbrirPainel && (
        <Button size="sm" variant="outline" className="flex-none" onClick={onAbrirPainel}>
          <LayoutGrid className="size-3.5" aria-hidden />
          Bolões
          {nCarrinho > 0 && <span className="tabular-nums">· {nCarrinho} no carrinho</span>}
        </Button>
      )}
      {pendente && (
        <div className="flex min-w-0 flex-1 items-center justify-between gap-2 rounded-[14px] bg-warn-bg py-1 pl-3 pr-1">
          <span className="flex min-w-0 items-center gap-1.5 text-[12.5px] text-text-strong">
            <Clock className="size-4 flex-none text-warn-text" />
            <span className="truncate">
              <b>Pix</b> <span className="tabular-nums">{brl(cob.valor)} · {mmss(cob.venceEm - agora)}</span>
            </span>
          </span>
          <Button
            size="sm"
            variant="success"
            className="flex-none"
            onClick={() => simularPagamento(conversaId, nomeCliente)}
            title="Simula o evento `paga` que o módulo do bolão manda depois do webhook da Idea"
          >
            {/* No celular a faixa divide a linha com o atalho, e o valor do Pix é
                o que não pode sumir: o botão encurta. */}
            {onAbrirPainel ? "Pago" : "Simular pago"}
          </Button>
        </div>
      )}
    </div>
  );
}
