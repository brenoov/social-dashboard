-- Fase 2 do Selo Vessel: o painel. A fase 1 (pagina publica) ja esta no ar e NAO
-- muda — vessel_verificar e vessel_registrar seguem com o mesmo contrato.
--
-- O QUE MUDA NA SEGURANCA: ate agora as quatro tabelas tinham RLS ligada e ZERO
-- politica, porque so a pagina publica falava com elas (por funcao). Agora a
-- equipe precisa LER. Entao entra politica de SELECT — mas so pra
-- `authenticated` que tenha a chave. O `anon` continua sem politica nenhuma, que
-- e o que impede baixar a lista de codigos e clonar tags em massa.

-- Porteiro, no mesmo desenho de is_frota_admin(): le features[], que e o campo
-- que o RLS enxerga (o permissions{} do front nao chega no banco).
create or replace function public.is_vessel_admin()
returns boolean language sql stable security definer set search_path to 'public'
as $$
  select coalesce(
    (select 'autenticidade' = any(p.features) or p.is_superadmin
       from public.profiles p where p.id = auth.uid()),
    false);
$$;

drop policy if exists vessel_lotes_read     on public.vessel_lotes;
drop policy if exists vessel_pecas_read     on public.vessel_pecas;
drop policy if exists vessel_registros_read on public.vessel_registros;
drop policy if exists vessel_leituras_read  on public.vessel_leituras;

create policy vessel_lotes_read     on public.vessel_lotes     for select to authenticated using (public.is_vessel_admin());
create policy vessel_pecas_read     on public.vessel_pecas     for select to authenticated using (public.is_vessel_admin());
create policy vessel_registros_read on public.vessel_registros for select to authenticated using (public.is_vessel_admin());
create policy vessel_leituras_read  on public.vessel_leituras  for select to authenticated using (public.is_vessel_admin());

-- Gera o lote e os codigos de uma vez.
--
-- POR QUE NO BANCO E NAO NO NAVEGADOR: quem garante que nao ha codigo repetido e
-- a chave primaria. Sorteando no front, cada codigo precisaria de uma ida e
-- volta pra saber se ja existe — um lote de 200 viraria 200 requisicoes, e
-- ainda assim daria pra duas pessoas sortearem igual ao mesmo tempo.
create or replace function public.vessel_gerar_lote(
  p_modelo text, p_cor text, p_sku text, p_quantidade int,
  p_fabricado_em date, p_fotos text[]
) returns json language plpgsql security definer set search_path to 'public'
as $$
declare
  ALFABETO constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';  -- sem O, 0, I, 1
  v_lote uuid;
  v_codigo text;
  v_codigos text[] := array[]::text[];
  i int; j int; tentativa int;
begin
  if not public.is_vessel_admin() then
    return json_build_object('ok', false, 'motivo', 'sem_permissao');
  end if;
  if coalesce(trim(p_modelo), '') = '' or coalesce(p_quantidade, 0) < 1 or p_quantidade > 500 then
    return json_build_object('ok', false, 'motivo', 'dados_invalidos');
  end if;

  insert into public.vessel_lotes (modelo, cor, sku, quantidade, fabricado_em, fotos, criado_por)
  values (trim(p_modelo),
          nullif(trim(coalesce(p_cor, '')), ''),
          nullif(trim(coalesce(p_sku, '')), ''),
          p_quantidade, coalesce(p_fabricado_em, current_date), p_fotos, auth.uid())
  returning id into v_lote;

  for i in 1..p_quantidade loop
    tentativa := 0;
    loop
      v_codigo := '';
      for j in 1..10 loop
        v_codigo := v_codigo || substr(ALFABETO, 1 + floor(random() * length(ALFABETO))::int, 1);
      end loop;
      begin
        insert into public.vessel_pecas (codigo, lote_id, numero_na_serie)
        values (v_codigo, v_lote, i);
        exit;
      exception when unique_violation then
        tentativa := tentativa + 1;
        if tentativa > 20 then raise exception 'nao consegui sortear codigo livre'; end if;
      end;
    end loop;
    v_codigos := v_codigos || v_codigo;
  end loop;

  return json_build_object('ok', true, 'lote_id', v_lote, 'codigos', to_json(v_codigos));
end;
$$;

-- Marca que a tag daquela peca ja foi gravada. E o que impede a equipe de se
-- perder no meio de 20 etiquetas fisicamente identicas.
create or replace function public.vessel_marcar_gravada(p_codigo text)
returns json language plpgsql security definer set search_path to 'public'
as $$
begin
  if not public.is_vessel_admin() then
    return json_build_object('ok', false, 'motivo', 'sem_permissao');
  end if;
  update public.vessel_pecas set gravada_em = now()
   where codigo = upper(trim(coalesce(p_codigo, ''))) and gravada_em is null;
  return json_build_object('ok', true);
end;
$$;

-- Os sinais de fraude, numa viagem so.
--
-- 'repetidas': a MESMA peca lida de muitos aparelhos diferentes. Tag e link, e
-- link se copia — entao a peca clonada aparece lida em muitos lugares.
-- 'invalidas': codigo que nao existe. Alguem tentando adivinhar.
create or replace function public.vessel_alertas()
returns json language plpgsql security definer set search_path to 'public'
as $$
declare v json;
begin
  if not public.is_vessel_admin() then
    return json_build_object('ok', false, 'motivo', 'sem_permissao');
  end if;

  select json_build_object(
    'ok', true,
    'repetidas', coalesce((
      select json_agg(x) from (
        select l.codigo,
               count(*)                  as leituras,
               count(distinct l.ip_hash) as aparelhos,
               max(l.lido_em)            as ultima
          from public.vessel_leituras l
         where l.achou and l.lido_em > now() - interval '30 days'
         group by l.codigo
        having count(distinct l.ip_hash) >= 5
         order by count(distinct l.ip_hash) desc
         limit 20
      ) x), '[]'::json),
    'invalidas', coalesce((
      select json_agg(x) from (
        select l.codigo,
               count(*)       as tentativas,
               max(l.lido_em) as ultima
          from public.vessel_leituras l
         where not l.achou and l.lido_em > now() - interval '30 days'
         group by l.codigo
         order by count(*) desc
         limit 20
      ) x), '[]'::json),
    'total_leituras', (select count(*) from public.vessel_leituras where lido_em > now() - interval '30 days')
  ) into v;
  return v;
end;
$$;

revoke all on function public.vessel_gerar_lote(text, text, text, int, date, text[]) from public, anon;
revoke all on function public.vessel_marcar_gravada(text) from public, anon;
revoke all on function public.vessel_alertas() from public, anon;
grant execute on function public.vessel_gerar_lote(text, text, text, int, date, text[]) to authenticated;
grant execute on function public.vessel_marcar_gravada(text) to authenticated;
grant execute on function public.vessel_alertas() to authenticated;
