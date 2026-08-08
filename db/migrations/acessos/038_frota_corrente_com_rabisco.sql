-- A conferência da corrente passa a enxergar a versão e o rabisco da ficha.
--
-- O DEFEITO QUE ISTO CONSERTA — e ele acusaria inocente:
--
-- `frota_corrente_do_veiculo()` devolve as fichas de um carro para que a tela
-- recalcule a impressão digital de cada uma e veja se alguma foi alterada. Só
-- que ela foi escrita antes da migration 037 e não devolve
-- `assinatura_versao` nem `assinatura_rabisco`.
--
-- Sem a versão, toda ficha assinada com rabisco (versão 2) seria recalculada
-- como se fosse versão 1 — sem a linha do rabisco no texto. O hash não
-- fecharia, e a conferência diria que a ficha de quem ACABOU DE ASSINAR foi
-- adulterada. É a terceira vez nesta fase que um defeito "acusa inocente"
-- aparece; as duas anteriores foram o instante reescrito pelo Postgres e a
-- ordem das respostas sem trava de unicidade.
--
-- A tela já contornava isso lendo a tabela por fora e casando por `id`. Este
-- arquivo tira o contorno do caminho: quem conferir a corrente por qualquer
-- outro meio — um robô, um relatório, uma tela futura — recebe o dado
-- completo da fonte, sem precisar saber que faltava alguma coisa.
--
-- `drop` antes de `create`: mudar as colunas de saída de uma função que
-- devolve tabela exige recriar, `create or replace` recusa. Dentro da
-- transação, ninguém vê a função ausente no meio do caminho.

begin;

drop function if exists public.frota_corrente_do_veiculo(uuid);

create function public.frota_corrente_do_veiculo(p_veiculo uuid)
returns table (
  id uuid, veiculo_id uuid, feita_em date, pessoa_id uuid,
  hodometro integer, hodometro_justificativa text, cadencias text[],
  resultado text, anomalias text, assinada_em timestamptz,
  assinatura_hash text, assinatura_hash_anterior text,
  -- As duas novas. `assinatura_versao` é a que impede a acusação injusta;
  -- `assinatura_rabisco` entra no texto assinado a partir da versão 2, então
  -- sem ela o hash também não fecharia.
  assinatura_versao smallint, assinatura_rabisco jsonb,
  respostas jsonb
)
language sql
stable
as $function$
  select c.id, c.veiculo_id, c.feita_em, c.pessoa_id,
         c.hodometro, c.hodometro_justificativa, c.cadencias,
         c.resultado, c.anomalias, c.assinada_em,
         c.assinatura_hash, c.assinatura_hash_anterior,
         c.assinatura_versao, c.assinatura_rabisco,
         coalesce((
           select jsonb_agg(jsonb_build_object(
                    'item_texto', r.item_texto, 'estado', r.estado, 'observacao', r.observacao)
                  order by r.ordem, r.id)
             from public.frota_checklist_respostas r where r.checklist_id = c.id
         ), '[]'::jsonb)
    -- A ORDEM É A CORRENTE. Cada ficha se prende no hash da anterior DESTE
    -- carro, então conferir fora de ordem quebraria o encadeamento mesmo com
    -- todas as fichas intactas.
    from public.frota_checklist c
   where c.veiculo_id = p_veiculo
   order by c.feita_em, c.criada_em;
$function$;

commit;
