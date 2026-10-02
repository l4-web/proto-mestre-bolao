import type { ReactNode } from "react";
import { BLUE_AI_ICON_SRC } from "@l4-web/ui/shell";

/**
 * A leitura do Blue sobre ESTA tela, no lugar do subtítulo do `PageHeader`.
 *
 * É a mesma peça do iAdm Financeiro, de propósito: lá o Blue não é um bloco
 * colorido no corpo da tela, é a linha de apoio do título, com o ícone dele e a
 * palavra "Blue" como etiqueta. Duas razões para ser assim e não como estava:
 *
 * - **Uma frase de apoio por tela.** Um subtítulo estático mais um bloco azul
 *   logo abaixo são duas linhas de apoio competindo antes do primeiro dado. A
 *   leitura do Blue É o subtítulo: ela diz o que a tela está dizendo agora.
 * - **Caixa colorida é aviso.** Fundo `info` no topo de toda tela gasta o
 *   recurso que deveria marcar exceção (o escopo da escuta, um canal fora do
 *   ar). Se tudo é destacado, nada é.
 *
 * O texto vem montado por quem chama, a partir dos números que a própria tela já
 * tem. Enquanto o Blue AI não estiver ligado no módulo, uma frase determinística
 * derivada do dado real é mais honesta que um espaço reservado para IA.
 */
export function LinhaBlue({ children }: { children: ReactNode }) {
  return (
    <span className="flex items-start gap-[9px]">
      <span className="mt-[2px] inline-flex shrink-0 items-center gap-[5px] text-[12px] font-semibold tracking-[-0.005em] text-text-secondary">
        <img src={BLUE_AI_ICON_SRC} alt="" className="h-4 w-4" />
        Blue
      </span>
      <span className="text-text-strong">{children}</span>
    </span>
  );
}
