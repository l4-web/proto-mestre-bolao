/**
 * Servidor FALSO do protótipo: substitui `window.fetch` e responde, a partir do
 * banco em memória (`db.ts`), todas as rotas que o front chama.
 *
 * - `/api/auth/*`, `/api/authz/*`, `/api/theme`, `/api/notificacoes`: o master.
 * - `.../v1/...`: a API do módulo (o RTK Query usa caminho relativo, então o
 *   prefixo antes de `v1/` varia com o `base` da página e é ignorado).
 * - Qualquer outra URL passa direto para o `fetch` original (Vite, assets).
 *
 * Rota desconhecida responde 200 com corpo vazio e avisa no console.
 */
import {
  CARLOS_ID,
  CODIGO_ATENDENTE,
  EMPRESA_ID,
  EU_ID,
  PRODUTO_PADRAO,
  _adicionarMensagem,
  _transferir,
  acharConversa,
  acharMotivo,
  agoraIso,
  db,
  emitir,
  invalidar,
  nomeDoUsuario,
  novoId,
  paraDetalhe,
  paraItem,
  recalcularCarga,
  type ConversaDb,
} from "./db";
import type { L4Claim } from "@l4-web/authz";
import type { Visao } from "../features/atendimento/tipos";

// ── Infra de resposta ─────────────────────────────────────────────────────

class ErroHttp extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

const NUNCA = Symbol("nunca");

interface Ctx {
  metodo: string;
  caminho: string;
  query: URLSearchParams;
  corpo: unknown;
  params: string[];
}

type Handler = (ctx: Ctx) => unknown | Promise<unknown>;

const rotas: { metodo: string; padrao: RegExp; h: Handler }[] = [];
function rota(metodo: string, padrao: string, h: Handler) {
  // `:x` vira grupo de captura de um segmento.
  const re = new RegExp("^" + padrao.replace(/:[a-zA-Z]+/g, "([^/]+)") + "/?$");
  rotas.push({ metodo, padrao: re, h });
}

const atraso = () => new Promise((r) => setTimeout(r, 150 + Math.random() * 150));

function json(dado: unknown, status = 200): Response {
  return new Response(JSON.stringify(dado ?? null), {
    status,
    headers: { "content-type": "application/json" },
  });
}

const obj = (c: unknown): Record<string, unknown> =>
  c && typeof c === "object" && !(c instanceof FormData) ? (c as Record<string, unknown>) : {};

function conversaOu404(id: string): ConversaDb {
  const c = acharConversa(id);
  if (!c) throw new ErroHttp(404, "Conversa não encontrada.");
  return c;
}

const ABERTA = (c: ConversaDb) => !["resolvida", "expirada"].includes(c.estado);

// ── Master: sessão, authz, tema, notificações ─────────────────────────────

const TELAS = [
  "conversas",
  "supervisao",
  "encaminhamentos-dev",
  "encaminhamentos-pagamentos",
  "social",
  "escuta",
  "base",
  "consumo",
  "config",
];

const ACOES = [
  "conversas.responder",
  "conversas.ler-todas",
  "conversas.encerrar",
  "fila.reatribuir",
  "encaminhar.criar",
  "contato.financeiro",
  "contato.pessoais",
  "base.gerenciar",
  "social.responder",
  "social.ocultar",
];

export const CLAIM: L4Claim = {
  pv: 1,
  sa: false,
  mng: ["atendeai"],
  scope: { orgs: ["org-mestre-do-bolao"], emps: [EMPRESA_ID] },
  m: {
    atendeai: {
      v: 1,
      r: ["atendente", "supervisor", "admin"],
      scr: TELAS,
      prod: db.produtos.map((p) => p.slug),
      axis: "produto",
      rules: Object.fromEntries(
        ACOES.flatMap((a) => ["view", "edit", "create", "delete", "manage"].map((acao) => [`${a}:${acao}`, 1 as const])),
      ),
    },
  },
};

rota("GET", "api/auth/me", () => ({
  user: {
    id: db.me.id,
    email: db.me.email,
    user_metadata: { name: db.me.nome, full_name: db.me.nome, avatar_url: null },
    app_metadata: { provider: "prototipo" },
  },
  authz: CLAIM,
  supabaseToken: "prototipo",
}));
rota("POST", "api/auth/refresh", () => ({ ok: true }));
// Logout é no-op: a promessa nunca resolve, então o shell não redireciona para o login.
rota("POST", "api/auth/logout", () => NUNCA);

rota("GET", "api/authz/catalog", () => ({
  resources: [
    {
      slug: "atendeai",
      parent_id: null,
      module_id: "atendeai",
      kind: "module",
      label: "Atende Aí",
      allowed_actions: ["view"],
      ordem: 1,
      nome: "Atende Aí",
      descricao: "Atendimento do Mestre do Bolão",
    },
    ...TELAS.map((t, i) => ({
      slug: `atendeai:${t}`,
      parent_id: "atendeai",
      module_id: "atendeai",
      kind: "screen",
      label: t,
      allowed_actions: ["view"],
      ordem: i + 2,
    })),
  ],
}));
rota("GET", "api/authz/produtos", () => ({ produtos: db.produtos }));
rota("GET", "api/theme", () => ({ theme: null }));
rota("GET", "api/notificacoes", () => ({ itens: [], naoLidas: 0 }));
rota("PATCH", "api/notificacoes/:id/lida", () => ({ ok: true }));
rota("POST", "api/notificacoes/marcar-todas-lidas", () => ({ ok: true }));
rota("DELETE", "api/notificacoes/lidas", () => ({ ok: true }));

// ── Praça, filas, atendentes ──────────────────────────────────────────────

rota("GET", "v1/praca", () => [db.praca]);

rota("PATCH", "v1/praca/:empresa", ({ corpo }) => {
  const c = obj(corpo);
  if (typeof c.teto_reais_mes === "number") {
    db.praca.teto_micros_mes = String(Math.round(c.teto_reais_mes * 1_000_000));
    delete c.teto_reais_mes;
  }
  Object.assign(db.praca, c);
  return { ok: true };
});

rota("POST", "v1/praca/:empresa/canais", ({ corpo }) => {
  const c = obj(corpo);
  const id = novoId("canal");
  db.praca.canais.push({
    id,
    tipo: (c.tipo as "whatsapp") ?? "whatsapp",
    rotulo: String(c.rotulo ?? "Canal novo"),
    status: "ativo",
    external_id: String(c.external_id ?? ""),
    waba_id: (c.waba_id as string) ?? null,
    secret_nome: (c.secret_nome as string) ?? `atendeai-${id}-token`,
    produto_slug: null,
    quality_rating: null,
    subscribed_apps_ok: true,
    token_expira_em: null,
    ultimo_evento_em: null,
  });
  db.tokensCanal[id] = { configured: Boolean(c.token || c.secret_nome), updatedAt: agoraIso() };
  return { ok: true, id, status: "ativo" };
});

