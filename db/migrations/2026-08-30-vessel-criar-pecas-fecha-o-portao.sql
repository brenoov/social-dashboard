-- FECHANDO UM BURACO QUE FOI PARA PRODUÇÃO.
--
-- Achado pela revisão da branch, em 30/08/2026, cerca de meia hora depois da
-- migration `2026-08-30-vessel-editar-lote.sql` ter sido aplicada.
--
-- `revoke all ... from public, anon` NÃO tira a concessão que o Postgres dá por
-- DEFAULT PRIVILEGES a `authenticated` em função nova do schema public. Medido
-- no banco, não deduzido:
--   select has_function_privilege('authenticated',
--          'public.vessel_criar_pecas(uuid,int,int)','execute');   -- devolvia TRUE
--
-- E `vessel_criar_pecas` é `security definer` SEM portão por dentro: a
-- concessão era a única porta. Com ela aberta, qualquer pessoa logada na
-- Central — mesmo sem a chave 'autenticidade' — podia injetar peças em qualquer
-- lote, ou segurar a transação até o timeout pedindo um intervalo gigante.
--
-- ⚠️ ESTE PROJETO JÁ SABIA DISSO. A armadilha está documentada em
-- `db/migrations/2026-07-31-saude-dos-robos.sql`, e quatro migrations já
-- revogam de `authenticated` explicitamente por causa dela. Esta não seguiu.
--
-- DUAS travas, e as duas valem: a concessão revogada E o portão por dentro. A
-- concessão sozinha volta a falhar se alguém recriar a função; o portão sozinho
-- deixa a função alcançável por quem não deveria nem enxergá-la.

create or replace function public.vessel_criar_pecas(p_lote uuid, p_de int, p_ate int)
returns int language plpgsql security definer set search_path to 'public'
as $$
declare
  ALFABETO constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';  -- sem O, 0, I, 1
  v_codigo text; v_bytes bytea; i int; j int; tentativa int; v_feitas int := 0;
begin
  -- O PORTÃO. As duas funções que chamam esta já conferem antes, e continuam
  -- passando: `auth.uid()` aqui dentro ainda é o da pessoa que chamou.
  if not public.is_vessel_admin() then
    raise exception 'sem_permissao';
  end if;

  -- Um intervalo absurdo seguraria a transação até o timeout. O lote já é
  -- limitado a 500 nas duas funções que chamam esta; aqui a trava é do próprio
  -- ajudante, para ele não depender de quem o chama.
  if p_de is null or p_ate is null or p_ate < p_de or (p_ate - p_de) >= 500 then
    raise exception 'intervalo_invalido';
  end if;

  for i in p_de..p_ate loop
    tentativa := 0;
    loop
      -- Sorteio CRIPTOGRAFICO, nao random(). O random() do Postgres e
      -- previsivel: quem comprasse algumas bolsas e olhasse os codigos poderia
      -- calcular os proximos — e a protecao contra falsificacao depende
      -- justamente de o codigo nao ser adivinhavel.
      -- O alfabeto tem exatamente 32 letras e 256/32 = 8, entao `byte % 32` nao
      -- puxa pra letra nenhuma (sem vies de modulo).
      v_bytes := extensions.gen_random_bytes(10);
      v_codigo := '';
      for j in 0..9 loop
        v_codigo := v_codigo || substr(ALFABETO, 1 + (get_byte(v_bytes, j) % length(ALFABETO)), 1);
      end loop;
      begin
        insert into public.vessel_pecas (codigo, lote_id, numero_na_serie)
        values (v_codigo, p_lote, i);
        v_feitas := v_feitas + 1;
        exit;
      exception when unique_violation then
        tentativa := tentativa + 1;
        if tentativa > 20 then raise exception 'nao consegui sortear codigo livre'; end if;
      end;
    end loop;
  end loop;
  return v_feitas;
end;
$$;

revoke all on function public.vessel_criar_pecas(uuid, int, int) from public, anon, authenticated;

-- ── E o motivo NULO, do mesmo relatório ───────────────────────────────────
-- `null not in (...)` devolve NULL, o `if` nao dispara, e a funcao seguia ate o
-- insert estourar com erro cru do Postgres — 500 na tela, em vez da recusa que
-- o desenho promete.
create or replace function public.vessel_baixar_peca(p_codigo text, p_motivo text)
returns json language plpgsql security definer set search_path to 'public'
as $$
declare v_codigo text := upper(trim(coalesce(p_codigo, '')));
begin
  if not public.is_vessel_admin() then
    return json_build_object('ok', false, 'motivo', 'sem_permissao');
  end if;
  if coalesce(p_motivo, '') not in ('extraviada','defeito','devolvida','etiqueta_perdida') then
    return json_build_object('ok', false, 'motivo', 'motivo_invalido');
  end if;
  if not exists (select 1 from public.vessel_pecas where codigo = v_codigo) then
    return json_build_object('ok', false, 'motivo', 'peca_nao_existe');
  end if;
  if exists (select 1 from public.vessel_baixas
              where codigo = v_codigo and desfeita_em is null) then
    return json_build_object('ok', false, 'motivo', 'ja_baixada');
  end if;
  insert into public.vessel_baixas (codigo, motivo, baixada_por)
  values (v_codigo, p_motivo, auth.uid());
  return json_build_object('ok', true, 'codigo', v_codigo, 'motivo_da_baixa', p_motivo);
end;
$$;
