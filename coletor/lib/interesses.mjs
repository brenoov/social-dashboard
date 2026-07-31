// Sugestão de interesses: a parte PURA.
//
// Monta o que a IA recebe e colhe o que a Meta devolve. Sem rede, sem banco —
// por isso dá pra testar a decisão inteira sem gastar um centavo de IA nem
// tocar numa conta de anúncios.
//
// REGRA QUE ATRAVESSA O ARQUIVO: toda lista que chega aqui vem de fora (banco,
// IA, Meta) e pode ter item nulo, item sem os campos esperados, ou campo do
// tipo errado. Item ruim é PULADO; nunca quebra e nunca vira texto lixo do tipo
// "undefined" no meio do pedido.

import { ALVOS } from '../../src/ferramentas/gestao-trafego/alvos.js';

// As chaves saem da régua, não são redigitadas: uma sétima nomenclatura aqui
// garantiria divergência com o resto da ferramenta.
export const OBJETIVOS = Object.keys(ALVOS);

// O nome do objetivo em português, para o pedido e para a tela.
// NÃO existe no projeto um mapa balde → nome: `alvos.js` guarda o rótulo da
// MÉTRICA de cada balde ('Custo por ponto'), e `baldes.js` traduz o objetivo da
// Meta para a chave do balde. Este mapa preenche essa lacuna, e há teste
// garantindo que ele cobre exatamente OBJETIVOS — nem a mais, nem a menos.
export const NOME_DO_OBJETIVO = {
  engajamento: 'Engajamento',
  reconhecimento: 'Reconhecimento de marca',
  trafego: 'Tráfego para o site',
  mensagens: 'Conversas no WhatsApp ou Direct',
  leads: 'Cadastros (leads)',
  vendas: 'Vendas',
};

const lista = (v) => (Array.isArray(v) ? v : []);
const texto = (v) => (typeof v === 'string' ? v.trim() : '');

// Tira o que poderia quebrar a estrutura do pedido: newlines criam novas seções,
// e um campo gigantesco domina a requisição. Preserva aspas e apóstrofos — legítimos
// em nomes (Casa D'Oro, Loja D'Água, Sant'Ana).
const limpo = (s) => texto(s).replace(/[\n\r\x00-\x1f]/g, ' ').replace(/\s{2,}/g, ' ').trim().substring(0, 200);

// As cidades de uma loja, prontas pra entrar no pedido.
//
// FORMATO REAL DO BANCO: `fabrica_lojas.geo_cities` guarda CHAVES da Meta, não
// nomes — a migration 018 semeou '[267873,241913]' e a Fábrica lê a coluna assim
// (painel-subir.vue trata cada item como chave). Chave pelada NÃO é lixo: é o
// formato de verdade. Só que ela não tem nome pra escrever no pedido.
//
// Quem traduz chave → nome é quem tem rede: o robô pergunta à Meta antes de
// montar o pedido e entrega os itens já no formato { key, nome }. Por isso os
// DOIS formatos entram aqui:
//   { key, nome } → cidade resolvida, o nome vai pro pedido;
//   267873 / '267873' → chave crua (a Meta não respondeu, ou a cidade não voltou):
//     a loja entra no pedido sem geografia, em vez de entrar com "267873" — que
//     não diz nada pra IA e ainda parece um nome de cidade quebrado.
// Lixo de verdade (null, {}, '', tipo errado) também sai, pelo mesmo caminho.
function cidadesDaLoja(loja) {
  const saida = [];
  for (const c of lista(loja && loja.geo_cities)) {
    if (c == null) continue;
    // Chave crua (número ou texto): formato legítimo, mas sem nome pra mostrar.
    if (typeof c !== 'object') continue;
    const nome = limpo(c.nome);
    if (nome) saida.push(nome);
  }
  return saida;
}

// Troca as CHAVES de cidade de uma loja pelos NOMES que a Meta devolveu.
//
// Fica aqui, no arquivo puro, porque é decisão — não é rede: quem fala com a
// Meta é o robô, que passa o mapa { chave: nome } pronto. Assim a regra de "o
// que fazer com a chave que a Meta não reconheceu" tem teste, sem chamada paga.
//
// Chave sem nome fica COMO ESTÁ (crua). Não se inventa nome, e não se apaga a
// entrada: apagar esconderia que a loja tem cidade cadastrada, e inventar
// colocaria um número no lugar de um nome de cidade dentro do pedido.
export function comCidadesResolvidas(loja, nomes) {
  const mapa = (nomes && typeof nomes === 'object') ? nomes : {};
  return {
    ...loja,
    geo_cities: lista(loja && loja.geo_cities).map((c) => {
      if (c == null || typeof c === 'object') return c;   // já resolvida, ou lixo: não mexe
      const nome = limpo(mapa[String(c)]);
      return nome ? { key: String(c), nome } : c;
    }),
  };
}