rota("PATCH", "v1/praca/:empresa/canais/:canal", ({ params, corpo }) => {
  const canal = db.praca.canais.find((k) => k.id === params[1]);
  if (!canal) throw new ErroHttp(404, "Canal não encontrado.");
  const { token, ...resto } = obj(corpo);
  Object.assign(canal, resto);
  if (token) db.tokensCanal[canal.id] = { configured: true, updatedAt: agoraIso() };
  return { ok: true };
});

rota("GET", "v1/canais/:canal/token", ({ params }) => {
  const canal = db.praca.canais.find((k) => k.id === params[0]);
  const t = db.tokensCanal[params[0]!] ?? { configured: false, updatedAt: null };
  return { ok: true, secret_nome: canal?.secret_nome ?? null, derivado: true, ...t };
});

rota("PATCH", "v1/canais/:canal", ({ params, corpo }) => {
  const canal = db.praca.canais.find((k) => k.id === params[0]);
  if (!canal) throw new ErroHttp(404, "Canal não encontrado.");
  canal.produto_slug = (obj(corpo).produto_slug as string | null) ?? null;
  return { ok: true };
});

rota("PATCH", "v1/praca/:empresa/compliance/:produto", ({ params, corpo }) => {
  const p = db.praca.produtos.find((x) => x.produto_slug === params[1]);
  if (!p) throw new ErroHttp(404, "Produto não encontrado.");
  const c = obj(corpo);
  p.compliance = {
    bloqueio_duro: (c.bloqueio_duro as string[]) ?? p.compliance?.bloqueio_duro ?? [],
    termos_revisao: (c.termos_revisao as string[]) ?? p.compliance?.termos_revisao ?? [],
    idade_minima: (c.idade_minima as number) ?? p.compliance?.idade_minima ?? 18,
  };
  return { ok: true };
});

rota("PATCH", "v1/praca/:empresa/produtos/:produto", ({ params, corpo }) => {
  const p = db.praca.produtos.find((x) => x.produto_slug === params[1]);
  if (!p) throw new ErroHttp(404, "Produto não encontrado.");
  p.ion_marca = (obj(corpo).ion_marca as string) ?? null;
  return { ok: true };
});

rota("GET", "v1/filas", () => db.filas);
rota("GET", "v1/filas/atendentes", ({ query }) => {
  recalcularCarga();
  const fila = query.get("filaId");
  return db.atendentes.filter((a) => !fila || a.fila_id === fila);
});
rota("GET", "v1/atendentes", () => {
  recalcularCarga();
  return db.atendentes.map((a) => ({ ...a, codigo: CODIGO_ATENDENTE[a.user_id] ?? null }));
});
rota("PUT", "v1/atendentes/:user/produtos", ({ params, corpo }) => {
  const a = db.atendentes.find((x) => x.user_id === params[0]);
  if (!a) throw new ErroHttp(404, "Atendente não encontrado.");
  a.produtos = (obj(corpo).produtos as string[]) ?? [];
  return { ok: true };
});
rota("POST", "v1/filas/meu-status", ({ corpo }) => {
  const eu = db.atendentes.find((a) => a.user_id === EU_ID);
  if (eu) {
    eu.status = (obj(corpo).status as "online") ?? "online";
    eu.status_desde = agoraIso();
  }
  return { ok: true };
});

// ── Conversas ─────────────────────────────────────────────────────────────

function filtrarPorVisao(visao: Visao, c: ConversaDb): boolean {
  if (c.com_bot) return false;
  switch (visao) {
    case "minhas":
      return c.responsavel === EU_ID && ABERTA(c) && c.estado !== "aguardando_equipe";
    case "nao-atribuidas":
      return !c.responsavel && ABERTA(c);
    case "fila":
      return ABERTA(c) && c.estado !== "aguardando_equipe";
    case "resolvidas":
      return !ABERTA(c);
    case "aguardando-equipe":
      return c.estado === "aguardando_equipe";
    default:
      return ABERTA(c);
  }
}

rota("GET", "v1/conversas", ({ query }) => {
  const visao = (query.get("visao") ?? "fila") as Visao;
  const produto = query.get("produto");
  const filaId = query.get("filaId");
  const busca = query.get("busca")?.toLowerCase().trim();
  const contatoId = query.get("contatoId");
  const sentimento = query.get("sentimento");
  const tema = query.get("tema");
  const tag = query.get("tag");
  const gravidade = query.get("gravidade");
  const atrasadas = query.get("atrasadas") === "true";

  let lista = db.conversas.filter((c) => (contatoId ? c.contato.id === contatoId : filtrarPorVisao(visao, c)));
  if (produto) lista = lista.filter((c) => c.produto_slug === produto);
  if (filaId) lista = lista.filter((c) => c.fila_id === filaId);
  if (sentimento) lista = lista.filter((c) => c.sentimento === sentimento);
  if (tema) lista = lista.filter((c) => c.temas.includes(tema));
  if (tag) lista = lista.filter((c) => c.tags.includes(tag));
  if (busca) {
    lista = lista.filter((c) =>
      [c.contato.nome, c.contato.telefone, ...c.tags, ...(db.mensagens[c.id] ?? []).map((m) => m.conteudo)]
        .filter(Boolean)
        .some((t) => String(t).toLowerCase().includes(busca)),
    );
  }
  let itens = lista.map(paraItem);
  if (gravidade) itens = itens.filter((i) => i.atendimento?.gravidade === gravidade);
  if (atrasadas) itens = itens.filter((i) => i.atendimento?.sla_com_estourado);
  itens.sort((a, b) => b.ultimo_evento_em.localeCompare(a.ultimo_evento_em));
  return { itens, proximoCursor: null };
});

rota("GET", "v1/conversas/contagem", ({ query }) => {
  const produto = query.get("produto");
  const base = db.conversas.filter((c) => !produto || c.produto_slug === produto);
  const conta = (v: Visao) => base.filter((c) => filtrarPorVisao(v, c)).length;
  return {
    minhas: conta("minhas"),
    naoAtribuidas: conta("nao-atribuidas"),
    fila: conta("fila"),
    comBot: base.filter((c) => c.com_bot && ABERTA(c)).length,
    aguardandoEquipe: conta("aguardando-equipe"),
  };
});

rota("GET", "v1/conversas/:id", ({ params }) => paraDetalhe(conversaOu404(params[0]!)));

