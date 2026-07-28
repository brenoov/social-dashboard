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
// Cada faixa com o texto e a cor do selo. Sem emoji: a tela usa cor e forma,
// não figurinha (é a regra da casa em elemento visual).
const FAIXA = {
  'escalar-forte': { texto: 'Escalar forte', cor: 'bom' },
  'dentro-da-meta': { texto: 'Dentro da meta', cor: 'bom' },
  'manter': { texto: 'Manter e observar', cor: 'meio' },
  'otimizar': { texto: 'Otimizar ou pausar', cor: 'ruim' },
  'sem-dados': { texto: 'Sem dados suficientes', cor: 'neutro' },
};
const reais = (v) => v == null ? '—' : 'R$ ' + Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const inteiro = (v) => Number(v || 0).toLocaleString('pt-BR');
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// `prefixo` é a unidade que mora DENTRO da caixa do campo ('R$' pra dinheiro,
// '×' pra multiplicador). Sem ela o número fica solto e o rótulo precisa carregar
// a unidade, o que alongava a linha.
function campo(id, valor, passo, editavel, formato) {
  const prefixo = formato === 'dinheiro' ? 'R$' : formato === 'multiplicador' ? '×' : '';
  if (!editavel) {
    // Custo-alvo é dinheiro: mostra "R$ 0,20" igual ao exemplo vivo ao lado,
    // não o número cru. Peso e limiar são multiplicadores, ficam como número.
    const texto = formato === 'dinheiro' ? reais(valor === '' ? null : valor) : esc(valor);
    return `<span class="pnd-valor">${texto}</span>`;
  }
  const pre = prefixo ? `<span class="pnd-pre">${prefixo}</span>` : '';
  return `<span class="pnd-campo">${pre}<input class="pnd-input" id="${esc(id)}" type="number" min="0" step="${passo}" value="${esc(valor)}"></span>`;
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

  // Só os baldes COM meta viram linha editável. Os demais viram UMA nota no rodapé
  // do cartão: como linha de tabela, a explicação quebrava em quatro linhas e
  // inchava a tabela inteira (ver M do review final, 2026-07-28).
  const linhasMeta = BALDES_COM_META.map((b) =>
    `<tr><td>${ROTULO_BALDE[b]}</td><td>${campo('pnd-meta-' + b, regua.metas[b] != null ? regua.metas[b] : '', '0.01', editavel, 'dinheiro')}</td></tr>`).join('');
  const semMeta = Object.keys(ROTULO_BALDE)
    .filter((b) => !BALDES_COM_META.includes(b) && b !== 'padrao')
    .map((b) => ROTULO_BALDE[b]).join(', ');


  // Ordem dos cartões: o que vale → quanto pagar → quando acende. A cor depende da
  // meta, então ela precisa ser lida antes.
  alvo.innerHTML = `
    <div class="pnd-regua">
      <div>
        <div class="pnd-cards">
          <div class="pnd-bloco">
            <div class="pnd-cab"><h3 class="pnd-titulo">Quanto vale cada interação</h3></div>
            <p class="pnd-ajuda">Uma curtida vale 1 ponto. Se salvar vale 30, é como dizer que um salvamento equivale a 30 curtidas.</p>
            <table class="pnd-tabela"><tbody>${linhasPeso}</tbody></table>
          </div>
          <div class="pnd-bloco">
            <div class="pnd-cab"><h3 class="pnd-titulo">Quanto você aceita pagar por ponto</h3></div>
            <p class="pnd-ajuda">Seu custo-alvo por ponto. É ele que dispara a decisão de verba.</p>
            <table class="pnd-tabela"><tbody>${linhasMeta}</tbody></table>
            <p class="pnd-nota">${esc(semMeta)} não têm meta aqui: são julgadas pela regra do próprio objetivo (clique, conversa, cadastro, venda), porque curtida e salvamento não dizem se isso aconteceu.</p>
          </div>
        </div>
        ${editavel ? (
          podeSalvar
            ? '<button class="pnd-salvar" id="pnd-salvar">Salvar a régua</button>'
            : '<button class="pnd-salvar" id="pnd-salvar" disabled>Salvar a régua</button><p class="pnd-nota">Ainda não consegui confirmar a régua que está salva no banco. Recarregue a página antes de editar — salvar agora arriscaria apagar a meta de verdade.</p>'
        ) : '<p class="pnd-nota">Você não tem permissão para editar a régua.</p>'}
      </div>
      <div class="pnd-exemplo" id="pnd-exemplo"></div>
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
    // Os limiares saíram da tela (decisão do dono, 2026-07-28): continuam valendo
    // no cálculo e no banco, mas não são mais editáveis aqui. Devolver os que já
    // estavam evita que salvar apague o que existe.
    for (const k of Object.keys(regua.limiares)) limiares[k] = regua.limiares[k];
    return { pesos, metas, limiares };
  }

  // EXEMPLO VIVO: recalcula com uma campanha real a cada tecla.
  function pintarExemplo() {
    const caixa = document.getElementById('pnd-exemplo');
    if (!caixa) return;
    if (!exemplo) {
      caixa.innerHTML = `
        <div class="pnd-ex-topo">
          <div class="pnd-ex-rot">Como fica na prática</div>
          <div class="pnd-ex-nome">Abra a aba Campanhas primeiro, para eu usar uma campanha sua de verdade aqui.</div>
        </div>`;
      return;
    }
    const r = reguaDaTela();
    const meta = metaDoBalde(r, exemplo.balde);
    const c = calcularPonderada(exemplo.quantidades, { pesos: r.pesos, limiares: r.limiares, meta });
    const faixa = FAIXA[c.faixa] || FAIXA['sem-dados'];
    // O RESULTADO vem em manchete (custo por ponto grande + selo colorido), não
    // escondido na última linha de uma tabela: é ele que responde "e daí?" a cada
    // tecla digitada. O detalhe fica embaixo, menor, pra quem quiser conferir a conta.
    const legenda = meta > 0
      ? `por ponto · sua meta é ${reais(meta)}`
      : 'por ponto · este tipo de campanha não tem meta aqui';
    caixa.innerHTML = `
      <div class="pnd-ex-topo">
        <div class="pnd-ex-rot">Como fica na prática</div>
        <div class="pnd-ex-nome">${esc(exemplo.nome)}</div>
        <div class="pnd-ex-num">${reais(c.custoPorPonto)}</div>
        <div class="pnd-ex-leg">${legenda}</div>
        <span class="pnd-ex-selo ${faixa.cor}">${faixa.texto}</span>
      </div>
      <div class="pnd-ex-corpo">
        <table class="pnd-tabela"><tbody>
          <tr><td>Gasto</td><td>${reais(exemplo.quantidades.gasto)}</td></tr>
          <tr><td>Curtidas</td><td>${inteiro(exemplo.quantidades.curtidas)}</td></tr>
          <tr><td>Comentários</td><td>${inteiro(exemplo.quantidades.comentarios)}</td></tr>
          <tr><td>Salvamentos</td><td>${inteiro(exemplo.quantidades.salvamentos)}</td></tr>
          <tr><td>Compartilhamentos</td><td>${inteiro(exemplo.quantidades.compartilhamentos)}</td></tr>
          <tr class="forte"><td>Pontos</td><td>${inteiro(c.pontos)}</td></tr>
        </tbody></table>
      </div>`;
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
