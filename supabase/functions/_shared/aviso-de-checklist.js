/* O TEXTO DO AVISO DO CHECKLIST.
 *
 * Puro, sem rede: a Edge busca os dados e passa pra cá.
 *
 * O texto diz o TAMANHO da tarefa porque é o que decide se a pessoa abre agora
 * ou deixa pra depois — e "depois" é como a tabela de uso ficou vazia. Nos dias
 * da conferência da semana ou do mês ele avisa por que hoje é mais longo: quem
 * recebe "15 itens" sem explicação acha que o app quebrou. */

export function montarAviso({ veiculo, itens, cadencias }) {
  const n = (itens || []).length;
  const quantos = n === 1 ? '1 item' : `${n} itens`;
  const c = cadencias || [];
  const extra = c.includes('mensal') ? ' Hoje tem a conferência do mês junto.'
    : c.includes('semanal') ? ' Hoje tem a conferência da semana junto.'
    : '';
  return {
    titulo: `Checklist do ${veiculo.nome}`,
    corpo: `${quantos} e o hodômetro.${extra}`,
  };
}
