-- Migration 012: Decisões por equipamento (visita técnica + deliberação da gerência)
-- Solução B: tabelas satélite + novos status parciais
-- Idempotente.

BEGIN;

-- ─── 0. Ampliar colunas de status (antes dos novos slugs longos) ─────────────
ALTER TABLE requests
  ALTER COLUMN status TYPE VARCHAR(50);

ALTER TABLE request_status_history
  ALTER COLUMN old_status TYPE VARCHAR(50),
  ALTER COLUMN new_status TYPE VARCHAR(50);

-- ─── 1. Novos status na solicitação ──────────────────────────────────────────
ALTER TABLE requests DROP CONSTRAINT IF EXISTS requests_status_check;
ALTER TABLE requests ADD CONSTRAINT requests_status_check CHECK (status IN (
  'requisitado',
  'visita_tecnica_solicitada',
  'visita_realizada',
  'aguardando_aprovacao',
  'necessidade_parcialmente_constatada',
  'aprovado',
  'parcialmente_aprovado',
  'reprovado',
  'em_execucao',
  'concluido',
  'cancelado',
  'indisponivel_estoque'
));

-- ─── 2. Resultado da visita técnica por item ─────────────────────────────────
CREATE TABLE IF NOT EXISTS technical_visit_item_results (
  id                SERIAL PRIMARY KEY,
  visit_id          INTEGER NOT NULL REFERENCES technical_visits(id) ON DELETE CASCADE,
  catalog_item_id   INTEGER NOT NULL REFERENCES request_catalog_items(id) ON DELETE CASCADE,
  result            VARCHAR(20) NOT NULL CHECK (result IN ('constatada', 'nao_constatada')),
  findings          TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (visit_id, catalog_item_id)
);

CREATE INDEX IF NOT EXISTS idx_tvir_visit
  ON technical_visit_item_results(visit_id);
CREATE INDEX IF NOT EXISTS idx_tvir_catalog_item
  ON technical_visit_item_results(catalog_item_id);

-- ─── 3. Deliberação da gerência por item ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS request_item_deliberations (
  id                 SERIAL PRIMARY KEY,
  request_id         INTEGER NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
  catalog_item_id    INTEGER NOT NULL REFERENCES request_catalog_items(id) ON DELETE CASCADE,
  decision           VARCHAR(20) NOT NULL CHECK (decision IN ('aprovado', 'reprovado')),
  approved_quantity  INTEGER CHECK (approved_quantity IS NULL OR approved_quantity >= 0),
  notes              TEXT,
  decided_by         INTEGER NOT NULL REFERENCES users(id),
  decided_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (request_id, catalog_item_id)
);

CREATE INDEX IF NOT EXISTS idx_rid_request
  ON request_item_deliberations(request_id);
CREATE INDEX IF NOT EXISTS idx_rid_catalog_item
  ON request_item_deliberations(catalog_item_id);

-- ─── 4. Backfill: visitas concluídas sem resultado por item ──────────────────
INSERT INTO technical_visit_item_results (visit_id, catalog_item_id, result, findings)
SELECT tv.id, rci.id, tv.result, tv.findings
FROM technical_visits tv
JOIN request_catalog_items rci ON rci.request_id = tv.request_id
WHERE tv.completed_at IS NOT NULL
  AND tv.result IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM technical_visit_item_results tvir
    WHERE tvir.visit_id = tv.id AND tvir.catalog_item_id = rci.id
  );

-- ─── 5. Backfill: solicitações já aprovadas/reprovadas sem deliberação ───────
INSERT INTO request_item_deliberations
  (request_id, catalog_item_id, decision, approved_quantity, notes, decided_by, decided_at)
SELECT
  r.id,
  rci.id,
  CASE WHEN r.status IN ('aprovado', 'parcialmente_aprovado', 'indisponivel_estoque', 'em_execucao', 'concluido')
       THEN 'aprovado' ELSE 'reprovado' END,
  CASE WHEN r.status IN ('aprovado', 'parcialmente_aprovado', 'indisponivel_estoque', 'em_execucao', 'concluido')
       THEN rci.quantity ELSE NULL END,
  'Backfill a partir do status da solicitação.',
  COALESCE(r.approved_by, r.created_by),
  COALESCE(r.approved_at, r.updated_at, r.created_at)
FROM requests r
JOIN request_catalog_items rci ON rci.request_id = r.id
WHERE r.status IN ('aprovado', 'reprovado', 'indisponivel_estoque', 'em_execucao', 'concluido')
  AND NOT EXISTS (
    SELECT 1 FROM request_item_deliberations rid
    WHERE rid.request_id = r.id AND rid.catalog_item_id = rci.id
  );

-- ─── 6. Índice DIT inclui aprovação parcial ───────────────────────────────────
DROP INDEX IF EXISTS idx_requests_dit_pendente;
CREATE INDEX IF NOT EXISTS idx_requests_dit_pendente
  ON requests(status, dit_ciente_at)
  WHERE status IN ('aprovado', 'parcialmente_aprovado') AND dit_ciente_at IS NULL;

COMMIT;
