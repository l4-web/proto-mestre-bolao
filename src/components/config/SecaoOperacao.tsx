import { useEffect, useState } from "react";
import { Button, Eyebrow, Input, SelectPill, Textarea } from "@l4-web/ui";
import { useConfigurarPracaMutation } from "../../features/atendimento/atendimento.api";

/**
 * O que a praça faz sozinha, editável: expediente, automações e teto.
 *
 * Era leitura, e a tela mostrava valor que ninguém alterava sem deploy. O expediente é o
 * mais consequente: o SLA comercial só corre dentro dele, então mudar o horário muda
 * todo prazo calculado depois, e deixar isso preso em `seed` significava que abrir sábado
 * dependia de um release.
 *
 * OS TRÊS FREIOS DE MÃO SAÍRAM DAQUI e viraram o `FreiosDeMao`, logo acima. Eles
 * estavam neste formulário e isso os quebrava de dois jeitos: eram salvos junto com
 * o expediente (então parar o envio exigia revisar horário antes de clicar em
 * Salvar, quando o motivo de existirem é parar em segundos), e o `?? false` da
 * leitura tratava o nulo do banco como desligado, o que mostrava toda praça
 * intocada como parada e gravava esse `false` de volta no primeiro Salvar.
 */
const DIAS = [
  ["1", "Segunda"],
  ["2", "Terça"],
  ["3", "Quarta"],
  ["4", "Quinta"],
  ["5", "Sexta"],
  ["6", "Sábado"],
  ["0", "Domingo"],
] as const;

type Faixas = Record<string, [string, string][]>;

interface Form {
  nome: string;
  fuso: string;
  dias: Faixas;
  auto_fechar_conversa_horas: number;
  auto_offline_atendente_min: number;
  espera_texto_inicial: string;
  lembrete_espera_horas: number;
  /**
   * Sempre com OITO posições, mesmo vazias, e a posição É o significado: a caixa 1 é o
   * primeiro lembrete que a pessoa recebe, a 8 é o último. Uma lista que cresce por
   * botão de adicionar esconderia essa ordem, que é a coisa mais importante da tela.
   */
  lembrete_espera_textos: string[];
  teto_reais_mes: number;
  teto_alerta_pct: number;
  teto_acao: string;
}

/** Quantos lembretes cabem num dia de expediente, e por isso quantas caixas a tela tem. */
const LEMBRETES = 8;

