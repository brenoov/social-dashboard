// ONDE O ANÚNCIO APARECE — ler, escrever e descrever posicionamento.
//
// PURO: sem rede e sem tela. Quem fala com a Meta é o editor; aqui mora a
// decisão, que é a parte que dá pra errar em silêncio.
//
// ═══ TUDO AQUI VEIO DE MEDIÇÃO, NÃO DE DOCUMENTAÇÃO ════════════════════════
// `coletor/sondar-posicionamentos.mjs` leu 50 conjuntos reais da conta em
// 2026-08-01. Os três achados que definem este arquivo:
//
// 1. AUTOMÁTICO É O NORMAL: 44 dos 50 não declaram posicionamento nenhum. Sair
//    do automático é decisão grande, não efeito colateral de abrir o editor.
// 2. O VOCABULÁRIO REAL É MAIOR QUE O DO NOSSO CRIATIVO: o `regrasPlacement` da
//    Fábrica conhece 4 plataformas e 3 posições de cada lado; a conta tem
//    `whatsapp` como plataforma, 8 posições no Facebook e 7 no Instagram. Uma
//    tela escrita a partir do criativo ESTREITARIA a entrega de quem tem 8.
// 3. HÁ CAMPO A PRESERVAR: `whatsapp_positions` e `device_platforms` existem na
//    conta e esta tela não os desenha. Montar o objeto do zero apagaria os dois
//    — a mesma dívida que `geo_locations` já paga para regiões e CEPs.

// AS PLATAFORMAS, na ordem em que fazem sentido para quem lê.
// `audience_network` e `messenger` não apareceram na conta, mas entram porque a
// Meta os aceita e um conjunto criado fora daqui pode trazê-los — e o que não
// está na lista não teria rótulo em português na tela.
export const PLATAFORMAS = [
  { chave: 'facebook', rotulo: 'Facebook' },
  { chave: 'instagram', rotulo: 'Instagram' },
  { chave: 'whatsapp', rotulo: 'WhatsApp' },
  { chave: 'messenger', rotulo: 'Messenger' },
  { chave: 'audience_network', rotulo: 'Rede de parceiros' },
];

// AS POSIÇÕES DE CADA PLATAFORMA, com nome de gente.
// A lista saiu da sonda: são exatamente os valores que a conta tem hoje. O nome
// técnico fica à direita porque é ele que viaja para a Meta — quem for conferir
// no Gerenciador precisa conseguir casar os dois.
export const POSICOES = {
  facebook: [
    { chave: 'feed', rotulo: 'Feed' },
    { chave: 'story', rotulo: 'Stories' },
    { chave: 'facebook_reels', rotulo: 'Reels' },
    { chave: 'profile_feed', rotulo: 'Feed do perfil' },
    { chave: 'marketplace', rotulo: 'Marketplace' },
    { chave: 'instream_video', rotulo: 'Vídeos' },
    { chave: 'search', rotulo: 'Resultados de busca' },
    { chave: 'notification', rotulo: 'Notificações' },
  ],
  instagram: [
    { chave: 'stream', rotulo: 'Feed' },
    { chave: 'story', rotulo: 'Stories' },
    { chave: 'reels', rotulo: 'Reels' },
    { chave: 'explore', rotulo: 'Explorar' },
    { chave: 'explore_home', rotulo: 'Início do Explorar' },
    { chave: 'profile_feed', rotulo: 'Feed do perfil' },
    { chave: 'profile_reels', rotulo: 'Reels do perfil' },
  ],
};

// OS CAMPOS QUE ESTA TELA GERENCIA. Todo o resto do targeting é preservado.
// Mexer nesta lista sem mexer na tela é o jeito de apagar posicionamento sem
// ninguém pedir — foi por isso que ela ficou nomeada e sozinha.
export const CAMPOS_GERENCIADOS = ['publisher_platforms', 'facebook_positions', 'instagram_positions'];

export const POSICIONAMENTO_AUTOMATICO = { automatico: true, plataformas: [], posicoes: {} };

const lista = (v) => (Array.isArray(v) ? v : []);
const textos = (v) => lista(v).filter((x) => typeof x === 'string' && x.trim()).map((x) => x.trim());

