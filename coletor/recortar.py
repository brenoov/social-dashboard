#!/usr/bin/env python3
# coletor/recortar.py — remove o fundo de uma foto de produto (rembg) e salva
# um PNG transparente. Uso: python3 recortar.py <entrada> <saida.png>
import sys
from rembg import remove
from PIL import Image

IN, OUT = sys.argv[1], sys.argv[2]
out = remove(Image.open(IN))
out.save(OUT)