rota("GET", "v1/conversas/:id/consulta", ({ params }) => {
  const c = conversaOu404(params[0]!);
  const premiada = c.tags.some((t) => t.toLowerCase().includes("premiad"));
  return {
    identificacao: { resolvido: true, por: "telefone", pedirAoCliente: null, consultadoSemResultado: false },
    linhas: [
      { chave: "cliente_desde", rotulo: "Cliente desde", fonte: "ion", estado: "ok", valor: "mar/2024", nota: null },
      {
        chave: "compras",
        rotulo: "Bolões comprados (90 dias)",
        fonte: "ion",
        estado: "ok",
        valor: c.id.includes("marcos") ? "Primeira compra" : "7 bolões · R$ 245,00",
        nota: null,
      },
      {
        chave: "premios",
        rotulo: "Prêmios",
        fonte: "ion",
        estado: premiada ? "ok" : "nao_consta",
        valor: premiada ? "Quina · R$ 412,37 (a resgatar)" : null,
        nota: null,
      },
      {
        chave: "origem",
        rotulo: "Origem",
        fonte: "disparai",
        estado: c.origem ? "ok" : "nao_consta",
        valor: c.origem?.rotulo ?? null,
        nota: c.origem?.utm?.campaign ? `utm_campaign=${c.origem.utm.campaign}` : null,
      },
      { chave: "saldo", rotulo: "Saldo APCAP VIP", fonte: "apcap", estado: "sem_fonte", valor: null, nota: "Fonte ainda não integrada." },
    ],
    divergencia: false,
    divergenciaNota: null,
    optOut: false,
    leadUrl: null,
  };
});

rota("POST", "v1/conversas/:id/classificar", ({ params, corpo }) => {
  const c = conversaOu404(params[0]!);
  const b = obj(corpo);
  if (b.sentimento) c.sentimento = b.sentimento as ConversaDb["sentimento"];
  if (Array.isArray(b.temas)) c.temas = b.temas as string[];
  if (Array.isArray(b.tags)) c.tags = b.tags as string[];
  return { ok: true };
});

rota("GET", "v1/midias/:id", ({ params }) => {
  const m = db.midias[params[0]!];
  if (!m) throw new ErroHttp(404, "Anexo não encontrado.");
  return m;
});

// ── Atendimentos ──────────────────────────────────────────────────────────

function abrirCaso(c: ConversaDb, motivoId?: string) {
  const existente = c.atendimentos.find((a) => !a.resolvido_em);
  if (existente) return existente;
  const m = acharMotivo(motivoId);
  const agora = Date.now();
  const at = {
    id: novoId("at"),
    ref: `MB-2026-${String(420 + c.atendimentos.length + db.conversas.indexOf(c)).padStart(4, "0")}`,
    gravidade: m?.gravidade_padrao ?? ("medio" as const),
    resolvido_em: null,
    sla_com_resolucao_em: new Date(agora + 4 * 3600_000).toISOString(),
    sla_com_estourado: false,
    sla_reg_prazo_em: null,
    sla_reg_estourado: false,
    motivo: m ? { id: m.id, label: m.label, codigo_tratamento: m.codigo_tratamento } : null,
    resolucao: null,
    aberto_em: new Date(agora).toISOString(),
  };
  c.atendimentos.push(at);
  return at;
}

function acharAtendimento(id: string) {
  for (const c of db.conversas) {
    const a = c.atendimentos.find((x) => x.id === id);
    if (a) return { c, a };
  }
  throw new ErroHttp(404, "Atendimento não encontrado.");
}

rota("POST", "v1/atendimentos/conversas/:id", ({ params, corpo }) => {
  const c = conversaOu404(params[0]!);
  return { id: abrirCaso(c, obj(corpo).motivoId as string | undefined).id };
});

rota("POST", "v1/atendimentos/conversas/:id/assumir", ({ params }) => {
  const c = conversaOu404(params[0]!);
  c.responsavel = EU_ID;
  c.com_bot = false;
  if (c.estado === "nova" || c.estado === "reaberta") c.estado = "em_atendimento";
  _adicionarMensagem(c.id, { autor: "sistema", texto: `${db.me.nome} assumiu a conversa` });
  return { ok: true };
});

rota("POST", "v1/atendimentos/conversas/:id/soltar", ({ params }) => {
  const c = conversaOu404(params[0]!);
  c.responsavel = null;
  c.estado = "nova";
  _adicionarMensagem(c.id, { autor: "sistema", texto: `${db.me.nome} devolveu a conversa para a fila` });
  return { ok: true };
});

rota("POST", "v1/atendimentos/conversas/:id/transferir", ({ params, corpo }) => {
  const c = conversaOu404(params[0]!);
  const b = obj(corpo);
  _transferir(c.id, {
    paraUserId: (b.paraUserId as string) || undefined,
    paraFilaId: (b.paraFilaId as string) || undefined,
    motivo: (b.motivo as string) || undefined,
  });
  return { id: c.id };
});

rota("POST", "v1/atendimentos/:id/encerrar", ({ params, corpo }) => {
  const { c, a } = acharAtendimento(params[0]!);
  const b = obj(corpo);
  const m = acharMotivo(b.motivoId as string);
  if (!m) throw new ErroHttp(400, "Escolha o motivo do encerramento.");
  const agora = agoraIso();
  a.motivo = { id: m.id, label: m.label, codigo_tratamento: m.codigo_tratamento };
  a.resolvido_em = agora;
  a.resolucao = (b.resolucao as string) || null;
  a.avaliacao = { estado: "sem_resposta", nota: null, rotulo: null, pedidoEm: agora, respondidoEm: null };
  c.avaliacao = { ...a.avaliacao };
  c.estado = "resolvida";
  _adicionarMensagem(c.id, { autor: "sistema", texto: `Atendimento encerrado: ${m.label}` });
  _adicionarMensagem(c.id, {
    autor: "bot",
    tipo: "template",
    texto: "Como foi o seu atendimento? Responda 1 (Ruim), 3 (Regular) ou 5 (Ótimo).",
    status_entrega: "entregue",
  });
  recalcularCarga();
  return { id: a.id };
});

rota("GET", "v1/atendimentos/em-risco", () => {
  const lista = [];
  for (const c of db.conversas) {
    for (const a of c.atendimentos) {
      if (a.resolvido_em) continue;
      lista.push({
        id: a.id,
        ref: a.ref,
        gravidade: a.gravidade,
        responsavel: nomeDoUsuario(c.responsavel),
        sla_com_resolucao_em: a.sla_com_resolucao_em,
        sla_reg_tipo: null,
        sla_reg_prazo_em: a.sla_reg_prazo_em,
        motivo: a.motivo ? { label: a.motivo.label } : null,
      });
    }
  }
  return lista
    .sort((x, y) => String(x.sla_com_resolucao_em).localeCompare(String(y.sla_com_resolucao_em)))
    .slice(0, 4);
});

rota("GET", "v1/atendimentos/:id/encaminhamento", ({ params }) => {
  const { a } = acharAtendimento(params[0]!);
  const premio = a.motivo?.label === "Prêmio" || a.motivo?.label?.startsWith("Pagamento");
  return {
    ref: a.ref,
    motivo: a.motivo?.label ?? null,
    sugerida: premio ? "pagamentos" : null,
    equipes: [
      {
        equipe: "pagamentos",
        campos: ["Valor", "Concurso", "Chave Pix do cliente"],
        aviso: "A equipe financeira recebe nome e telefone do cliente.",
      },
      {
        equipe: "dev",
        campos: ["Tela", "Aparelho", "O que aconteceu"],
        aviso: "A equipe técnica NÃO recebe dado pessoal, só a referência do caso.",
      },
    ],
  };
});

