import { Badge } from "@l4-web/ui";
import type { Janela } from "../../features/atendimento/tipos";
import { useJanela } from "../../lib/useJanela";

/** Quantos dias a Meta dá para o atendimento humano responder nas redes sociais. */
const DIAS_SOCIAL = 7;

/**
 * A janela de resposta, E ELA É POR REDE.
 *
 * Não é enfeite: quando fecha, o envio livre é bloqueado. Aparece o tempo TODO e não
 * só perto do fim, porque descobrir que a janela fechou na hora de responder é o pior
 * momento possível. E ANDA, porque relógio parado mostrando "resta 40min" durante meia
 * hora é pior que relógio nenhum: parece informação atual e não é.
 *
 * O que mudou: ela dizia "Janela de 24h" e, ao fechar, "só template aprovado". Nas
 * duas frases o WhatsApp estava escrito como se fosse o único canal. Num caso aberto a
 * partir de um comentário do Instagram isso mente duas vezes, porque lá são 7 dias e
 * template aprovado não existe: a saída, passado o prazo, é responder publicamente no
 * comentário. Mandar procurar template ali é mandar procurar uma porta que não há.
 */
export function RelogioJanela({
  janela,
  rede = "whatsapp",
}: {
  janela: Janela;
  rede?: "whatsapp" | "instagram" | "facebook";
}) {
  const { fechada, texto, apertado } = useJanela(janela);
  const ehWhats = rede === "whatsapp";

  if (fechada) {
    return (
      <Badge variant="warn" size="sm">
        {ehWhats
          ? "Janela fechada · só template aprovado"
          : "Janela fechada · responda no comentário"}
      </Badge>
    );
  }

  return (
    <Badge variant={apertado ? "warn" : "neutral"} size="sm">
      Janela de {ehWhats ? "24h" : `${DIAS_SOCIAL} dias`} · resta{" "}
      <span className="tabular-nums">{texto}</span>
    </Badge>
  );
}