// A RODADA INTEIRA FALHOU? — a decisão que pinta o Actions de vermelho.
//
// Cada marca × objetivo tem try/catch próprio, e isso está certo: uma marca com
// problema não pode derrubar as outras cinco. Mas quando NADA saiu e tudo foi
// pulado, a causa não é uma marca — é a chave da IA que não existe, a migration
// que não foi aplicada, o token da Meta vencido. Sem esta regra, todos esses
// casos terminavam a rodada em VERDE, e o dono só descobriria semanas depois,
// abrindo a Fábrica e estranhando a falta da faixa.
//
// Fica aqui, e não dentro do run(), pelo mesmo motivo do comCidadesResolvidas:
// `sugerir-interesses.mjs` executa no import, então nada lá dentro tem teste — e
// esta é justamente a regra que decide se um problema aparece ou não aparece.
//
// TRÊS entradas e três respostas:
//   pulou tudo e não produziu nada ....... FALHOU (vermelho)
//   rodada seca que SIMULOU pelo menos uma  não falhou (ela não grava por desenho)
//   não tinha o que fazer (nada pulado) ... não falhou (semana sem marca ativa
//                                           não é defeito; é uma semana vazia)
export function rodadaFalhouInteira({ gravadas, simuladas, puladas, seco } = {}) {
  const conta = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
  const produzidas = seco ? conta(simuladas) : conta(gravadas);
  return conta(puladas) > 0 && produzidas === 0;
}

function descreverLojas(lojas) {
  const linhas = [];
  for (const loja of lista(lojas)) {
    const nome = limpo(loja && loja.nome);
    if (!nome) continue;                      // loja nula ou sem nome: pulada
    const cidades = cidadesDaLoja(loja);
    linhas.push(cidades.length ? `- ${nome} (atende ${cidades.join(', ')})` : `- ${nome}`);
  }
  return linhas;
}

// O que a IA recebe. SÓ dado do cadastro — não existe campo de texto livre em
// lugar nenhum deste fluxo, e é isso que fecha a porta de injeção de instrução.
export function montarPedido({ marca, lojas, objetivo } = {}) {
  if (!OBJETIVOS.includes(objetivo)) return null;
  const nomeMarca = limpo(marca && marca.nome);
  if (!nomeMarca) return null;

  // ATENÇÃO: `ALVOS[x].rotulo` é o rótulo da MÉTRICA, não do objetivo —
  // engajamento tem rotulo 'Custo por ponto'. Dizer à IA "Objetivo da campanha:
  // Custo por ponto" seria absurdo. Por isso o nome do objetivo vem daqui, e o
  // `ajuda` de ALVOS entra só como contexto extra do que se está medindo.
  // Fallback: se a chave não está no mapa (divergência com ALVOS), usa a chave
  // mesmo. Nunca vira "undefined" no pedido.
  const nomeObjetivo = NOME_DO_OBJETIVO[objetivo] || objetivo;
  const ajuda = limpo((ALVOS[objetivo] || {}).ajuda);
  const linhasLojas = descreverLojas(lojas);

  // A IA NÃO PRECISA CONHECER O CATÁLOGO DA META — e é essa a mudança que este
  // pedido carrega. Antes se pedia o NOME EXATO de cada interesse, do jeito que
  // ele aparece no Gerenciador; medido na conta de verdade, só 15% dos nomes
  // existiam. Não era desleixo do modelo: pedir nome exato é pedir que ele
  // decore uma lista que ele nunca viu.
  //
  // Agora se pede o ASSUNTO. Quem procura o nome é o robô, que busca cada termo
  // na própria Meta (type=adinterest) e colhe o que voltar — os nomes saem do
  // catálogo, nunca da memória do modelo.
  const system =
    'Você sugere ASSUNTOS de busca para encontrar interesses de segmentação do Meta Ads para lojas brasileiras. ' +
    'Você NÃO precisa conhecer o catálogo do Meta nem acertar o nome exato de nenhum interesse: ' +
    'cada assunto que você der será buscado na própria Meta, e os nomes de verdade vêm de lá. ' +
    'Responda só com termos curtos em português do Brasil, um assunto por item. Nada de explicação.';

  const user = [
    `Marca: ${nomeMarca}`,
    linhasLojas.length ? `Lojas:\n${linhasLojas.join('\n')}` : 'Lojas: não cadastradas',
    `Objetivo da campanha: ${nomeObjetivo}${ajuda ? ` (medido por: ${ajuda})` : ''}`,
    '',
    'Sugira até 8 termos de busca: assuntos que importam para quem compraria desta marca com ESTE objetivo.',
    'Cada termo deve ser curto e abrangente (1 a 3 palavras), do tipo que se digita numa busca.',
    'Não tente adivinhar o nome exato de um interesse do Meta — cada termo será buscado no catálogo dele.',
  ].join('\n');

  return { system, user };
}

// O que a IA devolveu, limpo — hoje são TERMOS DE BUSCA, não nomes de interesse
// (ver montarPedido). A resposta vem de `structured()`, que já garante a forma —
// mas garantir forma não garante conteúdo, então item vazio, item que não é
// texto e repetido saem aqui. Repetido importa mais do que parecia: cada termo
// vira uma ida à Meta, e dois termos iguais são duas chamadas pela mesma resposta.
export function nomesPropostos(resposta) {
  const brutos = lista(resposta && resposta.interesses);
  const vistos = new Set();
  const saida = [];
  for (const b of brutos) {
    const nome = limpo(b);
    if (!nome || vistos.has(nome.toLowerCase())) continue;
    vistos.add(nome.toLowerCase());
    saida.push(nome);
  }
  return saida;
}

