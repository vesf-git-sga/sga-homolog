// utils/feedbackLabels.ts

import { FeedbackStatus, FeedbackTipo } from '../types/feedback'

export const FEEDBACK_TIPO_LABELS: Record<FeedbackTipo, string> = {
  reclamacao: 'Reclamação',
  elogio: 'Elogio',
  observacao: 'Observação',
  duvida: 'Dúvida',
}

export const FEEDBACK_STATUS_LABELS: Record<FeedbackStatus, string> = {
  aberto: 'Aberto',
  respondido: 'Respondido',
  encerrado: 'Arquivado',
}

/** Mapa activeMenu → rótulo legível para page_context */
export const PAGE_CONTEXT_LABELS: Record<string, string> = {
  dashboard: 'Dashboard',
  'item-types': 'Tipos de Itens',
  units: 'Unidades',
  people: 'Pessoas',
  assets: 'Ativos',
  'action-register-movement': 'Registrar Movimentação',
  'manage-external': 'Gerenciar Movimentações',
  'batch-collection': 'Logística Reversa (Coleta)',
  'requests-ti': 'Solicitações de TI',
  'retire-dispose': 'Baixas e Descartes',
  'tablet-delivery': 'Entrega de Tablets',
  'tablet-dashboard': 'Monitoramento (Tablets)',
  'executive-dashboard': 'Painel Executivo',
  'tablet-audit': 'Auditoria / Busca (Tablets)',
  'pending-terms': 'Termos Pendentes',
  queries: 'Consultas',
  'cd-inventory': 'Estoque do CD',
  reports: 'Relatórios',
  audit: 'Auditoria de Sistema',
  settings: 'Configurações',
  analytics: 'Analytics',
  'feedback-management': 'Gestão de Feedbacks',
}

export function resolvePageContextLabel(activeMenu: string): string {
  return PAGE_CONTEXT_LABELS[activeMenu] || activeMenu
}

export function feedbackTipoBadgeClass(tipo: FeedbackTipo): string {
  switch (tipo) {
    case 'reclamacao':
      return 'bg-red-100 text-red-800'
    case 'elogio':
      return 'bg-emerald-100 text-emerald-800'
    case 'observacao':
      return 'bg-amber-100 text-amber-800'
    case 'duvida':
      return 'bg-sky-100 text-sky-800'
    default:
      return 'bg-gray-100 text-gray-800'
  }
}

export function feedbackStatusBadgeClass(status: FeedbackStatus): string {
  switch (status) {
    case 'aberto':
      return 'bg-blue-100 text-blue-800'
    case 'respondido':
      return 'bg-violet-100 text-violet-800'
    case 'encerrado':
      return 'bg-gray-200 text-gray-700'
    default:
      return 'bg-gray-100 text-gray-800'
  }
}
