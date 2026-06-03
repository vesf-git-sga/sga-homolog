import React, { useState } from 'react';
import { 
  Inbox, FileText, Send, Calendar, CheckCircle2, XCircle, AlertCircle, 
  Search, Filter, Plus, ArrowRight, RefreshCw, Eye, AlertTriangle, HelpCircle, Layers, FileCheck2
} from 'lucide-react';

interface RequestsDashboardViewProps {
  userRole: string;
  onOpenNewRequest: () => void;
  onViewDetails: (request: any) => void;
}

export const mockRequests = [
  {
    id: 1,
    codigo: 'SOL-2026-0001',
    tipo: 'SUBSTITUICAO',
    canal: 'CHAMADO',
    status: 'CONCLUIDA',
    unidade: 'Escola Municipal Novo Horizonte',
    unidadeTipo: 'ESCOLAR',
    rpa: 3,
    dataSolicitacao: '2026-05-10',
    numeroChamado: '10293',
    equipamento: 'TV LCD 43"',
    quantidade: 1,
    observacao: 'TV SUBSTITUIDA 2026/10293',
    tomboDefeito: '29381',
    tomboEntregue: '88392',
    laudoUrl: 'https://drive.google.com/drive/folders/mock_laudo_1',
    reciboUrl: 'https://storage.sga.recife/recibos/recibo_1.pdf',
    vistoriaData: '2026-05-12',
    laudoData: '2026-05-14',
    deliberacaoData: '2026-05-15',
    entregaData: '2026-05-18',
    historico: [
      { data: '2026-05-10 09:30', acao: 'Chamado aberto na unidade. Solicitação criada no SGA.', responsavel: 'Diretoria Escolar' },
      { data: '2026-05-12 14:15', acao: 'Visita técnica realizada. Defeito irreparável constatado, TV recolhida para laboratório.', responsavel: 'Téc. Carlos Silva' },
      { data: '2026-05-14 11:00', acao: 'Laudo técnico emitido no laboratório. Condenação do equipamento confirmada.', responsavel: 'Eng. Lucas Santos' },
      { data: '2026-05-15 15:45', acao: 'Substituição deliberada e aprovada pela Gerência GIT.', responsavel: 'Gestor Alberto Dantas' },
      { data: '2026-05-18 10:20', acao: 'Equipamento novo entregue pela DIT e recibo assinado anexado.', responsavel: 'Logística DIT - Marcos' },
    ]
  },
  {
    id: 2,
    codigo: 'SOL-2026-0002',
    tipo: 'SUBSTITUICAO',
    canal: 'CHAMADO',
    status: 'AGUARDANDO_LAUDO',
    unidade: 'Creche Municipal Criança Feliz',
    unidadeTipo: 'ESCOLAR',
    rpa: 5,
    dataSolicitacao: '2026-05-28',
    numeroChamado: '10344',
    equipamento: 'TV LED 50"',
    quantidade: 1,
    tomboDefeito: '77218',
    semTombo: false,
    vistoriaData: '2026-05-30',
    historico: [
      { data: '2026-05-28 08:00', acao: 'Chamado de TV com defeito aberto pela creche.', responsavel: 'Diretoria Creche' },
      { data: '2026-05-30 11:30', acao: 'Visita técnica concluída. TV recolhida para o laboratório.', responsavel: 'Téc. Carlos Silva' },
    ]
  },
  {
    id: 3,
    codigo: 'SOL-2026-0003',
    tipo: 'ACRESCIMO',
    canal: 'SEI',
    status: 'AGUARDANDO_DELIBERACAO',
    unidade: 'CMEI Arco-Íris',
    unidadeTipo: 'ESCOLAR',
    rpa: 1,
    dataSolicitacao: '2026-06-01',
    numeroProcessoSei: '2026/001923',
    equipamento: 'Notebook Core i5',
    quantidade: 2,
    oficioUrl: 'https://storage.sga.recife/oficios/sei_001923.pdf',
    historico: [
      { data: '2026-06-01 10:00', acao: 'Solicitação de acréscimo via processo SEI com ofício obrigatório anexado.', responsavel: 'Unidade Executora' },
    ]
  },
  {
    id: 4,
    codigo: 'SOL-2026-0004',
    tipo: 'EMPRESTIMO',
    canal: 'EMAIL',
    status: 'CONCLUIDA',
    unidade: 'Setor de Tecnologia Pedagógica',
    unidadeTipo: 'ADMINISTRATIVA',
    rpa: 2,
    dataSolicitacao: '2026-05-15',
    equipamento: 'Modem 4G Wi-Fi',
    quantidade: 3,
    prazoDevolucao: '2026-06-15',
    entregaData: '2026-05-16',
    historico: [
      { data: '2026-05-15 14:00', acao: 'E-mail recebido solicitando modems para evento pedagógico.', responsavel: 'Coord. Pedagógica' },
      { data: '2026-05-15 17:00', acao: 'Empréstimo aprovado pela Executiva + Gerência GIT.', responsavel: 'Gestor Alberto Dantas' },
      { data: '2026-05-16 09:00', acao: 'Modems entregues sob termo de empréstimo assinado.', responsavel: 'Logística DIT - Marcos' },
    ]
  },
  {
    id: 5,
    codigo: 'SOL-2026-0005',
    tipo: 'ACRESCIMO',
    canal: 'SEI',
    status: 'NEGADA',
    unidade: 'Escola Municipal Dom Bosco',
    unidadeTipo: 'ESCOLAR',
    rpa: 2,
    dataSolicitacao: '2026-05-20',
    numeroProcessoSei: '2026/003321',
    equipamento: 'Computador Desktop',
    quantidade: 1,
    oficioUrl: 'https://storage.sga.recife/oficios/sei_003321.pdf',
    motivoNegacao: 'Computadores desktops são permitidos apenas para setores administrativos da Rede. Salas de leitura e espaços pedagógicos não têm direito à elegibilidade de desktops.',
    deliberacaoData: '2026-05-22',
    historico: [
      { data: '2026-05-20 11:00', acao: 'Solicitação de acréscimo de Desktop para Sala de Leitura.', responsavel: 'Diretoria Escolar' },
      { data: '2026-05-22 14:30', acao: 'Solicitação reprovada por critérios de elegibilidade (Desktops são restritos a setores administrativos).', responsavel: 'Gestor Alberto Dantas' },
    ]
  },
  {
    id: 6,
    codigo: 'SOL-2026-0006',
    tipo: 'EMPRESTIMO',
    canal: 'EMAIL',
    status: 'EM_ENTREGA',
    unidade: 'Gerência de Alfabetização',
    unidadeTipo: 'ADMINISTRATIVA',
    rpa: 6,
    dataSolicitacao: '2026-05-29',
    equipamento: 'Notebook Core i5',
    quantidade: 1,
    prazoDevolucao: '2026-06-10',
    historico: [
      { data: '2026-05-29 15:00', acao: 'Solicitação de empréstimo temporário de Notebook.', responsavel: 'Gerente Alfabetização' },
      { data: '2026-05-30 10:00', acao: 'Aprovado pelo Diretor Executivo e Gerência GIT.', responsavel: 'Gestor Alberto Dantas' },
      { data: '2026-06-02 08:30', acao: 'Solicitação encaminhada à DIT. Equipamento separado e aguardando rota de entrega.', responsavel: 'Coordenação DIT' },
    ]
  }
];

