-- Portal de Notícias: resumão escrito do mercado (1 por edição/rodada), gerado por IA (Opus 4.8).
create table if not exists public.noticias_panorama(
  rodada date primary key,
  conteudo_md text not null,
  modelo text,
  uso text,
  created_at timestamptz not null default now()
);
alter table public.noticias_panorama enable row level security;
drop policy if exists noticias_panorama_read on public.noticias_panorama;
create policy noticias_panorama_read on public.noticias_panorama for select to authenticated using (true);
drop policy if exists noticias_panorama_read_anon on public.noticias_panorama;
create policy noticias_panorama_read_anon on public.noticias_panorama for select to anon using (true);
