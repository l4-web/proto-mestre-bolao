/**
 * Banco EM MEMÓRIA do protótipo (Mestre do Bolão).
 *
 * Singleton de módulo: o `servidor.ts` lê e escreve aqui para responder as rotas
 * da API, e qualquer outro código do protótipo pode importar as funções exportadas
 * para simular eventos (cliente mandando mensagem, tag nova, conversa nova). Toda
 * mutação exportada avisa os inscritos de `onMudanca` e invalida as tags do RTK
 * Query, então a tela se atualiza sozinha.
 *
 * Os horários são calculados a partir de AGORA no carregamento, para a janela de
 * 24h do WhatsApp ficar aberta nas conversas em andamento.
 */
import { api } from "../store/api";
import { store } from "../store/store";
import type {
  Atendente,
  AtendimentoResumo,
  Avaliacao,
  Canal,
  Contato,
  ConversaDetalhe,
  ConversaItem,
  Edicao,
  EstadoConversa,
  EtapaMotivo,
  Fila,
  Gravidade,
  LinkDeMidia,
  Mensagem,
  MotivoNo,
  Praca,
  Sentimento,
} from "../features/atendimento/tipos";

// ── Identidades fixas ─────────────────────────────────────────────────────

export const EU_ID = "6f1c2a9e-3b4d-4e8a-9c2f-1a2b3c4d5e01";
export const JOANA_ID = "6f1c2a9e-3b4d-4e8a-9c2f-1a2b3c4d5e02";
export const CARLOS_ID = "6f1c2a9e-3b4d-4e8a-9c2f-1a2b3c4d5e03";
export const EMPRESA_ID = "b01a0000-4c2e-4f6a-9d11-mestredobolao";

export const PRODUTO_PADRAO = "mestre_do_bolao";
export const PRODUTO_VIP = "apcap_vip";

export const FILA_VENDAS = "fila-vendas-bolao";
export const FILA_POS_VENDA = "fila-pos-venda";

export const CANAL_WA_BOLAO = "canal-wa-mestre-bolao";
export const CANAL_WA_VIP = "canal-wa-apcap-vip";
export const CANAL_IG = "canal-ig-mestre-bolao";

/** Ids das conversas de destaque (para quem for roteirizar a demo). */
export const CONVERSA = {
  marcos: "cv-marcos-andrade",
  luciana: "cv-luciana-moraes",
  paulo: "cv-paulo-ribeiro",
  renata: "cv-renata-alves",
} as const;

export type TagApi = "Praca" | "Conversa" | "Atendimento" | "Fila" | "Motivo" | "TokenCanal" | "Comentario";

// ── Tempo relativo ────────────────────────────────────────────────────────

const T0 = Date.now();
const MIN = 60_000;
const haMin = (min: number) => new Date(T0 - min * MIN).toISOString();
const emMin = (min: number) => new Date(T0 + min * MIN).toISOString();
export const agoraIso = () => new Date().toISOString();

