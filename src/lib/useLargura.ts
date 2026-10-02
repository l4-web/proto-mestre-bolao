import { useEffect, useState } from "react";

/**
 * `true` quando a viewport tem pelo menos `px` de largura.
 *
 * Existe porque o par `hidden lg:block` NÃO funciona neste app: por decisão de
 * ordem de CSS, o `styles.css` do `@l4-web/ui` é importado DEPOIS do Tailwind
 * local (para a lib vencer empates de utility), e o `.hidden` da lib passa a
 * ganhar do `lg:block` do app. O elemento fica invisível em qualquer largura.
 *
 * Resolver por `matchMedia` sai da briga de cascata e deixa a condição explícita
 * em JS, onde dá para ler.
 */
export function useLarguraMinima(px: number): boolean {
  const [cabe, setCabe] = useState(
    () => typeof window !== "undefined" && window.matchMedia(`(min-width: ${px}px)`).matches,
  );

  useEffect(() => {
    const mq = window.matchMedia(`(min-width: ${px}px)`);
    const onChange = () => setCabe(mq.matches);
    onChange();
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [px]);

  return cabe;
}

/**
 * Largura em pixels do elemento observado, e não da viewport.
 *
 * A viewport mente para quem vive dentro do shell: a sidebar come uns 300px, então
 * uma janela de 1037px deixa pouco mais de 700px de conteúdo. Decidir a grade por
 * `min-width: 1024px` fazia a terceira coluna abrir com espaço que não existe, e o
 * `minmax(0,1fr)` do meio pagava a conta: a THREAD, que é a coluna que importa,
 * ficava com 129px e cada bolha virava uma palavra por linha, enquanto o painel de
 * contexto ficava com 292px.
 *
 * Medir o container resolve na origem, e de graça sai a outra briga: as classes de
 * breakpoint do Tailwind perdem para o `styles.css` do DS na cascata, e por isso o
 * `useLarguraMinima` já existia. Com a medida em JS a grade vai por `style`, onde
 * não há empate para perder.
 */
export function useLarguraDoElemento<T extends HTMLElement>(): [
  (no: T | null) => void,
  number,
] {
  const [no, setNo] = useState<T | null>(null);
  const [largura, setLargura] = useState(0);

  useEffect(() => {
    if (!no) return;
    const ro = new ResizeObserver(([entrada]) => {
      // `borderBoxSize` e não `getBoundingClientRect`: o rect inclui transform de
      // animação, e a grade piscaria durante qualquer transição do shell.
      const l = entrada?.borderBoxSize?.[0]?.inlineSize ?? no.clientWidth;
      setLargura(Math.round(l));
    });
    ro.observe(no);
    return () => ro.disconnect();
  }, [no]);

  return [setNo, largura];
}
