import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { Provider } from "react-redux";
import { applyGlassMode, ConfirmProvider, TenantThemeProvider, Toaster } from "@l4-web/ui";
import App from "./App.tsx";
import { store } from "./store/store.ts";
import { instalarMock } from "./mock/servidor.ts";

// Ordem de CSS IMPORTANTE: o Tailwind do app (index.css) ANTES do styles.css do
// DS: assim a lib vence empates de utility. Ver tailwind.config.ts.
import "./index.css";
import "@l4-web/ui/styles.css";

// Liquid glass: os cards do DS ficam translúcidos (vidro) sobre o fundo do app
// (GlassBackground no AppShell). Tiles aninhados usam <Card variant="solid">.
applyGlassMode(true);

// `BASE_URL` = o `base` do Vite (ex.: "/atendeai/"). O Router opera sob esse
// prefixo, para casar com o roteamento por path do L4 OS (LB aponta /atendeai/* aqui).
const basename = import.meta.env.BASE_URL;

// Módulo deste front = 1º segmento do base do Vite ("/atendeai/" → "atendeai"),
// igual ao id em `core.modules`. Passar isso ao provider é o que faz o backend
// mesclar o override de `core.module_temas` por cima da skin do tenant
// (cascata módulo → tenant → global). Sem ele o tema do MÓDULO nunca é pedido.
const themeModuleId = import.meta.env.BASE_URL.split("/").filter(Boolean)[0];

// Protótipo: sem backend e sem login. O servidor falso entra ANTES da primeira
// pintura, para nenhuma chamada escapar para a rede.
instalarMock();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {/* Tenant theming (white-label) do DS: resolve por hostname (mesmo do master)
        e aplica a skin do tenant. O módulo herda a cara do master. */}
    <TenantThemeProvider moduleId={themeModuleId}>
      <Provider store={store}>
        {/* Confirmação vem do DS (`useConfirm`), e não do `window.confirm`: é o que
            os freios de mão da praça usam antes de desligar bot, envio ou IA. O
            diálogo nativo não aceita o texto que explica O QUE para de funcionar, e
            é exatamente esse texto que separa "desliguei sabendo" de "desliguei
            achando que era outra coisa". */}
        <ConfirmProvider>
          <Toaster>
            <BrowserRouter basename={basename}>
              <App />
            </BrowserRouter>
          </Toaster>
        </ConfirmProvider>
      </Provider>
    </TenantThemeProvider>
  </StrictMode>,
);
