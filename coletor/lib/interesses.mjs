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

// QUEM PROCURAR em cada objetivo — a linha que faz os seis objetivos pedirem
// coisas DIFERENTES.
//
// Medido: com o pedido só dizendo o nome do objetivo, os seis devolveram
// praticamente a mesma lista. E aí a promessa da ferramenta cai por terra: a
// faixa existe porque o que serve pra vender não é o que serve pra ser
// conhecido. Se as seis listas são iguais, sobrou uma lista só, repetida seis
// vezes e cobrada seis vezes.
//
// Cada linha diz em que MOMENTO da relação com a marca está a pessoa daquele
// objetivo. É isso que muda o termo — não o nome do objetivo.
//
// Mesma regra do mapa acima: chave faltante não vira 'undefined' no pedido, a
// linha simplesmente não entra (ver montarPedido), e há teste garantindo que o
// mapa cobre exatamente OBJETIVOS.
//
// CADA LINHA DIZ *QUEM* PROCURAR — NUNCA "QUÃO ESTREITO" O TERMO TEM DE SER.
// Esta é a única sobrevivente da rodada que zerou, e ela só pode ficar se não
// carregar a pressão que zerou. A linha de vendas dizia "tipos de produto
// ESPECÍFICOS", que é a mesma instrução por outro nome — saiu. Se um dia alguém
// for editar aqui: palavra que empurre pra estreitar o termo ("específico",
// "nicho", "detalhado") reintroduz o defeito sem parecer que reintroduziu.
export const FOCO_DO_OBJETIVO = {
  engajamento: 'Gente que já gosta do assunto e comenta sobre ele: hobbies, comunidades e temas do dia a dia dela.',
  reconhecimento: 'Gente que ainda NÃO conhece a marca: o estilo de vida e os gostos de quem teria a ver com ela.',
  trafego: 'Gente que pesquisa e compara antes de decidir: assuntos de quem está se informando sobre esse tipo de produto.',
  mensagens: 'Gente que tira dúvida antes de comprar: assuntos de quem quer atendimento, medida, encomenda, personalização.',
  leads: 'Gente disposta a deixar contato em troca de algo: assuntos de quem busca novidade, lista de espera, condição especial.',
  vendas: 'Gente em momento de compra: marcas concorrentes e ocasiões que levam a comprar.',
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
  // "CURTO E ABRANGENTE" É DE PROPÓSITO, E JÁ FOI PAGO CARO PRA DESCOBRIR ISSO.
  //
  // Duas rodadas mediram os dois extremos deste mesmo texto:
  //   pedindo o NOME EXATO do interesse ........ 15% dos nomes existiam
  //   pedindo termo "ESPECÍFICO" ............... ZERO resultado em 48 buscas
  //   pedindo termo "curto e abrangente" ....... 49 interesses achados
  //
  // O motivo é o catálogo da Meta, não o modelo: ele é GROSSO. Tem "Moda
  // feminina", "Bolsas", "Roupas femininas" — não tem "bolsa de couro artesanal
  // para trabalho". Termo específico demais não acha nada porque a entrada
  // correspondente não existe lá dentro.
  //
  // ENTÃO NÃO APERTE ESTE TEXTO PRA "MELHORAR A RELEVÂNCIA". Já tentamos, e o
  // resultado foi a faixa inteira vazia nos seis objetivos. Se os nomes vierem
  // fora de contexto (filme americano, semana de moda da Índia), o caminho é
  // filtrar DEPOIS pela categoria que a Meta devolve em `path`, não estreitar o
  // termo antes — o `path` é justamente o que esta rodada está indo medir.
  const system =
    'Você sugere ASSUNTOS de busca para encontrar interesses de segmentação do Meta Ads para lojas brasileiras. ' +
    'Você NÃO precisa conhecer o catálogo do Meta nem acertar o nome exato de nenhum interesse: ' +
    'cada assunto que você der será buscado na própria Meta, e os nomes de verdade vêm de lá. ' +
    'Responda só com termos curtos em português do Brasil, um assunto por item. Nada de explicação.';

  const foco = limpo(FOCO_DO_OBJETIVO[objetivo]);

  const user = [
    `Marca: ${nomeMarca}`,
    linhasLojas.length ? `Lojas:\n${linhasLojas.join('\n')}` : 'Lojas: não cadastradas',
    `Objetivo da campanha: ${nomeObjetivo}${ajuda ? ` (medido por: ${ajuda})` : ''}`,
    // A ÚNICA linha que sobrou da tentativa que zerou: ela diz QUEM procurar, não
    // quão estreito o termo tem de ser. Sem foco cadastrado a linha some inteira —
    // nunca vira 'undefined' no pedido.
    ...(foco ? [`Quem procurar neste objetivo: ${foco}`] : []),
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

// TETO DE PÚBLICO — acima disto o interesse não é critério de segmentação.
//
// "Compras na internet" tem 1,58 BILHÃO de pessoas. Escolher isso como interesse
// é o mesmo que não escolher interesse nenhum: não separa cliente de
// não-cliente, só dá a impressão de que a campanha está mirando alguém.
//
// ESTE NÚMERO É PROVISÓRIO, e está escrito aqui pra ser mudado.
// Ele saiu de UMA rodada, e a rodada mediu pouco: dos tamanhos que o dono julgou,
// só conhecemos dois que ele recusou (1,58 bi e 178 mi) — e NENHUM dos quatro
// interesses que ele aprovou. Ou seja, não sabemos onde começa o "largo demais",
// só sabemos um lugar onde ele com certeza já passou.
//
// Por isso a linha começa ALTA, em 500 milhões: ela corta o que é indefensável
// e não arrisca derrubar às cegas um interesse bom cujo tamanho ninguém mediu.
// Errar pra cima deixa entrar lixo que o dono vê e reclama; errar pra baixo
// apaga interesse bom sem ninguém nunca saber que ele existiu.
//
// E TEM UM PORÉM QUE IMPEDE DE APERTAR NO CHUTE: o tamanho que a Meta devolve
// parece ser GLOBAL, não do Brasil. Um número grande não é automaticamente
// errado pra cá. Só dá pra baixar esta linha depois de ver, na rodada seca, os
// tamanhos dos interesses que PRESTAM — e é justamente por isso que a prévia
// mostra o tamanho de tudo que fica, e o log lista tudo que foi cortado por
// aqui.
export const TETO_DE_PUBLICO = 500_000_000;

// A CATEGORIA do interesse, do jeito que a Meta manda: um caminho de migalhas
// ("Compras e moda" > "Bolsas"). É a informação que a gente vinha JOGANDO FORA e
// que provavelmente separa "Bolsas" (Compras e moda) de "Observe and Report"
// (Entretenimento > Filmes) e "India Fashion Week" (Eventos).
//
// AINDA NÃO FILTRA NADA. Esta rodada só COLHE e MOSTRA, pra decidir a regra em
// cima de valor real em vez de mais um palpite — foi palpite que zerou as duas
// últimas rodadas.
//
// Devolve sempre um ARRAY DE TEXTOS, vazio quando não deu pra saber. Aqui vazio
// e ausente valem a mesma coisa de propósito: os dois querem dizer "não sei a
// categoria", e nenhuma decisão depende de distinguir um do outro (diferente do
// audience_size, onde 0 e desconhecido são fatos distintos e por isso null é
// obrigatório).
//
// Aceita array (filtrando pro que é texto de verdade) e também texto solto, caso
// a Meta mude o formato: numa rodada de diagnóstico, mostrar o que veio vale
// mais que descartar por não ser exatamente a forma esperada. Qualquer outra
// coisa vira vazio.
function caminhoDoInteresse(bruto) {
  if (typeof bruto === 'string') {
    const s = limpo(bruto);
    return s ? [s] : [];
  }
  const saida = [];
  for (const p of lista(bruto)) {
    const s = limpo(p);          // item nulo, número ou objeto no meio: pulado
    if (s) saida.push(s);
  }
  return saida;
}

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
// Devolve `{ itens, propostos, validos }` como sempre — tabela, faixa e
// contadores não mudam — mais `largos`, que são os cortados pelo teto de
// público. `largos` NÃO vai pro banco: existe pra rodada seca poder mostrar no
// log o que foi jogado fora e por quê. Corte que ninguém vê é corte que ninguém
// consegue corrigir, e este teto nasceu provisório de propósito.
//
// `propostos` são os TERMOS que a IA deu, `validos` os interesses distintos que
// ficaram. Não é taxa de sobrevivência, é quanto rendeu.
export function colherDaBusca(termos, respostas, limite = MAXIMO_POR_OBJETIVO, teto = TETO_DE_PUBLICO) {
  const vistos = new Set();
  const itens = [];
  const largos = [];
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
      const item = { id, nome, audience_size, path: caminhoDoInteresse(l.path) };
      // LARGO DEMAIS pra ser critério de segmentação — ver TETO_DE_PUBLICO.
      //
      // Só corta quem TEM tamanho medido e passou do teto. Tamanho DESCONHECIDO
      // (null) NUNCA é cortado aqui: não se joga fora o que não se conseguiu
      // medir. Tratar null como "grande" seria condenar por falta de prova, e
      // tratar como "pequeno" já é o que acontece — ele fica, e vai pro fim da
      // fila na ordenação, que é o lugar honesto de quem não tem número.
      const largoDemais = audience_size != null && Number.isFinite(teto) && audience_size > teto;
      (largoDemais ? largos : itens).push(item);
    }
  }

  // MAIOR PÚBLICO PRIMEIRO: é a ordem que serve ao dono, porque a faixa mostra
  // as primeiras e ele quer ver antes o interesse que alcança mais gente.
  // Tamanho DESCONHECIDO (null) vai pro fim, nunca pro começo — ordenar null
  // como se fosse zero já seria ruim; deixá-lo na frente colocaria justamente o
  // que não se sabe medir no lugar de mais destaque.
  const peso = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : -Infinity);
  const porTamanho = (a, b) => peso(b.audience_size) - peso(a.audience_size);
  itens.sort(porTamanho);
  largos.sort(porTamanho);   // o maior primeiro também aqui: o log fica lendo do pior pro menos pior

  const cortados = Number.isFinite(limite) && limite >= 0 ? itens.slice(0, limite) : itens;
  // `validos` conta o que FICOU na linha, não o que foi colhido antes do corte:
  // a tabela guarda `itens` e `validos` lado a lado, e um número maior que a
  // lista ao lado dele seria uma contradição visível na própria tela.
  return { itens: cortados, propostos: lista(termos).length, validos: cortados.length, largos };
}

