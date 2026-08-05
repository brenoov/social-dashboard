-- Frota: contato do veículo, para falar por WhatsApp.
--
-- Pedido do dono. O caso real: o carro deu problema na estrada e alguém precisa
-- falar com quem resolve — a oficina, a locadora, o seguro. Hoje esse número
-- mora na coluna "Última Oficina" da planilha, como texto solto
-- ("JHM Auto center, fone: 30339837 e 19971649471"), e ninguém liga dali.
alter table public.frota_veiculos
  add column if not exists contato_nome text,
  add column if not exists contato_telefone text,
  -- Pra que serve esse contato: oficina, locadora, seguro, guincho. Texto
  -- livre de propósito — quem usa sabe melhor que eu quais categorias existem.
  add column if not exists contato_papel text;

-- A oficina que já está na planilha, para os carros que a citam. O telefone
-- vem SEM DDD no texto original ("30339837"); aqui entra com o DDD 19, que é
-- o da JHM em Conchal — sem DDD o link do WhatsApp não pode ser montado, e o
-- app prefere não montar a montar errado.
update public.frota_veiculos
   set contato_nome = coalesce(contato_nome, 'JHM Auto Center'),
       contato_telefone = coalesce(contato_telefone, '(19) 3033-9837'),
       contato_papel = coalesce(contato_papel, 'Oficina'),
       atualizado_em = now()
 where id in (select veiculo_id from frota_revisoes where oficina ilike '%JHM%');
