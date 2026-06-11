-- docs/migrations/007_noticias_concorrentes.sql
-- Portal de Notícias / Inteligência de Concorrentes
-- Tabela que alimenta o módulo "Portal de Notícias" da Central.
-- Escrita feita pela automação semanal (Cowork) usando a SERVICE ROLE key,
-- que ignora RLS. A anon key (cliente) só consegue LER.

CREATE TABLE IF NOT EXISTS public.noticias_concorrentes (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  marca           text NOT NULL,                 -- aba: 'Santa Lolla', 'Capodarte', 'Mercado', ...
  titulo          text NOT NULL,
  resumo          text,
  categoria       text,                          -- Lançamento | Campanha | Preço/Promo | Faturamento | Expansão | Tendência | Estratégia | Outro
  url             text,                          -- link da fonte
  fonte           text,                          -- nome da fonte (ex: 'Exame')
  data_publicacao date,                          -- data da notícia (se conhecida)
  rodada          date NOT NULL DEFAULT current_date,  -- data da rodada de pesquisa
  destaque        boolean NOT NULL DEFAULT false, -- realça no topo da aba
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_noticias_marca  ON public.noticias_concorrentes (marca);
CREATE INDEX IF NOT EXISTS idx_noticias_rodada ON public.noticias_concorrentes (rodada DESC);

-- Evita duplicar a mesma notícia na mesma rodada (a automação roda toda semana)
CREATE UNIQUE INDEX IF NOT EXISTS uq_noticias_marca_titulo_rodada
  ON public.noticias_concorrentes (marca, titulo, rodada);

ALTER TABLE public.noticias_concorrentes ENABLE ROW LEVEL SECURITY;

-- Leitura: qualquer usuário autenticado da Central
DROP POLICY IF EXISTS "noticias_select_authenticated" ON public.noticias_concorrentes;
CREATE POLICY "noticias_select_authenticated"
  ON public.noticias_concorrentes
  FOR SELECT
  TO authenticated
  USING (true);

-- Escrita: NENHUMA policy de INSERT/UPDATE/DELETE de propósito.
-- Só a service_role (automação) grava, e ela ignora RLS.
-- Assim ninguém com a anon key pública consegue inserir/alterar dados.