// Tamanho de público em português: '2,3 mi', '940 mil', '850'.
//
// É A MESMA REGRA da etiqueta da faixa na Fábrica (painel-subir.vue,
// "formatarPublico"), copiada de propósito — o robô é Node e a outra mora dentro
// de um .vue, então não dá pra importar. Se um dia divergirem, o log do robô e a
// tela mostrariam números diferentes pro MESMO interesse, e quem estivesse
// conferindo um contra o outro ia achar que o robô gravou errado.
//
// O corte do 'mi' é 999.500 e não 1.000.000 porque a faixa de baixo ARREDONDA:
// com corte em 1 milhão, 999.999 caía no 'mil', virava Math.round(999,999) =
// 1.000 e aparecia como '1.000 mil' — que ninguém escreve.
//
// Desconhecido devolve '' (e não '0'): nulo e zero são fatos diferentes, e quem
// chama decide o que escrever no lugar.
export function tamanhoLegivel(n) {
  if (typeof n !== 'number' || !Number.isFinite(n)) return '';
  // 'bi' pelo mesmo motivo do 'mi', um degrau acima: sem ele, 1,58 bilhão sai
  // como '1.580 mi', que ninguém lê como um bilhão e meio. O corte é 999,5 mi
  // pra faixa de baixo não arredondar em '1.000 mi'.
  if (n >= 999_500_000) return (n / 1_000_000_000).toLocaleString('pt-BR', { maximumFractionDigits: 2 }) + ' bi';
  if (n >= 999_500) return (n / 1_000_000).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' mi';
  if (n >= 1_000) return Math.round(n / 1000).toLocaleString('pt-BR') + ' mil';
  return n.toLocaleString('pt-BR');
}

