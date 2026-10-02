import { defineConfig } from "vite";
import type { Plugin, ProxyOptions } from "vite";
import react from "@vitejs/plugin-react";

// `base` = prefixo do módulo no roteamento por path do L4 OS (ex.: "/atendeai/").
// É decisão de BUILD-TIME (entra embutido no index.html e nas URLs dos assets),
// então vem da env VITE_BASE_PATH, setada pelo Dockerfile via `--build-arg BASE_PATH`.
// O DEFAULT é `/atendeai/`, igual ao iadm: em dev o master (:3000) proxia
// `/atendeai/*` para cá, e com base `/` os assets do dev server (`/@vite/client`,
// `/src/main.tsx`) seriam pedidos na raiz do master, que não os tem.
//
// Para criar um módulo novo: defina BASE_PATH ao buildar (ex.: BASE_PATH=/cria/),
// igual ao path que a infra aponta no LB. Ver README (passo 1).
// Protótipo (Mestre do Bolão): roda sozinho na raiz, sem o master na frente.
const base = process.env.VITE_BASE_PATH ?? "/";

// Porta dev do módulo. O master (l4os-auth) roda em 5174 e proxia os módulos;
// cada módulo usa uma porta distinta (reporta 5175, iadm 5176/5177, hub 5178…).
// Escolha uma porta livre ao batizar o módulo.
const PORT = 4323;

/**
 * Para onde o proxy de dev aponta, e a sessão que ele encosta. As duas variáveis
 * são do AMBIENTE de quem roda (não têm prefixo `VITE_`, então nunca chegam ao
 * bundle nem ao navegador):
 *
 *   ALVO_API=https://apihml.l4os.com.br QA_SESSION=<jwt> pnpm dev
 */
const ALVO = process.env.ALVO_API ?? "";
const SESSAO = process.env.QA_SESSION ?? "";

const encostarSessao: ProxyOptions["configure"] = (proxy) => {
  if (!SESSAO) return;
  proxy.on("proxyReq", (req) => {
    req.setHeader("Cookie", `l4os_session=${SESSAO}`);
  });
};

/**
 * Bancada de QA: em dev, o `/api/auth/me` responde o authz DO TOKEN.
 *
 * Em produção o master deriva o authz do banco e o entrega nos dois lugares, na
 * claim do token e no corpo do `/me`. Em QA a sessão é montada à mão para
 * exercitar um perfil (supervisor, atendente, gestor, DPO...), e aí os dois lados
 * discordam: a API decide pela claim, e o front, que lê o `/me`, mostra "sem tela
 * liberada". A tela ficava impossível de validar por perfil.
 *
 * Este middleware reencosta os dois: repassa o `/me` de verdade (usuário, e-mail,
 * avatar vêm do servidor) e troca só o `authz` pelo da claim `l4` da sessão de QA.
 * É a MESMA fonte que a API usa para decidir, então o que a tela mostra passa a
 * ser o que o backend concede, e não uma terceira versão da verdade.
 *
 * Vale só no `pnpm dev` e só quando existe `QA_SESSION`. Não vai para o build.
 */
