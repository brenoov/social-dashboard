// Aba "A régua": as tabelas que governam a métrica ponderada em toda a ferramenta.
// Não fala com o banco — recebe a régua pronta e devolve a editada pelo callback.
// O EXEMPLO VIVO ao lado é o ponto: sem ele o dono editaria peso no escuro.
import { calcularPonderada, PESOS_PADRAO, LIMIARES_PADRAO } from './ponderada.js';

const ROTULO_PESO = {
  curtidas: 'Curtida', comentarios: 'Comentário',
  salvamentos: 'Salvamento', compartilhamentos: 'Compartilhamento',
};
const ROTULO_BALDE = {
  engajamento: 'Engajamento', trafego: 'Tráfego', reconhecimento: 'Reconhecimento',
  mensagens: 'Mensagens', leads: 'Leads', vendas: 'Vendas', padrao: 'Padrão (usado quando não há regra própria)',
};
const ROTULO_LIMIAR = {
  escalarForte: 'Escalar forte quando o custo for até (× a meta)',
  dentroMeta: 'Dentro da meta quando for até (× a meta)',
  manter: 'Manter e observar quando for até (× a meta)',
};
const ROTULO_FAIXA = {
  'escalar-forte': '🟢 Escalar forte', 'dentro-da-meta': '🟢 Dentro da meta',
  'manter': '🟡 Manter / observar', 'otimizar': '🔴 Otimizar ou pausar', 'sem-dados': 'Sem dados',
};
const reais = (v) => v == null ? '—' : 'R$ ' + Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const inteiro = (v) => Number(v || 0).toLocaleString('pt-BR');
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function campo(id, valor, passo, editavel) {
  if (!editavel) return `<span class="pnd-valor">${esc(valor)}</span>`;
  return `<input class="pnd-input" id="${esc(id)}" type="number" min="0" step="${passo}" value="${esc(valor)}">`;
}

