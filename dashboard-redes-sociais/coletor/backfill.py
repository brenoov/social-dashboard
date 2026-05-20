#!/usr/bin/env python3
"""
Backfill de até 90 dias de histórico no Supabase.

Como funciona:
  1. Seguidores — endpoint /insights?metric=follower_count retorna incremento diário;
     o script reconstrói o total histórico trabalhando de trás para frente a partir
     do total atual. Só insere datas que ainda não existem no banco.

  2. Engajamento e Conteúdo — busca todos os posts dos últimos 90 dias e, para cada
     data do passado, simula o snapshot que o coletor diário teria gerado.
     ATENÇÃO: likes/saves/shares são os valores ATUAIS dos posts, não os do momento
     histórico (a API não fornece isso). É uma aproximação, mas útil para tendências.

Execute:  python3 backfill.py
"""

import os
import time
from datetime import date, datetime, timedelta

import requests
from supabase import create_client
from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL = "https://kounqtdoioootxqegkij.supabase.co"
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_KEY") or os.environ["SUPABASE_KEY"]
GRAPH = "https://graph.facebook.com/v21.0"
PERIODS = [1, 7, 14, 30]
DIAS_HISTORICO = 90

TOKENS = {
    "17841401847160442": os.environ.get("TOKEN_RAISSA", ""),
    "17841401284454639": os.environ.get("TOKEN_BRENO", ""),
    "17841406451230767": os.environ.get("TOKEN_MANTOVA", ""),
    "17841462952561833": os.environ.get("TOKEN_VESSEL", ""),
    "17841464138609037": os.environ.get("TOKEN_MOTOEASY", ""),
}


# ── Helpers ───────────────────────────────────────────────────────────────────

def api_get(path, params, tentativas=3):
    url = path if path.startswith("http") else f"{GRAPH}/{path}"
    for tentativa in range(tentativas):
        try:
            r = requests.get(url, params=params if not path.startswith("http") else {}, timeout=30)
            if path.startswith("http"):
                r = requests.get(url, timeout=30)
            r.raise_for_status()
            return r.json()
        except requests.HTTPError as e:
            codigo = e.response.status_code if e.response else 0
            if codigo == 429:
                print("   ⏳ Rate limit — aguardando 60s...")
                time.sleep(60)
            elif tentativa < tentativas - 1:
                time.sleep(2)
            else:
                raise
        except Exception:
            if tentativa < tentativas - 1:
                time.sleep(2)
            else:
                raise


def parse_ts(ts_str):
    return datetime.fromisoformat(ts_str.replace("+0000", "+00:00").replace("Z", "+00:00")).date()


def datas_existentes(supabase, tabela, account_id, period_days=None):
    q = supabase.table(tabela).select("captured_at").eq("account_id", account_id)
    if period_days is not None:
        q = q.eq("period_days", period_days)
    return {r["captured_at"] for r in q.execute().data}


def upsert_lotes(supabase, tabela, linhas, conflict, batch=200):
    for i in range(0, len(linhas), batch):
        supabase.table(tabela).upsert(linhas[i:i+batch], on_conflict=conflict).execute()


# ── 1. Seguidores históricos ──────────────────────────────────────────────────

def backfill_seguidores(supabase, account_id, ig_id, token):
    print("  📈 Seguidores via insights...")

    # Total atual como âncora
    info = requests.get(f"{GRAPH}/{ig_id}", params={
        "fields": "followers_count", "access_token": token
    }, timeout=30).json()
    total_atual = info.get("followers_count", 0)
    print(f"     Total atual: {total_atual:,}")

    # Busca incrementos diários em blocos de 30 dias
    hoje = date.today()
    inicio = hoje - timedelta(days=DIAS_HISTORICO - 1)
    incrementos = {}  # {date: ganho_naquele_dia}

    cursor = inicio
    while cursor <= hoje:
        fim = min(cursor + timedelta(days=29), hoje)
        try:
            data = requests.get(f"{GRAPH}/{ig_id}/insights", params={
                "metric": "follower_count",
                "period": "day",
                "since": cursor.isoformat(),
                "until": (fim + timedelta(days=1)).isoformat(),
                "access_token": token,
            }, timeout=30).json()

            for item in data.get("data", []):
                if item.get("name") == "follower_count":
                    for v in item.get("values", []):
                        d = parse_ts(v["end_time"])
                        incrementos[d] = v.get("value", 0)
        except Exception as e:
            print(f"     ⚠️  Bloco {cursor}→{fim}: {e}")

        cursor = fim + timedelta(days=1)
        time.sleep(0.5)

    if not incrementos:
        print("     ⚠️  API não retornou incrementos de seguidores.")
        return

    # Reconstrói totais históricos de trás pra frente
    totais = {}
    total = total_atual
    for d in sorted(incrementos.keys(), reverse=True):
        totais[d] = total  # valor ao final do dia d
        total = max(0, total - incrementos[d])

    # Só insere datas ausentes
    existentes = datas_existentes(supabase, "daily_snapshots", account_id)
    novas = [
        {"account_id": account_id, "captured_at": d.isoformat(), "followers_count": v}
        for d, v in totais.items()
        if d.isoformat() not in existentes and d <= hoje
    ]

    if novas:
        upsert_lotes(supabase, "daily_snapshots", novas, "account_id,captured_at")
        datas = sorted(r["captured_at"] for r in novas)
        print(f"     ✅ {len(novas)} dias inseridos  ({datas[0]} → {datas[-1]})")
    else:
        print("     ✓  Sem novas datas para inserir.")


