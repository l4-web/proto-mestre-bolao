import { useSyncExternalStore } from "react";
import { arteBolao, arteCanhoto, arteQrPix, linkRastreado, type ModeloArte } from "./arte";
import { brl } from "./formato";
import type { Bolao, ClienteIon, Cobranca, ItemCarrinho } from "./tipos";

/**
 * Simulador das integrações que o Atende Aí consumiria no Mestre do Bolão.
 *
 * Cada função aqui representa UMA chamada que o backend do Atende Aí faria a um
 * provedor: catálogo e reserva (API Mestre do Bolão), cobrança (módulo do bolão,
 * que fala com a Idea), cliente (iON), arte (Cria Aí). O efeito na conversa (a
 * mensagem que sai, a etiqueta que muda) passa pela `ponte`, que escreve no mock da
 * API do próprio Atende Aí. Assim a thread mostra exatamente o que o cliente veria.
 */

export interface MensagemPonte {
  autor: "atendente" | "cliente" | "sistema";
  texto?: string;
  imagemUrl?: string;
}

export interface Ponte {
  postar: (conversaId: string, m: MensagemPonte) => void;
  etiquetar: (conversaId: string, mudar: (tags: string[]) => string[]) => void;
}

let ponte: Ponte = {
  postar: () => console.warn("[bolao] ponte não ligada"),
  etiquetar: () => undefined,
};
export function ligarPonte(p: Ponte) {
  ponte = p;
}

export const MEU_CODIGO = "MARIA01";
export const MINHA_NOME = "Maria Souza";
const LOTERICA = "Lotérica Campo Grande";
const PRAZO_MS = 30 * 60 * 1000;

const BOLOES: Bolao[] = [
  { id: "lf1", modalidade: "Lotofácil", cor: "#930089", selo: "Independência", concurso: 3510, sorteio: "Hoje, 20h", jogos: 3, dezenas: 17, cotasTotal: 20, cotasLivres: 13, precoCota: 142.79, premioEstimado: "R$ 5,5 milhões", loterica: LOTERICA },
  { id: "ms1", modalidade: "Mega-Sena", cor: "#209869", selo: "Acumulada", concurso: 2930, sorteio: "Qua, 20h", jogos: 5, dezenas: 9, cotasTotal: 10, cotasLivres: 4, precoCota: 123.69, premioEstimado: "R$ 48 milhões", loterica: LOTERICA },
  { id: "qn1", modalidade: "Quina", cor: "#260085", concurso: 6851, sorteio: "Hoje, 20h", jogos: 4, dezenas: 10, cotasTotal: 25, cotasLivres: 21, precoCota: 48.5, premioEstimado: "R$ 1,2 milhão", loterica: LOTERICA },
  { id: "lf2", modalidade: "Lotofácil", cor: "#930089", concurso: 3510, sorteio: "Hoje, 20h", jogos: 10, dezenas: 16, cotasTotal: 30, cotasLivres: 2, precoCota: 64.0, premioEstimado: "R$ 5,5 milhões", loterica: "Lotérica Centro" },
  { id: "mi1", modalidade: "+Milionária", cor: "#2e3078", concurso: 288, sorteio: "Sáb, 20h", jogos: 2, dezenas: 8, cotasTotal: 12, cotasLivres: 9, precoCota: 96.0, premioEstimado: "R$ 152 milhões", loterica: LOTERICA },
  { id: "ds1", modalidade: "Dupla Sena", cor: "#a61324", concurso: 2790, sorteio: "Sex, 20h", jogos: 6, dezenas: 7, cotasTotal: 15, cotasLivres: 0, precoCota: 22.5, premioEstimado: "R$ 3 milhões", loterica: LOTERICA },
];

