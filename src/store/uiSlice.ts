import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

/**
 * Exemplo de slice "clássico" do Redux (estado de UI), pra mostrar o padrão ao
 * lado do RTK Query. Estado de servidor → use RTK Query (api.ts); estado de UI
 * (toggles, seleção, filtros locais) → slices como este.
 */
type UiState = {
  sidebarOpen: boolean;
};

const initialState: UiState = {
  sidebarOpen: true,
};

const uiSlice = createSlice({
  name: "ui",
  initialState,
  reducers: {
    toggleSidebar(state) {
      state.sidebarOpen = !state.sidebarOpen;
    },
    setSidebar(state, action: PayloadAction<boolean>) {
      state.sidebarOpen = action.payload;
    },
  },
});

export const { toggleSidebar, setSidebar } = uiSlice.actions;
export const uiReducer = uiSlice.reducer;
