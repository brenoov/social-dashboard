-- Central de Conteúdo — ligar a peça ao post real na mão
--
-- O BURACO QUE ISTO FECHA: o casamento automático só acontece se o robô
-- encontrar e propuser. Quando ele não encontra — publicação fora da janela de
-- 24h, legenda muito reescrita, story (que a Meta não devolve de forma
-- confiável) — a peça ficava SEM MÉTRICA PARA SEMPRE e a pessoa não tinha o que
-- fazer: `conteudo_casamentos` só aceitava escrita do service_role, e a única
-- RPC exposta decidia sobre uma sugestão que precisava já existir.
--
-- Agora existe a saída óbvia: colar o link do post.

create or replace function public.conteudo_casar_na_mao(
  p_peca  uuid,
  p_media text
)
returns public.conteudo_pecas
language plpgsql
security definer
set search_path = public
as $$
declare
  v_peca    public.conteudo_pecas;
  v_media   text;
  -- Guardado ANTES do update: o `returning * into v_peca` sobrescreve o status,
  -- e a trilha sairia dizendo "publicada → publicada", que não conta nada.
  v_antes   text;
begin
  -- Quem pode mexer na peça pode ligá-la ao post. A checagem é a mesma das
  -- policies das outras tabelas de conteúdo.
  if not exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and (p.role = 'admin' or p.is_superadmin or 'conteudo' = any (p.features))
  ) then
    raise exception 'Você não tem acesso à Central de Conteúdo.';
  end if;

  v_media := trim(coalesce(p_media, ''));
  if v_media = '' then
    raise exception 'Informe o link ou o código do post.';
  end if;

  -- Aceita o link inteiro OU só o código. Colar a URL da barra do navegador é o
  -- que a pessoa vai fazer; exigir que ela extraia o código seria pedir para
  -- ela fazer o trabalho da máquina.
  --   https://www.instagram.com/p/ABC123/?igsh=xxxx  ->  ABC123
  --   https://www.instagram.com/reel/XYZ789/         ->  XYZ789
  if v_media ~ 'instagram\.com/(p|reel|reels|tv)/' then
    v_media := substring(v_media from 'instagram\.com/(?:p|reel|reels|tv)/([A-Za-z0-9_-]+)');
  end if;

  if v_media is null or v_media = '' then
    raise exception 'Não reconheci esse link. Cole o endereço do post no Instagram.';
  end if;

  select * into v_peca from public.conteudo_pecas where id = p_peca;
  if not found then
    raise exception 'Peça não encontrada.';
  end if;
  v_antes := v_peca.status;

  -- O mesmo post não pode ficar preso a duas peças: a métrica de uma seria a
  -- métrica da outra. O índice único em ig_media_id já barra, mas a mensagem
  -- dele é ilegível para quem está na tela.
  if exists (
    select 1 from public.conteudo_pecas
    where ig_media_id = v_media and id <> p_peca
  ) then
    raise exception 'Esse post já está ligado a outra peça.';
  end if;

  update public.conteudo_pecas
  set ig_media_id  = v_media,
      status       = 'publicada',
      publicado_em = coalesce(publicado_em, now())
  where id = p_peca
  returning * into v_peca;

  -- Registrado como 'confirmado' (não 'automatico'): foi decisão de gente.
  insert into public.conteudo_casamentos
    (peca_id, ig_media_id, pontuacao, motivo, situacao, decidido_por, decidido_em)
  values
    (p_peca, v_media, 1, 'Ligado à mão por quem cuida da peça.', 'confirmado', auth.uid(), now())
  on conflict (peca_id, ig_media_id) do update
    set situacao = 'confirmado', decidido_por = auth.uid(), decidido_em = now();

  insert into public.conteudo_eventos (peca_id, de, para, acao, detalhe, quem)
  values (p_peca, v_antes, 'publicada', 'casou_na_mao', v_media, auth.uid());

  return v_peca;
end;
$$;

-- O anon herda EXECUTE por padrão no Supabase, e `revoke from public` NÃO tira
-- a concessão explícita dele. Sem estas duas linhas, qualquer visitante sem
-- login poderia ligar posts a peças.
revoke all on function public.conteudo_casar_na_mao(uuid, text) from public, anon;
grant execute on function public.conteudo_casar_na_mao(uuid, text) to authenticated;
