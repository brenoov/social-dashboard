import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
// BCG idêntico ao lib (Deno não importa .mjs do coletor; espelho fiel — coberto por teste do lib).
function bcgClass(e: number, g: number, d: number): string {
  const st = g / Math.max(1, g + e); const recente = Number.isFinite(d) && d <= 21;
  if (g > 0 && st >= 0.5) return "Estrela";
  if (g > 0 && st >= 0.25) return "Vaca leiteira";
  if (recente || g > 0) return "Interrogação";
  return "Abacaxi";
}
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

    const { lojas = [], fonte, filtros = {} } = await req.json();
    // fabrica_lojas: deposito -> {nome, canal_loja_id}
    const { data: lojasCfg } = await sb.from("fabrica_lojas").select("deposito_id, nome, canal_loja_id").in("deposito_id", lojas);
    const cfgByDep: Record<string, any> = Object.fromEntries((lojasCfg || []).map((l) => [l.deposito_id, l]));

    let candidatos: any[] = [];
    if (fonte === "oportunidades" || fonte === "garimpo") {
      const { data: brief } = await sb.from("gestao_comercial_briefings").select("dados_json").order("rodada", { ascending: false }).limit(1).single();
      const blocos = (brief?.dados_json?.[fonte] || []) as any[]; // [{loja, itens[]}]
      const acc: Record<string, any> = {};
      for (const bloco of blocos) {
        const dep = Object.keys(cfgByDep).find((d) => cfgByDep[d].nome?.toLowerCase().includes(String(bloco.loja).toLowerCase())) ;
        if (!dep) continue;
        for (const it of bloco.itens || []) {
          acc[it.sku] ??= { sku: it.sku, nome: it.descricao, categoria: it.categoria, porLoja: {} };
          acc[it.sku].porLoja[dep] = { preco: it.precoOriginal, pctPrevisto: it.pct, precoComDesconto: it.precoComDesconto, estoque: it.estoqueLoja };
        }
      }
      candidatos = Object.values(acc);
    } else if (fonte === "bcg" || fonte === "abc") {
      // vendas (faturamento/giro) + estoque por loja a partir de gc_vendas_item/gc_estoque_item
      const canais = lojas.map((d: string) => cfgByDep[d]?.canal_loja_id).filter(Boolean);
      const { data: vendas } = await sb.from("gc_vendas_item").select("sku, produto, categoria, unidades, faturamento, canal_loja_id").in("canal_loja_id", canais);
      const { data: estoque } = await sb.from("gc_estoque_item").select("sku, saldo, deposito_id").in("deposito_id", lojas);
      const estByDepSku: Record<string, number> = {}; for (const e of estoque || []) estByDepSku[e.deposito_id + "|" + e.sku] = e.saldo;
      const fatBySku: Record<string, any> = {}; for (const v of vendas || []) { fatBySku[v.sku] ??= { sku: v.sku, nome: v.produto, categoria: v.categoria, faturamento: 0, unidades: 0 }; fatBySku[v.sku].faturamento += Number(v.faturamento) || 0; fatBySku[v.sku].unidades += Number(v.unidades) || 0; }
      let arr = Object.values(fatBySku) as any[];
      if (fonte === "abc") {
        arr.sort((a, b) => b.faturamento - a.faturamento);
        const total = arr.reduce((s, i) => s + i.faturamento, 0) || 1; let acc = 0;
        arr = arr.map((i) => { acc += i.faturamento; const p = acc / total; return { ...i, faixa: p <= 0.8 ? "A" : p <= 0.95 ? "B" : "C" }; });
        if (filtros.faixa) arr = arr.filter((i) => i.faixa === filtros.faixa);
      } else { // bcg: quadrante por loja (usa estoque da loja + unidades como giro proxy)
        // Nota: gc_vendas_item/gc_estoque_item não têm data da última venda, então diasSemVender
        // não pode ser calculado aqui (passamos 0) -> `recente` é sempre true -> o quadrante
        // "Abacaxi" nunca é produzido por esta Edge. Aceitável: o painel Gerar oferece só
        // Estrela / Vaca leiteira / Interrogação (Abacaxi fora de escopo, conforme spec).
        const quads: string[] = filtros.quadrantes || ["Estrela", "Vaca leiteira", "Interrogação"];
        arr = arr.filter((i) => lojas.some((d: string) => quads.includes(bcgClass(estByDepSku[d + "|" + i.sku] || 0, i.unidades || 0, 0))));
        if (filtros.categoria) arr = arr.filter((i) => (i.categoria || "").toLowerCase().includes(String(filtros.categoria).toLowerCase()));
      }
      candidatos = arr.map((i) => ({ sku: i.sku, nome: i.nome, categoria: i.categoria, porLoja: Object.fromEntries(lojas
        .map((d: string) => [d, { preco: null, pctPrevisto: null, precoComDesconto: null, estoque: estByDepSku[d + "|" + i.sku] || 0 }])
        .filter(([, info]: [string, any]) => info.estoque > 0)) }));
    } else if (fonte === "manual") {
      const termo = String(filtros.termo || "").toLowerCase();
      const { data: vendas } = await sb.from("gc_vendas_item").select("sku, produto, categoria").in("canal_loja_id", lojas.map((d: string) => cfgByDep[d]?.canal_loja_id).filter(Boolean));
      const { data: estoque } = await sb.from("gc_estoque_item").select("sku, saldo, deposito_id").in("deposito_id", lojas);
      const estByDepSku: Record<string, number> = {}; for (const e of estoque || []) estByDepSku[e.deposito_id + "|" + e.sku] = e.saldo;
      const uniq: Record<string, any> = {}; for (const v of vendas || []) if (!termo || (v.produto || "").toLowerCase().includes(termo) || (v.sku || "").toLowerCase().includes(termo)) uniq[v.sku] ??= { sku: v.sku, nome: v.produto, categoria: v.categoria, porLoja: Object.fromEntries(lojas
        .map((d: string) => [d, { preco: null, pctPrevisto: null, precoComDesconto: null, estoque: estByDepSku[d + "|" + v.sku] || 0 }])
        .filter(([, info]: [string, any]) => info.estoque > 0)) };
      candidatos = Object.values(uniq);
    } else return json({ error: "fonte_invalida" }, 400);

    return json({ candidatos });
  } catch (e) { return json({ error: String(e) }, 500); }
});
