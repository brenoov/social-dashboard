-- Frota: a OFICINA é um contato à parte do contato geral.
--
-- Correção do dono: eu tinha posto a JHM Auto Center no campo de contato
-- genérico, e ela é a MECÂNICA que fez algumas manutenções. São coisas
-- diferentes e cada uma se procura num momento diferente: a oficina quando o
-- carro precisa de revisão, o contato geral (locadora, seguro, guincho) quando
-- o problema é outro.
alter table public.frota_veiculos
  add column if not exists oficina_nome text,
  add column if not exists oficina_telefone text;

-- Move o que eu tinha posto no lugar errado, sem perder nada.
update public.frota_veiculos
   set oficina_nome = coalesce(oficina_nome, contato_nome),
       oficina_telefone = coalesce(oficina_telefone, contato_telefone),
       contato_nome = null, contato_telefone = null, contato_papel = null,
       atualizado_em = now()
 where contato_papel = 'Oficina';

-- E preenche a oficina em TODO veículo cujo histórico de revisão a cita — antes
-- só o Porsche tinha pegado, porque a regra anterior dependia de um texto que
-- só a linha dele trazia.
update public.frota_veiculos v
   set oficina_nome = coalesce(v.oficina_nome, 'JHM Auto Center'),
       oficina_telefone = coalesce(v.oficina_telefone, '(19) 3033-9837'),
       atualizado_em = now()
 where exists (select 1 from public.frota_revisoes r
                where r.veiculo_id = v.id and r.oficina ilike '%JHM%');