let seq = 1000;
export const novoId = (prefixo: string) => `${prefixo}-${(seq++).toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

// ── Tipos internos ────────────────────────────────────────────────────────

/** De onde a pessoa chegou. Campo EXTRA do protótipo (a API real não tem). */
export interface OrigemConversa {
  tipo: "landing_page" | "anuncio" | "organico" | "indicacao" | "comentario";
  rotulo: string;
  campanha: string | null;
  url?: string | null;
  utm?: { source?: string; medium?: string; campaign?: string; content?: string; term?: string } | null;
}

export interface AtendimentoDb extends AtendimentoResumo {
  resolucao: string | null;
  avaliacao?: Avaliacao;
  aberto_em: string;
}

export interface ConversaDb {
  id: string;
  estado: EstadoConversa;
  sentimento: Sentimento;
  temas: string[];
  tags: string[];
  canal_id: string;
  /** `user_id` de quem atende. Nulo = sem dono. */
  responsavel: string | null;
  fila_id: string | null;
  produto_slug: string;
  contato: Contato;
  atendimentos: AtendimentoDb[];
  avaliacao: Avaliacao;
  origem: OrigemConversa | null;
  /** Ainda com o bot: fora de todas as visões, só entra na contagem `comBot`. */
  com_bot?: boolean;
  criado_em: string;
  ultimo_evento_em: string;
}

export interface EncaminhamentoDb {
  id: string;
  equipe: "dev" | "pagamentos";
  conversa_id: string;
  atendimento_id: string;
  titulo: string;
  estado: string;
  gravidade: string;
  abertoPor: string | null;
  abertoEm: string;
  responsavel_id: string | null;
  pegoEm: string | null;
  resposta: string | null;
  respondidoPor: string | null;
  respondidoEm: string | null;
  demandaRef: string | null;
  coleta: Record<string, string>;
  notas: { id: string; autor: string; texto: string; created_at: string }[];
}

export interface ComentarioDb {
  id: string;
  rede: string;
  origem: string;
  campanha: string | null;
  autor_handle: string | null;
  texto: string;
  publicado_em: string;
  sentimento: string;
  temas: string[];
  suspeita_golpe: boolean;
  estado: string;
  gravidade: string | null;
  rede_pendente: boolean;
  rede_pendente_motivo: string | null;
  respondido_auto: boolean;
  acao_em_curso: string | null;
  respostas: { id: string; autor: string | null; texto: string; publicado_em: string; nosso: boolean }[] | null;
  conversa_id: string | null;
  motivo: { label: string } | null;
  produto_slug: string;
}

export interface MacroDb {
  id: string;
  titulo: string;
  corpo: string;
  variaveis: string[];
  motivoId: string | null;
}

export interface RespostaDb {
  versao: number;
  corpo: string;
  publico: boolean;
  estado: "publicado" | "rascunho";
  escopo: "global" | "por_edicao";
  edicao_id: string | null;
  publicadoEm: string | null;
}

// ── Seed ──────────────────────────────────────────────────────────────────

const avaliacaoAberta = (): Avaliacao => ({
  estado: "em_aberto",
  nota: null,
  rotulo: null,
  pedidoEm: null,
  respondidoEm: null,
});

const contato = (id: string, nome: string, telefone: string, tags: string[] = []): Contato => ({
  id,
  nome,
  handle: null,
  cpf: null,
  telefone,
  oculto: false,
  tags,
});

const praca: Praca = {
  id: "praca-lot-campo-grande",
  empresa_id: EMPRESA_ID,
  nome: "Lotérica Campo Grande",
  fuso: "America/Campo_Grande",
  expediente: {
    dias: {
      "1": [["08:00", "18:00"]],
      "2": [["08:00", "18:00"]],
      "3": [["08:00", "18:00"]],
      "4": [["08:00", "18:00"]],
      "5": [["08:00", "18:00"]],
      "6": [["08:00", "12:00"]],
    },
  },
  auto_fechar_conversa_horas: 24,
  auto_offline_atendente_min: 30,
  espera_texto_inicial: null,
  espera_texto_inicial_padrao: "Oi! Já já um dos nossos atendentes te responde por aqui.",
  lembrete_espera_horas: 2,
  lembrete_espera_textos: null,
  lembrete_espera_padroes: [
    "Seguimos com a sua mensagem na fila, já te respondemos.",
    "Ainda estamos por aqui! Assim que um atendente liberar, ele te chama.",
  ],
  bot_ativo: true,
  envio_ativo: true,
  ia_ativa: true,
  auto_resposta_ativa: false,
  auto_resposta_modelo: "Obrigado pelo carinho! Boa sorte no próximo bolão 🍀",
  teto_micros_mes: "800000000",
  teto_alerta_pct: 80,
  teto_acao: "avisar",
  canais: [
    {
      id: CANAL_WA_BOLAO,
      tipo: "whatsapp",
      rotulo: "WhatsApp Mestre do Bolão",
      status: "ativo",
      external_id: "556733210000",
      waba_id: "1029384756",
      secret_nome: "atendeai-wa-mestre-bolao-token",
      produto_slug: PRODUTO_PADRAO,
      quality_rating: "GREEN",
      subscribed_apps_ok: true,
      token_expira_em: null,
      ultimo_evento_em: haMin(2),
    },
    {
      id: CANAL_WA_VIP,
      tipo: "whatsapp",
      rotulo: "WhatsApp APCAP VIP",
      status: "ativo",
      external_id: "556733219999",
      waba_id: "1029384756",
      secret_nome: "atendeai-wa-apcap-vip-token",
      produto_slug: PRODUTO_VIP,
      quality_rating: "GREEN",
      subscribed_apps_ok: true,
      token_expira_em: null,
      ultimo_evento_em: haMin(35),
    },
    {
      id: CANAL_IG,
      tipo: "instagram",
      rotulo: "@mestredobolao",
      status: "ativo",
      external_id: "17841400000000001",
      waba_id: null,
      secret_nome: "atendeai-ig-mestre-bolao-token",
      produto_slug: PRODUTO_PADRAO,
      quality_rating: null,
      subscribed_apps_ok: true,
      token_expira_em: emMin(60 * 24 * 45),
      ultimo_evento_em: haMin(20),
    },
  ],
  produtos: [
    {
      id: "pp-mestre-bolao",
      produto_slug: PRODUTO_PADRAO,
      rotulo: "Mestre do Bolão",
      ativo: true,
      ion_marca: "mestre_do_bolao",
      compliance: {
        bloqueio_duro: ["ganho garantido", "prêmio garantido", "certeza de ganhar"],
        termos_revisao: ["investimento", "renda extra"],
        idade_minima: 18,
      },
    },
    {
      id: "pp-apcap-vip",
      produto_slug: PRODUTO_VIP,
      rotulo: "APCAP VIP",
      ativo: true,
      ion_marca: "apcap",
      compliance: {
        bloqueio_duro: ["ganho garantido", "aposta"],
        termos_revisao: ["investimento"],
        idade_minima: 16,
      },
    },
  ],
};

const filas: Fila[] = [
  { id: FILA_VENDAS, slug: "vendas-bolao", nome: "Vendas Bolão", ativa: true, ordem: 1 },
  { id: FILA_POS_VENDA, slug: "pos-venda", nome: "Pós-venda", ativa: true, ordem: 2 },
];

const atendentes: Atendente[] = [
  {
    id: "atd-maria",
    user_id: EU_ID,
    nome: "Maria Souza",
    fila_id: FILA_VENDAS,
    status: "online",
    status_desde: haMin(95),
    capacidade: 6,
    carga: 0,
    produtos: [],
  },
  {
    id: "atd-joana",
    user_id: JOANA_ID,
    nome: "Joana Lima",
    fila_id: FILA_VENDAS,
    status: "online",
    status_desde: haMin(140),
    capacidade: 6,
    carga: 0,
    produtos: [PRODUTO_PADRAO],
  },
  {
    id: "atd-carlos",
    user_id: CARLOS_ID,
    nome: "Carlos Pereira",
    fila_id: FILA_POS_VENDA,
    status: "online",
    status_desde: haMin(210),
    capacidade: 4,
    carga: 0,
    produtos: [],
  },
];

/** Códigos dos atendentes (para o protótipo mostrar no link da vendedora). */
export const CODIGO_ATENDENTE: Record<string, string> = {
  [EU_ID]: "MARIA01",
  [JOANA_ID]: "JOANA02",
  [CARLOS_ID]: "CARLOS03",
};

const motivo = (
  id: string,
  label: string,
  codigo: MotivoNo["codigo_tratamento"],
  gravidade: Gravidade,
  gatilhos: string[],
): MotivoNo => ({
  id,
  slug: id.replace(/^mot-/, ""),
  label,
  gravidade_padrao: gravidade,
  codigo_tratamento: codigo,
  gatilhos,
  resposta_restrita: false,
  sla_reg_tipo: null,
});

const etapasPadrao = (prefixo: string): EtapaMotivo[] => [
  {
    id: `${prefixo}-et-venda`,
    slug: "venda",
    label: "Venda",
    filhos: [
      motivo(`mot-${prefixo}-venda-concluida`, "Venda concluída", "direto", "medio", ["quero comprar", "manda o pix"]),
      motivo(`mot-${prefixo}-duvida-bolao`, "Dúvida sobre bolão", "faq", "medio", ["como funciona", "quantas cotas", "valor da cota"]),
      motivo(`mot-${prefixo}-desistiu`, "Desistiu", "direto", "medio", ["deixa pra próxima", "não quero mais"]),
    ],
  },
  {
    id: `${prefixo}-et-pos`,
    slug: "pos-venda",
    label: "Pós-venda",
    filhos: [
      motivo(`mot-${prefixo}-premio`, "Prêmio", "cq", "alto", ["ganhei", "prêmio", "resgatar"]),
      motivo(`mot-${prefixo}-pagamento`, "Pagamento não confirmado", "df", "alto", ["paguei", "comprovante", "pix não caiu"]),
      motivo(`mot-${prefixo}-comprovante`, "Comprovante do bolão", "faq", "medio", ["comprovante", "meus jogos"]),
    ],
  },
];

const taxonomia: Record<string, EtapaMotivo[]> = {
  [PRODUTO_PADRAO]: etapasPadrao("mb"),
  [PRODUTO_VIP]: etapasPadrao("vip"),
};

function acharMotivo(id: string | null | undefined): MotivoNo | undefined {
  if (!id) return undefined;
  for (const etapas of Object.values(taxonomia)) {
    for (const e of etapas) {
      const m = e.filhos.find((f) => f.id === id);
      if (m) return m;
    }
  }
  return undefined;
}

const MOT = {
  vendaConcluida: "mot-mb-venda-concluida",
  duvida: "mot-mb-duvida-bolao",
  desistiu: "mot-mb-desistiu",
  premio: "mot-mb-premio",
  pagamento: "mot-mb-pagamento",
};

function atendimento(
  ref: string,
  abertoHaMin: number,
  opts: { motivoId?: string; gravidade?: Gravidade; resolvidoHaMin?: number; resolucao?: string; avaliacao?: Avaliacao } = {},
): AtendimentoDb {
  const m = acharMotivo(opts.motivoId);
  const resolvido = opts.resolvidoHaMin != null ? haMin(opts.resolvidoHaMin) : null;
  return {
    id: novoId("at"),
    ref,
    gravidade: opts.gravidade ?? m?.gravidade_padrao ?? "medio",
    resolvido_em: resolvido,
    sla_com_resolucao_em: new Date(T0 - abertoHaMin * MIN + 4 * 60 * MIN).toISOString(),
    sla_com_estourado: false,
    sla_reg_prazo_em: null,
    sla_reg_estourado: false,
    motivo: m ? { id: m.id, label: m.label, codigo_tratamento: m.codigo_tratamento } : null,
    resolucao: opts.resolucao ?? null,
    avaliacao: opts.avaliacao,
    aberto_em: haMin(abertoHaMin),
  };
}

function msg(
  autor: Mensagem["autor"],
  conteudo: string | null,
  haMinutos: number,
  extra: Partial<Mensagem> = {},
): Mensagem {
  const nosso = autor === "atendente" || autor === "bot";
  return {
    id: novoId("msg"),
    direcao: autor === "cliente" ? "inbound" : "outbound",
    autor,
    tipo: "text",
    conteudo,
    midia_gcs: null,
    status_entrega: nosso ? "lida" : null,
    origem_resposta: autor === "atendente" ? "humano" : autor === "bot" ? "arvore" : null,
    created_at: haMin(haMinutos),
    ...extra,
  };
}

/** Comprovante de Pix desenhado em SVG (sem depender de rede). */
const COMPROVANTE_SVG =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="360" height="520" viewBox="0 0 360 520">
<rect width="360" height="520" rx="18" fill="#ffffff"/>
<rect width="360" height="92" rx="18" fill="#0f9d58"/>
<text x="24" y="54" font-family="Helvetica,Arial" font-size="22" fill="#fff" font-weight="700">Pix enviado</text>
<text x="24" y="140" font-family="Helvetica,Arial" font-size="14" fill="#666">Valor</text>
<text x="24" y="172" font-family="Helvetica,Arial" font-size="30" fill="#111" font-weight="700">R$ 45,00</text>
<text x="24" y="222" font-family="Helvetica,Arial" font-size="14" fill="#666">Para</text>
<text x="24" y="246" font-family="Helvetica,Arial" font-size="17" fill="#111">Lotérica Campo Grande LTDA</text>
<text x="24" y="292" font-family="Helvetica,Arial" font-size="14" fill="#666">Descrição</text>
<text x="24" y="316" font-family="Helvetica,Arial" font-size="17" fill="#111">Bolão Mega-Sena 2 cotas</text>
<text x="24" y="362" font-family="Helvetica,Arial" font-size="14" fill="#666">Data</text>
<text x="24" y="386" font-family="Helvetica,Arial" font-size="17" fill="#111">Hoje, 10:42</text>
<rect x="24" y="430" width="312" height="48" rx="12" fill="#f1f3f4"/>
<text x="40" y="460" font-family="Helvetica,Arial" font-size="13" fill="#555">ID E00038166202610021042</text>
</svg>`,
  );

