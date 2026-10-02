import { useState } from "react";
import { Input } from "@l4-web/ui";

/**
 * Lista de termos que se edita item a item, com o item saindo por um toque.
 *
 * Existe porque a alternativa natural (um `Textarea` com um por linha) esconde erro:
 * espaço sobrando, linha vazia e vírgula deixada no fim viram termo que nunca casa, e
 * numa régua de compliance isso significa uma palavra que devia bloquear e não bloqueia.
 * Aqui cada termo é uma coisa visível, e o que entra sai limpo.
 *
 * O salvamento é do formulário de fora, e não a cada tecla: régua é conjunto, e quem
 * edita precisa ver a lista completa antes de confirmar. Salvar por termo faria a régua
 * ficar parcialmente aplicada durante a edição.
 */
export function ListaEditavel({
  valores,
  onChange,
  placeholder,
  tom = "neutro",
  desabilitado,
}: {
  valores: string[];
  onChange: (v: string[]) => void;
  placeholder: string;
  /** `bloqueio` pinta os termos de vermelho: é o que impede o envio. */
  tom?: "neutro" | "bloqueio" | "aviso";
  desabilitado?: boolean;
}) {
  const [novo, setNovo] = useState("");

  const cor =
    tom === "bloqueio"
      ? "bg-error-bg text-error-text"
      : tom === "aviso"
        ? "bg-warn-bg text-warn-text"
        : "bg-[var(--l4-fill-4)] text-text-strong";

  function adicionar() {
    const v = novo.trim();
    if (!v) return;
    // Dedupe aqui e não só no servidor: ver o termo duplicado aparecer na lista e
    // depois sumir no salvamento é o tipo de coisa que faz a pessoa duvidar da tela.
    if (!valores.includes(v)) onChange([...valores, v]);
    setNovo("");
  }

  return (
    <div className="flex flex-col gap-1.5">
      {valores.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {valores.map((t) => (
            <button
              key={t}
              type="button"
              disabled={desabilitado}
              title="Remover"
              onClick={() => onChange(valores.filter((x) => x !== t))}
              className={`l4-pressable rounded-full px-2 py-0.5 text-[11px] disabled:opacity-40 ${cor}`}
            >
              {t} ×
            </button>
          ))}
        </div>
      )}
      <Input
        value={novo}
        placeholder={placeholder}
        disabled={desabilitado}
        onChange={(e) => {
          const v = e.currentTarget.value;
          setNovo(v);
        }}
        onKeyDown={(e) => {
          if (e.key !== "Enter") return;
          e.preventDefault();
          adicionar();
        }}
        onBlur={adicionar}
      />
    </div>
  );
}
