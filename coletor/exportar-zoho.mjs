// coletor/exportar-zoho.mjs
// Exporta os criativos FINAIS de uma campanha pro Zoho WorkDrive (nuvem), organizados por
// LOJA -> DATA_campanha -> SKU. Estáticos (.png) + o vídeo do 16:9 (.mp4). Roteia a loja pelo
// depósito (itens do job) x fabrica_lojas. Best-effort: o chamador (runner) usa try/catch.
import { zohoAtivo, acharOuCriarPasta, uploadArquivo } from './lib/zoho-workdrive.mjs';

// id da pasta "01. Varejo" no WorkDrive (achado via API; override por env se mudar de lugar)
const VAREJO_ID = process.env.ZOHO_VAREJO_ID || '42v21ca3d85243f4c4cb4866ec9d036c008b7';
// nome da loja (fabrica_lojas) -> nome da pasta de canal no WorkDrive (match por trecho)
const MAP_PASTA = [['Tivoli', '01. Tivoli'], ['Dom Pedro', '02. Dom Pedro'], ['Iguatemi', '03. Iguatemi Campinas'], ['Sorocaba', '04. Sorocaba'], ['Ribeir', '05. Ribeirão Preto']];
const pastaLojaNome = (nomeLoja) => { for (const [k, v] of MAP_PASTA) if ((nomeLoja || '').includes(k)) return v; return null; };
const sane = (s) => String(s || '').replace(/[\/\\:*?"<>|]+/g, '-').trim();

export async function exportarCampanhaZoho({ campanhaId, sbGet, log = console.log }) {
  if (!zohoAtivo()) { log('  zoho: sem ZOHO_* (secrets) — export pro WorkDrive pulado'); return { ok: 0, pulados: 0 }; }
  const [camp] = await sbGet(`/fabrica_campanhas?id=eq.${campanhaId}&select=job_id,nome,created_at`);
  if (!camp) return { ok: 0, pulados: 0 };
  const jobs = await sbGet(`/fabrica_jobs?params->>campanhaId=eq.${campanhaId}&select=params&order=created_at&limit=1`);
  const itens = jobs[0]?.params?.itens || [];
  const skuDep = Object.fromEntries(itens.map((it) => [String(it.sku).toUpperCase(), it.deposito]));
  const lojas = await sbGet('/fabrica_lojas?select=deposito_id,nome');
  const depNome = Object.fromEntries((lojas || []).map((l) => [l.deposito_id, l.nome]));
  const data = (camp.created_at || '').slice(0, 10);
  const pastaData = `${data}_${sane(camp.nome).slice(0, 44) || campanhaId.slice(0, 8)}`;
  const cr = await sbGet(`/fabrica_criativos?campanha_id=eq.${campanhaId}&select=sku,variante,formato,url&arquetipo=eq.produto`);

  let ok = 0, pulados = 0;
  for (const c of cr) {
    const nomeLoja = depNome[skuDep[String(c.sku).toUpperCase()]];
    const canal = pastaLojaNome(nomeLoja);
    if (!canal) { pulados++; continue; } // loja sem pasta de canal (ex.: atacado) -> pula
    try {
      const lojaId = await acharOuCriarPasta(VAREJO_ID, canal);
      const dataId = await acharOuCriarPasta(lojaId, pastaData);
      const skuId = await acharOuCriarPasta(dataId, sane(c.sku));
      const png = Buffer.from(await (await fetch(c.url)).arrayBuffer());
      await uploadArquivo(skuId, `${c.variante}-${c.formato}.png`, png, 'image/png');
      ok++;
      if (c.formato === '1920x1080') { // widescreen -> sobe o mp4 (motion) junto
        const rr = await fetch(c.url.replace(/\.png$/, '.mp4'));
        if (rr.ok) { await uploadArquivo(skuId, `${c.variante}-${c.formato}.mp4`, Buffer.from(await rr.arrayBuffer()), 'video/mp4'); ok++; }
      }
    } catch (e) { log('  zoho ' + c.sku + ' ' + c.variante + ' ' + c.formato + ' FALHOU: ' + e.message); }
  }
  log(`  zoho: ${ok} arquivos no WorkDrive (${pulados} sem pasta de loja) -> 01. Varejo/<loja>/${pastaData}`);
  return { ok, pulados };
}
