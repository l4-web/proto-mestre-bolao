import { lazy, useEffect, useMemo, useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell, BootFrame, type ShellUser } from "@l4-web/ui/shell";
import {
  createAbility,
  fetchCatalog,
  type Ability,
  type CatalogResource,
} from "@l4-web/authz";
import { loadMe, logout as authLogout } from "./lib/auth-client";
import { AbilityContext, MeuIdContext, useAbility } from "./lib/ability";
import { buildNav, homeDoPapel } from "./nav";
import { RotaComTela } from "./components/comum/RotaComTela";
import { SeletorPraca } from "./components/comum/SeletorPraca";
import { SeletorProduto } from "./components/comum/SeletorProduto";
import { ProdutoProvider } from "./lib/produto";

// Páginas em lazy(): cada uma vira um chunk próprio que só baixa quando a rota
// abre. O <Suspense> que segura a troca de chunk vive DENTRO do AppShell (do
// @l4-web/ui/shell), então sidebar/topbar seguem montadas. Export nomeado -> default.
const ConversasPage = lazy(() =>
  import("./pages/ConversasPage").then((m) => ({ default: m.ConversasPage })),
);
const SupervisaoPage = lazy(() =>
  import("./pages/SupervisaoPage").then((m) => ({ default: m.SupervisaoPage })),
);
const CaixaTecnicaPage = lazy(() =>
  import("./pages/CaixaEquipePage").then((m) => ({
    default: m.CaixaTecnicaPage,
  })),
);
const CaixaFinanceiraPage = lazy(() =>
  import("./pages/CaixaEquipePage").then((m) => ({
    default: m.CaixaFinanceiraPage,
  })),
);
const ComentariosPage = lazy(() =>
  import("./pages/ComentariosPage").then((m) => ({
    default: m.ComentariosPage,
  })),
);
const EscutaPage = lazy(() =>
  import("./pages/EscutaPage").then((m) => ({ default: m.EscutaPage })),
);
const BasePage = lazy(() =>
  import("./pages/BasePage").then((m) => ({ default: m.BasePage })),
);
const ConsumoPage = lazy(() =>
  import("./pages/ConsumoPage").then((m) => ({ default: m.ConsumoPage })),
);
const ConfiguracoesPage = lazy(() =>
  import("./pages/ConfiguracoesPage").then((m) => ({
    default: m.ConfiguracoesPage,
  })),
);
const SemAcessoPage = lazy(() =>
  import("./pages/SemAcessoPage").then((m) => ({ default: m.SemAcessoPage })),
);
const NotFoundPage = lazy(() =>
  import("./pages/NotFoundPage").then((m) => ({ default: m.NotFoundPage })),
);

// Login mora SÓ no master (mesma origem em prod e no dev-proxy). "" = mesma origem.
const MASTER_URL = import.meta.env.VITE_MASTER_URL ?? "";

/**
 * A raiz manda para a primeira tela QUE O PAPEL VÊ. Sem isto o Dev abre `/` e cai
 * numa home vazia, e o Gestor cai num inbox que ele não pode responder.
 */
function RaizDoPapel() {
  const ability = useAbility();
  return <Navigate to={homeDoPapel(ability)} replace />;
}

/**
 * Layout do módulo: resolve a sessão + authz (do master) e monta o shell
 * compartilhado (`@l4-web/ui/shell`). O módulo NÃO recria header/sidebar, só
 * passa a navegação (`NAV`), o usuário e o authz (p/ o seletor de módulos). Gate:
 * anônimo → `/login` do master. As páginas entram pelo `<Outlet/>` do AppShell.
 */
