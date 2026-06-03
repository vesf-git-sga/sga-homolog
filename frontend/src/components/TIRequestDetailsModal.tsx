import React, { useState } from 'react';
import { 
  X, Calendar, ClipboardList, CheckCircle2, AlertTriangle, AlertCircle, FileText, 
  ExternalLink, User, Check, RefreshCw, Send, Trash2, ArrowRight, ShieldAlert, HeartPulse
} from 'lucide-react';

interface TIRequestDetailsModalProps {
  request: any;
  onClose: () => void;
  onUpdateStatus: (requestId: number, updatedFields: any) => void;
}

export const TIRequestDetailsModal: React.FC<TIRequestDetailsModalProps> = ({
  request,
  onClose,
  onUpdateStatus,
}) => {
  const [activeTab, setActiveTab] = useState<'timeline' | 'detalhes' | 'historico'>('timeline');
  
  // States para simulações na UI
  const [vistoriaResultado, setVistoriaResultado] = useState<'REPARAVEL' | 'IRREPARAVEL'>('IRREPARAVEL');
  const [tomboRecolhido, setTomboRecolhido] = useState(request.tomboDefeito || '');
  const [semTomboRecolhido, setSemTomboRecolhido] = useState(request.semTombo || false);
  const [diagnosticoLaudo, setDiagnosticoLaudo] = useState('');
  const [motivoNegacao, setMotivoNegacao] = useState('');
  const [observacoesDeliberacao, setObservacoesDeliberacao] = useState('');
  const [tomboNovoEntregue, setTomboNovoEntregue] = useState('');
  const [isActionLoading, setIsActionLoading] = useState(false);

  const handleSimulateVisita = () => {
    setIsActionLoading(true);
    setTimeout(() => {
      if (vistoriaResultado === 'REPARAVEL') {
        onUpdateStatus(request.id, {
          status: 'CONCLUIDA',
          vistoriaData: new Date().toISOString().split('T')[0],
          historico: [
            ...request.historico,
            { 
              data: new Date().toLocaleString(), 
              acao: 'Visita técnica concluída: Problema resolvido in loco (reparável). Solicitação encerrada.', 
              responsavel: 'Téc. Carlos Silva' 
            }
          ]
        });
      } else {
        onUpdateStatus(request.id, {
          status: 'AGUARDANDO_LAUDO',
          vistoriaData: new Date().toISOString().split('T')[0],
          tomboDefeito: semTomboRecolhido ? 'S/TOMBO' : tomboRecolhido,
          semTombo: semTomboRecolhido,
          historico: [
            ...request.historico,
            { 
              data: new Date().toLocaleString(), 
              acao: `Visita técnica concluída: Defeito irreparável. Equipamento recolhido para o laboratório (Tombo: ${semTomboRecolhido ? 'S/TOMBO' : tomboRecolhido}).`, 
              responsavel: 'Téc. Carlos Silva' 
            }
          ]
        });
      }
      setIsActionLoading(false);
    }, 800);
  };

  const handleSimulateLaudo = () => {
    if (!diagnosticoLaudo) return;
    setIsActionLoading(true);
    setTimeout(() => {
      onUpdateStatus(request.id, {
        status: 'AGUARDANDO_DELIBERACAO',
        laudoData: new Date().toISOString().split('T')[0],
        laudoUrl: 'https://drive.google.com/drive/folders/mock_laudo_' + request.id,
        historico: [
          ...request.historico,
          { 
            data: new Date().toLocaleString(), 
            acao: `Laudo emitido: ${diagnosticoLaudo}. Conclusão: IRREPARÁVEL. Link do laudo arquivado no Drive.`, 
            responsavel: 'Eng. Lucas Santos' 
          }
        ]
      });
      setIsActionLoading(false);
    }, 800);
  };

  const handleSimulateDeliberacao = (resultado: 'APROVADA' | 'NEGADA') => {
    setIsActionLoading(true);
    setTimeout(() => {
      if (resultado === 'APROVADA') {
        const necessitaValidacaoDit = request.tipo === 'ACRESCIMO' && (request.equipamento.includes('Notebook') || request.equipamento.includes('Desktop'));
        const proximoStatus = necessitaValidacaoDit ? 'AGUARDANDO_DIT' : 'APROVADA';
        
        onUpdateStatus(request.id, {
          status: proximoStatus,
          deliberacaoData: new Date().toISOString().split('T')[0],
          historico: [
            ...request.historico,
            { 
              data: new Date().toLocaleString(), 
              acao: `Solicitação deliberada e APROVADA pela GIT/Gerência. ${necessitaValidacaoDit ? 'Encaminhada para validação da DIT.' : 'Encaminhada à DIT para preparação de entrega.'}`, 
              responsavel: 'Gestor Alberto Dantas' 
            }
          ]
        });
      } else {
        onUpdateStatus(request.id, {
          status: 'NEGADA',
          deliberacaoData: new Date().toISOString().split('T')[0],
          motivoNegacao: motivoNegacao || 'Solicitação reprovada com base nos critérios de elegibilidade.',
          historico: [
            ...request.historico,
            { 
              data: new Date().toLocaleString(), 
              acao: `Solicitação REPROVADA pela GIT. Motivo: ${motivoNegacao || 'Critérios de elegibilidade.'}`, 
              responsavel: 'Gestor Alberto Dantas' 
            }
          ]
        });
      }
      setIsActionLoading(false);
    }, 800);
  };

  const handleSimulateDitValidation = () => {
    setIsActionLoading(true);
    setTimeout(() => {
      onUpdateStatus(request.id, {
        status: 'APROVADA',
        ditAprovacaoData: new Date().toISOString().split('T')[0],
        historico: [
          ...request.historico,
          { 
            data: new Date().toLocaleString(), 
            acao: 'Solicitação validada pela DIT (Orçamento e estoque confirmados). Encaminhado para separação.', 
            responsavel: 'Coordenação DIT' 
          }
        ]
      });
      setIsActionLoading(false);
    }, 800);
  };

  const handleSimulateEntrega = () => {
    if (!tomboNovoEntregue) return;
    setIsActionLoading(true);
    setTimeout(() => {
      onUpdateStatus(request.id, {
        status: 'CONCLUIDA',
        entregaData: new Date().toISOString().split('T')[0],
        tomboEntregue: tomboNovoEntregue,
        reciboUrl: 'https://storage.sga.recife/recibos/recibo_' + request.id + '.pdf',
        observacao: request.tipo === 'SUBSTITUICAO' ? `TV SUBSTITUIDA 2026/${request.numeroChamado}` : undefined,
        historico: [
          ...request.historico,
          { 
            data: new Date().toLocaleString(), 
            acao: `Entrega física concluída com sucesso. Equipamento Tombo ${tomboNovoEntregue} entregue. Recibo assinado e digitalizado.`, 
            responsavel: 'Logística DIT - Marcos' 
          }
        ]
      });
      setIsActionLoading(false);
    }, 800);
  };

  const getTimelineSteps = () => {
    const isSub = request.tipo === 'SUBSTITUICAO';
    const isAcr = request.tipo === 'ACRESCIMO';
    const isEmp = request.tipo === 'EMPRESTIMO';

    let steps = [];

    steps.push({
      label: 'Abertura',
      desc: `Solicitação criada via ${request.canal}`,
      done: true,
      data: request.dataSolicitacao
    });

    if (isSub) {
      steps.push({
        label: 'Visita Técnica',
        desc: request.vistoriaData ? 'Concluída e avaliada' : 'Aguardando agendamento',
        done: !!request.vistoriaData,
        data: request.vistoriaData
      });

      steps.push({
        label: 'Recolhimento',
        desc: request.tomboDefeito ? `TV recolhida (Tombo: ${request.tomboDefeito})` : 'Aguardando visita técnica',
        done: !!request.vistoriaData,
        data: request.vistoriaData
      });

      steps.push({
        label: 'Laudo Técnico',
        desc: request.laudoData ? 'Laudo emitido' : 'Aguardando diagnóstico',
        done: !!request.laudoData,
        data: request.laudoData,
        link: request.laudoUrl
      });
    }

    steps.push({
      label: 'Deliberação GIT',
      desc: request.deliberacaoData 
        ? (request.status === 'NEGADA' ? 'Solicitação Negada' : 'Aprovada pela Gerência')
        : 'Pendente de análise',
      done: !!request.deliberacaoData,
      data: request.deliberacaoData,
      negated: request.status === 'NEGADA'
    });

    if (isAcr && (request.equipamento.includes('Notebook') || request.equipamento.includes('Desktop'))) {
      steps.push({
        label: 'Validação DIT',
        desc: request.ditAprovacaoData ? 'Aprovada pela DIT' : 'Pendente de validação financeira/estoque',
        done: !!request.ditAprovacaoData || request.status === 'CONCLUIDA',
        data: request.ditAprovacaoData
      });
    }

    steps.push({
      label: isEmp ? 'Entrega e Termo' : 'Entrega Física',
      desc: request.entregaData 
        ? `Equipamento entregue (Tombo: ${request.tomboEntregue || '-'})`
        : 'Aguardando separação/entrega',
      done: !!request.entregaData,
      data: request.entregaData,
      link: request.reciboUrl
    });

    return steps;
  };

  return (
    <div className="fixed inset-0 bg-slate-900 bg-opacity-75 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl border border-slate-100 flex flex-col my-8 max-h-[90vh]">
        
        {/* Header */}
        <div className="flex justify-between items-center px-6 py-4 border-b border-slate-100 bg-slate-50 rounded-t-2xl">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-lg font-black text-blue-900">{request.codigo}</span>
              <span className="px-2 py-0.5 text-xs font-bold bg-slate-200 text-slate-700 rounded uppercase">
                {request.tipo}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">{request.unidade} (RPA {request.rpa})</p>
          </div>
          <button 
            onClick={onClose}
            className="p-1 rounded-full hover:bg-slate-200 text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selector */}
        <div className="flex border-b text-sm font-semibold text-slate-500 bg-slate-50">
          {(['timeline', 'detalhes', 'historico'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-3 text-center border-b-2 transition-all ${
                activeTab === tab 
                  ? 'border-blue-600 text-blue-700 bg-white font-bold' 
                  : 'border-transparent hover:text-slate-700 hover:bg-slate-100'
              }`}
            >
              {tab === 'timeline' ? 'Linha do Tempo' : tab === 'detalhes' ? 'Mais Detalhes' : 'Histórico de Auditoria'}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {activeTab === 'timeline' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              
              {/* Timeline Flow */}
              <div className="md:col-span-2 space-y-6">
                <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-2">Fases do Processo</h3>
                <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
                  {getTimelineSteps().map((step, idx) => (
                    <div key={idx} className="relative flex gap-4">
                      {/* Icon */}
                      <span className={`absolute -left-5 w-4.5 h-4.5 rounded-full border-2 flex items-center justify-center transition-all bg-white z-10 ${
                        step.negated 
                          ? 'border-rose-500 text-rose-500 bg-rose-50'
                          : step.done 
                            ? 'border-green-500 text-green-500 bg-green-50' 
                            : 'border-slate-300 text-slate-300'
                      }`}>
                        {step.done && <Check className="w-3 h-3 stroke-[3]" />}
                      </span>
                      {/* Text */}
                      <div className="flex-1 -mt-1 bg-slate-50 border p-3 rounded-xl">
                        <div className="flex justify-between items-start">
                          <span className="font-bold text-slate-800 text-sm">{step.label}</span>
                          {step.data && <span className="text-[10px] text-gray-500 font-bold bg-white border px-1.5 py-0.5 rounded">{step.data}</span>}
                        </div>
                        <p className="text-xs text-slate-500 mt-1">{step.desc}</p>
                        {step.link && (
                          <a 
                            href={step.link} 
                            target="_blank" 
                            rel="noreferrer" 
                            className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-700 hover:text-blue-900 mt-2 bg-white border border-blue-100 px-2 py-1 rounded"
                          >
                            Visualizar Documento <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Action Simulation Box */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 h-fit space-y-4">
                <h4 className="text-xs font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1">
                  <ClipboardList className="w-4 h-4 text-blue-600" /> Painel de Simulação (Protótipo)
                </h4>
                
                {request.status === 'AGUARDANDO_VISITA' && (
                  <div className="space-y-3 animate-fadeIn text-xs">
                    <p className="text-slate-600 font-medium">Simular visita técnica da GIT na unidade escolar:</p>
                    <div>
                      <label className="block font-bold text-slate-500 mb-1">Resultado da Avaliação</label>
                      <select 
                        value={vistoriaResultado} 
                        onChange={(e) => setVistoriaResultado(e.target.value as any)}
                        className="w-full border rounded p-1.5 bg-white font-semibold"
                      >
                        <option value="IRREPARAVEL">Irreparável (Exige recolhimento)</option>
                        <option value="REPARAVEL">Reparável in loco (Encerra fluxo)</option>
                      </select>
                    </div>

                    {vistoriaResultado === 'IRREPARAVEL' && (
                      <div className="space-y-2">
                        <label className="block font-bold text-slate-500 mb-1 flex justify-between items-center">
                          <span>Tombo TV Recolhida</span>
                          <span className="flex items-center gap-1 font-normal text-[10px]">
                            <input 
                              type="checkbox" 
                              checked={semTomboRecolhido}
                              onChange={(e) => {
                                setSemTomboRecolhido(e.target.checked);
                                if (e.target.checked) setTomboRecolhido('S/TOMBO');
                                else setTomboRecolhido('');
                              }}
                              className="rounded w-3 h-3"
                            /> Sem tombo
                          </span>
                        </label>
                        <input 
                          type="text" 
                          disabled={semTomboRecolhido}
                          value={tomboRecolhido} 
                          onChange={(e) => setTomboRecolhido(e.target.value)}
                          placeholder="Ex: 928312"
                          className="w-full border rounded p-1.5 bg-white font-semibold disabled:bg-slate-100"
                        />
                      </div>
                    )}

                    <button
                      onClick={handleSimulateVisita}
                      disabled={isActionLoading || (vistoriaResultado === 'IRREPARAVEL' && !tomboRecolhido)}
                      className="w-full bg-blue-700 hover:bg-blue-800 text-white font-bold py-2 rounded-lg transition-all active:scale-95 flex items-center justify-center gap-1 shadow"
                    >
                      {isActionLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Registrar Vistoria'}
                    </button>
                  </div>
                )}

                {request.status === 'AGUARDANDO_LAUDO' && (
                  <div className="space-y-3 animate-fadeIn text-xs">
                    <p className="text-slate-600 font-medium">Emitir Laudo Técnico no laboratório pós-recolhimento:</p>
                    <div>
                      <label className="block font-bold text-slate-500 mb-1">Diagnóstico do Equipamento</label>
                      <input 
                        type="text" 
                        value={diagnosticoLaudo} 
                        onChange={(e) => setDiagnosticoLaudo(e.target.value)}
                        placeholder="Ex: Placa principal queimada por descarga elétrica."
                        className="w-full border rounded p-1.5 bg-white font-semibold"
                      />
                    </div>
                    <button
                      onClick={handleSimulateLaudo}
                      disabled={isActionLoading || !diagnosticoLaudo}
                      className="w-full bg-amber-600 hover:bg-amber-700 text-white font-bold py-2 rounded-lg transition-all active:scale-95 flex items-center justify-center gap-1 shadow"
                    >
                      {isActionLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Emitir Laudo (Drive)'}
                    </button>
                  </div>
                )}

                {request.status === 'AGUARDANDO_DELIBERACAO' && (
                  <div className="space-y-3 animate-fadeIn text-xs">
                    <p className="text-slate-600 font-medium">Deliberação da Gerência (GIT):</p>
                    
                    <div>
                      <label className="block font-bold text-slate-500 mb-1">Observações da Deliberação</label>
                      <input 
                        type="text" 
                        value={observacoesDeliberacao} 
                        onChange={(e) => setObservacoesDeliberacao(e.target.value)}
                        placeholder="Ex: Autorizado de acordo com o laudo..."
                        className="w-full border rounded p-1.5 bg-white"
                      />
                    </div>

                    <div className="space-y-2 border-t pt-2">
                      <label className="block font-bold text-slate-500 mb-1">Motivo da Reprovação (se Negado)</label>
                      <input 
                        type="text" 
                        value={motivoNegacao} 
                        onChange={(e) => setMotivoNegacao(e.target.value)}
                        placeholder="Ex: Fora dos critérios de elegibilidade..."
                        className="w-full border rounded p-1.5 bg-white"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-2">
                      <button
                        onClick={() => handleSimulateDeliberacao('NEGADA')}
                        disabled={isActionLoading}
                        className="bg-rose-600 hover:bg-rose-700 text-white font-bold py-2 rounded-lg transition-all text-center flex items-center justify-center"
                      >
                        Reprovar
                      </button>
                      <button
                        onClick={() => handleSimulateDeliberacao('APROVADA')}
                        disabled={isActionLoading}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 rounded-lg transition-all text-center flex items-center justify-center"
                      >
                        Aprovar
                      </button>
                    </div>
                  </div>
                )}

                {request.status === 'AGUARDANDO_DIT' && (
                  <div className="space-y-3 animate-fadeIn text-xs">
                    <p className="text-slate-600 font-medium">Validação Adicional da DIT:</p>
                    <button
                      onClick={handleSimulateDitValidation}
                      disabled={isActionLoading}
                      className="w-full bg-teal-600 hover:bg-teal-700 text-white font-bold py-2 rounded-lg transition-all flex items-center justify-center gap-1"
                    >
                      {isActionLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Confirmar Validação DIT'}
                    </button>
                  </div>
                )}

                {request.status === 'APROVADA' && (
                  <div className="space-y-3 animate-fadeIn text-xs">
                    <p className="text-slate-600 font-medium">Registrar entrega física pela DIT:</p>
                    <div>
                      <label className="block font-bold text-slate-500 mb-1">Tombo do Equipamento Entregue</label>
                      <input 
                        type="text" 
                        value={tomboNovoEntregue} 
                        onChange={(e) => setTomboNovoEntregue(e.target.value)}
                        placeholder="Ex: 889231"
                        className="w-full border rounded p-1.5 bg-white font-semibold"
                      />
                    </div>
                    <button
                      onClick={handleSimulateEntrega}
                      disabled={isActionLoading || !tomboNovoEntregue}
                      className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 rounded-lg transition-all active:scale-95 flex items-center justify-center gap-1"
                    >
                      {isActionLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Confirmar Entrega'}
                    </button>
                  </div>
                )}

                {request.status === 'CONCLUIDA' && (
                  <div className="p-3 bg-emerald-50 text-emerald-800 rounded-lg text-center font-bold text-xs border border-emerald-200">
                    Processo Concluído com Sucesso! Rastreabilidade patrimonial registrada.
                  </div>
                )}

                {request.status === 'NEGADA' && (
                  <div className="p-3 bg-rose-50 text-rose-800 rounded-lg text-center font-bold text-xs border border-rose-200">
                    Solicitação Rejeitada.
                  </div>
                )}

              </div>

            </div>
          )}

          {activeTab === 'detalhes' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider">Metadados da Solicitação</h3>
                <div className="space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-100 text-sm">
                  <div className="flex justify-between border-b pb-2"><span className="text-gray-500">Código Único:</span><span className="font-bold text-slate-800">{request.codigo}</span></div>
                  <div className="flex justify-between border-b pb-2"><span className="text-gray-500">Unidade Escolar:</span><span className="font-bold text-slate-800">{request.unidade}</span></div>
                  <div className="flex justify-between border-b pb-2"><span className="text-gray-500">Tipo de Unidade:</span><span className="font-bold text-slate-800 uppercase text-xs">{request.unidadeTipo}</span></div>
                  <div className="flex justify-between border-b pb-2"><span className="text-gray-500">RPA:</span><span className="font-bold text-slate-800">0{request.rpa}</span></div>
                  <div className="flex justify-between border-b pb-2"><span className="text-gray-500">Canal de Entrada:</span><span className="font-bold text-slate-800">{request.canal}</span></div>
                  <div className="flex justify-between border-b pb-2"><span className="text-gray-500">Equipamento:</span><span className="font-bold text-slate-800">{request.equipamento}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Quantidade:</span><span className="font-bold text-slate-800">{request.quantidade}</span></div>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider">Documentos & Referências</h3>
                <div className="space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-100 text-sm">
                  {request.numeroChamado && (
                    <div className="flex justify-between border-b pb-2"><span className="text-gray-500">Nº do Chamado (Origem):</span><span className="font-bold text-slate-800">{request.numeroChamado}</span></div>
                  )}
                  {request.numeroProcessoSei && (
                    <div className="flex justify-between border-b pb-2"><span className="text-gray-500">Processo SEI:</span><span className="font-bold text-slate-800">{request.numeroProcessoSei}</span></div>
                  )}
                  {request.oficioUrl && (
                    <div className="flex justify-between border-b pb-2"><span className="text-gray-500">Ofício Anexado:</span><a href={request.oficioUrl} target="_blank" rel="noreferrer" className="text-blue-600 font-bold hover:underline flex items-center gap-0.5">Oficio.pdf <ExternalLink className="w-3.5 h-3.5" /></a></div>
                  )}
                  {request.tomboDefeito && (
                    <div className="flex justify-between border-b pb-2"><span className="text-gray-500">Tombo Defeituoso:</span><span className="font-bold text-slate-800">{request.tomboDefeito}</span></div>
                  )}
                  {request.tomboEntregue && (
                    <div className="flex justify-between border-b pb-2"><span className="text-gray-500">Tombo Novo Entregue:</span><span className="font-bold text-slate-800">{request.tomboEntregue}</span></div>
                  )}
                  {request.observacao && (
                    <div className="flex justify-between border-b pb-2"><span className="text-gray-500">Ref. Cruzada (OBS):</span><span className="font-bold text-slate-800 text-xs bg-slate-200 px-1.5 py-0.5 rounded">{request.observacao}</span></div>
                  )}
                  {request.motivoNegacao && (
                    <div className="p-3 bg-rose-50 border border-rose-100 rounded-lg text-rose-800 text-xs font-semibold">
                      <span className="font-bold block mb-1">Motivo do Indeferimento:</span>
                      {request.motivoNegacao}
                    </div>
                  )}
                  {!request.oficioUrl && !request.tomboDefeito && !request.tomboEntregue && !request.motivoNegacao && (
                    <span className="text-gray-400 block text-center py-4">Nenhuma referência documental no status atual.</span>
                  )}
                </div>
              </div>

            </div>
          )}

          {activeTab === 'historico' && (
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider">Histórico de Movimentação do Registro</h3>
              <div className="bg-slate-50 border border-slate-200 rounded-xl overflow-hidden divide-y text-xs">
                {request.historico.map((h: any, i: number) => (
                  <div key={i} className="p-3 flex justify-between items-start gap-4 hover:bg-slate-100 transition-colors">
                    <div className="space-y-1">
                      <p className="font-bold text-slate-800">{h.acao}</p>
                      <p className="text-gray-400 font-medium">Executor: {h.responsavel}</p>
                    </div>
                    <span className="font-bold text-[10px] text-gray-500 bg-white border border-gray-150 px-2 py-0.5 rounded flex-shrink-0">{h.data}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 rounded-b-2xl flex justify-end">
          <button
            onClick={onClose}
            className="bg-slate-700 hover:bg-slate-800 text-white px-5 py-2 rounded-lg font-semibold text-sm transition-all"
          >
            Fechar Janela
          </button>
        </div>

      </div>
    </div>
  );
};

export default TIRequestDetailsModal;