/** Clientes do iON, achados pelo nome do contato (no real, pelo telefone/CPF). */
const CLIENTES: Record<string, Omit<ClienteIon, "nome" | "telefone">> = {
  "Marcos Andrade": { cpf: null, origem: "Landing page", campanha: "lotofacil-independencia", utm: "utm_source=meta&utm_campaign=lotofacil-independencia", vendedora: MEU_CODIGO, compras: [], premios: [] },
  "Luciana Moraes": { cpf: "123.456.789-09", origem: "Anúncio Meta (clique para WhatsApp)", campanha: "quina-sao-joao", vendedora: MEU_CODIGO, desde: "mar/2026", compras: [
    { data: "29/09", descricao: "Quina 6850 · 2 cotas", valor: 97, status: "premiada" },
    { data: "12/09", descricao: "Mega-Sena 2921 · 1 cota", valor: 123.69, status: "paga" },
    { data: "20/08", descricao: "Lotofácil 3470 · 1 cota", valor: 64, status: "paga" },
  ], premios: [{ concurso: "Quina 6850 (quadra)", valor: 312.4 }] },
  "Paulo Ribeiro": { cpf: "987.654.321-00", origem: "Indicação (link da vendedora)", vendedora: MEU_CODIGO, desde: "jul/2026", compras: [
    { data: "hoje", descricao: "Mega-Sena 2930 · 1 cota", valor: 123.69, status: "pendente" },
    { data: "05/09", descricao: "Lotofácil 3480 · 1 cota", valor: 64, status: "paga" },
  ], premios: [] },
};

interface Estado {
  boloes: Bolao[];
  carrinhos: Record<string, ItemCarrinho[]>;
  cobrancas: Record<string, Cobranca>;
  cpfs: Record<string, string>;
  vendas: { valor: number; em: number }[];
  semeadas: Record<string, true>;
}

let estado: Estado = {
  boloes: BOLOES,
  carrinhos: {},
  cobrancas: {},
  cpfs: {},
  vendas: [],
  semeadas: {},
};
const ouvintes = new Set<() => void>();

function mudar(f: (e: Estado) => Estado) {
  estado = f(estado);
  ouvintes.forEach((o) => o());
}

export function useLoja(): Estado {
  return useSyncExternalStore(
    (cb) => {
      ouvintes.add(cb);
      return () => ouvintes.delete(cb);
    },
    () => estado,
  );
}

export const bolaoPorId = (id: string) => estado.boloes.find((b) => b.id === id);

function codigoPix(valor: number) {
  const v = valor.toFixed(2);
  return `00020126580014br.gov.bcb.pix0136idea-${Math.random().toString(36).slice(2, 10)}5204000053039865406${v}5802BR5925MESTRE DO BOLAO LTDA6012CAMPO GRANDE62070503***6304${Math.floor(Math.random() * 9999)}`;
}

/** Semeia o estado inicial de uma conversa da demo, uma vez (ex.: Pix do Paulo). */
export function garantirSemente(conversaId: string, nome: string | null) {
  if (estado.semeadas[conversaId]) return;
  mudar((e) => {
    const semeadas = { ...e.semeadas, [conversaId]: true as const };
    if (nome === "Paulo Ribeiro") {
      const itens = [{ bolaoId: "ms1", cotas: 1, reservadaAte: Date.now() + 18 * 60_000 }];
      return {
        ...e,
        semeadas,
        cobrancas: {
          ...e.cobrancas,
          [conversaId]: {
            id: "cob-paulo",
            conversaId,
            valor: 123.69,
            itens,
            status: "pendente",
            criadaEm: Date.now() - 12 * 60_000,
            venceEm: Date.now() + 18 * 60_000,
            copiaECola: codigoPix(123.69),
            vendedora: MEU_CODIGO,
          },
        },
      };
    }
    return { ...e, semeadas };
  });
}

export function clienteDe(nome: string | null, telefone: string | null, conversaId: string): ClienteIon {
  const base = (nome && CLIENTES[nome]) || {
    cpf: null,
    origem: "WhatsApp direto",
    vendedora: MEU_CODIGO,
    compras: [],
    premios: [],
  };
  return {
    ...base,
    nome: nome ?? "Sem nome",
    telefone: telefone ?? "",
    cpf: estado.cpfs[conversaId] ?? base.cpf,
  };
}

/* ── catálogo e reserva (API Mestre do Bolão) ──────────────────────────────── */

