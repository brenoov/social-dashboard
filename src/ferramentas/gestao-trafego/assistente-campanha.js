// O DESENHO DO ASSISTENTE DE CRIAR CAMPANHA — quatro telas, uma pergunta cada.
//
// MORA AQUI, E NÃO NO .vue, pelo motivo que já custou um bug nesta tela: o
// arquivo da Gestão de Tráfego é `<script setup>`, então nada declarado nele é
// importável, e o que não se abre sozinho ninguém confere. Foi assim que o modal
// de criativo ficou dentro de uma aba escondida e parou de abrir sem dar erro.
//
// Recebe o `document` e os ajudantes de desenho por parâmetro. Puro no sentido
// que importa: não lê `window`, não fala com rede, e não guarda estado — quem
// chama passa o estado e recebe o desenho.
import { PASSOS, faltaNoPasso, primeiroPassoIncompleto, resumoDoQueVaiSerCriado, ORCAMENTO_MINIMO_CENTAVOS, pedeWhatsapp } from './criar-campanha.js';

const reais = (c) => (Number(c) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

function el(doc, tag, css, texto) {
  const e = doc.createElement(tag);
  if (css) e.style.cssText = css;
  if (texto != null) e.textContent = texto;
  return e;
}

const CSS = {
  tit: 'font-size:calc(12px*var(--gt-fs,1.3));font-weight:800;margin:0 0 3px;',
  ajuda: 'font-size:calc(10.5px*var(--gt-fs,1.3));color:var(--muted);margin:0 0 12px;line-height:1.5;',
  linha: 'display:flex;gap:7px;flex-wrap:wrap;align-items:center;',
  campo: 'width:100%;padding:9px 11px;border:1px solid var(--border);border-radius:8px;background:var(--surface);color:var(--text);font-family:var(--fonte-principal);font-size:calc(11.5px*var(--gt-fs,1.3));box-sizing:border-box;',
  resumo: 'background:var(--surface2);border-radius:8px;padding:11px 13px;font-size:calc(10.5px*var(--gt-fs,1.3));line-height:1.7;color:var(--muted);',
  rotulo: 'display:block;font-size:calc(10.5px*var(--gt-fs,1.3));font-weight:700;margin:0 0 5px;color:var(--text);',
  falta: 'margin:12px 0 0;padding:10px 12px;border-radius:8px;background:color-mix(in srgb,var(--orange) 12%,transparent);border:1px solid color-mix(in srgb,var(--orange) 35%,transparent);font-size:calc(10.5px*var(--gt-fs,1.3));line-height:1.55;color:var(--text);',
};

// A PASTILHA de escolha única. Usa o mesmo visual do resto da tela (o filtro de
// objetivo), então quem já usa o Gestor reconhece o gesto.
function pastilha(doc, rotulo, ligada, aoClicar) {
  const b = el(doc, 'button', 'padding:7px 13px;border-radius:999px;cursor:pointer;'
    + 'font-family:var(--fonte-principal);font-size:calc(10.5px*var(--gt-fs,1.3));'
    + (ligada
      ? 'background:var(--accent);border:1px solid var(--accent);color:#fff;font-weight:700;'
      : 'background:var(--surface2);border:1px solid var(--border);color:var(--muted);'), rotulo);
  b.type = 'button';
  b.onclick = (ev) => { if (ev && ev.preventDefault) ev.preventDefault(); aoClicar(); };
  return b;
}

// ── PASSO 1 · o que se quer ─────────────────────────────────────────────────
function passoObjetivo(doc, o) {
  const cx = el(doc, 'div');
  cx.appendChild(el(doc, 'div', CSS.tit, 'O que você quer que aconteça'));
  cx.appendChild(el(doc, 'p', CSS.ajuda,
    'Isto define como a Meta entrega e o que ela otimiza. Os quatro já foram testados nesta conta.'));

  const fila = el(doc, 'div', CSS.linha + 'margin-bottom:12px;');
  for (const obj of (o.objetivos || [])) {
    fila.appendChild(pastilha(doc, obj.rotulo || obj.chave, o.estado.objetivo === obj.chave,
      () => o.aoMudar({ objetivo: obj.chave })));
  }
  cx.appendChild(fila);

  const nome = el(doc, 'input', CSS.campo);
  nome.value = o.estado.nome || '';
  nome.placeholder = 'Nome da campanha — é por ele que você vai achá-la depois';
  // `input` e não `change`: o rodapé precisa liberar o Avançar enquanto se
  // digita, senão a pessoa escreve o nome e o botão continua apagado.
  nome.oninput = () => o.aoMudar({ nome: nome.value }, { semRedesenhar: true });
  cx.appendChild(nome);
  return cx;
}

// ── PASSO 2 · de quem é o anúncio ───────────────────────────────────────────
//
// As páginas vêm da Meta (`/me/accounts`), não do cadastro da Fábrica. O
// Instagram vem JUNTO de cada página — a Meta devolve os dois na mesma resposta,
// então escolher a página já resolve o perfil, e ninguém precisa saber o número
// de 17 dígitos do Instagram de cor.
function passoIdentidade(doc, o) {
  const cx = el(doc, 'div');
  cx.appendChild(el(doc, 'div', CSS.tit, 'De quem é o anúncio'));
  cx.appendChild(el(doc, 'p', CSS.ajuda,
    'A página assina o anúncio, e o perfil do Instagram é onde ele aparece por lá.'));

  const paginas = o.paginas || [];
  cx.appendChild(el(doc, 'label', CSS.rotulo, 'Página do Facebook'));
  if (!paginas.length) {
    cx.appendChild(el(doc, 'div', CSS.resumo, 'Não consegui carregar as páginas desta conta.'));
    return cx;
  }
  const sel = el(doc, 'select', CSS.campo);
  const vazia = el(doc, 'option', null, 'Escolha uma página…');
  vazia.value = '';
  sel.appendChild(vazia);
  for (const pg of paginas) {
    const op = el(doc, 'option', null, pg.nome || pg.id);
    op.value = String(pg.id);
    if (String(o.estado.pageId) === String(pg.id)) op.selected = true;
    sel.appendChild(op);
  }
  // Escolher a página TRAZ O INSTAGRAM JUNTO. Deixar o perfil para uma segunda
  // pergunta faria a pessoa escolher duas vezes a mesma coisa.
  sel.onchange = () => {
    const achou = paginas.find((pg) => String(pg.id) === String(sel.value));
    o.aoMudar({ pageId: sel.value, igId: (achou && achou.igId) || '' });
  };
  cx.appendChild(sel);

  const escolhida = paginas.find((pg) => String(pg.id) === String(o.estado.pageId));
  if (escolhida) {
    const box = el(doc, 'div', CSS.resumo + 'margin-top:10px;');
    box.appendChild(el(doc, 'div', null, escolhida.igNome
      ? `Instagram: @${escolhida.igNome}`
      : 'Esta página não tem perfil do Instagram ligado — o anúncio vai aparecer só no Facebook.'));
    cx.appendChild(box);
  }

  // O NÚMERO SÓ APARECE quando o objetivo leva para o WhatsApp. Num objetivo de
  // tráfego ele seria um campo sem uso, e campo sem uso faz a pessoa se perguntar
  // se esqueceu de preencher.
  if (pedeWhatsapp(o.objetivoRow)) {
    const wa = el(doc, 'div', 'margin-top:14px;');
    wa.appendChild(el(doc, 'label', CSS.rotulo, 'Número do WhatsApp que vai receber as conversas'));
    const campo = el(doc, 'input', CSS.campo);
    campo.type = 'tel';
    campo.value = o.estado.whatsapp || '';
    campo.placeholder = '55 19 99999-9999';
    campo.oninput = () => o.aoMudar({ whatsapp: campo.value }, { semRedesenhar: true });
    campo.onblur = () => o.aoMudar({}, {});
    wa.appendChild(campo);
    wa.appendChild(el(doc, 'p', CSS.ajuda + 'margin:7px 0 0;',
      'Com DDI e DDD. É para onde o botão do anúncio leva — número errado gasta e não conversa com ninguém.'));
    cx.appendChild(wa);
  }
  return cx;
}

// ── PASSO 3 · quanto ────────────────────────────────────────────────────────
function passoOrcamento(doc, o) {
  const cx = el(doc, 'div');
  // O TÍTULO acompanha a escolha: "Quanto por dia" com orçamento total é
  // simplesmente a frase errada, e é a frase que a pessoa lê primeiro.
  cx.appendChild(el(doc, 'div', CSS.tit,
    o.estado.tipoOrcamento === 'total' ? 'Quanto no total' : 'Quanto por dia'));
  cx.appendChild(el(doc, 'p', CSS.ajuda,
    'A campanha nasce PAUSADA. Nada é gasto até você ativar no Gerenciador ou aqui.'));

  const fila = el(doc, 'div', CSS.linha);
  const valor = el(doc, 'input', CSS.campo + 'width:130px;');
  valor.type = 'text';
  valor.value = reais(o.estado.orcamentoCentavos);
  valor.oninput = () => {
    // Lê só os dígitos: "R$ 1.234,56" e "1234,56" e "1234.56" viram o mesmo
    // número, e quem digita não devia precisar saber o formato certo.
    const digitos = String(valor.value).replace(/\D/g, '');
    o.aoMudar({ orcamentoCentavos: digitos ? Number(digitos) : 0 }, { semRedesenhar: true });
  };
  valor.onblur = () => o.aoMudar({}, {});
  fila.appendChild(valor);
  fila.appendChild(pastilha(doc, 'Por dia', o.estado.tipoOrcamento !== 'total', () => o.aoMudar({ tipoOrcamento: 'diario' })));
  fila.appendChild(pastilha(doc, 'Total', o.estado.tipoOrcamento === 'total', () => o.aoMudar({ tipoOrcamento: 'total' })));
  cx.appendChild(fila);

  // A DATA SÓ APARECE COM "Total" escolhido. É a Meta que exige `end_time` junto
  // de `lifetime_budget`; e um campo de data pendurado no orçamento diário só
  // faria a pessoa se perguntar se precisa preencher.
  if (o.estado.tipoOrcamento === 'total') {
    const fim = el(doc, 'div', 'margin-top:12px;');
    fim.appendChild(el(doc, 'label', CSS.rotulo, 'Até quando vai rodar'));
    const dia = el(doc, 'input', CSS.campo + 'width:190px;display:block;');
    // A classe existe só para o CSS da tela alcançar o ícone NATIVO do
    // seletor de data — ele nasce preto e some no tema escuro. Ver
    // `.gt-novo-data` em tela-de-gestao-trafego.vue.
    dia.className = 'gt-novo-data';
    dia.type = 'date';
    dia.value = o.estado.terminaEm || '';
    dia.onchange = () => o.aoMudar({ terminaEm: dia.value });
    fim.appendChild(dia);
    cx.appendChild(fim);
  }

  // UMA frase de rodapé, não duas: dizer a mesma coisa em dois parágrafos
  // seguidos faz parecer que são regras diferentes.
  cx.appendChild(el(doc, 'p', CSS.ajuda + 'margin:10px 0 0;',
    o.estado.tipoOrcamento === 'total'
      ? 'Este valor é o do período inteiro, e não por dia — a Meta distribui até a data de término.'
      : `Mínimo de ${reais(ORCAMENTO_MINIMO_CENTAVOS)} por dia — abaixo disso a Meta recusa.`));
  return cx;
}

// ── PASSO 4 · para quem ─────────────────────────────────────────────────────
function passoPublico(doc, o) {
  const cx = el(doc, 'div');
  cx.appendChild(el(doc, 'div', CSS.tit, 'Para quem'));
  cx.appendChild(el(doc, 'p', CSS.ajuda,
    'Abre o mesmo editor do botão 👥 Público — localização, idade, interesses e posicionamento.'));

  const p = o.estado.publico;
  const box = el(doc, 'div', CSS.resumo);
  if (!p) box.textContent = 'Ainda não escolhido.';
  else {
    const cidades = (p.cidades || []).map((c) => c.nome || c.key).filter(Boolean);
    const linhas = [
      cidades.length ? `Onde: ${cidades.join(', ')}` : 'Onde: nenhuma cidade escolhida',
      `Idade ${p.idadeMin}–${p.idadeMax}`,
      (p.interesses || []).length ? `Interesses: ${(p.interesses || []).map((i) => i.name).join(', ')}` : 'Sem interesse escolhido',
      p.posicionamentos && !p.posicionamentos.automatico ? 'Onde aparece: escolhido à mão' : 'Onde aparece: automático',
    ];
    for (const l of linhas) box.appendChild(el(doc, 'div', null, l));
  }
  cx.appendChild(box);

  const b = el(doc, 'button', 'margin-top:10px;padding:8px 14px;border-radius:8px;cursor:pointer;'
    + 'border:1px solid var(--accent);background:transparent;color:var(--accent);font-weight:700;'
    + 'font-family:var(--fonte-principal);font-size:calc(11px*var(--gt-fs,1.3));',
    p ? 'Ajustar público e posicionamento' : 'Escolher público e posicionamento');
  b.type = 'button';
  b.onclick = (ev) => { if (ev && ev.preventDefault) ev.preventDefault(); if (o.aoAbrirPublico) o.aoAbrirPublico(); };
  cx.appendChild(b);
  return cx;
}

// ── PASSO 5 · o anúncio ─────────────────────────────────────────────────────
function passoAnuncio(doc, o) {
  const cx = el(doc, 'div');
  cx.appendChild(el(doc, 'div', CSS.tit, 'O anúncio'));
  cx.appendChild(el(doc, 'p', CSS.ajuda,
    'Escolha uma imagem que já está na conta, ou envie uma nova. A Meta pede pelo menos 600×600.'));

  const grade = el(doc, 'div', 'display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:12px;');
  for (const img of (o.imagens || [])) {
    const escolhida = o.estado.imagemHash === img.hash;
    const d = el(doc, 'button', 'width:62px;height:62px;border-radius:8px;cursor:pointer;padding:0;overflow:hidden;'
      + `border:1px solid var(--border);background:var(--surface2) center/cover no-repeat${img.url ? ` url("${img.url}")` : ''};`
      + (escolhida ? 'outline:3px solid var(--accent);outline-offset:1px;' : ''));
    d.type = 'button';
    d.title = img.nome || 'imagem da conta';
    d.onclick = (ev) => { if (ev && ev.preventDefault) ev.preventDefault(); o.aoMudar({ imagemHash: img.hash, imagemPreview: img.url || '' }); };
    grade.appendChild(d);
  }
  if (o.aoEnviarImagem) {
    const env = el(doc, 'button', 'padding:7px 12px;border-radius:8px;cursor:pointer;border:1px dashed var(--accent);'
      + 'background:transparent;color:var(--accent);font-family:var(--fonte-principal);font-size:calc(10.5px*var(--gt-fs,1.3));',
      o.enviando ? 'enviando…' : '+ enviar imagem');
    env.type = 'button';
    env.disabled = !!o.enviando;
    env.onclick = (ev) => { if (ev && ev.preventDefault) ev.preventDefault(); o.aoEnviarImagem(); };
    grade.appendChild(env);
  }
  cx.appendChild(grade);

  const txt = el(doc, 'textarea', CSS.campo + 'min-height:74px;resize:vertical;line-height:1.5;');
  txt.value = o.estado.texto || '';
  txt.placeholder = 'O texto que aparece junto do anúncio.';
  txt.oninput = () => o.aoMudar({ texto: txt.value }, { semRedesenhar: true });
  cx.appendChild(txt);
  return cx;
}

const DESENHOS = { objetivo: passoObjetivo, identidade: passoIdentidade, orcamento: passoOrcamento, publico: passoPublico, anuncio: passoAnuncio };

// ── O ASSISTENTE INTEIRO ────────────────────────────────────────────────────
//
// `passo` é o índice (0..3). Devolve { corpo, rodape } para quem chama encaixar
// na janela — separados porque o rodapé fica fixo e o corpo rola.
export function montarAssistente(opcoes = {}) {
  const o = opcoes || {};
  const doc = o.doc;
  if (!doc || typeof doc.createElement !== 'function') return null;
  const i = Math.min(Math.max(Number(o.passo) || 0, 0), PASSOS.length - 1);
  const passo = PASSOS[i];

  const corpo = el(doc, 'div', 'padding:16px 18px;');

  // A TRILHA no topo: quatro pontos, o atual cheio. Diz onde se está e quanto
  // falta, que é a única coisa que um assistente precisa prometer.
  const trilha = el(doc, 'div', 'display:flex;gap:6px;align-items:center;margin-bottom:14px;');
  PASSOS.forEach((p, n) => {
    const feito = n < i && faltaNoPasso(p.chave, o.estado, o.objetivoRow).length === 0;
    trilha.appendChild(el(doc, 'span',
      `width:${n === i ? '22px' : '8px'};height:8px;border-radius:999px;`
      + `background:${n === i ? 'var(--accent)' : feito ? 'color-mix(in srgb,var(--accent) 45%,transparent)' : 'var(--border)'};`));
  });
  trilha.appendChild(el(doc, 'span', 'margin-left:6px;font-size:calc(10px*var(--gt-fs,1.3));color:var(--muted);',
    `passo ${i + 1} de ${PASSOS.length}`));
  corpo.appendChild(trilha);

  corpo.appendChild(DESENHOS[passo.chave](doc, o));

  // O QUE FALTA, dito na hora — não só um botão apagado. Botão desabilitado sem
  // explicação é o jeito mais rápido de deixar alguém preso numa tela.
  const faltas = faltaNoPasso(passo.chave, o.estado, o.objetivoRow);
  if (faltas.length && o.mostrarFaltas) {
    const av = el(doc, 'div', CSS.falta);
    for (const f of faltas) av.appendChild(el(doc, 'div', null, f));
    corpo.appendChild(av);
  }

  // ── Rodapé ────────────────────────────────────────────────────────────────
  const rodape = el(doc, 'div', 'display:flex;gap:8px;align-items:center;padding:12px 18px;'
    + 'border-top:1px solid var(--border);background:var(--surface2);');
  rodape.appendChild(el(doc, 'span', 'margin-right:auto;font-size:calc(10px*var(--gt-fs,1.3));color:var(--green);',
    '● tudo nasce pausado'));

  const btn = (rotulo, primario, ligado, aoClicar) => {
    const b = el(doc, 'button', 'padding:9px 16px;border-radius:8px;cursor:pointer;font-weight:700;'
      + 'font-family:var(--fonte-principal);font-size:calc(11.5px*var(--gt-fs,1.3));'
      + (primario ? 'border:1px solid var(--accent);background:var(--accent);color:#fff;'
        : 'border:1px solid var(--border);background:var(--surface);color:var(--muted);font-weight:600;')
      + (ligado ? '' : 'opacity:.5;cursor:not-allowed;'), rotulo);
    b.type = 'button';
    b.disabled = !ligado;
    b.onclick = (ev) => { if (ev && ev.preventDefault) ev.preventDefault(); if (ligado) aoClicar(); };
    return b;
  };

  if (i > 0) rodape.appendChild(btn('Voltar', false, true, () => o.aoPasso(i - 1)));
  if (i < PASSOS.length - 1) {
    rodape.appendChild(btn('Avançar', true, true, () => {
      // NÃO trava o Avançar: mostra o que falta e fica. Botão morto sem
      // explicação prende a pessoa sem dizer por quê.
      if (faltaNoPasso(passo.chave, o.estado, o.objetivoRow).length) o.aoMostrarFaltas();
      else o.aoPasso(i + 1);
    }));
  } else {
    rodape.appendChild(btn(o.criando ? 'Criando…' : 'Criar campanha', true, !o.criando, () => {
      // O QUE FALTA É PERGUNTADO NO CLIQUE, e não no desenho. Perguntar no
      // desenho parece igual e não é: o último campo (imagem e texto) muda o
      // estado SEM redesenhar — de propósito, senão o campo de texto perderia o
      // foco a cada letra. Então a resposta guardada no desenho fica velha, e
      // o primeiro clique em "Criar campanha" caía no ramo de "está incompleto"
      // e mandava a pessoa para o passo em que ela já estava.
      //
      // O sintoma era o pior possível: nada acontecia. Sem erro, sem aviso, sem
      // nada mudar na tela — só o segundo clique funcionava. Visto ao vivo na
      // conta real (03/08/2026), depois de 34 testes verdes.
      const incompleto = primeiroPassoIncompleto(o.estado, o.objetivoRow);
      if (incompleto) o.aoIrPara(incompleto);
      else o.aoCriar();
    }));
  }
  return { corpo, rodape };
}

// ESCAPA O QUE VEM DE FORA antes de virar HTML.
//
// Três coisas entram no resumo e NENHUMA é nossa: o nome da campanha é digitado
// pela pessoa, e os nomes de cidade e de interesse vêm da Meta. Sem escapar, um
// nome com `<img src=x onerror=...>` viraria código dentro da janela de
// confirmação — que é justamente a janela onde se aperta o botão que gasta
// dinheiro.
//
// Achado por revisão de segurança automática em 2026-08-03, e o alerta estava
// certo: eu montei HTML na mão num módulo em que todo o resto usa `textContent`.
const esc = (v) => String(v == null ? '' : v)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

// O TEXTO DA CONFIRMAÇÃO — a última chance de perceber que se está criando a
// coisa errada. Lista tudo e diz que nasce pausado: prometer "criar campanha"
// sem dizer que ela não vai rodar seria esconder a melhor parte.
//
// Devolve HTML (e não um nó) porque a janela de confirmação da tela recebe
// string — é a mesma `_gtConfirm` usada pelo Duplicar e pelo editor de público.
export function textoDaConfirmacao(estado, objetivoRotulo, identidade) {
  const linhas = resumoDoQueVaiSerCriado(estado, objetivoRotulo, identidade);
  return `<b>Vou criar na Meta:</b><ul style="margin:9px 0 0;padding-left:18px;line-height:1.7;">`
    + linhas.map((l) => `<li>${esc(l)}</li>`).join('')
    + '</ul><p style="margin:12px 0 0;">Tudo nasce <b>pausado</b> — nada gasta até você ativar.</p>';
}
