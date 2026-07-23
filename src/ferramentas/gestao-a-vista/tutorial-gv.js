// Passos do tour interativo (coach-marks) da Gestão à Vista — reusa o mesmo
// componente da Fábrica (../meta-ads/tour-coachmark.vue). Cada passo aponta pra um
// elemento com data-tour="<chave>"; o tour é resiliente e pula alvo que não estiver
// na tela. Linguagem simples, pra quem nunca mexeu (o Breno vê essa tela).
export const TOUR_GV = [
  { selector: '[data-tour="gv-periodo"]', titulo: 'Escolha o período', texto: 'Hoje, 7 dias, 30 dias, o mês… O botão AUTO fica trocando de período sozinho — ótimo pra deixar numa TV.' },
  { selector: '[data-tour="gv-canal"]', titulo: 'Filtre por canal', texto: 'Veja só um canal de venda ou vários ao mesmo tempo. Marque quantos quiser; sem nada marcado, aparecem todos.' },
  { selector: '[data-tour="gv-geral"]', titulo: 'Venda geral', texto: 'O velocímetro mostra quanto já vendeu no período, comparado com a meta.' },
  { selector: '[data-tour="gv-kpis"]', titulo: 'Números do período', texto: 'Vendido hoje, projeção do mês, quantos pedidos e o ticket médio — cada um com a variação em relação ao período anterior.' },
  { selector: '[data-tour="gv-canais"]', titulo: 'Venda por canal', texto: 'Um velocímetro por canal, do que mais vendeu pro que menos vendeu. Toque em "Ver mais" pra abrir todos.' },
  { selector: '[data-tour="gv-rankings"]', titulo: 'Rankings', texto: 'Quem mais vendeu no período — por canal e por vendedor.' },
  { selector: '[data-tour="gv-estoque"]', titulo: 'Novo: Estoque por canal', texto: 'Clique aqui pra ver o estoque de cada depósito. Dá pra buscar por SKU, filtrar por várias categorias e por status (baixo/crítico). Matéria-prima fica escondida automaticamente.' },
];
