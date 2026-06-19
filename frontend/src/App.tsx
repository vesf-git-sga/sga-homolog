import React, { useState, useEffect, createContext, useContext, ReactNode, useCallback, useMemo } from 'react';
import InputMask from 'react-input-mask';
import {
  Mail, Lock, LogIn, Menu, X, LayoutDashboard, HardDrive, BarChart2, Bell, Settings, LogOut,
  Box, CornerDownRight, CornerUpLeft, Calendar, List, Inbox, PlusCircle, UploadCloud, Edit, Trash2,
  CheckCircle, XCircle, Info, AlertTriangle as AlertTriangleIcon, Repeat, FileText, Users,
  Search, Archive, ArrowRightLeft, ChevronDown, History, UserCircle, Save, Activity, Database, ArrowDownCircle, Smartphone, ChevronRight, GraduationCap, Truck, Layers, ArchiveRestore, Package, Code, TrendingUp, Download, Filter  // Adicionado Users e Search para pessoas e busca
} from 'lucide-react';
import { ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import axios, { AxiosError } from 'axios';
import logoSGA from './assets/images/logo-sga-azul.png'; // Ajuste o caminho se necessário
import MovementQueryPage from './components/MovementQueryPage'; // Importa o novo componente
import DeliveryConfirmationPage from './components/DeliveryConfirmationPage';
import ConfirmationModal from './components/ConfirmationModal';
import ImportResultModal from './components/ImportResultModal';
import LoanRenewalModal from './components/LoanRenewalModal';
import LoanRenewalPage from './components/LoanRenewalPage';
import SubstitutionModal from './components/SubstitutionModal';
import ReturnConfirmationModal from './components/ReturnConfirmationModal';
import RetireAssetModal from './components/RetireAssetModal';
import DisposeAssetModal from './components/DisposeAssetModal';
import AssetManagementPage from './components/AssetManagementPage';
import RetirementAndDisposalPage from './components/RetirementAndDisposalPage';
import QueryHubPage from './components/QueryHubPage';
import UnitForm from './components/UnitForm';
import ParentUnitModal from './components/ParentUnitModal';
import Select from 'react-select';
import CreatableSelect from 'react-select/creatable';
import TabletDashboard from './components/TabletDashboard';
import AnalyticsDashboard from './components/AnalyticsDashboard';
import TabletAudit from './components/TabletAudit';
import SimSwapModal from './components/SimSwapModal'
import AuditLogPage from './components/AuditLogPage';
import FinalizeSubstitutionModal from './components/FinalizeSubstitutionModal';
import BatchCollectionPage from './components/BatchCollectionPage';
import DashboardView from './components/DashboardView';
import CdInventoryPage from './components/CdInventoryPage';
import PendingTermsList from './components/PendingTermsList';
import ExecutiveDashboard from './components/ExecutiveDashboard';


// --- LISTAS PADRÃO PARA COMBOS (DROPDOWNS) ---

const EDUCATION_YEARS = [
  "GRUPO I", "GRUPO II", "GRUPO III", "GRUPO IV", "GRUPO V",
  "1º ANO", "2º ANO", "3º ANO", "4º ANO", "5º ANO",
  "6º ANO", "7º ANO", "8º ANO", "9º ANO",
  "CORREÇÃO DE FLUXO",
  "TRAVESSIA",
  "EJA I", "EJA II" // Adicionei EJA por precaução, pode remover se não usar
];

const CLASS_NAMES = [
  "A", "B", "C", "D", "E", "F", "G", "H", "I", "J",
  "K", "L", "M", "N", "O", "P", "Q", "R", "S", "T",
  "U", "V", "W", "X", "Y", "Z", "ÚNICA"
];

const PCD_TYPES = [
  "NÃO", // Opção padrão
  "AUTISMO (TEA)",
  "BAIXA VISÃO",
  "CEGUEIRA",
  "DEFICIÊNCIA AUDITIVA",
  "DEFICIÊNCIA FÍSICA",
  "DEFICIÊNCIA INTELECTUAL",
  "DEFICIÊNCIA MÚLTIPLA",
  "SURDEZ",
  "SURDOCEGUEIRA",
  "ALTAS HABILIDADES/SUPERDOTAÇÃO",
  "SÍNDROME DE DOWN",
  "TDAH"
];

// Função para formatar telefone (Fixo ou Celular) na exibição
const formatPhoneDisplay = (phone: string | undefined | null) => {
  if (!phone) return '-';

  // Remove tudo que não for número para limpar sujeira
  const cleanValue = phone.replace(/\D/g, '');

  // Lógica para Fixo (10 dígitos: 2 DDD + 8 número)
  if (cleanValue.length === 10) {
    return cleanValue.replace(/^(\d{2})(\d{4})(\d{4})$/, '($1) $2-$3');
  }

  // Lógica para Celular (11 dígitos: 2 DDD + 9 número)
  if (cleanValue.length === 11) {
    return cleanValue.replace(/^(\d{2})(\d{5})(\d{4})$/, '($1) $2-$3');
  }

  // Se não bater com os padrões (ex: número incompleto), retorna o original
  return phone;
};

const translateActionType = (type: string): string => {
  const typeMap: { [key: string]: string } = {
    // Ações de Autenticação
    'login_success': 'Login Bem-Sucedido',
    'login_failed': 'Falha no Login',
    'logout': 'Logout',

    // Ações de Usuário
    'user_created': 'Criação de Usuário',
    'update_user_success': 'Atualização de Usuário',
    'delete_user_success': 'Exclusão de Usuário',
    'password_change_success': 'Alteração de Senha',

    // Ações de Movimentação
    'create_movement_loan': 'Criação de Empréstimo',
    'create_movement_exit': 'Criação de Saída',
    'create_movement_return': 'Criação de Devolução',
    'confirm_delivery': 'Confirmação de Entrega',
    'renew_loan': 'Renovação de Empréstimo',
    'asset_substitution': 'Substituição de Ativo',
    'asset_kit_substitution': 'Substituição de Kit',

    // Ações de Ativos
    'create_asset': 'Criação de Ativo',
    'update_asset': 'Atualização de Ativo',
    'delete_asset': 'Exclusão de Ativo',
    'retire_asset': 'Baixa de Ativo',
    'dispose_asset': 'Descarte de Ativo',
    'import_assets': 'Importação de Ativos',

    // Ações de Baixa/Descarte (Processo Novo)
    'request_retirement': 'Solicitação de Baixa',
    'approve_retirement': 'Aprovação de Baixa',
    'reject_retirement': 'Rejeição de Baixa',

    // Ações Genéricas
    'unauthorized_access': 'Acesso Não Autorizado',
    'generate_report': 'Geração de Relatório',
  };
  return typeMap[type] || type.replace(/_/g, ' '); // Se não encontrar, formata o original
};


// =====================================================================================
// Definições de Tipos TypeScript (Interfaces)
// =====================================================================================

// Interface para o objeto de usuário
interface User {
  id: number;
  username: string;
  email: string;
  full_name?: string;
  role: 'admin' | 'manager' | 'basic';
  must_change_password?: boolean;
  is_active?: boolean;
  job_title?: string;
  registration_number?: string;
  cpf?: string;
  unit_id?: number;
}

// Interface para os dados da unidade, para ajudar com o TypeScript
interface UnitData {
  type: 'ADMINISTRATIVA' | 'ESCOLAR' | 'EXTERNA' | '';
  name: string;
  code?: string;
  parent_id?: number | null;
  status: string;
  address?: string;
  contact_phone?: string;
  contact_email?: string;
  notes?: string;
}

// Interface para o contexto de autenticação
interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; message: string }>;
  logout: () => Promise<void>;
  API_URL: string;
}

// Interface para os dados do Dashboard (ATUALIZADA)
interface DashboardData {
  totalAssets: number;
  availableAssets: number;
  inUseAssets: number;
  loanedAssets: number;
  maintenanceAssets: number;
  retiredAssets: number;
  disposedAssets: number;
  pendingDeliveriesCount: number;
  pendingSubstitutionsCount: number;
  assetsByCategory: { name: string; value: number }[];
  recentMovements: { id: number | string; asset: string; type: string; date: string; user: string }[];
  pendingAlerts: { id: string; message: string; asset: string; dueDate: string }[];
  expiringWarranties: { count: number; description: string; endDate: string; daysRemaining: number }[];
}

// Interface para Tipos de Itens
interface ItemType {
  id: number;
  code: string;
  name: string;
  description?: string;
  sku_code?: string;
}

// Interface para Unidades
export interface Unit {
  id: number;
  type: 'ADMINISTRATIVA' | 'ESCOLAR' | 'EXTERNA';
  name: string;
  code?: string;
  parent_id?: number | null;
  status: string;
  address?: string;
  contact_phone?: string;
  contact_email?: string;
  notes?: string;
  current_assets_count?: number;
}

// Interface para Ativos (ATUALIZADA com dados logísticos complementares)
export interface Asset {
  id: number;
  sku: string;
  item_type_id: number;
  brand: string;
  model: string;
  description?: string;
  serial_number?: string;
  patrimonio_number?: string;
  unit_of_measure?: string;
  status: string;
  current_unit_id?: number;
  acquisition_date?: string;
  warranty_end_date?: string;
  notes?: string;
  item_type_name: string;
  current_unit_name?: string;
  // >>> NOVOS CAMPOS ADICIONADOS PARA TABLETS <<<
  imei?: string;
  sim_card_number?: string;
  box_number?: string;
  has_livox?: boolean;
  allow_automation?: boolean;
}

// Interface para Pessoas
export interface Person {
  id: number;
  full_name: string;
  unit_id?: number; // Renomeado
  registration_number?: string;
  cpf: string;
  email: string;
  contact_phone?: string;
  unit_name?: string; // Adicionado para clareza (nome da unidade da pessoa)
  current_assets_count?: number;
  job_title?: string;
}

// Interface para Movimentações (ATUALIZADA com campos de pessoa e novos campos)
export interface Movement {
  id: number;
  movement_id?: number;
  asset_ids?: number[]; // AGORA É UM ARRAY DE IDS
  assets?: Asset[]; // Para exibir os ativos associados à movimentação
  movement_type: 'entry' | 'exit' | 'loan' | 'return' | 'maintenance';
  movement_date: string; // ISO date string
  responsible_user_id: number;
  recipient_person_id?: number;
  recipient_name?: string;
  recipient_document?: string;
  purpose?: string;
  expected_return_date?: string; // ISO date string
  actual_return_date?: string; // ISO date string
  notes?: string;
  created_at: string;
  updated_at: string;
  sku?: string; // Pode não existir se for multi-ativo
  brand?: string; // Pode não existir se for multi-ativo
  model?: string; // Pode não existir se for multi-ativo
  responsible_username: string;
  responsible_full_name?: string;
  recipient_person_full_name?: string;
  recipient_person_cpf?: string;
  recipient_person_registration?: string;
  destination_unit_id?: number; // Renomeado
  destination_unit_name?: string; // Renomeado (do JOIN)
  request_channel_type?: 'Email' | 'SEI' | 'Ordem Direta'; // NOVO
  request_channel_details?: string; // NOVO
  total_assets_moved?: number; // Para o totalizador
  recipient_display_name?: string;
  delivery_status?: 'pending_confirmation' | 'confirmed';
  peripherals?: Peripheral[];
}

export interface Peripheral {
  peripheral_type: string;
  quantity: number;
  status: 'out' | 'returned' | 'in';
}

// Interface para a estrutura de resposta de erro do backend
interface BackendErrorResponse {
  message?: string;
  [key: string]: any;
}

// Interfaces para o sistema de Toast
type ToastType = 'success' | 'error' | 'info' | 'warning';

interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextType {
  addToast: (message: string, type?: ToastType) => void;
}

// Interface para o log de auditoria no topo do arquivo
interface AuditLog {
  id: number;
  action_type: string;
  target_entity: string;
  details: any;
  ip_address: string;
  created_at: string;
  user_name: string;
  username: string;
}

// =====================================================================================
// Contexto e Provedor de Toast
// =====================================================================================

const ToastContext = createContext<ToastContextType | null>(null);

const ToastProvider = ({ children }: { children: ReactNode }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((message: string, type: ToastType = 'info') => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prevToasts) => [...prevToasts, { id, message, type }]);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prevToasts) => prevToasts.filter((toast) => toast.id !== id));
  }, []);

  useEffect(() => {
    if (toasts.length > 0) {
      const timer = setTimeout(() => {
        removeToast(toasts[0].id);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [toasts, removeToast]);

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}
      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

const ToastContainer = ({ toasts, removeToast }: { toasts: Toast[]; removeToast: (id: string) => void }) => {
  return (
    <div className="fixed top-4 right-4 z-[2000] space-y-3">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} removeToast={removeToast} />
      ))}
    </div>
  );
};

// Coloque isso no início do seu componente App, junto com as outras constantes
//const API_URL = 'http://100.67.80.83:5000/api';

const ToastItem = ({ toast, removeToast }: { toast: Toast; removeToast: (id: string) => void }) => {
  const bgColor = {
    success: 'bg-green-500',
    error: 'bg-red-500',
    info: 'bg-blue-500',
    warning: 'bg-yellow-500',
  }[toast.type];

  const Icon = {
    success: CheckCircle,
    error: XCircle,
    info: Info,
    warning: AlertTriangleIcon,
  }[toast.type];

  return (
    <div
      className={`${bgColor} text-white px-4 py-3 rounded-lg shadow-lg flex items-center space-x-3 transition-all duration-300 ease-out transform translate-x-0 opacity-100`}
      role="alert"
    >
      {Icon && <Icon className="w-5 h-5 flex-shrink-0" />}
      <span className="text-sm font-medium flex-grow">{toast.message}</span>
      <button onClick={() => removeToast(toast.id)} className="ml-auto p-1 rounded-full hover:bg-white hover:bg-opacity-20 transition-colors duration-150">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};


// =====================================================================================
// Contexto e Provedor de Autenticação
// =====================================================================================

export const AuthContext = createContext<AuthContextType | null>(null);

const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
  const [loading, setLoading] = useState<boolean>(true);
  const { addToast } = useToast();

  // Tenta ler do .env, se não achar, usa o host atual de forma 100% dinâmica na porta 5000
  let API_URL = process.env.REACT_APP_API_URL || `http://${window.location.hostname}:5000/api`;
  // Garante que a URL termine exatamente com '/api' para evitar 404 nos endpoints
  API_URL = API_URL.replace(/\/$/, ''); // Remove barra no final se houver
  if (!API_URL.endsWith('/api')) {
    API_URL = `${API_URL}/api`;
  }

  useEffect(() => {
    const verifyToken = async () => {
      if (token) {
        try {
          const response = await axios.get(`${API_URL}/auth/verify-token`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          if (response.data.isValid) {
            setUser(response.data.user as User);
          } else {
            localStorage.removeItem('token');
            setToken(null);
            setUser(null);
            addToast('Sua sessão expirou ou é inválida. Por favor, faça login novamente.', 'warning');
          }
        } catch (error: unknown) {
          console.error('Erro ao verificar token:', error);
          localStorage.removeItem('token');
          setToken(null);
          setUser(null);
          addToast('Erro ao verificar sessão. Por favor, faça login novamente.', 'error');
        }
      }
      setLoading(false);
    };
    verifyToken();
  }, [token, API_URL, addToast]);

  const login = async (email: string, password: string): Promise<{ success: boolean; message: string }> => {
    try {
      const response = await axios.post(`${API_URL}/auth/login`, { email, password });
      const { token: newToken, user: userData } = response.data;
      localStorage.setItem('token', newToken);
      setToken(newToken);
      setUser(userData as User);
      addToast('Login bem-sucedido!', 'success');
      return { success: true, message: 'Login bem-sucedido!' };
    } catch (error: unknown) {
      console.error('Erro no login:', error);
      const axiosError = error as AxiosError<BackendErrorResponse>;
      const errorMessage = (axiosError.response?.data?.message && typeof axiosError.response.data.message === 'string')
        ? axiosError.response.data.message
        : 'Erro ao fazer login.';
      addToast(errorMessage, 'error');
      return { success: false, message: errorMessage };
    }
  };

  const logout = async (): Promise<void> => {
    try {
      await axios.post(`${API_URL}/auth/logout`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      addToast('Logout realizado com sucesso.', 'info');
    } catch (error: unknown) {
      console.error('Erro ao registrar logout no backend:', error);
      addToast('Erro ao fazer logout.', 'error');
    } finally {
      localStorage.removeItem('token');
      setToken(null);
      setUser(null);
    }
  };

  useEffect(() => {
    const requestInterceptor = axios.interceptors.request.use(config => {
      const currentToken = localStorage.getItem('token');
      if (currentToken) {
        config.headers.Authorization = `Bearer ${currentToken}`;
      }
      return config;
    }, error => {
      return Promise.reject(error);
    });

    return () => {
      axios.interceptors.request.eject(requestInterceptor);
    };
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout, API_URL }}>
      {children}
    </AuthContext.Provider>
  );
};

// Componente da Página de Login
const LoginPage = () => {
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const { login } = useContext(AuthContext) as AuthContextType;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    await login(email, password);
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center font-sans text-gray-800">
      <div className="bg-white p-8 md:p-12 rounded-xl shadow-2xl w-full max-w-md mx-4 sm:mx-6 md:mx-auto transition-all duration-300 ease-in-out transform hover:scale-105">
        <div className="flex justify-center mb-6">
          <img
            src={logoSGA}
            alt="Logo Prefeitura do Recife"
            className="h-40 w-auto rounded-lg shadow-md"
            onError={(e: React.SyntheticEvent<HTMLImageElement, Event>) => { e.currentTarget.onerror = null; e.currentTarget.src = 'https://placehold.co/150x80/007bff/ffffff?text=Logo'; }}
          />
        </div>

        <h2 className="text-3xl font-extrabold text-center text-blue-900 mt-8 mb-8 tracking-tight">
          SGA - Sistema de Gestão de Ativos
        </h2>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
              <Mail className="inline-block w-4 h-4 mr-2 text-blue-600" /> Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="appearance-none block w-full px-4 py-2 border border-gray-300 rounded-lg shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm transition duration-200 ease-in-out"
              placeholder="seu.email@recife.pe.gov.br"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
              <Lock className="inline-block w-4 h-4 mr-2 text-blue-600" /> Senha
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 block w-full px-4 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm transition duration-200 ease-in-out"
              placeholder="••••••••"
            />
          </div>

          <div>
            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center items-center py-2 px-4 border border-transparent rounded-lg shadow-sm text-lg font-semibold text-white bg-blue-700 hover:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-600 transition duration-300 ease-in-out transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Entrar
            </button>
          </div>
        </form>

        <div className="mt-8 text-center text-sm text-gray-600">
          <p>Acesso restrito. Solicite seu cadastro via e-mail:</p>
          <a href="mailto:relacionamentosepti@educ.rec.br" className="font-medium text-blue-700 hover:text-blue-900 transition-colors duration-200">
            relacionamentosepti@educ.rec.br
          </a>
        </div>

        {/* >>> ASSINATURA NA TELA DE LOGIN <<< */}
        <div className="mt-8 pt-6 border-t border-blue-100 text-center">
          <p className="text-xs text-gray-500 font-medium">Sistema de Gestão de Ativos (SGA)</p>
          <p className="text-[11px] text-gray-400 mt-1">
            Idealizado e desenvolvido pela <span className="font-semibold text-gray-500">GIT - Gerência de Infraestrutura</span>
          </p>
          <p className="text-[10px] text-gray-400 mt-1 flex items-center justify-center">
            <Code className="w-3 h-3 mr-1" /> Gestão: Alberto Dantas
          </p>
        </div>

      </div>
    </div>
  );
};

// Arquivo: App.tsx

// >>> Componente de página Configurações
interface SettingsPageProps {
  users: User[];
  onAddUser: () => void;
  onDeleteUser: (userId: number) => void;
  onEditUser: (user: User) => void;
}

