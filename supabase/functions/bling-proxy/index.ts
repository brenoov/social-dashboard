import { createClient } from 'jsr:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const BLING_BASE = 'https://api.bling.com.br/Api/v3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function getValidToken(sb: ReturnType<typeof createClient>): Promise<string> {
  const { data, error } = await sb
    .from('bling_tokens')
    .select('*')
    .order('id', { ascending: false })
    .limit(1)
    .single();

  if (error || !data) throw new Error('No Bling token found');

  if (new Date(data.expires_at) > new Date(Date.now() + 5 * 60 * 1000)) {
    return data.access_token;
  }

  const creds = btoa(`${data.client_id}:${data.client_secret}`);
  const resp = await fetch(`${BLING_BASE}/oauth/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${creds}`,
    },
    body: `grant_type=refresh_token&refresh_token=${data.refresh_token}`,
  });

  if (!resp.ok) throw new Error(`Token refresh failed: ${await resp.text()}`);

  const tokens = await resp.json();

  await sb.from('bling_tokens').update({
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
    updated_at: new Date().toISOString(),
  }).eq('id', data.id);

  return tokens.access_token;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const { endpoint, params } = await req.json();

    if (!endpoint) {
      return new Response(JSON.stringify({ error: 'endpoint required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const token = await getValidToken(sb);

    const url = new URL(`${BLING_BASE}/${endpoint}`);
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        if (v === undefined || v === null) continue;
        if (Array.isArray(v)) {
          for (const item of v) url.searchParams.append(k, String(item));
        } else {
          url.searchParams.set(k, String(v));
        }
      }
    }

    const blingResp = await fetch(url.toString(), {
      headers: { 'Authorization': `Bearer ${token}` },
    });

    const text = await blingResp.text();
    let data;
    try { data = JSON.parse(text); } catch { data = { raw: text }; }

    return new Response(JSON.stringify(data), {
      status: blingResp.status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
