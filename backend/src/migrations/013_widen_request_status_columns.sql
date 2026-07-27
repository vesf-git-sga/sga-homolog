-- Migration 013: Ampliar colunas de status para suportar slugs longos
-- Corrige: necessidade_parcialmente_constatada (35 chars) excede VARCHAR(30)
-- Idempotente.

BEGIN;

ALTER TABLE requests
  ALTER COLUMN status TYPE VARCHAR(50);

ALTER TABLE request_status_history
  ALTER COLUMN old_status TYPE VARCHAR(50),
  ALTER COLUMN new_status TYPE VARCHAR(50);

COMMIT;