rota("POST", "v1/atendimentos/:id/encaminhar", ({ params, corpo }) => {
  const { c, a } = acharAtendimento(params[0]!);
  const b = obj(corpo);
  const equipe = (b.equipe as "dev" | "pagamentos") ?? "pagamentos";
  const id = novoId("enc");
  db.encaminhamentos.unshift({
    id,
    equipe,
    conversa_id: c.id,
    atendimento_id: a.id,
    titulo: a.motivo?.label ?? `Caso ${a.ref}`,
    estado: "aberto",
    gravidade: a.gravidade,
    abertoPor: db.me.nome,
    abertoEm: agoraIso(),
    responsavel_id: null,
    pegoEm: null,
    resposta: null,
    respondidoPor: null,
    respondidoEm: null,
    demandaRef: null,
    coleta: (b.coleta as Record<string, string>) ?? {},
    notas: [],
  });
  c.estado = "aguardando_equipe";
  _adicionarMensagem(c.id, {
    autor: "sistema",
    texto: `Caso encaminhado para a equipe ${equipe === "dev" ? "técnica" : "financeira"}`,
  });
  return { ok: true, dado: { id, equipe, estado: "aberto" } };
});

// ── Envio ─────────────────────────────────────────────────────────────────

/** Simula a confirmação de entrega e leitura da Meta. */
function simularEntrega(conversaId: string, mensagemId: string) {
  const passo = (status: string, ms: number) =>
    setTimeout(() => {
      const m = db.mensagens[conversaId]?.find((x) => x.id === mensagemId);
      if (!m) return;
      m.status_entrega = status;
      emitir();
      invalidar(["Conversa"]);
    }, ms);
  passo("entregue", 1500);
  passo("lida", 4500);
}

rota("POST", "v1/envio/conversas/:id", ({ params, corpo }) => {
  const c = conversaOu404(params[0]!);
  const texto = String(obj(corpo).texto ?? "").trim();
  if (!texto) throw new ErroHttp(400, "Escreva a mensagem antes de enviar.");
  const m = _adicionarMensagem(c.id, { autor: "atendente", texto });
  simularEntrega(c.id, m.id);
  return { ok: true, id: m.id, estado: c.estado };
});

rota("POST", "v1/envio/conversas/:id/anexo", ({ params, corpo }) => {
  const c = conversaOu404(params[0]!);
  if (!(corpo instanceof FormData)) throw new ErroHttp(400, "Anexo ausente.");
  const arquivo = corpo.get("arquivo");
  const texto = (corpo.get("texto") as string | null) ?? null;
  if (!(arquivo instanceof Blob)) throw new ErroHttp(400, "Anexo ausente.");
  const mime = arquivo.type || "application/octet-stream";
  const nome = (arquivo as File).name ?? "anexo";
  const tipo = mime.startsWith("image/")
    ? "image"
    : mime.startsWith("audio/")
      ? "audio"
      : mime.startsWith("video/")
        ? "video"
        : "document";
  const m = _adicionarMensagem(c.id, {
    autor: "atendente",
    tipo,
    texto,
    url: URL.createObjectURL(arquivo),
    mime,
    nome,
    bytes: arquivo.size,
  });
  simularEntrega(c.id, m.id);
  return { ok: true, id: m.id, estado: c.estado };
});

// ── Motivos, macros, bot, base ────────────────────────────────────────────

rota("GET", "v1/motivos", ({ query }) => db.taxonomia[query.get("produto") ?? PRODUTO_PADRAO] ?? []);

rota("GET", "v1/motivos/macros", ({ query }) => {
  const motivoId = query.get("motivoId");
  return db.macros
    .filter((m) => !m.motivoId || m.motivoId === motivoId)
    .map(({ motivoId: _m, ...resto }) => {
      void _m;
      return resto;
    });
});

function respostaVigente(motivoId: string, produto: string, edicaoId?: string | null) {
  const lista = db.respostas[motivoId] ?? [];
  const vigente = edicaoId ?? db.edicoes[produto]?.find((e) => e.vigente)?.id ?? null;
  return (
    [...lista].reverse().find((r) => r.escopo === "global" || r.edicao_id === vigente) ?? null
  );
}

rota("GET", "v1/motivos/prontidao-bot", ({ query }) => {
  const produto = query.get("produto") ?? PRODUTO_PADRAO;
  const edicaoId = query.get("edicaoId");
  const etapas = db.taxonomia[produto] ?? [];
  const SOZINHO = ["faq", "interno", "rg", "tc", "direto"];
  const itens = etapas.flatMap((e) =>
    e.filhos.map((m) => {
      const r = respostaVigente(m.id, produto, edicaoId);
      const responde = SOZINHO.includes(m.codigo_tratamento);
      const ed = r?.edicao_id ? db.edicoes[produto]?.find((x) => x.id === r.edicao_id) : null;
      return {
        id: m.id,
        slug: m.slug,
        cenario: m.label,
        etapa: e.label,
        gravidade: m.gravidade_padrao,
        tratamento: m.codigo_tratamento,
        gatilhos: m.gatilhos,
        respostaRestrita: m.resposta_restrita,
        respondeSozinho: responde,
        artigo: r ? m.slug : null,
        estadoResposta: r?.estado ?? null,
        escopo: r?.escopo ?? null,
        publico: r?.publico ?? null,
        edicaoDaResposta: ed ? { id: ed.id, nome: ed.nome } : null,
        motivoPendencia: null,
        historico: r ? Math.max(0, r.versao - 1) : 0,
        semResposta: responde && !r,
      };
    }),
  );
  return {
    etapas: etapas.map((e) => ({ id: e.id, label: e.label })),
    total: itens.length,
    respondeSozinho: itens.filter((i) => i.respondeSozinho).length,
    escala: itens.filter((i) => !i.respondeSozinho).length,
    semResposta: itens.filter((i) => i.semResposta).length,
    semGatilho: itens.filter((i) => i.gatilhos.length === 0).length,
    itens,
  };
});

rota("PATCH", "v1/motivos/:id", ({ params, corpo }) => {
  const m = acharMotivo(params[0]);
  if (!m) throw new ErroHttp(404, "Situação não encontrada.");
  const b = obj(corpo);
  if (b.gravidade_padrao) m.gravidade_padrao = b.gravidade_padrao as typeof m.gravidade_padrao;
  if (b.codigo_tratamento) m.codigo_tratamento = b.codigo_tratamento as typeof m.codigo_tratamento;
  if (Array.isArray(b.gatilhos)) m.gatilhos = b.gatilhos as string[];
  if (typeof b.resposta_restrita === "boolean") m.resposta_restrita = b.resposta_restrita;
  return { ok: true };
});

