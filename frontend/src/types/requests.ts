export type RequestType = 'emprestimo' | 'substituicao' | 'acrescimo'

export type RequestStatus =
  | 'requisitado'
  | 'visita_tecnica_solicitada'
  | 'visita_realizada'
  | 'aguardando_aprovacao'
  | 'aprovado'
  | 'reprovado'
  | 'em_execucao'
  | 'concluido'
  | 'cancelado'

export type InputChannel = 'email' | 'sei' | 'chamado'

export interface EquipmentRequest {
  id: number
  protocol: string
  type: RequestType
  status: RequestStatus
  input_channel: InputChannel
  input_channel_details?: string | null
  requester_person_id: number
  requester_name?: string
  unit_id: number
  unit_name?: string
  unit_rpa?: string
  fundamentacao?: 'avaria' | 'necessidade_operacional' | null
  notes?: string | null
  created_by: number
  created_by_name?: string
  approved_by?: number | null
  approved_by_name?: string | null
  approved_at?: string | null
  created_at: string
  updated_at: string
  // carregados via getById
  visits?: TechnicalVisit[]
  history?: StatusHistoryEntry[]
  movements?: LinkedMovement[]
  allowed_transitions?: RequestStatus[]
}

export interface TechnicalVisit {
  id: number
  request_id: number
  assigned_to?: number | null
  assigned_to_name?: string | null
  scheduled_date?: string | null
  result?: 'constatada' | 'nao_constatada' | null
  findings?: string | null
  completed_by?: number | null
  completed_by_name?: string | null
  completed_at?: string | null
  created_by: number
  created_by_name?: string
  created_at: string
}

export interface StatusHistoryEntry {
  id: number
  request_id: number
  old_status?: string | null
  new_status: string
  notes?: string | null
  changed_by: number
  changed_by_name?: string
  changed_at: string
}

export interface LinkedMovement {
  id: number
  movement_type: string
  status: string
  delivery_status: string
  responsible_name?: string
  asset_count: number
  created_at: string
}
