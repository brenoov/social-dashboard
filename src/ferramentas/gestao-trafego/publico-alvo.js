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
  outrasLocalizacoes: [],
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

// Localidades que o editor não gerencia, mas que devem ser preservadas. Retorna
// os nomes das chaves de geo_locations que não são 'cities' e contêm dados.
// Também captura tipos desconhecidos (futuros campos da Meta).
function outrasLocalizacoesDe(targeting) {
  const geo = (targeting && targeting.geo_locations) || {};
  const outras = [];
  // Chaves conhecidas (para ordem consistente)
  const conhecidas = ['regions', 'countries', 'zips', 'custom_locations', 'places', 'geo_markets'];
  for (const chave of conhecidas) {
    if (lista(geo[chave]).length > 0) outras.push(chave);
  }
  // Captura tipos desconhecidos (iterar todas as chaves, exceto 'cities')
  for (const chave in geo) {
    if (chave !== 'cities' && !conhecidas.includes(chave) && lista(geo[chave]).length > 0) {
      outras.push(chave);
    }
  }
  return outras;
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
    // Localidades que o editor não gerencia (regiões, países, CEPs, etc.).
    // Descritivo apenas; montarTargeting ignora esse campo e preserva as outras
    // localidades direto do original.
    outrasLocalizacoes: outrasLocalizacoesDe(t),
  };
}

// A Meta recusa raio de cidade abaixo disso (código 1487110, apanhado ao vivo
// em 2026-07-12). Raio 0 é caso à parte: significa "a cidade inteira".
export const RAIO_MINIMO_KM = 17;
export const RAIO_MINIMO_MI = 10;

function cidadeParaMeta(c, ajustes) {
  if (c == null || c.key == null) return null;
  const saida = { key: String(c.key) };
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
  // Filtra nulls de interesses: Meta carrega nome no read, mas não valida na escrita
  const ints = interesses.filter((i) => i != null && i.id != null);
  if (!ints.length) return outros.length ? outros : null;
  return [...outros, { interests: ints.map((i) => ({ id: String(i.id), name: i.name })) }];
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

  // Preserva outras localidades (regiões, países, etc.) que o editor não gerencia.
  // Começa do original e sobrescreve só o campo 'cities'. Se as cidades ficarem
  // vazias, deleta apenas esse campo, mantendo o resto. Deleta geo_locations
  // inteira só se nada restar.
  const cidsFiltered = p.cidades.filter((c) => c != null).map((c) => cidadeParaMeta(c, ajustes)).filter((c) => c != null);
  const geoOriginal = (t.geo_locations && typeof t.geo_locations === 'object') ? { ...t.geo_locations } : {};
  if (cidsFiltered.length) {
    geoOriginal.cities = cidsFiltered;
  } else {
    delete geoOriginal.cities;
  }
  // Deleta geo_locations inteira só se nenhuma outra localização restar
  if (Object.keys(geoOriginal).length) {
    t.geo_locations = geoOriginal;
  } else {
    delete t.geo_locations;
  }

  const cid = p.excluidas.filter((e) => e != null && e.key != null && e.tipo !== 'regiao').map((e) => ({ key: String(e.key) }));
  const reg = p.excluidas.filter((e) => e != null && e.key != null && e.tipo === 'regiao').map((e) => ({ key: String(e.key) }));
  const fora = {};
  if (cid.length) fora.cities = cid;
  if (reg.length) fora.regions = reg;
  põe('excluded_geo_locations', Object.keys(fora).length ? fora : null);

  põe('age_min', Number(p.idadeMin));
  põe('age_max', Number(p.idadeMax));
  // Filtra nulls e coerce a number: Number(null) === 0 mas gêneros válidos são 1 e 2
  const gerosValid = p.generos.filter((g) => g != null).map(Number).filter((g) => !Number.isNaN(g));
  põe('genders', gerosValid.length ? gerosValid : null);
  põe('flexible_spec', flexComInteresses(t.flexible_spec, p.interesses));
  const incluirValid = p.incluir.filter((a) => a != null && a.id != null).map((a) => ({ id: String(a.id) }));
  põe('custom_audiences', incluirValid.length ? incluirValid : null);
  const excluirValid = p.excluir.filter((a) => a != null && a.id != null).map((a) => ({ id: String(a.id) }));
  põe('excluded_custom_audiences', excluirValid.length ? excluirValid : null);
  põe('targeting_automation', { ...(t.targeting_automation || {}), advantage_audience: p.advantagePlus ? 1 : 0 });

  return { targeting: t, ajustes };
}

