import { SelectPill } from "@l4-web/ui";
import { usePracaAtual } from "../../features/atendimento/usePracaAtual";
import { escolherPraca } from "../../store/pracaSlice";
import { useAppDispatch } from "../../store/hooks";

/**
 * Em qual praça o módulo está trabalhando.
 *
 * MORA NO TOPO DA SIDEBAR, no slot `sidebarHeader` do `AppShell`, que é o lugar
 * canônico do shell para este tipo de recorte (é onde o iAdm põe Org·Empresa e o
 * Reporta põe o produto). Não é preferência de posição: o recorte vale para a
 * navegação inteira, e um seletor dentro de uma página seria uma escolha que some
 * ao trocar de aba, que é justamente o defeito que ele existe para consertar.
 *
 * COM UMA PRAÇA SÓ ELE NÃO APARECE. Um controle com uma opção não é escolha, é
 * enfeite que ensina a pessoa a clicar em coisa que não faz nada, e ainda ocupa a
 * primeira linha da sidebar em toda instalação de cliente único.
 */
export function SeletorPraca() {
  const dispatch = useAppDispatch();
  const { praca, pracas } = usePracaAtual();

  if (pracas.length < 2 || !praca) return null;

  return (
    <div className="border-b border-[var(--l4-fill-3)] px-4 py-3">
      <SelectPill
        block
        label="Praça"
        value={praca.empresa_id}
        onChange={(v) => dispatch(escolherPraca(v))}
        options={pracas.map((p) => ({ value: p.empresa_id, label: p.nome }))}
      />
    </div>
  );
}
