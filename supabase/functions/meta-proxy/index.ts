import { createClient } from 'jsr:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const META_GRAPH = 'https://graph.facebook.com/v22.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  try {
    const authHeader = req.headers.get('Authorization') || '';
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: 'nao autenticado' }, 401);

    const svc = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    const { data: prof } = await svc.from('profiles').select('role, features').eq('id', user.id).single();
    const allowed = !!prof && (prof.role === 'admin' || (Array.isArray(prof.features) && prof.features.includes('meta')));
    if (!allowed) return json({ error: 'sem permissao' }, 403);

    const { accountId, path, params, method, imageFromUrl, imageField } = await req.json();
    if (!accountId || !path) return json({ error: 'accountId e path obrigatorios' }, 400);

    const { data: acc, error: accErr } = await svc.from('accounts').select('access_token').eq('id', accountId).single();
    if (accErr || !acc?.access_token) return json({ error: 'conta sem token' }, 400);

    // NOVO: upload de imagem por bytes (multipart) a partir de uma URL publica.
    // Usado pra /act_<id>/adimages sem estourar a query string. Retrocompativel:
    // so dispara quando imageFromUrl vem no body.
    if (imageFromUrl) {
      const imgResp = await fetch(String(imageFromUrl));
      if (!imgResp.ok) return json({ error: 'falha ao baixar imagem: ' + imgResp.status }, 400);
      const blob = await imgResp.blob();
      const field = (typeof imageField === 'string' && imageField) ? imageField : 'img0';
      const form = new FormData();
      for (const [k, v] of Object.entries(params || {})) {
        if (v === undefined || v === null) continue;
        form.append(k, typeof v === 'object' ? JSON.stringify(v) : String(v));
      }
      form.append(field, blob, field + '.png');
      const upUrl = new URL(META_GRAPH + path);
      upUrl.searchParams.set('access_token', acc.access_token);
      const ctrlU = new AbortController();
      const timerU = setTimeout(() => ctrlU.abort(), 30000);
      try {
        const resp = await fetch(upUrl.toString(), { method: 'POST', body: form, signal: ctrlU.signal });
        const text = await resp.text();
        let data; try { data = JSON.parse(text); } catch { data = { raw: text }; }
        return json(data, resp.status);
      } finally { clearTimeout(timerU); }
    }

    const url = new URL(META_GRAPH + path);
    url.searchParams.set('access_token', acc.access_token);
    for (const [k, v] of Object.entries(params || {})) {
      if (v === undefined || v === null) continue;
      url.searchParams.set(k, typeof v === 'object' ? JSON.stringify(v) : String(v));
    }
    const httpMethod = (typeof method === 'string' && ['GET','POST','DELETE'].includes(method.toUpperCase())) ? method.toUpperCase() : 'GET';
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 15000);
    try {
      const resp = await fetch(url.toString(), { method: httpMethod, signal: ctrl.signal });
      const text = await resp.text();
      let data; try { data = JSON.parse(text); } catch { data = { raw: text }; }
      return json(data, resp.status);
    } finally { clearTimeout(timer); }
  } catch (err) {
    return json({ error: String(err) }, 500);
  }
});
