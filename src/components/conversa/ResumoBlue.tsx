import { useState } from "react";
import { Sparkles } from "lucide-react";
import { useBlueResumoMutation } from "../../features/atendimento/atendimento.api";

/**
 * "Sobre o que é isso?" antes de assumir o caso.
 *
 * A fila mostra a última mensagem e mais nada, então para saber se um caso é seu a
 * pessoa abria a conversa e lia tudo, doze vezes, antes de escolher um. Aqui ela
 * pergunta ao Blue e decide em três frases.
 *
 * Só aparece em conversa SEM DONO. Depois de assumir, a pessoa vai ler a thread de
 * qualquer forma, e um resumo ali competiria com a conversa de verdade: o resumo é
 * para decidir, não para atender.
 */
export function ResumoBlue({ conversaId }: { conversaId: string }) {
  const [resumir, { isLoading }] = useBlueResumoMutation();
  const [texto, setTexto] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  async function pedir() {
    setErro(null);
    try {
      const r = await resumir({ conversaId }).unwrap();
      setTexto(r.texto);
    } catch (e) {
      const corpo = (e as { data?: { message?: string } }).data;
      setErro(corpo?.message ?? "O Blue não conseguiu resumir agora.");
    }
  }

  if (texto) {
    return (
      <div className="mx-3 mt-2 flex gap-2 rounded-[14px] bg-[var(--l4-fill-5)] px-3 py-2.5 motion-safe:animate-[entrar_.34s_cubic-bezier(.32,.72,0,1)]">
        <Sparkles className="mt-0.5 size-3.5 flex-none text-info-text" aria-hidden />
        <p className="text-[12.5px] leading-relaxed text-text-strong">{texto}</p>
      </div>
    );
  }

  return (
    <div className="mx-3 mt-2">
      <button
        type="button"
        onClick={() => void pedir()}
        disabled={isLoading}
        className="l4-pressable flex w-full items-center justify-center gap-2 rounded-[14px] border-[0.5px] border-dashed border-[var(--l4-fill-2)] px-3 py-2 text-[12.5px] text-text-secondary transition-colors hover:bg-[var(--l4-fill-5)] disabled:opacity-60"
      >
        {/*
          A estrela PULSA enquanto pensa, e o texto diz o que está acontecendo.
          Chamada a modelo leva alguns segundos, e botão que não responde ao toque é o
          que faz a pessoa clicar três vezes e gerar três resumos cobrados.
        */}
        <Sparkles
          className={`size-3.5 flex-none text-info-text ${isLoading ? "motion-safe:animate-pulse" : ""}`}
          aria-hidden
        />
        {isLoading ? "O Blue está lendo a conversa..." : "Resumir com o Blue"}
      </button>
      {erro && (
        <p role="alert" className="mt-1.5 px-1 text-[11.5px] text-error-text">
          {erro}
        </p>
      )}
    </div>
  );
}
