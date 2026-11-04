-- SOMENTE LEITURA: lista, por migration de supabase/migrations, o que já existe no banco.
-- Uso (Supabase SQL Editor ou psql): só SELECTs, não altera nada. Coluna `existe` = false indica objeto faltando.
-- Ao criar uma migration nova, acrescente os objetos dela na lista `alvos`.
WITH alvos(migration, tipo, tabela, objeto) AS (VALUES
  ('20260813000100_vehicle_ops','coluna','Vehicle','inStoreName'),
  ('20260813000100_vehicle_ops','coluna','Vehicle','hasSpareKey'),
  ('20260813000100_vehicle_ops','coluna','Vehicle','hasManual'),
  ('20260813000100_vehicle_ops','coluna','Vehicle','purchasePrice'),
  ('20260813000100_vehicle_ops','tabela','VehicleCost',NULL),
  ('20260813000100_vehicle_ops','tabela','VehicleDocument',NULL),
  ('20260818000100_indice_status_categoria','indice','Vehicle','Vehicle_status_category_idx'),
  ('20260822000100_conteudo_do_site','coluna','Vehicle','hasVideo'),
  ('20260822000100_conteudo_do_site','coluna','SiteSettings','googleRating'),
  ('20260822000100_conteudo_do_site','coluna','SiteSettings','faqJson'),
  ('20260822000100_conteudo_do_site','coluna','SiteSettings','conditionsJson'),
  ('20260822000100_conteudo_do_site','coluna','SiteSettings','founderPhotoUrl'),
  ('20260827000100_alinhamento_schema','coluna','Testimonial','rating'),
  ('20260827000100_alinhamento_schema','coluna','Testimonial','published'),
  ('20260827000100_alinhamento_schema','coluna','Photo','thumbnailUrl'),
  ('20260827000100_alinhamento_schema','coluna','Vehicle','locationCity'),
  ('20260907000100_lead_venda_extra','coluna','LeadVenda','interestVehicleId'),
  ('20260907000100_lead_venda_extra','coluna','LeadVenda','source'),
  ('20260907000100_lead_venda_extra','coluna','LeadVenda','photoUrls'),
  ('20260907000100_lead_venda_extra','coluna','LeadVenda','updatedAt'),
  ('20260917000100_cidade_do_veiculo','coluna','Vehicle','locationCity'),
  ('20260917000100_cidade_do_veiculo','indice','Vehicle','Vehicle_status_locationCity_idx'),
  ('20260921000100_remove_photo_has_plate','coluna_ausente','Photo','hasPlate'),
  ('20260923000100_veiculo_consignado','coluna','Vehicle','consigned'),
  ('20261003000100_admin_workspace_v2','coluna','Sale','updatedAt'),
  ('20261003000100_admin_workspace_v2','coluna','LeadVenda','nextAction'),
  ('20261003000100_admin_workspace_v2','coluna','LeadVenda','nextActionAt'),
  ('20261003000100_admin_workspace_v2','tabela','AdminDraft',NULL),
  ('20261003000100_admin_workspace_v2','tabela','AdminAudit',NULL),
  ('20261003000100_admin_workspace_v2','tabela','AdminLoginAttempt',NULL),
  ('20261003000100_admin_workspace_v2','tabela','LeadActivity',NULL),
  ('20261010000100_info_verificada_veiculo','tabela','VehicleVerifiedInfo',NULL),
  ('20261010000200_nota_do_anuncio','tabela','VehicleListingScore',NULL),
  ('20261010000300_indices_extras','indice','Sale','Sale_customerId_idx'),
  ('20261010000300_indices_extras','indice','LeadVenda','LeadVenda_status_createdAt_idx'),
  ('20261011000100_indices_agenda_admin','indice','LeadVenda','LeadVenda_agenda_ativa_idx'),
  ('20261012000100_historico_de_preco','tabela','VehiclePriceHistory',NULL),
  ('20261019000100_admin_comercial','tabela','VehicleReservation',NULL),
  ('20261019000100_admin_comercial','tabela','VehicleAssessment',NULL),
  ('20261019000100_admin_comercial','tabela','FinanceSimulation',NULL),
  ('20261019000100_admin_comercial','tabela','CommercialDocument',NULL),
  ('20261019000100_admin_comercial','tabela','AfterSaleTask',NULL),
  ('20261019000100_admin_comercial','indice','VehicleReservation','VehicleReservation_active_key'),
  ('20261019000100_admin_comercial','constraint','VehicleReservation','reservation_values'),
  ('20261019000100_admin_comercial','constraint','FinanceSimulation','finance_values'),
  ('20261019000200_motivo_de_perda_lead','coluna','LeadVenda','lostReason'),
  ('20261020000100_numero_documento_comercial','coluna','CommercialDocument','number'),
  ('20261020000100_numero_documento_comercial','indice','CommercialDocument','CommercialDocument_number_key'),
  ('20261021000100_rls_hardening','tabela','_rls_hardening_backup',NULL),
  ('20261029000100_nota_promissoria','tabela','PromissoryNote',NULL),
  ('20261029000100_nota_promissoria','indice','PromissoryNote','PromissoryNote_number_key'),
  ('20261029000100_nota_promissoria','constraint','PromissoryNote','promissory_status'),
  ('20261029000100_nota_promissoria','constraint','PromissoryNote','promissory_values'),
  ('20261101000100_lead_venda_request_key','coluna','LeadVenda','requestKey'),
  ('20261101000100_lead_venda_request_key','indice','LeadVenda','LeadVenda_requestKey_key')
)
SELECT a.migration, a.tipo, a.tabela, a.objeto,
  CASE a.tipo
    WHEN 'tabela' THEN to_regclass(format('public.%I', a.tabela)) IS NOT NULL
    WHEN 'coluna' THEN EXISTS (SELECT 1 FROM information_schema.columns c
      WHERE c.table_schema = 'public' AND c.table_name = a.tabela AND c.column_name = a.objeto)
    WHEN 'coluna_ausente' THEN NOT EXISTS (SELECT 1 FROM information_schema.columns c
      WHERE c.table_schema = 'public' AND c.table_name = a.tabela AND c.column_name = a.objeto)
    WHEN 'indice' THEN EXISTS (SELECT 1 FROM pg_indexes i WHERE i.schemaname = 'public' AND i.indexname = a.objeto)
    WHEN 'constraint' THEN EXISTS (SELECT 1 FROM pg_constraint k WHERE k.conname = a.objeto
      AND k.conrelid = to_regclass(format('public.%I', a.tabela)))
  END AS existe
FROM alvos a
ORDER BY a.migration, a.tipo, a.tabela, a.objeto;

-- Resumo por migration (true = tudo aplicado). A 20261021000100 também mexe em grants/RLS/storage: ver abaixo.
-- Tabelas de public sem RLS (esperado: nenhuma depois do rls_hardening):
SELECT c.relname AS tabela_sem_rls
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind = 'r' AND NOT c.relrowsecurity
ORDER BY 1;

-- Privilégios restantes de anon/authenticated em public (esperado: nenhum):
SELECT grantee, table_name, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public' AND grantee IN ('anon','authenticated')
ORDER BY 1, 2, 3;

-- Políticas "Public ... veiculos" em storage.objects (esperado: nenhuma):
SELECT policyname FROM pg_policies
WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname IN
  ('Public delete veiculos','Public update veiculos','Public upload veiculos');
