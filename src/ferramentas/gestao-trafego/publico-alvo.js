// Editar o público de um conjunto de anúncios da Meta.
//
// MÓDULO PURO: sem tela, sem rede. Traduz o `targeting` da Meta nos dois
// sentidos, resume o que mudou e gera os avisos.
//
// O PERIGO QUE MOLDA ESTE ARQUIVO: o `targeting` é UM PACOTE SÓ. Além do que
// este editor mexe, ele carrega onde o anúncio aparece (feed, story, reels),
// em que aparelhos e em que idiomas. Montar esse pacote só com os campos
// editados e mandar de volta APAGARIA todo o resto, em silêncio — o dono
// trocaria uma cidade e o conjunto pararia de rodar no Instagram Stories sem
// nada avisar. Por isso montarTargeting (Task 2) parte do original.

export const PUBLICO_VAZIO = {
  cidades: [], excluidas: [],
  idadeMin: 18, idadeMax: 65,
  generos: [], interesses: [],
  incluir: [], excluir: [],
  advantagePlus: true,
};

const lista = (v) => (Array.isArray(v) ? v : []);
const nomeDe = (o) => (o && (o.name || o.nome)) || '';

// Interesses podem estar em QUALQUER entrada do flexible_spec — a Meta usa
// esse array para combinar grupos (interesses, comportamentos, eventos de
// vida). Ler só a primeira entrada perderia interesses de verdade.
function interessesDe(targeting) {
  const flex = lista(targeting && targeting.flexible_spec);
  const achados = [];
  for (const grupo of flex) {
    for (const i of lista(grupo && grupo.interests)) {
      if (i && i.id != null) achados.push({ id: String(i.id), name: nomeDe(i) });
    }
  }
  return achados;
}

function excluidasDe(targeting) {
  const ex = (targeting && targeting.excluded_geo_locations) || {};
  const fora = [];
  for (const c of lista(ex.cities)) if (c && c.key != null) fora.push({ key: String(c.key), nome: nomeDe(c), tipo: 'cidade' });
  for (const r of lista(ex.regions)) if (r && r.key != null) fora.push({ key: String(r.key), nome: nomeDe(r), tipo: 'regiao' });
  return fora;
}

// Traduz o público como a Meta devolve para uma forma simples de trabalhar.
// Nunca lança: público ausente ou malformado devolve a forma padrão, porque
// travar a tela por causa de um campo estranho seria pior que mostrar vazio.
export function lerPublico(targeting) {
  const t = targeting && typeof targeting === 'object' ? targeting : {};
  const geo = t.geo_locations || {};
  const auto = t.targeting_automation || {};
  return {
    cidades: lista(geo.cities).filter((c) => c && c.key != null).map((c) => ({
      key: String(c.key),
      nome: nomeDe(c),
      raio: c.radius == null ? 0 : Number(c.radius),
      unidade: c.distance_unit || 'kilometer',
    })),
    excluidas: excluidasDe(t),
    idadeMin: t.age_min == null ? PUBLICO_VAZIO.idadeMin : Number.isFinite(Number(t.age_min)) ? Number(t.age_min) : PUBLICO_VAZIO.idadeMin,
    idadeMax: t.age_max == null ? PUBLICO_VAZIO.idadeMax : Number.isFinite(Number(t.age_max)) ? Number(t.age_max) : PUBLICO_VAZIO.idadeMax,
    generos: lista(t.genders).map(Number),
    interesses: interessesDe(t),
    incluir: lista(t.custom_audiences).filter((a) => a && a.id != null).map((a) => ({ id: String(a.id), name: nomeDe(a) })),
    excluir: lista(t.excluded_custom_audiences).filter((a) => a && a.id != null).map((a) => ({ id: String(a.id), name: nomeDe(a) })),
    // Ausente = padrão da Meta = LIGADO. Assumir desligado faria a tela mentir
    // sobre o estado atual da conta do dono.
    advantagePlus: auto.advantage_audience == null ? true : Number(auto.advantage_audience) === 1,
  };
}

