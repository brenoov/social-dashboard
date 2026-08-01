// A busca por texto da ferramenta.
//
// POR QUE UM MÓDULO E NÃO UM `.filter()` em cada tela: eram cinco visões sem
// busca nenhuma, e a tentação é escrever cinco filtros ligeiramente diferentes.
// Aí "bolsa" acha na Lista e não acha no Quadro, e ninguém entende por quê.
//
// PURO: sem Vue e sem banco, testável com `node --test`.

// Tira acento e caixa. Sem isso "sao paulo" não acha "São Paulo", que é o
// primeiro teste que qualquer pessoa faz — e o teclado do celular corrige
// acento de um jeito que ninguém controla.
export function normalizar(txt) {
  return (typeof txt === 'string' ? txt : '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

// Onde procurar numa PEÇA. Título e legenda são o óbvio; hashtags e observações
// entram porque é comum lembrar do post pela hashtag ou pelo recado da equipe.
function _textoDaPeca(p) {
  return [p?.titulo, p?.legenda, p?.hashtags, p?.observacoes].filter(Boolean).join(' ');
}

// Onde procurar numa IDEIA. O roteiro entra inteiro: quem procura "vitrine"
// pode estar lembrando de uma fala do take 3, não do título.
function _textoDaIdeia(i) {
  const roteiro = (Array.isArray(i?.roteiro) ? i.roteiro : [])
    .map(t => [t?.imagem, t?.narracao, t?.fala, t?.texto_na_tela].filter(Boolean).join(' '))
    .join(' ');
  return [
    i?.titulo, i?.gancho, i?.pilar, i?.formato, i?.producao, i?.cta,
    i?.legenda_sugerida, i?.hashtags_sugeridas, i?.por_que_agora, roteiro,
  ].filter(Boolean).join(' ');
}

// TODAS as palavras precisam aparecer, em qualquer ordem e em qualquer campo.
// Buscar frase exata seria pior: ninguém lembra a ordem em que escreveu.
function _casa(texto, termo) {
  const alvo = normalizar(texto);
  const palavras = normalizar(termo).split(/\s+/).filter(Boolean);
  if (!palavras.length) return true;
  return palavras.every(p => alvo.includes(p));
}

export function filtrarPecas(pecas, termo) {
  const lista = Array.isArray(pecas) ? pecas : [];
  if (!normalizar(termo)) return lista;
  return lista.filter(p => _casa(_textoDaPeca(p), termo));
}

export function filtrarIdeias(ideias, termo) {
  const lista = Array.isArray(ideias) ? ideias : [];
  if (!normalizar(termo)) return lista;
  return lista.filter(i => _casa(_textoDaIdeia(i), termo));
}
