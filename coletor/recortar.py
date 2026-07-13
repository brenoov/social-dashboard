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
from PIL import Image, ImageFilter

IN, OUT = sys.argv[1], sys.argv[2]
MODEL = os.path.expanduser('~/.u2net/birefnet-general-lite.onnx')
_MEAN = np.array([0.485, 0.456, 0.406], dtype=np.float32)
_STD = np.array([0.229, 0.224, 0.225], dtype=np.float32)
# CUTOUT_TOLERANCIA (0=nenhuma .. 1=máxima): quanto maior, mais o recorte PRESERVA partes
# finas/limítrofes da bolsa (correntes, alças, cantos de baixo contraste) que a máscara
# tenderia a cortar. Faz isso via boost gamma na máscara (levanta valores baixos) + leve
# dilatação (cresce a borda pra fora). Default 0.6 = generoso sem criar halo de fundo.
TOL = max(0.0, min(1.0, float(os.environ.get('CUTOUT_TOLERANCIA', '0.6'))))


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
    if TOL > 0:                             # tolerância: boost gamma (<1 levanta valores baixos)
        m = np.power(m, 1.0 - 0.4 * TOL)    # recupera partes finas INTERNAS da bolsa
    # tapa-buracos: no runner Linux o BiRefNet zera o corpo de baixo contraste (bolsa
    # CLARA sobre fundo branco) → buraco interno na máscara (a "parte branca" some do
    # recorte). Buraco 100% cercado por primeiro-plano (vivo/aba/ferragem) = erro de
    # segmentação: restauramos opaco. O fundo externo (inclusive o vão entre as alças)
    # fica conectado à borda da imagem → binary_fill_holes NÃO o enche. Só ADICIONA
    # alpha (nunca remove). Best-effort: sem scipy, segue sem tapar.
    try:
        from scipy import ndimage
        solid = m > 0.5                                  # núcleo de primeiro-plano
        interior = ndimage.binary_fill_holes(solid) & ~solid  # buracos internos cercados
        m[interior] = 1.0                                # corpo comido volta opaco
    except Exception as e:
        sys.stderr.write('tapa-buracos indisponivel (%s)\n' % str(e)[:100])
    # anti-franja: zera o alpha baixo (resíduo de fundo semitransparente que virava halo branco).
    # NÃO dilatamos a máscara (dilatar crescia pra dentro do fundo → franja clara na borda).
    m[m < 0.12] = 0.0
    mask = Image.fromarray((m * 255).astype(np.uint8)).resize((W, H), Image.BILINEAR)
    mask = mask.filter(ImageFilter.GaussianBlur(0.6))  # feather leve p/ borda limpa (anti-serrilhado)
    out = img.convert('RGBA')
    out.putalpha(mask)
    return out


def _cut_floodfill(img):
    # Remoção de fundo branco de estúdio (numpy/scipy) — determinístico, mesmo
    # resultado em Linux e macOS, ao contrário do BiRefNet.
    from scipy import ndimage
    from PIL import ImageFilter
    WHITE_MIN = int(os.environ.get('FLOODFILL_WHITE_MIN', '200'))
    SPREAD = int(os.environ.get('FLOODFILL_SPREAD', '28'))
    # tapa só buraco < 0.1% da imagem (reflexo do logo/ferragem no produto);
    # vazados grandes (vão entre alça e bolsa, buraco da alça transversal) ficam TRANSPARENTES.
    FILL_MAX = float(os.environ.get('FLOODFILL_FILL_MAX', '0.001'))
    # piso de cobertura: se o flood-fill removeu DEMAIS (bolsa muito clara comida junto com o
    # fundo), cai no fallback BiRefNet em vez de entregar um recorte esburacado.
    MIN_COV = float(os.environ.get('FLOODFILL_MIN_COV', '0.12'))
    a = np.asarray(img.convert('RGB')).astype(np.int32)
    mx = a.max(2); mn = a.min(2)
    whiteish = (mn >= WHITE_MIN) & ((mx - mn) <= SPREAD)   # branco + cinza-claro de fundo/sombra
    # Remove TODO whiteish (não só o conectado à borda) — assim os vazados internos, que são
    # branco puro cercado pela bolsa, também somem. O creme do corpo tem min-canal < 200
    # (ex.: ~193 na Panacota) → NÃO é whiteish → sobrevive; couro/ferragem/cor também.
    fg = ~whiteish
    lf, nf = ndimage.label(fg)
    if nf > 1:                                  # maior componente (descarta ilhas de ruído)
        fg = lf == (np.argmax(np.bincount(lf.ravel())[1:]) + 1)
    cobertura = float(fg.mean())
    if cobertura > 0.92 or cobertura < MIN_COV:  # removeu quase nada (foto não-branca) OU demais (bolsa clara comida) -> fallback
        return None
    filled = ndimage.binary_fill_holes(fg)
    holes = filled & ~fg                         # buracos cercados pelo primeiro-plano
    if holes.any():
        lblh, nh = ndimage.label(holes)
        sizes = np.bincount(lblh.ravel())
        limiar = fg.size * FILL_MAX
        pequenos = np.isin(lblh, [i for i in range(1, nh + 1) if sizes[i] < limiar])
        fg = fg | pequenos                       # só os pequenos voltam opacos
    mask = Image.fromarray((fg * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.8))
    out = img.convert('RGBA'); out.putalpha(mask)
    return out


def _cut_isnet(img):
    from rembg import remove, new_session
    return remove(img, session=new_session('isnet-general-use'))


src = Image.open(IN)
out = None
try:
    out = _cut_floodfill(src)                    # primário: determinístico
    if out is None:
        sys.stderr.write('floodfill: cobertura alta (nao e fundo branco) — fallback BiRefNet\n')
except Exception as e:
    sys.stderr.write('floodfill falhou (%s) — fallback BiRefNet\n' % str(e)[:120])
if out is None:
    try:
        if not os.path.exists(MODEL):
            raise FileNotFoundError('modelo BiRefNet ausente: ' + MODEL)
        out = _cut_birefnet(src)
    except Exception as e:
        sys.stderr.write('BiRefNet indisponivel (%s) — fallback isnet\n' % str(e)[:160])
        out = _cut_isnet(src)
out.save(OUT)
