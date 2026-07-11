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
        <span style="font-family:'Cormorant Garamond',serif;font-variant-numeric:lining-nums;font-feature-settings:'lnum' 1;font-size:${s(308)}px;font-weight:500;line-height:1;">${dados.oferta || '50%'}</span>
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
  const pct = (dados.oferta || '50%').replace('%', ''); // "50%" -> "50" (o % é renderizado menor)
  const cormNum = "font-family:'Cormorant Garamond',serif;font-variant-numeric:lining-nums;font-feature-settings:'lnum' 1;";
  // VALORES em evidência: "DE R$ x" riscado + linha grande ("POR R$ y" gigante, ou "EM ATÉ 10× R$ z")
  const linhaDe = `<div style="display:flex;align-items:baseline;gap:${s(14)}px;"><span style="font-size:${s(30)}px;letter-spacing:.3em;font-weight:600;color:#b0a596;">DE</span><span style="${cormNum}font-size:${s(60)}px;font-weight:500;color:#b0a596;text-decoration:line-through;text-decoration-thickness:3px;">R$ ${dados.precoDe}</span></div>`;
  const linhaPor = destaqueParcelado
    ? `<div style="display:flex;align-items:baseline;gap:${s(18)}px;"><span style="font-size:${s(36)}px;letter-spacing:.3em;font-weight:700;color:#89a88b;">EM ATÉ</span><span style="${cormNum}font-size:${s(150)}px;font-weight:600;line-height:1;color:#582f0a;">${dados.parcelas}× R$ ${dados.parcelado}</span></div>`
    : `<div style="display:flex;align-items:baseline;gap:${s(18)}px;"><span style="font-size:${s(38)}px;letter-spacing:.3em;font-weight:700;color:#89a88b;">POR</span><span style="${cormNum}font-size:${s(178)}px;font-weight:600;line-height:1;color:#582f0a;">R$ ${dados.precoPor}</span></div>`;
  const inner = `
  <div style="position:relative;width:${d.width}px;height:${d.height}px;background:#f2f1ed;overflow:hidden;color:#582f0a;font-family:'Archivo',sans-serif;">
    <div style="position:absolute;inset:0;background-image:url('${MONO.olive}');background-repeat:repeat;background-size:230px;opacity:.045;"></div>
    <div style="position:relative;z-index:1;height:${d.height}px;display:flex;flex-direction:column;align-items:center;text-align:center;justify-content:space-between;padding:${s(66)}px ${s(60)}px ${s(60)}px;">
      <div style="display:flex;flex-direction:column;align-items:center;">
        <img src="${MONO.brown}" style="height:${s(48)}px;width:auto;">
        <div style="font-family:'Cormorant Garamond',serif;font-size:${s(44)}px;font-weight:500;margin-top:${s(6)}px;">La <span style="font-style:italic;">vessel</span></div>
        <div style="display:flex;align-items:center;gap:${s(16)}px;margin-top:${s(12)}px;"><span style="width:${s(40)}px;height:1px;background:#89a88b;"></span><span style="font-size:${s(20)}px;letter-spacing:.44em;text-transform:uppercase;color:#89a88b;font-weight:600;padding-left:.44em;">${dados.eyebrow || 'Oferta especial'}</span><span style="width:${s(40)}px;height:1px;background:#89a88b;"></span></div>
      </div>
      <img src="${dados.fotoDataUrl}" style="width:${s(660)}px;height:auto;object-fit:contain;filter:drop-shadow(0 ${s(40)}px ${s(46)}px rgba(60,36,8,.30));">
      <div style="font-family:'Cormorant Garamond',serif;font-style:italic;font-weight:500;font-size:${s(66)}px;">${esc(dados.nome)}</div>
      <div style="display:flex;align-items:flex-start;gap:${s(12)}px;line-height:.8;">
        <span style="${cormNum}font-size:${s(320)}px;font-weight:600;">${pct}<span style="font-size:${s(150)}px;">%</span></span>
        <span style="font-family:'Archivo',sans-serif;font-size:${s(104)}px;font-weight:700;letter-spacing:.04em;color:#89a88b;align-self:center;">OFF</span>
      </div>
      <div style="display:flex;flex-direction:column;align-items:center;gap:${s(2)}px;">${linhaDe}${linhaPor}</div>
      <div style="background:#89a88b;color:#f2f1ed;font-weight:700;font-size:${s(32)}px;letter-spacing:.18em;text-transform:uppercase;padding:${s(32)}px ${s(84)}px;border-radius:999px;box-shadow:0 16px 34px rgba(88,47,10,.2);display:flex;align-items:center;gap:${s(18)}px;">${dados.cta || 'Eu quero a minha'} <span style="font-size:${s(36)}px;line-height:1;">&#8594;</span></div>
    </div>
  </div>`;
  return pagina(inner, formato);
}

