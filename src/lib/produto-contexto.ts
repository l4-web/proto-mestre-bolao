import { createContext, useContext } from "react";

/**
 * O contexto do produto, separado do provider.
 *
 * Mora em arquivo próprio pelo mesmo motivo do `ability.tsx`: o Fast Refresh do Vite
 * só funciona em arquivo que exporta COMPONENTES, e misturar hook com componente faz
 * o módulo inteiro recarregar a cada edição, perdendo o estado da tela.
 */
export interface Produto {
  slug: string;
  nome: string;
  foto?: string | null;
}

export interface ContextoDeProduto {
  produtos: Produto[];
  /** O escolhido. Vazio enquanto nada carregou ou quando a praça não tem produto. */
  produto: string;
  setProduto: (slug: string) => void;
}

export const ProdutoCtx = createContext<ContextoDeProduto>({
  produtos: [],
  produto: "",
  setProduto: () => {},
});

export function useProduto(): ContextoDeProduto {
  return useContext(ProdutoCtx);
}
