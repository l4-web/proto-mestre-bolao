import { Lock } from "lucide-react";
import { EmptyState, PageContainer, PageHeader } from "@l4-web/ui";

/**
 * O usuário tem o módulo (senão o hub nem mostraria o tile) mas nenhuma tela
 * liberada. Acontece de verdade: papel atribuído sem permissão de tela nenhuma.
 * Sem esta rota a pessoa cai num 404 e abre chamado dizendo que o módulo quebrou.
 */
export function SemAcessoPage() {
  return (
    <PageContainer>
      <PageHeader
        title="Atende Aí"
        subtitle="Seu perfil ainda não tem nenhuma tela liberada neste módulo."
      />
      <EmptyState
        icon={Lock}
        title="Sem tela liberada"
        description="Peça ao administrador do Atende Aí a atribuição de um papel com acesso às telas."
      />
    </PageContainer>
  );
}
