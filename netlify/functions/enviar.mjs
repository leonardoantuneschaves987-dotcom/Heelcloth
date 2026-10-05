// Recebe a lista enviada pelo site e guarda como uma encomenda separada.
import { getStore } from "@netlify/blobs";
import { OPCOES, lerPrecos, orcar, env } from "../lib/comum.mjs";

const MIN_CAMISAS = 10;
const ALFABETO = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const txt = (v, n) => String(v ?? "").trim().slice(0, n);
const resp = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { "Content-Type": "application/json" } });

function gerarProtocolo(ym) {
  let s = "";
  for (const b of crypto.getRandomValues(new Uint8Array(4))) s += ALFABETO[b % 32];
  return `HC-${ym.slice(2, 4)}${ym.slice(5, 7)}-${s}`;
}

async function avisar(e, nc, ns) {
  const msg = `Nova encomenda ${e.protocolo}\n${e.representante} - WhatsApp ${e.contato}\n${nc} camisas e ${ns} shorts\nTotal: R$ ${e.orcamento.total.toFixed(2).replace(".", ",")}${e.orcamento.aCombinar ? " (manga longa a combinar)" : ""}`;
  const tarefas = [], topico = env("NTFY_TOPIC"), chave = env("RESEND_API_KEY"), para = env("EMAIL_DESTINO");
  if (topico) tarefas.push(fetch("https://ntfy.sh/" + encodeURIComponent(topico), { method: "POST", body: msg, headers: { Title: "Nova encomenda" }, signal: AbortSignal.timeout(4000) }));
  if (chave && para) tarefas.push(fetch("https://api.resend.com/emails", {
    method: "POST", headers: { Authorization: "Bearer " + chave, "Content-Type": "application/json" },
    body: JSON.stringify({ from: "Encomendas <onboarding@resend.dev>", to: [para], subject: "Nova encomenda " + e.protocolo, text: msg }),
    signal: AbortSignal.timeout(4000),
  }));
  await Promise.allSettled(tarefas); // um aviso que falhe nunca impede o envio da lista
}

export default async (req) => {
  if (req.method !== "POST") return resp({ erro: "Método não permitido." }, 405);
  let d;
  try { d = await req.json(); } catch { return resp({ erro: "Dados inválidos." }, 400); }

  const representante = txt(d.representante, 100);
  if (!representante) return resp({ erro: "Informe o nome do representante." }, 400);
  let tel = String(d.contato || "").replace(/\D/g, "");
  if (tel.length < 10 || tel.length > 13) return resp({ erro: "Informe o WhatsApp do representante, com DDD." }, 400);
  if (tel.length <= 11) tel = "55" + tel;

  if (!Array.isArray(d.itens) || d.itens.length === 0 || d.itens.length > 500) return resp({ erro: "Lista inválida." }, 400);
  const itens = d.itens
    .map((i) => ({ nome: txt(i.nome, 80), numero: txt(i.numero, 10), tamCamisa: txt(i.tamCamisa, 20), tamShort: txt(i.tamShort, 20), goleiro: i.goleiro === true, obs: txt(i.obs, 200) }))
    .filter((i) => i.nome && i.numero && (i.tamCamisa || i.tamShort));
  const opcoes = [...new Set((Array.isArray(d.opcoes) ? d.opcoes : []).filter((o) => OPCOES.includes(o)))];

  const nc = itens.filter((i) => i.tamCamisa).length, ns = itens.filter((i) => i.tamShort).length;
  if (nc < MIN_CAMISAS) return resp({ erro: `O pedido precisa ter no mínimo ${MIN_CAMISAS} camisas (recebemos ${nc}).` }, 400);

  const agora = new Date();
  const ym = agora.toLocaleString("sv-SE", { timeZone: "America/Sao_Paulo" }).slice(0, 7);
  const id = crypto.randomUUID();
  const config = getStore({ name: "config", consistency: "strong" });
  const orcamento = orcar(await lerPrecos(config), opcoes, nc, ns);
  const e = {
    id, key: `${ym}/${id}`, protocolo: gerarProtocolo(ym), representante, contato: tel,
    criadoEm: agora.toISOString(), ano: Number(ym.slice(0, 4)), mes: Number(ym.slice(5, 7)),
    status: "Pendente", entrega: "", pago: 0, opcoes, orcamento, itens,
  };
  await getStore({ name: "encomendas", consistency: "strong" }).setJSON(e.key, e);
  await avisar(e, nc, ns);
  return resp({ ok: true, protocolo: e.protocolo, camisas: nc, shorts: ns, orcamento });
};

export const config = { path: "/api/enviar" };
