// Aba "A régua": as tabelas que governam a métrica ponderada em toda a ferramenta.
// Não fala com o banco — recebe a régua pronta e devolve a editada pelo callback.
// O EXEMPLO VIVO ao lado é o ponto: sem ele o dono editaria peso no escuro.
//
// A tela tem DOIS NÍVEIS DE LEITURA, não dois sistemas concorrentes (o dono
// finalmente colocou em palavras, 2026-07-28):
//  - BLOCO 1, a ponderada: uma média geral. Responde "essa campanha comprou
//    engajamento caro ou barato, no geral?". Vale enquanto o dono NÃO declarar
//    o que a campanha está comprando.
//  - BLOCO 2, o resultado: a leitura fina — custo por lead, por conversa, por
//    venda, por visita, por mil impressões. Vale a partir da declaração.
// Peso responde "quanto isso vale pra mim"; meta responde "quanto eu aceito
// pagar por isso" — por isso os dois blocos ficam JUNTOS mas SEPARADOS: o
// dono precisa ver os dois, mas nunca confundir um com o outro.
import { calcularPonderada, PESOS_PADRAO, LIMIARES_PADRAO } from './ponderada.js';
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
  // Visita entra com peso 5 (decisão do dono, 2026-07-28 — ver ponderada.js).
  visitas: 'Visita',
};
const ROTULO_BALDE = {
  engajamento: 'Engajamento', trafego: 'Tráfego', reconhecimento: 'Reconhecimento',
  mensagens: 'Mensagens', leads: 'Leads', vendas: 'Vendas',
};
// Voltaram a ser editáveis (decisão do dono, 2026-07-28): a tela mostra onde a cor
// muda e ele quer poder mover isso. Cada campo é um MULTIPLICADOR da meta de
// engajamento (custo por ponto) — sozinho ele não diz nada ("0,8" de quê?), por
// isso o preview ao lado converte pra reais em tempo real (ver pintarLimiares).
const ROTULO_LIMIAR = {
  escalarForte: 'Escalar forte até',
  dentroMeta: 'Dentro da meta até',
  manter: 'Manter e observar até',
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
// ALVOS[balde].unidade ('R$' hoje, pra toda meta) na linha de meta; peso e
// limiar não têm unidade (são números puros), então chamam sem este argumento.
// Sem ela o número fica solto e o rótulo precisa carregar a unidade, o que
// alongava a linha.
function campo(id, valor, passo, editavel, formato) {
  const prefixo = formato || '';
  if (!editavel) {
    // Custo-alvo é dinheiro: mostra "R$ 0,20" igual ao exemplo vivo ao lado,
    // não o número cru. Peso e limiar ficam como número puro (sem unidade).
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

  // Um preview em reais mora do lado de cada limiar (ver pintarLimiares): sozinho
  // um multiplicador ("0,8") não diz nada, e é isso que o transforma em legível.
  const linhasLimiar = Object.keys(LIMIARES_PADRAO).map((k) =>
    `<tr><td>${esc(ROTULO_LIMIAR[k])}</td><td>${campo('pnd-limiar-' + k, regua.limiares[k], '0.05', editavel)}<div class="pnd-limiar-prev" id="pnd-limiar-prev-${k}"></div></td></tr>`).join('');

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
  // no ponto ponderado. Mora no Bloco 1 porque é ainda o "mundo do engajamento":
  // só troca peso por preço de mercado, não vira uma leitura de outro objetivo.
  const linhasInteracao = Object.keys(INTERACOES).map((k) => {
    const it = INTERACOES[k];
    const temMeta = regua.metas[k] != null;
    const valor = temMeta ? regua.metas[k] : '';
    return `<tr>
      <td><div class="pnd-alvo-nome">${esc(it.rotulo)}</div><div class="pnd-alvo-ajuda">${esc(it.ajuda)}</div></td>
      <td>${campo('pnd-int-' + k, valor, '0.01', editavel, 'R$')}</td>
    </tr>`;
  }).join('');

  // Ordem dos cartões: abertura explica o conceito → Bloco 1 (a ponderada, geral)
  // → Bloco 2 (o resultado, fino). A cor do exemplo vivo depende da meta, então
  // ela precisa ser lida antes.
  alvo.innerHTML = `
    <div class="pnd-intro">
      <h2 class="pnd-intro-tit">O que é esta aba</h2>
        <div class="pnd-intro-corpo">
      <p>Aqui você diz <b>quanto aceita pagar por cada resultado</b>. É esse número que faz o cartão da campanha acender verde, amarelo ou vermelho lá na aba Campanhas.</p>
      <p>Existem duas formas de ler o preço. A <b>ponderada</b> é a leitura geral: soma curtida, comentário, salvamento, compartilhamento e visita, cada um valendo o que você decidir, numa nota só. Ela responde "essa campanha comprou engajamento caro ou barato, no geral?". O <b>resultado</b> é a leitura fina: custo por lead, por conversa, por venda, por visita, por mil impressões — responde exatamente o que aquele tipo de campanha comprou.</p>
      <p>Qual das duas vale para uma campanha? Você decide lá em Campanhas, declarando no cartão dela o que ela está comprando. Sem declarar, ela é julgada pela ponderada. Declarando um resultado, vale o custo daquele resultado. Declarando uma interação — curtida, comentário, salvamento ou compartilhamento —, vale o custo daquela interação, que você define logo abaixo.</p>
      <p>Peso e meta respondem perguntas diferentes: o <b>peso</b> diz quanto aquilo vale pra você, a <b>meta</b> diz quanto você aceita pagar por aquilo. Por isso, quando você declara uma interação, o peso não entra na conta — quem decide é só a meta.</p>
    </div>
      </div>
    <div class="pnd-regua">
      <div>
        <div class="pnd-grupo">
          <h2 class="pnd-grupo-tit">A métrica ponderada${ajudaBtn('ponto')}</h2>
          <p class="pnd-grupo-sub">A leitura geral. Vale para toda campanha de engajamento até você declarar, no cartão dela, o que ela está comprando.</p>
          <div class="pnd-cards">
            <div class="pnd-bloco">
              <div class="pnd-cab"><h3 class="pnd-titulo">Quanto vale cada interação</h3>${ajudaBtn('pesos')}</div>
              <p class="pnd-ajuda">Uma curtida vale 1 ponto. Uma visita vale 5. Um salvamento vale 30 — é como dizer que salvar equivale a 30 curtidas.</p>
              <table class="pnd-tabela"><tbody>${linhasPeso}</tbody></table>
            </div>
            <div class="pnd-bloco">
              <div class="pnd-cab"><h3 class="pnd-titulo">Quando cada cor acende</h3>${ajudaBtn('cores')}</div>
              <p class="pnd-ajuda">Multiplicadores da sua meta de engajamento (custo por ponto, na tabela ao lado). Cada um mostra em reais o que vira, pra você não fazer a conta de cabeça.</p>
              <table class="pnd-tabela"><tbody>${linhasLimiar}</tbody></table>
            </div>
            <div class="pnd-bloco">
              <div class="pnd-cab"><h3 class="pnd-titulo">Quanto você aceita pagar por cada interação</h3>${ajudaBtn('meta_interacao')}</div>
              <p class="pnd-ajuda">Só vale para campanha de engajamento em que você declarar, no cartão dela, qual interação ela está comprando. Curtida e salvamento são mercados diferentes: hoje uma curtida sai por R$ 0,12 e um salvamento por R$ 48.</p>
              <table class="pnd-tabela"><tbody>${linhasInteracao}</tbody></table>
            </div>
          </div>
        </div>
        <div class="pnd-grupo">
          <div class="pnd-cards">
            <div class="pnd-bloco">
              <div class="pnd-cab"><h3 class="pnd-titulo">Quanto você aceita pagar por resultado</h3>${ajudaBtn('meta_resultado')}</div>
              <p class="pnd-ajuda">Uma linha por tipo de campanha, cada uma na unidade do resultado que ela compra. É esse número que dispara a decisão de verba.</p>
              <table class="pnd-tabela"><tbody>${linhasMeta}</tbody></table>
            </div>
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
    // Limiares voltaram a ser editáveis (decisão do dono, 2026-07-28): percorre
    // LIMIARES_PADRAO (a MESMA lista que desenhou linhasLimiar), com o mesmo
    // fallback dos pesos — campo vazio/inválido volta pro que a régua JÁ TINHA,
    // nunca pro multiplicador de fábrica.
    for (const k of Object.keys(LIMIARES_PADRAO)) limiares[k] = ler('pnd-limiar-' + k, regua.limiares[k]);
    return { pesos, metas, limiares };
  }

  // Converte cada limiar em reais, ao vivo, contra a meta de engajamento (custo
  // por ponto — o mesmo campo 'pnd-meta-engajamento' do Bloco 2). Sem isso, um
  // multiplicador ("0,8") é abstrato demais pra decidir onde mover o corte.
  function pintarLimiares(r) {
    const metaEng = Number(r.metas && r.metas.engajamento) || 0;
    for (const k of Object.keys(LIMIARES_PADRAO)) {
      const el = document.getElementById('pnd-limiar-prev-' + k);
      if (!el) continue;
      const mult = Number(r.limiares[k]);
      el.textContent = (metaEng > 0 && Number.isFinite(mult) && mult > 0)
        ? `× ${mult.toLocaleString('pt-BR')} = ${reais(mult * metaEng)}`
        : 'defina a meta de engajamento para ver em reais';
    }
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
      : (ex.detalhe || []).map((d) => `<tr class="forte"><td>${esc(d.rotulo)}</td><td>${d.valor == null ? '—' : inteiro(d.valor)}</td></tr>`).join('');
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

  // Repinta os dois: o preview dos limiares (Bloco 1) e o exemplo vivo (lateral).
  // Os dois dependem da MESMA leitura da tela — uma tecla em qualquer campo
  // (peso, limiar, meta de balde ou meta de interação) precisa mover os dois.
  function atualizarTela() {
    pintarLimiares(reguaDaTela());
    pintarExemplo();
  }

  if (editavel) {
    alvo.querySelectorAll('.pnd-input').forEach((el) => el.addEventListener('input', atualizarTela));
    const botao = document.getElementById('pnd-salvar');
    // Além do atributo `disabled` no HTML, nem liga o listener quando a leitura do
    // banco não foi confirmada — dupla trava contra salvar em cima de dado errado.
    if (botao && podeSalvar) botao.addEventListener('click', () => o.aoSalvar && o.aoSalvar(reguaDaTela(), botao));
  }
  atualizarTela();
}
