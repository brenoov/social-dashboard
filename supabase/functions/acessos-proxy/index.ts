// Supabase Edge Function: acessos-proxy
// The ONLY caller-facing endpoint for the Zoho integration of
// "Controle de Acesso e Colaboradores". verify_jwt is TRUE at the platform level,
// but we ALSO re-verify the caller and gate to admins here (defense in depth).
//
// Auth gate (every request):
//   1) Read caller JWT from Authorization header; resolve user via a user-scoped client.
//   2) With a SERVICE-ROLE client, read public.profiles for that uid and allow only if
//      role='admin' OR 'acessos' = any(features)  (mirrors SQL is_acessos_admin()).
//
// Body: POST JSON { action, ...args }. Actions:
//   - zoho.status   -> { connected, org_id, conectado_em }  (never leaks secrets)
//   - zoho.authUrl  -> mints+stores random state, returns consent { url }
//   - zoho.users    -> lists org accounts (normalized)
//   - zoho.import   -> upserts acessos_pessoas + best-effort avatars
//
// ---------------------------------------------------------------------------
// VERIFIED Zoho endpoints / fields (June 2026), with sources:
//
// * OAuth token (refresh): POST https://accounts.zoho<dc>/oauth/v2/token
//     form: grant_type=refresh_token, client_id, client_secret, refresh_token
//     -> { access_token, ... }
//     Source: https://www.zoho.com/mail/help/api/using-oauth-2.html
//
// * List org accounts: GET https://mail.zoho<dc>/api/organization/<zoid>/accounts
//     ?start=<n>&limit=<n>  (default start=0, limit=10 -> we page explicitly)
//     Header: Authorization: Zoho-oauthtoken <access>
//     Response: { status:{...}, data:[ { accountId, zuid, firstName, lastName,
//       displayName, accountDisplayName, primaryEmailAddress, mailboxAddress,
//       emailAddress:[{ mailId, isPrimary, isAlias, isConfirmed }], ... ~70 fields } ] }
//     Sources:
//       https://www.zoho.com/mail/help/api/get-org-users-details.html
//       https://www.zoho.com/mail/help/api/organization-api.html
//   CONFIRMED field names: accountId, zuid, displayName, firstName, lastName,
//   primaryEmailAddress, mailboxAddress, emailAddress[].mailId. We read defensively
//   and fall back across these in case a tenant returns a subset.
//
// * USER PHOTO: NOT documented in the Zoho Mail REST API (index/account-api pages
//   list no photo endpoint as of June 2026). We attempt, defensively and best-effort:
//       GET https://mail.zoho<dc>/api/accounts/<accountId>/photo
//     and accept the body ONLY if the response is ok AND content-type is image/*.
//   Anything else (404 / HTML / JSON error) is treated as "no photo" and skipped
//   (NOT fatal). The raw status/content-type is logged so we can validate the real
//   endpoint shape against a live connection and adjust the path if Zoho differs.
//   Sources (absence of a documented endpoint):
//     https://www.zoho.com/mail/help/api/   https://www.zoho.com/mail/help/api/account-api.html
// ---------------------------------------------------------------------------

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const AVATAR_BUCKET = "acessos-avatars";
const CALLBACK_URI =
  "https://kounqtdoioootxqegkij.supabase.co/functions/v1/acessos-oauth/callback/zoho";

