import React, { useState } from 'react';
import { 
  X, FileText, UploadCloud, AlertCircle, AlertTriangle, CheckCircle, 
  HelpCircle, Info, Send, Calendar, List, Box
} from 'lucide-react';
import { Unit } from '../App';

interface RequestFormModalProps {
  onClose: () => void;
  onSubmit: (newRequest: any) => void;
  units: Unit[];
}

const EQUIPAMENTOS_OPCOES = [
  { value: 'TV', label: 'Televisor (TV)' },
  { value: 'NOTEBOOK', label: 'Notebook' },
  { value: 'DESKTOP', label: 'Computador Desktop' },
  { value: 'MONITOR', label: 'Monitor' },
  { value: 'MODEM', label: 'Modem 4G / Roteador' },
  { value: 'OUTRO', label: 'Outro' },
];

export const RequestFormModal: React.FC<RequestFormModalProps> = ({
  onClose,
  onSubmit,
  units,
}) => {
  const [tipo, setTipo] = useState<'SUBSTITUICAO' | 'ACRESCIMO' | 'EMPRESTIMO'>('SUBSTITUICAO');
  const [canal, setCanal] = useState<'EMAIL' | 'SEI' | 'CHAMADO'>('CHAMADO');
  const [unidadeId, setUnidadeId] = useState<string>('');
  
  // Equipamento
  const [equipamentoTipo, setEquipamentoTipo] = useState('TV');
  const [quantidade, setQuantidade] = useState(1);
  const [especificacoes, setEspecificacoes] = useState('');

  // Substituição
  const [numeroChamado, setNumeroChamado] = useState('');
  const [tomboDefeito, setTomboDefeito] = useState('');
  const [serialDefeito, setSerialDefeito] = useState('');
  const [semTombo, setSemTombo] = useState(false);
  const [descricaoDefeito, setDescricaoDefeito] = useState('');

  // Acréscimo
  const [numeroProcessoSei, setNumeroProcessoSei] = useState('');
  const [oficioFile, setOficioFile] = useState<File | null>(null);
  const [oficioFileName, setOficioFileName] = useState('');

  // Empréstimo
  const [prazoDevolucao, setPrazoDevolucao] = useState('');

  // UI States
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      setOficioFile(file);
      setOficioFileName(file.name);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!unidadeId) return;

    setIsSubmitting(true);
    
    // Simula atraso no envio
    setTimeout(() => {
      const selectedUnit = units.find(u => u.id.toString() === unidadeId);

      const requestPayload = {
        id: Math.floor(Math.random() * 1000) + 10,
        codigo: `SOL-2026-0${Math.floor(Math.random() * 9000) + 1000}`,
        tipo,
        canal,
        status: tipo === 'SUBSTITUICAO' ? 'AGUARDANDO_VISITA' : 'AGUARDANDO_DELIBERACAO',
        unidade: selectedUnit ? selectedUnit.name : 'Unidade Desconhecida',
        unidadeTipo: selectedUnit ? selectedUnit.type : 'ESCOLAR',
        rpa: selectedUnit ? selectedUnit.rpa : 1,
        dataSolicitacao: new Date().toISOString().split('T')[0],
        numeroChamado: tipo === 'SUBSTITUICAO' ? numeroChamado : undefined,
        numeroProcessoSei: canal === 'SEI' ? numeroProcessoSei : undefined,
        equipamento: EQUIPAMENTOS_OPCOES.find(o => o.value === equipamentoTipo)?.label || equipamentoTipo,
        quantidade,
        semTombo,
        tomboDefeito: tipo === 'SUBSTITUICAO' ? tomboDefeito : undefined,
        serialDefeito: tipo === 'SUBSTITUICAO' ? serialDefeito : undefined,
        descricaoDefeito: tipo === 'SUBSTITUICAO' ? descricaoDefeito : undefined,
        oficioUrl: oficioFileName ? `https://storage.sga.recife/oficios/mock_${oficioFileName}` : undefined,
        prazoDevolucao: tipo === 'EMPRESTIMO' ? prazoDevolucao : undefined,
        vistoriaData: undefined,
        historico: [
          { 
            data: new Date().toLocaleString(), 
            acao: `Solicitação criada no SGA via canal ${canal}.`, 
            responsavel: 'Operador Logístico' 
          }
        ]
      };

      onSubmit(requestPayload);
      setIsSubmitting(false);
    }, 800);
  };

  return (
    <div className="fixed inset-0 bg-slate-900 bg-opacity-75 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl border border-slate-100 flex flex-col my-8 max-h-[90vh]">
        
        {/* Header */}
        <div className="flex justify-between items-center px-6 py-4 border-b border-slate-100 bg-slate-50 rounded-t-2xl">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-blue-100 text-blue-800 rounded-lg">
              <Box className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-800">Nova Solicitação de Equipamento</h2>
              <p className="text-xs text-slate-500">Crie o registro de Substituição, Acréscimo ou Empréstimo.</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1 rounded-full hover:bg-slate-200 text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {/* Seção 1: Informações Gerais */}
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider">1. Informações Gerais</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Unidade Solicitante *</label>
                <select
                  required
                  value={unidadeId}
                  onChange={(e) => setUnidadeId(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-white"
                >
                  <option value="">Selecione a Unidade...</option>
                  {units.map((unit) => (
                    <option key={unit.id} value={unit.id}>
                      {unit.name} ({unit.type} - RPA {unit.rpa || '-'})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Tipo de Solicitação *</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['SUBSTITUICAO', 'ACRESCIMO', 'EMPRESTIMO'] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => {
                        setTipo(t);
                        // Ajusta canal padrão conforme o tipo
                        if (t === 'SUBSTITUICAO') setCanal('CHAMADO');
                        else if (t === 'EMPRESTIMO') setCanal('EMAIL');
                        else setCanal('SEI');
                      }}
                      className={`py-2 px-1 text-center font-bold text-xs rounded-lg border transition-all ${
                        tipo === t 
                          ? 'bg-blue-50 border-blue-500 text-blue-700 shadow-sm' 
                          : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                      }`}
                    >
                      {t === 'SUBSTITUICAO' ? 'Substituição' : t === 'ACRESCIMO' ? 'Acréscimo' : 'Empréstimo'}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Canal de Entrada *</label>
                <select
                  required
                  value={canal}
                  onChange={(e) => setCanal(e.target.value as any)}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-white"
                >
                  {tipo === 'SUBSTITUICAO' && <option value="CHAMADO">Chamado (Exclusivo p/ defeito)</option>}
                  <option value="SEI">SEI (Processo Eletrônico)</option>
                  <option value="EMAIL">E-mail (Solicitação formal)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Equipamento Requerido *</label>
                <select
                  value={equipamentoTipo}
                  onChange={(e) => setEquipamentoTipo(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-white"
                >
                  {EQUIPAMENTOS_OPCOES.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Quantidade *</label>
                <input
                  type="number"
                  required
                  min={1}
                  value={quantidade}
                  onChange={(e) => setQuantidade(parseInt(e.target.value) || 1)}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Especificações adicionais (opcional)</label>
                <input
                  type="text"
                  value={especificacoes}
                  onChange={(e) => setEspecificacoes(e.target.value)}
                  placeholder="Ex: Teclado ABNT2, monitor 24 polegadas..."
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                />
              </div>
            </div>
          </div>

          {/* Seção 2: Campos específicos conforme o tipo */}
          <div className="border-t border-slate-100 pt-6 space-y-4">
            
            {tipo === 'SUBSTITUICAO' && (
              <div className="space-y-4 animate-fadeIn">
                <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider">2. Detalhes de Substituição (Avaria)</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Nº do Chamado *</label>
                    <input
                      type="text"
                      required
                      placeholder="Ex: CHAMADO-2026-991"
                      value={numeroChamado}
                      onChange={(e) => setNumeroChamado(e.target.value)}
                      className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1 flex items-center justify-between">
                      <span>Tombo do Equipamento Defeituoso</span>
                      <span className="flex items-center gap-1">
                        <input
                          type="checkbox"
                          id="semTombo"
                          checked={semTombo}
                          onChange={(e) => {
                            setSemTombo(e.target.checked);
                            if (e.target.checked) setTomboDefeito('S/TOMBO');
                            else setTomboDefeito('');
                          }}
                          className="rounded text-blue-600 focus:ring-blue-500 w-3 h-3"
                        />
                        <label htmlFor="semTombo" className="text-[10px] font-bold text-slate-500 uppercase cursor-pointer">Sem Tombo</label>
                      </span>
                    </label>
                    <input
                      type="text"
                      disabled={semTombo}
                      placeholder={semTombo ? 'S/TOMBO' : 'Ex: 100234'}
                      value={tomboDefeito}
                      onChange={(e) => setTomboDefeito(e.target.value)}
                      className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm disabled:bg-slate-50 disabled:text-slate-400 font-bold"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Nº de Série Defeituoso</label>
                    <input
                      type="text"
                      placeholder="Ex: SN9982312A"
                      value={serialDefeito}
                      onChange={(e) => setSerialDefeito(e.target.value)}
                      className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm font-semibold"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Descrição Detalhada do Problema *</label>
                    <textarea
                      required
                      rows={2}
                      placeholder="Descreva o comportamento do defeito (ex: não liga, tela piscando)..."
                      value={descricaoDefeito}
                      onChange={(e) => setDescricaoDefeito(e.target.value)}
                      className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    />
                  </div>
                </div>

                <div className="bg-amber-50 p-4 rounded-xl border border-amber-200 flex gap-3 text-xs text-amber-900 font-medium">
                  <Info className="w-5 h-5 text-amber-600 flex-shrink-0" />
                  <div>
                    <span className="font-bold">Aviso sobre Substituição:</span> Ao salvar, o sistema agendará automaticamente uma Vistoria Técnica na unidade. O recolhimento físico do equipamento danificado será feito na visita e exige emissão de laudo antes da deliberação final da Gerência.
                  </div>
                </div>
              </div>
            )}

            {tipo === 'ACRESCIMO' && (
              <div className="space-y-4 animate-fadeIn">
                <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider">2. Detalhes de Acréscimo (Novo Equipamento)</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {canal === 'SEI' && (
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Nº do Processo SEI *</label>
                      <input
                        type="text"
                        required
                        placeholder="Ex: 2026/012932"
                        value={numeroProcessoSei}
                        onChange={(e) => setNumeroProcessoSei(e.target.value)}
                        className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                      />
                    </div>
                  )}
                  
                  <div className={canal !== 'SEI' ? 'md:col-span-2' : ''}>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Anexo de Ofício Assinado (Obrigatório) *</label>
                    <div className="border-2 border-dashed border-slate-300 hover:border-blue-500 rounded-xl p-4 transition-colors relative flex flex-col items-center justify-center bg-slate-50 cursor-pointer">
                      <input
                        type="file"
                        required
                        accept=".pdf,.png,.jpg,.jpeg"
                        onChange={handleFileChange}
                        className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                      />
                      <UploadCloud className="w-8 h-8 text-slate-400 mb-2" />
                      <span className="text-xs font-semibold text-slate-600">
                        {oficioFileName ? `Arquivo: ${oficioFileName}` : 'Clique ou arraste o Ofício assinado aqui'}
                      </span>
                      <span className="text-[10px] text-slate-400 mt-1">Formatos aceitos: PDF, PNG, JPG (Máx 5MB)</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {tipo === 'EMPRESTIMO' && (
              <div className="space-y-4 animate-fadeIn">
                <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider">2. Detalhes de Empréstimo Temporário</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Prazo de Devolução (Data Limite) *</label>
                    <input
                      type="date"
                      required
                      min={new Date().toISOString().split('T')[0]}
                      value={prazoDevolucao}
                      onChange={(e) => setPrazoDevolucao(e.target.value)}
                      className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Finalidade do Empréstimo *</label>
                    <input
                      type="text"
                      required
                      placeholder="Ex: Evento de formação de professores..."
                      value={especificacoes}
                      onChange={(e) => setEspecificacoes(e.target.value)}
                      className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    />
                  </div>
                </div>

                <div className="bg-blue-50 p-4 rounded-xl border border-blue-200 flex gap-3 text-xs text-blue-900 font-medium">
                  <Info className="w-5 h-5 text-blue-600 flex-shrink-0" />
                  <div>
                    <span className="font-bold">Regra de Empréstimos:</span> Requer obrigatoriamente a dupla aprovação no sistema (Gerência GIT + Diretoria Executiva) antes do despacho físico.
                  </div>
                </div>
              </div>
            )}
            
          </div>
          
        </form>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 rounded-b-2xl flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-150 rounded-lg transition-colors border"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting || !unidadeId}
            className="bg-blue-700 hover:bg-blue-800 text-white px-5 py-2 rounded-lg font-semibold text-sm transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
          >
            {isSubmitting ? (
              <>Criando registro...</>
            ) : (
              <>
                <Send className="w-4 h-4" /> Criar Solicitação
              </>
            )}
          </button>
        </div>

      </div>
    </div>
  );
};

export default RequestFormModal;