// PRODUTO · Preço Tipográfico (fundo Soft Pearl, preço grande ANTES da bolsa, De riscado + Por apenas gigante OU parcelado)
function produtoPrecoTipografico(dados, formato) {
  const d = DIM[formato];
  const escala = formato === '1080x1350' ? 0.76 : 1;
  const s = (n) => Math.round(n * escala);
  const destaqueParcelado = !!dados.parceladoEmEvidencia;
  // o preço grande é tipográfico e ocupa a largura toda sozinho: o protótipo
  // usava número redondo de 3 dígitos ("R$ 449"); preço real do Bling costuma
  // vir com centavos ("R$ 194,95"), bem mais largo — encolhe a fonte pelo
  // comprimento do texto final pra nunca quebrar linha.
  const fontParaTexto = (texto, base) => Math.min(base, Math.round(1480 / texto.length));
  const fPor = s(fontParaTexto(`R$ ${dados.precoPor}`, 232));
  const fParcelado = s(fontParaTexto(`${dados.parcelas}× R$ ${dados.parcelado}`, 150));
  const blocoPreco = destaqueParcelado
    ? `<div style="display:flex;align-items:baseline;gap:16px;"><span style="font-size:${s(24)}px;letter-spacing:.3em;text-transform:uppercase;font-weight:600;color:#b0a596;padding-left:.3em;">De</span><span style="font-family:'Cormorant Garamond',serif;font-variant-numeric:lining-nums;font-feature-settings:'lnum' 1;font-size:${s(54)}px;font-weight:500;color:#b0a596;text-decoration:line-through;text-decoration-thickness:2px;">R$ ${dados.precoDe}</span></div>
       <span style="font-size:${s(26)}px;letter-spacing:.36em;text-transform:uppercase;font-weight:700;color:#89a88b;padding-left:.36em;">Em até</span>
       <span style="font-family:'Cormorant Garamond',serif;font-variant-numeric:lining-nums;font-feature-settings:'lnum' 1;font-size:${fParcelado}px;font-weight:500;line-height:1;color:#582f0a;white-space:nowrap;">${dados.parcelas}× R$ ${dados.parcelado}</span>`
    : `<div style="display:flex;align-items:baseline;gap:16px;"><span style="font-size:${s(26)}px;letter-spacing:.3em;text-transform:uppercase;font-weight:600;color:#b0a596;padding-left:.3em;">De</span><span style="font-family:'Cormorant Garamond',serif;font-variant-numeric:lining-nums;font-feature-settings:'lnum' 1;font-size:${s(64)}px;font-weight:500;color:#b0a596;text-decoration:line-through;text-decoration-thickness:2px;">R$ ${dados.precoDe}</span></div>
       <span style="font-size:${s(30)}px;letter-spacing:.4em;text-transform:uppercase;font-weight:700;color:#89a88b;padding-left:.4em;">Por apenas</span>
       <span style="font-family:'Cormorant Garamond',serif;font-variant-numeric:lining-nums;font-feature-settings:'lnum' 1;font-size:${fPor}px;font-weight:500;line-height:.96;color:#582f0a;white-space:nowrap;">R$ ${dados.precoPor}</span>`;
  const inner = `
  <div style="position:relative;width:${d.width}px;height:${d.height}px;background:#f2f1ed;overflow:hidden;color:#582f0a;font-family:'Archivo',sans-serif;">
    <div style="position:absolute;inset:0;background-image:url('${MONO.olive}');background-repeat:repeat;background-size:230px;opacity:.045;"></div>
    <div style="position:relative;z-index:1;height:${d.height}px;display:flex;flex-direction:column;align-items:center;text-align:center;justify-content:center;gap:${s(40)}px;padding:${s(110)}px ${s(90)}px;">
      <div style="display:flex;flex-direction:column;align-items:center;">
        <img src="${MONO.brown}" style="height:${s(64)}px;width:auto;">
        <div style="font-family:'Cormorant Garamond',serif;font-size:${s(52)}px;font-weight:500;margin-top:14px;">La <span style="font-style:italic;">vessel</span></div>
        <div style="display:flex;align-items:center;gap:20px;margin-top:20px;"><span style="width:46px;height:1px;background:#89a88b;"></span><span style="font-size:${s(22)}px;letter-spacing:.46em;text-transform:uppercase;color:#89a88b;font-weight:600;padding-left:.46em;">${dados.eyebrow || 'Oferta especial'}</span><span style="width:46px;height:1px;background:#89a88b;"></span></div>
      </div>
      <div style="display:flex;flex-direction:column;align-items:center;gap:8px;">${blocoPreco}</div>
      <img src="${dados.fotoDataUrl}" style="width:${s(560)}px;height:auto;filter:drop-shadow(0 32px 40px rgba(60,36,8,.24));">
      <div style="font-family:'Cormorant Garamond',serif;font-style:italic;font-weight:500;font-size:${s(52)}px;">${esc(dados.nome)}</div>${dados.copyEfeito ? `
      <div style="font-family:'Archivo',sans-serif;font-size:${s(22)}px;letter-spacing:.14em;text-transform:uppercase;color:#7a5a37;font-weight:600;">${esc(dados.copyEfeito)}</div>` : ''}
      <div style="background:#89a88b;color:#f2f1ed;font-weight:600;font-size:${s(30)}px;letter-spacing:.2em;text-transform:uppercase;padding:${s(34)}px ${s(88)}px;border-radius:999px;box-shadow:0 16px 34px rgba(88,47,10,.2);display:flex;align-items:center;gap:18px;">${dados.cta || 'Eu quero a minha'} <span style="font-size:${s(34)}px;line-height:1;">&#8594;</span></div>
    </div>
  </div>`;
  return pagina(inner, formato);
}

// PRODUTO · Sage Círculo (fundo Sage Suede, bolsa em círculo pérola, De riscado + Por grande OU parcelado, CTA Burnt Wood)
function produtoSageCirculo(dados, formato) {
  const d = DIM[formato];
  const escala = formato === '1080x1350' ? 0.76 : 1;
  const s = (n) => Math.round(n * escala);
  const destaqueParcelado = !!dados.parceladoEmEvidencia;
  // mesmo cuidado do preco-tipo: preço real do Bling (com centavos) é bem mais
  // largo que o "R$ 449" redondo do protótipo — encolhe pelo comprimento do
  // texto pra nunca quebrar linha (o "Por"/"Em até" fica na mesma linha, por
  // isso a base é mais conservadora aqui do que na direção tipográfica).
  const fontParaTexto = (texto, base, k) => Math.min(base, Math.round(k / texto.length));
  const fPor = s(fontParaTexto(`R$ ${dados.precoPor}`, 158, 1300));
  const fParcelado = s(fontParaTexto(`${dados.parcelas}× R$ ${dados.parcelado}`, 140, 1480));
  const blocoPreco = destaqueParcelado
    ? `<div style="display:flex;align-items:baseline;gap:16px;"><span style="font-size:${s(24)}px;letter-spacing:.3em;text-transform:uppercase;font-weight:600;color:#6f6a5d;padding-left:.3em;">De</span><span style="font-family:'Cormorant Garamond',serif;font-variant-numeric:lining-nums;font-feature-settings:'lnum' 1;font-size:${s(54)}px;font-weight:500;color:#6f6a5d;text-decoration:line-through;text-decoration-thickness:2px;">R$ ${dados.precoDe}</span></div>
       <span style="font-size:${s(24)}px;letter-spacing:.32em;text-transform:uppercase;font-weight:700;color:#582f0a;padding-left:.32em;">Em até</span>
       <span style="font-family:'Cormorant Garamond',serif;font-variant-numeric:lining-nums;font-feature-settings:'lnum' 1;font-size:${fParcelado}px;font-weight:500;line-height:1;color:#582f0a;white-space:nowrap;">${dados.parcelas}× R$ ${dados.parcelado}</span>`
    : `<div style="display:flex;align-items:baseline;gap:16px;"><span style="font-size:${s(26)}px;letter-spacing:.3em;text-transform:uppercase;font-weight:600;color:#6f6a5d;padding-left:.3em;">De</span><span style="font-family:'Cormorant Garamond',serif;font-variant-numeric:lining-nums;font-feature-settings:'lnum' 1;font-size:${s(60)}px;font-weight:500;color:#6f6a5d;text-decoration:line-through;text-decoration-thickness:2px;">R$ ${dados.precoDe}</span></div>
       <div style="display:flex;align-items:baseline;gap:20px;white-space:nowrap;"><span style="font-size:${s(30)}px;letter-spacing:.32em;text-transform:uppercase;font-weight:700;color:#582f0a;padding-left:.32em;">Por</span><span style="font-family:'Cormorant Garamond',serif;font-variant-numeric:lining-nums;font-feature-settings:'lnum' 1;font-size:${fPor}px;font-weight:500;line-height:1;color:#582f0a;">R$ ${dados.precoPor}</span></div>`;
  const inner = `
  <div style="position:relative;width:${d.width}px;height:${d.height}px;background:#c2cfb4;overflow:hidden;color:#582f0a;font-family:'Archivo',sans-serif;">
    <div style="position:absolute;inset:0;background-image:url('${MONO.olive}');background-repeat:repeat;background-size:230px;opacity:.08;"></div>
    <div style="position:relative;z-index:1;height:${d.height}px;display:flex;flex-direction:column;align-items:center;text-align:center;justify-content:center;gap:${s(44)}px;padding:${s(104)}px ${s(90)}px;">
      <div style="display:flex;flex-direction:column;align-items:center;">
        <img src="${MONO.brown}" style="height:${s(64)}px;width:auto;">
        <div style="font-family:'Cormorant Garamond',serif;font-size:${s(54)}px;font-weight:500;margin-top:14px;">La <span style="font-style:italic;">vessel</span></div>
        <div style="display:flex;align-items:center;gap:20px;margin-top:20px;"><span style="width:46px;height:1px;background:#582f0a;opacity:.4;"></span><span style="font-size:${s(23)}px;letter-spacing:.46em;text-transform:uppercase;color:#582f0a;font-weight:600;padding-left:.46em;">${dados.eyebrow || 'Oferta especial'}</span><span style="width:46px;height:1px;background:#582f0a;opacity:.4;"></span></div>
      </div>
      <div style="position:relative;width:${s(716)}px;height:${s(716)}px;display:flex;align-items:center;justify-content:center;">
        <div style="position:absolute;inset:0;border-radius:50%;background:#f2f1ed;box-shadow:0 30px 60px rgba(60,36,8,.22);"></div>
        <img src="${dados.fotoDataUrl}" style="position:relative;width:${s(532)}px;height:auto;max-height:${s(532)}px;object-fit:contain;filter:drop-shadow(0 22px 28px rgba(60,36,8,.28));">
      </div>
      <div style="font-family:'Cormorant Garamond',serif;font-style:italic;font-weight:500;font-size:${s(58)}px;">${esc(dados.nome)}</div>
      <div style="display:flex;flex-direction:column;align-items:center;gap:8px;">${blocoPreco}</div>${dados.copyEfeito ? `
      <div style="font-family:'Archivo',sans-serif;font-size:${s(22)}px;letter-spacing:.14em;text-transform:uppercase;color:#3a2408;font-weight:600;">${esc(dados.copyEfeito)}</div>` : ''}
      <div style="background:#582f0a;color:#f2f1ed;font-weight:600;font-size:${s(29)}px;letter-spacing:.2em;text-transform:uppercase;padding:${s(32)}px ${s(84)}px;border-radius:999px;box-shadow:0 16px 34px rgba(60,36,8,.28);display:flex;align-items:center;gap:18px;white-space:nowrap;">${dados.cta || 'Aproveite já'} <span style="font-size:${s(32)}px;line-height:1;">&#8594;</span></div>
    </div>
  </div>`;
  return pagina(inner, formato);
}

