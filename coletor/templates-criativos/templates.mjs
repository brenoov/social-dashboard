// coletor/templates-criativos/templates.mjs
// Templates HTML parametrizados portados do protótipo La Vessel. Cada template
// devolve HTML AUTOCONTIDO (fontes+monograma inline) pronto pro renderPNG.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const DIR = join(dirname(fileURLToPath(import.meta.url)), 'assets');
const FONTS_CSS = readFileSync(join(DIR, 'fonts.css'), 'utf8');
const b64 = (f) => 'data:image/png;base64,' + readFileSync(join(DIR, f)).toString('base64');
const MONO = { brown: b64('monogram-brown.png'), cream: b64('monogram-cream.png'), olive: b64('monogram-olive.png') };

const DIM = { '1080x1920': { width: 1080, height: 1920 }, '1080x1350': { width: 1080, height: 1350 } };

const esc = (s) => String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

// wrapper autocontido: injeta fontes + normaliza body pro tamanho exato
function pagina(inner, formato) {
  const d = DIM[formato];
  return `<!doctype html><html><head><meta charset="utf-8"><style>${FONTS_CSS}
  *{margin:0;padding:0;box-sizing:border-box}html,body{width:${d.width}px;height:${d.height}px;overflow:hidden}</style></head>
  <body>${inner}</body></html>`;
}

// PROMO · Number Hero (fundo Burnt Wood, número gigante, bolsa em círculo pérola)
function promoNumberHero(dados, formato) {
  const d = DIM[formato];
  const escala = formato === '1080x1350' ? 0.76 : 1;      // Post reduz proporcional
  const s = (n) => Math.round(n * escala);
  const inner = `
  <div style="position:relative;width:${d.width}px;height:${d.height}px;background:radial-gradient(130% 75% at 50% 44%, #6a3c14 0%, #4f2908 100%);overflow:hidden;color:#f2f1ed;font-family:'Archivo',sans-serif;">
    <div style="position:absolute;inset:0;background-image:url('${MONO.cream}');background-repeat:repeat;background-size:230px;opacity:.045;"></div>
    <div style="position:relative;z-index:1;height:${d.height}px;display:flex;flex-direction:column;align-items:center;text-align:center;justify-content:center;gap:${s(56)}px;padding:${s(96)}px ${s(80)}px;">
      <div style="display:flex;flex-direction:column;align-items:center;">
        <img src="${MONO.cream}" style="height:${s(60)}px;width:auto;">
        <div style="font-family:'Cormorant Garamond',serif;font-size:${s(46)}px;font-weight:500;margin-top:16px;">La <span style="font-style:italic;">vessel</span></div>
        <div style="display:flex;align-items:center;gap:18px;margin-top:20px;"><span style="width:44px;height:1px;background:#c2cfb4;opacity:.55;"></span><span style="font-size:${s(20)}px;letter-spacing:.46em;text-transform:uppercase;color:#c2cfb4;font-weight:500;padding-left:.46em;">${dados.eyebrow || 'Season Sale'}</span><span style="width:44px;height:1px;background:#c2cfb4;opacity:.55;"></span></div>
      </div>
      <div style="display:flex;align-items:baseline;gap:${s(28)}px;">
        <span style="font-family:'Cormorant Garamond',serif;font-variant-numeric:lining-nums;font-feature-settings:'lnum' 1;font-size:${s(308)}px;font-weight:500;line-height:1;">${dados.oferta}</span>
        <span style="font-family:'Archivo',sans-serif;font-size:${s(88)}px;letter-spacing:.14em;font-weight:700;color:#c2cfb4;">OFF</span>
      </div>
      <div style="display:flex;align-items:center;justify-content:center;width:${s(600)}px;height:${s(600)}px;border-radius:50%;background:#f2f1ed;box-shadow:0 34px 70px rgba(0,0,0,.34);overflow:hidden;">
        <img src="${dados.fotoDataUrl}" style="width:${s(560)}px;height:${s(560)}px;object-fit:contain;">
      </div>
      <div style="display:flex;flex-direction:column;align-items:center;">
        <div style="font-family:'Cormorant Garamond',serif;font-style:italic;font-weight:500;font-size:${s(44)}px;">${esc(dados.nome)}</div>
        <div style="font-size:${s(23)}px;letter-spacing:.14em;text-transform:uppercase;color:#e4e6d9;opacity:.8;margin-top:12px;">Preço que não volta</div>${dados.copyEfeito ? `
        <div style="font-family:'Archivo',sans-serif;font-size:${s(22)}px;letter-spacing:.14em;text-transform:uppercase;color:#c2cfb4;font-weight:600;margin-top:10px;">${esc(dados.copyEfeito)}</div>` : ''}
      </div>
      <div style="background:#89a88b;color:#f2f1ed;font-weight:600;font-size:${s(27)}px;letter-spacing:.2em;text-transform:uppercase;padding:${s(32)}px ${s(82)}px;border-radius:999px;box-shadow:0 18px 36px rgba(0,0,0,.3);display:flex;align-items:center;gap:18px;">${dados.cta || 'Compre já'} <span style="font-size:${s(30)}px;line-height:1;">&#8594;</span></div>
    </div>
  </div>`;
  return pagina(inner, formato);
}

