/**
 * Tipos do que o Atende Aí CONSOME no produto Mestre do Bolão.
 *
 * Nada disto é dono do dado: bolão, cota e pedido são do módulo do bolão; cliente
 * e histórico são do iON; Pix é da Idea. O Atende Aí só lê, segura e dispara. Os
 * nomes seguem o formato genérico (catálogo, carrinho, cobrança) porque o mesmo
 * painel deve servir a outro produto trocando só o provedor.
 */

export type Modalidade =
  | "Lotofácil"
  | "Mega-Sena"
  | "Quina"
  | "+Milionária"
  | "Dupla Sena";

/** Um item do catálogo: aqui, um bolão impresso com N cotas. */
export interface Bolao {
  id: string;
  modalidade: Modalidade;
  /** Cor da modalidade, a mesma do volante da CAIXA. */
  cor: string;
  selo?: string;
  concurso: number;
  sorteio: string;
  jogos: number;
  dezenas: number;
  cotasTotal: number;
  cotasLivres: number;
  precoCota: number;
  premioEstimado: string;
  loterica: string;
}

export interface ItemCarrinho {
  bolaoId: string;
  cotas: number;
  /** Até quando a cota fica segura para esta conversa. */
  reservadaAte: number;
}

export type StatusCobranca = "pendente" | "paga" | "expirada";

export interface Cobranca {
  id: string;
  conversaId: string;
  valor: number;
  itens: ItemCarrinho[];
  status: StatusCobranca;
  criadaEm: number;
  venceEm: number;
  pagaEm?: number;
  copiaECola: string;
  /** Quem vendeu: sai do responsável da conversa, ninguém digita. */
  vendedora: string;
}

export interface CompraIon {
  data: string;
  descricao: string;
  valor: number;
  status: "paga" | "premiada" | "pendente";
}

/** O cliente como o iON o conhece. */
export interface ClienteIon {
  nome: string;
  telefone: string;
  cpf: string | null;
  origem: string;
  campanha?: string;
  utm?: string;
  vendedora: string;
  desde?: string;
  compras: CompraIon[];
  premios: { concurso: string; valor: number }[];
}
