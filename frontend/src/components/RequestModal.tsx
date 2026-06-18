import React, { useState, useContext, useEffect } from 'react'
import axios from 'axios'
import InputMask from 'react-input-mask'
import { X } from 'lucide-react'
import { AuthContext } from '../App'
import { useToast } from '../App'
import { requestsApi } from '../services/requestsApi'
import { REQUEST_TYPE_LABELS, REQUEST_CHANNEL_LABELS } from '../utils/translations'
import { RequestType, InputChannel } from '../types/requests'

interface Person { id: number; full_name: string; registration_number?: string }
interface Unit   { id: number; name: string; rpa?: string }

// Canais disponíveis por tipo (e fundamentação para substituição)
function getChannelOptions(type: RequestType, fundamentacao: string): { value: InputChannel; label: string }[] {
  if (type === 'emprestimo') return [
    { value: 'email', label: 'E-mail' },
    { value: 'sei',   label: 'SEI' },
  ]
  if (type === 'acrescimo') return [
    { value: 'sei',   label: 'SEI' },
    { value: 'email', label: 'E-mail' },
  ]
  if (type === 'substituicao') {
    return fundamentacao === 'avaria'
      ? [
          { value: 'chamado', label: 'Chamado (defeito)' },
          { value: 'sei',     label: 'SEI' },
          { value: 'email',   label: 'E-mail' },
        ]
      : [
          { value: 'sei',   label: 'SEI' },
          { value: 'email', label: 'E-mail' },
        ]
  }
  return []
}

interface RequestModalProps {
  onClose: () => void
  onCreated: () => void
}

