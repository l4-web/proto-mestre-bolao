import { useLarguraDoElemento } from "./useLargura";

/**
 * Altura das colunas de trabalho. Fixa e independente do conteúdo: com `max-h` numa
 * grade compartilhada, a coluna do meio esticava até a altura da lista. O scroll é
 * SEMPRE interno a cada coluna.
 *
 * Os 268px descontados são o cabeçalho da página mais a barra de filtros mais o
 * respiro do shell. Medido, não estimado.
 */
export const ALTURA_COLUNA = "clamp(360px, calc(100svh - 268px), 780px)";

/**
 * A GEOMETRIA DAS TELAS DE TRABALHO: lista, item aberto e contexto.
 *
 * Ela nasceu na tela de Conversas e a caixa das equipes precisa da MESMA, o que é o
 * pedido do usuário com essas palavras: "precisa ter o mesmo padrão de layout do
 * atendimento". O que vive aqui são só os números e as decisões que os dois usam, e é
 * de propósito que não seja um componente: o miolo das duas telas não tem nada em
 * comum (uma tem thread de WhatsApp e composer, a outra tem coleta e notas), então um
 * componente compartilhado seria um invólucro com três render props, que é mais difícil
 * de ler do que as duas telas separadas.
 *
 * O que NÃO pode divergir são estes números. Duas cópias de `clamp(...)` e de
 * `minmax(230px,258px)` ficam diferentes na primeira correção, e o sintoma é uma tela
 * abrir a terceira coluna e a outra não, na mesma janela.
 *
 * ── POR QUE MEDIR O ELEMENTO, E NÃO A VIEWPORT ────────────────────────────
 * A viewport mente para quem vive dentro do shell: a barra lateral come uns 300px, e
 * decidir por `min-width` fazia a terceira coluna abrir com espaço que não existia. A
 * coluna do meio pagava a conta e ficava com 129px.
 */
export function useGradeDeTrabalho(opcoes: {
  /** Há item aberto. No celular é ele que decide se a tela mostra lista ou item. */
  temSelecao: boolean;
  /** Há o que pôr na terceira coluna. Sem isso ela não abre, mesmo cabendo. */
  temContexto: boolean;
}) {
  const [ref, largura] = useLarguraDoElemento<HTMLDivElement>();
  const cabeContexto = largura >= 900;
  const cabeMeio = largura >= 620;

  /**
   * UMA TELA POR VEZ no celular, como todo aplicativo de mensagem.
   *
   * Com as duas colunas empilhadas, a pessoa rolava um documento longo para achar o
   * item que acabou de abrir. O par disto é o botão de voltar no cabeçalho do item:
   * sem ele a lista fica inalcançável, porque o gesto de voltar do navegador sai do
   * módulo inteiro.
   */
  const umaColunaSo = !cabeMeio;

  return {
    /** Vai no `ref` da grade: é o elemento medido. */
    ref,
    largura,
    umaColunaSo,
    /**
     * Só a largura, sem perguntar se há item aberto.
     *
     * `mostrarContexto` exige seleção EXPLÍCITA, e há tela em que o item aberto no
     * desktop é o primeiro da lista sem ninguém ter clicado. Ali a terceira coluna
     * precisa desta pergunta separada, senão ela só aparece depois do primeiro clique,
     * e a tela nasce com um buraco do tamanho de uma coluna.
     */
    cabeContexto,
    mostrarLista: !umaColunaSo || !opcoes.temSelecao,
    mostrarItem: !umaColunaSo || opcoes.temSelecao,
    mostrarContexto: opcoes.temSelecao && opcoes.temContexto && cabeContexto,
    /**
     * A lista tem largura FIXA porque é régua de leitura: coluna de fila que estica
     * vira linha longa e o olho perde o começo do nome. Quem ganha o espaço que sobra
     * é o item aberto.
     */
    colunas: umaColunaSo
      ? "minmax(0,1fr)"
      : opcoes.temContexto && cabeContexto
        ? "minmax(230px,258px) minmax(380px,1fr) minmax(240px,292px)"
        : "minmax(236px,264px) minmax(0,1fr)",
  };
}
