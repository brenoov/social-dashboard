#!/usr/bin/env python3
"""
Coletor de dados do Instagram para o Dashboard KPI.
Executa diariamente e armazena os dados no Supabase.
"""

import json
import os
import re
import requests
from datetime import date, datetime, timedelta
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL = "https://kounqtdoioootxqegkij.supabase.co"
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_KEY") or os.environ["SUPABASE_KEY"]

TOKENS = {
    "17841401847160442": os.environ.get("TOKEN_RAISSA", ""),
    "17841401284454639": os.environ.get("TOKEN_BRENO", ""),
    "17841406451230767": os.environ.get("TOKEN_MANTOVA", ""),
    "17841462952561833": os.environ.get("TOKEN_VESSEL", ""),
    "17841464138609037": os.environ.get("TOKEN_MOTOEASY", ""),
}

# Ad Account IDs por ig_id (sem o prefixo "act_")
AD_ACCOUNTS = {
    "17841401847160442": "591630990582441",   # Raíssa
    "17841401284454639": "1523458001735386",  # Breno
    "17841406451230767": "786453150398609",   # Mantova
    "17841462952561833": "1197997517858139",  # La Vessel
    "17841464138609037": "803642218253857",   # Motoeasy
}

PERIODS = [1, 7, 14, 30]
GRAPH = "https://graph.facebook.com/v21.0"


def api_get(path, params):
    r = requests.get(f"{GRAPH}/{path}", params=params, timeout=30)
    r.raise_for_status()
    return r.json()


def coletar_seguidores(ig_id, token):
    data = api_get(ig_id, {"fields": "followers_count", "access_token": token})
    return data.get("followers_count", 0)


def coletar_stories_hoje(ig_id, token):
    """Stories expiram em 24h — só o endpoint /stories retorna os ativos agora."""
    try:
        data = api_get(f"{ig_id}/stories", {
            "fields": "id",
            "access_token": token,
            "limit": 100
        })
        return len(data.get("data", []))
    except Exception:
        return 0


def coletar_midias(ig_id, token, dias):
    desde = date.today() - timedelta(days=dias)
    likes = saves = shares = 0
    posts = reels = 0

    data = api_get(f"{ig_id}/media", {
        "fields": "id,media_type,media_product_type,timestamp,like_count",
        "access_token": token,
        "limit": 100
    })

    for midia in data.get("data", []):
        produto = midia.get("media_product_type", "")
        ts = midia.get("timestamp", "")
        if ts:
            ts_norm = ts.replace("+0000", "+00:00").replace("Z", "+00:00")
            pub = datetime.fromisoformat(ts_norm)
            if pub.date() < desde:
                continue

        # Stories não aparecem em /media — tratados separadamente
        if produto == "STORY":
            continue

        likes += midia.get("like_count", 0)

        if produto == "REELS":
            reels += 1
        else:
            posts += 1

        try:
            insights = api_get(f"{midia['id']}/insights", {
                "metric": "saved,shares",
                "access_token": token
            })
            for item in insights.get("data", []):
                v = item.get("value") or (item.get("values") or [{}])[0].get("value", 0)
                if item["name"] == "saved":
                    saves += v
                elif item["name"] == "shares":
                    shares += v
        except Exception:
            pass

    return {"likes": likes, "saves": saves, "shares": shares,
            "posts": posts, "reels": reels}


def coletar_ads(ad_account_id, token, dias):
    """Busca gasto, impressões, cliques e alcance via Marketing API."""
    since = (date.today() - timedelta(days=dias)).isoformat()
    until = date.today().isoformat()
    try:
        data = api_get(f"act_{ad_account_id}/insights", {
            "fields": "spend,impressions,clicks,reach",
            "time_range": json.dumps({"since": since, "until": until}),
            "level": "account",
            "access_token": token,
        })
        rows = data.get("data", [])
        if rows:
            r = rows[0]
            return {
                "spend": float(r.get("spend", 0) or 0),
                "impressions": int(r.get("impressions", 0) or 0),
                "clicks": int(r.get("clicks", 0) or 0),
                "reach": int(r.get("reach", 0) or 0),
            }
    except Exception as e:
        print(f"   ⚠️  Ads ({ad_account_id}): {e}")
    return {"spend": 0.0, "impressions": 0, "clicks": 0, "reach": 0}


