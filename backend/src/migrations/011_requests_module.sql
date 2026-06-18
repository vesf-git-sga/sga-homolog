-- Módulo de Solicitações de Equipamentos de TI — v4
-- Migration: 011_requests_module.sql
-- Estratégia: mínimo impacto nos fluxos existentes.
-- O acoplamento é feito via FK request_id em asset_movements.

-- ─── Tabela principal ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS requests (
  id                      SERIAL PRIMARY KEY,
  protocol                VARCHAR(20) UNIQUE NOT NULL,  -- SOL-YYYY-NNNNN
  type                    VARCHAR(20) NOT NULL
                          CHECK (type IN ('emprestimo', 'substituicao', 'acrescimo')),
  status                  VARCHAR(30) NOT NULL DEFAULT 'requisitado'
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
  input_channel           VARCHAR(20) NOT NULL
                          CHECK (input_channel IN ('email', 'sei', 'chamado')),
  input_channel_details   VARCHAR(200),
  requester_person_id     INTEGER NOT NULL REFERENCES people(id),
  unit_id                 INTEGER NOT NULL REFERENCES units(id),
  -- substituicao: motivo (avaria exige chamado; necessidade_operacional exige SEI)
  fundamentacao           VARCHAR(30)
                          CHECK (fundamentacao IN ('avaria', 'necessidade_operacional')),
  notes                   TEXT,
  created_by              INTEGER NOT NULL REFERENCES users(id),
  approved_by             INTEGER REFERENCES users(id),
  approved_at             TIMESTAMP,
  created_at              TIMESTAMP DEFAULT NOW(),
  updated_at              TIMESTAMP DEFAULT NOW()
);

-- ─── Visita técnica (opcional, não vinculante) ───────────────────────────────
CREATE TABLE IF NOT EXISTS technical_visits (
  id              SERIAL PRIMARY KEY,
  request_id      INTEGER NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
  assigned_to     INTEGER REFERENCES users(id),  -- técnico designado
  scheduled_date  DATE,
  result          VARCHAR(20)
                  CHECK (result IN ('constatada', 'nao_constatada')),
  findings        TEXT,
  completed_by    INTEGER REFERENCES users(id),
  completed_at    TIMESTAMP,
  created_by      INTEGER NOT NULL REFERENCES users(id),
  created_at      TIMESTAMP DEFAULT NOW()
);

-- ─── Histórico de status ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS request_status_history (
  id          SERIAL PRIMARY KEY,
  request_id  INTEGER NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
  old_status  VARCHAR(30),
  new_status  VARCHAR(30) NOT NULL,
  notes       TEXT,
  changed_by  INTEGER NOT NULL REFERENCES users(id),
  changed_at  TIMESTAMP DEFAULT NOW()
);

-- ─── Acoplamento com movimentações ──────────────────────────────────────────
-- Nullable: zero impacto em movimentações existentes.
ALTER TABLE asset_movements ADD COLUMN IF NOT EXISTS request_id INTEGER REFERENCES requests(id);

-- Índices
CREATE INDEX IF NOT EXISTS idx_requests_status   ON requests(status);
CREATE INDEX IF NOT EXISTS idx_requests_type     ON requests(type);
CREATE INDEX IF NOT EXISTS idx_requests_unit     ON requests(unit_id);
CREATE INDEX IF NOT EXISTS idx_requests_created  ON requests(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_movements_request ON asset_movements(request_id) WHERE request_id IS NOT NULL;
