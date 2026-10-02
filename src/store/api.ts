import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";

/**
 * API slice base (RTK Query). Toda chamada de DADOS do módulo passa por aqui.
 *
 * `credentials: "include"` manda o cookie httpOnly de sessão em toda request. O
 * front não guarda token, e quem é o usuário vem do master
 * (`src/lib/auth-client.ts`), não daqui.
 *
 * Os endpoints reais são injetados por feature, em `src/features/*.api.ts`, para
 * este arquivo continuar sendo só a configuração.
 */
const baseQuery = fetchBaseQuery({
  baseUrl: import.meta.env.VITE_API_URL ?? "/",
  credentials: "include",
});

export const api = createApi({
  reducerPath: "api",
  baseQuery,
  // Tags para invalidação: encerrar um atendimento muda a lista de conversas e o
  // painel do supervisor ao mesmo tempo, e sem tag isso vira refetch na mão.
  // `TokenCanal` é separada de `Praca` porque a consulta que ela marca é CARA (uma ida
  // ao Secret Manager) e sob demanda: pendurá-la em `Praca` faria toda edição de
  // rótulo de canal reconsultar o cofre de um canal que ninguém abriu.
  // `Comentario` é etiqueta própria e não `Conversa`: responder um comentário não
  // pode rebuscar a caixa de entrada inteira, e virar caso precisa invalidar as duas.
  tagTypes: ["Praca", "Conversa", "Atendimento", "Fila", "Motivo", "TokenCanal", "Comentario"],
  endpoints: () => ({}),
});
