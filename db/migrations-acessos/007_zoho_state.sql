-- state do OAuth (CSRF): emitido só pelo proxy (admin) e verificado no callback
alter table public.acessos_conexoes add column if not exists oauth_state text;
alter table public.acessos_conexoes add column if not exists oauth_state_em timestamptz;
