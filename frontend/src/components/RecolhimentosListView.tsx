import React, { useState } from 'react';
import { 
  ArchiveRestore, Search, Filter, ShieldCheck, AlertCircle, FileText, 
  ExternalLink, Calendar, HelpCircle, Eye, Info, CheckCircle, Clock, Truck
} from 'lucide-react';

interface RecolhimentosListViewProps {
  onSelectRequestByChamado: (chamado: string) => void;
}

export const mockRecolhimentos = [
  {
    id: 1,
    numeroChamado: '10293',
    tombo: '29381',
    serial: 'SN-TV43981B',
    rpa: 3,
    dataRecolhimento: '2026-05-12',
    dataLaudo: '2026-05-14',
    status: 'LAUDO_EMITIDO',
    laudoUrl: 'https://drive.google.com/drive/folders/mock_laudo_1',
    obs: 'TV SUBSTITUIDA 2026/10293',
    unidade: 'Escola Municipal Novo Horizonte',
  },
  {
    id: 2,
    numeroChamado: '10344',
    tombo: '77218',
    serial: 'SN-TV50001A',
    rpa: 5,
    dataRecolhimento: '2026-05-30',
    dataLaudo: null,
    status: 'AGUARDANDO_LAUDO',
    laudoUrl: null,
    obs: '',
    unidade: 'Creche Municipal Criança Feliz',
  },
  {
    id: 3,
    numeroChamado: '10112',
    tombo: '88391',
    serial: 'SN-TV43990X',
    rpa: 1,
    dataRecolhimento: '2026-04-20',
    dataLaudo: '2026-04-22',
    status: 'LAUDO_EMITIDO',
    laudoUrl: 'https://drive.google.com/drive/folders/mock_laudo_3',
    obs: 'TV SUBSTITUIDA 2026/10112',
    unidade: 'Escola Municipal de Santo Amaro',
  },
  {
    id: 4,
    numeroChamado: '10411',
    tombo: 'S/TOMBO',
    serial: 'SN-UNKNOWN-992',
    rpa: 6,
    dataRecolhimento: '2026-06-01',
    dataLaudo: null,
    status: 'AGUARDANDO_LAUDO',
    laudoUrl: null,
    obs: '',
    unidade: 'CMEI Brasília Teimosa',
  },
  {
    id: 5,
    numeroChamado: '10088',
    tombo: '10293',
    serial: 'SN-TV43881C',
    rpa: 4,
    dataRecolhimento: '2026-04-10',
    dataLaudo: '2026-04-12',
    status: 'AGUARDANDO_CARRO',
    laudoUrl: 'https://drive.google.com/drive/folders/mock_laudo_5',
    obs: 'Aguardando carreto de recolhimento geral do depósito',
    unidade: 'Escola Municipal Cordeiro',
  },
  {
    id: 6,
    numeroChamado: '10041',
    tombo: '30491',
    serial: 'SN-TV32091Z',
    rpa: 2,
    dataRecolhimento: '2026-03-25',
    dataLaudo: null,
    status: 'RESOLVIDO',
    laudoUrl: null,
    obs: 'Visita técnica resolveu o problema (defeito simples na tomada da escola), sem necessidade de recolher.',
    unidade: 'Escola Municipal da Iputinga',
  }
];

