// components/FeedbackManagementPage.tsx
// Tela de gestão de feedbacks (admin/manager)

import React, { useCallback, useEffect, useState } from 'react'
import {
  RefreshCw,
  Search,
  MessageSquare,
  Send,
  Loader2,
  X,
  CheckCircle2,
} from 'lucide-react'
import { feedbacksApi } from '../services/feedbacksApi'
import { Feedback, FeedbackStatus, FeedbackTipo } from '../types/feedback'
import {
  FEEDBACK_STATUS_LABELS,
  FEEDBACK_TIPO_LABELS,
  feedbackStatusBadgeClass,
  feedbackTipoBadgeClass,
} from '../utils/feedbackLabels'

interface FeedbackManagementPageProps {
  currentUserId: number
  addToast: (message: string, type?: 'success' | 'error' | 'info' | 'warning') => void
}

const TIPOS: FeedbackTipo[] = ['reclamacao', 'elogio', 'observacao', 'duvida']
const STATUSES: FeedbackStatus[] = ['aberto', 'respondido', 'encerrado']

const FeedbackManagementPage: React.FC<FeedbackManagementPageProps> = ({
  currentUserId,
  addToast,
}) => {
  const [items, setItems] = useState<Feedback[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Feedback | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [reply, setReply] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const [filterTipo, setFilterTipo] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterPage, setFilterPage] = useState('')
  const [filterSearch, setFilterSearch] = useState('')
  const [filterDateFrom, setFilterDateFrom] = useState('')
  const [filterDateTo, setFilterDateTo] = useState('')

  const loadList = useCallback(async () => {
    setLoading(true)
    try {
      const data = await feedbacksApi.list({
        tipo: filterTipo || undefined,
        status: filterStatus || undefined,
        page_context: filterPage || undefined,
        search: filterSearch || undefined,
        date_from: filterDateFrom || undefined,
        date_to: filterDateTo || undefined,
      })
      setItems(data)
    } catch (err: any) {
      addToast(err.response?.data?.message || 'Erro ao listar feedbacks.', 'error')
    } finally {
      setLoading(false)
    }
  }, [
    addToast,
    filterTipo,
    filterStatus,
    filterPage,
    filterSearch,
    filterDateFrom,
    filterDateTo,
  ])

  useEffect(() => {
    loadList()
  }, [loadList])

  const openDetail = async (id: number) => {
    setLoadingDetail(true)
    setReply('')
    try {
      const data = await feedbacksApi.getById(id)
      setSelected(data)
    } catch (err: any) {
      addToast(err.response?.data?.message || 'Erro ao abrir feedback.', 'error')
    } finally {
      setLoadingDetail(false)
    }
  }

  const handleReply = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selected || !reply.trim()) return
    setSubmitting(true)
    try {
      const updated = await feedbacksApi.addMessage(selected.id, reply.trim())
      setSelected(updated)
      setReply('')
      addToast('Resposta enviada.', 'success')
      loadList()
    } catch (err: any) {
      addToast(err.response?.data?.message || 'Erro ao responder.', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const handleStatus = async (status: FeedbackStatus) => {
    if (!selected) return
    setSubmitting(true)
    try {
      const updated = await feedbacksApi.changeStatus(selected.id, status)
      setSelected(updated)
      addToast(`Status atualizado para ${FEEDBACK_STATUS_LABELS[status]}.`, 'success')
      loadList()
    } catch (err: any) {
      addToast(err.response?.data?.message || 'Erro ao alterar status.', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Gestão de Feedbacks</h1>
          <p className="text-sm text-gray-500">
            Consulte, responda e encerre reclamações, elogios, observações e dúvidas.
          </p>
        </div>
        <button
          type="button"
          onClick={loadList}
          className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          <RefreshCw className="h-4 w-4" />
          Atualizar
        </button>
      </div>

      <div className="grid grid-cols-1 gap-3 rounded-2xl border border-gray-200 bg-white p-4 md:grid-cols-3 lg:grid-cols-6">
        <div>
          <label className="mb-1 block text-xs font-semibold text-gray-500">Tipo</label>
          <select
            value={filterTipo}
            onChange={(e) => setFilterTipo(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-2 py-2 text-sm"
          >
            <option value="">Todos</option>
            {TIPOS.map((t) => (
              <option key={t} value={t}>
                {FEEDBACK_TIPO_LABELS[t]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-gray-500">Status</label>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-2 py-2 text-sm"
          >
            <option value="">Todos</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {FEEDBACK_STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-gray-500">Página</label>
          <input
            value={filterPage}
            onChange={(e) => setFilterPage(e.target.value)}
            placeholder="Ex: Dashboard"
            className="w-full rounded-lg border border-gray-300 px-2 py-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-gray-500">De</label>
          <input
            type="date"
            value={filterDateFrom}
            onChange={(e) => setFilterDateFrom(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-2 py-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-gray-500">Até</label>
          <input
            type="date"
            value={filterDateTo}
            onChange={(e) => setFilterDateTo(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-2 py-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-gray-500">Busca</label>
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-400" />
            <input
              value={filterSearch}
              onChange={(e) => setFilterSearch(e.target.value)}
              placeholder="Usuário ou texto"
              className="w-full rounded-lg border border-gray-300 py-2 pl-8 pr-2 text-sm"
            />
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        {loading ? (
          <div className="flex justify-center py-16 text-gray-400">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : items.length === 0 ? (
          <p className="py-16 text-center text-sm text-gray-500">
            Nenhum feedback encontrado com os filtros atuais.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-4 py-3">ID</th>
                  <th className="px-4 py-3">Tipo</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Usuário</th>
                  <th className="px-4 py-3">Página</th>
                  <th className="px-4 py-3">Prévia</th>
                  <th className="px-4 py-3">Atualizado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {items.map((item) => (
                  <tr
                    key={item.id}
                    onClick={() => openDetail(item.id)}
                    className="cursor-pointer hover:bg-blue-50"
                  >
                    <td className="px-4 py-3 font-medium text-gray-700">#{item.id}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-semibold ${feedbackTipoBadgeClass(item.tipo)}`}
                      >
                        {FEEDBACK_TIPO_LABELS[item.tipo]}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-semibold ${feedbackStatusBadgeClass(item.status)}`}
                      >
                        {FEEDBACK_STATUS_LABELS[item.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      {item.user_full_name || item.user_username}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{item.page_context}</td>
                    <td className="max-w-xs truncate px-4 py-3 text-gray-600">
                      {item.first_message}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-gray-500">
                      {formatDate(item.updated_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {(selected || loadingDetail) && (
        <div className="fixed inset-0 z-[1001] flex items-center justify-center bg-gray-900 bg-opacity-75 p-4">
          <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
              <div>
                <h2 className="text-lg font-bold text-gray-800">
                  Feedback #{selected?.id || '…'}
                </h2>
                {selected && (
                  <p className="text-xs text-gray-500">
                    {selected.user_full_name || selected.user_username} ·{' '}
                    {selected.page_context}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="rounded-lg p-1 text-gray-500 hover:bg-gray-100"
                aria-label="Fechar"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto p-5">
              {loadingDetail || !selected ? (
                <div className="flex justify-center py-12 text-gray-400">
                  <Loader2 className="h-7 w-7 animate-spin" />
                </div>
              ) : (
                <>
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-semibold ${feedbackTipoBadgeClass(selected.tipo)}`}
                    >
                      {FEEDBACK_TIPO_LABELS[selected.tipo]}
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-semibold ${feedbackStatusBadgeClass(selected.status)}`}
                    >
                      {FEEDBACK_STATUS_LABELS[selected.status]}
                    </span>
                    <span className="text-xs text-gray-400">
                      Criado em {formatDate(selected.created_at)}
                    </span>
                  </div>

                  <div className="space-y-3">
                    {(selected.messages || []).map((msg) => {
                      const isStaffMsg = msg.author_id !== selected.user_id
                      return (
                        <div
                          key={msg.id}
                          className={`rounded-xl px-3 py-2 text-sm ${
                            isStaffMsg
                              ? 'ml-6 bg-violet-50 text-gray-800'
                              : 'mr-6 bg-gray-100 text-gray-800'
                          }`}
                        >
                          <div className="mb-1 flex items-center gap-1 text-xs font-semibold text-gray-500">
                            <MessageSquare className="h-3 w-3" />
                            {msg.author_id === currentUserId
                              ? 'Você'
                              : msg.author_full_name || msg.author_username}
                            <span className="font-normal text-gray-400">
                              · {formatDate(msg.created_at)}
                            </span>
                          </div>
                          <p className="whitespace-pre-wrap">{msg.body}</p>
                        </div>
                      )
                    })}
                  </div>
                </>
              )}
            </div>

            {selected && (
              <div className="space-y-3 border-t border-gray-100 p-5">
                <div className="flex flex-wrap gap-2">
                  {selected.status !== 'encerrado' && (
                    <button
                      type="button"
                      disabled={submitting}
                      onClick={() => handleStatus('encerrado')}
                      className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Arquivar
                    </button>
                  )}
                  {selected.status === 'encerrado' && (
                    <button
                      type="button"
                      disabled={submitting}
                      onClick={() => handleStatus('respondido')}
                      className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60"
                    >
                      Reabrir
                    </button>
                  )}
                </div>

                {selected.status !== 'encerrado' ? (
                  <form onSubmit={handleReply} className="flex gap-2">
                    <textarea
                      value={reply}
                      onChange={(e) => setReply(e.target.value)}
                      rows={2}
                      maxLength={5000}
                      placeholder="Escreva a resposta..."
                      className="flex-1 rounded-xl border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                      required
                    />
                    <button
                      type="submit"
                      disabled={submitting || !reply.trim()}
                      className="inline-flex items-center gap-2 self-end rounded-xl bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-60"
                    >
                      {submitting ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4" />
                      )}
                      Responder
                    </button>
                  </form>
                ) : (
                  <p className="text-xs text-gray-500">
                    Feedback arquivado. Reabra para responder novamente.
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default FeedbackManagementPage
