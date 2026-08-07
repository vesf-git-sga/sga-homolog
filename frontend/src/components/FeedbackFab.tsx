// components/FeedbackFab.tsx
// Botão flutuante global + criar feedback + meus feedbacks (thread)

import React, { useCallback, useEffect, useState } from 'react'
import {
  MessageCirclePlus,
  X,
  Send,
  Inbox,
  MessageSquare,
  ChevronLeft,
  Loader2,
  Archive,
} from 'lucide-react'
import { feedbacksApi } from '../services/feedbacksApi'
import { Feedback, FeedbackTipo } from '../types/feedback'
import {
  FEEDBACK_STATUS_LABELS,
  FEEDBACK_TIPO_LABELS,
  feedbackStatusBadgeClass,
  feedbackTipoBadgeClass,
  resolvePageContextLabel,
} from '../utils/feedbackLabels'

interface FeedbackFabProps {
  activeMenu: string
  currentUserId: number
  addToast: (message: string, type?: 'success' | 'error' | 'info' | 'warning') => void
}

type PanelView = 'menu' | 'create' | 'mine' | 'detail'

const TIPOS: FeedbackTipo[] = ['reclamacao', 'elogio', 'observacao', 'duvida']

const FeedbackFab: React.FC<FeedbackFabProps> = ({ activeMenu, currentUserId, addToast }) => {
  const [open, setOpen] = useState(false)
  const [view, setView] = useState<PanelView>('menu')
  const [tipo, setTipo] = useState<FeedbackTipo>('duvida')
  const [body, setBody] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [mine, setMine] = useState<Feedback[]>([])
  const [loadingMine, setLoadingMine] = useState(false)
  const [selected, setSelected] = useState<Feedback | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)

  const pageLabel = resolvePageContextLabel(activeMenu)

  const resetCreate = () => {
    setTipo('duvida')
    setBody('')
  }

  const closePanel = () => {
    setOpen(false)
    setView('menu')
    setSelected(null)
    resetCreate()
  }

  const loadMine = useCallback(async () => {
    setLoadingMine(true)
    try {
      const data = await feedbacksApi.listMine()
      setMine(data)
    } catch {
      addToast('Erro ao carregar seus feedbacks.', 'error')
    } finally {
      setLoadingMine(false)
    }
  }, [addToast])

  useEffect(() => {
    if (open && view === 'mine') {
      loadMine()
    }
  }, [open, view, loadMine])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!body.trim()) {
      addToast('Informe a mensagem.', 'warning')
      return
    }
    setSubmitting(true)
    try {
      await feedbacksApi.create({
        tipo,
        page_context: pageLabel,
        body: body.trim(),
      })
      addToast('Feedback registrado com sucesso!', 'success')
      resetCreate()
      setView('mine')
    } catch (err: any) {
      addToast(err.response?.data?.message || 'Erro ao registrar feedback.', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const openDetail = async (id: number) => {
    setLoadingDetail(true)
    setView('detail')
    try {
      const data = await feedbacksApi.getById(id)
      setSelected(data)
    } catch (err: any) {
      addToast(err.response?.data?.message || 'Erro ao abrir feedback.', 'error')
      setView('mine')
    } finally {
      setLoadingDetail(false)
    }
  }

  const handleArchive = async () => {
    if (!selected || selected.status === 'encerrado') return
    setSubmitting(true)
    try {
      const updated = await feedbacksApi.changeStatus(selected.id, 'encerrado')
      setSelected(updated)
      setMine((prev) =>
        prev.map((item) =>
          item.id === updated.id ? { ...item, status: updated.status, updated_at: updated.updated_at } : item
        )
      )
      addToast('Feedback arquivado.', 'success')
    } catch (err: any) {
      addToast(err.response?.data?.message || 'Erro ao arquivar feedback.', 'error')
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
    <>
      <button
        type="button"
        onClick={() => {
          if (open) closePanel()
          else {
            setOpen(true)
            setView('menu')
          }
        }}
        className="fixed bottom-6 right-6 z-[1100] flex h-14 w-14 items-center justify-center rounded-full bg-yellow-400 text-gray-900 shadow-lg hover:bg-yellow-500 focus:outline-none focus:ring-4 focus:ring-yellow-200"
        title="Feedback"
        aria-label="Abrir feedback"
      >
        {open ? <X className="h-6 w-6" /> : <MessageCirclePlus className="h-6 w-6" />}
      </button>

      {open && (
        <div className="fixed bottom-24 right-6 z-[1100] flex w-[min(100vw-2rem,420px)] max-h-[min(80vh,640px)] flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl">
          <div className="flex items-center justify-between border-b border-yellow-200 bg-yellow-400 px-4 py-3 text-gray-900">
            <div className="flex items-center gap-2">
              {view !== 'menu' && (
                <button
                  type="button"
                  onClick={() => {
                    if (view === 'detail') {
                      setSelected(null)
                      setView('mine')
                    } else {
                      setView('menu')
                    }
                  }}
                  className="rounded-lg p-1 hover:bg-yellow-500"
                  aria-label="Voltar"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
              )}
              <div>
                <p className="text-sm font-semibold">
                  {view === 'menu' && 'Feedback'}
                  {view === 'create' && 'Novo registro'}
                  {view === 'mine' && 'Meus feedbacks'}
                  {view === 'detail' && 'Detalhe'}
                </p>
                {view === 'create' && (
                  <p className="text-xs text-yellow-900/70">Página: {pageLabel}</p>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={closePanel}
              className="rounded-lg p-1 hover:bg-yellow-500"
              aria-label="Fechar"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            {view === 'menu' && (
              <div className="space-y-3">
                <button
                  type="button"
                  onClick={() => setView('create')}
                  className="flex w-full items-center gap-3 rounded-xl border border-gray-200 p-4 text-left hover:border-blue-300 hover:bg-blue-50"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 text-blue-700">
                    <Send className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-800">Registrar feedback</p>
                    <p className="text-xs text-gray-500">
                      Reclamação, elogio, observação ou dúvida
                    </p>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setView('mine')}
                  className="flex w-full items-center gap-3 rounded-xl border border-gray-200 p-4 text-left hover:border-blue-300 hover:bg-blue-50"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-100 text-violet-700">
                    <Inbox className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-800">Meus feedbacks</p>
                    <p className="text-xs text-gray-500">Ver respostas e histórico</p>
                  </div>
                </button>
              </div>
            )}

            {view === 'create' && (
              <form onSubmit={handleCreate} className="space-y-4">
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Tipo
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {TIPOS.map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setTipo(t)}
                        className={`rounded-lg border px-3 py-2 text-sm font-medium ${
                          tipo === t
                            ? 'border-blue-600 bg-blue-600 text-white'
                            : 'border-gray-200 text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        {FEEDBACK_TIPO_LABELS[t]}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Mensagem
                  </label>
                  <textarea
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    rows={5}
                    maxLength={5000}
                    placeholder="Descreva sua reclamação, elogio, observação ou dúvida..."
                    className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm text-gray-800 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                    required
                  />
                </div>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-60"
                >
                  {submitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                  Enviar
                </button>
              </form>
            )}

            {view === 'mine' && (
              <div className="space-y-3">
                {loadingMine ? (
                  <div className="flex justify-center py-8 text-gray-400">
                    <Loader2 className="h-6 w-6 animate-spin" />
                  </div>
                ) : mine.length === 0 ? (
                  <p className="py-8 text-center text-sm text-gray-500">
                    Você ainda não registrou nenhum feedback.
                  </p>
                ) : (
                  mine.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => openDetail(item.id)}
                      className="w-full rounded-xl border border-gray-200 p-3 text-left hover:border-blue-300 hover:bg-blue-50"
                    >
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-semibold ${feedbackTipoBadgeClass(item.tipo)}`}
                        >
                          {FEEDBACK_TIPO_LABELS[item.tipo]}
                        </span>
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-semibold ${feedbackStatusBadgeClass(item.status)}`}
                        >
                          {FEEDBACK_STATUS_LABELS[item.status]}
                        </span>
                      </div>
                      <p className="line-clamp-2 text-sm text-gray-700">
                        {item.first_message}
                      </p>
                      <p className="mt-2 text-xs text-gray-400">
                        {item.page_context} · {formatDate(item.updated_at)}
                      </p>
                    </button>
                  ))
                )}
              </div>
            )}

            {view === 'detail' && (
              <div className="space-y-4">
                {loadingDetail || !selected ? (
                  <div className="flex justify-center py-8 text-gray-400">
                    <Loader2 className="h-6 w-6 animate-spin" />
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
                    </div>
                    <p className="text-xs text-gray-500">
                      Página: {selected.page_context} · Criado em{' '}
                      {formatDate(selected.created_at)}
                    </p>
                    <div className="space-y-3">
                      {(selected.messages || []).map((msg) => {
                        const isMine = msg.author_id === currentUserId
                        return (
                          <div
                            key={msg.id}
                            className={`rounded-xl px-3 py-2 text-sm ${
                              isMine
                                ? 'ml-4 bg-yellow-50 text-gray-800'
                                : 'mr-4 bg-gray-100 text-gray-800'
                            }`}
                          >
                            <div className="mb-1 flex items-center gap-1 text-xs font-semibold text-gray-500">
                              <MessageSquare className="h-3 w-3" />
                              {isMine
                                ? 'Você'
                                : msg.author_full_name || msg.author_username || 'Equipe'}
                              <span className="font-normal text-gray-400">
                                · {formatDate(msg.created_at)}
                              </span>
                            </div>
                            <p className="whitespace-pre-wrap">{msg.body}</p>
                          </div>
                        )
                      })}
                    </div>

                    {selected.status !== 'encerrado' ? (
                      <button
                        type="button"
                        onClick={handleArchive}
                        disabled={submitting}
                        className="flex w-full items-center justify-center gap-2 rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60"
                      >
                        {submitting ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Archive className="h-4 w-4" />
                        )}
                        Arquivar
                      </button>
                    ) : (
                      <p className="rounded-xl bg-gray-50 px-3 py-2 text-center text-xs text-gray-500">
                        Este feedback está arquivado.
                      </p>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}

export default FeedbackFab
