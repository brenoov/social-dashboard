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

    const body = await req.json();
    const acao = body.acao;
    if (acao === "apagar") {
      if (!body.id) return json({ error: "id_obrigatorio" }, 400);
      const { error } = await sb.from("fabrica_publicos").delete().eq("id", body.id);
      if (error) return json({ error: "delete_falhou", detail: error.message }, 500);
      return json({ ok: true });
    }
    if (acao === "salvar") {
      const p = body.preset || {};
      if (!p.nome) return json({ error: "nome_obrigatorio" }, 400);
      const linha = {
        nome: p.nome, marca_id: p.marca_id ?? null,
        geo: p.geo ?? {}, idade_min: p.idade_min ?? 18, idade_max: p.idade_max ?? 65,
        generos: p.generos ?? [], interesses: p.interesses ?? [], custom_audiences: p.custom_audiences ?? [],
        criado_por: ud.user.id,
      };
      const q = p.id
        ? sb.from("fabrica_publicos").update(linha).eq("id", p.id).select("id").single()
        : sb.from("fabrica_publicos").insert(linha).select("id").single();
      const { data, error } = await q;
      if (error) return json({ error: "salvar_falhou", detail: error.message }, 500);
      return json({ id: data.id });
    }
    return json({ error: "acao_invalida" }, 400);
  } catch (e) { return json({ error: String(e) }, 500); }
});
