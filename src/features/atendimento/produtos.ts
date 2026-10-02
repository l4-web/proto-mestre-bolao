import type {
  Atendente,
  ConversaItem,
  Praca,
  ProdutoDaConversa,
} from "./tipos";

/**
 * As regras de PRODUTO do módulo, num lugar só.
 *
 * "De qual produto é isto" atravessa três telas com consequências diferentes (o
 * número no cadastro do canal, a habilidade do atendente, o rótulo na conversa), e
 * as três leituras precisam concordar. A mais fácil de escrever errado é o vazio: no
 * canal, produto nulo é impedimento; no atendente, lista vazia é permissão total. As
 * duas moram aqui justamente para nenhuma tela decidir isso por conta.
 */

export interface ProdutoAtivo {
  slug: string;
  /** Rótulo da API quando existe, senão o slug cru. A tela não inventa rótulo. */
  rotulo: string;
}

/** Os produtos ATIVOS da praça: são os únicos slugs válidos em canal e habilidade. */
export function produtosAtivos(praca: Praca | undefined): ProdutoAtivo[] {
  return (praca?.produtos ?? [])
    .filter((p) => p.ativo)
    .map((p) => ({ slug: p.produto_slug, rotulo: p.rotulo || p.produto_slug }));
}

/**
 * Rótulo de um slug, olhando a lista de ativos.
 *
 * Cai no próprio slug quando a praça não conhece o produto (produto desativado depois
 * de o canal ter sido apontado para ele, por exemplo). Mostrar o slug cru é honesto;
 * traduzir por conta seria a segunda versão da verdade.
 */
export function rotuloDoProduto(slug: string, ativos: ProdutoAtivo[]): string {
  return ativos.find((p) => p.slug === slug)?.rotulo ?? slug;
}

/**
 * O produto de uma conversa, para exibição.
 *
 * Prefere o objeto com rótulo que a API passou a mandar e cai no `produto_slug`, que
 * sempre existiu, enquanto a API não alcança. Nos dois caminhos o texto exibido vem
 * do servidor.
 */
export function produtoDaConversa(
  conversa: Pick<ConversaItem, "produto" | "produto_slug">,
): ProdutoDaConversa | null {
  if (conversa.produto) return conversa.produto;
  if (conversa.produto_slug)
    return { slug: conversa.produto_slug, rotulo: conversa.produto_slug };
  return null;
}

/** As habilidades declaradas. `undefined` e `[]` são a mesma coisa: nenhuma. */
export function habilidades(atendente: Atendente): string[] {
  return atendente.produtos ?? [];
}

/** Ninguém declarado = atende TUDO. É fail-open na API, ver `Atendente.produtos`. */
export function atendeTudo(atendente: Atendente): boolean {
  return habilidades(atendente).length === 0;
}

/** Esta pessoa recebe conversa deste produto? */
export function atende(atendente: Atendente, slug: string): boolean {
  return atendeTudo(atendente) || habilidades(atendente).includes(slug);
}

/**
 * Quem cobre cada produto, separando os dois motivos de cobertura.
 *
 * `declarados` são os que pediram aquele produto; `curinga` são os que atendem tudo
 * por não terem habilidade nenhuma declarada. A separação existe porque as duas
 * coberturas têm durabilidade diferente: o curinga deixa de cobrir o produto no
 * instante em que alguém marcar a primeira caixa na ficha dele.
 */
export function coberturaDoProduto(
  slug: string,
  atendentes: Atendente[],
): { declarados: Atendente[]; curinga: Atendente[] } {
  return {
    declarados: atendentes.filter((a) => habilidades(a).includes(slug)),
    curinga: atendentes.filter(atendeTudo),
  };
}

/**
 * Os produtos ativos que NÃO TÊM NINGUÉM, nem declarado nem curinga.
 *
 * A conversa desses produtos fica sem distribuição, e é o único estado desta tela que
 * merece alarme.
 *
 * A condição é mais estreita que "nenhum declarado": com alguém atendendo tudo, o
 * produto está coberto de verdade, e alarme que aponta problema onde não há é o jeito
 * mais rápido de ensinar a ignorar o alarme. Ela também nunca dispara na praça que
 * ninguém configurou (todo mundo em branco é todo mundo curinga), que é o estado do
 * primeiro dia depois da migration.
 */
export function produtosSemDistribuicao(
  ativos: ProdutoAtivo[],
  atendentes: Atendente[],
): ProdutoAtivo[] {
  if (atendentes.length === 0) return [];
  return ativos.filter((p) => !atendentes.some((a) => atende(a, p.slug)));
}

