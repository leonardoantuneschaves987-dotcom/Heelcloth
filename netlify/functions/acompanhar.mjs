// Consulta pública do andamento: exige o protocolo + os 4 últimos números do WhatsApp.
import { getStore } from "@netlify/blobs";

const resp = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
const NAO = { erro: "Não encontramos esse pedido. Confira o protocolo e os 4 últimos números do WhatsApp usado no envio." };

export default async (req) => {
  if (req.method !== "POST") return resp({ erro: "Método não permitido." }, 405);
  let d;
  try { d = await req.json(); } catch { return resp(NAO, 400); }
  const pro = String(d.protocolo || "").trim().toUpperCase();
  const fim = String(d.final || "").replace(/\D/g, "").slice(-4);
  const m = /^HC-(\d{2})(\d{2})-([A-HJ-NP-Z2-9]{4})$/.exec(pro);
  if (!m || fim.length !== 4) return resp(NAO, 400);

  const store = getStore({ name: "encomendas", consistency: "strong" });
  const { blobs } = await store.list({ prefix: `20${m[1]}-${m[2]}/` });
  for (const b of blobs) {
    const e = await store.get(b.key, { type: "json" }).catch(() => null);
    if (e && e.protocolo === pro && String(e.contato || "").endsWith(fim)) {
      const total = e.orcamento?.total ?? 0, pago = e.pago || 0;
      return resp({
        ok: true, representante: e.representante, criadoEm: e.criadoEm,
        status: e.status === "Feita" ? "Pronta" : e.status, entrega: e.entrega || "",
        camisas: e.itens.filter((i) => i.tamCamisa).length, shorts: e.itens.filter((i) => i.tamShort).length,
        total, aCombinar: !!e.orcamento?.aCombinar, pago, saldo: Math.max(0, Math.round((total - pago) * 100) / 100),
      });
    }
  }
  return resp(NAO, 404);
};

export const config = { path: "/api/acompanhar" };
