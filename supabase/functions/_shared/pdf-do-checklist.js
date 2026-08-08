/* O PAPEL DA FICHA ASSINADA — o PDF que vai pro Zoho (D23).
 *
 * Desenho: docs/superpowers/specs/2026-08-06-frota-checklist-assinatura-design.md
 *
 * O QUE ESTE ARQUIVO É: lógica pura, sem rede e sem banco. Recebe a ficha já
 * lida e devolve (a) as linhas do documento e (b) os bytes do PDF. Quem busca
 * os dados e quem sobe pro Zoho é o robô da fila — separado de propósito, pra
 * que o conteúdo do documento possa ser conferido por teste sem depender de
 * uma empresa de fora estar no ar.
 *
 * POR QUE UM GERADOR DE PDF ESCRITO À MÃO, e não uma biblioteca: o documento é
 * texto em uma coluna, e é isso. Toda biblioteca de PDF que renderiza layout
 * pesa megabytes e entra no tempo de partida de uma Edge Function que roda de
 * poucos em poucos minutos. O formato usado aqui (Type1 Helvetica/Courier, uma
 * página por vez, sem imagem) é a parte mais antiga e mais estável do PDF —
 * abre em qualquer leitor desde 1994.
 *
 * A REGRA QUE MANDA NESTE ARQUIVO: o papel não pode discordar do sistema.
 * O instante da assinatura sai de `instanteCanonico` — a MESMA função que
 * entrou na impressão digital. Os textos dos itens saem das RESPOSTAS
 * gravadas (congeladas, D13), nunca da lista de itens de hoje: se o gestor
 * renomear um item amanhã, a ficha de hoje tem de continuar dizendo o que foi
 * realmente perguntado hoje. */

import { instanteCanonico, tempoDePreenchimento } from './assinatura.js';

/* ── Formatação de números, datas e horas ─────────────────────────────────── */

// `feita_em` é DATE. Vem como texto 'AAAA-MM-DD' e é partido como texto —
// nunca por `new Date()`, que interpretaria em UTC e mostraria o dia anterior
// pra quem está em Brasília.
export function dataPorExtenso(texto) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(texto ?? ''));
  return m ? `${m[3]}/${m[2]}/${m[1]}` : String(texto ?? '');
}

/**
 * O instante, no fuso de quem lê o papel (Brasília, UTC-3 o ano inteiro — o
 * Brasil não tem mais horário de verão).
 *
 * NUNCA usa `toLocaleString`: o fuso de uma Edge Function é UTC, e o de quem
 * gerar isso na máquina de casa é outro. O papel tem de sair igual dos dois.
 */
export function horaDeBrasilia(iso) {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  const d = new Date(t - 3 * 3600 * 1000);
  const p2 = (n) => String(n).padStart(2, '0');
  return `${p2(d.getUTCDate())}/${p2(d.getUTCMonth() + 1)}/${d.getUTCFullYear()} `
    + `às ${p2(d.getUTCHours())}:${p2(d.getUTCMinutes())}:${p2(d.getUTCSeconds())}`;
}

// 123456 -> "123.456". Feito à mão pra não depender de locale instalado.
const comPonto = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.');

export function tempoPorExtenso(segundos) {
  if (segundos === null || segundos === undefined) return null;
  if (segundos < 0) return null;             // relógio torto: não inventa duração
  if (segundos < 60) return `${segundos} segundos`;
  const min = Math.floor(segundos / 60), s = segundos % 60;
  return s === 0 ? `${min} minutos` : `${min} minutos e ${s} segundos`;
}

const ROTULO_RESULTADO = {
  liberado: 'Liberado', com_ressalvas: 'Com ressalvas', nao_liberado: 'Não liberado',
};
const ROTULO_ESTADO = { ok: 'OK', nao_ok: 'PROBLEMA', na: 'Não se aplica' };
const ROTULO_CADENCIA = { diario: 'diário', semanal: 'semanal', mensal: 'mensal' };
const ROTULO_SEM_ASSINATURA = {
  sem_login: 'quem conferiu não tem login próprio no aplicativo',
};

/* ── O conteúdo do documento ──────────────────────────────────────────────── */