// A Meta recusa raio de cidade abaixo disso (código 1487110, apanhado ao vivo
// em 2026-07-12). Raio 0 é caso à parte: significa "a cidade inteira".
export const RAIO_MINIMO_KM = 17;
export const RAIO_MINIMO_MI = 10;

function cidadeParaMeta(c, ajustes) {
  const saida = { key: String(c.key) };
  if (c.nome != null) saida.name = c.nome;
  const raio = Number(c.raio) || 0;
  if (raio > 0) {
    const unidade = c.unidade === 'mile' ? 'mile' : 'kilometer';
    const minimo = unidade === 'mile' ? RAIO_MINIMO_MI : RAIO_MINIMO_KM;
    if (raio < minimo) {
      ajustes.push({ cidade: c.nome || String(c.key), de: raio, para: minimo, unidade });
      saida.radius = minimo;
    } else {
      saida.radius = raio;
    }
    saida.distance_unit = unidade;
  }
  return saida;
}

// Troca APENAS a parte de interesses do flexible_spec, preservando os outros
// grupos (comportamentos, eventos de vida). Eles moram no mesmo array e
// sobrescrevê-lo inteiro os apagaria — mesma classe de perda que este arquivo
// existe para evitar.
function flexComInteresses(originalFlex, interesses) {
  const outros = (Array.isArray(originalFlex) ? originalFlex : []).filter((g) => g && !g.interests);
  if (!interesses.length) return outros.length ? outros : null;
  return [...outros, { interests: interesses.map((i) => ({ id: String(i.id), name: i.name })) }];
}

// Escreve o público de volta no formato da Meta.
//
// PARTE DO ORIGINAL e sobrescreve só as chaves gerenciadas. Toda chave que
// este editor não conhece passa intacta. Campo gerenciado que ficou vazio é
// REMOVIDO do pacote em vez de ir como lista vazia — a Meta trata `[]` e
// ausente de formas diferentes.
export function montarTargeting(publico, original) {
  const t = Object.assign({}, original && typeof original === 'object' ? original : {});
  const p = Object.assign({}, PUBLICO_VAZIO, publico || {});
  const ajustes = [];
  const põe = (chave, valor) => { if (valor == null) delete t[chave]; else t[chave] = valor; };

  // Sem cidade nenhuma a chave SAI do pacote. Ressuscitar as cidades antigas
  // aqui faria a tela mentir: o dono apagou tudo e veria o de antes voltar.
  // Quem impede de salvar um público sem lugar é o aviso bloqueante (Task 4).
  põe('geo_locations', p.cidades.length
    ? { cities: p.cidades.map((c) => cidadeParaMeta(c, ajustes)) }
    : null);

  const cid = p.excluidas.filter((e) => e.tipo !== 'regiao').map((e) => {
    const c = { key: String(e.key) };
    if (e.nome != null) c.name = e.nome;
    return c;
  });
  const reg = p.excluidas.filter((e) => e.tipo === 'regiao').map((e) => {
    const r = { key: String(e.key) };
    if (e.nome != null) r.name = e.nome;
    return r;
  });
  const fora = {};
  if (cid.length) fora.cities = cid;
  if (reg.length) fora.regions = reg;
  põe('excluded_geo_locations', Object.keys(fora).length ? fora : null);

  põe('age_min', Number(p.idadeMin));
  põe('age_max', Number(p.idadeMax));
  põe('genders', p.generos.length ? p.generos.map(Number) : null);
  põe('flexible_spec', flexComInteresses(t.flexible_spec, p.interesses));
  põe('custom_audiences', p.incluir.length ? p.incluir.map((a) => {
    const aud = { id: String(a.id) };
    if (a.name != null) aud.name = a.name;
    return aud;
  }) : null);
  põe('excluded_custom_audiences', p.excluir.length ? p.excluir.map((a) => {
    const aud = { id: String(a.id) };
    if (a.name != null) aud.name = a.name;
    return aud;
  }) : null);
  põe('targeting_automation', { ...(t.targeting_automation || {}), advantage_audience: p.advantagePlus ? 1 : 0 });

  return { targeting: t, ajustes };
}
