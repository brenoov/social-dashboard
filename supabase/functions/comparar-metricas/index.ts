// DESATIVADA — função temporária de diagnóstico (janela de métricas já validada 7/14/30).
// Pode ser excluída no painel: Supabase > Edge Functions > comparar-metricas > Delete.
Deno.serve(() => new Response(JSON.stringify({ ok: false, disabled: true, msg: 'diagnóstico concluído; função desativada' }), { status: 410, headers: { 'Content-Type': 'application/json' } }));
