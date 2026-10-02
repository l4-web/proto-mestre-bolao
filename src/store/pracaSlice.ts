import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

/**
 * Qual praça está selecionada no módulo.
 *
 * Antes disto o front pegava `pracas[0]` em cinco lugares diferentes (conversas,
 * supervisão, base, configurações), e o desenho é multi-tenant: uma praça por
 * empresa. Com duas praças no escopo, a tela mostrava o dado da primeira e a
 * escrita ia para o `empresa_id` da primeira, sem avisar ninguém. Errar em
 * silêncio na tela de configuração é pior que dar erro: dá para trocar o horário
 * de funcionamento da praça errada e ver "Salvo".
 *
 * Mora no store e não no estado de uma página porque a escolha precisa sobreviver
 * à navegação entre abas: quem escolhe a praça em Conversas e vai para Consumo
 * está olhando a mesma operação.
 */

/** Chave do último escolhido. Recarregar a página não é trocar de praça. */
const CHAVE = "atendeai.praca-selecionada";

/**
 * Ler o `localStorage` na inicialização pode LANÇAR (janela anônima com dado de
 * site bloqueado), e um throw aqui derruba o store inteiro antes da primeira
 * pintura. Sem valor guardado a escolha cai na primeira praça, que é o
 * comportamento de hoje.
 */
function lerEscolha(): string | null {
  try {
    return window.localStorage.getItem(CHAVE);
  } catch {
    return null;
  }
}

function gravarEscolha(empresaId: string) {
  try {
    window.localStorage.setItem(CHAVE, empresaId);
  } catch {
    /* Sem persistência a escolha vale só para esta sessão, e isso basta. */
  }
}

type PracaState = {
  /** `empresa_id` da praça escolhida. Nulo = ninguém escolheu ainda. */
  escolhida: string | null;
};

const initialState: PracaState = { escolhida: lerEscolha() };

const pracaSlice = createSlice({
  name: "praca",
  initialState,
  reducers: {
    // A gravação fica no reducer, e não em quem despacha, porque este é o único
    // ponto que sabe que o valor mudou: espalhar o `setItem` pelos componentes
    // garante que o segundo lugar a trocar de praça esqueça de persistir.
    escolherPraca(state, action: PayloadAction<string>) {
      state.escolhida = action.payload;
      gravarEscolha(action.payload);
    },
  },
});

export const { escolherPraca } = pracaSlice.actions;
export const pracaReducer = pracaSlice.reducer;
