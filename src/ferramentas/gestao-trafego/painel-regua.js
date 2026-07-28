// Aba "A régua": as tabelas que governam a métrica ponderada em toda a ferramenta.
// Não fala com o banco — recebe a régua pronta e devolve a editada pelo callback.
// O EXEMPLO VIVO ao lado é o ponto: sem ele o dono editaria peso no escuro.
import { calcularPonderada, PESOS_PADRAO } from './ponderada.js';
import { metaDoBalde } from './regua.js';
import { ALVOS, alvoDoBalde, avaliarAlvo } from './alvos.js';

const ROTULO_PESO = {
  curtidas: 'Curtida', comentarios: 'Comentário',
  salvamentos: 'Salvamento', compartilhamentos: 'Compartilhamento',
};
const ROTULO_BALDE = {
  engajamento: 'Engajamento', trafego: 'Tráfego', reconhecimento: 'Reconhecimento',
  mensagens: 'Mensagens', leads: 'Leads', vendas: 'Vendas',
};
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

// `formato` é a unidade que mora DENTRO da caixa do campo — vem direto de
// ALVOS[balde].unidade ('R$' hoje, pra toda meta) na linha de meta; peso não
// tem unidade (é um multiplicador puro), então chama sem este argumento.
// Sem ela o número fica solto e o rótulo precisa carregar a unidade, o que
// alongava a linha.
function campo(id, valor, passo, editavel, formato) {
  const prefixo = formato || '';
  if (!editavel) {
    // Custo-alvo é dinheiro: mostra "R$ 0,20" igual ao exemplo vivo ao lado,
    // não o número cru. Peso fica como número puro (sem unidade).
    const texto = prefixo === 'R$' ? reais(valor === '' ? null : valor) : esc(valor);
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

  // Uma linha por objetivo, cada uma na unidade do resultado dele (ver alvos.js).
  // Objetivo sem meta salva (leads, vendas, reconhecimento hoje, ver migration
  // 20260728_alvos_por_objetivo.sql) mostra o campo VAZIO com uma nota — nunca um
  // número de exemplo: campo vazio é honesto, número inventado não.
  const linhasMeta = Object.keys(ALVOS).map((b) => {
    const a = ALVOS[b];
    const temMeta = regua.metas[b] != null;
    const valor = temMeta ? regua.metas[b] : '';
    const nota = temMeta ? '' : '<div class="pnd-alvo-vazio">ainda sem histórico — defina quando começar a rodar esse tipo</div>';
    return `<tr>
      <td><div class="pnd-alvo-nome">${esc(ROTULO_BALDE[b] || b)}</div><div class="pnd-alvo-ajuda">${esc(a.rotulo)} — ${esc(a.ajuda)}</div>${nota}</td>
      <td>${campo('pnd-meta-' + b, valor, '0.01', editavel, a.unidade)}</td>
    </tr>`;
  }).join('');

  // Ordem dos cartões: abertura explica o conceito → o que vale → quanto pagar →
  // quando acende. A cor depende da meta, então ela precisa ser lida antes.
  alvo.innerHTML = `
    <div class="pnd-intro">
      <h2 class="pnd-intro-tit">O que é esta aba</h2>
      <p>Aqui você diz <b>quanto aceita pagar por cada resultado</b>. É esse número que faz o cartão da campanha acender verde, amarelo ou vermelho lá na aba Campanhas.</p>
      <p>Cada tipo de campanha é medido pelo resultado que ele realmente compra: campanha de lead pelo <b>custo por lead</b>, de WhatsApp pelo <b>custo por conversa</b>, de venda pelo <b>custo por venda</b>.</p>
      <p>A exceção é <b>engajamento</b>, que não compra uma ação só. Aí somamos as interações dando peso a cada uma — curtir vale 1, salvar vale 30, porque quem salva quer voltar naquilo. A soma chama-se <b>ponto</b>, e a meta é o preço do ponto.</p>
    </div>
    <div class="pnd-regua">
      <div>
        <div class="pnd-cards">
          <div class="pnd-bloco">
            <div class="pnd-cab"><h3 class="pnd-titulo">Quanto vale cada interação</h3></div>
            <p class="pnd-ajuda">Uma curtida vale 1 ponto. Se salvar vale 30, é como dizer que um salvamento equivale a 30 curtidas.</p>
            <table class="pnd-tabela"><tbody>${linhasPeso}</tbody></table>
          </div>
          <div class="pnd-bloco">
            <div class="pnd-cab"><h3 class="pnd-titulo">Quanto você aceita pagar por resultado</h3></div>
            <p class="pnd-ajuda">Uma linha por tipo de campanha, cada uma na unidade do resultado que ela compra. É esse número que dispara a decisão de verba.</p>
            <table class="pnd-tabela"><tbody>${linhasMeta}</tbody></table>
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
    // Percorre ALVOS (não ROTULO_BALDE nem regua.metas) — é a MESMA lista que
    // desenhou as linhas em linhasMeta, então leitura e escrita nunca divergem.
    // Um balde fora de ALVOS (ex.: 'padrao') não tem <input> na tela: 'pnd-meta-
    // <balde>' não existe no DOM, `ler` devolve o padrão 0, e a linha abaixo não
    // grava a chave. Resultado: salvar a régua também limpa qualquer meta antiga
    // guardada por engano num balde sem alvo — o que é o comportamento certo,
    // essas metas nunca deveriam existir (ver M do review final, 2026-07-28).
    for (const b of Object.keys(ALVOS)) { const v = ler('pnd-meta-' + b, 0); if (v > 0) metas[b] = v; }
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
    // MESMO CAMINHO do cartão da campanha (ver tela-de-gestao-trafego.vue,
    // bloco "ALVO DO OBJETIVO"): alvoDoBalde + avaliarAlvo, nunca sempre
    // "custo por ponto". Antes este exemplo calculava só a ponderada e pintava
    // o selo com a meta do balde da campanha (ex.: WhatsApp, balde 'mensagens'),
    // então uma campanha de conversa aparecia com "R$ X por ponto" comparado
    // contra a meta de R$ 20,00 por CONVERSA — comparação entre unidades
    // diferentes, o exato erro que esta fase eliminou em todo o resto da tela
    // (C1 do review final, 2026-07-28). `exemplo.balde` já vem resolvido pela
    // tela (considerando se a campanha tem resultado de mensagem).
    // `alvoObj` (não `alvo` — esse nome já é o parâmetro/elemento DOM da função
    // de fora) é a definição do alvos.js pro balde desta campanha-exemplo.
    const alvoObj = alvoDoBalde(exemplo.balde);
    const meta = metaDoBalde(r, exemplo.balde);
    // Só quando o alvo do balde É a ponderada (hoje, só engajamento) o custo
    // depende dos pesos que o dono está editando agora nesta mesma aba; para
    // os demais baldes, o custo já veio pronto de uma campanha real e não muda
    // com peso/limiar (eles não fazem parte da conta daquele objetivo).
    const ehPonderada = !!alvoObj && alvoObj.metrica === 'ponderada';
    const c = calcularPonderada(exemplo.quantidades, { pesos: r.pesos, limiares: r.limiares, meta: ehPonderada ? meta : 0 });
    const custo = !alvoObj ? null : ehPonderada ? c.custoPorPonto : exemplo.custo;
    const aval = avaliarAlvo({ custo, meta, limiares: r.limiares });
    const faixa = FAIXA[aval.faixa] || FAIXA['sem-dados'];
    // O rótulo vem do PRÓPRIO alvo (alvos.js) — nunca mais "por ponto" fixo.
    // Sem alvo definido pro balde (objetivo que a tela não mapeia), mostra um
    // rótulo genérico e cai em 'sem-dados': nunca um selo colorido nascido da
    // meta de outro balde.
    const rotulo = alvoObj ? alvoObj.rotulo : 'Custo por resultado';
    // O RESULTADO vem em manchete (número grande + selo colorido), não
    // escondido na última linha de uma tabela: é ele que responde "e daí?" a cada
    // tecla digitada. O detalhe fica embaixo, menor, pra quem quiser conferir a conta.
    const legenda = meta > 0
      ? `${rotulo} · sua meta é ${reais(meta)}`
      : `${rotulo} · este tipo de campanha não tem meta aqui`;
    caixa.innerHTML = `
      <div class="pnd-ex-topo">
        <div class="pnd-ex-rot">Como fica na prática</div>
        <div class="pnd-ex-nome">${esc(exemplo.nome)}</div>
        <div class="pnd-ex-num">${reais(custo)}</div>
        <div class="pnd-ex-leg">${esc(legenda)}</div>
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
