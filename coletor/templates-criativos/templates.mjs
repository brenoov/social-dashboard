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
      <img src="${dados.fotoDataUrl}" style="width:${s(604)}px;height:auto;object-fit:contain;filter:drop-shadow(0 36px 44px rgba(60,36,8,.26));">
      <div style="font-family:'Cormorant Garamond',serif;font-style:italic;font-weight:500;font-size:${s(56)}px;">${esc(dados.nome)}</div>
      <div style="display:flex;flex-direction:column;align-items:center;gap:10px;">${blocoPreco}</div>${dados.copyEfeito ? `
      <div style="font-family:'Archivo',sans-serif;font-size:${s(22)}px;letter-spacing:.14em;text-transform:uppercase;color:#7a5a37;font-weight:600;">${esc(dados.copyEfeito)}</div>` : ''}
      <div style="background:#89a88b;color:#f2f1ed;font-weight:600;font-size:${s(30)}px;letter-spacing:.2em;text-transform:uppercase;padding:${s(30)}px ${s(84)}px;border-radius:999px;box-shadow:0 16px 34px rgba(88,47,10,.2);display:flex;align-items:center;gap:18px;">${dados.cta || 'Eu quero a minha'} <span style="font-size:${s(34)}px;line-height:1;">&#8594;</span></div>
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
      <img src="${dados.fotoDataUrl}" style="width:${s(470)}px;height:auto;filter:drop-shadow(0 32px 40px rgba(60,36,8,.24));">
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
      <div style="position:relative;width:${s(648)}px;height:${s(648)}px;display:flex;align-items:center;justify-content:center;">
        <div style="position:absolute;inset:0;border-radius:50%;background:#f2f1ed;box-shadow:0 30px 60px rgba(60,36,8,.22);"></div>
        <img src="${dados.fotoDataUrl}" style="position:relative;width:${s(472)}px;height:auto;max-height:${s(472)}px;object-fit:contain;filter:drop-shadow(0 22px 28px rgba(60,36,8,.28));">
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
          <span style="font-family:'Cormorant Garamond',serif;font-variant-numeric:lining-nums;font-feature-settings:'lnum' 1;font-size:${s(300)}px;font-weight:500;line-height:1;">${dados.oferta}</span>
          <span style="font-family:'Archivo',sans-serif;font-size:${s(78)}px;letter-spacing:.14em;font-weight:700;">OFF</span>
        </div>
        <div style="display:flex;align-items:baseline;gap:22px;margin-top:${s(30)}px;">
          <span style="font-family:'Cormorant Garamond',serif;font-variant-numeric:lining-nums;font-feature-settings:'lnum' 1;font-size:${s(40)}px;font-weight:500;color:#6f6a5d;text-decoration:line-through;text-decoration-thickness:2px;">R$ ${dados.precoDe}</span>
          <span style="width:7px;height:7px;border-radius:50%;background:#4f5c43;"></span>
          <span style="font-family:'Cormorant Garamond',serif;font-variant-numeric:lining-nums;font-feature-settings:'lnum' 1;font-size:${s(60)}px;font-weight:600;color:#582f0a;">R$ ${dados.precoPor}</span>
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
          <span style="font-family:'Cormorant Garamond',serif;font-variant-numeric:lining-nums;font-feature-settings:'lnum' 1;font-size:${s(300)}px;font-weight:500;line-height:1;">${dados.oferta}</span>
          <span style="font-family:'Archivo',sans-serif;font-size:${s(78)}px;letter-spacing:.14em;font-weight:700;color:#89a88b;">OFF</span>
        </div>
        <div style="display:flex;align-items:baseline;gap:22px;margin-top:${s(30)}px;">
          <span style="font-family:'Cormorant Garamond',serif;font-variant-numeric:lining-nums;font-feature-settings:'lnum' 1;font-size:${s(40)}px;font-weight:500;color:#a08f77;text-decoration:line-through;text-decoration-thickness:2px;">R$ ${dados.precoDe}</span>
          <span style="width:7px;height:7px;border-radius:50%;background:#89a88b;"></span>
          <span style="font-family:'Cormorant Garamond',serif;font-variant-numeric:lining-nums;font-feature-settings:'lnum' 1;font-size:${s(60)}px;font-weight:600;color:#582f0a;">R$ ${dados.precoPor}</span>
        </div>${dados.copyEfeito ? `
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
          <span style="font-family:'Cormorant Garamond',serif;font-variant-numeric:lining-nums;font-feature-settings:'lnum' 1;font-size:${s(308)}px;font-weight:500;line-height:1;">${dados.oferta}</span>
          <span style="font-family:'Archivo',sans-serif;font-size:${s(82)}px;letter-spacing:.12em;font-weight:700;color:#c2cfb4;">OFF</span>
        </div>
        <div style="display:flex;align-items:baseline;gap:24px;margin-top:${s(36)}px;">
          <span style="font-family:'Cormorant Garamond',serif;font-variant-numeric:lining-nums;font-feature-settings:'lnum' 1;font-size:${s(38)}px;font-weight:500;color:#d8cdb8;text-decoration:line-through;text-decoration-thickness:2px;">R$ ${dados.precoDe}</span>
          <span style="width:7px;height:7px;border-radius:50%;background:#c2cfb4;"></span>
          <span style="font-family:'Cormorant Garamond',serif;font-variant-numeric:lining-nums;font-feature-settings:'lnum' 1;font-size:${s(58)}px;font-weight:600;">R$ ${dados.precoPor}</span>
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
        <img src="${dados.fotoDataUrl}" style="position:relative;width:${s(560)}px;height:auto;max-height:100%;object-fit:contain;filter:drop-shadow(0 34px 40px rgba(88,47,10,.32));">
      </div>
    </div>
    <div style="position:relative;flex:0 0 42%;background:#f2f1ed;overflow:hidden;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:${s(56)}px ${s(90)}px;gap:${s(20)}px;">
      <div style="position:absolute;inset:0;background-image:url('${MONO.olive}');background-repeat:repeat;background-size:200px;opacity:.05;"></div>
      <div style="position:relative;z-index:1;display:flex;align-items:center;gap:16px;">
        <span style="width:44px;height:1px;background:#89a88b;"></span>
        <span style="font-size:${s(22)}px;letter-spacing:.5em;text-transform:uppercase;color:#89a88b;font-weight:600;padding-left:.5em;">${dados.eyebrow || 'Sale'}</span>
        <span style="width:44px;height:1px;background:#89a88b;"></span>
      </div>
      <div style="position:relative;z-index:1;display:flex;align-items:flex-start;gap:26px;">
        <span style="font-family:'Cormorant Garamond',serif;font-variant-numeric:lining-nums;font-feature-settings:'lnum' 1;font-size:${s(220)}px;font-weight:500;line-height:.8;color:#582f0a;">${dados.oferta}</span>
        <span style="font-family:'Archivo',sans-serif;font-weight:700;font-size:${s(56)}px;letter-spacing:.14em;color:#89a88b;padding-top:${s(26)}px;padding-left:.14em;">OFF</span>
      </div>
      <div style="position:relative;z-index:1;font-family:'Cormorant Garamond',serif;font-style:italic;font-weight:500;font-size:${s(58)}px;color:#582f0a;line-height:1;">${esc(dados.nome)}</div>
      <div style="position:relative;z-index:1;display:flex;align-items:baseline;gap:24px;">
        <span style="font-family:'Cormorant Garamond',serif;font-variant-numeric:lining-nums;font-feature-settings:'lnum' 1;font-size:${s(50)}px;font-weight:500;color:#a08f77;text-decoration:line-through;text-decoration-thickness:1.5px;">R$ ${dados.precoDe}</span>
        <span style="width:7px;height:7px;border-radius:50%;background:#89a88b;align-self:center;"></span>
        <span style="font-family:'Cormorant Garamond',serif;font-variant-numeric:lining-nums;font-feature-settings:'lnum' 1;font-size:${s(78)}px;font-weight:600;color:#582f0a;">R$ ${dados.precoPor}</span>
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
        <div style="display:flex;align-items:flex-start;gap:24px;">
          <span style="font-family:'Cormorant Garamond',serif;font-variant-numeric:lining-nums;font-feature-settings:'lnum' 1;font-size:${s(210)}px;font-weight:500;line-height:.8;">${dados.oferta}</span>
          <span style="font-family:'Archivo',sans-serif;font-weight:700;font-size:${s(56)}px;letter-spacing:.14em;color:#89a88b;padding-top:${s(22)}px;padding-left:.14em;">OFF</span>
        </div>
        <div style="font-family:'Cormorant Garamond',serif;font-style:italic;font-weight:500;font-size:${s(58)}px;line-height:1;">${esc(dados.nome)}</div>
        <div style="display:flex;align-items:baseline;gap:22px;">
          <span style="font-family:'Cormorant Garamond',serif;font-variant-numeric:lining-nums;font-feature-settings:'lnum' 1;font-size:${s(50)}px;font-weight:500;color:#a08f77;text-decoration:line-through;text-decoration-thickness:1.5px;">R$ ${dados.precoDe}</span>
          <span style="width:7px;height:7px;border-radius:50%;background:#89a88b;align-self:center;"></span>
          <span style="font-family:'Cormorant Garamond',serif;font-variant-numeric:lining-nums;font-feature-settings:'lnum' 1;font-size:${s(78)}px;font-weight:600;">R$ ${dados.precoPor}</span>
        </div>${dados.copyEfeito ? `
        <div style="font-family:'Archivo',sans-serif;font-size:${s(20)}px;letter-spacing:.14em;text-transform:uppercase;color:#3a2408;font-weight:600;">${esc(dados.copyEfeito)}</div>` : ''}
        <div style="margin-top:${s(8)}px;background:#89a88b;color:#f2f1ed;font-weight:600;font-size:${s(26)}px;letter-spacing:.2em;text-transform:uppercase;padding:${s(26)}px ${s(74)}px;border-radius:999px;box-shadow:0 16px 34px rgba(88,47,10,.22);display:flex;align-items:center;gap:16px;white-space:nowrap;">${dados.cta || 'Comprar agora'} <span style="font-size:${s(26)}px;line-height:1;">&#8594;</span></div>
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
};
export { DIM };