/**
 * As linhas do papel, na ordem em que saem.
 *
 * Cada linha é `{ estilo, texto }`. Os estilos existem pra hierarquia visual e
 * são traduzidos em fonte/tamanho lá embaixo, em `montarPdf`.
 *
 * `donoNome` é de quem é o carro; `assinanteNome` é quem assinou. Os dois
 * podem ser pessoas DIFERENTES de quem preencheu (D21b: quem administra
 * preenche a ficha de qualquer carro e assina com a própria senha), e é
 * justamente por isso que o papel traz os dois: registrar só um deles deixaria
 * o documento sugerindo que o dono do carro foi quem olhou.
 *
 * Nada aqui é inventado: campo que não veio sai como "não informado", nunca
 * como um nome plausível ou um traço mudo.
 */
export function linhasDoChecklist({ ficha, respostas, veiculo, donoNome, assinanteNome }) {
  const f = ficha || {};
  const v = veiculo || {};
  const itens = Array.isArray(respostas) ? respostas : [];
  const L = [];
  const put = (estilo, texto) => L.push({ estilo, texto });

  put('titulo', 'Checklist de primeiro escalão — Frota');
  put('fraco', 'Documento gerado pela Central de Inteligência RBV a partir da ficha assinada. '
    + 'O conteúdo abaixo é o que foi gravado no dia, e não pode mais ser alterado.');
  put('vazio', '');

  put('secao', 'O carro e o dia');
  put('texto', `Carro: ${v.nome || 'não informado'}`);
  put('texto', `Placa: ${v.placa || 'não informada'}`);
  put('texto', `Data da conferência: ${dataPorExtenso(f.feita_em)}`);
  const cadencias = (f.cadencias || []).map((c) => ROTULO_CADENCIA[c] || c);
  put('texto', `Tipo de conferência: ${cadencias.length ? cadencias.join(', ') : 'não informado'}`);
  put('texto', f.hodometro
    ? `Hodômetro: ${comPonto(f.hodometro)} km`
    : 'Hodômetro: não informado');
  if (f.hodometro_justificativa) {
    put('texto', `Por que o hodômetro contraria o anterior: ${f.hodometro_justificativa}`);
  }
  put('texto', `Resultado: ${ROTULO_RESULTADO[f.resultado] || f.resultado || 'não informado'}`);
  if (f.anomalias) put('texto', `Anomalias registradas: ${f.anomalias}`);
  put('vazio', '');

  put('secao', `O que foi conferido (${itens.length} ${itens.length === 1 ? 'item' : 'itens'})`);
  if (itens.length === 0) {
    // Ficha sem resposta nenhuma é anormal e o papel DIZ isso, em vez de sair
    // com uma seção vazia que parece defeito de impressão.
    put('texto', 'Esta ficha foi gravada sem nenhum item respondido. '
      + 'Avise quem administra a Frota.');
  }
  for (const r of itens) {
    put('texto', `${ROTULO_ESTADO[r.estado] || r.estado} — ${r.item_texto}`);
    if (r.observacao) put('fraco', `      observação: ${r.observacao}`);
  }
  put('vazio', '');

  put('secao', 'Quem respondeu por esta ficha');
  put('texto', `Conferiu e preencheu: ${f.pessoa_nome || 'não informado'}`);
  put('texto', `Carro de: ${donoNome || 'não informado'}`);
  put('vazio', '');

  put('secao', 'A assinatura');
  if (f.assinada_em) {
    put('texto', `Assinada por: ${assinanteNome || 'não informado'}`);
    // OS DOIS FORMATOS, DE PROPÓSITO. O de cima é pra pessoa ler; o de baixo é
    // o instante EXATO que entrou na impressão digital. Mostrar só o legível
    // faria o papel parecer discordar do sistema pra quem for recalcular.
    put('texto', `Assinada em: ${horaDeBrasilia(f.assinada_em)} (horário de Brasília)`);
    put('fraco', `Instante exato registrado pelo servidor: ${instanteCanonico(f.assinada_em)}`);

    const { segundos } = tempoDePreenchimento(f.aberta_em, f.assinada_em);
    const tempo = tempoPorExtenso(segundos);
    put('texto', tempo
      ? `Tempo de preenchimento: ${tempo}`
      // Não escreve zero: zero significaria "instantâneo", que é uma acusação
      // contra quem talvez nem tenha como ter o dado (ficha sem login nasce
      // sem `aberta_em`).
      : 'Tempo de preenchimento: não registrado nesta ficha');
  } else {
    put('texto', 'Esta ficha NÃO foi assinada.');
    const motivo = ROTULO_SEM_ASSINATURA[f.sem_assinatura_motivo] || f.sem_assinatura_motivo;
    put('texto', motivo
      ? `Motivo: ${motivo}.`
      : 'Motivo não registrado.');
    put('fraco', 'A conferência do carro foi feita e vale; o que falta é a prova de quem a fez.');
  }
  put('vazio', '');

  put('secao', 'Os códigos de conferência');
  put('fraco', 'Estes códigos são calculados a partir de TUDO o que está escrito acima. '
    + 'Mudar qualquer letra desta ficha no sistema muda o código — e o código da ficha seguinte '
    + 'deste mesmo carro deixa de encaixar. É assim que uma alteração feita depois não tem como '
    + 'passar despercebida.');
  put('texto', 'Código desta ficha:');
  put('codigo', f.assinatura_hash || '(a ficha não foi assinada — não há código)');
  put('texto', 'Código da ficha anterior deste carro:');
  put('codigo', f.assinatura_hash_anterior
    || (f.assinada_em
      ? '(não há: esta é a primeira ficha assinada deste carro)'
      : '(a ficha não foi assinada — não há código)'));

  return L;
}

