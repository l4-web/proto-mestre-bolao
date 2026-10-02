import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { Button, Eyebrow, Input, Textarea } from "@l4-web/ui";
import { useConfigurarComplianceMutation } from "../../features/atendimento/atendimento.api";
import { ListaEditavel } from "./ListaEditavel";

/**
 * A régua de linguagem de um produto, editável.
 *
 * Era leitura: a tela mostrava as três listas e ninguém conseguia mudar sem deploy. É a
 * configuração mais delicada do módulo, porque `bloqueio_duro` IMPEDE o envio: palavra a
 * mais trava atendimento legítimo, palavra a menos deixa passar o que um título de
 * capitalização não pode dizer.
 *
 * O salvamento é do bloco inteiro e explícito, com botão. Régua é conjunto, e quem edita
 * precisa ver a lista completa antes de confirmar: salvar por termo deixaria a régua
 * parcialmente aplicada no meio da edição, e é ela que decide o que sai para o cliente.
 */
interface Regua {
  bloqueio_duro: string[];
  termos_revisao: string[];
  mencoes_obrigatorias: string[];
  idade_minima: number;
  script_sac: string;
}

export function SecaoCompliance({
  empresaId,
  produtoSlug,
  atual,
}: {
  empresaId: string;
  produtoSlug: string;
  atual?: {
    bloqueio_duro?: string[];
    termos_revisao?: string[];
    mencoes_obrigatorias?: string[];
    idade_minima?: number;
    script_sac?: string | null;
  } | null;
}) {
  const [salvar, { isLoading }] = useConfigurarComplianceMutation();
  const [erro, setErro] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  const inicial: Regua = {
    bloqueio_duro: atual?.bloqueio_duro ?? [],
    termos_revisao: atual?.termos_revisao ?? [],
    mencoes_obrigatorias: atual?.mencoes_obrigatorias ?? [],
    idade_minima: atual?.idade_minima ?? 18,
    script_sac: atual?.script_sac ?? "",
  };
  const [form, setForm] = useState<Regua>(inicial);

  // Quando o dado do servidor chega (ou muda por invalidação), o formulário acompanha.
  // Sem isto o bloco ficaria mostrando o estado inicial vazio de antes da resposta.
  useEffect(() => {
    setForm({
      bloqueio_duro: atual?.bloqueio_duro ?? [],
      termos_revisao: atual?.termos_revisao ?? [],
      mencoes_obrigatorias: atual?.mencoes_obrigatorias ?? [],
      idade_minima: atual?.idade_minima ?? 18,
      script_sac: atual?.script_sac ?? "",
    });
  }, [atual]);

  const mudou = JSON.stringify(form) !== JSON.stringify(inicial);

  async function confirmar() {
    setErro(null);
    setOk(false);
    try {
      await salvar({ empresaId, produtoSlug, ...form }).unwrap();
      setOk(true);
    } catch (e) {
      const corpo = (e as { data?: { message?: string | string[] } }).data;
      const msg = Array.isArray(corpo?.message) ? corpo?.message[0] : corpo?.message;
      setErro(msg ?? "Não deu para salvar a régua.");
    }
  }

  return (
    <div className="flex flex-col gap-3.5">
      <div>
        <span className="text-[11px] font-semibold uppercase tracking-wide text-error-text">
          Bloqueio duro
        </span>
        <p className="mb-1.5 mt-0.5 text-[11px] leading-snug text-text-secondary">
          <b>Impede o envio</b>, do atendente e do bot. Prometer prêmio fora do
          regulamento, informar alíquota de imposto, pedir senha ou pagamento antecipado.
        </p>
        <ListaEditavel
          valores={form.bloqueio_duro}
          tom="bloqueio"
          placeholder="palavra ou expressão que não pode sair"
          desabilitado={isLoading}
          onChange={(v) => setForm((a) => ({ ...a, bloqueio_duro: v }))}
        />
      </div>

      <div>
        <span className="text-[11px] font-semibold uppercase tracking-wide text-warn-text">
          Passa com aviso
        </span>
        <p className="mb-1.5 mt-0.5 text-[11px] leading-snug text-text-secondary">
          O atendente vê o aviso e decide. <b>Para o bot, barra</b>: não existe alguém
          lendo o aviso e assumindo a responsabilidade.
        </p>
        <ListaEditavel
          valores={form.termos_revisao}
          tom="aviso"
          placeholder="palavra que pede atenção"
          desabilitado={isLoading}
          onChange={(v) => setForm((a) => ({ ...a, termos_revisao: v }))}
        />
      </div>

      <div>
        <Eyebrow>Menções obrigatórias</Eyebrow>
        <p className="mb-1.5 mt-0.5 text-[11px] leading-snug text-text-secondary">
          O que a resposta precisa dizer quando fala do produto.
        </p>
        <ListaEditavel
          valores={form.mencoes_obrigatorias}
          placeholder="o que não pode faltar"
          desabilitado={isLoading}
          onChange={(v) => setForm((a) => ({ ...a, mencoes_obrigatorias: v }))}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-[160px_1fr]">
        <Input
          label="Idade mínima"
          type="number"
          value={String(form.idade_minima)}
          disabled={isLoading}
          onChange={(e) => {
            const v = Number(e.currentTarget.value);
            setForm((a) => ({ ...a, idade_minima: Number.isFinite(v) ? v : a.idade_minima }));
          }}
        />
        <div className="flex flex-col gap-1">
          <span className="text-[11.5px] text-text-secondary">Script de SAC</span>
          <Textarea
            value={form.script_sac}
            rows={3}
            placeholder="Texto que o atendimento precisa seguir, quando o produto exige"
            disabled={isLoading}
            onChange={(e) => {
              const v = e.currentTarget.value;
              setForm((a) => ({ ...a, script_sac: v }));
            }}
          />
        </div>
      </div>

      {erro && (
        <p
          role="alert"
          className="rounded-[12px] border-[0.5px] border-error-border bg-error-bg px-3 py-2 text-[11.5px] text-error-text"
        >
          {erro}
        </p>
      )}

      {form.bloqueio_duro.length === 0 && (
        <div className="flex items-start gap-2 rounded-[12px] bg-warn-bg px-3 py-2">
          <AlertTriangle className="mt-0.5 size-3.5 flex-none text-warn-text" aria-hidden />
          <p className="text-[11.5px] leading-relaxed text-text-strong">
            Sem bloqueio duro, a avaliação devolve <b>revisão</b> em vez de liberado, e o
            bot fica barrado em tudo. É o lado seguro, e trava o time até alguém preencher.
          </p>
        </div>
      )}

      <div className="flex items-center justify-end gap-2">
        {ok && !mudou && <span className="text-[11.5px] text-success-text">Salvo.</span>}
        <Button size="sm" variant="filled" loading={isLoading} disabled={!mudou} onClick={confirmar}>
          Salvar régua
        </Button>
      </div>
    </div>
  );
}
