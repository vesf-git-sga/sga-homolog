import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Activity, Calendar, AlertTriangle, CheckCircle, TrendingUp, Box, Target } from 'lucide-react';
import { 
    ResponsiveContainer, ComposedChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ReferenceLine, Area,
    BarChart, Bar, LabelList
} from 'recharts';

interface ProjectionData {
    totalMeta: number;
    totalDelivered: number;
    remaining: number;
    availableStock: number;
    velocity: number;
    weeklyVelocity: number;
    projectedDate: string | null;
    targetDeadline: string;
    chartData: any[];
    weeklyHistory: any[];
    rpaData: any[];
    delayDays: number;
    isLate: boolean;
}

// >>> COMPONENTE DE TOOLTIP CUSTOMIZADO (COM BARRA DE ESCOLAS) <<<
const CustomTooltipRPA = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
        const data = payload[0].payload; 
        
        // Evita divisão por zero se escolas_total não existir
        const maxEscolas = Math.max(1, data.escolas_total || 1);
        const percentualEscolas = ((data.escolas_atendidas || 0) / maxEscolas) * 100;

        return (
            <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg min-w-[220px] z-50">
                <p className="font-bold text-gray-800 border-b border-gray-200 pb-2 mb-3 text-sm uppercase tracking-wide">{label}</p>
                <div className="space-y-2">
                    <p className="text-sm font-bold flex justify-between items-center text-green-700 bg-green-50 p-1.5 rounded">
                        <span>Concluído:</span> <span>{data.entregues}</span>
                    </p>
                    <p className="text-sm font-bold flex justify-between items-center text-gray-600 bg-gray-50 p-1.5 rounded">
                        <span>Fila / Pendente:</span> <span>{data.pendentes}</span>
                    </p>
                </div>
                <div className="mt-4 pt-3 border-t border-dashed border-gray-300">
                    <p className="text-[10px] text-gray-400 uppercase font-bold tracking-wider mb-1 flex items-center">
                        <Box className="w-3 h-3 mr-1" /> Cobertura Escolar
                    </p>
                    <p className="text-sm text-gray-700">
                        Atendidas: <b className="text-blue-700">{data.escolas_atendidas || 0}</b> de {data.escolas_total || 0}
                    </p>
                    {/* Barra de Progresso Visual */}
                    <div className="w-full bg-gray-200 rounded-full h-1.5 mt-2">
                        <div 
                            className="bg-blue-600 h-1.5 rounded-full" 
                            style={{ width: `${percentualEscolas}%` }}
                        ></div>
                    </div>
                </div>
            </div>
        );
    }
    return null;
};

