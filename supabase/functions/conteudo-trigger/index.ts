// supabase/functions/conteudo-trigger/index.ts
//
// Enfileira uma rodada do robô de pauta e dispara o GitHub Actions.
//
// Molde de fabrica-trigger. A Edge não gera as ideias ela mesma porque Opus com
// contexto grande estoura o relógio de uma Edge Function — quem executa é
// coletor/conteudo-ideias.mjs, pelo Actions.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Teto por rodada. Cada ideia é token de Opus; sem limite, um número digitado
// errado (ou um clique repetido) vira conta alta sem ninguém perceber.
const MAX_POR_RODADA = 20;
// Uma rodada por vez por marca: o botão fica desabilitado no front, mas o front
// não é a garantia — dois cliques rápidos chegariam aqui como duas chamadas.
const MINUTOS_ENTRE_RODADAS = 3;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
  const json = (b: unknown, s = 200) =>
    new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } });

  try {
    const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const uc = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: req.headers.get('Authorization') || '' } },
    });

    const { data: ud } = await uc.auth.getUser();
    if (!ud?.user) return json({ error: 'nao_autenticado' }, 401);

    const { data: prof } = await sb
      .from('profiles').select('role, permissions, features, is_superadmin')
      .eq('id', ud.user.id).single();

    // Checa os DOIS modelos de permissão do projeto (permissions no front,
    // features no backend) — um usuário pode ter só um dos dois preenchido.
    const ok = prof && (
      prof.role === 'admin' ||
      prof.is_superadmin === true ||
      (prof.permissions && Object.prototype.hasOwnProperty.call(prof.permissions, 'conteudo')) ||
      (Array.isArray(prof.features) && prof.features.includes('conteudo'))
    );
    if (!ok) return json({ error: 'sem_permissao' }, 403);

    const body = await req.json().catch(() => ({}));
    const accountId = String(body.account_id || '');
    if (!/^[0-9a-fA-F-]{36}$/.test(accountId)) return json({ error: 'conta_invalida' }, 400);

    const quantas = Math.min(Math.max(Number(body.quantas) || 12, 1), MAX_POR_RODADA);

    // Já tem rodada em andamento para esta marca?
    const desde = new Date(Date.now() - MINUTOS_ENTRE_RODADAS * 60000).toISOString();
    const { data: emAndamento } = await sb
      .from('conteudo_jobs')
      .select('id,status,created_at')
      .eq('account_id', accountId)
      .in('status', ['enfileirado', 'rodando'])
      .gte('created_at', desde)
      .limit(1);
    if (emAndamento?.length) {
      return json({ error: 'ja_rodando', job_id: emAndamento[0].id }, 409);
    }

    const { data: job, error } = await sb
      .from('conteudo_jobs')
      .insert({ tipo: 'ideias', account_id: accountId, params: { quantas }, criado_por: ud.user.id })
      .select('id').single();
    if (error) return json({ error: 'insert_falhou', detail: error.message }, 500);

    const repo = Deno.env.get('GITHUB_REPO')!;
    const gh = await fetch(
      `https://api.github.com/repos/${repo}/actions/workflows/conteudo-ideias.yml/dispatches`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${Deno.env.get('GITHUB_PAT_FABRICA')!}`,
          Accept: 'application/vnd.github+json',
          'User-Agent': 'conteudo-trigger',
        },
        body: JSON.stringify({ ref: 'main', inputs: { job_id: job.id, quantas: String(quantas) } }),
      },
    );

    if (!gh.ok) {
      const corpo = (await gh.text()).slice(0, 300);

      // O 404 aqui quase sempre tem UMA causa: o arquivo do workflow ainda não
      // está na branch `main`. O disparo é sempre em `main` (é de lá que o
      // Actions roda), então enquanto a mudança viver só numa branch, o botão
      // "Gerar ideias" falha — e "dispatch_falhou 404" não diz isso a ninguém.
      const motivo = gh.status === 404
        ? 'O robô de pauta ainda não está publicado: o arquivo conteudo-ideias.yml '
          + 'precisa estar na branch main (ou seja, o PR precisa ser mesclado). '
          + 'Até lá, o resto da Central de Conteúdo funciona normalmente.'
        : `A chamada ao GitHub falhou (${gh.status}). ${corpo}`;

      // Job marcado como erro na hora: sem isto ele ficaria "enfileirado" para
      // sempre, e a tela mostraria uma ampulheta eterna.
      await sb.from('conteudo_jobs')
        .update({ status: 'erro', erro: motivo, updated_at: new Date().toISOString() })
        .eq('id', job.id);
      return json({ error: 'dispatch_falhou', detail: motivo }, 502);
    }

    return json({ job_id: job.id, quantas });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
