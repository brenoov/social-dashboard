-- PROVA POR ROLLBACK. Cria o próprio lote e desfaz tudo no fim — o lote real do
-- dono (Mônaco Quartz LV1021) nunca é tocado.
-- Roda como service role, então `is_vessel_admin()` é contornado de propósito
-- aqui: o que esta prova mede é a REGRA DE NEGÓCIO, não o portão de permissão.
begin;

-- um lote de mentira, com uma peça gravada e uma não gravada
insert into public.vessel_lotes (id, modelo, quantidade, fabricado_em)
values ('11111111-1111-1111-1111-111111111111', 'PROVA', 2, current_date);
insert into public.vessel_pecas (codigo, lote_id, numero_na_serie, gravada_em) values
  ('PROVAGRAV01', '11111111-1111-1111-1111-111111111111', 1, now()),
  ('PROVALIVRE1', '11111111-1111-1111-1111-111111111111', 2, null);

-- 1. baixar com motivo fora da lista tem de RECUSAR
select 'motivo invalido recusa' as prova,
       (public.vessel_baixar_peca('PROVAGRAV01','qualquer') ->> 'motivo') = 'motivo_invalido' as passou;

-- 2. baixar de verdade
select 'baixa funciona' as prova,
       (public.vessel_baixar_peca('PROVAGRAV01','extraviada') ->> 'ok')::boolean as passou;

-- 3. baixar de novo tem de RECUSAR
select 'baixa repetida recusa' as prova,
       (public.vessel_baixar_peca('PROVAGRAV01','defeito') ->> 'motivo') = 'ja_baixada' as passou;

-- 4. desfazer funciona, e desfazer de novo recusa
select 'desfazer funciona' as prova,
       (public.vessel_desfazer_baixa('PROVAGRAV01') ->> 'ok')::boolean as passou;
select 'desfazer duas vezes recusa' as prova,
       (public.vessel_desfazer_baixa('PROVAGRAV01') ->> 'motivo') = 'nao_esta_baixada' as passou;

-- 5. depois de desfazer, dá pra baixar de novo — e o histórico guarda AS DUAS
select 'baixar de novo depois de desfazer' as prova,
       (public.vessel_baixar_peca('PROVAGRAV01','devolvida') ->> 'ok')::boolean as passou;
select 'historico guarda as duas baixas' as prova,
       (select count(*) from public.vessel_baixas where codigo = 'PROVAGRAV01') = 2 as passou;

-- 6. peça que não existe recusa
select 'peca inexistente recusa' as prova,
       (public.vessel_baixar_peca('NAOEXISTE1','defeito') ->> 'motivo') = 'peca_nao_existe' as passou;

rollback;
