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
//   Microsoft OneDrive (personal account, via Microsoft Graph):
//   - microsoft.status       -> { connected, conectado_em }  (never leaks secrets)
//   - microsoft.authUrl      -> mints+stores state, returns consumers consent { url }
//   - microsoft.browse       -> folder picker: lists child FOLDERS of itemId|root
//   - microsoft.addFolder    -> insert acessos_recursos (tipo=onedrive), dedup by external_id
//   - microsoft.folders      -> lists managed acessos_recursos (tipo=onedrive)
//   - microsoft.removeFolder -> deletes an acessos_recursos row
//   - microsoft.shares       -> lists driveItem permissions normalized
//   - microsoft.allShares    -> all managed folders x permissions (flat, for Auditoria)
//   - microsoft.share        -> POST /invite (read|write)
//   - microsoft.unshare      -> DELETE a permission
//   - microsoft.revokeForEmail -> offboarding: remove email from ALL managed OneDrive folders
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
// Microsoft OneDrive (personal/consumer account).
// VERIFIED (Microsoft Learn — Microsoft identity platform v2 OAuth, June 2026:
//   https://learn.microsoft.com/en-us/entra/identity-platform/v2-oauth2-auth-code-flow ;
//   https://learn.microsoft.com/en-us/graph/auth-v2-user ): the "/consumers" tenant
// serves personal Microsoft accounts (MSA). Graph base + driveItem endpoints verified at
//   https://learn.microsoft.com/en-us/graph/api/driveitem-invite
//   https://learn.microsoft.com/en-us/graph/api/driveitem-list-permissions
//   https://learn.microsoft.com/en-us/graph/api/driveitem-list-children
const MS_CALLBACK_URI =
  "https://kounqtdoioootxqegkij.supabase.co/functions/v1/acessos-oauth/callback/microsoft";
