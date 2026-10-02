import {
  BarChart3,
  BookOpen,
  Cog,
  CreditCard,
  Inbox,
  LifeBuoy,
  MessageSquare,
  Radar,
  Wrench,
} from "lucide-react";
import type { NavSection } from "@l4-web/ui/shell";
import type { Ability } from "@l4-web/authz";

export const MODULE_ID = "atendeai";

/**
 * Navegação da sidebar, montada a partir do que o papel PODE VER. Não é enfeite:
 * o Atende Aí tem oito perfis com recortes muito diferentes (o Dev não vê
 * conversa, o Gestor não responde, o DPO só audita), e uma sidebar fixa com itens
 * que dão 403 ensina a pessoa a ignorar a navegação.
 *
 * Isto é UX, não segurança. A fronteira real é o guard da API: a tela some aqui e
 * a rota devolve 403 lá, e as duas coisas precisam ser verdade ao mesmo tempo.
 */
export function buildNav(ability?: Ability): NavSection[] {
  const pode = (tela: string) => ability?.canScreen(MODULE_ID, tela) ?? false;
  const secoes: NavSection[] = [];

  if (pode("conversas")) {
    secoes.push({
      title: "Atendimento",
      items: [{ to: "/conversas", label: "Conversas", icon: Inbox }],
    });
  }

  const social = [];
  if (pode("social")) social.push({ to: "/comentarios", label: "Comentários", icon: MessageSquare });
  if (pode("escuta")) social.push({ to: "/escuta", label: "Escuta", icon: Radar });
  if (social.length) secoes.push({ title: "Redes sociais", items: social });

  // As duas caixas são a MESMA tela com equipe diferente, e por isso são duas
  // permissões distintas: quem trata defeito não precisa ver dado de pagamento.
  const equipes = [];
  if (pode("encaminhamentos-dev"))
    equipes.push({ to: "/equipes/tecnica", label: "Caixa técnica", icon: Wrench });
  if (pode("encaminhamentos-pagamentos"))
    equipes.push({ to: "/equipes/financeira", label: "Caixa financeira", icon: CreditCard });
  if (equipes.length) secoes.push({ title: "Equipes", items: equipes });

  const gestao = [];
  if (pode("supervisao")) gestao.push({ to: "/supervisao", label: "Supervisão", icon: BarChart3 });
  /**
   * A Base de conhecimento passou a pedir `config`, e não mais a tela `base`.
   *
   * Ela absorveu a antiga aba "Bot" de Configurações, que escreve na árvore do bot e
   * publica o texto que o cliente lê. Com duas telas para a mesma tabela, quem tivesse
   * só `base` enxergaria a página e levaria 403 na metade dela, que é pior do que não
   * ver a página. A tela `base` deixa de portear rota nenhuma.
   *
   * ⚠️ CONSEQUÊNCIA: no catálogo semeado, `atendeai:base` é do atendente, do supervisor
   * e do admin, e `atendeai:config` é SÓ do admin. Enquanto o catálogo não mudar,
   * atendente e supervisor perdem este item do menu e o acesso à base.
   */
  if (pode("config")) gestao.push({ to: "/base", label: "Base de conhecimento", icon: BookOpen });
  if (pode("consumo")) gestao.push({ to: "/consumo", label: "Consumo e custo", icon: LifeBuoy });
  if (pode("config")) gestao.push({ to: "/configuracoes", label: "Configurações", icon: Cog });
  if (gestao.length) secoes.push({ title: "Gestão", items: gestao });

  return secoes;
}

/**
 * Primeira tela do papel. Sem isto o Dev abre a raiz e vê uma tela vazia com um
 * item de menu só, e o Gestor cai num inbox que ele não pode responder.
 */
export function homeDoPapel(ability?: Ability): string {
  const pode = (tela: string) => ability?.canScreen(MODULE_ID, tela) ?? false;
  if (pode("conversas")) return "/conversas";
  if (pode("encaminhamentos-dev")) return "/equipes/tecnica";
  if (pode("encaminhamentos-pagamentos")) return "/equipes/financeira";
  if (pode("supervisao")) return "/supervisao";
  if (pode("social")) return "/comentarios";
  if (pode("consumo")) return "/consumo";
  // A base e as configurações caem na mesma tela do authz agora, então a base vem
  // primeiro por ser a que se abre no dia a dia.
  if (pode("config")) return "/base";
  return "/sem-acesso";
}