const GENERO_NOME = { 1: 'homens', 2: 'mulheres' };

// Formata nome para display: mostra "sem nome" se vazio, nunca codigo sozinho.
function nomePara(x, chave) {
  const nome = x.nome || x.name;
  if (nome) return nome;
  return `sem nome (${chave})`;
}

// Compara duas listas por chave e devolve "+entrou, −saiu" com NOMES.
// Código de cidade e id de interesse não significam nada para o dono.
// Null ou sem chave/id é saltado — nunca quebra.
function diffLista(antes, depois, chaveDe, rotulo) {
  const mapa = (arr) => new Map(
    (arr || [])
      .filter((x) => x != null && chaveDe(x) != null)
      .map((x) => {
        const chave = String(chaveDe(x));
        const nome = nomePara(x, chave);
        return [chave, nome];
      })
  );
  const a = mapa(antes), d = mapa(depois);
  const entrou = [...d].filter(([k]) => !a.has(k)).map(([, n]) => '+' + n);
  const saiu = [...a].filter(([k]) => !d.has(k)).map(([, n]) => '−' + n);
  if (!entrou.length && !saiu.length) return null;
  return rotulo + ': ' + [...entrou, ...saiu].join(', ');
}

// Lista em português do que mudou entre dois públicos. É o que o dono lê
// antes de confirmar — por isso nomes, nunca códigos.
export function resumoDasMudancas(antes, depois) {
  const a = Object.assign({}, PUBLICO_VAZIO, antes || {});
  const d = Object.assign({}, PUBLICO_VAZIO, depois || {});
  const linhas = [];

  const cid = diffLista(a.cidades, d.cidades, (x) => x.key, 'Cidades');
  if (cid) linhas.push(cid);

  // Raio ou unidade mudam sem a cidade entrar ou sair — precisa de comparação própria.
  const raioAntes = new Map((a.cidades || []).filter((c) => c != null && c.key != null).map((c) => [c.key, c]));
  for (const c of (d.cidades || [])) {
    if (c == null || c.key == null) continue;
    const ant = raioAntes.get(c.key);
    if (ant && (Number(ant.raio) !== Number(c.raio) || ant.unidade !== c.unidade)) {
      // Pula mudança de unidade quando ambos os raios são 0 (cidade inteira), é irrelevante.
      if (Number(ant.raio) === 0 && Number(c.raio) === 0) continue;
      const unAnt = ant.unidade === 'mile' ? 'mi' : 'km';
      const unNova = c.unidade === 'mile' ? 'mi' : 'km';
      const valAnt = ant.raio ? `${ant.raio} ${unAnt}` : 'cidade inteira';
      const valNova = c.raio ? `${c.raio} ${unNova}` : 'cidade inteira';
      const nomeCidade = nomePara(c, c.key);
      linhas.push(`Raio de ${nomeCidade}: ${valAnt} → ${valNova}`);
    }
  }

  const exc = diffLista(a.excluidas, d.excluidas, (x) => x.key, 'Lugares excluídos');
  if (exc) linhas.push(exc);

  if (a.idadeMin !== d.idadeMin || a.idadeMax !== d.idadeMax)
    linhas.push(`Idade: ${a.idadeMin}–${a.idadeMax} → ${d.idadeMin}–${d.idadeMax}`);

  const gen = (g) => (g.length ? g.map((x) => GENERO_NOME[x] || x).join(' e ') : 'todos');
  if (gen(a.generos) !== gen(d.generos))
    linhas.push(`Gênero: ${gen(a.generos)} → ${gen(d.generos)}`);

  const int = diffLista(a.interesses, d.interesses, (x) => x.id, 'Interesses');
  if (int) linhas.push(int);

  const inc = diffLista(a.incluir, d.incluir, (x) => x.id, 'Públicos incluídos');
  if (inc) linhas.push(inc);

  const exd = diffLista(a.excluir, d.excluir, (x) => x.id, 'Públicos excluídos');
  if (exd) linhas.push(exd);

  if (a.advantagePlus !== d.advantagePlus)
    linhas.push('Advantage+: ' + (d.advantagePlus ? 'desligado → LIGADO' : 'ligado → DESLIGADO'));

  return linhas;
}

