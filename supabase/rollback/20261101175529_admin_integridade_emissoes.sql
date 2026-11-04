BEGIN;
-- Rascunhos legados descartados por conter dados pessoais não são restaurados.
ALTER TABLE "Customer" DROP COLUMN IF EXISTS "updatedAt";
-- Executar apenas após retirar a versão que depende das chaves de emissão.
DROP INDEX IF EXISTS "PromissoryNote_issuanceKey_installmentNo_key";
ALTER TABLE "PromissoryNote" DROP COLUMN IF EXISTS "issuanceHash";
ALTER TABLE "PromissoryNote" DROP COLUMN IF EXISTS "issuanceKey";
-- Mantém RESTRICT: rollback não deve reintroduzir perda de histórico financeiro.
COMMIT;