// PROMO · Sage (fundo radial Sage, bolsa em círculo pérola, 50%+OFF gigante, nome, De/Por, CTA Burnt Wood)
function promoSage(dados, formato) {
  const d = DIM[formato];
  const escala = formato === '1080x1350' ? 0.76 : 1;
  const s = (n) => Math.round(n * escala);
  const inner = `
  <div style="position:relative;width:${d.width}px;height:${d.height}px;background:radial-gradient(125% 80% at 50% 40%, #ccd7be 0%, #b4c4a2 100%);overflow:hidden;color:#582f0a;font-family:'Archivo',sans-serif;">
    <div style="position:absolute;inset:0;background-image:url('${MONO.brown}');background-repeat:repeat;background-size:230px;opacity:.05;"></div>
    <div style="position:relative;z-index:1;height:${d.height}px;display:flex;flex-direction:column;align-items:center;text-align:center;justify-content:center;gap:${s(54)}px;padding:${s(96)}px ${s(100)}px;">
      <div style="display:flex;flex-direction:column;align-items:center;">
        <img src="${MONO.brown}" style="height:${s(64)}px;width:auto;">
        <div style="font-family:'Cormorant Garamond',serif;font-size:${s(50)}px;font-weight:500;margin-top:18px;">La <span style="font-style:italic;">vessel</span></div>
        <div style="display:flex;align-items:center;gap:18px;margin-top:22px;"><span style="width:44px;height:1px;background:#582f0a;opacity:.4;"></span><span style="font-size:${s(20)}px;letter-spacing:.46em;text-transform:uppercase;color:#4f5c43;font-weight:600;padding-left:.46em;">${dados.eyebrow || 'Season Sale'}</span><span style="width:44px;height:1px;background:#582f0a;opacity:.4;"></span></div>
      </div>
      <div style="display:flex;align-items:center;justify-content:center;width:${s(700)}px;height:${s(700)}px;border-radius:50%;background:#f2f1ed;box-shadow:0 34px 70px rgba(60,36,8,.16);">
        <img src="${dados.fotoDataUrl}" style="width:${s(520)}px;height:auto;max-height:${s(520)}px;object-fit:contain;filter:drop-shadow(0 24px 30px rgba(60,36,8,.28));">
      </div>
      <div style="display:flex;flex-direction:column;align-items:center;">
        <div style="font-family:'Cormorant Garamond',serif;font-style:italic;font-weight:500;font-size:${s(48)}px;margin-bottom:18px;">${esc(dados.nome)}</div>
        <div style="display:flex;align-items:baseline;gap:26px;">
          <span style="font-family:'Cormorant Garamond',serif;font-variant-numeric:lining-nums;font-feature-settings:'lnum' 1;font-size:${s(300)}px;font-weight:500;line-height:1;">${dados.oferta || '50%'}</span>
          <span style="font-family:'Archivo',sans-serif;font-size:${s(78)}px;letter-spacing:.14em;font-weight:700;">OFF</span>
        </div>
        <div style="display:flex;flex-direction:column;align-items:center;gap:${s(2)}px;margin-top:${s(26)}px;">
          <div style="display:flex;align-items:baseline;gap:${s(12)}px;"><span style="font-family:'Archivo',sans-serif;font-size:${s(26)}px;letter-spacing:.3em;font-weight:600;color:#6f6a5d;">DE</span><span style="font-family:'Cormorant Garamond',serif;font-variant-numeric:lining-nums;font-feature-settings:'lnum' 1;font-size:${s(46)}px;font-weight:500;color:#6f6a5d;text-decoration:line-through;text-decoration-thickness:2px;">R$ ${dados.precoDe}</span></div>
          <div style="display:flex;align-items:baseline;gap:${s(16)}px;"><span style="font-family:'Archivo',sans-serif;font-size:${s(30)}px;letter-spacing:.3em;font-weight:700;color:#4f5c43;">POR</span><span style="font-family:'Cormorant Garamond',serif;font-variant-numeric:lining-nums;font-feature-settings:'lnum' 1;font-size:${s(104)}px;font-weight:600;color:#582f0a;line-height:1;">R$ ${dados.precoPor}</span></div>
        </div>${dados.copyEfeito ? `
        <div style="font-family:'Archivo',sans-serif;font-size:${s(22)}px;letter-spacing:.14em;text-transform:uppercase;color:#4f5c43;font-weight:600;margin-top:16px;">${esc(dados.copyEfeito)}</div>` : ''}
      </div>
      <div style="background:#582f0a;color:#f2f1ed;font-weight:600;font-size:${s(27)}px;letter-spacing:.2em;text-transform:uppercase;padding:${s(32)}px ${s(82)}px;border-radius:999px;box-shadow:0 18px 36px rgba(60,36,8,.32);display:flex;align-items:center;gap:18px;white-space:nowrap;">${dados.cta || 'Garanta a sua'} <span style="font-size:${s(30)}px;line-height:1;">&#8594;</span></div>
    </div>
  </div>`;
  return pagina(inner, formato);
}

