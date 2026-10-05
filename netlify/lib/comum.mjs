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

export function orcar(precos, opcoes, nc, ns) {
  const tex = opcoes.includes("texturizada"), pun = opcoes.includes("punhos"), man = opcoes.includes("manga_longa");
  const pl = (n, s, p) => (n === 1 ? s : p);
  const linhas = [];
  const pc = tex ? precos.camisa_text : precos.camisa;
  linhas.push({ d: `${nc} ${pl(nc, "camisa", "camisas")} ${tex ? pl(nc, "texturizada", "texturizadas") : "tecido padrão"} × ${brl(pc)}`, v: r2(nc * pc) });
  if (pun) { const dif = r2(precos.camisa_punho - precos.camisa); linhas.push({ d: `Personalização de punhos: ${nc} × ${brl(dif)}`, v: r2(nc * dif) }); }
  if (man) {
    if (precos.manga_longa > 0) linhas.push({ d: `Manga longa: ${nc} × ${brl(precos.manga_longa)}`, v: r2(nc * precos.manga_longa) });
    else linhas.push({ d: "Manga longa: valor a combinar", v: 0, combinar: true });
  }
  if (ns) { const ps = tex ? precos.short_text : precos.short; linhas.push({ d: `${ns} ${pl(ns, "short", "shorts")}${tex ? " texturizado" + (ns === 1 ? "" : "s") : ""} × ${brl(ps)}`, v: r2(ns * ps) }); }
  return { linhas, total: r2(linhas.reduce((a, l) => a + l.v, 0)), aCombinar: linhas.some((l) => l.combinar) };
}

export const env = (n) => globalThis.Netlify?.env?.get(n) ?? process.env[n];
