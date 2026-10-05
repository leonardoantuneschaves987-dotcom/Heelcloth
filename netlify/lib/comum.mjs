// Regras compartilhadas entre as funções: preços, status e cálculo do orçamento.
export const PADRAO = { camisa: 44.9, camisa_punho: 49.9, camisa_text: 59.9, manga_longa: 0, short: 24.9, short_text: 34.9 };
export const OPCOES = ["texturizada", "manga_longa", "punhos"];
export const STATUS = ["Pendente", "Em produção", "Pronta", "Entregue"];

const brl = (v) => Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const r2 = (v) => Math.round(v * 100) / 100;

export async function lerPrecos(config) {
  const salvo = await config.get("precos2", { type: "json" }).catch(() => null);
  return { ...PADRAO, ...(salvo || {}) };
}

// itens: cada linha da lista, com suas opções (texturizada, punhos, manga_longa).
// "padrao" só é usado em encomendas antigas, em que a opção valia para o pedido inteiro.
export function orcar(precos, itens, padrao = []) {
  const pl = (n, s, p) => (n === 1 ? s : p);
  const cam = {}, sho = {}, linhas = [];
  const flags = (i) => { const o = Array.isArray(i.opcoes) ? i.opcoes : padrao; return { tex: o.includes("texturizada"), pun: o.includes("punhos"), man: o.includes("manga_longa") }; };
  for (const i of itens) {
    const f = flags(i);
    f.pun = f.pun && !f.tex; // na camisa texturizada os punhos personalizados já estão inclusos
    if (i.tamCamisa) { const k = (f.tex ? "1" : "0") + (f.pun ? "1" : "0") + (f.man ? "1" : "0"); (cam[k] ??= { f, n: 0 }).n++; }
    if (i.tamShort) { const k = f.tex ? "t" : "p"; (sho[k] ??= { tex: f.tex, n: 0 }).n++; }
  }
  for (const k of Object.keys(cam).sort()) {
    const { f, n } = cam[k], mangaOk = precos.manga_longa > 0;
    const unit = r2((f.tex ? precos.camisa_text : precos.camisa) + (f.pun ? precos.camisa_punho - precos.camisa : 0) + (f.man && mangaOk ? precos.manga_longa : 0));
    const combinar = f.man && !mangaOk;
    linhas.push({ d: `${n} ${pl(n, "camisa", "camisas")} ${f.tex ? pl(n, "texturizada", "texturizadas") + " (punhos inclusos)" : "tecido padrão"}${f.pun ? " com punhos personalizados" : ""}${f.man ? " manga longa" : ""} × ${brl(unit)}${combinar ? " (manga longa a combinar)" : ""}`, v: r2(n * unit), combinar });
  }
  for (const k of Object.keys(sho).sort()) {
    const { tex, n } = sho[k], p = tex ? precos.short_text : precos.short;
    linhas.push({ d: `${n} ${pl(n, "short", "shorts")}${tex ? " texturizado" + (n === 1 ? "" : "s") : ""} × ${brl(p)}`, v: r2(n * p) });
  }
  return { linhas, total: r2(linhas.reduce((a, l) => a + l.v, 0)), aCombinar: linhas.some((l) => l.combinar) };
}

export const env = (n) => globalThis.Netlify?.env?.get(n) ?? process.env[n];
