// Esta campanha está RODANDO agora?
//
// A pergunta parece boba e não é: `effective_status === 'ACTIVE'` NÃO significa
// que a campanha está no ar. Significa que ninguém a pausou na mão. Campanha que
// chegou ao fim do período programado continua ACTIVE na Meta para sempre —
// medido em 29/07 nas contas reais:
//
//   Raíssa   "Post do Instagram: Vamos Brasillll"   parou 05/07   ACTIVE
//   Raíssa   "Post do Instagram: 8 aninhos do Snow" parou 05/07   ACTIVE
//   Breno    "Resultado sem equilíbrio"             parou 01/06   ACTIVE
//
// Todas com o anúncio ainda ACTIVE dentro. Quem responde de verdade é o
// `stop_time`, e é por isso que ele não pode ser esquecido: sugerir mexer no
// orçamento de uma campanha encerrada é pedir uma decisão que não muda nada, e
// gastar análise em cima dela é gastar à toa.
//
// Vive num módulo próprio porque a TELA e o ROBÔ precisam da mesma resposta. O
// robô já tinha essa regra, a fila não — e foi a fila que mostrou a "Vamos
// Brasillll" pedindo mudança de orçamento quase um mês depois de terminar.
// PURO: o `agora` entra por parâmetro, senão não dá pra testar data.

// Campanha "em veiculação real": ACTIVE e (sem stop_time OU stop_time no
// futuro). Sem `agora`, usa o relógio — quem testa passa o valor.
export function emVeiculacao(campanha, agoraMs) {
  if (!campanha) return false;
  const status = String(campanha.effective_status || campanha.status || '').toUpperCase();
  if (status !== 'ACTIVE') return false;
  if (!campanha.stop_time) return true;
  const t = Date.parse(campanha.stop_time);
  // Data ilegível não pode encerrar a campanha por engano: na dúvida ela segue
  // valendo, e o pior caso é uma sugestão a mais — não uma campanha viva sumindo
  // da tela sem explicação.
  return Number.isNaN(t) ? true : t > (agoraMs ?? Date.now());
}

// Por que ela NÃO está rodando — texto curto pra tela poder dizer, em vez de só
// sumir com a campanha.
export function motivoDeNaoVeicular(campanha, agoraMs) {
  if (!campanha) return 'campanha não encontrada';
  const status = String(campanha.effective_status || campanha.status || '').toUpperCase();
  if (status !== 'ACTIVE') {
    if (status === 'PAUSED') return 'campanha pausada';
    if (status === 'ARCHIVED' || status === 'DELETED') return 'campanha arquivada';
    return 'campanha fora do ar';
  }
  const t = campanha.stop_time ? Date.parse(campanha.stop_time) : NaN;
  if (!Number.isNaN(t) && t <= (agoraMs ?? Date.now())) return 'campanha já terminou';
  return null;
}