const midias: Record<string, LinkDeMidia> = {};

function conversa(c: Partial<ConversaDb> & Pick<ConversaDb, "id" | "contato">): ConversaDb {
  return {
    estado: "em_atendimento",
    sentimento: "neutro",
    temas: [],
    tags: [],
    canal_id: CANAL_WA_BOLAO,
    responsavel: null,
    fila_id: FILA_VENDAS,
    produto_slug: PRODUTO_PADRAO,
    atendimentos: [],
    avaliacao: avaliacaoAberta(),
    origem: null,
    criado_em: haMin(60),
    ultimo_evento_em: haMin(1),
    ...c,
  };
}

const conversas: ConversaDb[] = [
  conversa({
    id: CONVERSA.marcos,
    contato: contato("ct-marcos", "Marcos Andrade", "+55 67 99812-4821"),
    responsavel: EU_ID,
    estado: "em_atendimento",
    sentimento: "positivo",
    temas: ["Compra"],
    origem: {
      tipo: "landing_page",
      rotulo: "Landing page · Lotofácil da Independência",
      campanha: "lotofacil-independencia",
      url: "https://mestredobolao.com.br/lotofacil-independencia?utm_source=instagram&utm_medium=paid_social&utm_campaign=lotofacil-independencia&utm_content=video-cotas",
      utm: {
        source: "instagram",
        medium: "paid_social",
        campaign: "lotofacil-independencia",
        content: "video-cotas",
      },
    },
    atendimentos: [atendimento("MB-2026-0418", 15)],
    criado_em: haMin(15),
  }),
  conversa({
    id: CONVERSA.luciana,
    contato: contato("ct-luciana", "Luciana Moraes", "+55 67 99634-1170"),
    responsavel: EU_ID,
    estado: "em_atendimento",
    sentimento: "positivo",
    temas: ["Prêmio"],
    tags: ["Premiada · Quina"],
    origem: { tipo: "organico", rotulo: "Cliente da casa", campanha: null, utm: null },
    atendimentos: [atendimento("MB-2026-0411", 55, { motivoId: MOT.premio })],
    criado_em: haMin(55),
  }),
  conversa({
    id: CONVERSA.paulo,
    contato: contato("ct-paulo", "Paulo Ribeiro", "+55 67 99177-3052"),
    responsavel: EU_ID,
    estado: "aguardando_cliente",
    temas: ["Compra"],
    tags: ["Pix pendente"],
    origem: {
      tipo: "anuncio",
      rotulo: "Anúncio · Mega da Virada",
      campanha: "mega-virada-2026",
      utm: { source: "facebook", medium: "paid_social", campaign: "mega-virada-2026" },
    },
    atendimentos: [atendimento("MB-2026-0402", 130, { motivoId: MOT.vendaConcluida })],
    criado_em: haMin(130),
  }),
  conversa({
    id: CONVERSA.renata,
    contato: contato("ct-renata", "Renata Alves", "+55 67 99905-6638"),
    responsavel: null,
    estado: "nova",
    origem: {
      tipo: "landing_page",
      rotulo: "Landing page · Mega-Sena acumulada",
      campanha: "mega-acumulada",
      utm: { source: "google", medium: "cpc", campaign: "mega-acumulada" },
    },
    criado_em: haMin(6),
  }),
  conversa({
    id: "cv-fernando-costa",
    contato: contato("ct-fernando", "Fernando Costa", "+55 67 99288-4410"),
    responsavel: JOANA_ID,
    estado: "em_atendimento",
    temas: ["Dúvida"],
    atendimentos: [atendimento("MB-2026-0415", 25, { motivoId: MOT.duvida })],
    criado_em: haMin(25),
  }),
  conversa({
    id: "cv-sandra-melo",
    contato: contato("ct-sandra", "Sandra Melo", "+55 67 99351-2207"),
    responsavel: JOANA_ID,
    fila_id: FILA_POS_VENDA,
    estado: "aguardando_cliente",
    sentimento: "positivo",
    atendimentos: [atendimento("MB-2026-0399", 180, { motivoId: MOT.pagamento })],
    criado_em: haMin(180),
  }),
  conversa({
    id: "cv-rogerio-nunes",
    contato: contato("ct-rogerio", "Rogério Nunes", "+55 67 99460-8812"),
    responsavel: CARLOS_ID,
    fila_id: FILA_POS_VENDA,
    estado: "aguardando_equipe",
    sentimento: "negativo",
    temas: ["Reclamação"],
    atendimentos: [atendimento("MB-2026-0377", 60 * 26, { motivoId: MOT.premio, gravidade: "alto" })],
    criado_em: haMin(60 * 26),
  }),
  conversa({
    id: "cv-helena-duarte",
    contato: contato("ct-helena", "Helena Duarte", "+55 67 99712-0094"),
    canal_id: CANAL_WA_VIP,
    produto_slug: PRODUTO_VIP,
    responsavel: null,
    fila_id: FILA_POS_VENDA,
    estado: "nova",
    criado_em: haMin(18),
  }),
  conversa({
    id: "cv-thiago-rocha",
    contato: contato("ct-thiago", "Thiago Rocha", "+55 67 99023-5571"),
    responsavel: null,
    estado: "nova",
    com_bot: true,
    criado_em: haMin(3),
  }),
  conversa({
    id: "cv-beatriz-santos",
    contato: contato("ct-beatriz", "Beatriz Santos", "+55 67 99540-3318"),
    responsavel: EU_ID,
    estado: "resolvida",
    sentimento: "positivo",
    temas: ["Compra"],
    avaliacao: {
      estado: "avaliado",
      nota: 5,
      rotulo: "Ótimo",
      pedidoEm: haMin(60 * 20),
      respondidoEm: haMin(60 * 19.8),
    },
    atendimentos: [
      atendimento("MB-2026-0360", 60 * 21, {
        motivoId: MOT.vendaConcluida,
        resolvidoHaMin: 60 * 20,
        resolucao: "Cliente comprou 3 cotas da Lotofácil.",
        avaliacao: {
          estado: "avaliado",
          nota: 5,
          rotulo: "Ótimo",
          pedidoEm: haMin(60 * 20),
          respondidoEm: haMin(60 * 19.8),
        },
      }),
    ],
    criado_em: haMin(60 * 21),
  }),
  conversa({
    id: "cv-jorge-almeida",
    contato: contato("ct-jorge", "Jorge Almeida", "+55 67 99813-7765"),
    responsavel: JOANA_ID,
    estado: "resolvida",
    avaliacao: {
      estado: "sem_resposta",
      nota: null,
      rotulo: null,
      pedidoEm: haMin(60 * 28),
      respondidoEm: null,
    },
    atendimentos: [
      atendimento("MB-2026-0341", 60 * 30, {
        motivoId: MOT.desistiu,
        resolvidoHaMin: 60 * 28,
        resolucao: "Achou o valor da cota alto, vai esperar a próxima.",
        avaliacao: {
          estado: "sem_resposta",
          nota: null,
          rotulo: null,
          pedidoEm: haMin(60 * 28),
          respondidoEm: null,
        },
      }),
    ],
    criado_em: haMin(60 * 30),
  }),
];

