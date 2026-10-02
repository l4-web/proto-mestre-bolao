import { useEffect, useState } from "react";
import { Cluster } from "@l4-web/ui";
import { Pause, Play, Power } from "lucide-react";
import type { Atendente } from "../../features/atendimento/tipos";

/**
 * O turno como um toggle triplo, com o estado ativo se abrindo.
 *
 * Eram três ícones iguais sem rótulo, e a pergunta que veio foi literal: "como eu
 * fico online, não, clicando no pause?". Três ícones do mesmo tamanho não dizem qual
 * está valendo, e turno é o que decide se a pessoa recebe caso: errar ali é ficar
 * fora da distribuição sem perceber.
 *
 * O que muda: o botão ativo CRESCE e mostra a palavra e o cronômetro. Não é enfeite,
 * é a única parte da tela que responde "qual é o meu estado agora e desde quando", e
 * responder isso com largura em vez de com um selo separado mantém o controle e a
 * informação na mesma peça, alinhados com o resto da faixa.
 *
 * `Cluster` do DS e não uma cápsula própria: é ela que dá a altura de 30 dentro do
 * agrupamento, que é o que faz este controle casar com os vizinhos da barra.
 */
/**
 * FUNDO vem de `*-accent`, texto vem de `*-text`. Não é preferência, é o que existe.
 *
 * `success.text` no Tailwind do projeto é `var(--l4-success-text)`, e essa variável só
 * resolve como cor de TEXTO no escopo do DS: aplicada como `background-color` ela
 * devolve transparente. O efeito era uma bola verde presente no DOM, com a classe
 * certa, e invisível na tela. Medido no navegador: `bg-success-text` computa
 * `rgba(0,0,0,0)` e `bg-success-accent` computa `rgb(52,199,89)`.
 *
 * Vale para warn e error do mesmo jeito.
 */
const OPCOES: {
  status: Atendente["status"];
  rotulo: string;
  /** O que o botão FAZ, mostrado ao passar o mouse. */
  acao: string;
  dica: string;
  icon: typeof Play;
  /** `encerrar` não expande: sair de turno não tem tempo para contar. */
  expande: boolean;
  ponto: string;
  texto: string;
}[] = [
  {
    status: "online",
    rotulo: "Online",
    acao: "Entrar em turno",
    dica: "Entrar em turno: passa a receber caso da fila",
    icon: Play,
    expande: true,
    ponto: "bg-success-accent",
    texto: "text-success-text",
  },
  {
    status: "pausa",
    rotulo: "Em pausa",
    acao: "Pausar",
    dica: "Pausa: mantém seus casos abertos e para de receber novo",
    icon: Pause,
    expande: true,
    ponto: "bg-warn-accent",
    texto: "text-warn-text",
  },
  {
    status: "offline",
    rotulo: "Fora",
    acao: "Sair de turno",
    dica: "Sair de turno: para de receber e libera a vaga",
    icon: Power,
    expande: false,
    ponto: "bg-text-muted",
    texto: "text-text-secondary",
  },
];

