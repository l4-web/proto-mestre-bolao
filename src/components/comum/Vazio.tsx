import type { ComponentType } from "react";

/**
 * Estado vazio DENTRO de um cartão que já existe.
 *
 * Não é uma versão caseira do `EmptyState` do DS: o `EmptyState` renderiza um
 * `Card` por construção (é o que ele resolve, o "Card centralizado pra estado
 * vazio" que se repetia nas telas). Ele substitui um cartão, então dentro de um
 * cartão ele desenha cartão sobre cartão, e nenhuma `variant` desliga isso, elas
 * só mudam o padding.
 *
 * Aqui o cartão é do conteúdo (a tabela de temas, a lista de atendentes) e o que
 * falta é só a mensagem, então a mensagem vem sem superfície nenhuma.
 */
export function Vazio({
  icone: Icone,
  titulo,
  descricao,
}: {
  icone?: ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  titulo: string;
  descricao?: string;
}) {
  return (
    <div className="flex flex-col items-center gap-1 px-4 py-8 text-center">
      {Icone && <Icone className="mb-1 h-6 w-6 text-text-muted" aria-hidden />}
      <p className="text-[13px] font-medium text-text-secondary">{titulo}</p>
      {descricao && <p className="text-[12px] text-text-muted">{descricao}</p>}
    </div>
  );
}
