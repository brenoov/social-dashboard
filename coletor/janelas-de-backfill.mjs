// A JANELA DE DATAS de cada recorte de campaign_insights.
//
// Cada recorte é gravado por um código diferente, com uma conta de datas
// diferente. O backfill tem de fazer a MESMA pergunta que quem gravou a linha
// fez — senão o número novo não bate com o gasto que já está na mesma linha, e
// duas colunas vizinhas passam a falar de períodos diferentes.
//
// Lido no código em 17/08/2026, não deduzido:
//   0            → coletarAdsDia: time_range {since: dia, until: dia}
//                  (e coletarAdsPorCampanha com dias=0 dá a MESMA janela)
//   1, 7, 14, 30 → coletarAdsPorCampanha: until = hoje, since = hoje − dias
//                  (repare: cobre N+1 dias; o backfill COPIA o jeito, não conserta)
//   99           → O COLETOR PYTHON LEGADO, não a Edge Function:
//                  projetos/central-inteligencia/redes-sociais/coletor/coletar.py
//                  linha 369  dias_mtd = max(date.today().day - 1, 0)
//                  linha 394  coletar_ads_por_campanha(..., dias_mtd, hoje, store_as=99)
//                  e a janela sai em coletar.py:251-252 (since = hoje − dias_mtd,
//                  until = hoje) — ou seja, do 1º do mês até o dia. Confere.
//                  (Um comentário anterior citava recuperar-curtidas-zeradas.mjs:
//                  aquele arquivo grava engagement_snapshots e NUNCA
//                  campaign_insights. A janela calculada estava certa, a fonte
//                  citada não. Corrigido em 17/08/2026.)
//                  Repare de passagem: o Python pede
//                  `fields=campaign_id,spend,impressions,clicks,reach` — SEM
//                  `actions`. É por isso que o recorte 99 não tem uma única linha
//                  preenchida, e é por isso que ele só se preenche por aqui.
// PURO: sem rede, sem banco.

const RECORTES_DE_N_DIAS = [1, 7, 14, 30];

// Âncora ao MEIO-DIA de propósito: assim nem horário de verão nem fuso empurram
// a data para o dia anterior/seguinte na hora de formatar. É a mesma conta do
// coletor (supabase/functions/coletar-dados/index.ts:420).
function menosDias(dia, n) {
  const d = new Date(dia + 'T12:00:00');
  d.setDate(d.getDate() - n);
  return d.toLocaleDateString('en-CA');
}

export function janelaDoRecorte(capturedAt, periodDays) {
  if (!capturedAt) return null;
  if (periodDays === 0) return { since: capturedAt, until: capturedAt };
  if (RECORTES_DE_N_DIAS.includes(periodDays)) return { since: menosDias(capturedAt, periodDays), until: capturedAt };
  if (periodDays === 99) return { since: capturedAt.slice(0, 7) + '-01', until: capturedAt };
  return null; // recorte que ninguém grava hoje: não inventa janela
}

// Uma chamada à Meta cobre TODAS as campanhas de uma conta numa janela. Então o
// alvo é conta + data + recorte, e não a linha (que é por campanha).
// Do mais antigo para o mais novo: se a Meta interromper no meio, o que sobra é o
// pedaço recente, que a própria rodada seguinte do coletor cobre.
export function alvosPendentes(linhas) {
  const vistos = new Set();
  const alvos = [];
  for (const l of (linhas || [])) {
    if (!janelaDoRecorte(l.captured_at, l.period_days)) continue;
    const chave = `${l.account_id}|${l.captured_at}|${l.period_days}`;
    if (vistos.has(chave)) continue;
    vistos.add(chave);
    alvos.push({ account_id: l.account_id, captured_at: l.captured_at, period_days: l.period_days });
  }
  return alvos.sort((a, b) => (a.captured_at < b.captured_at ? -1 : a.captured_at > b.captured_at ? 1 : 0));
}

// ------------------------------------------------------------- as bandeiras

export const PAUSA_PADRAO = 2000;
// Piso. Pausa zero é exatamente o que martelou a Meta em 07/07/2026 e derrubou o
// painel ao vivo por horas. Um valor menor que isto é engano de digitação, não
// intenção — então o piso vence em silêncio, e o script avisa que venceu.
export const PAUSA_MINIMA = 250;

// Por que um interpretador em vez de process.argv.includes(): `includes` é
// comparação exata, então `--dry-run` — a grafia que quase todo mundo tenta
// primeiro — passava batido e o script começava a gravação de verdade, 2.179
// chamadas, sem perguntar nada. Aqui bandeira que não existe RECUSA a execução.
// PURO: só lê o array que recebe.
export function interpretarArgumentos(argv) {
  let dry = false;
  let pausaPedida = null;

  for (let i = 0; i < (argv || []).length; i++) {
    const arg = argv[i];
    if (arg === '--dry' || arg === '--dry-run') { dry = true; continue; }

    let bruto;
    if (arg === '--pausa') bruto = argv[++i];
    else if (typeof arg === 'string' && arg.startsWith('--pausa=')) bruto = arg.slice('--pausa='.length);
    else return { erro: `não reconheço "${arg}". Só existem --dry (ou --dry-run) e --pausa <ms>.` };

    const texto = String(bruto ?? '').trim();
    const n = parseInt(texto, 10);
    // Recusa "3000ms", "abc" e o --pausa solto no fim. Cair no padrão em silêncio
    // faria o script correr num ritmo que ninguém pediu.
    if (!Number.isFinite(n) || String(n) !== texto) {
      return { erro: `--pausa precisa de um número em milissegundos; veio "${texto}".` };
    }
    pausaPedida = n;
  }

  const pausa = pausaPedida === null ? PAUSA_PADRAO : Math.max(pausaPedida, PAUSA_MINIMA);
  return { dry, pausa, pausaPedida, erro: null };
}

// --------------------------------------------- a resposta pela metade da Meta

// A Meta já respondeu 200 estruturalmente válido com o detalhe faltando neste
// projeto — é a história inteira em
// supabase/functions/_shared/leitura-de-engajamento.js.
//
// No coletor isso se conserta sozinho: ele regrava a MESMA linha a cada passada.
// Aqui não. Este script grava cada linha UMA vez, e o filtro `conversas=is.null`
// — que existe para proteger — tranca a linha contra qualquer conserto depois.
// Meia resposta gravada aqui é dano PERMANENTE.
//
// Então o critério é conservador: se a Meta devolveu campanhas mas NENHUMA delas
// traz o array `actions`, a resposta não serve e o alvo fica nulo. Ficar nulo é
// "não sei", que é a verdade e é consertável. Gravar zero não é nem uma coisa
// nem outra.
//
// `actions: []` (lista vazia, presente) SERVE: a Meta olhou e não havia ação.
// Diferente de `actions` ausente, que é a Meta não tendo respondido aquilo.
export function respostaTemAcoes(itens) {
  return Array.isArray(itens) && itens.some((i) => Array.isArray(i?.actions));
}