const mensagens: Record<string, Mensagem[]> = {
  [CONVERSA.marcos]: [
    msg("sistema", "Chegou pela landing page da campanha lotofacil-independencia", 15),
    msg("cliente", "Boa tarde! Vi o anúncio da Lotofácil da Independência, ainda tem cota?", 14),
    msg("atendente", "Oi, Marcos! Tem sim. Quer que eu te mande os bolões de hoje?", 12),
    msg("cliente", "Quero. Manda a Lotofácil e a Mega", 9),
  ],
  [CONVERSA.luciana]: [
    msg("cliente", "Oi, sou a Luciana. Entrei no bolão da Quina de ontem, deu alguma coisa?", 52),
    msg("atendente", "Oi, Luciana! Conferi aqui: o bolão 2381 fez a quadra e a quina. A sua cota rendeu R$ 412,37 🎉", 41),
    msg("cliente", "Nossa, ganhei mesmo?", 38),
  ],
  [CONVERSA.paulo]: [
    msg("cliente", "Bom dia, quero 2 cotas do bolão da Mega da Virada", 128),
    msg("atendente", "Bom dia, Paulo! Fechado: 2 cotas ficam R$ 60,00. Vou te mandar o Pix.", 120),
    msg("atendente", "Pix copia e cola: 00020126580014BR.GOV.BCB.PIX0136mestredobolao@pix.com.br520400005303986540660.00", 119),
    msg("cliente", "Vou pagar no almoço", 104),
  ],
  [CONVERSA.renata]: [
    msg("bot", "Olá! Eu sou o assistente do Mestre do Bolão. Em que posso ajudar?", 7),
    msg("cliente", "Oi, quero entrar no bolão da Mega", 6),
    msg("sistema", "O bot encaminhou para a fila Vendas Bolão", 6),
  ],
  "cv-fernando-costa": [
    msg("cliente", "Vocês têm bolão da Dupla Sena?", 24),
    msg("atendente", "Temos sim, Fernando! Sai toda terça e sexta. Quer ver as cotas?", 20),
    msg("cliente", "Quanto fica a cota?", 17),
  ],
  "cv-sandra-melo": [
    msg("cliente", "Paguei o bolão da Mega, segue o comprovante", 178),
    msg("cliente", null, 177, { tipo: "image", midia_gcs: "mock://comprovante-sandra" }),
    msg("atendente", "Recebido, Sandra! Seu bolão está confirmado. Boa sorte! 🍀", 170),
    msg("cliente", "Recebi o comprovante, obrigada", 165),
  ],
  "cv-rogerio-nunes": [
    msg("cliente", "Meu prêmio da Lotofácil ainda não caiu na conta", 60 * 26),
    msg("atendente", "Rogério, vou verificar com o financeiro e te retorno.", 60 * 25.8),
    msg("sistema", "Caso encaminhado para a equipe financeira", 60 * 25.7),
    msg("cliente", "Alguma novidade?", 60 * 3),
  ],
  "cv-helena-duarte": [
    msg("cliente", "Quero saber se o meu título do APCAP VIP foi sorteado", 18),
  ],
  "cv-thiago-rocha": [
    msg("bot", "Olá! Eu sou o assistente do Mestre do Bolão. Em que posso ajudar?", 3),
    msg("cliente", "Como funciona o bolão?", 3),
  ],
  "cv-beatriz-santos": [
    msg("cliente", "Quero 3 cotas da Lotofácil", 60 * 21),
    msg("atendente", "Perfeito, Beatriz! Separei as 3 cotas. Te mando o Pix.", 60 * 20.9),
    msg("cliente", "Paguei!", 60 * 20.5),
    msg("atendente", "Confirmado! Boa sorte 🍀", 60 * 20.2),
  ],
  "cv-jorge-almeida": [
    msg("cliente", "Quanto é a cota da Mega?", 60 * 30),
    msg("atendente", "Jorge, a cota está R$ 35,00 neste concurso.", 60 * 29.5),
    msg("cliente", "Achei caro, deixa pra próxima", 60 * 29),
  ],
};