export function MeuTurno({
  status,
  desde,
  salvando,
  onTrocar,
}: {
  status?: Atendente["status"];
  /** Desde quando neste status. Vem do banco, não do relógio da aba. */
  desde?: string | null;
  salvando?: boolean;
  onTrocar: (s: Atendente["status"]) => void;
}) {
  const cronometro = useCronometro(desde, status === "online" || status === "pausa");
  /**
   * Passar o mouse ABRE o botão e mostra o que ele faz.
   *
   * O DS não tem tooltip, e o `title` do navegador demora um segundo e meio para
   * aparecer, num controle em que a pessoa não sabe o que cada ícone significa. Em vez
   * de inventar um tooltip na tela (peça caseira que o DS teria de absorver depois),
   * o hover usa o MESMO gesto que o estado ativo já usa: a peça se abre e se explica.
   */
  const [sobre, setSobre] = useState<Atendente["status"] | null>(null);

  return (
    <Cluster>
      {OPCOES.map((o) => {
        const ativo = status === o.status;
        const Icone = o.icon;
        const emFoco = sobre === o.status && !ativo;
        const abrir = (ativo && o.expande) || emFoco;
        return (
          <button
            key={o.status}
            type="button"
            disabled={salvando}
            onClick={() => onTrocar(o.status)}
            onMouseEnter={() => setSobre(o.status)}
            onMouseLeave={() => setSobre(null)}
            onFocus={() => setSobre(o.status)}
            onBlur={() => setSobre(null)}
            aria-pressed={ativo}
            title={o.dica}
            aria-label={o.dica}
            className={[
              "l4-pressable flex h-[30px] items-center gap-1.5 overflow-hidden rounded-full transition-[width,background-color] disabled:opacity-35",
              // A curva é a do sistema: a peça se acomoda, não salta.
              "duration-[340ms] ease-[cubic-bezier(.32,.72,0,1)]",
              abrir ? "w-auto px-2.5" : "w-[30px] justify-center px-0",
              ativo
                ? "bg-[var(--l4-fill-2)]"
                : "text-text-secondary hover:bg-[var(--l4-fill-3)]",
            ].join(" ")}
          >
            {ativo && o.expande ? (
              /*
                A bola ENTRA crescendo, e no online ela respira.
                A troca era seca porque só a largura animava: o conteúdo aparecia
                pronto no fim. Agora a peça inteira se acomoda, que é o que faz o
                gesto parecer uma coisa mudando de estado e não dois desenhos
                trocados. `motion-safe` porque quem pediu menos movimento no sistema
                não quer um ponto pulsando na barra o dia inteiro.
              */
              <span
                className={[
                  "size-2 flex-none rounded-full motion-safe:animate-[surgir_.34s_cubic-bezier(.32,.72,0,1)]",
                  o.status === "online" ? "motion-safe:animate-pulse" : "",
                  o.ponto,
                ].join(" ")}
                aria-hidden
              />
            ) : (
              <Icone
                className={`size-4 flex-none ${ativo ? "text-text-strong" : ""}`}
                aria-hidden
              />
            )}
            {abrir && (
              <span className="flex items-center gap-1 whitespace-nowrap text-[12px] motion-safe:animate-[entrar_.34s_cubic-bezier(.32,.72,0,1)]">
                {emFoco ? (
                  <span className="text-text-secondary">{o.acao}</span>
                ) : (
                  <>
                    <span className={`font-medium ${o.texto}`}>{o.rotulo}</span>
                    {cronometro && (
                      <span className="tabular-nums text-text-secondary">{cronometro}</span>
                    )}
                  </>
                )}
              </span>
            )}
          </button>
        );
      })}
    </Cluster>
  );
}

/**
 * O tempo no status, contando na tela.
 *
 * Conta a partir de `status_desde`, que vem do BANCO: um contador que começa quando a
 * aba abriu mostraria "há 2 min" para quem está em turno desde as oito da manhã, e é
 * justamente essa pessoa (marcada online e ausente) que o supervisor precisa achar.
 *
 * O intervalo só existe enquanto há o que contar. Timer rodando em aba de quem está
 * fora de turno é trabalho para não mudar nada na tela.
 */
function useCronometro(desde: string | null | undefined, ativo: boolean): string | null {
  const [agora, setAgora] = useState(() => Date.now());

  useEffect(() => {
    if (!ativo || !desde) return;
    const id = setInterval(() => setAgora(Date.now()), 1000);
    return () => clearInterval(id);
  }, [ativo, desde]);

  if (!ativo || !desde) return null;
  const seg = Math.max(0, Math.floor((agora - new Date(desde).getTime()) / 1000));
  const h = Math.floor(seg / 3600);
  const m = Math.floor((seg % 3600) / 60);
  // Acima de uma hora o segundo deixa de informar e só faz o número piscar.
  if (h > 0) return `${h}h${String(m).padStart(2, "0")}`;
  return `${String(m).padStart(2, "0")}:${String(seg % 60).padStart(2, "0")}`;
}
