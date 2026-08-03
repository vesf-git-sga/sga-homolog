import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { 
  Search, Download, Filter, RefreshCw, Eye, X, 
  ShieldAlert, LogIn, LogOut, PlusCircle, Trash2, Edit, 
  FileText, Truck, Smartphone, CheckCircle,
  Database, User
} from 'lucide-react';
import { useToast } from '../App';

interface AuditLogPageProps {
  API_URL: string;
}

interface AuditLog {
  id: number;
  action_type: string;
  target_entity: string;
  target_id: number;
  details: any;
  ip_address: string;
  created_at: string;
  user_name: string;
  username: string;
}

// --- HELPER: MAPEAMENTO VISUAL (ICONE + COR + TEXTO) ---
const getActionMeta = (type: string) => {
  const meta: { [key: string]: { label: string; color: string; icon: any } } = {
    // Acesso
    'login_success': { label: 'Login Sucesso', color: 'bg-green-100 text-green-700', icon: LogIn },
    'login_failed': { label: 'Login Falhou', color: 'bg-red-100 text-red-700', icon: ShieldAlert },
    'logout': { label: 'Logout', color: 'bg-gray-100 text-gray-600', icon: LogOut },
    'unauthorized_access': { label: 'Acesso Negado', color: 'bg-red-100 text-red-800', icon: ShieldAlert },

    // Cadastros
    'user_created': { label: 'Novo Usuário', color: 'bg-blue-100 text-blue-700', icon: User },
    'create_asset': { label: 'Ativo Criado', color: 'bg-blue-100 text-blue-700', icon: PlusCircle },
    'update_asset': { label: 'Ativo Editado', color: 'bg-indigo-100 text-indigo-700', icon: Edit },
    'delete_asset': { label: 'Ativo Excluído', color: 'bg-red-100 text-red-700', icon: Trash2 },
    
    // Movimentação
    'create_movement_loan': { label: 'Empréstimo', color: 'bg-purple-100 text-purple-700', icon: Truck },
    'create_movement_return': { label: 'Devolução', color: 'bg-green-100 text-green-700', icon: CheckCircle },
    'create_movement_exit': { label: 'Saída Definitiva', color: 'bg-orange-100 text-orange-700', icon: Truck },
    'confirm_delivery': { label: 'Entrega Confirmada', color: 'bg-teal-100 text-teal-700', icon: CheckCircle },
    'request_retroactive_movement_link': { label: 'Vínculo Retroativo', color: 'bg-teal-100 text-teal-800', icon: Truck },

    // Manutenção / Baixa
    'retire_asset': { label: 'Baixa de Bem', color: 'bg-red-100 text-red-800', icon: Trash2 },
    'sim_swap': { label: 'Troca de Chip', color: 'bg-pink-100 text-pink-700', icon: Smartphone },
    
    // Relatórios
    'generate_report': { label: 'Relatório Gerado', color: 'bg-gray-100 text-gray-700', icon: FileText },
    
    // Importações
    'import_assets': { label: 'Importação', color: 'bg-yellow-100 text-yellow-800', icon: Database },
  };

  // Fallback para tipos não mapeados
  return meta[type] || { 
    label: type.replace(/_/g, ' ').toUpperCase(), 
    color: 'bg-gray-100 text-gray-600', 
    icon: ActivityIcon 
  };
};

// --- HELPER: TRADUÇÃO DE ENTIDADES (Tabelas do Banco -> Português) ---
const translateEntity = (entity: string): string => {
    const entityMap: { [key: string]: string } = {
      'assets': 'Ativo/Bem',
      'users': 'Usuário do Sistema',
      'people': 'Pessoa/Beneficiário',
      'units': 'Unidade/Escola',
      'item_types': 'Tipo de Item',
      'asset_movements': 'Movimentação',
      'delivery_batches': 'Lote de Entrega',
      'delivery_batch_items': 'Item de Lote',
      'pending_substitutions': 'Substituição',
      'auth': 'Autenticação',
      'reports': 'Relatórios',
      'dashboard': 'Dashboard'
    };
    return entityMap[entity] || entity; 
};

