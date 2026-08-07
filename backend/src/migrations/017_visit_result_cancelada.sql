-- Migration 017: Resultado "cancelada" para visita técnica desfeita por reversão
BEGIN;

ALTER TABLE technical_visits DROP CONSTRAINT IF EXISTS technical_visits_result_check;
ALTER TABLE technical_visits ADD CONSTRAINT technical_visits_result_check
  CHECK (result IS NULL OR result IN ('constatada', 'nao_constatada', 'frustrada', 'cancelada'));

COMMIT;
