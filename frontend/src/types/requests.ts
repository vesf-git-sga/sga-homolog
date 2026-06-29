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
  | 'indisponivel_estoque'

export type InputChannel = 'email' | 'sei' | 'chamado'

export interface CatalogBrand { id: number; name: string }
export interface CatalogModel { id: number; name: string; brand_id: number; item_type_id: number }
export interface ItemType     { id: number; name: string; code: string }

export interface RequestCatalogItem {
  id: number
  request_id: number
  item_type_id: number
  item_type_name: string
  brand_id?: number | null
  brand_name?: string | null
  model_id?: number | null
  model_name?: string | null
  description?: string | null
  quantity: number
  created_at: string
}

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
  oficio_path?: string | null
  oficio_original_name?: string | null
  created_by: number
  created_by_name?: string
  approved_by?: number | null
  approved_by_name?: string | null
  approved_at?: string | null
  dit_ciente_at?: string | null
  dit_ciente_by?: number | null
  dit_ciente_by_name?: string | null
  dit_modalidade?: 'entrega' | 'retirada' | null
  dit_previsao_at?: string | null
  dit_eventos?: DitEvento[]
  created_at: string
  updated_at: string
  // carregados via getById
  items?: RequestCatalogItem[]
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
  scheduled_time?: string | null
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
  delivery_status: string
  responsible_name?: string
  asset_count: number
  created_at: string
}

export interface UnavailableQueueEntry {
  id: number
  protocol: string
  type: RequestType
  unit_name: string
  unit_rpa?: string | null
  requester_name: string
  unavailable_since?: string | null
  items: Array<{
    item_type_name: string
    brand_name?: string | null
    model_name?: string | null
    quantity: number
  }>
}

export interface DitEvento {
  id: number
  tipo: 'ciente' | 'reagendamento' | 'observacao'
  modalidade?: 'entrega' | 'retirada' | null
  data_anterior?: string | null
  nova_data?: string | null
  motivo?: string | null
  changed_by_name?: string | null
  changed_at: string
}

export interface VisitRouteEntry {
  id: number
  protocol: string
  type: RequestType
  unit_name: string
  unit_rpa?: string | null
  unit_address?: string | null
  requester_name: string
  visit_id?: number | null
  scheduled_date?: string | null
  scheduled_time?: string | null
  assigned_to_name?: string | null
}
