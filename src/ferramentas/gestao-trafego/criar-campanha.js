// O ASSISTENTE DE CRIAR CAMPANHA — os passos, o que cada um exige, e o resumo.
//
// PURO: sem rede e sem tela. Quem fala com a Meta é o editor; aqui mora a
// decisão de quando dá para avançar e o que vai ser criado.
//
// O PAYLOAD NÃO É MONTADO AQUI. Ele sai de `coletor/lib/payload-campanha.mjs`,
// o MESMO montador que a Fábrica usa para subir campanha de verdade há meses.
// Escrever um segundo montador ao lado de um provado foi o erro mais caro desta
// série: a Meta recusou quatro vezes seguidas, cada uma por um campo que o
// original já mandava.
import { payloadCampanhaAdset } from '../../../coletor/lib/payload-campanha.mjs';

// OS QUATRO PASSOS, na ordem em que a decisão acontece: o que se quer, quanto
// custa, para quem, e o que a pessoa vê. Cada um é uma pergunta, e é por isso
// que o assistente tem quatro telas em vez de um formulário só.
export const PASSOS = [
  { chave: 'objetivo', titulo: 'O que você quer que aconteça',
    ajuda: 'Isto define como a Meta entrega e o que ela otimiza.' },
  { chave: 'orcamento', titulo: 'Quanto por dia',
    ajuda: 'A campanha nasce PAUSADA — nada é gasto até você ativar.' },
  { chave: 'publico', titulo: 'Para quem',
    ajuda: 'Onde a campanha vai rodar e quem vai ver.' },
  { chave: 'anuncio', titulo: 'O anúncio',
    ajuda: 'A imagem e o texto que as pessoas vão ver.' },
];

// A Meta recusa imagem pequena — medido em 2026-08-03: um PNG de 95 bytes voltou
// `100/2446496 "Formato de imagem"`, com o tamanho no corpo do erro. O aviso tem
// de vir ANTES do envio: descobrir depois de esperar o upload é o pior momento.
export const LADO_MINIMO_PX = 600;
export const TAMANHO_MINIMO_BYTES = 10 * 1024;

// Piso de orçamento diário, o mesmo da fila: a Meta recusa valores muito baixos
// e o número exato varia com moeda e objetivo.
export const ORCAMENTO_MINIMO_CENTAVOS = 500;

export function estadoInicial() {
  return {
    objetivo: '',           // chave de fabrica_objetivos
    nome: '',
    orcamentoCentavos: 5000,
    tipoOrcamento: 'diario',
    // Só usada quando o orçamento é TOTAL. A Meta exige `end_time` para
    // lifetime_budget — sem data, ela recusa o conjunto.
    terminaEm: '',
    publico: null,          // forma do publico-alvo.js
    imagemHash: '',
    imagemPreview: '',
    texto: '',
  };
}

const texto = (v) => (typeof v === 'string' ? v.trim() : '');

