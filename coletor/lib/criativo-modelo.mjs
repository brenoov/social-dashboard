// coletor/lib/criativo-modelo.mjs
// Cálculo De/Por/parcelado + expansão da matriz de variações por arquétipo.
import { TEMPLATES } from '../templates-criativos/templates.mjs';

const FMT = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const money = (n) => FMT.format(Math.round(n * 100) / 100);

export function precoDePor(precoBling, pct) {
  const de = Number(precoBling) || 0;
  const por = de * (1 - (Number(pct) || 0) / 100);
  return { de: money(de), por: money(por), porNum: Math.round(por * 100) / 100 };
}
export function parcelado(porNum, n) { return money((Number(porNum) || 0) / (n || 10)); }

const FORMATOS = ['1080x1920', '1080x1350'];

// PRODUTO: template 'produto-heroi' em 2 variantes (à vista x parcelado) × 2 formatos = 4.
export function variacoesProduto(candidato, campanha) {
  const pct = descontoDe(candidato, campanha);
  const { de, por, porNum } = precoDePor(candidato.preco, pct);
  const parc = parcelado(porNum, campanha.parcelas);
  const out = [];
  for (const formato of FORMATOS) {
    for (const parceladoEmEvidencia of [false, true]) {
      out.push({
        arquetipo: 'produto', template: 'produto-heroi', formato,
        variante: parceladoEmEvidencia ? 'parcelado' : 'avista',
        preco_de: candidato.preco, preco_por: porNum,
        dados: { nome: candidato.nome, fotoDataUrl: candidato.fotoDataUrl, precoDe: de, precoPor: por, parcelado: parc, parcelas: campanha.parcelas, parceladoEmEvidencia, eyebrow: 'Oferta especial' },
      });
    }
  }
  return out;
}

// PROMO: template 'promo-number-hero' × 2 formatos = 2.
export function variacoesPromo(campanha, fotoDataUrl, nome) {
  const oferta = Math.round(Number(campanha.desconto_pct) || 0) + '%';
  return FORMATOS.map((formato) => ({
    arquetipo: 'promo', template: 'promo-number-hero', formato, variante: 'number-hero',
    dados: { oferta, nome: nome || 'Coleção', fotoDataUrl, eyebrow: 'Season Sale', cta: 'Compre já' },
  }));
}

// desconto efetivo do item: 'fixo'/'personalizado' usa desconto_pct; 'gestor' usaria a escada (F2a.2+: por ora cai no pct da campanha se vier).
function descontoDe(candidato, campanha) {
  if (campanha.desconto_tipo === 'gestor' && candidato.desconto_pct != null) return candidato.desconto_pct;
  return Number(campanha.desconto_pct) || 0;
}

export { TEMPLATES };
