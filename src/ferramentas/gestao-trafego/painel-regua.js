// Aba "A régua": as tabelas que governam a métrica ponderada em toda a ferramenta.
// Não fala com o banco — recebe a régua pronta e devolve a editada pelo callback.
// O EXEMPLO VIVO ao lado é o ponto: sem ele o dono editaria peso no escuro.
import { calcularPonderada, PESOS_PADRAO } from './ponderada.js';
import { metaDoBalde } from './regua.js';
import { ALVOS, alvoDoBalde, avaliarAlvo } from './alvos.js';
// Metas por interação (Fase 3): ALVOS e INTERACOES são DUAS listas que gravam na
// MESMA regua.metas — os baldes são 'engajamento/trafego/...' e as interações são
// 'curtidas/comentarios/...', então as chaves nunca colidem (ver Task 3 do plano
// 2026-07-28-meta-ads-objetivo-por-interacao-f3.md).
import { INTERACOES } from './interacoes.js';

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
  const exemplos = o.exemplos || null;
  // Botão "?" de ajuda contextual (ver ajuda.js e _gtAjudaBtn na tela). Este
  // módulo é puro — só monta innerHTML, nunca lê `window` — então recebe a
  // função pronta de quem chama, em vez de importar do .vue (que importaria
  // este arquivo de volta) ou reimplementar aqui o HTML do botão. Sem o
  // parâmetro (ex.: chamada de teste), vira no-op — nunca quebra o painel.
  const ajudaBtn = typeof o.ajudaBtn === 'function' ? o.ajudaBtn : () => '';

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

  // Uma linha por INTERAÇÃO (curtida/comentário/salvamento/compartilhamento).
  // Só serve pra campanha/anúncio de engajamento em que o dono DECLARAR, no
  // cartão dela, qual interação está comprando (ver o selo de objetivo no
  // cartão, tela-de-gestao-trafego.vue) — sem declaração nada muda, continua
  // no ponto ponderado.
  const linhasInteracao = Object.keys(INTERACOES).map((k) => {
    const it = INTERACOES[k];
    const temMeta = regua.metas[k] != null;
    const valor = temMeta ? regua.metas[k] : '';
    return `<tr>
      <td><div class="pnd-alvo-nome">${esc(it.rotulo)}</div><div class="pnd-alvo-ajuda">${esc(it.ajuda)}</div></td>
      <td>${campo('pnd-int-' + k, valor, '0.01', editavel, 'R$')}</td>
    </tr>`;
  }).join('');

  // Ordem dos cartões: abertura explica o conceito → o que vale → quanto pagar →
  // quando acende. A cor depende da meta, então ela precisa ser lida antes.
  alvo.innerHTML = `
    <div class="pnd-intro">
      <h2 class="pnd-intro-tit">O que é esta aba</h2>
        <div class="pnd-intro-corpo">
      <p>Aqui você diz <b>quanto aceita pagar por cada resultado</b>. É esse número que faz o cartão da campanha acender verde, amarelo ou vermelho lá na aba Campanhas.</p>
      <p>Cada tipo de campanha é medido pelo resultado que ele realmente compra: campanha de lead pelo <b>custo por lead</b>, de WhatsApp pelo <b>custo por conversa</b>, de venda pelo <b>custo por venda</b>.</p>
      <p>A exceção é <b>engajamento</b>, que não compra uma ação só. Aí somamos as interações dando peso a cada uma — curtir vale 1, salvar vale 30, porque quem salva quer voltar naquilo. A soma chama-se <b>ponto</b>, e a meta é o preço do ponto.</p>
    </div>
      </div>
    <div class="pnd-regua">
      <div>
        <div class="pnd-cards">
          <div class="pnd-bloco">
            <div class="pnd-cab"><h3 class="pnd-titulo">Quanto vale cada interação</h3>${ajudaBtn('pesos')}</div>
            <p class="pnd-ajuda">Uma curtida vale 1 ponto. Se salvar vale 30, é como dizer que um salvamento equivale a 30 curtidas.</p>
            <table class="pnd-tabela"><tbody>${linhasPeso}</tbody></table>
          </div>
          <div class="pnd-bloco">
            <div class="pnd-cab"><h3 class="pnd-titulo">Quanto você aceita pagar por resultado</h3>${ajudaBtn('meta_resultado')}</div>
            <p class="pnd-ajuda">Uma linha por tipo de campanha, cada uma na unidade do resultado que ela compra. É esse número que dispara a decisão de verba.</p>
            <table class="pnd-tabela"><tbody>${linhasMeta}</tbody></table>
          </div>
          <div class="pnd-bloco">
            <div class="pnd-cab"><h3 class="pnd-titulo">Quanto você aceita pagar por cada interação</h3>${ajudaBtn('meta_interacao')}</div>
            <p class="pnd-ajuda">Só vale para campanha de engajamento em que você declarar, no cartão dela, qual interação ela está comprando. Curtida e salvamento são mercados diferentes: hoje uma curtida sai por R$ 0,12 e um salvamento por R$ 48.</p>
            <table class="pnd-tabela"><tbody>${linhasInteracao}</tbody></table>
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
    // Mesma lógica, agora para as METAS POR INTERAÇÃO (Task 3): percorre
    // INTERACOES (a MESMA lista que desenhou linhasInteracao), gravando na
    // MESMA `metas` — balde ('engajamento'...) e interação ('curtidas'...)
    // nunca colidem, então as duas listas convivem no mesmo objeto sem
    // sobrescrever uma a outra.
    for (const k of Object.keys(INTERACOES)) { const v = ler('pnd-int-' + k, 0); if (v > 0) metas[k] = v; }
    // Os limiares saíram da tela (decisão do dono, 2026-07-28): continuam valendo
    // no cálculo e no banco, mas não são mais editáveis aqui. Devolver os que já
    // estavam evita que salvar apague o que existe.
    for (const k of Object.keys(regua.limiares)) limiares[k] = regua.limiares[k];
    return { pesos, metas, limiares };
  }

  // EXEMPLO VIVO: um bloco por OBJETIVO que a conta roda, com campanha real.
  // O dono pediu depois de olhar a régua: ele precisa ver como CADA tipo de
  // campanha vai ser julgado, não só o tipo da mais cara.
  function blocoDeExemplo(ex, r) {
    // Dois tipos de exemplo, porque a régua tem dois tipos de meta:
    //  - 'objetivo'  -> meta do balde (custo por lead, conversa, venda, visita…)
    //  - 'interacao' -> meta por curtida/comentário/salvamento/compartilhamento
    // A chave de cada um é a MESMA usada em `metas`, então metaDoBalde serve pros
    // dois sem função nova. Só o caso da ponderada (engajamento) recalcula ao vivo
    // com os pesos que o dono está editando agora; nos demais o custo já veio pronto.
    const chave = ex.chave || ex.balde;
    const meta = metaDoBalde(r, chave);
    const alvoObj = ex.tipo === 'interacao' ? null : alvoDoBalde(chave);
    const ehPonderada = !!alvoObj && alvoObj.metrica === 'ponderada';
    const c = calcularPonderada(ex.quantidades, { pesos: r.pesos, limiares: r.limiares, meta: ehPonderada ? meta : 0 });
    const custo = ehPonderada ? c.custoPorPonto : (ex.custo != null ? ex.custo : null);
    const aval = avaliarAlvo({ custo, meta, limiares: r.limiares });
    const faixa = FAIXA[aval.faixa] || FAIXA['sem-dados'];
    const rotulo = ex.rotulo || (alvoObj ? alvoObj.rotulo : 'Custo por resultado');
    const titulo = ex.titulo || ROTULO_BALDE[chave] || chave;
    // Detalhe: engajamento mostra a quebra das interações (que muda ao vivo com os
    // pesos); os demais mostram a quantidade do resultado que compraram.
    const detalhe = ehPonderada
      ? `<tr><td>Curtidas</td><td>${inteiro(ex.quantidades.curtidas)}</td></tr>
         <tr><td>Comentários</td><td>${inteiro(ex.quantidades.comentarios)}</td></tr>
         <tr><td>Salvamentos</td><td>${inteiro(ex.quantidades.salvamentos)}</td></tr>
         <tr><td>Compartilhamentos</td><td>${inteiro(ex.quantidades.compartilhamentos)}</td></tr>
         <tr class="forte"><td>Pontos${ajudaBtn('ponto')}</td><td>${inteiro(c.pontos)}</td></tr>`
      : (ex.detalhe || []).map((d) => `<tr class="forte"><td>${esc(d.rotulo)}</td><td>${d.valor == null ? '\u2014' : inteiro(d.valor)}</td></tr>`).join('');
    const cortes = meta > 0 ? `
        <div class="pnd-ex-regua">
          <div class="pnd-ex-corte"><span class="pnd-ponto bom"></span>até ${reais(meta * r.limiares.escalarForte)} — escalar forte</div>
          <div class="pnd-ex-corte"><span class="pnd-ponto bom"></span>até ${reais(meta * r.limiares.dentroMeta)} — dentro da meta</div>
          <div class="pnd-ex-corte"><span class="pnd-ponto meio"></span>até ${reais(meta * r.limiares.manter)} — manter e observar</div>
          <div class="pnd-ex-corte"><span class="pnd-ponto ruim"></span>acima disso — otimizar ou pausar</div>
        </div>` : '';
    const legenda = meta > 0
      ? `${rotulo} · sua meta é ${reais(meta)}`
      : `${rotulo} · sem meta definida aqui`;
    return `
      <div class="pnd-ex-bloco${ex.tipo === 'interacao' ? ' interacao' : ''}">
        <div class="pnd-ex-topo">
          <div class="pnd-ex-rot">${esc(titulo)}</div>
          <div class="pnd-ex-nome">${esc(ex.nome)}</div>
          <div class="pnd-ex-num">${reais(custo)}</div>
          <div class="pnd-ex-leg">${esc(legenda)}</div>
          <span class="pnd-ex-selo ${faixa.cor}">${faixa.texto}</span>${ajudaBtn('cores')}
          ${cortes}
        </div>
        <div class="pnd-ex-corpo">
          <table class="pnd-tabela"><tbody>
            <tr><td>Gasto</td><td>${reais(ex.quantidades.gasto)}</td></tr>
            ${detalhe}
          </tbody></table>
        </div>
      </div>`;
  }


  function pintarExemplo() {
    const caixa = document.getElementById('pnd-exemplo');
    if (!caixa) return;
    const lista = exemplos || [];
    if (!lista.length) {
      caixa.innerHTML = `
        <div class="pnd-ex-bloco"><div class="pnd-ex-topo">
          <div class="pnd-ex-rot">Como fica na prática</div>
          <div class="pnd-ex-nome">Ainda estou carregando suas campanhas. Assim que chegarem, mostro aqui um exemplo real de cada tipo que você roda.</div>
        </div></div>`;
      return;
    }
    const r = reguaDaTela();
    caixa.innerHTML = `
      <div class="pnd-ex-cab">
        <div class="pnd-ex-cab-tit">Como fica na prática</div>
        <div class="pnd-ex-cab-sub">Um exemplo real de cada tipo de campanha que você roda. Mexa nos campos ao lado e veja mudar.</div>
      </div>
      ${lista.map((ex) => blocoDeExemplo(ex, r)).join('')}`;
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