// O QUE FALTA NESTE PASSO — lista de frases, vazia quando dá para avançar.
//
// Devolve FRASES, não códigos: quem chama mostra direto, e uma mensagem escrita
// aqui perto da regra tem chance de continuar verdadeira quando a regra mudar.
export function faltaNoPasso(chave, estado) {
  const e = estado || {};
  const faltas = [];
  if (chave === 'objetivo') {
    if (!texto(e.objetivo)) faltas.push('Escolha o que você quer que aconteça.');
    if (!texto(e.nome)) faltas.push('Dê um nome à campanha — é por ele que você vai achá-la depois.');
  }
  if (chave === 'orcamento') {
    const c = Number(e.orcamentoCentavos);
    if (!Number.isFinite(c) || c <= 0) faltas.push('Informe quanto pode ser gasto por dia.');
    else if (c < ORCAMENTO_MINIMO_CENTAVOS) {
      faltas.push(`A Meta não aceita menos de ${(ORCAMENTO_MINIMO_CENTAVOS / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} por dia.`);
    }
    // ORÇAMENTO TOTAL EXIGE DATA DE TÉRMINO. É a Meta que exige (`lifetime_budget`
    // sem `end_time` é recusado), e faz sentido: um valor total sem prazo não diz
    // em quanto tempo gastar. Pedir aqui evita a recusa lá.
    if (e.tipoOrcamento === 'total' && !texto(e.terminaEm)) {
      faltas.push('Escolha até quando a campanha vai rodar — orçamento total precisa de uma data de término.');
    }
  }
  if (chave === 'publico') {
    // Localização é a única coisa que a Meta EXIGE, e é a que barra o salvamento
    // no editor de público — a mesma regra, no mesmo lugar do fluxo.
    const p = e.publico || {};
    const temCidade = (p.cidades || []).length > 0;
    const temOutra = (p.outrasLocalizacoes || []).length > 0;
    if (!temCidade && !temOutra) faltas.push('Escolha pelo menos uma cidade ou região — a Meta exige um lugar.');
  }
  if (chave === 'anuncio') {
    if (!texto(e.imagemHash)) faltas.push('Escolha uma imagem, ou envie uma.');
    if (!texto(e.texto)) faltas.push('Escreva o texto que vai aparecer no anúncio.');
  }
  return faltas;
}

export const podeAvancar = (chave, estado) => faltaNoPasso(chave, estado).length === 0;

// O PRIMEIRO PASSO INCOMPLETO — para o assistente saber onde parar quando alguém
// pula direto para o fim, e para o botão final não prometer o que não pode.
export function primeiroPassoIncompleto(estado) {
  for (const p of PASSOS) if (!podeAvancar(p.chave, estado)) return p.chave;
  return null;
}

// A IMAGEM SERVE? — checagem no navegador, antes de subir.
//
// A Meta recusa imagem pequena, e descobrir isso depois de esperar o upload é o
// pior momento possível. `largura`/`altura` vêm do próprio navegador ao ler o
// arquivo; `bytes` do File. Tudo opcional: o que não se sabe não vira acusação.
export function imagemServe({ bytes, largura, altura } = {}) {
  const problemas = [];
  if (Number.isFinite(bytes) && bytes < TAMANHO_MINIMO_BYTES) {
    problemas.push('Esta imagem é pequena demais e a Meta recusa. Use uma maior.');
  }
  if (Number.isFinite(largura) && Number.isFinite(altura) && (largura < LADO_MINIMO_PX || altura < LADO_MINIMO_PX)) {
    problemas.push(`A imagem tem ${largura}×${altura}. A Meta pede pelo menos ${LADO_MINIMO_PX}×${LADO_MINIMO_PX}.`);
  }
  return { ok: problemas.length === 0, problemas };
}

