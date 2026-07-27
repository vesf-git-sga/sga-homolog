-- Migration 014: Quantidade constatada por item + resultado visita frustrada
-- Idempotente.

BEGIN;

-- ─── 1. Quantidade constatada por equipamento na visita ───────────────────────
ALTER TABLE technical_visit_item_results
  ADD COLUMN IF NOT EXISTS constatada_quantity INTEGER
    CHECK (constatada_quantity IS NULL OR constatada_quantity >= 1);

-- Backfill: visitas constatadas existentes assumem quantidade solicitada
UPDATE technical_visit_item_results tvir
SET constatada_quantity = rci.quantity
FROM request_catalog_items rci
WHERE tvir.catalog_item_id = rci.id
  AND tvir.result = 'constatada'
  AND tvir.constatada_quantity IS NULL;

-- ─── 2. Resultado "frustrada" na visita técnica ─────────────────────────────
ALTER TABLE technical_visits DROP CONSTRAINT IF EXISTS technical_visits_result_check;
ALTER TABLE technical_visits ADD CONSTRAINT technical_visits_result_check
  CHECK (result IS NULL OR result IN ('constatada', 'nao_constatada', 'frustrada'));

COMMIT;
