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
  CatalogBrand,
  CatalogModel,
  ItemType,
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

export interface RequestItemPayload {
  item_type_id: number
  brand_id?: number | null
  model_id?: number | null
  description?: string
  quantity: number
}

export interface ScheduleVisitPayload {
  assigned_to?: number
  scheduled_date?: string
  scheduled_time?: string
}

export interface UpdateVisitSchedulePayload {
  assigned_to?: number
  scheduled_date?: string
  scheduled_time?: string
}

export interface CompleteVisitPayload {
  result: 'constatada' | 'nao_constatada'
  findings?: string
}

export interface UpdateVisitResultPayload {
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

  // Criação via multipart/form-data (inclui ofício + itens serializados)
  create: (formData: FormData) =>
    axios.post<EquipmentRequest>(`${API_URL}/requests`, formData).then(r => r.data),

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

  updateVisitSchedule: (requestId: number, visitId: number, payload: UpdateVisitSchedulePayload) =>
    axios.patch<TechnicalVisit>(`${API_URL}/requests/${requestId}/technical-visits/${visitId}/schedule`, payload).then(r => r.data),

  updateVisitResult: (requestId: number, visitId: number, payload: UpdateVisitResultPayload) =>
    axios.patch<TechnicalVisit>(`${API_URL}/requests/${requestId}/technical-visits/${visitId}/result`, payload).then(r => r.data),

  listUsers: () =>
    axios.get<{ id: number; full_name: string; username: string }[]>(`${API_URL}/users`).then(r => r.data),

  // Pré-preenchimento no form de movimentação
  getApprovedPrefill: (id: number) =>
    axios.get<ApprovedPrefill>(`${API_URL}/requests/${id}/approved-prefill`).then(r => r.data),

  // ─── Catálogo ───────────────────────────────────────────────────────────
  listItemTypes: () =>
    axios.get<ItemType[]>(`${API_URL}/item-types`).then(r => r.data),

  listBrands: (item_type_id?: number) =>
    axios.get<CatalogBrand[]>(`${API_URL}/catalog/brands`, { params: item_type_id ? { item_type_id } : {} }).then(r => r.data),

  listModels: (brand_id: number, item_type_id: number) =>
    axios.get<CatalogModel[]>(`${API_URL}/catalog/models`, { params: { brand_id, item_type_id } }).then(r => r.data),

  createBrand: (name: string) =>
    axios.post<CatalogBrand>(`${API_URL}/catalog/brands`, { name }).then(r => r.data),

  createModel: (name: string, brand_id: number, item_type_id: number) =>
    axios.post<CatalogModel>(`${API_URL}/catalog/models`, { name, brand_id, item_type_id }).then(r => r.data),
}
