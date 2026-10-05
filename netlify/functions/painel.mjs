// Área do dono: lista, atualiza e exclui encomendas. Protegida por senha.
import { getStore } from "@netlify/blobs";
import { PADRAO, STATUS, lerPrecos, orcar, env } from "../lib/comum.mjs";

const json = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
const CHAVE = /^\d{4}-\d{2}\/[\w-]+$/;

export default async (req) => {
  const senha = env("PAINEL_SENHA");
  if (!senha) return json({ erro: "senha-nao-configurada" }, 500);
  if (req.headers.get("x-senha") !== senha) return json({ erro: "senha" }, 401);

  const store = getStore({ name: "encomendas", consistency: "strong" });
  const config = getStore({ name: "config", consistency: "strong" });
  const fotos = getStore({ name: "fotos", consistency: "strong" });

  if (req.method === "GET") {
    const fk = new URL(req.url).searchParams.get("foto");
    if (fk) {
      if (!CHAVE.test(fk)) return json({ erro: "chave" }, 400);
      return json({ imagem: (await fotos.get(fk, { type: "text" }).catch(() => null)) || null });
    }
    const { blobs } = await store.list();
    const lista = (await Promise.all(blobs.map((b) => store.get(b.key, { type: "json" }).catch(() => null)))).filter(Boolean);
    return json({ encomendas: lista, precos: await lerPrecos(config) });
  }

  if (req.method === "POST") {
    const d = await req.json().catch(() => ({}));

    if (d.acao === "precos") {
      const novo = {};
      for (const k of Object.keys(PADRAO)) {
        const v = Number(d.precos?.[k]);
        novo[k] = Number.isFinite(v) && v > 0 && v < 100000 ? Math.round(v * 100) / 100 : 0;
      }
      await config.setJSON("precos2", novo);
      return json({ ok: true });
    }

    const key = String(d.key || "");
    if (!CHAVE.test(key)) return json({ erro: "chave" }, 400);

    if (d.acao === "excluir") {
      await store.delete(key);
      await fotos.delete(key).catch(() => {});
      return json({ ok: true });
    }

    const e = await store.get(key, { type: "json" });
    if (!e) return json({ erro: "nao-encontrada" }, 404);

    if (d.acao === "atualizar") {
      if (d.status !== undefined && STATUS.includes(d.status)) e.status = d.status;
      if (d.entrega !== undefined) e.entrega = /^\d{4}-\d{2}-\d{2}$/.test(d.entrega || "") ? d.entrega : "";
      if (d.pago !== undefined) { const v = Number(d.pago); e.pago = Number.isFinite(v) && v >= 0 && v < 1e7 ? Math.round(v * 100) / 100 : 0; }
      await store.setJSON(key, e);
      return json({ ok: true });
    }

    if (d.acao === "recalcular") {
      const nc = e.itens.filter((i) => i.tamCamisa).length, ns = e.itens.filter((i) => i.tamShort).length;
      e.orcamento = orcar(await lerPrecos(config), e.opcoes || [], nc, ns);
      await store.setJSON(key, e);
      return json({ ok: true, orcamento: e.orcamento });
    }

    if (d.acao === "foto") {
      const img = String(d.imagem || "");
      if (!/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(img) || img.length > 3_000_000) return json({ erro: "imagem-invalida" }, 400);
      await fotos.set(key, img); e.foto = true;
      await store.setJSON(key, e);
      return json({ ok: true });
    }
    if (d.acao === "removerFoto") {
      await fotos.delete(key).catch(() => {}); e.foto = false;
      await store.setJSON(key, e);
      return json({ ok: true });
    }
  }
  return json({ erro: "invalido" }, 400);
};

export const config = { path: "/api/painel" };
