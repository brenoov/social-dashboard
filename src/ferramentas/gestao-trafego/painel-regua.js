// Aba "A régua": as tabelas que governam a métrica ponderada em toda a ferramenta.
// Não fala com o banco — recebe a régua pronta e devolve a editada pelo callback.
// O EXEMPLO VIVO ao lado é o ponto: sem ele o dono editaria peso no escuro.
import { calcularPonderada, PESOS_PADRAO, LIMIARES_PADRAO } from './ponderada.js';
import { metaDoBalde } from './regua.js';

const ROTULO_PESO = {
  curtidas: 'Curtida', comentarios: 'Comentário',
  salvamentos: 'Salvamento', compartilhamentos: 'Compartilhamento',
};
const ROTULO_BALDE = {
  engajamento: 'Engajamento', trafego: 'Tráfego', reconhecimento: 'Reconhecimento',
  mensagens: 'Mensagens', leads: 'Leads', vendas: 'Vendas', padrao: 'Padrão (usado quando não há regra própria)',
};
// Só engajamento e reconhecimento nascem de curtida/comentário/salvamento/
// compartilhamento — é a única situação em que "custo por ponto" é a régua
// certa. Tráfego, mensagens, leads e vendas têm objetivo próprio (clique,
// conversa, cadastro, venda) que a métrica ponderada não enxerga; e "padrão"
// é o fallback que vale pra QUALQUER balde sem regra própria — dar uma meta
// a ele é reabrir a mesma porta. Por isso só esses dois ganham campo editável
// (ver M do review final, 2026-07-28): a tela não pode convidar o admin a
// preencher um número que não mede o que aquele balde realmente decide.
const BALDES_COM_META = ['engajamento', 'reconhecimento'];
const EXPLICACAO_SEM_META = 'Sem meta aqui de propósito: quem julga esse tipo de campanha é a regra do próprio objetivo (clique, conversa, cadastro, venda) — curtida, comentário, salvamento e compartilhamento não dizem se isso aconteceu.';
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

function campo(id, valor, passo, editavel, formato) {
  if (!editavel) {
    // Custo-alvo é dinheiro: mostra "R$ 0,20" igual ao exemplo vivo ao lado,
    // não o número cru. Peso e limiar são multiplicadores, ficam como número.
    const texto = formato === 'dinheiro' ? reais(valor === '' ? null : valor) : esc(valor);
    return `<span class="pnd-valor">${texto}</span>`;
  }
  return `<input class="pnd-input" id="${esc(id)}" type="number" min="0" step="${passo}" value="${esc(valor)}">`;
}

export function montarPainelRegua(alvo, opcoes) {
  const o = opcoes || {};
  const regua = o.regua;
  const editavel = !!o.editavel;
  // Fail-CLOSED de propósito: só conta como "carregou" quando quem chamou passar
  // `true` explicitamente. Isto controla um botão que grava valores de verba
  // reais em cima da linha única de produção — se quem chamou esquecer de
  // passar a opção (ou passar undefined), o padrão tem que ser "não confio",
  // nunca "confio". Antes o padrão era o oposto (fail-OPEN: `!== false`), e é
  // exatamente essa lacuna que permitia salvar `metas: {}` por cima da régua
  // real quando a leitura falhava em silêncio (ver C3 do review final, 2026-07-28).
  const carregouOk = o.carregouOk === true;
  const podeSalvar = editavel && carregouOk;
  const exemplo = o.exemplo || null;

  const linhasPeso = Object.keys(PESOS_PADRAO).map((k) =>
    `<tr><td>${ROTULO_PESO[k]}</td><td>${campo('pnd-peso-' + k, regua.pesos[k], '1', editavel)}</td></tr>`).join('');

  const linhasMeta = Object.keys(ROTULO_BALDE).map((b) => {
    if (BALDES_COM_META.includes(b)) {
      return `<tr><td>${ROTULO_BALDE[b]}</td><td>${campo('pnd-meta-' + b, regua.metas[b] != null ? regua.metas[b] : '', '0.01', editavel, 'dinheiro')}</td></tr>`;
    }
    return `<tr><td>${ROTULO_BALDE[b]}</td><td class="pnd-sem-meta">${esc(EXPLICACAO_SEM_META)}</td></tr>`;
  }).join('');

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
          <p class="pnd-ajuda">Seu custo-alvo por ponto, em reais — só para Engajamento e Reconhecimento, que são julgados por curtida/comentário/salvamento/compartilhamento. As demais campanhas têm objetivo próprio e são julgadas pela regra dele, não por este preço.</p>
          <table class="pnd-tabela"><tbody>${linhasMeta}</tbody></table>
        </div>
        <div class="pnd-bloco">
          <h3 class="pnd-titulo">Quando cada cor acende</h3>
          <p class="pnd-ajuda">Multiplicadores da meta. 0,8 significa "custando 80% da meta ou menos".</p>
          <table class="pnd-tabela"><tbody>${linhasLimiar}</tbody></table>
        </div>
        ${editavel ? (
          podeSalvar
            ? '<button class="pnd-salvar" id="pnd-salvar">Salvar a régua</button>'
            : '<button class="pnd-salvar" id="pnd-salvar" disabled>Salvar a régua</button><p class="pnd-ajuda">Ainda não consegui confirmar a régua que está salva no banco. Recarregue a página antes de editar — salvar agora arriscaria apagar a meta de verdade.</p>'
        ) : '<p class="pnd-ajuda">Você não tem permissão para editar a régua.</p>'}
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
    // Se o dono apagar um campo sem querer, o valor volta pro que a régua JÁ TINHA
    // (não pro padrão de fábrica) — senão um peso 50 customizado vira 30 no silêncio.
    for (const k of Object.keys(PESOS_PADRAO)) pesos[k] = ler('pnd-peso-' + k, regua.pesos[k]);
    // Baldes fora de BALDES_COM_META não têm <input> na tela (ver linhasMeta) —
    // 'pnd-meta-<balde>' não existe no DOM, `ler` devolve o padrão 0, e a linha
    // abaixo não grava a chave. Resultado: salvar a régua também limpa qualquer
    // meta antiga guardada por engano num balde sem target (ex.: 'padrao'),
    // o que é o comportamento certo — essas metas nunca deveriam existir (ver M
    // do review final, 2026-07-28).
    for (const b of Object.keys(ROTULO_BALDE)) { const v = ler('pnd-meta-' + b, 0); if (v > 0) metas[b] = v; }
    for (const k of Object.keys(LIMIARES_PADRAO)) limiares[k] = ler('pnd-limiar-' + k, regua.limiares[k]);
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
    const meta = metaDoBalde(r, exemplo.balde);
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
    // Além do atributo `disabled` no HTML, nem liga o listener quando a leitura do
    // banco não foi confirmada — dupla trava contra salvar em cima de dado errado.
    if (botao && podeSalvar) botao.addEventListener('click', () => o.aoSalvar && o.aoSalvar(reguaDaTela(), botao));
  }
  pintarExemplo();
}
