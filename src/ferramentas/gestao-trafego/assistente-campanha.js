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
import { GRUPOS, bloqueio, podeSerCriado, usaPublicacao } from './subobjetivos.js';
// A busca, o filtro, a ordem e a descrição de cada publicação moram num módulo
// puro — ver conteudo-existente.js.
import { filtrar, ordenar, tiposPresentes, descricaoDaPublicacao, ORDENS, AVISO_STORIES } from './conteudo-existente.js';
import { PASSOS, faltaNoPasso, primeiroPassoIncompleto, resumoDoQueVaiSerCriado, ORCAMENTO_MINIMO_CENTAVOS, pedeWhatsapp, pedeSite, numerosParaPagina } from './criar-campanha.js';

const reais = (c) => (Number(c) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

// Com CLASSE, e não com estilo solto. O estilo solto foi o que fez esta tela
// destoar do resto: botão de um tamanho aqui, de outro ali. As classes moram no
// <style> da tela — ver ".gtw-*" em tela-de-gestao-trafego.vue.
function ec(doc, tag, className, texto) {
  const e = doc.createElement(tag);
  if (className) e.className = className;
  if (texto != null) e.textContent = texto;
  return e;
}

function el(doc, tag, css, texto) {
  const e = doc.createElement(tag);
  if (css) e.style.cssText = css;
  if (texto != null) e.textContent = texto;
  return e;
}

// O NOME CURTO de cada passo, para a trilha. Curto de propósito: cinco títulos
// inteiros lado a lado não cabem, e cortados no meio não informam.
const NOMES_CURTOS = {
  objetivo: 'O que',
  identidade: 'De quem',
  orcamento: 'Quanto',
  publico: 'Para quem',
  anuncio: 'O anúncio',
};

const CSS = {
  // Mantidos porque muitos trechos ainda os usam; os novos vão de classe.
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
    'A Meta tem um tipo para cada resultado, e entrega diferente em cada um. O selo verde marca o que esta conta já rodou.'));

  // AGRUPADO, e não uma fila de pastilhas: com quatorze opções, uma fila só vira
  // um paredão que ninguém lê. O grupo é o objetivo ("Conversas"), e o item é o
  // sub-objetivo — que é a distinção que a Meta faz e a tela não fazia.
  const escolhido = (o.objetivos || []).find((x) => x.id === o.estado.objetivo);
  for (const grupo of GRUPOS) {
    const doGrupo = (o.objetivos || []).filter((x) => x.grupo === grupo);
    if (!doGrupo.length) continue;
    cx.appendChild(el(doc, 'div', 'font-size:calc(9.5px*var(--gt-fs,1.3));font-weight:700;letter-spacing:1.2px;'
      + 'text-transform:uppercase;color:var(--muted);margin:14px 0 6px;', grupo));
    for (const sub of doGrupo) cx.appendChild(linhaDoSubobjetivo(doc, o, sub));
  }

  // A EXPLICAÇÃO do escolhido fica embaixo, e não em cada linha: catorze
  // explicações abertas ao mesmo tempo não são ajuda, são ruído.
  if (escolhido) {
    const box = el(doc, 'div', CSS.resumo + 'margin-top:14px;');
    box.appendChild(el(doc, 'div', null, escolhido.explicacao));
    const trava = bloqueio(escolhido);
    if (trava) {
      box.appendChild(el(doc, 'div', 'margin-top:8px;color:var(--orange);font-weight:600;', trava));
    } else if (escolhido.aviso) {
      // AVISO não é bloqueio: dá para tentar, e pode dar certo em outra conta.
      // Esconder isso faria a recusa da Meta parecer defeito da ferramenta.
      box.appendChild(el(doc, 'div', 'margin-top:8px;color:var(--orange);', escolhido.aviso));
    }
    cx.appendChild(box);
  }

  cx.appendChild(el(doc, 'div', 'height:12px;'));

  const nome = el(doc, 'input', CSS.campo);
  nome.value = o.estado.nome || '';
  nome.placeholder = 'Nome da campanha — é por ele que você vai achá-la depois';
  // `input` e não `change`: o rodapé precisa liberar o Avançar enquanto se
  // digita, senão a pessoa escreve o nome e o botão continua apagado.
  nome.oninput = () => o.aoMudar({ nome: nome.value }, { semRedesenhar: true });
  cx.appendChild(nome);
  return cx;
}

