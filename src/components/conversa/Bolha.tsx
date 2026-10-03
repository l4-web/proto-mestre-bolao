import type { Mensagem } from "../../features/atendimento/tipos";
import { Anexo } from "./Anexo";
import type { MensagemAgrupada } from "./util";
import { hora } from "./util";

const ROTULO_AUTOR: Record<Mensagem["autor"], string> = {
  cliente: "Cliente",
  bot: "Bot",
  atendente: "Atendente",
  sistema: "Sistema",
};

/**
 * Uma bolha da thread, no padrão do Messages.
 *
 * Três decisões que vêm de lá e mudam a leitura:
 *
 * 1. **Preenchimento sólido, não tinta translúcida.** A nossa é azul de marca com
 *    texto branco; a do cliente é cinza com texto escuro. Tinta com alpha sobre
 *    fundo de vidro deixa as duas quase iguais, e a thread perde o lado.
 * 2. **Grupo colado, cauda só na última.** Mensagens seguidas do mesmo autor viram
 *    um bloco, e o canto de baixo do lado dele fecha em 5px. É o que faz o olho ler
 *    "uma fala" em vez de cinco linhas soltas.
 * 3. **Autor e hora aparecem uma vez por grupo**, no fim. Carimbar em toda bolha é
 *    o ruído que o Messages evita, e aqui atrapalha mais: numa fila de atendimento
 *    a pessoa varre a conversa procurando o assunto, não o horário.
 *
 * A cauda é feita com raio assimétrico e não com pseudo-elemento desenhado: o
 * resultado lê como bolha de conversa e não depende de CSS frágil que quebra na
 * primeira mudança de fundo.
 */
export function Bolha({
  item,
  corpoOculto,
}: {
  item: MensagemAgrupada<Mensagem>;
  corpoOculto?: boolean;
}) {
  const { mensagem: m, primeira, ultima, marcoTempo } = item;

  if (m.autor === "sistema") {
    return (
      <div className="flex flex-col items-center gap-1 px-6 py-2">
        {marcoTempo && <MarcoTempo texto={marcoTempo} />}
        <p className="max-w-[82%] text-center text-[11px] leading-snug text-text-secondary">
          {m.conteudo ??
            (corpoOculto ? "nota do sistema oculta para o seu perfil" : null)}
        </p>
      </div>
    );
  }

  const nosso = m.autor === "atendente" || m.autor === "bot";
  /**
   * Imagem SEM legenda vai solta, sem a bolha colorida em volta. Com a bolha azul a
   * arte ganhava uma moldura grossa que lia como "selecionada", e no WhatsApp foto
   * enviada não tem moldura.
   */
  const soImagem = Boolean(m.midia_gcs) && !m.conteudo && !corpoOculto && m.tipo === "image";

  // Raio grande em tudo, menos o canto de baixo do lado do autor na ÚLTIMA do
  // grupo, que é onde a cauda mora.
  const raio = [
    "rounded-[19px]",
    ultima ? (nosso ? "rounded-br-[5px]" : "rounded-bl-[5px]") : "",
  ].join(" ");

  return (
    <div className="flex flex-col">
      {marcoTempo && (
        <div className="flex justify-center py-2">
          <MarcoTempo texto={marcoTempo} />
        </div>
      )}

      <div
        className={[
          "flex px-4",
          nosso ? "justify-end" : "justify-start",
          primeira ? "mt-3.5" : "mt-[3px]",
        ].join(" ")}
      >
        <div className="flex max-w-[76%] flex-col items-stretch">
          <div
            className={soImagem ? "overflow-hidden rounded-[14px]" : [
              raio,
              // `overflow-wrap:anywhere` e quebra de linha preservada: código Pix e link
              // são uma palavra só de 120 caracteres e vazavam da bolha no celular.
              "whitespace-pre-wrap px-3.5 py-2 text-[14px] leading-[1.4] [overflow-wrap:anywhere]",
              nosso
                ? "bg-brand text-white"
                : "bg-surface-chip text-text-strong",
              // Com imagem E legenda a foto encosta na borda, como no WhatsApp.
              m.midia_gcs && !corpoOculto ? "p-1 pb-2" : "",
            ].join(" ")}
          >
            {/*
              O ANEXO É O CONTEÚDO quando não há texto, e às vezes acompanha o texto
              (imagem com legenda). Por isso ele vem antes e não dentro do fallback:
              legenda sem a imagem é metade da mensagem.
            */}
            {m.midia_gcs && !corpoOculto && (
              <span className={m.conteudo ? "mb-1.5 block [&_img]:rounded-[15px] [&_img]:border-0" : "block [&_img]:border-0"}>
                <Anexo mensagemId={m.id} tipo={m.tipo} />
              </span>
            )}
            {m.conteudo && m.midia_gcs && !corpoOculto ? (
              <span className="block px-2.5">{m.conteudo}</span>
            ) : m.conteudo ??
              (m.midia_gcs && !corpoOculto ? null : (
                <span
                  className={
                    nosso ? "italic text-white/80" : "italic text-text-secondary"
                  }
                >
                  {/* Sem texto E sem anexo guardado: ou é recorte de permissão (o
                      dado existe e você não pode ler), ou o download da mídia falhou
                      lá atrás e não há arquivo nenhum. Dizer "anexo" nos dois casos
                      manda a pessoa procurar um arquivo que não vai aparecer. */}
                  {corpoOculto
                    ? "texto oculto para o seu perfil"
                    : `anexo de ${m.tipo} não recebido`}
                </span>
              ))}
          </div>

          {/* Botões de resposta da mensagem interativa: faixas separadas embaixo da
              bolha, como o WhatsApp desenha. Aqui só mostram o que o cliente vê; quem
              toca é ele. */}
          {(m.botoes ?? []).map((rotulo) => (
            <span
              key={rotulo}
              className="mt-[3px] block rounded-[14px] bg-surface-chip px-3 py-2 text-center text-[13.5px] font-semibold text-brand"
            >
              {rotulo}
            </span>
          ))}

          {ultima && (
            <span
              className={[
                "mt-1 flex items-center gap-1.5 px-1 text-[10.5px] text-text-secondary",
                nosso ? "justify-end" : "justify-start",
              ].join(" ")}
            >
              {m.autor === "bot" && (
                <span className="font-medium text-info-text">
                  {m.origem_resposta === "ia" ? "Bot · IA" : "Bot"}
                </span>
              )}
              {m.autor === "atendente" && <span>{ROTULO_AUTOR[m.autor]}</span>}
              <span className="tabular-nums">{hora(m.created_at)}</span>
              {nosso && m.status_entrega && <span>{m.status_entrega}</span>}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

/** Separador central de data e hora, no lugar de carimbar toda bolha. */
function MarcoTempo({ texto }: { texto: string }) {
  return (
    <span className="text-[10.5px] font-medium uppercase tracking-wide text-text-secondary">
      {texto}
    </span>
  );
}