export function adicionarAoCarrinho(conversaId: string, bolaoId: string, cotas = 1) {
  const b = bolaoPorId(bolaoId);
  if (!b || b.cotasLivres < cotas) return false;
  mudar((e) => {
    const atual = e.carrinhos[conversaId] ?? [];
    const existente = atual.find((i) => i.bolaoId === bolaoId);
    const carrinho = existente
      ? atual.map((i) => (i.bolaoId === bolaoId ? { ...i, cotas: i.cotas + cotas, reservadaAte: Date.now() + PRAZO_MS } : i))
      : [...atual, { bolaoId, cotas, reservadaAte: Date.now() + PRAZO_MS }];
    return {
      ...e,
      carrinhos: { ...e.carrinhos, [conversaId]: carrinho },
      // Segurar tira a cota da vitrine de TODO MUNDO: é o que acaba com a venda dupla.
      boloes: e.boloes.map((x) => (x.id === bolaoId ? { ...x, cotasLivres: x.cotasLivres - cotas } : x)),
    };
  });
  return true;
}

export function removerDoCarrinho(conversaId: string, bolaoId: string) {
  mudar((e) => {
    const item = (e.carrinhos[conversaId] ?? []).find((i) => i.bolaoId === bolaoId);
    if (!item) return e;
    return {
      ...e,
      carrinhos: { ...e.carrinhos, [conversaId]: (e.carrinhos[conversaId] ?? []).filter((i) => i.bolaoId !== bolaoId) },
      boloes: e.boloes.map((x) => (x.id === bolaoId ? { ...x, cotasLivres: x.cotasLivres + item.cotas } : x)),
    };
  });
}

export function definirCpf(conversaId: string, cpf: string) {
  mudar((e) => ({ ...e, cpfs: { ...e.cpfs, [conversaId]: cpf } }));
}

/** "Enviar bolões": a arte padrão de cada um + um texto com os links rastreados. */
export function enviarBoloes(conversaId: string, ids: string[]) {
  const lista = ids.map(bolaoPorId).filter(Boolean) as Bolao[];
  lista.forEach((b) => ponte.postar(conversaId, { autor: "atendente", imagemUrl: arteBolao(b, "padrao", MEU_CODIGO) }));
  ponte.postar(conversaId, {
    autor: "atendente",
    texto:
      "Os bolões de hoje:\n" +
      lista
        .map((b) => `• ${b.modalidade} ${b.concurso} (${b.sorteio}): ${brl(b.precoCota)} a cota, ${b.cotasLivres} livres. ${linkRastreado(b, MEU_CODIGO)}`)
        .join("\n") +
      "\nQual você quer? Posso reservar agora.",
  });
}

/* ── arte (Cria Aí) ─────────────────────────────────────────────────────────── */

export function enviarArte(conversaId: string, bolaoId: string, modelo: ModeloArte) {
  const b = bolaoPorId(bolaoId);
  if (!b) return;
  ponte.postar(conversaId, { autor: "atendente", imagemUrl: arteBolao(b, modelo, MEU_CODIGO) });
}

/* ── cobrança (módulo do bolão → Idea) ─────────────────────────────────────── */

export function totalDoCarrinho(conversaId: string) {
  return (estado.carrinhos[conversaId] ?? []).reduce((s, i) => s + (bolaoPorId(i.bolaoId)?.precoCota ?? 0) * i.cotas, 0);
}

export function gerarPix(conversaId: string) {
  const itens = estado.carrinhos[conversaId] ?? [];
  if (itens.length === 0) return;
  const valor = totalDoCarrinho(conversaId);
  const cob: Cobranca = {
    id: `cob-${Date.now()}`,
    conversaId,
    valor,
    itens,
    status: "pendente",
    criadaEm: Date.now(),
    venceEm: Date.now() + PRAZO_MS,
    copiaECola: codigoPix(valor),
    vendedora: MEU_CODIGO,
  };
  mudar((e) => ({
    ...e,
    cobrancas: { ...e.cobrancas, [conversaId]: cob },
    carrinhos: { ...e.carrinhos, [conversaId]: [] },
  }));
  ponte.postar(conversaId, { autor: "sistema", texto: `Cobrança criada pelo módulo do bolão na Idea · ${brl(valor)} · vence em 30 min · venda de ${MINHA_NOME} (${MEU_CODIGO})` });
  ponte.postar(conversaId, { autor: "atendente", imagemUrl: arteQrPix(valor) });
  ponte.postar(conversaId, {
    autor: "atendente",
    texto: `Prontinho! Seu Pix de ${brl(valor)} vale por 30 minutos e suas cotas ficam reservadas até lá.\n\nPix copia e cola:\n${cob.copiaECola}`,
  });
  ponte.etiquetar(conversaId, (t) => [...t.filter((x) => x !== "Pix expirado" && x !== "Pago"), "Pix pendente"]);
}