// PRODUTO · Herói (fundo Soft Pearl, bolsa, De riscado + Por grande OU parcelado)
function produtoHeroi(dados, formato) {
  const d = DIM[formato];
  const escala = formato === '1080x1350' ? 0.76 : 1;
  const s = (n) => Math.round(n * escala);
  const destaqueParcelado = !!dados.parceladoEmEvidencia;
  const blocoPreco = destaqueParcelado
    ? `<div style="display:flex;align-items:baseline;gap:14px;"><span style="font-size:${s(24)}px;letter-spacing:.3em;text-transform:uppercase;font-weight:600;color:#b0a596;">De</span><span style="font-family:'Cormorant Garamond',serif;font-variant-numeric:lining-nums;font-feature-settings:'lnum' 1;font-size:${s(50)}px;font-weight:500;color:#b0a596;text-decoration:line-through;text-decoration-thickness:2px;">R$ ${dados.precoDe}</span></div>
       <span style="font-size:${s(26)}px;letter-spacing:.32em;text-transform:uppercase;font-weight:700;color:#89a88b;">Em até</span>
       <span style="font-family:'Cormorant Garamond',serif;font-variant-numeric:lining-nums;font-feature-settings:'lnum' 1;font-size:${s(150)}px;font-weight:500;line-height:1;color:#582f0a;">${dados.parcelas}× R$ ${dados.parcelado}</span>`
    : `<div style="display:flex;align-items:baseline;gap:16px;"><span style="font-size:${s(26)}px;letter-spacing:.3em;text-transform:uppercase;font-weight:600;color:#b0a596;">De</span><span style="font-family:'Cormorant Garamond',serif;font-variant-numeric:lining-nums;font-feature-settings:'lnum' 1;font-size:${s(60)}px;font-weight:500;color:#b0a596;text-decoration:line-through;text-decoration-thickness:2px;">R$ ${dados.precoDe}</span></div>
       <div style="display:flex;align-items:baseline;gap:22px;"><span style="font-size:${s(32)}px;letter-spacing:.32em;text-transform:uppercase;font-weight:700;color:#89a88b;">Por</span><span style="font-family:'Cormorant Garamond',serif;font-variant-numeric:lining-nums;font-feature-settings:'lnum' 1;font-size:${s(168)}px;font-weight:500;line-height:1;color:#582f0a;">R$ ${dados.precoPor}</span></div>`;
  const inner = `
  <div style="position:relative;width:${d.width}px;height:${d.height}px;background:#f2f1ed;overflow:hidden;color:#582f0a;font-family:'Archivo',sans-serif;">
    <div style="position:absolute;inset:0;background-image:url('${MONO.olive}');background-repeat:repeat;background-size:230px;opacity:.045;"></div>
    <div style="position:relative;z-index:1;height:${d.height}px;display:flex;flex-direction:column;align-items:center;text-align:center;justify-content:center;gap:${s(40)}px;padding:${s(104)}px ${s(90)}px;">
      <div style="display:flex;flex-direction:column;align-items:center;">
        <img src="${MONO.brown}" style="height:${s(60)}px;width:auto;">
        <div style="font-family:'Cormorant Garamond',serif;font-size:${s(52)}px;font-weight:500;margin-top:14px;">La <span style="font-style:italic;">vessel</span></div>
        <div style="display:flex;align-items:center;gap:20px;margin-top:20px;"><span style="width:46px;height:1px;background:#89a88b;"></span><span style="font-size:${s(22)}px;letter-spacing:.46em;text-transform:uppercase;color:#89a88b;font-weight:600;padding-left:.46em;">${dados.eyebrow || 'Oferta especial'}</span><span style="width:46px;height:1px;background:#89a88b;"></span></div>
      </div>
      <div style="display:flex;align-items:center;justify-content:center;width:${s(560)}px;height:${s(560)}px;border-radius:50%;background:#ffffff;box-shadow:0 30px 60px rgba(60,36,8,.14);overflow:hidden;"><img src="${dados.fotoDataUrl}" style="width:${s(520)}px;height:${s(520)}px;object-fit:contain;"></div>
      <div style="font-family:'Cormorant Garamond',serif;font-style:italic;font-weight:500;font-size:${s(56)}px;">${esc(dados.nome)}</div>
      <div style="display:flex;flex-direction:column;align-items:center;gap:10px;">${blocoPreco}</div>${dados.copyEfeito ? `
      <div style="font-family:'Archivo',sans-serif;font-size:${s(22)}px;letter-spacing:.14em;text-transform:uppercase;color:#7a5a37;font-weight:600;">${esc(dados.copyEfeito)}</div>` : ''}
      <div style="background:#89a88b;color:#f2f1ed;font-weight:600;font-size:${s(30)}px;letter-spacing:.2em;text-transform:uppercase;padding:${s(30)}px ${s(84)}px;border-radius:999px;box-shadow:0 16px 34px rgba(88,47,10,.2);display:flex;align-items:center;gap:18px;">${dados.cta || 'Eu quero a minha'} <span style="font-size:${s(34)}px;line-height:1;">&#8594;</span></div>
    </div>
  </div>`;
  return pagina(inner, formato);
}

export const TEMPLATES = {
  'promo-number-hero': { arquetipo: 'promo', nome: 'Promo · Number Hero', render: promoNumberHero },
  'produto-heroi':     { arquetipo: 'produto', nome: 'Produto · Herói', render: produtoHeroi },
};
export { DIM };
