// O GRUPO DO CANAL DE VENDA (atacado, varejo, ...).
//
// PEDIDO DO DONO (20/08/2026): "nas vendas tem o campo seletor de canais, eu
// quero uma separação por canal — exemplo, atacado (opção pra marcar/desmarcar
// todos) e varejo".
//
// PURO de propósito, como os vizinhos desta pasta: aqui não se desenha nada e
// não se fala com banco. A tela pergunta e obedece.
//
// O GRUPO MORA NO CANAL (`bling_lojas.grupo`), NÃO NO TIME. Medido: dos 14
// canais do Bling só 3 têm time, e os 11 sem time aparecem no seletor das
// dashboards do mesmo jeito. Pôr o rótulo no time deixaria esses 11 sem grupo.
// O time é atacado ou varejo pelo canal a que já está amarrado.
//
// Grupo é TEXTO, não uma lista travada no código: o dono disse "exemplo,
// atacado e varejo", e "exemplo" é o aviso de que um terceiro pode aparecer.

// Espaço das pontas fora, espaço repetido virando um só, vazio virando nulo.
// Sem isto, "Atacado " e "Atacado" viram dois grupos que parecem um.
export function normalizarGrupo(texto) {
  const t = String(texto == null ? '' : texto).trim().replace(/\s+/g, ' ');
  return t === '' ? null : t;
}

// Comparar SEM diferenciar maiúscula: quem digita "atacado" está falando do
// mesmo grupo de quem digitou "Atacado".
export function mesmoGrupo(a, b) {
  const na = normalizarGrupo(a);
  const nb = normalizarGrupo(b);
  if (na === null || nb === null) return na === nb;
  return na.toLocaleLowerCase('pt-BR') === nb.toLocaleLowerCase('pt-BR');
}

// Os grupos que já existem, para o seletor oferecer. Guarda a grafia da PRIMEIRA
// aparição — quem escreveu primeiro decide como o nome aparece.
export function gruposExistentes(canais) {
  const vistos = new Map();
  for (const c of canais || []) {
    const g = normalizarGrupo(c && c.grupo);
    if (g === null) continue;
    const chave = g.toLocaleLowerCase('pt-BR');
    if (!vistos.has(chave)) vistos.set(chave, g);
  }
  return [...vistos.values()].sort((a, b) => a.localeCompare(b, 'pt-BR'));
}

// Os canais em baldes. O balde SEM GRUPO vai por ÚLTIMO e só existe se tiver
// gente dentro: canal sem grupo não pode sumir da lista — some do seletor é o
// defeito que a Peça 2 evita — mas cabeçalho vazio também não ajuda ninguém.
export function agruparCanais(canais) {
  const lista = canais || [];
  const baldes = [];
  for (const nome of gruposExistentes(lista)) {
    baldes.push({ grupo: nome, canais: lista.filter((c) => mesmoGrupo(c && c.grupo, nome)) });
  }
  const orfaos = lista.filter((c) => normalizarGrupo(c && c.grupo) === null);
  if (orfaos.length) baldes.push({ grupo: null, canais: orfaos });
  return baldes;
}

// De-para canal -> time, para a linha do canal poder dizer de quem ele é.
// Chave em TEXTO porque o id vem number do banco e string do formulário: casar
// por tipo diferente faz a linha dizer "sem time" com o time bem ali.
export function timePorCanal(times) {
  const mapa = new Map();
  for (const t of times || []) {
    if (t == null) continue;
    const id = t.canal_loja_id;
    if (id === null || id === undefined || id === '') continue;
    mapa.set(String(id), t);
  }
  return mapa;
}

// Quantos ainda faltam configurar — vai no cabeçalho da seção.
export function contarSemGrupo(canais) {
  return (canais || []).filter((c) => normalizarGrupo(c && c.grupo) === null).length;
}
