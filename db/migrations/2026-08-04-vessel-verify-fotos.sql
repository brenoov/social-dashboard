-- Fotos da peca no certificado.
--
-- As fotos ficam NO LOTE, nao no HTML: a pagina e uma so pra todos os modelos, e
-- o dia que existir o painel (fase 2) ele so grava a lista aqui. Chumbar foto no
-- HTML obrigaria a mexer em codigo a cada modelo novo.
--
-- Guardamos o CAMINHO relativo ("fotos/lv1021/1-frente.jpg"), nao a URL inteira:
-- assim o mesmo dado serve em vesselbrasil.com.br, no dominio do painel e na
-- maquina de casa, sem reescrever nada.

alter table public.vessel_lotes add column if not exists fotos text[];

comment on column public.vessel_lotes.fotos is
  'Caminhos relativos das fotos do modelo, na ordem de exibicao. Ex: {"fotos/lv1021/1-frente.jpg"}.';

-- vessel_verificar passa a devolver sku e fotos. O resto do contrato nao muda.
create or replace function public.vessel_verificar(p_codigo text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_codigo text := upper(regexp_replace(coalesce(p_codigo, ''), '[\s.\-_]', '', 'g'));
  v_peca   record;
  v_reg    record;
  v_cab    json := nullif(current_setting('request.headers', true), '')::json;
begin
  select p.codigo, p.numero_na_serie, l.modelo, l.cor, l.sku, l.quantidade,
         l.fabricado_em, l.fotos
    into v_peca
    from public.vessel_pecas p
    join public.vessel_lotes l on l.id = p.lote_id
   where p.codigo = v_codigo;

  insert into public.vessel_leituras (codigo, achou, agente, ip_hash)
  values (
    left(v_codigo, 32),
    v_peca.codigo is not null,
    left(coalesce(v_cab ->> 'user-agent', ''), 300),
    encode(extensions.digest(coalesce(v_cab ->> 'x-forwarded-for', 'sem-ip'), 'sha256'), 'hex')
  );

  if v_peca.codigo is null then
    return json_build_object('ok', false);
  end if;

  select * into v_reg from public.vessel_registros where codigo = v_codigo;

  return json_build_object(
    'ok', true,
    'modelo', v_peca.modelo,
    'cor', v_peca.cor,
    'sku', v_peca.sku,
    'numero', v_peca.numero_na_serie,
    'total', v_peca.quantidade,
    'fabricado_em', v_peca.fabricado_em,
    'fotos', coalesce(v_peca.fotos, array[]::text[]),
    'registrada', v_reg.codigo is not null,
    'nome_mascarado', case when v_reg.codigo is null then null
                           else split_part(v_reg.nome, ' ', 1) || '***' end,
    'registrada_em', v_reg.registrado_em,
    'garantia_ate', v_reg.garantia_ate
  );
end;
$$;

revoke all on function public.vessel_verificar(text) from public;
grant execute on function public.vessel_verificar(text) to anon, authenticated;

-- O lote de demonstracao passa a ser uma bolsa DE VERDADE do catalogo, com as
-- fotos oficiais: Bolsa de Ombro Grande Monaco, referencia LV1021, cor Quartz.
-- (Antes era um "Altiva" inventado, que numa demonstracao pro dono soaria falso.)
update public.vessel_lotes
   set modelo = 'Mônaco',
       cor    = 'Quartz',
       sku    = 'LV1021',
       fotos  = array[
         'fotos/lv1021/1-frente.jpg',
         'fotos/lv1021/2-tres-quartos.jpg',
         'fotos/lv1021/3-lateral.jpg',
         'fotos/lv1021/4-costas.jpg',
         'fotos/lv1021/5-interior.jpg'
       ]
 where id = '00000000-0000-4000-8000-000000000001';
