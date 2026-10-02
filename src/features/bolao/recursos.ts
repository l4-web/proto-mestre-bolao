/**
 * CONFIGURAÇÃO POR PRODUTO.
 *
 * É a peça central da proposta: o Atende Aí não sabe o que é bolão. Ele sabe montar
 * painéis, ações e filtros genéricos, e cada produto diz quais quer. No sistema real
 * isto mora em `atd_praca_produto` e se edita em Configurações > Produtos; aqui é um
 * objeto, mas o formato é o mesmo.
 *
 * O teste de que ficou genérico: trocar o produto no seletor do topo troca a tela
 * inteira de comportamento sem nenhum `if (produto === ...)` nas telas.
 */

export type PainelId = "catalogo" | "carrinho" | "cliente" | "consulta";
export type AcaoId = "enviar_catalogo" | "criar_arte" | "carrinho" | "cliente";

export interface RecursosProduto {
  /** Abas do painel lateral, na ordem. Uma só = sem abas (o painel atual do APCAP). */
  paineis: PainelId[];
  /** Botões abaixo da caixa de mensagem. */
  acoes: AcaoId[];
  /** Filtros rápidos da lista: cada um é uma etiqueta da conversa. */
  recortesPorEtiqueta: { id: string; label: string; etiqueta: string }[];
  rotuloEncerrar: string;
  /** Provedores (quem responde catálogo e cobrança). */
  provedorCatalogo?: { nome: string; rotuloItem: string; rotuloCatalogo: string };
  provedorCobranca?: { nome: string; prazoMin: number; envio: "pix_nativo" | "copia_e_cola" };
  /** Quem é a fonte do cliente. */
  fonteCliente?: string;
}

export const RECURSOS: Record<string, RecursosProduto> = {
  mestre_do_bolao: {
    paineis: ["catalogo", "carrinho", "cliente"],
    acoes: ["enviar_catalogo", "criar_arte", "carrinho", "cliente"],
    recortesPorEtiqueta: [
      { id: "pix", label: "Pix pendente", etiqueta: "Pix pendente" },
      { id: "premiados", label: "Prêmio", etiqueta: "Premiada" },
    ],
    rotuloEncerrar: "Resolver",
    provedorCatalogo: {
      nome: "API Mestre do Bolão",
      rotuloItem: "bolão",
      rotuloCatalogo: "Bolões do dia",
    },
    provedorCobranca: { nome: "Idea · Pix", prazoMin: 30, envio: "copia_e_cola" },
    fonteCliente: "iON",
  },
  apcap_vip: {
    paineis: ["consulta"],
    acoes: [],
    recortesPorEtiqueta: [],
    rotuloEncerrar: "Encerrar",
  },
};

const PADRAO: RecursosProduto = RECURSOS.apcap_vip;

export function recursosDe(produtoSlug: string | null | undefined): RecursosProduto {
  return (produtoSlug && RECURSOS[produtoSlug]) || PADRAO;
}
