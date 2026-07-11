#!/usr/bin/env python3
# coletor/recortar.py — remove o fundo de uma foto de produto (rembg) e salva
# um PNG transparente. Uso: python3 recortar.py <entrada> <saida.png>
# Modelo: isnet-general-use (sem alpha matting) — preserva detalhes finos
# como correntes e alças de bolsa, que o u2net padrão cortava.
import sys
from rembg import remove, new_session
from PIL import Image

IN, OUT = sys.argv[1], sys.argv[2]
_session = new_session('isnet-general-use')
out = remove(Image.open(IN), session=_session)
out.save(OUT)