const ALLOW_ORIGIN = "https://socialdashboard.rbvcompany.com";
const CORS = {
  "Access-Control-Allow-Origin": ALLOW_ORIGIN,
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  Vary: "Origin",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}
function admin() {
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
function dcSuffix(raw: unknown): string {
  let dc = (typeof raw === "string" ? raw : "").trim();
  if (!dc) return ".com";
  if (!dc.startsWith(".")) dc = "." + dc;
  return dc;
}
function randomState(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

// Fresh access token from the stored refresh_token. No caching.
async function freshAccessToken(row: {
  client_id: string;
  client_secret: string;
  refresh_token: string;
  data_center: string;
}): Promise<string> {
  const dc = dcSuffix(row.data_center);
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: row.client_id,
    client_secret: row.client_secret,
    refresh_token: row.refresh_token,
  });
  const resp = await fetch(`https://accounts.zoho${dc}/oauth/v2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const j: any = await resp.json().catch(() => ({}));
  if (!resp.ok || !j?.access_token) {
    throw new Error(`token_refresh_falhou http ${resp.status} ${JSON.stringify(j)}`);
  }
  return j.access_token as string;
}

// Page through the org accounts and normalize.
async function listZohoUsers(
  conn: any,
  access: string,
): Promise<{ users: Array<{ accountId: string; name: string; email: string }>; rawCount: number }> {
  const dc = dcSuffix(conn.data_center);
  const out: Array<{ accountId: string; name: string; email: string }> = [];
  let start = 0;
  const limit = 50;
  let rawCount = 0;

  // The /api/organization/accounts endpoint (WITHOUT a zoid in the path) returns the
  // CURRENT org's accounts and works with the ZohoMail.organization.accounts scope.
  // (Getting the zoid itself requires the partner scope, which a regular org admin
  // can't grant — and we don't need it: the zoid-less path is the current org.)
  // Page until a short page is returned.
  for (let page = 0; page < 200; page++) {
    const url = `https://mail.zoho${dc}/api/organization/accounts?start=${start}&limit=${limit}`;
    const resp = await fetch(url, {
      headers: { Authorization: `Zoho-oauthtoken ${access}` },
    });
    const raw = await resp.text();
    if (!resp.ok) {
      console.error("[acessos-proxy] users http", resp.status, raw.slice(0, 800));
      throw new Error(`zoho_users_http_${resp.status}`);
    }
    let parsed: any;
    try {
      parsed = JSON.parse(raw);
    } catch {
      console.error("[acessos-proxy] users parse falhou:", raw.slice(0, 800));
      throw new Error("zoho_users_parse");
    }
    const data: any[] = Array.isArray(parsed?.data) ? parsed.data : [];
    rawCount += data.length;

    for (const u of data) {
      try {
        const accountId =
          u?.accountId ?? u?.zuid ?? u?.account_id ?? u?.zid ?? null;
        if (accountId == null) {
          console.error("[acessos-proxy] usuario sem accountId/zuid:", JSON.stringify(u).slice(0, 400));
          continue;
        }
        const name =
          (u?.displayName && String(u.displayName).trim()) ||
          (u?.accountDisplayName && String(u.accountDisplayName).trim()) ||
          [u?.firstName, u?.lastName].filter(Boolean).join(" ").trim() ||
          "";
        let email =
          (u?.primaryEmailAddress && String(u.primaryEmailAddress)) ||
          (u?.mailboxAddress && String(u.mailboxAddress)) ||
          "";
        if (!email && Array.isArray(u?.emailAddress)) {
          const primary = u.emailAddress.find((e: any) => e?.isPrimary) ?? u.emailAddress[0];
          email = primary?.mailId ?? primary?.emailAddress ?? "";
        }
        out.push({ accountId: String(accountId), name: name || String(email), email: String(email) });
      } catch (e) {
        console.error("[acessos-proxy] falha ao normalizar usuario:", e, JSON.stringify(u).slice(0, 400));
      }
    }

    if (data.length < limit) break; // last page
    start += limit;
  }
  return { users: out, rawCount };
}

// Best-effort fetch of a user's photo bytes. Returns null if unavailable / not an image.
async function fetchZohoPhoto(
  conn: any,
  access: string,
  accountId: string,
): Promise<{ bytes: Uint8Array; contentType: string } | null> {
  const dc = dcSuffix(conn.data_center);
  // NOTE: photo endpoint is NOT documented; this is a best-effort probe (see header).
  const url = `https://mail.zoho${dc}/api/accounts/${accountId}/photo`;
  try {
    const resp = await fetch(url, {
      headers: { Authorization: `Zoho-oauthtoken ${access}` },
    });
    const ct = resp.headers.get("content-type") || "";
    if (!resp.ok) {
      console.warn("[acessos-proxy] photo http", resp.status, "ct", ct, "acct", accountId);
      return null;
    }
    if (!ct.toLowerCase().startsWith("image/")) {
      console.warn("[acessos-proxy] photo nao-imagem ct", ct, "acct", accountId);
      return null;
    }
    const buf = new Uint8Array(await resp.arrayBuffer());
    if (buf.byteLength === 0) return null;
    return { bytes: buf, contentType: ct };
  } catch (e) {
    console.warn("[acessos-proxy] photo erro", accountId, e instanceof Error ? e.message : e);
    return null;
  }
}

async function readZohoConn(sb: any) {
  const { data, error } = await sb
    .from("acessos_conexoes")
    .select(
      "client_id, client_secret, refresh_token, org_id, data_center, escopos, conectado_em",
    )
    .eq("provedor", "zoho")
    .single();
  if (error || !data) throw new Error(error?.message || "conexao_zoho_inexistente");
  return data;
}

// ---- actions ----

async function actStatus(sb: any) {
  const conn = await readZohoConn(sb);
  return json({
    connected: !!conn.refresh_token,
    org_id: conn.org_id ?? null,
    conectado_em: conn.conectado_em ?? null,
  });
}

async function actAuthUrl(sb: any) {
  const conn = await readZohoConn(sb);
  const dc = dcSuffix(conn.data_center);
  const state = randomState();
  const { error } = await sb
    .from("acessos_conexoes")
    .update({ oauth_state: state, oauth_state_em: new Date().toISOString() })
    .eq("provedor", "zoho");
  if (error) return json({ error: "falha_ao_gravar_state", detalhe: error.message }, 500);

  const scope = (conn.escopos && String(conn.escopos).trim()) || "ZohoMail.organization.accounts.READ";
  const params = new URLSearchParams({
    response_type: "code",
    access_type: "offline",
    prompt: "consent",
    client_id: conn.client_id,
    scope,
    redirect_uri: CALLBACK_URI,
    state,
  });
  const url = `https://accounts.zoho${dc}/oauth/v2/auth?${params.toString()}`;
  return json({ url });
}

