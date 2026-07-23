// Gerador de senha forte pro reset de senha (superadmin). Puro/testável.
// Alfabeto sem caracteres ambíguos (0/O, 1/l/I) pra facilitar ditar/copiar.
const ALFABETO = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%&*';

export function gerarSenhaForte(len = 14) {
  const n = Math.max(6, len | 0);
  const arr = new Uint32Array(n);
  crypto.getRandomValues(arr);
  let s = '';
  for (let i = 0; i < n; i++) s += ALFABETO[arr[i] % ALFABETO.length];
  return s;
}
