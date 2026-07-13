// SP-6: conteúdo único do tutorial da Fábrica (checklist + coach-marks + tooltips "?").
export const CHECKLIST = [
  { id: 'criar', titulo: 'Crie uma campanha', texto: 'Escolha a loja, o objetivo, os produtos e o desconto. A ferramenta gera os criativos.', rota: 'fabrica-nova' },
  { id: 'curar', titulo: 'Escolha os melhores', texto: 'No passo Curar, marque os criativos que vão virar anúncio.', rota: 'fabrica-nova' },
  { id: 'publicar', titulo: 'Publique (pausado)', texto: 'No passo Subir, defina destino, localização e público. Tudo sobe PAUSADO — não gasta.', rota: 'fabrica-nova' },
  { id: 'conferir', titulo: 'Confira e ative', texto: 'No passo Conferir, revise os anúncios e ative com confirmação de gasto quando quiser.', rota: 'fabrica-nova' },
  { id: 'looks', titulo: 'Gerencie os looks', texto: 'Ligue/desligue os templates, reordene e gere as prévias na galeria de Looks.', rota: 'fabrica-looks' },
];

export const COACH = [
  { selector: '[data-tour="nova-campanha"]', titulo: 'Comece por aqui', texto: 'Clique em "Nova campanha" pra abrir o passo a passo: gerar → curar → subir → conferir.' },
  { selector: '[data-tour="numeros"]', titulo: 'Seu panorama', texto: 'Quantas campanhas estão em criação, quantos criativos já saíram e quantas foram publicadas.' },
  { selector: '[data-tour="em-criacao"]', titulo: 'Em criação', texto: 'As rodadas gerando ou prontas pra curar. Abra pra continuar de onde parou; apague se desistir.' },
  { selector: '[data-tour="publicadas"]', titulo: 'Publicadas recentes', texto: 'As campanhas que já foram pro Meta (pausadas). Abra no Gerenciador pra ativar.' },
  { selector: '[data-tour="looks-card"]', titulo: 'Looks & Templates', texto: 'A galeria dos modelos de criativo: ligue/desligue e veja as prévias.' },
];

export const AJUDA = {
  gerar: { titulo: 'Passo 1 · Gerar', itens: [
    { termo: 'Objetivo', texto: 'O que a campanha busca: conversas no WhatsApp (engajamento), vendas, reconhecimento de marca ou tráfego. Muda os criativos e a campanha no Meta.' },
    { termo: 'Fonte dos produtos', texto: 'De onde vêm os produtos: oportunidades da semana, garimpo, grade BCG, curva ABC ou busca manual.' },
    { termo: 'Desconto', texto: 'Use o desconto previsto do Gestor ou defina um % manual. No branding não há desconto.' },
    { termo: 'Curadoria', texto: 'Revise a lista, marque/desmarque os produtos antes de gerar.' },
  ] },
  curar: { titulo: 'Passo 2 · Curar', itens: [
    { termo: 'Escolher', texto: 'Toque nos criativos que vão virar anúncio — ficam com a borda âmbar.' },
    { termo: 'Ver inteiro', texto: 'Clique no criativo pra abrir em tamanho grande e decidir com calma.' },
  ] },
  subir: { titulo: 'Passo 3 · Subir', itens: [
    { termo: 'Destino', texto: 'Nova campanha por loja (a ferramenta cria) ou injetar numa campanha existente.' },
    { termo: 'Localização e público', texto: 'Cidades + raio, idade/gênero, interesses e públicos salvos. Começa pela geo da loja.' },
    { termo: 'Tudo pausado', texto: 'Os anúncios sobem PAUSADOS — ninguém vê e não gastam nada até você ativar.' },
  ] },
  conferir: { titulo: 'Passo 4 · Conferir', itens: [
    { termo: 'Revisar', texto: 'Veja quantos anúncios foram criados (pausados) antes de decidir.' },
    { termo: 'Ativar tudo', texto: 'Só ativa com uma confirmação de gasto. Enquanto não ativar, nada roda.' },
  ] },
  looks: { titulo: 'Looks & Templates', itens: [
    { termo: 'Ligar/desligar', texto: 'Um look desligado não é usado na geração.' },
    { termo: 'Ordem', texto: 'Reordene com as setas — a ordem vale na hora de gerar.' },
    { termo: 'Gerar prévias', texto: 'Renderiza uma amostra de cada look pra você ver como fica.' },
  ] },
};

export function proximoPassoPendente(feito, checklist) {
  const set = new Set(feito || []);
  return (checklist || []).find((i) => !set.has(i.id)) || null;
}
