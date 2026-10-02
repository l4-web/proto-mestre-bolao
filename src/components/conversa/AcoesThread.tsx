import type { ComponentType } from "react";
import { ArrowRightLeft, CheckCircle2, MoreHorizontal, Send, Undo2 } from "lucide-react";
import { Button, Cluster, MenuSuspenso, type ItemMenu } from "@l4-web/ui";

/**
 * Botão de ícone DENTRO do cluster. Fica limpo de propósito: o vidro é da cápsula
 * (`Cluster` do DS), e o próprio DS diz que vidro sobre vidro derruba a
 * legibilidade e desenha moldura dentro de moldura. A versão anterior disto tinha
 * blur em cada bola, o que era exatamente o erro.
 *
 * 38 de altura é a medida de controle do sistema; dentro de cápsula o DS usa a
 * mesma largura para ícone, porque ícone já lê centrado.
 */
const BOTAO_ICONE =
  "l4-pressable flex h-[30px] w-[30px] items-center justify-center rounded-full text-text-strong transition-colors hover:bg-[var(--l4-fill-3)] disabled:opacity-35";

function BotaoIcone({
  icon: Icon,
  rotulo,
  onClick,
  desabilitado,
}: {
  icon: ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  rotulo: string;
  onClick: () => void;
  desabilitado?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={desabilitado}
      title={rotulo}
      aria-label={rotulo}
      className={BOTAO_ICONE}
    >
      <Icon className="h-4 w-4" aria-hidden />
    </button>
  );
}

/**
 * As ações do caso: as duas que passam o caso adiante numa cápsula do DS, e
 * Encerrar como `Button` de verdade, preenchido, fora dela.
 *
 * A separação é a do protótipo e tem razão: encerrar é a única irreversível e a
 * única que exige motivo, então não pertence ao mesmo agrupamento funcional de
 * transferir e encaminhar.
 */
export function AcoesThread({
  podeTransferir,
  podeEncaminhar,
  podeEncerrar,
  temCasoAberto,
  ehMinha,
  temDono,
  ocupado,
  compacto,
  onAssumir,
  onSoltar,
  onTransferir,
  onEncaminhar,
  onEncerrar,
  rotuloEncerrar = "Encerrar",
}: {
  /** Vem da configuração do produto (no Mestre do Bolão, "Resolver"). */
  rotuloEncerrar?: string;
  podeTransferir: boolean;
  podeEncaminhar: boolean;
  podeEncerrar: boolean;
  /** Existe atendimento em aberto nesta conversa. */
  temCasoAberto: boolean;
  /** A conversa é de quem está olhando. */
  ehMinha: boolean;
  /** Alguém é responsável por ela (eu ou outra pessoa). */
  temDono: boolean;
  ocupado?: boolean;
  /**
   * Telefone: só a ação principal fica visível, o resto vai para o menu.
   *
   * Em 375px as quatro ações lado a lado não cabem, e o que acontecia era o
   * "Encerrar" ficar cortado pela direita: uma ação irreversível pela metade na tela,
   * que é o pior lugar possível para faltar espaço.
   */
  compacto?: boolean;
  onAssumir: () => void;
  onSoltar: () => void;
  onTransferir: () => void;
  onEncaminhar: () => void;
  onEncerrar: () => void;
}) {
  if (!podeTransferir && !podeEncaminhar && !podeEncerrar) return null;

  if (compacto) {
    /**
     * A principal fica, as outras entram no menu.
     *
     * Qual é a principal depende de quem é a conversa: se não é minha, o gesto é
     * ASSUMIR; se é minha, é ENCERRAR. Encerrar continua sendo a única com cor, e
     * continua a única que exige motivo.
     */
    const itens: ItemMenu[] = [
      ...(podeTransferir && ehMinha && temDono
        ? [{ id: "soltar", label: "Soltar para a fila", icon: Undo2, onSelect: onSoltar }]
        : []),
      ...(podeTransferir
        ? [{ id: "transferir", label: "Transferir para outra pessoa", icon: ArrowRightLeft, onSelect: onTransferir }]
        : []),
      ...(podeEncaminhar
        ? [
            {
              id: "encaminhar",
              label: temCasoAberto
                ? "Encaminhar para uma equipe"
                : "Abrir o caso e encaminhar",
              icon: Send,
              onSelect: onEncaminhar,
            },
          ]
        : []),
      ...(podeEncerrar && !ehMinha
        ? [{ id: "encerrar", label: `${rotuloEncerrar} com motivo`, icon: CheckCircle2, onSelect: onEncerrar }]
        : []),
    ];

    return (
      <div className="flex items-center gap-1.5">
        {itens.length > 0 && (
          <MenuSuspenso
            ariaLabel="Mais ações do caso"
            align="end"
            itens={itens}
            gatilho={
              <button
                type="button"
                aria-label="Mais ações"
                className="l4-pressable flex size-9 items-center justify-center rounded-full text-text-strong hover:bg-[var(--l4-fill-4)]"
              >
                <MoreHorizontal className="size-5" aria-hidden />
              </button>
            }
          />
        )}
        {podeTransferir && !ehMinha && (
          <Button size="sm" variant="filled" onClick={onAssumir} loading={ocupado}>
            Assumir
          </Button>
        )}
        {podeEncerrar && ehMinha && (
          <Button size="sm" variant="filled" onClick={onEncerrar}>
            {rotuloEncerrar}
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      {/*
        ASSUMIR e SOLTAR vêm antes das outras, e como texto e não ícone.
        São a decisão mais frequente de quem abre uma conversa da fila ("isto é meu
        ou não?"), e era a única que não existia na tela: dava para transferir para
        outra pessoa e não dava para pegar para si. Ícone aqui seria adivinhação;
        estas duas mudam de quem é o caso, e isso se escreve.
      */}
      {podeTransferir && !ehMinha && (
        <Button size="sm" variant="filled" onClick={onAssumir} loading={ocupado}>
          Assumir
        </Button>
      )}
      {podeTransferir && ehMinha && temDono && (
        <Button
          size="sm"
          variant="ghost"
          onClick={onSoltar}
          loading={ocupado}
          title="Devolve para a fila sem dono, para qualquer pessoa pegar"
        >
          Soltar
        </Button>
      )}

      {/*
        TRANSFERIR VIROU TEXTO. Era um ícone de setas dentro da cápsula, e a pergunta
        "como passo para a colega?" mostrou que ninguém lia aquilo como transferir.
        Encaminhar (para equipe interna) segue como ícone, porque é raro na venda.
      */}
      {podeTransferir && (
        <Button size="sm" variant="tinted" onClick={onTransferir} title="Transferir para outra pessoa ou fila">
          <ArrowRightLeft className="h-3.5 w-3.5" aria-hidden />
          Transferir
        </Button>
      )}
      {podeEncaminhar && (
        <Cluster>
          <BotaoIcone
            icon={Send}
            rotulo={
              temCasoAberto
                ? "Encaminhar para uma equipe interna"
                : "Abrir o caso e encaminhar para uma equipe interna"
            }
            onClick={onEncaminhar}
          />
        </Cluster>
      )}

      {podeEncerrar && (
        <Button
          size="sm"
          variant="filled"
          onClick={onEncerrar}
          title={`${rotuloEncerrar} com motivo`}
        >
          <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
          {rotuloEncerrar}
        </Button>
      )}
    </div>
  );
}
