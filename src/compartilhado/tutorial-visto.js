// Memória de "já viu este tutorial" — compartilhada entre todas as
// ferramentas que têm um passeio guiado (hoje: Patrimônio e Frota).
//
// Por que isto virou um arquivo à parte e não ficou duplicado em cada
// `tutorial.js`: a REGRA é idêntica nas duas ferramentas (abre sozinho uma
// vez por pessoa, depois só quando ela pedir); só o PREFIXO da chave muda,
// pra cada ferramenta lembrar separado de quem já viu O SEU passeio — quem
// já fechou o tutorial da Frota ainda precisa ver o do Patrimônio, e
// vice-versa. Duas cópias da mesma lógica divergem com o tempo; uma só, com
// o prefixo por fora, não tem como divergir.
//
// A memória é POR PESSOA, não por navegador: sem o identificador na chave,
// quem entrasse num aparelho onde outra pessoa já tinha fechado o passeio
// nunca veria o tutorial — e é justamente quem chega depois que mais precisa
// dele.
function chaveDe(prefixo, usuarioId) {
  return prefixo + ':' + (usuarioId || 'anonimo')
}

// O passeio abre sozinho UMA vez, na primeira visita daquela pessoa àquela
// ferramenta. Depois disso, só quando ela pedir — tutorial que reaparece
// vira estorvo, e quem já sabe usar passa a fechar no reflexo, sem ler.
export function deveAbrirSozinho(armazem, usuarioId, prefixo) {
  // Sem lugar pra guardar (modo privado, armazém bloqueado), NÃO abre: abrir
  // sem conseguir lembrar significa abrir toda santa vez.
  if (!armazem || typeof armazem.getItem !== 'function') return false
  try { return !armazem.getItem(chaveDe(prefixo, usuarioId)) } catch (e) { return false }
}

export function marcarComoVisto(armazem, usuarioId, prefixo) {
  try { armazem?.setItem(chaveDe(prefixo, usuarioId), '1') } catch (e) { /* modo privado: só não guarda */ }
}