// A categoria pronta pro log: 'Compras e moda > Bolsas', ou o aviso de que a
// Meta não mandou nenhuma. Aparece em TUDO que o log mostra (o que fica e o que
// é cortado), porque é justamente o valor que esta rodada foi medir.
function categoriaLegivel(path) {
  const c = lista(path).filter((p) => typeof p === 'string' && p);
  return c.length ? c.join(' > ') : 'sem categoria';
}

// OS TERMOS QUE A IA DEVOLVEU — só na rodada seca, e é o buraco que duas rodadas
// zeradas escancararam: com zero interesse achado, os termos eram a ÚNICA pista
// do que tinha acontecido, e eles eram invisíveis. É a mesma falta que os nomes
// de interesse tinham, um andar acima.
//
// Sai ANTES das buscas, e não depois: numa rodada em que tudo falha ou tudo vem
// vazio, esta linha ainda assim aparece.
export function linhaDosTermos(termos) {
  const limpos = [];
  for (const t of lista(termos)) {
    const s = limpo(t);
    if (s) limpos.push(s);
  }
  if (!limpos.length) return '';
  // Junta com ' · ' e não com vírgula: termo pode ter vírgula dentro, e aí não
  // dava pra saber onde um acaba e o outro começa.
  return `termos da IA: ${limpos.join(' · ')}`;
}

