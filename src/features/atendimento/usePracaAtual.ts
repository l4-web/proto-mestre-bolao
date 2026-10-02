import { useAppSelector } from "../../store/hooks";
import { usePracaQuery } from "./atendimento.api";
import type { Praca } from "./tipos";

/**
 * A praça em que a tela está trabalhando. É o substituto de `pracas?.[0]`.
 *
 * O `[0]` estava em cinco lugares e era a mesma aposta em todos: "só existe uma
 * praça". O módulo é multi-tenant por desenho (uma praça por empresa), então com
 * a segunda praça no escopo a tela passava a mostrar a primeira e a escrever no
 * `empresa_id` da primeira, calada.
 *
 * A ESCOLHA GUARDADA PODE NÃO EXISTIR MAIS: papel revogado, praça desligada,
 * escopo trocado. Neste caso a queda é para a primeira da lista, e não para
 * "nenhuma": tela sem praça nenhuma não tem como se explicar, e o escopo já foi
 * recortado pela API, então a primeira é sempre uma praça que esta pessoa pode ver.
 */
export function usePracaAtual(): {
  praca: Praca | undefined;
  pracas: Praca[];
  isLoading: boolean;
  isFetching: boolean;
} {
  const escolhida = useAppSelector((s) => s.praca.escolhida);
  const { data, isLoading, isFetching } = usePracaQuery();
  const pracas = data ?? [];
  const praca = pracas.find((p) => p.empresa_id === escolhida) ?? pracas[0];
  return { praca, pracas, isLoading, isFetching };
}