// PROMO · Minimal Pearl (fundo Soft Pearl, moldura fina Sage, bolsa flutuando sem molde, 50%+OFF, De/Por, CTA)
function promoMinimalPearl(dados, formato) {
  const d = DIM[formato];
  const escala = formato === '1080x1350' ? 0.76 : 1;
  const s = (n) => Math.round(n * escala);
  const inner = `
  <div style="position:relative;width:${d.width}px;height:${d.height}px;background:#f2f1ed;overflow:hidden;color:#582f0a;font-family:'Archivo',sans-serif;">
    <div style="position:absolute;inset:0;background-image:url('${MONO.olive}');background-repeat:repeat;background-size:220px;opacity:.05;"></div>
    <div style="position:absolute;inset:${s(40)}px;border:1px solid rgba(137,168,139,.55);"></div>
    <div style="position:relative;z-index:1;height:100%;display:flex;flex-direction:column;align-items:center;text-align:center;justify-content:space-between;padding:${s(132)}px ${s(104)}px ${s(120)}px;">
      <div style="display:flex;flex-direction:column;align-items:center;">
        <img src="${MONO.brown}" style="height:${s(64)}px;width:auto;">
        <div style="font-family:'Cormorant Garamond',serif;font-size:${s(50)}px;font-weight:500;margin-top:18px;">La <span style="font-style:italic;">vessel</span></div>
        <div style="display:flex;align-items:center;gap:18px;margin-top:22px;"><span style="width:44px;height:1px;background:#89a88b;"></span><span style="font-size:${s(20)}px;letter-spacing:.46em;text-transform:uppercase;color:#89a88b;font-weight:600;padding-left:.46em;">${dados.eyebrow || 'Season Sale'}</span><span style="width:44px;height:1px;background:#89a88b;"></span></div>
      </div>
      <img src="${dados.fotoDataUrl}" style="width:${s(512)}px;height:auto;object-fit:contain;filter:drop-shadow(0 34px 40px rgba(88,47,10,.26));">
      <div style="display:flex;flex-direction:column;align-items:center;">
        <div style="font-family:'Cormorant Garamond',serif;font-style:italic;font-weight:500;font-size:${s(48)}px;margin-bottom:18px;">${esc(dados.nome)}</div>
        <div style="display:flex;align-items:baseline;gap:26px;">
          <span style="font-family:'Cormorant Garamond',serif;font-variant-numeric:lining-nums;font-feature-settings:'lnum' 1;font-size:${s(300)}px;font-weight:500;line-height:1;">${dados.oferta || '50%'}</span>
          <span style="font-family:'Archivo',sans-serif;font-size:${s(78)}px;letter-spacing:.14em;font-weight:700;color:#89a88b;">OFF</span>
        </div>
        ${dados.precoDe && dados.precoPor ? `<div style="display:flex;flex-direction:column;align-items:center;gap:${s(2)}px;margin-top:${s(26)}px;">
          <div style="display:flex;align-items:baseline;gap:${s(12)}px;"><span style="font-family:'Archivo',sans-serif;font-size:${s(26)}px;letter-spacing:.3em;font-weight:600;color:#a08f77;">DE</span><span style="font-family:'Cormorant Garamond',serif;font-variant-numeric:lining-nums;font-feature-settings:'lnum' 1;font-size:${s(46)}px;font-weight:500;color:#a08f77;text-decoration:line-through;text-decoration-thickness:2px;">R$ ${dados.precoDe}</span></div>
          <div style="display:flex;align-items:baseline;gap:${s(16)}px;"><span style="font-family:'Archivo',sans-serif;font-size:${s(30)}px;letter-spacing:.3em;font-weight:700;color:#89a88b;">POR</span><span style="font-family:'Cormorant Garamond',serif;font-variant-numeric:lining-nums;font-feature-settings:'lnum' 1;font-size:${s(104)}px;font-weight:600;color:#582f0a;line-height:1;">R$ ${dados.precoPor}</span></div>
        </div>` : ''}${dados.copyEfeito ? `
        <div style="font-family:'Archivo',sans-serif;font-size:${s(22)}px;letter-spacing:.14em;text-transform:uppercase;color:#7a5a37;font-weight:600;margin-top:16px;">${esc(dados.copyEfeito)}</div>` : ''}
      </div>
      <div style="background:#89a88b;color:#f2f1ed;font-weight:600;font-size:${s(27)}px;letter-spacing:.2em;text-transform:uppercase;padding:${s(32)}px ${s(82)}px;border-radius:999px;box-shadow:0 16px 32px rgba(88,47,10,.2);display:flex;align-items:center;gap:18px;white-space:nowrap;">${dados.cta || 'Eu quero a minha'} <span style="font-size:${s(30)}px;line-height:1;">&#8594;</span></div>
    </div>
  </div>`;
  return pagina(inner, formato);
}

