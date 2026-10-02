import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useCatalogoDeProdutos } from "./authz/produtoCatalogo";
import { usePracaQuery } from "../features/atendimento/atendimento.api";
import { ProdutoCtx, type Produto } from "./produto-contexto";

/**
 * O PRODUTO em que o módulo está, igual ao Reporta.
 *
 * ⚠️ Isto muda uma premissa escrita no código do módulo: a fila nasceu MISTA de
 * propósito, porque cada produto tem o seu número e todos caem na mesma caixa. Com o
 * seletor, quem atende dois produtos e deixa um selecionado vê metade da fila. Foi
 * decidido assim para o Atende Aí ficar consistente com os outros módulos do OS, e o
 * efeito é conhecido, não defeito.
 *
 * A lista vem do cruzamento de duas fontes, e as duas são necessárias:
 *
 * - o OPT-IN local (`atd_praca_produto`), que diz quais produtos ESTA praça atende;
 * - o CATÁLOGO GLOBAL do core, que dá o nome e a foto.
 *
 * Só do catálogo, a praça ofereceria produtos que ela não atende. Só do local, o nome
 * seria o rótulo da praça, e o mesmo produto apareceria com nomes diferentes em dois
 * módulos do mesmo OS.
 */

/**
 * Guardado por NAVEGADOR e não no servidor.
 *
 * É preferência de quem está olhando, não configuração da praça: duas pessoas do mesmo
 * time podem cuidar de produtos diferentes, e gravar isso no banco faria a escolha de
 * uma trocar a tela da outra.
 */
const CHAVE = "atendeai_produto_v1";

export function ProdutoProvider({ children }: { children: ReactNode }) {
  const { data: pracas } = usePracaQuery();
  const { produtos: catalogo, nomeDe } = useCatalogoDeProdutos();
  const [escolhido, setEscolhido] = useState<string>(() => {
    try {
      return window.localStorage.getItem(CHAVE) ?? "";
    } catch {
      return "";
    }
  });

  const produtos = useMemo<Produto[]>(() => {
    const ativos = (pracas?.[0]?.produtos ?? []).filter((p) => p.ativo);
    return ativos.map((p) => ({
      slug: p.produto_slug,
      nome: nomeDe(p.produto_slug),
      foto: catalogo.find((c) => c.slug === p.produto_slug)?.foto_url ?? null,
    }));
  }, [pracas, catalogo, nomeDe]);

  /**
   * Cai no PRIMEIRO produto quando não há escolha válida.
   *
   * "Válida" inclui o caso de a escolha guardada ter saído da praça: sem esta checagem
   * a tela ficaria recortada por um produto que não existe mais, mostrando vazio, e a
   * pessoa não teria como saber por quê.
   */
  useEffect(() => {
    if (!produtos.length) return;
    if (produtos.some((p) => p.slug === escolhido)) return;
    setEscolhido(produtos[0]!.slug);
  }, [produtos, escolhido]);

  useEffect(() => {
    try {
      if (escolhido) window.localStorage.setItem(CHAVE, escolhido);
    } catch {
      /* janela anônima: segue sem lembrar */
    }
  }, [escolhido]);

  return (
    <ProdutoCtx.Provider value={{ produtos, produto: escolhido, setProduto: setEscolhido }}>
      {children}
    </ProdutoCtx.Provider>
  );
}
