#!/usr/bin/env python3
"""
Busca as fotos de perfil do Instagram via Meta API
e salva permanentemente no Supabase Storage.
Rode uma vez (ou sempre que quiser atualizar as fotos).
"""

import os
import requests
from supabase import create_client
from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL = "https://kounqtdoioootxqegkij.supabase.co"
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_KEY") or os.environ["SUPABASE_KEY"]
GRAPH = "https://graph.facebook.com/v21.0"
BUCKET = "profile-pics"

TOKENS = {
    "17841401847160442": os.environ.get("TOKEN_RAISSA", ""),
    "17841401284454639": os.environ.get("TOKEN_BRENO", ""),
    "17841406451230767": os.environ.get("TOKEN_MANTOVA", ""),
    "17841462952561833": os.environ.get("TOKEN_VESSEL", ""),
    "17841464138609037": os.environ.get("TOKEN_MOTOEASY", ""),
    "17841401243622922": os.environ.get("TOKEN_HUMBERTO", ""),
}

sb = create_client(SUPABASE_URL, SUPABASE_KEY)

accounts = sb.table("accounts").select("id,name,instagram_id").execute().data

for acc in accounts:
    ig_id = acc["instagram_id"]
    token = TOKENS.get(ig_id, "")
    if not token:
        print(f"⚠️  Sem token para {acc['name']}")
        continue

    # Busca URL da foto de perfil via Meta API
    try:
        r = requests.get(f"{GRAPH}/{ig_id}", params={
            "fields": "profile_picture_url",
            "access_token": token
        }, timeout=15)
        r.raise_for_status()
        pic_url = r.json().get("profile_picture_url")
    except Exception as e:
        print(f"❌ Erro ao buscar foto de {acc['name']}: {e}")
        continue

    if not pic_url:
        print(f"⚠️  Sem foto para {acc['name']}")
        continue

    # Baixa a imagem
    try:
        img = requests.get(pic_url, timeout=15)
        img.raise_for_status()
        img_bytes = img.content
        content_type = img.headers.get("Content-Type", "image/jpeg")
    except Exception as e:
        print(f"❌ Erro ao baixar foto de {acc['name']}: {e}")
        continue

    # Sobe para Supabase Storage (sobrescreve se já existir)
    file_name = f"{ig_id}.jpg"
    try:
        sb.storage.from_(BUCKET).upload(
            file_name, img_bytes,
            {"content-type": content_type, "upsert": "true"}
        )
    except Exception as e:
        print(f"❌ Erro ao subir foto de {acc['name']}: {e}")
        continue

    # URL pública permanente
    public_url = sb.storage.from_(BUCKET).get_public_url(file_name)

    # Salva no banco
    sb.table("accounts").update({"picture_url": public_url}).eq("id", acc["id"]).execute()
    print(f"✅ {acc['name']} → {public_url}")

print("\nPronto!")
