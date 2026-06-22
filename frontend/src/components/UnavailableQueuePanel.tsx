import React, { useState, useEffect, useMemo } from 'react'
import { X, PackageX, RefreshCw, Clock, FileText } from 'lucide-react'
import { requestsApi } from '../services/requestsApi'
import { UnavailableQueueEntry } from '../types/requests'
import { REQUEST_TYPE_LABELS } from '../utils/translations'

interface ItemTypeGroup {
  item_type_name: string
  entries: UnavailableQueueEntry[]
}

interface Props {
  onOpenDetail: (id: number) => void
  onClose: () => void
  refreshKey?: number
}

function daysSince(iso: string | null | undefined): string {
  if (!iso) return ''
  const diff = Date.now() - new Date(iso).getTime()
  const days = Math.floor(diff / 86400000)
  if (days === 0) return 'hoje'
  if (days === 1) return 'há 1 dia'
  return `há ${days} dias`
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })
}

const UnavailableQueuePanel = ({ onOpenDetail, onClose, refreshKey }: Props) => {
  const [entries, setEntries] = useState<UnavailableQueueEntry[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    setIsLoading(true)
    requestsApi.getUnavailableQueue()
      .then(setEntries)
      .catch(() => {})
      .finally(() => setIsLoading(false))
  }, [refreshKey])

  // Agrupa por tipo de equipamento (usando o primeiro item como chave principal)
  const groups = useMemo<ItemTypeGroup[]>(() => {
    const map = new Map<string, UnavailableQueueEntry[]>()
    for (const entry of entries) {
      const key = entry.items.length > 0 ? entry.items[0].item_type_name : 'Sem especificação'
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(entry)
    }
    return Array.from(map.entries())
      .map(([item_type_name, list]) => ({ item_type_name, entries: list }))
      .sort((a, b) => b.entries.length - a.entries.length)
  }, [entries])

  const GROUP_COLORS = [
    { header: 'bg-orange-600', border: 'border-orange-100' },
    { header: 'bg-red-600',    border: 'border-red-100'    },
    { header: 'bg-rose-600',   border: 'border-rose-100'   },
    { header: 'bg-amber-600',  border: 'border-amber-100'  },
  ]

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3.5 bg-gradient-to-r from-orange-600 to-red-600">
        <div className="flex items-center gap-2.5">
          <PackageX size={16} className="text-orange-200 shrink-0" />
          <div>
            <h3 className="text-sm font-semibold text-white leading-tight">Fila de Indisponíveis no Estoque</h3>
            {!isLoading && (
              <p className="text-xs text-orange-200 mt-0.5">
                {entries.length === 0
                  ? 'Nenhum item em espera'
                  : `${entries.length} ${entries.length === 1 ? 'solicitação aguardando' : 'solicitações aguardando'} estoque`}
              </p>
            )}
          </div>
        </div>
        <button
          onClick={onClose}
          className="text-orange-200 hover:text-white transition-colors p-1 rounded"
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
            Carregando fila…
          </div>
        ) : entries.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-gray-400">
            <PackageX size={36} className="mb-3 opacity-30" />
            <p className="text-sm font-medium text-gray-500">Nenhuma solicitação aguardando estoque</p>
            <p className="text-xs text-gray-400 mt-1">
              Solicitações marcadas como "Indisponível no Estoque" aparecerão aqui por equipamento
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {groups.map((group, groupIdx) => {
              const colors = GROUP_COLORS[groupIdx % GROUP_COLORS.length]
              return (
                <div key={group.item_type_name} className={`rounded-xl border ${colors.border} overflow-hidden`}>
                  {/* Group header */}
                  <div className={`${colors.header} px-3.5 py-2 flex items-center justify-between`}>
                    <div className="flex items-center gap-1.5">
                      <PackageX size={12} className="text-white/70 shrink-0" />
                      <span className="text-xs font-bold text-white tracking-wide truncate">{group.item_type_name}</span>
                    </div>
                    <span className="text-xs font-semibold bg-white/20 text-white px-2 py-0.5 rounded-full shrink-0">
                      {group.entries.length} {group.entries.length === 1 ? 'sol.' : 'sols.'}
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
                              <span className="font-mono text-xs font-bold text-orange-700">{entry.protocol}</span>
                              <span className="text-[10px] text-gray-400">
                                · {REQUEST_TYPE_LABELS[entry.type] || entry.type}
                              </span>
                            </div>

                            {/* Unit */}
                            <p className="text-xs font-medium text-gray-800 mt-0.5 line-clamp-1">{entry.unit_name}</p>

                            {/* Requester */}
                            <p className="text-[10px] text-gray-500 mt-0.5">{entry.requester_name}</p>

                            {/* Items list */}
                            {entry.items.length > 0 && (
                              <ul className="mt-1 space-y-0.5">
                                {entry.items.map((item, j) => (
                                  <li key={j} className="flex items-baseline gap-1 text-[10px] text-gray-600">
                                    <span className="text-gray-300">›</span>
                                    <span className="font-medium">{item.quantity}×</span>
                                    <span>{item.item_type_name}</span>
                                    {item.brand_name && <span className="text-gray-400">{item.brand_name}</span>}
                                    {item.model_name && <span className="text-gray-400">{item.model_name}</span>}
                                  </li>
                                ))}
                              </ul>
                            )}

                            {/* Time waiting */}
                            {entry.unavailable_since && (
                              <div className="flex items-center gap-1 mt-1.5 text-[10px] text-orange-600 font-medium">
                                <Clock size={9} className="shrink-0" />
                                <span>Desde {formatDate(entry.unavailable_since)} · {daysSince(entry.unavailable_since)}</span>
                              </div>
                            )}
                          </div>

                          {/* Ver button */}
                          <button
                            onClick={() => onOpenDetail(entry.id)}
                            className="shrink-0 text-[10px] font-semibold px-2 py-1 text-orange-700 bg-orange-50 border border-orange-200 rounded-md hover:bg-orange-100 transition-colors whitespace-nowrap"
                          >
                            <FileText size={11} className="inline mr-0.5" />
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

export default UnavailableQueuePanel
