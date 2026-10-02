import { useEffect, useState } from "react";
import type { Janela } from "../features/atendimento/tipos";

const DIA_MS = 24 * 60 * 60 * 1000;

export interface EstadoJanela {
  fechada: boolean;
  /** Quanto falta, formatado. `null` quando já fechou. */
  texto: string | null;
  /** Quanto sobrou da janela, de 0 a 100, para o trilho. */
  pct: number;
  /** Menos de uma hora: o trilho e o texto viram aviso. */
  apertado: boolean;
}

/**
 * O relógio da janela de 24h, contado NO CLIENTE a partir do instante de
 * expiração que a API manda.
 *
 * Antes disto a tela mostrava os minutos restantes calculados no servidor, o que
 * dava um relógio congelado: ele só mudava quando alguma outra coisa provocava um
 * refetch. Numa conversa parada, alguém podia olhar "resta 40min" por meia hora.
 * E a alternativa preguiçosa, refazer a requisição a cada segundo para animar um
 * contador, é gastar rede para desenhar o que dá para calcular.
 *
 * A contagem é local, o instante é do servidor: o relógio do navegador pode estar
 * errado, mas o erro é constante e pequeno diante de uma janela de 24 horas, e a
 * decisão de VERDADE sobre poder enviar continua sendo da API (`permite`).
 *
 * Quando o contador cruza o zero a janela fecha na hora, sem esperar resposta
 * nenhuma. Descobrir que a janela fechou só depois de escrever a resposta é o
 * pior momento possível para descobrir.
 */
export function useJanela(janela: Janela): EstadoJanela {
  const expira = janela.expiraEm ? new Date(janela.expiraEm).getTime() : null;

  const [agora, setAgora] = useState(() => Date.now());

  useEffect(() => {
    // Sem instante ou já fechada não há o que animar, e um timer rodando por
    // conversa fechada é bateria gasta para não mudar nada na tela.
    if (!expira || expira <= Date.now()) return;
    const t = setInterval(() => setAgora(Date.now()), 1000);
    return () => clearInterval(t);
  }, [expira]);

  // `permite` é a palavra final da API: se ela já disse template, é template,
  // mesmo que a conta local ainda ache que sobra tempo.
  const restaMs = expira ? Math.max(0, expira - agora) : 0;
  const fechada =
    janela.permite === "template" || !janela.aberta || restaMs <= 0;

  if (fechada) return { fechada: true, texto: null, pct: 100, apertado: true };

  const totalSeg = Math.floor(restaMs / 1000);
  const h = Math.floor(totalSeg / 3600);
  const m = Math.floor((totalSeg % 3600) / 60);
  const s = totalSeg % 60;

  return {
    fechada: false,
    // Segundos aparecem só na última hora. Ver o segundo correr numa janela de
    // 20 horas é ansiedade sem informação; na última hora é o dado que importa.
    texto:
      h > 0
        ? `${h}h ${String(m).padStart(2, "0")}min`
        : `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`,
    pct: Math.min(100, (restaMs / DIA_MS) * 100),
    apertado: restaMs < 60 * 60 * 1000,
  };
}