export default function ExecutiveDashboard({ API_URL }: { API_URL: string }) {
    const [data, setData] = useState<ProjectionData | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchProjection = async () => {
            try {
                const token = localStorage.getItem('token');
                const res = await axios.get(`${API_URL}/analytics/tablet-projection`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                setData(res.data);
            } catch (e) {
                console.error('Erro ao carregar painel executivo', e);
            } finally {
                setLoading(false);
            }
        };
        fetchProjection();
    }, [API_URL]);

    if (loading) return <div className="p-8 text-center text-gray-500 animate-pulse font-medium">Carregando Painel Executivo - Projeção...</div>;
    if (!data) return <div className="p-8 text-center text-red-500 font-bold">Erro ao carregar os dados. Verifique a conexão com o servidor.</div>;

    const isDelayed = data.projectedDate && new Date(data.projectedDate) > new Date(data.targetDeadline);
    const stockRupture = data.availableStock < data.remaining;
    const progressPercent = data.totalMeta > 0 ? ((data.totalDelivered / data.totalMeta) * 100).toFixed(1) : '0.0';

    // Cria um novo array calculando a porcentagem exata para o gráfico de RPA
    const rpaDataWithPercent = (data.rpaData || []).map(item => {
        const totalAlvos = item.entregues + item.pendentes; // Ignorando os devolvidos para o gráfico
        let perc = totalAlvos > 0 ? Math.round((item.entregues / totalAlvos) * 100) : 0;
        
        // >>> A CORREÇÃO (TRAVA DE AUDITORIA) <<<
        // Se o arredondamento bater 100%, mas ainda existir qualquer pendência (por menor que seja),
        // nós forçamos o valor para 99%. O 100% é exclusivo para quando a fila é rigorosamente ZERO.
        if (item.pendentes > 0 && perc >= 100) {
            perc = 99;
        }
        
        return {
            ...item,
            // Só renderiza o texto se o percentual for maior que 5% para caber na barra visualmente
            percentual: perc > 5 ? `${perc}%` : ''
        };
    });

    return (
        <div className="space-y-8 pb-10 animate-fadeIn">
            
            {/* CABEÇALHO */}
            <div className="border-b border-gray-200 pb-4">
                <h2 className="text-3xl font-extrabold text-blue-900 flex items-center tracking-tight">
                    <Target className="w-8 h-8 mr-3 text-blue-600" />
                    Painel Executivo - Projeção
                </h2>
                <p className="text-gray-500 mt-2 text-sm">Visão estratégica, metas e projeção de entregas do projeto de tablets escolares.</p>
            </div>

            {/* KPIS GERAIS (Linha 1) */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm flex flex-col justify-center">
                    <span className="text-xs font-bold text-gray-400 uppercase tracking-wide">Status da Meta</span>
                    <span className="text-4xl font-black text-gray-800 mt-2">{progressPercent}%</span>
                    <span className="text-sm text-green-600 font-medium mt-1">{data.totalDelivered} de {data.totalMeta} concluídos</span>
                </div>

                <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
                    <div className="flex justify-between items-start mb-2">
                        <span className="text-xs font-bold text-gray-400 uppercase tracking-wide">Run Rate Diário</span>
                        <Activity className="w-5 h-5 text-blue-500" />
                    </div>
                    <span className="text-3xl font-black text-blue-700">{data.velocity}</span>
                    <span className="text-sm text-gray-500 font-medium ml-2">tablets/dia</span>
                    <p className="text-[10px] text-gray-400 mt-2 leading-tight">Média com base nos dias úteis operacionais. Projeção de {data.weeklyVelocity} por semana.</p>
                </div>

                <div className={`border rounded-xl p-5 shadow-sm ${data.isLate ? 'bg-amber-50 border-amber-200' : 'bg-blue-50 border-blue-200'}`}>
                    <div className="flex justify-between items-start mb-3">
                        <span className={`text-xs font-bold uppercase tracking-wide ${data.isLate ? 'text-amber-800' : 'text-blue-800'}`}>
                            Performance de Entrega
                        </span>
                        <Calendar className={`w-5 h-5 ${data.isLate ? 'text-amber-600' : 'text-blue-600'}`} />
                    </div>
                    
                    <div className="space-y-3">
                        {/* Linha 1: Data Real */}
                        <div className="flex justify-between items-baseline">
                            <span className="text-sm font-medium text-gray-600">Data Real:</span>
                            <span className="text-xl font-black text-gray-800">25/06/2026</span>
                        </div>
                        
                        {/* Linha 2: Meta */}
                        <div className="flex justify-between items-baseline">
                            <span className="text-sm font-medium text-gray-600">Prazo Meta:</span>
                            <span className="text-md font-bold text-gray-500">31/05/2026</span>
                        </div>

                        {/* Linha 3: Desvio */}
                        <div className="flex justify-between items-baseline pt-2 border-t border-gray-200/50">
                            <span className="text-sm font-bold text-gray-700">Desvio:</span>
                            <span className={`text-sm font-black px-3 py-1 rounded-full ${data.isLate ? 'bg-amber-100 text-amber-800' : 'bg-green-100 text-green-700'}`}>
                                {data.delayDays > 0 ? `+${data.delayDays} dias` : 'No prazo'}
                            </span>
                        </div>
                    </div>
                </div>

                <div className={`border rounded-xl p-5 shadow-sm ${stockRupture ? 'bg-orange-50 border-orange-200' : 'bg-white border-gray-200'}`}>
                    <div className="flex justify-between items-start mb-2">
                        <span className={`text-xs font-bold uppercase tracking-wide ${stockRupture ? 'text-orange-700' : 'text-gray-400'}`}>Estoque Físico</span>
                        <Box className={`w-5 h-5 ${stockRupture ? 'text-orange-500' : 'text-gray-400'}`} />
                    </div>
                    <span className="text-3xl font-black text-gray-800">{data.availableStock}</span>
                    <span className="text-sm text-gray-500 font-medium ml-2">disponíveis</span>
                    {stockRupture ? (
                        <p className="text-xs font-bold text-orange-700 mt-2 flex items-center leading-tight">
                            <AlertTriangle className="w-3 h-3 mr-1 flex-shrink-0" /> Faltam {data.remaining - data.availableStock} equipamentos para a meta.
                        </p>
                    ) : (
                        <p className="text-xs font-bold text-green-600 mt-2 flex items-center">
                            <CheckCircle className="w-3 h-3 mr-1" /> Estoque cobre a demanda.
                        </p>
                    )}
                </div>
            </div>

            {/* GRÁFICO 1: BURN-UP (LARGURA TOTAL) */}
            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                <h3 className="font-bold text-gray-800 mb-6 text-lg flex items-center">
                    <TrendingUp className="w-5 h-5 mr-2 text-blue-600"/> 
                    Curva de Progresso (Entregas Reais vs. Projeção Matemática)
                </h3>
                <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={data.chartData || []} margin={{ top: 20, right: 20, bottom: 0, left: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                            <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#888' }} axisLine={false} tickLine={false} />
                            <YAxis tick={{ fontSize: 11, fill: '#888' }} axisLine={false} tickLine={false} />
                            <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }} />
                            <Legend wrapperStyle={{ paddingTop: '10px' }} />
                            
                            <Line type="linear" dataKey="planejado" name="Ritmo Ideal (Alvo)" stroke="#10b981" strokeWidth={2} strokeDasharray="3 3" dot={false} />
                            
                            <Area 
                                type="monotone" 
                                dataKey="realizado" 
                                name="Entregas Reais Acumuladas" 
                                fill="#93c5fd" 
                                fillOpacity={0.5} 
                                stroke="#2563eb" 
                                strokeWidth={3} 
                                dot={{ r: 4, fill: '#2563eb' }} 
                                activeDot={{ r: 6 }} 
                            />
                            
                            <Line type="monotone" dataKey="projetado" name="Projeção Estimada" stroke="#f59e0b" strokeWidth={3} strokeDasharray="5 5" dot={false} activeDot={{ r: 6 }} />
                            <ReferenceLine y={data.totalMeta} label={{ position: 'insideTopLeft', value: `Alvo Total: ${data.totalMeta} alunos`, fill: '#dc2626', fontSize: 11, fontWeight: 'bold' }} stroke="#dc2626" strokeDasharray="3 3" />
                        </ComposedChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* LINHA 3: GRÁFICOS SECUNDÁRIOS */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                
                {/* Gráfico de Barras: Velocidade Semanal */}
                <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                    <h3 className="font-bold text-gray-800 mb-4 text-md">Histórico de Entregas por Semana</h3>
                    <div className="h-60">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={data.weeklyHistory || []} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#888' }} axisLine={false} tickLine={false} />
                                <YAxis tick={{ fontSize: 11, fill: '#888' }} axisLine={false} tickLine={false} />
                                <Tooltip cursor={{fill: '#f3f4f6'}} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }} />
                                <Bar dataKey="entregas" name="Qtd. Entregue" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={40} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Gráfico de Barras Empilhadas: Avanço por RPA */}
                <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                    <h3 className="font-bold text-gray-800 mb-4 text-md">Avanço da Meta por Região (RPA)</h3>
                    <div className="h-60">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={rpaDataWithPercent} layout="vertical" margin={{ top: 0, right: 30, left: 10, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f0f0f0" />
                                <XAxis type="number" hide />
                                
                                <YAxis dataKey="name" type="category" width={70} tick={{ fontSize: 12, fill: '#374151', fontWeight: 'bold' }} axisLine={false} tickLine={false} />
                                
                                {/* >>> INJEÇÃO DO TOOLTIP CUSTOMIZADO COM ESCOLAS <<< */}
                                <Tooltip content={<CustomTooltipRPA />} cursor={{ fill: 'rgba(0,0,0,0.04)' }} />
                                
                                <Legend wrapperStyle={{ paddingTop: '10px', fontSize: '12px', fontWeight: '500', color: '#4b5563' }} />
                                
                                <Bar dataKey="entregues" name="Concluído" stackId="a" fill="#10b981" radius={[0, 0, 0, 0]} barSize={24}>
                                    <LabelList dataKey="percentual" position="insideRight" fill="#ffffff" fontSize={11} fontWeight="bold" />
                                </Bar>
                                
                                <Bar dataKey="pendentes" name="Fila / Pendente" stackId="a" fill="#d1d5db" radius={[0, 4, 4, 0]} barSize={24} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

            </div>
        </div>
    );
}