rota("POST", "v1/motivos", ({ query, corpo }) => {
  const produto = query.get("produto") ?? PRODUTO_PADRAO;
  const b = obj(corpo);
  const etapa = db.taxonomia[produto]?.find((e) => e.id === b.etapa_id) ?? db.taxonomia[produto]?.[0];
  if (!etapa) throw new ErroHttp(400, "Etapa inválida.");
  const label = String(b.cenario ?? "Situação nova");
  const slug = label
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-");
  const id = novoId("mot");
  etapa.filhos.push({
    id,
    slug,
    label,
    gravidade_padrao: (b.gravidade_padrao as "medio") ?? "medio",
    codigo_tratamento: (b.codigo_tratamento as "faq") ?? "faq",
    gatilhos: [],
    resposta_restrita: false,
    sla_reg_tipo: null,
  });
  return { ok: true, id, slug };
});

rota("GET", "v1/motivos/:id/resposta", ({ params, query }) => {
  const produto = query.get("produto") ?? PRODUTO_PADRAO;
  const m = acharMotivo(params[0]);
  const r = respostaVigente(params[0]!, produto, query.get("edicaoId"));
  if (!r || !m) return { existe: false };
  const ed = r.edicao_id ? db.edicoes[produto]?.find((x) => x.id === r.edicao_id) : null;
  return {
    existe: true,
    artigo: m.slug,
    publico: r.publico,
    versao: r.versao,
    estado: r.estado,
    corpo: r.corpo,
    publicadoEm: r.publicadoEm,
    motivoPendencia: null,
    escopo: r.escopo,
    edicao: ed ? { id: ed.id, nome: ed.nome } : null,
    historico: Math.max(0, r.versao - 1),
  };
});

rota("POST", "v1/motivos/:id/resposta", ({ params, corpo }) => {
  const b = obj(corpo);
  const lista = (db.respostas[params[0]!] ??= []);
  const versao = (lista.at(-1)?.versao ?? 0) + 1;
  lista.push({
    versao,
    corpo: String(b.corpo ?? ""),
    publico: b.publico !== false,
    estado: b.publicar ? "publicado" : "rascunho",
    escopo: (b.escopo as "global") ?? "global",
    edicao_id: (b.edicao_id as string) ?? null,
    publicadoEm: b.publicar ? agoraIso() : null,
  });
  return { ok: true, versao };
});

rota("POST", "v1/bot/simular", ({ query, corpo }) => {
  const produto = query.get("produto") ?? PRODUTO_PADRAO;
  const texto = String(obj(corpo).texto ?? "").toLowerCase();
  const candidatos = (db.taxonomia[produto] ?? [])
    .flatMap((e) => e.filhos)
    .map((m) => ({
      id: m.id,
      slug: m.slug,
      cenario: m.label,
      tratamento: m.codigo_tratamento,
      gravidade: m.gravidade_padrao,
      respostaRestrita: m.resposta_restrita,
      escore: m.gatilhos.filter((g) => texto.includes(g)).length + (texto.includes(m.label.toLowerCase()) ? 2 : 0),
    }))
    .sort((a, b) => b.escore - a.escore);
  const escolhido = candidatos[0] && candidatos[0].escore > 0 ? candidatos[0] : undefined;
  const r = escolhido ? respostaVigente(escolhido.id, produto) : null;
  if (escolhido && r) {
    return {
      fala: r.corpo,
      regua: { nivel: "ok", bloqueios: [], revisar: [], faltando: [] },
      escalar: false,
      motivoSlug: escolhido.slug,
      gravidade: escolhido.gravidade,
      artigo: escolhido.slug,
      estado: {},
      diagnostico: { decisao: "respondeu", escolhido, candidatos: candidatos.slice(0, 3), artigo: escolhido.slug },
    };
  }
  return {
    fala: escolhido
      ? "Vou te passar para um dos nossos atendentes, só um instante."
      : "Não entendi muito bem. Você quer comprar um bolão, conferir um prêmio ou falar de um pagamento?",
    regua: { nivel: "ok", bloqueios: [], revisar: [], faltando: [] },
    opcoes: escolhido ? undefined : candidatos.slice(0, 3),
    escalar: Boolean(escolhido),
    motivoSlug: escolhido?.slug,
    gravidade: escolhido?.gravidade,
    estado: escolhido ? {} : { aguardando: candidatos.slice(0, 3), tentativas: 1 },
    diagnostico: {
      decisao: escolhido ? "escalou" : "pediu_esclarecimento",
      escolhido,
      candidatos: candidatos.slice(0, 3),
      semResposta: Boolean(escolhido),
    },
  };
});

rota("GET", "v1/base/edicoes", ({ query }) => db.edicoes[query.get("produto") ?? PRODUTO_PADRAO] ?? []);

rota("POST", "v1/base/edicoes", ({ query, corpo }) => {
  const produto = query.get("produto") ?? PRODUTO_PADRAO;
  const b = obj(corpo);
  const lista = (db.edicoes[produto] ??= []);
  const id = novoId("ed");
  if (b.vigente) lista.forEach((e) => (e.vigente = false));
  lista.push({
    id,
    id_ion: String(b.id_ion ?? ""),
    nome: String(b.nome ?? "Edição nova"),
    inicio: String(b.inicio ?? agoraIso().slice(0, 10)),
    fim: (b.fim as string) ?? null,
    vigente: Boolean(b.vigente),
  });
  return { ok: true, id, vigente: Boolean(b.vigente) };
});

rota("PATCH", "v1/base/edicoes/:id", ({ params, query, corpo }) => {
  const e = db.edicoes[query.get("produto") ?? PRODUTO_PADRAO]?.find((x) => x.id === params[0]);
  if (!e) throw new ErroHttp(404, "Edição não encontrada.");
  Object.assign(e, obj(corpo));
  return { ok: true };
});

function prontidaoDaEdicao(produto: string, edicaoId: string) {
  const motivos = (db.taxonomia[produto] ?? []).flatMap((e) => e.filhos);
  const itens = motivos.map((m) => {
    const r = respostaVigente(m.id, produto, edicaoId);
    return {
      id: m.id,
      titulo: m.label,
      estado: r ? r.estado : "pendente",
      motivoPendencia: r ? null : "Sem resposta publicada para esta edição.",
    };
  });
  return {
    total: itens.length,
    publicados: itens.filter((i) => i.estado === "publicado").length,
    pendentesDeDefinicao: itens.filter((i) => i.estado === "pendente").length,
    itens,
  };
}

rota("PUT", "v1/base/edicoes/:id/vigente", ({ params, query }) => {
  const produto = query.get("produto") ?? PRODUTO_PADRAO;
  const lista = db.edicoes[produto] ?? [];
  const e = lista.find((x) => x.id === params[0]);
  if (!e) throw new ErroHttp(404, "Edição não encontrada.");
  lista.forEach((x) => (x.vigente = x.id === e.id));
  const { itens: _i, ...prontidao } = prontidaoDaEdicao(produto, e.id);
  void _i;
  return { ok: true, id: e.id, nome: e.nome, prontidao };
});

rota("GET", "v1/base/prontidao", ({ query }) =>
  prontidaoDaEdicao(query.get("produto") ?? PRODUTO_PADRAO, query.get("edicaoId") ?? ""),
);

rota("GET", "v1/base/lacunas", () => db.lacunas);

// ── Supervisão ────────────────────────────────────────────────────────────