// PROMO · Burnt Wood (fundo Burnt Wood com halo sage, bolsa em molde pérola arredondado, 50%+OFF hero, De/Por, CTA)
function promoBurntWood(dados, formato) {
  const d = DIM[formato];
  const escala = formato === '1080x1350' ? 0.76 : 1;
  const s = (n) => Math.round(n * escala);
  const inner = `
  <div style="position:relative;width:${d.width}px;height:${d.height}px;background:#582f0a;overflow:hidden;color:#f2f1ed;font-family:'Archivo',sans-serif;">
    <div style="position:absolute;inset:0;background-image:url('${MONO.cream}');background-repeat:repeat;background-size:230px;opacity:.04;"></div>
    <div style="position:absolute;inset:0;background:radial-gradient(115% 60% at 50% 34%, rgba(137,168,139,.15), transparent 62%);"></div>
    <div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:space-between;text-align:center;padding:${s(118)}px ${s(96)}px ${s(106)}px;">
      <div style="display:flex;flex-direction:column;align-items:center;">
        <img src="${MONO.cream}" style="height:${s(70)}px;width:auto;">
        <div style="font-family:'Cormorant Garamond',serif;font-size:${s(52)}px;font-weight:500;margin-top:20px;">La <span style="font-style:italic;">vessel</span></div>
        <div style="display:flex;align-items:center;gap:22px;margin-top:26px;"><span style="width:46px;height:1px;background:#c2cfb4;opacity:.55;"></span><span style="font-size:${s(21)}px;letter-spacing:.5em;text-transform:uppercase;color:#c2cfb4;font-weight:500;padding-left:.5em;">${dados.eyebrow || 'Season Sale'}</span><span style="width:46px;height:1px;background:#c2cfb4;opacity:.55;"></span></div>
      </div>
      <div style="position:relative;width:${s(520)}px;height:${s(590)}px;">
        <div style="position:absolute;inset:0;background:#f2f1ed;border-radius:${s(272)}px ${s(272)}px ${s(24)}px ${s(24)}px;overflow:hidden;box-shadow:0 34px 70px rgba(0,0,0,.4);">
          <div style="position:absolute;inset:0;background-image:url('${MONO.olive}');background-repeat:repeat;background-size:140px;opacity:.05;"></div>
          <div style="position:absolute;inset:18px;border:1px solid rgba(137,168,139,.5);border-radius:${s(258)}px ${s(258)}px ${s(12)}px ${s(12)}px;"></div>
        </div>
        <img src="${dados.fotoDataUrl}" style="position:absolute;bottom:${s(34)}px;left:50%;transform:translateX(-50%);width:${s(470)}px;height:auto;object-fit:contain;filter:drop-shadow(0 24px 26px rgba(0,0,0,.38));">
      </div>
      <div style="display:flex;flex-direction:column;align-items:center;">
        <div style="font-family:'Cormorant Garamond',serif;font-style:italic;font-weight:500;font-size:${s(56)}px;margin-bottom:20px;">${esc(dados.nome)}</div>
        <div style="display:flex;align-items:baseline;gap:30px;">
          <span style="font-family:'Cormorant Garamond',serif;font-variant-numeric:lining-nums;font-feature-settings:'lnum' 1;font-size:${s(308)}px;font-weight:500;line-height:1;">${dados.oferta || '50%'}</span>
          <span style="font-family:'Archivo',sans-serif;font-size:${s(82)}px;letter-spacing:.12em;font-weight:700;color:#c2cfb4;">OFF</span>
        </div>
        <div style="display:flex;flex-direction:column;align-items:center;gap:${s(2)}px;margin-top:${s(30)}px;">
          <div style="display:flex;align-items:baseline;gap:${s(12)}px;"><span style="font-family:'Archivo',sans-serif;font-size:${s(26)}px;letter-spacing:.3em;font-weight:600;color:#d8cdb8;">DE</span><span style="font-family:'Cormorant Garamond',serif;font-variant-numeric:lining-nums;font-feature-settings:'lnum' 1;font-size:${s(46)}px;font-weight:500;color:#d8cdb8;text-decoration:line-through;text-decoration-thickness:2px;">R$ ${dados.precoDe}</span></div>
          <div style="display:flex;align-items:baseline;gap:${s(16)}px;"><span style="font-family:'Archivo',sans-serif;font-size:${s(30)}px;letter-spacing:.3em;font-weight:700;color:#c2cfb4;">POR</span><span style="font-family:'Cormorant Garamond',serif;font-variant-numeric:lining-nums;font-feature-settings:'lnum' 1;font-size:${s(104)}px;font-weight:600;">R$ ${dados.precoPor}</span></div>
        </div>${dados.copyEfeito ? `
        <div style="font-family:'Archivo',sans-serif;font-size:${s(22)}px;letter-spacing:.14em;text-transform:uppercase;color:#e4e6d9;opacity:.82;font-weight:600;margin-top:${s(20)}px;">${esc(dados.copyEfeito)}</div>` : ''}
      </div>
      <div style="background:#89a88b;color:#f2f1ed;font-weight:600;font-size:${s(27)}px;letter-spacing:.2em;text-transform:uppercase;padding:${s(32)}px ${s(82)}px;border-radius:999px;box-shadow:0 18px 36px rgba(0,0,0,.3);display:flex;align-items:center;gap:18px;white-space:nowrap;">${dados.cta || 'Aproveite já'} <span style="font-size:${s(30)}px;line-height:1;">&#8594;</span></div>
    </div>
  </div>`;
  return pagina(inner, formato);
}

// EDITORIAL · Sale (painel Sage com herói 3/4 no topo, painel Soft Pearl com oferta+De/Por na base)
function editorialSale(dados, formato) {
  const d = DIM[formato];
  const escala = formato === '1080x1350' ? 0.76 : 1;
  const s = (n) => Math.round(n * escala);
  const inner = `
  <div style="position:relative;width:${d.width}px;height:${d.height}px;background:#f2f1ed;overflow:hidden;color:#582f0a;font-family:'Archivo',sans-serif;display:flex;flex-direction:column;">
    <div style="position:relative;flex:0 0 58%;background:#c2cfb4;overflow:hidden;border-bottom:1px solid rgba(137,168,139,.6);display:flex;flex-direction:column;">
      <div style="position:absolute;inset:0;background-image:url('${MONO.cream}');background-repeat:repeat;background-size:180px;opacity:.14;"></div>
      <div style="position:relative;z-index:2;display:flex;flex-direction:column;align-items:center;padding-top:${s(78)}px;">
        <img src="${MONO.brown}" style="height:${s(54)}px;width:auto;">
        <div style="font-family:'Cormorant Garamond',serif;font-size:${s(50)}px;font-weight:500;margin-top:12px;">La <span style="font-style:italic;">vessel</span></div>
      </div>
      <div style="position:relative;z-index:3;flex:1;display:flex;align-items:center;justify-content:center;">
        <div style="position:absolute;left:50%;bottom:${s(20)}px;transform:translateX(-50%);width:${s(470)}px;height:${s(60)}px;background:radial-gradient(ellipse at center, rgba(88,47,10,.30) 0%, rgba(88,47,10,0) 72%);filter:blur(11px);"></div>
        <img src="${dados.fotoDataUrl}" style="position:relative;width:${s(600)}px;height:auto;max-height:100%;object-fit:contain;filter:drop-shadow(0 34px 40px rgba(88,47,10,.32));">
      </div>
    </div>
    <div style="position:relative;flex:0 0 42%;background:#f2f1ed;overflow:hidden;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:${s(56)}px ${s(90)}px;gap:${s(20)}px;">
      <div style="position:absolute;inset:0;background-image:url('${MONO.olive}');background-repeat:repeat;background-size:200px;opacity:.05;"></div>
      <div style="position:relative;z-index:1;display:flex;align-items:center;gap:16px;">
        <span style="width:44px;height:1px;background:#89a88b;"></span>
        <span style="font-size:${s(22)}px;letter-spacing:.5em;text-transform:uppercase;color:#89a88b;font-weight:600;padding-left:.5em;">${dados.eyebrow || 'Sale'}</span>
        <span style="width:44px;height:1px;background:#89a88b;"></span>
      </div>
      <div style="position:relative;z-index:1;display:flex;align-items:flex-start;gap:${s(26)}px;">
        <span style="font-family:'Cormorant Garamond',serif;font-variant-numeric:lining-nums;font-feature-settings:'lnum' 1;font-size:${s(272)}px;font-weight:500;line-height:.8;color:#582f0a;">${dados.oferta || '50%'}</span>
        <span style="font-family:'Archivo',sans-serif;font-weight:700;font-size:${s(70)}px;letter-spacing:.14em;color:#89a88b;padding-top:${s(30)}px;padding-left:.14em;">OFF</span>
      </div>
      <div style="position:relative;z-index:1;font-family:'Cormorant Garamond',serif;font-style:italic;font-weight:500;font-size:${s(60)}px;color:#582f0a;line-height:1;">${esc(dados.nome)}</div>
      <div style="position:relative;z-index:1;display:flex;flex-direction:column;align-items:center;gap:${s(2)}px;">
        <div style="display:flex;align-items:baseline;gap:${s(12)}px;"><span style="font-family:'Archivo',sans-serif;font-size:${s(26)}px;letter-spacing:.3em;font-weight:600;color:#a08f77;">DE</span><span style="font-family:'Cormorant Garamond',serif;font-variant-numeric:lining-nums;font-feature-settings:'lnum' 1;font-size:${s(52)}px;font-weight:500;color:#a08f77;text-decoration:line-through;text-decoration-thickness:2px;">R$ ${dados.precoDe}</span></div>
        <div style="display:flex;align-items:baseline;gap:${s(16)}px;"><span style="font-family:'Archivo',sans-serif;font-size:${s(32)}px;letter-spacing:.3em;font-weight:700;color:#89a88b;">POR</span><span style="font-family:'Cormorant Garamond',serif;font-variant-numeric:lining-nums;font-feature-settings:'lnum' 1;font-size:${s(118)}px;font-weight:600;color:#582f0a;line-height:1;">R$ ${dados.precoPor}</span></div>
      </div>${dados.copyEfeito ? `
      <div style="position:relative;z-index:1;font-family:'Archivo',sans-serif;font-size:${s(20)}px;letter-spacing:.14em;text-transform:uppercase;color:#7a5a37;font-weight:600;">${esc(dados.copyEfeito)}</div>` : ''}
      <div style="position:relative;z-index:1;margin-top:${s(12)}px;background:#89a88b;color:#f2f1ed;font-weight:600;font-size:${s(26)}px;letter-spacing:.2em;text-transform:uppercase;padding:${s(26)}px ${s(74)}px;border-radius:999px;box-shadow:0 16px 34px rgba(88,47,10,.22);display:flex;align-items:center;gap:16px;white-space:nowrap;">${dados.cta || 'Comprar agora'} <span style="font-size:${s(27)}px;line-height:1;">&#8594;</span></div>
    </div>
  </div>`;
  return pagina(inner, formato);
}

