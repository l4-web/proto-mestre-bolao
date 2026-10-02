import { useEffect, useRef, useState } from "react";
import { Check, ChevronsUpDown, Package } from "lucide-react";
import { Button, cn } from "@l4-web/ui";
import { useProduto } from "../../lib/produto-contexto";

/**
 * ⚠️ As cores saem dos TOKENS do DS, nunca de branco assado.
 *
 * A primeira versão foi portada do Reporta, que tem a barra lateral ESCURA, e trouxe
 * `text-white/40` junto. Na barra CLARA do Atende Aí isso vira branco sobre branco: o
 * rótulo "Produto" ficou invisível na tela, e o nome do produto quase.
 *
 * É a regra do design system: cor nova nunca vai assada na classe, porque ela também
 * é o que quebra a troca de tema.
 */

/**
 * A logo do produto, dirigida por DADO e sem asset local.
 *
 * A foto vem do catálogo global, que é a fonte compartilhada entre os módulos: o mesmo
 * produto tem a mesma cara no Reporta e aqui. Sem foto, ou com a foto quebrada, cai no
 * ícone genérico em vez de deixar um quadrado vazio.
 */
function LogoDoProduto({ foto, nome }: { foto?: string | null; nome: string }) {
  const [quebrou, setQuebrou] = useState(false);
  // Reseta ao trocar de foto: sem isto um erro antigo prende a imagem nova.
  useEffect(() => setQuebrou(false), [foto]);

  if (foto && !quebrou) {
    return (
      <img
        src={foto}
        alt={nome}
        onError={() => setQuebrou(true)}
        className="h-full w-full rounded-lg object-contain"
      />
    );
  }
  return <Package className="h-4 w-4" aria-hidden />;
}

/**
 * O seletor de produto no topo da barra lateral, no mesmo padrão do Reporta.
 *
 * É o ESCOPO do módulo: vale para conversas, comentários e escuta ao mesmo tempo, e
 * não um filtro por tela. Por isso mora na barra lateral e não no cabeçalho de cada
 * página: filtro de tela some quando a pessoa navega, escopo de módulo não.
 *
 * Com um produto só vira bloco estático, sem popover: oferecer um menu que só tem a
 * opção já marcada ensina a clicar em coisa que não faz nada.
 */
export function SeletorProduto() {
  const { produtos, produto, setProduto } = useProduto();
  const [aberto, setAberto] = useState(false);
  const caixa = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!aberto) return;
    const foraDaCaixa = (e: MouseEvent) => {
      if (caixa.current && !caixa.current.contains(e.target as Node)) setAberto(false);
    };
    const escape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAberto(false);
    };
    document.addEventListener("mousedown", foraDaCaixa);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("mousedown", foraDaCaixa);
      document.removeEventListener("keydown", escape);
    };
  }, [aberto]);

  if (produtos.length === 0) return null;
  const atual = produtos.find((p) => p.slug === produto) ?? produtos[0]!;

  if (produtos.length === 1) {
    return (
      <div className="flex items-center gap-2.5 px-3 pb-1 pt-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-[var(--l4-fill-4)] text-text-secondary">
          <LogoDoProduto foto={atual.foto} nome={atual.nome} />
        </span>
        <div className="flex min-w-0 flex-col">
          <span className="text-[9px] font-semibold uppercase tracking-wider text-text-secondary">
            Produto
          </span>
          <span className="truncate text-[13.5px] font-bold text-text-strong">{atual.nome}</span>
        </div>
      </div>
    );
  }

  return (
    <div ref={caixa} className="relative px-3 pb-1 pt-3">
      <Button
        variant="plain"
        onClick={() => setAberto((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={aberto}
        className="flex w-full items-center gap-2.5 rounded-[14px] bg-[var(--l4-fill-5)] px-2.5 py-2 text-left hover:bg-[var(--l4-fill-4)]"
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-[var(--l4-fill-4)] text-text-secondary">
          <LogoDoProduto foto={atual.foto} nome={atual.nome} />
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="text-[9px] font-semibold uppercase tracking-wider text-text-secondary">
            Produto
          </span>
          <span className="truncate text-[13.5px] font-bold text-text-strong">{atual.nome}</span>
        </span>
        <ChevronsUpDown className="size-3.5 shrink-0 text-text-secondary" aria-hidden />
      </Button>

      {aberto && (
        <div
          role="listbox"
          className="absolute inset-x-3 top-[calc(100%-0.25rem)] z-30 overflow-hidden rounded-[14px] bg-[var(--l4-surface)] py-1 shadow-lg ring-1 ring-black/10"
        >
          {produtos.map((p) => (
            <button
              key={p.slug}
              type="button"
              role="option"
              aria-selected={p.slug === produto}
              onClick={() => {
                setAberto(false);
                setProduto(p.slug);
              }}
              className={cn(
                "flex w-full items-center gap-2 px-2.5 py-2 text-left text-[13px] hover:bg-fill-2",
                p.slug === produto ? "font-semibold text-text-strong" : "text-text-secondary",
              )}
            >
              <span className="flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden rounded-md">
                <LogoDoProduto foto={p.foto} nome={p.nome} />
              </span>
              <span className="min-w-0 flex-1 truncate">{p.nome}</span>
              {p.slug === produto && <Check className="size-3.5 shrink-0" aria-hidden />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