const temRestricaoManual = (p) =>
  (p.generos && p.generos.length > 0) ||
  (p.interesses && p.interesses.length > 0) ||
  p.idadeMin !== PUBLICO_VAZIO.idadeMin ||
  p.idadeMax !== PUBLICO_VAZIO.idadeMax;

const NOMES_LOCALIZACOES = {
  regions: 'região',
  countries: 'país',
  zips: 'CEP',
  custom_locations: 'localização personalizada',
  places: 'local',
  geo_markets: 'mercado geográfico',
};

// Traduz chaves de geo_locations da Meta para português legível.
function nomeDaLocalizacao(chave) {
  return NOMES_LOCALIZACOES[chave] || 'outra localização';
}

// Os avisos que precedem o salvar. `bloqueia: true` impede a gravação até o
// dono resolver o conflito.
//
// Aviso que aparece sempre é aviso que ninguém lê: se nada mudou, não avisa
// nada, e o aviso de aprendizado só sai em conjunto que está rodando.
export function avisosDe(antes, depois, contexto) {
  const a = Object.assign({}, PUBLICO_VAZIO, antes || {});
  const d = Object.assign({}, PUBLICO_VAZIO, depois || {});
  const ctx = contexto || {};
  const avisos = [];
  const mudou = resumoDasMudancas(a, d).length > 0;

  for (const aj of ctx.ajustes || []) {
    if (aj == null) continue;
    const un = aj.unidade === 'mile' ? 'milhas' : 'km';
    avisos.push({
      tipo: 'raio',
      texto: `Ajustei o raio de ${aj.cidade} de ${aj.de} para ${aj.para} ${un} — a Meta não aceita menos.`,
      bloqueia: false,
    });
  }

  // A Meta exige localização: conjunto não mira em lugar nenhum. Barrar aqui
  // é melhor que deixar salvar e tomar recusa sem entender o motivo.
  // Mas só bloqueia se REALMENTE não houver localização nenhuma — nem cidades
  // nem regiões/países/CEPs/etc.
  const temCidades = (d.cidades || []).length > 0;
  const temOutrasLoc = (d.outrasLocalizacoes || []).length > 0;
  if (!temCidades && !temOutrasLoc) {
    avisos.push({
      tipo: 'sem-lugar',
      texto: 'O público ficou <b>sem nenhuma localização</b>. A Meta não aceita um conjunto sem localização — escolha pelo menos uma cidade, região, país, CEP ou localização customizada.',
      bloqueia: true,
    });
  } else if (temOutrasLoc) {
    // Avisa que há localidades que o editor não gerencia, mas que serão preservadas.
    const nomes = d.outrasLocalizacoes.map(nomeDaLocalizacao).join(', ');
    avisos.push({
      tipo: 'outras-localizacoes',
      texto: `Este conjunto tem ${nomes} definido(s). O editor aqui não gerencia essas localidades — elas serão <b>mantidas intactas</b> ao salvar.`,
      bloqueia: false,
    });
  }

  // A Meta REJEITA segmentação manual com o Advantage+ ligado (código 1870227,
  // apanhado ao vivo em 2026-07-12). Deixar salvar e tomar o erro seria
  // transferir pro dono um conflito que a ferramenta já conhece.
  if (d.advantagePlus && temRestricaoManual(d)) {
    avisos.push({
      tipo: 'conflito',
      texto: 'Com o Advantage+ ligado, a Meta <b>recusa</b> idade, gênero e interesses definidos à mão. Escolha: ou desliga o Advantage+, ou limpa essas restrições.',
      bloqueia: true,
    });
  } else if (!d.advantagePlus && a.advantagePlus) {
    avisos.push({
      tipo: 'advantage',
      texto: 'O Advantage+ será <b>desligado</b>. A partir daí idade, gênero e interesses passam a valer como limite de verdade.',
      bloqueia: false,
    });
  }

  if (mudou && ctx.ativo) {
    avisos.push({
      tipo: 'aprendizado',
      texto: 'Este conjunto está rodando. Mudar o público <b>reinicia o aprendizado da Meta</b> — o custo pode piorar por alguns dias até estabilizar.',
      bloqueia: false,
    });
  }

  return avisos;
}
