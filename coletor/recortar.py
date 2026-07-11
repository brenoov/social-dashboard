#!/usr/bin/env python3
# coletor/recortar.py — remove o fundo de uma foto de produto e salva um PNG
# transparente. Uso: python3 recortar.py <entrada> <saida.png>
#
# Modelo: BiRefNet (general-lite) via onnxruntime DIRETO — preserva detalhes
# finos (correntes/alças) E separa bolsa CLARA de fundo branco, onde o isnet
# comia o corpo da bolsa (deixando "buraco"/parte branca no criativo).
#
# Rodamos o ONNX na mão (sem passar pela camada de download do rembg, que
# trava/re-baixa em rede instável). O peso fica em ~/.u2net/birefnet-general-lite.onnx
# (baixado 1x). Se o modelo/onnxruntime não estiverem disponíveis, cai pro
# isnet-general-use via rembg (fallback que nunca quebra o pipeline).
import os
import sys
import numpy as np
from PIL import Image

IN, OUT = sys.argv[1], sys.argv[2]
MODEL = os.path.expanduser('~/.u2net/birefnet-general-lite.onnx')
_MEAN = np.array([0.485, 0.456, 0.406], dtype=np.float32)
_STD = np.array([0.229, 0.224, 0.225], dtype=np.float32)


def _cut_birefnet(img):
    import onnxruntime as ort
    sess = ort.InferenceSession(MODEL, providers=['CPUExecutionProvider'])
    name = sess.get_inputs()[0].name
    W, H = img.size
    r = img.convert('RGB').resize((1024, 1024), Image.BILINEAR)
    x = (np.asarray(r, dtype=np.float32) / 255.0 - _MEAN) / _STD
    x = np.transpose(x, (2, 0, 1))[None].astype(np.float32)
    m = sess.run(None, {name: x})[0]
    m = 1.0 / (1.0 + np.exp(-m))            # sigmoid
    m = m[0, 0]
    m = (m - m.min()) / (m.max() - m.min() + 1e-8)
    mask = Image.fromarray((m * 255).astype(np.uint8)).resize((W, H), Image.BILINEAR)
    out = img.convert('RGBA')
    out.putalpha(mask)
    return out


def _cut_isnet(img):
    from rembg import remove, new_session
    return remove(img, session=new_session('isnet-general-use'))


src = Image.open(IN)
try:
    if not os.path.exists(MODEL):
        raise FileNotFoundError('modelo BiRefNet ausente: ' + MODEL)
    out = _cut_birefnet(src)
except Exception as e:
    sys.stderr.write('BiRefNet indisponivel (%s) — fallback isnet\n' % str(e)[:160])
    out = _cut_isnet(src)
out.save(OUT)