// UMA LINHA da lista de tipos. Botão de largura inteira, e não pastilha: o
// rótulo é uma frase ("Conversa no WhatsApp (buscando cadastro)"), e frase em
// pastilha vira uma sopa de retângulos de tamanhos diferentes.
function linhaDoSubobjetivo(doc, o, sub) {
  const ligado = o.estado.objetivo === sub.id;
  const travado = !podeSerCriado(sub);
  const b = el(doc, 'button', 'display:flex;align-items:center;gap:8px;width:100%;text-align:left;'
    + 'padding:9px 11px;margin-bottom:5px;border-radius:8px;cursor:pointer;box-sizing:border-box;'
    + 'font-family:var(--fonte-principal);font-size:calc(11px*var(--gt-fs,1.3));'
    + (ligado
      ? 'background:color-mix(in srgb,var(--accent) 16%,transparent);border:1px solid var(--accent);color:var(--text);font-weight:700;'
      : 'background:var(--surface2);border:1px solid var(--border);color:var(--text);')
    // O que ainda não dá para criar fica APAGADO, mas clicável: clicar mostra o
    // motivo embaixo. Botão morto que não responde não ensina nada.
    + (travado && !ligado ? 'opacity:.55;' : ''));
  b.type = 'button';
  b.appendChild(el(doc, 'span', 'flex:1;', sub.rotulo));
  if (sub.usos > 0) {
    b.appendChild(el(doc, 'span', 'font-size:calc(9px*var(--gt-fs,1.3));font-weight:700;color:var(--green);'
      + 'background:color-mix(in srgb,var(--green) 15%,transparent);border-radius:999px;padding:2px 7px;white-space:nowrap;',
      `já usado aqui · ${sub.usos}`));
  }
  if (travado) b.appendChild(el(doc, 'span', 'font-size:calc(9px*var(--gt-fs,1.3));color:var(--orange);', 'ainda não dá'));
  b.onclick = (ev) => { if (ev && ev.preventDefault) ev.preventDefault(); o.aoMudar({ objetivo: sub.id }); };
  return b;
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

  // O ENDEREÇO DO SITE, quando é para lá que o anúncio leva.
  if (pedeSite(o.objetivoRow)) {
    const site = el(doc, 'div', 'margin-top:14px;');
    site.appendChild(el(doc, 'label', CSS.rotulo, 'Endereço para onde o anúncio leva'));
    const campo = el(doc, 'input', CSS.campo);
    campo.type = 'url';
    campo.value = o.estado.site || '';
    campo.placeholder = 'https://…';
    campo.oninput = () => o.aoMudar({ site: campo.value }, { semRedesenhar: true });
    campo.onblur = () => o.aoMudar({}, {});
    site.appendChild(campo);
    site.appendChild(el(doc, 'p', CSS.ajuda + 'margin:7px 0 0;',
      'Completo, começando com https:// — sem isso a Meta recusa.'));
    cx.appendChild(site);
  }

  // O NÚMERO SÓ APARECE quando o objetivo leva para o WhatsApp. Num objetivo de
  // tráfego ele seria um campo sem uso, e campo sem uso faz a pessoa se perguntar
  // se esqueceu de preencher.
  if (pedeWhatsapp(o.objetivoRow)) {
    const wa = el(doc, 'div', 'margin-top:14px;');
    wa.appendChild(el(doc, 'label', CSS.rotulo, 'Número do WhatsApp que vai receber as conversas'));
    const campo = el(doc, 'input', CSS.campo + 'font-family:var(--fonte-dados);letter-spacing:.4px;');
    campo.type = 'tel';
    campo.value = o.estado.whatsapp || '';
    campo.placeholder = '55 19 99999-9999';
    campo.oninput = () => o.aoMudar({ whatsapp: campo.value }, { semRedesenhar: true });
    campo.onblur = () => o.aoMudar({}, {});
    wa.appendChild(campo);

    // OS NÚMEROS QUE JÁ FUNCIONAM aparecem como atalho. A Meta recusa número
    // que não esteja ligado à conta, e não há como perguntar quais são — o que
    // se sabe é quais ela JÁ aceitou, pelos conjuntos que existem.
    const conhecidos = numerosParaPagina(o.numerosWa || [], o.estado.pageId);
    if (conhecidos.length) {
      const fila = el(doc, 'div', CSS.linha + 'margin-top:8px;');
      fila.appendChild(el(doc, 'span', 'font-size:calc(10px*var(--gt-fs,1.3));color:var(--muted);', 'Já usados aqui:'));
      for (const n of conhecidos.slice(0, 4)) {
        const p = pastilha(doc, n.numero, String(o.estado.whatsapp || '').replace(/\D/g, '') === n.numero,
          () => o.aoMudar({ whatsapp: n.numero }));
        p.style.cssText += 'font-family:var(--fonte-dados);letter-spacing:.3px;';
        fila.appendChild(p);
      }
      wa.appendChild(fila);
    }

    wa.appendChild(el(doc, 'p', CSS.ajuda + 'margin:7px 0 0;',
      conhecidos.length
        ? 'Com DDI e DDD. A Meta só aceita número já ligado a esta conta — os acima são os que ela já aceitou.'
        : 'Com DDI e DDD. É para onde o botão do anúncio leva — número errado gasta e não conversa com ninguém.'));
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
  // NÚMERO É DADO: o painel inteiro usa a fonte de dados para medida, e o
  // orçamento é a medida mais importante desta tela.
  const valor = el(doc, 'input', CSS.campo + 'width:140px;font-family:var(--fonte-dados);');
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

// ── PASSO 5b · impulsionar uma publicação ───────────────────────────────────
//
// Aqui não se escolhe imagem nem se escreve texto: a arte e a legenda são as da
// publicação. Pedir de novo faria escrever um texto que nunca apareceria — o
// anúncio É o post.
function passoPublicacao(doc, o) {
  const cx = el(doc, 'div');
  cx.appendChild(el(doc, 'div', CSS.tit, 'Qual publicação impulsionar'));
  cx.appendChild(el(doc, 'p', CSS.ajuda,
    'O anúncio vai ser esta publicação, com a legenda que ela já tem. As curtidas e comentários somam aos que ela já tem.'));

  if (o.carregandoPublicacoes) {
    cx.appendChild(el(doc, 'div', CSS.resumo, 'Carregando as publicações do perfil…'));
    return cx;
  }
  const posts = o.publicacoes || [];
  if (!posts.length) {
    const caixa = el(doc, 'div', CSS.resumo);
    if (!o.estado.igId) {
      caixa.textContent = 'Esta página não tem perfil do Instagram ligado, e é de lá que vêm as publicações. '
        + 'Volte e escolha outra página.';
    } else if (o.erroPublicacoes) {
      // O MOTIVO, INTEIRO. "Não consegui" sozinho não ajuda ninguém — nem quem
      // usa, nem quem conserta.
      caixa.appendChild(el(doc, 'div', null, 'Não consegui carregar as publicações deste perfil.'));
      caixa.appendChild(el(doc, 'div', 'margin-top:6px;color:var(--orange);', o.erroPublicacoes));
    } else {
      caixa.textContent = 'Este perfil não tem publicação nenhuma para impulsionar.';
    }
    cx.appendChild(caixa);
    return cx;
  }

  // BUSCAR, FILTRAR E ORDENAR. Com o histórico inteiro na tela, rolar até achar
  // "aquele post do lançamento" é pior que digitar duas palavras.
  const busca = el(doc, 'input', CSS.campo + 'margin-bottom:8px;');
  busca.type = 'search';
  busca.value = o.buscaPublicacao || '';
  busca.placeholder = 'Procurar na legenda…';
  busca.dataset.gtpubId = 'busca-publicacao';
  busca.oninput = () => o.aoMudarBusca && o.aoMudarBusca({ buscaPublicacao: busca.value });
  cx.appendChild(busca);

  const barra = el(doc, 'div', CSS.linha + 'margin-bottom:9px;');
  const tipos = ['todos', ...tiposPresentes(posts)];
  for (const t of tipos) {
    barra.appendChild(pastilha(doc, t === 'todos' ? 'Tudo' : t, (o.tipoPublicacao || 'todos') === t,
      () => o.aoMudarBusca && o.aoMudarBusca({ tipoPublicacao: t })));
  }
  for (const ord of ORDENS) {
    barra.appendChild(pastilha(doc, ord.rotulo, (o.ordemPublicacao || 'recentes') === ord.chave,
      () => o.aoMudarBusca && o.aoMudarBusca({ ordemPublicacao: ord.chave })));
  }
  cx.appendChild(barra);

  const visiveis = ordenar(filtrar(posts, o.buscaPublicacao, o.tipoPublicacao), o.ordemPublicacao);
  if (!visiveis.length) {
    cx.appendChild(el(doc, 'div', CSS.resumo, 'Nenhuma publicação com esse texto. Apague a busca para ver todas.'));
    return cx;
  }
  cx.appendChild(el(doc, 'div', CSS.ajuda + 'margin:0 0 7px;',
    `${visiveis.length} de ${posts.length} ${posts.length === 1 ? 'publicação' : 'publicações'}`));

  const grade = el(doc, 'div', 'display:grid;grid-template-columns:repeat(auto-fill,minmax(104px,1fr));gap:8px;');
  for (const post of visiveis) {
    const escolhido = String(o.estado.publicacaoId) === String(post.id);
    const b = el(doc, 'button', 'position:relative;padding:0;border-radius:8px;overflow:hidden;cursor:pointer;'
      + 'aspect-ratio:1;background:var(--surface2);'
      + (escolhido ? 'border:2px solid var(--accent);' : 'border:1px solid var(--border);'));
    b.type = 'button';
    if (post.miniatura) {
      const img = el(doc, 'img', 'width:100%;height:100%;object-fit:cover;display:block;');
      img.src = post.miniatura;
      img.alt = post.legenda || 'publicação';
      b.appendChild(img);
    } else {
      b.appendChild(el(doc, 'span', 'font-size:calc(9px*var(--gt-fs,1.3));color:var(--muted);padding:6px;display:block;',
        (post.legenda || 'sem legenda').slice(0, 40)));
    }
    // O SELO É O TIPO (Reels, Carrossel, Foto…), e não só "vídeo": o tipo decide
    // o que dá para fazer com a publicação — visualização de vídeo só existe em
    // vídeo —, e ver isso na grade evita escolher e tomar recusa depois.
    if (post.tipo) {
      b.appendChild(el(doc, 'span', 'position:absolute;top:4px;right:5px;font-size:calc(8.5px*var(--gt-fs,1.3));'
        + 'font-weight:700;color:#fff;background:rgba(0,0,0,.6);border-radius:4px;padding:1px 5px;', post.tipo));
    }
    // ENGAJAMENTO NA PRÓPRIA MINIATURA. É o número que decide qual impulsionar,
    // e obrigar a clicar em cada uma para vê-lo tornaria a grade inútil.
    if (post.curtidas || post.comentarios) {
      b.appendChild(el(doc, 'span', 'position:absolute;bottom:0;left:0;right:0;font-size:calc(8.5px*var(--gt-fs,1.3));'
        + 'color:#fff;background:linear-gradient(transparent,rgba(0,0,0,.75));padding:10px 5px 3px;text-align:left;',
        `♥ ${post.curtidas} · 💬 ${post.comentarios}`));
    }
    b.title = descricaoDaPublicacao(post);
    b.onclick = (ev) => {
      if (ev && ev.preventDefault) ev.preventDefault();
      o.aoMudar({ publicacaoId: String(post.id), publicacaoResumo: resumoDaPublicacao(post) });
    };
    grade.appendChild(b);
  }
  cx.appendChild(grade);

  // STORIES: a lista vazia é o caso NORMAL, e sem esta frase parece defeito.
  if ((o.stories || []).length === 0 && o.mostrarAvisoStories) {
    cx.appendChild(el(doc, 'div', CSS.ajuda + 'margin:9px 0 0;', AVISO_STORIES));
  }

  const escolhida = posts.find((p) => String(p.id) === String(o.estado.publicacaoId));
  if (escolhida) {
    const box = el(doc, 'div', CSS.resumo + 'margin-top:11px;');
    box.appendChild(el(doc, 'div', null, descricaoDaPublicacao(escolhida) || resumoDaPublicacao(escolhida)));
    if (escolhida.legenda) {
      box.appendChild(el(doc, 'div', 'margin-top:5px;color:var(--text);', `"${escolhida.legenda.slice(0, 160)}"`));
    }
    cx.appendChild(box);
  }
  return cx;
}

// Um jeito curto de dizer QUAL publicação, para a confirmação. Data e tipo, que
// é o que distingue duas fotos parecidas.
export function resumoDaPublicacao(post) {
  const p = post || {};
  // `video` é o sinal, e não mais o texto do tipo: desde que a lista passou a
  // dizer "Reels"/"Carrossel"/"Foto" em português, comparar com 'VIDEO' calava
  // e todo post virava "a publicação".
  const tipo = p.video ? 'o vídeo' : 'a publicação';
  const dia = p.data ? new Date(p.data) : null;
  const quando = dia && !Number.isNaN(dia.getTime())
    ? ` de ${String(dia.getDate()).padStart(2, '0')}/${String(dia.getMonth() + 1).padStart(2, '0')}`
    : '';
  return `${tipo}${quando}`;
}

// ── PASSO 5 · o anúncio ─────────────────────────────────────────────────────
function passoAnuncio(doc, o) {
  const cx = el(doc, 'div');
  cx.appendChild(el(doc, 'div', CSS.tit, 'O anúncio'));
  cx.appendChild(el(doc, 'p', CSS.ajuda,
    'Escolha uma imagem ou um vídeo que já está na conta, ou envie um. A Meta pede imagem de pelo menos 600×600.'));

  const grade = el(doc, 'div', 'display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:12px;');

  // A MOLDURA de uma peça — vale para imagem e para vídeo, porque escolher é o
  // mesmo gesto nos dois casos.
  const peca = (fundo, escolhida, titulo, selo, aoEscolher) => {
    const d = el(doc, 'button', 'position:relative;width:62px;height:62px;border-radius:8px;cursor:pointer;padding:0;'
      + `overflow:hidden;border:1px solid var(--border);background:var(--surface2) center/cover no-repeat${fundo ? ` url("${fundo}")` : ''};`
      + (escolhida ? 'outline:3px solid var(--accent);outline-offset:1px;' : ''));
    d.type = 'button';
    d.title = titulo;
    if (selo) {
      d.appendChild(el(doc, 'span', 'position:absolute;bottom:3px;right:3px;font-size:calc(8px*var(--gt-fs,1.3));'
        + 'font-weight:700;color:#fff;background:rgba(0,0,0,.65);border-radius:4px;padding:1px 4px;', selo));
    }
    d.onclick = (ev) => { if (ev && ev.preventDefault) ev.preventDefault(); aoEscolher(); };
    return d;
  };

  for (const img of (o.imagens || [])) {
    // ESCOLHER IMAGEM LIMPA O VÍDEO, e vice-versa. São alternativas, não soma:
    // sem isto, um vídeo escolhido antes continuaria mandando no criativo e a
    // imagem clicada não faria nada visível.
    grade.appendChild(peca(img.url, o.estado.imagemHash === img.hash && !o.estado.videoId,
      img.nome || 'imagem da conta', '',
      () => o.aoMudar({ imagemHash: img.hash, imagemPreview: img.url || '', videoId: '', videoCapa: '' })));
  }
  for (const vid of (o.videos || [])) {
    grade.appendChild(peca(vid.capa, o.estado.videoId === vid.id,
      vid.titulo || 'vídeo da conta', '▶',
      () => o.aoMudar({ videoId: vid.id, videoCapa: vid.capa || '', imagemHash: '', imagemPreview: '' })));
  }
  if (o.aoEnviarImagem) {
    const env = el(doc, 'button', 'padding:7px 12px;border-radius:8px;cursor:pointer;border:1px dashed var(--accent);'
      + 'background:transparent;color:var(--accent);font-family:var(--fonte-principal);font-size:calc(10.5px*var(--gt-fs,1.3));',
      o.enviando ? 'enviando…' : '+ enviar imagem ou vídeo');
    env.type = 'button';
    env.disabled = !!o.enviando;
    env.onclick = (ev) => { if (ev && ev.preventDefault) ev.preventDefault(); o.aoEnviarImagem(); };
    grade.appendChild(env);
  }
  cx.appendChild(grade);

  // VÍDEO SEM CAPA é recusado pela Meta. Avisar aqui, ao lado da escolha, evita
  // descobrir isso só no fim.
  if (o.estado.videoId && !o.estado.videoCapa) {
    cx.appendChild(el(doc, 'div', CSS.falta + 'margin:0 0 10px;',
      'Este vídeo não tem capa, e a Meta exige uma. Escolha outro vídeo ou envie uma imagem.'));
  }

  const txt = el(doc, 'textarea', CSS.campo + 'min-height:74px;resize:vertical;line-height:1.5;');
  txt.value = o.estado.texto || '';
  txt.placeholder = 'O texto que aparece junto do anúncio.';
  txt.oninput = () => o.aoMudar({ texto: txt.value }, { semRedesenhar: true });
  cx.appendChild(txt);
  return cx;
}

// O ÚLTIMO PASSO tem dois desenhos, e quem decide é o tipo escolhido.
const DESENHOS = {
  objetivo: passoObjetivo, identidade: passoIdentidade, orcamento: passoOrcamento,
  publico: passoPublico,
  anuncio: (doc, o) => (usaPublicacao(o.objetivoRow) ? passoPublicacao(doc, o) : passoAnuncio(doc, o)),
};

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
  corpo.className = 'gtw-entra';

  // A TRILHA DIZ OS NOMES. Cinco pontinhos respondem "quanto falta" e não
  // respondem "o que vem" — e é o que vem que faz alguém decidir se continua
  // agora ou volta depois. Nome curto, número na fonte de dados, e o passo
  // atual em destaque.
  const trilha = ec(doc, 'div', 'gtw-trilha');
  PASSOS.forEach((p, n) => {
    const feito = n < i && faltaNoPasso(p.chave, o.estado, o.objetivoRow).length === 0;
    const item = ec(doc, 'div', 'gtw-passo' + (n === i ? ' agora' : feito ? ' feito' : ''));
    item.appendChild(ec(doc, 'span', 'n', feito && n !== i ? '✓' : String(n + 1)));
    item.appendChild(ec(doc, 'span', null, NOMES_CURTOS[p.chave] || p.chave));
    item.title = p.titulo;
    trilha.appendChild(item);
  });
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
    const b = ec(doc, 'button', 'gtw-b ' + (primario ? 'primario' : 'fantasma'), rotulo);
    b.type = 'button';
    b.disabled = !ligado;
    if (ligado) b.onclick = (ev) => { if (ev && ev.preventDefault) ev.preventDefault(); aoClicar(); };
    return b;
  };
  const btnAntigo = (rotulo, primario, ligado, aoClicar) => {
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
export function textoDaConfirmacao(estado, objetivoRotulo, identidade, sub) {
  const linhas = resumoDoQueVaiSerCriado(estado, objetivoRotulo, identidade, sub);
  return `<b>Vou criar na Meta:</b><ul style="margin:9px 0 0;padding-left:18px;line-height:1.7;">`
    + linhas.map((l) => `<li>${esc(l)}</li>`).join('')
    + '</ul><p style="margin:12px 0 0;">Tudo nasce <b>pausado</b> — nada gasta até você ativar.</p>';
}
