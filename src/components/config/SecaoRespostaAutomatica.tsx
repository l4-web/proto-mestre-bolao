import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { Button, Eyebrow, SegmentedControl, Textarea, useConfirm } from "@l4-web/ui";
import { useConfigurarPracaMutation } from "../../features/atendimento/atendimento.api";

const OPCOES = [
  { id: "ligada" as const, label: "Ligada" },
  { id: "desligada" as const, label: "Desligada" },
];

/** O que aparece na caixa vazia. NÃO é padrão: se ninguém escrever, nada sai. */
const EXEMPLO = "Que bom saber disso, {autor}! Obrigado por participar com a gente.";

/**
 * A praça respondendo SOZINHA ao elogio público.
 *
 * Não é freio de mão, e por isso não está com os outros três: eles PARAM alguma
 * coisa e nascem ligados, este COMEÇA e nasce desligado. Publicar em nome da marca
 * sem ninguém ler é o tipo de comportamento que precisa ser ligado por alguém com
 * nome, nunca herdado por omissão de configuração.
 *
 * O interruptor salva NA HORA e o texto salva no botão, de propósito: desligar tem
 * que ser um clique (é o que alguém faz quando a automação escreve algo errado em
 * público), e o texto é escrita que se revisa antes de valer.
 */
export function SecaoRespostaAutomatica({
  praca,
}: {
  praca: {
    empresa_id: string;
    auto_resposta_ativa?: boolean | null;
    auto_resposta_modelo?: string | null;
  };
}) {
  const confirm = useConfirm();
  const [salvar, { isLoading }] = useConfigurarPracaMutation();
  const [modelo, setModelo] = useState(praca.auto_resposta_modelo ?? "");
  const [erro, setErro] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  // O servidor é a fonte: depois de salvar, a lista da praça é reconsultada e o
  // texto precisa acompanhar, senão a caixa mostra o rascunho antigo de quem
  // editou em outra aba.
  useEffect(() => setModelo(praca.auto_resposta_modelo ?? ""), [praca.auto_resposta_modelo]);

  const ligada = praca.auto_resposta_ativa === true;
  const semTexto = !(praca.auto_resposta_modelo ?? "").trim();

  async function aplicar(campos: Record<string, unknown>) {
    setErro(null);
    setOk(false);
    try {
      await salvar({ empresaId: praca.empresa_id, ...campos }).unwrap();
      setOk(true);
    } catch (e) {
      const corpo = (e as { data?: { message?: string | string[] } }).data;
      const msg = Array.isArray(corpo?.message) ? corpo?.message[0] : corpo?.message;
      setErro(msg ?? "Não deu para salvar.");
      throw new Error(msg ?? "Não deu para salvar.");
    }
  }

  async function trocar(valor: "ligada" | "desligada") {
    const ligar = valor === "ligada";
    // O segmentado dispara mesmo no segmento já marcado, e confirmação que aparece à
    // toa é o jeito mais rápido de ensinar alguém a confirmar sem ler.
    if (ligar === ligada) return;
    // Desligar não pergunta: voltar ao normal depressa é o ponto.
    if (!ligar) return void aplicar({ auto_resposta_ativa: false }).catch(() => {});
    await confirm({
      title: "Ligar a resposta automática?",
      description:
        "A praça vai publicar este texto embaixo dos comentários elogiosos, em público, " +
        "sem ninguém ler antes. Não sai em comentário com pergunta, em suspeita de golpe " +
        "nem no que a régua de linguagem do produto não liberar por inteiro.",
      confirmLabel: "Ligar",
      onConfirm: () => aplicar({ auto_resposta_ativa: true }),
    });
  }

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Eyebrow>Resposta automática ao elogio</Eyebrow>
        <SegmentedControl
          options={OPCOES}
          value={ligada ? "ligada" : "desligada"}
          onChange={(v) => void trocar(v as "ligada" | "desligada")}
          size="sm"
          disabled={isLoading}
        />
      </div>

      <p className="text-[11.5px] leading-relaxed text-text-secondary">
        Sai só no comentário classificado como elogio, sem pergunta e sem suspeita de
        golpe, e só quando a régua de linguagem do produto libera o texto inteiro. Não
        é recurso da Meta: é a mesma publicação que sai quando alguém clica em
        responder, com a diferença de que ninguém leu antes. Na tela de Comentários ela
        aparece marcada como <b>Resposta automática</b>.
      </p>

      {ligada && semTexto && (
        <p className="flex items-start gap-2 rounded-[12px] bg-warn-bg px-2.5 py-2 text-[11.5px] leading-snug text-warn-text">
          <AlertTriangle className="mt-px size-3.5 flex-none" aria-hidden />
          <span>
            Está ligada e sem texto, então nada sai. Não existe frase de fábrica aqui de
            propósito: uma resposta que a praça não escreveu sairia em público assinada
            pela marca.
          </span>
        </p>
      )}

      <label className="flex flex-col gap-1.5">
        <span className="text-[11.5px] text-text-secondary">
          Texto da resposta. <code className="font-mono">{"{autor}"}</code> vira o @ de
          quem comentou.
        </span>
        <Textarea
          value={modelo}
          onChange={(e) => setModelo(e.target.value)}
          rows={3}
          maxLength={600}
          placeholder={EXEMPLO}
        />
      </label>

      {erro && <p className="text-[11.5px] text-error-text">{erro}</p>}
      {ok && !erro && <p className="text-[11.5px] text-success-text">Salvo.</p>}

      <div className="flex items-center gap-2">
        <Button
          size="sm"
          loading={isLoading}
          disabled={modelo === (praca.auto_resposta_modelo ?? "")}
          onClick={() => void aplicar({ auto_resposta_modelo: modelo }).catch(() => {})}
        >
          Salvar o texto
        </Button>
        {modelo.trim() && (
          <span className="text-[11.5px] text-text-secondary">
            Sai assim: {modelo.replaceAll("{autor}", "@fulano")}
          </span>
        )}
      </div>
    </section>
  );
}
