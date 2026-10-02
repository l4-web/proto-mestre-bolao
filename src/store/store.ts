import { configureStore } from "@reduxjs/toolkit";
import { setupListeners } from "@reduxjs/toolkit/query";
import { api } from "./api";
import { uiReducer } from "./uiSlice";
import { pracaReducer } from "./pracaSlice";

export const store = configureStore({
  reducer: {
    [api.reducerPath]: api.reducer,
    ui: uiReducer,
    praca: pracaReducer,
  },
  // O middleware do RTK Query habilita caching, invalidação e polling.
  middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(api.middleware),
});

// Habilita refetchOnFocus / refetchOnReconnect do RTK Query.
setupListeners(store.dispatch);

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
