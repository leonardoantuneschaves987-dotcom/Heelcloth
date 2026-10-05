// Preços públicos: o site usa para mostrar o orçamento ao cliente.
import { getStore } from "@netlify/blobs";
import { lerPrecos } from "../lib/comum.mjs";

export default async () => {
  const precos = await lerPrecos(getStore({ name: "config", consistency: "strong" }));
  return new Response(JSON.stringify({ precos }), { headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
};
export const config = { path: "/api/precos" };