const RequestsDashboardView: React.FC<RequestsDashboardViewProps> = ({ 
  userRole, 
  onOpenNewRequest, 
  onViewDetails 
}) => {
  const [requestsList, setRequestsList] = useState(mockRequests);
  const [filterTipo, setFilterTipo] = useState('TODOS');
  const [filterStatus, setFilterStatus] = useState('TODOS');
  const [filterRpa, setFilterRpa] = useState('TODOS');
  const [searchTerm, setSearchTerm] = useState('');

  // KPIs
  const totalAbertas = requestsList.filter(r => r.status !== 'CONCLUIDA' && r.status !== 'NEGADA').length;
  const aguardandoLaudo = requestsList.filter(r => r.status === 'AGUARDANDO_LAUDO').length;
  const aguardandoDeliberacao = requestsList.filter(r => r.status === 'AGUARDANDO_DELIBERACAO').length;
  const pendentesEntrega = requestsList.filter(r => r.status === 'APROVADA' || r.status === 'EM_ENTREGA').length;

  const handleRefresh = () => {
    // Simula recarga
    setRequestsList([...mockRequests]);
  };

  const filteredRequests = requestsList.filter(request => {
    const matchesTipo = filterTipo === 'TODOS' || request.tipo === filterTipo;
    const matchesStatus = filterStatus === 'TODOS' || request.status === filterStatus;
    const matchesRpa = filterRpa === 'TODOS' || request.rpa.toString() === filterRpa;
    const matchesSearch = request.unidade.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          request.codigo.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          request.equipamento.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (request.numeroChamado && request.numeroChamado.includes(searchTerm));
    return matchesTipo && matchesStatus && matchesRpa && matchesSearch;
  });

  const getStatusBadge = (status: string) => {
    const styles: { [key: string]: string } = {
      ABERTA: 'bg-blue-100 text-blue-800 border-blue-200',
      AGUARDANDO_VISITA: 'bg-purple-100 text-purple-800 border-purple-200',
      AGUARDANDO_LAUDO: 'bg-amber-100 text-amber-800 border-amber-200',
      AGUARDANDO_DELIBERACAO: 'bg-indigo-100 text-indigo-800 border-indigo-200',
      AGUARDANDO_DIT: 'bg-teal-100 text-teal-800 border-teal-200',
      APROVADA: 'bg-emerald-100 text-emerald-800 border-emerald-200',
      NEGADA: 'bg-rose-100 text-rose-800 border-rose-200',
      EM_ENTREGA: 'bg-sky-100 text-sky-800 border-sky-200',
      CONCLUIDA: 'bg-green-100 text-green-800 border-green-200',
    };

    const labels: { [key: string]: string } = {
      ABERTA: 'Aberta',
      AGUARDANDO_VISITA: 'Visita Técnica',
      AGUARDANDO_LAUDO: 'Aguardando Laudo',
      AGUARDANDO_DELIBERACAO: 'Aguardando GIT',
      AGUARDANDO_DIT: 'Aguardando DIT',
      APROVADA: 'Aprovada',
      NEGADA: 'Negada',
      EM_ENTREGA: 'Em Rota',
      CONCLUIDA: 'Concluída',
    };

    return (
      <span className={`px-2.5 py-1 text-xs font-semibold rounded-full border ${styles[status] || 'bg-slate-100 text-slate-800'}`}>
        {labels[status] || status}
      </span>
    );
  };

  const getTipoBadge = (tipo: string) => {
    const labels: { [key: string]: string } = {
      SUBSTITUICAO: 'Substituição (Defeito)',
      ACRESCIMO: 'Acréscimo (Novo)',
      EMPRESTIMO: 'Empréstimo',
    };
    const colors: { [key: string]: string } = {
      SUBSTITUICAO: 'text-orange-700 bg-orange-50 border-orange-100',
      ACRESCIMO: 'text-indigo-700 bg-indigo-50 border-indigo-100',
      EMPRESTIMO: 'text-cyan-700 bg-cyan-50 border-cyan-100',
    };
    return (
      <span className={`px-2 py-0.5 text-xs font-medium rounded border ${colors[tipo] || 'bg-slate-100 text-slate-700 border-slate-200'}`}>
        {labels[tipo] || tipo}
      </span>
    );
  };

  return (
    <div className="space-y-6 pb-10 animate-fadeIn">
      {/* 1. Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b pb-4 gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-blue-900 tracking-tight">Gestão de Solicitações de TI</h1>
          <p className="text-gray-500 mt-1">Gestão de Substituições, Acréscimos e Empréstimos de Equipamentos de TI.</p>
        </div>
        <div className="flex gap-3 w-full md:w-auto">
          <button 
            onClick={handleRefresh}
            className="p-2 border rounded-lg bg-white text-gray-700 hover:bg-gray-50 transition-colors shadow-sm flex items-center justify-center"
            title="Atualizar lista"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
          <button 
            onClick={onOpenNewRequest}
            className="flex-1 md:flex-initial bg-blue-700 text-white px-4 py-2 rounded-lg shadow-md hover:bg-blue-800 transition-all font-semibold flex items-center justify-center gap-2 active:scale-95"
          >
            <Plus className="w-5 h-5" /> Nova Solicitação
          </button>
        </div>
      </div>

      {/* 2. KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Abertas / Ativas</p>
            <h3 className="text-2xl font-black text-gray-800 mt-1">{totalAbertas}</h3>
          </div>
          <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
            <Inbox className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Aguardando Laudo</p>
            <h3 className="text-2xl font-black text-amber-600 mt-1">{aguardandoLaudo}</h3>
          </div>
          <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
            <AlertTriangle className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Aguardando Deliberação</p>
            <h3 className="text-2xl font-black text-indigo-600 mt-1">{aguardandoDeliberacao}</h3>
          </div>
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
            <FileCheck2 className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Em Rota de Entrega</p>
            <h3 className="text-2xl font-black text-sky-600 mt-1">{pendentesEntrega}</h3>
          </div>
          <div className="p-3 bg-sky-50 text-sky-600 rounded-xl">
            <ArrowRight className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* 3. Filtros */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col md:flex-row gap-4 items-center">
        <div className="relative w-full md:flex-1">
          <Search className="absolute left-3 top-2.5 text-gray-400 w-5 h-5" />
          <input 
            type="text" 
            placeholder="Buscar por unidade, código de solicitação, chamado..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          />
        </div>
        <div className="flex flex-wrap gap-3 w-full md:w-auto">
          <div className="flex items-center gap-2 border rounded-lg px-3 py-2 bg-slate-50 text-sm w-full sm:w-auto">
            <Filter className="w-4 h-4 text-gray-500" />
            <select 
              value={filterTipo} 
              onChange={(e) => setFilterTipo(e.target.value)} 
              className="bg-transparent border-none text-xs font-semibold focus:outline-none cursor-pointer text-gray-700 w-full"
            >
              <option value="TODOS">Todos os Tipos</option>
              <option value="SUBSTITUICAO">Substituição</option>
              <option value="ACRESCIMO">Acréscimo</option>
              <option value="EMPRESTIMO">Empréstimo</option>
            </select>
          </div>

          <div className="flex items-center gap-2 border rounded-lg px-3 py-2 bg-slate-50 text-sm w-full sm:w-auto">
            <Layers className="w-4 h-4 text-gray-500" />
            <select 
              value={filterStatus} 
              onChange={(e) => setFilterStatus(e.target.value)}
              className="bg-transparent border-none text-xs font-semibold focus:outline-none cursor-pointer text-gray-700 w-full"
            >
              <option value="TODOS">Todos os Status</option>
              <option value="AGUARDANDO_LAUDO">Aguardando Laudo</option>
              <option value="AGUARDANDO_DELIBERACAO">Aguardando GIT</option>
              <option value="EM_ENTREGA">Em Rota</option>
              <option value="CONCLUIDA">Concluídas</option>
              <option value="NEGADA">Negadas</option>
            </select>
          </div>

          <div className="flex items-center gap-2 border rounded-lg px-3 py-2 bg-slate-50 text-sm w-full sm:w-auto">
            <HelpCircle className="w-4 h-4 text-gray-500" />
            <select 
              value={filterRpa} 
              onChange={(e) => setFilterRpa(e.target.value)}
              className="bg-transparent border-none text-xs font-semibold focus:outline-none cursor-pointer text-gray-700 w-full"
            >
              <option value="TODOS">Todas RPAs</option>
              <option value="1">RPA 1</option>
              <option value="2">RPA 2</option>
              <option value="3">RPA 3</option>
              <option value="4">RPA 4</option>
              <option value="5">RPA 5</option>
              <option value="6">RPA 6</option>
            </select>
          </div>
        </div>
      </div>

      {/* 4. Tabela de Solicitações */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left text-gray-500">
            <thead className="text-xs text-gray-700 uppercase bg-slate-50 border-b">
              <tr>
                <th className="px-6 py-4">Código</th>
                <th className="px-6 py-4">Unidade</th>
                <th className="px-6 py-4">Tipo</th>
                <th className="px-6 py-4">Canal</th>
                <th className="px-6 py-4">Equipamento</th>
                <th className="px-6 py-4">Data Solicitação</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filteredRequests.map((request) => (
                <tr key={request.id} className="bg-white hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4 font-bold text-gray-900">{request.codigo}</td>
                  <td className="px-6 py-4">
                    <div className="font-semibold text-gray-800">{request.unidade}</div>
                    <div className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">RPA {request.rpa} • {request.unidadeTipo}</div>
                  </td>
                  <td className="px-6 py-4">{getTipoBadge(request.tipo)}</td>
                  <td className="px-6 py-4 font-medium text-xs text-gray-600 uppercase tracking-wider">{request.canal}</td>
                  <td className="px-6 py-4">
                    <div className="font-medium text-gray-800">{request.equipamento}</div>
                    <div className="text-xs text-gray-400">Qtd: {request.quantidade}</div>
                  </td>
                  <td className="px-6 py-4 text-xs font-semibold text-gray-600">{request.dataSolicitacao}</td>
                  <td className="px-6 py-4">{getStatusBadge(request.status)}</td>
                  <td className="px-6 py-4 text-right">
                    <button 
                      onClick={() => onViewDetails(request)}
                      className="inline-flex items-center gap-1 bg-slate-100 hover:bg-blue-50 hover:text-blue-700 text-gray-700 font-bold text-xs px-3 py-1.5 rounded-lg border transition-all"
                    >
                      <Eye className="w-3.5 h-3.5" /> Detalhes
                    </button>
                  </td>
                </tr>
              ))}
              {filteredRequests.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-6 py-10 text-center text-gray-500 font-medium bg-slate-50">
                    Nenhuma solicitação encontrada.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default RequestsDashboardView;
