-- Migration 012: corrige tabelas technical_visits e request_status_history
-- que existiam do esquema v3 (FK apontando para equipment_requests).
-- Recria com FK apontando para a tabela requests do v4.

BEGIN;

-- ─── Preserva dados de request_status_history gerados pelo v4 ───────────────
CREATE TEMP TABLE rsh_v4_backup AS
  SELECT id, request_id, old_status, new_status, notes, changed_by, changed_at
  FROM request_status_history
  WHERE request_id IN (SELECT id FROM requests);

-- ─── Dropa tabelas com schema incorreto ──────────────────────────────────────
DROP TABLE IF EXISTS technical_visits CASCADE;
DROP TABLE IF EXISTS request_status_history CASCADE;

-- ─── Recria technical_visits com schema v4 ───────────────────────────────────
CREATE TABLE technical_visits (
  id              SERIAL PRIMARY KEY,
  request_id      INTEGER NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
  assigned_to     INTEGER REFERENCES users(id),
  scheduled_date  DATE,
  result          VARCHAR(20) CHECK (result IN ('constatada', 'nao_constatada')),
  findings        TEXT,
  completed_by    INTEGER REFERENCES users(id),
  completed_at    TIMESTAMP,
  created_by      INTEGER NOT NULL REFERENCES users(id),
  created_at      TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_technical_visits_request ON technical_visits(request_id);

-- ─── Recria request_status_history com schema v4 ─────────────────────────────
CREATE TABLE request_status_history (
  id          SERIAL PRIMARY KEY,
  request_id  INTEGER NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
  old_status  VARCHAR(30),
  new_status  VARCHAR(30) NOT NULL,
  notes       TEXT,
  changed_by  INTEGER NOT NULL REFERENCES users(id),
  changed_at  TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_request_status_history_request ON request_status_history(request_id);

-- ─── Restaura registros v4 preservados ───────────────────────────────────────
INSERT INTO request_status_history (id, request_id, old_status, new_status, notes, changed_by, changed_at)
  SELECT id, request_id, old_status, new_status, notes, changed_by, changed_at
  FROM rsh_v4_backup;

-- Corrige a sequência para não colidir com os IDs restaurados
SELECT setval('request_status_history_id_seq', COALESCE((SELECT MAX(id) FROM request_status_history), 1));

COMMIT;
