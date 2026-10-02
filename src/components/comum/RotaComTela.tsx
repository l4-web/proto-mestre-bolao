import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAbility } from "../../lib/ability";
import { MODULE_ID } from "../../nav";

/**
 * Portão de rota: a tela só monta se o papel tiver ela liberada no claim.
 *
 * As 9 rotas eram declaradas sem nenhum envelope de autorização. Quem digitasse
 * `/atendeai/consumo` montava a tela de custo, e a proteção real era a API
 * responder 403 depois: a pessoa via cabeçalho, KPI vazio e mensagem de erro, o
 * que parece defeito e não falta de permissão.
 *
 * Isto NÃO substitui o portão do servidor, que é o que protege o dado (bloco 3).
 * Portão de front é sobre não mostrar caminho que não leva a lugar nenhum, e
 * tratar quem chegou por link como quem não tem acesso, não como quem achou um bug.
 */
export function RotaComTela({
  tela,
  children,
}: {
  tela: string;
  children: ReactNode;
}) {
  const ability = useAbility();

  // `undefined` é sessão ainda carregando, e redirecionar aqui manda a pessoa para
  // "sem acesso" antes de o claim chegar. O layout já cuida do estado de carga.
  if (!ability) return null;

  if (!ability.canScreen(MODULE_ID, tela) && !ability.isSuperAdmin()) {
    return <Navigate to="/sem-acesso" replace />;
  }
  return <>{children}</>;
}
