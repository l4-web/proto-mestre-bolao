import { Badge, Button } from "@l4-web/ui";
import { ImagePlus, Plus } from "lucide-react";
import type { Bolao } from "../../features/bolao/tipos";
import { brl } from "../../features/bolao/formato";

/**
 * O card genérico de ITEM DE CATÁLOGO, na variante bolão.
 *
 * A borda e o nome levam a cor da modalidade (a mesma do volante da CAIXA), porque
 * é por ela que a vendedora acha o bolão de olho, antes de ler. A barra é a venda:
 * quanto já saiu do total, que é o que cria urgência na conversa.
 */
export function CardBolao({
  bolao,
  onArte,
  onCarrinho,
}: {
  bolao: Bolao;
  onArte?: () => void;
  onCarrinho?: () => void;
}) {
  const vendidas = bolao.cotasTotal - bolao.cotasLivres;
  const esgotado = bolao.cotasLivres === 0;
  return (
    <article
      className="relative overflow-hidden rounded-[16px] bg-surface p-3 pl-4 shadow-[var(--l4-sh-rest)]"
      style={{ borderLeft: `4px solid ${bolao.cor}` }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[15px] font-bold" style={{ color: bolao.cor }}>
              {bolao.modalidade}
            </span>
            {bolao.selo && (
              <Badge size="xs" variant="warn">
                {bolao.selo}
              </Badge>
            )}
          </div>
          <p className="text-[11.5px] text-text-secondary">
            Concurso {bolao.concurso} · {bolao.sorteio}
          </p>
          <p className="text-[11.5px] text-text-secondary">
            {bolao.jogos} jogos × {bolao.dezenas} dezenas · {bolao.loterica}
          </p>
        </div>
        <div className="flex-none text-right">
          <p className="text-[15px] font-bold tabular-nums text-text-strong">{brl(bolao.precoCota)}</p>
          <p className="text-[10.5px] text-text-secondary">por cota</p>
        </div>
      </div>

      <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-[var(--l4-fill-4)]">
        <div
          className="h-full rounded-full"
          style={{ width: `${(vendidas / bolao.cotasTotal) * 100}%`, background: bolao.cor }}
        />
      </div>

      <div className="mt-2.5 flex items-center justify-between gap-2">
        <span className="text-[12px] text-text-strong">
          {esgotado ? (
            <span className="font-semibold text-error-text">Esgotado</span>
          ) : (
            <>
              <b className="tabular-nums">{bolao.cotasLivres}</b> de {bolao.cotasTotal} cotas livres
            </>
          )}
        </span>
        <span className="flex gap-1.5">
          {onArte && (
            <Button size="sm" variant="outline" onClick={onArte} title="Abrir o Cria Aí com este bolão">
              <ImagePlus className="size-3.5" aria-hidden />
              Arte
            </Button>
          )}
          {onCarrinho && (
            <Button size="sm" variant="filled" onClick={onCarrinho} disabled={esgotado} title="Segura 1 cota por 30 min">
              <Plus className="size-3.5" aria-hidden />
              Carrinho
            </Button>
          )}
        </span>
      </div>
    </article>
  );
}