# ── 2. Mídia dos últimos 90 dias ──────────────────────────────────────────────

def buscar_midias(ig_id, token):
    """Retorna lista de posts/reels publicados nos últimos 90 dias."""
    cutoff = date.today() - timedelta(days=DIAS_HISTORICO)
    midias = []
    next_url = None
    params = {
        "fields": "id,media_type,media_product_type,timestamp,like_count",
        "access_token": token,
        "limit": 100,
    }

    for pagina in range(15):  # máximo 1500 posts
        data = api_get(next_url or f"{ig_id}/media", params if not next_url else {})
        parar = False

        for m in data.get("data", []):
            produto = m.get("media_product_type", "")
            if produto == "STORY":
                continue
            ts = m.get("timestamp", "")
            if not ts:
                continue
            pub = parse_ts(ts)
            if pub <= cutoff:
                parar = True
                break

            saves = shares = 0
            try:
                ins = api_get(f"{m['id']}/insights", {
                    "metric": "saved,shares",
                    "access_token": token,
                })
                for item in ins.get("data", []):
                    v = item.get("value") or (item.get("values") or [{}])[0].get("value", 0)
                    if item["name"] == "saved":
                        saves = v
                    elif item["name"] == "shares":
                        shares = v
            except Exception:
                pass

            midias.append({
                "pub": pub,
                "type": produto,
                "likes": m.get("like_count", 0),
                "saves": saves,
                "shares": shares,
            })
            time.sleep(0.05)

        if parar:
            break
        next_url = data.get("paging", {}).get("next")
        if not next_url:
            break
        params = {}
        time.sleep(0.3)

    return midias


# ── 3. Engajamento e conteúdo históricos ─────────────────────────────────────

def backfill_engajamento_conteudo(supabase, account_id, midias):
    print(f"  📊 Engajamento e conteúdo ({len(midias)} posts encontrados)...")

    hoje = date.today()
    eng_rows = []
    cnt_rows = []

    for period in PERIODS:
        existentes_eng = datas_existentes(supabase, "engagement_snapshots", account_id, period)
        existentes_cnt = datas_existentes(supabase, "content_snapshots", account_id, period)

        for days_ago in range(DIAS_HISTORICO - 1, 0, -1):
            ref = hoje - timedelta(days=days_ago)
            ref_str = ref.isoformat()
            inicio_period = ref - timedelta(days=period)

            likes = saves = shares = posts = reels = 0
            for m in midias:
                if inicio_period < m["pub"] <= ref:
                    likes += m["likes"]
                    saves += m["saves"]
                    shares += m["shares"]
                    if m["type"] == "REELS":
                        reels += 1
                    else:
                        posts += 1

            if ref_str not in existentes_eng:
                eng_rows.append({
                    "account_id": account_id, "captured_at": ref_str,
                    "period_days": period,
                    "likes": likes, "saves": saves, "shares": shares,
                })
            if ref_str not in existentes_cnt:
                cnt_rows.append({
                    "account_id": account_id, "captured_at": ref_str,
                    "period_days": period,
                    "posts_count": posts, "reels_count": reels,
                })

    upsert_lotes(supabase, "engagement_snapshots", eng_rows, "account_id,captured_at,period_days")
    upsert_lotes(supabase, "content_snapshots", cnt_rows, "account_id,captured_at,period_days")
    print(f"     ✅ {len(eng_rows)} engajamento  |  {len(cnt_rows)} conteúdo inseridos")


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    print("=" * 60)
    print(f"🔄 Backfill {DIAS_HISTORICO} dias  |  {date.today()}")
    print("=" * 60)
    print()
    print("  ⚠️  likes/saves/shares = valores ATUAIS dos posts (aproximação)")
    print("     Seguidores = reconstruídos a partir do incremento diário real")
    print()

    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
    contas = supabase.table("accounts").select("id,name,instagram_id").execute()

    for conta in contas.data:
        ig_id = conta["instagram_id"]
        token = TOKENS.get(ig_id, "")
        if not token:
            print(f"\n⚠️  Sem token para {conta['name']}")
            continue

        print(f"\n{'─'*60}")
        print(f"👤 {conta['name']}")
        try:
            backfill_seguidores(supabase, conta["id"], ig_id, token)
            midias = buscar_midias(ig_id, token)
            backfill_engajamento_conteudo(supabase, conta["id"], midias)
        except Exception as e:
            print(f"  ❌ Erro: {e}")

    print(f"\n{'='*60}")
    print("✅ Backfill concluído!")
    print("   Abra o dashboard e selecione 30D para ver o histórico completo.")


if __name__ == "__main__":
    main()
