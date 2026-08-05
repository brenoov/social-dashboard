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

// Data pura ("2028-08-04") sai como veio. Ja um instante do banco
// ("2026-08-05T01:33:18+00:00") vem em UTC: quem registrasse as 22h33 de
// quarta leria "quinta-feira". Entao o instante e convertido pro fuso de
// Sao Paulo ANTES de virar dia, mes e ano.
export function dataPorExtenso(iso) {
  const texto = String(iso);
  let ano, mes, dia;
  if (texto.includes('T')) {
    const d = new Date(texto);
    [ano, mes, dia] = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit',
    }).format(d).split('-');
  } else {
    [ano, mes, dia] = texto.slice(0, 10).split('-');
  }
  return `${Number(dia)} de ${MESES[Number(mes) - 1]} de ${ano}`;
}

export function whatsappLimpo(texto) {
  return String(texto || '').replace(/\D/g, '');
}

export function whatsappValido(texto) {
  const n = whatsappLimpo(texto).length;
  return n === 10 || n === 11;
}
