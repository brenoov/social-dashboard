// supabase/functions/enviar-pdf-checklist/index.ts
//
// O ROBÔ DA FILA: pega as fichas de checklist já assinadas, monta o PDF e
// arquiva na pasta do Zoho WorkDrive.
// Desenho: docs/superpowers/specs/2026-08-06-frota-checklist-assinatura-design.md (D23)
//
// A REGRA QUE MANDA AQUI: **a assinatura nunca esperou por isto.** Quando este
// robô roda, a ficha já está assinada, gravada e válida no banco. Tudo o que
// pode dar errado daqui pra frente atrasa um PAPEL — não invalida uma prova, e
// não aparece pra quem dirige. Por isso toda falha é gravada em português na
// própria fila (`ultimo_erro`), dizendo o que fazer, e a linha volta pra fila.
//
// ONDE O PAPEL VAI PARAR:
//   <pasta "Gestão de Serviços"> / Frota / <carro (placa)> / <AAAA-MM>
//
// A PASTA É ACHADA PELO NOME, NUNCA POR UM ID ESCRITO AQUI. O id existe e está
// em `acessos_recursos` desde a importação de 17/07/2026, mas veio de UMA
// importação: se alguém recriar a pasta, o id muda e um id fixo continuaria
// apontando, calado, pro lugar errado. Mandar ~150 PDFs por mês pra pasta
// errada é pior do que não mandar nenhum, porque ninguém percebe.
//
// ⚠️ O QUE AINDA NÃO FOI PROVADO CONTRA A API DE VERDADE, dito com todas as
// letras pra ninguém confiar no que não foi medido:
//   - listar o conteúdo de uma pasta comum: GET /files/<id>/files
//   - criar pasta:                          POST /files
//   - subir arquivo:                        POST /upload
// Os três estão na documentação do WorkDrive, e a conexão TEM os escopos
// (WorkDrive.files.ALL + WorkDrive.teamfolders.ALL, gravados em
// acessos_conexoes). Mas o que já foi chamado de verdade nesta conta (e está
// anotado em acessos-proxy/index.ts) é só a parte de LEITURA de pastas de
// equipe. Na primeira execução real, conferir a resposta de cada um dos três.
// O último uso bem-sucedido do Zoho nesta central foi 17/07/2026 — o token de
// atualização pode ter caducado desde então, e isso aparece aqui como erro
// normal da fila, com a frase que manda reconectar em Acessos.

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { exigirSegredoDeCron } from '../_shared/segredo-de-cron.ts';
import { acharPasta } from '../_shared/pasta-do-zoho.js';
import { nomeDoArquivo, pastasDoArquivo, pdfDoChecklist } from '../_shared/pdf-do-checklist.js';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// O nome que se procura no WorkDrive. Fica aqui, e não no banco, porque é uma
// decisão do dono ("arquive dentro de Gestão de Serviços") e mudar de pasta é
// mudança de desenho, não configuração de tela. O prefixo numérico ("01. ") e
// os acentos são tolerados por `acharPasta` — o número é ordenação, não nome.
const PASTA_DESTINO = 'Gestão de Serviços';

// Quantas fichas por rodada. O robô roda de poucos em poucos minutos e o volume
// é de ~150 por mês: 20 é folga larga, e mantém a rodada curta o bastante pra
// não esbarrar no tempo máximo da Edge Function.
const POR_RODADA = 20;

// Depois disto a linha para de tentar e vira 'falhou', pra aparecer na tela em
// vez de ficar batendo na mesma pedra pra sempre. 8 tentativas a cada 10
// minutos = mais de uma hora de insistência antes de desistir.
const TENTATIVAS_ATE_DESISTIR = 8;

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } });

/* ── Zoho: token e chamadas ao WorkDrive ──────────────────────────────────────
   CÓPIA DELIBERADA do que já existe em `acessos-proxy/index.ts`, e não um
   import: aquele arquivo é o `index.ts` de OUTRA função, e uma função não
   importa o index de outra. Mover os trechos para `_shared` obrigaria a
   republicar o `acessos-proxy`, que está no ar e funcionando — republicar uma
   função que ninguém pediu pra mexer, só pra evitar vinte linhas repetidas, é
   trocar risco real por elegância. Se um dia o acessos-proxy for republicado
   por outro motivo, é a hora de juntar os dois.

   O que veio de lá, verificado contra a API em 2026-07-17/18:
   - o endereço base do WorkDrive;
   - `Accept: application/vnd.api+json` é OBRIGATÓRIO (sem ele o Zoho responde vazio);
   - a autorização é `Zoho-oauthtoken <token>`;
   - o token de acesso se pede na hora, a partir do refresh_token guardado. */
const WD_BASE = 'https://www.zohoapis.com/workdrive/api/v1';

function sufixoDoDataCenter(cru: unknown): string {
  let dc = (typeof cru === 'string' ? cru : '').trim();
  if (!dc) return '.com';
  if (!dc.startsWith('.')) dc = '.' + dc;
  return dc;
}