midias[mensagens["cv-sandra-melo"]![1]!.id] = {
  url: COMPROVANTE_SVG,
  mime: "image/svg+xml",
  nome: "comprovante-pix.png",
  bytes: 48211,
};
// A imagem precisa apontar para o mesmo id que o mapa de mídia usa.
mensagens["cv-sandra-melo"]![1]!.midia_gcs = `mock://${mensagens["cv-sandra-melo"]![1]!.id}`;

// Último evento = última mensagem.
for (const c of conversas) {
  const ult = mensagens[c.id]?.at(-1);
  if (ult) c.ultimo_evento_em = ult.created_at;
}

const encaminhamentos: EncaminhamentoDb[] = [
  {
    id: "enc-rogerio",
    equipe: "pagamentos",
    conversa_id: "cv-rogerio-nunes",
    atendimento_id: conversas.find((c) => c.id === "cv-rogerio-nunes")!.atendimentos[0]!.id,
    titulo: "Prêmio da Lotofácil não creditado",
    estado: "aberto",
    gravidade: "alto",
    abertoPor: "Carlos Pereira",
    abertoEm: haMin(60 * 25.7),
    responsavel_id: null,
    pegoEm: null,
    resposta: null,
    respondidoPor: null,
    respondidoEm: null,
    demandaRef: null,
    coleta: {
      "Valor do prêmio": "R$ 186,40",
      "Concurso": "Lotofácil 3502",
      "Chave Pix do cliente": "(67) 99460-8812",
    },
    notas: [
      {
        id: "nota-1",
        autor: "Carlos Pereira",
        texto: "Cliente informou a chave Pix por telefone. Prêmio apurado no dia 30.",
        created_at: haMin(60 * 25.6),
      },
    ],
  },
  {
    id: "enc-sandra-app",
    equipe: "dev",
    conversa_id: "cv-sandra-melo",
    atendimento_id: conversas.find((c) => c.id === "cv-sandra-melo")!.atendimentos[0]!.id,
    titulo: "Bolão pago não aparece em Meus jogos",
    estado: "em_analise",
    gravidade: "medio",
    abertoPor: "Joana Lima",
    abertoEm: haMin(160),
    responsavel_id: CARLOS_ID,
    pegoEm: haMin(120),
    resposta: null,
    respondidoPor: null,
    respondidoEm: null,
    demandaRef: "DEV-212",
    coleta: { "Tela": "Meus jogos", "Aparelho": "Android" },
    notas: [],
  },
];

const comentarios: ComentarioDb[] = [
  {
    id: "cm-1",
    rede: "instagram",
    origem: "impulsionado",
    campanha: "lotofacil-independencia",
    autor_handle: "@marcos.andrade",
    texto: "Ainda dá tempo de entrar no bolão da Lotofácil?",
    publicado_em: haMin(40),
    sentimento: "neutro",
    temas: ["duvida"],
    suspeita_golpe: false,
    estado: "novo",
    gravidade: null,
    rede_pendente: false,
    rede_pendente_motivo: null,
    respondido_auto: false,
    acao_em_curso: null,
    respostas: null,
    conversa_id: null,
    motivo: null,
    produto_slug: PRODUTO_PADRAO,
  },
  {
    id: "cm-2",
    rede: "instagram",
    origem: "organico",
    campanha: null,
    autor_handle: "@lu.moraes",
    texto: "Ganhei na quina com vocês ontem!! Melhor lotérica de Campo Grande 💚",
    publicado_em: haMin(90),
    sentimento: "positivo",
    temas: ["elogio"],
    suspeita_golpe: false,
    estado: "respondido",
    gravidade: null,
    rede_pendente: false,
    rede_pendente_motivo: null,
    respondido_auto: false,
    acao_em_curso: null,
    respostas: [
      { id: "r-1", autor: "@mestredobolao", texto: "Parabéns, Luciana! Que venham mais 🍀", publicado_em: haMin(80), nosso: true },
    ],
    conversa_id: null,
    motivo: null,
    produto_slug: PRODUTO_PADRAO,
  },
  {
    id: "cm-3",
    rede: "instagram",
    origem: "dark_post",
    campanha: "mega-virada-2026",
    autor_handle: "@rogerio_nunes",
    texto: "Até agora não recebi meu prêmio, ninguém responde no WhatsApp",
    publicado_em: haMin(60 * 4),
    sentimento: "negativo",
    temas: ["reclamacao", "premio"],
    suspeita_golpe: false,
    estado: "novo",
    gravidade: "alto",
    rede_pendente: false,
    rede_pendente_motivo: null,
    respondido_auto: false,
    acao_em_curso: null,
    respostas: null,
    conversa_id: "cv-rogerio-nunes",
    motivo: { label: "Prêmio" },
    produto_slug: PRODUTO_PADRAO,
  },
  {
    id: "cm-4",
    rede: "instagram",
    origem: "organico",
    campanha: null,
    autor_handle: "@premios_rapidos_oficial",
    texto: "Quer ganhar todo dia? Chama no direct que eu te passo o esquema garantido",
    publicado_em: haMin(60 * 6),
    sentimento: "negativo",
    temas: ["golpe"],
    suspeita_golpe: true,
    estado: "novo",
    gravidade: "critico",
    rede_pendente: false,
    rede_pendente_motivo: null,
    respondido_auto: false,
    acao_em_curso: null,
    respostas: null,
    conversa_id: null,
    motivo: null,
    produto_slug: PRODUTO_PADRAO,
  },
  {
    id: "cm-5",
    rede: "facebook",
    origem: "impulsionado",
    campanha: "mega-acumulada",
    autor_handle: "Renata Alves",
    texto: "Quanto custa a cota da Mega acumulada?",
    publicado_em: haMin(60 * 9),
    sentimento: "neutro",
    temas: ["duvida", "preco"],
    suspeita_golpe: false,
    estado: "novo",
    gravidade: null,
    rede_pendente: false,
    rede_pendente_motivo: null,
    respondido_auto: false,
    acao_em_curso: null,
    respostas: null,
    conversa_id: null,
    motivo: null,
    produto_slug: PRODUTO_PADRAO,
  },
  {
    id: "cm-6",
    rede: "instagram",
    origem: "organico",
    campanha: null,
    autor_handle: "@helena.duarte",
    texto: "O sorteio do APCAP VIP desse domingo é que horas?",
    publicado_em: haMin(60 * 12),
    sentimento: "neutro",
    temas: ["duvida"],
    suspeita_golpe: false,
    estado: "oculto",
    gravidade: null,
    rede_pendente: false,
    rede_pendente_motivo: null,
    respondido_auto: false,
    acao_em_curso: null,
    respostas: null,
    conversa_id: null,
    motivo: null,
    produto_slug: PRODUTO_VIP,
  },
];

