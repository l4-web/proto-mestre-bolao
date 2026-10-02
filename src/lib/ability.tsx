import { createContext, useContext } from "react";
import type { Ability } from "@l4-web/authz";

/**
 * A `Ability` resolvida pelo layout, disponível às páginas. O `AppShell` renderiza
 * o `<Outlet/>` sem contexto próprio, então o caminho é um contexto nosso em volta
 * dele, e não `useOutletContext`.
 *
 * Mora em arquivo separado porque o App.tsx só exporta componentes: misturar hook
 * e componente no mesmo módulo derruba o fast refresh do Vite.
 */
export const AbilityContext = createContext<Ability | undefined>(undefined);

export function useAbility(): Ability | undefined {
  return useContext(AbilityContext);
}

/**
 * O id de quem está logado.
 *
 * Contexto separado da `Ability` porque as duas perguntas são diferentes: "o que eu
 * posso" e "quem eu sou". A segunda aparece quando a tela precisa achar a PRÓPRIA
 * linha numa lista (qual atendente sou eu na fila), e resolver isso comparando
 * e-mail ou nome quebra no primeiro homônimo.
 */
export const MeuIdContext = createContext<string | undefined>(undefined);

export function useMeuId(): string | undefined {
  return useContext(MeuIdContext);
}
