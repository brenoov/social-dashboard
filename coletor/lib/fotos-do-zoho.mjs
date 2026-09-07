// AS FOTOS QUE MORAM NO ZOHO WORKDRIVE — a segunda fonte, nunca a primeira.
//
// ⚠️ O BLING E O PADRAO, e isto e regra do dono (07/09/2026). O Zoho so entra
// quando o produto NAO TEM FOTO NO CADASTRO do Bling. Quem inverte a ordem faz
// a foto do certificado divergir da foto da loja — e a cliente compara.
//
// ⚠️ E O CASAMENTO E POR SKU EXATO, nunca por nome parecido. As pastas la tem
// nomes como `Ravelle_Pequena_Jeans - SS0001SB.S1`: umas trazem o SKU, outras
// so o modelo. Adivinhar pelo modelo poria a foto de OUTRA bolsa num
// certificado de autenticidade — o erro que destroi exatamente a coisa que o
// selo existe para provar, e que ninguem percebe ate uma cliente reclamar.
// Pasta sem SKU no nome fica de fora, e o robo diz qual e.

/** Todo SKU do catalogo tem esta forma: SS0001SB.S1 */
const FORMA_DO_SKU = /SS\d{4}[A-Z]{2}\.[A-Z]\d/i;

export function skuDaPasta(nome) {
  const m = String(nome ?? '').toUpperCase().match(FORMA_DO_SKU);
  return m ? m[0] : null;
}

/**
 * Acha a pasta daquele SKU. Devolve `null` quando nao ha — e nao a "mais
 * parecida", que e como se poe foto errada num certificado.
 */
export function pastaDoSku(pastas, sku) {
  const alvo = String(sku ?? '').toUpperCase().trim();
  if (!FORMA_DO_SKU.test(alvo)) return null;
  const iguais = (pastas || []).filter((p) => skuDaPasta(p?.nome) === alvo);
  // DUAS PASTAS COM O MESMO SKU e ambiguidade, e ambiguidade aqui vira foto
  // errada. Melhor nao trazer nenhuma e deixar o robo avisar.
  return iguais.length === 1 ? iguais[0] : null;
}

// ⚠️ O DESENHO A MAO, ASSINADO PELA RAISSA, NAO PODE IR PARA O CERTIFICADO.
// Pedido explicito do dono. Ele e reconhecivel e o padrao se repete: as FOTOS
// se chamam `Modelo_Cor_Angulo.png` (com sublinhado), e o desenho e sempre o
// arquivo SOLTO, em maiusculas, sem sublinhado nenhum — `LINEAR.jpeg`,
// `CERNE.jpeg`, `SOLENNE.jpeg`. Conferido em cinco pastas diferentes em
// 07/09/2026, e o desenho estava em todas.
//
// A regra e por SUBLINHADO, e nao por extensao: `.jpeg` tambem aparece em foto
// em outras pastas, e mudar a extensao do desenho o traria de volta.
export function ehDesenhoAMao(nomeDoArquivo) {
  const base = String(nomeDoArquivo ?? '').replace(/\.[^.]+$/, '');
  if (!base.trim()) return true;
  if (!base.includes('_')) return true;
  // Cinto e suspensorio: se um dia alguem nomear o desenho com sublinhado.
  return /desenho|croqui|sketch|assinad|raissa/i.test(base);
}

const EXTENSAO_DE_IMAGEM = /\.(png|jpe?g|webp)$/i;

/**
 * As fotos aproveitaveis de uma pasta, em ordem estavel.
 * `Frente` primeiro: e a que a cliente ve como capa do certificado.
 */
export function fotosDaPasta(arquivos) {
  const vale = (arquivos || [])
    .filter((a) => a && !a.ehPasta)
    .filter((a) => EXTENSAO_DE_IMAGEM.test(a.nome || ''))
    .filter((a) => !ehDesenhoAMao(a.nome));

  const peso = (nome) => {
    const n = String(nome).toLowerCase();
    if (n.includes('frente')) return 0;
    if (n.includes('lateraliz')) return 1;
    if (n.includes('lado')) return 2;
    if (n.includes('costas')) return 3;
    if (n.includes('inter')) return 4;
    if (n.includes('alca') || n.includes('alça')) return 5;
    return 6;
  };
  // Ordem estavel: pelo peso, e empate resolvido pelo nome — assim duas
  // execucoes seguidas produzem a MESMA ordem, e a foto 1 nao troca sozinha.
  return vale.sort((a, b) => peso(a.nome) - peso(b.nome) || String(a.nome).localeCompare(b.nome));
}