function bancadaDeQa(): Plugin {
  return {
    name: "atendeai-bancada-de-qa",
    apply: "serve",
    configureServer(server) {
      if (!ALVO || !SESSAO) return;
      server.middlewares.use("/api/auth/me", (_req, res, next) => {
        void (async () => {
          try {
            const sessao = JSON.parse(
              Buffer.from(SESSAO.split(".")[1] ?? "", "base64url").toString("utf8"),
            ) as {
              l4?: unknown;
              sub?: string;
              email?: string;
              user_metadata?: { name?: string; full_name?: string; avatar_url?: string | null };
            };

            const upstream = await fetch(`${ALVO}/api/auth/me`, {
              headers: { cookie: `l4os_session=${SESSAO}` },
            });

            /**
             * Upstream recusando NÃO derruba a bancada.
             *
             * Antes isto caía em `next()`, e o efeito era a bancada não servir para o
             * que ela existe: uma sessão montada à mão tem `sub` que não é usuário
             * real, o `/me` do master devolve 401, e a tela ia direto para o login. Ou
             * seja, dava para validar QA só com a sessão de alguém que já existe, que
             * é justamente o caso em que não se precisa de bancada.
             *
             * Quando o upstream responde, o perfil real dele é usado (nome e avatar de
             * verdade); quando não, o perfil vem do próprio token. O `authz` sai da
             * claim nos dois casos, porque é a MESMA fonte que a API usa para decidir.
             */
            const corpo = upstream.ok
              ? ((await upstream.json()) as Record<string, unknown>)
              : {
                  // O formato é o do `MeResponse`: `user` por fora, e não os campos
                  // do usuário na raiz. O front lê `me.user.user_metadata`, então raiz
                  // achatada quebra na primeira linha, sem dizer o que faltou.
                  user: {
                    id: sessao.sub,
                    email: sessao.email,
                    user_metadata: {
                      name: sessao.user_metadata?.name ?? sessao.email ?? "QA",
                      full_name: sessao.user_metadata?.full_name ?? sessao.user_metadata?.name ?? "QA",
                      avatar_url: sessao.user_metadata?.avatar_url ?? null,
                    },
                    app_metadata: { provider: "bancada" },
                  },
                };

            res.setHeader("content-type", "application/json");
            res.end(JSON.stringify({ ...corpo, authz: sessao.l4 ?? corpo.authz }));
          } catch {
            next();
          }
        })();
      });
    },
  };
}

export default defineConfig({
  base,
  plugins: [react(), bancadaDeQa()],
  build: {
    rollupOptions: {
      output: {
        // Vendor chunks estáveis: o framework e o store ficam fora do bundle das
        // páginas (que já são lazy), melhorando o cache entre deploys.
        manualChunks: {
          react: ["react", "react-dom", "react-router-dom"],
          store: ["@reduxjs/toolkit", "react-redux"],
        },
      },
    },
  },
  server: {
    port: PORT,
    // strictPort: falha em vez de pular de porta, o master proxia uma porta fixa.
    strictPort: true,
    hmr: { clientPort: PORT },
    /**
     * Proxy de DESENVOLVIMENTO para as telas rodarem contra o HML de verdade.
     *
     * Sem isto o front local não tinha como carregar dado nenhum: o `/api/auth/me` e
     * o `/atendeai-api/v1` são resolvidos na MESMA ORIGEM (é assim em produção,
     * atrás do roteamento por path do L4 OS), e em `localhost` isso bate no próprio
     * dev server e dá 404. Apontar o `VITE_API_URL` direto para o HML também não
     * resolve, porque o cookie de sessão é `httpOnly` do domínio `.l4os.com.br` e o
     * navegador não o manda para outra origem.
     *
     * O proxy encosta o `Cookie` do lado do SERVIDOR, fora do alcance do JS da
     * página, e a sessão vem de `QA_SESSION` no ambiente de quem roda: nada de
     * sessão entra no repositório, e sem a variável o proxy só repassa a request
     * sem credencial (a tela mostra o estado de anônimo, que também é caso de
     * teste). Vale só no `pnpm dev`; o build de produção não tem proxy nenhum.
     */
    proxy: ALVO
      ? {
          /**
           * `/api` inteiro, e não só `/api/auth`.
           *
           * O shell do DS também chama `/api/authz/catalog`, `/api/theme` e
           * `/api/notificacoes`. Sem eles no proxy, o catálogo voltava 401, o shell
           * ficava esperando para sempre e a tela morria no spinner: a bancada parecia
           * quebrada quando o que faltava era rota proxiada.
           */
          "/api": { target: ALVO, changeOrigin: true, configure: encostarSessao },
          "/atendeai-api": { target: ALVO, changeOrigin: true, configure: encostarSessao },
        }
      : undefined,
  },
  preview: { port: PORT },
  // Só `VITE_*` é exposto ao client (nada de segredo de runtime num SPA estático).
  envPrefix: ["VITE_"],
});
