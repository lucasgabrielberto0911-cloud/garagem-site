-- Desfaz 20261110150000_avaliador_de_compra.sql.
-- DESTRUTIVO: apaga as tabelas do avaliador de compra. Rollback operacional preferido é desligar a flag
-- PURCHASE_EVALUATOR_ENABLED e manter as avaliações. Por segurança, aborta se houver avaliação gravada.
BEGIN;
DO $$
DECLARE t text; populated boolean;
BEGIN
  FOREACH t IN ARRAY ARRAY['PurchaseEvaluation','PurchaseEvaluationRevision','VehicleFipeIdentity','VehicleAcquisitionMetadata','PurchasePolicyVersion'] LOOP
    IF to_regclass(format('public.%I', t)) IS NOT NULL THEN
      EXECUTE format('SELECT EXISTS (SELECT 1 FROM public.%I)', t) INTO populated;
      IF populated THEN RAISE EXCEPTION 'Rollback abortado: % tem dados privados. Preserve os registros e desligue a flag.', t; END IF;
    END IF;
  END LOOP;
END $$;
DROP TABLE IF EXISTS "PurchaseEvaluationRevision";
DROP TABLE IF EXISTS "PurchaseEvaluation";
DROP TABLE IF EXISTS "FipeMonthlyPrice";
DROP TABLE IF EXISTS "VehicleFipeIdentity";
DROP TABLE IF EXISTS "VehicleAcquisitionMetadata";
DROP TABLE IF EXISTS "PurchasePolicyVersion";
DROP TABLE IF EXISTS "FipeHistoryCache";
DROP FUNCTION IF EXISTS public.purchase_snapshot_immutable();
COMMIT;
