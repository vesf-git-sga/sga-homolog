import React from 'react'
import { REQUEST_STATUS_LABELS } from '../utils/translations'

const STATUS_STYLES: Record<string, string> = {
  requisitado:                         'bg-blue-100 text-blue-800',
  visita_tecnica_solicitada:           'bg-purple-100 text-purple-800',
  visita_realizada:                    'bg-indigo-100 text-indigo-800',
  aguardando_aprovacao:                'bg-yellow-100 text-yellow-800',
  necessidade_parcialmente_constatada: 'bg-amber-100 text-amber-800',
  aprovado:                            'bg-green-100 text-green-800',
  parcialmente_aprovado:               'bg-lime-100 text-lime-800',
  reprovado:                           'bg-red-100 text-red-800',
  em_execucao:                         'bg-orange-100 text-orange-800',
  concluido:                           'bg-teal-100 text-teal-800',
  cancelado:                           'bg-gray-100 text-gray-500',
  indisponivel_estoque:                'bg-orange-100 text-orange-800',
}

interface StatusBadgeProps {
  status: string
}

const StatusBadge = ({ status }: StatusBadgeProps) => {
  const style = STATUS_STYLES[status] || 'bg-gray-100 text-gray-600'
  const label = REQUEST_STATUS_LABELS[status] || status
  return (
    <span className={`px-2 py-1 rounded-full text-xs font-medium whitespace-nowrap ${style}`}>
      {label}
    </span>
  )
}

export default StatusBadge