def processar_conta(supabase, account_id, ig_id, token, nome):
    hoje = date.today().isoformat()
    print(f"\n📊 Coletando: {nome} ({ig_id})")

    seguidores = coletar_seguidores(ig_id, token)
    supabase.table("daily_snapshots").upsert(
        {"account_id": account_id, "captured_at": hoje, "followers_count": seguidores},
        on_conflict="account_id,captured_at"
    ).execute()
    print(f"   Seguidores: {seguidores:,}")

    # Stories só ficam disponíveis via API por 24h — coletamos uma vez por dia
    stories_hoje = coletar_stories_hoje(ig_id, token)
    print(f"   Stories ativos agora: {stories_hoje}")

    for dias in PERIODS:
        m = coletar_midias(ig_id, token, dias)
        # Para período 1D usamos stories_hoje; para períodos maiores acumulamos o histórico do BD
        stories_val = stories_hoje if dias == 1 else None
        supabase.table("engagement_snapshots").upsert(
            {"account_id": account_id, "captured_at": hoje, "period_days": dias,
             "likes": m["likes"], "saves": m["saves"], "shares": m["shares"]},
            on_conflict="account_id,captured_at,period_days"
        ).execute()
        row = {"account_id": account_id, "captured_at": hoje, "period_days": dias,
               "posts_count": m["posts"], "reels_count": m["reels"]}
        if stories_val is not None:
            row["stories_count"] = stories_val
        supabase.table("content_snapshots").upsert(row, on_conflict="account_id,captured_at,period_days").execute()
        s_label = str(stories_val) if stories_val is not None else "—"
        print(f"   {dias:2d}D → ❤️ {m['likes']:,} | 🔖 {m['saves']:,} | ↗️ {m['shares']:,} | "
              f"Posts:{m['posts']} Stories:{s_label} Reels:{m['reels']}")

    # Ads
    ad_account_id = AD_ACCOUNTS.get(ig_id, "")
    if ad_account_id:
        print(f"   💰 Coletando Ads...")
        for dias in PERIODS:
            ads = coletar_ads(ad_account_id, token, dias)
            supabase.table("ads_snapshots").upsert(
                {"account_id": account_id, "captured_at": hoje, "period_days": dias,
                 "spend": ads["spend"], "impressions": ads["impressions"],
                 "clicks": ads["clicks"], "reach": ads["reach"]},
                on_conflict="account_id,captured_at,period_days"
            ).execute()
            print(f"   {dias:2d}D → 💸 R${ads['spend']:.2f} | 👁 {ads['impressions']:,} | "
                  f"🖱 {ads['clicks']:,} | 📡 {ads['reach']:,}")


NOMES_TOKENS = {
    "17841401847160442": "TOKEN_RAISSA",
    "17841401284454639": "TOKEN_BRENO",
    "17841406451230767": "TOKEN_MANTOVA",
    "17841462952561833": "TOKEN_VESSEL",
    "17841464138609037": "TOKEN_MOTOEASY",
}


def renovar_token(nome_env, token):
    app_id = os.environ.get("APP_ID", "")
    app_secret = os.environ.get("APP_SECRET", "")
    if not app_id or not app_secret:
        return token
    try:
        r = requests.get(f"{GRAPH}/oauth/access_token", params={
            "grant_type": "fb_exchange_token",
            "client_id": app_id,
            "client_secret": app_secret,
            "fb_exchange_token": token,
        }, timeout=30)
        r.raise_for_status()
        novo = r.json().get("access_token", "")
        if novo:
            print(f"   ✅ {nome_env} renovado")
            return novo
    except Exception as e:
        print(f"   ⚠️  Erro ao renovar {nome_env}: {e}")
    return token


def renovar_todos_tokens():
    print("\n🔄 Renovando tokens do Instagram...")
    env_path = os.path.join(os.path.dirname(__file__), ".env")
    try:
        with open(env_path, "r") as f:
            conteudo = f.read()
    except Exception as e:
        print(f"   ⚠️  Não foi possível ler .env: {e}")
        return

    for ig_id, nome_env in NOMES_TOKENS.items():
        token_atual = TOKENS.get(ig_id, "")
        if not token_atual:
            continue
        novo = renovar_token(nome_env, token_atual)
        TOKENS[ig_id] = novo
        conteudo = re.sub(rf"^{nome_env}=.*$", f"{nome_env}={novo}", conteudo, flags=re.MULTILINE)

    try:
        with open(env_path, "w") as f:
            f.write(conteudo)
        print("   📝 .env atualizado com tokens renovados")
    except Exception as e:
        print(f"   ⚠️  Não foi possível salvar .env: {e}")


def main():
    print("=" * 60)
    print("🚀 Iniciando coleta | Data:", date.today().isoformat())
    print("=" * 60)
    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
    contas = supabase.table("accounts").select("id, name, instagram_id").execute()
    for conta in contas.data:
        ig_id = conta["instagram_id"]
        token = TOKENS.get(ig_id, "")
        if not token:
            print(f"\n⚠️  Sem token para {conta['name']}")
            continue
        try:
            processar_conta(supabase, conta["id"], ig_id, token, conta["name"])
        except Exception as e:
            print(f"\n❌ Erro em {conta['name']}: {e}")
    renovar_todos_tokens()
    print("\n✅ Concluído!")


if __name__ == "__main__":
    main()
