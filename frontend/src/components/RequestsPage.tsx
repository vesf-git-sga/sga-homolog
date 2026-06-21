import React, { useState, useEffect, useMemo } from 'react'
import { PlusCircle, RefreshCw, Search, Inbox, FileText, MapPin } from 'lucide-react'
import { useToast } from '../App'
import StatusBadge from './StatusBadge'
import RequestModal from './RequestModal'
import RequestDetail from './RequestDetail'
import VisitRoutePanel from './VisitRoutePanel'
import { EquipmentRequest } from '../types/requests'
import { REQUEST_TYPE_LABELS, REQUEST_STATUS_LABELS, REQUEST_CHANNEL_LABELS } from '../utils/translations'
import { requestsApi } from '../services/requestsApi'

const ACTIVE_STATUSES = ['requisitado', 'visita_tecnica_solicitada', 'visita_realizada', 'aguardando_aprovacao', 'aprovado', 'em_execucao']

// ─── KPI Card ─────────────────────────────────────────────────────────────────
const KpiCard = ({
  label, count, icon, iconBg, countColor, onClick, active,
}: {
  label: string; count: number; icon: React.ReactNode; iconBg: string
  countColor: string; onClick: () => void; active: boolean
}) => (
  <button
    type="button"
    onClick={onClick}
    className={`flex items-center justify-between w-full bg-white rounded-2xl p-5 shadow-sm border-2 transition-all text-left hover:shadow-md ${active ? 'border-blue-400' : 'border-transparent'}`}
  >
    <div>
      <p className="text-xs font-semibold text-gray-400 tracking-widest uppercase mb-2">{label}</p>
      <p className={`text-4xl font-bold ${countColor}`}>{count}</p>
    </div>
    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${iconBg}`}>
      {icon}
    </div>
  </button>
)

// ─── Componente principal ──────────────────────────────────────────────────────
interface RequestsPageProps {
  currentUserRole: string
}

const RequestsPage = ({ currentUserRole }: RequestsPageProps) => {
  const { addToast } = useToast()

  const [requests, setRequests] = useState<EquipmentRequest[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [rpas, setRpas] = useState<string[]>([])

  const [searchText, setSearchText] = useState('')
  const [filterType, setFilterType] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterRpa, setFilterRpa] = useState('')
  const [activeKpi, setActiveKpi] = useState<string | null>(null)

  const [showRoutePanel, setShowRoutePanel] = useState(false)
  const [routeRefresh, setRouteRefresh] = useState(0)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [selectedRequestId, setSelectedRequestId] = useState<number | null>(null)

  const fetchRequests = async () => {
    setIsLoading(true)
    try {
      const data = await requestsApi.list()
      setRequests(Array.isArray(data) ? data : [])
      const rpasSet = new Set<string>()
      data.forEach((r: EquipmentRequest) => { if (r.unit_rpa) rpasSet.add(r.unit_rpa) })
      setRpas(Array.from(rpasSet).sort())
    } catch {
      addToast('Erro ao carregar solicitações.', 'error')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => { fetchRequests() }, [])

  // ─── KPIs ──────────────────────────────────────────────────────────────────
  const kpiAtivas     = useMemo(() => requests.filter(r => ACTIVE_STATUSES.includes(r.status)).length, [requests])
  const kpiAguardando = useMemo(() => requests.filter(r => r.status === 'aguardando_aprovacao').length, [requests])
  const kpiAprovadas  = useMemo(() => requests.filter(r => r.status === 'aprovado').length, [requests])
  const kpiConcluidas = useMemo(() => requests.filter(r => r.status === 'concluido').length, [requests])
  const kpiVisitas    = useMemo(() => requests.filter(r => r.status === 'visita_tecnica_solicitada').length, [requests])

  // ─── Filtros ───────────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let list = requests

    if (activeKpi === 'ativas')     list = list.filter(r => ACTIVE_STATUSES.includes(r.status))
    if (activeKpi === 'aguardando') list = list.filter(r => r.status === 'aguardando_aprovacao')
    if (activeKpi === 'aprovadas')  list = list.filter(r => r.status === 'aprovado')
    if (activeKpi === 'concluidas') list = list.filter(r => r.status === 'concluido')

    if (filterStatus) list = list.filter(r => r.status === filterStatus)
    if (filterType)   list = list.filter(r => r.type === filterType)
    if (filterRpa)    list = list.filter(r => r.unit_rpa === filterRpa)

    if (searchText) {
      const q = searchText.toLowerCase()
      list = list.filter(r =>
        r.protocol.toLowerCase().includes(q) ||
        (r.requester_name || '').toLowerCase().includes(q) ||
        (r.unit_name || '').toLowerCase().includes(q)
      )
    }

    return list
  }, [requests, activeKpi, filterStatus, filterType, filterRpa, searchText])

  const handleKpiClick = (key: string) => setActiveKpi(prev => prev === key ? null : key)

  const handleCreated = () => {
    setShowCreateModal(false)
    fetchRequests()
  }

  const handleDetailClose = () => {
    setSelectedRequestId(null)
    fetchRequests()
    if (showRoutePanel) setRouteRefresh(k => k + 1)
  }

  const canCreate = ['basic', 'operator', 'manager', 'admin'].includes(currentUserRole)

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Solicitações de TI</h1>
          <p className="text-sm text-gray-500 mt-1">Gestão de solicitações de equipamentos (empréstimo, substituição e acréscimo)</p>
        </div>
        <div className="flex gap-2">
          <button onClick={fetchRequests} className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors" title="Atualizar">
            <RefreshCw size={18} />
          </button>
          {canCreate && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
            >
              <PlusCircle size={16} />
              Nova Solicitação
            </button>
          )}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <KpiCard label="Ativas" count={kpiAtivas} icon={<Inbox size={22} className="text-blue-600" />}
          iconBg="bg-blue-50" countColor="text-blue-700" onClick={() => handleKpiClick('ativas')} active={activeKpi === 'ativas'} />
        <KpiCard label="Aguard. Aprovação" count={kpiAguardando} icon={<FileText size={22} className="text-yellow-600" />}
          iconBg="bg-yellow-50" countColor="text-yellow-700" onClick={() => handleKpiClick('aguardando')} active={activeKpi === 'aguardando'} />
        <KpiCard label="Aprovadas" count={kpiAprovadas} icon={<FileText size={22} className="text-green-600" />}
          iconBg="bg-green-50" countColor="text-green-700" onClick={() => handleKpiClick('aprovadas')} active={activeKpi === 'aprovadas'} />
        <KpiCard label="Concluídas" count={kpiConcluidas} icon={<FileText size={22} className="text-teal-600" />}
          iconBg="bg-teal-50" countColor="text-teal-700" onClick={() => handleKpiClick('concluidas')} active={activeKpi === 'concluidas'} />
        <KpiCard label="Visitas Técnicas" count={kpiVisitas} icon={<MapPin size={22} className="text-purple-600" />}
          iconBg="bg-purple-50" countColor="text-purple-700"
          onClick={() => setShowRoutePanel(prev => !prev)} active={showRoutePanel} />
      </div>

      {/* Painel de rotas de visitas */}
      {showRoutePanel && (
        <VisitRoutePanel
          onOpenDetail={id => setSelectedRequestId(id)}
          onClose={() => setShowRoutePanel(false)}
          refreshKey={routeRefresh}
        />
      )}

      {/* Filtros */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Protocolo, solicitante ou unidade…"
              value={searchText}
              onChange={e => setSearchText(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300"
            />
          </div>
          <select
            value={filterType}
            onChange={e => setFilterType(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300"
          >
            <option value="">Todos os tipos</option>
            {Object.entries(REQUEST_TYPE_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300"
          >
            <option value="">Todos os status</option>
            {Object.entries(REQUEST_STATUS_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
          <select
            value={filterRpa}
            onChange={e => setFilterRpa(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300"
          >
            <option value="">Todas as RPAs</option>
            {rpas.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
      </div>

      {/* Tabela */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-gray-400">
            <RefreshCw size={20} className="animate-spin mr-2" /> Carregando…
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400">
            <Inbox size={40} className="mb-3 opacity-40" />
            <p className="text-sm">Nenhuma solicitação encontrada.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600">Protocolo</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600">Tipo</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600">Unidade</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600">Solicitante</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600">Canal</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600">Status</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600">Abertura</th>
                  <th className="px-4 py-3 text-center font-semibold text-gray-600">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map(r => (
                  <tr
                    key={r.id}
                    className="hover:bg-gray-50 transition-colors"
                  >
                    <td className="px-4 py-3 font-mono font-medium text-blue-700">{r.protocol}</td>
                    <td className="px-4 py-3 text-gray-700">{REQUEST_TYPE_LABELS[r.type] || r.type}</td>
                    <td className="px-4 py-3 text-gray-700">
                      <div>{r.unit_name || '—'}</div>
                      {r.unit_rpa && <div className="text-xs text-gray-400">{r.unit_rpa}</div>}
                    </td>
                    <td className="px-4 py-3 text-gray-700">{r.requester_name || '—'}</td>
                    <td className="px-4 py-3 text-gray-500">{REQUEST_CHANNEL_LABELS[r.input_channel] || r.input_channel}</td>
                    <td className="px-4 py-3"><StatusBadge status={r.status} /></td>
                    <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                      {new Date(r.created_at).toLocaleDateString('pt-BR')}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => setSelectedRequestId(r.id)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors whitespace-nowrap"
                      >
                        <FileText size={13} />
                        Detalhes
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showCreateModal && (
        <RequestModal
          onClose={() => setShowCreateModal(false)}
          onCreated={handleCreated}
        />
      )}

      {selectedRequestId !== null && (
        <RequestDetail
          requestId={selectedRequestId}
          currentUserRole={currentUserRole}
          onClose={handleDetailClose}
        />
      )}
    </div>
  )
}

export default RequestsPage
