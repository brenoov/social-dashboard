import { createClient } from "jsr:@supabase/supabase-js@2";
const BUCKET = "fabrica-criativos";
async function purgar() {
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const trintaDias = new Date(Date.now() - 30 * 864e5).toISOString();
  // rodadas alvo: fechadas não purgadas OU abandonadas (nunca fechadas) com >30d
  const { data: rodadas } = await sb.from("fabrica_campanhas")
    .select("id, fechada_em, created_at")
    .is("purgado_em", null)
    .or(`fechada_em.not.is.null,and(fechada_em.is.null,created_at.lt.${trintaDias})`);
  let objetos = 0, purgadas = 0;
  for (const r of rodadas || []) {
    const { data: crs } = await sb.from("fabrica_criativos").select("id, storage_path").eq("campanha_id", r.id).is("purgado_em", null);
    const paths = (crs || []).map((c) => c.storage_path).filter(Boolean);
    if (paths.length) { const { error } = await sb.storage.from(BUCKET).remove(paths); if (error) throw error; objetos += paths.length; }
    const agora = new Date().toISOString();
    const { error: e1 } = await sb.from("fabrica_criativos").update({ purgado_em: agora }).eq("campanha_id", r.id).is("purgado_em", null);
    if (e1) throw e1;
    const { error: e2 } = await sb.from("fabrica_campanhas").update({ purgado_em: agora }).eq("id", r.id);
    if (e2) throw e2;
    purgadas++;
  }
  return { rodadas_purgadas: purgadas, objetos_apagados: objetos };
}
// Comparação em tempo constante (evita timing side-channel na checagem do segredo).
function igualTempoConstante(a: string, b: string): boolean {
  const ea = new TextEncoder().encode(a), eb = new TextEncoder().encode(b);
  if (ea.length !== eb.length) return false;
  let diff = 0;
  for (let i = 0; i < ea.length; i++) diff |= ea[i] ^ eb[i];
  return diff === 0;
}
Deno.serve(async (req) => {
  // Endpoint deleta Storage — auth SELF-CONTAINED no código (não depende do toggle verify_jwt do
  // gateway): segredo dedicado FABRICA_PURGA_SECRET, comparado em tempo constante. Deploy com
  // verify_jwt=false (o segredo não é um JWT); só quem tem o segredo (o pg_cron) apaga Storage.
  const segredo = Deno.env.get("FABRICA_PURGA_SECRET") || "";
  const auth = req.headers.get("Authorization") || "";
  if (!segredo || !igualTempoConstante(auth, `Bearer ${segredo}`)) {
    return new Response(JSON.stringify({ error: "nao_autorizado" }), { status: 401, headers: { "Content-Type": "application/json" } });
  }
  try { return new Response(JSON.stringify({ ok: true, ...(await purgar()) }), { headers: { "Content-Type": "application/json" } }); }
  catch (e) { return new Response(JSON.stringify({ ok: false, error: String(e) }), { status: 500, headers: { "Content-Type": "application/json" } }); }
});
