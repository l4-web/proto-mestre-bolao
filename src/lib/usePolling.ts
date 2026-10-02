import { useEffect, useState } from "react";

/**
 * Intervalo de recarga da caixa de entrada, em milissegundos.
 *
 * Não existia NENHUM: sem polling, sem SSE e sem WebSocket, a mensagem do cliente
 * só aparecia quando o atendente trocava de aba ou recarregava a página. Numa caixa
 * de atendimento isso não é conforto, é o produto não funcionar: a pessoa fica
 * olhando uma tela que ela acredita estar atualizada.
 *
 * Por que polling e não SSE: SSE é mais elegante e mais caro. Ele exige conexão
 * aberta por atendente, `LISTEN/NOTIFY` ou Pub/Sub do outro lado, e o Cloud Run
 * cobra pelo tempo de conexão viva, não pela requisição. Com poucos atendentes por
 * praça, uma requisição leve a cada poucos segundos custa menos e falha melhor: se
 * uma resposta se perde, a próxima corrige, e não há reconexão para gerenciar.
 *
 * A escolha é revisível e o número está escrito aqui, num lugar só, para a conta
 * ser refeita quando o volume mudar.
 */
const ATIVO_MS = 8_000;
/** Aba escondida: mantém vivo, mas raro. Zerar deixaria a volta desatualizada. */
const OCULTO_MS = 60_000;

/**
 * O intervalo de polling que a aba merece AGORA.
 *
 * Aba escondida não pode custar o mesmo que aba em uso: atendente com o inbox aberto
 * atrás do WhatsApp Web pagaria requisição a cada 8 segundos por nada. E parar de
 * vez é pior, porque a volta mostra estado velho até a primeira resposta chegar.
 */
export function useIntervaloPolling(): number {
  const [visivel, setVisivel] = useState(() =>
    typeof document === "undefined"
      ? true
      : document.visibilityState === "visible",
  );

  useEffect(() => {
    const onChange = () => setVisivel(document.visibilityState === "visible");
    document.addEventListener("visibilitychange", onChange);
    return () => document.removeEventListener("visibilitychange", onChange);
  }, []);

  return visivel ? ATIVO_MS : OCULTO_MS;
}
