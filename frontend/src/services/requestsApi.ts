// services/requestsApi.ts
// Camada de acesso à API do módulo de Solicitações de TI.
// Autorização (Bearer token) aplicada pelo interceptor global do axios (App.tsx).

import axios from 'axios'
import {
  EquipmentRequest,
  TechnicalVisit,
  StatusHistoryEntry,
  RequestStatus,
  RequestType,
  InputChannel,
} from '../types/requests'

let API_URL = process.env.REACT_APP_API_URL || `http://${window.location.hostname}:5000/api`
API_URL = API_URL.replace(/\/$/, '')
if (!API_URL.endsWith('/api')) API_URL = `${API_URL}/api`

export interface RequestListFilters {
  status?: string
  type?: string
  unit_id?: number
  search?: string
}

export interface CreateRequestPayload {
  type: RequestType
  input_channel: InputChannel
  input_channel_details?: string
  requester_person_id: number
  unit_id: number
  fundamentacao?: 'avaria' | 'necessidade_operacional'
  notes?: string
}

export interface ScheduleVisitPayload {
  assigned_to?: number
  scheduled_date?: string
}

export interface CompleteVisitPayload {
  result: 'constatada' | 'nao_constatada'
  findings?: string
}

export interface ApprovedPrefill {
  id: number
  protocol: string
  type: RequestType
  status: RequestStatus
  unit_id: number
  requester_person_id: number
}

export const requestsApi = {
  list: (filters?: RequestListFilters) =>
    axios.get<EquipmentRequest[]>(`${API_URL}/requests`, { params: filters }).then(r => r.data),

  getById: (id: number) =>
    axios.get<EquipmentRequest>(`${API_URL}/requests/${id}`).then(r => r.data),

  create: (payload: CreateRequestPayload) =>
    axios.post<EquipmentRequest>(`${API_URL}/requests`, payload).then(r => r.data),

  changeStatus: (id: number, status: RequestStatus, notes?: string) =>
    axios.patch<EquipmentRequest>(`${API_URL}/requests/${id}/status`, { status, notes }).then(r => r.data),

  getHistory: (id: number) =>
    axios.get<StatusHistoryEntry[]>(`${API_URL}/requests/${id}/history`).then(r => r.data),

  // Visitas técnicas
  listVisits: (id: number) =>
    axios.get<TechnicalVisit[]>(`${API_URL}/requests/${id}/technical-visits`).then(r => r.data),

  scheduleVisit: (id: number, payload: ScheduleVisitPayload) =>
    axios.post<TechnicalVisit>(`${API_URL}/requests/${id}/technical-visits`, payload).then(r => r.data),

  completeVisit: (requestId: number, visitId: number, payload: CompleteVisitPayload) =>
    axios.patch(`${API_URL}/requests/${requestId}/technical-visits/${visitId}/complete`, payload).then(r => r.data),

  // Pré-preenchimento no form de movimentação
  getApprovedPrefill: (id: number) =>
    axios.get<ApprovedPrefill>(`${API_URL}/requests/${id}/approved-prefill`).then(r => r.data),
}