/**
 * Os canais que a API vai recusar por falta de produto.
 *
 * Com um produto ativo só não há ambiguidade e o canal em branco segue atendendo; com
 * dois ou mais, canal sem produto não atende. Por isso a regra depende da praça e não
 * do canal isolado.
 */
export function canaisSemProduto(praca: Praca): Praca["canais"] {
  if (produtosAtivos(praca).length < 2) return [];
  return praca.canais.filter((c) => !c.produto_slug);
}

// ══════════════════════════════════════════════════════════════════════════════
// A CORRENTE: NÚMERO → PRODUTO → QUEM ATENDE
// ══════════════════════════════════════════════════════════════════════════════
//
// A pergunta do cliente foi "quem atende o quê", e a resposta tem três elos, não dois.
// O número decide o produto da conversa; o produto decide quem pode recebê-la. Cada
// tela via um elo só: Canais mostrava número e produto, Alocação mostrava produto e
// pessoa, e ninguém via a corrente inteira. O estado que isso escondia é o pior de
// todos: número ATIVO apontando para um produto que nenhuma pessoa atende, ou seja
// conversa entrando e ficando parada, sem erro em lugar nenhum.
//
// ⚠️ E não existe um terceiro elo de FILA. `atd_fila` tem uma linha por praça
// (`cx-geral`, criada pelo provisionamento) e nada na tela a edita: o atendente cai
// nela sozinho ao entrar em turno. A distribuição casa fila E produto, mas com uma
// fila só quem decide de verdade é o produto. As caixas do dev e do financeiro NÃO são
// fila: são `atd_encaminhamento` com acesso por papel de authz.

/** O canal está de pé? Só `ativo` entrega; os outros três estados não. */
function canalNoAr(canal: Praca["canais"][number]): boolean {
  return canal.status === "ativo";
}

/**
 * Os números apontados para este produto.
 *
 * Inclui os canais SEM produto quando a praça tem um produto ativo só, porque é
 * exatamente o que a API faz nesse caso (cai no produto da praça). Com dois ou mais,
 * canal sem produto não atende ninguém e não conta para produto nenhum: ver
 * `canaisSemProduto`.
 */
export function canaisDoProduto(praca: Praca, slug: string): Praca["canais"] {
  const soUmProduto = produtosAtivos(praca).length === 1;
  return praca.canais.filter(
    (c) => c.produto_slug === slug || (soUmProduto && !c.produto_slug),
  );
}

/**
 * Os números que chegam NESTA PESSOA hoje.
 *
 * É a corrente lida do fim para o começo, e é o que faz a habilidade deixar de ser
 * abstrata: marcar "HiperXCAP" na ficha de alguém não diz nada até a tela responder
 * "então o número Apcap da Sorte Gold para de cair em você".
 *
 * Quem não declarou habilidade nenhuma recebe TUDO (fail-open), então recebe todos os
 * números da praça. É a leitura que mais surpreende quem configura, e por isso ela
 * precisa aparecer com os números na tela e não só como uma frase.
 */
export function numerosQueChegamEm(
  atendente: Atendente,
  praca: Praca,
): Praca["canais"] {
  if (atendeTudo(atendente)) return praca.canais;
  const meus = new Set(habilidades(atendente));
  return praca.canais.filter((c) =>
    [...meus].some((slug) => canaisDoProduto(praca, slug).includes(c)),
  );
}

/** Quantas pessoas recebem conversa deste produto hoje, contando quem atende tudo. */
export function quemAtendeOProduto(slug: string, atendentes: Atendente[]): Atendente[] {
  return atendentes.filter((a) => atende(a, slug));
}

/**
 * O ESTADO QUE PRECISA GRITAR: produto com número NO AR e ninguém para atender.
 *
 * Mais estreito que `produtosSemDistribuicao` de propósito. Produto sem ninguém e sem
 * número é configuração pela metade, e configuração pela metade é normal no meio de um
 * cadastro; produto sem ninguém E com número ativo é cliente mandando mensagem agora
 * para uma fila que ninguém vai pegar. São urgências diferentes, e tratá-las com o
 * mesmo alarme ensina a ignorar o alarme.
 */
export function produtosComNumeroESemNinguem(
  praca: Praca,
  atendentes: Atendente[],
): { produto: ProdutoAtivo; canais: Praca["canais"] }[] {
  // Sem ninguém na praça inteira não há o que alarmar: é praça que ainda não tem
  // equipe, e o aviso certo para ela é o "nenhum atendente", que a tela já dá.
  if (atendentes.length === 0) return [];
  return produtosSemDistribuicao(produtosAtivos(praca), atendentes)
    .map((produto) => ({ produto, canais: canaisDoProduto(praca, produto.slug).filter(canalNoAr) }))
    .filter((x) => x.canais.length > 0);
}
