-- O SEGREDO DA FUNÇÃO conteudo-hora-h.
--
-- Separado do agendamento (migration 06) de propósito: dá para ter a função no
-- ar e testável À MÃO antes de deixá-la disparando push sozinha na mão de todo
-- mundo. Ligar o cron é uma decisão, não um efeito colateral de deployar.
--
-- POR QUE A LINHA PRECISA EXISTIR ANTES: exigirSegredoDeCron() é fail-closed —
-- sem segredo cadastrado ela nega TUDO com 401. Se o cron for agendado antes
-- desta linha, o pg_cron monta o cabeçalho como 'Bearer ' vazio e a função
-- passa a falhar em silêncio para sempre. O único rastro é cron.job_run_details,
-- que ninguém abre sem motivo.
insert into public.segredos_de_cron (nome, segredo)
values ('conteudo-hora-h', encode(gen_random_bytes(32), 'hex'))
on conflict (nome) do nothing;
