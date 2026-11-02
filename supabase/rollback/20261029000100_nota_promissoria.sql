-- Desfaz 20261029000100_nota_promissoria.sql.
-- DESTRUTIVO: apaga a tabela de notas promissórias. Por segurança, aborta se houver notas gravadas.
-- Para desfazer mesmo assim, faça backup da tabela e apague as linhas de propósito antes de rodar.
BEGIN;
DO $$
BEGIN
  IF to_regclass('"PromissoryNote"') IS NOT NULL AND EXISTS (SELECT 1 FROM "PromissoryNote") THEN
    RAISE EXCEPTION 'Rollback abortado: "PromissoryNote" tem notas gravadas. Faça backup e esvazie a tabela antes.';
  END IF;
END $$;
DROP TABLE IF EXISTS "PromissoryNote";
DROP SEQUENCE IF EXISTS "PromissoryNote_number_seq";
COMMIT;
