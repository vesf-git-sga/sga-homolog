// types/feedback.ts

export type FeedbackTipo = 'reclamacao' | 'elogio' | 'observacao' | 'duvida'
export type FeedbackStatus = 'aberto' | 'respondido' | 'encerrado'

export interface FeedbackMessage {
  id: number
  feedback_id: number
  author_id: number
  body: string
  created_at: string
  author_full_name?: string
  author_username?: string
  author_role?: string
}

export interface Feedback {
  id: number
  user_id: number
  tipo: FeedbackTipo
  status: FeedbackStatus
  page_context: string
  created_at: string
  updated_at: string
  user_full_name?: string
  user_username?: string
  user_email?: string
  user_role?: string
  message_count?: number
  first_message?: string
  messages?: FeedbackMessage[]
}

export interface FeedbackListFilters {
  status?: string
  tipo?: string
  user_id?: number
  page_context?: string
  search?: string
  date_from?: string
  date_to?: string
}

export interface CreateFeedbackPayload {
  tipo: FeedbackTipo
  page_context: string
  body: string
}