async function actUsers(sb: any) {
  const conn = await readZohoConn(sb);
  if (!conn.refresh_token) return json({ error: "nao_conectado" });
  const access = await freshAccessToken(conn);
  const { users, rawCount } = await listZohoUsers(conn, access);
  return json({ count: rawCount, users });
}

async function actImport(sb: any, quem: string | null) {
  const conn = await readZohoConn(sb);
  if (!conn.refresh_token) return json({ error: "nao_conectado" });
  const access = await freshAccessToken(conn);
  const { users } = await listZohoUsers(conn, access);

  let criados = 0;
  let atualizados = 0;
  let com_foto = 0;
  let erros = 0;

  for (const u of users) {
    try {
      // Upsert keyed by zoho_account_id.
      const { data: existing, error: selErr } = await sb
        .from("acessos_pessoas")
        .select("id")
        .eq("zoho_account_id", u.accountId)
        .maybeSingle();
      if (selErr) throw selErr;

      let pessoaId: string;
      if (existing?.id) {
        const { error: upErr } = await sb
          .from("acessos_pessoas")
          .update({
            nome: u.name || undefined,
            email_corporativo: u.email || undefined,
            atualizado_em: new Date().toISOString(),
          })
          .eq("id", existing.id);
        if (upErr) throw upErr;
        pessoaId = existing.id;
        atualizados++;
      } else {
        const { data: ins, error: insErr } = await sb
          .from("acessos_pessoas")
          .insert({
            nome: u.name || u.email || "Sem nome",
            email_corporativo: u.email || null,
            status: "ativo",
            setor_id: null,
            zoho_account_id: u.accountId,
          })
          .select("id")
          .single();
        if (insErr) throw insErr;
        pessoaId = ins.id;
        criados++;
      }

      // Best-effort avatar.
      try {
        const photo = await fetchZohoPhoto(conn, access, u.accountId);
        if (photo) {
          const path = `${pessoaId}.jpg`;
          const { error: stErr } = await sb.storage
            .from(AVATAR_BUCKET)
            .upload(path, photo.bytes, { contentType: photo.contentType, upsert: true });
          if (stErr) {
            console.warn("[acessos-proxy] upload avatar falhou", pessoaId, stErr.message);
          } else {
            const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/${AVATAR_BUCKET}/${path}`;
            await sb.from("acessos_pessoas").update({ avatar_url: publicUrl }).eq("id", pessoaId);
            com_foto++;
          }
        }
      } catch (e) {
        console.warn("[acessos-proxy] avatar erro", u.accountId, e instanceof Error ? e.message : e);
      }
    } catch (e) {
      erros++;
      console.error("[acessos-proxy] import erro usuario", u.accountId, e instanceof Error ? e.message : e);
    }
  }

  const resumo = { criados, atualizados, com_foto, erros, total: users.length };
  try {
    await sb.from("acessos_log").insert({
      quem,
      acao: "zoho.import",
      provedor: "zoho",
      alvo: "acessos_pessoas",
      resultado: erros > 0 ? "parcial" : "ok",
      detalhe: JSON.stringify(resumo),
    });
  } catch (e) {
    console.warn("[acessos-proxy] log import falhou", e instanceof Error ? e.message : e);
  }

  return json(resumo);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (req.method !== "POST") return json({ error: "metodo_invalido" }, 405);

  // --- Auth gate ---
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "sem_token" }, 401);

  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  const user = userData?.user;
  if (userErr || !user) return json({ error: "nao_autenticado" }, 401);

  const sb = admin();
  const { data: prof, error: profErr } = await sb
    .from("profiles")
    .select("role, features")
    .eq("id", user.id)
    .single();
  if (profErr || !prof) return json({ error: "perfil_inexistente" }, 403);
  const isAdmin =
    prof.role === "admin" || (Array.isArray(prof.features) && prof.features.includes("acessos"));
  if (!isAdmin) return json({ error: "sem_permissao" }, 403);

  // --- Dispatch ---
  let body: any;
  try {
    body = await req.json();
  } catch {
    return json({ error: "json_invalido" }, 400);
  }
  const action = body?.action;
  try {
    switch (action) {
      case "zoho.status":
        return await actStatus(sb);
      case "zoho.authUrl":
        return await actAuthUrl(sb);
      case "zoho.users":
        return await actUsers(sb);
      case "zoho.import":
        return await actImport(sb, user.id);
      default:
        return json({ error: "acao_desconhecida", action: action ?? null }, 400);
    }
  } catch (e) {
    console.error("[acessos-proxy] erro acao", action, e instanceof Error ? e.message : e);
    return json({ error: "falha_interna", detalhe: e instanceof Error ? e.message : String(e) }, 500);
  }
});