const RequestModal = ({ onClose, onCreated }: RequestModalProps) => {
  const ctx = useContext(AuthContext) as any
  const API_URL: string = ctx?.API_URL || ''
  const { addToast } = useToast()

  const [type, setType] = useState<RequestType>('emprestimo')
  const [fundamentacao, setFundamentacao] = useState<'avaria' | 'necessidade_operacional' | ''>('')
  const [inputChannel, setInputChannel] = useState<InputChannel | ''>('')
  const [channelDetails, setChannelDetails] = useState('')
  const [notes, setNotes] = useState('')

  const [people, setPeople] = useState<Person[]>([])
  const [units, setUnits] = useState<Unit[]>([])
  const [personSearch, setPersonSearch] = useState('')
  const [selectedPerson, setSelectedPerson] = useState<Person | null>(null)
  const [showPersonDropdown, setShowPersonDropdown] = useState(false)
  const [selectedUnitId, setSelectedUnitId] = useState<number | ''>('')

  const [isLoading, setIsLoading] = useState(false)

  // Reseta canal ao mudar tipo ou fundamentação
  useEffect(() => {
    setInputChannel('')
    setChannelDetails('')
  }, [type, fundamentacao])

  useEffect(() => {
    setChannelDetails('')
  }, [inputChannel])

  useEffect(() => {
    axios.get(`${API_URL}/people`)
      .then(r => setPeople(Array.isArray(r.data) ? r.data : []))
      .catch(() => {})
    axios.get(`${API_URL}/units`)
      .then(r => { const d = Array.isArray(r.data) ? r.data : r.data?.units || []; setUnits(d) })
      .catch(() => {})
  }, [API_URL])

  const channelOptions = getChannelOptions(type, fundamentacao)
  const filteredPeople = personSearch.length >= 2
    ? people.filter(p =>
        p.full_name.toLowerCase().includes(personSearch.toLowerCase()) ||
        (p.registration_number || '').includes(personSearch)
      ).slice(0, 50)
    : []

  const handleSelectPerson = (p: Person) => {
    setSelectedPerson(p)
    setPersonSearch(p.full_name)
    setShowPersonDropdown(false)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedPerson) { addToast('Selecione o solicitante.', 'error'); return }
    if (!selectedUnitId)  { addToast('Selecione a unidade solicitante.', 'error'); return }
    if (!inputChannel)    { addToast('Selecione o canal de entrada.', 'error'); return }
    if (type === 'substituicao' && !fundamentacao) {
      addToast('Selecione a fundamentação da substituição.', 'error'); return
    }
    if ((inputChannel === 'sei' || inputChannel === 'chamado') && !channelDetails.trim()) {
      addToast(`Informe ${inputChannel === 'sei' ? 'o número do processo SEI' : 'o número do chamado'}.`, 'error'); return
    }

    setIsLoading(true)
    try {
      await requestsApi.create({
        type,
        input_channel: inputChannel as InputChannel,
        input_channel_details: channelDetails.trim() || undefined,
        requester_person_id: selectedPerson.id,
        unit_id: selectedUnitId as number,
        fundamentacao: fundamentacao || undefined,
        notes: notes.trim() || undefined,
      })
      addToast('Solicitação criada com sucesso.', 'success')
      onCreated()
    } catch (err: any) {
      addToast(err?.response?.data?.message || 'Erro ao criar solicitação.', 'error')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">Nova Solicitação de TI</h2>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-5">
          {/* Tipo */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de Solicitação <span className="text-red-500">*</span></label>
            <div className="grid grid-cols-3 gap-2">
              {(['emprestimo', 'substituicao', 'acrescimo'] as RequestType[]).map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => { setType(t); setFundamentacao('') }}
                  className={`py-2 px-3 text-sm rounded-lg border-2 font-medium transition-colors ${
                    type === t
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-gray-200 text-gray-600 hover:border-gray-300'
                  }`}
                >
                  {REQUEST_TYPE_LABELS[t]}
                </button>
              ))}
            </div>
          </div>

          {/* Fundamentação (substituição) */}
          {type === 'substituicao' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Fundamentação <span className="text-red-500">*</span></label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { value: 'avaria', label: 'Avaria' },
                  { value: 'necessidade_operacional', label: 'Necessidade Operacional' },
                ].map(f => (
                  <button
                    key={f.value}
                    type="button"
                    onClick={() => setFundamentacao(f.value as 'avaria' | 'necessidade_operacional')}
                    className={`py-2 px-3 text-sm rounded-lg border-2 font-medium transition-colors ${
                      fundamentacao === f.value
                        ? 'border-orange-500 bg-orange-50 text-orange-700'
                        : 'border-gray-200 text-gray-600 hover:border-gray-300'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Canal de Entrada */}
          {channelOptions.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Canal de Entrada <span className="text-red-500">*</span></label>
              <div className="flex gap-2 flex-wrap">
                {channelOptions.map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setInputChannel(opt.value)}
                    className={`py-2 px-4 text-sm rounded-lg border-2 font-medium transition-colors ${
                      inputChannel === opt.value
                        ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                        : 'border-gray-200 text-gray-600 hover:border-gray-300'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              {/* Detalhe do canal */}
              {inputChannel === 'sei' && (
                <div className="mt-2">
                  <InputMask
                    mask="99.999999/9999-99"
                    value={channelDetails}
                    onChange={e => setChannelDetails(e.target.value)}
                  >
                    {(inputProps: any) => (
                      <input
                        {...inputProps}
                        type="text"
                        placeholder="Número do processo SEI"
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300"
                      />
                    )}
                  </InputMask>
                </div>
              )}
              {inputChannel === 'chamado' && (
                <input
                  type="text"
                  placeholder="Número do chamado"
                  value={channelDetails}
                  onChange={e => setChannelDetails(e.target.value)}
                  className="mt-2 w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300"
                />
              )}
              {inputChannel === 'email' && (
                <input
                  type="text"
                  placeholder="Endereço de e-mail (opcional)"
                  value={channelDetails}
                  onChange={e => setChannelDetails(e.target.value)}
                  className="mt-2 w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300"
                />
              )}
            </div>
          )}

          {/* Unidade */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Unidade Solicitante <span className="text-red-500">*</span></label>
            <select
              value={selectedUnitId}
              onChange={e => setSelectedUnitId(e.target.value ? parseInt(e.target.value) : '')}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300"
            >
              <option value="">Selecione a unidade…</option>
              {units.map(u => (
                <option key={u.id} value={u.id}>{u.name}{u.rpa ? ` — ${u.rpa}` : ''}</option>
              ))}
            </select>
          </div>

          {/* Solicitante */}
          <div className="relative">
            <label className="block text-sm font-medium text-gray-700 mb-1">Solicitante <span className="text-red-500">*</span></label>
            <input
              type="text"
              placeholder="Digite nome ou matrícula…"
              value={personSearch}
              onChange={e => { setPersonSearch(e.target.value); setSelectedPerson(null); setShowPersonDropdown(true) }}
              onFocus={() => setShowPersonDropdown(true)}
              onBlur={() => setTimeout(() => setShowPersonDropdown(false), 150)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300"
            />
            {showPersonDropdown && filteredPeople.length > 0 && (
              <ul className="absolute z-10 w-full bg-white border border-gray-200 rounded-lg shadow-lg mt-1 max-h-48 overflow-y-auto">
                {filteredPeople.map(p => (
                  <li
                    key={p.id}
                    onMouseDown={() => handleSelectPerson(p)}
                    className="px-3 py-2 text-sm cursor-pointer hover:bg-blue-50"
                  >
                    <span className="font-medium">{p.full_name}</span>
                    {p.registration_number && <span className="text-gray-400 ml-2 text-xs">{p.registration_number}</span>}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Observações */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Observações</label>
            <textarea
              rows={3}
              placeholder="Informações adicionais sobre a solicitação…"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300 resize-none"
            />
          </div>

          {/* Rodapé */}
          <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="px-5 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-60"
            >
              {isLoading ? 'Criando…' : 'Criar Solicitação'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default RequestModal