// EDITORIAL · V2 (fundo Sage inteiro, disco Soft Pearl com herói 3/4, oferta+De/Por logo abaixo, CTA)
function editorialV2(dados, formato) {
  const d = DIM[formato];
  const escala = formato === '1080x1350' ? 0.76 : 1;
  const s = (n) => Math.round(n * escala);
  const inner = `
  <div style="position:relative;width:${d.width}px;height:${d.height}px;background:#c2cfb4;overflow:hidden;color:#582f0a;font-family:'Archivo',sans-serif;">
    <div style="position:absolute;inset:0;background-image:url('${MONO.cream}');background-repeat:repeat;background-size:190px;opacity:.13;"></div>
    <div style="position:relative;z-index:1;height:100%;display:flex;flex-direction:column;align-items:center;text-align:center;padding:${s(96)}px ${s(80)}px ${s(64)}px;">
      <div style="display:flex;flex-direction:column;align-items:center;">
        <img src="${MONO.brown}" style="height:${s(54)}px;width:auto;">
        <div style="font-family:'Cormorant Garamond',serif;font-size:${s(50)}px;font-weight:500;margin-top:12px;">La <span style="font-style:italic;">vessel</span></div>
      </div>
      <div style="position:relative;flex:1;width:100%;display:flex;align-items:center;justify-content:center;margin-top:${s(24)}px;">
        <div style="position:absolute;width:${s(760)}px;height:${s(760)}px;border-radius:50%;background:#f2f1ed;box-shadow:0 44px 90px rgba(88,47,10,.22), inset 0 -24px 60px rgba(88,47,10,.05);overflow:hidden;">
          <div style="position:absolute;inset:0;background-image:url('${MONO.olive}');background-repeat:repeat;background-size:150px;opacity:.06;"></div>
        </div>
        <div style="position:absolute;left:50%;bottom:${s(150)}px;transform:translateX(-50%);width:${s(400)}px;height:${s(56)}px;background:radial-gradient(ellipse at center, rgba(88,47,10,.26) 0%, rgba(88,47,10,0) 72%);filter:blur(11px);"></div>
        <img src="${dados.fotoDataUrl}" style="position:relative;width:${s(560)}px;height:auto;max-height:${s(700)}px;object-fit:contain;filter:drop-shadow(0 30px 38px rgba(88,47,10,.34));">
      </div>
      <div style="display:flex;flex-direction:column;align-items:center;gap:${s(18)}px;padding-top:${s(24)}px;">
        <div style="display:flex;align-items:center;gap:16px;">
          <span style="width:44px;height:1px;background:#89a88b;"></span>
          <span style="font-size:${s(22)}px;letter-spacing:.5em;text-transform:uppercase;color:#89a88b;font-weight:600;padding-left:.5em;">${dados.eyebrow || 'Sale'}</span>
          <span style="width:44px;height:1px;background:#89a88b;"></span>
        </div>
        <div style="display:flex;align-items:flex-start;gap:${s(24)}px;">
          <span style="font-family:'Cormorant Garamond',serif;font-variant-numeric:lining-nums;font-feature-settings:'lnum' 1;font-size:${s(258)}px;font-weight:500;line-height:.8;">${dados.oferta || '50%'}</span>
          <span style="font-family:'Archivo',sans-serif;font-weight:700;font-size:${s(66)}px;letter-spacing:.14em;color:#89a88b;padding-top:${s(28)}px;padding-left:.14em;">OFF</span>
        </div>
        <div style="font-family:'Cormorant Garamond',serif;font-style:italic;font-weight:500;font-size:${s(58)}px;line-height:1;">${esc(dados.nome)}</div>
        <div style="display:flex;flex-direction:column;align-items:center;gap:${s(2)}px;">
          <div style="display:flex;align-items:baseline;gap:${s(12)}px;"><span style="font-family:'Archivo',sans-serif;font-size:${s(26)}px;letter-spacing:.3em;font-weight:600;color:#a08f77;">DE</span><span style="font-family:'Cormorant Garamond',serif;font-variant-numeric:lining-nums;font-feature-settings:'lnum' 1;font-size:${s(52)}px;font-weight:500;color:#a08f77;text-decoration:line-through;text-decoration-thickness:2px;">R$ ${dados.precoDe}</span></div>
          <div style="display:flex;align-items:baseline;gap:${s(16)}px;"><span style="font-family:'Archivo',sans-serif;font-size:${s(32)}px;letter-spacing:.3em;font-weight:700;color:#89a88b;">POR</span><span style="font-family:'Cormorant Garamond',serif;font-variant-numeric:lining-nums;font-feature-settings:'lnum' 1;font-size:${s(116)}px;font-weight:600;line-height:1;">R$ ${dados.precoPor}</span></div>
        </div>${dados.copyEfeito ? `
        <div style="font-family:'Archivo',sans-serif;font-size:${s(20)}px;letter-spacing:.14em;text-transform:uppercase;color:#3a2408;font-weight:600;">${esc(dados.copyEfeito)}</div>` : ''}
        <div style="margin-top:${s(8)}px;background:#89a88b;color:#f2f1ed;font-weight:600;font-size:${s(26)}px;letter-spacing:.2em;text-transform:uppercase;padding:${s(26)}px ${s(74)}px;border-radius:999px;box-shadow:0 16px 34px rgba(88,47,10,.22);display:flex;align-items:center;gap:16px;white-space:nowrap;">${dados.cta || 'Comprar agora'} <span style="font-size:${s(26)}px;line-height:1;">&#8594;</span></div>
      </div>
    </div>
  </div>`;
  return pagina(inner, formato);
}

