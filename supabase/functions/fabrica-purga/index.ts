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
// role(tok): decodifica o payload do JWT (SEM verificar assinatura — o gateway já verificou, pois a
// função roda com verify_jwt=true) e devolve o claim `role`. Usado só pra distinguir service_role de
// anon; a autenticidade vem do verify_jwt do gateway.
function roleDoJwt(tok: string): string | null {
  try {
    const p = tok.split(".")[1];
    const json = JSON.parse(atob(p.replace(/-/g, "+").replace(/_/g, "/")));
    return json.role ?? null;
  } catch { return null; }
}
Deno.serve(async (req) => {
  // Endpoint deleta Storage — só service_role. verify_jwt=true (gateway valida a assinatura) +
  // checagem do claim role aqui garante que anon (público) ou token forjado não passam.
  const auth = req.headers.get("Authorization") || "";
  const tok = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (roleDoJwt(tok) !== "service_role") {
    return new Response(JSON.stringify({ error: "nao_autorizado" }), { status: 401, headers: { "Content-Type": "application/json" } });
  }
  try { return new Response(JSON.stringify({ ok: true, ...(await purgar()) }), { headers: { "Content-Type": "application/json" } }); }
  catch (e) { return new Response(JSON.stringify({ ok: false, error: String(e) }), { status: 500, headers: { "Content-Type": "application/json" } }); }
});
