// Supabase Edge Function: acessos-oauth
// Drives the Zoho OAuth "connect" flow for the "Controle de Acesso e Colaboradores" module.
//
// Routes (dispatched by URL path; Supabase routes the full path to the function):
//   GET .../acessos-oauth/start/zoho      -> 302 to the Zoho consent screen
//   GET .../acessos-oauth/callback/zoho   -> exchanges code, fetches zoid, persists, 302 back to the app
//   anything else                         -> 404
//
// Verified Zoho endpoints (June 2026):
//   * OAuth authorize: https://accounts.zoho<dc>/oauth/v2/auth
//   * OAuth token:     https://accounts.zoho<dc>/oauth/v2/token  (POST, form-urlencoded)
//       - grant_type=authorization_code returns: access_token, refresh_token, api_domain,
//         token_type=Bearer, expires_in=3600. The refresh_token is only returned on the
//         FIRST consent, so we force prompt=consent + access_type=offline to always get one.
//       Source: https://www.zoho.com/accounts/protocol/oauth/web-apps/access-token.html
//   * Org id (zoid):   GET https://mail.zoho<dc>/api/organization  (no zoid path param needed;
//         returns the CURRENT org). Auth header: "Authorization: Zoho-oauthtoken <access_token>".
//         Response shape: { status: {...}, data: { zoid: <number>, ... } } -> we read data.zoid.
//       Sources: https://www.zoho.com/mail/help/api/get-org-details.html
//                https://www.zoho.com/mail/help/api/getting-started-with-api.html
//   * Data center (.com / .com.br / .eu / ...) is stored in acessos_conexoes.data_center and
//     spliced into the host: accounts.zoho<dc> and mail.zoho<dc>.
//
// Security: client_id/client_secret/refresh_token are read from / written to the service-role
// table public.acessos_conexoes and NEVER leak into any redirect URL or response body.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Where to send the browser back to after the connect flow.
const APP_RETURN = "https://socialdashboard.rbvcompany.com/";
// The exact redirect URI registered in Zoho (must match byte-for-byte on token exchange).
const CALLBACK_URI =
  "https://kounqtdoioootxqegkij.supabase.co/functions/v1/acessos-oauth/callback/zoho";

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

// Normalize the data_center column into a host suffix (".com", ".com.br", ".eu", ...).
// Accepts "com", ".com", "com.br", etc. Defaults to ".com".
function dcSuffix(raw: unknown): string {
  let dc = (typeof raw === "string" ? raw : "").trim();
  if (!dc) return ".com";
  if (!dc.startsWith(".")) dc = "." + dc;
  return dc;
}

async function readZohoRow() {
  const sb = admin();
  const { data, error } = await sb
    .from("acessos_conexoes")
    .select("client_id, client_secret, data_center, escopos")
    .eq("provedor", "zoho")
    .single();
  if (error) throw new Error(`db_read: ${error.message}`);
  if (!data) throw new Error("db_read: linha zoho nao encontrada");
  return data as {
    client_id: string;
    client_secret: string;
    data_center: string | null;
    escopos: string | null;
  };
}

async function handleStart(): Promise<Response> {
  try {
    const row = await readZohoRow();
    const dc = dcSuffix(row.data_center);
    const escopos = row.escopos ?? "";
    const url = new URL(`https://accounts.zoho${dc}/oauth/v2/auth`);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("access_type", "offline");
    url.searchParams.set("prompt", "consent");
    url.searchParams.set("client_id", row.client_id);
    url.searchParams.set("scope", escopos);
    url.searchParams.set("redirect_uri", CALLBACK_URI);
    return redirect(url.toString());
  } catch (e) {
    return fail("falha_ao_iniciar", e instanceof Error ? e.message : e);
  }
}

async function handleCallback(reqUrl: URL): Promise<Response> {
  // Surface a user-denied / Zoho error param directly.
  const oauthErr = reqUrl.searchParams.get("error");
  if (oauthErr) return fail(oauthErr);

  const code = reqUrl.searchParams.get("code");
  if (!code) return fail("sem_code");

  let row: Awaited<ReturnType<typeof readZohoRow>>;
  try {
    row = await readZohoRow();
  } catch (e) {
    return fail("falha_ao_ler_credenciais", e instanceof Error ? e.message : e);
  }
  const dc = dcSuffix(row.data_center);

  // 1) Exchange the authorization code for tokens.
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

  // Zoho can return a 200 with an "error" field (e.g. invalid_code).
  if (tokenJson?.error) {
    console.error("[acessos-oauth] token erro", tokenJson);
    return fail("falha_token", tokenJson.error);
  }

  const refreshToken = tokenJson?.refresh_token;
  const accessToken = tokenJson?.access_token;
  if (!refreshToken) {
    // Without prompt=consent Zoho omits refresh_token on repeat consents; we force it,
    // so this should not happen — log the full response to diagnose if it ever does.
    console.error("[acessos-oauth] sem refresh_token. resposta:", tokenJson);
    return fail("sem_refresh_token");
  }

  // 2) Fetch the organization id (zoid). The Mail API host may be returned in
  //    api_domain, but the org endpoint lives on mail.zoho<dc>. Parse defensively:
  //    on any failure we still store the refresh_token (org_id stays null) so the
  //    connect is not lost — but we log the raw body.
  let zoid: string | null = null;
  if (accessToken) {
    try {
      const orgResp = await fetch(`https://mail.zoho${dc}/api/organization`, {
        method: "GET",
        headers: { Authorization: `Zoho-oauthtoken ${accessToken}` },
      });
      const rawOrg = await orgResp.text();
      if (!orgResp.ok) {
        console.error("[acessos-oauth] org http", orgResp.status, rawOrg);
      } else {
        try {
          const orgJson = JSON.parse(rawOrg);
          // Expected: { data: { zoid: <number> } }. Be tolerant of shape drift.
          const candidate =
            orgJson?.data?.zoid ??
            (Array.isArray(orgJson?.data) ? orgJson.data[0]?.zoid : undefined) ??
            orgJson?.zoid;
          if (candidate !== undefined && candidate !== null) {
            zoid = String(candidate);
          } else {
            console.error("[acessos-oauth] zoid nao encontrado no payload:", rawOrg);
          }
        } catch (pe) {
          console.error("[acessos-oauth] org json invalido:", rawOrg, pe);
        }
      }
    } catch (e) {
      console.error("[acessos-oauth] falha ao buscar org:", e);
    }
  }

  // 3) Persist refresh_token + org_id.
  try {
    const sb = admin();
    const nowIso = new Date().toISOString();
    const { error } = await sb
      .from("acessos_conexoes")
      .update({
        refresh_token: refreshToken,
        org_id: zoid,
        conectado_em: nowIso,
        atualizado_em: nowIso,
      })
      .eq("provedor", "zoho");
    if (error) {
      console.error("[acessos-oauth] update erro", error);
      return fail("falha_ao_salvar", error.message);
    }
  } catch (e) {
    return fail("falha_ao_salvar", e instanceof Error ? e.message : e);
  }

  return redirect(`${APP_RETURN}?zoho=ok`);
}

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);
  const path = url.pathname;

  if (path.endsWith("/start/zoho")) {
    return await handleStart();
  }
  if (path.includes("/callback/zoho")) {
    return await handleCallback(url);
  }
  return new Response("not found", { status: 404 });
});
