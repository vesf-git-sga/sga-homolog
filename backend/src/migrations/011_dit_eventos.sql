-- Migration 011: DIT modalidade, previsão e log de eventos
-- Idempotente: usa IF NOT EXISTS / IF NOT EXISTS

ALTER TABLE requests
  ADD COLUMN IF NOT EXISTS dit_modalidade VARCHAR(10)
    CHECK (dit_modalidade IN ('entrega', 'retirada')),
  ADD COLUMN IF NOT EXISTS dit_previsao_at DATE;

CREATE TABLE IF NOT EXISTS dit_eventos (
  id            SERIAL PRIMARY KEY,
  request_id    INTEGER NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
  tipo          VARCHAR(30) NOT NULL,   -- 'ciente' | 'reagendamento' | 'observacao'
  modalidade    VARCHAR(10),            -- preenchido em tipo='ciente'
  data_anterior DATE,                   -- preenchido em tipo='reagendamento'
  nova_data     DATE,                   -- preenchido em tipo='reagendamento'
  motivo        TEXT,                   -- preenchido em 'reagendamento' e 'observacao'
  changed_by    INTEGER REFERENCES users(id),
  changed_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dit_eventos_request
  ON dit_eventos(request_id, changed_at);
