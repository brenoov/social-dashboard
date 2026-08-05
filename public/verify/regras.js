// Regras puras da pagina do certificado. Sem DOM, sem rede — por isso da pra testar.

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

// Tira espaco, hifen, ponto e sublinhado, e sobe pra maiuscula. NAO adivinha
// caractere: se a cliente digitar uma letra que nao existe no alfabeto do
// codigo, a busca nao acha e a pagina diz "nao conseguimos confirmar" — que e o
// certo. Melhor nao confirmar do que confirmar a peca errada.
export function normalizarCodigo(texto) {
  return String(texto || '').replace(/[\s.\-_]/g, '').toUpperCase();
}

export function pecaDaSerie(numero, total) {
  return `${String(numero).padStart(2, '0')} de ${total}`;
}

export function mesPorExtenso(iso) {
  const [ano, mes] = String(iso).split('-');
  return `${MESES[Number(mes) - 1]} de ${ano}`;
}

export function dataPorExtenso(iso) {
  const [ano, mes, dia] = String(iso).slice(0, 10).split('-');
  return `${Number(dia)} de ${MESES[Number(mes) - 1]} de ${ano}`;
}

export function whatsappLimpo(texto) {
  return String(texto || '').replace(/\D/g, '');
}

export function whatsappValido(texto) {
  const n = whatsappLimpo(texto).length;
  return n === 10 || n === 11;
}