export function SecaoOperacao({
  praca,
}: {
  praca: {
    empresa_id: string;
    nome?: string | null;
    fuso?: string | null;
    expediente?: { dias?: Faixas } | null;
    auto_fechar_conversa_horas?: number | null;
    auto_offline_atendente_min?: number | null;
    espera_texto_inicial?: string | null;
    lembrete_espera_horas?: number | null;
    lembrete_espera_textos?: string[] | null;
    /**
     * Os textos de fábrica, vindos da API. Ficam de `placeholder` nas caixas vazias:
     * sem eles a tela mostraria oito caixas em branco e ninguém saberia o que o
     * cliente está lendo hoje. Não são copiados para cá de propósito, para não existir
     * uma segunda versão das frases divergindo da que sai de verdade.
     */
    espera_texto_inicial_padrao?: string | null;
    lembrete_espera_padroes?: string[] | null;
    teto_micros_mes?: string | number | null;
    teto_alerta_pct?: number | null;
    teto_acao?: string | null;
  };
}) {
  const [salvar, { isLoading }] = useConfigurarPracaMutation();
  const [erro, setErro] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  const doServidor = (): Form => ({
    nome: praca.nome ?? "",
    fuso: praca.fuso ?? "America/Sao_Paulo",
    dias: praca.expediente?.dias ?? {},
    auto_fechar_conversa_horas: praca.auto_fechar_conversa_horas ?? 72,
    auto_offline_atendente_min: praca.auto_offline_atendente_min ?? 30,
    espera_texto_inicial: praca.espera_texto_inicial ?? "",
    lembrete_espera_horas: praca.lembrete_espera_horas ?? 1,
    // Sempre oito posições: a caixa vazia é a que usa o padrão, e ela precisa existir
    // na tela para a pessoa ver que existe um sétimo e um oitavo lembrete.
    lembrete_espera_textos: Array.from(
      { length: LEMBRETES },
      (_, i) => praca.lembrete_espera_textos?.[i] ?? "",
    ),
    // O banco guarda micros; a tela pergunta reais, que é o que a pessoa sabe responder.
    teto_reais_mes: praca.teto_micros_mes ? Math.round(Number(praca.teto_micros_mes) / 1_000_000) : 0,
    teto_alerta_pct: praca.teto_alerta_pct ?? 80,
    teto_acao: praca.teto_acao ?? "avisar",
  });

  const [form, setForm] = useState<Form>(doServidor);
  useEffect(() => setForm(doServidor()), [praca]); // eslint-disable-line react-hooks/exhaustive-deps

  const mudou = JSON.stringify(form) !== JSON.stringify(doServidor());

  async function confirmar() {
    setErro(null);
    setOk(false);
    try {
      const { dias, lembrete_espera_textos, espera_texto_inicial, ...resto } = form;
      await salvar({
        empresaId: praca.empresa_id,
        ...resto,
        expediente: { dias },
        /**
         * COMPACTA antes de mandar, e é isto que faz a numeração da tela ser verdade.
         *
         * A API descarta texto em branco na hora de escolher o lembrete, então mandar
         * `["a","","c"]` faria o segundo lembrete ser "c" enquanto a tela mostra "c" na
         * caixa três. Compactando aqui, o que está guardado é o que sai, e ao recarregar
         * a tela renumera para a mesma ordem que o cliente recebe.
         */
        lembrete_espera_textos: lembrete_espera_textos.map((t) => t.trim()).filter(Boolean),
        // String vazia é o jeito de VOLTAR AO PADRÃO, e por isso ela é enviada em vez
        // de omitida: a API trata vazio como "use o texto de fábrica", e omitir o
        // campo faria o valor antigo continuar guardado depois de a pessoa limpar a
        // caixa, ou seja a tela mostraria o padrão em cinza e o cliente ouviria outro
        // texto.
        espera_texto_inicial: espera_texto_inicial.trim(),
      }).unwrap();
      setOk(true);
    } catch (e) {
      const corpo = (e as { data?: { message?: string | string[] } }).data;
      const msg = Array.isArray(corpo?.message) ? corpo?.message[0] : corpo?.message;
      setErro(msg ?? "Não deu para salvar.");
    }
  }

  function trocarFaixa(dia: string, inicio: string, fim: string) {
    setForm((a) => ({
      ...a,
      // Faixa vazia REMOVE o dia em vez de guardar par vazio: dia sem faixa é dia
      // fechado, e guardar `[["",""]]` faria o cálculo de SLA tratar como aberto de
      // meia-noite a meia-noite.
      dias: inicio && fim ? { ...a.dias, [dia]: [[inicio, fim]] } : omitir(a.dias, dia),
    }));
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Input
          label="Nome da praça"
          value={form.nome}
          disabled={isLoading}
          onChange={(e) => {
            const v = e.currentTarget.value;
            setForm((a) => ({ ...a, nome: v }));
          }}
        />
        <Input
          label="Fuso"
          value={form.fuso}
          disabled={isLoading}
          onChange={(e) => {
            const v = e.currentTarget.value;
            setForm((a) => ({ ...a, fuso: v }));
          }}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Eyebrow>Horário de funcionamento</Eyebrow>
        <p className="text-[11px] leading-snug text-text-secondary">
          O SLA comercial só corre aqui dentro: caso aberto às 17h50 de sexta com 4h de
          prazo vence segunda ao meio-dia, e não às 21h50 de sexta. Dia sem horário é dia
          fechado.
        </p>
        <div className="flex flex-col gap-1">
          {DIAS.map(([dia, rotulo]) => {
            const faixa = form.dias[dia]?.[0];
            return (
              <div key={dia} className="grid grid-cols-[92px_1fr_1fr] items-center gap-2">
                <span className="text-[12px] text-text-secondary">{rotulo}</span>
                <Input
                  type="time"
                  value={faixa?.[0] ?? ""}
                  disabled={isLoading}
                  onChange={(e) => trocarFaixa(dia, e.currentTarget.value, faixa?.[1] ?? "18:00")}
                />
                <Input
                  type="time"
                  value={faixa?.[1] ?? ""}
                  disabled={isLoading}
                  onChange={(e) => trocarFaixa(dia, faixa?.[0] ?? "09:00", e.currentTarget.value)}
                />
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Input
          label="Fecha conversa parada depois de (horas)"
          type="number"
          value={String(form.auto_fechar_conversa_horas)}
          disabled={isLoading}
          onChange={(e) => {
            const v = Number(e.currentTarget.value);
            setForm((a) => ({ ...a, auto_fechar_conversa_horas: v || a.auto_fechar_conversa_horas }));
          }}
        />
        <Input
          label="Atendente vira offline depois de (minutos)"
          type="number"
          value={String(form.auto_offline_atendente_min)}
          disabled={isLoading}
          onChange={(e) => {
            const v = Number(e.currentTarget.value);
            setForm((a) => ({ ...a, auto_offline_atendente_min: v || a.auto_offline_atendente_min }));
          }}
        />
      </div>

      {/*
        O LEMBRETE FICA JUNTO DO EXPEDIENTE, e não numa aba própria, porque é o
        expediente que decide a hora de parar: quem mexe no horário precisa ver, na
        mesma rolagem, que mudou junto a última hora em que o cliente é lembrado.
      */}
      <div className="flex flex-col gap-2">
        <Eyebrow>Lembrete de quem está na fila</Eyebrow>
        <p className="text-[11px] leading-snug text-text-secondary">
          Quem escalou e ficou sem atendente ouve uma vez que está na fila, e depois
          volta a ouvir de tempos em tempos enquanto ninguém pega o caso. Os lembretes
          só saem <strong className="font-medium text-text-strong">dentro do horário
          de funcionamento</strong> definido acima: no fim da faixa do dia eles param,
          e voltam na abertura seguinte. Zero hora desliga o lembrete.
        </p>

        {/*
          O PRIMEIRO aviso vem antes do campo de horas, e fica FORA do `horas > 0`.
          Ele sai no instante em que o bot escala e ninguém está online, inclusive de
          madrugada, e não depende da cadência: zerar as horas desliga os lembretes de
          hora em hora, não este. Escondê-lo junto dos oito faria parecer que
          desligar o lembrete cala o módulo inteiro, e cala nada.
        */}
        <div className="flex flex-col gap-1.5">
          <Textarea
            label="O primeiro aviso, na hora em que entra na fila"
            rows={2}
            value={form.espera_texto_inicial}
            placeholder={praca.espera_texto_inicial_padrao ?? ""}
            disabled={isLoading}
            onChange={(e) => setForm((a) => ({ ...a, espera_texto_inicial: e.currentTarget.value }))}
          />
          <p className="text-[11px] leading-snug text-text-secondary">
            Em branco usa o texto padrão (o cinza dentro da caixa). Ele sai uma vez,
            assim que a conversa entra na fila sem atendente, em qualquer horário.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-[220px_1fr]">
          <Input
            label="A cada (horas, zero desliga)"
            type="number"
            min={0}
            max={24}
            value={String(form.lembrete_espera_horas)}
            disabled={isLoading}
            onChange={(e) => {
              const v = Number(e.currentTarget.value);
              // Zero é valor legítimo (desliga), então não dá para usar o `v || anterior`
              // dos campos vizinhos: ele descartaria justamente o desligamento.
              setForm((a) => ({
                ...a,
                lembrete_espera_horas: Number.isFinite(v) && v >= 0 ? Math.trunc(v) : a.lembrete_espera_horas,
              }));
            }}
          />
        </div>

        {form.lembrete_espera_horas > 0 && (
          <div className="flex flex-col gap-1.5">
            <p className="text-[11px] leading-snug text-text-secondary">
              Os textos saem <strong className="font-medium text-text-strong">nesta
              ordem</strong>: o primeiro lembrete usa o texto 1, o seguinte usa o 2, e
              assim por diante. Caixa em branco{" "}
              <strong className="font-medium text-text-strong">volta ao texto padrão</strong>{" "}
              (o cinza que aparece dentro dela), e apagar todas não desliga o lembrete,
              só devolve os padrões. Para desligar, zere o campo de horas acima.
            </p>
            <div className="flex flex-col gap-1.5">
              {form.lembrete_espera_textos.map((texto, i) => (
                <div key={i} className="grid grid-cols-[28px_1fr] items-start gap-2">
                  {/*
                    A numeração é a cadência, e por isso ela é o rótulo. Sem o número
                    visível, oito caixas iguais viram uma lista sem ordem, e a ordem é
                    a única coisa que muda o que o cliente lê na terceira hora.
                  */}
                  <span className="pt-2.5 text-[12px] tabular-nums text-text-secondary">{i + 1}</span>
                  <Textarea
                    rows={2}
                    value={texto}
                    disabled={isLoading}
                    placeholder={praca.lembrete_espera_padroes?.[i] ?? "Texto padrão"}
                    onChange={(e) => {
                      const v = e.currentTarget.value;
                      setForm((a) => ({
                        ...a,
                        lembrete_espera_textos: a.lembrete_espera_textos.map((t, j) => (j === i ? v : t)),
                      }));
                    }}
                  />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Input
          label="Teto do mês (R$, zero = sem teto)"
          type="number"
          value={String(form.teto_reais_mes)}
          disabled={isLoading}
          onChange={(e) => {
            const v = Number(e.currentTarget.value);
            setForm((a) => ({ ...a, teto_reais_mes: Number.isFinite(v) ? v : a.teto_reais_mes }));
          }}
        />
        <Input
          label="Avisar em (% do teto)"
          type="number"
          value={String(form.teto_alerta_pct)}
          disabled={isLoading}
          onChange={(e) => {
            const v = Number(e.currentTarget.value);
            setForm((a) => ({ ...a, teto_alerta_pct: v || a.teto_alerta_pct }));
          }}
        />
        <div className="flex flex-col gap-1">
          <span className="text-[11.5px] text-text-secondary">Ao bater o teto</span>
          <SelectPill
            value={form.teto_acao}
            onChange={(v) => setForm((a) => ({ ...a, teto_acao: v }))}
            options={[
              { value: "avisar", label: "Só avisar" },
              { value: "restringir", label: "Cortar só o automático" },
              { value: "bloquear", label: "Bloquear tudo" },
            ]}
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

      <div className="flex items-center justify-end gap-2">
        {ok && !mudou && <span className="text-[11.5px] text-success-text">Salvo.</span>}
        <Button size="sm" variant="filled" loading={isLoading} disabled={!mudou} onClick={confirmar}>
          Salvar
        </Button>
      </div>
    </div>
  );
}

/** Tira um dia do expediente sem mutar o objeto do estado. */
function omitir(dias: Faixas, dia: string): Faixas {
  const copia = { ...dias };
  delete copia[dia];
  return copia;
}