function ModuleLayout() {
  const [state, setState] = useState<{
    ready: boolean;
    user?: ShellUser;
    /** Id de quem está logado. O `ShellUser` não carrega id, e a tela precisa dele
     *  para achar a PRÓPRIA linha numa lista (qual atendente sou eu na fila). */
    meuId?: string;
    ability?: Ability;
    catalog?: CatalogResource[];
  }>({ ready: false });

  useEffect(() => {
    let active = true;
    (async () => {
      const me = await loadMe();
      if (!me) {
        const next = encodeURIComponent(
          window.location.pathname + window.location.search,
        );
        window.location.href = `${MASTER_URL}/login?next=${next}`;
        return;
      }
      const ability = createAbility(me.authz ?? null);
      const catalog = await fetchCatalog(MASTER_URL).catch(
        () => [] as CatalogResource[],
      );
      if (!active) return;
      const meta = me.user.user_metadata;
      setState({
        ready: true,
        ability,
        catalog,
        user: {
          nome: meta?.full_name || meta?.name || me.user.email,
          email: me.user.email,
          avatar_url: meta?.avatar_url ?? undefined,
        },
        meuId: me.user.id,
      });
    })();
    return () => {
      active = false;
    };
  }, []);

  // A navegação depende do papel, então só existe depois do authz resolver. O
  // hook fica ANTES do early return do BootFrame: a ordem dos hooks não pode
  // mudar entre renders.
  const nav = useMemo(() => buildNav(state.ability), [state.ability]);

  if (!state.ready) return <BootFrame />;

  async function onLogout() {
    await authLogout();
    window.location.href = `${MASTER_URL}/login`;
  }

  return (
    <AbilityContext.Provider value={state.ability}>
      <MeuIdContext.Provider value={state.meuId}>
        {/* O produto envolve o shell inteiro: a barra lateral o escolhe e as telas o
            leem, e as duas pontas precisam do mesmo contexto. */}
        <ProdutoProvider>
        <AppShell
          nav={nav}
          user={state.user}
          onLogout={onLogout}
          isSuperAdmin={state.ability?.isSuperAdmin()}
          ability={state.ability}
          catalog={state.catalog}
          /**
           * Praça E produto, nessa ordem, porque são dois recortes encaixados: a
           * praça é o TENANT e o produto é o escopo dentro dela. Trocar de praça pode
           * mudar quais produtos existem, então o de cima manda no de baixo.
           *
           * Os dois moram no shell e não no cabeçalho das telas: escopo de módulo
           * sobrevive à navegação, filtro de tela não.
           */
          sidebarHeader={
            <>
              <SeletorPraca />
              <SeletorProduto />
              {/* Wireframe: deixa claro em toda tela que nada aqui é dado real. */}
              <p className="mx-1 mt-1 rounded-[10px] bg-warn-bg px-2 py-1 text-[10.5px] leading-snug text-warn-text">
                Wireframe · dados fictícios. Integrações simuladas.
              </p>
            </>
          }
        />
        </ProdutoProvider>
      </MeuIdContext.Provider>
    </AbilityContext.Provider>
  );
}

export default function App() {
  return (
    <Routes>
      <Route element={<ModuleLayout />}>
        <Route index element={<RaizDoPapel />} />
        <Route
          path="conversas"
          element={
            <RotaComTela tela="conversas">
              <ConversasPage />
            </RotaComTela>
          }
        />
        <Route
          path="supervisao"
          element={
            <RotaComTela tela="supervisao">
              <SupervisaoPage />
            </RotaComTela>
          }
        />
        <Route
          path="equipes/tecnica"
          element={
            <RotaComTela tela="encaminhamentos-dev">
              <CaixaTecnicaPage />
            </RotaComTela>
          }
        />
        <Route
          path="equipes/financeira"
          element={
            <RotaComTela tela="encaminhamentos-pagamentos">
              <CaixaFinanceiraPage />
            </RotaComTela>
          }
        />
        <Route
          path="comentarios"
          element={
            <RotaComTela tela="social">
              <ComentariosPage />
            </RotaComTela>
          }
        />
        <Route
          path="escuta"
          element={
            <RotaComTela tela="escuta">
              <EscutaPage />
            </RotaComTela>
          }
        />
        <Route
          path="base"
          element={
            /* A base absorveu a aba "Bot" de Configurações e passou a pedir `config`.
               A tela `base` não porteia mais rota nenhuma; ver a nota em `nav.ts`. */
            <RotaComTela tela="config">
              <BasePage />
            </RotaComTela>
          }
        />
        <Route
          path="consumo"
          element={
            <RotaComTela tela="consumo">
              <ConsumoPage />
            </RotaComTela>
          }
        />
        <Route
          path="configuracoes"
          element={
            <RotaComTela tela="config">
              <ConfiguracoesPage />
            </RotaComTela>
          }
        />
        <Route path="sem-acesso" element={<SemAcessoPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
