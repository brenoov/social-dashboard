// SP-6: conteúdo único do tutorial da Fábrica (checklist + coach-marks + tooltips "?").
// Linguagem simples, pra quem não é técnico. Fluxo: Gerar → Curar → Subir → Conferir, + Looks.
export const CHECKLIST = [
  { id: 'criar', titulo: 'Crie uma campanha', texto: 'Escolha a loja, o objetivo, os produtos e o desconto. A ferramenta gera os criativos sozinha — a foto do produto vem do Bling.', rota: 'fabrica-nova' },
  { id: 'curar', titulo: 'Escolha os melhores', texto: 'No passo Curar aparecem todos os formatos de cada criativo. Marque os que vão virar anúncio.', rota: 'fabrica-nova' },
  { id: 'publicar', titulo: 'Publique (pausado)', texto: 'No passo Subir, defina destino, localização e público. Tudo sobe PAUSADO — não gasta nada.', rota: 'fabrica-nova' },
  { id: 'conferir', titulo: 'Confira e ative', texto: 'No passo Conferir, revise os anúncios e ative com confirmação de gasto quando quiser.', rota: 'fabrica-nova' },
  { id: 'looks', titulo: 'Gerencie os looks', texto: 'Ligue/desligue os estilos de criativo (inclusive os feitos por IA), reordene e gere as prévias na galeria de Looks.', rota: 'fabrica-looks' },
];

export const COACH = [
  { selector: '[data-tour="nova-campanha"]', titulo: 'Comece por aqui', texto: 'Clique em "Nova campanha" pra abrir o passo a passo: Gerar → Curar → Subir → Conferir.' },
  { selector: '[data-tour="numeros"]', titulo: 'Seu panorama', texto: 'Quantas campanhas estão em criação, quantos criativos já saíram e quantas foram publicadas.' },
  { selector: '[data-tour="em-criacao"]', titulo: 'Em criação', texto: 'As rodadas gerando ou prontas pra curar. Abra pra continuar de onde parou; apague se desistir. Se uma ficar vazia, a ferramenta mostra o motivo (ex.: produto sem foto no Bling).' },
  { selector: '[data-tour="publicadas"]', titulo: 'Publicadas recentes', texto: 'As campanhas que já foram pro Meta (pausadas). Abra no Gerenciador pra ativar.' },
  { selector: '[data-tour="looks-card"]', titulo: 'Looks & Templates', texto: 'A galeria dos estilos de criativo: ligue/desligue, reordene e veja as prévias. Alguns são feitos por IA (foto fotorrealista).' },
];

export const AJUDA = {
  gerar: { titulo: 'Passo 1 · Gerar', itens: [
    { termo: 'Objetivo', texto: 'O que a campanha busca: conversas no WhatsApp (engajamento), vendas/conversão, tráfego ou reconhecimento de marca (branding). O objetivo decide quais looks entram: campanha de venda usa looks de promoção (com preço); campanha de marca usa looks de branding (sem preço).' },
    { termo: 'Fonte dos produtos', texto: 'De onde vêm os produtos: oportunidades da semana, garimpo, grade BCG, curva ABC ou busca manual.' },
    { termo: 'Precisa de foto', texto: 'O produto precisa ter foto cadastrada no Bling — é dela que o criativo é montado. Produto sem foto não gera; nesse caso a campanha avisa o motivo em vez de ficar vazia.' },
    { termo: 'Desconto', texto: 'Use o desconto previsto do Gestor ou defina um % manual. Em branding não há desconto.' },
    { termo: 'Vários produtos', texto: 'Pode escolher muitos: a ferramenta gera em lotes automáticos, um após o outro, sem travar. A tela pode ficar "gerando" por um tempo — é normal, os criativos vão aparecendo aos poucos.' },
    { termo: 'Curadoria', texto: 'Revise a lista e marque/desmarque os produtos antes de gerar.' },
  ] },
  curar: { titulo: 'Passo 2 · Curar', itens: [
    { termo: 'Escolher', texto: 'Toque nos criativos que vão virar anúncio — ficam com a borda âmbar.' },
    { termo: 'Formatos', texto: 'Cada criativo sai em 4 tamanhos: Feed 1:1, Feed 4:5, Stories 9:16 e Widescreen 16:9. Todos aparecem aqui, com o nome embaixo.' },
    { termo: 'Widescreen 16:9', texto: 'É o formato de YouTube/Google Ads (sai também em vídeo). No Meta sobem só Feed e Stories — o 16:9 fica guardado pro Google Ads.' },
    { termo: 'Ver inteiro', texto: 'Clique no criativo pra abrir em tamanho grande e decidir com calma.' },
  ] },
  subir: { titulo: 'Passo 3 · Subir', itens: [
    { termo: 'Destino', texto: 'Nova campanha por loja (a ferramenta cria) ou injetar numa campanha existente.' },
    { termo: 'Localização e público', texto: 'Cidades + raio, idade/gênero, interesses e públicos salvos. Começa pela região da loja.' },
    { termo: 'Só Feed e Stories', texto: 'Vão pro Meta os formatos Feed e Stories. O Widescreen 16:9 não sobe aqui — é reservado pro Google Ads.' },
    { termo: 'Tudo pausado', texto: 'Os anúncios sobem PAUSADOS — ninguém vê e não gastam nada até você ativar.' },
  ] },
  conferir: { titulo: 'Passo 4 · Conferir', itens: [
    { termo: 'Revisar', texto: 'Veja quantos anúncios foram criados (pausados) antes de decidir.' },
    { termo: 'Ativar tudo', texto: 'Só ativa com uma confirmação de gasto. Enquanto não ativar, nada roda.' },
  ] },
  looks: { titulo: 'Looks & Templates', itens: [
    { termo: 'Ligar/desligar', texto: 'Um look desligado não é usado na geração. Ligue os que quiser usar.' },
    { termo: 'Looks de IA', texto: 'Alguns looks geram a cena por IA (foto fotorrealista com a bolsa fiel, ou a modelo). São mais caros/demorados, por isso entram desligados — ligue quando quiser.' },
    { termo: 'Promoção × Branding', texto: 'Looks de promoção (com preço) só rodam em campanhas de venda/conversão/tráfego. Looks de branding (sem preço) só em campanhas de branding.' },
    { termo: 'Ordem', texto: 'Reordene com as setas — a ordem vale na hora de gerar.' },
    { termo: 'Gerar prévias', texto: 'Renderiza uma amostra de cada look pra você ver como fica na galeria.' },
  ] },
};

export function proximoPassoPendente(feito, checklist) {
  const set = new Set(feito || []);
  return (checklist || []).find((i) => !set.has(i.id)) || null;
}
