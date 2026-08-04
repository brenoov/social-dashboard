// OS PÚBLICOS SALVOS DA CONTA — os de verdade.
//
// POR QUE ESTE ARQUIVO EXISTE (apontado pelo dono, 2026-08-03): a seção do
// editor chamada "Públicos salvos na conta" listava `customaudiences`, que são
// LISTAS DE PESSOAS (remarketing: quem visitou, quem comprou). Público salvo é
// outra coisa: é uma SEGMENTAÇÃO guardada — cidade, idade, gênero, interesses e
// comportamentos —, e mora em `/act_X/saved_audiences`.
//
// A confusão tinha uma consequência concreta: o dono escolhia um público salvo
// que já trazia as cidades configuradas e a tela continuava pedindo a cidade.
//
// MEDIDO na conta Vessel (03/08/2026): 6 públicos salvos, e o primeiro traz
// idade 25–65, gêneros, 9 interesses, 3 comportamentos e 4 cidades com nome.
//
// PURO: sem rede, sem tela.

const lista = (v) => (Array.isArray(v) ? v : []);
const texto = (v) => (typeof v === 'string' ? v.trim() : '');

// O QUE ESTE PÚBLICO TRAZ, em uma linha — é o que decide a escolha na tela.
//
// Sem isto, seis nomes como "Público La Vessel B2B" e
// "[PÚBLICOSALVO][NÃO SEGUIDORES][COM INTERESSES][BR]" não dizem nada sobre o
// que vai ser aplicado.
export function resumoDoSalvo(targeting) {
  const t = targeting && typeof targeting === 'object' ? targeting : {};
  const geo = t.geo_locations || {};
  const partes = [];

  const cidades = lista(geo.cities).length;
  const regioes = lista(geo.regions).length;
  const paises = lista(geo.countries).length;
  if (cidades) partes.push(cidades === 1 ? '1 cidade' : `${cidades} cidades`);
  if (regioes) partes.push(regioes === 1 ? '1 região' : `${regioes} regiões`);
  if (paises) partes.push(paises === 1 ? '1 país' : `${paises} países`);
  if (!partes.length) partes.push('sem localização');

  if (t.age_min != null || t.age_max != null) {
    partes.push(`${t.age_min ?? 18}–${t.age_max ?? 65} anos`);
  }
  const g = lista(t.genders).map(Number);
  if (g.length === 1) partes.push(g[0] === 1 ? 'só homens' : 'só mulheres');

  const nInteresses = contarNoFlex(t, 'interests');
  const nComportamentos = contarNoFlex(t, 'behaviors');
  if (nInteresses) partes.push(nInteresses === 1 ? '1 interesse' : `${nInteresses} interesses`);
  if (nComportamentos) partes.push(nComportamentos === 1 ? '1 comportamento' : `${nComportamentos} comportamentos`);

  const custom = lista(t.custom_audiences).length;
  if (custom) partes.push(custom === 1 ? '1 público de remarketing' : `${custom} públicos de remarketing`);

  return partes.join(' · ');
}

function contarNoFlex(t, chave) {
  let n = 0;
  for (const grupo of lista(t && t.flexible_spec)) n += lista(grupo && grupo[chave]).length;
  return n;
}

// AS CIDADES QUE ESTE PÚBLICO JÁ TRAZ, por nome. É a frase que responde à
// reclamação que originou tudo isto ("já tem localização e você pede de novo").
export function cidadesDoSalvo(targeting) {
  const geo = (targeting && targeting.geo_locations) || {};
  return lista(geo.cities).map((c) => texto(c && c.name) || String((c && c.key) || '')).filter(Boolean);
}

// Traz localização? Quem traz não pode fazer a tela pedir cidade de novo.
export const trazLocalizacao = (targeting) => {
  const geo = (targeting && targeting.geo_locations) || {};
  return lista(geo.cities).length > 0 || lista(geo.regions).length > 0 || lista(geo.countries).length > 0;
};

// Normaliza a resposta da Meta. `targeting` ausente é público salvo que não dá
// para aplicar — some da lista em vez de aparecer e não fazer nada.
export function lerSalvos(resposta) {
  return lista(resposta)
    .filter((a) => a && a.id != null && a.targeting && typeof a.targeting === 'object')
    .map((a) => ({
      id: String(a.id),
      nome: texto(a.name) || `Público ${a.id}`,
      targeting: a.targeting,
      resumo: resumoDoSalvo(a.targeting),
      cidades: cidadesDoSalvo(a.targeting),
      temLocalizacao: trazLocalizacao(a.targeting),
    }));
}