// Ícone Genérico para fallback
const ActivityIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
  </svg>
);

const AuditLogPage = ({ API_URL }: AuditLogPageProps) => {
  const { addToast } = useToast();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Filtros
  const [filterAction, setFilterAction] = useState('');
  const [filterUser, setFilterUser] = useState(''); // ID do usuário
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  const fetchLogs = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterAction) params.append('actionType', filterAction);
      if (filterUser) params.append('userId', filterUser);
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);

      const response = await axios.get(`${API_URL}/audit-logs`, { params });
      setLogs(response.data);
    } catch (error) {
      console.error('Erro ao buscar logs:', error);
      addToast('Erro ao carregar auditoria.', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [API_URL, filterAction, filterUser, startDate, endDate, addToast]);

  // Carrega ao iniciar
  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const handleDownload = async (format: 'csv' | 'xlsx' | 'pdf') => {
    try {
      addToast(`Gerando arquivo ${format.toUpperCase()}...`, 'info');
      const params = new URLSearchParams();
      if (filterAction) params.append('actionType', filterAction);
      if (filterUser) params.append('userId', filterUser);
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);

      const response = await axios.get(`${API_URL}/reports/audit-logs/${format}`, { 
        params,
        responseType: 'blob' 
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Auditoria_Sistema_${new Date().toISOString().split('T')[0]}.${format}`);
      document.body.appendChild(link);
      link.click();
      
    } catch (error) {
      console.error('Erro no download:', error);
      addToast('Erro ao exportar dados.', 'error');
    }
  };

  const clearFilters = () => {
      setFilterAction('');
      setFilterUser('');
      setStartDate('');
      setEndDate('');
      setTimeout(() => fetchLogs(), 100); 
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-10">
      
      {/* 1. CABEÇALHO */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-gray-200 pb-4">
        <div>
          <h1 className="text-2xl font-extrabold text-blue-900 flex items-center">
            <ShieldAlert className="w-8 h-8 mr-3 text-blue-600"/> 
            Auditoria e Segurança
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Rastreabilidade completa de ações, acessos e modificações no sistema.
          </p>
        </div>
        <div className="flex gap-2">
            <span className="bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-xs font-bold border border-blue-100 flex items-center">
                {logs.length} Registros Encontrados
            </span>
            <button onClick={fetchLogs} className="p-2 text-blue-600 hover:bg-blue-50 rounded-full transition-colors" title="Atualizar Lista">
                <RefreshCw className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
        </div>
      </div>

      {/* 2. PAINEL DE CONTROLE (FILTROS E EXPORTAÇÃO) */}
      <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200">
        
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
            
            {/* Filtro: ID Usuário */}
            <div className="md:col-span-2">
                <label className="block text-xs font-bold text-gray-600 mb-1 uppercase">ID Usuário</label>
                <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"/>
                    <input 
                        type="text" 
                        placeholder="Ex: 42" 
                        value={filterUser}
                        onChange={e => setFilterUser(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                </div>
            </div>

            {/* Filtro: Tipo de Ação */}
            <div className="md:col-span-3">
                <label className="block text-xs font-bold text-gray-600 mb-1 uppercase">Tipo de Evento</label>
                <div className="relative">
                    <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"/>
                    <select 
                        value={filterAction}
                        onChange={e => setFilterAction(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none appearance-none"
                    >
                        <option value="">Todas as Ações</option>
                        <option value="login_success">Logins (Sucesso)</option>
                        <option value="login_failed">Logins (Falha)</option>
                        <option value="create_movement_loan">Empréstimos</option>
                        <option value="create_movement_return">Devoluções</option>
                        <option value="update_asset">Edição de Ativos</option>
                        <option value="delete_asset">Exclusão de Ativos</option>
                        <option value="unauthorized_access">Tentativas Bloqueadas</option>
                    </select>
                </div>
            </div>

            {/* Filtro: Data */}
            <div className="md:col-span-4">
                <label className="block text-xs font-bold text-gray-600 mb-1 uppercase">Período de Análise</label>
                <div className="flex gap-2 items-center">
                    <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full p-2 border border-gray-300 rounded-lg text-sm" />
                    <span className="text-gray-400 text-xs">até</span>
                    <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-full p-2 border border-gray-300 rounded-lg text-sm" />
                </div>
            </div>

            {/* Botões de Ação */}
            <div className="md:col-span-3 flex gap-2">
                <button onClick={fetchLogs} className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 flex items-center justify-center font-bold text-sm shadow-sm transition-colors">
                    <Search className="w-4 h-4 mr-2" /> Buscar
                </button>
                {(filterUser || filterAction || startDate || endDate) && (
                    <button onClick={clearFilters} className="px-3 py-2 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition-colors text-sm" title="Limpar Filtros">
                        <X className="w-4 h-4" />
                    </button>
                )}
            </div>
        </div>

        <div className="mt-4 pt-4 border-t border-gray-100 flex justify-end gap-2">
            <span className="text-xs text-gray-400 self-center mr-2">Exportar Resultados:</span>
            <button onClick={() => handleDownload('xlsx')} className="flex items-center px-3 py-1.5 bg-green-50 text-green-700 border border-green-200 rounded-md text-xs font-bold hover:bg-green-100 transition-colors">
                <Download className="w-3 h-3 mr-1" /> EXCEL
            </button>
            <button onClick={() => handleDownload('pdf')} className="flex items-center px-3 py-1.5 bg-red-50 text-red-700 border border-red-200 rounded-md text-xs font-bold hover:bg-red-100 transition-colors">
                <Download className="w-3 h-3 mr-1" /> PDF
            </button>
        </div>
      </div>

      {/* 3. TABELA DE LOGS */}
      <div className="bg-white rounded-xl shadow-md overflow-hidden border border-gray-200">
        <div className="overflow-x-auto">
            <table className="w-full text-sm text-left text-gray-500">
                <thead className="text-xs text-gray-700 uppercase bg-gray-50 border-b border-gray-200">
                    <tr>
                        <th className="px-6 py-4">Evento</th>
                        <th className="px-6 py-4">Data/Hora</th>
                        <th className="px-6 py-4">Usuário Responsável</th>
                        <th className="px-6 py-4">Alvo / Entidade</th>
                        <th className="px-6 py-4">Origem (IP)</th>
                        <th className="px-6 py-4 text-center">Detalhes</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                    {logs.length > 0 ? logs.map((log) => {
                        const meta = getActionMeta(log.action_type);
                        const Icon = meta.icon;
                        
                        return (
                            <tr key={log.id} className="hover:bg-blue-50 transition-colors duration-150">
                                <td className="px-6 py-4">
                                    <div className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold border ${meta.color} border-opacity-20`}>
                                        <Icon className="w-3 h-3 mr-1.5" />
                                        {meta.label}
                                    </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-gray-700">
                                    <div className="font-medium">{new Date(log.created_at).toLocaleDateString('pt-BR')}</div>
                                    <div className="text-xs text-gray-400">{new Date(log.created_at).toLocaleTimeString('pt-BR')}</div>
                                </td>
                                <td className="px-6 py-4">
                                    {log.user_name ? (
                                        <div className="flex items-center">
                                            <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-gray-600 text-xs font-bold mr-2">
                                                {log.username.substring(0,2).toUpperCase()}
                                            </div>
                                            <div>
                                                <div className="font-bold text-gray-900">{log.user_name}</div>
                                                <div className="text-xs text-gray-400">ID: {log.username}</div>
                                            </div>
                                        </div>
                                    ) : <span className="text-gray-400 italic">Sistema Automático</span>}
                                </td>
                                <td className="px-6 py-4">
                                    <div className="text-gray-900 font-medium">
                                        {/* AQUI ESTÁ A CORREÇÃO NA TABELA */}
                                        {translateEntity(log.target_entity) || 'N/A'}
                                    </div>
                                    {log.target_id && <div className="text-xs text-gray-400">ID Ref: #{log.target_id}</div>}
                                </td>
                                <td className="px-6 py-4 font-mono text-xs text-gray-500">
                                    {log.ip_address}
                                </td>
                                <td className="px-6 py-4 text-center">
                                    <button 
                                        onClick={() => setSelectedLog(log)}
                                        className="text-gray-400 hover:text-blue-600 transition-colors p-2 hover:bg-blue-100 rounded-full"
                                        title="Ver JSON Completo"
                                    >
                                        <Eye className="w-5 h-5" />
                                    </button>
                                </td>
                            </tr>
                        );
                    }) : (
                        <tr>
                            <td colSpan={6} className="px-6 py-12 text-center text-gray-400 bg-gray-50">
                                <div className="flex flex-col items-center justify-center">
                                    <Search className="w-12 h-12 mb-3 opacity-20"/>
                                    <p className="text-base font-medium">Nenhum registro encontrado.</p>
                                    <p className="text-sm">Tente ajustar os filtros de busca.</p>
                                </div>
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>
      </div>

      {/* 4. MODAL DE DETALHES (JSON) */}
      {selectedLog && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[1050] p-4 backdrop-blur-sm animate-fadeIn">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col border border-gray-200">
                
                <div className="flex justify-between items-center p-5 border-b bg-gray-50 rounded-t-xl">
                    <div className="flex items-center">
                        <Database className="w-5 h-5 text-blue-600 mr-2"/>
                        <h3 className="text-lg font-extrabold text-gray-800">Detalhes Técnicos do Evento #{selectedLog.id}</h3>
                    </div>
                    <button onClick={() => setSelectedLog(null)} className="text-gray-400 hover:text-red-500 transition-colors">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                <div className="p-6 overflow-y-auto bg-white">
                    {/* Resumo Visual */}
                    <div className="grid grid-cols-2 gap-4 mb-6">
                        <div className="p-3 bg-gray-50 rounded-lg border border-gray-100">
                            <span className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Tipo de Ação</span>
                            <span className="text-sm font-bold text-gray-800">{getActionMeta(selectedLog.action_type).label}</span>
                        </div>
                        <div className="p-3 bg-gray-50 rounded-lg border border-gray-100">
                            <span className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Entidade Alvo</span>
                            <span className="text-sm font-bold text-gray-800">
                                {/* AQUI ESTÁ A CORREÇÃO NO MODAL */}
                                {translateEntity(selectedLog.target_entity)} #{selectedLog.target_id}
                            </span>
                        </div>
                    </div>

                    {/* JSON Viewer Bonito */}
                    <div className="rounded-lg border border-gray-200 overflow-hidden">
                        <div className="bg-gray-100 px-4 py-2 border-b border-gray-200 flex justify-between items-center">
                            <span className="text-xs font-bold text-gray-600 font-mono">PAYLOAD / DETALHES</span>
                        </div>
                        <div className="bg-slate-900 p-4 overflow-x-auto">
                            {selectedLog.details ? (
                                <pre className="text-xs font-mono text-green-400 whitespace-pre-wrap">
                                    {JSON.stringify(selectedLog.details, null, 2)}
                                </pre>
                            ) : (
                                <span className="text-gray-500 italic text-sm">Nenhum detalhe adicional registrado.</span>
                            )}
                        </div>
                    </div>
                </div>

                <div className="p-4 border-t bg-gray-50 rounded-b-xl flex justify-end">
                    <button onClick={() => setSelectedLog(null)} className="px-6 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg text-sm font-bold hover:bg-gray-100 shadow-sm transition-all">
                        Fechar Visualização
                    </button>
                </div>
            </div>
        </div>
      )}

    </div>
  );
};

export default AuditLogPage;