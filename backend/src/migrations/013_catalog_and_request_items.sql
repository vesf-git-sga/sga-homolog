-- Migration 013: tabelas de catálogo e itens de solicitação v4
-- catalog_brands e catalog_models não tinham migration (apenas rotas no server.js).
-- request_catalog_items liga os itens de catálogo à tabela requests (v4).
-- oficio_path e oficio_original_name registram o ofício anexado na criação.

BEGIN;

-- ─── Catálogo de marcas ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS catalog_brands (
  id   SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE
);

-- ─── Catálogo de modelos (marca + tipo de item) ───────────────────────────────
CREATE TABLE IF NOT EXISTS catalog_models (
  id           SERIAL PRIMARY KEY,
  name         VARCHAR(100) NOT NULL,
  brand_id     INTEGER NOT NULL REFERENCES catalog_brands(id) ON DELETE CASCADE,
  item_type_id INTEGER NOT NULL REFERENCES item_types(id),
  UNIQUE (brand_id, name, item_type_id)
);

CREATE INDEX IF NOT EXISTS idx_catalog_models_brand     ON catalog_models(brand_id);
CREATE INDEX IF NOT EXISTS idx_catalog_models_item_type ON catalog_models(item_type_id);

-- ─── Itens da solicitação v4 ──────────────────────────────────────────────────
-- Cada item descreve o equipamento desejado via catálogo + quantidade.
CREATE TABLE IF NOT EXISTS request_catalog_items (
  id           SERIAL PRIMARY KEY,
  request_id   INTEGER NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
  item_type_id INTEGER NOT NULL REFERENCES item_types(id),
  brand_id     INTEGER REFERENCES catalog_brands(id),
  model_id     INTEGER REFERENCES catalog_models(id),
  description  TEXT,
  quantity     INTEGER NOT NULL DEFAULT 1 CHECK (quantity >= 1),
  created_at   TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_req_catalog_items_request ON request_catalog_items(request_id);

-- ─── Ofício na tabela requests ────────────────────────────────────────────────
ALTER TABLE requests
  ADD COLUMN IF NOT EXISTS oficio_path          VARCHAR(500),
  ADD COLUMN IF NOT EXISTS oficio_original_name VARCHAR(255);

COMMIT;
