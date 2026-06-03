#!/usr/bin/env python3
"""Backfill de gained/lost (follows/unfollows brutos) nos últimos N dias,
atualizando as linhas existentes de daily_snapshots. Rode UMA vez."""
import os
import time
from datetime import date, datetime, timedelta

import requests
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()

SUPABASE_URL = "https://kounqtdoioootxqegkij.supabase.co"
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_KEY") or os.environ.get("SUPABASE_KEY")
GRAPH = "https://graph.facebook.com/v21.0"
DIAS = 30


def follows_dia(ig, token, dia):
    start = int(datetime.combine(dia, datetime.min.time()).timestamp())
    end = int(datetime.combine(dia, datetime.max.time()).timestamp())
    try:
        r = requests.get(f"{GRAPH}/{ig}/insights", params={
            "metric": "follows_and_unfollows", "period": "day",
            "metric_type": "total_value", "breakdown": "follow_type",
            "since": start, "until": end, "access_token": token,
        }, timeout=30)
        rows = (r.json().get("data") or [])
        if not rows:
            return None, None
        bd = (rows[0].get("total_value") or {}).get("breakdowns") or []
        results = (bd[0].get("results") if bd else []) or []
        g = l = 0
        for x in results:
            dv = (x.get("dimension_values") or [None])[0]
            v = x.get("value", 0) or 0
            if dv == "FOLLOWER":
                g = v
            elif dv == "NON_FOLLOWER":
                l = v
        return g, l
    except Exception:
        return None, None


def main():
    sb = create_client(SUPABASE_URL, SUPABASE_KEY)
    contas = sb.table("accounts").select("id,name,instagram_id,access_token").execute().data or []
    hoje = date.today()
    for c in contas:
        ig = c["instagram_id"]
        tok = c.get("access_token")
        if not tok:
            print(f"\n⚠️  {c['name']}: sem token")
            continue
        print(f"\n📊 {c['name']}")
        ok = 0
        for n in range(1, DIAS + 1):
            d = hoje - timedelta(days=n)
            g, l = follows_dia(ig, tok, d)
            if g is None:
                continue
            sb.table("daily_snapshots").update({"gained": g, "lost": l}) \
              .eq("account_id", c["id"]).eq("captured_at", d.isoformat()).execute()
            ok += 1
            time.sleep(0.2)
        print(f"   {ok} dias atualizados")
    print("\n✅ Backfill concluído. Rode: python3 coletar.py (p/ o dia de hoje)")


if __name__ == "__main__":
    main()