const ROTULO_TEMA: Record<string, string> = {
  duvida: "Dúvida",
  elogio: "Elogio",
  reclamacao: "Reclamação",
  premio: "Prêmio",
  golpe: "Golpe",
  preco: "Preço",
};

const macros: MacroDb[] = [
  {
    id: "mac-boas-vindas",
    titulo: "Boas-vindas",
    corpo: "Oi, {{nome}}! Aqui é a {{atendente}}, do Mestre do Bolão. Como posso te ajudar?",
    variaveis: ["nome", "atendente"],
    motivoId: null,
  },
  {
    id: "mac-bolos-hoje",
    titulo: "Bolões de hoje",
    corpo: "Os bolões de hoje são: Lotofácil (cota R$ 25), Mega-Sena (cota R$ 35) e Quina (cota R$ 15). Qual você quer?",
    variaveis: [],
    motivoId: null,
  },
  {
    id: "mac-pix",
    titulo: "Enviar Pix",
    corpo: "Para garantir sua cota, faça o Pix de {{valor}} para a chave mestredobolao@pix.com.br e me mande o comprovante por aqui.",
    variaveis: ["valor"],
    motivoId: MOT.vendaConcluida,
  },
  {
    id: "mac-premio",
    titulo: "Parabéns pelo prêmio",
    corpo: "Parabéns, {{nome}}! 🎉 Para resgatar, me confirme a chave Pix que cai em até 2 dias úteis.",
    variaveis: ["nome"],
    motivoId: MOT.premio,
  },
];

const edicoes: Record<string, Edicao[]> = {
  [PRODUTO_PADRAO]: [
    {
      id: "ed-lotofacil-indep",
      id_ion: "ION-LF-INDEP-2026",
      nome: "Lotofácil da Independência 2026",
      inicio: "2026-08-20",
      fim: "2026-10-10",
      vigente: true,
    },
    {
      id: "ed-mega-virada",
      id_ion: "ION-MS-VIRADA-2026",
      nome: "Mega da Virada 2026",
      inicio: "2026-10-11",
      fim: "2026-12-31",
      vigente: false,
    },
  ],
  [PRODUTO_VIP]: [
    {
      id: "ed-vip-out",
      id_ion: "ION-VIP-ED42",
      nome: "APCAP VIP · Edição 42",
      inicio: "2026-09-28",
      fim: "2026-10-04",
      vigente: true,
    },
  ],
};

/** Respostas publicadas por motivo (chave `motivoId`). */
const respostas: Record<string, RespostaDb[]> = {
  [MOT.duvida]: [
    {
      versao: 2,
      corpo: "O bolão é um jogo em grupo: você compra uma cota e divide o prêmio com os outros participantes, na proporção das cotas.",
      publico: true,
      estado: "publicado",
      escopo: "global",
      edicao_id: null,
      publicadoEm: haMin(60 * 24 * 12),
    },
  ],
  [MOT.vendaConcluida]: [
    {
      versao: 1,
      corpo: "Perfeito! Vou te mandar o Pix para garantir a sua cota.",
      publico: false,
      estado: "publicado",
      escopo: "global",
      edicao_id: null,
      publicadoEm: haMin(60 * 24 * 30),
    },
  ],
  "mot-mb-comprovante": [
    {
      versao: 1,
      corpo: "Seu comprovante fica em Meus jogos, no site do Mestre do Bolão, assim que o pagamento é confirmado.",
      publico: true,
      estado: "publicado",
      escopo: "por_edicao",
      edicao_id: "ed-lotofacil-indep",
      publicadoEm: haMin(60 * 24 * 5),
    },
  ],
};

const lacunas = [
  {
    id: "lac-1",
    pergunta: "Posso dividir uma cota com outra pessoa?",
    marcado_por: "Maria Souza",
    resolvido: false,
    created_at: haMin(60 * 5),
  },
  {
    id: "lac-2",
    pergunta: "Qual o horário limite para entrar no bolão do dia?",
    marcado_por: "Joana Lima",
    resolvido: false,
    created_at: haMin(60 * 30),
  },
];

const tokensCanal: Record<string, { configured: boolean; updatedAt: string | null }> = {
  [CANAL_WA_BOLAO]: { configured: true, updatedAt: haMin(60 * 24 * 20) },
  [CANAL_WA_VIP]: { configured: true, updatedAt: haMin(60 * 24 * 40) },
  [CANAL_IG]: { configured: true, updatedAt: haMin(60 * 24 * 3) },
};

// ── O estado exportado ────────────────────────────────────────────────────

export const db = {
  me: {
    id: EU_ID,
    nome: "Maria Souza",
    email: "maria@mestredobolao.com.br",
    codigo: "MARIA01",
    papel: "vendedora",
  },
  praca,
  /** Catálogo global de produtos (o que `/api/authz/produtos` devolve). */
  produtos: [
    { slug: PRODUTO_PADRAO, nome: "Mestre do Bolão", foto_url: null as string | null },
    { slug: PRODUTO_VIP, nome: "APCAP VIP", foto_url: null as string | null },
  ],
  filas,
  atendentes,
  conversas,
  mensagens,
  midias,
  taxonomia,
  macros,
  comentarios,
  encaminhamentos,
  edicoes,
  respostas,
  lacunas,
  tokensCanal,
  rotuloTema: ROTULO_TEMA,
};

