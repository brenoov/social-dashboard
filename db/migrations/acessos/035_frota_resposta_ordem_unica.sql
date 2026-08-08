-- Duas respostas da mesma ficha não podem mais dividir o mesmo número de ordem.
--
-- POR QUE AGORA, e não antes: a folga existia desde a 032, mas era inofensiva
-- enquanto `ordem` não entrava em nada. Agora ela entra na IMPRESSÃO DIGITAL da
-- ficha assinada, e `conferirCorrente()` acusa quando a ordem muda. Sem esta
-- restrição, dois `insert` concorrentes gravando o mesmo número deixariam a
-- leitura decidida por desempate de `id` — e uma ficha honesta poderia ser
-- acusada de adulterada por acidente de gravação. Acusar inocente é o pior
-- desfecho possível num recurso que existe pra provar quem fez o quê.
-- (A ressalva foi levantada quatro vezes durante a construção. Esta é a vez.)

begin;

-- ── 1. Arrumar o que já existe ───────────────────────────────────────────────
-- Uma ficha real tem 15 respostas TODAS com `ordem = 0`: foi gravada antes de a
-- tela passar a preencher o campo. A renumeração usa `order by ordem, id` — a
-- MESMA sequência que a conferência já lê hoje —, então a ordem efetiva das
-- respostas não muda: só deixa de haver empate.
--
-- ⚠️ SÓ FICHA NÃO ASSINADA. Renumerar uma ficha assinada mudaria o texto que a
-- impressão digital cobre e a faria parecer adulterada — exatamente o defeito
-- que esta migration existe pra evitar. Hoje não há nenhuma assinada (conferido
-- antes de escrever isto), mas a guarda fica: quem rodar isto de novo, ou num
-- banco restaurado, não pode estragar prova.
with nova as (
  select r.id,
         (row_number() over (partition by r.checklist_id order by r.ordem, r.id) - 1) as n
    from public.frota_checklist_respostas r
    join public.frota_checklist c on c.id = r.checklist_id
   where c.assinada_em is null
)
update public.frota_checklist_respostas r
   set ordem = nova.n
  from nova
 where nova.id = r.id
   and r.ordem is distinct from nova.n;

-- ── 2. Impedir que aconteça de novo ──────────────────────────────────────────
-- Se este índice falhar, é porque sobrou duplicata numa ficha ASSINADA — e aí
-- parar é o certo: a correção não é renumerar (isso apagaria a prova), é
-- registrar uma ficha nova explicando, que é o mesmo caminho que o gatilho de
-- imutabilidade já obriga para qualquer erro em ficha assinada.
create unique index if not exists frota_resposta_ordem_unica
  on public.frota_checklist_respostas(checklist_id, ordem);

commit;