const DISTRIB = (n5: number, n3: number, n1: number) => [
  { nota: 5, rotulo: "Ótimo", total: n5 },
  { nota: 3, rotulo: "Regular", total: n3 },
  { nota: 1, rotulo: "Ruim", total: n1 },
];

rota("GET", "v1/supervisao/resumo", () => {
  recalcularCarga();
  const abertas = db.conversas.filter((c) => ABERTA(c) && !c.com_bot);
  const semDono = abertas.filter((c) => !c.responsavel);
  const hoje = new Date().toISOString().slice(0, 10);
  const resolvidasHoje = db.conversas.filter((c) =>
    c.atendimentos.some((a) => a.resolvido_em?.startsWith(hoje)),
  ).length;
  return {
    aguardando: {
      total: semDono.length,
      semDonoHa15min: semDono.filter((c) => Date.now() - new Date(c.criado_em).getTime() > 15 * 60_000).length,
    },
    slaEmRisco: { total: 1, criticos: 0 },
    resolvidasHoje: resolvidasHoje + 14,
    atendimentosTotal: abertas.length + resolvidasHoje + 14,
    escalonamentoBot: 38,
    premissaEscalonamento: 40,
    atendentes: db.atendentes,
    encaminhamentosAbertos: (["pagamentos", "dev"] as const).map((equipe) => ({
      equipe,
      total: db.encaminhamentos.filter((e) => e.equipe === equipe && ["aberto", "em_analise"].includes(e.estado)).length,
    })),
    gatilhosHoje: [
      {
        id: "g-1",
        conversa_id: "cv-rogerio-nunes",
        ref: "MB-2026-0377",
        em: new Date(Date.now() - 3 * 3600_000).toISOString(),
        motivo: "Prêmio",
        gatilhos: ["não caiu", "prêmio"],
      },
    ],
    csat: {
      desde: `${hoje}T00:00:00.000Z`,
      resolvidos: 16,
      avaliados: 9,
      semResposta: 5,
      semPergunta: 2,
      distribuicao: DISTRIB(7, 1, 1),
      taxaResposta: 56,
      media: 4.33,
    },
  };
});

rota("GET", "v1/supervisao/csat/atendentes", () => ({
  desde: new Date(Date.now() - 30 * 86400_000).toISOString(),
  dias: 30,
  itens: [
    { user_id: EU_ID, nome: "Maria Souza", resolvidos: 128, avaliados: 61, semResposta: 52, semPergunta: 15, distribuicao: DISTRIB(52, 6, 3), media: 4.62, minimoParaMedia: 10 },
    { user_id: db.atendentes[1]!.user_id, nome: "Joana Lima", resolvidos: 104, avaliados: 44, semResposta: 50, semPergunta: 10, distribuicao: DISTRIB(33, 8, 3), media: 4.25, minimoParaMedia: 10 },
    { user_id: CARLOS_ID, nome: "Carlos Pereira", resolvidos: 22, avaliados: 6, semResposta: 14, semPergunta: 2, distribuicao: DISTRIB(4, 1, 1), media: null, minimoParaMedia: 10 },
  ],
}));

rota("GET", "v1/supervisao/integracoes", () =>
  db.praca.canais.map((k) => ({
    id: k.id,
    tipo: k.tipo,
    rotulo: k.rotulo,
    status: k.status ?? "ativo",
    quality_rating: k.quality_rating,
    subscribed_apps_ok: k.subscribed_apps_ok,
    token_expira_em: k.token_expira_em,
    ultimo_evento_em: k.ultimo_evento_em,
  })),
);

// ── Escuta e comentários ──────────────────────────────────────────────────

const doProduto = (produto: string | null) =>
  db.comentarios.filter((c) => !produto || c.produto_slug === produto);

rota("GET", "v1/escuta/resumo", ({ query }) => {
  const l = doProduto(query.get("produto"));
  const neg = l.filter((c) => c.sentimento === "negativo").length;
  const caso = l.filter((c) => c.conversa_id).length;
  const pct = (n: number) => (l.length ? Math.round((n / l.length) * 100) : 0);
  return {
    comentarios: l.length,
    negativos: neg,
    pctNegativo: pct(neg),
    viraramCaso: caso,
    pctViraramCaso: pct(caso),
    suspeitaGolpe: l.filter((c) => c.suspeita_golpe).length,
    ocultados: l.filter((c) => c.estado === "oculto").length,
  };
});

rota("GET", "v1/escuta/temas", () => ({
  janela: { dias: 30 },
  temas: [
    { id: "t-premio", rotulo: "Prêmio não creditado", volume: 18, variacao: 0.2, motivo: { id: "mot-mb-premio", caminho: "Pós-venda › Prêmio" }, abertasNoMotivo: 2, termos: [{ termo: "não caiu", frequencia: 9 }, { termo: "prêmio", frequencia: 14 }], variacaoFonte: "agregado_externo" },
    { id: "t-cota", rotulo: "Valor da cota", volume: 31, variacao: -0.05, motivo: { id: "mot-mb-duvida-bolao", caminho: "Venda › Dúvida sobre bolão" }, abertasNoMotivo: 1, termos: [{ termo: "quanto custa", frequencia: 17 }, { termo: "cota", frequencia: 25 }], variacaoFonte: "agregado_externo" },
    { id: "t-elogio", rotulo: "Elogios à lotérica", volume: 12, variacao: 0.1, motivo: null, abertasNoMotivo: null, termos: [{ termo: "melhor", frequencia: 6 }], variacaoFonte: "agregado_externo" },
    { id: "t-golpe", rotulo: "Perfis falsos", volume: 4, variacao: null, motivo: null, abertasNoMotivo: null, termos: [{ termo: "esquema", frequencia: 3 }], variacaoFonte: "agregado_externo" },
  ],
}));

rota("GET", "v1/escuta/canais", () => ({
  janela: { dias: 30 },
  canais: [
    { rede: "instagram", comentarios: db.comentarios.filter((c) => c.rede === "instagram").length },
    { rede: "facebook", comentarios: db.comentarios.filter((c) => c.rede === "facebook").length },
  ],
}));

rota("GET", "v1/escuta/comentarios", ({ query }) => {
  let l = doProduto(query.get("produto"));
  const f = (k: string) => query.get(k);
  if (f("rede")) l = l.filter((c) => c.rede === f("rede"));
  if (f("tema")) l = l.filter((c) => c.temas.includes(f("tema")!));
  if (f("estado")) l = l.filter((c) => c.estado === f("estado"));
  if (f("origem")) l = l.filter((c) => c.origem === f("origem"));
  if (f("sentimento")) l = l.filter((c) => c.sentimento === f("sentimento"));
  if (f("golpe") === "true") l = l.filter((c) => c.suspeita_golpe);
  return l
    .map(({ produto_slug: _p, ...resto }) => {
      void _p;
      return resto;
    })
    .sort((a, b) => b.publicado_em.localeCompare(a.publicado_em));
});

