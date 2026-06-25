import React, { useState, useEffect, useMemo } from 'react'
import { X, MapPin, Calendar, Clock, User, AlertCircle, Route, RefreshCw } from 'lucide-react'
import { requestsApi } from '../services/requestsApi'
import { VisitRouteEntry } from '../types/requests'
import { REQUEST_TYPE_LABELS } from '../utils/translations'

interface RpaGroup {
  rpa: string
  entries: VisitRouteEntry[]
}

interface Props {
  onOpenDetail: (id: number) => void
  onClose: () => void
  refreshKey?: number
}

const RPA_COLORS = [
  { header: 'bg-purple-600', border: 'border-purple-100' },
  { header: 'bg-blue-600',   border: 'border-blue-100'   },
  { header: 'bg-teal-600',   border: 'border-teal-100'   },
  { header: 'bg-orange-500', border: 'border-orange-100' },
  { header: 'bg-pink-600',   border: 'border-pink-100'   },
  { header: 'bg-indigo-600', border: 'border-indigo-100' },
]

const VisitRoutePanel = ({ onOpenDetail, onClose, refreshKey }: Props) => {
  const [entries, setEntries] = useState<VisitRouteEntry[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    setIsLoading(true)
    requestsApi.getVisitRoute()
      .then(setEntries)
      .catch(() => {})
      .finally(() => setIsLoading(false))
  }, [refreshKey])

  const groups = useMemo<RpaGroup[]>(() => {
    const map = new Map<string, VisitRouteEntry[]>()
    for (const entry of entries) {
      const key = entry.unit_rpa || '__SEM_RPA__'
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(entry)
    }

    return Array.from(map.entries())
      .map(([rpa, list]) => ({
        rpa,
        entries: [...list].sort((a, b) => {
          if (!a.scheduled_date && b.scheduled_date) return -1
          if (a.scheduled_date && !b.scheduled_date) return 1
          if (a.scheduled_date && b.scheduled_date) {
            return a.scheduled_date.localeCompare(b.scheduled_date)
          }
          return 0
        }),
      }))
      .sort((a, b) => {
        if (a.rpa === '__SEM_RPA__') return 1
        if (b.rpa === '__SEM_RPA__') return -1
        return b.entries.length - a.entries.length
      })
  }, [entries])

  const rpaCount = groups.filter(g => g.rpa !== '__SEM_RPA__').length

  const formatDate = (d: string) => {
    const [, m, day] = d.split('-')
    return `${day}/${m}`
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3.5 bg-gradient-to-r from-purple-600 to-purple-700">
        <div className="flex items-center gap-2.5">
          <Route size={16} className="text-purple-200 shrink-0" />
          <div>
            <h3 className="text-sm font-semibold text-white leading-tight">Rota de Visitas Técnicas</h3>
            {!isLoading && (
              <p className="text-xs text-purple-200 mt-0.5">
                {entries.length === 0
                  ? 'Nenhuma visita pendente'
                  : `${entries.length} ${entries.length === 1 ? 'visita' : 'visitas'} em ${rpaCount} ${rpaCount === 1 ? 'RPA' : 'RPAs'}`}
              </p>
            )}
          </div>
        </div>
        <button
          onClick={onClose}
          className="text-purple-200 hover:text-white transition-colors p-1 rounded"
          aria-label="Fechar painel"
        >
          <X size={16} />
        </button>
      </div>

      {/* Body */}
      <div className="p-5">
        {isLoading ? (
          <div className="flex items-center justify-center py-10 text-gray-400">
            <RefreshCw size={18} className="animate-spin mr-2" />
            Carregando rotas…
          </div>
        ) : entries.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-gray-400">
            <MapPin size={36} className="mb-3 opacity-30" />
            <p className="text-sm font-medium text-gray-500">Nenhuma visita técnica pendente</p>
            <p className="text-xs text-gray-400 mt-1">
              Solicitações com visitas programadas aparecerão aqui agrupadas por RPA
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {groups.map((group, groupIdx) => {
              const colors = RPA_COLORS[groupIdx % RPA_COLORS.length]
              const isNoRpa = group.rpa === '__SEM_RPA__'

              return (
                <div key={group.rpa} className={`rounded-xl border ${colors.border} overflow-hidden`}>
                  {/* RPA header */}
                  <div className={`${isNoRpa ? 'bg-gray-500' : colors.header} px-3.5 py-2 flex items-center justify-between`}>
                    <div className="flex items-center gap-1.5">
                      <MapPin size={12} className="text-white/70 shrink-0" />
                      <span className="text-xs font-bold text-white tracking-wide">
                        {isNoRpa ? 'Sem RPA definida' : `RPA ${group.rpa}`}
                      </span>
                    </div>
                    <span className="text-xs font-semibold bg-white/20 text-white px-2 py-0.5 rounded-full">
                      {group.entries.length} {group.entries.length === 1 ? 'visita' : 'visitas'}
                    </span>
                  </div>

                  {/* Entries */}
                  <div className="divide-y divide-gray-50">
                    {group.entries.map((entry, i) => (
                      <div key={entry.id} className="p-3 bg-white hover:bg-gray-50/70 transition-colors">
                        <div className="flex items-start gap-2">
                          {/* Order badge */}
                          <span className="mt-0.5 text-[10px] font-bold bg-gray-100 text-gray-400 w-5 h-5 rounded-full flex items-center justify-center shrink-0">
                            {i + 1}
                          </span>

                          <div className="min-w-0 flex-1">
                            {/* Protocol + type */}
                            <div className="flex items-center gap-1 flex-wrap">
                              <span className="font-mono text-xs font-bold text-purple-700">{entry.protocol}</span>
                              <span className="text-[10px] text-gray-400">
                                · {REQUEST_TYPE_LABELS[entry.type] || entry.type}
                              </span>
                            </div>

                            {/* Unit name */}
                            <p className="text-xs font-medium text-gray-800 mt-0.5 line-clamp-1">{entry.unit_name}</p>

                            {/* Address */}
                            {entry.unit_address && (
                              <p className="text-[10px] text-gray-400 mt-0.5 line-clamp-1">{entry.unit_address}</p>
                            )}

                            {/* Requester */}
                            <p className="text-[10px] text-gray-500 mt-0.5">{entry.requester_name}</p>

                            {/* Schedule status */}
                            <div className="mt-1.5">
                              {entry.scheduled_date ? (
                                <div className="flex items-center flex-wrap gap-x-1 gap-y-0.5 text-[10px] text-green-700 font-medium">
                                  <Calendar size={10} className="shrink-0" />
                                  <span>{formatDate(entry.scheduled_date)}</span>
                                  {entry.scheduled_time && (
                                    <>
                                      <Clock size={10} className="shrink-0" />
                                      <span>{entry.scheduled_time}</span>
                                    </>
                                  )}
                                  {entry.assigned_to_name && (
                                    <>
                                      <span className="text-gray-300">·</span>
                                      <User size={9} className="shrink-0" />
                                      <span className="max-w-[72px] truncate">{entry.assigned_to_name.split(' ')[0]}</span>
                                    </>
                                  )}
                                </div>
                              ) : (
                                <div className="flex items-center gap-1 text-[10px] text-amber-600 font-medium">
                                  <AlertCircle size={10} className="shrink-0" />
                                  <span>Sem agendamento</span>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Ver button */}
                          <button
                            onClick={() => onOpenDetail(entry.id)}
                            className="shrink-0 text-[10px] font-semibold px-2 py-1 text-purple-700 bg-purple-50 border border-purple-200 rounded-md hover:bg-purple-100 transition-colors whitespace-nowrap"
                          >
                            Ver
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

export default VisitRoutePanel
