#!/usr/bin/env python3
"""Testa se a métrica follows_and_unfollows (brutos) responde para o Breno.
Lê o token do BANCO (accounts.access_token) — o do .env está quebrado."""
import os, json, time
import requests
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()

SUPABASE_URL = "https://kounqtdoioootxqegkij.supabase.co"
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_KEY") or os.environ.get("SUPABASE_KEY")
IG = "17841401284454639"  # Breno Vale

sb = create_client(SUPABASE_URL, SUPABASE_KEY)
row = sb.table("accounts").select("access_token").eq("instagram_id", IG).execute().data
TOKEN = (row[0]["access_token"] if row else "") or ""
TOKEN = "".join(TOKEN.split())  # remove qualquer espaço/quebra

if not TOKEN:
    print("Sem token no banco para o Breno"); raise SystemExit(1)

until = int(time.time())
since = until - 7 * 86400

for v in ["v21.0", "v23.0", "v25.0"]:
    try:
        r = requests.get(
            f"https://graph.facebook.com/{v}/{IG}/insights",
            params={
                "metric": "follows_and_unfollows",
                "period": "day",
                "metric_type": "total_value",
                "breakdown": "follow_type",
                "since": since,
                "until": until,
                "access_token": TOKEN,
            },
            timeout=30,
        )
        print(f"\n===== {v}  ->  HTTP {r.status_code} =====")
        print(json.dumps(r.json(), ensure_ascii=False, indent=2)[:1500])
    except Exception as e:
        print(f"\n===== {v}  ->  ERRO: {e} =====")