const MS_AUTH_URL = "https://login.microsoftonline.com/consumers/oauth2/v2.0/authorize";
const MS_TOKEN_URL = "https://login.microsoftonline.com/consumers/oauth2/v2.0/token";
const GRAPH_BASE = "https://graph.microsoft.com/v1.0";

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
): Promise<{ users: Array<{ accountId: string; zuid: string | null; name: string; email: string }>; rawCount: number }> {
  const dc = dcSuffix(conn.data_center);
  const out: Array<{ accountId: string; zuid: string | null; name: string; email: string }> = [];
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
        out.push({ accountId: String(accountId), zuid: u?.zuid != null ? String(u.zuid) : null, name: name || String(email), email: String(email) });
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
// Fetch a user's photo from the Zoho Contacts thumbnail endpoint, keyed by zuid.
// CONFIRMED working: GET https://contacts.zoho<dc>/file?ID=<zuid>&fs=thumb  -> image/png
// (the documented Mail /accounts/<id>/photo path 404s; this contacts path returns the avatar).
async function fetchZohoPhoto(
  conn: any,
  access: string,
  zuid: string,
): Promise<{ bytes: Uint8Array; contentType: string } | null> {
  const dc = dcSuffix(conn.data_center);
  const url = `https://contacts.zoho${dc}/file?ID=${encodeURIComponent(zuid)}&fs=thumb`;
  try {
    const resp = await fetch(url, {
      headers: { Authorization: `Zoho-oauthtoken ${access}` },
    });
    const ct = resp.headers.get("content-type") || "";
    if (!resp.ok || !ct.toLowerCase().startsWith("image/")) {
      console.warn("[acessos-proxy] photo skip", resp.status, "ct", ct, "zuid", zuid);
      return null;
    }
    const buf = new Uint8Array(await resp.arrayBuffer());
    if (buf.byteLength === 0) return null;
    return { bytes: buf, contentType: ct.split(";")[0].trim() };
  } catch (e) {
    console.warn("[acessos-proxy] photo erro", zuid, e instanceof Error ? e.message : e);
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

// --- Microsoft OneDrive helpers ---

async function readMsConn(sb: any) {
  const { data, error } = await sb
    .from("acessos_conexoes")
    .select("client_id, client_secret, refresh_token, escopos, conectado_em")
    .eq("provedor", "microsoft")
    .single();
  if (error || !data) throw new Error(error?.message || "conexao_microsoft_inexistente");
  return data;
}

// Fresh Graph access token from the stored refresh_token. No caching.
// VERIFIED form params (Microsoft Learn, v2 auth-code flow): client_id, scope,
// refresh_token, grant_type=refresh_token, client_secret -> { access_token }.
async function freshMsToken(conn: {
  client_id: string;
  client_secret: string;
  refresh_token: string;
  escopos?: string | null;
}): Promise<string> {
  const scope = (conn.escopos && String(conn.escopos).trim()) ||
    "Files.ReadWrite offline_access User.Read";
  const body = new URLSearchParams({
    client_id: conn.client_id,
    scope,
    refresh_token: conn.refresh_token,
    grant_type: "refresh_token",
    client_secret: conn.client_secret,
  });
  const resp = await fetch(MS_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const j: any = await resp.json().catch(() => ({}));
  if (!resp.ok || !j?.access_token) {
    throw new Error(`ms_token_refresh_falhou http ${resp.status} ${JSON.stringify(j)}`);
  }
  return j.access_token as string;
}

// Thin Graph fetch wrapper. Returns { ok, status, json } — never throws on HTTP errors,
// so callers can translate to a clean { error:'graph_http_<status>', detalhe }.
async function graphFetch(
  access: string,
  path: string,
  init?: { method?: string; body?: unknown },
): Promise<{ ok: boolean; status: number; json: any }> {
  const headers: Record<string, string> = { Authorization: `Bearer ${access}` };
  const opts: RequestInit = { method: init?.method || "GET", headers };
  if (init?.body !== undefined) {
    headers["Content-Type"] = "application/json";
    opts.body = JSON.stringify(init.body);
  }
  const resp = await fetch(`${GRAPH_BASE}${path}`, opts);
  // DELETE returns 204 with empty body.
  let j: any = null;
  const text = await resp.text();
  if (text) {
    try {
      j = JSON.parse(text);
    } catch {
      j = { raw: text.slice(0, 800) };
    }
  }
  return { ok: resp.ok, status: resp.status, json: j };
}

function graphErr(status: number, detalhe: unknown) {
  return json({ error: `graph_http_${status}`, detalhe });
}

async function logMs(
  sb: any,
  quem: string | null,
  acao: string,
  alvo: string | null,
  resultado: string,
  detalhe: unknown,
) {
  try {
    await sb.from("acessos_log").insert({
      quem,
      acao,
      provedor: "microsoft",
      alvo,
      resultado,
      detalhe: typeof detalhe === "string" ? detalhe : JSON.stringify(detalhe),
    });
  } catch (e) {
    console.warn("[acessos-proxy] log microsoft falhou", acao, e instanceof Error ? e.message : e);
  }
}

// Parse a Graph permission into { name, email } defensively across the shapes that
// personal-account OneDrive returns: grantedToV2 (direct), grantedToIdentitiesV2[]
// (link/invite targets), invitation.email, link (sharing link, no identity).
function parsePermIdentity(p: any): { name: string; email: string } {
  const fromIdentitySet = (idset: any): { name: string; email: string } | null => {
    if (!idset) return null;
    const u = idset.user || idset.siteUser || idset.group || idset.application;
    if (u) {
      return {
        name: (u.displayName && String(u.displayName)) || "",
        email: (u.email && String(u.email)) || (u.loginName && String(u.loginName)) || "",
      };
    }
    return null;
  };
  let id = fromIdentitySet(p?.grantedToV2);
  if (!id && Array.isArray(p?.grantedToIdentitiesV2) && p.grantedToIdentitiesV2.length) {
    id = fromIdentitySet(p.grantedToIdentitiesV2[0]);
  }
  if (!id && p?.invitation?.email) {
    id = { name: p.invitation.invitedBy?.user?.displayName || "", email: String(p.invitation.email) };
  }
  if (!id && p?.link) {
    // Sharing link with no specific identity.
    id = { name: p.link.scope ? `Link (${p.link.scope})` : "Link de compartilhamento", email: "" };
  }
  return id || { name: "", email: "" };
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

      // Best-effort avatar (Zoho contacts thumbnail, keyed by zuid).
      try {
        const photo = u.zuid ? await fetchZohoPhoto(conn, access, u.zuid) : null;
        if (photo) {
          const ext = photo.contentType.includes("png") ? "png" : "jpg";
          const path = `${pessoaId}.${ext}`;
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

// Suspend / reactivate a Zoho mailbox by the person's email.
// CONFIRMED live (June 2026): PUT https://mail.zoho<dc>/api/organization/accounts/<accountId>
//   header Authorization: Zoho-oauthtoken <access>; body { mode:'disableUser'|'enableUser', zuid }
//   -> 200 with { status:{ code:200, ... } } on success.
// The accountId + zuid are resolved by listing the org accounts (zoid-less path) and
// matching the email against primaryEmailAddress / mailboxAddress.
async function actZohoSetUser(sb: any, email: string | null, mode: string) {
  try {
    if (!email) return json({ error: "sem_email" });
    const conn = await readZohoConn(sb);
    if (!conn.refresh_token) return json({ error: "nao_conectado" });
    const access = await freshAccessToken(conn);
    const dc = dcSuffix(conn.data_center);
    const base = `https://mail.zoho${dc}/api/organization/accounts`;

    // Find the account by email.
    const listResp = await fetch(`${base}?limit=200`, {
      headers: { Authorization: `Zoho-oauthtoken ${access}` },
    });
    const listRaw = await listResp.text();
    if (!listResp.ok) {
      console.error("[acessos-proxy] zoho.setUser list http", listResp.status, listRaw.slice(0, 800));
      return json({ error: "zoho_" + mode + "_falhou", detalhe: `list http ${listResp.status}` });
    }
    let data: any;
    try {
      data = JSON.parse(listRaw);
    } catch {
      return json({ error: "zoho_" + mode + "_falhou", detalhe: "list parse" });
    }
    const target = email.toLowerCase();
    const u = (data.data || []).find(
      (x: any) =>
        String(x.primaryEmailAddress || "").toLowerCase() === target ||
        String(x.mailboxAddress || "").toLowerCase() === target,
    );
    if (!u) return json({ error: "usuario_zoho_nao_encontrado" });

    const accountId = u.accountId;
    const zuid = String(u.zuid);

    const putResp = await fetch(`${base}/${accountId}`, {
      method: "PUT",
      headers: {
        Authorization: "Zoho-oauthtoken " + access,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ mode, zuid }),
    });
    const putRaw = await putResp.text();
    let parsed: any = null;
    try {
      parsed = putRaw ? JSON.parse(putRaw) : null;
    } catch {
      parsed = null;
    }
    const ok =
      putResp.ok && (parsed?.status?.code === 200 || parsed?.status?.code === 201);
    if (!ok) {
      console.error("[acessos-proxy] zoho.setUser put falhou", mode, putResp.status, putRaw.slice(0, 800));
      return json({
        error: "zoho_" + mode + "_falhou",
        detalhe: parsed?.status ?? `http ${putResp.status} ${putRaw.slice(0, 300)}`,
      });
    }

    const acao = mode === "disableUser" ? "zoho.suspend" : "zoho.reactivate";
    try {
      await sb.from("acessos_log").insert({
        quem: null,
        acao,
        provedor: "zoho",
        alvo: email,
        resultado: "ok",
        detalhe: JSON.stringify({ accountId: String(accountId), zuid, mode }),
      });
    } catch (e) {
      console.warn("[acessos-proxy] log " + acao + " falhou", e instanceof Error ? e.message : e);
    }

    return json({ ok: true, accao: mode });
  } catch (e) {
    console.error("[acessos-proxy] zoho.setUser erro", mode, e instanceof Error ? e.message : e);
    return json({ error: "zoho_" + mode + "_falhou", detalhe: e instanceof Error ? e.message : String(e) });
  }
}

// ---- Microsoft OneDrive actions ----

async function msStatus(sb: any) {
  const conn = await readMsConn(sb);
  return json({
    connected: !!conn.refresh_token,
    conectado_em: conn.conectado_em ?? null,
  });
}

async function msAuthUrl(sb: any) {
  const conn = await readMsConn(sb);
  const state = randomState();
  const { error } = await sb
    .from("acessos_conexoes")
    .update({ oauth_state: state, oauth_state_em: new Date().toISOString() })
    .eq("provedor", "microsoft");
  if (error) return json({ error: "falha_ao_gravar_state", detalhe: error.message }, 500);

  const scope = (conn.escopos && String(conn.escopos).trim()) ||
    "Files.ReadWrite offline_access User.Read";
  const params = new URLSearchParams({
    client_id: conn.client_id,
    response_type: "code",
    redirect_uri: MS_CALLBACK_URI,
    response_mode: "query",
    scope,
    state,
  });
  return json({ url: `${MS_AUTH_URL}?${params.toString()}` });
}

async function msBrowse(sb: any, itemId: string | null) {
  const conn = await readMsConn(sb);
  if (!conn.refresh_token) return json({ error: "nao_conectado" });
  const access = await freshMsToken(conn);
  const path = itemId
    ? `/me/drive/items/${encodeURIComponent(itemId)}/children`
    : `/me/drive/root/children`;
  const r = await graphFetch(access, path);
  if (!r.ok) return graphErr(r.status, r.json);
  const value: any[] = Array.isArray(r.json?.value) ? r.json.value : [];
  // FILTER to folders only (item.folder != null).
  const folders = value
    .filter((it) => it && it.folder != null)
    .map((it) => ({
      id: String(it.id),
      name: String(it.name ?? ""),
      childCount: it.folder?.childCount ?? 0,
    }));
  return json({ folders, parentId: itemId || null });
}

async function msAddFolder(
  sb: any,
  quem: string | null,
  itemId: string,
  name: string,
  caminho: string | null,
) {
  if (!itemId) return json({ error: "sem_itemId" }, 400);
  // Avoid duplicates: same external_id already managed -> return it.
  const { data: existing } = await sb
    .from("acessos_recursos")
    .select("*")
    .eq("external_id", itemId)
    .maybeSingle();
  if (existing) return json({ recurso: existing, jaExistia: true });

  const { data: inserted, error: insErr } = await sb
    .from("acessos_recursos")
    .insert({
      tipo: "onedrive",
      provedor: "microsoft",
      nome: name || "(sem nome)",
      external_id: itemId,
      caminho: caminho ?? null,
    })
    .select("*")
    .single();
  if (insErr) return json({ error: "falha_ao_inserir", detalhe: insErr.message }, 500);

  await logMs(sb, quem, "onedrive.addFolder", inserted.id, "ok", { itemId, name });
  return json({ recurso: inserted });
}

async function msFolders(sb: any) {
  const { data, error } = await sb
    .from("acessos_recursos")
    .select("*")
    .eq("tipo", "onedrive")
    .order("nome", { ascending: true });
  if (error) return json({ error: "falha_ao_listar", detalhe: error.message }, 500);
  return json({ folders: data ?? [] });
}

async function msRemoveFolder(sb: any, quem: string | null, recursoId: string) {
  if (!recursoId) return json({ error: "sem_recursoId" }, 400);
  const { error } = await sb.from("acessos_recursos").delete().eq("id", recursoId);
  if (error) return json({ error: "falha_ao_remover", detalhe: error.message }, 500);
  await logMs(sb, quem, "onedrive.removeFolder", recursoId, "ok", { recursoId });
  return json({ ok: true });
}

async function msShares(sb: any, itemId: string) {
  if (!itemId) return json({ error: "sem_itemId" }, 400);
  const conn = await readMsConn(sb);
  if (!conn.refresh_token) return json({ error: "nao_conectado" });
  const access = await freshMsToken(conn);
  const r = await graphFetch(access, `/me/drive/items/${encodeURIComponent(itemId)}/permissions`);
  if (!r.ok) return graphErr(r.status, r.json);
  const value: any[] = Array.isArray(r.json?.value) ? r.json.value : [];
  const shares = value
    // Skip the owner permission (not a "share" to manage).
    .filter((p) => !(Array.isArray(p?.roles) && p.roles.includes("owner")))
    .map((p) => {
      const roles: string[] = Array.isArray(p?.roles) ? p.roles : [];
      const role = roles.includes("write") ? "edição" : "leitura";
      const ident = parsePermIdentity(p);
      return { permId: String(p.id), name: ident.name, email: ident.email, role };
    });
  return json({ shares });
}

async function msShare(
  sb: any,
  quem: string | null,
  itemId: string,
  email: string,
  role: string,
) {
  if (!itemId || !email) return json({ error: "sem_itemId_ou_email" }, 400);
  const conn = await readMsConn(sb);
  if (!conn.refresh_token) return json({ error: "nao_conectado" });
  const access = await freshMsToken(conn);
  const graphRole = role === "edição" ? "write" : "read";
  // VERIFIED invite body (Microsoft Learn driveItem:invite). sendInvitation:false so no
  // email is sent (we manage access programmatically); requireSignIn:true forces auth.
  const r = await graphFetch(access, `/me/drive/items/${encodeURIComponent(itemId)}/invite`, {
    method: "POST",
    body: {
      recipients: [{ email }],
      roles: [graphRole],
      requireSignIn: true,
      sendInvitation: false,
    },
  });
  if (!r.ok) {
    await logMs(sb, quem, "onedrive.share", itemId, "erro", { email, role, status: r.status, detalhe: r.json });
    return json({ error: `graph_http_${r.status}`, detalhe: r.json });
  }
  await logMs(sb, quem, "onedrive.share", itemId, "ok", { email, role: graphRole });
  return json({ ok: true });
}

async function actAllShares(sb: any) {
  const conn = await readMsConn(sb);
  if (!conn.refresh_token) return json({ error: "nao_conectado" });
  const access = await freshMsToken(conn);

  const { data: recursos } = await sb
    .from("acessos_recursos")
    .select("id, nome, external_id")
    .eq("tipo", "onedrive");

  const items: Array<{
    recursoId: string;
    pasta: string;
    name: string;
    email: string;
    role: string;
  }> = [];

  for (const recurso of (recursos ?? [])) {
    if (!recurso.external_id) continue;
    try {
      const r = await graphFetch(
        access,
        `/me/drive/items/${encodeURIComponent(recurso.external_id)}/permissions`,
      );
      if (!r.ok) {
        console.warn(
          "[acessos-proxy] allShares: falha ao ler permissoes da pasta",
          recurso.nome,
          r.status,
          r.json,
        );
        continue;
      }
      const value: any[] = Array.isArray(r.json?.value) ? r.json.value : [];
      for (const p of value) {
        if (Array.isArray(p?.roles) && p.roles.includes("owner")) continue;
        const ident = parsePermIdentity(p);
        const role =
          Array.isArray(p?.roles) && p.roles.includes("write") ? "edição" : "leitura";
        items.push({
          recursoId: String(recurso.id),
          pasta: String(recurso.nome ?? ""),
          name: ident.name,
          email: (ident.email || "").toLowerCase(),
          role,
        });
      }
    } catch (e) {
      console.warn(
        "[acessos-proxy] allShares: erro ao processar pasta",
        recurso.nome,
        e instanceof Error ? e.message : e,
      );
    }
  }

  return json({ items });
}

async function actRevokeForEmail(sb: any, email: string | null) {
  if (!email) return json({ error: "sem_email" });
  const conn = await readMsConn(sb);
  if (!conn.refresh_token) return json({ error: "nao_conectado" });
  const access = await freshMsToken(conn);

  const { data: recursos } = await sb
    .from("acessos_recursos")
    .select("id, nome, external_id")
    .eq("tipo", "onedrive");

  const target = email.toLowerCase();
  let removed = 0;
  const folders: string[] = [];

  for (const recurso of (recursos ?? [])) {
    if (!recurso.external_id) continue;
    try {
      const r = await graphFetch(
        access,
        `/me/drive/items/${encodeURIComponent(recurso.external_id)}/permissions`,
      );
      if (!r.ok) {
        console.warn(
          "[acessos-proxy] revokeForEmail: falha ao ler permissoes da pasta",
          recurso.nome,
          r.status,
          r.json,
        );
        continue;
      }
      const value: any[] = Array.isArray(r.json?.value) ? r.json.value : [];
      for (const p of value) {
        if (Array.isArray(p?.roles) && p.roles.includes("owner")) continue;
        const ident = parsePermIdentity(p);
        if ((ident.email || "").toLowerCase() !== target) continue;
        const del = await graphFetch(
          access,
          `/me/drive/items/${encodeURIComponent(recurso.external_id)}/permissions/${encodeURIComponent(p.id)}`,
          { method: "DELETE" },
        );
        if (del.ok) {
          removed++;
          folders.push(String(recurso.nome ?? ""));
        } else {
          console.warn(
            "[acessos-proxy] revokeForEmail: DELETE falhou",
            recurso.nome,
            p.id,
            del.status,
            del.json,
          );
        }
      }
    } catch (e) {
      console.warn(
        "[acessos-proxy] revokeForEmail: erro ao processar pasta",
        recurso.nome,
        e instanceof Error ? e.message : e,
      );
    }
  }

  await logMs(sb, null, "onedrive.revoke", email, "ok", removed + " acessos");
  return json({ removed, folders });
}

async function msUnshare(sb: any, quem: string | null, itemId: string, permId: string) {
  if (!itemId || !permId) return json({ error: "sem_itemId_ou_permId" }, 400);
  const conn = await readMsConn(sb);
  if (!conn.refresh_token) return json({ error: "nao_conectado" });
  const access = await freshMsToken(conn);
  const r = await graphFetch(
    access,
    `/me/drive/items/${encodeURIComponent(itemId)}/permissions/${encodeURIComponent(permId)}`,
    { method: "DELETE" },
  );
  if (!r.ok) {
    await logMs(sb, quem, "onedrive.unshare", itemId, "erro", { permId, status: r.status, detalhe: r.json });
    return json({ error: `graph_http_${r.status}`, detalhe: r.json });
  }
  await logMs(sb, quem, "onedrive.unshare", itemId, "ok", { permId });
  return json({ ok: true });
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
      case "zoho.suspend":
        return await actZohoSetUser(sb, body.email, "disableUser");
      case "zoho.reactivate":
        return await actZohoSetUser(sb, body.email, "enableUser");
      case "microsoft.status":
        return await msStatus(sb);
      case "microsoft.authUrl":
        return await msAuthUrl(sb);
      case "microsoft.browse":
        return await msBrowse(sb, body?.itemId ?? null);
      case "microsoft.addFolder":
        return await msAddFolder(sb, user.id, body?.itemId, body?.name, body?.caminho ?? null);
      case "microsoft.folders":
        return await msFolders(sb);
      case "microsoft.removeFolder":
        return await msRemoveFolder(sb, user.id, body?.recursoId);
      case "microsoft.shares":
        return await msShares(sb, body?.itemId);
      case "microsoft.allShares":
        return await actAllShares(sb);
      case "microsoft.share":
        return await msShare(sb, user.id, body?.itemId, body?.email, body?.role);
      case "microsoft.unshare":
        return await msUnshare(sb, user.id, body?.itemId, body?.permId);
      case "microsoft.revokeForEmail":
        return await actRevokeForEmail(sb, body?.email ?? null);
      default:
        return json({ error: "acao_desconhecida", action: action ?? null }, 400);
    }
  } catch (e) {
    console.error("[acessos-proxy] erro acao", action, e instanceof Error ? e.message : e);
    return json({ error: "falha_interna", detalhe: e instanceof Error ? e.message : String(e) }, 500);
  }
});
