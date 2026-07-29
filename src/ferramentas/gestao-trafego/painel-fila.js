// A aba FILA: tudo que o robô propôs e ainda espera uma decisão, das cinco
// contas numa lista só.
//
// PURO no sentido que importa aqui: monta innerHTML e liga listeners no
// elemento que recebe, mas não lê `window`, não vai à rede e não conhece o
// Supabase. Quem busca dado e quem aplica na Meta é a tela — este arquivo
// recebe os itens prontos e devolve as decisões por callback. Mesmo contrato de
// painel-regua.js.
import { distribuirEntreConjuntos } from './fila.js';

// TEXTO DE FORA VAI TODO POR `esc`. Vale pro nome da campanha e do conjunto (vêm
// da Meta) e principalmente pra `justificativa` e `impacto_estimado`, que são
// escritos pelo MODELO — texto que ninguém revisou antes de virar innerHTML.
// Nenhuma interpolação abaixo escapa dessa regra; a única exceção é `ajudaBtn`,
// que é HTML montado pela própria tela.

const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const reais = (cent) => cent == null ? '—' : 'R$ ' + (Number(cent) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Cor e palavra de cada veredito. 'reduzir' e 'pausar' são avisos, não boas
// notícias — mesma família visual do cartão da campanha.
const VEREDITO = {
  escalar: { texto: 'Subir orçamento', cor: 'positivo' },
  reduzir: { texto: 'Baixar orçamento', cor: 'reduzir' },
  pausar: { texto: 'Pausar campanha', cor: 'pausar' },
};

const diasAtras = (iso, agoraMs) => {
  const t = Date.parse(iso || '');
  if (!Number.isFinite(t)) return null;
  return Math.max(0, Math.round((agoraMs - t) / 86400000));
};

// A quebra por conjunto de um item ABO — o que o dono vê ANTES de aprovar.
// Fica dobrada num <details>: em lista, abrir a quebra de todos de uma vez
// empurraria as decisões seguintes pra fora da tela. Devolve '' quando é CBO
// (aplica direto na campanha) ou quando não há conjunto.
function blocoConjuntos(item) {
  const partes = item.conjuntos && item.conjuntos.length
    ? distribuirEntreConjuntos(item.conjuntos, item.budget_sugerido_centavos)
    : [];
  if (!partes.length) return '';
  const linhas = partes.map((p) => `
    <tr>
      <td class="gtf-cj-nome">${esc(p.nome || '—')}</td>
      <td class="gtf-cj-de">${reais(p.deCentavos)}</td>
      <td class="gtf-cj-seta">→</td>
      <td class="gtf-cj-para">${reais(p.paraCentavos)}</td>
    </tr>`).join('');
  return `
    <details class="gtf-conjuntos">
      <summary>O orçamento está em ${partes.length} conjunto${partes.length > 1 ? 's' : ''} — ver como fica cada um</summary>
      <table class="gtf-cj-tabela"><tbody>${linhas}</tbody></table>
    </details>`;
}

// UMA LINHA por sugestão (pedido do dono, 2026-07-29: lista, não blocos). A
// linha carrega o essencial na horizontal — conta, campanha, de → para, ação —
// e o que é leitura (justificativa, quebra por conjunto) desce abaixo, sem
// disputar espaço com a decisão.
function linha(item, agoraMs, editavel) {
  const v = VEREDITO[item.veredito] || { texto: item.veredito, cor: 'neutro' };
  const de = item.budget_atual_centavos;
  const para = item.budget_sugerido_centavos;
  const pct = (de > 0 && para > 0) ? Math.round(((para - de) / de) * 100) : null;
  const idade = diasAtras(item.gerado_em, agoraMs);
  const valores = item.veredito === 'pausar'
    ? `<span class="gtf-pausar-nota">para de rodar</span>`
    : `<span class="gtf-de">${reais(de)}</span><span class="gtf-seta">→</span><span class="gtf-para">${reais(para)}</span>${pct != null ? `<span class="gtf-pct ${pct < 0 ? 'neg' : ''}">${pct > 0 ? '+' : ''}${pct}%</span>` : ''}`;

  return `
    <li class="gtf-item ${v.cor}" data-gtf-id="${esc(item.campaign_id)}">
      <div class="gtf-linha">
        <span class="gtf-selo">${esc(v.texto)}</span>
        <div class="gtf-ident">
          <span class="gtf-nome">${esc(item.campaign_name || item.campaign_id)}</span>
          <span class="gtf-conta">${esc(item.conta_nome || '')}${idade == null ? '' : ` · ${idade === 0 ? 'hoje' : idade === 1 ? 'ontem' : `há ${idade} dias`}`}</span>
        </div>
        <div class="gtf-valores">${valores}</div>
        ${editavel ? `
          <div class="gtf-acoes">
            <button class="gtf-btn recusar" data-gtf-recusar="1">Recusar</button>
            <button class="gtf-btn aprovar" data-gtf-aprovar="1">Aprovar</button>
          </div>` : '<span class="gtf-sem-permissao" title="Só quem tem permissão de editar a Gestão de Tráfego pode aprovar ou recusar.">você não tem permissão para decidir</span>'}
      </div>
      ${item.justificativa ? `<p class="gtf-just">${esc(item.justificativa)}</p>` : ''}
      ${item.impacto_estimado ? `<p class="gtf-impacto"><b>Impacto esperado:</b> ${esc(item.impacto_estimado)}</p>` : ''}
      ${blocoConjuntos(item)}
    </li>`;
}

// opcoes: { pendentes, vencidas, silenciadas, contas, contaFiltro, agora,
//           editavel, aoAprovar(item, botao), aoRecusar(item, botao),
//           aoFiltrar(contaId), ajudaBtn }
export function montarPainelFila(alvo, opcoes) {
  const o = opcoes || {};
  const agoraMs = Date.parse(o.agora || '') || Date.now();
  const pendentes = o.pendentes || [];
  const vencidas = o.vencidas || [];
  const silenciadas = o.silenciadas || [];
  const editavel = !!o.editavel;
  const ajudaBtn = typeof o.ajudaBtn === 'function' ? o.ajudaBtn : () => '';

  // O filtro conta o que CADA conta tem de pendente. Sem o número, o dono
  // clicaria conta por conta pra descobrir que quatro estão vazias — foi
  // exatamente o motivo de a fila ser lista única.
  const porConta = new Map();
  for (const i of pendentes) {
    const k = String(i.account_id || '');
    porConta.set(k, (porConta.get(k) || 0) + 1);
  }
  const filtroAtual = o.contaFiltro == null ? '' : String(o.contaFiltro);
  const botoesFiltro = [{ id: '', nome: 'Todas as contas', n: pendentes.length }]
    .concat((o.contas || []).map((c) => ({ id: String(c.id), nome: c.display_name || c.name || '—', n: porConta.get(String(c.id)) || 0 })))
    .map((c) => `<button class="gtf-filtro${filtroAtual === c.id ? ' ativo' : ''}" data-gtf-conta="${esc(c.id)}">${esc(c.nome)}<span class="gtf-filtro-n">${c.n}</span></button>`)
    .join('');

  const visiveis = filtroAtual ? pendentes.filter((i) => String(i.account_id || '') === filtroAtual) : pendentes;

  const corpo = visiveis.length
    ? visiveis.map((i) => linha(i, agoraMs, editavel)).join('')
    : `<div class="gtf-vazio">
         <b>Nada esperando decisão${filtroAtual ? ' nesta conta' : ''}.</b>
         <span>O robô analisa as campanhas toda madrugada. Quando ele propuser mexer em orçamento, aparece aqui.</span>
       </div>`;

  alvo.innerHTML = `
    <div class="gtf-cab">
      <div>
        <h2 class="gtf-tit">Esperando sua decisão${ajudaBtn('fila')}</h2>
        <p class="gtf-sub">O robô propõe, você decide. Nada mexe no orçamento sem passar por aqui.</p>
      </div>
    </div>
    <div class="gtf-filtros">${botoesFiltro}</div>
    <ul class="gtf-lista">${corpo}</ul>
    ${vencidas.length ? `
      <details class="gtf-extra">
        <summary>${vencidas.length} sugest${vencidas.length > 1 ? 'ões vencidas' : 'ão vencida'}</summary>
        <p class="gtf-extra-nota">O robô parou de reanalisar estas campanhas, então o número é antigo. Ficam aqui para você não perder de vista uma campanha esquecida.</p>
        <ul class="gtf-lista">${vencidas.map((i) => linha(i, agoraMs, editavel)).join('')}</ul>
      </details>` : ''}
    ${silenciadas.length ? `
      <div class="gtf-silenciadas">${silenciadas.length} sugest${silenciadas.length > 1 ? 'ões recusadas voltam' : 'ão recusada volta'} a aparecer se a situação continuar.</div>` : ''}
  `;

  for (const b of alvo.querySelectorAll('[data-gtf-conta]')) {
    b.addEventListener('click', () => o.aoFiltrar && o.aoFiltrar(b.dataset.gtfConta || ''));
  }
  if (!editavel) return;
  const todos = pendentes.concat(vencidas);
  for (const el of alvo.querySelectorAll('[data-gtf-id]')) {
    const item = todos.find((i) => String(i.campaign_id) === el.dataset.gtfId);
    if (!item) continue;
    const ap = el.querySelector('[data-gtf-aprovar]');
    const re = el.querySelector('[data-gtf-recusar]');
    if (ap && o.aoAprovar) ap.addEventListener('click', () => o.aoAprovar(item, ap));
    if (re && o.aoRecusar) re.addEventListener('click', () => o.aoRecusar(item, re));
  }
}
