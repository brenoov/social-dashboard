-- PROVA POR ROLLBACK das funções de excluir, editar e baixar do Selo Vessel.
--
-- Rode inteiro, de uma vez. No fim ele desfaz tudo: nenhuma linha fica no banco.
--
-- ── DUAS ARMADILHAS QUE ESTA PROVA JÁ CAIU, e por isso ela é assim ──────────
--
-- 1. O SERVICE ROLE NÃO CONTORNA O PORTÃO. A primeira versão desta prova rodou
--    numa conexão administrativa e as oito asserções voltaram FALSAS de uma vez.
--    Falha em bloco é sinal de causa única, e era esta: `auth.uid()` é NULO numa
--    conexão dessas, então `is_vessel_admin()` dá falso e TODA função devolve
--    'sem_permissao'. A prova estava medindo o portão, não a regra.
--    A saída não é desarmar a trava — teste que precisa desarmar a trava está
--    provando outra coisa. É dar a chave à conta de ROBÔ dentro da transação e
--    fazer a sessão SER ela. O rollback devolve a chave.
--
-- 2. `union all` NÃO GARANTE ORDEM DE AVALIAÇÃO. A asserção do histórico ficou
--    vermelha sozinha porque a contagem rodou antes das baixas existirem.
--    Prova cujos passos dependem um do outro precisa de ordem garantida: por
--    isso os passos vivem num bloco `do $$`, um por vez, gravando numa tabela
--    temporária.
--
-- E o lote real do dono (Mônaco Quartz LV1021) nunca é tocado: a prova cria os
-- próprios lotes, com id fixo e modelo 'PROVA'.

begin;

-- a conta de ROBÔ (claudecode@rbvcompany.com) recebe a chave só aqui dentro
update public.profiles set features = array_append(coalesce(features,'{}'), 'autenticidade')
 where id = '5efc08ed-ca8a-437b-9e43-31542029cea9';
set local request.jwt.claims = '{"sub":"5efc08ed-ca8a-437b-9e43-31542029cea9","role":"authenticated"}';

create temp table resultado (n int, prova text, passou boolean) on commit drop;

do $$
declare v_lote uuid := '11111111-1111-1111-1111-111111111111';
begin
  insert into public.vessel_lotes (id, modelo, quantidade, fabricado_em)
  values (v_lote, 'PROVA', 2, current_date);
  insert into public.vessel_pecas (codigo, lote_id, numero_na_serie, gravada_em) values
    ('PROVAGRAV01', v_lote, 1, now()),
    ('PROVALIVRE1', v_lote, 2, null);

  insert into resultado values (0, 'o portao deixa passar', public.is_vessel_admin());
  insert into resultado values (1, 'motivo invalido recusa',
    (public.vessel_baixar_peca('PROVAGRAV01','qualquer') ->> 'motivo') = 'motivo_invalido');
  insert into resultado values (2, 'baixa funciona',
    (public.vessel_baixar_peca('PROVAGRAV01','extraviada') ->> 'ok')::boolean);
  insert into resultado values (3, 'baixa repetida recusa',
    (public.vessel_baixar_peca('PROVAGRAV01','defeito') ->> 'motivo') = 'ja_baixada');
  insert into resultado values (4, 'desfazer funciona',
    (public.vessel_desfazer_baixa('PROVAGRAV01') ->> 'ok')::boolean);
  insert into resultado values (5, 'desfazer duas vezes recusa',
    (public.vessel_desfazer_baixa('PROVAGRAV01') ->> 'motivo') = 'nao_esta_baixada');
  insert into resultado values (6, 'baixar de novo depois de desfazer',
    (public.vessel_baixar_peca('PROVAGRAV01','devolvida') ->> 'ok')::boolean);
  insert into resultado values (7, 'historico guarda AS DUAS baixas',
    (select count(*) from public.vessel_baixas where codigo = 'PROVAGRAV01') = 2);
  insert into resultado values (8, 'peca inexistente recusa',
    (public.vessel_baixar_peca('NAOEXISTE1','defeito') ->> 'motivo') = 'peca_nao_existe');
  insert into resultado values (9, 'vessel_alertas ainda responde',
    (public.vessel_alertas() ->> 'ok')::boolean);
end $$;

-- TODAS as linhas têm de vir passou = true. Qualquer false ou nulo é defeito.
select * from resultado order by n;

rollback;
