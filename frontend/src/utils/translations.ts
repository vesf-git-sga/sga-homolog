// frontend/src/utils/translations.ts

// Função para traduzir os status dos ativos
export const translateStatus = (status: string): string => {
    const statusMap: { [key: string]: string } = {
      available: 'Disponível',
      in_use: 'Em Uso',
      loaned: 'Emprestado',
      maintenance: 'Em Manutenção',
      pending_retirement: 'Pendente de Baixa',
      retired: 'Baixado',
      disposed: 'Descartado'
    };
    return statusMap[status] || status; 
};

// Função para traduzir os tipos de movimentação
export const translateMovementType = (type: string): string => {
    const typeMap: { [key: string]: string } = {
      entry: 'Entrada',
      exit: 'Saída',
      loan: 'Empréstimo',
      return: 'Devolução',
      maintenance: 'Manutenção'
    };
    return typeMap[type] || type;
};

// ─── Módulo de Solicitações de TI ────────────────────────────────────────────

export const REQUEST_TYPE_LABELS: Record<string, string> = {
  emprestimo:   'Empréstimo',
  substituicao: 'Substituição',
  acrescimo:    'Acréscimo',
}

export const REQUEST_STATUS_LABELS: Record<string, string> = {
  requisitado:               'Requisitado',
  visita_tecnica_solicitada: 'Visita Técnica Solicitada',
  visita_realizada:          'Visita Realizada',
  aguardando_aprovacao:      'Aguardando Aprovação',
  aprovado:                  'Aprovado',
  reprovado:                 'Reprovado',
  em_execucao:               'Em Execução',
  concluido:                 'Concluído',
  cancelado:                 'Cancelado',
}

export const REQUEST_CHANNEL_LABELS: Record<string, string> = {
  email:   'E-mail',
  sei:     'SEI',
  chamado: 'Chamado',
}

// Função para traduzir os tipos de ações de auditoria
export const translateActionType = (type: string): string => {
    const typeMap: { [key: string]: string } = {
      'login_success': 'Login Bem-Sucedido',
      'login_failed': 'Falha no Login',
      'logout': 'Logout',
      'user_created': 'Criação de Usuário',
      'update_user_success': 'Atualização de Usuário',
      'delete_user_success': 'Exclusão de Usuário',
      'password_change_success': 'Alteração de Senha',
      'create_movement_loan': 'Criação de Empréstimo',
      'create_movement_exit': 'Criação de Saída',
      'create_movement_return': 'Criação de Devolução',
      'confirm_delivery': 'Confirmação de Entrega',
      'renew_loan': 'Renovação de Empréstimo',
      'asset_substitution': 'Substituição de Ativo',
      'asset_kit_substitution': 'Substituição de Kit',
      'create_asset': 'Criação de Ativo',
      'update_asset': 'Atualização de Ativo',
      'delete_asset': 'Exclusão de Ativo',
      'retire_asset': 'Baixa de Ativo',
      'dispose_asset': 'Descarte de Ativo',
      'import_assets': 'Importação de Ativos',
      'request_retirement': 'Solicitação de Baixa',
      'approve_retirement': 'Aprovação de Baixa',
      'reject_retirement': 'Rejeição de Baixa',
      'unauthorized_access': 'Acesso Não Autorizado',
      'generate_report': 'Geração de Relatório',
    };
    return typeMap[type] || type.replace(/_/g, ' ');
};