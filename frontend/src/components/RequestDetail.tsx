import React, { useState, useEffect, useCallback } from 'react'
import { X, Calendar, CheckCircle, XCircle, Clock, Truck, ChevronRight, ArrowRight } from 'lucide-react'
import { useToast } from '../App'
import StatusBadge from './StatusBadge'
import { requestsApi } from '../services/requestsApi'
import { EquipmentRequest, TechnicalVisit, StatusHistoryEntry, LinkedMovement, RequestStatus } from '../types/requests'
import { REQUEST_TYPE_LABELS, REQUEST_CHANNEL_LABELS, REQUEST_STATUS_LABELS } from '../utils/translations'

interface RequestDetailProps {
  requestId: number
  currentUserRole: string
  onClose: () => void
}

// ─── Labels de ação por transição ──────────────────────────────────────────
const TRANSITION_LABELS: Record<string, string> = {
  visita_tecnica_solicitada: 'Solicitar Visita Técnica',
  aguardando_aprovacao:      'Encaminhar para Aprovação',
  aprovado:                  'Aprovar',
  reprovado:                 'Reprovar',
  em_execucao:               'Marcar em Execução',
  concluido:                 'Concluir',
  cancelado:                 'Cancelar',
}

const TRANSITION_STYLES: Record<string, string> = {
  aprovado:             'bg-green-600 hover:bg-green-700 text-white',
  reprovado:            'bg-red-600 hover:bg-red-700 text-white',
  cancelado:            'bg-gray-500 hover:bg-gray-600 text-white',
  visita_tecnica_solicitada: 'bg-purple-600 hover:bg-purple-700 text-white',
  aguardando_aprovacao: 'bg-yellow-600 hover:bg-yellow-700 text-white',
  em_execucao:          'bg-orange-600 hover:bg-orange-700 text-white',
  concluido:            'bg-teal-600 hover:bg-teal-700 text-white',
}

// ─── Linha do tempo ─────────────────────────────────────────────────────────
const TimelineEntry = ({ entry }: { entry: StatusHistoryEntry }) => (
  <div className="flex gap-3">
    <div className="flex flex-col items-center">
      <div className="w-3 h-3 rounded-full bg-blue-400 mt-1 shrink-0" />
      <div className="w-px flex-1 bg-gray-200 mt-1" />
    </div>
    <div className="pb-4">
      <div className="flex items-center gap-2 flex-wrap">
        {entry.old_status && (
          <>
            <StatusBadge status={entry.old_status} />
            <ArrowRight size={12} className="text-gray-400" />
          </>
        )}
        <StatusBadge status={entry.new_status} />
      </div>
      {entry.notes && <p className="text-xs text-gray-500 mt-1">{entry.notes}</p>}
      <p className="text-xs text-gray-400 mt-1">
        {entry.changed_by_name} · {new Date(entry.changed_at).toLocaleString('pt-BR')}
      </p>
    </div>
  </div>
)

// ─── Card de movimentação vinculada ─────────────────────────────────────────
const MovementCard = ({ m }: { m: LinkedMovement }) => {
  const typeLabels: Record<string, string> = {
    loan: 'Empréstimo', exit: 'Saída', return: 'Devolução', maintenance: 'Manutenção', entry: 'Entrada',
  }
  return (
    <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-100">
      <Truck size={16} className="text-gray-400 shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-700">#{m.id}</span>
          <span className="text-xs text-gray-500">{typeLabels[m.movement_type] || m.movement_type}</span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">{m.asset_count} ativo(s)</span>
        </div>
        <p className="text-xs text-gray-400 mt-0.5">{m.responsible_name} · {new Date(m.created_at).toLocaleDateString('pt-BR')}</p>
      </div>
    </div>
  )
}

