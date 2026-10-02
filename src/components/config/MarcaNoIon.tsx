import { useEffect, useState } from "react";
import { Button, Eyebrow, Input } from "@l4-web/ui";
import { useConfigurarProdutoDaPracaMutation } from "../../features/atendimento/atendimento.api";

/**
 * Como este produto se chama do lado do iOn.
 *
 * Por que virou tela: a rota da API já existia, com o comentário "Configura o produto
 * da praça: hoje, a marca dele no iOn", e NENHUMA tela a chamava. Trocar a marca
 * exigia abrir o Postgres. Foi assim que o APCAP passou dias consultando o iOn como
 * `hiperxcap`, sobra de um teste com um CPF que só tinha compra lá: toda consulta
 * voltava vazia, e o log dizia "iOn não conhece o CPF consultado em hiperxcap" numa
 * linha que ninguém lia.
 *
 * O campo é livre e não um seletor de propósito: quem manda no vocabulário é o iOn, e
 * uma lista fixa aqui ficaria velha no dia em que eles criarem um produto. O preço é
 * que erro de digitação não é detectável antes da primeira consulta, e por isso o
 * rodapé diz o que acontece quando fica vazio.
 */
export function MarcaNoIon({
  empresaId,
  produtoSlug,
  atual,
}: {
  empresaId: string;
  produtoSlug: string;
  atual: string | null | undefined;
}) {
  const [salvar, { isLoading }] = useConfigurarProdutoDaPracaMutation();
  const [valor, setValor] = useState(atual ?? "");
  const [erro, setErro] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  // A praça é reconsultada depois de salvar (a mutation invalida `Praca`), então o
  // campo precisa acompanhar o que voltou: sem isto ele seguiria mostrando o que foi
  // digitado mesmo se o servidor tivesse normalizado o valor.
  useEffect(() => setValor(atual ?? ""), [atual]);

  const mudou = valor.trim() !== (atual ?? "").trim();

  async function confirmar() {
    setErro(null);
    setOk(false);
    try {
      await salvar({ empresaId, produtoSlug, ion_marca: valor.trim() }).unwrap();
      setOk(true);
    } catch (e) {
      const corpo = (e as { data?: { message?: string | string[] } }).data;
      const msg = Array.isArray(corpo?.message) ? corpo?.message[0] : corpo?.message;
      setErro(msg ?? "Não deu para salvar agora.");
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <Eyebrow>Marca no iOn</Eyebrow>
      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={valor}
          onChange={(e) => {
            setValor(e.target.value);
            setOk(false);
          }}
          placeholder="Vazio: não consulta o iOn"
          className="w-full sm:w-56"
          aria-label={`Marca de ${produtoSlug} no iOn`}
        />
        <Button size="sm" onClick={() => void confirmar()} disabled={!mudou} loading={isLoading}>
          Salvar
        </Button>
        {ok && !mudou && <span className="text-[11px] text-text-secondary">Salvo.</span>}
      </div>
      {/*
        O erro usa a caixa de erro do projeto, e não uma classe de cor solta: `text-danger`
        não existe no Tailwind daqui, e classe inexistente não dá erro de build, só deixa
        de gerar a regra. O aviso sairia cinza, igual ao texto de ajuda.
      */}
      {erro && (
        <p
          role="alert"
          className="mt-1 rounded-[12px] border-[0.5px] border-error-border bg-error-bg px-3 py-2 text-[11.5px] text-error-text"
        >
          {erro}
        </p>
      )}
      <p className="text-[11px] leading-snug text-text-muted">
        O nome deste produto no iOn, que não é o mesmo slug daqui (aqui{" "}
        <span className="font-mono">{produtoSlug}</span>, lá pode ser outro). Em branco, o
        atendente abre a conversa sem histórico de compra, e o bot segue funcionando.
      </p>
    </div>
  );
}
