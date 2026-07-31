-- O segredo da função conteudo-espelho.
--
-- Mesma separação da hora H: o segredo vem numa migration, o agendamento vem em
-- outra (a 09). Assim dá para ter a função no ar e testável à mão antes de
-- deixá-la consumindo cota da Graph API a cada 30 minutos.
--
-- Sem esta linha, exigirSegredoDeCron() é fail-closed e nega tudo com 401 — em
-- silêncio, com o único rastro em cron.job_run_details.
insert into public.segredos_de_cron (nome, segredo)
values ('conteudo-espelho', encode(gen_random_bytes(32), 'hex'))
on conflict (nome) do nothing;
