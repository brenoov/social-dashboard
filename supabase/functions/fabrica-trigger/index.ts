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
    const { data: prof } = await sb.from("profiles").select("role, permissions").eq("id", ud.user.id).single();
    const ok = prof && (prof.role === "admin" || (prof.permissions && Object.prototype.hasOwnProperty.call(prof.permissions, "meta.fabrica")));
    if (!ok) return json({ error: "sem_permissao" }, 403);
    const { tipo, params } = await req.json();
    if (!["gerar", "subir"].includes(tipo)) return json({ error: "tipo_invalido" }, 400);
    const { data: job, error } = await sb.from("fabrica_jobs").insert({ tipo, params: params || {}, status: "enfileirado", criado_por: ud.user.id }).select("id").single();
    if (error) return json({ error: "insert_falhou", detail: error.message }, 500);
    const repo = Deno.env.get("GITHUB_REPO")!; // "brenoov/social-dashboard"
    const gh = await fetch(`https://api.github.com/repos/${repo}/actions/workflows/fabrica.yml/dispatches`, {
      method: "POST", headers: { Authorization: `Bearer ${Deno.env.get("GITHUB_PAT_FABRICA")!}`, Accept: "application/vnd.github+json", "User-Agent": "fabrica-trigger" },
      body: JSON.stringify({ ref: "main", inputs: { job_id: job.id } }),
    });
    if (!gh.ok) { await sb.from("fabrica_jobs").update({ status: "erro", erro: "dispatch_falhou " + gh.status }).eq("id", job.id); return json({ error: "dispatch_falhou", detail: await gh.text() }, 502); }
    return json({ job_id: job.id });
  } catch (e) { return json({ error: String(e) }, 500); }
});
