// Supabase Edge Function: acessos-oauth
// OAuth callback for the Zoho connect flow of "Controle de Acesso e Colaboradores".
//
// ONLY route: GET .../acessos-oauth/callback/zoho?code=...&state=...
//   The authorize URL (with `state`) is minted by the ADMIN-GATED proxy (acessos-proxy
//   action `zoho.authUrl`), which stores the state in acessos_conexoes.oauth_state.
//   This callback rejects any code whose `state` does not match the stored one (CSRF /
//   connection-fixation protection) and whose state is older than 10 minutes.
//   There is intentionally NO public `/start` route — initiation requires an authenticated
//   admin via the proxy, so an attacker cannot fixate our org's Zoho connection.
//
// Verified Zoho endpoints (June 2026):
//   * OAuth token: https://accounts.zoho<dc>/oauth/v2/token  (POST, form-urlencoded)
//   * Org id (zoid): GET https://mail.zoho<dc>/api/organization -> data.zoid
//   * Data center stored in acessos_conexoes.data_center, spliced into the host.
// Security: client_id/client_secret/refresh_token live in the service-role table
// public.acessos_conexoes and NEVER leak into any redirect URL or response body.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const APP_RETURN = "https://socialdashboard.rbvcompany.com/";
const CALLBACK_URI =
  "https://kounqtdoioootxqegkij.supabase.co/functions/v1/acessos-oauth/callback/zoho";
const STATE_TTL_MS = 10 * 60 * 1000;

function admin() {
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
function redirect(location: string): Response {
  return new Response(null, { status: 302, headers: { Location: location } });
}
function fail(reason: string, detail?: unknown): Response {
  console.error("[acessos-oauth] erro:", reason, detail ?? "");
  return redirect(`${APP_RETURN}?zoho=erro&msg=${encodeURIComponent(reason)}`);
}
function dcSuffix(raw: unknown): string {
  let dc = (typeof raw === "string" ? raw : "").trim();
  if (!dc) return ".com";
  if (!dc.startsWith(".")) dc = "." + dc;
  return dc;
}
// constant-time string compare
function ctEq(a: string, b: string): boolean {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

async function handleCallback(reqUrl: URL): Promise<Response> {
  const oauthErr = reqUrl.searchParams.get("error");
  if (oauthErr) return fail(oauthErr);
  const code = reqUrl.searchParams.get("code");
  const qState = reqUrl.searchParams.get("state");
  if (!code) return fail("sem_code");
  if (!qState) return fail("sem_state");

  const sb = admin();
  // Read creds + the stored state in one go.
  const { data: row, error: readErr } = await sb
    .from("acessos_conexoes")
    .select("client_id, client_secret, data_center, oauth_state, oauth_state_em")
    .eq("provedor", "zoho")
    .single();
  if (readErr || !row) return fail("falha_ao_ler_credenciais", readErr?.message);

  // Verify state (CSRF): must match the one minted by the admin-gated proxy, and be fresh.
  if (!row.oauth_state || !ctEq(qState, row.oauth_state)) return fail("state_invalido");
  if (row.oauth_state_em && Date.now() - new Date(row.oauth_state_em).getTime() > STATE_TTL_MS) {
    await sb.from("acessos_conexoes").update({ oauth_state: null }).eq("provedor", "zoho");
    return fail("state_expirado");
  }
  // One-time use: clear the state immediately.
  await sb.from("acessos_conexoes").update({ oauth_state: null }).eq("provedor", "zoho");

  const dc = dcSuffix(row.data_center);

  // 1) Exchange code -> tokens.
  let tokenJson: any;
  try {
    const body = new URLSearchParams({
      grant_type: "authorization_code",
      client_id: row.client_id,
      client_secret: row.client_secret,
      redirect_uri: CALLBACK_URI,
      code,
    });
    const resp = await fetch(`https://accounts.zoho${dc}/oauth/v2/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    tokenJson = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      console.error("[acessos-oauth] token http", resp.status, tokenJson);
      return fail("falha_token", `http ${resp.status}`);
    }
  } catch (e) {
    return fail("falha_token", e instanceof Error ? e.message : e);
  }
  if (tokenJson?.error) return fail("falha_token", tokenJson.error);

  const refreshToken = tokenJson?.refresh_token;
  const accessToken = tokenJson?.access_token;
  if (!refreshToken) {
    console.error("[acessos-oauth] sem refresh_token. resposta:", tokenJson);
    return fail("sem_refresh_token");
  }

  // 2) Fetch zoid (defensive — store token even if org lookup fails).
  let zoid: string | null = null;
  if (accessToken) {
    try {
      const orgResp = await fetch(`https://mail.zoho${dc}/api/organization`, {
        headers: { Authorization: `Zoho-oauthtoken ${accessToken}` },
      });
      const rawOrg = await orgResp.text();
      if (!orgResp.ok) {
        console.error("[acessos-oauth] org http", orgResp.status, rawOrg);
      } else {
        const orgJson = JSON.parse(rawOrg);
        const candidate =
          orgJson?.data?.zoid ??
          (Array.isArray(orgJson?.data) ? orgJson.data[0]?.zoid : undefined) ??
          orgJson?.zoid;
        if (candidate !== undefined && candidate !== null) zoid = String(candidate);
        else console.error("[acessos-oauth] zoid nao encontrado:", rawOrg);
      }
    } catch (e) {
      console.error("[acessos-oauth] falha ao buscar org:", e);
    }
  }

  // 3) Persist.
  const nowIso = new Date().toISOString();
  const { error: upErr } = await sb
    .from("acessos_conexoes")
    .update({ refresh_token: refreshToken, org_id: zoid, conectado_em: nowIso, atualizado_em: nowIso })
    .eq("provedor", "zoho");
  if (upErr) return fail("falha_ao_salvar", upErr.message);

  return redirect(`${APP_RETURN}?zoho=ok`);
}

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);
  if (url.pathname.includes("/callback/zoho")) return await handleCallback(url);
  return new Response("not found", { status: 404 });
});
