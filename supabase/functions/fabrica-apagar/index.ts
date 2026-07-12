import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });
  try {
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const uc = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: req.headers.get("Authorization") || "" } } });
    const { data: ud } = await uc.auth.getUser();
    if (!ud?.user) return json({ error: "nao_autenticado" }, 401);
    const { data: prof } = await sb.from("profiles").select("role, permissions, is_superadmin").eq("id", ud.user.id).single();
    if (!(prof && (prof.role === "admin" || prof.is_superadmin === true || (prof.permissions && Object.prototype.hasOwnProperty.call(prof.permissions, "meta.fabrica"))))) return json({ error: "sem_permissao" }, 403);

    const { campanhaId } = await req.json();
    if (!campanhaId) return json({ error: "campanhaId_obrigatorio" }, 400);
    const { data: camp } = await sb.from("fabrica_campanhas").select("id, job_id, status").eq("id", campanhaId).single();
    if (!camp) return json({ ok: true }); // idempotente

    // best-effort: cancela o Actions run se ainda gerando
    if (camp.status === "gerando" && camp.job_id) {
      const { data: job } = await sb.from("fabrica_jobs").select("github_run_id").eq("id", camp.job_id).single();
      const runId = job?.github_run_id;
      if (runId) {
        try {
          await fetch(`https://api.github.com/repos/${Deno.env.get("GITHUB_REPO")}/actions/runs/${runId}/cancel`, {
            method: "POST", headers: { Authorization: `Bearer ${Deno.env.get("GITHUB_PAT_FABRICA")}`, Accept: "application/vnd.github+json", "User-Agent": "fabrica-apagar" },
          });
        } catch (_) { /* best-effort */ }
      }
    }
    // apaga Storage dos criativos
    const { data: crs } = await sb.from("fabrica_criativos").select("storage_path").eq("campanha_id", campanhaId);
    const paths = (crs || []).map((c) => c.storage_path).filter(Boolean);
    if (paths.length) await sb.storage.from("fabrica-criativos").remove(paths);
    // apaga a campanha (ON DELETE CASCADE remove os criativos)
    const { error: ed } = await sb.from("fabrica_campanhas").delete().eq("id", campanhaId);
    if (ed) return json({ error: "delete_falhou", detail: ed.message }, 500);
    return json({ ok: true });
  } catch (e) { return json({ error: String(e) }, 500); }
});
