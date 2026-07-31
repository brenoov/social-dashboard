// QUEM RECEBE CADA TIPO DE NOTIFICAÇÃO.
//
// Até 2026-07-29 todo push ia pra TODAS as inscrições, sem distinção. Na prática
// isso significava que três pessoas — Breno, Erick e Humberto — recebiam tudo,
// inclusive avisos que não são da alçada delas: o "Vessel está sem saldo" chegou
// nos três.
//
// Agora cada usuário tem uma preferência POR TIPO, e o admin liga e desliga na
// tela de Usuários.
//
// PURO: sem rede. A Edge busca as inscrições e as preferências e passa pra cá.

// Os tipos que existem. Adicionar um aqui é o que o faz aparecer na tela de
// permissões — a tela lê esta lista, não uma cópia dela.
export const TIPOS_DE_NOTIFICACAO = [
  {
    chave: 'vendas',
    rotulo: 'Vendas do dia',
    descricao: 'Fechamento às 22h e recapitulação às 7h, com o faturamento por canal.',
    padrao: true,
  },
  {
    chave: 'saldo',
    rotulo: 'Saldo das contas de anúncios',
    descricao: 'Aviso pela manhã quando o saldo de alguma conta está acabando ou já acabou.',
    // Só quem cuida de tráfego precisa disso; ligar pra todo mundo por padrão
    // repetiria o problema que esta tabela existe pra resolver.
    padrao: false,
  },
  {
    chave: 'conteudo',
    rotulo: 'Hora de publicar',
    descricao: 'No horário agendado de cada post, com a arte e a legenda prontas para copiar.',
    // DESLIGADO por padrão, decisão do dono (2026-07-31). Só recebe quem ligar
    // em Administração › Usuários.
    //
    // O efeito prático é bom: o robô da hora H pode ficar ativo desde já sem
    // tocar o celular de ninguém que não pediu. Quem cuida do conteúdo liga o
    // próprio aviso; quem não cuida nunca é incomodado — que é exatamente o
    // problema que a tabela push_preferencias existe para resolver.
    padrao: false,
  },
];

export function ehTipoValido(tipo) {
  return TIPOS_DE_NOTIFICACAO.some((t) => t.chave === tipo);
}

export function padraoDoTipo(tipo) {
  const t = TIPOS_DE_NOTIFICACAO.find((x) => x.chave === tipo);
  return t ? t.padrao : false;
}

// A preferência de um usuário para um tipo. SEM linha salva vale o padrão do
// tipo — assim ligar uma notificação nova não exige mexer em cada usuário, e
// desligar uma que é padrão continua sendo uma escolha explícita e gravada.
export function querReceber(preferencias, userId, tipo) {
  if (!ehTipoValido(tipo)) return false;
  const achou = (preferencias || []).find(
    (p) => p && String(p.user_id) === String(userId) && p.tipo === tipo,
  );
  return achou ? achou.ativo === true : padraoDoTipo(tipo);
}

// Filtra as inscrições push que devem receber ESTE tipo.
//
// Inscrição sem `user_id` fica de fora: não dá pra saber de quem é, e mandar
// "por via das dúvidas" é o comportamento antigo que se está corrigindo. Melhor
// um aparelho a menos que um aviso na mão de quem não deveria vê-lo.
export function inscricoesDoTipo(inscricoes, preferencias, tipo) {
  if (!ehTipoValido(tipo)) return [];
  return (inscricoes || []).filter(
    (s) => s && s.user_id && querReceber(preferencias, s.user_id, tipo),
  );
}