const RecolhimentosListView: React.FC<RecolhimentosListViewProps> = ({
  onSelectRequestByChamado,
}) => {
  const [recolhimentosList, setRecolhimentosList] = useState(mockRecolhimentos);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRpa, setFilterRpa] = useState('TODOS');
  const [filterStatus, setFilterStatus] = useState('TODOS');

  // Metricas
  const totalRecolhidos = recolhimentosList.length;
  const laudoEmitidoCount = recolhimentosList.filter(r => r.status === 'LAUDO_EMITIDO').length;
  const aguardandoLaudoCount = recolhimentosList.filter(r => r.status === 'AGUARDANDO_LAUDO').length;
  const aguardandoCarroCount = recolhimentosList.filter(r => r.status === 'AGUARDANDO_CARRO').length;

  const filteredRecolhimentos = recolhimentosList.filter(item => {
    const matchesRpa = filterRpa === 'TODOS' || item.rpa.toString() === filterRpa;
    const matchesStatus = filterStatus === 'TODOS' || item.status === filterStatus;
    const matchesSearch = item.numeroChamado.includes(searchTerm) || 
                          item.tombo.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          item.unidade.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (item.obs && item.obs.toLowerCase().includes(searchTerm.toLowerCase()));
    return matchesRpa && matchesStatus && matchesSearch;
  });

  const getStatusBadge = (status: string) => {
    const styles: { [key: string]: string } = {
      LAUDO_EMITIDO: 'bg-green-100 text-green-800 border-green-200',
      AGUARDANDO_LAUDO: 'bg-amber-100 text-amber-800 border-amber-200',
      AGUARDANDO_CARRO: 'bg-indigo-100 text-indigo-800 border-indigo-200',
      RESOLVIDO: 'bg-blue-100 text-blue-800 border-blue-200',
    };

    const labels: { [key: string]: string } = {
      LAUDO_EMITIDO: 'Laudo Emitido',
      AGUARDANDO_LAUDO: 'Aguardando Laudo',
      AGUARDANDO_CARRO: 'Aguardando Carro',
      RESOLVIDO: 'Resolvido (Sem Coleta)',
    };

    const Icons: { [key: string]: React.ElementType } = {
      LAUDO_EMITIDO: CheckCircle,
      AGUARDANDO_LAUDO: Clock,
      AGUARDANDO_CARRO: Truck,
      RESOLVIDO: ShieldCheck,
    };

    const Icon = Icons[status] || Clock;

    return (
      <span className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-full border ${styles[status] || 'bg-slate-100 text-slate-800'}`}>
        <Icon className="w-3.5 h-3.5" /> {labels[status] || status}
      </span>
    );
  };

  return (
    <div className="space-y-6 pb-10 animate-fadeIn">
      {/* 1. Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b pb-4 gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-blue-900 tracking-tight">Recolhimento de Equipamentos & TVs</h1>
          <p className="text-gray-500 mt-1">Livro de Logística Reversa: TVs e outros equipamentos coletados durante visitas técnicas da GIT.</p>
        </div>
      </div>

      {/* 2. KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Total de Coletas</p>
            <h3 className="text-2xl font-black text-gray-800 mt-1">{totalRecolhidos}</h3>
          </div>
          <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
            <ArchiveRestore className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Laudo Emitido (~89%)</p>
            <h3 className="text-2xl font-black text-green-600 mt-1">{laudoEmitidoCount}</h3>
          </div>
          <div className="p-3 bg-green-50 text-green-600 rounded-xl">
            <CheckCircle className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Aguardando Laudo</p>
            <h3 className="text-2xl font-black text-amber-600 mt-1">{aguardandoLaudoCount}</h3>
          </div>
          <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
            <Clock className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Aguardando Carro</p>
            <h3 className="text-2xl font-black text-indigo-600 mt-1">{aguardandoCarroCount}</h3>
          </div>
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
            <Truck className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* 3. Filtros */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col md:flex-row gap-4 items-center">
        <div className="relative w-full md:flex-1">
          <Search className="absolute left-3 top-2.5 text-gray-400 w-5 h-5" />
          <input 
            type="text" 
            placeholder="Buscar por chamado, tombo, unidade escolar ou observações..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          />
        </div>
        <div className="flex flex-wrap gap-3 w-full md:w-auto">
          <div className="flex items-center gap-2 border rounded-lg px-3 py-2 bg-slate-50 text-sm w-full sm:w-auto">
            <Filter className="w-4 h-4 text-gray-500" />
            <select 
              value={filterStatus} 
              onChange={(e) => setFilterStatus(e.target.value)}
              className="bg-transparent border-none text-xs font-semibold focus:outline-none cursor-pointer text-gray-700 w-full"
            >
              <option value="TODOS">Todos os Status</option>
              <option value="LAUDO_EMITIDO">Laudo Emitido</option>
              <option value="AGUARDANDO_LAUDO">Aguardando Laudo</option>
              <option value="AGUARDANDO_CARRO">Aguardando Carro</option>
              <option value="RESOLVIDO">Resolvido (Sem Coleta)</option>
            </select>
          </div>

          <div className="flex items-center gap-2 border rounded-lg px-3 py-2 bg-slate-50 text-sm w-full sm:w-auto">
            <Filter className="w-4 h-4 text-gray-500" />
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

      {/* 4. Tabela de Recolhimentos */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left text-gray-500">
            <thead className="text-xs text-gray-700 uppercase bg-slate-50 border-b">
              <tr>
                <th className="px-6 py-4">Nº Chamado</th>
                <th className="px-6 py-4">Unidade Escolar</th>
                <th className="px-6 py-4">Tombo / Série</th>
                <th className="px-6 py-4">RPA</th>
                <th className="px-6 py-4">Data Recolhimento</th>
                <th className="px-6 py-4">Data Laudo</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Laudo (Drive)</th>
                <th className="px-6 py-4">Observações (Ref. Cruzada)</th>
                <th className="px-6 py-4 text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filteredRecolhimentos.map((item) => (
                <tr key={item.id} className="bg-white hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4 font-bold text-gray-800">#{item.numeroChamado}</td>
                  <td className="px-6 py-4 font-semibold text-slate-800">{item.unidade}</td>
                  <td className="px-6 py-4">
                    <div className={`font-bold ${item.tombo === 'S/TOMBO' ? 'text-red-500 italic' : 'text-slate-800'}`}>{item.tombo}</div>
                    <div className="text-[10px] text-gray-400 font-bold">{item.serial}</div>
                  </td>
                  <td className="px-6 py-4 font-semibold text-slate-800">RPA 0{item.rpa}</td>
                  <td className="px-6 py-4 font-semibold text-xs text-slate-500">{item.dataRecolhimento}</td>
                  <td className="px-6 py-4 font-semibold text-xs text-slate-500">{item.dataLaudo || '-'}</td>
                  <td className="px-6 py-4">{getStatusBadge(item.status)}</td>
                  <td className="px-6 py-4">
                    {item.laudoUrl ? (
                      <a 
                        href={item.laudoUrl} 
                        target="_blank" 
                        rel="noreferrer" 
                        className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-700 hover:text-blue-900 bg-blue-50 border border-blue-100 px-2 py-1 rounded"
                      >
                        Abrir <ExternalLink className="w-3 h-3" />
                      </a>
                    ) : (
                      <span className="text-gray-400 text-xs">-</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    {item.obs ? (
                      <span className="inline-block max-w-[200px] truncate text-xs bg-slate-100 border px-1.5 py-0.5 rounded text-gray-700 font-medium" title={item.obs}>
                        {item.obs}
                      </span>
                    ) : (
                      <span className="text-slate-400 text-xs italic">Nenhuma observação</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button 
                      onClick={() => onSelectRequestByChamado(item.numeroChamado)}
                      className="inline-flex items-center gap-1 bg-slate-100 hover:bg-blue-50 hover:text-blue-700 text-gray-700 font-bold text-xs px-2.5 py-1.5 rounded-lg border transition-all"
                      title="Visualizar solicitação vinculada"
                    >
                      <Eye className="w-3.5 h-3.5" /> Solicitação
                    </button>
                  </td>
                </tr>
              ))}
              {filteredRecolhimentos.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-6 py-10 text-center text-gray-500 font-medium bg-slate-50">
                    Nenhum recolhimento encontrado.
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

export default RecolhimentosListView;
