import React, { useState, useEffect } from 'react';
import axios from 'axios';
// ÍCONES ATUALIZADOS: Adicionados FileText, MailWarning, ChevronRight
import { BarChart2, CheckCircle, Clock, Users, Accessibility, Calendar, AlertTriangle, Smartphone, MapPin, HardDrive, FileText, MailWarning, ChevronRight } from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';

import { DeliveryProjectionView } from './DeliveryProjectionView'

// Importe o useNavigate se estiver usando react-router-dom para o link funcionar:
// import { useNavigate } from 'react-router-dom';

interface TabletDashboardProps {
  API_URL: string;
  onNavigateToPendingTerms: () => void; // <<< NOVA PROP
}

const TabletDashboard: React.FC<TabletDashboardProps> = ({ API_URL, onNavigateToPendingTerms }) => {
  const [metrics, setMetrics] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  // const navigate = useNavigate(); // Descomente se usar react-router-dom
  const [selectedRpa, setSelectedRpa] = useState<string>('');

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const queryParams = selectedRpa ? `?rpa=${selectedRpa}` : '';
        const res = await axios.get(`${API_URL}/dashboard/tablets/metrics${queryParams}`);
        setMetrics(res.data);
      } catch (error) {
        console.error("Erro ao carregar dashboard", error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
    const intervalId = setInterval(loadData, 60000);
    return () => clearInterval(intervalId);
  }, [API_URL, selectedRpa]);

  if (loading && !metrics) return <div className="p-8 text-center text-gray-500">Carregando indicadores...</div>;
  if (!metrics) return <div className="p-8 text-center text-red-600">Erro ao carregar dados.</div>;

  // >>> NOVO: EXTRAINDO termsStatus <<<
  const { kpis, charts, batches, pendingSchools, termsStatus } = metrics;
  const delayedBatchesCount = batches ? batches.filter((b: any) => b.is_delayed).length : 0;

  const KpiCard = ({ title, value, subtext, icon: Icon, colorClass, bgClass }: any) => (
    <div className={`bg-white p-5 rounded-xl shadow-sm border-l-4 ${colorClass} flex justify-between items-start`}>
        <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">{title}</p>
            <p className="text-2xl font-extrabold text-gray-800 mt-1">{value}</p>
            {subtext && <p className={`text-xs font-medium mt-1 ${colorClass.replace('border-', 'text-')}`}>{subtext}</p>}
        </div>
        <div className={`p-2 rounded-full ${bgClass}`}>
            <Icon className={`w-6 h-6 ${colorClass.replace('border-', 'text-')}`} />
        </div>
    </div>
  );

  return (
    <div className="space-y-6 animate-fade-in pb-10">
      
      {/* CABEÇALHO COM FILTRO DE RPA */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4 bg-white p-4 rounded-xl shadow-sm border border-gray-200">
        <div>
            <h2 className="text-2xl font-bold text-gray-800">Monitoramento de Entregas</h2>
            <p className="text-sm text-gray-500 mt-1">Acompanhamento logístico e acessibilidade</p>
        </div>
        
        <div className="flex items-center gap-4">
            <div className="flex items-center bg-gray-50 border border-gray-200 rounded-lg p-1">
                <MapPin className="w-4 h-4 text-gray-400 ml-2" />
                <select 
                    value={selectedRpa} 
                    onChange={(e) => setSelectedRpa(e.target.value)}
                    className="bg-transparent border-none text-sm font-bold text-gray-700 focus:ring-0 cursor-pointer pl-2 pr-6 py-1 outline-none"
                >
                    <option value="">Todas as RPAs (Rede Geral)</option>
                    <option value="1">RPA 1</option>
                    <option value="2">RPA 2</option>
                    <option value="3">RPA 3</option>
                    <option value="4">RPA 4</option>
                    <option value="5">RPA 5</option>
                    <option value="6">RPA 6</option>
                </select>
            </div>
            <span className="text-xs text-gray-500 bg-gray-100 px-3 py-2 rounded-lg font-mono">
                {new Date().toLocaleTimeString()}
            </span>
        </div>
      </div>

      {/* ========================================================= */}
      {/* NOVO BLOCO: ALERTA DE TERMOS DE RESPONSABILIDADE (O FAROL) */}
      {/* ========================================================= */}
      {termsStatus && (
          <div 
            onClick={onNavigateToPendingTerms}
            className={`border-2 rounded-xl p-4 flex flex-col md:flex-row items-center justify-between cursor-pointer transition-colors shadow-sm ${
                termsStatus.atrasado > 0 
                ? 'bg-white border-red-200 hover:bg-red-50' 
                : termsStatus.atencao > 0 
                    ? 'bg-white border-yellow-200 hover:bg-yellow-50'
                    : 'bg-green-50 border-green-200 hover:bg-green-100'
            }`}
          >
              <div className="flex items-center mb-4 md:mb-0">
                  <div className={`p-3 rounded-full mr-4 ${
                      termsStatus.atrasado > 0 ? 'bg-red-100' : termsStatus.atencao > 0 ? 'bg-yellow-100' : 'bg-green-200'
                  }`}>
                      {termsStatus.atrasado > 0 ? (
                          <MailWarning className="w-8 h-8 text-red-600" />
                      ) : termsStatus.atencao > 0 ? (
                          <AlertTriangle className="w-8 h-8 text-yellow-600" />
                      ) : (
                          <FileText className="w-8 h-8 text-green-700" />
                      )}
                  </div>
                  <div>
                      <h3 className={`font-bold text-lg ${
                          termsStatus.atrasado > 0 ? 'text-red-800' : termsStatus.atencao > 0 ? 'text-yellow-800' : 'text-green-800'
                      }`}>
                          Monitoramento Documental (Termos de Responsabilidade)
                      </h3>
                      <p className={`text-sm ${
                          termsStatus.atrasado > 0 ? 'text-red-600' : termsStatus.atencao > 0 ? 'text-yellow-700' : 'text-green-700'
                      }`}>
                          {termsStatus.atrasado > 0 
                              ? 'Existem escolas com prazo estourado para envio dos termos!'
                              : termsStatus.atencao > 0 
                                  ? 'Atenção: Existem lotes com prazo de envio vencendo em breve.'
                                  : 'Todos os lotes entregues estão dentro do prazo para devolução dos termos.'}
                      </p>
                  </div>
              </div>
              
              <div className="flex gap-4">
                  {/* Farol Verde */}
                  <div className="text-center px-4 border-r border-gray-200">
                      <p className={`text-2xl font-bold ${termsStatus.no_prazo > 0 ? 'text-green-600' : 'text-gray-400'}`}>
                          {termsStatus.no_prazo}
                      </p>
                      <p className="text-xs text-gray-500 uppercase font-bold">No Prazo</p>
                  </div>
                  
                  {/* Farol Amarelo */}
                  <div className="text-center px-4 border-r border-gray-200">
                      <p className={`text-2xl font-bold ${termsStatus.atencao > 0 ? 'text-yellow-600' : 'text-gray-400'}`}>
                          {termsStatus.atencao}
                      </p>
                      <p className="text-xs text-gray-500 uppercase font-bold">Vencendo</p>
                  </div>
                  
                  {/* Farol Vermelho */}
                  <div className="text-center px-4">
                      <p className={`text-2xl font-bold ${termsStatus.atrasado > 0 ? 'text-red-600 animate-pulse' : 'text-gray-400'}`}>
                          {termsStatus.atrasado}
                      </p>
                      <p className="text-xs text-gray-500 uppercase font-bold">Atrasados</p>
                  </div>
                  
                  <div className={`flex items-center ml-2 ${
                      termsStatus.atrasado > 0 ? 'text-red-400' : termsStatus.atencao > 0 ? 'text-yellow-500' : 'text-green-600'
                  }`}>
                      <ChevronRight className="w-6 h-6" />
                  </div>
              </div>
          </div>
      )}

      {/* 1. KPIs GERAIS */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard title={`Entregues ${selectedRpa ? `(RPA ${selectedRpa})` : '(Geral)'}`} value={kpis.delivered} subtext={`${kpis.percentage}% Concluído`} icon={CheckCircle} colorClass="border-green-500" bgClass="bg-green-50" />
        <KpiCard title="Pendentes (Fila)" value={kpis.pending} subtext="Aguardando estoque" icon={Clock} colorClass="border-yellow-500" bgClass="bg-yellow-50" />
        <KpiCard title="Alunos PCD (Livox)" value={`${kpis.allocatedPcd} / ${kpis.totalPcd}`} subtext={`${kpis.percentagePcd}% Atendidos`} icon={Accessibility} colorClass="border-purple-500" bgClass="bg-purple-50" />
        <KpiCard title="Status dos Lotes" value={delayedBatchesCount > 0 ? `${delayedBatchesCount} Atrasados` : "Em Dia"} subtext={delayedBatchesCount > 0 ? "Requer atenção logística" : "Cronograma normal"} icon={AlertTriangle} colorClass={delayedBatchesCount > 0 ? "border-red-500" : "border-blue-500"} bgClass={delayedBatchesCount > 0 ? "bg-red-50" : "bg-blue-50"} />
      </div>

      {/* >>> RAIO-X LIVOX + LISTA DE ESCOLAS <<< */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Coluna Principal: O Raio-X */}
          <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-100 p-5">
              <div className="flex items-center justify-between mb-4 border-b pb-3">
                  <h3 className="font-bold text-gray-800 flex items-center">
                      <Smartphone className="w-5 h-5 mr-2 text-purple-600"/> Raio-X Operação LIVOX {selectedRpa && `(RPA ${selectedRpa})`}
                  </h3>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-5">
                  <div className="bg-purple-50 p-4 rounded-lg border border-purple-100">
                      <h4 className="text-xs font-bold text-purple-800 uppercase mb-3 border-b border-purple-200 pb-2 flex items-center">
                          <Users className="w-4 h-4 mr-2"/> Demanda PCD (Alunos)
                      </h4>
                      <div className="flex justify-between text-sm mb-1">
                          <span className="text-gray-600">Total Necessário:</span>
                          <span className="font-bold text-gray-800">{kpis.totalPcd}</span>
                      </div>
                      <div className="flex justify-between text-sm mb-1">
                          <span className="text-gray-600">Já Atendidos / Em Lotes:</span>
                          <span className="font-bold text-green-600">{kpis.allocatedPcd}</span>
                      </div>
                      <div className="flex justify-between text-sm pt-2 border-t border-purple-200 mt-2">
                          <span className="font-bold text-purple-900">Fila Pendente Real:</span>
                          <span className="font-bold text-red-600 text-lg">{kpis.pendingPcd}</span>
                      </div>
                  </div>

                  <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
                      <h4 className="text-xs font-bold text-blue-800 uppercase mb-3 border-b border-blue-200 pb-2 flex items-center">
                          <HardDrive className="w-4 h-4 mr-2"/> Estoque LIVOX (Global)
                      </h4>
                      <div className="flex justify-between text-sm mb-1">
                          <span className="text-gray-600">Total no Banco:</span>
                          <span className="font-bold text-gray-800">{kpis.totalLivox}</span>
                      </div>
                      <div className="flex justify-between text-sm mb-1">
                          <span className="text-gray-600">Em Uso / Comprometido:</span>
                          <span className="font-bold text-blue-600">{kpis.allocatedLivox}</span>
                      </div>
                      <div className="flex justify-between text-sm pt-2 border-t border-blue-200 mt-2">
                          <span className="font-bold text-blue-900">Livres p/ Distribuição:</span>
                          <span className="font-bold text-green-600 text-lg">{kpis.availableLivox}</span>
                      </div>
                  </div>
              </div>

              <div className="flex flex-col justify-center">
                  {kpis.pendingPcd > (kpis.availableLivox || 0) ? (
                      <div className="bg-red-50 border border-red-200 p-3 rounded-lg flex items-start">
                          <AlertTriangle className="w-5 h-5 text-red-600 mr-2 flex-shrink-0 mt-0.5" />
                          <div>
                              <p className="text-sm font-bold text-red-800">Déficit de {(kpis.pendingPcd - (kpis.availableLivox || 0))} equipamentos Livox!</p>
                              <p className="text-xs text-red-600 mt-1">O estoque livre não cobre a fila da RPA selecionada. Acione a bancada.</p>
                          </div>
                      </div>
                  ) : kpis.pendingPcd > 0 ? (
                      <div className="bg-green-50 border border-green-200 p-3 rounded-lg flex items-center">
                          <CheckCircle className="w-5 h-5 text-green-600 mr-2" />
                          <div>
                              <p className="text-sm font-bold text-green-800">Estoque Saudável</p>
                              <p className="text-xs text-green-700 mt-0.5">Temos tablets suficientes para atender esta fila.</p>
                          </div>
                      </div>
                  ) : (
                       <div className="bg-gray-50 border border-gray-200 p-3 rounded-lg flex items-center">
                          <CheckCircle className="w-5 h-5 text-gray-400 mr-2" />
                          <p className="text-sm font-bold text-gray-500">Operação concluída para esta seleção.</p>
                      </div>
                  )}
              </div>
          </div>

          {/* Coluna Secundária: Lista de Alvos */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 overflow-hidden flex flex-col">
              <div className="border-b pb-3 mb-3">
                  <h3 className="font-bold text-gray-800 text-sm">📍 Prioridades Logísticas</h3>
                  <p className="text-xs text-gray-500">Escolas com alunos PCD aguardando tablet.</p>
              </div>
              
              <div className="flex-1 overflow-y-auto pr-2">
                  {pendingSchools && pendingSchools.length > 0 ? (
                      <ul className="space-y-3">
                          {pendingSchools.map((school: any, idx: number) => (
                              <li key={idx} className="flex justify-between items-center p-2 hover:bg-gray-50 rounded border border-transparent hover:border-gray-200 transition-colors">
                                  <span className="text-xs font-bold text-gray-700 truncate mr-2" title={school.school_name}>
                                      {school.school_name}
                                  </span>
                                  <span className="bg-red-100 text-red-700 font-bold text-xs px-2 py-1 rounded-full whitespace-nowrap">
                                      {school.pending_count} alunos
                                  </span>
                              </li>
                          ))}
                      </ul>
                  ) : (
                      <div className="h-full flex flex-col items-center justify-center text-center p-4">
                          <CheckCircle className="w-8 h-8 text-green-300 mb-2" />
                          <p className="text-sm font-medium text-gray-500">Nenhuma escola com pendência PCD nesta região!</p>
                      </div>
                  )}
              </div>
          </div>
      </div>

      {/* 2. GRÁFICOS (CORRIGIDOS PARA EVITAR CORTE DE TEXTO) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
            <h3 className="font-bold text-gray-700 mb-4 flex items-center"><BarChart2 className="w-5 h-5 mr-2 text-blue-600"/> Progresso por RPA</h3>
            <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={charts.byRPA} layout="vertical" margin={{ left: 10, right: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                        <XAxis type="number" hide />
                        {/* width ampliado para 70 para não cortar nomes como "Indefinido" */}
                        <YAxis dataKey="name" type="category" width={70} tick={{fontSize: 11, fontWeight: 'bold'}} />
                        <Tooltip cursor={{fill: 'transparent'}} />
                        <Bar dataKey="delivered" name="Entregue" stackId="a" fill="#10b981" radius={[0, 4, 4, 0]} barSize={20} />
                        <Bar dataKey="total" name="Total" stackId="b" fill="#f3f4f6" radius={[0, 4, 4, 0]} barSize={20} />
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </div>

        <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
            <h3 className="font-bold text-gray-700 mb-4 flex items-center"><Users className="w-5 h-5 mr-2 text-blue-600"/> Distribuição por Ano de Ensino</h3>
            <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                    {/* margin bottom ampliada para 60 para não cortar nomes rotacionados como "CORREÇÃO DE FLUXO" */}
                    <BarChart data={charts.byYear} margin={{ top: 10, right: 10, left: 0, bottom: 60 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        {/* height do XAxis ampliada para 70 */}
                        <XAxis dataKey="name" tick={{fontSize: 10}} interval={0} angle={-45} textAnchor="end" height={70} />
                        <YAxis />
                        <Tooltip />
                        <Bar dataKey="total" name="Total" fill="#e5e7eb" radius={[4, 4, 0, 0]} barSize={20} />
                        <Bar dataKey="delivered" name="Entregues" fill="#8884d8" radius={[4, 4, 0, 0]} barSize={20} />
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </div>
      </div>

      {/* 3. CRONOGRAMA DETALHADO DE LOTES (MANTIDO IGUAL) */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-5 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
              <h3 className="font-bold text-gray-800 flex items-center">
                  <Calendar className="w-5 h-5 mr-2 text-blue-600"/> Cronograma de Planejamento
              </h3>
              <span className="text-xs text-gray-500">Últimos 20 lotes ativos</span>
          </div>
          <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                  <thead className="bg-white text-gray-500 border-b">
                      <tr>
                          <th className="px-6 py-3">Lote / Escola</th>
                          <th className="px-6 py-3">Responsável</th>
                          <th className="px-6 py-3">Criação</th>
                          <th className="px-6 py-3">Previsão Entrega</th>
                          <th className="px-6 py-3 text-center">Volume</th>
                          <th className="px-6 py-3 text-right">Situação</th>
                      </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                      {batches && batches.map((batch: any) => (
                          <tr key={batch.id} className={`hover:bg-gray-50 ${batch.is_delayed ? 'bg-red-50' : ''}`}>
                              <td className="px-6 py-4">
                                  <p className="font-bold text-gray-800">{batch.batch_name}</p>
                                  <p className="text-xs text-gray-500">{batch.school_name}</p>
                              </td>
                              <td className="px-6 py-4 text-gray-600">{batch.created_by}</td>
                              <td className="px-6 py-4 text-gray-500">{new Date(batch.creation_date).toLocaleDateString('pt-BR')}</td>
                              <td className="px-6 py-4">
                                  {batch.scheduled_delivery_date ? (
                                      <span className={`font-medium ${batch.is_delayed ? 'text-red-600' : 'text-gray-700'}`}>
                                          {new Date(batch.scheduled_delivery_date).toLocaleDateString('pt-BR')}
                                      </span>
                                  ) : (
                                      <span className="text-gray-400 italic">Não definida</span>
                                  )}
                              </td>
                              <td className="px-6 py-4 text-center font-bold text-blue-600">{batch.total_items}</td>
                              <td className="px-6 py-4 text-right">
                                  {batch.status === 'Concluído' ? (
                                      <span className="px-2 py-1 rounded-full text-xs font-bold bg-green-100 text-green-700">Realizado</span>
                                  ) : batch.is_delayed ? (
                                      <span className="px-2 py-1 rounded-full text-xs font-bold bg-red-100 text-red-700 flex items-center justify-end w-fit ml-auto">
                                          <AlertTriangle className="w-3 h-3 mr-1"/> Atrasado
                                      </span>
                                  ) : (
                                      <span className="px-2 py-1 rounded-full text-xs font-bold bg-yellow-100 text-yellow-700">Em Andamento</span>
                                  )}
                              </td>
                          </tr>
                      ))}
                      {(!batches || batches.length === 0) && (
                          <tr><td colSpan={6} className="p-8 text-center text-gray-400">Nenhum planejamento encontrado.</td></tr>
                      )}
                  </tbody>
              </table>
          </div>
      </div>

      

    </div>
  );
};

export default TabletDashboard;