// AS LINHAS DO QUE FOI CORTADO POR SER LARGO DEMAIS — só na rodada seca.
//
// O teto de público é provisório e foi tirado de uma medição só. Um corte que
// não aparece em lugar nenhum é um corte que ninguém consegue conferir: o dono
// veria a faixa menor e não saberia se o robô achou pouco ou se jogou fora
// muito. Mostrando nome, tamanho e categoria de cada descartado, a próxima
// rodada tem com o que ajustar a linha — que é exatamente o que falta hoje.
export function linhasDosLargos(largos, teto = TETO_DE_PUBLICO) {
  const linhas = [];
  for (const i of lista(largos)) {
    if (!i || typeof i !== 'object') continue;
    const nome = limpo(i.nome);
    if (!nome) continue;
    linhas.push(`         · ${nome} — ${tamanhoLegivel(i.audience_size) || 'tamanho desconhecido'}  [${categoriaLegivel(i.path)}]`);
  }
  if (!linhas.length) return [];
  const limite = tamanhoLegivel(teto);
  return [`      descartados por serem largos demais${limite ? ` (acima de ${limite})` : ''}:`, ...linhas];
}

// A PRÉVIA DA RODADA SECA: as linhas que mostram O QUE SERIA GRAVADO.
//
// Sem isto, a rodada seca dizia só "56 interesses achados" — e uma prévia que
// não mostra o que seria escrito faz metade do serviço: o número diz se rendeu,
// mas só os NOMES dizem se prestam. Quantidade e qualidade são perguntas
// diferentes, e o dono é quem responde a segunda.
//
// Fica aqui, no arquivo puro, pelo mesmo motivo do resto: `sugerir-interesses.mjs`
// executa no import, então nada lá dentro tem teste.
//
// Ordem preservada: a lista chega de `colherDaBusca` já ordenada por maior
// público, e é NESTA ordem que ela vai pro banco. A prévia mostra exatamente
// isso — reordenar aqui seria mostrar uma coisa e gravar outra.
export function linhasDaPrevia(itens) {
  const saida = [];
  let posicao = 0;
  for (const i of lista(itens)) {
    if (!i || typeof i !== 'object') continue;      // item nulo ou lixo: pulado
    const nome = limpo(i.nome);
    if (!nome) continue;
    posicao += 1;
    const tam = tamanhoLegivel(i.audience_size);
    // 'tamanho desconhecido' por extenso, nunca '0' nem espaço em branco: no log
    // um traço solto pareceria número faltando por defeito do robô.
    // A CATEGORIA entre colchetes no fim: é o dado que esta rodada foi buscar, e
    // é lendo esta coluna que se decide se dá pra filtrar por ela.
    saida.push(`      ${String(posicao).padStart(2, ' ')}. ${nome} — ${tam || 'tamanho desconhecido'}  [${categoriaLegivel(i.path)}]`);
  }
  return saida;
}
