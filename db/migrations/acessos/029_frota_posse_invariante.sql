-- Frota F6b (revisão de código): a invariante da posse se guarda no banco.
-- Desenho: docs/superpowers/specs/2026-08-05-frota-checklist-motorista-design.md (D9b)
--
-- POR QUE ESTA MIGRATION EXISTE: estado-do-veiculo.js calcula `disponivel` só
-- a partir de `pessoa_id` — não olha se há posse aberta (de propósito: ver o
-- comentário de usoAberto() nesse arquivo). Se um veículo perder o dono fixo
-- (pessoa_id vira nulo) enquanto ainda tem uma posse aberta, ele apareceria
-- livre pra qualquer um pegar mesmo estando com alguém.
--
-- A tela (tela-de-frota.vue, salvarVeiculo/trocarDonoFixo) já evita isso
-- quando a troca acontece por ali. Mas não é o único caminho de escrita:
-- coletor/importar-frota-manutencao.mjs faz
-- `update frota_veiculos set pessoa_id=$2 ...` direto contra o banco, com $2
-- podendo ser nulo, sem passar pela tela nem pela regra em JS. Invariante que
-- importa se guarda no banco, não em checagem de tela — mesmo padrão das
-- migrations anteriores desta central (ex.: frota_checar_decisao na 023).

create or replace function public.frota_fechar_posse_orfa()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- Dispara só quando pessoa_id acabou de virar nulo (a condição do gatilho,
  -- abaixo). Fecha qualquer posse aberta deste veículo — não há o que reabrir
  -- aqui, só evitar a combinação proibida (sem dono fixo + posse aberta).
  update public.frota_uso
     set volta_em = now()
   where veiculo_id = new.id
     and tipo = 'posse'
     and volta_em is null;
  return new;
end;
$$;

drop trigger if exists trg_frota_fechar_posse_orfa on public.frota_veiculos;
create trigger trg_frota_fechar_posse_orfa
  after update of pessoa_id on public.frota_veiculos
  for each row
  when (new.pessoa_id is null)
  execute function public.frota_fechar_posse_orfa();