// LÊ o posicionamento do targeting que a Meta devolveu.
//
// AUSENTE = AUTOMÁTICO, e isso não é detalhe: é o estado de 44 dos 50 conjuntos.
// Ler ausente como "nenhuma plataforma marcada" faria a tela mostrar tudo
// desmarcado e, ao salvar, gravar exatamente isso — desligando a entrega inteira
// de um conjunto que ninguém pediu para mexer.
export function lerPosicionamentos(targeting) {
  const t = targeting && typeof targeting === 'object' ? targeting : {};
  const plataformas = textos(t.publisher_platforms);
  if (!plataformas.length) return { ...POSICIONAMENTO_AUTOMATICO, posicoes: {} };
  return {
    automatico: false,
    plataformas,
    posicoes: {
      facebook: textos(t.facebook_positions),
      instagram: textos(t.instagram_positions),
    },
  };
}

// ESCREVE de volta, preservando tudo que esta tela não desenha.
//
// Começa do targeting ORIGINAL e mexe só nos três campos gerenciados — mesmo
// princípio de `montarTargeting` com `geo_locations`. `whatsapp_positions` e
// `device_platforms` seguem intocados porque nunca são tocados.
//
// VOLTAR PARA AUTOMÁTICO apaga os três campos gerenciados E as posições das
// plataformas que saíram. Deixar `facebook_positions` para trás com
// `publisher_platforms` ausente é um estado que a Meta não entende como nenhum
// dos dois — nem automático, nem manual.
export function gravarPosicionamentos(original, pos) {
  const t = Object.assign({}, original && typeof original === 'object' ? original : {});
  const p = pos && typeof pos === 'object' ? pos : POSICIONAMENTO_AUTOMATICO;

  const plataformas = textos(p.plataformas);
  // Sem plataforma marcada é automático, mesmo que quem chamou tenha dito o
  // contrário: gravar `publisher_platforms: []` desliga a entrega, e nenhuma
  // tela deve conseguir produzir isso por engano.
  if (p.automatico || !plataformas.length) {
    for (const c of CAMPOS_GERENCIADOS) delete t[c];
    return t;
  }

  t.publisher_platforms = plataformas;
  for (const plat of ['facebook', 'instagram']) {
    const campo = plat === 'facebook' ? 'facebook_positions' : 'instagram_positions';
    // Plataforma desmarcada não pode deixar as posições dela para trás.
    if (!plataformas.includes(plat)) { delete t[campo]; continue; }
    const escolhidas = textos((p.posicoes || {})[plat]);
    // Plataforma marcada SEM posição escolhida = todas as posições dela, que é
    // como a Meta lê a ausência do campo. Gravar lista vazia seria "nenhuma".
    if (escolhidas.length) t[campo] = escolhidas; else delete t[campo];
  }
  return t;
}

const rotuloPlataforma = (c) => (PLATAFORMAS.find((p) => p.chave === c) || {}).rotulo || c;
const rotuloPosicao = (plat, c) => (lista(POSICOES[plat]).find((p) => p.chave === c) || {}).rotulo || c;

