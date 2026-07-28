// As quatro interações que uma campanha de engajamento pode estar COMPRANDO, e
// quanto custa cada uma.
//
// Por que existe: medido nas campanhas reais do dono (90 dias), curtida custa
// R$ 0,12 e salvamento custa R$ 48 — 400 vezes mais. O ponto ponderado é 83%
// curtida em volume, então ordenar por custo por ponto é ordenar por "quem
// comprou mais curtida". Declarada a interação, a campanha passa a ser medida no
// mercado dela. PURO: sem rede, sem tela.
export const INTERACOES = {
  curtidas: {
    rotulo: 'Curtida', rotuloCusto: 'Custo por curtida',
    ajuda: 'A mais barata e a mais abundante. Serve para alcance e prova social.',
  },
  comentarios: {
    rotulo: 'Comentário', rotuloCusto: 'Custo por comentário',
    ajuda: 'Cara e rara: quem comenta parou para escrever alguma coisa.',
  },
  salvamentos: {
    rotulo: 'Salvamento', rotuloCusto: 'Custo por salvamento',
    ajuda: 'Quem salva pretende voltar naquilo depois. É intenção guardada.',
  },
  compartilhamentos: {
    rotulo: 'Compartilhamento', rotuloCusto: 'Custo por compartilhamento',
    ajuda: 'Quem compartilha leva sua marca para a rede dele.',
  },
};

export function interacaoValida(chave) {
  return !!chave && Object.prototype.hasOwnProperty.call(INTERACOES, chave);
}

// Custo = tudo que se gastou ÷ quantidade daquela interação. Atribuir o gasto
// INTEIRO a uma interação só faz sentido porque o dono DECLAROU que é ela que
// aquela campanha está comprando — é a mesma lógica de custo por lead.
//
// "Gasto ausente" (chave nem veio) é DIFERENTE de "gasto zero" (veio e vale 0):
// ausente = não sei quanto custou → null (nunca inventar "R$ 0,00"); zero =
// sei que custou zero de verdade (veio de graça) → 0. Na prática o gasto quase
// sempre vem preenchido por quantidadesDoInsight; o caso "ausente" só aparece
// se alguém chamar esta função direto, fora do fluxo normal.
export function custoDaInteracao(quantidades, chave) {
  if (!interacaoValida(chave)) return null;
  const q = quantidades || {};
  const n = Number(q[chave]);
  if (!Number.isFinite(n) || n <= 0) return null;   // zero não é R$ 0,00, é sem-dados
  const gasto = Number(q.gasto);
  return Number.isFinite(gasto) ? gasto / n : null;
}
