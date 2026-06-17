-- Migration 010: laudo_resultado e novos status do fluxo de avaria
-- Novos estados: nao_constatada, em_conserto, aprovada_conserto

-- Adiciona o resultado do laudo técnico à solicitação
ALTER TABLE equipment_requests
  ADD COLUMN IF NOT EXISTS laudo_resultado VARCHAR(20)
    CHECK (laudo_resultado IN ('conserto', 'substituicao'));

-- Atualiza o CHECK de status para incluir os novos valores
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