async function tokenDeAcesso(conexao: any): Promise<string> {
  const dc = sufixoDoDataCenter(conexao.data_center);
  const corpo = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: conexao.client_id,
    client_secret: conexao.client_secret,
    refresh_token: conexao.refresh_token,
  });
  const resp = await fetch(`https://accounts.zoho${dc}/oauth/v2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: corpo,
  });
  const j: any = await resp.json().catch(() => ({}));
  if (!resp.ok || !j?.access_token) {
    // A frase diz o que FAZER. O motivo mais provável, três semanas depois do
    // último uso, é a autorização do Zoho ter caducado.
    throw new Error('O Zoho recusou a conexão da central (o acesso guardado não vale mais). '
      + 'Abra Acessos → Zoho e clique em conectar de novo; o envio dos PDFs volta sozinho '
      + 'na próxima rodada.');
  }
  return j.access_token as string;
}

async function wdGet(access: string, caminho: string) {
  const resp = await fetch(WD_BASE + caminho, {
    headers: { Authorization: `Zoho-oauthtoken ${access}`, Accept: 'application/vnd.api+json' },
  });
  const cru = await resp.text();
  let corpo: any = null;
  try { corpo = JSON.parse(cru); } catch { corpo = null; }
  return { ok: resp.ok, status: resp.status, corpo, cru };
}

async function wdPost(access: string, caminho: string, corpo: unknown) {
  const resp = await fetch(WD_BASE + caminho, {
    method: 'POST',
    headers: {
      Authorization: `Zoho-oauthtoken ${access}`,
      Accept: 'application/vnd.api+json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(corpo),
  });
  const cru = await resp.text();
  let json: any = null;
  try { json = JSON.parse(cru); } catch { json = null; }
  return { ok: resp.ok, status: resp.status, corpo: json, cru };
}

/**
 * A pasta `nome` dentro de `paiId` — acha se já existe, cria se não existe.
 *
 * ACHAR ANTES DE CRIAR não é economia: sem isso, cada ficha criaria uma pasta
 * nova com o mesmo nome (o WorkDrive permite), e em um mês a pasta do carro
 * teria vinte e duas pastas "2026-08" com um papel dentro de cada.
 */
async function garantirPasta(access: string, paiId: string, nome: string): Promise<string> {
  // O conteúdo vem paginado. 500 filhas por pasta é muito mais do que estas
  // pastas terão (uma por carro, uma por mês) e ainda assim o laço tem fim:
  // laço sem fim numa Edge Function trava a rodada inteira.
  for (let pagina = 0; pagina < 5; pagina++) {
    const r = await wdGet(access,
      `/files/${encodeURIComponent(paiId)}/files?page%5Blimit%5D=100&page%5Boffset%5D=${pagina * 100}`);
    if (!r.ok) {
      // Não achar o conteúdo NÃO autoriza criar às cegas: se a listagem falhou
      // por rede, criar geraria a pasta repetida que o parágrafo acima explica.
      throw new Error(`Não consegui ler o que existe dentro da pasta do Zoho (código ${r.status}) `
        + `para achar ou criar "${nome}". Isso costuma ser instabilidade do Zoho — a próxima `
        + 'rodada tenta de novo sozinha.');
    }
    const filhas: any[] = Array.isArray(r.corpo?.data) ? r.corpo.data : [];
    for (const f of filhas) {
      const a = f?.attributes ?? {};
      const ehPasta = a.is_folder === true || a.type === 'folder' || a.resource_type === 'folder';
      if (ehPasta && String(a.name ?? '').trim() === nome) return String(f.id ?? a.resource_id);
    }
    if (filhas.length < 100) break;
  }

  const criada = await wdPost(access, '/files', {
    data: { attributes: { name: nome, parent_id: paiId }, type: 'files' },
  });
  if (!criada.ok) {
    throw new Error(`Não consegui criar a pasta "${nome}" no Zoho (código ${criada.status}). `
      + 'Confira em Acessos se a conexão do Zoho ainda tem permissão de escrita no WorkDrive; '
      + 'a próxima rodada tenta de novo sozinha.');
  }
  const nova = Array.isArray(criada.corpo?.data) ? criada.corpo.data[0] : criada.corpo?.data;
  const id = nova?.id ?? nova?.attributes?.resource_id ?? null;
  if (!id) {
    throw new Error(`O Zoho aceitou criar a pasta "${nome}" mas não disse qual é o identificador `
      + 'dela, então não dá pra guardar o papel lá dentro com segurança. Avise quem cuida da '
      + 'integração do Zoho.');
  }
  return String(id);
}

/** Sobe o PDF. Devolve o identificador do arquivo no Zoho, ou nulo se ele não disser qual é. */
async function subirArquivo(
  access: string, pastaId: string, nome: string, bytes: Uint8Array,
): Promise<string | null> {
  const formulario = new FormData();
  formulario.append('content', new Blob([bytes], { type: 'application/pdf' }), nome);
  // `override-name-exist=false`: se o papel já estiver lá (uma rodada anterior
  // subiu e caiu antes de marcar como enviado), o Zoho guarda como versão nova
  // em vez de apagar o que já existe. Documento de conferência não se sobrescreve.
  const url = `${WD_BASE}/upload?filename=${encodeURIComponent(nome)}`
    + `&parent_id=${encodeURIComponent(pastaId)}&override-name-exist=false`;
  const resp = await fetch(url, {
    method: 'POST',
    // Sem `Content-Type` de propósito: quem monta a fronteira do multipart é o
    // próprio `fetch` a partir do FormData. Escrever à mão quebra o envio.
    headers: { Authorization: `Zoho-oauthtoken ${access}`, Accept: 'application/vnd.api+json' },
    body: formulario,
  });
  const cru = await resp.text();
  if (!resp.ok) {
    throw new Error(`O Zoho recusou o arquivo "${nome}" (código ${resp.status}). `
      + 'A próxima rodada tenta de novo sozinha; se continuar, confira em Acessos se a conexão '
      + 'do Zoho ainda tem permissão de escrita no WorkDrive.');
  }
  let corpo: any = null;
  try { corpo = JSON.parse(cru); } catch { corpo = null; }
  const primeiro = Array.isArray(corpo?.data) ? corpo.data[0] : corpo?.data;
  const a = primeiro?.attributes ?? {};
  // O formato da resposta do upload varia conforme a versão da API. O arquivo
  // JÁ SUBIU (o código foi 2xx) — não achar o identificador não pode desfazer
  // isso nem fazer o robô mandar o mesmo papel de novo na rodada seguinte.
  return String(
    primeiro?.id ?? a.resource_id ?? a.ResourceId ?? a?.Permalink ?? '',
  ) || null;
}

/* ── A rodada ─────────────────────────────────────────────────────────────── */

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const negado = await exigirSegredoDeCron(req, 'enviar-pdf-checklist');
  if (negado) return negado;

  const sb = createClient(SUPABASE_URL, SERVICE_KEY);

  // Marca a linha de volta pra fila (ou como desistida) com a frase que quem
  // administra vai ler. Nunca deixa a linha presa em 'enviando'.
  const devolverPraFila = async (linha: any, frase: string) => {
    const desistiu = linha.tentativas_ate_agora >= TENTATIVAS_ATE_DESISTIR;
    await sb.from('frota_checklist_pdf')
      .update({
        situacao: desistiu ? 'falhou' : 'na_fila',
        ultimo_erro: desistiu
          ? `${frase} (Parei de tentar depois de ${linha.tentativas_ate_agora} tentativas.)`
          : frase,
      })
      .eq('id', linha.id_da_fila);
  };

  const { data: fila, error: erroFila } = await sb.rpc('frota_pdf_pegar_da_fila', { p_limite: POR_RODADA });
  if (erroFila) {
    console.error('[enviar-pdf-checklist] não consegui ler a fila:', erroFila.message);
    return json({ erro: 'nao_consegui_ler_a_fila', detalhe: erroFila.message }, 500);
  }
  const linhas: any[] = fila ?? [];
  if (linhas.length === 0) return json({ pegos: 0, enviados: 0, falhas: 0 });

  // ── A conexão e a pasta: uma vez por rodada, não uma vez por ficha ────────
  const { data: conexao } = await sb
    .from('acessos_conexoes')
    .select('client_id, client_secret, refresh_token, data_center')
    .eq('provedor', 'zoho')
    .maybeSingle();

  if (!conexao?.refresh_token) {
    const frase = 'A central não está conectada ao Zoho. Abra Acessos → Zoho e clique em conectar; '
      + 'os PDFs que estão esperando sobem sozinhos na rodada seguinte.';
    for (const l of linhas) await devolverPraFila(l, frase);
    return json({ pegos: linhas.length, enviados: 0, falhas: linhas.length, motivo: 'sem_conexao_zoho' });
  }

  let access: string;
  try {
    access = await tokenDeAcesso(conexao);
  } catch (e) {
    const frase = e instanceof Error ? e.message : String(e);
    for (const l of linhas) await devolverPraFila(l, frase);
    return json({ pegos: linhas.length, enviados: 0, falhas: linhas.length, motivo: 'token_zoho' });
  }

  // A pasta de destino sai da lista que a própria central já mantém
  // (`acessos_recursos`), e é procurada PELO NOME — nunca por id fixo.
  const { data: pastas, error: erroPastas } = await sb
    .from('acessos_recursos')
    .select('nome, external_id, caminho')
    .eq('provedor', 'zoho').eq('tipo', 'workdrive')
    .is('arquivado_em', null);

  if (erroPastas) {
    const frase = 'Não consegui ler a lista de pastas do Zoho que a central conhece. '
      + 'A próxima rodada tenta de novo sozinha.';
    for (const l of linhas) await devolverPraFila(l, frase);
    return json({ pegos: linhas.length, enviados: 0, falhas: linhas.length, motivo: 'nao_li_as_pastas' });
  }

  const { pasta: destino, erro: erroDestino } = acharPasta(pastas ?? [], PASTA_DESTINO);
  if (!destino) {
    // NUNCA sobe pro primeiro lugar que encontrar. O erro diz QUAL nome foi
    // procurado e o que fazer — é a diferença entre um papel atrasado e 150
    // papéis por mês arquivados no lugar errado sem ninguém notar.
    for (const l of linhas) await devolverPraFila(l, erroDestino!);
    return json({ pegos: linhas.length, enviados: 0, falhas: linhas.length, motivo: 'pasta_nao_encontrada' });
  }

  // ── Uma ficha de cada vez ─────────────────────────────────────────────────
  let enviados = 0, falhas = 0;
  // Guarda o id de cada pasta já garantida nesta rodada. Sete carros no mesmo
  // mês pedem a mesma pasta "Frota" sete vezes; sem isto seriam sete listagens
  // idênticas na API do Zoho por rodada.
  const jaGarantidas = new Map<string, string>();

  for (const linha of linhas) {
    try {
      const { data: ficha, error: erroFicha } = await sb
        .from('frota_checklist')
        // `assinatura_rabisco` PRECISA estar aqui: é o desenho que a pessoa fez
        // com o dedo, e é ele que o papel imprime. Sem esta coluna na leitura, o
        // PDF sairia dizendo "assinada só com a senha" sobre uma ficha que TEM
        // rabisco — o documento discordando do sistema, que é o que este módulo
        // inteiro existe pra evitar.
        .select('id, veiculo_id, feita_em, pessoa_nome, hodometro, hodometro_justificativa, '
          + 'cadencias, resultado, anomalias, aberta_em, assinada_em, assinada_por, '
          + 'assinatura_hash, assinatura_hash_anterior, sem_assinatura_motivo, '
          + 'assinatura_rabisco, assinatura_versao')
        .eq('id', linha.id_da_ficha)
        .single();
      if (erroFicha || !ficha) throw new Error('Não consegui ler a ficha do checklist no banco.');

      const [{ data: respostas }, { data: veiculo }] = await Promise.all([
        sb.from('frota_checklist_respostas')
          .select('item_texto, estado, observacao, ordem')
          // A MESMA ORDEM que entrou na impressão digital (`ordem`, e `id` só
          // como desempate). Imprimir noutra ordem faria o papel discordar do
          // que foi assinado.
          .eq('checklist_id', ficha.id).order('ordem').order('id'),
        sb.from('frota_veiculos').select('nome, placa, pessoa_id').eq('id', ficha.veiculo_id).single(),
      ]);

      // Os nomes. Ausência vira "não informado" lá no papel — nunca um nome
      // plausível escolhido pelo robô.
      let donoNome: string | null = null;
      if (veiculo?.pessoa_id) {
        const { data: dono } = await sb.from('acessos_pessoas')
          .select('nome').eq('id', veiculo.pessoa_id).maybeSingle();
        donoNome = dono?.nome ?? null;
      }
      let assinanteNome: string | null = null;
      if (ficha.assinada_por) {
        const { data: perfil } = await sb.from('profiles')
          .select('name, email').eq('id', ficha.assinada_por).maybeSingle();
        assinanteNome = perfil?.name || perfil?.email || null;
      }

      const bytes = pdfDoChecklist({
        ficha, respostas: respostas ?? [], veiculo: veiculo ?? {}, donoNome, assinanteNome,
      });

      // Frota / <carro (placa)> / <AAAA-MM>, uma dentro da outra.
      let paiId = String(destino.external_id);
      let caminho = destino.nome;
      for (const nome of pastasDoArquivo({ ficha, veiculo: veiculo ?? {} })) {
        caminho += ` / ${nome}`;
        const guardada = jaGarantidas.get(caminho);
        paiId = guardada ?? await garantirPasta(access, paiId, nome);
        jaGarantidas.set(caminho, paiId);
      }

      const nome = nomeDoArquivo({ ficha, veiculo: veiculo ?? {} });
      const arquivoId = await subirArquivo(access, paiId, nome, bytes);

      await sb.from('frota_checklist_pdf').update({
        situacao: 'enviado',
        enviado_em: new Date().toISOString(),
        zoho_file_id: arquivoId,
        // O erro anterior é apagado no sucesso: deixar o texto de uma falha
        // velha ao lado de "enviado" faria quem lê achar que ainda há problema.
        // Quando o Zoho não devolve o identificador, isso fica dito — o papel
        // subiu, mas não dá pra apontar o link dele.
        ultimo_erro: arquivoId ? null
          : 'O arquivo subiu, mas o Zoho não informou o identificador dele. '
            + 'O papel está na pasta; só não há link direto guardado aqui.',
      }).eq('id', linha.id_da_fila);
      enviados++;
    } catch (e) {
      falhas++;
      const frase = e instanceof Error ? e.message : String(e);
      console.error('[enviar-pdf-checklist] ficha', linha.id_da_ficha, frase);
      await devolverPraFila(linha, frase);
    }
  }

  return json({ pegos: linhas.length, enviados, falhas, pasta: destino.nome });
});
