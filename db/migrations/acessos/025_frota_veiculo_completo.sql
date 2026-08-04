-- Frota: os campos que faltavam para o veículo ser gerido de verdade.
-- Pedido do dono: seguro, tag de pedágio, rastreador e a ligação com o
-- Patrimônio.

alter table public.frota_veiculos
  -- SEGURO. Vence, e vencer sem ninguém perceber é caro — por isso a data é
  -- coluna própria e não texto solto: só assim dá pra avisar antes.
  add column if not exists seguro_seguradora text,
  add column if not exists seguro_apolice text,
  add column if not exists seguro_vence_em date,
  add column if not exists seguro_valor_centavos bigint,
  -- Tag de pedágio (Sem Parar e afins) e rastreador: quando o carro some, ou
  -- quando chega uma cobrança de pedágio, é aqui que se procura.
  add column if not exists tag_pedagio text,
  add column if not exists rastreador text,
  -- Ligação OPCIONAL com o Patrimônio. Continua opcional pelo mesmo motivo da
  -- D1: estes carros são alugados, e lançá-los como bens inflaria o patrimônio
  -- com coisa que a empresa não possui. Quando houver carro PRÓPRIO, ele
  -- aponta pro bem e aparece nos dois lugares sem ser contado duas vezes.
  add column if not exists bem_id uuid references public.patrimonio_bens(id) on delete set null;

create index if not exists idx_frota_veiculos_bem on public.frota_veiculos(bem_id);
create index if not exists idx_frota_veiculos_seguro on public.frota_veiculos(seguro_vence_em);

-- CORREÇÃO DE DADO, informada pelo dono: o Porsche Cayenne e o Volvo XC90 não
-- estão em manutenção — estão EM USO. A planilha os trazia como "Em
-- manutenção" e a importação repetiu isso fielmente. Carro marcado como na
-- oficina não aparece para pegar nem entra na conta de disponíveis, então o
-- erro escondia dois carros da frota.
update public.frota_veiculos
   set situacao = 'ativo', atualizado_em = now()
 where placa in ('FQW7G77', 'FEF0C13') and situacao = 'em_manutencao';
