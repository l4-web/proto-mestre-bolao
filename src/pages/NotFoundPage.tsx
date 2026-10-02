import { EmptyState, PageContainer } from "@l4-web/ui";

export function NotFoundPage() {
  return (
    <PageContainer>
      <EmptyState
        emoji="🧭"
        title="Página não encontrada"
        description="A rota acessada não existe neste módulo."
      />
    </PageContainer>
  );
}
