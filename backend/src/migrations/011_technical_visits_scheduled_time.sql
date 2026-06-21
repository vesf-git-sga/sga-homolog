-- Migration 011: adiciona horário e permite edição do agendamento de visitas técnicas

ALTER TABLE technical_visits
  ADD COLUMN IF NOT EXISTS scheduled_time VARCHAR(5);
