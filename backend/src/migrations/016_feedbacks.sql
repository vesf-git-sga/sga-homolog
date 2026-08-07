-- Migration 016: Módulo de Feedback (reclamação, elogio, observação, dúvida)
-- Idempotente: IF NOT EXISTS

CREATE TABLE IF NOT EXISTS feedbacks (
  id            SERIAL PRIMARY KEY,
  user_id       INTEGER NOT NULL REFERENCES users(id),
  tipo          VARCHAR(20) NOT NULL
                  CHECK (tipo IN ('reclamacao', 'elogio', 'observacao', 'duvida')),
  status        VARCHAR(20) NOT NULL DEFAULT 'aberto'
                  CHECK (status IN ('aberto', 'respondido', 'encerrado')),
  page_context  VARCHAR(120) NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS feedback_messages (
  id            SERIAL PRIMARY KEY,
  feedback_id   INTEGER NOT NULL REFERENCES feedbacks(id) ON DELETE CASCADE,
  author_id     INTEGER NOT NULL REFERENCES users(id),
  body          TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_feedbacks_user_id
  ON feedbacks(user_id);

CREATE INDEX IF NOT EXISTS idx_feedbacks_status
  ON feedbacks(status);

CREATE INDEX IF NOT EXISTS idx_feedbacks_tipo
  ON feedbacks(tipo);

CREATE INDEX IF NOT EXISTS idx_feedbacks_created_at
  ON feedbacks(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_feedback_messages_feedback
  ON feedback_messages(feedback_id, created_at);