// ── Notificação ───────────────────────────────────────────────────────────

type Ouvinte = () => void;
const ouvintes = new Set<Ouvinte>();

/** Inscreve um callback chamado a cada mutação. Devolve a função de desinscrever. */
export function onMudanca(cb: () => void): () => void {
  ouvintes.add(cb);
  return () => {
    ouvintes.delete(cb);
  };
}

/** Avisa os inscritos (sem invalidar o RTK Query). Uso interno do servidor. */
export function emitir(): void {
  for (const cb of ouvintes) {
    try {
      cb();
    } catch (e) {
      console.error("[mock] ouvinte falhou", e);
    }
  }
}

/** Faz o RTK Query rebuscar as consultas marcadas com estas tags. */
export function invalidar(tags: TagApi[]): void {
  store.dispatch(api.util.invalidateTags(tags));
}

function notificar(tags: TagApi[]) {
  emitir();
  invalidar(tags);
}

// ── Leituras derivadas ────────────────────────────────────────────────────

export function acharConversa(id: string): ConversaDb | undefined {
  return db.conversas.find((c) => c.id === id);
}

export function nomeDoUsuario(userId: string | null | undefined): string | null {
  if (!userId) return null;
  return db.atendentes.find((a) => a.user_id === userId)?.nome ?? null;
}

export { acharMotivo };

export function canalDe(c: ConversaDb): Canal {
  const canal = db.praca.canais.find((k) => k.id === c.canal_id) ?? db.praca.canais[0]!;
  return { id: canal.id, tipo: canal.tipo, rotulo: canal.rotulo, status: canal.status };
}

export function rotuloProduto(slug: string): string {
  return db.produtos.find((p) => p.slug === slug)?.nome ?? slug;
}

export function janelaDe(c: ConversaDb): ConversaDetalhe["janela"] {
  const ultCliente = [...(db.mensagens[c.id] ?? [])].reverse().find((m) => m.autor === "cliente");
  if (!ultCliente) return { aberta: false, restaMinutos: 0, expiraEm: null, permite: "template" };
  const expira = new Date(ultCliente.created_at).getTime() + 24 * 60 * MIN;
  const resta = Math.max(0, Math.floor((expira - Date.now()) / MIN));
  const aberta = resta > 0;
  return {
    aberta,
    restaMinutos: resta,
    expiraEm: new Date(expira).toISOString(),
    permite: aberta ? "livre" : "template",
  };
}

const abertoDe = (c: ConversaDb) => c.atendimentos.find((a) => !a.resolvido_em) ?? null;

function resumoAtendimento(a: AtendimentoDb | null | undefined): AtendimentoResumo | null {
  if (!a) return null;
  const { resolucao: _r, avaliacao: _a, aberto_em: _e, ...resto } = a;
  void _r;
  void _a;
  void _e;
  const estourado = !a.resolvido_em && !!a.sla_com_resolucao_em && new Date(a.sla_com_resolucao_em).getTime() < Date.now();
  return { ...resto, sla_com_estourado: estourado };
}

export function paraItem(c: ConversaDb): ConversaItem & { origem: OrigemConversa | null } {
  const ms = db.mensagens[c.id] ?? [];
  const ult = ms.at(-1);
  const aberto = abertoDe(c);
  return {
    id: c.id,
    estado: c.estado,
    sentimento: c.sentimento,
    temas: [...c.temas],
    tags: [...c.tags],
    canal: canalDe(c),
    // Na LISTA a API real devolve o NOME (a linha escreve "Com Fulano"); no detalhe
    // devolve o id, que é o que a tela compara com quem está logado.
    responsavel: nomeDoUsuario(c.responsavel),
    produto_slug: c.produto_slug,
    produto: { slug: c.produto_slug, rotulo: rotuloProduto(c.produto_slug) },
    janela_expira_em: janelaDe(c).expiraEm,
    ultimo_evento_em: c.ultimo_evento_em,
    contato: { ...c.contato, tags: [...(c.contato.tags ?? [])] },
    atendimento: resumoAtendimento(aberto ?? c.atendimentos.at(-1)),
    avaliacao: { ...c.avaliacao },
    previa: ult
      ? {
          conteudo: ult.conteudo ?? (ult.midia_gcs ? `[${ult.tipo === "image" ? "imagem" : "anexo"}]` : null),
          autor: ult.autor,
          created_at: ult.created_at,
        }
      : null,
    origem: c.origem,
  };
}

export function paraDetalhe(c: ConversaDb): ConversaDetalhe & { origem: OrigemConversa | null } {
  const { atendimento: _a, previa: _p, ...base } = paraItem(c);
  void _a;
  void _p;
  return {
    ...base,
    responsavel: c.responsavel,
    corpoOculto: false,
    atendimentos: c.atendimentos.map((a) => ({
      ...resumoAtendimento(a)!,
      resolvido_em: a.resolvido_em,
      resolucao: a.resolucao,
      avaliacao: a.avaliacao,
    })),
    mensagens: (db.mensagens[c.id] ?? []).map((m) => ({ ...m })),
    janela: janelaDe(c),
  };
}

/** Recalcula a carga de cada atendente pelas conversas abertas dele. */
export function recalcularCarga(): void {
  for (const a of db.atendentes) {
    a.carga = db.conversas.filter(
      (c) => c.responsavel === a.user_id && !["resolvida", "expirada"].includes(c.estado),
    ).length;
  }
}
recalcularCarga();

// ── Mutações (núcleo, sem notificar) ──────────────────────────────────────

export interface NovaMensagem {
  autor: Mensagem["autor"];
  /** `text` (padrão), `image` (com `url`) ou `template`. Outros tipos passam direto. */
  tipo?: "text" | "image" | "template" | "document" | "audio" | string;
  texto?: string | null;
  /** URL da mídia (http, data: ou blob:). Obrigatória para `image`. */
  url?: string;
  mime?: string;
  nome?: string;
  bytes?: number;
  /** Quando aconteceu. Padrão: agora. */
  em?: string | Date;
  status_entrega?: string | null;
  origem_resposta?: Mensagem["origem_resposta"];
  botoes?: string[];
}