// AS LINHAS DA CONFIRMAÇÃO, em português de gente.
//
// A janela de confirmar já lista o que muda em cidade, idade e interesse; sem
// estas linhas, trocar posicionamento seria a única mudança que passaria calada
// — e é a que muda ONDE o anúncio aparece.
export function resumoDosPosicionamentos(antes, depois) {
  const a = antes && typeof antes === 'object' ? antes : POSICIONAMENTO_AUTOMATICO;
  const d = depois && typeof depois === 'object' ? depois : POSICIONAMENTO_AUTOMATICO;
  const linhas = [];

  const autoAntes = !!a.automatico || !textos(a.plataformas).length;
  const autoDepois = !!d.automatico || !textos(d.plataformas).length;

  if (autoAntes && autoDepois) return linhas;
  if (autoAntes !== autoDepois) {
    linhas.push(autoDepois
      ? 'Posicionamento: escolhido à mão → automático (a Meta volta a decidir onde mostrar)'
      : 'Posicionamento: automático → escolhido à mão');
  }

  if (!autoDepois) {
    const pa = textos(a.plataformas), pd = textos(d.plataformas);
    const saiu = pa.filter((x) => !pd.includes(x)), entrou = pd.filter((x) => !pa.includes(x));
    if (saiu.length) linhas.push(`Plataformas retiradas: ${saiu.map(rotuloPlataforma).join(', ')}`);
    if (entrou.length) linhas.push(`Plataformas incluídas: ${entrou.map(rotuloPlataforma).join(', ')}`);

    for (const plat of ['facebook', 'instagram']) {
      // Só compara posição de plataforma que está nos dois lados: quem entrou ou
      // saiu já foi contado na linha de cima, e repetir viraria ruído.
      if (!pa.includes(plat) || !pd.includes(plat)) continue;
      const va = textos((a.posicoes || {})[plat]), vd = textos((d.posicoes || {})[plat]);
      // Lista vazia dos dois lados = "todas", nos dois lados. Nada mudou.
      if (!va.length && !vd.length) continue;
      const fora = va.filter((x) => !vd.includes(x)), dentro = vd.filter((x) => !va.includes(x));
      // De "todas" para uma lista (ou o contrário) é mudança de verdade e não
      // aparece na conta de entrou/saiu — precisa de frase própria.
      if (!va.length && vd.length) { linhas.push(`${rotuloPlataforma(plat)}: de todas as posições para ${vd.map((x) => rotuloPosicao(plat, x)).join(', ')}`); continue; }
      if (va.length && !vd.length) { linhas.push(`${rotuloPlataforma(plat)}: de posições escolhidas para TODAS`); continue; }
      if (fora.length) linhas.push(`${rotuloPlataforma(plat)} — retiradas: ${fora.map((x) => rotuloPosicao(plat, x)).join(', ')}`);
      if (dentro.length) linhas.push(`${rotuloPlataforma(plat)} — incluídas: ${dentro.map((x) => rotuloPosicao(plat, x)).join(', ')}`);
    }
  }
  return linhas;
}

// ESTREITOU? — a pergunta que decide se cabe um aviso vermelho.
//
// Estreitar a entrega de um conjunto ATIVO é a mudança mais cara que este editor
// permite, e a mais silenciosa: nada dá erro, o anúncio só passa a alcançar
// menos gente. Sair do automático conta como estreitar, porque o automático é
// sempre o mais amplo possível.
export function estreitou(antes, depois) {
  const a = antes && typeof antes === 'object' ? antes : POSICIONAMENTO_AUTOMATICO;
  const d = depois && typeof depois === 'object' ? depois : POSICIONAMENTO_AUTOMATICO;
  const autoAntes = !!a.automatico || !textos(a.plataformas).length;
  const autoDepois = !!d.automatico || !textos(d.plataformas).length;

  if (autoDepois) return false;          // voltar pro automático só amplia
  if (autoAntes) return true;            // sair do automático sempre estreita

  const pa = textos(a.plataformas), pd = textos(d.plataformas);
  if (pa.some((x) => !pd.includes(x))) return true;

  for (const plat of ['facebook', 'instagram']) {
    if (!pd.includes(plat)) continue;
    const va = textos((a.posicoes || {})[plat]), vd = textos((d.posicoes || {})[plat]);
    if (!vd.length) continue;            // virou "todas": ampliou
    if (!va.length) return true;         // era "todas" e agora é uma lista
    if (va.some((x) => !vd.includes(x))) return true;
  }
  return false;
}