/** Evento `paga` vindo do módulo do bolão (que recebeu o webhook da Idea). */
export function simularPagamento(conversaId: string, nomeCliente: string) {
  const cob = estado.cobrancas[conversaId];
  if (!cob || cob.status !== "pendente") return;
  mudar((e) => ({
    ...e,
    cobrancas: { ...e.cobrancas, [conversaId]: { ...cob, status: "paga", pagaEm: Date.now() } },
    vendas: [...e.vendas, { valor: cob.valor, em: Date.now() }],
  }));
  ponte.postar(conversaId, { autor: "sistema", texto: `Evento do módulo do bolão: Pix de ${brl(cob.valor)} confirmado pela Idea. Estoque baixado, cotas no CPF do cliente e venda atribuída a ${cob.vendedora}.` });
  ponte.etiquetar(conversaId, (t) => [...t.filter((x) => x !== "Pix pendente" && x !== "Pix expirado"), "Pago"]);
  ponte.postar(conversaId, { autor: "atendente", texto: "Pagamento confirmado! Já já te mando o comprovante com o seu nome. Boa sorte! 🍀" });
  // O canhoto chega depois, quando a lotérica endossa (passo 9 do diagrama).
  window.setTimeout(() => {
    cob.itens.forEach((i) => {
      const b = bolaoPorId(i.bolaoId);
      if (b) ponte.postar(conversaId, { autor: "atendente", imagemUrl: arteCanhoto(b, nomeCliente, i.cotas) });
    });
    ponte.postar(conversaId, { autor: "sistema", texto: "Canhoto endossado enviado automaticamente (evento `comprovante_pronto` do módulo do bolão)." });
  }, 2500);
}

/** Evento `expirada`: as cotas voltam para a vitrine. */
export function simularExpiracao(conversaId: string) {
  const cob = estado.cobrancas[conversaId];
  if (!cob || cob.status !== "pendente") return;
  mudar((e) => ({
    ...e,
    cobrancas: { ...e.cobrancas, [conversaId]: { ...cob, status: "expirada" } },
    boloes: e.boloes.map((b) => {
      const it = cob.itens.find((i) => i.bolaoId === b.id);
      return it ? { ...b, cotasLivres: b.cotasLivres + it.cotas } : b;
    }),
  }));
  ponte.postar(conversaId, { autor: "sistema", texto: `Pix de ${brl(cob.valor)} expirou sem pagamento. As cotas voltaram para o estoque.` });
  ponte.etiquetar(conversaId, (t) => [...t.filter((x) => x !== "Pix pendente"), "Pix expirado"]);
}

/* ── eventos externos que caem na conversa ─────────────────────────────────── */

export function simularRespostaCliente(conversaId: string, texto: string) {
  ponte.postar(conversaId, { autor: "cliente", texto });
}

export function simularResultado(conversaId: string, premiado: boolean) {
  if (premiado) {
    ponte.postar(conversaId, { autor: "sistema", texto: "Resultado (CAIXA) cruzado com as cotas vendidas: este cliente acertou a quadra na Quina 6851 · R$ 287,90 por cota. A lotérica paga por Pix na chave CPF." });
    ponte.etiquetar(conversaId, (t) => [...t.filter((x) => !x.startsWith("Premiada")), "Premiada · Quina"]);
    ponte.postar(conversaId, { autor: "cliente", texto: "Vi no grupo que saiu o resultado, ganhei alguma coisa?" });
  } else {
    ponte.postar(conversaId, { autor: "sistema", texto: "Resultado (CAIXA) cruzado com as cotas vendidas: nenhum prêmio para este cliente. Segue para o CRM (iON)." });
  }
}

export const segurosAte = (conversaId: string) =>
  Math.min(...(estado.carrinhos[conversaId] ?? []).map((i) => i.reservadaAte));

/** Cliente novo (lead da landing ou chamado por template) passa a existir no "iON". */
export function registrarCliente(nome: string, dados: Omit<ClienteIon, "nome" | "telefone">) {
  CLIENTES[nome] = dados;
}
