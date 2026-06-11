-- docs/migrations/008_noticias_seed_2026-06-11.sql
-- Seed inicial do Portal de Notícias — rodada de 11/06/2026.
-- Rode DEPOIS da 007. Idempotente: ON CONFLICT não duplica.

INSERT INTO public.noticias_concorrentes
  (marca, titulo, resumo, categoria, url, fonte, data_publicacao, rodada, destaque)
VALUES
-- ───────── Santa Lolla ─────────
('Santa Lolla','Verão 2026 com storytelling de "oásis no deserto"',
 'Coleção Verão 2026 construída sobre uma narrativa única — personagem cruzando o deserto em busca do "oásis pessoal", ligando estilo a autoconhecimento. Cada coleção vira um evento de marca.',
 'Lançamento','https://rsvpperfil.com.br/sem-categoria/preview-verao-2026-da-santa-lolla-com-colecao-inspirada-nos-sabores-e-sensacoes-da-estacao/','RSVP','2026-05-01','2026-06-11',true),
('Santa Lolla','Campanha de Dia das Mães "Cápsula do Tempo" com Rafa Kalimann',
 'Narrativa emocional com celebridade (carta à filha) para datas comerciais de pico. Aposta em rosto conhecido + storytelling sensível.',
 'Campanha','https://abramark.com.br/destaques/santa-lolla-campanha-capsula-do-tempo-rafa-kalimann-dia-das-maes-2026/','ABRAMARK','2026-04-20','2026-06-11',false),
('Santa Lolla','Collabs de buzz: Disney (Zé Carioca) e gelateria Le Botteghe di Leonardo',
 'Colaborações fora do óbvio para gerar mídia espontânea — identidade brasileira (Zé Carioca, 80 anos) e cross-over sensorial com gelato.',
 'Estratégia','https://revistalivemarketing.com.br/santa-lolla-apresenta-parceria-com-a-disney-em-homenagem-ao-personagem-ze-carioca/','Revista Live Marketing','2026-03-15','2026-06-11',false),
('Santa Lolla','Distribuição é o fosso: +3.000 PDVs e ~290–300 franquias',
 '21 anos de mercado, 2 concept stores (incl. Oscar Freire), ~2.000 multimarcas, e-commerce robusto, ~7 coleções/ano. Competir por presença é inviável para marca pequena.',
 'Expansão','https://franquias.portaldofranchising.com.br/franquia-santa-lolla-moda/','Portal do Franchising','2026-01-01','2026-06-11',false),
('Santa Lolla','Preços e promoções: entrada acessível + outlet agressivo',
 'Acessórios a partir de ~R$39,90; novidades a partir de ~R$49,90. Cupons 10% OFF / R$200 OFF / 1ª compra; frete grátis acima de R$299; outlet até 50%.',
 'Preço/Promo','https://www.cupomdesconto.com.br/cupom-santa-lolla','Cupomdesconto','2026-06-01','2026-06-11',false),

-- ───────── Capodarte ─────────
('Capodarte','Coleção Inverno 2026 "gabinete de curiosidades" (35 anos)',
 'Conceito de luxo como contemplação, memória e permanência. Marca prestes a completar 35 anos, com inspiração italiana/artesanal como território.',
 'Lançamento','https://www.semanapop.com.br/capodarte-reflete-sobre-legado-na-colecao-inverno-2026/','Semana Pop','2026-05-10','2026-06-11',true),
('Capodarte','Maxibolsas com múltiplos compartimentos voltam ao foco',
 'Produto: maxibolsas práticas e multifuncionais dialogando com rotina dinâmica sem perder sofisticação. Sinal de tendência a observar.',
 'Tendência','https://www.semanapop.com.br/capodarte-reflete-sobre-legado-na-colecao-inverno-2026/','Semana Pop','2026-05-10','2026-06-11',false),
('Capodarte','Promoções: cupom ~15% OFF e outlet/marketplaces até 60%',
 'Posicionamento premium (couro/inspiração italiana) com descontos pesados via Dafiti, Privalia e cupons.',
 'Preço/Promo','https://www.cuponation.com.br/cupom-desconto-capodarte','Cuponation','2026-06-01','2026-06-11',false),

-- ───────── Carmen Steffens ─────────
('Carmen Steffens','Bolsas em couro e materiais tecnológicos, até 50% OFF',
 'Catálogo premium empurrando couro e materiais tecnológicos, com parte da linha em descontos de até 50%.',
 'Preço/Promo','https://www.carmensteffensbhonline.com.br/bolsas-carmen-steffens/','Carmen Steffens BH Online','2026-06-01','2026-06-11',false),