// ─────────────────────────────────────────────────────────────────────────────
// A SEÇÃO DA TELA, montada aqui e não dentro do .vue.
//
// Mesmo motivo da faixa de sugestões: `tela-de-gestao-trafego.vue` é
// `<script setup>`, então nada declarado lá é importável, e o que não se abre
// sozinho ninguém confere. Recebe o `document` e os ajudantes de desenho da
// janela por parâmetro.
//
// `aoMudar(novo)` recebe o posicionamento inteiro já novo — quem chama grava e
// manda redesenhar. Esta função não guarda estado.
export function montarSecaoPosicionamentos(opcoes = {}) {
  const { doc, pos, aoMudar, titulo, ajuda, linha } = opcoes;
  if (!doc || typeof doc.createElement !== 'function') return null;

  const atual = pos && typeof pos === 'object' ? pos : POSICIONAMENTO_AUTOMATICO;
  const automatico = !!atual.automatico || !textos(atual.plataformas).length;
  const plataformas = textos(atual.plataformas);
  const posicoes = atual.posicoes || {};
  const avisar = (novo) => { if (typeof aoMudar === 'function') aoMudar(novo); };

  const cx = doc.createElement('div');
  if (typeof titulo === 'function') cx.appendChild(titulo('Onde o anúncio aparece'));
  if (typeof ajuda === 'function') {
    cx.appendChild(ajuda(automatico
      // A frase muda com o estado porque a informação útil muda: no automático o
      // que importa é não mexer à toa; no manual, o que importa é o que ficou de
      // fora. Uma frase só teria de ser genérica o bastante para não dizer nada.
      ? 'A Meta está escolhendo sozinha, que é como está a maioria dos conjuntos. Mexer aqui faz o anúncio aparecer em MENOS lugares.'
      : 'Escolhido à mão. Plataforma marcada sem nenhuma posição escolhida quer dizer TODAS as posições dela.'));
  }

  const marcavel = (rot, marcado, aoTrocar, recuo) => {
    const lb = doc.createElement('label');
    lb.style.cssText = `display:flex;align-items:center;gap:8px;font-size:calc(12px*var(--gt-fs,1.3));cursor:pointer;${recuo ? 'margin-left:22px;' : ''}`;
    const ck = doc.createElement('input');
    ck.type = 'checkbox';
    ck.checked = !!marcado;
    ck.onchange = () => aoTrocar(!!ck.checked);
    lb.appendChild(ck);
    const s = doc.createElement('span');
    s.textContent = rot;
    lb.appendChild(s);
    return lb;
  };

  cx.appendChild(marcavel('Deixar a Meta escolher (recomendado)', automatico, (marcado) => {
    // Ao sair do automático, começa com TODAS as plataformas e nenhuma posição
    // escolhida — que é o equivalente mais próximo do que estava valendo. Começar
    // vazio faria o primeiro clique estreitar a entrega sem ninguém pedir.
    avisar(marcado
      ? { automatico: true, plataformas: [], posicoes: {} }
      : { automatico: false, plataformas: PLATAFORMAS.map((p) => p.chave), posicoes: {} });
  }));

  if (automatico) return cx;

  const fila = typeof linha === 'function' ? linha() : doc.createElement('div');
  fila.style.cssText = 'display:flex;flex-direction:column;gap:4px;margin-top:8px;';
  for (const plat of PLATAFORMAS) {
    const marcada = plataformas.includes(plat.chave);
    fila.appendChild(marcavel(plat.rotulo, marcada, (m) => {
      const novas = m ? [...plataformas, plat.chave] : plataformas.filter((x) => x !== plat.chave);
      const novasPos = { ...posicoes };
      if (!m) delete novasPos[plat.chave];
      avisar({ automatico: false, plataformas: novas, posicoes: novasPos });
    }));

    // As posições só aparecem para plataforma marcada, e só para as duas que
    // têm vocabulário conhecido. WhatsApp e os outros entram como plataforma
    // inteira — a conta não tem posição editável neles, e inventar caixinha
    // para o que não se mediu é como se estreita entrega sem querer.
    if (!marcada || !POSICOES[plat.chave]) continue;
    const escolhidas = textos(posicoes[plat.chave]);
    for (const p of POSICOES[plat.chave]) {
      // Nenhuma escolhida = todas: a caixinha aparece marcada, porque é isso que
      // está valendo. Desmarcar a primeira é que transforma "todas" numa lista.
      const marcadaPos = escolhidas.length ? escolhidas.includes(p.chave) : true;
      fila.appendChild(marcavel(p.rotulo, marcadaPos, (m) => {
        const base = escolhidas.length ? escolhidas : POSICOES[plat.chave].map((x) => x.chave);
        const novas = m ? [...new Set([...base, p.chave])] : base.filter((x) => x !== p.chave);
        avisar({
          automatico: false,
          plataformas,
          // Todas marcadas de novo volta a ser "todas" (lista vazia) — senão a
          // gente gravaria a lista inteira à mão e a Meta trataria como escolha
          // fixa, que envelhece quando ela criar uma posição nova.
          posicoes: { ...posicoes, [plat.chave]: novas.length === POSICOES[plat.chave].length ? [] : novas },
        });
      }, true));
    }
  }
  cx.appendChild(fila);
  return cx;
}