export function montarPainelRegua(alvo, opcoes) {
  const o = opcoes || {};
  const regua = o.regua;
  const editavel = !!o.editavel;
  const exemplo = o.exemplo || null;

  const linhasPeso = Object.keys(PESOS_PADRAO).map((k) =>
    `<tr><td>${ROTULO_PESO[k]}</td><td>${campo('pnd-peso-' + k, regua.pesos[k], '1', editavel)}</td></tr>`).join('');

  const linhasMeta = Object.keys(ROTULO_BALDE).map((b) =>
    `<tr><td>${ROTULO_BALDE[b]}</td><td>${campo('pnd-meta-' + b, regua.metas[b] != null ? regua.metas[b] : '', '0.01', editavel)}</td></tr>`).join('');

  const linhasLimiar = Object.keys(LIMIARES_PADRAO).map((k) =>
    `<tr><td>${ROTULO_LIMIAR[k]}</td><td>${campo('pnd-limiar-' + k, regua.limiares[k], '0.05', editavel)}</td></tr>`).join('');

  alvo.innerHTML = `
    <div class="pnd-regua">
      <div class="pnd-col">
        <div class="pnd-bloco">
          <h3 class="pnd-titulo">Quanto vale cada interação</h3>
          <p class="pnd-ajuda">Uma curtida vale 1 ponto. Se um salvamento vale 30, é como dizer que salvar equivale a 30 curtidas.</p>
          <table class="pnd-tabela"><tbody>${linhasPeso}</tbody></table>
        </div>
        <div class="pnd-bloco">
          <h3 class="pnd-titulo">Quanto você aceita pagar</h3>
          <p class="pnd-ajuda">Seu custo-alvo por ponto, em reais, para cada tipo de campanha. É o que dispara a decisão de verba.</p>
          <table class="pnd-tabela"><tbody>${linhasMeta}</tbody></table>
        </div>
        <div class="pnd-bloco">
          <h3 class="pnd-titulo">Quando cada cor acende</h3>
          <p class="pnd-ajuda">Multiplicadores da meta. 0,8 significa "custando 80% da meta ou menos".</p>
          <table class="pnd-tabela"><tbody>${linhasLimiar}</tbody></table>
        </div>
        ${editavel ? '<button class="pnd-salvar" id="pnd-salvar">Salvar a régua</button>' : '<p class="pnd-ajuda">Você não tem permissão para editar a régua.</p>'}
      </div>
      <div class="pnd-col">
        <div class="pnd-bloco pnd-exemplo" id="pnd-exemplo"></div>
      </div>
    </div>`;

  // Lê o que está nos campos AGORA (ou a régua atual, quando só-leitura).
  function reguaDaTela() {
    if (!editavel) return regua;
    const ler = (id, padrao) => {
      const el = document.getElementById(id);
      const n = el ? Number(el.value) : NaN;
      return (Number.isFinite(n) && n > 0) ? n : padrao;
    };
    const pesos = {}, metas = {}, limiares = {};
    for (const k of Object.keys(PESOS_PADRAO)) pesos[k] = ler('pnd-peso-' + k, PESOS_PADRAO[k]);
    for (const b of Object.keys(ROTULO_BALDE)) { const v = ler('pnd-meta-' + b, 0); if (v > 0) metas[b] = v; }
    for (const k of Object.keys(LIMIARES_PADRAO)) limiares[k] = ler('pnd-limiar-' + k, LIMIARES_PADRAO[k]);
    return { pesos, metas, limiares };
  }

  // EXEMPLO VIVO: recalcula com uma campanha real a cada tecla.
  function pintarExemplo() {
    const caixa = document.getElementById('pnd-exemplo');
    if (!caixa) return;
    if (!exemplo) {
      caixa.innerHTML = '<h3 class="pnd-titulo">Exemplo</h3><p class="pnd-ajuda">Abra a aba Campanhas primeiro para eu usar uma campanha sua de verdade aqui.</p>';
      return;
    }
    const r = reguaDaTela();
    const meta = r.metas[exemplo.balde] > 0 ? r.metas[exemplo.balde] : (r.metas.padrao || 0);
    const c = calcularPonderada(exemplo.quantidades, { pesos: r.pesos, limiares: r.limiares, meta });
    caixa.innerHTML = `
      <h3 class="pnd-titulo">Como fica na prática</h3>
      <p class="pnd-ajuda">Campanha <b>${esc(exemplo.nome)}</b>, com os números reais dela. Mexa nos campos ao lado e veja mudar aqui.</p>
      <table class="pnd-tabela"><tbody>
        <tr><td>Gasto</td><td>${reais(exemplo.quantidades.gasto)}</td></tr>
        <tr><td>Curtidas</td><td>${inteiro(exemplo.quantidades.curtidas)}</td></tr>
        <tr><td>Comentários</td><td>${inteiro(exemplo.quantidades.comentarios)}</td></tr>
        <tr><td>Salvamentos</td><td>${inteiro(exemplo.quantidades.salvamentos)}</td></tr>
        <tr><td>Compartilhamentos</td><td>${inteiro(exemplo.quantidades.compartilhamentos)}</td></tr>
        <tr class="pnd-destaque"><td>Pontos</td><td>${inteiro(c.pontos)}</td></tr>
        <tr class="pnd-destaque"><td>Custo por ponto</td><td>${reais(c.custoPorPonto)}</td></tr>
        <tr><td>Sua meta</td><td>${meta > 0 ? reais(meta) : '— (defina ao lado)'}</td></tr>
        <tr class="pnd-destaque"><td>Resultado</td><td>${ROTULO_FAIXA[c.faixa]}</td></tr>
      </tbody></table>`;
  }

  if (editavel) {
    alvo.querySelectorAll('.pnd-input').forEach((el) => el.addEventListener('input', pintarExemplo));
    const botao = document.getElementById('pnd-salvar');
    if (botao) botao.addEventListener('click', () => o.aoSalvar && o.aoSalvar(reguaDaTela(), botao));
  }
  pintarExemplo();
}
