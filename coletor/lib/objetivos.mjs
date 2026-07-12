// SP-3: mapa objetivo -> Meta (lido de fabrica_objetivos) + helpers puros.
export async function carregarObjetivos(sbGet) {
  const objetivos = await sbGet('/fabrica_objetivos?select=*&ativo=eq.true&order=ordem');
  const porChave = new Map((objetivos || []).map((o) => [o.chave, o]));
  return { objetivos: objetivos || [], porChave };
}

export function mapaObjetivo(porChave, chave) {
  const row = porChave.get(chave) || porChave.get('engajamento');
  if (!row) throw new Error('objetivo indisponível (nem engajamento na tabela)');
  return row;
}

export function montaPromotedObject(tipo, marca, loja) {
  if (tipo === 'whatsapp') return { page_id: marca.pageId, whatsapp_phone_number: loja.whatsapp };
  if (tipo === 'page') return { page_id: marca.pageId };
  if (tipo === 'ig') return { instagram_user_id: marca.igId };
  return undefined; // 'none'
}

export function looksDoObjetivo(row, looksDisponiveis) {
  const tags = row?.looks || [];
  if (!tags.length) return looksDisponiveis;
  return looksDisponiveis.filter((l) => tags.includes(l));
}
