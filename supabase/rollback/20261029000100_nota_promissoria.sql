-- Desfaz 20261029000100_nota_promissoria.sql. DESTRUTIVO: apaga todas as notas promissórias gravadas.
-- Faça backup da tabela antes, se já houver notas reais.
BEGIN;
DROP TABLE IF EXISTS "PromissoryNote";
DROP SEQUENCE IF EXISTS "PromissoryNote_number_seq";
COMMIT;
