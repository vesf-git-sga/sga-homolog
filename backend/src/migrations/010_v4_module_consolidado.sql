-- =============================================================================
-- Migration consolidada: Módulo de Solicitações de TI v4
-- Substitui: 010_laudo_resultado_new_statuses.sql
--            011_requests_module.sql
--            012_fix_v4_tables.sql
--            013_catalog_and_request_items.sql
--
-- Pode ser executada em banco limpo (sem migrações anteriores do módulo).
-- Todos os comandos usam IF NOT EXISTS / IF EXISTS para ser idempotente.
-- =============================================================================

BEGIN;

-- ─── 1. equipment_requests (v3) — novos campos e status ──────────────────────
--   Mantém o módulo v3 funcional com o resultado de laudo e os estados
--   adicionados durante o desenvolvimento.

ALTER TABLE equipment_requests
  ADD COLUMN IF NOT EXISTS laudo_resultado VARCHAR(20)
    CHECK (laudo_resultado IN ('conserto', 'substituicao'));

ALTER TABLE equipment_requests
  DROP CONSTRAINT IF EXISTS equipment_requests_status_check;

ALTER TABLE equipment_requests
  ADD CONSTRAINT equipment_requests_status_check
    CHECK (status IN (
      'aberta', 'em_analise', 'aprovada', 'em_execucao', 'finalizada',
      'rejeitada', 'cancelada', 'em_manutencao', 'aguardando_laudo',
      'resolvida_in_loco', 'devolvido', 'em_vistoria', 'vistoria_concluida',
      'nao_constatada', 'em_conserto', 'aprovada_conserto'
    ));


-- ─── 2. requests — tabela principal do módulo v4 ─────────────────────────────

CREATE TABLE IF NOT EXISTS requests (
  id                    SERIAL PRIMARY KEY,
  protocol              VARCHAR(20) UNIQUE NOT NULL,      -- SOL-YYYY-NNNNN
  type                  VARCHAR(20) NOT NULL
                        CHECK (type IN ('emprestimo', 'substituicao', 'acrescimo')),
  status                VARCHAR(30) NOT NULL DEFAULT 'requisitado'
                        CHECK (status IN (
                          'requisitado',
                          'visita_tecnica_solicitada',
                          'visita_realizada',
                          'aguardando_aprovacao',
                          'aprovado',
                          'reprovado',
                          'em_execucao',
                          'concluido',
                          'cancelado'
                        )),
  input_channel         VARCHAR(20) NOT NULL
                        CHECK (input_channel IN ('email', 'sei', 'chamado')),
  input_channel_details VARCHAR(200),
  requester_person_id   INTEGER NOT NULL REFERENCES people(id),
  unit_id               INTEGER NOT NULL REFERENCES units(id),
  -- substituicao: avaria exige chamado; necessidade_operacional exige SEI/e-mail
  fundamentacao         VARCHAR(30)
                        CHECK (fundamentacao IN ('avaria', 'necessidade_operacional')),
  notes                 TEXT,
  oficio_path           VARCHAR(500),
  oficio_original_name  VARCHAR(255),
  created_by            INTEGER NOT NULL REFERENCES users(id),
  approved_by           INTEGER REFERENCES users(id),
  approved_at           TIMESTAMP,
  created_at            TIMESTAMP DEFAULT NOW(),
  updated_at            TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_requests_status  ON requests(status);
CREATE INDEX IF NOT EXISTS idx_requests_type    ON requests(type);
CREATE INDEX IF NOT EXISTS idx_requests_unit    ON requests(unit_id);
CREATE INDEX IF NOT EXISTS idx_requests_created ON requests(created_at DESC);


-- ─── 3. technical_visits ─────────────────────────────────────────────────────
--   FK aponta para requests(id), NÃO para equipment_requests(id).

CREATE TABLE IF NOT EXISTS technical_visits (
  id             SERIAL PRIMARY KEY,
  request_id     INTEGER NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
  assigned_to    INTEGER REFERENCES users(id),
  scheduled_date DATE,
  result         VARCHAR(20) CHECK (result IN ('constatada', 'nao_constatada')),
  findings       TEXT,
  completed_by   INTEGER REFERENCES users(id),
  completed_at   TIMESTAMP,
  created_by     INTEGER NOT NULL REFERENCES users(id),
  created_at     TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_technical_visits_request ON technical_visits(request_id);


-- ─── 4. request_status_history ───────────────────────────────────────────────
--   FK aponta para requests(id), NÃO para equipment_requests(id).

CREATE TABLE IF NOT EXISTS request_status_history (
  id          SERIAL PRIMARY KEY,
  request_id  INTEGER NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
  old_status  VARCHAR(30),
  new_status  VARCHAR(30) NOT NULL,
  notes       TEXT,
  changed_by  INTEGER NOT NULL REFERENCES users(id),
  changed_at  TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_request_status_history_request ON request_status_history(request_id);


-- ─── 5. Acoplamento com movimentações ────────────────────────────────────────
--   FK nullable: zero impacto em movimentações existentes sem solicitação.

ALTER TABLE asset_movements
  ADD COLUMN IF NOT EXISTS request_id INTEGER REFERENCES requests(id);

CREATE INDEX IF NOT EXISTS idx_movements_request
  ON asset_movements(request_id) WHERE request_id IS NOT NULL;


-- ─── 6. Catálogo de marcas e modelos ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS catalog_brands (
  id   SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS catalog_models (
  id           SERIAL PRIMARY KEY,
  name         VARCHAR(100) NOT NULL,
  brand_id     INTEGER NOT NULL REFERENCES catalog_brands(id) ON DELETE CASCADE,
  item_type_id INTEGER NOT NULL REFERENCES item_types(id),
  UNIQUE (brand_id, name, item_type_id)
);

CREATE INDEX IF NOT EXISTS idx_catalog_models_brand     ON catalog_models(brand_id);
CREATE INDEX IF NOT EXISTS idx_catalog_models_item_type ON catalog_models(item_type_id);


-- ─── 7. Itens da solicitação (catálogo + quantidade) ─────────────────────────

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

COMMIT;