// PRODUTO · Split (Soft Pearl à esquerda com texto/oferta, painel Sage à direita com a bolsa
// flutuando; "50%"+"OFF" hero na coluna de texto + De/Por opcional como suporte)
function produtoSplit(dados, formato) {
  const d = DIM[formato];
  // o design nasceu no Post 1080x1350 (split lado a lado, largura já é 1080 nos dois
  // formatos) — a coluna de texto fica fixa em 540px (metade do canvas) nos dois formatos;
  // o que muda de um formato pro outro é só a altura do canvas, e o justify-content:
  // space-between da coluna de texto absorve a folga extra da Story automaticamente, sem
  // precisar reescalar nada.
  const bagWidth = formato === '1080x1920' ? 520 : 496;
  const destaquePreco = !!(dados.precoDe && dados.precoPor);
  const blocoSuporte = destaquePreco
    ? `<div style="display:flex;flex-direction:column;align-items:flex-start;gap:4px;margin-top:32px;"><span style="font-family:'Cormorant Garamond',serif;font-variant-numeric:lining-nums;font-feature-settings:'lnum' 1;font-size:44px;font-weight:500;color:#a08f77;text-decoration:line-through;text-decoration-thickness:2px;white-space:nowrap;">R$ ${dados.precoDe}</span><span style="font-family:'Cormorant Garamond',serif;font-variant-numeric:lining-nums;font-feature-settings:'lnum' 1;font-size:82px;font-weight:600;color:#582f0a;line-height:1;white-space:nowrap;">R$ ${dados.precoPor}</span></div>`
    : `<div style="font-size:26px;letter-spacing:.06em;color:#7a5a37;margin-top:40px;line-height:1.5;font-weight:400;">Seleção especial de bolsas<br>por tempo limitado</div>`;
  const linhaCopy = dados.copyEfeito
    ? `<div style="font-family:'Archivo',sans-serif;font-size:23px;letter-spacing:.14em;text-transform:uppercase;color:#7a5a37;font-weight:600;margin-top:16px;">${esc(dados.copyEfeito)}</div>`
    : '';
  const inner = `
  <div style="position:relative;width:${d.width}px;height:${d.height}px;background:#f2f1ed;overflow:hidden;color:#582f0a;font-family:'Archivo',sans-serif;display:flex;">
    <div style="position:absolute;inset:0;background-image:url('${MONO.olive}');background-repeat:repeat;background-size:210px;opacity:.045;"></div>
    <div style="position:relative;z-index:2;width:540px;flex:0 0 auto;padding:92px 56px 92px 84px;display:flex;flex-direction:column;justify-content:space-between;align-items:flex-start;">
      <div style="display:flex;flex-direction:column;align-items:flex-start;">
        <img src="${MONO.brown}" style="height:60px;width:auto;">
        <div style="font-family:'Cormorant Garamond',serif;font-size:52px;font-weight:500;margin-top:16px;color:#582f0a;">La <span style="font-style:italic;">vessel</span></div>
        <div style="display:flex;align-items:center;gap:16px;margin-top:22px;"><span style="width:40px;height:1px;background:#89a88b;"></span><span style="font-size:21px;letter-spacing:.44em;text-transform:uppercase;color:#89a88b;font-weight:600;padding-left:.44em;">${dados.eyebrow || 'Season Sale'}</span></div>
      </div>
      <div style="display:flex;flex-direction:column;align-items:flex-start;max-width:400px;">
        <div style="font-size:21px;letter-spacing:.42em;text-transform:uppercase;color:#89a88b;font-weight:600;padding-left:.42em;">Bolsa</div>
        <div style="font-family:'Cormorant Garamond',serif;font-style:italic;font-weight:500;font-size:54px;line-height:1.06;color:#582f0a;margin-top:6px;margin-bottom:12px;max-width:400px;overflow-wrap:break-word;">${esc((dados.nome || '').replace(/^bolsa\s+/i, ''))}</div>
        <div style="display:flex;flex-direction:column;align-items:flex-start;">
          <span style="font-family:'Cormorant Garamond',serif;font-variant-numeric:lining-nums;font-feature-settings:'lnum' 1;font-size:264px;font-weight:500;line-height:.92;color:#582f0a;">${dados.oferta || '50%'}</span>
          <span style="font-family:'Archivo',sans-serif;font-size:88px;letter-spacing:.16em;font-weight:700;color:#89a88b;margin-top:2px;padding-left:.16em;line-height:1;">OFF</span>
        </div>${blocoSuporte}${linhaCopy}
      </div>
      <div style="background:#89a88b;color:#f2f1ed;font-weight:600;font-size:27px;letter-spacing:.18em;text-transform:uppercase;padding:30px 64px;border-radius:999px;box-shadow:0 16px 32px rgba(88,47,10,.2);display:flex;align-items:center;gap:14px;white-space:nowrap;">${dados.cta || 'Aproveite já'} <span style="font-size:30px;line-height:1;">&#8594;</span></div>
    </div>
    <div style="position:relative;z-index:1;flex:1 1 auto;background:#c2cfb4;overflow:hidden;border-left:1px solid rgba(137,168,139,.6);">
      <div style="position:absolute;inset:0;background-image:url('${MONO.cream}');background-repeat:repeat;background-size:160px;opacity:.14;"></div>
      <img src="${dados.fotoDataUrl}" style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:${bagWidth}px;height:auto;filter:drop-shadow(0 28px 34px rgba(88,47,10,.32));">
      <img src="${MONO.brown}" style="position:absolute;bottom:46px;right:46px;height:64px;width:auto;opacity:.4;">
    </div>
  </div>`;
  return pagina(inner, formato);
}

// PRODUTO · Modelo (split: foto ORIGINAL da modelo com bolsa — com o fundo dela,
// SEM recorte — à esquerda; oferta "50%"+"OFF" + nome + De/Por + CTA à direita
// sobre fundo colorido. 4 variantes de cor do protótipo: sage (Sage Suede) /
// pearl (Soft Pearl) / espresso (Dark Espresso, texto claro) — 'sage' é o default.)
const VARIANTES_MODELO = {
  sage:     { bgDireita: '#c2cfb4', monoPattern: MONO.cream, monoPatternOpacity: .13, corBorda: '#89a88b', lineColor: '#597a5c', saleColor: '#597a5c', offColor: '#597a5c', monoTopo: MONO.brown, textoCor: '#582f0a', nomeCor: '#582f0a', ofertaCor: '#582f0a', precoDeCor: '#8f7d64', precoPorCor: '#582f0a', copyCor: '#4f5c43', ctaBg: '#582f0a', ctaCor: '#f2f1ed', ctaSeta: '#f2f1ed' },
  pearl:    { bgDireita: '#f2f1ed', monoPattern: MONO.olive, monoPatternOpacity: .06, corBorda: '#89a88b', lineColor: '#89a88b', saleColor: '#597a5c', offColor: '#597a5c', monoTopo: MONO.brown, textoCor: '#582f0a', nomeCor: '#582f0a', ofertaCor: '#582f0a', precoDeCor: '#8f7d64', precoPorCor: '#582f0a', copyCor: '#7a5a37', ctaBg: '#89a88b', ctaCor: '#f2f1ed', ctaSeta: '#f2f1ed' },
  espresso: { bgDireita: '#43250a', monoPattern: MONO.cream, monoPatternOpacity: .05, corBorda: '#c9a54f', lineColor: '#c9a54f', saleColor: '#e0c893', offColor: '#e0c893', monoTopo: MONO.cream, textoCor: '#f3ecdd', nomeCor: '#f3ecdd', ofertaCor: '#fdf6e6', precoDeCor: '#c3a684', precoPorCor: '#fdf6e6', copyCor: '#e4e6d9', ctaBg: '#f3ecdd', ctaCor: '#43250a', ctaSeta: '#a98545' },
};

