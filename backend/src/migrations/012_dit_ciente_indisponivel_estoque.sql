-- Migration 012: Ciência da DIT + Status Indisponível no Estoque
-- Executar uma única vez; idempotente via IF NOT EXISTS e DROP/ADD constraint.

-- ─── Colunas de ciência da DIT ───────────────────────────────────────────────
ALTER TABLE requests
  ADD COLUMN IF NOT EXISTS dit_ciente_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS dit_ciente_by  INTEGER REFERENCES users(id);

-- ─── Expandir CHECK de status para incluir indisponivel_estoque ───────────────
ALTER TABLE requests DROP CONSTRAINT IF EXISTS requests_status_check;
ALTER TABLE requests ADD CONSTRAINT requests_status_check
  CHECK (status IN (
    'requisitado',
    'visita_tecnica_solicitada',
    'visita_realizada',
    'aguardando_aprovacao',
    'aprovado',
    'reprovado',
    'em_execucao',
    'concluido',
    'cancelado',
    'indisponivel_estoque'
  ));

-- Índice para consulta de pendentes DIT (status aprovado sem ciência)
CREATE INDEX IF NOT EXISTS idx_requests_dit_pendente
  ON requests (status, dit_ciente_at)
  WHERE status = 'aprovado' AND dit_ciente_at IS NULL;
