import type { Bolao } from "./tipos";
import { brl } from "./formato";

/**
 * Artes geradas em SVG, no lugar do que o Cria Aí devolveria.
 *
 * Vira data URL para entrar na thread como imagem de verdade: a bolha do Atende Aí
 * só sabe mostrar anexo, e é assim que a arte chega ao cliente no WhatsApp.
 */

function esc(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function dataUrl(svg: string) {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export type ModeloArte = "padrao" | "especial";

export function linkRastreado(bolao: Bolao, codigo: string) {
  return `mestredobolao.com.br/b/${bolao.id}?v=${codigo}`;
}

export function arteBolao(bolao: Bolao, modelo: ModeloArte, codigo: string): string {
  const fundo =
    modelo === "especial"
      ? `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${bolao.cor}"/><stop offset="1" stop-color="#111"/></linearGradient></defs><rect width="600" height="760" rx="36" fill="url(#g)"/>`
      : `<rect width="600" height="760" rx="36" fill="${bolao.cor}"/>`;
  const selo =
    modelo === "especial" && bolao.selo
      ? `<rect x="40" y="150" rx="16" width="${bolao.selo.length * 15 + 40}" height="40" fill="#FFD84D"/><text x="60" y="178" font-size="22" font-weight="700" fill="#3a2a00">${esc(bolao.selo)}</text>`
      : "";
  const linhas = [
    ["Jogos", `${bolao.jogos} jogos × ${bolao.dezenas} dezenas`],
    ["Cotas livres", `${bolao.cotasLivres} de ${bolao.cotasTotal}`],
    ["Valor da cota", brl(bolao.precoCota)],
    ["Lotérica", bolao.loterica],
  ]
    .map(
      ([k, v], i) =>
        `<text x="70" y="${470 + i * 44}" font-size="22" fill="#555">${esc(k)}</text><text x="530" y="${470 + i * 44}" font-size="22" font-weight="700" fill="#111" text-anchor="end">${esc(v)}</text>`,
    )
    .join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="760" viewBox="0 0 600 760" font-family="Inter, -apple-system, Helvetica, Arial, sans-serif">
${fundo}
<text x="40" y="92" font-size="52" font-weight="800" fill="#fff">${esc(bolao.modalidade)}</text>
<text x="40" y="132" font-size="22" fill="#fff" opacity=".9">Concurso ${bolao.concurso} · ${esc(bolao.sorteio)}</text>
${selo}
<text x="40" y="250" font-size="18" fill="#fff" opacity=".85" letter-spacing="2">PRÊMIO ESTIMADO</text>
<text x="40" y="310" font-size="56" font-weight="800" fill="#fff">${esc(bolao.premioEstimado)}</text>
<rect x="40" y="420" width="520" height="200" rx="22" fill="#fff"/>
${linhas}
<rect x="40" y="640" width="520" height="64" rx="18" fill="#fff"/>
<text x="300" y="682" font-size="26" font-weight="800" fill="${bolao.cor}" text-anchor="middle">Quero minha cota</text>
<text x="300" y="736" font-size="15" fill="#fff" opacity=".85" text-anchor="middle">${esc(linkRastreado(bolao, codigo))} · Proibido para menores de 18 anos</text>
</svg>`;
  return dataUrl(svg);
}

/** O canhoto com o nome do comprador, que o módulo do bolão manda depois do Pix. */
export function arteCanhoto(bolao: Bolao, nome: string, cotas: number): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="380" viewBox="0 0 600 380" font-family="Inter, -apple-system, Helvetica, Arial, sans-serif">
<rect width="600" height="380" rx="20" fill="#FFFDF5" stroke="#d9cfa8" stroke-width="2"/>
<rect width="600" height="64" rx="20" fill="${bolao.cor}"/><rect y="40" width="600" height="24" fill="${bolao.cor}"/>
<text x="28" y="42" font-size="24" font-weight="800" fill="#fff">${esc(bolao.modalidade)} · Concurso ${bolao.concurso}</text>
<text x="28" y="110" font-size="16" fill="#777">COMPROVANTE DE COTA DE BOLÃO</text>
<text x="28" y="150" font-size="26" font-weight="700" fill="#222">${esc(nome)}</text>
<text x="28" y="190" font-size="18" fill="#444">${cotas} cota(s) · ${bolao.jogos} jogos × ${bolao.dezenas} dezenas</text>
<text x="28" y="222" font-size="18" fill="#444">Sorteio: ${esc(bolao.sorteio)} · ${esc(bolao.loterica)}</text>
<g fill="#222">${Array.from({ length: 46 }, (_, i) => `<rect x="${28 + i * 11}" y="270" width="${i % 3 === 0 ? 6 : 3}" height="60"/>`).join("")}</g>
<text x="572" y="352" font-size="13" fill="#999" text-anchor="end">endossado pela lotérica · cópia digital</text>
</svg>`;
  return dataUrl(svg);
}

/** QR "de mentira" para o Pix: é o desenho, não um código que um banco leia. */
export function arteQrPix(valor: number): string {
  let semente = Math.round(valor * 100) || 7;
  const rnd = () => {
    semente = (semente * 9301 + 49297) % 233280;
    return semente / 233280;
  };
  const n = 25;
  const cel = 10;
  const quadros: string[] = [];
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++) {
      const canto = (x < 7 && y < 7) || (x > n - 8 && y < 7) || (x < 7 && y > n - 8);
      if (canto) continue;
      if (rnd() > 0.52) quadros.push(`<rect x="${20 + x * cel}" y="${20 + y * cel}" width="${cel}" height="${cel}"/>`);
    }
  const olho = (x: number, y: number) =>
    `<rect x="${x}" y="${y}" width="70" height="70" fill="#111"/><rect x="${x + 10}" y="${y + 10}" width="50" height="50" fill="#fff"/><rect x="${x + 20}" y="${y + 20}" width="30" height="30" fill="#111"/>`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="290" height="330" viewBox="0 0 290 330" font-family="Inter, Helvetica, Arial, sans-serif">
<rect width="290" height="330" rx="16" fill="#fff"/>
<g fill="#111">${quadros.join("")}</g>
${olho(20, 20)}${olho(200, 20)}${olho(20, 200)}
<text x="145" y="306" font-size="18" font-weight="700" fill="#111" text-anchor="middle">Pix · ${esc(brl(valor))}</text>
</svg>`;
  return dataUrl(svg);
}