// Quantos interesses uma linha da tabela pode ter. Um termo largo ("moda")
// devolve dez resultados sozinho; sem teto, um termo desses tomaria a faixa
// inteira e os outros sete termos não apareceriam.
export const MAXIMO_POR_OBJETIVO = 12;

// OS NOMES VÊM DA META, NÃO DA IA. Aqui se colhe o que as buscas devolveram —
// cada termo da IA virou uma busca `type=adinterest`, e o que volta é catálogo
// de verdade, já com id e tamanho de público. A IA nunca escreve um nome que
// chegue à tabela: ela só escolhe o assunto.
//
// A função que existia antes (`filtrarValidos`) fazia o contrário: recebia os
// nomes que a IA tinha escrito e jogava fora o que a Meta não reconhecia.
// Funcionava, mas jogava fora 85% — daí a inversão.
//
// `respostas` é a lista de respostas acumuladas, UMA POR TERMO buscado, cada uma
// no formato que a Meta devolve ({ data: [...] }). Vem como lista porque uma
// busca pode ter falhado sozinha: o robô segue com as outras, e o que chegou
// aqui é só o que deu certo.
//
// Devolve a MESMA forma de antes — { itens, propostos, validos } — pra tabela,
// faixa e contadores da rodada não mudarem. O que mudou é o significado:
// `propostos` são os TERMOS que a IA deu, `validos` são os interesses distintos
// que as buscas acharam. Não é mais uma taxa de sobrevivência, é quanto rendeu.
export function colherDaBusca(termos, respostas, limite = MAXIMO_POR_OBJETIVO) {
  const vistos = new Set();
  const itens = [];
  for (const resposta of lista(respostas)) {
    for (const l of lista(resposta && resposta.data)) {
      if (!l || typeof l !== 'object') continue;   // item nulo ou lixo: pulado
      if (l.id == null) continue;                  // sem id não dá pra usar
      // Só aceita id string ou número; qualquer outro tipo é garbage que não pode
      // ser um identificador de verdade (objeto, array, boolean viram identificadores
      // fake como "[object Object]" ou "true" se convertidos a string, e depois quebram
      // na tabela e na conta). NaN é typeof 'number' mas também é garbage: "NaN" string.
      if (typeof l.id !== 'string' && typeof l.id !== 'number') continue;
      if (Number.isNaN(l.id)) continue;
      const id = String(l.id);
      // Repetido sai aqui, e agora ele é ROTINA, não exceção: termos parecidos
      // ("bolsa" e "bolsas") devolvem o mesmo interesse, e cada busca vem numa
      // resposta diferente — a comparação tem de valer entre TODAS elas.
      if (vistos.has(id)) continue;
      const nome = limpo(l.name);
      if (!nome) continue;
      vistos.add(id);
      // Tamanho do público: TRÊS nomes de campo possíveis, na ordem de preferência.
      // A Graph v22 (a versão que o meta-proxy usa) aposentou o `audience_size`
      // pelado nas buscas de segmentação em favor de `audience_size_lower_bound` /
      // `audience_size_upper_bound` — a mesma família de mudança que já mordeu este
      // projeto com `approximate_count` → `approximate_count_upper_bound` (a cicatriz
      // está anotada no painel-subir.vue). Ler só o nome antigo não daria ERRO: daria
      // tamanho nulo em TODO interesse, e a faixa apareceria sem número nenhum, que é
      // justamente o que ela tem de mais útil. Aceitar os três resolve nos dois mundos.
      // Ausente continua virando null (tamanho DESCONHECIDO), nunca 0.
      const bruto = l.audience_size ?? l.audience_size_upper_bound ?? l.audience_size_lower_bound;
      let audience_size = null;
      if (bruto != null) {
        const n = Number(bruto);
        if (Number.isFinite(n)) audience_size = n;
      }
      itens.push({
        id,
        nome,
        audience_size,
      });
    }
  }

  // MAIOR PÚBLICO PRIMEIRO: é a ordem que serve ao dono, porque a faixa mostra
  // as primeiras e ele quer ver antes o interesse que alcança mais gente.
  // Tamanho DESCONHECIDO (null) vai pro fim, nunca pro começo — ordenar null
  // como se fosse zero já seria ruim; deixá-lo na frente colocaria justamente o
  // que não se sabe medir no lugar de mais destaque.
  const peso = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : -Infinity);
  itens.sort((a, b) => peso(b.audience_size) - peso(a.audience_size));

  const cortados = Number.isFinite(limite) && limite >= 0 ? itens.slice(0, limite) : itens;
  // `validos` conta o que FICOU na linha, não o que foi colhido antes do corte:
  // a tabela guarda `itens` e `validos` lado a lado, e um número maior que a
  // lista ao lado dele seria uma contradição visível na própria tela.
  return { itens: cortados, propostos: lista(termos).length, validos: cortados.length };
}
