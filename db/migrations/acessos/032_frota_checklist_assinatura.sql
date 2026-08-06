-- Frota F7a: a assinatura do checklist.
-- Desenho: docs/superpowers/specs/2026-08-06-frota-checklist-assinatura-design.md
--
-- O QUE ISTO GARANTE: que uma ficha assinada não muda mais, e que alteração
-- retroativa não pode ser escondida. Cada ficha assinada guarda a impressão
-- digital do próprio conteúdo E a da ficha anterior DAQUELE CARRO — reescrever
-- uma ficha de agosto obrigaria a reescrever todas as de setembro em diante.

alter table public.frota_checklist
  -- Quando o cartão foi ABERTO. É o que permite medir quanto tempo a pessoa
  -- levou (D20) — o único sinal que existe contra "marcou tudo sem olhar".
  add column if not exists aberta_em timestamptz,
  add column if not exists assinada_em timestamptz,
  add column if not exists assinada_por uuid references auth.users(id) on delete set null,
  add column if not exists assinatura_hash text,
  add column if not exists assinatura_hash_anterior text,
  -- Por que ficou sem assinatura. Hoje só 'sem_login' (D22): 4 dos 7 motoristas
  -- não têm conta no app, e o registro não pode parar por causa disso.
  add column if not exists sem_assinatura_motivo text;

create index if not exists idx_frota_checklist_corrente
  on public.frota_checklist(veiculo_id, feita_em)
  where assinada_em is not null;

-- A ordem das respostas dentro de uma ficha faz parte da impressão digital
-- (assinatura.js percorre na ordem em que recebe). `id` é uuid ALEATÓRIO —
-- não dá ordem estável. Sem esta coluna, a leitura do lado do servidor
-- devolveria as respostas numa ordem diferente da que foi assinada, e a
-- conferência acusaria adulteração numa ficha intacta: o pior defeito possível
-- aqui, porque acusa alguém inocente. Quem grava o valor é a tela (tarefa
-- seguinte); aqui só garantimos que a coluna existe antes dela precisar.
alter table public.frota_checklist_respostas
  add column if not exists ordem int not null default 0;

-- ── Ficha assinada NÃO MUDA MAIS (D21) ─────────────────────────────────────
-- Gatilho, não checagem de tela: a tela não é o único caminho de escrita, e
-- esta central já aprendeu isso na migration 029 (posse órfã). Uma assinatura
-- que a própria aplicação pode reescrever não prova nada.
create or replace function public.frota_checklist_imutavel()
returns trigger language plpgsql as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'Esta ficha foi assinada em % e não pode ser apagada.', old.assinada_em;
  end if;
  raise exception 'Esta ficha foi assinada em % e não pode ser alterada. '
    'Se há algo errado nela, registre uma ficha nova explicando.', old.assinada_em;
end $$;

drop trigger if exists trg_frota_checklist_imutavel on public.frota_checklist;
create trigger trg_frota_checklist_imutavel
  before update or delete on public.frota_checklist
  for each row
  when (old.assinada_em is not null)
  execute function public.frota_checklist_imutavel();

-- As RESPOSTAS também: adiantaria pouco travar a ficha e deixar mudar o que foi
-- respondido nela.
create or replace function public.frota_resposta_imutavel()
returns trigger language plpgsql as $$
declare v_assinada timestamptz;
begin
  select c.assinada_em into v_assinada from public.frota_checklist c
   where c.id = coalesce(old.checklist_id, new.checklist_id);
  if v_assinada is not null then
    raise exception 'A ficha desta resposta foi assinada em % e não pode ser alterada.', v_assinada;
  end if;
  return coalesce(new, old);
end $$;

drop trigger if exists trg_frota_resposta_imutavel on public.frota_checklist_respostas;
create trigger trg_frota_resposta_imutavel
  before update or delete on public.frota_checklist_respostas
  for each row execute function public.frota_resposta_imutavel();

-- ── A leitura pra conferir a corrente ──────────────────────────────────────
-- Devolve as fichas assinadas de um carro, da mais antiga pra mais nova, com as
-- respostas juntas — que é exatamente o que conferirCorrente() precisa. Está
-- aqui pra não obrigar a tela a fazer N+1 consultas.
create or replace function public.frota_corrente_do_veiculo(p_veiculo uuid)
returns table (
  id uuid, veiculo_id uuid, feita_em date, pessoa_id uuid,
  hodometro int, hodometro_justificativa text, cadencias text[],
  resultado text, anomalias text, assinada_em timestamptz,
  assinatura_hash text, assinatura_hash_anterior text, respostas jsonb
)
language sql stable security invoker as $$
  select c.id, c.veiculo_id, c.feita_em, c.pessoa_id,
         c.hodometro, c.hodometro_justificativa, c.cadencias,
         c.resultado, c.anomalias, c.assinada_em,
         c.assinatura_hash, c.assinatura_hash_anterior,
         coalesce((
           select jsonb_agg(jsonb_build_object(
                    'item_texto', r.item_texto, 'estado', r.estado, 'observacao', r.observacao)
                  order by r.ordem, r.id)
             from public.frota_checklist_respostas r where r.checklist_id = c.id
         ), '[]'::jsonb)
    from public.frota_checklist c
   where c.veiculo_id = p_veiculo
   order by c.feita_em, c.criada_em;
$$;
