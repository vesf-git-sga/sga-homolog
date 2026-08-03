// services/feedbacksApi.ts
// Autorização (Bearer token) aplicada pelo interceptor global do axios (App.tsx).

import axios from 'axios'
import {
  CreateFeedbackPayload,
  Feedback,
  FeedbackListFilters,
  FeedbackStatus,
} from '../types/feedback'

let API_URL = process.env.REACT_APP_API_URL || `http://${window.location.hostname}:5000/api`
API_URL = API_URL.replace(/\/$/, '')
if (!API_URL.endsWith('/api')) API_URL = `${API_URL}/api`

export const feedbacksApi = {
  create: async (payload: CreateFeedbackPayload): Promise<Feedback> => {
    const { data } = await axios.post(`${API_URL}/feedbacks`, payload)
    return data
  },

  listMine: async (): Promise<Feedback[]> => {
    const { data } = await axios.get(`${API_URL}/feedbacks/mine`)
    return data
  },

  list: async (filters: FeedbackListFilters = {}): Promise<Feedback[]> => {
    const { data } = await axios.get(`${API_URL}/feedbacks`, { params: filters })
    return data
  },

  getById: async (id: number): Promise<Feedback> => {
    const { data } = await axios.get(`${API_URL}/feedbacks/${id}`)
    return data
  },

  addMessage: async (id: number, body: string): Promise<Feedback> => {
    const { data } = await axios.post(`${API_URL}/feedbacks/${id}/messages`, { body })
    return data
  },

  changeStatus: async (id: number, status: FeedbackStatus): Promise<Feedback> => {
    const { data } = await axios.patch(`${API_URL}/feedbacks/${id}/status`, { status })
    return data
  },
}