const SettingsPage = ({ users, onAddUser, onDeleteUser, onEditUser }: SettingsPageProps) => {
  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-extrabold text-blue-900 mb-6">Gestão de Usuários</h1>
      <div className="flex">
        <button
          onClick={onAddUser}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg shadow-md hover:bg-blue-700 flex items-center transition-colors duration-200"
        >
          <PlusCircle className="w-5 h-5 mr-2" /> Adicionar Novo Usuário
        </button>
      </div>
      <div className="bg-white p-6 rounded-xl shadow-md">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Usuários do Sistema</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left text-gray-500">
            <thead className="text-xs text-gray-700 uppercase bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3">Nome Completo</th>
                <th scope="col" className="px-6 py-3">Email</th>
                <th scope="col" className="px-6 py-3">Perfil</th>
                <th scope="col" className="px-6 py-3">Status</th> {/* <<< NOVA COLUNA */}
                <th scope="col" className="px-6 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="bg-white border-b hover:bg-gray-50">
                  <td scope="row" className="px-6 py-4 font-medium text-gray-900 whitespace-nowrap">{user.full_name}</td>
                  <td className="px-6 py-4">{user.email}</td>
                  <td className="px-6 py-4">{user.role}</td>
                  <td className="px-6 py-4">
                    {/* <<< TAG DE STATUS VISUAL >>> */}
                    <span className={`px-2 py-1 font-semibold leading-tight text-xs rounded-full ${user.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-600'
                      }`}>
                      {user.is_active ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right whitespace-nowrap">
                    <button
                      onClick={() => onEditUser(user)}
                      className="font-medium text-blue-600 hover:underline mr-4"
                      title="Editar Usuário"
                    >
                      <Edit className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => onDeleteUser(user.id)}
                      className="font-medium text-red-600 hover:underline"
                      title="Remover Usuário"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

// Componente do Dashboard
const DashboardPage = () => {
  const [refreshKey, setRefreshKey] = useState(0);
  const triggerRefresh = () => setRefreshKey(prevKey => prevKey + 1);
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(false);
  const [activeMenu, setActiveMenu] = useState<string>('dashboard');
  const [openMenu, setOpenMenu] = useState<string | null>('cadastros'); // Inicia com o menu 'cadastros' aberto
  const { user, logout, API_URL, loading: authLoading } = useContext(AuthContext) as AuthContextType;
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [itemTypes, setItemTypes] = useState<ItemType[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [filteredMovements, setFilteredMovements] = useState<Movement[] | null>(null);
  const [people, setPeople] = useState<Person[]>([]); // NOVO: Estado para pessoas
  const [users, setUsers] = useState<User[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [showUserModal, setShowUserModal] = useState(false);
  const [showMovementModal, setShowMovementModal] = useState<boolean>(false);
  const [showItemTypeModal, setShowItemTypeModal] = useState<boolean>(false);
  const [editingItemType, setEditingItemType] = useState<ItemType | null>(null);
  const [isUnitModalOpen, setIsUnitModalOpen] = useState<boolean>(false);
  const [editingUnit, setEditingUnit] = useState<Unit | null>(null);
  const [isParentUnitModalOpen, setIsParentUnitModalOpen] = useState(false);
  const [showAssetModal, setShowAssetModal] = useState<boolean>(false);
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null);
  const [showPeopleModal, setShowPeopleModal] = useState<boolean>(false); // NOVO: Estado para modal de pessoas
  const [editingPerson, setEditingPerson] = useState<Person | null>(null); // NOVO: Estado para pessoa em edição
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [showReturnByAssetModal, setShowReturnByAssetModal] = useState<boolean>(false);
  const [showReturnByUserModal, setShowReturnByUserModal] = useState<boolean>(false);
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [patrimonioFilter, setPatrimonioFilter] = useState('');
  const [responsibleUserIdFilter, setResponsibleUserIdFilter] = useState('');
  const [solicitanteIdFilter, setSolicitanteIdFilter] = useState('');
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [filters, setFilters] = useState({ solicitante: '', patrimonio: '', cpf: '', matricula: '', movementType: '', startDate: '', endDate: '' });
  const [isReportButtonEnabled, setIsReportButtonEnabled] = useState(false);
  const [lastAppliedFilters, setLastAppliedFilters] = useState({});
  const [selectedMovementForConfirmation, setSelectedMovementForConfirmation] = useState<Movement | null>(null);
  const [movementToRenew, setMovementToRenew] = useState<Movement | null>(null);
  const [movementToSubstitute, setMovementToSubstitute] = useState<Movement | null>(null);
  const [substitutionOldAssetId, setSubstitutionOldAssetId] = useState<number | null>(null);
  const [movementToReturn, setMovementToReturn] = useState<Movement | null>(null);
  const [detailedMovementToReturn, setDetailedMovementToReturn] = useState<Movement | null>(null);
  const [assetToRetire, setAssetToRetire] = useState<Asset | null>(null);
  const [assetToDispose, setAssetToDispose] = useState<Asset | null>(null);
  const [importResult, setImportResult] = useState<{ importedCount: number; errors: string[] } | null>(null);
  const [peopleFilter, setPeopleFilter] = useState('');
  const [unitFilter, setUnitFilter] = useState('');
  const [assetFilter, setAssetFilter] = useState('');
  const [assetStatusFilter, setAssetStatusFilter] = useState('');
  const [assetUnitFilter, setAssetUnitFilter] = useState('');
  const [expiringWarranties, setExpiringWarranties] = useState<{ count: number; description: string; endDate: string; daysRemaining: number }[]>([]);
  const [substitutionToFinalize, setSubstitutionToFinalize] = useState<any>(null);

  // Estado para controlar qual submenu do sidebar está aberto
  // Pode ser 'school' (Escolar) ou 'logistics' (Logística) ou null (fechado)
  const [expandedMenu, setExpandedMenu] = useState<string | null>('school');

  // Função auxiliar para alternar o menu
  const toggleMenu = (menuName: string) => {
    setExpandedMenu(expandedMenu === menuName ? null : menuName);
  };

  const fetchExpiringWarranties = useCallback(async () => {
    try {
      const response = await axios.get(`${API_URL}/reports/expiring-warranties`);
      setExpiringWarranties(response.data);
    } catch (error) {
      console.error('Erro ao buscar garantias a vencer:', error);
      // Não mostra toast de erro para não poluir a tela, apenas loga.
    }
  }, [API_URL]);

  const handleOpenReturnModal = async (movementId: number) => {
    if (!movementId) {
      addToast('ID da movimentação inválido.', 'error');
      return;
    }

    try {
      addToast('Buscando detalhes para devolução...', 'info');
      // Chama a nova rota que criamos no backend
      const response = await axios.get<Movement>(`${API_URL}/asset-movements/${movementId}/details`);

      // Armazena os dados completos no novo estado que criamos no passo 2.1
      setDetailedMovementToReturn(response.data);

    } catch (error) {
      console.error('Erro ao buscar detalhes da movimentação:', error);
      addToast('Não foi possível carregar os detalhes para devolução.', 'error');
    }
  };

  const handleOpenSubstitutionModal = (movement: Movement) => {
    setMovementToSubstitute(movement);
    setSubstitutionOldAssetId(null); // Limpa a seleção anterior ao abrir
  };

  const handleSubstitutionSelection = (id: number | null) => {
    console.log(`%c[App.tsx] Tentando definir o ID de seleção para: ${id}`, 'color: green; font-weight: bold;');
    setSubstitutionOldAssetId(id);
  }

  const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFilters(prev => ({ ...prev, [name]: value }));
  };
  const handleDisposeAsset = async (assetId: number, disposalNote: string) => {
    try {
      await axios.put(`${API_URL}/assets/${assetId}/dispose`, { disposal_note: disposalNote });
      addToast('Ativo descartado com sucesso!', 'success');
      fetchAssets();
      fetchDashboardData();
    } catch (error: any) {
      addToast(error.response?.data?.message || 'Erro ao descartar ativo.', 'error');
      console.error('Erro ao descartar ativo:', error);
    }
  };
  const handleRetireAsset = async (assetId: number, reason: string) => {
    try {
      await axios.put(`${API_URL}/assets/${assetId}/retire`, { reason });
      addToast('Ativo baixado com sucesso!', 'success');
      fetchAssets(); // Atualiza a lista de ativos
      fetchDashboardData(); // Atualiza os contadores do dashboard
    } catch (error: any) {
      addToast(error.response?.data?.message || 'Erro ao dar baixa no ativo.', 'error');
      console.error('Erro ao dar baixa no ativo:', error);
    }
  };

  // =====================================================================
  // FUNÇÃO DE DEVOLUÇÃO (ATUALIZADA PARA PARCIAL)
  // =====================================================================
  const handleConfirmReturn = async (
    notes: string,
    returnedPeripherals: Peripheral[],
    file?: File,
    condition?: string,
    selectedAssetIds?: number[] // <<< NOVO ARGUMENTO: Lista de IDs selecionados
  ) => {

    // 1. Validação de Segurança
    if (!detailedMovementToReturn) return;

    // Se tentar confirmar sem arquivo, bloqueia.
    if (!file) {
      addToast('Erro: Para confirmar a devolução e dar baixa no estoque, é OBRIGATÓRIO anexar o termo assinado.', 'error');
      return;
    }

    // 2. Prepara os dados
    const formData = new FormData();
    formData.append('movement_type', 'return');
    // Envia o recipient_person_id para manter o histórico de quem devolveu
    if (detailedMovementToReturn.recipient_person_id) {
      formData.append('recipient_person_id', String(detailedMovementToReturn.recipient_person_id));
    }

    formData.append('notes', `Devolução referente à movimentação #${detailedMovementToReturn.id}. ${notes}`);

    // >>> LÓGICA DE SELEÇÃO ATUALIZADA <<<
    // Se vieram IDs selecionados do modal, usa eles. Se não, usa todos (fallback).
    const assetIds = (selectedAssetIds && selectedAssetIds.length > 0)
      ? selectedAssetIds
      : (detailedMovementToReturn.assets?.map((a: Asset) => a.id) || []);

    if (assetIds.length === 0) {
      addToast('Nenhum ativo selecionado para devolução.', 'warning');
      return;
    }

    formData.append('asset_ids', JSON.stringify(assetIds));

    if (returnedPeripherals) formData.append('returned_peripherals', JSON.stringify(returnedPeripherals));
    if (condition) formData.append('return_condition', condition);

    // O Arquivo é garantido pelo if lá em cima
    formData.append('receiptFile', file);

    try {
      // 3. Envia para o Backend
      await axios.post(`${API_URL}/asset-movements`, formData);

      addToast('Devolução confirmada e arquivada com sucesso!', 'success');

      // 4. Limpa e atualiza
      setDetailedMovementToReturn(null);
      triggerRefresh();
      fetchMovements();
      fetchAssets();
      fetchDashboardData();

    } catch (error: any) {
      console.error("Erro no registro da devolução:", error);
      const msg = error.response?.data?.message || 'Erro desconhecido.';
      addToast(`Falha: ${msg}`, 'error');
    }
  };

  const { addToast } = useToast();
  // 1. Definição dos Perfis
  const ROLES = {
    ADMIN: 'admin',
    MANAGER: 'manager',
    ADVISOR: 'advisor',
    BASIC: 'basic',       // Técnico de Almoxarifado (Só Logística)
    OPERATOR: 'operator'  // Técnico de Campo (Logística + Escolar) - NOVO
  };

  // 2. Matriz de Permissões
  const PERMISSIONS = {
    MENU_DASHBOARD: [ROLES.ADMIN, ROLES.MANAGER, ROLES.ADVISOR, ROLES.BASIC, ROLES.OPERATOR],
    MENU_CADASTROS: [ROLES.ADMIN, ROLES.MANAGER],

    // Logística Geral: Basic e Operator acessam
    MENU_LOGISTICA: [ROLES.ADMIN, ROLES.MANAGER, ROLES.ADVISOR, ROLES.BASIC, ROLES.OPERATOR],

    // Patrimônio: Gestão apenas
    MENU_PATRIMONIO: [ROLES.ADMIN, ROLES.MANAGER, ROLES.ADVISOR],

    // --- A MUDANÇA ESTÁ AQUI ---
    // Menu Escolar: REMOVEMOS O BASIC e adicionamos o OPERATOR
    MENU_ESCOLAR: [ROLES.ADMIN, ROLES.MANAGER, ROLES.ADVISOR, ROLES.OPERATOR],

    MENU_RELATORIOS: [ROLES.ADMIN, ROLES.MANAGER, ROLES.ADVISOR],
    MENU_CONSULTAS: [ROLES.ADMIN, ROLES.MANAGER, ROLES.ADVISOR, ROLES.BASIC, ROLES.OPERATOR],

    MENU_AUDITORIA: [ROLES.ADMIN],
    MENU_CONFIGURACOES: [ROLES.ADMIN, ROLES.MANAGER],

    // Ações
    // Ambos (Basic e Operator) podem registrar movimentações gerais
    ACTION_REGISTER_MOVEMENT: [ROLES.ADMIN, ROLES.MANAGER, ROLES.BASIC, ROLES.OPERATOR],

    ACTION_CREATE_EDIT: [ROLES.ADMIN, ROLES.MANAGER, ROLES.ADVISOR],
    ACTION_REQUEST_RETIREMENT: [ROLES.ADMIN, ROLES.MANAGER],
    ACTION_FINAL_APPROVAL: [ROLES.ADMIN],
    ACTION_APPROVE_REJECT: [ROLES.ADMIN],
    ACTION_DELETE: [ROLES.ADMIN],

    // Compatibilidade
    SUBMENU_TIPOS_ITENS: [ROLES.ADMIN, ROLES.MANAGER],
    SUBMENU_UNIDADES: [ROLES.ADMIN, ROLES.MANAGER],
    SUBMENU_PESSOAS: [ROLES.ADMIN, ROLES.MANAGER],
    SUBMENU_ATIVOS: [ROLES.ADMIN, ROLES.MANAGER],
  };

  // Função `can` atualizada para usar as novas chaves
  const can = (permission: keyof typeof PERMISSIONS): boolean => {
    const userRole = user?.role;
    if (!userRole) return false;
    const allowedRoles = PERMISSIONS[permission];
    if (!allowedRoles) return false;
    return allowedRoles.includes(userRole);
  };

  const translateStatus = (status: string): string => {
    const statusMap: { [key: string]: string } = {
      available: 'Disponível',
      in_use: 'Em Uso',
      loaned: 'Emprestado',
      maintenance: 'Em Manutenção',
      pending_retirement: 'Pendente de Baixa',
      retired: 'Baixado',
      disposed: 'Descartado'
    };
    // Retorna o status traduzido, ou o original caso não encontre uma tradução
    return statusMap[status] || status;
  };

  const translateMovementType = (type: string): string => {
    const typeMap: { [key: string]: string } = {
      entry: 'Entrada',
      exit: 'Saída',
      loan: 'Empréstimo',
      return: 'Devolução',
      maintenance: 'Manutenção'
    };
    return typeMap[type] || type;
  };

  const COLORS = ['#007bff', '#ffc107', '#6c757d', '#28a745', '#dc3545', '#17a2b8'];

  const fetchDashboardData = useCallback(async () => {
    try {
      const response = await axios.get<DashboardData>(`${API_URL}/dashboard/summary`);
      setDashboardData(response.data);
    } catch (error) {
      console.error('Erro ao buscar dados do dashboard:', error);
      addToast('Erro ao carregar dados. Verifique a conexão.', 'error');

      // ESTADO SEGURO: Zera tudo para a tela não quebrar nem mostrar mentiras
      setDashboardData({
        totalAssets: 0,
        availableAssets: 0,
        inUseAssets: 0,
        loanedAssets: 0,
        maintenanceAssets: 0,
        retiredAssets: 0,
        disposedAssets: 0,
        pendingDeliveriesCount: 0, // Campos novos zerados
        pendingSubstitutionsCount: 0, // Campos novos zerados
        assetsByCategory: [],
        recentMovements: [],
        pendingAlerts: [],
        expiringWarranties: []
      });
    }
  }, [API_URL, addToast]);

  const fetchItemTypes = useCallback(async () => {
    console.log('Fetching item types...');
    try {
      const response = await axios.get<ItemType[]>(`${API_URL}/item-types`);
      setItemTypes(response.data);
    } catch (error) {
      console.error('Erro ao buscar tipos de itens:', error);
      addToast('Erro ao carregar tipos de itens.', 'error');
      setItemTypes([]);
    }
  }, [API_URL, addToast]);

  const fetchUnits = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get<Unit[]>(`${API_URL}/units`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUnits(response.data);
    } catch (error) {
      console.error('Erro ao buscar unidades:', error);
      addToast('Erro ao carregar unidades.', 'error');
      setUnits([]);
    }
  }, [API_URL, addToast, setUnits]);

  const fetchAssets = useCallback(async (searchQuery: string = '', statusQuery: string = '') => {
    console.log('Fetching assets com filtros do banco...', { searchQuery, statusQuery });
    try {
      const response = await axios.get<Asset[]>(`${API_URL}/assets`, {
        params: {
          search: searchQuery || undefined,
          status: statusQuery || undefined
        }
      });
      setAssets(response.data);
    } catch (error) {
      console.error('Erro ao buscar ativos:', error);
      addToast('Erro ao carregar ativos.', 'error');
      setAssets([]);
    }
  }, [API_URL, addToast]);

  const fetchMovements = useCallback(async (currentFilters = {}) => {
    console.log('Buscando movimentações com os filtros:', currentFilters);
    try {
      // Constrói a query string apenas com os filtros que têm valor
      const params = new URLSearchParams();
      for (const [key, value] of Object.entries(currentFilters)) {
        if (value) { // Adiciona o filtro apenas se não for vazio
          params.append(key, value as string);
        }
      }

      const queryString = params.toString();
      const url = `${API_URL}/asset-movements${queryString ? `?${queryString}` : ''}`;

      const response = await axios.get<Movement[]>(url);
      // IMPORTANTE: Decide se atualiza a lista principal ou a lista filtrada
      if (Object.keys(currentFilters).length > 0 && queryString) {
        setFilteredMovements(response.data);
      } else {
        setMovements(response.data);
        setFilteredMovements(null);
      }
    } catch (error) {
      console.error('Erro ao buscar movimentações:', error);
      addToast('Erro ao carregar movimentações.', 'error');
    }
  }, [API_URL, addToast]); // Removido 'filters' da dependência para evitar re-renders

  // NOVO: Função para buscar pessoas
  const fetchPeople = useCallback(async () => {
    console.log('Fetching people...');
    try {
      const response = await axios.get<Person[]>(`${API_URL}/people`);
      setPeople(response.data);
    } catch (error) {
      console.error('Erro ao buscar pessoas:', error);
      addToast('Erro ao carregar pessoas.', 'error');
      setPeople([]);
    }
  }, [API_URL, addToast]);

  // >>> NOVA FUNÇÃO DE BUSCA - USER<<<
  const fetchUsers = useCallback(async () => {
    if (user?.role !== 'admin') return; // Apenas admin pode buscar usuários
    console.log('Fetching users...');
    try {
      const response = await axios.get<User[]>(`${API_URL}/users`);
      setUsers(response.data);
    } catch (error) {
      console.error('Erro ao buscar usuários:', error);
      addToast('Erro ao carregar a lista de usuários.', 'error');
      setUsers([]);
    }
  }, [API_URL, addToast, user?.role]);

  // >>> NOVA FUNÇÃO DE BUSCA - AUDITORIA <<<
  const fetchAuditLogs = useCallback(async () => {
    if (user?.role !== 'admin') return;
    try {
      const response = await axios.get<AuditLog[]>(`${API_URL}/audit-logs`);
      setAuditLogs(response.data);
    } catch (error) {
      console.error('Erro ao buscar logs de auditoria:', error);
      addToast('Erro ao carregar logs de auditoria.', 'error');
    }
  }, [API_URL, user?.role, addToast]);

  useEffect(() => {
    if (user && !authLoading) {
      console.log('User authenticated, fetching dashboard data...');
      fetchDashboardData();
      fetchItemTypes();
      fetchUnits();
      fetchAssets();
      fetchMovements();
      fetchPeople(); // NOVO: Carrega pessoas ao iniciar
      fetchUsers();
      fetchAuditLogs();
      fetchExpiringWarranties();
    }
  }, [user, authLoading, fetchAssets, fetchItemTypes, fetchUnits, fetchDashboardData, fetchMovements, fetchPeople, fetchUsers, fetchAuditLogs, refreshKey]);

  const Card = ({ title, value, icon: Icon, colorClass }: { title: string; value: number; icon: React.ElementType; colorClass: string }) => (
    <div className={`bg-white p-6 rounded-xl shadow-md flex items-center justify-between transition-all duration-300 ease-in-out transform hover:scale-105 ${colorClass}`}>
      <div className="flex flex-col">
        <span className="text-sm font-medium text-gray-500">{title}</span>
        <span className="text-3xl font-bold text-gray-800 mt-1">{value}</span>
      </div>
      {Icon && <Icon className="w-12 h-12 opacity-20" />}
    </div>
  );

  const menuItems = [
    { name: 'Dashboard', icon: LayoutDashboard, id: 'dashboard', roles: PERMISSIONS.MENU_DASHBOARD },

    {
      name: 'Cadastros', icon: Archive, id: 'cadastros', roles: PERMISSIONS.MENU_CADASTROS,
      subMenus: [
        { name: 'Tipos de Itens', icon: List, id: 'item-types', roles: PERMISSIONS.SUBMENU_TIPOS_ITENS },
        { name: 'Unidades', icon: List, id: 'units', roles: PERMISSIONS.SUBMENU_UNIDADES },
        { name: 'Pessoas', icon: Users, id: 'people', roles: PERMISSIONS.SUBMENU_PESSOAS },
        { name: 'Ativos', icon: HardDrive, id: 'assets', roles: PERMISSIONS.SUBMENU_ATIVOS },
      ]
    },

    // --- GRUPO 1: LOGÍSTICA & OPERAÇÕES (Técnicos Acessam) ---
    {
      name: 'Logística & Operações',
      icon: Truck,
      id: 'logistics_assets',
      roles: PERMISSIONS.MENU_LOGISTICA,
      subMenus: [
        { name: 'Registrar Movimentação', icon: PlusCircle, id: 'action-register-movement', roles: PERMISSIONS.ACTION_REGISTER_MOVEMENT },
        { name: 'Gerenciar Movimentações', icon: ArrowRightLeft, id: 'manage-external', roles: PERMISSIONS.MENU_LOGISTICA },
        // >>> MUDANÇA AQUI: A Logística Reversa agora mora aqui <<<
        { name: 'Logística Reversa (Coleta)', icon: ArchiveRestore, id: 'batch-collection', roles: PERMISSIONS.ACTION_REGISTER_MOVEMENT },
      ]
    },

    // --- GRUPO 2: GESTÃO DE PATRIMÔNIO (Técnicos NÃO Acessam) ---
    {
      name: 'Gestão de Patrimônio',
      icon: ArrowDownCircle,
      id: 'patrimony_management',
      roles: PERMISSIONS.MENU_PATRIMONIO,
      subMenus: [
        { name: 'Baixas e Descartes', icon: Trash2, id: 'retire-dispose', roles: PERMISSIONS.MENU_PATRIMONIO },
      ]
    },

    // --- GRUPO 3: GESTÃO ESCOLAR (TABLETS) ---
    {
      name: 'Gestão Escolar (Tablets)',
      icon: GraduationCap,
      id: 'school_management',
      roles: PERMISSIONS.MENU_ESCOLAR,
      subMenus: [
        { name: 'Entrega de Tablets', icon: HardDrive, id: 'tablet-delivery', roles: PERMISSIONS.ACTION_REGISTER_MOVEMENT },
        // { name: 'Devolução em Lote', ... } <-- REMOVIDO DAQUI
        { name: 'Monitoramento', icon: BarChart2, id: 'tablet-dashboard', roles: PERMISSIONS.MENU_ESCOLAR },
        { name: 'Painel Executivo - Projeção', icon: TrendingUp, id: 'executive-dashboard', roles: PERMISSIONS.MENU_ESCOLAR },
        { name: 'Auditoria / Busca', icon: Search, id: 'tablet-audit', roles: PERMISSIONS.MENU_CONSULTAS },
      ]
    },

    { name: 'Consultas', icon: Search, id: 'queries', roles: PERMISSIONS.MENU_CONSULTAS },
    { name: 'Estoque do CD', icon: Package, id: 'cd-inventory', roles: PERMISSIONS.MENU_CONSULTAS },
    { name: 'Relatórios', icon: BarChart2, id: 'reports', roles: PERMISSIONS.MENU_RELATORIOS },
    { name: 'Auditoria de Sistema', icon: History, id: 'audit', roles: PERMISSIONS.MENU_AUDITORIA },
    { name: 'Configurações', icon: Settings, id: 'settings', roles: PERMISSIONS.MENU_CONFIGURACOES },
  ];

  const canAccess = (roles: string[]): boolean => {
    // Se a lista de 'roles' não for definida ou estiver vazia, permite o acesso.
    if (!roles || roles.length === 0) {
      return true;
    }
    // Caso contrário, verifica se o cargo do usuário está na lista.
    return roles.includes(user?.role || '');
  };

  // Funções de manipulação para Tipos de Itens
  const handleEditItemType = (itemType: ItemType) => {
    setEditingItemType(itemType);
    setShowItemTypeModal(true);
  };

  //nova função para abrir o modal em modo de edição
  const handleEditUser = (user: User) => {
    setEditingUser(user);
    setShowUserModal(true);
  };

  const handleDeleteItemType = async (id: number) => {
    if (window.confirm('Tem certeza que deseja excluir este tipo de item?')) {
      try {
        await axios.delete(`${API_URL}/item-types/${id}`);
        addToast('Tipo de item excluído com sucesso!', 'success');
        triggerRefresh();
        fetchItemTypes(); // Recarrega a lista
      } catch (error: unknown) {
        const axiosError = error as AxiosError<BackendErrorResponse>;
        const errorMessage = (axiosError.response?.data?.message && typeof axiosError.response.data.message === 'string')
          ? axiosError.response.data.message
          : 'Erro ao excluir tipo de item.';
        addToast(`Erro: ${errorMessage}`, 'error');
        console.error('Erro ao excluir tipo de item:', axiosError);
      }
    }
  };


  // Funções de manipulação para Unidades

  const handleEditUnit = (unit: Unit | null) => {
    // A função agora apenas precisa definir qual unidade está sendo editada
    // e abrir o modal. O UnitForm cuidará do resto.
    setEditingUnit(unit);
    setIsUnitModalOpen(true);
  };
  const handleDeleteUnit = async (id: number) => {
    if (window.confirm("Tem certeza que deseja deletar esta unidade? A ação não pode ser desfeita.")) {
      try {
        const token = localStorage.getItem('token');
        // CORREÇÃO AQUI: Usando a variável API_URL em vez do texto fixo
        await axios.delete(`${API_URL}/units/${id}`, {
          headers: { Authorization: `Bearer ${token}` }
        });

        setUnits(units.filter(u => u.id !== id));
        addToast("Unidade deletada com sucesso!", "success");
        triggerRefresh();

      } catch (error: any) {
        addToast(error.response?.data?.message || "Ocorreu um erro ao deletar a unidade.", "error");
      }
    }
  };

  // Funções de manipulação para Ativos
  const handleEditAsset = (asset: Asset) => {
    setEditingAsset(asset);
    setShowAssetModal(true);
  };

  const handleDeleteAsset = async (id: number) => {
    if (window.confirm('Tem certeza que deseja excluir este ativo?')) {
      try {
        await axios.delete(`${API_URL}/assets/${id}`);
        addToast('Ativo excluído com sucesso!', 'success');
        triggerRefresh();
        fetchAssets(); // Recarrega a lista
        fetchDashboardData(); // Atualiza o dashboard
      } catch (error: unknown) {
        const axiosError = error as AxiosError<BackendErrorResponse>;
        const errorMessage = (axiosError.response?.data?.message && typeof axiosError.response.data.message === 'string')
          ? axiosError.response.data.message
          : 'Erro ao excluir ativo.';
        addToast(`Erro: ${errorMessage}`, 'error');
        console.error('Erro ao excluir ativo:', axiosError);
      }
    }
  };


  // Funções de manipulação para Pessoas
  const handleEditPerson = (person: Person) => {
    setEditingPerson(person);
    setShowPeopleModal(true);
  };

  const handleDeletePerson = async (id: number) => {
    if (window.confirm('Tem certeza que deseja excluir esta pessoa?')) {
      try {
        await axios.delete(`${API_URL}/people/${id}`);
        addToast('Pessoa excluída com sucesso!', 'success');
        triggerRefresh();
        fetchPeople(); // Recarrega a lista de pessoas
        fetchMovements(); // Recarrega movimentações, pois a pessoa pode estar associada
      } catch (error: unknown) {
        const axiosError = error as AxiosError<BackendErrorResponse>;
        const errorMessage = (axiosError.response?.data?.message && typeof axiosError.response.data.message === 'string')
          ? axiosError.response.data.message
          : 'Erro ao excluir pessoa.';
        addToast(`Erro: ${errorMessage}`, 'error');
        console.error('Erro ao excluir pessoa:', axiosError);
      }
    }
  };

  const handleDeleteUser = async (userId: number) => {
    // Pede uma confirmação antes de uma ação destrutiva
    if (window.confirm('Tem certeza que deseja remover este usuário? Esta ação não pode ser desfeita.')) {
      try {
        await axios.delete(`${API_URL}/users/${userId}`);
        addToast('Usuário removido com sucesso!', 'success');
        fetchUsers(); // Atualiza a lista de usuários na tela
      } catch (error: unknown) {
        const axiosError = error as AxiosError<BackendErrorResponse>;
        const errorMessage = axiosError.response?.data?.message || 'Erro ao remover usuário.';
        addToast(errorMessage, 'error');
        console.error('Erro ao remover usuário:', error);
      }
    }
  };

  const handleGenerateFilteredReport = async () => {
    // O botão já está desabilitado se não houver filtros, mas adicionamos uma segurança extra.
    if (!isReportButtonEnabled || Object.keys(lastAppliedFilters).length === 0) {
      addToast('Por favor, realize uma consulta primeiro.', 'warning');
      return;
    }

    addToast('Gerando seu relatório PDF...', 'info');
    try {
      // Usamos o método POST para enviar o objeto complexo de filtros no corpo da requisição
      const response = await axios.post(
        `${API_URL}/reports/movements/pdf`,
        lastAppliedFilters, // Envia o último conjunto de filtros aplicados
        { responseType: 'blob' }
      );

      // O restante do código é o mesmo para download de arquivos
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'relatorio_movimentacoes_filtrado.pdf');
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Erro ao gerar relatório filtrado:", error);
      addToast('Erro ao gerar relatório.', 'error');
    }
  };

  // Função para gerar Recibo PDF para Movimentação
  const handleGenerateMovementReceipt = async (movementId: number) => {
    try {
      addToast('Gerando recibo PDF...', 'info');
      const response = await axios.get(`${API_URL}/asset-movements/${movementId}/receipt-pdf`, {
        responseType: 'blob',
      });

      const contentDisposition = response.headers['content-disposition'];
      let fileName = `recibo_movimentacao_${movementId}.pdf`; // Nome padrão
      if (contentDisposition) {
        const fileNameMatch = contentDisposition.match(/filename="?([^"]+)"?/);
        if (fileNameMatch && fileNameMatch.length > 1) {
          fileName = fileNameMatch[1];
        }
      }

      const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', fileName); // <<< USA O NOME DE ARQUIVO CORRETO
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
      window.URL.revokeObjectURL(url);
      addToast('Recibo PDF gerado com sucesso!', 'success');
    } catch (error: unknown) {
      const axiosError = error as AxiosError<BackendErrorResponse>;
      const errorMessage = (axiosError.response?.data?.message && typeof axiosError.response.data.message === 'string')
        ? axiosError.response.data.message
        : 'Erro ao gerar recibo PDF.';
      console.error(`Erro ao gerar recibo PDF para movimentação ${movementId}:`, axiosError.response?.data || axiosError);
      addToast(`Erro: ${errorMessage}`, 'error');
    }
  };

  const handleSaveRenewal = async (movementId: number, newDate: string, note: string) => {
    try {
      await axios.put(`${API_URL}/asset-movements/${movementId}/renew`, {
        new_expected_return_date: newDate,
        renewal_note: note,
      });
      addToast('Empréstimo renovado com sucesso!', 'success');

      // >>> CORREÇÃO: BAIXA O RECIBO ATUALIZADO COM A NOVA DATA <<<
      handleGenerateMovementReceipt(movementId);
      triggerRefresh();
      fetchMovements(); // Atualiza a lista de movimentações
      fetchDashboardData(); // Atualiza os alertas do dashboard
    } catch (error: any) {
      addToast(error.response?.data?.message || 'Erro ao renovar empréstimo.', 'error');
      console.error('Erro ao renovar empréstimo:', error);
    }
  };

  console.log('%c[App.tsx] Renderizando. O valor ATUAL de substitutionOldAssetId é:', 'color: blue;', substitutionOldAssetId);

  // --- CÓDIGO NOVO: PREPARAÇÃO DA LISTA DE UNIDADES ---

  // Transforma a sua lista de 400 unidades no formato que o Select entende
  const unitFilterOptions = units
    .sort((a, b) => a.name.localeCompare(b.name)) // Deixa em ordem alfabética
    .map(u => ({
      value: u.name, // Vamos usar o NOME para filtrar (igual você fazia antes)
      label: u.name  // O que vai aparecer escrito na lista
    }));

  // --- FUNÇÕES DE NAVEGAÇÃO DOS CARDS DE ALERTA ---
  const goToPendingDeliveries = () => {
    // Leva para o módulo de Logística (onde a aba padrão é Entregas)
    setActiveMenu('manage-external');
  };

  const goToPendingSubstitutions = () => {
    // Leva para o módulo de Logística e avisa para trocar de aba
    setActiveMenu('manage-external');
    addToast('Por favor, clique na aba "Substituições Pendentes".', 'info');
  };

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar - Mobile */}
      <div
        className={`fixed inset-0 bg-gray-900 bg-opacity-75 z-40 lg:hidden ${sidebarOpen ? 'block' : 'hidden'}`}
        onClick={() => setSidebarOpen(false)}
      ></div>

      <div className={`fixed top-0 left-0 h-full bg-blue-900 text-white w-64 p-5 z-50 transform lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} transition-transform duration-300 ease-in-out flex flex-col`}>
        <div className="flex items-center justify-between mb-8">
          <a
            href="#dashboard"
            className="cursor-pointer" // Adiciona o cursor de "mãozinha" para indicar que é clicável
            onClick={(e) => {
              e.preventDefault(); // Evita que a página mude a URL de forma padrão
              setActiveMenu('dashboard'); // Define o menu ativo para o dashboard
              setSidebarOpen(false); // Fecha a sidebar (importante para o mobile)
            }}
          >
            <img
              src={logoSGA}
              alt="Logo SGA - Voltar ao Dashboard"
              className="h-38 w-auto" // Ajuste a altura (h-12) conforme necessário
            //onError={(e: React.SyntheticEvent<HTMLImageElement, Event>) => { e.currentTarget.onerror = null; e.currentTarget.src = 'https://placehold.co/180x60/0056b3/ffffff?text=Logo'; }}
            />
          </a>
        </div>

        <nav className="space-y-2 flex-1 overflow-y-auto pb-4 scrollbar-thin scrollbar-track-blue-900 scrollbar-thumb-blue-700 hover:scrollbar-thumb-blue-500 scrollbar-thumb-rounded-full">
          {menuItems.map((item) => (
            (canAccess(item.roles || [])) ? (
              // Se o item tiver submenus, cria um grupo expansível
              item.subMenus ? (
                <div key={item.id}>
                  <button
                    onClick={() => setOpenMenu(openMenu === item.id ? null : item.id)}
                    className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-blue-800 transition-colors duration-200"
                  >
                    <div className="flex items-center">
                      <item.icon className="w-5 h-5 mr-3" />
                      <span className="font-medium">{item.name}</span>
                    </div>
                    <ChevronDown
                      className={`w-5 h-5 transition-transform duration-300 ${openMenu === item.id ? 'rotate-180' : ''}`}
                    />
                  </button>
                  {/* Mostra os submenus se o menu principal estiver aberto */}
                  {openMenu === item.id && (
                    <div className="pl-6 mt-1 space-y-1">
                      {item.subMenus.map((subMenu) => (
                        (canAccess(subMenu.roles || [])) && (
                          <a
                            key={subMenu.id}
                            href={`#${subMenu.id}`}
                            onClick={(e) => {
                              e.preventDefault(); // Previne a mudança na URL
                              if (subMenu.id === 'action-register-movement') {
                                // Se for a ação de registrar, apenas abre o modal
                                setShowMovementModal(true);
                              } else {
                                // Para todos os outros, define o menu ativo para trocar de página
                                setActiveMenu(subMenu.id);
                              }
                              setSidebarOpen(false);
                            }}
                            className={`flex items-center p-2 rounded-lg transition-colors duration-200 text-sm ${activeMenu === subMenu.id ? 'bg-blue-700 text-yellow-300' : 'hover:bg-blue-800'
                              }`}
                          >
                            <subMenu.icon className="w-4 h-4 mr-3" />
                            <span>{subMenu.name}</span>
                          </a>
                        )
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                // Se não tiver submenus, cria um item de menu normal
                <a
                  key={item.id}
                  href={`#${item.id}`}
                  onClick={() => { setActiveMenu(item.id); setSidebarOpen(false); }}
                  className={`flex items-center p-3 rounded-lg transition-colors duration-200 ${activeMenu === item.id ? 'bg-blue-700 text-yellow-300 shadow-md' : 'hover:bg-blue-800'
                    }`}
                >
                  <item.icon className="w-5 h-5 mr-3" />
                  <span className="font-medium">{item.name}</span>
                </a>
              )
            ) : null
          ))}
          <a
            href="#logout"
            onClick={logout}
            className="flex items-center p-3 rounded-lg transition-colors duration-200 hover:bg-red-700 text-red-300"
          >
            <LogOut className="w-5 h-5 mr-3" />
            <span className="font-medium">Sair</span>
          </a>
        </nav>

        {/* >>> ASSINATURA NO RODAPÉ DO MENU LATERAL <<< */}
        <div className="mt-auto pt-4 border-t border-blue-800 pb-2">
          <p className="text-[10px] text-blue-300 text-center leading-tight">
            Desenvolvido pela <br />
            <span className="font-semibold text-blue-100">GIT - Gerência de Infraestrutura</span>
          </p>
          <p className="text-[10px] text-blue-400 text-center mt-1 flex items-center justify-center">
            <Code className="w-3 h-3 mr-1" /> Gestão: Alberto Dantas
          </p>
          <p className="text-[9px] text-blue-500 text-center mt-2">Versão 1.0.0 • 2026</p>
        </div>

      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col lg:ml-64 transition-all duration-300 ease-in-out">
        {/* Header */}
        <header className="bg-white shadow-sm p-4 flex items-center justify-between lg:justify-end">
          <button onClick={() => setSidebarOpen(true)} className="lg:hidden text-blue-800 focus:outline-none">
            <Menu className="w-6 h-6" />
          </button>
          <div className="relative">
            {/* Botão que abre o dropdown */}
            <button onClick={() => setSidebarOpen(p => !p)} className="flex items-center space-x-2 cursor-pointer">
              <div className="text-right hidden sm:block">
                <span className="block text-sm font-medium text-gray-700">{user?.full_name || user?.username}</span>
                <span className="block text-xs text-gray-500">{user?.role}</span>
              </div>
              <div className="w-10 h-10 bg-blue-200 rounded-full flex items-center justify-center text-blue-800 font-bold">
                {user?.username?.charAt(0).toUpperCase() || 'U'}
              </div>
            </button>

            {/* O menu dropdown que aparece ao clicar */}
            {sidebarOpen && (
              <div
                className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 z-50 border"
                // Adicionado para fechar o menu se clicar fora (opcional, mas bom UX)
                onMouseLeave={() => setSidebarOpen(false)}
              >
                <button
                  onClick={() => {
                    setShowProfileModal(true);
                    setSidebarOpen(false); // Fecha o dropdown
                  }}
                  className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center"
                >
                  <UserCircle className="w-4 h-4 mr-2" /> Meu Perfil
                </button>
                <button
                  onClick={logout}
                  className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center"
                >
                  <LogOut className="w-4 h-4 mr-2" /> Sair
                </button>
              </div>
            )}
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-6 bg-gray-50 overflow-y-auto">

          {activeMenu === 'pending-terms' && (
            <PendingTermsList
              API_URL={API_URL}
              onBack={() => setActiveMenu('tablet-dashboard')}
            />
          )}

          {activeMenu === 'dashboard' && dashboardData && (
            <DashboardView
              data={dashboardData}
              expiringWarranties={expiringWarranties}
              user={user}
              onRefresh={() => {
                fetchDashboardData();
                fetchExpiringWarranties();
              }}
              onNavigateToDeliveries={goToPendingDeliveries}
              onNavigateToSubstitutions={goToPendingSubstitutions}
            />
          )}

          {activeMenu === 'item-types' && (
            <div className="space-y-8">
              <h1 className="text-3xl font-extrabold text-blue-900 mb-6">Gestão de Tipos de Itens</h1>
              {canAccess(['admin', 'manager']) && (
                <div className="flex flex-col sm:flex-row gap-4 mb-6">
                  <button
                    onClick={() => { setEditingItemType(null); setShowItemTypeModal(true); }}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg shadow-md hover:bg-blue-700 flex items-center justify-center transition-colors duration-200"
                  >
                    <PlusCircle className="w-5 h-5 mr-2" /> Adicionar Tipo de Item
                  </button>
                  <input
                    type="file"
                    id="itemTypeFileInput"
                    className="hidden"
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleImport(e.target.files ? e.target.files[0] : null, 'item-types')}
                  />
                  <label htmlFor="itemTypeFileInput" className="bg-green-600 text-white px-4 py-2 rounded-lg shadow-md hover:bg-green-700 flex items-center justify-center cursor-pointer transition-colors duration-200">
                    <UploadCloud className="w-5 h-5 mr-2" /> Importar Tipos (XLSX/CSV)
                  </label>
                </div>
              )}
              <div className="bg-white p-6 rounded-xl shadow-md">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">Lista de Tipos de Itens</h3>
                {itemTypes.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Código</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nome</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Descrição</th>
                          {canAccess(['admin', 'manager']) && <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ações</th>}
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {itemTypes.map((type: ItemType) => (
                          <tr key={type.id}>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{type.code}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{type.name}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{type.description || 'N/A'}</td>
                            {canAccess(['admin', 'manager']) && (
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                <button
                                  onClick={() => handleEditItemType(type)}
                                  className="text-blue-600 hover:text-blue-900 mr-3"
                                >
                                  <Edit className="inline-block w-4 h-4" /> Editar
                                </button>
                                {canAccess(['admin']) && (
                                  <button
                                    onClick={() => handleDeleteItemType(type.id)}
                                    className="text-red-600 hover:text-red-900"
                                  >
                                    <Trash2 className="inline-block w-4 h-4" /> Excluir
                                  </button>
                                )}
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-gray-500 text-center py-4">Nenhum tipo de item cadastrado.</p>
                )}
              </div>
            </div>
          )}

          {activeMenu === 'units' && (
            <div className="space-y-8">
              {/* Título atualizado */}
              <h1 className="text-3xl font-extrabold text-blue-900 mb-6">Gestão de Unidades</h1>
              {canAccess(['admin', 'manager']) && (
                <div className="flex flex-col sm:flex-row gap-4 mb-6">
                  <button
                    /* Ação e texto do botão atualizados */
                    onClick={() => handleEditUnit(null)}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg shadow-md hover:bg-blue-700 flex items-center justify-center"
                  >
                    <PlusCircle className="w-5 h-5 mr-2" /> Adicionar Unidade
                  </button>
                  <input
                    type="file"
                    /* ID do input atualizado */
                    id="unitFileInput"
                    className="hidden"
                    onChange={(e) => {
                      handleImport(e.target.files ? e.target.files[0] : null, 'units');
                      e.target.value = '';
                    }}
                  />
                  <label
                    /* 'for' e texto da label atualizados */
                    htmlFor="unitFileInput"
                    className="bg-green-600 text-white px-4 py-2 rounded-lg shadow-md hover:bg-green-700 flex items-center justify-center cursor-pointer">
                    <UploadCloud className="w-5 h-5 mr-2" /> Importar Unidades
                  </label>
                </div>
              )}

              {/* <<< CAMPO DE BUSCA INTELIGENTE ADICIONADO AQUI >>> */}
              <div className="bg-white p-4 rounded-xl shadow-md">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Filtrar por Nome, Código ou Tipo..." /* Placeholder atualizado */
                    value={unitFilter} /* CORRIGIDO: Deve ser a variável, não a função */
                    onChange={(e) => setUnitFilter(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border rounded-lg"
                  />
                </div>
              </div>

              <div className="bg-white p-6 rounded-xl shadow-md">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">Unidades/Setores Cadastrados</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left text-gray-500">
                    <thead className="text-xs text-gray-700 uppercase bg-gray-50">
                      <tr>
                        <th scope="col" className="px-6 py-3">Nome da Unidade</th>
                        <th scope="col" className="px-6 py-3">Tipo</th>
                        <th scope="col" className="px-6 py-3">Código/Sigla</th>
                        <th scope="col" className="px-6 py-3">Telefone</th>
                        {canAccess(['admin', 'manager']) && <th scope="col" className="px-6 py-3 text-right">Ações</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {/* Lógica de filtro e mapeamento para a nova estrutura de Unidades */}
                      {units
                        .filter(unit =>
                          unit.name.toLowerCase().includes(unitFilter.toLowerCase()) ||
                          (unit.code && unit.code.toLowerCase().includes(unitFilter.toLowerCase())) ||
                          unit.type.toLowerCase().includes(unitFilter.toLowerCase())
                        )
                        /* Mapeamento atualizado para usar 'unit: Unit' */
                        .map((unit: Unit) => (
                          <tr key={unit.id} className="bg-white border-b hover:bg-gray-50">
                            {/* Colunas da tabela atualizadas para os campos de Unit */}
                            <th scope="row" className="px-6 py-4 font-medium text-gray-900 whitespace-nowrap">{unit.name}</th>
                            <td className="px-6 py-4">{unit.type}</td>
                            <td className="px-6 py-4">{unit.code || 'N/A'}</td>
                            <td className="px-6 py-4">{formatPhoneDisplay(unit.contact_phone)}</td>
                            {canAccess(['admin', 'manager']) && (
                              <td className="px-6 py-4 text-right whitespace-nowrap">
                                {/* Botões de ação atualizados */}
                                <button onClick={() => handleEditUnit(unit)} className="font-medium text-blue-600 hover:underline mr-4" title="Editar Unidade"><Edit className="inline-block w-5 h-5" /></button>
                                {canAccess(['admin']) && (<button onClick={() => handleDeleteUnit(unit.id)} className="font-medium text-red-600 hover:underline" title="Excluir Unidade"><Trash2 className="inline-block w-5 h-5" /></button>)}
                              </td>
                            )}
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activeMenu === 'people' && (
            <div className="space-y-8">
              <h1 className="text-3xl font-extrabold text-blue-900 mb-6">Gestão de Pessoas</h1>
              {canAccess(['admin', 'manager']) && (
                <div className="flex flex-col sm:flex-row gap-4 mb-6">
                  <button
                    onClick={() => { setEditingPerson(null); setShowPeopleModal(true); }}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg shadow-md hover:bg-blue-700 flex items-center justify-center"
                  >
                    <PlusCircle className="w-5 h-5 mr-2" /> Adicionar Pessoa
                  </button>
                  <input
                    type="file"
                    id="personFileInput"
                    className="hidden"
                    accept=".xlsx, .csv"
                    onChange={(e) => {
                      handleImport(e.target.files ? e.target.files[0] : null, 'people');
                      e.target.value = ''; // Limpa o input
                    }}
                  />
                  <label htmlFor="personFileInput" className="bg-green-600 text-white px-4 py-2 rounded-lg shadow-md hover:bg-green-700 flex items-center justify-center cursor-pointer">
                    <UploadCloud className="w-5 h-5 mr-2" /> Importar Pessoas
                  </label>
                </div>
              )}

              {/* <<< CAMPO DE BUSCA INTELIGENTE ADICIONADO AQUI >>> */}
              <div className="bg-white p-4 rounded-xl shadow-md">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Filtrar por Nome, CPF ou Matrícula..."
                    value={peopleFilter}
                    onChange={(e) => setPeopleFilter(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border rounded-lg"
                  />
                </div>
              </div>

              <div className="bg-white p-6 rounded-xl shadow-md">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">Lista de Pessoas Cadastradas</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left text-gray-500">
                    <thead className="text-xs text-gray-700 uppercase bg-gray-50">
                      <tr>
                        <th scope="col" className="px-6 py-3">Nome Completo</th>
                        <th scope="col" className="px-6 py-3">Unidade / Setor</th>
                        <th scope="col" className="px-6 py-3">Matrícula</th>
                        <th scope="col" className="px-6 py-3">CPF</th>
                        <th scope="col" className="px-6 py-3">Email</th>
                        {canAccess(['admin', 'manager']) && <th scope="col" className="px-6 py-3 text-right">Ações</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {/* <<< LÓGICA DE FILTRO APLICADA AQUI >>> */}
                      {people
                        .filter(p =>
                          p.full_name.toLowerCase().includes(peopleFilter.toLowerCase()) ||
                          p.cpf.includes(peopleFilter) ||
                          (p.registration_number && p.registration_number.includes(peopleFilter))
                        )
                        .map((person: Person) => (
                          <tr key={person.id} className="bg-white border-b hover:bg-gray-50">
                            <th scope="row" className="px-6 py-4 font-medium text-gray-900 whitespace-nowrap">{person.full_name}</th>
                            <td className="px-6 py-4">{person.unit_name || 'N/A'}</td>
                            <td className="px-6 py-4">{person.registration_number || 'N/A'}</td>
                            <td className="px-6 py-4">{person.cpf}</td>
                            <td className="px-6 py-4">{person.email}</td>
                            {canAccess(['admin', 'manager']) && (
                              <td className="px-6 py-4 text-right whitespace-nowrap">
                                <button onClick={() => handleEditPerson(person)} className="font-medium text-blue-600 hover:underline mr-4" title="Editar Pessoa"><Edit className="inline-block w-5 h-5" /></button>
                                {canAccess(['admin']) && (<button onClick={() => handleDeletePerson(person.id)} className="font-medium text-red-600 hover:underline" title="Excluir Pessoa"><Trash2 className="inline-block w-5 h-5" /></button>)}
                              </td>
                            )}
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activeMenu === 'assets' && (
            <div className="space-y-8">
              <h1 className="text-3xl font-extrabold text-blue-900 mb-6">Gestão de Ativos</h1>
              {canAccess(['admin', 'manager']) && (
                <div className="flex flex-col sm:flex-row gap-4 mb-6">
                  <button
                    onClick={() => {
                      console.log('Botão Adicionar Ativo clicado. Abrindo modal...');
                      setEditingAsset(null);
                      setShowAssetModal(true);
                    }}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg shadow-md hover:bg-blue-700 flex items-center justify-center transition-colors duration-200"
                  >
                    <PlusCircle className="w-5 h-5 mr-2" /> Adicionar Ativo
                  </button>
                  <input
                    type="file"
                    id="assetFileInput"
                    className="hidden"
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleImport(e.target.files ? e.target.files[0] : null, 'assets')}
                  />
                  <label htmlFor="assetFileInput" className="bg-green-600 text-white px-4 py-2 rounded-lg shadow-md hover:bg-green-700 flex items-center justify-center cursor-pointer transition-colors duration-200">
                    <UploadCloud className="w-5 h-5 mr-2" /> Importar Ativos (XLSX/CSV)
                  </label>
                </div>
              )}

              <div className="bg-white p-4 rounded-xl shadow-md mb-6">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">

                  {/* 1. Busca Textual (Patrimônio, Serial, Modelo) */}
                  <div className="md:col-span-2 flex gap-2">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                      <input
                        type="text"
                        placeholder="Buscar no banco (Pressione Enter)..."
                        value={assetFilter}
                        onChange={(e) => setAssetFilter(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && fetchAssets(assetFilter, assetStatusFilter)}
                        className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                      />
                    </div>
                    <button 
                      onClick={() => fetchAssets(assetFilter, assetStatusFilter)}
                      className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-bold shadow-sm transition-colors"
                    >
                      Buscar
                    </button>
                  </div>

                  {/* 2. Filtro por Status */}
                  <div>
                    <select
                      value={assetStatusFilter}
                      onChange={(e) => {
                        setAssetStatusFilter(e.target.value);
                        // Opcional: dispara a busca automaticamente ao trocar o status
                        fetchAssets(assetFilter, e.target.value);
                      }}
                      className="w-full p-2 border rounded-lg bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                    >
                      <option value="">Todos os Status</option>
                      <option value="available">Disponível</option>
                      <option value="in_use">Em Uso</option>
                      <option value="loaned">Emprestado</option>
                      <option value="maintenance">Em Manutenção</option>
                      <option value="pending_retirement">Pendente de Baixa</option>
                      <option value="retired">Baixado</option>
                      <option value="disposed">Descartado</option>
                    </select>
                  </div>

                  {/* 3. Filtro por Unidade */}
                  <div>
                    <Select
                      // Aqui passamos a lista preparada no Passo 2
                      options={unitFilterOptions}

                      // Lógica para mostrar o valor selecionado (ou limpar se estiver vazio)
                      value={assetUnitFilter ? { value: assetUnitFilter, label: assetUnitFilter } : null}

                      // Quando o usuário escolhe uma escola:
                      onChange={(selectedOption) => {
                        // Se ele selecionou algo, salva o nome. Se limpou (X), salva vazio.
                        setAssetUnitFilter(selectedOption ? selectedOption.value : '');
                      }}

                      placeholder="Digite o nome da unidade..."
                      isClearable // Mostra o botão 'X' para limpar
                      noOptionsMessage={() => "Nenhuma unidade encontrada"}

                      // Estilização para ficar igual aos outros campos (Altura e Borda)
                      styles={{
                        control: (base) => ({
                          ...base,
                          minHeight: '42px',
                          borderRadius: '0.5rem',
                          borderColor: '#e5e7eb', // Cinza claro igual aos outros inputs
                          boxShadow: 'none',
                          '&:hover': {
                            borderColor: '#3b82f6' // Azul ao passar o mouse
                          }
                        }),
                        menu: (base) => ({ ...base, zIndex: 9999 }) // Garante que a lista fique por cima da tabela
                      }}
                      className="text-sm"
                    />
                  </div>

                </div>
              </div>

              <div className="bg-white p-6 rounded-xl shadow-md">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">Lista de Ativos Cadastrados</h3>
                {assets.length > 0 ? (
                  <div className="overflow-x-auto">
                    {/* Tabela com a nova formatação e colunas */}
                    <table className="w-full text-sm text-left text-gray-500">
                      <thead className="text-xs text-gray-700 uppercase bg-gray-50">
                        <tr>
                          <th scope="col" className="px-6 py-3">Patrimônio / Nº Série</th>
                          <th scope="col" className="px-6 py-3">Tipo</th>
                          <th scope="col" className="px-6 py-3">Marca / Modelo</th>
                          <th scope="col" className="px-6 py-3">Status</th>
                          <th scope="col" className="px-6 py-3">Unidade Atual</th>
                          {canAccess(['admin', 'manager']) && <th scope="col" className="px-6 py-3 text-right">Ações</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {assets
                          .filter((asset) => {
                            // 1. Verifica Texto (Busca geral)
                            const matchesText =
                              (asset.patrimonio_number || '').toLowerCase().includes(assetFilter.toLowerCase()) ||
                              (asset.serial_number || '').toLowerCase().includes(assetFilter.toLowerCase()) ||
                              (asset.brand || '').toLowerCase().includes(assetFilter.toLowerCase()) ||
                              (asset.model || '').toLowerCase().includes(assetFilter.toLowerCase()) ||
                              (asset.item_type_name || '').toLowerCase().includes(assetFilter.toLowerCase());

                            // 2. Verifica Status (Se houver filtro selecionado)
                            const matchesStatus = assetStatusFilter
                              ? asset.status === assetStatusFilter
                              : true;

                            // 3. Verifica Unidade (Se houver filtro selecionado)
                            // Nota: Usamos current_unit_name pois é o que exibimos na tabela
                            const matchesUnit = assetUnitFilter
                              ? (asset.current_unit_name || '') === assetUnitFilter
                              : true;

                            // Retorna verdadeiro apenas se passar em TODAS as condições
                            return matchesText && matchesStatus && matchesUnit;
                          })
                          .map((asset: Asset) => (
                            <tr key={asset.id} className="bg-white border-b hover:bg-gray-50">
                              <th scope="row" className="px-6 py-4 whitespace-nowrap">
                                <div className="font-bold text-gray-900 text-sm">
                                  {asset.patrimonio_number || 'Sem Tombo'}
                                </div>
                                <div className="text-xs text-gray-500 font-mono mt-0.5">
                                  Série: {asset.serial_number || 'N/A'}
                                </div>
                              </th>
                              <td className="px-6 py-4">
                                {asset.item_type_name}
                              </td>
                              <td className="px-6 py-4">
                                {`${asset.brand} / ${asset.model}`}
                              </td>
                              <td className="px-6 py-4">
                                <span className={`px-2 py-1 font-semibold leading-tight text-xs rounded-full ${asset.status === 'available' ? 'bg-green-100 text-green-700' :
                                    asset.status === 'in_use' ? 'bg-blue-100 text-blue-700' :
                                      asset.status === 'loaned' ? 'bg-yellow-100 text-yellow-700' :
                                        asset.status === 'maintenance' ? 'bg-orange-100 text-orange-700' :
                                          'bg-gray-100 text-gray-700'
                                  }`}>
                                  {/* >>> A TRADUÇÃO ACONTECE AQUI <<< */}
                                  {translateStatus(asset.status)}
                                </span>
                              </td>
                              <td className="px-6 py-4">
                                {asset.current_unit_name || 'N/A'}
                              </td>
                              {canAccess(['admin', 'manager']) && (
                                <td className="px-6 py-4 text-right whitespace-nowrap">

                                  {/* LÓGICA DE BLOQUEIO DO BOTÃO EDITAR */}
                                  {(() => {
                                    // Status que bloqueiam edição para não-admins
                                    const isLockedStatus = ['pending_retirement', 'retired', 'disposed'].includes(asset.status);
                                    // Apenas Admin pode editar ativos travados
                                    const canEdit = user?.role === 'admin' || !isLockedStatus;

                                    return (
                                      <button
                                        onClick={() => canEdit && handleEditAsset(asset)}
                                        className={`font-medium mr-4 ${canEdit ? 'text-blue-600 hover:underline' : 'text-gray-300 cursor-not-allowed'}`}
                                        disabled={!canEdit}
                                        title={canEdit ? "Editar Ativo" : "Edição bloqueada (Ativo em processo de baixa/descarte)"}
                                      >
                                        <Edit className="inline-block w-5 h-5" />
                                      </button>
                                    );
                                  })()}

                                  {/* Botão de Baixar (NOVO) */}
                                  {['available', 'maintenance'].includes(asset.status) && user?.role === 'admin' && (
                                    <button
                                      onClick={() => setAssetToRetire(asset)}
                                      className="font-medium text-yellow-600 hover:underline ml-4"
                                      title="Dar Baixa no Ativo (Direto)"
                                    >
                                      <ArrowDownCircle className="inline-block w-5 h-5" />
                                    </button>
                                  )}

                                  {asset.status === 'retired' && can('ACTION_DELETE') && (
                                    <button
                                      onClick={() => setAssetToDispose(asset)}
                                      className="font-medium text-black hover:text-red-700 ml-4"
                                      title="Descartar Ativo Permanentemente"
                                    >
                                      <Trash2 className="inline-block w-5 h-5" />
                                    </button>
                                  )}

                                  {/* Botão de Excluir (já existente) */}
                                  {asset.status !== 'retired' && can('ACTION_DELETE') && (
                                    <button
                                      onClick={() => handleDeleteAsset(asset.id)}
                                      className="font-medium text-red-600 hover:underline ml-4"
                                      title="Excluir Registro do Ativo"
                                    >
                                      <Trash2 className="inline-block w-5 h-5" />
                                    </button>
                                  )}
                                </td>
                              )}
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-gray-500 text-center py-4">Nenhum ativo cadastrado.</p>
                )}
              </div>
            </div>
          )}

          {activeMenu === 'settings' && (
            // Apenas usuários com o perfil 'admin' podem ver esta página
            canAccess(['admin']) ? (
              <SettingsPage
                users={users}
                onAddUser={() => {
                  setEditingUser(null); // Garante que não há usuário em edição
                  setShowUserModal(true);
                }}
                onDeleteUser={handleDeleteUser}
                onEditUser={handleEditUser} // <<< PASSA A NOVA FUNÇÃO
              />
            ) : (
              // Mensagem de Acesso Negado para outros perfis
              <div className="text-center py-20 text-red-600">
                <h1 className="text-3xl font-bold mb-4">Acesso Negado</h1>
                <p>Você não tem permissão para acessar esta área.</p>
              </div>
            )
          )}

          {activeMenu === 'reports' && (
            <div className="space-y-8 animate-fadeIn">

              <div className="flex justify-between items-end border-b pb-4">
                <div>
                  <h1 className="text-3xl font-extrabold text-blue-900">Central de Relatórios</h1>
                  <p className="text-gray-500 mt-1">Extração de dados para auditoria, gestão estratégica e controle operacional.</p>
                </div>
              </div>

              {/* 1. NÍVEL ESTRATÉGICO (TOMADA DE DECISÃO) */}
              <section>
                <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4 flex items-center">
                  <Activity className="w-4 h-4 mr-2" /> Indicadores Estratégicos e Gestão
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

                  {/* Card: Inventário Matriz */}
                  <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-shadow relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                      <LayoutDashboard className="w-20 h-20 text-blue-900" />
                    </div>
                    <div className="relative z-10">
                      <div className="w-12 h-12 bg-blue-100 text-blue-700 rounded-lg flex items-center justify-center mb-4">
                        <List className="w-6 h-6" />
                      </div>
                      <h4 className="text-lg font-bold text-gray-900">Inventário Geral (Matriz)</h4>
                      <p className="text-sm text-gray-500 mt-2 mb-6 h-10">
                        Visão cruzada de Unidades x Tipos de Item. Saldo total de bens na rede.
                      </p>
                      <button
                        onClick={async () => {
                          addToast('Gerando Matriz...', 'info');
                          try {
                            const response = await axios.get(`${API_URL}/reports/management/inventory-by-unit/xlsx`, { responseType: 'blob' });
                            const url = window.URL.createObjectURL(new Blob([response.data]));
                            const link = document.createElement('a'); link.href = url; link.setAttribute('download', 'Inventario_Geral.xlsx'); document.body.appendChild(link); link.click();
                          } catch (e) { addToast('Erro ao gerar.', 'error'); }
                        }}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-lg font-bold shadow flex items-center justify-center transition-colors text-xs"
                      >
                        <Download className="w-4 h-4 mr-2" /> Baixar Planilha (XLSX)
                      </button>
                    </div>
                  </div>

                  {/* NOVO CARD: OPERAÇÃO TABLETS (EducaRecife) */}
                  <div className="bg-white p-6 rounded-xl shadow-sm border-2 border-blue-50 hover:border-blue-100 hover:shadow-md transition-all relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                      <GraduationCap className="w-20 h-20 text-blue-800" />
                    </div>
                    <div className="relative z-10">
                      <div className="w-12 h-12 bg-indigo-100 text-indigo-700 rounded-lg flex items-center justify-center mb-4">
                        <Smartphone className="w-6 h-6" />
                      </div>
                      <h4 className="text-lg font-bold text-gray-900">Logística de Tablets</h4>
                      <p className="text-sm text-gray-500 mt-2 mb-6 h-10">
                        Acompanhamento completo: entregas, pendências por escola e dados de chips.
                      </p>
                      <div className="flex flex-col gap-2">
                        <button
                          onClick={async () => {
                            addToast('Gerando base completa (XLSX)...', 'info');
                            try {
                              const response = await axios.get(`${API_URL}/reports/tablets/detailed/xlsx`, { responseType: 'blob' });
                              const url = window.URL.createObjectURL(new Blob([response.data]));
                              const link = document.createElement('a'); link.href = url; link.setAttribute('download', 'Base_Operacional_Tablets.xlsx'); document.body.appendChild(link); link.click();
                            } catch (e) { addToast('Erro ao gerar.', 'error'); }
                          }}
                          className="w-full bg-green-600 hover:bg-green-700 text-white py-2 rounded-lg font-bold shadow flex items-center justify-center transition-colors text-xs"
                        >
                          <Download className="w-3 h-3 mr-2" /> Base Analítica (XLSX)
                        </button>
                        <button
                          onClick={async () => {
                            addToast('Gerando resumo executivo (PDF)...', 'info');
                            try {
                              const response = await axios.get(`${API_URL}/reports/tablets/consolidated/pdf`, { responseType: 'blob' });
                              const url = window.URL.createObjectURL(new Blob([response.data]));
                              const link = document.createElement('a'); link.href = url; link.setAttribute('download', 'Resumo_Executivo_Tablets.pdf'); document.body.appendChild(link); link.click();
                            } catch (e) { addToast('Erro ao gerar.', 'error'); }
                          }}
                          className="w-full bg-white border border-blue-600 text-blue-700 hover:bg-blue-50 py-2 rounded-lg font-bold flex items-center justify-center transition-colors text-xs"
                        >
                          <FileText className="w-3 h-3 mr-2" /> Resumo por Escola (PDF)
                        </button>
                        <button
                          onClick={async () => {
                            addToast('Gerando resumo consolidado (XLSX)...', 'info');
                            try {
                              const response = await axios.get(`${API_URL}/reports/tablets/consolidated/xlsx`, { responseType: 'blob' });
                              const url = window.URL.createObjectURL(new Blob([response.data]));
                              const link = document.createElement('a');
                              link.href = url;
                              link.setAttribute('download', 'Resumo_Consolidado_Tablets.xlsx');
                              document.body.appendChild(link);
                              link.click();
                              link.parentNode?.removeChild(link);
                            } catch (e) {
                              addToast('Erro ao gerar planilha.', 'error');
                            }
                          }}
                          className="w-full bg-white border border-green-600 text-green-700 hover:bg-green-50 py-2 rounded-lg font-bold flex items-center justify-center transition-colors text-xs"
                        >
                          <Download className="w-3 h-3 mr-2" /> Resumo por Escola (XLSX)
                        </button>
                        <div className="border-t border-amber-200 mt-1 pt-2">
                          <p className="text-xs text-amber-700 font-semibold mb-1.5 text-center">Relatório Final de Execução</p>
                          <div className="flex gap-2">
                            <button
                              onClick={async () => {
                                addToast('Gerando relatório histórico (PDF)...', 'info');
                                try {
                                  const response = await axios.get(`${API_URL}/reports/tablets/historical/pdf`, { responseType: 'blob' });
                                  const url = window.URL.createObjectURL(new Blob([response.data]));
                                  const link = document.createElement('a'); link.href = url; link.setAttribute('download', 'Relatorio_Historico_Tablets.pdf'); document.body.appendChild(link); link.click(); link.parentNode?.removeChild(link);
                                } catch (e) { addToast('Erro ao gerar relatório histórico.', 'error'); }
                              }}
                              className="flex-1 bg-amber-600 hover:bg-amber-700 text-white py-2 rounded-lg font-bold shadow flex items-center justify-center transition-colors text-xs"
                            >
                              <FileText className="w-3 h-3 mr-1" /> PDF Gerencial
                            </button>
                            <button
                              onClick={async () => {
                                addToast('Gerando relatório histórico (XLSX)...', 'info');
                                try {
                                  const response = await axios.get(`${API_URL}/reports/tablets/historical/xlsx`, { responseType: 'blob' });
                                  const url = window.URL.createObjectURL(new Blob([response.data]));
                                  const link = document.createElement('a'); link.href = url; link.setAttribute('download', 'Relatorio_Historico_Tablets.xlsx'); document.body.appendChild(link); link.click(); link.parentNode?.removeChild(link);
                                } catch (e) { addToast('Erro ao gerar relatório histórico.', 'error'); }
                              }}
                              className="flex-1 bg-white border border-amber-600 text-amber-700 hover:bg-amber-50 py-2 rounded-lg font-bold flex items-center justify-center transition-colors text-xs"
                            >
                              <Download className="w-3 h-3 mr-1" /> XLSX Análise
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Card: Volume Operacional */}
                  <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-shadow relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                      <Activity className="w-20 h-20 text-green-900" />
                    </div>
                    <div className="relative z-10">
                      <div className="w-12 h-12 bg-green-100 text-green-700 rounded-lg flex items-center justify-center mb-4">
                        <BarChart2 className="w-6 h-6" />
                      </div>
                      <h4 className="text-lg font-bold text-gray-900">Volume Operacional</h4>
                      <p className="text-sm text-gray-500 mt-2 mb-6 h-10">
                        Resumo quantitativo de Entradas, Saídas e Devoluções por período.
                      </p>
                      <div className="flex gap-2">
                        <button
                          onClick={async () => {
                            addToast('Gerando Relatório...', 'info');
                            try {
                              const response = await axios.get(`${API_URL}/reports/management/movements-summary/xlsx`, { responseType: 'blob' });
                              const url = window.URL.createObjectURL(new Blob([response.data]));
                              const link = document.createElement('a'); link.href = url; link.setAttribute('download', 'Volume_Operacional.xlsx'); document.body.appendChild(link); link.click();
                            } catch (e) { addToast('Erro ao gerar.', 'error'); }
                          }}
                          className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2.5 rounded-lg font-bold shadow flex items-center justify-center transition-colors text-xs"
                        >
                          Baixar (XLSX)
                        </button>
                      </div>
                    </div>
                  </div>

                </div>
              </section>

              {/* 2. NÍVEL OPERACIONAL (AÇÃO IMEDIATA) */}
              <section>
                <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4 flex items-center">
                  <AlertTriangleIcon className="w-4 h-4 mr-2" /> Controle Operacional e Auditoria
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

                  {/* Card 1: Empréstimos Vencidos (Cobrança Externa) */}
                  <div className="bg-red-50 border border-red-200 rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-center mb-3">
                      <div className="p-2 bg-red-100 rounded-lg text-red-600 mr-3">
                        <History className="w-5 h-5" />
                      </div>
                      <h4 className="font-bold text-red-900">Empréstimos Vencidos</h4>
                    </div>
                    <p className="text-xs text-red-700 mb-4 h-8">
                      Ativos que deveriam ter retornado e estão em atraso. Use para cobrar os usuários.
                    </p>
                    <div className="flex gap-2">
                      <button onClick={() => handleDownloadReport('overdue-loans', 'xlsx')} className="flex-1 bg-white text-red-700 border border-red-200 py-2 rounded font-bold text-xs hover:bg-red-100">Excel</button>
                      <button onClick={() => handleDownloadReport('overdue-loans', 'pdf')} className="flex-1 bg-red-600 text-white py-2 rounded font-bold text-xs hover:bg-red-700">PDF</button>
                    </div>
                  </div>

                  {/* Card 2: Pendências de Documentação (Cobrança Interna) - NOVO */}
                  <div className="bg-orange-50 border border-orange-200 rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-center mb-3">
                      <div className="p-2 bg-orange-100 rounded-lg text-orange-600 mr-3">
                        <FileText className="w-5 h-5" />
                      </div>
                      <h4 className="font-bold text-orange-900">Pendências de Upload</h4>
                    </div>
                    <p className="text-xs text-orange-700 mb-4 h-8">
                      Movimentações criadas no sistema mas sem o recibo assinado anexado. Cobrança de Técnicos.
                    </p>
                    <button
                      onClick={async () => {
                        addToast('Gerando Relatório de Pendências...', 'info');
                        try {
                          const response = await axios.get(`${API_URL}/reports/pending-docs/xlsx`, { responseType: 'blob' });
                          const url = window.URL.createObjectURL(new Blob([response.data]));
                          const link = document.createElement('a');
                          link.href = url;
                          link.setAttribute('download', `Auditoria_Pendencias_${new Date().toISOString().split('T')[0]}.xlsx`);
                          document.body.appendChild(link);
                          link.click();
                        } catch (e) { addToast('Erro ao gerar relatório.', 'error'); }
                      }}
                      className="w-full bg-orange-500 text-white py-2 rounded font-bold text-xs hover:bg-orange-600 shadow-sm"
                    >
                      Baixar Auditoria (XLSX)
                    </button>
                  </div>

                  {/* Card 3: Saúde do Parque (Manutenção) - NOVO */}
                  <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-center mb-3">
                      <div className="p-2 bg-yellow-100 rounded-lg text-yellow-700 mr-3">
                        <HardDrive className="w-5 h-5" />
                      </div>
                      <h4 className="font-bold text-yellow-900">Saúde do Parque</h4>
                    </div>
                    <p className="text-xs text-yellow-800 mb-4 h-8">
                      Lista de ativos em Manutenção, Defeituosos ou Baixados. Controle de estoque inativo.
                    </p>
                    <button
                      onClick={async () => {
                        addToast('Gerando Relatório de Manutenção...', 'info');
                        try {
                          const response = await axios.get(`${API_URL}/reports/maintenance/xlsx`, { responseType: 'blob' });
                          const url = window.URL.createObjectURL(new Blob([response.data]));
                          const link = document.createElement('a');
                          link.href = url;
                          link.setAttribute('download', `Relatorio_Manutencao_${new Date().toISOString().split('T')[0]}.xlsx`);
                          document.body.appendChild(link);
                          link.click();
                        } catch (e) { addToast('Erro ao gerar relatório.', 'error'); }
                      }}
                      className="w-full bg-yellow-500 text-white py-2 rounded font-bold text-xs hover:bg-yellow-600 shadow-sm"
                    >
                      Baixar Relatório (XLSX)
                    </button>
                  </div>

                </div>
              </section>

              {/* 3. NÍVEL DE AUDITORIA (DADOS BRUTOS) */}
              <section>
                <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4 flex items-center">
                  <Database className="w-4 h-4 mr-2" /> Exportação de Dados (Auditoria)
                </h3>

                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 divide-y md:divide-y-0 md:divide-x divide-gray-200">

                    {/* Coluna 1: Ativos */}
                    <div className="p-5 hover:bg-gray-50 transition-colors">
                      <h5 className="font-bold text-gray-800 mb-1 flex items-center"><HardDrive className="w-4 h-4 mr-2 text-blue-500" /> Ativos (Base Completa)</h5>
                      <p className="text-xs text-gray-500 mb-4">Todos os bens registrados.</p>
                      <div className="flex gap-2">
                        <button onClick={() => handleDownloadReport('assets', 'xlsx')} className="flex-1 text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 py-2 rounded border font-medium">Excel</button>
                        <button onClick={() => handleDownloadReport('assets', 'csv')} className="flex-1 text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 py-2 rounded border font-medium">CSV</button>
                      </div>
                    </div>

                    {/* Coluna 2: Pessoas */}
                    <div className="p-5 hover:bg-gray-50 transition-colors">
                      <h5 className="font-bold text-gray-800 mb-1 flex items-center"><Users className="w-4 h-4 mr-2 text-purple-500" /> Pessoas</h5>
                      <p className="text-xs text-gray-500 mb-4">Base de solicitantes.</p>
                      <div className="flex gap-2">
                        <button onClick={() => handleDownloadReport('people', 'xlsx')} className="flex-1 text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 py-2 rounded border font-medium">Excel</button>
                        <button onClick={() => handleDownloadReport('people', 'csv')} className="flex-1 text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 py-2 rounded border font-medium">CSV</button>
                      </div>
                    </div>

                    {/* Coluna 3: Unidades */}
                    <div className="p-5 hover:bg-gray-50 transition-colors">
                      <h5 className="font-bold text-gray-800 mb-1 flex items-center"><Box className="w-4 h-4 mr-2 text-orange-500" /> Unidades</h5>
                      <p className="text-xs text-gray-500 mb-4">Escolas e setores.</p>
                      <div className="flex gap-2">
                        <button onClick={() => handleDownloadReport('units', 'xlsx')} className="flex-1 text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 py-2 rounded border font-medium">Excel</button>
                        <button onClick={() => handleDownloadReport('units', 'pdf')} className="flex-1 text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 py-2 rounded border font-medium">PDF</button>
                      </div>
                    </div>

                    {/* Coluna 4: Tipos */}
                    <div className="p-5 hover:bg-gray-50 transition-colors">
                      <h5 className="font-bold text-gray-800 mb-1 flex items-center"><List className="w-4 h-4 mr-2 text-indigo-500" /> Tipos de Item</h5>
                      <p className="text-xs text-gray-500 mb-4">Categorias e SKUs.</p>
                      <div className="flex gap-2">
                        <button onClick={() => handleDownloadReport('item-types', 'xlsx')} className="flex-1 text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 py-2 rounded border font-medium">Excel</button>
                      </div>
                    </div>

                  </div>
                </div>
              </section>

            </div>
          )}

          {activeMenu === 'audit' && (
            can('MENU_AUDITORIA') ? (
              <AuditLogPage API_URL={API_URL} />
            ) : (
              <div className="text-center py-20 text-red-600">
                <h1 className="text-3xl font-bold mb-4">Acesso Negado</h1>
                <p>Você não tem permissão para acessar esta área.</p>
              </div>
            )
          )}

          {/* >>> RENDERIZA A NOVA PÁGINA CENTRAL "Gerenciar Ativos Externos" <<< */}
          {activeMenu === 'manage-external' && (
            <AssetManagementPage
              onConfirmClick={setSelectedMovementForConfirmation}
              onRenewClick={setMovementToRenew}
              onSubstituteClick={handleOpenSubstitutionModal}
              onReturnClick={(movement) => handleOpenReturnModal(movement.id)} // ✨ AJUSTE AQUI
              onFinalizeSubstitution={(item) => setSubstitutionToFinalize(item)}
              API_URL={API_URL}
              refreshKey={refreshKey}
            />
          )}

          {/* >>> NOVO COMPONENTE DE ENTREGA DE TABLETS AQUI <<<     */}
          {activeMenu === 'tablet-delivery' && (
            <TabletDeliveryPage
              API_URL={API_URL}
              units={units}
              addToast={addToast}
              onImportResult={setImportResult} // Reutiliza o modal de importação!
              triggerRefresh={triggerRefresh}
            />
          )}
          {activeMenu === 'batch-collection' && (
            <BatchCollectionPage
              API_URL={API_URL}
              addToast={addToast}
              units={units}
            />
          )}
          {/* >>> NOVA PÁGINA DE MONITORAMENTO <<< */}
          {activeMenu === 'tablet-dashboard' && (
            <TabletDashboard
              API_URL={API_URL}
              // >>> ADICIONE ESTA PROP <<<
              onNavigateToPendingTerms={() => setActiveMenu('pending-terms')}
            />
          )}

          {activeMenu === 'executive-dashboard' && (
            <ExecutiveDashboard API_URL={API_URL} />
          )}



          {activeMenu === 'tablet-audit' && <TabletAudit API_URL={API_URL} addToast={addToast} />}

          {activeMenu === 'retire-dispose' && (
            <RetirementAndDisposalPage
              API_URL={API_URL}
              userRole={user?.role}
              userName={user?.full_name}
            />
          )}

          {activeMenu === 'analytics' && <AnalyticsDashboard API_URL={API_URL} />}

          {detailedMovementToReturn && (
            <ReturnConfirmationModal
              movement={detailedMovementToReturn}
              onClose={() => setDetailedMovementToReturn(null)}
              // AQUI ESTÁ A CORREÇÃO: Passamos a função direto, sem o wrapper (...) => ...
              onConfirm={handleConfirmReturn}
              API_URL={API_URL}
            />
          )}

          {/* RENDERIZA A PÁGINA DE CONSULTAS QUANDO O MENU FOR CLICADO */}
          {activeMenu === 'queries' && (
            <QueryHubPage
              people={people}
              units={units}
              API_URL={API_URL}
              translateMovementType={translateMovementType}
              translateStatus={translateStatus}
              onRenewClick={setMovementToRenew}
              onSubstituteClick={handleOpenSubstitutionModal}
              onReturnClick={(movement) => handleOpenReturnModal(movement.id)}
              userRole={user?.role || ''}
              handleGenerateMovementReceipt={handleGenerateMovementReceipt}
            />
          )}


          {activeMenu === 'cd-inventory' && (
            <CdInventoryPage
              API_URL={API_URL}
              addToast={addToast}
            />
          )}

        </main>
      </div>

      {/* MODAL DE RENOVAÇÃO AQUI */}
      {movementToRenew && (
        <LoanRenewalModal
          movement={movementToRenew}
          onClose={() => setMovementToRenew(null)}
          onSave={handleSaveRenewal}
        />
      )}

      {movementToSubstitute && (
        <SubstitutionModal
          movement={movementToSubstitute}
          onClose={() => setMovementToSubstitute(null)}
          onSuccess={(resultData?: any) => {
            fetchMovements();
            fetchAssets();
            triggerRefresh();
          }}
          API_URL={API_URL}
        />
      )}

      {/* Modais de Gerenciamento */}
      {showMovementModal && (
        <MovementModal
          onClose={() => setShowMovementModal(false)}
          onSave={async (newMovementData) => {
            try {
              const response = await axios.post(`${API_URL}/asset-movements`, newMovementData);
              addToast('Movimentação registrada com sucesso!', 'success');
              fetchMovements();
              fetchAssets();
              fetchDashboardData();
              // Retorna o ID da movimentação para o componente pai
              return { success: true, movementId: response.data.movement_id, message: 'Movimentação registrada com sucesso!' };
            } catch (error: unknown) {
              const axiosError = error as AxiosError<BackendErrorResponse>;
              const errorMessage = (axiosError.response?.data?.message && typeof axiosError.response.data.message === 'string')
                ? axiosError.response.data.message
                : 'Erro ao registrar movimentação.';
              addToast(`Erro: ${errorMessage}`, 'error');
              console.error('Erro ao registrar movimentação:', axiosError);
              return { success: false, message: errorMessage };
            }
          }}
          assets={assets}
          people={people}
          units={units} // Passa a lista de uniades
          handleGenerateMovementReceipt={handleGenerateMovementReceipt} // Passa a função para o modal
        />
      )}

      {/* RENDERIZAÇÃO DO NOVO MODAL */}
      {showReturnByAssetModal && (
        <ReturnByAssetModal
          onClose={() => setShowReturnByAssetModal(false)}
          onSave={async (newMovementData) => {
            try {
              const response = await axios.post(`${API_URL}/asset-movements`, newMovementData);
              // Esta função de 'onSave' é a mesma do modal principal.
              // Ela é genérica o suficiente para ser reutilizada aqui.
              fetchMovements();
              fetchAssets();
              fetchDashboardData();
              return { success: true, movementId: response.data.movement_id, message: 'Movimentação registrada com sucesso!' };
            } catch (error: unknown) {
              const axiosError = error as AxiosError<BackendErrorResponse>;
              const errorMessage = (axiosError.response?.data?.message && typeof axiosError.response.data.message === 'string')
                ? axiosError.response.data.message
                : 'Erro ao registrar movimentação.';
              console.error('Erro ao registrar movimentação:', axiosError);
              return { success: false, message: errorMessage };
            }
          }}
          handleGenerateMovementReceipt={handleGenerateMovementReceipt}
        />
      )}

      {showReturnByUserModal && (
        <ReturnByUserModal
          onClose={() => setShowReturnByUserModal(false)}
          people={people} // Passando a lista de pessoas que já está no estado
          onSave={async (newMovementData) => {
            // A função onSave é a mesma para todos os modais de movimentação.
            // Você pode copiar e colar este bloco de código.
            try {
              const response = await axios.post(`${API_URL}/asset-movements`, newMovementData);
              fetchMovements();
              fetchAssets();
              fetchDashboardData();
              return { success: true, movementId: response.data.movement_id, message: 'Movimentação registrada com sucesso!' };
            } catch (error: unknown) {
              const axiosError = error as AxiosError<BackendErrorResponse>;
              const errorMessage = (axiosError.response?.data?.message && typeof axiosError.response.data.message === 'string')
                ? axiosError.response.data.message
                : 'Erro ao registrar movimentação.';
              console.error('Erro ao registrar movimentação:', axiosError);
              return { success: false, message: errorMessage };
            }
          }}
          handleGenerateMovementReceipt={handleGenerateMovementReceipt}
        />
      )}

      {showItemTypeModal && (
        <ItemTypeModal
          onClose={() => { setShowItemTypeModal(false); setEditingItemType(null); }}
          // A função onSave já passa o objeto de dados completo (itemTypeData),
          // então o código abaixo já deve funcionar corretamente com as novas props
          onSave={async (itemTypeData) => { // itemTypeData agora inclui sku_code
            try {
              if (editingItemType) {
                await axios.put(`${API_URL}/item-types/${editingItemType.id}`, itemTypeData);
                addToast('Tipo de item atualizado com sucesso!', 'success');
              } else {
                await axios.post(`${API_URL}/item-types`, itemTypeData);
                addToast('Tipo de item adicionado com sucesso!', 'success');
              }
              triggerRefresh();
              fetchItemTypes();
              setShowItemTypeModal(false);
              setEditingItemType(null);
            } catch (error: any) {
              // <<< AQUI ESTÁ A CORREÇÃO >>>
              // Pega a mensagem específica enviada pelo backend
              const msg = error.response?.data?.message || 'Erro desconhecido ao salvar tipo de item.';
              console.error('Erro no cadastro:', error);
              addToast(msg, 'error'); // Mostra o toast vermelho com a explicação
            }
          }}
          itemType={editingItemType}
        />
      )}

      {isUnitModalOpen && (
        <UnitForm
          unitToEdit={editingUnit}
          units={units}
          onClose={() => setIsUnitModalOpen(false)}
          onUnitSaved={() => {
            setIsUnitModalOpen(false);
            fetchUnits(); // Mantemos a atualização da lista
          }}
          API_URL={API_URL}
          addToast={addToast}
        />
      )}


      {isParentUnitModalOpen && (
        <ParentUnitModal
          API_URL={API_URL}
          onClose={() => setIsParentUnitModalOpen(false)}
          onSaveSuccess={() => {
            fetchUnits(); // Apenas atualiza a lista de opções
            setIsParentUnitModalOpen(false); // E fecha o modal
          }}
        />
      )}

      {showAssetModal && (
        <AssetModal
          onClose={() => { setShowAssetModal(false); setEditingAsset(null); }}
          onSave={async (assetData) => {
            try {
              if (editingAsset) {
                await axios.put(`${API_URL}/assets/${editingAsset.id}`, assetData);
                addToast('Ativo atualizado com sucesso!', 'success');
              } else {
                await axios.post(`${API_URL}/assets`, assetData);
                addToast('Ativo adicionado com sucesso!', 'success');
              }
              triggerRefresh();
              fetchAssets();
              fetchDashboardData();
              setShowAssetModal(false);
              setEditingAsset(null);
            } catch (error: unknown) {
              const axiosError = error as AxiosError<BackendErrorResponse>;
              const errorMessage = (axiosError.response?.data?.message && typeof axiosError.response.data.message === 'string')
                ? axiosError.response.data.message
                : 'Erro ao salvar ativo.';
              addToast(`Erro: ${errorMessage}`, 'error');
              console.error('Erro ao salvar ativo:', axiosError);
            }
          }}
          asset={editingAsset}
          itemTypes={itemTypes}
          units={units}
          translateStatus={translateStatus}
          userRole={user?.role}
        />
      )}

      {/* NOVO: Modal de Pessoas */}
      {showPeopleModal && (
        <PeopleModal
          onClose={() => { setShowPeopleModal(false); setEditingPerson(null); }}
          onSave={async (personData) => {
            try {
              if (editingPerson) {
                await axios.put(`${API_URL}/people/${editingPerson.id}`, personData);
                addToast('Pessoa atualizada com sucesso!', 'success');
              } else {
                await axios.post(`${API_URL}/people`, personData);
                addToast('Pessoa adicionada com sucesso!', 'success');
              }
              triggerRefresh();
              fetchPeople();
              fetchMovements();
              setShowPeopleModal(false);
              setEditingPerson(null);
            } catch (error: unknown) {
              const axiosError = error as AxiosError<BackendErrorResponse>;
              const errorMessage = (axiosError.response?.data?.message && typeof axiosError.response.data.message === 'string')
                ? axiosError.response.data.message
                : 'Erro ao salvar pessoa.';
              addToast(`Erro: ${errorMessage}`, 'error');
              console.error('Erro ao salvar pessoa:', axiosError);
            }
          }}
          person={editingPerson}
          units={units}
        />
      )}

      {showUserModal && (
        <UserModal
          userToEdit={editingUser}
          units={units}
          onClose={() => {
            setShowUserModal(false);
            setEditingUser(null); // Limpa o estado de edição ao fechar
          }}
          onSave={async (userData, userId) => {
            try {
              if (userId) {
                // Lógica de Edição
                await axios.put(`${API_URL}/users/${userId}`, userData);
                addToast('Usuário atualizado com sucesso!', 'success');
              } else {
                // Lógica de Criação
                const response = await axios.post(`${API_URL}/users/register`, userData);
                addToast('Usuário registrado com sucesso!', 'success');
                if (response.data.generatedPassword) {
                  alert(`Senha Temporária: ${response.data.generatedPassword}`);
                }
              }
              fetchUsers();
              setShowUserModal(false);
              setEditingUser(null);
            } catch (error: unknown) {
              const axiosError = error as AxiosError<BackendErrorResponse>;
              const errorMessage = axiosError.response?.data?.message || 'Erro ao salvar usuário.';
              addToast(errorMessage, 'error');
            }
          }}
        />
      )}
      {/* Modal para editar o perfil do usuário */}
      {showProfileModal && (
        <ProfileModal
          currentUser={user}
          onClose={() => setShowProfileModal(false)}
          onChangePasswordClick={() => {
            setShowProfileModal(false); // Fecha o modal de perfil
            setShowChangePasswordModal(true); // Abre o modal de senha
          }}
          onSave={async (profileData) => {
            try {
              const response = await axios.put(`${API_URL}/users/me`, profileData);
              addToast('Perfil atualizado com sucesso!', 'success');

              const { token: newToken } = response.data;
              localStorage.setItem('token', newToken);

              setShowProfileModal(false);
              window.location.reload();

            } catch (error: unknown) {
              const axiosError = error as AxiosError<BackendErrorResponse>;
              const errorMessage = axiosError.response?.data?.message || 'Erro ao atualizar o perfil.';
              addToast(errorMessage, 'error');
            }
          }}
        />
      )}
      {/* Modal para alterar a senha do usuário */}
      {showChangePasswordModal && (
        <ChangePasswordModal
          onClose={() => setShowChangePasswordModal(false)}
          onSave={async (passwordData) => {
            try {
              await axios.post(`${API_URL}/users/me/change-password`, passwordData);
              addToast('Senha alterada com sucesso!', 'success');
              setShowChangePasswordModal(false);
            } catch (error: unknown) {
              const axiosError = error as AxiosError<BackendErrorResponse>;
              const errorMessage = axiosError.response?.data?.message || 'Erro ao alterar a senha.';
              addToast(errorMessage, 'error');
            }
          }}
        />
      )}

      {selectedMovementForConfirmation && (
        <ConfirmationModal
          movement={selectedMovementForConfirmation}
          onClose={() => setSelectedMovementForConfirmation(null)}
          onSuccess={() => {
            // Recarrega a lista de movimentações para refletir o status atualizado
            fetchMovements();
            triggerRefresh();
          }}
          API_URL={API_URL}
        />
      )}

      {importResult && (
        <ImportResultModal
          result={importResult}
          onClose={() => setImportResult(null)}
        />
      )}

      {assetToRetire && (
        <RetireAssetModal
          asset={assetToRetire}
          onClose={() => setAssetToRetire(null)}
          onSave={handleRetireAsset}
        />
      )}
      {assetToDispose && (
        <DisposeAssetModal
          asset={assetToDispose}
          onClose={() => setAssetToDispose(null)}
          onSave={handleDisposeAsset}
          API_URL={API_URL}
        />
      )}
      {substitutionToFinalize && (
        <FinalizeSubstitutionModal
          substitution={substitutionToFinalize}
          onClose={() => setSubstitutionToFinalize(null)}
          onSuccess={() => {
            triggerRefresh();
            // Se quiser atualizar a lista de pendências imediatamente, pode passar um trigger específico
          }}
          API_URL={API_URL}
        />
      )}
    </div>
  );

  async function handleImport(file: File | null, type: 'item-types' | 'units' | 'assets' | 'people') {
    alert(`Iniciando importação para o tipo: ${type}`);
    console.log(`[TESTE DEFINITIVO] A função handleImport foi chamada com o tipo:`, type);
    if (!file) {
      addToast('Por favor, selecione um arquivo para importar.', 'warning');
      return;
    }

    const formData = new FormData();
    formData.append('file', file);

    addToast(`Importando ${type}... Isso pode levar um momento.`, 'info');

    try {
      const response = await axios.post(`${API_URL}/${type}/import`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      // <<< MUDANÇA AQUI: Usa o estado para abrir o modal com os resultados >>>
      setImportResult(response.data);

      // Atualiza a lista correspondente na tela
      if (type === 'item-types') fetchItemTypes();
      if (type === 'units') fetchUnits();
      if (type === 'assets') fetchAssets();
      if (type === 'people') fetchPeople();

    } catch (error: unknown) {
      const axiosError = error as AxiosError<BackendErrorResponse>;
      const errorMessage = axiosError.response?.data?.message || axiosError.message;
      console.error(`Erro ao importar ${type}:`, axiosError.response?.data || axiosError);
      addToast(`Erro ao importar ${type}: ${errorMessage}`, 'error');
    }
  }

  async function handleDownloadReport(reportType: 'assets' | 'people' | 'units' | 'item-types' | 'overdue-loans' | 'audit-logs', format: string) {
    addToast(`Gerando relatório de ${reportType}...`, 'info');
    try {
      const response = await axios.get(`${API_URL}/reports/${reportType}/${format}`, {
        responseType: 'blob',
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `relatorio_${reportType}.${format}`);
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
      window.URL.revokeObjectURL(url);
      addToast(`Relatório de ${reportType} (${format.toUpperCase()}) gerado com sucesso!`, 'success');
    } catch (error: unknown) {
      const axiosError = error as AxiosError<BackendErrorResponse>;
      const errorMessage = axiosError.response?.data?.message || 'Erro ao gerar relatório.';
      console.error(`Erro ao baixar relatório ${reportType} ${format}:`, axiosError.response?.data || axiosError);
      addToast(`Erro: ${errorMessage}`, 'error');
    }
  }
};

// =====================================================================================
// VERSÃO FINAL E COMPLETA: Componente Modal de Movimentação
// =====================================================================================
interface MovementModalProps {
  onClose: () => void;
  onSave: (movementData: any) => Promise<{ success: boolean; movementId?: number; message: string }>;
  assets: Asset[];
  people: Person[];
  units: Unit[];
  handleGenerateMovementReceipt: (movementId: number) => Promise<void>;
}

// =====================================================================================
// NOVO: Componente Modal de Tipo de Item (FALTANDO)
// =====================================================================================

interface ItemTypeModalProps {
  onClose: () => void;
  onSave: (itemTypeData: { name: string; sku_code: string; description?: string }, id?: number) => Promise<void>; // <-- LINHA CORRIGIDA
  itemType: ItemType | null;
}

const ItemTypeModal = ({ onClose, onSave, itemType }: ItemTypeModalProps) => {
  const [name, setName] = useState<string>(itemType?.name || '');
  const [description, setDescription] = useState<string>(itemType?.description || '');
  const [skuCode, setSkuCode] = useState<string>(itemType?.sku_code || ''); // ✨ ADICIONADO
  const [loading, setLoading] = useState<boolean>(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    // ✨ ATENÇÃO: A FUNÇÃO onSave NO PAI PRECISA SER AJUSTADA PARA ACEITAR sku_code
    // IREMOS FAZER ISSO NA PRÓXIMA ETAPA, MAS O MODAL JÁ ESTÁ PRONTO
    await onSave({
      name,
      description: description || undefined,
      sku_code: skuCode, // ✨ ENVIANDO O NOVO DADO
    },
      itemType?.id
    );
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 bg-gray-900 bg-opacity-75 flex items-center justify-center z-[1001] p-4">
      <div className="bg-white p-8 rounded-xl shadow-2xl w-full max-w-lg relative">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-500 hover:text-gray-800">
          <X className="w-6 h-6" />
        </button>
        <h2 className="text-2xl font-bold text-blue-900 mb-6">
          {itemType ? 'Editar Tipo de Item' : 'Adicionar Novo Tipo de Item'}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">Nome do Tipo</label>
            <input
              type="text" id="name" value={name} onChange={(e) => setName(e.target.value)}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm" required
            />
          </div>

          {/* ✨ CAMPO ADICIONADO ✨ */}
          <div>
            <label htmlFor="skuCode" className="block text-sm font-medium text-gray-700 mb-1">Código SKU (Padrão de finido pela Gestão, 3 Letras)</label>
            <input
              type="text" id="skuCode" value={skuCode} onChange={(e) => setSkuCode(e.target.value.toUpperCase())}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm"
              required maxLength={3} minLength={3} placeholder="Ex: NTB, MNT"
            />
          </div>

          <div>
            <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">Descrição (Opcional)</label>
            <textarea
              id="description" value={description} onChange={(e) => setDescription(e.target.value)}
              rows={3} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm"
            ></textarea>
          </div>

          <div className="flex justify-end space-x-3 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg shadow-sm hover:bg-gray-300 transition-colors duration-200"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-blue-700 text-white rounded-lg shadow-sm hover:bg-blue-800 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const MovementModal = ({ onClose, onSave, assets: allAssets, people, units, handleGenerateMovementReceipt }: MovementModalProps) => {
  // --- ESTADOS DO FORMULÁRIO ---
  const [movementType, setMovementType] = useState<Movement['movement_type']>('loan');
  const [purpose, setPurpose] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [expectedReturnDate, setExpectedReturnDate] = useState<string>('');
  const [requestChannelType, setRequestChannelType] = useState<'Email' | 'SEI' | 'Ordem Direta' | ''>('');
  const [requestChannelDetails, setRequestChannelDetails] = useState<string>('');

  // Estado dos periféricos padrão (Checkboxes)
  const [checkedPeripherals, setCheckedPeripherals] = useState<{ [key: string]: boolean }>({});

  // >>> NOVO: Estado para periférico avulso (digitável) <<<
  const [otherPeripheral, setOtherPeripheral] = useState<string>('');

  const handlePeripheralChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, checked } = e.target;
    setCheckedPeripherals(prev => ({ ...prev, [name]: checked }));
  };

  // --- ESTADOS DE BUSCA E SELEÇÃO ---
  const [patrimonioSearchTerm, setPatrimonioSearchTerm] = useState<string>('');
  const [foundAsset, setFoundAsset] = useState<Asset | null>(null);
  const [selectedAssets, setSelectedAssets] = useState<Asset[]>([]);

  // Estado para dados técnicos (IMEI/Chip)
  const [assetUpdates, setAssetUpdates] = useState<Record<number, { imei: string, sim_card_number: string }>>({});

  const [solicitanteSearchTerm, setSolicitanteSearchTerm] = useState<string>('');
  const [filteredPeople, setFilteredPeople] = useState<Person[]>([]);
  const [selectedPerson, setSelectedPerson] = useState<Person | null>(null);
  const [unitSearchTerm, setUnitSearchTerm] = useState<string>('');
  const [filteredUnits, setFilteredUnits] = useState<Unit[]>([]);
  const [selectedUnit, setSelectedUnit] = useState<Unit | null>(null);

  // Monitor (Desktop)
  const [monitorSearchTerm, setMonitorSearchTerm] = useState('');
  const [monitorSearchLoading, setMonitorSearchLoading] = useState(false);

  // Busca por nome (ainda presente para legibilidade, embora o principal seja patrimônio)
  const [nameSearchTerm, setNameSearchTerm] = useState('');
  const [nameSearchResults, setNameSearchResults] = useState<Asset[]>([]);
  const [nameSearchLoading, setNameSearchLoading] = useState(false);

  const [loading, setLoading] = useState<boolean>(false);
  const [patrimonioLoading, setPatrimonioLoading] = useState<boolean>(false);
  const [lastMovementId, setLastMovementId] = useState<number | null>(null);
  const [isAwaitingConfirmation, setIsAwaitingConfirmation] = useState<boolean>(false);

  const { API_URL } = useContext(AuthContext) as AuthContextType;
  const { addToast } = useToast();

  // >>> NOVO ESTADO: Trava do Monitor <<<
  const [enforceMonitorLink, setEnforceMonitorLink] = useState<boolean>(true);

  // --- LÓGICA DE EXIBIÇÃO CONDICIONAL E MATEMÁTICA ---
  const showPeripheralsSection = selectedAssets.some(asset => {
    const type = asset.item_type_name ? asset.item_type_name.toLowerCase() : '';
    return type.includes('notebook') || type.includes('desktop') || type.includes('computador');
  });

  // >>> MATEMÁTICA DE PROPORÇÃO 1:1 <<<
  const desktopsCount = selectedAssets.filter(asset => {
    const type = asset.item_type_name ? asset.item_type_name.toLowerCase() : '';
    return type.includes('desktop') || type.includes('computador');
  }).length;

  const monitorsCount = selectedAssets.filter(asset => {
    const type = asset.item_type_name ? asset.item_type_name.toLowerCase() : '';
    return type.includes('monitor');
  }).length;

  const missingMonitorsCount = desktopsCount - monitorsCount;
  const needsMonitor = (missingMonitorsCount > 0) && enforceMonitorLink;

  const isTabletType = (typeName: string) => {
    const t = typeName.toLowerCase();
    return t.includes('tablet') || t.includes('ipad') || t.includes('galaxy') || t.includes('samsung tab');
  };

  // --- FUNÇÕES DE MANIPULAÇÃO ---
  const handleSelectPerson = (person: Person) => { setSelectedPerson(person); setSolicitanteSearchTerm(person.full_name); setFilteredPeople([]); };
  const handleSelectUnit = (unit: Unit) => { setSelectedUnit(unit); setUnitSearchTerm(unit.name); setFilteredUnits([]); };

  const handleAssetUpdateChange = (assetId: number, field: 'imei' | 'sim_card_number', value: string) => {
    setAssetUpdates(prev => ({
      ...prev,
      [assetId]: {
        ...prev[assetId],
        [field]: value
      }
    }));
  };

  // --- VALIDAÇÃO E CONFIRMAÇÃO ---
  const handleProceedToConfirmation = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedAssets.length === 0) { addToast('Adicione ao menos um ativo.', 'warning'); return; }
    if (!selectedPerson && (movementType === 'exit' || movementType === 'loan')) { addToast('Selecione um solicitante.', 'warning'); return; }
    if (!selectedUnit && (movementType === 'exit' || movementType === 'loan' || movementType === 'maintenance')) { addToast('Selecione o destino.', 'warning'); return; }

    // Validação Desktop (Proporção 1 para 1)
    if (desktopsCount > monitorsCount && enforceMonitorLink) {
      addToast(`Atenção: Faltam ${missingMonitorsCount} monitor(es) para os desktops selecionados.`, 'warning');
      return; // Impede de avançar
    }

    // Validação Tablet (Chip)
    const tabletsWithoutChip = selectedAssets.filter(asset => {
      if (!isTabletType(asset.item_type_name)) return false;
      const updates = assetUpdates[asset.id];
      return !updates?.sim_card_number || updates.sim_card_number.replace(/\D/g, '').length < 8;
    });

    if (tabletsWithoutChip.length > 0) {
      if (!window.confirm(`AVISO: Existem ${tabletsWithoutChip.length} Tablet(s) sem número de Chip informado.\n\nDeseja continuar sem vincular a linha?`)) {
        return;
      }
    }

    setIsAwaitingConfirmation(true);
    addToast('Confirme os dados antes de registrar.', 'info');
  };

  const handleEditAgain = () => { setIsAwaitingConfirmation(false); };

  // --- SALVAMENTO FINAL ---
  const handleConfirmAndSave = async () => {
    setLoading(true);

    // 1. Coleta os periféricos marcados nos checkboxes
    // O backend espera um array de strings ou objetos. Vamos mandar strings para os padrões.
    const peripheralsList: any[] = Object.keys(checkedPeripherals).filter(key => checkedPeripherals[key]);

    // 2. >>> ADICIONA O ITEM "OUTROS" SE HOUVER <<<
    if (otherPeripheral && otherPeripheral.trim() !== '') {
      // Adiciona como string simples. O Backend já trata: "const pType = p.peripheral_type || p;"
      peripheralsList.push(otherPeripheral.trim());
    }

    const movementData = {
      asset_ids: selectedAssets.map(asset => asset.id),
      movement_type: movementType,
      recipient_person_id: selectedPerson?.id,
      destination_unit_id: selectedUnit?.id,
      purpose: purpose || undefined,
      notes: notes || undefined,
      expected_return_date: movementType === 'loan' ? expectedReturnDate : undefined,
      request_channel_type: requestChannelType || undefined,
      request_channel_details: requestChannelDetails || undefined,
      peripherals: peripheralsList, // Envia a lista completa
      asset_updates: assetUpdates // Dados técnicos (IMEI/CHIP)
    };

    const result = await onSave(movementData);
    if (result.success && result.movementId) {
      setLastMovementId(result.movementId);
    }
    setIsAwaitingConfirmation(false);
    setLoading(false);
  };

  // --- FUNÇÕES DE BUSCA ---
  const handleSearchAssetByPatrimonio = async () => {
    if (!patrimonioSearchTerm) { addToast('Insira o patrimônio.', 'warning'); return; }
    setPatrimonioLoading(true);
    setFoundAsset(null);
    try {
      const response = await axios.post<Asset>(`${API_URL}/assets/validate-for-movement`, { patrimonio_number: patrimonioSearchTerm, movement_type: movementType });
      setFoundAsset(response.data);

      // PRE-CARREGA OS DADOS SE JÁ EXISTIREM NO ATIVO (Para Tablets)
      if (response.data) {
        const a = response.data;
        if (isTabletType(a.item_type_name)) {
          setAssetUpdates(prev => ({
            ...prev,
            // @ts-ignore
            [a.id]: { imei: a.imei || '', sim_card_number: a.sim_card_number || '' }
          }));
        }
      }
      addToast('Ativo verificado!', 'success');
    } catch (error: any) {
      addToast(error.response?.data?.message ?? 'Erro ao consultar.', 'error');
      setFoundAsset(null);
    } finally {
      setPatrimonioLoading(false);
    }
  };

  const handleSearchAssetByName = async () => {
    if (nameSearchTerm.length < 3) { addToast('Digite pelo menos 3 letras.', 'warning'); return; }
    setNameSearchLoading(true);
    try {
      const response = await axios.get<Asset[]>(`${API_URL}/assets/search-available?query=${nameSearchTerm}`);
      setNameSearchResults(response.data);
      if (response.data.length === 0) { addToast('Nenhum item encontrado.', 'info'); }
    } catch (error) { console.error(error); addToast('Erro na busca.', 'error'); } finally { setNameSearchLoading(false); }
  };

  const handleAddAssetToMovement = (assetToAdd: Asset | null) => {
    const asset = assetToAdd || foundAsset;
    if (asset) {
      if (selectedAssets.some(a => a.id === asset.id)) { addToast('Já adicionado.', 'warning'); return; }
      setSelectedAssets(prev => [...prev, asset]);

      // Se for Tablet, inicializa o estado com os dados que já existem no banco
      if (isTabletType(asset.item_type_name)) {
        setAssetUpdates(prev => ({
          ...prev,
          [asset.id]: {
            // @ts-ignore
            imei: asset.imei || '',
            // @ts-ignore
            sim_card_number: asset.sim_card_number || ''
          }
        }));
      }
      if (!assetToAdd) { setPatrimonioSearchTerm(''); setFoundAsset(null); }
    } else { addToast('Consulte um ativo primeiro.', 'warning'); }
  };

  const handleLinkMonitor = async () => {
    if (!monitorSearchTerm) { addToast('Digite o patrimônio do monitor.', 'warning'); return; }
    setMonitorSearchLoading(true);
    try {
      const response = await axios.post<Asset>(`${API_URL}/assets/validate-for-movement`, { patrimonio_number: monitorSearchTerm, movement_type: 'loan' });
      const foundMonitor = response.data;
      if (!foundMonitor.item_type_name.toLowerCase().includes('monitor')) { addToast('Não é um monitor.', 'error'); return; }
      handleAddAssetToMovement(foundMonitor);
      addToast(`Monitor vinculado!`, 'success');
      setMonitorSearchTerm('');
    } catch (error: any) { addToast(error.response?.data?.message ?? 'Erro ao consultar monitor.', 'error'); } finally { setMonitorSearchLoading(false); }
  };

  const handleRemoveAssetFromMovement = (assetId: number) => {
    setSelectedAssets((prevAssets) => prevAssets.filter((asset) => asset.id !== assetId));
    setAssetUpdates(prev => {
      const newState = { ...prev };
      delete newState[assetId];
      return newState;
    });
  };

  // Efeitos de filtro para autocomplete
  useEffect(() => { if (solicitanteSearchTerm.length > 2) { setFilteredPeople(people.filter(p => p.full_name.toLowerCase().includes(solicitanteSearchTerm.toLowerCase()) || p.cpf.includes(solicitanteSearchTerm) || (p.registration_number && p.registration_number.includes(solicitanteSearchTerm)))); } else { setFilteredPeople([]); } }, [solicitanteSearchTerm, people]);
  useEffect(() => { if (unitSearchTerm.length > 2) { setFilteredUnits(units.filter(unit => unit.name.toLowerCase().includes(unitSearchTerm.toLowerCase()) || (unit.code && unit.code.toLowerCase().includes(unitSearchTerm.toLowerCase())) || unit.type.toLowerCase().includes(unitSearchTerm.toLowerCase()))); } else { setFilteredUnits([]); } }, [unitSearchTerm, units]);

  return (
    <div className="fixed inset-0 bg-gray-900 bg-opacity-75 flex items-center justify-center z-[1001] p-4">
      <div className="bg-white p-8 rounded-xl shadow-2xl w-full max-w-5xl relative overflow-y-auto max-h-[90vh]">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-500 hover:text-gray-800"><X className="w-6 h-6" /></button>
        <h2 className="text-2xl font-bold text-blue-900 mb-6">Registrar Nova Movimentação</h2>

        <form onSubmit={handleProceedToConfirmation} className="space-y-6">
          <fieldset disabled={isAwaitingConfirmation || !!lastMovementId} className="space-y-6">

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="movementType" className="block text-sm font-medium text-gray-700 mb-1">Tipo de Movimentação</label>
                <select id="movementType" value={movementType} onChange={(e) => setMovementType(e.target.value as Movement['movement_type'])} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm disabled:bg-gray-100" required>
                  <option value="loan">Empréstimo</option>
                  <option value="exit">Saída</option>
                  <option value="maintenance">Manutenção</option>
                </select>
              </div>
            </div>

            {/* DADOS SOLICITANTE */}
            <div className="border border-gray-200 p-4 rounded-lg space-y-4">
              <h3 className="text-lg font-semibold text-gray-800">Dados do Solicitante</h3>
              <div className="relative">
                <div className="flex">
                  <input type="text" value={solicitanteSearchTerm} onChange={(e) => { setSolicitanteSearchTerm(e.target.value); setSelectedPerson(null); }} className="flex-1 px-3 py-2 border border-gray-300 rounded-l-md shadow-sm disabled:bg-gray-100" placeholder="Buscar Nome, CPF ou Matrícula..." />
                  <button type="button" className="px-4 py-2 bg-blue-600 text-white rounded-r-md shadow-sm"> <Search className="w-5 h-5" /> </button>
                </div>

                {/* Lista de Resultados */}
                {filteredPeople.length > 0 && (
                  <ul className="absolute z-10 w-full bg-white border border-gray-300 rounded-md mt-1 max-h-40 overflow-y-auto shadow-lg">
                    {filteredPeople.map((person) => (<li key={person.id} onClick={() => handleSelectPerson(person)} className="px-3 py-2 cursor-pointer hover:bg-blue-50">{person.full_name}</li>))}
                  </ul>
                )}

                {/* >>> MENSAGEM DE ALERTA (SOLICITANTE NÃO ENCONTRADO) <<< */}
                {filteredPeople.length === 0 && solicitanteSearchTerm.length > 3 && !selectedPerson && (
                  <div className="absolute z-10 w-full bg-yellow-50 border border-yellow-200 rounded-md mt-1 p-3 shadow-lg">
                    <div className="flex items-start">
                      <AlertTriangleIcon className="w-5 h-5 text-yellow-600 mr-2 flex-shrink-0" />
                      <div>
                        <p className="text-sm font-bold text-yellow-800">Solicitante não encontrado.</p>
                        <p className="text-xs text-yellow-700 mt-1">
                          Não é possível prosseguir sem o cadastro. Por favor, feche esta janela e cadastre a pessoa no menu <strong>Cadastros &gt; Pessoas</strong>.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
              {selectedPerson && <div className="text-sm text-green-700 font-medium bg-green-50 p-2 rounded border border-green-200">Selecionado: {selectedPerson.full_name} ({selectedPerson.cpf})</div>}
            </div>

            {/* CARD DE ATIVOS (ATUALIZADO COM BUSCA POR NOME) */}
            <div className="border border-gray-200 p-4 rounded-lg space-y-4">
              <h3 className="text-lg font-semibold text-gray-800">Ativos</h3>

              {/* Abas de Tipo de Busca */}
              <div className="flex gap-4 text-sm border-b border-gray-200 pb-2 mb-2">
                <label className="flex items-center cursor-pointer font-medium text-gray-700">
                  <input type="radio" name="searchType" className="mr-2" defaultChecked
                    onClick={() => { setNameSearchResults([]); setFoundAsset(null); }} />
                  Por Patrimônio ou Nº Série
                </label>
                <label className="flex items-center cursor-pointer font-medium text-gray-700">
                  <input type="radio" name="searchType" className="mr-2" id="toggleNameSearch" />
                  Por Nome/Modelo (Itens sem Etiqueta)
                </label>
              </div>

              {/* Input 1: Busca por Patrimônio / Série (Padrão) */}
              <div className="flex gap-2" id="searchByPatrimonioBlock">
                <input
                  type="text"
                  placeholder="Bipe ou digite o Patrimônio ou Nº de Série..."
                  value={patrimonioSearchTerm}
                  onChange={(e) => setPatrimonioSearchTerm(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleSearchAssetByPatrimonio())}
                  className="flex-1 p-2 border rounded-md focus:ring-2 focus:ring-blue-500 outline-none"
                />
                <button type="button" onClick={handleSearchAssetByPatrimonio} className="bg-blue-600 text-white px-5 font-bold rounded-md hover:bg-blue-700 shadow-sm">Buscar</button>
                <button type="button" onClick={() => handleAddAssetToMovement(null)} disabled={!foundAsset} className="bg-green-600 text-white px-5 font-bold rounded-md disabled:opacity-50 hover:bg-green-700 shadow-sm">Incluir</button>
              </div>

              {/* Feedback da busca por Patrimônio */}
              {foundAsset && <div className="text-sm text-green-700 bg-green-50 p-2 rounded border border-green-200 mt-2">Encontrado: <b>{foundAsset.item_type_name} {foundAsset.brand} {foundAsset.model}</b> <br /> SKU: {foundAsset.sku}</div>}

              {/* Input 2: Busca por Nome (Para itens sem etiqueta) - Exibido via CSS simples ou condicional */}
              <div className="mt-2 hidden" ref={el => {
                // Hack simples para alternar visibilidade sem criar state novo (já que queremos intervenção cirúrgica)
                const radioName = document.getElementById('toggleNameSearch') as HTMLInputElement;
                if (radioName && el) {
                  radioName.addEventListener('change', () => {
                    if (radioName.checked) {
                      el.style.display = 'block';
                      document.getElementById('searchByPatrimonioBlock')!.style.display = 'none';
                    }
                  });
                  const radioPat = document.getElementsByName('searchType')[0] as HTMLInputElement;
                  radioPat.addEventListener('change', () => {
                    if (radioPat.checked) {
                      el.style.display = 'none';
                      document.getElementById('searchByPatrimonioBlock')!.style.display = 'flex';
                    }
                  });
                }
              }}>
                <div className="flex gap-2">
                  <input type="text" placeholder="Ex: Webcam, Pedestal, Mouse..." value={nameSearchTerm} onChange={(e) => setNameSearchTerm(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleSearchAssetByName())} className="flex-1 p-2 border rounded" />
                  <button type="button" onClick={handleSearchAssetByName} disabled={nameSearchLoading} className="bg-blue-600 text-white px-4 rounded hover:bg-blue-700">{nameSearchLoading ? '...' : 'Listar'}</button>
                </div>

                {/* Lista de Resultados da Busca por Nome */}
                {nameSearchResults.length > 0 && (
                  <div className="mt-2 max-h-40 overflow-y-auto border border-gray-200 rounded-md bg-white shadow-inner">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-gray-100 font-bold sticky top-0">
                        <tr><th className="p-2">Item</th><th className="p-2">Marca/Modelo</th><th className="p-2">SKU</th><th className="p-2">Ação</th></tr>
                      </thead>
                      <tbody>
                        {nameSearchResults.map(asset => (
                          <tr key={asset.id} className="border-t hover:bg-blue-50">
                            <td className="p-2">{asset.item_type_name}</td>
                            <td className="p-2">{asset.brand} {asset.model}</td>
                            <td className="p-2">{asset.sku}</td>
                            <td className="p-2">
                              <button type="button" onClick={() => { handleAddAssetToMovement(asset); setNameSearchResults([]); setNameSearchTerm(''); }} className="text-green-700 font-bold hover:underline">
                                Selecionar
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Tabela de Itens Selecionados (MANTIDA IGUAL AO ORIGINAL) */}
              {/* Tabela de Itens Selecionados COM CONTADOR */}
              <div className="flex justify-between items-end mt-6 mb-2 px-1">
                <h4 className="font-bold text-gray-800 flex items-center text-sm uppercase tracking-wide">
                  <HardDrive className="w-4 h-4 mr-2 text-blue-600" />
                  Equipamentos na Lista
                </h4>
                <div className="bg-blue-100 text-blue-800 px-4 py-1.5 rounded-full text-xs font-extrabold shadow-sm border border-blue-200 flex items-center">
                  TOTAL: <span className="text-lg ml-2">{selectedAssets.length}</span>
                </div>
              </div>

              <div className="overflow-x-auto border rounded-lg bg-gray-50">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Tipo/Modelo</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Patrimônio / SKU</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-blue-700 uppercase">IMEI (Tablet)</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-blue-700 uppercase">Nº Chip (Tablet)</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {selectedAssets.length > 0 ? (selectedAssets.map((asset) => {
                      const isTablet = isTabletType(asset.item_type_name);
                      const data = assetUpdates[asset.id] || { imei: '', sim_card_number: '' };
                      return (
                        <tr key={asset.id} className={isTablet ? "bg-blue-50" : ""}>
                          <td className="px-4 py-2 text-sm">
                            <div className="font-bold">{asset.item_type_name}</div>
                            <div className="text-xs text-gray-500">{asset.brand} {asset.model}</div>
                          </td>
                          {/* AQUI: Se não tiver Patrimônio, mostra o SKU ou Serial */}
                          <td className="px-4 py-2 text-sm font-mono text-gray-600">
                            {asset.patrimonio_number || asset.sku || 'S/N'}
                          </td>
                          {/* ... (Resto das colunas IMEI/CHIP mantidas) ... */}
                          <td className="px-4 py-2 text-sm">
                            {isTablet ? (
                              <input type="text" className="w-full p-1 border rounded text-xs border-blue-300" placeholder="IMEI..." value={data.imei} onChange={(e) => handleAssetUpdateChange(asset.id, 'imei', e.target.value)} />
                            ) : <span className="text-gray-300">-</span>}
                          </td>
                          <td className="px-4 py-2 text-sm">
                            {isTablet ? (
                              <InputMask mask="(99) 99999-9999" value={data.sim_card_number} onChange={(e) => handleAssetUpdateChange(asset.id, 'sim_card_number', e.target.value)}>{(inputProps: any) => (<input {...inputProps} type="text" className="w-full p-1 border rounded text-xs border-blue-300" placeholder="Chip..." />)}</InputMask>
                            ) : <span className="text-gray-300">-</span>}
                          </td>
                          <td className="px-4 py-2 text-sm">
                            <button type="button" onClick={() => handleRemoveAssetFromMovement(asset.id)} className="text-red-600 hover:text-red-800"><Trash2 className="w-4 h-4" /></button>
                          </td>
                        </tr>
                      );
                    })) : (<tr><td colSpan={5} className="px-4 py-4 text-center text-sm text-gray-500">Nenhum ativo selecionado.</td></tr>)}
                  </tbody>
                </table>
              </div>
            </div>

            {/* LÓGICA DE MONITORES COM PROPORÇÃO 1:1 E CHECKBOX */}
            {desktopsCount > 0 && (
              <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg animate-fadeIn mb-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between mb-3 border-b border-yellow-200 pb-2 gap-2">
                  <h4 className="font-bold text-yellow-800 flex items-center">
                    <AlertTriangleIcon className="w-4 h-4 mr-2" />
                    Vinculação de Monitores ({monitorsCount}/{desktopsCount})
                  </h4>
                  <label className="flex items-center space-x-2 cursor-pointer text-sm text-yellow-800 font-medium bg-yellow-100 p-2 rounded hover:bg-yellow-200 transition-colors">
                    <input
                      type="checkbox"
                      checked={enforceMonitorLink}
                      onChange={(e) => setEnforceMonitorLink(e.target.checked)}
                      className="rounded text-yellow-600 focus:ring-yellow-500 w-4 h-4 cursor-pointer"
                    />
                    <span>Exigir monitor para cada desktop</span>
                  </label>
                </div>

                {needsMonitor ? (
                  <>
                    <p className="text-xs text-yellow-700 mb-2 font-bold animate-pulse">
                      Faltam {missingMonitorsCount} monitor(es) para fechar os conjuntos.
                    </p>
                    <div className="flex gap-2">
                      <input type="text" value={monitorSearchTerm} onChange={e => setMonitorSearchTerm(e.target.value)} onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleLinkMonitor())} placeholder="Bipe ou digite o patrimônio do Monitor..." className="flex-grow px-3 py-2 border border-yellow-300 rounded-md text-sm focus:ring-2 focus:ring-yellow-500 outline-none" />
                      <button type="button" onClick={handleLinkMonitor} disabled={monitorSearchLoading} className="bg-yellow-600 text-white px-4 py-2 rounded-md text-sm font-bold hover:bg-yellow-700 disabled:opacity-50 transition-colors">
                        {monitorSearchLoading ? '...' : 'Vincular Monitor'}
                      </button>
                    </div>
                  </>
                ) : (
                  <p className="text-xs text-green-700 font-bold flex items-center mt-2 bg-green-50 p-2 rounded border border-green-200">
                    <CheckCircle className="w-4 h-4 mr-2" />
                    {enforceMonitorLink ? 'Todos os desktops possuem monitores vinculados!' : 'Vinculação obrigatória desativada pelo operador.'}
                  </p>
                )}
              </div>
            )}

            {/* 6. ACESSÓRIOS (Checkboxes + Campo Outros) */}
            {showPeripheralsSection && (
              <div className="border border-gray-200 p-4 rounded-lg bg-blue-50 animate-fadeIn">
                <h3 className="text-lg font-semibold text-gray-800 mb-2">Acessórios do Kit</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-3">
                  <label className="flex items-center space-x-2 cursor-pointer p-2 rounded-md hover:bg-white transition-colors"> <input type="checkbox" name="Mouse" checked={!!checkedPeripherals['Mouse']} onChange={handlePeripheralChange} className="h-4 w-4 text-blue-600 rounded" /> <span className="text-sm">Mouse</span> </label>
                  <label className="flex items-center space-x-2 cursor-pointer p-2 rounded-md hover:bg-white transition-colors"> <input type="checkbox" name="Teclado" checked={!!checkedPeripherals['Teclado']} onChange={handlePeripheralChange} className="h-4 w-4 text-blue-600 rounded" /> <span className="text-sm">Teclado</span> </label>
                  <label className="flex items-center space-x-2 cursor-pointer p-2 rounded-md hover:bg-white transition-colors"> <input type="checkbox" name="Fonte de Alimentação" checked={!!checkedPeripherals['Fonte de Alimentação']} onChange={handlePeripheralChange} className="h-4 w-4 text-blue-600 rounded" /> <span className="text-sm">Fonte</span> </label>
                  <label className="flex items-center space-x-2 cursor-pointer p-2 rounded-md hover:bg-white transition-colors"> <input type="checkbox" name="Cabo de Força" checked={!!checkedPeripherals['Cabo de Força']} onChange={handlePeripheralChange} className="h-4 w-4 text-blue-600 rounded" /> <span className="text-sm">Cabo de Força</span> </label>
                </div>
                {/* >>> CAMPO DE OUTROS PERIFÉRICOS ADICIONADO AQUI <<< */}
                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1">Outros Periféricos / Observações de Acessórios</label>
                  <input
                    type="text"
                    value={otherPeripheral}
                    onChange={(e) => setOtherPeripheral(e.target.value)}
                    placeholder="Ex: Webcam, Adaptador Wifi, Headset..."
                    className="w-full p-2 border rounded-md text-sm bg-white focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>
            )}

            {/* 7. CAMPOS FINAIS */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
              <div className="space-y-1">
                <label className="block text-sm font-medium text-gray-700">Unidade de Destino</label>
                <div className="relative">
                  <div className="flex">
                    <input type="text" value={unitSearchTerm} onChange={(e) => { setUnitSearchTerm(e.target.value); setSelectedUnit(null) }} className="flex-1 px-3 py-2 border border-gray-300 rounded-l-md shadow-sm disabled:bg-gray-100" placeholder="Buscar por Nome, Código..." autoComplete="off" />
                    <button type="button" className="px-4 py-2 bg-blue-600 text-white rounded-r-md shadow-sm hover:bg-blue-700 disabled:bg-gray-400"><Search className="w-5 h-5" /></button>
                  </div>

                  {filteredUnits.length > 0 && (<ul className="absolute z-10 w-full bg-white border border-gray-300 rounded-md mt-1 max-h-40 overflow-y-auto shadow-lg"> {filteredUnits.map((unit: Unit) => (<li key={unit.id} onClick={() => handleSelectUnit(unit)} className="px-3 py-2 cursor-pointer hover:bg-blue-50"> {unit.name} ({unit.type}) </li>))} </ul>)}

                  {/* >>> MENSAGEM DE ALERTA (UNIDADE NÃO ENCONTRADA) <<< */}
                  {filteredUnits.length === 0 && unitSearchTerm.length > 3 && !selectedUnit && (
                    <div className="absolute z-10 w-full bg-yellow-50 border border-yellow-200 rounded-md mt-1 p-3 shadow-lg">
                      <div className="flex items-start">
                        <AlertTriangleIcon className="w-5 h-5 text-yellow-600 mr-2 flex-shrink-0" />
                        <div>
                          <p className="text-sm font-bold text-yellow-800">Unidade não encontrada.</p>
                          <p className="text-xs text-yellow-700 mt-1">
                            Cadastre a nova unidade em <strong>Cadastros &gt; Unidades</strong> ou verifique a ortografia.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                {selectedUnit && <div className="mt-2 p-2 bg-gray-100 border rounded-md text-sm"> <p><b>Unidade Selecionada:</b> {selectedUnit.name}</p> </div>}
              </div>

              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label htmlFor="requestChannelType" className="block text-sm font-medium text-gray-700">Canal de Solicitação</label>
                  <select id="requestChannelType" value={requestChannelType} onChange={(e) => { setRequestChannelType(e.target.value as any); setRequestChannelDetails(''); }} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm disabled:bg-gray-100">
                    <option value="">Selecione...</option> <option value="Email">E-mail</option> <option value="SEI">SEI</option> <option value="Ordem Direta">Ordem Direta</option>
                  </select>
                  {requestChannelType === 'SEI' ? (<InputMask mask="99.999999/9999-99" value={requestChannelDetails} onChange={(e) => setRequestChannelDetails(e.target.value)}>{(inputProps: any) => <input {...inputProps} type="text" placeholder="Número do SEI" className="mt-2 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm disabled:bg-gray-100" required />}</InputMask>) : requestChannelType === 'Ordem Direta' && (<input type="text" placeholder="Nome e Cargo" value={requestChannelDetails} onChange={(e) => setRequestChannelDetails(e.target.value)} className="mt-2 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm disabled:bg-gray-100" required />)}
                </div>
                <div>
                  <label htmlFor="expectedReturnDate" className="block text-sm font-medium text-gray-700">Data Prevista Para Devolução</label>
                  <input type="date" id="expectedReturnDate" value={expectedReturnDate} onChange={(e) => setExpectedReturnDate(e.target.value)} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm disabled:bg-gray-100" disabled={movementType !== 'loan'} required={movementType === 'loan'} />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div><label htmlFor="purpose" className="block text-sm font-medium text-gray-700 mb-1">Finalidade</label><textarea id="purpose" value={purpose} onChange={(e) => setPurpose(e.target.value)} rows={3} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm disabled:bg-gray-100"></textarea></div>
              <div><label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-1">Observação</label><textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm disabled:bg-gray-100"></textarea></div>
            </div>

          </fieldset>

          <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
            {!isAwaitingConfirmation && !lastMovementId && (<> <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg shadow-sm hover:bg-gray-300">Cancelar</button> <button type="submit" className="px-4 py-2 bg-blue-700 text-white rounded-lg shadow-sm hover:bg-blue-800 font-bold"> Revisar para Registrar </button> </>)}
            {isAwaitingConfirmation && !lastMovementId && (<> <button type="button" onClick={handleEditAgain} disabled={loading} className="px-6 py-2 bg-yellow-500 text-white rounded-lg shadow-sm hover:bg-yellow-600 disabled:opacity-50"> <Edit className="w-5 h-5 mr-2 inline-block" /> Editar </button> <button type="button" onClick={handleConfirmAndSave} disabled={loading} className="px-6 py-2 bg-green-600 text-white rounded-lg shadow-sm hover:bg-green-700 disabled:opacity-50 font-bold"> {loading ? 'Registrando...' : <><CheckCircle className="w-5 h-5 mr-2 inline-block" /> Confirmar e Registrar</>} </button> </>)}
            {lastMovementId && (<> <button type="button" onClick={onClose} className="px-6 py-2 bg-gray-200 text-gray-800 rounded-lg shadow-sm hover:bg-gray-300">Fechar</button> <button type="button" onClick={() => handleGenerateMovementReceipt(lastMovementId)} className="px-6 py-2 bg-purple-600 text-white rounded-lg shadow-sm hover:bg-purple-700 flex items-center"> <FileText className="w-5 h-5 mr-2" /> Gerar Recibo </button> </>)}
          </div>
        </form>
      </div>
    </div>
  );
};

// =====================================================================================
// Componente Modal de Ativo (Mantido)
// =====================================================================================

interface AssetModalProps {
  onClose: () => void;
  onSave: (assetData: Omit<Asset, 'id' | 'sku' | 'item_type_name' | 'current_unit_name' | 'created_at' | 'updated_at'>, id?: number) => Promise<void>;
  asset: Asset | null; // Se for null, é adição; se for Asset, é edição
  itemTypes: ItemType[]; // Lista de tipos de itens para o dropdown
  units: Unit[]; // Lista de unidades para o dropdown
  translateStatus: (status: string) => string;
  userRole?: string;
}

const AssetModal = ({ onClose, onSave, asset, itemTypes, units, translateStatus, userRole }: AssetModalProps) => {
  const { API_URL } = useContext(AuthContext) as AuthContextType;
  const [itemTypeId, setItemTypeId] = useState<string>(asset?.item_type_id?.toString() || '');
  const [brand, setBrand] = useState<string>(asset?.brand || '');
  const [model, setModel] = useState<string>(asset?.model || '');
  const [brandId, setBrandId] = useState<string>('');
  const [brands, setBrands] = useState<{label: string, value: string}[]>([]);
  const [models, setModels] = useState<{label: string, value: string}[]>([]);

  // Carrega as marcas disponíveis baseadas no Tipo de Item (Objetivo 2)
  useEffect(() => {
    if (!itemTypeId) {
      setBrands([]);
      return;
    }
    axios.get(`${API_URL}/catalog/brands?item_type_id=${itemTypeId}`, { 
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
    })
    .then(res => setBrands(res.data.map((b: any) => ({ label: b.name, value: b.id.toString() }))));
  }, [itemTypeId, API_URL]);

  // Se for edição de ativo existente, localiza o ID da marca correspondente ao texto
  useEffect(() => {
    if (asset && brands.length > 0) {
      const found = brands.find(b => b.label === asset.brand);
      if (found) setBrandId(found.value);
    }
  }, [asset, brands]);

  // Carrega os modelos condicionados à Marca e ao Tipo de Item (Objetivo 3)
  useEffect(() => {
    if (brandId && itemTypeId) {
      axios.get(`${API_URL}/catalog/models?brand_id=${brandId}&item_type_id=${itemTypeId}`, { 
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      })
      .then(res => setModels(res.data.map((m: any) => ({ label: m.name, value: m.id.toString() }))));
    } else {
      setModels([]);
    }
  }, [brandId, itemTypeId, API_URL]);

  const handleCreateBrand = async (inputValue: string) => {
    try {
      const { data } = await axios.post(`${API_URL}/catalog/brands`, { name: inputValue }, { 
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      const newOption = { label: data.name, value: data.id.toString() };
      setBrands(prev => [...prev, newOption]);
      setBrand(data.name);
      setBrandId(data.id.toString());
      setModel('');
    } catch (e) {
      console.error("Erro ao criar marca:", e);
    }
  };

  const handleCreateModel = async (inputValue: string) => {
    if (!brandId || !itemTypeId) return;
    try {
      const { data } = await axios.post(`${API_URL}/catalog/models`, { 
        name: inputValue, 
        brand_id: brandId,
        item_type_id: itemTypeId
      }, { 
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      const newOption = { label: data.name, value: data.id.toString() };
      setModels(prev => [...prev, newOption]);
      setModel(data.name);
    } catch (e) {
      console.error("Erro ao criar modelo:", e);
    }
  };
  const [description, setDescription] = useState<string>(asset?.description || '');
  const [serialNumber, setSerialNumber] = useState<string>(asset?.serial_number || '');
  const [patrimonioNumber, setPatrimonioNumber] = useState<string>(asset?.patrimonio_number || '');
  const [unitOfMeasure, setUnitOfMeasure] = useState<string>(asset?.unit_of_measure || '');
  const [status, setStatus] = useState<string>(asset?.status || 'available');
  const [currentUnitId, setCurrentUnitId] = useState<string>(asset?.current_unit_id?.toString() || '');
  const [acquisitionDate, setAcquisitionDate] = useState<string>(asset?.acquisition_date || new Date().toISOString().split('T')[0]);
  const [warrantyEndDate, setWarrantyEndDate] = useState<string>(asset?.warranty_end_date || '');
  const [notes, setNotes] = useState<string>(asset?.notes || '');
  // >>> NOVOS ESTADOS PARA DADOS COMPLEMENTARES <<<
  const [imei, setImei] = useState<string>(asset?.imei || '');
  const [simCardNumber, setSimCardNumber] = useState<string>(asset?.sim_card_number || '');
  const [boxNumber, setBoxNumber] = useState<string>(asset?.box_number || '');
  const [hasLivox, setHasLivox] = useState<boolean>(asset?.has_livox || false);
  // Reserva Técnica = Automação Desligada (Inverso)
  const [isReserve, setIsReserve] = useState<boolean>(asset ? !asset.allow_automation : false);

  // Lógica para saber se o item selecionado é um Tablet e mostrar o bloco extra
  const selectedItemType = itemTypes.find(t => t.id.toString() === itemTypeId);
  const isTabletType = selectedItemType && (selectedItemType.name.toLowerCase().includes('tablet') || selectedItemType.name.toLowerCase().includes('tab'));
  const [loading, setLoading] = useState<boolean>(false);

  const unitsForDropdown = useMemo(() => {
    const list = asset ? units : units.filter(unit => unit.name.toLowerCase().includes('almoxarifado'));
    // Formata para o react-select
    return list.map(unit => ({ value: unit.id.toString(), label: unit.name }));
  }, [units, asset]);

  const statusesForDropdown = useMemo(() => {
    const freeStatuses = ['available', 'maintenance'];

    // 1. Novo Cadastro: Pode criar como Disponível ou Manutenção
    if (!asset) return freeStatuses;

    // 2. Se for Admin, tem poder total (útil para correções de erro no banco)
    if (userRole === 'admin') {
      return ['available', 'in_use', 'loaned', 'maintenance', 'pending_retirement', 'retired', 'disposed'];
    }

    // 3. Se o status atual permite troca livre (está na oficina ou no estoque),
    // o usuário pode alternar entre eles.
    if (freeStatuses.includes(asset.status)) {
      return freeStatuses;
    }

    // 4. BLOQUEIO TOTAL: Se o status é restrito (Em Uso, Emprestado, Baixado),
    // a lista retorna APENAS o status atual.
    // Isso impede que "Available" apareça como opção.
    return [asset.status];

  }, [asset, userRole]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const assetData = {
      item_type_id: parseInt(itemTypeId),
      brand, model, description: description || undefined,
      serial_number: serialNumber || undefined,
      patrimonio_number: patrimonioNumber || undefined,
      unit_of_measure: unitOfMeasure || undefined,
      status,
      current_unit_id: currentUnitId ? parseInt(currentUnitId) : undefined,
      acquisition_date: acquisitionDate || undefined,
      warranty_end_date: warrantyEndDate || undefined,
      notes: notes || undefined,
      // >>> NOVOS CAMPOS ENVIADOS <<<
      imei: imei || undefined,
      sim_card_number: simCardNumber || undefined,
      box_number: boxNumber || undefined,
      has_livox: hasLivox,
      allow_automation: !isReserve // Inverte a lógica: Se é reserva, não tem automação.
    };
    await onSave(assetData, asset?.id);
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 bg-gray-900 bg-opacity-75 flex items-center justify-center z-[1001] p-4">
      <div className="bg-white p-8 rounded-xl shadow-2xl w-full max-w-2xl relative">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-500 hover:text-gray-800">
          <X className="w-6 h-6" />
        </button>
        <h2 className="text-2xl font-bold text-blue-900 mb-6">
          {asset ? 'Editar Ativo' : 'Adicionar Novo Ativo'}
        </h2>
        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[70vh] overflow-y-auto pr-2">
          <div>
            <label htmlFor="itemTypeId" className="block text-sm font-medium text-gray-700 mb-1">Tipo de Item</label>
            <select
              id="itemTypeId"
              value={itemTypeId}
              onChange={(e) => { 
                setItemTypeId(e.target.value); 
                setBrand(''); 
                setBrandId(''); 
                setModel(''); 
              }}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              required
            >
              <option value="">Selecione um tipo de item</option>
              {itemTypes.map((type) => (
                <option key={type.id} value={type.id}>
                  {type.name}
                </option>
              ))}
            </select>
          </div>
          {/* Campo Marca Blindado */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Marca *</label>
            <CreatableSelect
              isClearable
              isDisabled={!itemTypeId}
              options={brands}
              value={brand ? { label: brand, value: brandId } : null}
              onChange={(val: any) => { 
                setBrand(val ? val.label : ''); 
                setBrandId(val ? val.value : ''); 
                setModel(''); 
              }}
              onCreateOption={handleCreateBrand}
              placeholder={itemTypeId ? "Selecione ou digite..." : "Selecione o tipo de item primeiro"}
              formatCreateLabel={(inputValue) => `Criar marca "${inputValue.toUpperCase()}"`}
              styles={{ menu: (base) => ({ ...base, zIndex: 9999 }) }}
            />
          </div>

          {/* Campo Modelo Blindado */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Modelo *</label>
            <CreatableSelect
              isClearable
              isDisabled={!brandId}
              options={models}
              value={model ? { label: model, value: model } : null}
              onChange={(val: any) => setModel(val ? val.label : '')}
              onCreateOption={handleCreateModel}
              placeholder={brandId ? "Selecione ou digite..." : "Selecione uma marca primeiro"}
              formatCreateLabel={(inputValue) => `Criar modelo "${inputValue.toUpperCase()}"`}
              styles={{ menu: (base) => ({ ...base, zIndex: 9999 }) }}
            />
          </div>
          <div>
            <label htmlFor="status" className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select
              id="status"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm"
              required
              // Desabilita o campo se for um novo cadastro, pois só há uma opção
              disabled={!asset}
            >
              {/* O dropdown agora usa a lista filtrada 'statusesForDropdown' */}
              {statusesForDropdown.map((s) => (
                <option key={s} value={s}>
                  {translateStatus(s)}
                </option>
              ))}
            </select>
          </div>
          <div className="md:col-span-2">
            <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">Descrição</label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            ></textarea>
          </div>
          <div>
            <label htmlFor="serialNumber" className="block text-sm font-medium text-gray-700 mb-1">Número de Série</label>
            <input
              type="text"
              id="serialNumber"
              value={serialNumber}
              onChange={(e) => setSerialNumber(e.target.value)}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            />
          </div>
          <div>
            <label htmlFor="patrimonioNumber" className="block text-sm font-medium text-gray-700 mb-1">Número de Patrimônio</label>
            <input
              type="text"
              id="patrimonioNumber"
              value={patrimonioNumber}
              onChange={(e) => setPatrimonioNumber(e.target.value)}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            />
          </div>
          <div>
            <label htmlFor="unitOfMeasure" className="block text-sm font-medium text-gray-700 mb-1">Unidade de Medida</label>
            <input
              type="text"
              id="unitOfMeasure"
              value={unitOfMeasure}
              onChange={(e) => setUnitOfMeasure(e.target.value)}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            />
          </div>
          <div>
            <label htmlFor="currentUnitId" className="block text-sm font-medium text-gray-700 mb-1">
              {asset ? 'Unidade Atual (Opcional)' : 'Unidade de Entrada *'}
            </label>
            {/* <<< O <select> HTML FOI SUBSTITUÍDO PELO <Select> INTELIGENTE >>> */}
            <Select
              id="currentUnitId"
              options={unitsForDropdown}
              value={unitsForDropdown.find(option => option.value === currentUnitId) || null}
              onChange={(selectedOption) => setCurrentUnitId(selectedOption ? selectedOption.value : '')}
              placeholder="Digite para buscar a unidade..."
              isClearable
              noOptionsMessage={() => "Nenhuma unidade encontrada"}
              required={!asset}
            />
          </div>
          <div>
            <label htmlFor="acquisitionDate" className="block text-sm font-medium text-gray-700 mb-1">Data de Aquisição (Opcional)</label>
            <input
              type="date"
              id="acquisitionDate"
              value={acquisitionDate}
              onChange={(e) => setAcquisitionDate(e.target.value)}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            />
          </div>
          <div>
            <label htmlFor="warrantyEndDate" className="block text-sm font-medium text-gray-700 mb-1">Data Fim da Garantia (Opcional)</label>
            <input
              type="date"
              id="warrantyEndDate"
              value={warrantyEndDate}
              onChange={(e) => setWarrantyEndDate(e.target.value)}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            />
          </div>
          <div className="md:col-span-2">
            <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-1">Observações (Opcional)</label>
            <textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            ></textarea>
          </div>

          {/* >>> BLOCO DE DADOS COMPLEMENTARES (SÓ APARECE PARA TABLETS) <<< */}
          {isTabletType && (
            <div className="md:col-span-2 bg-orange-50 p-4 rounded-lg border border-orange-200 mt-2 space-y-4">
              <h3 className="font-bold text-orange-800 flex items-center mb-2 border-b border-orange-200 pb-2">
                <Smartphone className="w-4 h-4 mr-2" /> Dados Complementares (Logística de Tablets)
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Caixa / Lote</label>
                  <input type="text" value={boxNumber} onChange={(e) => setBoxNumber(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-orange-500 text-sm" placeholder="Ex: CX 01" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">IMEI</label>
                  <input type="text" value={imei} onChange={(e) => setImei(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-orange-500 text-sm" placeholder="Apenas números..." />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Chip de Dados (Linha)</label>
                  <InputMask mask="(99) 99999-9999" value={simCardNumber} onChange={(e) => setSimCardNumber(e.target.value)}>
                    {(inputProps: any) => <input {...inputProps} type="text" className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-orange-500 text-sm" placeholder="(81) 99999-9999" />}
                  </InputMask>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Software LIVOX (PCD)?</label>
                  <select value={hasLivox ? "true" : "false"} onChange={(e) => setHasLivox(e.target.value === "true")} className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm bg-white focus:ring-orange-500 text-sm font-bold text-gray-700">
                    <option value="false">NÃO</option>
                    <option value="true">SIM</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Reserva Técnica?</label>
                  <select value={isReserve ? "true" : "false"} onChange={(e) => setIsReserve(e.target.value === "true")} className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm bg-white focus:ring-orange-500 text-sm font-bold text-gray-700">
                    <option value="false">NÃO</option>
                    <option value="true">SIM</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          <div className="md:col-span-2 flex justify-end space-x-3 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg shadow-sm hover:bg-gray-300 transition-colors duration-200"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-blue-700 text-white rounded-lg shadow-sm hover:bg-blue-800 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Salvando...' : 'Salvar Ativo'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// =====================================================================================
// ATUALIZADO: Componente Modal de Usuários (Cadastro Completo)
// =====================================================================================

interface UserModalProps {
  onClose: () => void;
  onSave: (userData: any, userId?: number) => Promise<void>;
  userToEdit: User | null;
  units: Unit[]; // <<< ADICIONADO: Necessário para escolher a lotação
}

const UserModal = ({ onClose, onSave, userToEdit, units }: UserModalProps) => {
  const { addToast } = useToast();

  // Dados de Acesso
  const [username, setUsername] = useState(userToEdit?.username || '');
  const [email, setEmail] = useState(userToEdit?.email || '');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'admin' | 'manager' | 'basic'>(userToEdit?.role || 'basic');
  const [isActive, setIsActive] = useState<boolean>(userToEdit?.is_active ?? true);

  // Dados Pessoais / Funcionais
  const [fullName, setFullName] = useState(userToEdit?.full_name || '');
  const [jobTitle, setJobTitle] = useState(userToEdit?.job_title || '');
  const [regNumber, setRegNumber] = useState(userToEdit?.registration_number || '');
  const [cpf, setCpf] = useState(userToEdit?.cpf || '');
  const [unitId, setUnitId] = useState(userToEdit?.unit_id?.toString() || '');

  const [loading, setLoading] = useState(false);
  const isEditing = !!userToEdit;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const userData = {
      username,
      email,
      full_name: fullName,
      role,
      is_active: isActive,
      // Novos campos integrados
      job_title: jobTitle || null,
      registration_number: regNumber || null,
      cpf: cpf || null,
      unit_id: unitId ? parseInt(unitId) : null,

      ...(password && { password }),
    };

    await onSave(userData, userToEdit?.id);
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 bg-gray-900 bg-opacity-75 flex items-center justify-center z-[1001] p-4">
      <div className="bg-white p-8 rounded-xl shadow-2xl w-full max-w-3xl relative flex flex-col max-h-[90vh]">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-500 hover:text-gray-800"><X className="w-6 h-6" /></button>

        <h2 className="text-2xl font-bold text-blue-900 mb-1">
          {isEditing ? 'Editar Usuário' : 'Novo Usuário'}
        </h2>
        <p className="text-sm text-gray-500 mb-6">Preencha os dados cadastrais e funcionais do servidor.</p>

        <form onSubmit={handleSubmit} className="space-y-4 overflow-y-auto pr-2 scrollbar-thin">

          {/* BLOCO 1: IDENTIFICAÇÃO E LOTAÇÃO */}
          <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
            <h3 className="text-sm font-bold text-blue-800 mb-3 uppercase tracking-wide">Dados Funcionais</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700">Nome Completo *</label>
                <input type="text" value={fullName} onChange={e => setFullName(e.target.value)} className="mt-1 block w-full border-gray-300 rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500" required />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">CPF</label>
                <InputMask mask="999.999.999-99" value={cpf} onChange={(e) => setCpf(e.target.value)}>
                  {(inputProps: any) => <input {...inputProps} type="text" className="mt-1 block w-full border-gray-300 rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500" placeholder="000.000.000-00" />}
                </InputMask>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Cargo / Função</label>
                <input type="text" value={jobTitle} onChange={e => setJobTitle(e.target.value)} className="mt-1 block w-full border-gray-300 rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500" placeholder="Ex: Gerente de TI" />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Matrícula</label>
                <input type="text" value={regNumber} onChange={e => setRegNumber(e.target.value)} className="mt-1 block w-full border-gray-300 rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500" placeholder="Ex: 123.456-7" />
              </div>

              <div className="lg:col-span-1">
                <label className="block text-sm font-medium text-gray-700">Lotação (Setor)</label>
                <select value={unitId} onChange={e => setUnitId(e.target.value)} className="mt-1 block w-full border-gray-300 rounded-md shadow-sm p-2 bg-white focus:ring-blue-500 focus:border-blue-500">
                  <option value="">Selecione o setor...</option>
                  {units?.sort((a, b) => a.name.localeCompare(b.name)).map((u) => (
                    <option key={u.id} value={u.id}>{u.name}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* BLOCO 2: DADOS DE ACESSO */}
          <div className="p-4 rounded-lg border border-gray-200">
            <h3 className="text-sm font-bold text-gray-600 mb-3 uppercase tracking-wide">Credenciais de Acesso</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Email (Login) *</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} className="mt-1 block w-full border-gray-300 rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500" required />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Username *</label>
                <input type="text" value={username} onChange={e => setUsername(e.target.value)} className="mt-1 block w-full border-gray-300 rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500" required />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Senha {isEditing ? <span className="text-xs text-gray-400 font-normal">(Opcional)</span> : <span className="text-xs text-gray-400 font-normal">(Gerada se vazia)</span>}
                </label>
                <input type="password" value={password} onChange={e => setPassword(e.target.value)} className="mt-1 block w-full border-gray-300 rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500" placeholder={isEditing ? "Manter atual" : "Definir senha"} />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Perfil de Acesso</label>
                <select
                  value={role}
                  onChange={e => setRole(e.target.value as any)}
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm p-2 bg-white focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="basic">Técnico Interno (Logística)</option>
                  <option value="operator">Técnico de Campo (Escolar)</option> {/* NOVO */}
                  <option value="advisor">Assessoria (Auditoria)</option>
                  <option value="manager">Coordenação (Gerente)</option>
                  <option value="admin">Administrador (Total)</option>
                </select>
              </div>
            </div>

            <div className="flex items-center justify-between mt-4 pt-4 border-t">
              <div className="flex items-center">
                <span className="text-sm font-medium text-gray-700 mr-3">Status da Conta:</span>
                <label htmlFor="isActive" className="flex items-center cursor-pointer">
                  <div className="relative">
                    <input type="checkbox" id="isActive" className="sr-only" checked={isActive} onChange={() => setIsActive(!isActive)} />
                    <div className={`block w-12 h-7 rounded-full transition-colors ${isActive ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                    <div className={`dot absolute left-1 top-1 bg-white w-5 h-5 rounded-full transition-transform ${isActive ? 'transform translate-x-5' : ''}`}></div>
                  </div>
                  <div className="ml-3 text-sm font-bold text-gray-700 w-16">
                    {isActive ? 'ATIVA' : 'INATIVA'}
                  </div>
                </label>
              </div>
            </div>
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-200 rounded-lg hover:bg-gray-300 text-gray-800 font-medium transition-colors">Cancelar</button>
            <button type="submit" disabled={loading} className="px-6 py-2 bg-blue-700 text-white rounded-lg hover:bg-blue-800 disabled:opacity-50 font-bold shadow-md transition-colors">
              {loading ? 'Salvando...' : 'Salvar Usuário'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// =====================================================================================
// ATUALIZADO: Componente Modal de Pessoa
// =====================================================================================
// App.tsx -> SUBSTITUA O COMPONENTE PeopleModal PELA VERSÃO ABAIXO

// A interface de props permanece a mesma
interface PeopleModalProps {
  onClose: () => void;
  onSave: (personData: Omit<Person, 'id' | 'unit_name' | 'created_at' | 'updated_at'>, id?: number) => Promise<void>;
  person: Person | null;
  units: Unit[];
}

// =====================================================================================
// CORRIGIDO: Componente Modal de Pessoa (Com Hierarquia para Externas)
// =====================================================================================

const PeopleModal = ({ onClose, onSave, person, units }: PeopleModalProps) => {
  // Estados para os dados da pessoa
  const [fullName, setFullName] = useState<string>(person?.full_name || '');
  const [registrationNumber, setRegistrationNumber] = useState<string>(person?.registration_number || '');
  const [cpf, setCpf] = useState<string>(person?.cpf || '');
  const [email, setEmail] = useState<string>(person?.email || '');
  const [contactPhone, setContactPhone] = useState<string>(person?.contact_phone || '');
  const [jobTitle, setJobTitle] = useState<string>(person?.job_title || '');

  // Estados para controlar o wizard de lotação
  const [selectedUnitType, setSelectedUnitType] = useState<'ADMINISTRATIVA' | 'ESCOLAR' | 'EXTERNA' | ''>('');

  // Níveis hierárquicos (usados tanto para ADM quanto para EXTERNA)
  const [level1UnitId, setLevel1UnitId] = useState<string>('');
  const [level2UnitId, setLevel2UnitId] = useState<string>('');
  const [level3UnitId, setLevel3UnitId] = useState<string>('');
  const [level4UnitId, setLevel4UnitId] = useState<string>('');
  const [finalUnitId, setFinalUnitId] = useState<string>(person?.unit_id?.toString() || '');

  const [loading, setLoading] = useState<boolean>(false);

  // Função auxiliar para formatar opções do React-Select com ordenação
  const formatOptions = (unitList: Unit[]) => unitList
    .sort((a, b) => a.name.localeCompare(b.name))
    .map(u => ({ value: u.id.toString(), label: u.name }));

  // --- LÓGICA DE FILTROS HIERÁRQUICOS ---

  // 1. Encontra a raiz da SEDUC para filtrar as Administrativas
  const topLevelSeduc = useMemo(() =>
    units.find(u => u.name.toLowerCase().includes('secretaria de educação') && !u.parent_id),
    [units]
  );

  // 2. Nível 1: 
  // Se ADM: Filhos da "Secretaria de Educação"
  // Se EXTERNA: Unidades do tipo EXTERNA que NÃO têm pai (Raiz)
  const level1Options = useMemo(() => {
    if (selectedUnitType === 'ADMINISTRATIVA' && topLevelSeduc) {
      return formatOptions(units.filter(u => u.parent_id === topLevelSeduc.id));
    }
    if (selectedUnitType === 'EXTERNA') {
      // Aqui está a correção: Pega todas as externas que são "Pai" (parent_id null)
      return formatOptions(units.filter(u => u.type === 'EXTERNA' && !u.parent_id));
    }
    return [];
  }, [units, selectedUnitType, topLevelSeduc]);

  // 3. Nível 2: Filhos da unidade selecionada no Nível 1
  const level2Options = useMemo(() => {
    if (!level1UnitId) return [];
    return formatOptions(units.filter(u => u.parent_id === parseInt(level1UnitId)));
  }, [units, level1UnitId]);

  // 4. Nível 3: Filhos da unidade selecionada no Nível 2
  const level3Options = useMemo(() => {
    if (!level2UnitId) return [];
    return formatOptions(units.filter(u => u.parent_id === parseInt(level2UnitId)));
  }, [units, level2UnitId]);

  // 5. Nível 4: Filhos da unidade selecionada no Nível 3
  const level4Options = useMemo(() => {
    if (!level3UnitId) return [];
    return formatOptions(units.filter(u => u.parent_id === parseInt(level3UnitId)));
  }, [units, level3UnitId]);

  // Lista simples para Escolas (sem hierarquia complexa)
  const schoolUnits = useMemo(() => units.filter(u => u.type === 'ESCOLAR'), [units]);

  // --- EFEITO: CARREGAR DADOS NA EDIÇÃO ---
  useEffect(() => {
    if (person && person.unit_id) {
      const personUnit = units.find(u => u.id === person.unit_id);
      if (personUnit) {
        setSelectedUnitType(personUnit.type);

        // Reconstrói a hierarquia de baixo para cima
        const hierarchy: Unit[] = [];
        let current: Unit | undefined = personUnit;
        while (current) {
          hierarchy.unshift(current); // Adiciona no início do array
          current = units.find(u => u.id === current?.parent_id);
        }

        // Ajuste específico para SEDUC (Remove o nó raiz "Secretaria de Educação" da visualização)
        // Para EXTERNA, mantemos o nó raiz pois ele é o nível 1
        if (personUnit.type === 'ADMINISTRATIVA' && hierarchy.length > 0 && hierarchy[0].id === topLevelSeduc?.id) {
          hierarchy.shift();
        }

        // Preenche os estados com base na profundidade encontrada
        if (hierarchy[0]) setLevel1UnitId(hierarchy[0].id.toString());
        if (hierarchy[1]) setLevel2UnitId(hierarchy[1].id.toString());
        if (hierarchy[2]) setLevel3UnitId(hierarchy[2].id.toString());
        if (hierarchy[3]) setLevel4UnitId(hierarchy[3].id.toString());

        setFinalUnitId(person.unit_id.toString());
      }
    }
  }, [person, units, topLevelSeduc]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const personData = {
      full_name: fullName,
      unit_id: finalUnitId ? parseInt(finalUnitId) : undefined,
      registration_number: registrationNumber || undefined,
      cpf,
      email,
      contact_phone: contactPhone || undefined,
      job_title: jobTitle || undefined,
    };
    await onSave(personData, person?.id);
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 bg-gray-900 bg-opacity-75 flex items-center justify-center z-[1001] p-4">
      <div className="bg-white p-8 rounded-xl shadow-2xl w-full max-w-4xl relative max-h-[90vh] overflow-y-auto">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-500 hover:text-gray-800"><X className="w-6 h-6" /></button>
        <h2 className="text-2xl font-bold text-blue-900 mb-6">{person ? 'Editar Pessoa' : 'Adicionar Nova Pessoa'}</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="border border-gray-200 p-4 rounded-lg space-y-4">
            <h3 className="text-lg font-semibold text-gray-800">Dados Pessoais</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="lg:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Nome Completo *</label>
                <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} className="w-full p-2 border rounded-md" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Cargo (Opcional)</label>
                <input type="text" value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} className="w-full p-2 border rounded-md" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">CPF *</label>
                <InputMask mask="999.999.999-99" value={cpf} onChange={(e) => setCpf(e.target.value)}>{(inputProps: any) => <input {...inputProps} type="text" className="w-full p-2 border rounded-md" required />}</InputMask>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Matrícula (Opcional)</label>
                <InputMask mask="999999-9" value={registrationNumber} onChange={(e) => setRegistrationNumber(e.target.value)}>{(inputProps: any) => <input {...inputProps} type="text" className="w-full p-2 border rounded-md" />}</InputMask>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full p-2 border rounded-md" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Telefone (Opcional)</label>
                <InputMask
                  mask={contactPhone.replace(/\D/g, '').length > 10 ? "(99) 99999-9999" : "(99) 9999-99999?"}

                  // @ts-ignore
                  formatChars={{ "9": "[0-9]", "?": "[0-9]" }}

                  maskChar={null}
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                >
                  {(inputProps: any) => (
                    <input
                      {...inputProps}
                      type="tel"
                      className="w-full p-2 border rounded-md"
                      placeholder="(81) 99999-9999"
                    />
                  )}
                </InputMask>
              </div>
            </div>
          </div>

          <div className="border border-gray-200 p-4 rounded-lg space-y-4">
            <h3 className="text-lg font-semibold text-gray-800">Lotação (Opcional)</h3>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">1. Tipo de Unidade</label>
              <select value={selectedUnitType} onChange={e => {
                setSelectedUnitType(e.target.value as any);
                setLevel1UnitId(''); setLevel2UnitId(''); setLevel3UnitId(''); setLevel4UnitId(''); setFinalUnitId('');
              }} className="w-full p-2 border rounded-md">
                <option value="">Selecione o tipo...</option>
                <option value="ADMINISTRATIVA">Unidade Administrativa (SEDUC)</option>
                <option value="ESCOLAR">Unidade Escolar</option>
                <option value="EXTERNA">Unidade Externa</option>
              </select>
            </div>

            {/* AQUI ESTÁ A MÁGICA: Usamos a mesma lógica hierárquica para ADM e EXTERNA */}
            {(selectedUnitType === 'ADMINISTRATIVA' || selectedUnitType === 'EXTERNA') && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">

                {/* NÍVEL 1: Secretaria Executiva OU Secretaria Externa Principal */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {selectedUnitType === 'ADMINISTRATIVA' ? '2. Secretaria Executiva' : '2. Secretaria/Órgão Principal'}
                  </label>
                  <Select options={level1Options} isClearable placeholder="Selecione..."
                    onChange={(opt) => {
                      const newId = opt ? opt.value : '';
                      setLevel1UnitId(newId);
                      setLevel2UnitId(''); setLevel3UnitId(''); setLevel4UnitId('');
                      setFinalUnitId(newId);
                    }}
                    value={level1Options.find(o => o.value === level1UnitId)}
                    noOptionsMessage={() => "Nenhuma unidade encontrada"}
                  />
                </div>

                {/* NÍVEL 2: Gerência OU Executiva da Externa */}
                {level1UnitId && level2Options.length > 0 && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {selectedUnitType === 'ADMINISTRATIVA' ? '3. Ger.Geral ou Gerência' : '3. Sec. Executiva / Depto'}
                    </label>
                    <Select options={level2Options} isClearable placeholder="Selecione..."
                      onChange={(opt) => {
                        const newId = opt ? opt.value : '';
                        setLevel2UnitId(newId);
                        setLevel3UnitId(''); setLevel4UnitId('');
                        setFinalUnitId(newId || level1UnitId);
                      }}
                      value={level2Options.find(o => o.value === level2UnitId)}
                    />
                  </div>
                )}

                {/* NÍVEL 3 */}
                {level2UnitId && level3Options.length > 0 && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">4. Gerência ou Setor</label>
                    <Select options={level3Options} isClearable placeholder="Selecione..."
                      onChange={(opt) => {
                        const newId = opt ? opt.value : '';
                        setLevel3UnitId(newId);
                        setLevel4UnitId('');
                        setFinalUnitId(newId || level2UnitId);
                      }}
                      value={level3Options.find(o => o.value === level3UnitId)}
                    />
                  </div>
                )}

                {/* NÍVEL 4 */}
                {level3UnitId && level4Options.length > 0 && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">5. Setor</label>
                    <Select options={level4Options} isClearable placeholder="Selecione..."
                      onChange={(opt) => {
                        const newId = opt ? opt.value : '';
                        setLevel4UnitId(newId);
                        setFinalUnitId(newId || level3UnitId);
                      }}
                      value={level4Options.find(o => o.value === level4UnitId)}
                    />
                  </div>
                )}
              </div>
            )}

            {/* Se for ESCOLAR, mantém a lógica simples de lista */}
            {selectedUnitType === 'ESCOLAR' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">2. Escola</label>
                <Select options={formatOptions(schoolUnits)} isClearable placeholder="Busque a Escola..."
                  onChange={(opt) => setFinalUnitId(opt ? opt.value : '')}
                  value={formatOptions(schoolUnits).find(o => o.value === finalUnitId)}
                />
              </div>
            )}
          </div>

          <div className="flex justify-end space-x-3 mt-6 border-t pt-6">
            <button type="button" onClick={onClose} className="px-6 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300">Cancelar</button>
            <button type="submit" disabled={loading} className="px-6 py-2 bg-blue-700 text-white rounded-lg hover:bg-blue-800 disabled:opacity-50">
              <Save className="w-5 h-5 mr-2 inline-block" />{loading ? 'Salvando...' : 'Salvar Pessoa'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};


// =====================================================================================
// NOVO: Componente Modal de Devolução por Ativo
// =====================================================================================
interface ReturnByAssetModalProps {
  onClose: () => void;
  onSave: (movementData: any) => Promise<{ success: boolean; movementId?: number; message: string }>;
  handleGenerateMovementReceipt: (movementId: number) => Promise<void>;
}

const ReturnByAssetModal = ({ onClose, onSave, handleGenerateMovementReceipt }: ReturnByAssetModalProps) => {
  const [identifier, setIdentifier] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ asset: Asset; person: Person } | null>(null);
  const [isReturned, setIsReturned] = useState(false);
  const [movementId, setMovementId] = useState<number | null>(null);
  const { API_URL } = useContext(AuthContext) as AuthContextType;
  const { addToast } = useToast();

  const handleSearch = async () => {
    if (!identifier) {
      setError('Por favor, insira um número de patrimônio ou série.');
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const response = await axios.post(`${API_URL}/assets/find-for-return`, { identifier });
      setResult(response.data);
    } catch (err: unknown) {
      const axiosError = err as AxiosError<BackendErrorResponse>;
      const errorMessage = axiosError.response?.data?.message ?? 'Ocorreu um erro desconhecido.';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmReturn = async () => {
    if (!result) return;
    setLoading(true);

    const movementData = {
      asset_ids: [result.asset.id],
      movement_type: 'return',
      recipient_person_id: result.person.id,
      notes: `Devolução realizada via consulta de ativo (${identifier}).`
    };

    const saveResult = await onSave(movementData);
    if (saveResult.success && saveResult.movementId) {
      addToast('Devolução registrada com sucesso!', 'success');
      setIsReturned(true);
      setMovementId(saveResult.movementId);
    } else {
      addToast(saveResult.message, 'error');
    }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 bg-gray-900 bg-opacity-75 flex items-center justify-center z-[1001] p-4">
      <div className="bg-white p-8 rounded-xl shadow-2xl w-full max-w-2xl relative">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-500 hover:text-gray-800" disabled={loading}>
          <X className="w-6 h-6" />
        </button>
        <h2 className="text-2xl font-bold text-blue-900 mb-6">Devolução por Ativo</h2>

        {!isReturned ? (
          <>
            <div className="space-y-4">
              <div>
                <label htmlFor="identifier" className="block text-sm font-medium text-gray-700 mb-1">Patrimônio ou Nº de Série</label>
                <div className="flex space-x-2">
                  <input
                    type="text"
                    id="identifier"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md shadow-sm"
                    placeholder="Digite o identificador do ativo"
                  />
                  <button onClick={handleSearch} disabled={loading} className="px-4 py-2 bg-blue-600 text-white rounded-md shadow-sm hover:bg-blue-700 flex items-center disabled:opacity-50">
                    <Search className="w-5 h-5 mr-2" /> {loading ? 'Buscando...' : 'Buscar'}
                  </button>
                </div>
                {error && <p className="text-red-600 text-sm mt-2">{error}</p>}
              </div>

              {result && (
                <div className="mt-6 border-t pt-6 space-y-6">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-800">Ativo Encontrado</h3>
                    <div className="mt-2 p-4 bg-gray-50 rounded-lg border grid grid-cols-2 gap-4">
                      <p><strong className="text-gray-600">Patrimônio:</strong> {result.asset.patrimonio_number}</p>
                      <p><strong className="text-gray-600">Nº Série:</strong> {result.asset.serial_number}</p>
                      <p><strong className="text-gray-600">Tipo:</strong> {result.asset.item_type_name}</p>
                      <p><strong className="text-gray-600">Marca/Modelo:</strong> {result.asset.brand} {result.asset.model}</p>
                    </div>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-800">Responsável Atual</h3>
                    <div className="mt-2 p-4 bg-yellow-50 rounded-lg border border-yellow-200 grid grid-cols-2 gap-4">
                      <p><strong className="text-gray-600">Nome:</strong> {result.person.full_name}</p>
                      <p><strong className="text-gray-600">CPF:</strong> {result.person.cpf}</p>
                      <p className="col-span-2"><strong className="text-gray-600">Email:</strong> {result.person.email}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end space-x-3 mt-8">
              <button onClick={onClose} disabled={loading} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300">
                Cancelar
              </button>
              <button onClick={handleConfirmReturn} disabled={!result || loading} className="px-4 py-2 bg-green-600 text-white rounded-lg shadow-sm hover:bg-green-700 disabled:opacity-50">
                {loading ? 'Processando...' : 'Confirmar Devolução'}
              </button>
            </div>
          </>
        ) : (
          <div className="text-center">
            <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h3 className="text-2xl font-bold text-gray-800">Devolução Registrada!</h3>
            <p className="text-gray-600 mt-2">O ativo foi devolvido com sucesso e já está disponível no almoxarifado.</p>
            <div className="flex justify-center space-x-3 mt-8">
              <button onClick={onClose} className="px-6 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300">
                Fechar
              </button>
              {movementId && (
                <button onClick={() => handleGenerateMovementReceipt(movementId)} className="px-6 py-2 bg-purple-600 text-white rounded-lg shadow-sm hover:bg-purple-700 flex items-center">
                  <FileText className="w-5 h-5 mr-2" /> Gerar Recibo
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// =====================================================================================
// NOVO: Componente Modal de Devolução por Usuário
// =====================================================================================
interface ReturnByUserModalProps {
  onClose: () => void;
  onSave: (movementData: any) => Promise<{ success: boolean; movementId?: number; message: string }>;
  people: Person[];
  handleGenerateMovementReceipt: (movementId: number) => Promise<void>;
}

const ReturnByUserModal = ({ onClose, onSave, people, handleGenerateMovementReceipt }: ReturnByUserModalProps) => {
  const [solicitanteSearchTerm, setSolicitanteSearchTerm] = useState<string>('');
  const [filteredPeople, setFilteredPeople] = useState<Person[]>([]);
  const [selectedPerson, setSelectedPerson] = useState<Person | null>(null);
  const [assetsOfPerson, setAssetsOfPerson] = useState<Asset[]>([]);
  const [personAssetsLoading, setPersonAssetsLoading] = useState<boolean>(false);
  const [selectedReturnAssetIds, setSelectedReturnAssetIds] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState<boolean>(false);
  const [lastMovementId, setLastMovementId] = useState<number | null>(null);
  const { API_URL } = useContext(AuthContext) as AuthContextType;
  const { addToast } = useToast();

  const fetchAssetsOfPerson = useCallback(async (personId: number) => {
    setPersonAssetsLoading(true);
    setAssetsOfPerson([]);
    try {
      const response = await axios.get<Asset[]>(`${API_URL}/people/${personId}/assets`);
      setAssetsOfPerson(response.data);
      if (response.data.length === 0) {
        addToast('Este solicitante não possui ativos pendentes de devolução.', 'info');
      }
    } catch (error) {
      addToast('Erro ao buscar os ativos do solicitante.', 'error');
    } finally {
      setPersonAssetsLoading(false);
    }
  }, [API_URL, addToast]);

  useEffect(() => {
    if (selectedPerson) {
      fetchAssetsOfPerson(selectedPerson.id);
    } else {
      setAssetsOfPerson([]);
    }
  }, [selectedPerson, fetchAssetsOfPerson]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const assetIdsToMove = Array.from(selectedReturnAssetIds);
    if (assetIdsToMove.length === 0) {
      addToast('Selecione ao menos um ativo para devolver.', 'warning');
      setLoading(false);
      return;
    }
    const movementData = {
      asset_ids: assetIdsToMove,
      movement_type: 'return',
      recipient_person_id: selectedPerson?.id,
    };
    const result = await onSave(movementData);
    if (result.success && result.movementId) {
      setLastMovementId(result.movementId);
    }
    setLoading(false);
  };

  const handleToggleReturnAsset = (assetId: number) => {
    setSelectedReturnAssetIds(prev => {
      const newSet = new Set(prev);
      newSet.has(assetId) ? newSet.delete(assetId) : newSet.add(assetId);
      return newSet;
    });
  };

  const handleToggleSelectAllReturnAssets = () => {
    if (selectedReturnAssetIds.size === assetsOfPerson.length) {
      setSelectedReturnAssetIds(new Set());
    } else {
      setSelectedReturnAssetIds(new Set(assetsOfPerson.map(asset => asset.id)));
    }
  };

  const handleSelectPerson = (person: Person) => {
    setSelectedPerson(person);
    setSolicitanteSearchTerm(person.full_name);
    setFilteredPeople([]);
  };

  useEffect(() => {
    if (solicitanteSearchTerm.length > 2) {
      setFilteredPeople(people.filter(p => p.full_name.toLowerCase().includes(solicitanteSearchTerm.toLowerCase()) || p.cpf.includes(solicitanteSearchTerm) || (p.registration_number && p.registration_number.includes(solicitanteSearchTerm))));
    } else {
      setFilteredPeople([]);
    }
  }, [solicitanteSearchTerm, people]);

  return (
    <div className="fixed inset-0 bg-gray-900 bg-opacity-75 flex items-center justify-center z-[1001] p-4">
      <div className="bg-white p-8 rounded-xl shadow-2xl w-full max-w-4xl relative overflow-y-auto max-h-[90vh]">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-500 hover:text-gray-800" disabled={loading}>
          <X className="w-6 h-6" />
        </button>
        <h2 className="text-2xl font-bold text-blue-900 mb-6">Devolução por Usuário</h2>

        {!lastMovementId ? (
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="relative">
              <label htmlFor="solicitanteSearch" className="block text-sm font-medium text-gray-700 mb-1">Buscar Solicitante (Nome, CPF ou Matrícula)</label>
              <input type="text" id="solicitanteSearch" value={solicitanteSearchTerm} onChange={(e) => { setSolicitanteSearchTerm(e.target.value); setSelectedPerson(null); }} className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm" placeholder="Digite para buscar..." autoComplete="off" />
              {filteredPeople.length > 0 && (<ul className="absolute z-10 w-full bg-white border border-gray-300 rounded-md mt-1 max-h-40 overflow-y-auto shadow-lg">{filteredPeople.map((person) => (<li key={person.id} onClick={() => handleSelectPerson(person)} className="px-3 py-2 cursor-pointer hover:bg-blue-50">{person.full_name} ({person.cpf})</li>))}</ul>)}
            </div>

            <div className="border border-gray-200 p-4 rounded-lg space-y-4">
              <h3 className="text-lg font-semibold text-gray-800">Ativos do Solicitante</h3>
              {personAssetsLoading && <p className="text-center text-blue-600">Buscando ativos...</p>}
              {!personAssetsLoading && assetsOfPerson.length > 0 && (
                <div className="overflow-x-auto border rounded-lg">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs"><input type="checkbox" className="rounded" checked={assetsOfPerson.length > 0 && selectedReturnAssetIds.size === assetsOfPerson.length} onChange={handleToggleSelectAllReturnAssets} /></th>
                        <th className="px-4 py-2 text-left text-xs">SKU</th>
                        <th className="px-4 py-2 text-left text-xs">Tipo</th>
                        <th className="px-4 py-2 text-left text-xs">Marca/Modelo</th>
                        <th className="px-4 py-2 text-left text-xs">Patrimônio</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {assetsOfPerson.map((asset) => (
                        <tr key={asset.id} className={selectedReturnAssetIds.has(asset.id) ? 'bg-blue-50' : ''}>
                          <td className="px-4 py-2 text-sm"><input type="checkbox" className="rounded" checked={selectedReturnAssetIds.has(asset.id)} onChange={() => handleToggleReturnAsset(asset.id)} /></td>
                          <td className="px-4 py-2 text-sm">{asset.sku}</td>
                          <td className="px-4 py-2 text-sm">{asset.item_type_name}</td>
                          <td className="px-4 py-2 text-sm">{asset.brand} {asset.model}</td>
                          <td className="px-4 py-2 text-sm">{asset.patrimonio_number || 'N/A'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {!personAssetsLoading && !selectedPerson && (<p className="text-center text-gray-500 py-4">Selecione um solicitante para listar os ativos.</p>)}
              {!personAssetsLoading && selectedPerson && assetsOfPerson.length === 0 && (<p className="text-center text-gray-500 py-4">Nenhum ativo pendente encontrado para este solicitante.</p>)}
            </div>
            <div className="flex justify-end space-x-3 pt-4">
              <button type="button" onClick={onClose} className="px-6 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300">Cancelar</button>
              <button type="submit" disabled={loading || selectedReturnAssetIds.size === 0} className="px-6 py-2 bg-green-600 text-white rounded-lg shadow-sm hover:bg-green-700 disabled:opacity-50">
                {loading ? 'Processando...' : `Devolver ${selectedReturnAssetIds.size} Iten(s)`}
              </button>
            </div>
          </form>
        ) : (
          <div className="text-center py-8">
            <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h3 className="text-2xl font-bold text-gray-800">Devolução Registrada!</h3>
            <p className="text-gray-600 mt-2">Os itens foram devolvidos com sucesso.</p>
            <div className="flex justify-center space-x-3 mt-8">
              <button onClick={onClose} className="px-6 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300">Fechar</button>
              {lastMovementId && (<button onClick={() => handleGenerateMovementReceipt(lastMovementId)} className="px-6 py-2 bg-purple-600 text-white rounded-lg shadow-sm hover:bg-purple-700 flex items-center"><FileText className="w-5 h-5 mr-2" /> Gerar Recibo</button>)}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// =====================================================================================
// NOVO: Componente da Página de Devoluções
// =====================================================================================
interface ReturnsPageProps {
  onStartReturnByUser: () => void;
  onStartReturnByAsset: () => void;
}

const ReturnsPage = ({ onStartReturnByUser, onStartReturnByAsset }: ReturnsPageProps) => {
  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-extrabold text-blue-900 mb-6">Central de Devoluções</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">

        {/* Opção 1: Devolução por Usuário */}
        <div className="bg-white p-8 rounded-xl shadow-md border border-gray-200 flex flex-col items-center text-center">
          <Users className="w-16 h-16 text-blue-600 mb-4" />
          <h2 className="text-xl font-bold text-gray-800">Devolução por Usuário</h2>
          <p className="text-gray-600 mt-2 mb-6">
            Ideal para quando o solicitante está presente. Busque pelo nome, CPF ou matrícula para ver e devolver todos os seus ativos.
          </p>
          <button
            onClick={onStartReturnByUser}
            className="w-full bg-blue-600 text-white px-6 py-3 rounded-lg shadow-md hover:bg-blue-700 flex items-center justify-center transition-colors duration-200"
          >
            <Search className="w-5 h-5 mr-2" /> Iniciar Devolução por Usuário
          </button>
        </div>

        {/* Opção 2: Devolução por Ativo */}
        <div className="bg-white p-8 rounded-xl shadow-md border border-gray-200 flex flex-col items-center text-center">
          <HardDrive className="w-16 h-16 text-teal-600 mb-4" />
          <h2 className="text-xl font-bold text-gray-800">Devolução por Ativo</h2>
          <p className="text-gray-600 mt-2 mb-6">
            Use esta opção quando você tem o equipamento em mãos, mas não sabe quem é o responsável. Consulte pelo patrimônio ou nº de série.
          </p>
          <button
            onClick={onStartReturnByAsset}
            className="w-full bg-teal-600 text-white px-6 py-3 rounded-lg shadow-md hover:bg-teal-700 flex items-center justify-center transition-colors duration-200"
          >
            <CornerUpLeft className="w-5 h-5 mr-2" /> Iniciar Devolução por Ativo
          </button>
        </div>
      </div>
    </div>
  );
};

// >>> NOVO COMPONENTE DE MODAL ALTERAÇÃO DE SENHA <<<
interface ChangePasswordModalProps {
  onClose: () => void;
  onSave: (passwordData: any) => Promise<void>;
}

const ChangePasswordModal = ({ onClose, onSave }: ChangePasswordModalProps) => {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { addToast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      addToast('A nova senha e a confirmação não correspondem.', 'error');
      return;
    }
    setLoading(true);
    await onSave({ currentPassword, newPassword, confirmPassword });
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 bg-gray-900 bg-opacity-75 flex items-center justify-center z-[1002] p-4">
      <div className="bg-white p-8 rounded-xl shadow-2xl w-full max-w-md relative">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-500 hover:text-gray-800"><X className="w-6 h-6" /></button>
        <h2 className="text-2xl font-bold text-blue-900 mb-6">Alterar Senha</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Senha Atual</label>
            <input type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} className="mt-1 block w-full border-gray-300 rounded-md shadow-sm" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Nova Senha</label>
            <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} className="mt-1 block w-full border-gray-300 rounded-md shadow-sm" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Confirmar Nova Senha</label>
            <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} className="mt-1 block w-full border-gray-300 rounded-md shadow-sm" required />
          </div>
          <div className="flex justify-end space-x-3 pt-4">
            <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-200 rounded-lg hover:bg-gray-300">Cancelar</button>
            <button type="submit" disabled={loading} className="px-4 py-2 bg-blue-700 text-white rounded-lg hover:bg-blue-800 disabled:opacity-50">
              {loading ? 'Salvando...' : 'Salvar Nova Senha'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// >>> COMPONENTE DE MODAL PROFILE <<<
interface ProfileModalProps {
  onClose: () => void;
  onSave: (profileData: any) => Promise<void>;
  currentUser: User | null;
  onChangePasswordClick: () => void; // Nova prop para chamar o modal de senha
}

const ProfileModal = ({ onClose, onSave, currentUser, onChangePasswordClick }: ProfileModalProps) => {
  const [fullName, setFullName] = useState(currentUser?.full_name || '');
  const [username, setUsername] = useState(currentUser?.username || '');
  const [email, setEmail] = useState(currentUser?.email || '');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    await onSave({ full_name: fullName, username, email });
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 bg-gray-900 bg-opacity-75 flex items-center justify-center z-[1001] p-4">
      <div className="bg-white p-8 rounded-xl shadow-2xl w-full max-w-lg relative">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-500 hover:text-gray-800"><X className="w-6 h-6" /></button>
        <h2 className="text-2xl font-bold text-blue-900 mb-6">Meu Perfil</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Nome Completo</label>
            <input type="text" value={fullName} onChange={e => setFullName(e.target.value)} className="mt-1 block w-full border-gray-300 rounded-md shadow-sm" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Username</label>
            <input type="text" value={username} onChange={e => setUsername(e.target.value)} className="mt-1 block w-full border-gray-300 rounded-md shadow-sm" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} className="mt-1 block w-full border-gray-300 rounded-md shadow-sm" required />
          </div>

          {/* Botão para abrir o modal de alterar senha */}
          <div className="border-t pt-4 mt-4">
            <button
              type="button"
              onClick={onChangePasswordClick}
              className="text-sm font-medium text-blue-600 hover:underline"
            >
              Alterar minha senha
            </button>
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-200 rounded-lg hover:bg-gray-300">Cancelar</button>
            <button type="submit" disabled={loading} className="px-4 py-2 bg-blue-700 text-white rounded-lg hover:bg-blue-800 disabled:opacity-50">
              {loading ? 'Salvando...' : 'Salvar Alterações'}
            </button>
          </div>
        </form>

        {/* >>> ASSINATURA NO MODAL DE PERFIL <<< */}
        <div className="mt-6 pt-4 border-t border-gray-100 text-center">
          <p className="text-[10px] text-gray-400">
            SGA idealizado pela <span className="font-medium text-gray-500">Gerência de Infraestrutura de Tecnologia (GIT)</span>
          </p>
          <p className="text-[10px] text-gray-400 flex items-center justify-center mt-1">
            <Code className="w-3 h-3 mr-1" /> Gestão técnica: Alberto Dantas
          </p>
        </div>

      </div>
    </div>
  );
};
// Arquivo: App.tsx

// >>>  NOVO COMPONENTE DE PÁGINA - Tela de Troca Obrigatória de Senha <<<
const ForcedChangePasswordPage = () => {
  // Pegamos as funções que precisamos do contexto
  const { API_URL } = useContext(AuthContext) as AuthContextType;
  const { addToast } = useToast();

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col justify-center items-center p-4">
      <div className="text-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Alteração de Senha Obrigatória</h1>
        <p className="text-gray-600">Por segurança, você precisa definir uma nova senha para continuar.</p>
      </div>
      {/* Reutilizamos o modal de troca de senha, mas sem o botão de fechar */}
      <div className="w-full max-w-md">
        <ChangePasswordModal
          onClose={() => { }} // Não faz nada, impedindo o fechamento
          onSave={async (passwordData) => {
            try {
              // A chamada para a API permanece a mesma
              const response = await axios.post(`${API_URL}/users/me/change-password`, passwordData);

              // Captura o novo token da resposta do backend
              const { token: newToken } = response.data;

              // Salva o novo token no localStorage, substituindo o antigo
              localStorage.setItem('token', newToken);

              addToast('Senha alterada com sucesso! Redirecionando...', 'success');

              // Recarrega a aplicação após 2 segundos
              setTimeout(() => {
                window.location.reload();
              }, 2000);

            } catch (error: unknown) {
              const axiosError = error as AxiosError<BackendErrorResponse>;
              const errorMessage = axiosError.response?.data?.message || 'Erro ao alterar a senha.';
              addToast(errorMessage, 'error');
            }
          }}
        />
      </div>
    </div>
  );
};

interface MovementQueryPageProps {
  filters: any;
  movements: Movement[];
  isReportEnabled: boolean;
  onFilterChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void;
  onFilterSubmit: () => void;
  onFilterClear: () => void;
  onGenerateReport: () => void;
  onRegisterMovementClick: () => void;
  translateMovementType: (type: string) => string;
  handleGenerateMovementReceipt: (id: number) => void;
}

// ============================================================================
// COMPONENTE AUTOCONSCIENTE DE AMBIENTE (Inovação de Infraestrutura)
// ============================================================================
const EnvironmentBadge = () => {
  const currentHost = window.location.hostname;

  // Ativa o alerta visual se estiver no servidor .83 ou rodando local (testes)
  const isTestEnvironment = currentHost === '100.67.80.83' || currentHost === 'localhost';

  // Se for Produção (100.67.80.80), o componente simplesmente não renderiza nada (invisível)
  if (!isTestEnvironment) return null;

  return (
    <>
      {/* 1. Barra Global no Topo (Estilo Fita Zebrada de Cuidado) */}
      <div className="fixed top-0 left-0 w-full z-[9999] bg-yellow-400 text-yellow-900 py-1 text-center font-bold text-[11px] tracking-widest uppercase shadow-md flex items-center justify-center pointer-events-none opacity-90">
        <AlertTriangleIcon className="w-3 h-3 mr-2" />
        Atenção: Ambiente de Homologação — Dados fictícios. Não afeta a Produção.
        <AlertTriangleIcon className="w-3 h-3 ml-2" />
      </div>

      {/* 2. Selo Flutuante Persistente no canto inferior direito */}
      <div className="fixed bottom-6 right-6 z-[9998] bg-gray-900 bg-opacity-80 backdrop-blur-sm text-yellow-400 border border-yellow-500 px-4 py-2 rounded-full shadow-2xl flex items-center pointer-events-none animate-pulse">
        <Code className="w-5 h-5 mr-2" />
        <div className="flex flex-col">
          <span className="font-mono font-bold text-xs leading-tight">HOMOLOGAÇÃO</span>
          <span className="text-[9px] text-gray-300 leading-tight">IP: {currentHost}</span>
        </div>
      </div>

      {/* 3. Borda amarela sutil ao redor de toda a tela para reforço psicológico */}
      <div className="fixed inset-0 border-4 border-yellow-400 pointer-events-none z-[9997] opacity-20"></div>
    </>
  );
};

// Componente principal da aplicação
const App = () => {
  return (
    <ToastProvider>
      <EnvironmentBadge />
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ToastProvider>
  );
};

const AppContent = () => {
  const { user, loading } = useContext(AuthContext) as AuthContextType;

  if (loading) {
    // ... (tela de loading permanece a mesma)
  }

  // Se o usuário está logado E precisa trocar a senha, mostra a página de troca obrigatória
  if (user && user.must_change_password) {
    return <ForcedChangePasswordPage />;
  }

  // Se o usuário está logado E não precisa trocar a senha, mostra o Dashboard
  if (user) {
    return <DashboardPage />;
  }

  // Se não há usuário, mostra a página de Login
  return <LoginPage />;
};

// ============================================================================
// MODAL DE SUBSTITUIÇÃO DE TABLET (Gestão Escolar) - ATUALIZADO (Item 3)
// ============================================================================
interface SubstitutionModalProps {
  onClose: () => void;
  API_URL: string;
  addToast: any;
}

const TabletSubstitutionModal: React.FC<SubstitutionModalProps> = ({ onClose, API_URL, addToast }) => {
  const [step, setStep] = useState(1);
  const [matricula, setMatricula] = useState('');
  const [loading, setLoading] = useState(false);
  const [studentData, setStudentData] = useState<any>(null);

  // --- ESTADOS DO EQUIPAMENTO ANTIGO (DEVOLUÇÃO) ---
  const [oldImei, setOldImei] = useState('');
  const [oldSim, setOldSim] = useState('');

  // --- ESTADOS DO EQUIPAMENTO NOVO (ENTRADA) ---
  const [searchTerm, setSearchTerm] = useState('');
  const [foundNewTablet, setFoundNewTablet] = useState<any | null>(null);
  const [searchList, setSearchList] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Dados técnicos do novo
  const [newImei, setNewImei] = useState('');
  const [newSim, setNewSim] = useState('');
  const [linkNewSim, setLinkNewSim] = useState(false); // Checkbox "Vincular Chip?"

  const [reason, setReason] = useState('');

  // PASSO 1: Buscar Aluno
  const handleSearchStudent = async () => {
    if (!matricula) return addToast('Digite a matrícula.', 'warning');
    setLoading(true);
    try {
      const response = await axios.get(`${API_URL}/tablets/student-status/${matricula}`);
      const data = response.data;

      // Valida existência de vínculo (mesmo que status esteja zoado)
      if (!data || !data.asset_id) {
        addToast('Este aluno não possui nenhum tablet vinculado para troca.', 'warning');
        setLoading(false);
        return;
      }

      setStudentData(data);

      // >>> PREENCHE DADOS DO ANTIGO COM O QUE TEM NO BANCO <<<
      setOldImei(data.imei || '');
      setOldSim(data.sim_card_number || '');

      setStep(2);
    } catch (error: any) {
      addToast(error.response?.data?.message || 'Erro ao buscar aluno.', 'error');
    } finally { setLoading(false); }
  };

  // BUSCA INTELIGENTE (NOVO TABLET)
  const handleSearchTablet = async () => {
    if (!searchTerm || searchTerm.length < 3) return addToast('Digite pelo menos 3 caracteres.', 'warning');
    setIsSearching(true);
    setFoundNewTablet(null);
    setSearchList([]);

    try {
      const response = await axios.get(`${API_URL}/assets/search-available?query=${searchTerm}`);
      const results = response.data;

      // Filtra apenas TABLETS
      const tabletsOnly = results.filter((a: any) => {
        const type = (a.item_type_name || '').toLowerCase();
        return type.includes('tablet') || type.includes('ipad') || type.includes('galaxy') || type.includes('tab');
      });

      if (tabletsOnly.length === 0) {
        addToast('Nenhum tablet disponível encontrado.', 'info');
      } else if (tabletsOnly.length === 1 && (tabletsOnly[0].patrimonio_number === searchTerm || tabletsOnly[0].serial_number === searchTerm)) {
        selectTablet(tabletsOnly[0]);
        addToast('Tablet identificado!', 'success');
      } else {
        setSearchList(tabletsOnly);
      }
    } catch (error) {
      console.error(error);
      addToast('Erro na busca.', 'error');
    } finally {
      setIsSearching(false);
    }
  };

  const selectTablet = (asset: any) => {
    setFoundNewTablet(asset);
    setSearchList([]);
    setSearchTerm(asset.patrimonio_number || asset.serial_number);

    // >>> PREENCHE DADOS DO NOVO <<<
    setNewImei(asset.imei || '');
    setNewSim(asset.sim_card_number || '');

    // Se já tem chip no banco, marca a checkbox automaticamente
    if (asset.sim_card_number) {
      setLinkNewSim(true);
    } else {
      setLinkNewSim(false);
    }
  };

  // PASSO FINAL: Executar Troca
  const handleExecute = async () => {
    if (!foundNewTablet) return addToast('Selecione o novo tablet.', 'warning');
    if (!reason) return addToast('Informe o motivo da troca.', 'warning');

    // Validação do Chip Novo (Se marcado para vincular)
    if (linkNewSim && (!newSim || newSim.replace(/\D/g, '').length < 10)) {
      if (!window.confirm("O número do Chip Novo parece incompleto. Deseja prosseguir mesmo assim?")) return;
    }

    if (!window.confirm(`Confirma a troca e a atualização dos dados cadastrais?`)) return;

    setLoading(true);
    try {
      const response = await axios.post(`${API_URL}/tablets/substitute`, {
        student_id: studentData.student_id,
        old_item_id: studentData.item_id,
        old_asset_id: studentData.asset_id,
        batch_id: studentData.batch_id,

        new_asset_patrimonio: foundNewTablet.patrimonio_number,
        new_asset_serial: foundNewTablet.serial_number, // Fallback

        reason: reason,

        // >>> DADOS DE SANEAMENTO (ANTIGO) <<<
        old_asset_updates: {
          imei: oldImei,
          sim_card_number: oldSim // Se vier vazio, o backend deve setar NULL
        },

        // >>> DADOS DE SANEAMENTO (NOVO) <<<
        new_asset_updates: {
          imei: newImei,
          sim_card_number: linkNewSim ? newSim : null // Se desmarcado, remove chip
        }
      });

      addToast('Substituição realizada e cadastro atualizado!', 'success');

      if (window.confirm('Deseja imprimir o Novo Termo Individual agora?')) {
        const termRes = await axios.get(`${API_URL}/reports/delivery-item/${response.data.newItemId}/term`, { responseType: 'blob' });
        const url = window.URL.createObjectURL(new Blob([termRes.data]));
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `Novo_Termo_${studentData.student_name}.pdf`);
        document.body.appendChild(link);
        link.click();
      }
      onClose();
    } catch (error: any) {
      addToast(error.response?.data?.message || 'Erro na troca.', 'error');
    } finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 bg-gray-900 bg-opacity-75 flex items-center justify-center z-[1002] p-4">
      <div className="bg-white p-6 rounded-xl shadow-2xl w-full max-w-lg relative flex flex-col max-h-[90vh]">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-500 hover:text-gray-800"><X className="w-6 h-6" /></button>
        <h2 className="text-xl font-bold text-blue-900 mb-4">Substituição de Tablet (Escolar)</h2>

        {step === 1 && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Matrícula do Aluno</label>
              <input
                type="text"
                value={matricula}
                onChange={e => setMatricula(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSearchStudent()}
                className="w-full p-2 border rounded mt-1"
                placeholder="Digite a matrícula..."
                autoFocus
              />
            </div>
            <button onClick={handleSearchStudent} disabled={loading} className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 disabled:opacity-50 font-bold">
              {loading ? 'Buscando...' : 'Consultar Aluno'}
            </button>
          </div>
        )}

        {step === 2 && studentData && (
          <div className="space-y-4 overflow-y-auto pr-2 pb-2">

            {/* === CARTÃO VERMELHO: DEVOLUÇÃO === */}
            <div className="bg-red-50 p-3 rounded border border-red-200">
              <h3 className="font-bold text-red-800 mb-2 border-b border-red-200 pb-1 flex justify-between">
                <span>Equipamento a Devolver</span>
                <span className="text-xs bg-red-200 px-2 rounded">SAI DO ALUNO</span>
              </h3>
              <div className="text-sm text-gray-700 mb-2">
                <p><strong>Aluno:</strong> {studentData.student_name}</p>
                <p><strong>Patrimônio:</strong> {studentData.patrimonio_number}</p>
              </div>

              {/* Campos Editáveis para Saneamento */}
              <div className="grid grid-cols-2 gap-2 mt-2">
                <div>
                  <label className="block text-xs font-bold text-red-700 mb-1">Confira o IMEI</label>
                  <input
                    type="text"
                    value={oldImei}
                    onChange={e => setOldImei(e.target.value)}
                    className="w-full p-1 text-xs border border-red-300 rounded"
                    placeholder="IMEI do devolvido..."
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-red-700 mb-1">Confira o Chip</label>
                  <InputMask mask="(99) 99999-9999" value={oldSim} onChange={e => setOldSim(e.target.value)}>
                    {(inputProps: any) => <input {...inputProps} type="text" className="w-full p-1 text-xs border border-red-300 rounded" placeholder="Limpe se extraviado" />}
                  </InputMask>
                </div>
              </div>
              <p className="text-[10px] text-red-600 mt-1">* Se o chip foi extraviado, limpe o campo acima.</p>
            </div>

            {/* === CARTÃO VERDE: ENTRADA === */}
            <div className="bg-green-50 p-3 rounded border border-green-200">
              <h3 className="font-bold text-green-800 mb-2 border-b border-green-200 pb-1 flex justify-between">
                <span>Novo Equipamento</span>
                <span className="text-xs bg-green-200 px-2 rounded">ENTRA PARA ALUNO</span>
              </h3>

              {/* Busca */}
              <div className="flex gap-2 mb-2">
                <input
                  type="text"
                  value={searchTerm}
                  onChange={e => { setSearchTerm(e.target.value); setFoundNewTablet(null); setSearchList([]); }}
                  onKeyDown={e => e.key === 'Enter' && handleSearchTablet()}
                  className="w-full p-2 border rounded text-sm focus:ring-2 focus:ring-green-500 outline-none"
                  placeholder="Bipe ou digite o modelo..."
                />
                <button onClick={handleSearchTablet} disabled={isSearching} className="bg-green-600 text-white px-3 rounded hover:bg-green-700">
                  <Search className="w-4 h-4" />
                </button>
              </div>

              {/* Resultados Lista */}
              {searchList.length > 0 && (
                <div className="mt-2 max-h-32 overflow-y-auto bg-white border rounded shadow-inner mb-2">
                  <table className="w-full text-xs text-left">
                    <tbody>
                      {searchList.map(t => (
                        <tr key={t.id} className="border-b hover:bg-green-100 cursor-pointer" onClick={() => selectTablet(t)}>
                          <td className="p-2 font-medium">{t.brand} {t.model}</td>
                          <td className="p-2 text-gray-500">{t.patrimonio_number}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Dados do Selecionado */}
              {foundNewTablet && (
                <div className="animate-fadeIn">
                  <div className="p-2 bg-white rounded border border-green-300 flex items-center text-sm text-green-800 mb-2">
                    <CheckCircle className="w-4 h-4 mr-2 text-green-600" />
                    <div className="font-bold">{foundNewTablet.brand} {foundNewTablet.model} ({foundNewTablet.patrimonio_number})</div>
                  </div>

                  {/* Configuração de Chip do Novo */}
                  <div className="bg-white p-2 rounded border border-green-200">
                    <label className="flex items-center space-x-2 mb-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={linkNewSim}
                        onChange={e => setLinkNewSim(e.target.checked)}
                        className="rounded text-green-600 focus:ring-green-500"
                      />
                      <span className="text-sm font-bold text-gray-700">Entregar com Chip/Conectividade?</span>
                    </label>

                    {linkNewSim && (
                      <div className="grid grid-cols-2 gap-2 animate-fadeIn">
                        <div>
                          <label className="block text-xs font-bold text-gray-500 mb-1">IMEI do Novo</label>
                          <input type="text" value={newImei} onChange={e => setNewImei(e.target.value)} className="w-full p-1 text-xs border rounded" />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-gray-500 mb-1">Nº Chip do Novo</label>
                          <InputMask mask="(99) 99999-9999" value={newSim} onChange={e => setNewSim(e.target.value)}>
                            {(inputProps: any) => <input {...inputProps} type="text" className="w-full p-1 text-xs border rounded" placeholder="Obrigatório" required />}
                          </InputMask>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Motivo da Troca</label>
              <textarea value={reason} onChange={e => setReason(e.target.value)} className="w-full p-2 border rounded mt-1 text-sm" rows={2} placeholder="Ex: Tela quebrada, não liga..."></textarea>
            </div>

            <div className="flex gap-2 pt-2 border-t mt-2">
              <button onClick={() => setStep(1)} className="w-1/3 bg-gray-200 text-gray-800 py-2 rounded font-medium">Voltar</button>
              <button onClick={handleExecute} disabled={loading} className="w-2/3 bg-blue-600 text-white py-2 rounded hover:bg-blue-700 disabled:opacity-50 font-bold shadow flex justify-center items-center">
                {loading ? 'Processando...' : <><Save className="w-4 h-4 mr-2" /> Confirmar e Salvar</>}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// ============================================================================
// MODAL DE TRANSFERÊNCIA DE ALUNO (LISTA FILTRADA E BUSCA OTIMIZADA)
// ============================================================================
interface StudentTransferModalProps {
  onClose: () => void;
  API_URL: string;
  addToast: any;
  triggerRefresh: () => void;
  schools: any[]; // Recebe a lista de escolas ativas (com alunos/censo)
}

const StudentTransferModal: React.FC<StudentTransferModalProps> = ({ onClose, API_URL, addToast, triggerRefresh, schools }) => {
  const [step, setStep] = useState(1);
  const [matricula, setMatricula] = useState('');
  const [studentData, setStudentData] = useState<any>(null);
  const [newSchoolId, setNewSchoolId] = useState('');
  const [loading, setLoading] = useState(false);

  // Prepara as opções para o Select (Formato { value, label })
  // Ordena alfabeticamente para facilitar
  const schoolOptions = useMemo(() => {
    return schools
      .map(s => ({
        value: s.id.toString(),
        label: s.name, // O react-select busca automaticamente pelo label
        rpa: s.rpa // Guardamos o RPA se quiser mostrar depois
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [schools]);

  const handleSearch = async () => {
    if (!matricula) return addToast('Digite a matrícula.', 'warning');
    setLoading(true);
    try {
      const response = await axios.get(`${API_URL}/tablets/student-status/${matricula}`);
      setStudentData(response.data);
      setStep(2);
    } catch (error: any) {
      if (error.response?.status === 404) {
        addToast('Aluno não encontrado na base de Tablets. Verifique a matrícula.', 'error');
      } else {
        addToast('Erro ao buscar aluno.', 'error');
      }
    } finally { setLoading(false); }
  };

  const handleTransfer = async () => {
    if (!newSchoolId) return addToast('Selecione a nova escola de destino.', 'warning');

    // Validação: Mesma escola
    if (studentData.school_unit_id && String(studentData.school_unit_id) === String(newSchoolId)) {
      return addToast('O aluno já está alocado nesta escola.', 'warning');
    }

    let confirmMsg = `Confirma a transferência de ${studentData.student_name}?`;

    if (studentData.delivery_status === 'planejada') {
      confirmMsg += `\n\nATENÇÃO: O tablet planejado será desvinculado e voltará ao estoque.`;
    } else if (['realizada', 'confirmed'].includes(studentData.delivery_status)) {
      confirmMsg += `\n\nNOTA: O histórico do tablet entregue será atualizado para a nova escola.`;
    }

    if (!window.confirm(confirmMsg)) return;

    setLoading(true);
    try {
      await axios.put(`${API_URL}/tablets/students/transfer`, {
        student_registration: matricula,
        new_school_id: newSchoolId
      });
      addToast('Transferência realizada com sucesso!', 'success');
      triggerRefresh();
      onClose();
    } catch (error: any) {
      addToast(error.response?.data?.message || 'Erro ao transferir.', 'error');
    } finally { setLoading(false); }
  };

  const renderStatusBadge = (status: string) => {
    switch (status) {
      case 'planejada': return <span className="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs font-bold rounded">Tablet Planejado</span>;
      case 'realizada':
      case 'confirmed': return <span className="px-2 py-1 bg-green-100 text-green-800 text-xs font-bold rounded">Tablet Entregue</span>;
      case 'devolvido': return <span className="px-2 py-1 bg-gray-100 text-gray-800 text-xs font-bold rounded">Tablet Devolvido</span>;
      default: return <span className="px-2 py-1 bg-blue-50 text-blue-800 text-xs font-bold rounded">Sem Tablet</span>;
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-900 bg-opacity-75 flex items-center justify-center z-[1002] p-4">
      <div className="bg-white p-6 rounded-xl shadow-2xl w-full max-w-lg relative">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-500 hover:text-gray-800"><X className="w-6 h-6" /></button>

        <h2 className="text-xl font-bold text-blue-900 mb-1 flex items-center">
          <ArrowRightLeft className="w-6 h-6 mr-2" /> Transferência de Aluno
        </h2>
        <p className="text-sm text-gray-500 mb-6">Mover aluno entre escolas ativas.</p>

        {step === 1 && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Matrícula do Aluno</label>
              <input type="text" value={matricula} onChange={e => setMatricula(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSearch()} className="w-full p-2 border rounded mt-1 outline-none focus:ring-2 focus:ring-blue-500" placeholder="Digite a matrícula..." autoFocus />
            </div>
            <button onClick={handleSearch} disabled={loading} className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 font-bold disabled:opacity-50">
              {loading ? 'Buscando...' : 'Consultar Situação'}
            </button>
          </div>
        )}

        {step === 2 && studentData && (
          <div className="space-y-5 animate-fadeIn">
            <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
              <div className="flex items-start mb-3">
                <UserCircle className="w-10 h-10 text-gray-400 mr-3 mt-1" />
                <div>
                  <h3 className="font-bold text-gray-900 text-lg">{studentData.student_name}</h3>
                  <p className="text-sm text-gray-500">
                    Matrícula: <span className="font-mono font-bold text-gray-700">{studentData.student_registration || matricula}</span>
                  </p>
                </div>
              </div>
              <div className="space-y-2 text-sm border-t border-gray-200 pt-3">
                <div className="flex justify-between">
                  <span className="text-gray-500">Escola Atual:</span>
                  <span className="font-medium text-gray-800 text-right">{studentData.school_name || 'Não alocado'}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-500">Status Tablet:</span>
                  {renderStatusBadge(studentData.delivery_status)}
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-blue-900 mb-1">Nova Escola de Destino</label>
              {/* REACT-SELECT COM BUSCA HABILITADA */}
              <Select
                options={schoolOptions}
                onChange={o => setNewSchoolId(o?.value || '')}
                placeholder="Digite o nome da escola para buscar..."
                className="mt-1 text-sm"
                noOptionsMessage={() => "Nenhuma escola ativa encontrada"}
                isClearable
                isSearchable // Garante que o usuário pode digitar
              />
              <p className="text-xs text-gray-500 mt-1">
                * Lista restrita às escolas com censo ativo ({schoolOptions.length} unidades).
              </p>
            </div>

            <div className="flex gap-2 pt-2">
              <button onClick={() => { setStep(1); setStudentData(null); }} className="w-1/3 bg-gray-200 text-gray-800 py-2 rounded font-medium">Voltar</button>
              <button onClick={handleTransfer} disabled={loading} className="w-2/3 bg-blue-600 text-white py-2 rounded hover:bg-blue-700 font-bold shadow disabled:opacity-50">
                {loading ? 'Processando...' : 'Confirmar Transferência'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// ============================================================================
// MODAL DE CONFIRMAÇÃO (CORRIGIDO: ERROS DE TYPESCRIPT)
// ============================================================================

// 1. Definimos o formato do nosso Checklist
interface CheckListState {
  [key: string]: {
    received: boolean;
    reason: string;
  };
}

interface BatchConfirmationModalProps {
  onClose: () => void;
  onConfirm: (file: File, exceptions: any[]) => Promise<void>;
  batchName: string;
  items: any[];
}

const BatchConfirmationModal: React.FC<BatchConfirmationModalProps> = ({ onClose, onConfirm, batchName, items }) => {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);

  // 2. Aplicamos o tipo ao useState para o TS entender a estrutura
  const [checkList, setCheckList] = useState<CheckListState>({});

  // Inicializa a lista
  useEffect(() => {
    // 3. Tipamos a variável 'initial' para permitir a atribuição dinâmica
    const initial: CheckListState = {};
    items.forEach((i: any) => {
      initial[i.id] = { received: true, reason: '' };
    });
    setCheckList(initial);
  }, [items]);

  const toggleItem = (id: number) => {
    setCheckList(prev => ({
      ...prev,
      [id]: { ...prev[id], received: !prev[id].received }
    }));
  };

  const updateReason = (id: number, reason: string) => {
    setCheckList(prev => ({
      ...prev,
      [id]: { ...prev[id], reason }
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return alert("Por favor, anexe o recibo assinado.");

    const exceptions = [];
    // 4. Agora o TS sabe que 'data' tem 'received' e 'reason'
    for (const [id, data] of Object.entries(checkList)) {
      if (data.received === false) {
        if (!data.reason) return alert("Informe o motivo para os itens não entregues.");
        exceptions.push({ itemId: id, reason: data.reason });
      }
    }

    setLoading(true);
    await onConfirm(file, exceptions);
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 bg-gray-900 bg-opacity-75 flex items-center justify-center z-[1003] p-4">
      <div className="bg-white p-6 rounded-xl shadow-2xl w-full max-w-2xl relative max-h-[90vh] overflow-y-auto">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-500 hover:text-gray-800"><X className="w-6 h-6" /></button>
        <h2 className="text-xl font-bold text-green-700 mb-2 flex items-center">
          <CheckCircle className="w-6 h-6 mr-2" /> Conferência de Entrega
        </h2>
        <p className="text-sm text-gray-600 mb-4">Desmarque os alunos que <b>NÃO</b> receberam o tablet.</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* LISTA DE CONFERÊNCIA */}
          <div className="border rounded overflow-hidden max-h-60 overflow-y-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-100 font-bold text-xs uppercase">
                <tr>
                  <th className="p-3 w-10">Recebeu?</th>
                  <th className="p-3">Aluno</th>
                  <th className="p-3">Motivo (se não)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {items.map((item: any) => (
                  <tr key={item.id} className={!checkList[item.id]?.received ? 'bg-red-50' : ''}>
                    <td className="p-3 text-center">
                      <input
                        type="checkbox"
                        checked={checkList[item.id]?.received ?? true}
                        onChange={() => toggleItem(item.id)}
                        className="w-5 h-5 text-green-600 rounded focus:ring-green-500 cursor-pointer"
                      />
                    </td>
                    <td className="p-3">
                      <p className="font-medium">{item.student_name}</p>
                      <p className="text-xs text-gray-500">{item.patrimonio_number}</p>
                    </td>
                    <td className="p-3">
                      {!checkList[item.id]?.received && (
                        <select
                          className="w-full p-1 border rounded text-xs border-red-300 bg-white"
                          value={checkList[item.id]?.reason}
                          onChange={e => updateReason(item.id, e.target.value)}
                          required
                        >
                          <option value="">Selecione o motivo...</option>
                          <option value="Transferido de Unidade">Transferido de Unidade</option>
                          <option value="Transferido da Rede">Transferido da Rede</option>
                          <option value="Abandono / Evasão">Abandono / Evasão</option>
                          <option value="Nunca Compareceu">Nunca Compareceu</option>
                          <option value="Falecimento">Falecimento</option>
                          <option value="Recusa do Responsável">Recusa do Responsável</option>
                          <option value="Defeito Técnico">Defeito Técnico</option>
                          <option value="Outros">Outros</option>
                        </select>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="bg-blue-50 p-4 rounded border border-blue-200">
            <label className="block text-sm font-medium text-blue-800 mb-2">Anexar Recibo Assinado (com ressalvas) *</label>
            <input
              type="file"
              accept=".pdf,.jpg,.jpeg,.png"
              onChange={(e) => setFile(e.target.files ? e.target.files[0] : null)}
              className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
              required
            />
            <p className="text-xs text-gray-400 mt-1">Formatos: PDF, JPG ou PNG.</p>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-200 rounded-lg hover:bg-gray-300">Cancelar</button>
            <button type="submit" disabled={loading} className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 font-bold">
              {loading ? 'Processando...' : 'Confirmar Conferência'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ============================================================================
// MODAL DE ENTREGA AVULSA / COMPLEMENTAR (COM DATA DE PREVISÃO)
// ============================================================================
interface QuickDeliveryModalProps {
  onClose: () => void;
  API_URL: string;
  addToast: any;
  schools: any[];
  triggerRefresh: () => void;
}

const QuickDeliveryModal: React.FC<QuickDeliveryModalProps> = ({ onClose, API_URL, addToast, schools, triggerRefresh }) => {
  const [matricula, setMatricula] = useState('');
  const [nome, setNome] = useState('');
  const [ano, setAno] = useState('');
  const [turma, setTurma] = useState('');
  const [pcd, setPcd] = useState('');
  const [selectedSchoolId, setSelectedSchoolId] = useState('');

  // >>> NOVO ESTADO <<<
  const [scheduledDate, setScheduledDate] = useState('');

  const [studentList, setStudentList] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const handleBlurMatricula = async () => {
    if (matricula.length < 4) return;
    try {
      const res = await axios.get(`${API_URL}/tablets/student-status/${matricula}`);
      const data = res.data;
      if (data) {
        if (['realizada', 'confirmed'].includes(data.delivery_status)) {
          alert(`ALERTA: O aluno ${data.student_name} JÁ RECEBEU um tablet.`);
          setMatricula(''); return;
        }
        if (selectedSchoolId && data.school_unit_id && data.school_unit_id.toString() !== selectedSchoolId) {
          alert(`ERRO: O aluno pertence à escola "${data.school_name}".`);
          setMatricula(''); return;
        }
        setNome(data.student_name || '');
        setAno(data.education_year || '');
        setTurma(data.class_name || '');
        setPcd(data.pcd_type || '');
        if (!selectedSchoolId && data.school_unit_id) setSelectedSchoolId(data.school_unit_id.toString());
        addToast('Dados carregados.', 'success');
      }
    } catch (e) { if (selectedSchoolId && !nome) addToast('Aluno novo. Preencha os dados.', 'info'); }
  };

  const handleAddToList = () => {
    if (!matricula || !nome || !selectedSchoolId) return addToast('Dados obrigatórios faltando.', 'warning');
    if (studentList.some(s => s.registration === matricula)) return addToast('Aluno já está na lista.', 'warning');
    setStudentList(prev => [...prev, { registration: matricula, name: nome, year: ano, class_name: turma, pcd: pcd }]);
    setMatricula(''); setNome(''); setAno(''); setTurma(''); setPcd('');
  };

  const handleRemoveFromList = (index: number) => { setStudentList(prev => prev.filter((_, i) => i !== index)); };

  const handleProcessBatch = async () => {
    if (studentList.length === 0) return;
    if (!scheduledDate) return addToast('Informe a data de previsão de entrega.', 'warning'); // Validação da data
    if (!window.confirm(`Gerar lote complementar para ${studentList.length} alunos?`)) return;

    setLoading(true);
    try {
      await axios.post(`${API_URL}/tablets/complementary-batch`, {
        school_unit_id: selectedSchoolId,
        students: studentList,
        scheduled_date: scheduledDate // Envia a data
      });
      addToast('Lote criado e tablets distribuídos!', 'success');
      triggerRefresh();
      onClose();
    } catch (error: any) {
      addToast(error.response?.data?.message || 'Erro.', 'error');
    } finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 bg-gray-900 bg-opacity-75 flex items-center justify-center z-[1005] p-4">
      <div className="bg-white p-6 rounded-xl shadow-2xl w-full max-w-3xl relative max-h-[90vh] overflow-y-auto">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-500 hover:text-gray-800"><X className="w-6 h-6" /></button>
        <h2 className="text-xl font-bold text-blue-900 mb-2 flex items-center"><CheckCircle className="w-6 h-6 mr-2 text-green-600" /> Entrega Complementar</h2>
        <p className="text-sm text-gray-500 mb-6">Cadastre alunos não planejados para entrega imediata.</p>

        {/* 1. Configuração do Lote (Escola e Data) */}
        <div className="mb-4 p-3 bg-blue-50 rounded border border-blue-100 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-blue-800 uppercase mb-1">Unidade Escolar</label>
            <Select
              options={schools.map(u => ({ value: u.id.toString(), label: u.name }))}
              onChange={o => { setSelectedSchoolId(o?.value || ''); setStudentList([]); }}
              value={schools.map(u => ({ value: u.id.toString(), label: u.name })).find(o => o.value === selectedSchoolId)}
              placeholder="Selecione a Escola..."
              isDisabled={studentList.length > 0}
            />
          </div>
          {/* >>> CAMPO DE DATA ADICIONADO <<< */}
          <div>
            <label className="block text-xs font-bold text-blue-800 uppercase mb-1">Previsão de Entrega</label>
            <input
              type="date"
              value={scheduledDate}
              onChange={e => setScheduledDate(e.target.value)}
              className="w-full p-2 border rounded bg-white text-sm"
              required
            />
          </div>
        </div>

        {/* 2. Formulário Aluno */}
        <div className="grid grid-cols-12 gap-3 mb-3">
          <div className="col-span-3">
            <label className="text-xs font-bold text-gray-600">Matrícula *</label>
            <input type="text" value={matricula} onChange={e => setMatricula(e.target.value)} onBlur={handleBlurMatricula} className="w-full p-2 border rounded text-sm" />
          </div>
          <div className="col-span-9">
            <label className="text-xs font-bold text-gray-600">Nome do Aluno *</label>
            <input type="text" value={nome} onChange={e => setNome(e.target.value)} className="w-full p-2 border rounded text-sm" />
          </div>
        </div>

        <div className="grid grid-cols-12 gap-3 items-end">
          {/* SELECT DE ANO */}
          <div className="col-span-4">
            <label className="text-xs font-bold text-gray-600">Ano Escolar</label>
            <select
              value={ano}
              onChange={e => setAno(e.target.value)}
              className="w-full p-2 border rounded text-sm bg-white"
            >
              <option value="">Selecione...</option>
              {EDUCATION_YEARS.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>

          {/* SELECT DE TURMA */}
          <div className="col-span-2">
            <label className="text-xs font-bold text-gray-600">Turma</label>
            <select
              value={turma}
              onChange={e => setTurma(e.target.value)}
              className="w-full p-2 border rounded text-sm bg-white"
            >
              <option value="">--</option>
              {CLASS_NAMES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          {/* SELECT DE PCD */}
          <div className="col-span-4">
            <label className="text-xs font-bold text-gray-600">PCD</label>
            <select
              value={pcd}
              onChange={e => setPcd(e.target.value)}
              className="w-full p-2 border rounded text-sm bg-white"
            >
              <option value="">Não / Se houver...</option>
              {PCD_TYPES.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>

          <div className="col-span-2">
            <button onClick={handleAddToList} type="button" className="w-full bg-blue-600 text-white p-2 rounded hover:bg-blue-700 text-sm font-bold shadow-sm">+ Incluir</button>
          </div>
        </div>

        {/* 3. Tabela */}
        <div className="border rounded overflow-hidden mb-4">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-100 text-gray-600 font-bold text-xs uppercase"><tr><th className="p-3">Matrícula</th><th className="p-3">Nome</th><th className="p-3">Ano</th><th className="p-3">PCD</th><th className="p-3 text-right"></th></tr></thead>
            <tbody className="divide-y divide-gray-100">
              {studentList.map((s, i) => (
                <tr key={i}>
                  <td className="p-3">{s.registration}</td>
                  <td className="p-3 font-medium">{s.name}</td>
                  <td className="p-3">{s.year} {s.class_name}</td>
                  <td className="p-3">{s.pcd || '-'}</td>
                  <td className="p-3 text-right"><button onClick={() => handleRemoveFromList(i)} className="text-red-500 hover:text-red-700"><X className="w-4 h-4" /></button></td>
                </tr>
              ))}
              {studentList.length === 0 && <tr><td colSpan={5} className="p-6 text-center text-gray-400">Lista vazia.</td></tr>}
            </tbody>
          </table>
        </div>

        <div className="flex justify-between items-center pt-4 border-t">
          <span className="text-sm text-gray-600 font-medium">Total: {studentList.length} alunos</span>
          <button onClick={handleProcessBatch} disabled={loading || studentList.length === 0} className="bg-green-600 text-white px-6 py-3 rounded-lg font-bold hover:bg-green-700 disabled:opacity-50 shadow flex items-center">
            {loading ? 'Processando...' : 'Concluir e Gerar Documentos'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// MODAL DE DEVOLUÇÃO RÁPIDA (COM AUTO-BUSCA)
// ============================================================================
interface QuickReturnModalProps {
  onClose: () => void;
  API_URL: string;
  addToast: any;
  triggerRefresh: () => void;
  initialMatricula?: string; // <<< NOVA PROP OPCIONAL
}

const QuickReturnModal: React.FC<QuickReturnModalProps> = ({ onClose, API_URL, addToast, triggerRefresh, initialMatricula }) => {
  const [step, setStep] = useState(1);
  const [matricula, setMatricula] = useState(initialMatricula || '');
  const [loading, setLoading] = useState(false);
  const [studentData, setStudentData] = useState<any>(null);
  const [reason, setReason] = useState('');

  // Efeito para disparar a busca automática se vier matrícula pronta
  useEffect(() => {
    if (initialMatricula) {
      handleSearch(initialMatricula);
    }
  }, []); // Roda apenas na montagem

  const handleSearch = async (matr = matricula) => {
    if (!matr) return addToast('Digite a matrícula.', 'warning');
    setLoading(true);
    try {
      const response = await axios.get(`${API_URL}/tablets/student-status/${matr}`);
      const data = response.data;

      if (data.delivery_status === 'devolvido') {
        addToast(`O aluno ${data.student_name} JÁ DEVOLVEU este equipamento.`, 'warning');
        setLoading(false);
        // Se foi auto-busca, fecha o modal para não ficar travado
        if (initialMatricula) onClose();
        return;
      }
      if (!data.asset_id) {
        addToast('Aluno não possui tablet vinculado para devolução.', 'error');
        setLoading(false);
        if (initialMatricula) onClose();
        return;
      }

      setStudentData(data);
      setStep(2);
    } catch (error: any) {
      addToast(error.response?.data?.message || 'Aluno não encontrado.', 'error');
      if (initialMatricula) onClose();
    } finally { setLoading(false); }
  };

  const handleConfirmReturn = async () => {
    if (!reason) return addToast('O motivo é obrigatório.', 'warning');

    const confirmMsg = `ATENÇÃO: Confirma a devolução deste equipamento?\n\n` +
      `O Tablet (Tombo: ${studentData.patrimonio_number}) voltará para o estoque 'Disponível'.\n` +
      `Certifique-se que o CHIP ${studentData.sim_card_number || '(S/N)'} está presente.`;

    if (!window.confirm(confirmMsg)) return;

    setLoading(true);
    try {
      await axios.post(`${API_URL}/delivery-batch-items/${studentData.item_id}/return`, { reason });
      addToast('Devolução registrada com sucesso!', 'success');
      triggerRefresh();
      onClose();
    } catch (error: any) {
      addToast(error.response?.data?.message || 'Erro ao devolver.', 'error');
    } finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 bg-gray-900 bg-opacity-75 flex items-center justify-center z-[1006] p-4">
      <div className="bg-white p-6 rounded-xl shadow-2xl w-full max-w-lg relative">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-500 hover:text-gray-800"><X className="w-6 h-6" /></button>

        <h2 className="text-xl font-bold text-orange-700 mb-4 flex items-center">
          <CornerUpLeft className="w-6 h-6 mr-2" /> Devolução de Tablet
        </h2>

        {step === 1 && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">Informe a matrícula para localizar o equipamento.</p>
            <div>
              <label className="block text-sm font-medium text-gray-700">Matrícula</label>
              <input
                type="text"
                value={matricula}
                onChange={e => setMatricula(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSearch()}
                className="w-full p-3 border rounded mt-1 text-lg font-mono tracking-widest outline-none focus:ring-2 focus:ring-orange-500"
                placeholder="Ex: 22135820"
                autoFocus
              />
            </div>
            <button onClick={() => handleSearch()} disabled={loading} className="w-full bg-orange-600 text-white py-3 rounded hover:bg-orange-700 disabled:opacity-50 font-bold shadow">
              {loading ? 'Consultando...' : 'Buscar Aluno e Ativo'}
            </button>
          </div>
        )}

        {/* PASSO 2: CONFERÊNCIA DETALHADA (Mesmo layout rico que criamos antes) */}
        {step === 2 && studentData && (
          <div className="space-y-5 animate-fadeIn">
            <div className="bg-gray-50 rounded-lg border border-gray-200 overflow-hidden">
              <div className="bg-gray-100 p-3 border-b border-gray-200 flex justify-between items-start">
                <div>
                  <h3 className="font-bold text-gray-800 text-sm">{studentData.student_name}</h3>
                  <p className="text-xs text-gray-500">{studentData.school_name}</p>
                </div>
                <span className="bg-white text-gray-600 text-xs px-2 py-1 rounded border font-mono">
                  {studentData.student_registration || matricula}
                </span>
              </div>

              <div className="p-3 grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase">Patrimônio (Tombo)</label>
                  <div className="font-bold text-gray-800 text-sm flex items-center">
                    <HardDrive className="w-3 h-3 mr-1 text-blue-500" />
                    {studentData.patrimonio_number}
                  </div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase mt-2">IMEI</label>
                  <div className="text-gray-600 text-xs font-mono">{studentData.imei || 'Não cadastrado'}</div>
                </div>

                <div className="bg-white p-2 rounded border border-orange-100">
                  <label className="block text-[10px] font-bold text-orange-600 uppercase flex items-center">
                    <Smartphone className="w-3 h-3 mr-1" /> Chip de Dados
                  </label>
                  {studentData.sim_card_number ? (
                    <div className="mt-1">
                      <span className="block text-lg font-bold text-gray-800 tracking-wide">{studentData.sim_card_number}</span>
                      <span className="text-[10px] text-green-600 font-bold bg-green-50 px-1 rounded">VINCULADO</span>
                    </div>
                  ) : (
                    <div className="mt-2 text-xs text-red-500 font-bold bg-red-50 p-1 rounded text-center">⚠️ SEM CHIP</div>
                  )}
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Motivo da Devolução *</label>
              <select value={reason} onChange={e => setReason(e.target.value)} className="w-full p-2 border rounded bg-white text-sm focus:ring-2 focus:ring-orange-500 outline-none" required>
                <option value="">Selecione o motivo...</option>
                <option value="Transferido de Unidade">Transferido de Unidade</option>
                <option value="Transferido da Rede">Transferido da Rede</option>
                <option value="Abandono / Evasão">Abandono / Evasão</option>
                <option value="Recusa do Responsável">Recusa do Responsável</option>
                <option value="Defeito Técnico">Defeito Técnico</option>
                <option value="Devolução Espontânea">Devolução Espontânea</option>
                <option value="Outros">Outros</option>
              </select>
            </div>

            <div className="flex gap-2 pt-2 border-t">
              <button onClick={() => { setStep(1); setStudentData(null); if (initialMatricula) onClose(); }} className="w-1/3 bg-gray-200 text-gray-800 py-2 rounded font-medium hover:bg-gray-300">Cancelar</button>
              <button onClick={handleConfirmReturn} disabled={loading} className="w-2/3 bg-orange-600 text-white py-2 rounded hover:bg-orange-700 disabled:opacity-50 font-bold shadow flex justify-center items-center">
                {loading ? 'Salvando...' : <><CornerUpLeft className="w-4 h-4 mr-2" /> Confirmar</>}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// ============================================================================
// MODAL: ADICIONAR ALUNO MANUALMENTE AO LOTE
// ============================================================================
interface AddStudentToBatchModalProps {
  onClose: () => void;
  onSuccess: () => void;
  API_URL: string;
  addToast: any;
  batchId: number;
}

const AddStudentToBatchModal: React.FC<AddStudentToBatchModalProps> = ({ onClose, onSuccess, API_URL, addToast, batchId }) => {
  const [matricula, setMatricula] = useState('');
  const [nome, setNome] = useState('');
  const [ano, setAno] = useState('');
  const [turma, setTurma] = useState('');
  const [pcd, setPcd] = useState('');
  const [loading, setLoading] = useState(false);

  // Busca dados se o aluno já existir em outra escola
  const handleBlur = async () => {
    if (matricula.length < 4) return;
    try {
      const res = await axios.get(`${API_URL}/tablets/student-status/${matricula}`);
      if (res.data) {
        setNome(res.data.student_name || '');
        setAno(res.data.education_year || '');
        setPcd(res.data.pcd_type || '');
        addToast('Cadastro encontrado. Confirme os dados para importar para este lote.', 'info');
      }
    } catch (e) { /* Aluno novo, segue o jogo */ }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await axios.post(`${API_URL}/delivery-batches/${batchId}/add-manual-student`, {
        student_registration: matricula,
        student_name: nome,
        education_year: ano,
        class_name: turma,
        pcd_type: pcd
      });
      addToast('Aluno adicionado e tablet vinculado!', 'success');
      onSuccess();
      onClose();
    } catch (error: any) {
      addToast(error.response?.data?.message || 'Erro ao adicionar.', 'error');
    } finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 bg-gray-900 bg-opacity-75 flex items-center justify-center z-[1006] p-4">
      <div className="bg-white p-6 rounded-xl shadow-2xl w-full max-w-md relative">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-500 hover:text-gray-800"><X className="w-6 h-6" /></button>
        <h2 className="text-xl font-bold text-blue-900 mb-4">Adicionar Aluno ao Lote</h2>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="text-xs font-bold text-gray-600">Matrícula *</label>
            <input className="w-full p-2 border rounded" value={matricula} onChange={e => setMatricula(e.target.value)} onBlur={handleBlur} required />
          </div>
          <div>
            <label className="text-xs font-bold text-gray-600">Nome *</label>
            <input className="w-full p-2 border rounded" value={nome} onChange={e => setNome(e.target.value)} required />
          </div>

          <div className="grid grid-cols-2 gap-2">
            {/* SELECT ANO */}
            <div>
              <label className="text-xs font-bold text-gray-600">Ano</label>
              <select
                className="w-full p-2 border rounded bg-white"
                value={ano}
                onChange={e => setAno(e.target.value)}
              >
                <option value="">Selecione...</option>
                {EDUCATION_YEARS.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>

            {/* SELECT TURMA */}
            <div>
              <label className="text-xs font-bold text-gray-600">Turma</label>
              <select
                className="w-full p-2 border rounded bg-white"
                value={turma}
                onChange={e => setTurma(e.target.value)}
              >
                <option value="">--</option>
                {CLASS_NAMES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          {/* SELECT PCD */}
          <div>
            <label className="text-xs font-bold text-gray-600">PCD</label>
            <select
              className="w-full p-2 border rounded bg-white"
              value={pcd}
              onChange={e => setPcd(e.target.value)}
            >
              <option value="">Selecione se houver...</option>
              {PCD_TYPES.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>

          <button type="submit" disabled={loading} className="w-full bg-green-600 text-white py-2 rounded font-bold hover:bg-green-700 disabled:opacity-50 mt-2">
            {loading ? 'Processando...' : 'Adicionar ao Lote'}
          </button>
        </form>
      </div>
    </div>
  );
};

// ============================================================================
// MODAL SIMPLES DE DEVOLUÇÃO (PARA CLIQUE NA TABELA)
// ============================================================================
interface SimpleReturnModalProps {
  onClose: () => void;
  onConfirm: (reason: string) => void;
  studentName: string;
}

const SimpleReturnModal: React.FC<SimpleReturnModalProps> = ({ onClose, onConfirm, studentName }) => {
  const [reason, setReason] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason) return alert('Selecione um motivo.');
    onConfirm(reason);
  };

  return (
    <div className="fixed inset-0 bg-gray-900 bg-opacity-75 flex items-center justify-center z-[1007] p-4">
      <div className="bg-white p-6 rounded-xl shadow-xl w-full max-w-sm relative">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-500 hover:text-gray-800"><X className="w-5 h-5" /></button>

        <h3 className="text-lg font-bold text-orange-700 mb-2 flex items-center">
          <CornerUpLeft className="w-5 h-5 mr-2" /> Devolver Item
        </h3>
        <p className="text-sm text-gray-600 mb-4">Registrar devolução do aluno: <b>{studentName}</b></p>

        <form onSubmit={handleSubmit}>
          <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Motivo da Devolução</label>
          <select
            className="w-full p-2 border rounded text-sm bg-white focus:ring-2 focus:ring-orange-500 outline-none"
            value={reason}
            onChange={e => setReason(e.target.value)}
            required
          >
            <option value="">Selecione...</option>
            <option value="Transferido de Unidade">Transferido de Unidade</option>
            <option value="Transferido da Rede">Transferido da Rede</option>
            <option value="Abandono / Evasão">Abandono / Evasão</option>
            <option value="Nunca Compareceu">Nunca Compareceu</option>
            <option value="Falecimento">Falecimento</option>
            <option value="Recusa do Responsável">Recusa do Responsável</option>
            <option value="Defeito Técnico">Defeito Técnico</option>
            <option value="Duplicidade">Duplicidade</option>
            <option value="Outros">Outros</option>
          </select>

          <div className="flex justify-end gap-2 mt-6">
            <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-100 rounded text-sm hover:bg-gray-200">Cancelar</button>
            <button type="submit" className="px-4 py-2 bg-orange-600 text-white rounded text-sm font-bold hover:bg-orange-700">Confirmar</button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ============================================================================
// MODAL DE SANEAMENTO DE LOTE (RESCUE BATCH VIA EXCEL)
// ============================================================================
interface RescueBatchModalProps {
  isOpen: boolean;
  onClose: () => void;
  units: any[];
  API_URL: string;
  addToast: any;
  onComplete: () => void;
}

const RescueBatchModal: React.FC<RescueBatchModalProps> = ({ isOpen, onClose, units, API_URL, addToast, onComplete }) => {
  const [selectedSchool, setSelectedSchool] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  if (!isOpen) return null;

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSchool) return addToast('Selecione a Escola.', 'warning');
    if (!file) return addToast('Selecione a planilha Excel.', 'warning');

    const formData = new FormData();
    formData.append('school_unit_id', selectedSchool);
    formData.append('file', file);

    setLoading(true);
    try {
      const response = await axios.post(`${API_URL}/tablets/import-rescue-batch`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setResult(response.data);
      addToast(response.data.message, 'success');
      if (onComplete) onComplete();
    } catch (error: any) {
      addToast(error.response?.data?.message || 'Erro ao processar arquivo.', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-gray-900 bg-opacity-75 backdrop-blur-sm p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg p-6 relative">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-700">
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center mb-4 text-orange-600">
          <AlertTriangleIcon className="w-6 h-6 mr-2" />
          <h2 className="text-xl font-bold">Saneamento de Lote (Retroativo)</h2>
        </div>

        <p className="text-sm text-gray-600 mb-6">
          Use para corrigir lotes que foram entregues fisicamente, mas perdidos no sistema. A planilha precisa das colunas <strong>MATRICULA</strong> e <strong>PATRIMONIO</strong>.
        </p>

        {!result ? (
          <form onSubmit={handleUpload} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Escola de Destino</label>
              <select
                value={selectedSchool}
                onChange={(e) => setSelectedSchool(e.target.value)}
                className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-orange-500 outline-none"
              >
                <option value="">-- Selecione a Escola --</option>
                {units.filter(u => u.type === 'ESCOLAR').map(u => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
            </div>

            <div className="border-2 border-dashed border-gray-300 rounded-xl p-6 text-center hover:bg-orange-50 transition-colors">
              <input
                type="file"
                accept=".xlsx, .csv"
                onChange={(e) => setFile(e.target.files ? e.target.files[0] : null)}
                className="hidden"
                id="rescue-file-upload"
              />
              <label htmlFor="rescue-file-upload" className="cursor-pointer flex flex-col items-center">
                <FileText className={`w-10 h-10 mb-2 ${file ? 'text-green-500' : 'text-gray-400'}`} />
                <span className="text-sm font-bold text-gray-700">
                  {file ? file.name : 'Clique para selecionar a planilha'}
                </span>
              </label>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-orange-600 hover:bg-orange-700 text-white font-bold py-3 rounded-lg flex items-center justify-center transition-colors shadow-sm disabled:opacity-50"
            >
              {loading ? 'Processando...' : <><UploadCloud className="w-5 h-5 mr-2" /> Iniciar Saneamento</>}
            </button>
          </form>
        ) : (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
            <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-2" />
            <h3 className="font-bold text-green-900 mb-2">{result.message}</h3>
            {result.errors?.length > 0 && (
              <div className="text-left bg-white p-3 rounded border border-red-100 mt-4 max-h-40 overflow-y-auto">
                <p className="text-xs font-bold text-red-600 mb-1">Avisos ({result.errors.length}):</p>
                <ul className="list-disc list-inside text-xs text-red-500">
                  {result.errors.map((err: string, i: number) => <li key={i}>{err}</li>)}
                </ul>
              </div>
            )}
            <button onClick={onClose} className="mt-4 px-6 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold rounded-lg transition-colors">
              Fechar
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

// MÓDULO DE ENTREGA DE TABLETS (Início)
// ============================================================================

interface TabletDeliveryPageProps {
  API_URL: string;
  units: Unit[];
  addToast: (message: string, type?: ToastType) => void;
  onImportResult: (result: { importedCount: number; errors: string[] }) => void;
  triggerRefresh: () => void;
}

const TabletDeliveryPage: React.FC<TabletDeliveryPageProps> = ({ API_URL, units, addToast, onImportResult, triggerRefresh }) => {
  const [batches, setBatches] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newBatchName, setNewBatchName] = useState('');
  const [selectedSchoolId, setSelectedSchoolId] = useState<string>('');
  const [activeSchools, setActiveSchools] = useState<any[]>([]);
  const [isSubstitutionModalOpen, setIsSubstitutionModalOpen] = useState(false);
  const [isQuickModalOpen, setIsQuickModalOpen] = useState(false);
  const [scheduledDate, setScheduledDate] = useState('');
  const [editingBatch, setEditingBatch] = useState<any | null>(null); // Para saber se estamos editando
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [isReturnModalOpen, setIsReturnModalOpen] = useState(false);
  const [isAddStudentModalOpen, setIsAddStudentModalOpen] = useState(false);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [isSimModalOpen, setIsSimModalOpen] = useState(false);
  const [isRescueModalOpen, setIsRescueModalOpen] = useState(false);
  const [itemToReturn, setItemToReturn] = useState<any>(null); // Guarda o item clicado
  const [filterRpa, setFilterRpa] = useState('');
  const [matriculaForReturn, setMatriculaForReturn] = useState<string | undefined>(undefined);
  const [batchFilterSchool, setBatchFilterSchool] = useState('');
  const [batchFilterStatus, setBatchFilterStatus] = useState('');
  const [batchFilterRpa, setBatchFilterRpa] = useState('');
  const [batchFilterDate, setBatchFilterDate] = useState('');
  const processConfirmation = async (file: File, exceptions: any[]) => {
    const fd = new FormData();
    fd.append('receiptFile', file);
    // Envia as exceções como string JSON
    fd.append('exceptions', JSON.stringify(exceptions));

    try {
      await axios.put(`${API_URL}/delivery-batches/${selectedBatch.id}/confirm`, fd);
      addToast('Lote confirmado e recibo arquivado!', 'success');

      // Limpa tudo e atualiza
      setIsConfirmModalOpen(false);
      setSelectedBatch(null);
      fetchBatches();
      triggerRefresh();
    } catch (error: any) {
      addToast(error.response?.data?.message || 'Erro ao confirmar.', 'error');
    }
  };

  // Detalhes do Lote
  const [selectedBatch, setSelectedBatch] = useState<any | null>(null);
  const [eligibleStudents, setEligibleStudents] = useState<any[]>([]);
  const [availableTablets, setAvailableTablets] = useState<any[]>([]);
  const [batchItems, setBatchItems] = useState<any[]>([]);

  const schoolUnits = useMemo(() => units.filter(u => u.type === 'ESCOLAR'), [units]);

  const fetchBatches = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await axios.get(`${API_URL}/delivery-batches`);
      setBatches(response.data);
    } catch (error) { addToast('Erro ao buscar lotes.', 'error'); }
    finally { setIsLoading(false); }
  }, [API_URL, addToast]);

  useEffect(() => { fetchBatches(); }, [fetchBatches]);

  const fetchBatchDetails = useCallback(async (batch: any) => {
    setSelectedBatch(batch);
    setIsLoading(true);
    try {
      const studentsRes = await axios.get(`${API_URL}/tablets/eligible-students/${batch.school_unit_id}`);
      setEligibleStudents(studentsRes.data);
      const tabletsRes = await axios.get(`${API_URL}/tablets/available-assets`);
      setAvailableTablets(tabletsRes.data);
      const itemsRes = await axios.get(`${API_URL}/delivery-batches/${batch.id}/items`);
      setBatchItems(itemsRes.data);
    } catch (error) { addToast('Erro ao carregar dados.', 'error'); }
    finally { setIsLoading(false); }
  }, [API_URL, addToast]);

  const fetchActiveSchools = useCallback(async () => {
    try {
      const response = await axios.get(`${API_URL}/tablets/schools-with-students`);
      setActiveSchools(response.data);
    } catch (error) {
      console.error(error);
    }
  }, [API_URL]);

  // Adicione a chamada no useEffect principal (para carregar ao abrir a tela)
  useEffect(() => {
    fetchBatches();
    fetchActiveSchools(); // <--- CHAME AQUI
  }, [fetchBatches, fetchActiveSchools]);

  const handleCreateOrUpdateBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBatchName) return addToast('Nome do lote é obrigatório.', 'warning');

    try {
      if (editingBatch) {
        // MODO EDIÇÃO
        await axios.put(`${API_URL}/delivery-batches/${editingBatch.id}`, {
          batch_name: newBatchName,
          scheduled_date: scheduledDate
        });
        addToast('Lote atualizado!', 'success');
      } else {
        // MODO CRIAÇÃO
        if (!selectedSchoolId) return addToast('Selecione a escola.', 'warning');
        await axios.post(`${API_URL}/delivery-batches`, {
          batch_name: newBatchName,
          school_unit_id: selectedSchoolId,
          scheduled_date: scheduledDate
        });
        addToast('Lote criado!', 'success');
      }

      setIsModalOpen(false);
      setNewBatchName('');
      setScheduledDate('');
      setEditingBatch(null);
      fetchBatches();
      triggerRefresh();
    } catch (error) { addToast('Erro ao salvar lote.', 'error'); }
  };

  // Função auxiliar para abrir o modal em modo de edição
  const openEditModal = (batch: any) => {
    setEditingBatch(batch);
    setNewBatchName(batch.name);
    // Formata a data para o input (YYYY-MM-DD)
    const dateStr = batch.scheduled_delivery_date ? new Date(batch.scheduled_delivery_date).toISOString().split('T')[0] : '';
    setScheduledDate(dateStr);
    setIsModalOpen(true);
  };

  const handleAutoDistribute = async () => {
    if (!window.confirm(`Confirmar distribuição automática para os ${eligibleStudents.length} alunos pendentes?`)) return;
    setIsLoading(true);
    try {
      const response = await axios.post(`${API_URL}/delivery-batches/${selectedBatch.id}/distribute-automatically`);

      // EXIBE ALERTAS DE FALTA DE ESTOQUE (Se houver)
      if (response.data.warnings && response.data.warnings.length > 0) {
        response.data.warnings.forEach((warn: string) => addToast(warn, 'warning'));
      }

      // EXIBE O DETALHE DE QUANTOS FORAM DISTRIBUÍDOS DE FATO
      addToast(response.data.details || response.data.message, 'success');

      fetchBatchDetails(selectedBatch); // Atualiza a tela atual
      fetchBatches(); // Atualiza a contagem na lista de trás
      triggerRefresh(); // ATUALIZA O STATUS DOS ATIVOS GLOBALMENTE
    } catch (error: any) {
      addToast(error.response?.data?.message || 'Erro ao processar distribuição automática.', 'error');
    }
    finally { setIsLoading(false); }
  };

  const handleRemoveItem = async (itemId: number) => {
    if (!window.confirm('Desfazer associação?')) return;
    try {
      await axios.delete(`${API_URL}/delivery-batch-items/${itemId}`);
      addToast('Removido.', 'success');
      fetchBatchDetails(selectedBatch);
      fetchBatches(); // Atualiza contagem
      triggerRefresh(); // <<< LIBERA O ATIVO NO SISTEMA GERAL
    } catch (error) { addToast('Erro.', 'error'); }
  };

  const handleReturnItem = async (itemId: number) => {
    const reason = window.prompt('Qual o motivo da devolução/não entrega? (Ex: Falecimento, Evasão, Recusa)');
    if (!reason) return;

    setIsLoading(true);
    try {
      await axios.post(`${API_URL}/delivery-batch-items/${itemId}/return`, { reason });
      addToast('Devolução registrada.', 'success');
      fetchBatchDetails(selectedBatch); // Atualiza a tela
      triggerRefresh(); // Atualiza estoque global
    } catch (error: any) {
      addToast(error.response?.data?.message || 'Erro.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePrint = async (type: 'collective' | 'all-terms') => {
    addToast('Gerando PDF...', 'info');
    try {
      const response = await axios.get(`${API_URL}/reports/delivery-batch/${selectedBatch.id}/${type}`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Lote_${selectedBatch.name}_${type}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
    } catch (error) { addToast('Erro ao gerar PDF.', 'error'); }
  };

  const handleConfirmDelivery = async () => {
    if (!window.confirm(`ATENÇÃO: Confirmar a entrega do lote "${selectedBatch.name}"?\n\nIsso registrará a saída oficial dos equipamentos.`)) return;
    setIsLoading(true);
    try {
      await axios.put(`${API_URL}/delivery-batches/${selectedBatch.id}/confirm`);
      addToast('Lote confirmado e encerrado!', 'success');
      setSelectedBatch(null); fetchBatches();
    } catch (error: any) { addToast(error.response?.data?.message || 'Erro.', 'error'); }
    finally { setIsLoading(false); }
  };

  // Função para processar a devolução vinda do Modal Simples
  const processSingleReturn = async (reason: string) => {
    if (!itemToReturn) return;

    setIsLoading(true);
    try {
      // Chama a rota de devolução que criamos no backend
      await axios.post(`${API_URL}/delivery-batch-items/${itemToReturn.id}/return`, { reason });

      addToast('Devolução registrada com sucesso.', 'success');

      // Limpa o estado e atualiza a tela
      setItemToReturn(null);
      if (selectedBatch) fetchBatchDetails(selectedBatch);
      triggerRefresh();
    } catch (error: any) {
      addToast(error.response?.data?.message || 'Erro ao devolver.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // TELA DE DETALHES DO LOTE SELECIONADO
  if (selectedBatch) {
    return (
      <div className="space-y-6 pb-10">

        {/* CABEÇALHO DO LOTE */}
        <div className="flex justify-between items-center">
          <button onClick={() => setSelectedBatch(null)} className="text-blue-600 hover:underline flex items-center text-sm font-medium">
            &larr; Voltar para Lista de Lotes
          </button>
          <span className={`px-3 py-1 rounded-full text-sm font-bold ${selectedBatch.status === 'Concluído' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
            Status: {selectedBatch.status}
          </span>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border-l-4 border-blue-600">
          <h1 className="text-2xl font-bold text-gray-900">{selectedBatch.name}</h1>
          <p className="text-gray-600 mt-1">{selectedBatch.school_unit_name}</p>
          <div className="mt-2 text-sm text-gray-500 flex gap-4">
            <span>Previsão: <b>{selectedBatch.scheduled_delivery_date ? new Date(selectedBatch.scheduled_delivery_date).toLocaleDateString('pt-BR') : 'Não definida'}</b></span>
            <span>Itens: <b>{batchItems.length}</b></span>
          </div>
        </div>

        {/* ÁREA DE AÇÃO (Só aparece se estiver Em Planejamento) */}
        {selectedBatch.status === 'Em Planejamento' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

            {/* Card 1: Distribuição Automática (COM PRÉ-CHECK LIVOX) */}
            <div className="bg-indigo-50 border border-indigo-200 p-5 rounded-xl shadow-sm flex flex-col justify-between">
              <div>
                <h3 className="text-sm font-bold text-indigo-900 uppercase tracking-wide mb-2 flex items-center">
                  <Repeat className="w-4 h-4 mr-2" /> Distribuição em Massa
                </h3>

                {/* LÓGICA DE CÁLCULO DE DEMANDA VS ESTOQUE */}
                {(() => {
                  const livoxDemand = eligibleStudents.filter(s => s.requires_livox).length;
                  const stdDemand = eligibleStudents.length - livoxDemand;
                  const livoxStock = availableTablets.filter(t => t.has_livox).length;
                  const stdStock = availableTablets.filter(t => !t.has_livox).length;
                  const missingLivox = livoxDemand > livoxStock ? livoxDemand - livoxStock : 0;

                  if (eligibleStudents.length === 0) {
                    return <p className="text-xs text-indigo-700 mb-3">Não há alunos pendentes da importação para esta escola.</p>;
                  }

                  return (
                    <div className="space-y-2 mb-3">
                      <p className="text-xs text-indigo-800 font-medium">Alunos aguardando: <b>{eligibleStudents.length}</b></p>

                      {/* Linha do Livox */}
                      {livoxDemand > 0 && (
                        <div className={`p-2 rounded border text-xs flex justify-between items-center ${missingLivox > 0 ? 'bg-red-50 border-red-200 text-red-700' : 'bg-green-50 border-green-200 text-green-700'}`}>
                          <span>♿ Demanda Livox: <b>{livoxDemand}</b></span>
                          <span>Estoque: <b>{livoxStock}</b></span>
                          {missingLivox > 0 && <span className="font-bold flex items-center"><AlertTriangleIcon className="w-3 h-3 mr-1" /> Faltam {missingLivox}</span>}
                        </div>
                      )}

                      {/* Linha Padrão */}
                      {stdDemand > 0 && (
                        <div className="p-2 rounded border bg-white border-indigo-100 text-indigo-700 text-xs flex justify-between items-center">
                          <span>📱 Demanda Comum: <b>{stdDemand}</b></span>
                          <span>Estoque: <b>{stdStock}</b></span>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>

              <button
                onClick={handleAutoDistribute}
                disabled={isLoading || eligibleStudents.length === 0}
                className="w-full bg-indigo-600 text-white px-4 py-2 rounded-lg shadow hover:bg-indigo-700 flex items-center justify-center transition-transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-bold mt-2"
              >
                Distribuir Sequencialmente
              </button>
            </div>

            {/* Card 2: Adição Manual (RESTAURADO!) */}
            <div className="bg-blue-50 border border-blue-200 p-5 rounded-xl shadow-sm flex flex-col justify-between">
              <div>
                <h3 className="text-sm font-bold text-blue-900 uppercase tracking-wide mb-1 flex items-center"><PlusCircle className="w-4 h-4 mr-2" /> Aluno Extra / Manual</h3>
                <p className="text-xs text-blue-700 mb-3">
                  Adicione um aluno individualmente a este lote (ex: novato ou não importado no censo).
                </p>
              </div>
              <button
                onClick={() => setIsAddStudentModalOpen(true)}
                disabled={isLoading}
                className="w-full bg-blue-600 text-white px-4 py-2 rounded-lg shadow hover:bg-blue-700 flex items-center justify-center transition-transform active:scale-95 disabled:opacity-50 text-sm font-bold"
              >
                Incluir Aluno Manualmente
              </button>
            </div>

          </div>
        )}

        {/* >>> AQUI ESTÃO OS BOTÕES QUE FALTAVAM (IMPRESSÃO E CONFIRMAÇÃO) <<< */}
        {batchItems.length > 0 && (
          <div className="bg-gray-50 border border-gray-200 p-5 rounded-xl flex flex-col md:flex-row justify-between items-center gap-4">

            {/* Grupo de Impressão */}
            <div className="flex gap-3">
              <button onClick={() => handlePrint('collective')} className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg shadow-sm hover:bg-gray-100 flex items-center text-sm font-medium transition-colors">
                <FileText className="w-4 h-4 mr-2 text-blue-600" /> Recibo Coletivo (Escola)
              </button>
              <button onClick={() => handlePrint('all-terms')} className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg shadow-sm hover:bg-gray-100 flex items-center text-sm font-medium transition-colors">
                <FileText className="w-4 h-4 mr-2 text-purple-600" /> Todos os Termos Individuais
              </button>
            </div>

            {/* Botão de Confirmar (Só se não estiver concluído) */}
            {selectedBatch.status === 'Em Planejamento' && (
              <button
                onClick={() => setIsConfirmModalOpen(true)}
                disabled={isLoading}
                className="bg-green-600 text-white px-6 py-3 rounded-lg shadow-md hover:bg-green-700 flex items-center text-sm font-bold transition-transform transform hover:scale-105"
              >
                <CheckCircle className="w-5 h-5 mr-2" /> Confirmar Entrega Realizada
              </button>
            )}
          </div>
        )}

        {/* TABELA DE ITENS (LAYOUT NOVO) */}
        <div className="mt-4">
          <h3 className="font-bold text-gray-800 text-lg mb-4 flex items-center">
            <List className="w-5 h-5 mr-2 text-blue-600" />
            Itens no Lote ({batchItems.length})
          </h3>

          <div className="bg-white shadow-lg rounded-xl overflow-hidden border border-gray-200 w-full">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider w-1/3">Aluno</th>
                    {/* NOVA COLUNA PCD */}
                    <th className="px-3 py-4 text-center text-xs font-bold text-gray-500 uppercase tracking-wider w-20">PCD</th>

                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider w-32">Matrícula</th>
                    <th className="px-6 py-4 text-center text-xs font-bold text-gray-500 uppercase tracking-wider w-24 bg-orange-50 text-orange-700 border-b-2 border-orange-200">Caixa</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider w-1/4">Tablet</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider w-40">Nº Série</th>

                    {/* NOVA COLUNA LIVOX */}
                    <th className="px-3 py-4 text-center text-xs font-bold text-gray-500 uppercase tracking-wider w-24">Livox</th>

                    <th className="px-6 py-4 text-center text-xs font-bold text-gray-500 uppercase tracking-wider w-32">Status</th>

                    {(selectedBatch.status === 'Em Planejamento' || selectedBatch.status === 'Concluído') && (
                      <th className="px-6 py-4 text-right text-xs font-bold text-gray-500 uppercase tracking-wider w-24">Ações</th>
                    )}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {batchItems.map((item: any) => (
                    <tr key={item.id} className="hover:bg-blue-50 transition-colors duration-150">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">
                        {item.student_name}
                      </td>

                      {/* LÓGICA VISUAL DA COLUNA PCD */}
                      <td className="px-3 py-4 whitespace-nowrap text-center">
                        {item.requires_livox || (item.pcd_type && item.pcd_type.length > 2 && !['NÃO', 'NAO'].includes(item.pcd_type.toUpperCase())) ? (
                          <span className="inline-flex items-center justify-center px-2 py-1 rounded bg-purple-100 text-purple-800 text-[10px] font-bold border border-purple-200" title={item.pcd_type}>
                            ♿ SIM
                          </span>
                        ) : (
                          <span className="text-gray-300 text-xs">-</span>
                        )}
                      </td>

                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.student_registration}</td>

                      <td className="px-6 py-4 whitespace-nowrap text-center bg-orange-50">
                        <span className="inline-flex items-center justify-center px-3 py-1 rounded-full text-sm font-bold bg-white border border-orange-200 text-orange-800 shadow-sm">
                          {item.box_number || '-'}
                        </span>
                      </td>

                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">{item.patrimonio_number}</td>

                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono">{item.serial_number || '-'}</td>

                      {/* LÓGICA VISUAL DA COLUNA LIVOX (O SEMÁFORO) */}
                      <td className="px-3 py-4 whitespace-nowrap text-center">
                        {item.has_livox ? (
                          item.requires_livox ? (
                            // Match Perfeito (Verde)
                            <span className="inline-flex items-center justify-center px-2 py-1 rounded bg-green-100 text-green-800 text-[10px] font-bold border border-green-200">
                              ✅ OK
                            </span>
                          ) : (
                            // Desperdício (Amarelo - Aluno não precisa, mas tablet tem)
                            <span className="inline-flex items-center justify-center px-2 py-1 rounded bg-yellow-100 text-yellow-800 text-[10px] font-bold border border-yellow-200" title="Este aluno não requer Livox. Considere trocar o tablet.">
                              ⚠️ EXTRA
                            </span>
                          )
                        ) : (
                          item.requires_livox ? (
                            // ERRO CRÍTICO (Vermelho - Aluno precisa, tablet não tem)
                            <span className="inline-flex items-center justify-center px-2 py-1 rounded bg-red-100 text-red-800 text-[10px] font-bold border border-red-200 animate-pulse" title="ALERTA: Este aluno precisa do software Livox!">
                              🚫 FALTA
                            </span>
                          ) : (
                            // Normal (Cinza - Tablet comum para aluno comum)
                            <span className="text-gray-300 text-xs">-</span>
                          )
                        )}
                      </td>

                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <span className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${item.delivery_status === 'devolvido' ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800'}`}>
                          {item.delivery_status}
                        </span>
                      </td>

                      {(selectedBatch.status === 'Em Planejamento' || selectedBatch.status === 'Concluído') && (
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <div className="flex justify-end items-center gap-2">
                            {/* ... (Botões de Ação mantidos iguais) ... */}
                            {selectedBatch.status === 'Em Planejamento' && (
                              <button onClick={() => handleRemoveItem(item.id)} className="text-red-600 hover:text-red-900 p-1" title="Remover">
                                <Trash2 className="w-5 h-5" />
                              </button>
                            )}
                            {selectedBatch.status === 'Concluído' && item.delivery_status !== 'devolvido' && (
                              /* ... Botões de Devolução e PDF ... */
                              <>
                                <button onClick={() => { setMatriculaForReturn(item.student_registration); setIsReturnModalOpen(true); }} className="group flex items-center justify-center text-orange-600 hover:text-white hover:bg-orange-600 border border-orange-200 bg-orange-50 p-2 rounded-lg transition-all duration-200" title="Devolver">
                                  <CornerUpLeft className="w-4 h-4 mr-1" />
                                  <span className="text-xs font-bold hidden group-hover:inline-block">Devolver</span>
                                </button>
                                <button onClick={async () => {/* ... Lógica de PDF ... */ }} className="text-blue-600 hover:text-blue-900 p-1" title="Imprimir Termo">
                                  <FileText className="w-5 h-5" />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* MODAIS ESPECÍFICOS DO LOTE */}
        {isConfirmModalOpen && (
          <BatchConfirmationModal
            onClose={() => setIsConfirmModalOpen(false)}
            onConfirm={processConfirmation}
            batchName={selectedBatch?.name}
            items={batchItems}

          />
        )}

        {isAddStudentModalOpen && (
          <AddStudentToBatchModal
            onClose={() => setIsAddStudentModalOpen(false)}
            onSuccess={() => { fetchBatchDetails(selectedBatch); fetchBatches(); triggerRefresh(); }}
            API_URL={API_URL}
            addToast={addToast}
            batchId={selectedBatch.id}
          />
        )}

        {isReturnModalOpen && (
          <QuickReturnModal
            onClose={() => {
              setIsReturnModalOpen(false);
              setMatriculaForReturn(undefined); // Limpa a memória ao fechar
            }}
            API_URL={API_URL}
            addToast={addToast}
            triggerRefresh={() => {
              // Atualiza os detalhes do lote para o aluno sair da lista de 'planejado/entregue'
              if (selectedBatch) fetchBatchDetails(selectedBatch);
              fetchBatches();
              triggerRefresh();
            }}
            initialMatricula={matriculaForReturn} // <<< O PULO DO GATO
          />
        )}

        {itemToReturn && (
          <SimpleReturnModal
            onClose={() => setItemToReturn(null)}
            onConfirm={processSingleReturn}
            studentName={itemToReturn.student_name}
          />
        )}

      </div>
    );
  }

  const mainBatches = batches.filter(b => !b.name.startsWith('Complementar'));
  const complementaryBatches = batches.filter(b => b.name.startsWith('Complementar'));

  // Extrai RPAs únicas dos lotes para o dropdown
  const availableBatchRPAs = Array.from(new Set(batches.map(b => b.rpa).filter(Boolean))).sort();

  // Função genérica que filtra qualquer uma das listas
  const applyBatchFilters = (list: any[]) => {
    return list.filter(b => {
      const matchSchool = batchFilterSchool ? (b.school_unit_name.toLowerCase().includes(batchFilterSchool.toLowerCase()) || b.name.toLowerCase().includes(batchFilterSchool.toLowerCase())) : true;
      const matchStatus = batchFilterStatus ? b.status === batchFilterStatus : true;
      const matchRpa = batchFilterRpa ? String(b.rpa) === String(batchFilterRpa) : true;
      const matchDate = batchFilterDate ?
        (b.scheduled_delivery_date && b.scheduled_delivery_date.startsWith(batchFilterDate)) ||
        (b.creation_date && b.creation_date.startsWith(batchFilterDate))
        : true;

      return matchSchool && matchStatus && matchRpa && matchDate;
    });
  };

  const filteredMainBatches = applyBatchFilters(mainBatches);
  const filteredCompBatches = applyBatchFilters(complementaryBatches);

  // 1. Extrai as RPAs únicas (Isso restaura a variável que estava faltando)
  const availableRPAs = Array.from(new Set(activeSchools.map(s => s.rpa).filter(Boolean))).sort();

  // 2. Filtra a lista de escolas: (RPA selecionada) E (Ainda não tem lote)
  const filteredSchools = activeSchools.filter(s => {
    const matchRpa = filterRpa ? s.rpa == filterRpa : true;
    // Agora a escola aparece se houver qualquer saldo pendente (calculado no SQL acima)
    return matchRpa;

    // Filtro de Disponibilidade: Se já tiver lote (status preenchido), ESCONDE.
    // Se last_batch_status for null ou vazio, significa que a escola está livre.
    //const hasNoBatch = !s.last_batch_status;
  });

  return (
    <div className="space-y-8">
      {/* ... (Código da Lista de Lotes e Modal de Criação permanece IGUAL ao anterior) ... */}
      {/* Para economizar espaço na resposta, mantenha o 'return' inicial igual ao que você já tinha */}
      {/* Apenas copie a parte de dentro do 'if (selectedBatch)' acima */}
      <h1 className="text-3xl font-extrabold text-blue-900 mb-2">Logística de Tablets</h1>
      <p className="text-gray-500 mb-8">Gerencie a distribuição, estoque e manutenção dos equipamentos educacionais.</p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">

        {/* PAINEL 1: OPERAÇÕES DIÁRIAS (Lotes e Trocas) */}
        <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center mb-4">
            <div className="p-2 bg-blue-100 rounded-lg mr-3">
              <Activity className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h3 className="font-bold text-gray-800">Operações de Entrega</h3>
              <p className="text-xs text-gray-500">Gerenciamento de lotes e suporte ao aluno</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            {/* 1. Novo Lote (Destaque Azul) */}
            <button onClick={() => setIsModalOpen(true)} className="flex-grow bg-blue-600 text-white px-3 py-3 rounded-lg flex items-center justify-center hover:bg-blue-700 transition-colors shadow-sm font-medium text-sm whitespace-nowrap">
              <PlusCircle className="w-4 h-4 mr-2" /> Novo Lote
            </button>

            {/* 2. Entrega Avulsa (NOVO BOTÃO) */}
            <button onClick={() => setIsQuickModalOpen(true)} className="flex-grow bg-white text-green-600 border border-green-200 px-3 py-3 rounded-lg flex items-center justify-center hover:bg-green-50 transition-colors font-medium text-sm whitespace-nowrap">
              <CheckCircle className="w-4 h-4 mr-2" /> Entrega Avulsa
            </button>

            {/* 3. Transferir (Estilo Neutro/Indigo) */}
            <button onClick={() => setIsTransferModalOpen(true)} className="flex-grow bg-white text-indigo-600 border border-indigo-200 px-3 py-3 rounded-lg flex items-center justify-center hover:bg-indigo-50 transition-colors font-medium text-sm whitespace-nowrap">
              <ArrowRightLeft className="w-4 h-4 mr-2" /> Transferir
            </button>

            {/* 4. Substituição (Estilo Alerta/Vermelho) */}
            <button onClick={() => setIsSubstitutionModalOpen(true)} className="flex-grow bg-white text-red-600 border border-red-200 px-3 py-3 rounded-lg flex items-center justify-center hover:bg-red-50 transition-colors font-medium text-sm whitespace-nowrap">
              <Repeat className="w-4 h-4 mr-2" /> Substituição
            </button>

            <button onClick={() => setIsRescueModalOpen(true)} className="flex-grow bg-white text-orange-600 border border-orange-200 px-3 py-3 rounded-lg flex items-center justify-center hover:bg-orange-50 transition-colors font-medium text-sm whitespace-nowrap" title="Sanear lote que foi entregue fisicamente mas sumiu do sistema">
              <UploadCloud className="w-4 h-4 mr-2" /> Sanear Lote (Excel)
            </button>

            <button
              onClick={() => setIsSimModalOpen(true)}
              className="flex-grow bg-white text-purple-600 border border-purple-200 px-3 py-3 rounded-lg flex items-center justify-center hover:bg-purple-50 transition-colors font-medium text-sm whitespace-nowrap"
            >
              <Smartphone className="w-4 h-4 mr-2" /> Troca de Chip
            </button>

            {/* 5. Botão Devolução (Laranja) */}
            <button
              onClick={() => setIsReturnModalOpen(true)}
              className="flex-grow bg-white text-orange-600 border border-orange-200 px-3 py-3 rounded-lg flex items-center justify-center hover:bg-orange-50 transition-colors font-medium text-sm whitespace-nowrap"
              title="Buscar aluno para devolver equipamento"
            >
              <Search className="w-4 h-4 mr-2" /> Devolução Avulsa Individual
            </button>

          </div>
        </div>

        {/* PAINEL 2: GESTÃO DE DADOS (Importações) */}
        <div className="bg-gray-50 p-5 rounded-xl border border-gray-200">
          <div className="flex items-center mb-4">
            <div className="p-2 bg-gray-200 rounded-lg mr-3">
              <Database className="w-5 h-5 text-gray-600" />
            </div>
            <div>
              <h3 className="font-bold text-gray-700">Carga de Dados</h3>
              <p className="text-xs text-gray-500">Atualização das bases de alunos e estoque</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            {/* Botão Importar Alunos */}
            <input type="file" id="stFile" className="hidden" onChange={e => e.target.files && onImportResult && (() => { addToast('Importando...', 'info'); const fd = new FormData(); fd.append('file', e.target.files[0]); axios.post(`${API_URL}/tablets/import-students`, fd).then(r => onImportResult(r.data)).catch(e => addToast('Erro.', 'error')); })()} />
            <label htmlFor="stFile" className="flex-1 bg-white text-gray-700 border border-gray-300 px-4 py-3 rounded-lg cursor-pointer flex items-center justify-center hover:bg-gray-100 transition-colors text-sm font-medium">
              <UploadCloud className="w-4 h-4 mr-2 text-green-600" /> Importar Alunos
            </label>

            {/* Botão Importar Base Tablet */}
            <input type="file" id="logisticsFile" className="hidden" onChange={e => e.target.files && onImportResult && (() => { addToast('Atualizando dados...', 'info'); const fd = new FormData(); fd.append('file', e.target.files[0]); axios.post(`${API_URL}/tablets/import-logistics`, fd).then(r => onImportResult({ importedCount: r.data.updatedCount, errors: r.data.errors })).catch(e => addToast('Erro.', 'error')); })()} />
            <label htmlFor="logisticsFile" className="flex-1 bg-white text-gray-700 border border-gray-300 px-4 py-3 rounded-lg cursor-pointer flex items-center justify-center hover:bg-gray-100 transition-colors text-sm font-medium">
              <Box className="w-4 h-4 mr-2 text-orange-600" /> Importar Dados Complementares de Tables
            </label>
          </div>
        </div>
      </div>

      {/* >>> 3. BARRA DE FILTROS DOS LOTES (COLE AQUI) <<< */}
      <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200 mb-6">
        <h3 className="font-bold text-gray-700 mb-3 flex items-center text-sm uppercase tracking-wide">
          <Filter className="w-4 h-4 mr-2" /> Buscar Lotes Criados
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          <div className="md:col-span-5 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar por Nome da Escola ou Nome do Lote..."
              value={batchFilterSchool}
              onChange={e => setBatchFilterSchool(e.target.value)}
              className="w-full pl-9 pr-3 py-2.5 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 transition-shadow"
            />
          </div>
          <div className="md:col-span-3">
            <select value={batchFilterStatus} onChange={e => setBatchFilterStatus(e.target.value)} className="w-full p-2.5 border border-gray-300 rounded-lg text-sm bg-white outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer">
              <option value="">Status (Todos)</option>
              <option value="Em Planejamento">Em Planejamento</option>
              <option value="Concluído">Concluído</option>
            </select>
          </div>
          <div className="md:col-span-2">
            <select value={batchFilterRpa} onChange={e => setBatchFilterRpa(e.target.value)} className="w-full p-2.5 border border-gray-300 rounded-lg text-sm bg-white outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer">
              <option value="">RPA (Todas)</option>
              {availableBatchRPAs.map(rpa => <option key={rpa} value={rpa as string}>{rpa as string}</option>)}
            </select>
          </div>
          <div className="md:col-span-2">
            <input
              type="date"
              value={batchFilterDate}
              onChange={e => setBatchFilterDate(e.target.value)}
              className="w-full p-2.5 border border-gray-300 rounded-lg text-sm bg-white outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer text-gray-600"
              title="Filtrar por data (Criação ou Previsão)"
            />
          </div>
        </div>

        {/* Botão de Limpar Filtros só aparece se algum filtro estiver ativo */}
        {(batchFilterSchool || batchFilterStatus || batchFilterRpa || batchFilterDate) && (
          <div className="mt-3 flex justify-end">
            <button
              onClick={() => { setBatchFilterSchool(''); setBatchFilterStatus(''); setBatchFilterRpa(''); setBatchFilterDate(''); }}
              className="text-xs font-bold text-red-500 hover:text-red-700 underline"
            >
              Limpar Filtros
            </button>
          </div>
        )}
      </div>
      {/* ========================================================= */}

      {/* === TABELA 1: LOTES DE PLANEJAMENTO (AZUL) === */}
      <div className="bg-white p-6 rounded shadow border-l-4 border-blue-500">
        <h3 className="font-bold text-blue-900 mb-4 flex items-center text-lg">
          <Box className="w-6 h-6 mr-2" /> Lotes de Entrega (Planejados)
        </h3>
        {filteredMainBatches.length > 0 ? (
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-100">
              <tr>
                <th className="p-3">Nome</th>
                <th className="p-3">Escola</th>
                <th className="p-3 text-center w-16">RPA</th>
                <th className="p-3">Previsão</th>
                <th className="p-3">Status</th>
                <th className="p-3 text-center">Volume</th>
                <th className="p-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filteredMainBatches.map(b => (
                <tr key={b.id} className="border-b hover:bg-gray-50">
                  <td className="p-3 font-medium">{b.name}</td>
                  <td className="p-3">{b.school_unit_name}</td>
                  <td className="p-3 text-center">
                    {b.rpa ? (
                      <span className="inline-flex items-center justify-center px-2 py-1 rounded border border-gray-300 bg-gray-50 text-xs font-bold text-gray-600">
                        {b.rpa}
                      </span>
                    ) : '-'}
                  </td>
                  <td className="p-3 text-gray-500">{b.scheduled_delivery_date ? new Date(b.scheduled_delivery_date).toLocaleDateString('pt-BR') : '-'}</td>
                  <td className="p-3"><span className={`px-2 py-1 rounded text-xs ${b.status === 'Concluído' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>{b.status}</span></td>
                  <td className="p-3 text-center">{b.total_items}</td>
                  <td className="p-3 flex justify-end items-center space-x-2">
                    <button onClick={() => fetchBatchDetails(b)} className="text-blue-600 hover:underline font-bold text-xs uppercase">Detalhes</button>

                    {/* CORREÇÃO: Botão Editar SÓ aparece se NÃO estiver Concluído */}
                    {b.status !== 'Concluído' && (
                      <button
                        onClick={(e) => { e.stopPropagation(); openEditModal(b); }}
                        className="text-gray-500 hover:text-blue-600"
                        title="Editar Lote"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                    )}

                    {b.status !== 'Concluído' && (
                      <button
                        onClick={async (e) => {
                          e.stopPropagation();
                          if (window.confirm('Excluir lote?')) {
                            try {
                              await axios.delete(`${API_URL}/delivery-batches/${b.id}`);
                              addToast('Lote excluído.', 'success');
                              fetchBatches();
                              triggerRefresh();
                            } catch (error: any) {
                              // AGORA O ERRO NÃO É MAIS CEGO
                              const msg = error.response?.data?.message || `Falha na requisição: ${error.message}`;
                              addToast(msg, 'error');
                              console.error('Erro detalhado ao excluir:', error);
                            }
                          }
                        }}
                        className="text-red-500 hover:text-red-700"
                        title="Excluir"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-gray-500 italic py-4 text-center bg-gray-50 rounded">Nenhum lote de planejamento ativo.</p>
        )}
      </div>

      {/* === TABELA 2: LOTES COMPLEMENTARES (VERDE) === */}
      <div className="bg-white p-6 rounded shadow border-l-4 border-green-500 mt-6">
        <h3 className="font-bold text-green-900 mb-4 flex items-center text-lg">
          <CheckCircle className="w-6 h-6 mr-2" /> Entregas Complementares (Avulsas)
        </h3>
        {filteredCompBatches.length > 0 ? (
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-100">
              <tr>
                <th className="p-3">Nome / Referência</th>
                <th className="p-3">Escola</th>
                <th className="p-3 text-center w-16">RPA</th>
                <th className="p-3">Data Criação</th>
                <th className="p-3">Status</th>
                <th className="p-3 text-center">Volume</th>
                <th className="p-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filteredCompBatches.map(b => (
                <tr key={b.id} className="border-b hover:bg-green-50">
                  <td className="p-3 font-medium text-green-800">{b.name}</td>
                  <td className="p-3">{b.school_unit_name}</td>
                  <td className="p-3 text-center">
                    {b.rpa ? (
                      <span className="inline-flex items-center justify-center px-2 py-1 rounded border border-green-200 bg-green-50 text-xs font-bold text-green-700">
                        {b.rpa}
                      </span>
                    ) : '-'}
                  </td>
                  <td className="p-3 text-gray-500">{new Date(b.creation_date).toLocaleDateString('pt-BR')}</td>
                  <td className="p-3"><span className={`px-2 py-1 rounded text-xs ${b.status === 'Concluído' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>{b.status}</span></td>
                  <td className="p-3 text-center font-bold">{b.total_items}</td>
                  <td className="p-3 flex justify-end items-center space-x-2">
                    <button onClick={() => fetchBatchDetails(b)} className="text-blue-600 hover:underline font-bold text-xs uppercase">Detalhes</button>

                    {/* CORREÇÃO: Botão Editar SÓ aparece se NÃO estiver Concluído */}
                    {b.status !== 'Concluído' && (
                      <button
                        onClick={(e) => { e.stopPropagation(); openEditModal(b); }}
                        className="text-gray-500 hover:text-blue-600"
                        title="Editar Lote"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                    )}

                    {b.status !== 'Concluído' && (
                      <button
                        onClick={async (e) => {
                          e.stopPropagation();
                          if (window.confirm('Excluir lote complementar?')) {
                            try {
                              await axios.delete(`${API_URL}/delivery-batches/${b.id}`);
                              addToast('Excluído.', 'success');
                              fetchBatches();
                              triggerRefresh();
                            } catch (error: any) {
                              // AGORA O ERRO NÃO É MAIS CEGO
                              const msg = error.response?.data?.message || `Falha na requisição: ${error.message}`;
                              addToast(msg, 'error');
                              console.error('Erro detalhado ao excluir:', error);
                            }
                          }
                        }}
                        className="text-red-500 hover:text-red-700"
                        title="Excluir"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-gray-500 italic py-4 text-center bg-gray-50 rounded">Nenhuma entrega complementar registrada.</p>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white p-6 rounded w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">{editingBatch ? 'Editar Lote' : 'Novo Lote de Entrega'}</h2>

            {/* BLOCO DE SELEÇÃO DE ESCOLA (COM FILTRO RPA) */}
            {!editingBatch && (
              <>
                {/* 1. Botões de Filtro RPA */}
                <div className="mb-4 bg-gray-50 p-3 rounded border border-gray-200">
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Filtrar por Região (RPA)</label>
                  <div className="flex gap-2 flex-wrap">
                    {availableRPAs.map(rpa => (
                      <button
                        key={rpa}
                        onClick={() => {
                          setFilterRpa(filterRpa === rpa ? '' : rpa);
                          setSelectedSchoolId('');
                        }}
                        className={`px-3 py-1 rounded text-sm font-bold border transition-colors ${filterRpa === rpa
                            ? 'bg-blue-600 text-white border-blue-600'
                            : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-100'
                          }`}
                      >
                        {rpa}
                      </button>
                    ))}
                    {filterRpa && (
                      <button onClick={() => setFilterRpa('')} className="text-xs text-red-500 underline ml-2">
                        Limpar
                      </button>
                    )}
                  </div>
                </div>

                {/* 2. Select de Escola (Filtrado e Ordenado) */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Unidade Escolar {filterRpa ? `(RPA ${filterRpa})` : '(Todas - Ordenadas por Qtd. Alunos)'}
                  </label>
                  <Select
                    options={filteredSchools.map(u => {
                      // BLINDAGEM: Se o pending_count não vier do banco, o React calcula na hora!
                      const pendentes = u.pending_count !== undefined
                        ? u.pending_count
                        : (u.total_eligible || u.student_count || 0) - (u.delivered_count || 0) - (u.planned_count || 0);

                      const livox = u.pending_livox_count || 0;

                      return {
                        value: u.id.toString(),
                        label: livox > 0
                          ? `${u.name} (${pendentes} tablets / ${livox} com Livox)`
                          : `${u.name} (${pendentes} tablets)`,
                        status: u.last_batch_status,
                        batchId: u.last_batch_id
                      };
                    })}
                    onChange={(o: any) => {
                      if (o?.status === 'Em Planejamento') {
                        if (window.confirm(`ATENÇÃO: A unidade "${o.label.split(' (')[0]}" já possui um lote em planejamento.\n\nDeseja fechar esta janela e ir editar o lote existente?`)) {
                          setIsModalOpen(false);
                          const existingBatch = batches.find(b => b.id === o.batchId);
                          if (existingBatch) fetchBatchDetails(existingBatch);
                        }
                        return;
                      }
                      if (o?.status === 'Concluído') {
                        alert(`AVISO: A unidade "${o.label.split(' (')[0]}" já teve sua entrega CONCLUÍDA.`);
                        return;
                      }
                      setSelectedSchoolId(o?.value || '');
                      // Limpa o nome do lote para remover o "(X alunos pendentes)"
                      if (o?.label) setNewBatchName(o.label.split(' (')[0]);
                    }}
                    placeholder={filterRpa ? `Selecione na RPA ${filterRpa}...` : "Selecione a escola (Mais pendentes primeiro)..."}
                    noOptionsMessage={() => "Nenhuma escola com pendências encontrada."}
                    value={filteredSchools.map(u => {
                      const pendentes = u.pending_count !== undefined
                        ? u.pending_count
                        : (u.total_eligible || u.student_count || 0) - (u.delivered_count || 0) - (u.planned_count || 0);

                      const livox = u.pending_livox_count || 0;

                      return {
                        value: u.id.toString(),
                        label: livox > 0
                          ? `${u.name} (${pendentes} tablets / ${livox} com Livox)`
                          : `${u.name} (${pendentes} tablets)`,
                      };
                    }).find(o => o.value === selectedSchoolId) || null}
                    isSearchable
                  />
                </div>
              </>
            )}

            {/* DADOS DO LOTE (Nome e Data) */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Nome do Lote</label>
              <input type="text" value={newBatchName} onChange={e => setNewBatchName(e.target.value)} className="w-full p-2 border rounded" />
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Data Prevista de Entrega</label>
              <input
                type="date"
                value={scheduledDate}
                onChange={e => setScheduledDate(e.target.value)}
                className="w-full p-2 border rounded"
              />
              <p className="text-xs text-gray-500 mt-1">Essa data será usada para monitoramento de prazos.</p>
            </div>

            <div className="flex justify-end gap-2">
              <button onClick={() => { setIsModalOpen(false); setEditingBatch(null); }} className="px-4 py-2 bg-gray-200 rounded">Cancelar</button>
              <button onClick={handleCreateOrUpdateBatch} className="px-4 py-2 bg-blue-600 text-white rounded">Salvar</button>
            </div>
          </div>
        </div>
      )}
      {isSubstitutionModalOpen && (
        <TabletSubstitutionModal
          onClose={() => setIsSubstitutionModalOpen(false)}
          API_URL={API_URL}
          addToast={addToast}
        />
      )}

      {isTransferModalOpen && (
        <StudentTransferModal
          onClose={() => setIsTransferModalOpen(false)}
          API_URL={API_URL}
          addToast={addToast}
          triggerRefresh={() => {
            fetchBatches();
            triggerRefresh();
            fetchActiveSchools(); // Atualiza a lista caso a transferência mude contagens
          }}
          // >>> CORREÇÃO: Voltamos a usar schoolUnits para que TODAS as escolas apareçam no destino <<<
          schools={schoolUnits}
        />
      )}

      {isConfirmModalOpen && (
        <BatchConfirmationModal
          onClose={() => setIsConfirmModalOpen(false)}
          onConfirm={processConfirmation}
          batchName={selectedBatch?.name}
          items={batchItems}
        />
      )}

      {isQuickModalOpen && (
        <QuickDeliveryModal
          onClose={() => setIsQuickModalOpen(false)}
          API_URL={API_URL}
          addToast={addToast}
          schools={units} // Passamos a lista de escolas que o componente já recebe
          triggerRefresh={() => { fetchBatches(); triggerRefresh(); }}
        />
      )}

      {isReturnModalOpen && (
        <QuickReturnModal
          onClose={() => setIsReturnModalOpen(false)}
          API_URL={API_URL}
          addToast={addToast}
          triggerRefresh={() => { fetchBatches(); triggerRefresh(); }}
        />
      )}

      {itemToReturn && (
        <SimpleReturnModal
          onClose={() => setItemToReturn(null)}
          onConfirm={processSingleReturn}
          studentName={itemToReturn.student_name}
        />
      )}

      <SimSwapModal
        isOpen={isSimModalOpen}
        onClose={() => setIsSimModalOpen(false)}
        onSuccess={() => {
          // Se estiver dentro de um lote, recarrega ele
          if (selectedBatch) fetchBatchDetails(selectedBatch);
          triggerRefresh();
        }}
        API_URL={API_URL}
        addToast={addToast}
      />

      <RescueBatchModal
        isOpen={isRescueModalOpen}
        onClose={() => {
          setIsRescueModalOpen(false);
          // Ao fechar, garante que a tela recarregue para mostrar o lote que acabou de criar
          fetchBatches();
        }}
        units={units}
        API_URL={API_URL}
        addToast={addToast}
        onComplete={() => {
          fetchBatches();
          triggerRefresh();
        }}
      />

    </div>
  );
};

export default App;