// ─── Componente principal ────────────────────────────────────────────────────
const RequestDetail = ({ requestId, currentUserRole, onClose }: RequestDetailProps) => {
  const { addToast } = useToast()

  const [request, setRequest] = useState<EquipmentRequest | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'info' | 'timeline' | 'movements'>('info')

  // Ações inline
  const [confirmingTransition, setConfirmingTransition] = useState<RequestStatus | null>(null)
  const [transitionNotes, setTransitionNotes] = useState('')
  const [isActing, setIsActing] = useState(false)

  // Visita técnica
  const [showScheduleVisit, setShowScheduleVisit] = useState(false)
  const [visitScheduledDate, setVisitScheduledDate] = useState('')
  const [visitAssignedTo, setVisitAssignedTo] = useState('')

  // Completar visita
  const [completingVisitId, setCompletingVisitId] = useState<number | null>(null)
  const [visitResult, setVisitResult] = useState<'constatada' | 'nao_constatada' | ''>('')
  const [visitFindings, setVisitFindings] = useState('')

  const loadRequest = useCallback(async () => {
    setIsLoading(true)
    try {
      const data = await requestsApi.getById(requestId)
      setRequest(data)
    } catch {
      addToast('Erro ao carregar solicitação.', 'error')
    } finally {
      setIsLoading(false)
    }
  }, [requestId])

  useEffect(() => { loadRequest() }, [loadRequest])

  const handleTransition = async (toStatus: RequestStatus) => {
    if (!request) return
    setIsActing(true)
    try {
      await requestsApi.changeStatus(requestId, toStatus, transitionNotes || undefined)
      addToast(`Status atualizado para "${REQUEST_STATUS_LABELS[toStatus]}".`, 'success')
      setConfirmingTransition(null)
      setTransitionNotes('')
      await loadRequest()
    } catch (err: any) {
      addToast(err?.response?.data?.message || 'Erro ao atualizar status.', 'error')
    } finally {
      setIsActing(false)
    }
  }

  const handleScheduleVisit = async () => {
    setIsActing(true)
    try {
      await requestsApi.scheduleVisit(requestId, {
        assigned_to: visitAssignedTo ? parseInt(visitAssignedTo) : undefined,
        scheduled_date: visitScheduledDate || undefined,
      })
      addToast('Visita técnica agendada.', 'success')
      setShowScheduleVisit(false)
      setVisitScheduledDate('')
      setVisitAssignedTo('')
      await loadRequest()
    } catch (err: any) {
      addToast(err?.response?.data?.message || 'Erro ao agendar visita.', 'error')
    } finally {
      setIsActing(false)
    }
  }

  const handleCompleteVisit = async (visitId: number) => {
    if (!visitResult) { addToast('Selecione o resultado da visita.', 'error'); return }
    setIsActing(true)
    try {
      await requestsApi.completeVisit(requestId, visitId, {
        result: visitResult,
        findings: visitFindings || undefined,
      })
      addToast('Visita técnica concluída.', 'success')
      setCompletingVisitId(null)
      setVisitResult('')
      setVisitFindings('')
      await loadRequest()
    } catch (err: any) {
      addToast(err?.response?.data?.message || 'Erro ao concluir visita.', 'error')
    } finally {
      setIsActing(false)
    }
  }

  const isManagerOrAdmin = ['manager', 'admin'].includes(currentUserRole)
  const canScheduleVisit = request &&
    ['requisitado', 'visita_tecnica_solicitada'].includes(request.status) &&
    ['basic', 'operator', 'manager', 'admin'].includes(currentUserRole)

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-3">
            <span className="font-mono font-semibold text-blue-700 text-sm">
              {request?.protocol || '…'}
            </span>
            {request && <StatusBadge status={request.status} />}
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
            <X size={18} />
          </button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20 text-gray-400 text-sm">Carregando…</div>
        ) : !request ? (
          <div className="flex items-center justify-center py-20 text-gray-400 text-sm">Solicitação não encontrada.</div>
        ) : (
          <>
            {/* Abas */}
            <div className="flex border-b border-gray-100 px-6 shrink-0">
              {(['info', 'timeline', 'movements'] as const).map(tab => {
                const labels = { info: 'Informações', timeline: 'Histórico', movements: 'Movimentações' }
                return (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`py-3 px-1 mr-6 text-sm font-medium border-b-2 transition-colors ${
                      activeTab === tab
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    {labels[tab]}
                    {tab === 'movements' && (request.movements?.length ?? 0) > 0 && (
                      <span className="ml-1.5 px-1.5 py-0.5 text-xs bg-gray-100 rounded-full">
                        {request.movements!.length}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>

            {/* Conteúdo */}
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

              {/* ── Aba Informações ── */}
              {activeTab === 'info' && (
                <>
                  <div className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm">
                    <div>
                      <p className="text-xs text-gray-400 mb-0.5">Tipo</p>
                      <p className="font-medium text-gray-800">{REQUEST_TYPE_LABELS[request.type] || request.type}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 mb-0.5">Canal de Entrada</p>
                      <p className="font-medium text-gray-800">
                        {REQUEST_CHANNEL_LABELS[request.input_channel] || request.input_channel}
                        {request.input_channel_details && (
                          <span className="text-gray-500 ml-1 font-normal">({request.input_channel_details})</span>
                        )}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 mb-0.5">Unidade</p>
                      <p className="font-medium text-gray-800">{request.unit_name || '—'}</p>
                      {request.unit_rpa && <p className="text-xs text-gray-400">{request.unit_rpa}</p>}
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 mb-0.5">Solicitante</p>
                      <p className="font-medium text-gray-800">{request.requester_name || '—'}</p>
                    </div>
                    {request.fundamentacao && (
                      <div>
                        <p className="text-xs text-gray-400 mb-0.5">Fundamentação</p>
                        <p className="font-medium text-gray-800">
                          {request.fundamentacao === 'avaria' ? 'Avaria' : 'Necessidade Operacional'}
                        </p>
                      </div>
                    )}
                    {request.approved_by_name && (
                      <div>
                        <p className="text-xs text-gray-400 mb-0.5">Aprovado por</p>
                        <p className="font-medium text-gray-800">{request.approved_by_name}</p>
                      </div>
                    )}
                    <div>
                      <p className="text-xs text-gray-400 mb-0.5">Aberto em</p>
                      <p className="font-medium text-gray-800">{new Date(request.created_at).toLocaleString('pt-BR')}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 mb-0.5">Criado por</p>
                      <p className="font-medium text-gray-800">{request.created_by_name || '—'}</p>
                    </div>
                  </div>

                  {request.notes && (
                    <div className="p-3 bg-gray-50 rounded-lg text-sm text-gray-700 border border-gray-100">
                      <p className="text-xs text-gray-400 mb-1">Observações</p>
                      {request.notes}
                    </div>
                  )}

                  {/* ── Visitas técnicas ── */}
                  {(request.visits && request.visits.length > 0) && (
                    <div>
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Visitas Técnicas</p>
                      <div className="space-y-2">
                        {request.visits.map(v => (
                          <div key={v.id} className="p-3 bg-purple-50 rounded-lg border border-purple-100 text-sm">
                            <div className="flex items-center gap-2 flex-wrap">
                              {v.result ? (
                                v.result === 'constatada'
                                  ? <span className="text-xs px-2 py-0.5 bg-red-100 text-red-700 rounded-full font-medium">Defeito Constatado</span>
                                  : <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded-full font-medium">Defeito Não Constatado</span>
                              ) : (
                                <span className="text-xs px-2 py-0.5 bg-yellow-100 text-yellow-700 rounded-full font-medium">Pendente</span>
                              )}
                              {v.scheduled_date && (
                                <span className="text-xs text-purple-600 flex items-center gap-1">
                                  <Calendar size={11} /> {new Date(v.scheduled_date + 'T00:00:00').toLocaleDateString('pt-BR')}
                                </span>
                              )}
                            </div>
                            {v.assigned_to_name && <p className="text-xs text-gray-500 mt-1">Técnico: {v.assigned_to_name}</p>}
                            {v.findings && <p className="text-xs text-gray-600 mt-1 italic">"{v.findings}"</p>}

                            {/* Botão para registrar resultado */}
                            {!v.completed_at && (
                              completingVisitId === v.id ? (
                                <div className="mt-3 space-y-2">
                                  <div className="flex gap-2">
                                    {[
                                      { value: 'constatada', label: 'Defeito Constatado' },
                                      { value: 'nao_constatada', label: 'Não Constatado' },
                                    ].map(opt => (
                                      <button
                                        key={opt.value}
                                        type="button"
                                        onClick={() => setVisitResult(opt.value as 'constatada' | 'nao_constatada')}
                                        className={`flex-1 py-1.5 text-xs rounded-lg border-2 font-medium transition-colors ${
                                          visitResult === opt.value ? 'border-purple-500 bg-purple-50 text-purple-700' : 'border-gray-200 text-gray-600'
                                        }`}
                                      >
                                        {opt.label}
                                      </button>
                                    ))}
                                  </div>
                                  <textarea
                                    rows={2}
                                    placeholder="Parecer técnico (opcional)…"
                                    value={visitFindings}
                                    onChange={e => setVisitFindings(e.target.value)}
                                    className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-purple-300 resize-none"
                                  />
                                  <div className="flex gap-2">
                                    <button onClick={() => { setCompletingVisitId(null); setVisitResult(''); setVisitFindings('') }}
                                      className="flex-1 py-1.5 text-xs border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50">
                                      Cancelar
                                    </button>
                                    <button
                                      onClick={() => handleCompleteVisit(v.id)}
                                      disabled={isActing || !visitResult}
                                      className="flex-1 py-1.5 text-xs bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-60">
                                      {isActing ? 'Salvando…' : 'Salvar'}
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <button
                                  onClick={() => setCompletingVisitId(v.id)}
                                  className="mt-2 text-xs text-purple-600 hover:underline font-medium"
                                >
                                  Registrar resultado
                                </button>
                              )
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Agendar visita */}
                  {canScheduleVisit && !showScheduleVisit && (
                    <button
                      onClick={() => setShowScheduleVisit(true)}
                      className="text-sm text-purple-600 hover:underline font-medium"
                    >
                      + Agendar Visita Técnica
                    </button>
                  )}

                  {showScheduleVisit && (
                    <div className="p-4 bg-purple-50 rounded-xl border border-purple-100 space-y-3">
                      <p className="text-sm font-medium text-purple-800">Agendar Visita Técnica</p>
                      <p className="text-xs text-purple-600">A visita é opcional e não vinculante. A gerência pode aprovar independente do resultado.</p>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-xs text-gray-600 mb-1 block">Data prevista</label>
                          <input type="date" value={visitScheduledDate} onChange={e => setVisitScheduledDate(e.target.value)}
                            className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-purple-300" />
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => setShowScheduleVisit(false)}
                          className="flex-1 py-1.5 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50">
                          Cancelar
                        </button>
                        <button onClick={handleScheduleVisit} disabled={isActing}
                          className="flex-1 py-1.5 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-60">
                          {isActing ? 'Agendando…' : 'Agendar'}
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* ── Aba Histórico ── */}
              {activeTab === 'timeline' && (
                <div className="space-y-1">
                  {(!request.history || request.history.length === 0) ? (
                    <p className="text-sm text-gray-400 text-center py-8">Nenhum registro de histórico.</p>
                  ) : (
                    request.history.map(entry => <TimelineEntry key={entry.id} entry={entry} />)
                  )}
                </div>
              )}

              {/* ── Aba Movimentações ── */}
              {activeTab === 'movements' && (
                <div className="space-y-2">
                  {(!request.movements || request.movements.length === 0) ? (
                    <div className="text-center py-8">
                      <Truck size={32} className="mx-auto text-gray-300 mb-2" />
                      <p className="text-sm text-gray-400">Nenhuma movimentação vinculada.</p>
                      {request.status === 'aprovado' && (
                        <p className="text-xs text-gray-400 mt-2 max-w-xs mx-auto">
                          Para vincular, crie uma movimentação no fluxo de Logística & Operações e informe o protocolo <span className="font-mono text-blue-600">{request.protocol}</span>.
                        </p>
                      )}
                    </div>
                  ) : (
                    request.movements.map(m => <MovementCard key={m.id} m={m} />)
                  )}
                </div>
              )}
            </div>

            {/* ── Ações de transição ── */}
            {request.allowed_transitions && request.allowed_transitions.length > 0 && (
              <div className="px-6 py-4 border-t border-gray-100 shrink-0 space-y-3">
                {confirmingTransition ? (
                  <div className="space-y-3">
                    <p className="text-sm font-medium text-gray-700">
                      Confirmar: <span className="text-blue-600">{REQUEST_STATUS_LABELS[confirmingTransition]}</span>
                    </p>
                    <textarea
                      rows={2}
                      placeholder="Observação (opcional)…"
                      value={transitionNotes}
                      onChange={e => setTransitionNotes(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300 resize-none"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => { setConfirmingTransition(null); setTransitionNotes('') }}
                        className="flex-1 py-2 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50"
                      >
                        Voltar
                      </button>
                      <button
                        onClick={() => handleTransition(confirmingTransition)}
                        disabled={isActing}
                        className={`flex-1 py-2 text-sm rounded-lg font-medium disabled:opacity-60 ${TRANSITION_STYLES[confirmingTransition] || 'bg-blue-600 hover:bg-blue-700 text-white'}`}
                      >
                        {isActing ? 'Aguarde…' : 'Confirmar'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-2 flex-wrap">
                    {request.allowed_transitions.map(toStatus => (
                      <button
                        key={toStatus}
                        onClick={() => setConfirmingTransition(toStatus)}
                        className={`px-4 py-2 text-sm rounded-lg font-medium transition-colors ${TRANSITION_STYLES[toStatus] || 'bg-blue-600 hover:bg-blue-700 text-white'}`}
                      >
                        {TRANSITION_LABELS[toStatus] || REQUEST_STATUS_LABELS[toStatus] || toStatus}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

export default RequestDetail
