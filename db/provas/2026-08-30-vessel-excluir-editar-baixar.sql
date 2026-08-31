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

  -- 10. excluir lote com peça gravada tem de RECUSAR, dizendo quantas
  insert into resultado values (10, 'excluir lote com gravada recusa',
    (public.vessel_excluir_lote(v_lote) ->> 'motivo') = 'tem_gravada');
  insert into resultado values (11, 'e diz quantas estao gravadas',
    (public.vessel_excluir_lote(v_lote) ->> 'gravadas')::int = 1);

  -- 12. excluir peça gravada tem de RECUSAR
  insert into resultado values (12, 'excluir peca gravada recusa',
    (public.vessel_excluir_peca('PROVAGRAV01') ->> 'motivo') = 'esta_gravada');

  -- 13. excluir peça NÃO gravada funciona, e a quantidade do lote acompanha
  insert into resultado values (13, 'excluir peca livre funciona',
    (public.vessel_excluir_peca('PROVALIVRE1') ->> 'ok')::boolean);
  insert into resultado values (14, 'quantidade do lote acompanha',
    (select quantidade from public.vessel_lotes where id = v_lote) = 1);

  -- 15. sem peça gravada, o lote inteiro sai
  insert into public.vessel_lotes (id, modelo, quantidade, fabricado_em)
  values ('22222222-2222-2222-2222-222222222222', 'PROVA LIVRE', 2, current_date);
  insert into public.vessel_pecas (codigo, lote_id, numero_na_serie) values
    ('PROVALIVRE2', '22222222-2222-2222-2222-222222222222', 1),
    ('PROVALIVRE3', '22222222-2222-2222-2222-222222222222', 2);
  insert into resultado values (15, 'excluir lote livre funciona',
    (public.vessel_excluir_lote('22222222-2222-2222-2222-222222222222') ->> 'ok')::boolean);
  insert into resultado values (16, 'e as pecas dele sumiram junto',
    (select count(*) from public.vessel_pecas
      where lote_id = '22222222-2222-2222-2222-222222222222') = 0);

  -- 17. criar lote continua funcionando depois de trocar o miolo pelo ajudante
  insert into resultado values (17, 'gerar lote ainda funciona',
    (public.vessel_gerar_lote('PROVA EDIT', 'Cor', 'SKU1', 3, current_date, null) ->> 'ok')::boolean);

  -- 18. e os 3 codigos sao DIFERENTES entre si e tem 10 caracteres
  insert into resultado values (18, 'os codigos sao distintos e com 10 letras',
    (select count(distinct codigo) = 3 and bool_and(length(codigo) = 10)
       from public.vessel_pecas p
       join public.vessel_lotes l on l.id = p.lote_id
      where l.modelo = 'PROVA EDIT'));

  -- 19. editar nome e data e seguro
  insert into public.vessel_lotes (id, modelo, quantidade, fabricado_em)
  values ('33333333-3333-3333-3333-333333333333', 'ANTES', 2, '2020-01-01');
  insert into public.vessel_pecas (codigo, lote_id, numero_na_serie, gravada_em) values
    ('PROVAED0001', '33333333-3333-3333-3333-333333333333', 1, now()),
    ('PROVAED0002', '33333333-3333-3333-3333-333333333333', 2, null);
  insert into resultado values (19, 'editar nome e data funciona',
    (public.vessel_editar_lote('33333333-3333-3333-3333-333333333333',
     'DEPOIS', 'Nova', 'SKU9', '2026-03-01', 2) ->> 'ok')::boolean);
  insert into resultado values (20, 'a data mudou mesmo',
    (select fabricado_em = '2026-03-01' and modelo = 'DEPOIS'
       from public.vessel_lotes where id = '33333333-3333-3333-3333-333333333333'));

  -- 21. AUMENTAR cria codigos novos continuando a serie
  insert into resultado values (21, 'aumentar cria pecas',
    (public.vessel_editar_lote('33333333-3333-3333-3333-333333333333',
     'DEPOIS', 'Nova', 'SKU9', '2026-03-01', 4) ->> 'quantidade')::int = 4);
  insert into resultado values (22, 'a serie continua, nao repete numero',
    (select count(distinct numero_na_serie) = 4 and max(numero_na_serie) = 4
       from public.vessel_pecas where lote_id = '33333333-3333-3333-3333-333333333333'));

  -- 23. DIMINUIR tira as nao gravadas, e a gravada FICA
  insert into resultado values (23, 'diminuir tira as livres',
    (public.vessel_editar_lote('33333333-3333-3333-3333-333333333333',
     'DEPOIS', 'Nova', 'SKU9', '2026-03-01', 1) ->> 'quantidade')::int = 1);
  insert into resultado values (24, 'a peca gravada sobreviveu',
    (select count(*) = 1 from public.vessel_pecas
      where lote_id = '33333333-3333-3333-3333-333333333333' and codigo = 'PROVAED0001'));

  -- 25 a 27. Diminuir ABAIXO do gravado. Um lote NOVO, com DUAS gravadas.
  --
  -- A primeira versao desta prova pedia quantidade ZERO e aceitava
  -- 'dados_invalidos' OU 'abaixo_do_gravado'. Zero cai sempre no primeiro
  -- (a funcao exige de 1 a 500), entao a recusa que mais importa do plano
  -- NUNCA era testada — a asserçao passava sem provar nada.
  insert into public.vessel_lotes (id, modelo, quantidade, fabricado_em)
  values ('44444444-4444-4444-4444-444444444444', 'DUAS GRAVADAS', 2, current_date);
  insert into public.vessel_pecas (codigo, lote_id, numero_na_serie, gravada_em) values
    ('PROVAED0003', '44444444-4444-4444-4444-444444444444', 1, now()),
    ('PROVAED0004', '44444444-4444-4444-4444-444444444444', 2, now());
  insert into resultado values (25, 'diminuir ABAIXO do gravado recusa',
    (public.vessel_editar_lote('44444444-4444-4444-4444-444444444444',
     'DUAS','x','y',current_date,1) ->> 'motivo') = 'abaixo_do_gravado');
  insert into resultado values (26, 'e diz quantas estao presas',
    (public.vessel_editar_lote('44444444-4444-4444-4444-444444444444',
     'DUAS','x','y',current_date,1) ->> 'gravadas')::int = 2);
  insert into resultado values (27, 'e NAO apagou nenhuma delas',
    (select count(*) = 2 from public.vessel_pecas
      where lote_id = '44444444-4444-4444-4444-444444444444'));
end $$;

-- TODAS as linhas têm de vir passou = true. Qualquer false ou nulo é defeito.
select * from resultado order by n;

rollback;
