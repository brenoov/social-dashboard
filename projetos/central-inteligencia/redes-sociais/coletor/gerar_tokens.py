#!/usr/bin/env python3
"""
Valida um token da Meta e grava em accounts.access_token (+ .env), para
o coletor e a tela de Meta Ads voltarem a funcionar.

──────────────────────────────────────────────────────────────────────────
COMO GERAR O TOKEN (System User — NÃO expira; melhor opção, BM único):

  1. business.facebook.com → Configurações do Negócio → Usuários →
     "Usuários do sistema" → crie/escolha um (perfil Admin).
  2. Clique "Gerar novo token":
       • App: 1960915391453503
       • Validade do token: NUNCA expira
       • Permissões:
           instagram_basic, instagram_manage_insights,
           pages_show_list, pages_read_engagement, read_insights,
           ads_read, business_management
  3. Em "Atribuir ativos", dê a esse System User acesso a:
       • as 7 Páginas do Facebook ligadas às contas de Instagram
       • as 5 contas de anúncio (Ad Accounts)
  4. Copie o token e rode AQUI:

       META_TOKEN='COLE_O_TOKEN' python3 gerar_tokens.py

     (ou rode sem a variável e cole quando pedir — não aparece na tela)
──────────────────────────────────────────────────────────────────────────

O script valida o acesso conta a conta, mostra ✅/❌ (quem ainda falta
atribuir no BM) e grava o token só nas contas que validaram. Pode rodar
quantas vezes quiser — é idempotente.
"""
import os
import re
import sys
import json
import getpass

import requests
from dotenv import load_dotenv

load_dotenv()

GRAPH = "https://graph.facebook.com/v21.0"
SUPABASE_URL = "https://kounqtdoioootxqegkij.supabase.co"
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_KEY") or os.environ.get("SUPABASE_KEY")

# ig_id → nome da variável no .env (fallback do coletor quando accounts.access_token é nulo)
NOMES_TOKENS = {
    "17841401847160442": "TOKEN_RAISSA",
    "17841401284454639": "TOKEN_BRENO",
    "17841406451230767": "TOKEN_MANTOVA",
    "17841462952561833": "TOKEN_VESSEL",
    "17841464138609037": "TOKEN_MOTOEASY",
    "17841401243622922": "TOKEN_HUMBERTO",
    "17841400576243780": "TOKEN_MANTOVA",  # Gustavo Guerra usa o token Mantova (mesmo BM)
}


def get_token():
    t = os.environ.get("META_TOKEN")
    if not t:
        try:
            t = getpass.getpass("Cole o token da Meta (não aparece na tela): ")
        except Exception:
            t = input("Cole o token da Meta: ")
    # Remove QUALQUER espaço/quebra de linha (colar em terminal costuma quebrar a linha)
    return re.sub(r"\s", "", t or "")


def check_ig(ig_id, token):
    r = requests.get(f"{GRAPH}/{ig_id}",
                     params={"fields": "username,followers_count", "access_token": token},
                     timeout=30)
    return r.status_code, r.json()


def check_ad(ad_id, token):
    r = requests.get(f"{GRAPH}/act_{ad_id}",
                     params={"fields": "name,account_status", "access_token": token},
                     timeout=30)
    return r.status_code, r.json()


def update_env(env_names_ok, token):
    """Atualiza no .env as TOKEN_* das contas que validaram (fallback do coletor)."""
    env_path = os.path.join(os.path.dirname(__file__), ".env")
    try:
        with open(env_path) as f:
            env = f.read()
    except Exception:
        env = ""
    for name in sorted(env_names_ok):
        if re.search(rf"^{name}=.*$", env, flags=re.MULTILINE):
            env = re.sub(rf"^{name}=.*$", f"{name}={token}", env, flags=re.MULTILINE)
        else:
            env = env.rstrip("\n") + f"\n{name}={token}\n"
    try:
        with open(env_path, "w") as f:
            f.write(env)
        print(f"📝 .env atualizado: {', '.join(sorted(env_names_ok)) or '(nenhum)'}")
    except Exception as e:
        print(f"⚠️  Não consegui escrever no .env: {e}")


def main():
    token = get_token()
    if not token:
        print("Sem token. Abortando.")
        sys.exit(1)

    sb = None
    if SUPABASE_KEY:
        from supabase import create_client
        sb = create_client(SUPABASE_URL, SUPABASE_KEY)
        contas = sb.table("accounts").select(
            "id,name,username,instagram_id,ad_account_id").execute().data or []
    else:
        print("⚠️  SUPABASE_SERVICE_KEY/SUPABASE_KEY ausente — vou validar, mas não gravo no banco.")
        contas = [{"id": None, "name": n, "username": "", "instagram_id": ig, "ad_account_id": None}
                  for ig, n in NOMES_TOKENS.items()]

    print("\n=== Validando acesso por conta ===")
    ok_ids = []
    ok_env_names = set()
    fail = []
    for c in contas:
        ig = c.get("instagram_id")
        st, body = check_ig(ig, token)
        if st == 200 and "followers_count" in body:
            print(f"  ✅ {c['name']:<26} @{body.get('username','?')} — {body['followers_count']:,} seguidores")
            if c.get("id"):
                ok_ids.append(c["id"])
            if ig in NOMES_TOKENS:
                ok_env_names.add(NOMES_TOKENS[ig])
        else:
            msg = (body.get("error") or {}).get("message", body)
            print(f"  ❌ {c['name']:<26} ig={ig} — {msg}")
            fail.append(c["name"])

        ad = c.get("ad_account_id")
        if ad:
            ast, abody = check_ad(ad, token)
            if ast == 200:
                print(f"        ↳ Ad act_{ad}: {abody.get('name','?')} ✅")
            else:
                amsg = (abody.get("error") or {}).get("message", abody)
                print(f"        ↳ Ad act_{ad}: ❌ {amsg}")
                print(f"          (atribua essa conta de anúncio ao System User no BM)")

    if not ok_ids and not ok_env_names:
        print("\n❌ Nenhuma conta acessível com esse token.")
        print("   Confira as permissões do token e se as Páginas/IG foram atribuídas ao System User.")
        sys.exit(1)

    # Grava no banco (preferido — o coletor usa accounts.access_token antes do .env)
    if sb and ok_ids:
        for cid in ok_ids:
            sb.table("accounts").update({"access_token": token}).eq("id", cid).execute()
        print(f"\n💾 Token gravado em accounts.access_token para {len(ok_ids)} conta(s).")

    # Atualiza .env (fallback)
    update_env(ok_env_names, token)

    if fail:
        print(f"\n⚠️  Faltou acesso a: {', '.join(fail)}")
        print("   Atribua as Páginas dessas contas ao System User no BM e rode de novo.")
    print("\n✅ Concluído. Próximo passo:  python3 coletar.py")


if __name__ == "__main__":
    main()