rota("GET", "v1/escuta/comentarios/tags", ({ query }) => {
  const conta = new Map<string, number>();
  for (const c of doProduto(query.get("produto"))) for (const t of c.temas) conta.set(t, (conta.get(t) ?? 0) + 1);
  return {
    tags: [...conta].map(([tema, comentarios]) => ({ tema, label: db.rotuloTema[tema] ?? tema, comentarios })),
  };
});

function comentarioOu404(id: string) {
  const c = db.comentarios.find((x) => x.id === id);
  if (!c) throw new ErroHttp(404, "Comentário não encontrado.");
  return c;
}

rota("POST", "v1/escuta/comentarios/:id/responder", ({ params, corpo }) => {
  const c = comentarioOu404(params[0]!);
  (c.respostas ??= []).push({
    id: novoId("r"),
    autor: "@mestredobolao",
    texto: String(obj(corpo).texto ?? ""),
    publicado_em: agoraIso(),
    nosso: true,
  });
  c.estado = "respondido";
  return { ok: true, estado: c.estado, redeFeita: true };
});

rota("POST", "v1/escuta/comentarios/:id/ocultar", ({ params }) => {
  const c = comentarioOu404(params[0]!);
  c.estado = "oculto";
  return { ok: true, estado: c.estado, redeFeita: true };
});

rota("POST", "v1/escuta/comentarios/:id/virar-caso", ({ params, corpo }) => {
  const c = comentarioOu404(params[0]!);
  if (!c.conversa_id) {
    const id = novoId("cv");
    const agora = agoraIso();
    db.conversas.unshift({
      id,
      estado: "nova",
      sentimento: (c.sentimento as ConversaDb["sentimento"]) ?? "neutro",
      temas: [],
      tags: [],
      canal_id: c.rede === "instagram" ? "canal-ig-mestre-bolao" : "canal-wa-mestre-bolao",
      responsavel: null,
      fila_id: "fila-vendas-bolao",
      produto_slug: c.produto_slug,
      contato: { id: novoId("ct"), nome: null, handle: c.autor_handle, cpf: null, telefone: null, oculto: false, tags: [] },
      atendimentos: [],
      avaliacao: { estado: "em_aberto", nota: null, rotulo: null, pedidoEm: null, respondidoEm: null },
      origem: { tipo: "comentario", rotulo: `Comentário no ${c.rede}`, campanha: c.campanha },
      criado_em: agora,
      ultimo_evento_em: agora,
    });
    db.mensagens[id] = [];
    _adicionarMensagem(id, { autor: "cliente", texto: c.texto, em: c.publicado_em });
    const conv = acharConversa(id)!;
    abrirCaso(conv, obj(corpo).motivoId as string | undefined);
    c.conversa_id = id;
  }
  return { ok: true, estado: c.estado, redeFeita: true };
});

rota("POST", "v1/blue/comentarios/:id/rascunho", ({ params }) => {
  const c = comentarioOu404(params[0]!);
  const texto =
    c.sentimento === "negativo"
      ? "Oi! Sentimos muito pelo transtorno. Chama a gente no WhatsApp (67) 3321-0000 que resolvemos rapidinho."
      : c.sentimento === "positivo"
        ? "Que alegria! Obrigado pela confiança, e boa sorte no próximo bolão 🍀"
        : "Oi! Te respondemos no direct com todos os detalhes 😉";
  return { texto, modelo: "blue-prototipo", compliance: { nivel: "ok", bloqueios: [], revisar: [], faltando: [] } };
});

rota("GET", "v1/instagram/autorizar", () => ({ configurado: false, url: null }));

// ── Equipes internas ──────────────────────────────────────────────────────

rota("GET", "v1/equipes/:equipe", ({ params }) =>
  db.encaminhamentos
    .filter((e) => e.equipe === params[0])
    .map((e) => {
      const c = acharConversa(e.conversa_id);
      const a = c?.atendimentos.find((x) => x.id === e.atendimento_id);
      return {
        id: e.id,
        titulo: e.titulo,
        estado: e.estado,
        gravidade: e.gravidade,
        abertoPor: e.abertoPor,
        abertoEm: e.abertoEm,
        responsavel: nomeDoUsuario(e.responsavel_id),
        meu: e.responsavel_id === EU_ID,
        pegoEm: e.pegoEm,
        resposta: e.resposta,
        respondidoPor: e.respondidoPor,
        respondidoEm: e.respondidoEm,
        demandaRef: e.demandaRef,
        ref: a?.ref ?? "MB-2026-0000",
        motivo: a?.motivo?.label ?? null,
        slaComercial: a?.sla_com_resolucao_em ?? null,
        slaRegulatorio: null,
        slaRegTipo: null,
        notas: e.notas,
        coleta: e.coleta,
        contato:
          e.equipe === "dev" || !c
            ? null
            : {
                nome: c.contato.nome,
                cpf_mascarado: "***.412.***-07",
                telefone_mascarado: c.contato.telefone?.replace(/\d{4}-/, "****-") ?? null,
              },
        trabalhaPorReferencia: e.equipe === "dev",
      };
    }),
);

function encOu404(id: string) {
  const e = db.encaminhamentos.find((x) => x.id === id);
  if (!e) throw new ErroHttp(404, "Encaminhamento não encontrado.");
  return e;
}

rota("POST", "v1/equipes/:equipe/encaminhamentos/:id/pegar", ({ params }) => {
  const e = encOu404(params[1]!);
  if (e.responsavel_id && e.responsavel_id !== EU_ID)
    throw new ErroHttp(400, `${nomeDoUsuario(e.responsavel_id)} já pegou este caso.`);
  e.responsavel_id = EU_ID;
  e.pegoEm = agoraIso();
  e.estado = "em_analise";
  return { ok: true };
});

rota("POST", "v1/equipes/:equipe/encaminhamentos/:id/soltar", ({ params }) => {
  const e = encOu404(params[1]!);
  e.responsavel_id = null;
  e.pegoEm = null;
  e.estado = "aberto";
  return { ok: true };
});

rota("POST", "v1/equipes/:equipe/encaminhamentos/:id/responder", ({ params, corpo }) => {
  const e = encOu404(params[1]!);
  const b = obj(corpo);
  e.estado = String(b.estado ?? "resolvido");
  e.resposta = String(b.resposta ?? "");
  e.respondidoPor = db.me.nome;
  e.respondidoEm = agoraIso();
  const c = acharConversa(e.conversa_id);
  if (c && c.estado === "aguardando_equipe") {
    c.estado = "em_atendimento";
    _adicionarMensagem(c.id, {
      autor: "sistema",
      texto: `A equipe ${e.equipe === "dev" ? "técnica" : "financeira"} respondeu: ${e.resposta}`,
    });
  }
  return { ok: true };
});

// ── Consumo ───────────────────────────────────────────────────────────────