const reais = (c) => (Number(c) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

// A DATA DO CAMPO ("2026-08-31") vira o FIM daquele dia, não o começo.
// Quem escolhe 31 quer que rode o dia 31 inteiro; mandar 00:00 encerraria a
// campanha antes de o dia começar. Sem fuso escrito à mão: a Meta interpreta na
// zona da conta de anúncios, que é a mesma de quem está olhando a tela.
export function horarioDeTermino(data) {
  const d = String(data || '').trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(d) ? `${d}T23:59:59` : '';
}

// O QUE VAI SER CRIADO, em português, para a confirmação.
//
// A janela de confirmar é a última chance de perceber que se está criando a
// coisa errada — então ela lista tudo, e diz que nasce pausado. Prometer "criar
// campanha" sem dizer que ela não vai rodar seria esconder a melhor parte.
export function resumoDoQueVaiSerCriado(estado, objetivoRotulo) {
  const e = estado || {};
  const p = e.publico || {};
  const linhas = [
    `Campanha "${texto(e.nome)}" — ${objetivoRotulo || texto(e.objetivo)}`,
    `1 conjunto com ${reais(e.orcamentoCentavos)} por dia`,
  ];
  const cidades = (p.cidades || []).map((c) => c.nome || c.key).filter(Boolean);
  if (cidades.length) linhas.push(`Em ${cidades.join(', ')}`);
  if (p.idadeMin != null && p.idadeMax != null) linhas.push(`Idade ${p.idadeMin}–${p.idadeMax}`);
  const interesses = (p.interesses || []).map((i) => i.name).filter(Boolean);
  if (interesses.length) linhas.push(`Interesses: ${interesses.join(', ')}`);
  linhas.push('1 anúncio com a imagem escolhida');
  return linhas;
}

// OS PAYLOADS PRONTOS PARA A META. Delega no montador compartilhado — este
// arquivo só junta o estado do formulário com a linha do objetivo.
//
// `nome` do formulário SOBRESCREVE o nome automático: quem digitou um nome quer
// aquele nome. O do montador é o padrão da Fábrica, bom para lote e ruim para
// campanha feita à mão.
export function payloadsDoAssistente({ estado, objetivoRow, marca, loja }) {
  const e = estado || {};
  if (!objetivoRow || !marca || !loja) return null;
  // OS NOMES DOS CAMPOS SÃO OS DE `orcamento.mjs`, e não é detalhe: a primeira
  // versão mandava `tipo:'lifetime'` e `valorCentavos`, e `normalizarOrcamento`
  // — que só conhece `'total'` e `valor` — caía no padrão silenciosamente.
  // Resultado: quem escolhesse "Total R$ 500" criava um conjunto de R$ 500 POR
  // DIA. Nenhum erro, nenhum aviso, e a diferença aparecia na fatura.
  const orcamento = {
    modo: 'ABO',
    tipo: e.tipoOrcamento === 'total' ? 'total' : 'diario',
    valor: Number(e.orcamentoCentavos),
    ...(e.tipoOrcamento === 'total' && texto(e.terminaEm) ? { fim: horarioDeTermino(e.terminaEm) } : {}),
  };
  const { campaign, adset } = payloadCampanhaAdset(
    objetivoRow, marca, loja,
    { DAILY_BUDGET: Number(e.orcamentoCentavos), DATA: '' },
    e.publico ? publicoParaFabrica(e.publico, loja) : null,
    orcamento,
  );
  if (texto(e.nome)) {
    campaign.name = texto(e.nome).slice(0, 200);
    adset.name = `${texto(e.nome)} · conjunto`.slice(0, 200);
  }
  return { campaign, adset };
}

// O EDITOR DE PÚBLICO e a FÁBRICA falam formas diferentes do mesmo público: o
// editor guarda `cidades:[{key,raio,unidade}]`, a Fábrica espera
// `geo:{cities:[{key,radius,distance_unit}]}`. Traduzir aqui é o preço de reusar
// o `montarTargeting` que já está provado, e é melhor que manter dois.
export function publicoParaFabrica(pub, loja) {
  const p = pub || {};
  return {
    geo: {
      cities: (p.cidades || []).filter((c) => c && c.key != null).map((c) => ({
        key: String(c.key),
        ...(Number(c.raio) > 0 ? { radius: Number(c.raio), distance_unit: c.unidade === 'mile' ? 'mile' : 'kilometer' } : {}),
      })),
      excluded: (p.excluidas || []).filter((x) => x && x.key != null).map((x) => ({ key: String(x.key), type: x.tipo === 'regiao' ? 'region' : 'city' })),
    },
    idade_min: p.idadeMin,
    idade_max: p.idadeMax,
    generos: p.generos || [],
    interesses: (p.interesses || []).filter((i) => i && i.id).map((i) => ({ id: String(i.id), name: i.name })),
    custom_audiences: (p.incluir || []).filter((a) => a && a.id).map((a) => ({ id: String(a.id) })),
    _loja: loja,
  };
}
