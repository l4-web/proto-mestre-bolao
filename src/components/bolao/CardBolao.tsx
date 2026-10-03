import { Badge, Button, Checkbox } from "@l4-web/ui";
import { ImagePlus, Plus } from "lucide-react";
import type { Bolao } from "../../features/bolao/tipos";
import { brl } from "../../features/bolao/formato";

/**
 * O card genérico de ITEM DE CATÁLOGO, na variante bolão.
 *
 * Mesma superfície dos grupos do painel (cartão do DS, sem borda). A cor da
 * modalidade fica num PONTO antes do nome e na barra de venda, nunca numa borda
 * grossa: borda colorida não existe no DS e transformava a coluna num varal de
 * listras. Quem carrega a cor é o ponto, como nos indicadores.
 */
export function CardBolao({
  bolao,
  selecionado,
  onSelecionar,
  onArte,
  onCarrinho,
}: {
  bolao: Bolao;
  selecionado?: boolean;
  onSelecionar?: () => void;
  onArte?: () => void;
  onCarrinho?: () => void;
}) {
  const vendidas = bolao.cotasTotal - bolao.cotasLivres;
  const esgotado = bolao.cotasLivres === 0;
  return (
    <article className="rounded-[18px] bg-surface p-3 shadow-[var(--l4-sh-rest)]">
      <div className="flex items-start gap-2.5">
        {onSelecionar && (
          <Checkbox
            checked={Boolean(selecionado)}
            onCheckedChange={onSelecionar}
            disabled={esgotado}
            aria-label={`Selecionar ${bolao.modalidade} ${bolao.concurso} para enviar`}
            className="mt-0.5 flex-none"
          />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="size-2 flex-none rounded-full" style={{ background: bolao.cor }} />
                <span className="text-[14px] font-semibold text-text-strong">{bolao.modalidade}</span>
                {bolao.selo && (
                  <Badge size="xs" variant="warn">
                    {bolao.selo}
                  </Badge>
                )}
              </div>
              <p className="mt-0.5 text-[11.5px] text-text-secondary">
                Concurso {bolao.concurso} · {bolao.sorteio}
              </p>
              <p className="text-[11.5px] text-text-secondary">
                {bolao.jogos} jogos × {bolao.dezenas} dezenas · {bolao.loterica}
              </p>
            </div>
            <div className="flex-none text-right">
              <p className="text-[14px] font-semibold tabular-nums text-text-strong">{brl(bolao.precoCota)}</p>
              <p className="text-[10.5px] text-text-secondary">por cota</p>
            </div>
          </div>

          <div className="mt-2 flex items-center gap-2">
            <div className="h-1 flex-1 overflow-hidden rounded-full bg-[var(--l4-fill-4)]">
              <div
                className="h-full rounded-full"
                style={{ width: `${(vendidas / bolao.cotasTotal) * 100}%`, background: bolao.cor }}
              />
            </div>
            {/* Uma linha só: "13 de 20 cotas livres" quebrava em três na coluna estreita. */}
            <span className="flex-none whitespace-nowrap text-[11.5px] tabular-nums text-text-secondary">
              {esgotado ? (
                <span className="font-semibold text-error-text">Esgotado</span>
              ) : (
                <>
                  <b className="text-text-strong">{bolao.cotasLivres}</b>/{bolao.cotasTotal} livres
                </>
              )}
            </span>
          </div>

          {(onArte || onCarrinho) && (
            <div className="mt-2.5 flex justify-end gap-1.5">
              {onArte && (
                <Button size="sm" variant="outline" onClick={onArte} title="Abrir o Cria Aí com este bolão">
                  <ImagePlus className="size-3.5" aria-hidden />
                  Arte
                </Button>
              )}
              {onCarrinho && (
                <Button size="sm" variant="tinted" onClick={onCarrinho} disabled={esgotado} title="Segura 1 cota por 30 min">
                  <Plus className="size-3.5" aria-hidden />
                  Carrinho
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </article>
  );
}
