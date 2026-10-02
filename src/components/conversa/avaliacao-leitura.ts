import type { BadgeProps } from "@l4-web/ui";
import type { Avaliacao, ConversaDetalhe } from "../../features/atendimento/tipos";
import { dataHora } from "./util";

/**
 * A NOTA QUE O CLIENTE DEU, na tela.
 *
 * O módulo coletava CSAT e não mostrava em lugar nenhum: a pessoa respondia "Ruim"
 * pelo WhatsApp, a nota ia para o banco e nem o atendente nem a supervisão viam. Do
 * lado de quem usa, gravar e não mostrar é idêntico a não gravar, e foi assim que o
 * defeito chegou ("o módulo não avalia").
 *
 * ESTE É O ÚNICO JULGAMENTO DE QUALIDADE NA TELA DO ATENDIMENTO, e é do CLIENTE.
 * Existia ao lado disto um seletor de "sentimento" com três carinhas que o próprio
 * atendente marcava, e ele saiu: quem atende não avalia o atendimento. Duas escalas
 * de três pontos lado a lado, uma nossa e uma do cliente, transformariam "bem
 * avaliado" na nossa opinião sobre nós mesmos.
 */

/**
 * O RÓTULO DE CADA UM DOS QUATRO ESTADOS, e o porquê de cada um existir.
 *
 * `curto` é para a linha da fila, que dentro do AppShell tem ~250px. `longo` e
 * `porque` são para a coluna de contexto, onde cabe a frase inteira.
 *
 * O `porque` do `nao_perguntado` é obrigatório e não é enfeite: sem ele, "não
 * perguntamos" ao lado do nome do atendente lê como omissão dele. A causa é a janela
 * de 24h da Meta, que é regra do provedor e não desleixo de ninguém, e a tela precisa
 * dizer isso onde a acusação apareceria.
 */
const CINZA: BadgeProps["variant"] = "neutral";

const COR_DA_NOTA: Record<number, BadgeProps["variant"]> = {
  5: "success",
  3: "warn",
  1: "error",
};

export interface Leitura {
  curto: string;
  longo: string;
  porque: string | null;
  variante: BadgeProps["variant"];
}

export function lerAvaliacao(a: Avaliacao): Leitura | null {
  switch (a.estado) {
    case "avaliado": {
      // O rótulo vem da API, que o resolve pela mesma tabela que gerou o botão do
      // WhatsApp. Traduzir nota aqui criaria um de-para que diverge no dia em que a
      // escala mudar de três para cinco pontos.
      const rotulo = a.rotulo ?? String(a.nota ?? "");
      return {
        curto: rotulo,
        longo: `O cliente avaliou como ${rotulo.toLowerCase()}`,
        porque: a.respondidoEm ? `Respondeu em ${dataHora(a.respondidoEm)}.` : null,
        variante: COR_DA_NOTA[a.nota ?? 0] ?? CINZA,
      };
    }
    case "sem_resposta":
      return {
        curto: "Sem resposta",
        longo: "Perguntamos e o cliente não respondeu",
        porque: a.pedidoEm
          ? `A pesquisa saiu em ${dataHora(a.pedidoEm)} e ficou sem toque no botão.`
          : "A pesquisa saiu e ficou sem toque no botão.",
        variante: CINZA,
      };
    case "nao_perguntado":
      return {
        curto: "Sem pesquisa",
        longo: "Não chegamos a perguntar",
        // A frase inteira, e não "janela fechada": quem lê a fila não tem por que
        // saber de cor a regra de 24h da Meta.
        porque:
          "A janela de 24 horas do WhatsApp já tinha fechado quando o caso foi encerrado, " +
          "e fora dela só passa template aprovado. Não é falha do atendimento.",
        variante: CINZA,
      };
    case "em_aberto":
      // Caso de pé não tem estado de avaliação: a pesquisa sai NO ENCERRAMENTO.
      // Desenhar "não avaliado" aqui seria acusar de omissão algo que ainda nem
      // devia ter acontecido.
      return null;
  }
}


/**
 * A conversa tem alguma avaliação a mostrar?
 *
 * Serve para a tela ESCONDER o bloco inteiro no ambiente cuja API ainda não manda o
 * campo (front e API sobem separados). Sem isso, todo caso apareceria como "não
 * perguntamos", que é inventar um defeito onde só falta um deploy.
 */
export function temAvaliacao(conversa: ConversaDetalhe): boolean {
  return conversa.atendimentos.some((a) => a.avaliacao);
}
