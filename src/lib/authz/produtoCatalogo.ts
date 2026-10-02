import { useEffect, useState } from "react";

/**
 * O CATÁLOGO GLOBAL de produtos, lido do core.
 *
 * Fonte única: `GET <MASTER_URL>/api/authz/produtos?module=atendeai`, a mesma do
 * Reporta e dos outros módulos. Existe um slug GLOBAL por produto e não há tradução
 * nem slug local: dois catálogos divergem na primeira correção, e aí o mesmo produto
 * aparece com dois nomes em dois módulos do mesmo OS.
 *
 * O Atende Aí guarda localmente só o OPT-IN (`atd_praca_produto`: quais produtos esta
 * praça atende) e a configuração local (régua, marca no iOn). O NOME de tela vem
 * daqui, e é por isso que esta peça existe em vez de o seletor ler o `rotulo` local:
 * o rótulo local é último recurso, não fonte.
 *
 * Falha é tolerada em silêncio: cai no cache e, sem ele, em lista vazia. O seletor
 * continua funcionando com o slug humanizado, e nenhuma tela quebra porque o core
 * piscou.
 */
const MASTER_URL = import.meta.env.VITE_MASTER_URL ?? "";
const MODULE = "atendeai";
const CACHE_KEY = "atendeai_produto_catalogo_v1";

export interface ProdutoGlobal {
  /** Slug GLOBAL do catálogo central. É o valor gravado em `produto_slug`. */
  slug: string;
  nome?: string | null;
  foto_url?: string | null;
}

/**
 * Último recurso de rótulo: humaniza o slug.
 *
 * `dispara_ai` vira "Dispara Ai". É feio e nunca mente, que é a mesma regra do
 * backend quando o produto não tem rótulo: verdade feia é melhor que nome inventado.
 */
export function humanizarSlug(slug: string): string {
  return slug
    .split(/[_-]+/)
    .filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(" ");
}

function lerCache(): ProdutoGlobal[] | null {
  try {
    const bruto = window.localStorage.getItem(CACHE_KEY);
    const lista = bruto ? (JSON.parse(bruto) as ProdutoGlobal[]) : null;
    return Array.isArray(lista) ? lista : null;
  } catch {
    return null;
  }
}

async function buscar(): Promise<ProdutoGlobal[]> {
  const r = await fetch(`${MASTER_URL}/api/authz/produtos?module=${MODULE}`, {
    credentials: "include",
  });
  if (!r.ok) throw new Error(`produtos ${r.status}`);
  const j = (await r.json()) as { produtos?: ProdutoGlobal[] };
  const lista = Array.isArray(j?.produtos) ? j.produtos.filter((p) => p?.slug) : [];
  try {
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(lista));
  } catch {
    /* quota ou janela anônima: segue sem cache */
  }
  return lista;
}

// Memoiza: vários consumidores no mesmo carregamento viram uma requisição só.
let emVoo: Promise<ProdutoGlobal[]> | null = null;

export function useCatalogoDeProdutos(): { produtos: ProdutoGlobal[]; nomeDe: (slug: string) => string } {
  const [produtos, setProdutos] = useState<ProdutoGlobal[]>(() => lerCache() ?? []);

  useEffect(() => {
    let vivo = true;
    (emVoo ??= buscar().catch(() => lerCache() ?? [])).then((l) => {
      if (vivo) setProdutos(l);
    });
    return () => {
      vivo = false;
    };
  }, []);

  const nomeDe = (slug: string) =>
    produtos.find((p) => p.slug === slug)?.nome?.trim() || humanizarSlug(slug);

  return { produtos, nomeDe };
}
