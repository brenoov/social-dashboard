/* Transformar um telefone digitado à mão num link de WhatsApp.
 *
 * Parece bobo e não é: o número chega de todo jeito — "(19) 99164-9471",
 * "19971649471", "+55 19 3033-9837", "3033-9837" sem DDD. E o link do WhatsApp
 * exige o formato internacional colado, sem nada além de dígitos.
 *
 * Errar aqui não dá erro na tela: abre uma conversa com OUTRA PESSOA. É por
 * isso que esta lógica mora separada e tem teste — e por isso ela prefere
 * devolver nulo a chutar. */

// Só o Brasil por enquanto: a empresa é toda daqui. Número que já venha com
// outro código de país é respeitado.
const BRASIL = '55';

/** Fixo do estado de São Paulo e região — usado só para reconhecer o formato. */
const DDDS_VALIDOS = /^[1-9][1-9]$/;

/**
 * Devolve só os dígitos no formato que o WhatsApp aceita, ou null.
 *
 * Regras, nesta ordem:
 *  - tira tudo que não é dígito;
 *  - se começa com 0 (o "0" de operadora), descarta o zero;
 *  - 10 ou 11 dígitos = número nacional com DDD → prefixa 55;
 *  - 12 ou 13 dígitos começando com 55 = já internacional → mantém;
 *  - 8 ou 9 dígitos = SEM DDD → devolve null, porque adivinhar o DDD é
 *    exatamente o erro que abre conversa com estranho;
 *  - qualquer outro tamanho → null.
 */
export function numeroParaWhatsapp(bruto) {
  if (bruto === null || bruto === undefined) return null;
  let d = String(bruto).replace(/\D/g, '');
  if (!d) return null;

  // "0" de operadora na frente (0 19 99164...) — ou o 0800, que não é celular.
  if (d.startsWith('0800')) return null;
  while (d.startsWith('0')) d = d.slice(1);
  if (!d) return null;

  if (d.length === 8 || d.length === 9) return null;          // falta o DDD

  if (d.length === 10 || d.length === 11) {
    if (!DDDS_VALIDOS.test(d.slice(0, 2))) return null;
    return BRASIL + d;
  }
  if ((d.length === 12 || d.length === 13) && d.startsWith(BRASIL)) {
    if (!DDDS_VALIDOS.test(d.slice(2, 4))) return null;
    return d;
  }
  // Outro país: aceita se o tamanho é plausível e não parece lixo.
  if (d.length >= 11 && d.length <= 15) return d;
  return null;
}

/** O link para abrir a conversa. Null quando o número não serve. */
export function linkDoWhatsapp(bruto, mensagem) {
  const n = numeroParaWhatsapp(bruto);
  if (!n) return null;
  const base = `https://wa.me/${n}`;
  return mensagem ? `${base}?text=${encodeURIComponent(mensagem)}` : base;
}

/** O número do jeito que se lê: (19) 99164-9471. */
export function telefoneLegivel(bruto) {
  const n = numeroParaWhatsapp(bruto);
  if (!n) return String(bruto || '').trim() || '—';
  if (!n.startsWith(BRASIL)) return '+' + n;
  const nac = n.slice(2);
  const ddd = nac.slice(0, 2);
  const resto = nac.slice(2);
  if (resto.length === 9) return `(${ddd}) ${resto.slice(0, 5)}-${resto.slice(5)}`;
  if (resto.length === 8) return `(${ddd}) ${resto.slice(0, 4)}-${resto.slice(4)}`;
  return '+' + n;
}

/** Por que este número não vira link — pra tela poder explicar em vez de sumir. */
export function porQueNaoDaLink(bruto) {
  const t = String(bruto ?? '').trim();
  if (!t) return 'Sem telefone cadastrado.';
  const d = t.replace(/\D/g, '');
  if (!d) return 'Esse contato não tem número nenhum.';
  if (d.replace(/^0+/, '').length === 8 || d.replace(/^0+/, '').length === 9) {
    return 'Falta o DDD. Sem ele não dá pra abrir o WhatsApp — dois estados têm o mesmo número.';
  }
  if (d.startsWith('0800')) return 'Número 0800 não tem WhatsApp.';
  return 'Não reconheci esse número. Confira se está completo, com DDD.';
}
