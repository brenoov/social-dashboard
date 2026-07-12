// Resolve config de marca/loja da tabela (substitui as constantes CFG/LOJAS hardcoded).
export function montarLegenda(template, { desconto, marca }) {
  return String(template || '').replace(/\{desconto\}/g, desconto ?? '').replace(/\{marca\}/g, marca ?? '');
}

export async function carregarMarcasELojas(sbGet) {
  const marcas = await sbGet('/fabrica_marcas?select=id,nome,caption_template,ad_account,page_id,ig_id,account_id,ativo');
  const lojasRaw = await sbGet('/fabrica_lojas?select=deposito_id,nome,ativo,ordem,marca_id,whatsapp,geo_cities,canal_loja_id&order=ordem');
  const marcaById = Object.fromEntries(marcas.map((m) => [m.id, {
    id: m.id, nome: m.nome, captionTemplate: m.caption_template, adAccount: m.ad_account,
    pageId: m.page_id, igId: m.ig_id, accountId: m.account_id, ativo: m.ativo,
  }]));
  const lojas = lojasRaw.map((l) => ({
    depositoId: l.deposito_id, nome: l.nome, ativo: l.ativo, ordem: l.ordem,
    whatsapp: l.whatsapp, geoCities: l.geo_cities || [], canalLojaId: l.canal_loja_id,
    marca: marcaById[l.marca_id] || null,
  }));
  const marcaAtiva = marcas.find((m) => m.ativo) ? marcaById[marcas.find((m) => m.ativo).id] : null;
  return { lojas, marcaAtiva };
}
