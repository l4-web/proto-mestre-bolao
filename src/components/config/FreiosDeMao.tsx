import { useState } from "react";
import { Bot, Send, Sparkles } from "lucide-react";
import { Eyebrow, SegmentedControl, useConfirm } from "@l4-web/ui";
import { useConfigurarPracaMutation } from "../../features/atendimento/atendimento.api";
import { estaLigado, FREIOS, type ChaveFreio } from "./freios";
import type { Praca } from "../../features/atendimento/tipos";

const ICONE: Record<ChaveFreio, typeof Bot> = {
  bot_ativo: Bot,
  envio_ativo: Send,
  ia_ativa: Sparkles,
};

const OPCOES = [
  { id: "ligado" as const, label: "Ligado" },
  { id: "desligado" as const, label: "Desligado" },
];

/**
 * Os três interruptores de emergência da praça, com controle na tela.
 *
 * Eles existem na API desde o começo e não tinham controle nenhum aqui: acionar
 * dependia de chamada direta ou de um UPDATE no banco. A razão de existirem é
 * velocidade, e um freio que só o time de plantão consegue puxar não é freio.
 *
 * SALVAM NA HORA, fora do "Salvar" do resto da operação. É a diferença entre um
 * clique e um formulário: quando a régua de linguagem falha na frente do cliente,
 * ninguém vai revisar horário de funcionamento antes de parar o envio. E o
 * contrário também é verdade: sem isto, quem só queria trocar o expediente
 * gravaria junto o estado dos três freios.
 *
 * CADA PATCH MANDA UM CAMPO SÓ. A coluna é nula por padrão e nulo significa
 * ligado, então mandar os três a cada salvamento converteria em `false` (ou em
 * `true`) freios que ninguém tocou, apagando o padrão do banco.
 */
export function FreiosDeMao({ praca }: { praca: Praca }) {
  const confirm = useConfirm();
  const [salvar] = useConfigurarPracaMutation();
  /** Qual freio está em voo. Um por vez: são três decisões, não um formulário. */
  const [emVoo, setEmVoo] = useState<ChaveFreio | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  async function aplicar(chave: ChaveFreio, ligar: boolean) {
    setErro(null);
    setEmVoo(chave);
    try {
      await salvar({ empresaId: praca.empresa_id, [chave]: ligar }).unwrap();
    } catch (e) {
      const corpo = (e as { data?: { message?: string | string[] } }).data;
      const msg = Array.isArray(corpo?.message) ? corpo?.message[0] : corpo?.message;
      // O throw sobe para o `onConfirm` do diálogo, que mostra o erro inline e
      // mantém a confirmação aberta para nova tentativa. Aqui a mensagem também
      // fica na seção, que é o caminho de quem RELIGOU (esse não passa por diálogo).
      setErro(msg ?? "Não deu para mudar o interruptor.");
      throw new Error(msg ?? "Não deu para mudar o interruptor.");
    } finally {
      setEmVoo(null);
    }
  }

  async function trocar(chave: ChaveFreio, valor: "ligado" | "desligado") {
    const ligar = valor === "ligado";
    // O segmentado dispara `onChange` mesmo no segmento que já está marcado, então
    // sem esta saída clicar em "Desligado" no que já está desligado abriria uma
    // confirmação para não mudar nada, e um diálogo que aparece à toa é o jeito mais
    // rápido de ensinar alguém a confirmar sem ler.
    if (ligar === estaLigado(praca[chave])) return;
    // Religar não pergunta: é o estado normal da praça, e voltar ao normal depressa
    // é tão parte do freio quanto puxá-lo.
    if (ligar) {
      await aplicar(chave, true).catch(() => {});
      return;
    }
    const freio = FREIOS[chave];
    await confirm({
      title: freio.pergunta,
      description: freio.consequencia,
      confirmLabel: "Desligar",
      variant: "danger",
      onConfirm: () => aplicar(chave, false),
    });
  }

  return (
    <div className="flex flex-col gap-1.5">
      <Eyebrow>Interruptores de emergência</Eyebrow>
      <p className="text-[11px] leading-snug text-text-secondary">
        Valem na hora, sem deploy e sem passar pelo Salvar da página. Use quando algo
        estiver errado na frente do cliente, e religue assim que estiver resolvido.
      </p>

      <div className="mt-1 flex flex-col gap-1">
        {(Object.keys(FREIOS) as ChaveFreio[]).map((chave) => {
          const freio = FREIOS[chave];
          const Icone = ICONE[chave];
          const ligado = estaLigado(praca[chave]);
          return (
            /*
              Grade, e não `flex-col sm:flex-row`: o `styles.css` do DS carrega
              depois do CSS do app, então o `.flex-col` dele ganha do
              `.sm:flex-row` daqui e a linha nunca vira linha no desktop.
            */
            <div
              key={chave}
              className="grid gap-2 rounded-[14px] bg-[var(--l4-fill-5)] px-3 py-2.5 sm:grid-cols-[1fr_auto] sm:items-center sm:gap-3"
            >
              <span className="flex min-w-0 items-start gap-2.5">
                <Icone
                  className={`mt-0.5 size-4 flex-none ${ligado ? "text-success-text" : "text-error-text"}`}
                  aria-hidden
                />
                <span className="min-w-0">
                  <span className="block text-[12.5px] font-medium text-text-strong">
                    {freio.rotulo}
                  </span>
                  <span className="block text-[11px] leading-snug text-text-secondary">
                    {freio.corta}
                  </span>
                </span>
              </span>
              {/*
                Segmentado com as duas palavras escritas, e não uma chavinha.
                Interruptor de emergência é onde ambiguidade custa caro: com a
                chavinha a pessoa lê a posição e adivinha o estado, e aqui ela lê
                "Desligado" em letra.
              */}
              <div className="sm:justify-self-end">
                <SegmentedControl
                  size="sm"
                  aria-label={freio.rotulo}
                  options={OPCOES}
                  value={ligado ? "ligado" : "desligado"}
                  disabled={emVoo !== null}
                  onChange={(v) => void trocar(chave, v)}
                />
              </div>
            </div>
          );
        })}
      </div>

      {erro && (
        <p
          role="alert"
          className="mt-1 rounded-[12px] border-[0.5px] border-error-border bg-error-bg px-3 py-2 text-[11.5px] text-error-text"
        >
          {erro}
        </p>
      )}
    </div>
  );
}
