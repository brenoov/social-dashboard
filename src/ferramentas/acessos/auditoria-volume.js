// Lógica pura da AUDITORIA: classificar o VOLUME de acesso de uma pessoa ao
// OneDrive, pra a tela dar destaque visual a quem acumulou acesso a MUITAS
// pastas (é um sinal de que talvez tenha permissão demais). Sem DOM, sem banco —
// só transforma um número no "nível" que a tela pinta, pra ser testável em node.

// A partir de quantas pastas do OneDrive uma pessoa é considerada "muitas".
// 10 é o corte: acima disso o acesso deixa de ser pontual e vira um caso pra olhar.
export const LIMITE_MUITAS_PASTAS = 10

// Recebe a quantidade de pastas (número) e devolve o nível de destaque.
//   nenhuma  -> zero pastas (sem acesso registrado)
//   algumas  -> tem acesso, mas dentro do normal
//   muitas   -> acumulou acesso a muitas pastas (destaque de atenção)
// Número inválido/negativo é tratado como zero — nunca quebra, nunca inventa.
export function volumeDeAcesso(n) {
  const q = Number.isFinite(n) ? Math.max(0, Math.trunc(n)) : 0
  if (q >= LIMITE_MUITAS_PASTAS) return { nivel: 'muitas', muitas: true, quantidade: q }
  if (q > 0) return { nivel: 'algumas', muitas: false, quantidade: q }
  return { nivel: 'nenhuma', muitas: false, quantidade: q }
}
