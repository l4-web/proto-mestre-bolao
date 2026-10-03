import {
  EU_ID,
  FILA_VENDAS,
  adicionarMensagem,
  atualizarConversa,
  criarConversa,
  db,
  definirTags,
} from "../../mock/db";
import { MEU_CODIGO, ligarPonte, registrarCliente, tirarDisparo } from "./loja";

/**
 * Liga o simulador do bolão ao mock da API do Atende Aí. No sistema real, este é o
 * papel do backend do Atende Aí: o que um provedor responde vira mensagem enviada
 * pelo despachante da Meta, nota de sistema ou etiqueta na conversa.
 */
ligarPonte({
  postar: (conversaId, m) => {
    if (m.imagemUrl) {
      adicionarMensagem(conversaId, {
        autor: m.autor,
        tipo: "image",
        url: m.imagemUrl,
        mime: "image/svg+xml",
        nome: "arte.svg",
        texto: m.texto ?? null,
        botoes: m.botoes,
      });
    } else {
      adicionarMensagem(conversaId, { autor: m.autor, texto: m.texto ?? "", botoes: m.botoes });
    }
  },
  etiquetar: (conversaId, mudar) => {
    const c = db.conversas.find((x) => x.id === conversaId);
    definirTags(conversaId, mudar(c?.tags ?? []));
  },
});

/** "Nova conversa": abre já com a vendedora como dona e o template como 1ª mensagem. */
export function criarConversaPorTemplate(d: {
  nome: string;
  telefone: string;
  texto: string;
  responsavel: string | null;
}): string {
  registrarCliente(d.nome, {
    cpf: null,
    origem: "Chamada ativa da vendedora (Dispara Aí)",
    vendedora: MEU_CODIGO,
    compras: [],
    premios: [],
  });
  const id = criarConversa({
    nome: d.nome,
    telefone: d.telefone,
    produto_slug: "mestre_do_bolao",
    responsavel: d.responsavel ?? EU_ID,
    fila_id: FILA_VENDAS,
  });
  atualizarConversa(id, { estado: "aguardando_cliente" } as never);
  adicionarMensagem(id, {
    autor: "sistema",
    texto: "Chamada ativa enviada pelo Dispara Aí (template aprovado). A conversa entrou na sua fila porque o cliente respondeu.",
  });
  adicionarMensagem(id, { autor: "atendente", tipo: "template", texto: d.texto });
  return id;
}

const LEADS = [
  { nome: "Camila Rocha", telefone: "(67) 99654-1188", msg: "Oi! Vim pelo site, quero uma cota da Lotofácil da Independência" },
  { nome: "Diego Martins", telefone: "(67) 99321-4455", msg: "Boa noite, ainda dá tempo de entrar no bolão da Quina de hoje?" },
  { nome: "Patrícia Gomes", telefone: "(67) 98123-9090", msg: "Quero saber dos bolões da Mega acumulada" },
];
let proximoLead = 0;

/** Lead da landing page: chega SEM dono, na fila de vendas, para a distribuição. */
export function novoLeadDaLanding(): string {
  const l = LEADS[proximoLead++ % LEADS.length];
  registrarCliente(l.nome, {
    cpf: null,
    origem: "Landing page",
    campanha: "lotofacil-independencia",
    utm: "utm_source=google&utm_campaign=lotofacil-independencia",
    vendedora: "a definir (distribuição)",
    compras: [],
    premios: [],
  });
  return criarConversa({
    nome: l.nome,
    telefone: l.telefone,
    produto_slug: "mestre_do_bolao",
    origem: "lotofacil-independencia",
    mensagem: l.msg,
    responsavel: null,
    fila_id: FILA_VENDAS,
  });
}

/**
 * O cliente chamado pelo Dispara Aí respondeu. Só AGORA a conversa nasce no Atende
 * Aí, já com a vendedora que disparou como dona (o Dispara Aí manda junto quem
 * disparou), e não na fila geral.
 */
export function clienteRespondeDisparo(disparoId: string, resposta: string): string | null {
  const d = tirarDisparo(disparoId);
  if (!d) return null;
  const id = criarConversaPorTemplate({ nome: d.nome, telefone: d.telefone, texto: d.texto, responsavel: EU_ID });
  adicionarMensagem(id, { autor: "cliente", texto: resposta });
  return id;
}
