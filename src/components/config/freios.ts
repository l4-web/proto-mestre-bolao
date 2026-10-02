import type { FreioDeMao, Praca } from "../../features/atendimento/tipos";

export type ChaveFreio = "bot_ativo" | "envio_ativo" | "ia_ativa";

/**
 * O QUE CADA FREIO CORTA, em uma frase, e a pergunta que a confirmação faz.
 *
 * O texto mora aqui, e não dentro do controle, porque quem avisa que um freio está
 * puxado é o topo da página e quem o aciona é a seção lá embaixo. Duas cópias do
 * mesmo texto viram duas descrições diferentes do mesmo desligamento na primeira
 * correção, e a que a pessoa lê no aviso é a que ela não vai reler ao confirmar.
 */
export const FREIOS: Record<
  ChaveFreio,
  { rotulo: string; corta: string; pergunta: string; consequencia: string; avisoCurto: string }
> = {
  bot_ativo: {
    rotulo: "Bot de triagem",
    corta: "Desligado, toda mensagem que chega vai para gente: o bot para de responder sozinho.",
    pergunta: "Desligar o bot de triagem?",
    consequencia:
      "Toda mensagem que chegar vai direto para a fila humana. Nenhuma resposta automática sai, e o volume inteiro passa a depender de quem está de turno.",
    avisoCurto: "o bot não responde e tudo cai na fila humana",
  },
  envio_ativo: {
    rotulo: "Envio ao cliente",
    corta: "Desligado, nenhuma mensagem sai da praça, nem do bot nem do atendente.",
    pergunta: "Desligar o envio ao cliente?",
    consequencia:
      "Nenhuma mensagem sai da praça, nem do bot nem do atendente. As conversas continuam chegando e ninguém consegue responder até religar.",
    avisoCurto: "nenhuma resposta sai da praça",
  },
  ia_ativa: {
    rotulo: "IA do Blue",
    corta:
      "Desligado, corta a chamada ao modelo (rascunho, resumo e motivo sugerido). O resto do Blue segue.",
    pergunta: "Desligar a IA?",
    consequencia:
      "Corta a chamada ao modelo: acabam o rascunho, o resumo da conversa e o motivo sugerido no encerramento. O resto do módulo continua funcionando normalmente.",
    avisoCurto: "não há rascunho, resumo nem motivo sugerido",
  },
};

/**
 * NULO É LIGADO.
 *
 * A coluna nasceu numa migration anterior ao código que a lê, então a praça que
 * ninguém configurou tem que seguir se comportando como se comportava: enviando. É
 * a mesma leitura que a API faz (`flag === false` para desligar), e escrever isso
 * como `flag ?? false` ou `!flag` mostra toda praça intocada como desligada, e no
 * primeiro salvamento grava esse `false` de volta.
 */
export function estaLigado(flag: FreioDeMao | undefined): boolean {
  return flag !== false;
}

/** Os freios PUXADOS da praça, na ordem em que aparecem na tela. */
export function freiosPuxados(praca: Praca | undefined): ChaveFreio[] {
  if (!praca) return [];
  return (Object.keys(FREIOS) as ChaveFreio[]).filter((c) => !estaLigado(praca[c]));
}