rota("GET", "v1/consumo/resumo", () => ({
  praca: db.praca.nome,
  mensagensNoMes: 4823,
  porCategoria: [
    { categoria: "service", qtd: 3910, reais: 0 },
    { categoria: "utility", qtd: 612, reais: 48.96 },
    { categoria: "marketing", qtd: 301, reais: 105.35 },
  ],
  custoHojeReais: 6.42,
  projecaoReais: 231.8,
  cobrancaComeca: "2026-07-01",
  jaCobra: true,
  resolvidosNoMes: 412,
  mensagensPorResolvido: 11.7,
  metaMensagensPorResolvido: 12,
  teto: { reais: Number(db.praca.teto_micros_mes ?? 0) / 1_000_000, alertaPct: db.praca.teto_alerta_pct, acao: db.praca.teto_acao, usoPct: 19 },
  tarifa: { reais: 0.35, vigenteDe: "2026-07-01", fonte: "Meta · tabela Brasil" },
}));

rota("GET", "v1/consumo/serie", ({ query }) => {
  const dias = Number(query.get("dias") ?? 14);
  return Array.from({ length: dias }, (_, i) => {
    const d = new Date(Date.now() - (dias - 1 - i) * 86400_000);
    const qtd = 120 + Math.round(80 * Math.abs(Math.sin(i * 1.3))) + (d.getDay() === 0 ? -60 : 0);
    return { dia: d.toISOString().slice(0, 10), qtd, reais: Math.round(qtd * 0.032 * 100) / 100 };
  });
});

// ── Blue (IA) ─────────────────────────────────────────────────────────────

rota("GET", "v1/blue/estado", () => ({ ligado: true }));

rota("POST", "v1/blue/conversas/:id/resumo", ({ params }) => {
  const c = conversaOu404(params[0]!);
  const ult = [...(db.mensagens[c.id] ?? [])].reverse().find((m) => m.autor === "cliente");
  return {
    texto: `${c.contato.nome ?? "O cliente"} fala sobre bolões do ${c.produto_slug === PRODUTO_PADRAO ? "Mestre do Bolão" : "APCAP VIP"}. Última mensagem: "${ult?.conteudo ?? "(sem texto)"}".${c.tags.length ? ` Tags: ${c.tags.join(", ")}.` : ""}`,
    modelo: "blue-prototipo",
  };
});

rota("POST", "v1/blue/conversas/:id/rascunho", ({ params }) => {
  const c = conversaOu404(params[0]!);
  const ult = [...(db.mensagens[c.id] ?? [])].reverse().find((m) => m.autor === "cliente")?.conteudo?.toLowerCase() ?? "";
  const nome = c.contato.nome?.split(" ")[0] ?? "";
  let texto = `Oi, ${nome}! Como posso te ajudar?`;
  if (ult.includes("lotofácil") || ult.includes("mega")) {
    texto = `Claro, ${nome}! Hoje temos a Lotofácil com cota de R$ 25,00 (15 dezenas, 10 jogos) e a Mega-Sena com cota de R$ 35,00. Quantas cotas você quer de cada?`;
  } else if (ult.includes("ganhei")) {
    texto = `Ganhou sim, ${nome}! 🎉 Para resgatar é só me confirmar a sua chave Pix. O valor cai em até 2 dias úteis.`;
  } else if (ult.includes("pagar")) {
    texto = `Combinado, ${nome}! Assim que pagar, me manda o comprovante por aqui que eu já confirmo a sua cota.`;
  }
  return { texto, modelo: "blue-prototipo", compliance: { nivel: "ok", bloqueios: [], revisar: [], faltando: [] } };
});

rota("POST", "v1/blue/conversas/:id/motivo-sugerido", ({ params }) => {
  const c = conversaOu404(params[0]!);
  const premiada = c.tags.some((t) => t.toLowerCase().includes("premiad"));
  const m = acharMotivo(premiada ? "mot-mb-premio" : "mot-mb-venda-concluida");
  return {
    motivoId: m?.id ?? null,
    label: m?.label ?? null,
    confianca: "media",
    porque: premiada ? "A conversa trata de um prêmio da Quina." : "O cliente pediu cotas e recebeu o Pix.",
  };
});

// ── Despacho ──────────────────────────────────────────────────────────────

const fetchOriginal = window.fetch.bind(window);

/** Extrai o caminho de rota (`api/...` ou `v1/...`) ou null se não for nosso. */
function caminhoDaRota(url: URL): string | null {
  const p = url.pathname;
  const api = p.match(/(?:^|\/)(api\/(?:auth|authz|theme|notificacoes|l4ia)(?:\/.*)?)$/);
  if (api) return api[1]!;
  const v1 = p.match(/(?:^|\/)(v1\/.*)$/);
  if (v1) return v1[1]!;
  return null;
}

async function lerCorpo(input: RequestInfo | URL, init?: RequestInit): Promise<unknown> {
  const bruto = init?.body;
  if (bruto instanceof FormData) return bruto;
  if (typeof bruto === "string") {
    try {
      return JSON.parse(bruto);
    } catch {
      return bruto;
    }
  }
  if (input instanceof Request && !["GET", "HEAD"].includes(input.method.toUpperCase())) {
    const tipo = input.headers.get("content-type") ?? "";
    const copia = input.clone();
    try {
      if (tipo.includes("multipart/form-data")) return await copia.formData();
      const texto = await copia.text();
      return texto ? JSON.parse(texto) : undefined;
    } catch {
      return undefined;
    }
  }
  return undefined;
}

async function responder(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const url = new URL(input instanceof Request ? input.url : String(input), window.location.href);
  const caminho = caminhoDaRota(url);
  if (!caminho) return fetchOriginal(input, init);

  const metodo = (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();
  const corpo = await lerCorpo(input, init);
  await atraso();

  // A l4.ia (Blue do shell) fica desligada no protótipo.
  if (caminho.startsWith("api/l4ia")) return json({ message: "l4ia desligada no protótipo" }, 404);

  for (const r of rotas) {
    if (r.metodo !== metodo) continue;
    const m = caminho.match(r.padrao);
    if (!m) continue;
    try {
      const dado = await r.h({ metodo, caminho, query: url.searchParams, corpo, params: m.slice(1).map(decodeURIComponent) });
      if (dado === NUNCA) return new Promise<Response>(() => {});
      if (metodo !== "GET") emitir();
      return json(dado);
    } catch (e) {
      if (e instanceof ErroHttp) return json({ statusCode: e.status, message: e.message }, e.status);
      console.error(`[mock] ${metodo} ${caminho} falhou`, e);
      return json({ statusCode: 500, message: "Erro no servidor falso do protótipo." }, 500);
    }
  }

  console.warn(`[mock] rota sem handler: ${metodo} ${caminho}`);
  return json(metodo === "GET" ? {} : { ok: true });
}

let instalado = false;

/** Troca o `window.fetch` pelo servidor falso. Idempotente. */
export function instalarMock(): void {
  if (instalado) return;
  instalado = true;
  window.fetch = responder as typeof window.fetch;
  // Atalho de depuração no console: `__mock.db`, `__mock.adicionarMensagem(...)`.
  void import("./db").then((mod) => {
    (window as unknown as { __mock: unknown }).__mock = mod;
  });
  console.info("[mock] servidor falso instalado (Mestre do Bolão)");
}