/* ── Onde o arquivo mora no Zoho ──────────────────────────────────────────── */

// Barra, dois-pontos e companhia quebram nome de pasta e de arquivo em
// qualquer nuvem. Trocados por hífen — nunca apagados, senão "A/B" e "AB"
// viravam a mesma pasta.
const semCaractereProibido = (s) => String(s ?? '')
  .replace(/[\\/:*?"<>|]/g, '-')
  .replace(/\s+/g, ' ')
  .trim();

/**
 * As pastas, de fora pra dentro, DENTRO da pasta "Gestão de Serviços" do Zoho:
 * `Frota / <carro> / <AAAA-MM>`.
 *
 * O carro leva a PLACA junto do nome porque dois carros podem ter o mesmo nome
 * de modelo ("FORD FIESTA SEDAN") — e duas pastas com o mesmo nome fariam as
 * fichas de dois veículos se misturarem sem ninguém notar.
 */
export function pastasDoArquivo({ ficha, veiculo }) {
  const v = veiculo || {};
  const carro = semCaractereProibido(
    v.placa ? `${v.nome || 'Carro sem nome'} (${v.placa})` : (v.nome || 'Carro sem nome'));
  // O mês sai do TEXTO da data (AAAA-MM-DD), não de um objeto Date: converter
  // pra data e voltar poderia jogar o dia 1º pro mês anterior por causa de fuso.
  const mes = /^(\d{4})-(\d{2})/.exec(String(ficha?.feita_em ?? ''));
  return ['Frota', carro, mes ? `${mes[1]}-${mes[2]}` : 'sem-data'];
}

/**
 * O nome do arquivo. Leva a data e a placa pra ser único dentro da pasta do
 * mês, e legível pra quem procura o papel de um dia específico.
 */
export function nomeDoArquivo({ ficha, veiculo }) {
  const placa = semCaractereProibido(veiculo?.placa || 'sem-placa');
  const dia = /^\d{4}-\d{2}-\d{2}$/.test(String(ficha?.feita_em ?? ''))
    ? ficha.feita_em : 'sem-data';
  return `checklist-${dia}-${placa}.pdf`;
}

/* ── Os bytes do PDF ──────────────────────────────────────────────────────── */

// A4 em pontos (1 pt = 1/72 pol). Margem de 56 pt ≈ 2 cm.
const LARGURA = 595, ALTURA = 842, MARGEM = 56;
const UTIL = LARGURA - 2 * MARGEM;

// fonte: F1 Helvetica, F2 Helvetica-Bold, F3 Courier (pros códigos).
const ESTILOS = {
  titulo: { fonte: 'F2', tamanho: 15, antes: 0, depois: 10 },
  secao: { fonte: 'F2', tamanho: 11, antes: 6, depois: 4 },
  texto: { fonte: 'F1', tamanho: 10, antes: 0, depois: 3 },
  fraco: { fonte: 'F1', tamanho: 8.5, antes: 0, depois: 3 },
  codigo: { fonte: 'F3', tamanho: 8.5, antes: 0, depois: 5 },
  vazio: { fonte: 'F1', tamanho: 10, antes: 0, depois: 6 },
};

// Largura média de caractere, em fração do tamanho da fonte. Helvetica em
// texto corrido fica perto de 0,50; o valor aqui é FOLGADO de propósito
// (0,54) porque errar pra mais só quebra a linha um pouco antes, enquanto
// errar pra menos deixa texto passando da margem — e texto cortado é o
// defeito que o padrão da central proíbe por escrito.
const LARGURA_MEDIA = { F1: 0.54, F2: 0.56, F3: 0.60 };

// Quebra o texto em linhas que cabem na largura útil. Palavra maior que a
// linha inteira (um código de 64 letras, um caminho de pasta) é PARTIDA em vez
// de vazar pra fora da folha.
function quebrar(texto, estilo) {
  const { fonte, tamanho } = ESTILOS[estilo] || ESTILOS.texto;
  const cabem = Math.max(8, Math.floor(UTIL / (tamanho * LARGURA_MEDIA[fonte])));
  const palavras = String(texto ?? '').split(/\s+/).filter(Boolean);
  if (palavras.length === 0) return [''];
  const linhas = [];
  let atual = '';
  for (let p of palavras) {
    while (p.length > cabem) {
      if (atual) { linhas.push(atual); atual = ''; }
      linhas.push(p.slice(0, cabem));
      p = p.slice(cabem);
    }
    if (!atual) atual = p;
    else if ((atual + ' ' + p).length <= cabem) atual += ' ' + p;
    else { linhas.push(atual); atual = p; }
  }
  if (atual) linhas.push(atual);
  return linhas;
}

// PDF guarda texto em bytes, não em Unicode. WinAnsiEncoding cobre todo o
// português (é o Latin-1 com uns símbolos a mais entre 0x80 e 0x9F). O que
// não couber vira "?" — visível, nunca um byte inválido que estraga o arquivo
// inteiro e impede de abrir o documento.
const WINANSI_EXTRA = {
  '€': 0x80, '‚': 0x82, 'ƒ': 0x83, '„': 0x84, '…': 0x85,
  '†': 0x86, '‡': 0x87, 'ˆ': 0x88, '‰': 0x89, 'Š': 0x8A,
  '‹': 0x8B, 'Œ': 0x8C, 'Ž': 0x8E, '‘': 0x91, '’': 0x92,
  '“': 0x93, '”': 0x94, '•': 0x95, '–': 0x96, '—': 0x97,
  '˜': 0x98, '™': 0x99, 'š': 0x9A, '›': 0x9B, 'œ': 0x9C,
  'ž': 0x9E, 'Ÿ': 0x9F,
};

/** O texto virado em bytes de string PDF, já com os escapes de `(`, `)` e `\`. */
export function bytesDeTexto(texto) {
  const out = [];
  for (const ch of String(texto ?? '')) {
    let b;
    const cp = ch.codePointAt(0);
    if (WINANSI_EXTRA[ch] !== undefined) b = WINANSI_EXTRA[ch];
    else if (cp >= 0x20 && cp <= 0x7e) b = cp;
    else if (cp >= 0xa0 && cp <= 0xff) b = cp;
    else b = 0x3f; // "?"
    if (b === 0x28 || b === 0x29 || b === 0x5c) out.push(0x5c); // ( ) \
    out.push(b);
  }
  return out;
}

/**
 * As linhas viram bytes de PDF. Devolve `Uint8Array`.
 *
 * Uma coluna, quantas páginas precisar. Sem imagem, sem fonte embutida —
 * Helvetica e Courier são as fontes que todo leitor de PDF já tem.
 */
export function montarPdf(linhas) {
  // 1) Distribui as linhas em páginas, medindo a altura conforme desce.
  const paginas = [];
  let atual = [];
  let y = ALTURA - MARGEM;
  for (const l of (linhas || [])) {
    const est = ESTILOS[l.estilo] || ESTILOS.texto;
    const pedacos = l.estilo === 'vazio' ? [''] : quebrar(l.texto, l.estilo);
    for (const pedaco of pedacos) {
      const alturaLinha = est.tamanho * 1.25;
      if (y - (est.antes + alturaLinha) < MARGEM) {
        paginas.push(atual); atual = []; y = ALTURA - MARGEM;
      }
      y -= est.antes + alturaLinha;
      if (pedaco !== '') atual.push({ x: MARGEM, y, fonte: est.fonte, tamanho: est.tamanho, texto: pedaco });
      y -= est.depois;
    }
  }
  paginas.push(atual);

  // 2) Cada página vira um fluxo de desenho.
  const fluxos = paginas.map((itens) => {
    const bytes = [];
    const escrever = (s) => { for (const c of s) bytes.push(c.charCodeAt(0)); };
    escrever('BT\n');
    for (const it of itens) {
      escrever(`/${it.fonte} ${it.tamanho} Tf\n1 0 0 1 ${it.x} ${it.y.toFixed(2)} Tm\n(`);
      bytes.push(...bytesDeTexto(it.texto));
      escrever(') Tj\n');
    }
    escrever('ET\n');
    return bytes;
  });

  // 3) Os objetos do arquivo. 1 catálogo, 2 páginas, 3-5 fontes, e depois um
  //    par (página, fluxo) por página.
  const objetos = [];
  const idPagina = (i) => 6 + i * 2;
  const idFluxo = (i) => 7 + i * 2;

  objetos.push(bytesDe('<< /Type /Catalog /Pages 2 0 R >>'));
  objetos.push(bytesDe(`<< /Type /Pages /Kids [${paginas.map((_, i) => `${idPagina(i)} 0 R`).join(' ')}] `
    + `/Count ${paginas.length} >>`));
  objetos.push(bytesDe('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>'));
  objetos.push(bytesDe('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>'));
  objetos.push(bytesDe('<< /Type /Font /Subtype /Type1 /BaseFont /Courier /Encoding /WinAnsiEncoding >>'));
  paginas.forEach((_, i) => {
    objetos.push(bytesDe(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${LARGURA} ${ALTURA}] `
      + `/Resources << /Font << /F1 3 0 R /F2 4 0 R /F3 5 0 R >> >> /Contents ${idFluxo(i)} 0 R >>`));
    const fluxo = fluxos[i];
    objetos.push([...bytesDe(`<< /Length ${fluxo.length} >>\nstream\n`), ...fluxo,
      ...bytesDe('\nendstream')]);
  });

  // 4) Monta o arquivo e a tabela de posições (xref). Os deslocamentos têm de
  //    bater byte a byte, senão o leitor recusa o arquivo — por isso tudo aqui
  //    é contado em BYTES, nunca em caracteres.
  const saida = [];
  const empurrar = (b) => { for (const x of b) saida.push(x); };
  empurrar(bytesDe('%PDF-1.4\n'));
  // Comentário com bytes altos: convenção do formato pra avisar que o arquivo
  // é binário, e evita que um programa de transferência o trate como texto.
  empurrar([0x25, 0xe2, 0xe3, 0xcf, 0xd3, 0x0a]);

  const posicoes = [];
  objetos.forEach((corpo, i) => {
    posicoes.push(saida.length);
    empurrar(bytesDe(`${i + 1} 0 obj\n`));
    empurrar(corpo);
    empurrar(bytesDe('\nendobj\n'));
  });

  const inicioXref = saida.length;
  empurrar(bytesDe(`xref\n0 ${objetos.length + 1}\n0000000000 65535 f \n`));
  for (const p of posicoes) empurrar(bytesDe(`${String(p).padStart(10, '0')} 00000 n \n`));
  empurrar(bytesDe(`trailer\n<< /Size ${objetos.length + 1} /Root 1 0 R >>\nstartxref\n${inicioXref}\n%%EOF\n`));

  return new Uint8Array(saida);
}

// Texto ASCII do próprio formato (nomes de objeto, números) em bytes.
function bytesDe(s) {
  const out = [];
  for (let i = 0; i < s.length; i++) out.push(s.charCodeAt(i) & 0xff);
  return out;
}

/** O atalho que o robô usa: da ficha direto pros bytes. */
export function pdfDoChecklist(dados) {
  return montarPdf(linhasDoChecklist(dados));
}
