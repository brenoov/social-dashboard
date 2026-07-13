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
    if (acao === "salvar") {
      const l = body.look || {};
      if (!l.chave) return json({ error: "chave_obrigatoria" }, 400);
      const patch: Record<string, unknown> = {};
      if (l.nome !== undefined) patch.nome = l.nome;
      if (l.objetivos !== undefined) patch.objetivos = l.objetivos;
      if (l.ativo !== undefined) patch.ativo = l.ativo;
      const { error } = await sb.from("fabrica_looks").update(patch).eq("chave", l.chave);
      if (error) return json({ error: "salvar_falhou", detail: error.message }, 500);
      return json({ ok: true });
    }
    if (acao === "ordenar") {
      for (const o of (body.ordem || [])) {
        if (o?.chave == null) continue;
        await sb.from("fabrica_looks").update({ ordem: o.ordem ?? 0 }).eq("chave", o.chave);
      }
      return json({ ok: true });
    }
    if (acao === "sync") {
      const registry = body.registry || [];
      const { data: existentes } = await sb.from("fabrica_looks").select("chave");
      const has = new Set((existentes || []).map((e: { chave: string }) => e.chave));
      const faltam = registry.filter((r: { chave: string }) => !has.has(r.chave))
        .map((r: any) => ({ chave: r.chave, nome: r.nome, arquetipo: r.arquetipo, objetivos: r.objetivos || [], tipo: "codigo", ativo: true, ordem: r.ordem ?? 0 }));
      if (faltam.length) { const { error } = await sb.from("fabrica_looks").insert(faltam); if (error) return json({ error: "sync_falhou", detail: error.message }, 500); }
      return json({ inseridos: faltam.length });
    }
    if (acao === "excluir") {
      // Excluir (sumir da galeria) OU restaurar. excluido default true; passe excluido:false p/ restaurar.
      const chave = body.chave;
      if (!chave) return json({ error: "chave_obrigatoria" }, 400);
      const excluido = body.excluido !== false;
      const { error } = await sb.from("fabrica_looks").update({ excluido }).eq("chave", chave);
      if (error) return json({ error: "excluir_falhou", detail: error.message }, 500);
      return json({ ok: true, excluido });
    }
    return json({ error: "acao_invalida" }, 400);
  } catch (e) { return json({ error: String(e) }, 500); }
});