function produtoModelo(dados, formato) {
  const d = DIM[formato];
  const isStory = formato === '1080x1920';
  const v = VARIANTES_MODELO[dados.varianteCor] || VARIANTES_MODELO.sage;
  const leftWidth = isStory ? 640 : 600;
  const pad = isStory ? '70px 40px 60px' : '56px 36px 52px';
  const fMono = isStory ? 42 : 40;
  const fBrand = isStory ? 38 : 36;
  const lineW = isStory ? 34 : 30;
  const fSale = isStory ? 23 : 21;
  const fOferta = isStory ? 232 : 218;
  const fOff = isStory ? 62 : 58;
  const fNome = isStory ? 58 : 54;
  const fDe = isStory ? 50 : 48;
  const fPor = isStory ? 96 : 90;
  const fCta = isStory ? 27 : 25;
  const ctaPad = isStory ? '26px 60px' : '24px 56px';
  const fSeta = isStory ? 24 : 25;
  const objectPosition = dados.modeloObjectPosition || '50% 30%';
  const inner = `
  <div style="position:relative;width:${d.width}px;height:${d.height}px;background:${v.bgDireita};overflow:hidden;color:${v.textoCor};font-family:'Archivo',sans-serif;display:flex;">
    <div style="position:relative;flex:0 0 ${leftWidth}px;height:100%;overflow:hidden;background:#eceae9;border-right:3px solid ${v.corBorda};">
      <img src="${dados.modeloFotoUrl}" style="width:100%;height:100%;object-fit:cover;object-position:${objectPosition};">
    </div>
    <div style="position:relative;flex:1 1 auto;overflow:hidden;background:${v.bgDireita};">
      <div style="position:absolute;inset:0;background-image:url('${v.monoPattern}');background-repeat:repeat;background-size:180px;opacity:${v.monoPatternOpacity};"></div>
      <div style="position:relative;z-index:1;height:100%;display:flex;flex-direction:column;align-items:center;text-align:center;padding:${pad};">
        <img src="${v.monoTopo}" style="height:${fMono}px;width:auto;">
        <div style="font-family:'Cormorant Garamond',serif;font-size:${fBrand}px;font-weight:500;margin-top:8px;white-space:nowrap;color:${v.textoCor};">La <span style="font-style:italic;">vessel</span></div>
        <div style="flex:1 1 auto;display:flex;flex-direction:column;justify-content:center;align-items:center;gap:18px;">
          <div style="display:flex;align-items:center;gap:14px;">
            <span style="width:${lineW}px;height:1px;background:${v.lineColor};"></span>
            <span style="font-size:${fSale}px;letter-spacing:.46em;text-transform:uppercase;color:${v.saleColor};font-weight:600;padding-left:.46em;">${esc(dados.eyebrow || 'Sale')}</span>
            <span style="width:${lineW}px;height:1px;background:${v.lineColor};"></span>
          </div>
          <div style="display:flex;flex-direction:column;align-items:center;gap:0;">
            <span style="font-family:'Cormorant Garamond',serif;font-variant-numeric:lining-nums;font-feature-settings:'lnum' 1;font-size:${fOferta}px;font-weight:500;line-height:.78;color:${v.ofertaCor};">${dados.oferta || '50%'}</span>
            <span style="font-family:'Archivo',sans-serif;font-weight:700;font-size:${fOff}px;letter-spacing:.4em;color:${v.offColor};padding-left:.4em;margin-top:-8px;">OFF</span>
          </div>
          <div style="font-family:'Cormorant Garamond',serif;font-style:italic;font-weight:500;font-size:${fNome}px;color:${v.nomeCor};line-height:1;">${esc(dados.nome)}</div>
          <div style="display:flex;flex-direction:column;align-items:center;gap:4px;">
            <span style="font-family:'Cormorant Garamond',serif;font-variant-numeric:lining-nums;font-feature-settings:'lnum' 1;font-size:${fDe}px;font-weight:500;color:${v.precoDeCor};text-decoration:line-through;text-decoration-thickness:1.5px;white-space:nowrap;">R$ ${dados.precoDe}</span>
            <span style="font-family:'Cormorant Garamond',serif;font-variant-numeric:lining-nums;font-feature-settings:'lnum' 1;font-size:${fPor}px;font-weight:600;white-space:nowrap;color:${v.precoPorCor};">R$ ${dados.precoPor}</span>
          </div>${dados.copyEfeito ? `
          <div style="font-family:'Archivo',sans-serif;font-size:20px;letter-spacing:.14em;text-transform:uppercase;color:${v.copyCor};font-weight:600;">${esc(dados.copyEfeito)}</div>` : ''}
        </div>
        <div style="background:${v.ctaBg};color:${v.ctaCor};font-weight:600;font-size:${fCta}px;letter-spacing:.2em;text-transform:uppercase;padding:${ctaPad};padding-left:calc(${ctaPad.split(' ')[1]} + .2em);border-radius:999px;box-shadow:0 16px 34px rgba(0,0,0,.28);display:flex;align-items:center;gap:14px;white-space:nowrap;">${esc(dados.cta || 'Comprar agora')} <span style="font-size:${fSeta}px;line-height:1;color:${v.ctaSeta};">&#8594;</span></div>
      </div>
    </div>
  </div>`;
  return pagina(inner, formato);
}

export const TEMPLATES = {
  'promo-number-hero':   { arquetipo: 'promo', nome: 'Promo · Number Hero', render: promoNumberHero },
  'produto-heroi':       { arquetipo: 'produto', nome: 'Produto · Herói', render: produtoHeroi },
  'produto-preco-tipo':  { arquetipo: 'produto', nome: 'Produto · Preço Tipográfico', render: produtoPrecoTipografico },
  'produto-sage-circulo':{ arquetipo: 'produto', nome: 'Produto · Sage Círculo', render: produtoSageCirculo },
  'promo-sage':          { arquetipo: 'promo', nome: 'Promo · Sage', render: promoSage },
  'promo-minimal-pearl': { arquetipo: 'promo', nome: 'Promo · Minimal Pearl', render: promoMinimalPearl },
  'promo-burnt-wood':    { arquetipo: 'promo', nome: 'Promo · Burnt Wood', render: promoBurntWood },
  'editorial-sale':      { arquetipo: 'produto', nome: 'Editorial · Sale', render: editorialSale },
  'editorial-v2':        { arquetipo: 'produto', nome: 'Editorial · V2', render: editorialV2 },
  'produto-split':       { arquetipo: 'produto', nome: 'Produto · Split', render: produtoSplit },
  'produto-modelo':      { arquetipo: 'produto', nome: 'Produto · Modelo', render: produtoModelo },
};
export { DIM };
