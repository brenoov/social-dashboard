-- ENVIAR IMAGEM PELO GESTOR (assistente de criar campanha, o "C3").
--
-- POR QUE PRECISA: o passo 4 do assistente deixa enviar uma imagem nova. O
-- caminho é arquivo → Storage → URL pública → Meta (`imageFromUrl` do
-- meta-proxy, que SÓ aceita URL do Storage deste projeto — trava anti-SSRF).
-- O envio sai do NAVEGADOR, com o JWT da pessoa, e o bucket `fabrica-criativos`
-- não tinha política nenhuma para `authenticated`: a Fábrica sempre escreveu ali
-- pelo servidor, com a service key. Sem isto, o clique em "+ enviar imagem"
-- morre em "new row violates row-level security policy".
--
-- SÓ DENTRO DE `gestor-envios/`, e é o ponto principal desta migration.
-- Liberar o bucket inteiro daria a quem tem `meta.gestor` o poder de
-- SOBRESCREVER os criativos que a Fábrica gerou e já subiu para a Meta — um
-- upload com o nome certo e a arte de um anúncio no ar troca sozinha. A pasta
-- separa o que a pessoa manda do que o robô produziu.
--
-- QUEM PODE: exatamente quem já pode escrever no resto da Gestão de Tráfego —
-- `admin` OU `meta.gestor` em `profiles.features`. É o mesmo predicado de
-- gt_config_metricas / gt_fila_decisoes / gt_objetivo_interacao, copiado sem
-- afrouxar: um gate novo mais largo que o da ferramenta seria uma porta lateral.
--
-- SEM DELETE de propósito: apagar o arquivo depois de a Meta ter copiado a
-- imagem não desfaz nada (a Meta guarda a sua cópia pelo `image_hash`), e um
-- DELETE aberto só serviria para alguém derrubar o histórico de envios.

create policy gestor_envios_inserir
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'fabrica-criativos'
    and name like 'gestor-envios/%'
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and (p.role = 'admin' or 'meta.gestor' = any (p.features))
    )
  );

-- O upload do navegador usa `upsert:true` (reenviar o mesmo arquivo não deve dar
-- erro), e upsert vira UPDATE quando o objeto já existe. Mesmo gate, mesma pasta:
-- sem isto, reenviar falharia com um erro que ninguém entenderia.
create policy gestor_envios_atualizar
  on storage.objects for update to authenticated
  using (
    bucket_id = 'fabrica-criativos'
    and name like 'gestor-envios/%'
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and (p.role = 'admin' or 'meta.gestor' = any (p.features))
    )
  )
  with check (
    bucket_id = 'fabrica-criativos'
    and name like 'gestor-envios/%'
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and (p.role = 'admin' or 'meta.gestor' = any (p.features))
    )
  );