export function _adicionarMensagem(conversaId: string, nova: NovaMensagem): Mensagem {
  const c = acharConversa(conversaId);
  if (!c) throw new Error(`[mock] conversa ${conversaId} não existe`);
  const id = novoId("msg");
  const tipo = nova.tipo ?? (nova.url ? "image" : "text");
  const nosso = nova.autor === "atendente" || nova.autor === "bot";
  const m: Mensagem = {
    id,
    direcao: nova.autor === "cliente" ? "inbound" : "outbound",
    autor: nova.autor,
    tipo,
    conteudo: nova.texto ?? null,
    midia_gcs: nova.url ? `mock://${id}` : null,
    status_entrega: nova.status_entrega !== undefined ? nova.status_entrega : nosso ? "enviada" : null,
    origem_resposta:
      nova.origem_resposta !== undefined
        ? nova.origem_resposta
        : nova.autor === "atendente"
          ? "humano"
          : nova.autor === "bot"
            ? "arvore"
            : null,
    created_at: nova.em ? new Date(nova.em).toISOString() : agoraIso(),
    botoes: nova.botoes ?? null,
  };
  if (nova.url) {
    db.midias[id] = {
      url: nova.url,
      mime: nova.mime ?? (tipo === "image" ? "image/jpeg" : "application/octet-stream"),
      nome: nova.nome ?? null,
      bytes: nova.bytes ?? null,
    };
  }
  (db.mensagens[conversaId] ??= []).push(m);
  c.ultimo_evento_em = m.created_at;

  if (nova.autor === "cliente") {
    // Cliente voltou: conversa fechada reabre, e quem esperava o cliente volta a atender.
    if (c.estado === "resolvida" || c.estado === "expirada") {
      c.estado = "reaberta";
      c.avaliacao = avaliacaoAberta();
    } else if (c.estado === "aguardando_cliente") {
      c.estado = "em_atendimento";
    }
  } else if (nova.autor === "atendente") {
    if (c.estado === "nova" || c.estado === "reaberta") c.estado = "em_atendimento";
    if (!c.responsavel) c.responsavel = EU_ID;
    c.com_bot = false;
  }
  recalcularCarga();
  return m;
}

export function _definirTags(conversaId: string, tags: string[]): void {
  const c = acharConversa(conversaId);
  if (!c) throw new Error(`[mock] conversa ${conversaId} não existe`);
  c.tags = [...new Set(tags.map((t) => t.trim()).filter(Boolean))];
}

export interface NovaConversa {
  nome: string;
  telefone: string;
  produto_slug?: string;
  origem?: OrigemConversa | string | null;
  /** Primeira mensagem do cliente (opcional). */
  mensagem?: string;
  responsavel?: string | null;
  fila_id?: string | null;
  tags?: string[];
}

export function _criarConversa(dados: NovaConversa): string {
  const id = novoId("cv");
  const produto = dados.produto_slug ?? PRODUTO_PADRAO;
  const canal = db.praca.canais.find((k) => k.tipo === "whatsapp" && k.produto_slug === produto) ?? db.praca.canais[0]!;
  const origem: OrigemConversa | null =
    typeof dados.origem === "string"
      ? { tipo: "landing_page", rotulo: dados.origem, campanha: dados.origem, utm: { campaign: dados.origem } }
      : (dados.origem ?? null);
  const agora = agoraIso();
  db.conversas.unshift({
    id,
    estado: "nova",
    sentimento: "nao_classificado",
    temas: [],
    tags: dados.tags ?? [],
    canal_id: canal.id,
    responsavel: dados.responsavel ?? null,
    fila_id: dados.fila_id ?? FILA_VENDAS,
    produto_slug: produto,
    contato: contato(novoId("ct"), dados.nome, dados.telefone),
    atendimentos: [],
    avaliacao: avaliacaoAberta(),
    origem,
    criado_em: agora,
    ultimo_evento_em: agora,
  });
  db.mensagens[id] = [];
  if (origem) {
    _adicionarMensagem(id, { autor: "sistema", texto: `Chegou por: ${origem.rotulo}` });
  }
  if (dados.mensagem) _adicionarMensagem(id, { autor: "cliente", texto: dados.mensagem });
  recalcularCarga();
  return id;
}

export function _transferir(
  conversaId: string,
  para: { paraUserId?: string; paraFilaId?: string; motivo?: string },
): void {
  const c = acharConversa(conversaId);
  if (!c) throw new Error(`[mock] conversa ${conversaId} não existe`);
  const partes: string[] = [];
  if (para.paraFilaId) {
    c.fila_id = para.paraFilaId;
    if (!para.paraUserId) c.responsavel = null;
    partes.push(`para a fila ${db.filas.find((f) => f.id === para.paraFilaId)?.nome ?? para.paraFilaId}`);
  }
  if (para.paraUserId) {
    c.responsavel = para.paraUserId;
    const fila = db.atendentes.find((a) => a.user_id === para.paraUserId)?.fila_id;
    if (fila && !para.paraFilaId) c.fila_id = fila;
    partes.push(`para ${nomeDoUsuario(para.paraUserId) ?? "outro atendente"}`);
  }
  if (c.estado === "nova") c.estado = c.responsavel ? "em_atendimento" : "nova";
  _adicionarMensagem(conversaId, {
    autor: "sistema",
    texto: `Conversa transferida ${partes.join(" e ")}${para.motivo ? `: ${para.motivo}` : ""}`,
  });
  recalcularCarga();
}

// ── API pública (notifica e invalida) ─────────────────────────────────────

/** Acrescenta uma mensagem (cliente, atendente, bot ou sistema) e atualiza a tela. */
export function adicionarMensagem(conversaId: string, msgNova: NovaMensagem): Mensagem {
  const m = _adicionarMensagem(conversaId, msgNova);
  notificar(["Conversa", "Fila", "Atendimento"]);
  return m;
}

/** Substitui as tags (texto livre) da conversa. */
export function definirTags(conversaId: string, tags: string[]): void {
  _definirTags(conversaId, tags);
  notificar(["Conversa"]);
}

/** Cria uma conversa de WhatsApp nova (sem dono, na fila Vendas Bolão). Devolve o id. */
export function criarConversa(dados: NovaConversa): string {
  const id = _criarConversa(dados);
  notificar(["Conversa", "Fila", "Atendimento"]);
  return id;
}

/** Transfere para um atendente (`paraUserId`) e/ou uma fila (`paraFilaId`). */
export function transferir(
  conversaId: string,
  para: { paraUserId?: string; paraFilaId?: string; motivo?: string },
): void {
  _transferir(conversaId, para);
  notificar(["Conversa", "Fila", "Atendimento"]);
}

/** Muda campos arbitrários da conversa (estado, sentimento, responsável...). */
export function atualizarConversa(conversaId: string, campos: Partial<Omit<ConversaDb, "id">>): void {
  const c = acharConversa(conversaId);
  if (!c) throw new Error(`[mock] conversa ${conversaId} não existe`);
  Object.assign(c, campos);
  recalcularCarga();
  notificar(["Conversa", "Fila", "Atendimento"]);
}