-- ───────── Dumond ─────────
('Dumond','Forte presença em campanhas promocionais de marketplace',
 'Pacotes conjuntos com Capodarte e Jorge Bischoff em Dafiti e Privalia, com 30%–60% OFF. Estratégia de volume via marketplace.',
 'Preço/Promo','https://www.dafiti.com.br/campanha-capodarte-santalolla-dumond-30-60-off/','Dafiti','2026-06-01','2026-06-11',false),

-- ───────── Arezzo&Co / Azzas 2154 ─────────
('Arezzo&Co','Fusão com Grupo Soma cria a "Azzas 2154" (~R$11,8 bi)',
 'O guarda-chuva de Arezzo/Schutz/Anacapri virou gigante de varejo de moda. Sinergias projetadas: ~R$358 mi (2025), ~R$767 mi (2026), ~R$1,09 bi (2027). Competir em preço/escala é inviável — caminho é nicho e proximidade.',
 'Faturamento','https://www.seudinheiro.com/2024/empresas/azzas-2154-fusao-de-arezzo-e-soma-deve-adicionar-r-11-bilhao-em-receita-a-nova-gigante-do-varejo-ate-2027-mcss/','Seu Dinheiro','2026-02-01','2026-06-11',true),
('Arezzo&Co','2º tri: lucro acima do esperado com disciplina de custos',
 'Crescimento modesto de receita transformado em lucro acima das estimativas, apesar do impacto de tarifas dos EUA. Recorde histórico de R$6,1 bi de receita bruta em 2023.',
 'Faturamento','https://www.investimentosenoticias.com.br/noticias/mercado/arezzo-azza3-minimiza-impacto-das-tarifas-dos-eua-em-estrategia-de-mercado-norte-americano/','Investimentos e Notícias','2026-05-01','2026-06-11',false),
('Arezzo&Co','Schutz/Arezzo: sale recorrente até 50% OFF + cupom (chega a ~60%)',
 'Captura forte via newsletter/app (cupom de primeira compra). Programa "Influencerszz" transforma vendedores em criadores de conteúdo (influência distribuída).',
 'Preço/Promo','https://www.schutz.com.br/c/sale','Schutz','2026-06-01','2026-06-11',false),

-- ───────── La Vessel (homônima) ─────────
('La Vessel','Concorrente homônima em bolsas — risco de confusão de marca',
 'Marca @lavessel (design europeu, produção brasileira), ainda pequena (~4 mil seguidores). Quem busca "Vessel bolsas" pode cair nela. Blindar SEO/social de @vessel.brasil.',
 'Estratégia','https://www.instagram.com/lavessel/','Instagram','2026-06-01','2026-06-11',true),

-- ───────── Mercado / Tendências ─────────
('Mercado','Setor em modo promocional pesado: 50–60% OFF virou o normal',
 'Descontos agressivos via marketplaces (Dafiti, Privalia) e captura de cupom por newsletter/app. Evitar guerra de desconto raso; usar preço-âncora claro + promoção pontual bem comunicada.',
 'Tendência','https://jornaldobras.com.br/noticia/109455/do-casual-ao-sofisticado-como-a-moda-de-calcados-esta-se-redefinindo-em-2026','Jornal do Brás','2026-05-01','2026-06-11',true),
('Mercado','Cor do momento: marrom (chocolate→caramelo) lidera 2026',
 'Paleta forte em neutros atemporais (bege, off-white, preto) + tons sofisticados (vinho, marinho, verde musgo, nudes). Couro liso, veganos bem trabalhados e tecidos tecnológicos.',
 'Tendência','https://www.vitallycebags.com.br/blog/tendencias-em-bolsas-femininas-2025-2026/','Vitallyce Bags','2026-05-01','2026-06-11',false),
('Mercado','Formatos quentes: tote estruturada, baguete, tiracolo, hobo e meia-lua Y2K',
 'Versatilidade dia-a-noite supera ostentação. Maxibolsa com compartimentos voltando. Vídeo curto domina engajamento; IA conversacional e omnichannel no centro da jornada.',
 'Tendência','https://www.em.com.br/emfoco/2026/03/12/as-4-bolsas-que-vao-dominar-as-ruas-em-2026-e-transformar-qualquer-visual-basico/','Estado de Minas','2026-03-12','2026-06-11',false),
('Mercado','Varejo de moda/calçados ~R$396 bi em 2025 (+6%)',
 'Crescimento puxado por preço médio e previsibilidade de compra (projeção IEMI). Consumidor mantém interesse em design + conforto + funcionalidade mesmo sob pressão de preço.',
 'Tendência','https://jornaldobras.com.br/noticia/109455/do-casual-ao-sofisticado-como-a-moda-de-calcados-esta-se-redefinindo-em-2026','Jornal do Brás','2026-05-01','2026-06-11',false)

ON CONFLICT (marca, titulo, rodada) DO NOTHING;
