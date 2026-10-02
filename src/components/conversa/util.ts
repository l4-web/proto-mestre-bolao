import type { Atendente, Gravidade } from "../../features/atendimento/tipos";

/**
 * Situação do atendente, em rótulo e em cor.
 *
 * Mora aqui, junto dos outros rótulos do módulo, porque duas telas leem a mesma
 * coisa: a supervisão (quem está de turno) e a alocação por produto (quem atende o
 * quê). Eram uma cópia dentro da supervisão, e a segunda cópia é o começo de "Em
 * pausa" numa tela e "Pausa" na vizinha.
 */
export const ROTULO_STATUS: Record<Atendente["status"], string> = {
  online: "Disponível",
  pausa: "Em pausa",
  offline: "Offline",
};

export const COR_STATUS: Record<
  Atendente["status"],
  "success" | "warn" | "neutral"
> = {
  online: "success",
  pausa: "warn",
  offline: "neutral",
};

/*
 * SAÍRAM DAQUI `SENTIMENTOS` e `ROTULO_SENTIMENTO`.
 *
 * Eles serviam ao seletor de três carinhas da coluna de contexto, que era o ATENDENTE
 * classificando o próprio atendimento. Quem avalia é o participante, então o controle
 * saiu e a avaliação do cliente (CSAT) tomou o lugar dele.
 *
 * O CONCEITO não foi removido do módulo, e a coluna `sentimento` continua no banco: o
 * enum `AtdSentimento` é o mesmo que a escuta social usa em `atd_comentario`, que a
 * tela de Comentários lê e filtra. O que saiu foi o controle da tela de quem atende.
 */

/** Cor do PONTO do selo por gravidade. Quem carrega a cor é o ponto, não o texto. */
export const CORES_GRAVIDADE: Record<Gravidade, "error" | "warn" | "neutral"> = {
  critico: "error",
  alto: "warn",
  medio: "neutral",
};

export const ROTULO_GRAVIDADE: Record<Gravidade, string> = {
  critico: "Crítico",
  alto: "Alto",
  medio: "Médio",
};

/**
 * Distância até um prazo, em texto curto. Negativo vira "estourou há", porque a
 * fila precisa mostrar atraso como fato consumado e não como número negativo,
 * que a pessoa lê errado sob pressão.
 */
export function prazo(
  iso: string | null,
  /**
   * O INSTANTE CONTRA O QUAL MEDIR, que para caso resolvido e a resolucao.
   *
   * Sem isto o prazo era sempre comparado com AGORA, e caso ja fechado continuava
   * envelhecendo: um atendimento resolvido dentro do prazo aparecia como "estourou ha
   * 5h" na aba Resolvidas algumas horas depois, acusando de atraso justamente quem
   * entregou no tempo. O prazo de um caso fechado congela quando ele fecha.
   */
  resolvidoEm?: string | null,
): { texto: string; estourado: boolean } | null {
  if (!iso) return null;
  const referencia = resolvidoEm ? new Date(resolvidoEm).getTime() : Date.now();
  const ms = new Date(iso).getTime() - referencia;
  const estourado = ms < 0;
  const min = Math.floor(Math.abs(ms) / 60000);
  const texto = min < 60 ? `${min}min` : min < 1440 ? `${Math.floor(min / 60)}h` : `${Math.floor(min / 1440)}d`;
  /**
   * Caso fechado nao diz "ha quanto tempo": o tempo parou, e "estourou ha 5h" num
   * caso resolvido se le como atraso que ainda corre.
   */
  if (resolvidoEm) return { texto: estourado ? `estourou por ${texto}` : `dentro do prazo`, estourado };
  return { texto: estourado ? `estourou há ${texto}` : `em ${texto}`, estourado };
}

/** Hora curta para a lista, dia e hora para a thread. */
export function hora(iso: string): string {
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

export function dataHora(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Nome a exibir quando o papel não pode ver dado pessoal. Não inventa iniciais
 * nem apelido: mostra a referência do caso, que é o identificador legítimo de
 * quem trabalha sem dado do cliente.
 */
export function nomeVisivel(
  contato: { nome: string | null; handle?: string | null; oculto: boolean },
  ref?: string | null,
): string {
  if (contato.oculto) return ref ?? "Caso sem referência";
  /**
   * O @ da rede entra ANTES de "Sem nome".
   *
   * O caso aberto a partir de um comentário não tem nome por construção: o handle é o
   * identificador público da rede e não o nome civil de ninguém, e gravá-lo em `nome`
   * faria a máscara de PII esconder o único identificador que o atendente tem. O
   * efeito colateral era a fila mostrar "Sem nome" justamente nesses casos, que é
   * pior: "Sem nome" não identifica ninguém, e "@bielvdm" identifica.
   */
  return contato.nome ?? contato.handle ?? "Sem nome";
}

/** Uma mensagem com a posição dela no grupo, para a bolha saber o raio e a cauda. */
export interface MensagemAgrupada<T> {
  mensagem: T;
  primeira: boolean;
  ultima: boolean;
  /** Separador de data e hora acima desta mensagem, quando houve intervalo. */
  marcoTempo: string | null;
}

/**
 * Agrupa mensagens consecutivas do MESMO autor, no padrão do Messages: o grupo
 * fica colado (poucos px), só a última bolha tem cauda, e o rótulo de autor
 * aparece uma vez por grupo em vez de em cada linha.
 *
 * Também decide o separador de tempo: acima de 15 minutos de intervalo, entra uma
 * linha central com data e hora. Carimbar hora em toda bolha polui a leitura e é
 * exatamente o que o Messages evita.
 */
export function agrupar<T extends { autor: string; created_at: string }>(
  mensagens: T[],
  intervaloMin = 15,
): MensagemAgrupada<T>[] {
  return mensagens.map((m, i) => {
    const ant = mensagens[i - 1];
    const prox = mensagens[i + 1];
    const t = new Date(m.created_at).getTime();
    const gap = ant ? (t - new Date(ant.created_at).getTime()) / 60000 : Infinity;
    const quebra = gap > intervaloMin;

    return {
      mensagem: m,
      primeira: !ant || ant.autor !== m.autor || quebra,
      ultima:
        !prox ||
        prox.autor !== m.autor ||
        (new Date(prox.created_at).getTime() - t) / 60000 > intervaloMin,
      marcoTempo: quebra ? dataHora(m.created_at) : null,
    };
  });
}
