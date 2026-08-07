import React, { useState, useEffect, useCallback, useContext } from 'react';
import {
	X,
	Calendar,
	Clock,
	Truck,
	ArrowRight,
	Download,
	AlertTriangle,
	CheckCheck,
	Link2,
	Search,
	CheckCircle2,
	XCircle,
	RotateCcw,
} from 'lucide-react';
import { useToast, AuthContext } from '../App';
import StatusBadge from './StatusBadge';
import {
	requestsApi,
	LinkableMovement,
	LinkMatchAnalysis,
} from '../services/requestsApi';
import {
	EquipmentRequest,
	StatusHistoryEntry,
	LinkedMovement,
	RequestStatus,
	TechnicalVisit,
	VisitItemResultValue,
	ItemDeliberationDecision,
} from '../types/requests';
import {
	REQUEST_TYPE_LABELS,
	REQUEST_CHANNEL_LABELS,
	REQUEST_STATUS_LABELS,
} from '../utils/translations';

interface RequestDetailProps {
	requestId: number;
	currentUserRole: string;
	onClose: () => void;
}

const DELIBERATION_STATUSES = new Set([
	'aguardando_aprovacao',
	'necessidade_parcialmente_constatada',
]);

const APPROVED_LIKE_STATUSES = new Set(['aprovado', 'parcialmente_aprovado']);

const CAN_LINK_MOVEMENT_ROLES = new Set([
	'admin',
	'manager',
	'basic',
	'operator',
]);

const MOVEMENT_TYPE_LABELS: Record<string, string> = {
	loan: 'Empréstimo',
	exit: 'Saída',
	return: 'Devolução',
	maintenance: 'Manutenção',
	entry: 'Entrada',
};

type ItemVisitDraft = Record<
	number,
	{ result: VisitItemResultValue | ''; constatada_quantity: number }
>;
type ItemDeliberationDraft = Record<
	number,
	{ decision: ItemDeliberationDecision | ''; approved_quantity: number }
>;

const itemLabel = (item: {
	item_type_name: string;
	brand_name?: string | null;
	model_name?: string | null;
}) =>
	[item.item_type_name, item.brand_name, item.model_name]
		.filter(Boolean)
		.join(' · ');

const getVisitItemResult = (
	visit: TechnicalVisit,
	catalogItemId: number,
) => visit.item_results?.find((r) => r.catalog_item_id === catalogItemId);

const buildVisitEditDraft = (
	items: EquipmentRequest['items'],
	visit: TechnicalVisit,
): ItemVisitDraft => {
	const draft: ItemVisitDraft = {};
	(items || []).forEach((item) => {
		const visitResult = getVisitItemResult(visit, item.id);
		draft[item.id] = {
			result: visitResult?.result || '',
			constatada_quantity:
				visitResult?.constatada_quantity || item.quantity,
		};
	});
	return draft;
};

// ─── Labels de ação por transição ──────────────────────────────────────────
const TRANSITION_LABELS: Record<string, string> = {
	visita_tecnica_solicitada: 'Solicitar Visita Técnica',
	aguardando_aprovacao: 'Encaminhar para Aprovação',
	aprovado: 'Aprovar',
	reprovado: 'Reprovar',
	em_execucao: 'Marcar em Execução',
	concluido: 'Concluir',
	cancelado: 'Cancelar Solicitação',
	indisponivel_estoque: 'Marcar Indisponível no Estoque',
};

const TRANSITION_LABELS_FROM_UNAVAILABLE: Record<string, string> = {
	aprovado: 'Equipamento Disponível',
};

const DESTRUCTIVE_TRANSITIONS = new Set(['cancelado', 'reprovado']);

/** Ações auxiliares ficam à esquerda no rodapé; as demais (decisão) à direita. */
const AUXILIARY_TRANSITIONS = new Set(['visita_tecnica_solicitada']);

const TRANSITION_STYLES: Record<string, string> = {
	aprovado: 'bg-green-600 hover:bg-green-700 text-white',
	reprovado: 'bg-red-600 hover:bg-red-700 text-white',
	cancelado: 'bg-gray-500 hover:bg-gray-600 text-white',
	indisponivel_estoque: 'bg-orange-500 hover:bg-orange-600 text-white',
	visita_tecnica_solicitada: 'bg-purple-600 hover:bg-purple-700 text-white',
	aguardando_aprovacao: 'bg-yellow-600 hover:bg-yellow-700 text-white',
	em_execucao: 'bg-orange-600 hover:bg-orange-700 text-white',
	concluido: 'bg-teal-600 hover:bg-teal-700 text-white',
};

// ─── Linha do tempo ─────────────────────────────────────────────────────────
const TimelineEntry = ({ entry }: { entry: StatusHistoryEntry }) => (
	<div className="flex gap-3">
		<div className="flex flex-col items-center">
			<div className="w-3 h-3 rounded-full bg-blue-400 mt-1 shrink-0" />
			<div className="w-px flex-1 bg-gray-200 mt-1" />
		</div>
		<div className="pb-4">
			<div className="flex items-center gap-2 flex-wrap">
				{entry.old_status && (
					<>
						<StatusBadge status={entry.old_status} />
						<ArrowRight size={12} className="text-gray-400" />
					</>
				)}
				<StatusBadge status={entry.new_status} />
			</div>
			{entry.notes && (
				<p className="text-xs text-gray-500 mt-1">{entry.notes}</p>
			)}
			<p className="text-xs text-gray-400 mt-1">
				{entry.changed_by_name} ·{' '}
				{new Date(entry.changed_at).toLocaleString('pt-BR')}
			</p>
		</div>
	</div>
);

// ─── Card de movimentação vinculada ─────────────────────────────────────────
const MovementCard = ({ m }: { m: LinkedMovement }) => {
	const typeLabels: Record<string, string> = {
		loan: 'Empréstimo',
		exit: 'Saída',
		return: 'Devolução',
		maintenance: 'Manutenção',
		entry: 'Entrada',
	};
	const deliveryStatusConfig: Record<
		string,
		{ label: string; className: string }
	> = {
		pending_confirmation: {
			label: 'Aguardando confirmação',
			className: 'bg-yellow-100 text-yellow-700 border-yellow-200',
		},
		confirmed: {
			label: 'Entrega confirmada',
			className: 'bg-green-100 text-green-700 border-green-200',
		},
		cancelled: {
			label: 'Cancelada',
			className: 'bg-red-100 text-red-600 border-red-200',
		},
	};
	const statusInfo = deliveryStatusConfig[m.delivery_status] ?? {
		label: m.delivery_status,
		className: 'bg-gray-100 text-gray-600 border-gray-200',
	};
	return (
		<div className="p-4 bg-gray-50 rounded-lg border border-gray-100 space-y-2">
			<div className="flex items-start justify-between gap-2">
				<div className="flex items-center gap-2">
					<Truck
						size={14}
						className="text-gray-400 shrink-0 mt-0.5"
					/>
					<span className="text-sm font-semibold text-gray-700">
						Movimentação #{m.id}
					</span>
					<span className="text-xs text-gray-500">
						· {typeLabels[m.movement_type] || m.movement_type}
					</span>
				</div>
				<span
					className={`text-xs px-2 py-0.5 rounded-full border font-medium whitespace-nowrap ${statusInfo.className}`}
				>
					{statusInfo.label}
				</span>
			</div>
			<div className="flex items-center gap-3 text-xs text-gray-400 pl-5">
				<span>{m.asset_count} ativo(s) vinculado(s)</span>
				{m.responsible_name && (
					<>
						<span>·</span>
						<span>{m.responsible_name}</span>
					</>
				)}
				<span>·</span>
				<span>
					{new Date(m.created_at).toLocaleDateString('pt-BR')}
				</span>
			</div>
		</div>
	);
};

// ─── Componente principal ────────────────────────────────────────────────────
const RequestDetail = ({
	requestId,
	currentUserRole,
	onClose,
}: RequestDetailProps) => {
	const { addToast } = useToast();
	const ctx = useContext(AuthContext) as any;
	const API_URL: string = ctx?.API_URL || '';

	const [request, setRequest] = useState<EquipmentRequest | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [activeTab, setActiveTab] = useState<
		'info' | 'timeline' | 'movements'
	>('info');
	const [users, setUsers] = useState<{ id: number; full_name: string }[]>([]);

	// Ações inline
	const [confirmingTransition, setConfirmingTransition] =
		useState<RequestStatus | null>(null);
	const [confirmingRevert, setConfirmingRevert] = useState(false);
	const [transitionNotes, setTransitionNotes] = useState('');
	const [revertNotes, setRevertNotes] = useState('');
	const [isActing, setIsActing] = useState(false);

	// Novo agendamento de visita
	const [showScheduleVisit, setShowScheduleVisit] = useState(false);
	const [visitScheduledDate, setVisitScheduledDate] = useState('');
	const [visitScheduledTime, setVisitScheduledTime] = useState('');
	const [visitAssignedTo, setVisitAssignedTo] = useState(''); // ID selecionado
	const [visitAssignedSearch, setVisitAssignedSearch] = useState(''); // texto digitado
	const [visitAssignedOpen, setVisitAssignedOpen] = useState(false);

	// Editar agendamento existente
	const [editingVisitScheduleId, setEditingVisitScheduleId] = useState<
		number | null
	>(null);
	const [editScheduleDate, setEditScheduleDate] = useState('');
	const [editScheduleTime, setEditScheduleTime] = useState('');
	const [editScheduleAssignedTo, setEditScheduleAssignedTo] = useState(''); // ID
	const [editScheduleSearch, setEditScheduleSearch] = useState(''); // texto
	const [editScheduleOpen, setEditScheduleOpen] = useState(false);

	// Registrar resultado (por equipamento)
	const [completingVisitId, setCompletingVisitId] = useState<number | null>(
		null,
	);
	const [itemVisitResults, setItemVisitResults] = useState<ItemVisitDraft>({});
	const [visitFindings, setVisitFindings] = useState('');
	const [completingVisitMode, setCompletingVisitMode] = useState<
		'itens' | 'frustrada' | null
	>(null);
	const [frustratedReason, setFrustratedReason] = useState('');

	// Editar resultado existente (por equipamento)
	const [editingVisitResultId, setEditingVisitResultId] = useState<
		number | null
	>(null);
	const [editItemVisitResults, setEditItemVisitResults] =
		useState<ItemVisitDraft>({});
	const [editVisitFindings, setEditVisitFindings] = useState('');

	// Deliberação da gerência por equipamento
	const [deliberationDraft, setDeliberationDraft] =
		useState<ItemDeliberationDraft>({});
	const [deliberationNotes, setDeliberationNotes] = useState('');
	const [showDeliberationForm, setShowDeliberationForm] = useState(false);

	// DIT — form de ciência
	const [showDitForm, setShowDitForm] = useState(false);
	const [ditModalidade, setDitModalidade] = useState<'entrega' | 'retirada' | ''>('');
	const [ditPrevisao, setDitPrevisao] = useState('');

	// DIT — reagendamento / observação
	const [showReagForm, setShowReagForm] = useState(false);
	const [reagNovaData, setReagNovaData] = useState('');
	const [reagMotivo, setReagMotivo] = useState('');
	const [showObsForm, setShowObsForm] = useState(false);
	const [obsMotivo, setObsMotivo] = useState('');

	// Vínculo retroativo com movimentação
	const [showLinkModal, setShowLinkModal] = useState(false);
	const [linkSearch, setLinkSearch] = useState('');
	const [linkResults, setLinkResults] = useState<LinkableMovement[]>([]);
	const [linkSearching, setLinkSearching] = useState(false);
	const [selectedLinkMovement, setSelectedLinkMovement] =
		useState<LinkableMovement | null>(null);
	const [linkMatch, setLinkMatch] = useState<LinkMatchAnalysis | null>(null);
	const [linkChecking, setLinkChecking] = useState(false);
	const [confirmMismatches, setConfirmMismatches] = useState(false);
	const [linkNotes, setLinkNotes] = useState('');
	const [isLinking, setIsLinking] = useState(false);

	const canLinkMovement = CAN_LINK_MOVEMENT_ROLES.has(currentUserRole);

	const loadRequest = useCallback(async () => {
		setIsLoading(true);
		try {
			const data = await requestsApi.getById(requestId);
			setRequest(data);
		} catch {
			addToast('Erro ao carregar solicitação.', 'error');
		} finally {
			setIsLoading(false);
		}
	}, [requestId, addToast]);

	useEffect(() => {
		loadRequest();
	}, [loadRequest]);

	useEffect(() => {
		requestsApi
			.listUsers()
			.then(setUsers)
			.catch(() => {});
	}, []);

	const handleTransition = async (toStatus: RequestStatus) => {
		if (!request) return;
		setIsActing(true);
		try {
			await requestsApi.changeStatus(
				requestId,
				toStatus,
				transitionNotes || undefined,
			);
			addToast(
				`Status atualizado para "${REQUEST_STATUS_LABELS[toStatus]}".`,
				'success',
			);
			setConfirmingTransition(null);
			setTransitionNotes('');
			await loadRequest();
		} catch (err: any) {
			addToast(
				err?.response?.data?.message || 'Erro ao atualizar status.',
				'error',
			);
		} finally {
			setIsActing(false);
		}
	};

	const handleRevert = async () => {
		if (!request?.previous_status) return;
		const motivo = revertNotes.trim();
		if (!motivo) {
			addToast('Informe o motivo da alteração de status.', 'error');
			return;
		}
		setIsActing(true);
		try {
			const updated = await requestsApi.revertStatus(
				requestId,
				motivo,
				request.previous_status,
			);
			addToast(
				`Alteração desfeita. Novo status: "${REQUEST_STATUS_LABELS[updated.status] || updated.status}".`,
				'success',
			);
			setConfirmingRevert(false);
			setRevertNotes('');
			setShowScheduleVisit(false);
			await loadRequest();
		} catch (err: any) {
			addToast(
				err?.response?.data?.message || 'Erro ao reverter status.',
				'error',
			);
		} finally {
			setIsActing(false);
		}
	};


	const resetLinkModal = () => {
		setShowLinkModal(false);
		setLinkSearch('');
		setLinkResults([]);
		setSelectedLinkMovement(null);
		setLinkMatch(null);
		setConfirmMismatches(false);
		setLinkNotes('');
	};

	const handleSearchLinkableMovements = async () => {
		setLinkSearching(true);
		setSelectedLinkMovement(null);
		setLinkMatch(null);
		setConfirmMismatches(false);
		try {
			const results = await requestsApi.searchLinkableMovements(
				requestId,
				linkSearch.trim() || undefined,
			);
			setLinkResults(results);
			if (results.length === 0) {
				addToast(
					linkSearch.trim()
						? 'Nenhuma movimentação elegível encontrada para o termo informado.'
						: 'Nenhuma sugestão por afinidade. Informe ID, solicitante, unidade ou patrimônio.',
					'info',
				);
			}
		} catch (err: any) {
			addToast(
				err?.response?.data?.message ||
					'Erro ao buscar movimentações.',
				'error',
			);
		} finally {
			setLinkSearching(false);
		}
	};

	const handleSelectLinkMovement = async (movement: LinkableMovement) => {
		setSelectedLinkMovement(movement);
		setConfirmMismatches(false);
		setLinkChecking(true);
		try {
			const check = await requestsApi.checkLinkMovement(
				requestId,
				movement.id,
			);
			setLinkMatch(check.match);
		} catch (err: any) {
			setSelectedLinkMovement(null);
			setLinkMatch(null);
			addToast(
				err?.response?.data?.message ||
					'Erro ao analisar correspondência.',
				'error',
			);
		} finally {
			setLinkChecking(false);
		}
	};

	const handleConfirmLinkMovement = async () => {
		if (!selectedLinkMovement || !linkMatch) return;
		if (!linkMatch.matches && !confirmMismatches) {
			addToast(
				'Confirme explicitamente o vínculo apesar das divergências.',
				'error',
			);
			return;
		}
		setIsLinking(true);
		try {
			await requestsApi.linkMovement(requestId, {
				movement_id: selectedLinkMovement.id,
				confirm_mismatches: !linkMatch.matches,
				notes: linkNotes.trim() || undefined,
			});
			addToast(
				'Movimentação vinculada e solicitação concluída com sucesso.',
				'success',
			);
			resetLinkModal();
			setActiveTab('movements');
			await loadRequest();
		} catch (err: any) {
			if (err?.response?.status === 409 && err?.response?.data?.match) {
				setLinkMatch(err.response.data.match);
				addToast(
					'Há divergências. Confirme explicitamente para prosseguir.',
					'error',
				);
			} else {
				addToast(
					err?.response?.data?.message ||
						'Erro ao vincular movimentação.',
					'error',
				);
			}
		} finally {
			setIsLinking(false);
		}
	};

	const handleDitCiente = async () => {
		if (!request) return;
		if (!ditModalidade) {
			addToast('Selecione a modalidade (Entrega ou Retirada).', 'error');
			return;
		}
		if (!ditPrevisao) {
			addToast('Informe a data prevista de realização.', 'error');
			return;
		}
		setIsActing(true);
		try {
			await requestsApi.ackDitCiente(requestId, {
				modalidade: ditModalidade,
				previsao_at: ditPrevisao,
			});
			addToast('Ciência da DIT registrada com sucesso.', 'success');
			setShowDitForm(false);
			setDitModalidade('');
			setDitPrevisao('');
			await loadRequest();
		} catch (err: any) {
			addToast(err?.response?.data?.message || 'Erro ao registrar ciência da DIT.', 'error');
		} finally {
			setIsActing(false);
		}
	};

	const handleRegistrarEventoDit = async (tipo: 'reagendamento' | 'observacao') => {
		if (!request) return;
		setIsActing(true);
		try {
			await requestsApi.registrarEventoDit(requestId, {
				tipo,
				nova_data: tipo === 'reagendamento' ? reagNovaData : undefined,
				motivo: tipo === 'reagendamento' ? reagMotivo : obsMotivo,
			});
			addToast(
				tipo === 'reagendamento' ? 'Reagendamento registrado.' : 'Observação registrada.',
				'success',
			);
			setShowReagForm(false);
			setReagNovaData('');
			setReagMotivo('');
			setShowObsForm(false);
			setObsMotivo('');
			await loadRequest();
		} catch (err: any) {
			addToast(err?.response?.data?.message || 'Erro ao registrar evento DIT.', 'error');
		} finally {
			setIsActing(false);
		}
	};
	const getUserSuggestions = (search: string) =>
		search.length >= 2 ?
			users
				.filter((u) =>
					u.full_name.toLowerCase().includes(search.toLowerCase()),
				)
				.slice(0, 8)
		:	[];

	const formatVisitDate = (d: string | null | undefined): string | null => {
		if (!d) return null;
		const dateOnly = d.split('T')[0];
		const parts = dateOnly.split('-');
		if (parts.length !== 3) return d;
		return `${parts[2]}/${parts[1]}/${parts[0]}`;
	};

	const handleScheduleVisit = async () => {
		setIsActing(true);
		try {
			await requestsApi.scheduleVisit(requestId, {
				assigned_to:
					visitAssignedTo ? parseInt(visitAssignedTo) : undefined,
				scheduled_date: visitScheduledDate || undefined,
				scheduled_time: visitScheduledTime || undefined,
			});
			addToast('Visita técnica agendada.', 'success');
			setShowScheduleVisit(false);
			setVisitScheduledDate('');
			setVisitScheduledTime('');
			setVisitAssignedTo('');
			setVisitAssignedSearch('');
			await loadRequest();
		} catch (err: any) {
			addToast(
				err?.response?.data?.message || 'Erro ao agendar visita.',
				'error',
			);
		} finally {
			setIsActing(false);
		}
	};

	const handleUpdateVisitSchedule = async (visitId: number) => {
		setIsActing(true);
		try {
			await requestsApi.updateVisitSchedule(requestId, visitId, {
				assigned_to:
					editScheduleAssignedTo ?
						parseInt(editScheduleAssignedTo)
					:	undefined,
				scheduled_date: editScheduleDate || undefined,
				scheduled_time: editScheduleTime || undefined,
			});
			addToast('Agendamento atualizado.', 'success');
			setEditingVisitScheduleId(null);
			setEditScheduleSearch('');
			await loadRequest();
		} catch (err: any) {
			addToast(
				err?.response?.data?.message ||
					'Erro ao atualizar agendamento.',
				'error',
			);
		} finally {
			setIsActing(false);
		}
	};

	const initItemVisitDraft = () => {
		const draft: ItemVisitDraft = {};
		(request?.items || []).forEach((item) => {
			draft[item.id] = { result: '', constatada_quantity: item.quantity };
		});
		return draft;
	};

	const validateItemVisitDraft = (draft: ItemVisitDraft) => {
		const items = request?.items || [];
		for (const item of items) {
			const entry = draft[item.id];
			if (!entry?.result) {
				addToast('Informe o resultado de todos os equipamentos.', 'error');
				return false;
			}
			if (entry.result === 'constatada') {
				const qty = Number(entry.constatada_quantity);
				if (!qty || qty < 1 || qty > item.quantity) {
					addToast(
						`Quantidade constatada inválida para "${itemLabel(item)}".`,
						'error',
					);
					return false;
				}
			}
		}
		return true;
	};

	const buildItemResultsPayload = (draft: ItemVisitDraft) =>
		(request?.items || []).map((item) => {
			const entry = draft[item.id];
			return {
				catalog_item_id: item.id,
				result: entry.result as VisitItemResultValue,
				constatada_quantity:
					entry.result === 'constatada' ? entry.constatada_quantity : null,
			};
		});

	const handleUpdateVisitResult = async (visitId: number) => {
		if (!validateItemVisitDraft(editItemVisitResults)) return;
		setIsActing(true);
		try {
			await requestsApi.updateVisitResult(requestId, visitId, {
				item_results: buildItemResultsPayload(editItemVisitResults),
				findings: editVisitFindings || undefined,
			});
			addToast('Resultado atualizado.', 'success');
			setEditingVisitResultId(null);
			setEditItemVisitResults({});
			setEditVisitFindings('');
			await loadRequest();
		} catch (err: any) {
			addToast(
				err?.response?.data?.message || 'Erro ao atualizar resultado.',
				'error',
			);
		} finally {
			setIsActing(false);
		}
	};

	const handleCompleteVisit = async (visitId: number) => {
		if (!validateItemVisitDraft(itemVisitResults)) return;
		setIsActing(true);
		try {
			await requestsApi.completeVisit(requestId, visitId, {
				item_results: buildItemResultsPayload(itemVisitResults),
				findings: visitFindings || undefined,
			});
			addToast('Visita técnica concluída.', 'success');
			setCompletingVisitId(null);
			setCompletingVisitMode(null);
			setItemVisitResults({});
			setVisitFindings('');
			await loadRequest();
		} catch (err: any) {
			addToast(
				err?.response?.data?.message || 'Erro ao concluir visita.',
				'error',
			);
		} finally {
			setIsActing(false);
		}
	};

	const handleCompleteFrustratedVisit = async (visitId: number) => {
		if (!frustratedReason.trim()) {
			addToast('Informe o motivo da visita frustrada.', 'error');
			return;
		}
		setIsActing(true);
		try {
			await requestsApi.completeVisit(requestId, visitId, {
				outcome: 'frustrada',
				reason: frustratedReason.trim(),
			});
			addToast(
				'Visita frustrada registrada. Agende uma nova visita técnica.',
				'success',
			);
			setCompletingVisitId(null);
			setCompletingVisitMode(null);
			setFrustratedReason('');
			await loadRequest();
			setShowScheduleVisit(true);
		} catch (err: any) {
			addToast(
				err?.response?.data?.message || 'Erro ao registrar visita frustrada.',
				'error',
			);
		} finally {
			setIsActing(false);
		}
	};

	const resetCompletingVisit = () => {
		setCompletingVisitId(null);
		setCompletingVisitMode(null);
		setItemVisitResults({});
		setVisitFindings('');
		setFrustratedReason('');
	};

	const initDeliberationDraft = () => {
		const draft: ItemDeliberationDraft = {};
		(request?.items || []).forEach((item) => {
			draft[item.id] = {
				decision: item.deliberation?.decision || '',
				approved_quantity:
					item.deliberation?.approved_quantity || item.quantity,
			};
		});
		setDeliberationDraft(draft);
		setShowDeliberationForm(true);
	};

	const handleSubmitDeliberation = async () => {
		const items = request?.items || [];
		for (const item of items) {
			const d = deliberationDraft[item.id];
			if (!d?.decision) {
				addToast('Delibere sobre todos os equipamentos.', 'error');
				return;
			}
			if (d.decision === 'aprovado') {
				const qty = Number(d.approved_quantity);
				if (!qty || qty < 1 || qty > item.quantity) {
					addToast(
						`Quantidade inválida para "${itemLabel(item)}".`,
						'error',
					);
					return;
				}
			}
		}
		setIsActing(true);
		try {
			await requestsApi.submitItemDeliberations(
				requestId,
				items.map((item) => {
					const d = deliberationDraft[item.id];
					return {
						catalog_item_id: item.id,
						decision: d.decision as ItemDeliberationDecision,
						approved_quantity:
							d.decision === 'aprovado' ? d.approved_quantity : null,
					};
				}),
				deliberationNotes || undefined,
			);
			addToast('Deliberação registrada.', 'success');
			setShowDeliberationForm(false);
			setDeliberationNotes('');
			await loadRequest();
		} catch (err: any) {
			addToast(
				err?.response?.data?.message || 'Erro ao registrar deliberação.',
				'error',
			);
		} finally {
			setIsActing(false);
		}
	};

	const handleDownloadOficio = async () => {
		try {
			const token = localStorage.getItem('token');
			const base = API_URL.replace(/\/api$/, '');
			const resp = await fetch(
				`${base}/api/requests/${requestId}/oficio`,
				{
					headers: { Authorization: `Bearer ${token}` },
				},
			);
			if (!resp.ok) throw new Error();
			const blob = await resp.blob();
			const url = window.URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;
			a.download = request?.oficio_original_name || 'oficio';
			document.body.appendChild(a);
			a.click();
			document.body.removeChild(a);
			window.URL.revokeObjectURL(url);
		} catch {
			addToast('Erro ao baixar ofício.', 'error');
		}
	};

	const showVisitSection =
		request != null &&
		request.status === 'visita_tecnica_solicitada' &&
		['basic', 'operator', 'manager', 'admin'].includes(currentUserRole);
	const hasPendingVisit =
		request?.visits?.some((v) => !v.completed_at) ?? false;
	const canScheduleVisit = showVisitSection && !hasPendingVisit;

	const auxiliaryTransitions = (request?.allowed_transitions ?? []).filter(
		(toStatus) => AUXILIARY_TRANSITIONS.has(toStatus),
	);
	const decisionTransitions = (request?.allowed_transitions ?? []).filter(
		(toStatus) => !AUXILIARY_TRANSITIONS.has(toStatus),
	);
	const canRevert = Boolean(request?.can_revert && request?.previous_status);
	const hasFooterActions =
		auxiliaryTransitions.length > 0 ||
		decisionTransitions.length > 0 ||
		canRevert ||
		(request != null &&
			APPROVED_LIKE_STATUSES.has(request.status) &&
			!request.dit_ciente_at &&
			['operator', 'manager', 'admin'].includes(currentUserRole));

	const transitionLabel = (toStatus: RequestStatus) =>
		request?.status === 'indisponivel_estoque' &&
		TRANSITION_LABELS_FROM_UNAVAILABLE[toStatus]
			? TRANSITION_LABELS_FROM_UNAVAILABLE[toStatus]
			: TRANSITION_LABELS[toStatus] ||
				REQUEST_STATUS_LABELS[toStatus] ||
				toStatus;

	const renderTransitionButton = (toStatus: RequestStatus) => (
		<button
			key={toStatus}
			onClick={() => {
				if (DESTRUCTIVE_TRANSITIONS.has(toStatus)) {
					setConfirmingTransition(toStatus);
					setConfirmingRevert(false);
				} else {
					handleTransition(toStatus);
				}
			}}
			className={`px-4 py-2 text-sm rounded-lg font-medium transition-colors ${TRANSITION_STYLES[toStatus] || 'bg-blue-600 hover:bg-blue-700 text-white'}`}
		>
			{transitionLabel(toStatus)}
		</button>
	);

	return (
		<div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
			<div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[92vh] flex flex-col">
				{/* Header */}
				<div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
					<div className="flex items-center gap-3">
						<span className="font-mono font-semibold text-blue-700 text-sm">
							{request?.protocol || '…'}
						</span>
						{request && <StatusBadge status={request.status} />}
					</div>
					<button
						onClick={onClose}
						className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
					>
						<X size={18} />
					</button>
				</div>

				{isLoading ?
					<div className="flex items-center justify-center py-20 text-gray-400 text-sm">
						Carregando…
					</div>
				: !request ?
					<div className="flex items-center justify-center py-20 text-gray-400 text-sm">
						Solicitação não encontrada.
					</div>
				:	<>
						{/* Abas */}
						<div className="flex border-b border-gray-100 px-6 shrink-0">
							{(['info', 'timeline', 'movements'] as const).map(
								(tab) => {
									const labels = {
										info: 'Informações',
										timeline: 'Histórico',
										movements: 'Movimentações',
									};
									return (
										<button
											key={tab}
											onClick={() => setActiveTab(tab)}
											className={`py-3 px-1 mr-6 text-sm font-medium border-b-2 transition-colors ${
												activeTab === tab ?
													'border-blue-500 text-blue-600'
												:	'border-transparent text-gray-500 hover:text-gray-700'
											}`}
										>
											{labels[tab]}
											{tab === 'movements' &&
												(request.movements?.length ??
													0) > 0 && (
													<span className="ml-1.5 px-1.5 py-0.5 text-xs bg-gray-100 rounded-full">
														{
															request.movements!
																.length
														}
													</span>
												)}
										</button>
									);
								},
							)}
						</div>

						{/* Conteúdo */}
						<div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
							{/* ── Aba Informações ── */}
							{activeTab === 'info' && (
								<>
									<div className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm">
										<div>
											<p className="text-xs text-gray-400 mb-0.5">
												Tipo
											</p>
											<p className="font-medium text-gray-800">
												{REQUEST_TYPE_LABELS[
													request.type
												] || request.type}
											</p>
										</div>
										<div>
											<p className="text-xs text-gray-400 mb-0.5">
												Canal de Entrada
											</p>
											<p className="font-medium text-gray-800">
												{REQUEST_CHANNEL_LABELS[
													request.input_channel
												] || request.input_channel}
												{request.input_channel_details && (
													<span className="text-gray-500 ml-1 font-normal">
														(
														{
															request.input_channel_details
														}
														)
													</span>
												)}
											</p>
										</div>
										<div>
											<p className="text-xs text-gray-400 mb-0.5">
												Unidade
											</p>
											<p className="font-medium text-gray-800">
												{request.unit_name || '—'}
											</p>
											{request.unit_rpa && (
												<p className="text-xs text-gray-400">
													{request.unit_rpa}
												</p>
											)}
										</div>
										<div>
											<p className="text-xs text-gray-400 mb-0.5">
												Solicitante
											</p>
											<p className="font-medium text-gray-800">
												{request.requester_name || '—'}
											</p>
										</div>
										{request.fundamentacao && (
											<div>
												<p className="text-xs text-gray-400 mb-0.5">
													Fundamentação
												</p>
												<p className="font-medium text-gray-800">
													{(
														request.fundamentacao ===
														'avaria'
													) ?
														'Avaria'
													:	'Necessidade Operacional'}
												</p>
											</div>
										)}
										{request.approved_by_name && (
											<div>
												<p className="text-xs text-gray-400 mb-0.5">
													Aprovado por
												</p>
												<p className="font-medium text-gray-800">
													{request.approved_by_name}
												</p>
											</div>
										)}
								{(APPROVED_LIKE_STATUSES.has(request.status) || request.status === 'indisponivel_estoque') && (
									<div className="col-span-2 space-y-1">
										{request.dit_ciente_at ? (
											<>
												<div className="flex items-center gap-1.5 px-3 py-1.5 bg-green-50 border border-green-200 rounded-lg text-xs text-green-700 font-medium flex-wrap">
													<CheckCheck size={13} className="shrink-0" />
													<span>
														DIT ciente em{' '}
														{new Date(request.dit_ciente_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
														{' às '}
														{new Date(request.dit_ciente_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
														{request.dit_ciente_by_name && ` · ${request.dit_ciente_by_name}`}
													</span>
													{request.dit_modalidade && (
														<span className="ml-1 px-1.5 py-0.5 bg-green-100 rounded font-semibold uppercase tracking-wide">
															{request.dit_modalidade === 'entrega' ? 'Entrega' : 'Retirada'}
														</span>
													)}
												</div>
												{request.dit_previsao_at && (
													<div className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-700 font-medium">
														<Calendar size={13} className="shrink-0" />
														<span>
															Previsto para{' '}
															{new Date(String(request.dit_previsao_at).slice(0, 10) + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
														</span>
														{(request.dit_eventos?.filter(e => e.tipo === 'reagendamento').length ?? 0) > 0 && (
															<span className="ml-1 px-1.5 py-0.5 bg-orange-100 text-orange-700 rounded font-semibold">
																Reagendado {request.dit_eventos!.filter(e => e.tipo === 'reagendamento').length}×
															</span>
														)}
													</div>
												)}
											</>
										) : (
											<div className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700 font-medium">
												<Clock size={13} className="shrink-0" />
												<span>Aguardando ciência da DIT</span>
											</div>
										)}
									</div>
								)}
										<div>
											<p className="text-xs text-gray-400 mb-0.5">
												Aberto em
											</p>
											<p className="font-medium text-gray-800">
												{new Date(
													request.created_at,
												).toLocaleString('pt-BR')}
											</p>
										</div>
										<div>
											<p className="text-xs text-gray-400 mb-0.5">
												Criado por
											</p>
											<p className="font-medium text-gray-800">
												{request.created_by_name || '—'}
											</p>
										</div>
									</div>

									{/* ── Equipamentos Solicitados ── */}
									{request.items &&
										request.items.length > 0 && (
											<div>
												<p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
													Equipamentos Solicitados
												</p>
												<ul className="space-y-2">
													{request.items.map((item) => (
														<li
															key={item.id}
															className="px-3 py-2.5 bg-blue-50 border border-blue-100 rounded-lg text-sm space-y-1.5"
														>
															<div className="flex items-center justify-between gap-2">
																<span className="text-blue-800 font-medium">
																	{itemLabel(item)}
																	{item.description &&
																		!item.brand_name && (
																			<span className="text-gray-500">
																				{' '}
																				— {item.description}
																			</span>
																		)}
																</span>
																<span className="text-xs text-blue-600 font-semibold ml-3 flex-shrink-0">
																	Solicitado: × {item.quantity}
																</span>
															</div>
															{item.deliberation && (
																<div className="flex flex-wrap gap-1.5">
																	<span
																		className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${
																			item.deliberation.decision === 'aprovado'
																				? 'bg-green-100 text-green-700'
																				: 'bg-red-100 text-red-700'
																		}`}
																	>
																		{item.deliberation.decision === 'aprovado'
																			? `Aprovado × ${item.deliberation.approved_quantity ?? item.quantity}`
																			: 'Reprovado'}
																	</span>
																</div>
															)}
														</li>
													))}
												</ul>
											</div>
										)}

									{/* ── Ofício ── */}
									{request.oficio_path && (
										<div className="flex items-center justify-between px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-sm">
											<div className="flex items-center gap-2 min-w-0">
												<span className="text-amber-700 font-medium shrink-0">
													Ofício:
												</span>
												<span className="text-gray-700 truncate">
													{request.oficio_original_name ||
														'Arquivo anexado'}
												</span>
											</div>
											<button
												onClick={handleDownloadOficio}
												className="flex items-center gap-1 ml-3 px-2.5 py-1 text-xs font-medium text-amber-800 bg-amber-200 rounded-lg hover:bg-amber-300 transition-colors shrink-0"
											>
												<Download size={12} />
												Baixar
											</button>
										</div>
									)}

									{request.notes && (
										<div className="p-3 bg-gray-50 rounded-lg text-sm text-gray-700 border border-gray-100">
											<p className="text-xs text-gray-400 mb-1">
												Observações
											</p>
											{request.notes}
										</div>
									)}

									{/* ── Visitas técnicas ── */}
									{request.status !== 'requisitado' &&
										request.visits &&
										request.visits.length > 0 && (
											<div>
												<p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
													Visitas Técnicas
												</p>
												<div className="space-y-2">
													{[...(request.visits ?? [])]
														.sort(
															(a, b) =>
																new Date(a.created_at).getTime() -
																new Date(b.created_at).getTime(),
														)
														.map((v) => {
														const canEditSchedule =
															!v.completed_at &&
															request.status ===
																'visita_tecnica_solicitada';
														const isEditingSchedule =
															editingVisitScheduleId ===
															v.id;
														const isRegisteringResult =
															completingVisitId === v.id &&
															completingVisitMode === 'itens';
														const isRegisteringFrustrated =
															completingVisitId === v.id &&
															completingVisitMode === 'frustrada';
														const isEditingResult =
															editingVisitResultId ===
															v.id;
														const latestEditableVisitId = [...(request.visits ?? [])]
															.filter(
																(visit) =>
																	visit.completed_at &&
																	visit.result !== 'frustrada' &&
																	visit.result !== 'cancelada',
															)
															.sort(
																(a, b) =>
																	new Date(b.completed_at!).getTime() -
																	new Date(a.completed_at!).getTime(),
															)[0]?.id;
														const canEditVisitResult =
															!!v.completed_at &&
															v.result !== 'frustrada' &&
															v.result !== 'cancelada' &&
															v.id === latestEditableVisitId &&
															DELIBERATION_STATUSES.has(
																request.status,
															);

														return (
															<div
																key={v.id}
																className="rounded-lg border border-purple-100 text-sm overflow-hidden"
															>
																{/* ── Seção de agendamento ── */}
																<div className="p-3 bg-purple-50">
																	{(
																		isEditingSchedule
																	) ?
																		/* Formulário de edição de agendamento */
																		<div className="space-y-2.5">
																			<p className="text-xs font-semibold text-purple-700 uppercase tracking-wide">
																				Editar
																				agendamento
																			</p>
																			<div className="grid grid-cols-2 gap-2">
																				<div>
																					<label className="text-xs text-gray-600 mb-0.5 block">
																						Data
																					</label>
																					<input
																						type="date"
																						value={
																							editScheduleDate
																						}
																						onChange={(
																							e,
																						) =>
																							setEditScheduleDate(
																								e
																									.target
																									.value,
																							)
																						}
																						className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-purple-300"
																					/>
																				</div>
																				<div>
																					<label className="text-xs text-gray-600 mb-0.5 block">
																						Horário
																					</label>
																					<input
																						type="time"
																						value={
																							editScheduleTime
																						}
																						onChange={(
																							e,
																						) =>
																							setEditScheduleTime(
																								e
																									.target
																									.value,
																							)
																						}
																						className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-purple-300"
																					/>
																				</div>
																			</div>
																			<div className="relative">
																				<label className="text-xs text-gray-600 mb-0.5 block">
																					Técnico
																					responsável
																				</label>
																				<input
																					type="text"
																					placeholder="Digite o nome do técnico…"
																					value={
																						editScheduleSearch
																					}
																					onChange={(
																						e,
																					) => {
																						setEditScheduleSearch(
																							e
																								.target
																								.value,
																						);
																						setEditScheduleAssignedTo(
																							'',
																						);
																						setEditScheduleOpen(
																							true,
																						);
																					}}
																					onFocus={() =>
																						setEditScheduleOpen(
																							true,
																						)
																					}
																					onBlur={() =>
																						setTimeout(
																							() =>
																								setEditScheduleOpen(
																									false,
																								),
																							150,
																						)
																					}
																					className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-purple-300"
																				/>
																				{editScheduleOpen &&
																					getUserSuggestions(
																						editScheduleSearch,
																					)
																						.length >
																						0 && (
																						<ul className="absolute z-20 w-full mt-0.5 bg-white border border-gray-200 rounded-lg shadow-lg max-h-36 overflow-y-auto">
																							{getUserSuggestions(
																								editScheduleSearch,
																							).map(
																								(
																									u,
																								) => (
																									<li
																										key={
																											u.id
																										}
																									>
																										<button
																											type="button"
																											onMouseDown={() => {
																												setEditScheduleSearch(
																													u.full_name,
																												);
																												setEditScheduleAssignedTo(
																													String(
																														u.id,
																													),
																												);
																												setEditScheduleOpen(
																													false,
																												);
																											}}
																											className="w-full text-left px-3 py-1.5 text-xs hover:bg-purple-50 text-gray-700"
																										>
																											{
																												u.full_name
																											}
																										</button>
																									</li>
																								),
																							)}
																						</ul>
																					)}
																				{editScheduleSearch &&
																					!editScheduleAssignedTo && (
																						<p className="text-xs text-amber-600 mt-0.5">
																							Selecione
																							um
																							nome
																							da
																							lista
																						</p>
																					)}
																			</div>
																			<div className="flex gap-2 pt-1">
																				<button
																					onClick={() => {
																						setEditingVisitScheduleId(
																							null,
																						);
																						setEditScheduleSearch(
																							'',
																						);
																					}}
																					className="flex-1 py-1.5 text-xs border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50"
																				>
																					Cancelar
																				</button>
																				<button
																					onClick={() =>
																						handleUpdateVisitSchedule(
																							v.id,
																						)
																					}
																					disabled={
																						isActing
																					}
																					className="flex-1 py-1.5 text-xs bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-60"
																				>
																					{(
																						isActing
																					) ?
																						'Salvando…'
																					:	'Salvar'
																					}
																				</button>
																			</div>
																		</div>
																	:	/* Visualização do agendamento */
																		<div className="flex items-start justify-between gap-2">
																			<div className="space-y-1">
																				<div className="flex items-center gap-2 flex-wrap">
																					{v.completed_at ?
																						v.result === 'cancelada' ?
																							<span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-700 rounded-full font-medium">
																								Visita Cancelada
																							</span>
																						: v.result === 'frustrada' ?
																							<span className="text-xs px-2 py-0.5 bg-orange-100 text-orange-800 rounded-full font-medium">
																								Visita Frustrada
																							</span>
																						: v.result === 'constatada' ?
																							<span className="text-xs px-2 py-0.5 bg-red-100 text-red-700 rounded-full font-medium">
																								Necessidade Constatada
																							</span>
																						: v.result === 'nao_constatada' ?
																							<span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded-full font-medium">
																								Necessidade Não Constatada
																							</span>
																						:	<span className="text-xs px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full font-medium">
																								Resultado Parcial por Equipamento
																							</span>
																					:	<span className="text-xs px-2 py-0.5 bg-yellow-100 text-yellow-700 rounded-full font-medium">
																							Pendente
																						</span>
																					}
																					{v.scheduled_date && (
																						<span className="text-xs text-purple-600 flex items-center gap-1">
																							<Calendar
																								size={
																									11
																								}
																							/>
																							{formatVisitDate(
																								v.scheduled_date,
																							)}
																							{v.scheduled_time &&
																								` às ${v.scheduled_time}`}
																						</span>
																					)}
																				</div>
																				{v.assigned_to_name && (
																					<p className="text-xs text-gray-500">
																						Técnico:{' '}
																						{
																							v.assigned_to_name
																						}
																					</p>
																				)}
																			</div>
																			{canEditSchedule && (
																				<button
																					onClick={() => {
																						setEditingVisitScheduleId(
																							v.id,
																						);
																						setEditScheduleDate(
																							v.scheduled_date?.split(
																								'T',
																							)[0] ||
																								'',
																						);
																						setEditScheduleTime(
																							v.scheduled_time ||
																								'',
																						);
																						setEditScheduleAssignedTo(
																							(
																								v.assigned_to
																							) ?
																								String(
																									v.assigned_to,
																								)
																							:	'',
																						);
																						setEditScheduleSearch(
																							v.assigned_to_name ||
																								'',
																						);
																					}}
																					className="text-xs text-purple-500 hover:text-purple-700 hover:underline shrink-0"
																				>
																					Editar
																				</button>
																			)}
																		</div>
																	}
																</div>

																{/* ── Separador ── */}
																<div className="border-t border-purple-100" />

																{/* ── Seção de resultado ── */}
																<div className="p-3 bg-white">
																	{!v.completed_at ? (
																		isRegisteringResult ? (
																			<div className="space-y-3">
																				<p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
																					Registrar resultado por equipamento
																				</p>
																				{(request.items || []).map((item) => {
																					const draft = itemVisitResults[item.id] || {
																						result: '' as const,
																						constatada_quantity: item.quantity,
																					};
																					return (
																						<div key={item.id} className="border border-gray-200 rounded-lg p-2 space-y-1.5">
																							<p className="text-xs font-medium text-gray-700">
																								{itemLabel(item)}
																								<span className="text-gray-500 font-normal ml-2">
																									Solicitado: × {item.quantity}
																								</span>
																							</p>
																							<div className="flex gap-2">
																								{[
																									{ value: 'constatada', label: 'Constatada' },
																									{ value: 'nao_constatada', label: 'Não constatada' },
																								].map((opt) => (
																									<button
																										key={opt.value}
																										type="button"
																										onClick={() =>
																											setItemVisitResults((prev) => ({
																												...prev,
																												[item.id]: {
																													result: opt.value as VisitItemResultValue,
																													constatada_quantity:
																														prev[item.id]?.constatada_quantity || item.quantity,
																												},
																											}))
																										}
																										className={`flex-1 py-1.5 text-xs rounded-lg border-2 font-medium transition-colors ${
																											draft.result === opt.value
																												? 'border-purple-500 bg-purple-50 text-purple-700'
																												: 'border-gray-200 text-gray-600'
																										}`}
																									>
																										{opt.label}
																									</button>
																								))}
																							</div>
																							{draft.result === 'constatada' && (
																								<div>
																									<label className="text-xs text-gray-600 mb-1 block">
																										Quantidade com necessidade constatada
																									</label>
																									<input
																										type="number"
																										min={1}
																										max={item.quantity}
																										value={draft.constatada_quantity}
																										onChange={(e) =>
																											setItemVisitResults((prev) => ({
																												...prev,
																												[item.id]: {
																													result: 'constatada',
																													constatada_quantity:
																														parseInt(e.target.value, 10) || 1,
																												},
																											}))
																										}
																										className="w-28 px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-purple-300"
																									/>
																								</div>
																							)}
																						</div>
																					);
																				})}
																				<textarea
																					rows={2}
																					placeholder="Parecer técnico geral (opcional)…"
																					value={visitFindings}
																					onChange={(e) => setVisitFindings(e.target.value)}
																					className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-purple-300 resize-none"
																				/>
																				<div className="flex gap-2">
																					<button
																						onClick={resetCompletingVisit}
																						className="flex-1 py-1.5 text-xs border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50"
																					>
																						Cancelar
																					</button>
																					<button
																						onClick={() => handleCompleteVisit(v.id)}
																						disabled={
																							isActing ||
																							(request.items || []).some(
																								(item) => !itemVisitResults[item.id]?.result,
																							)
																						}
																						className="flex-1 py-1.5 text-xs bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-60"
																					>
																						{isActing ? 'Salvando…' : 'Salvar'}
																					</button>
																				</div>
																			</div>
																		) : isRegisteringFrustrated ? (
																			<div className="space-y-3">
																				<p className="text-xs font-semibold text-orange-700 uppercase tracking-wide">
																					Registrar visita frustrada
																				</p>
																				<p className="text-xs text-gray-500">
																					Use quando não foi possível verificar a necessidade in loco.
																					Após salvar, você poderá agendar uma nova visita.
																				</p>
																				<textarea
																					rows={3}
																					placeholder="Descreva o motivo da frustração da visita (obrigatório)…"
																					value={frustratedReason}
																					onChange={(e) => setFrustratedReason(e.target.value)}
																					className="w-full px-2 py-1.5 text-xs border border-orange-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-orange-300 resize-none"
																				/>
																				<div className="flex gap-2">
																					<button
																						onClick={resetCompletingVisit}
																						className="flex-1 py-1.5 text-xs border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50"
																					>
																						Cancelar
																					</button>
																					<button
																						onClick={() => handleCompleteFrustratedVisit(v.id)}
																						disabled={isActing || !frustratedReason.trim()}
																						className="flex-1 py-1.5 text-xs bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-60"
																					>
																						{isActing ? 'Salvando…' : 'Registrar frustrada'}
																					</button>
																				</div>
																			</div>
																		) : (
																			<div className="flex flex-wrap gap-3">
																				<button
																					onClick={() => {
																						setItemVisitResults(initItemVisitDraft());
																						setCompletingVisitId(v.id);
																						setCompletingVisitMode('itens');
																					}}
																					className="text-xs text-purple-600 hover:underline font-medium"
																				>
																					Registrar resultado
																				</button>
																				<button
																					onClick={() => {
																						setCompletingVisitId(v.id);
																						setCompletingVisitMode('frustrada');
																						setFrustratedReason('');
																					}}
																					className="text-xs text-orange-600 hover:underline font-medium"
																				>
																					Visita frustrada
																				</button>
																			</div>
																		)
																	) : v.result === 'cancelada' ? (
																		<div className="space-y-2">
																			<p className="text-xs text-gray-700 font-medium">
																				Visita técnica cancelada.
																			</p>
																			{v.findings && (
																				<p className="text-xs text-gray-600">
																					<span className="font-medium">Motivo:</span> {v.findings}
																				</p>
																			)}
																		</div>
																	) : v.result === 'frustrada' ? (
																		<div className="space-y-2">
																			<p className="text-xs text-orange-800 font-medium">
																				Verificação não realizada in loco.
																			</p>
																			{v.findings && (
																				<p className="text-xs text-gray-600">
																					<span className="font-medium">Motivo:</span> {v.findings}
																				</p>
																			)}
																		</div>
																	) : isEditingResult ? (
																		<div className="space-y-3">
																			<p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
																				Corrigir resultado por equipamento
																			</p>
																			{(request.items || []).map((item) => {
																				const draft = editItemVisitResults[item.id] || {
																					result: '' as const,
																					constatada_quantity: item.quantity,
																				};
																				return (
																					<div key={item.id} className="border border-gray-200 rounded-lg p-2 space-y-1.5">
																						<p className="text-xs font-medium text-gray-700">
																							{itemLabel(item)}
																							<span className="text-gray-500 font-normal ml-2">
																								Solicitado: × {item.quantity}
																							</span>
																						</p>
																						<div className="flex gap-2">
																							{[
																								{ value: 'constatada', label: 'Constatada' },
																								{ value: 'nao_constatada', label: 'Não constatada' },
																							].map((opt) => (
																								<button
																									key={opt.value}
																									type="button"
																									onClick={() =>
																										setEditItemVisitResults((prev) => ({
																											...prev,
																											[item.id]: {
																												result: opt.value as VisitItemResultValue,
																												constatada_quantity:
																													prev[item.id]?.constatada_quantity || item.quantity,
																											},
																										}))
																									}
																									className={`flex-1 py-1.5 text-xs rounded-lg border-2 font-medium transition-colors ${
																										draft.result === opt.value
																											? 'border-purple-500 bg-purple-50 text-purple-700'
																											: 'border-gray-200 text-gray-600'
																									}`}
																								>
																									{opt.label}
																								</button>
																							))}
																						</div>
																						{draft.result === 'constatada' && (
																							<div>
																								<label className="text-xs text-gray-600 mb-1 block">
																									Quantidade com necessidade constatada
																								</label>
																								<input
																									type="number"
																									min={1}
																									max={item.quantity}
																									value={draft.constatada_quantity}
																									onChange={(e) =>
																										setEditItemVisitResults((prev) => ({
																											...prev,
																											[item.id]: {
																												result: 'constatada',
																												constatada_quantity:
																													parseInt(e.target.value, 10) || 1,
																											},
																										}))
																									}
																									className="w-28 px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-purple-300"
																								/>
																							</div>
																						)}
																					</div>
																				);
																			})}
																			<textarea
																				rows={2}
																				placeholder="Parecer técnico geral (opcional)…"
																				value={editVisitFindings}
																				onChange={(e) => setEditVisitFindings(e.target.value)}
																				className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-purple-300 resize-none"
																			/>
																			<div className="flex gap-2">
																				<button
																					onClick={() => {
																						setEditingVisitResultId(null);
																						setEditItemVisitResults({});
																						setEditVisitFindings('');
																					}}
																					className="flex-1 py-1.5 text-xs border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50"
																				>
																					Cancelar
																				</button>
																				<button
																					onClick={() => handleUpdateVisitResult(v.id)}
																					disabled={
																						isActing ||
																						(request.items || []).some(
																							(item) => !editItemVisitResults[item.id]?.result,
																						)
																					}
																					className="flex-1 py-1.5 text-xs bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-60"
																				>
																					{isActing ? 'Salvando…' : 'Salvar'}
																				</button>
																			</div>
																		</div>
																	) : (
																		<div className="space-y-2">
																			{(request.items || []).map((item) => {
																				const visitResult = getVisitItemResult(v, item.id);
																				if (!visitResult) return null;
																				return (
																					<div key={item.id} className="flex items-center justify-between gap-2 text-xs">
																						<span className="text-gray-600 truncate">{itemLabel(item)}</span>
																						<span
																							className={`px-2 py-0.5 rounded-full font-medium shrink-0 ${
																								visitResult.result === 'constatada'
																									? 'bg-red-100 text-red-700'
																									: 'bg-green-100 text-green-700'
																							}`}
																						>
																							{visitResult.result === 'constatada'
																								? `Constatada × ${visitResult.constatada_quantity ?? item.quantity}`
																								: 'Não constatada'}
																						</span>
																					</div>
																				);
																			})}
																			{v.findings && (
																				<p className="text-xs text-gray-500 italic">"{v.findings}"</p>
																			)}
																			{canEditVisitResult && (
																				<button
																					onClick={() => {
																						setEditItemVisitResults(
																							buildVisitEditDraft(request.items, v),
																						);
																						setEditVisitFindings(v.findings || '');
																						setEditingVisitResultId(v.id);
																					}}
																					className="text-xs text-purple-500 hover:text-purple-700 hover:underline"
																				>
																					Corrigir resultado
																				</button>
																			)}
																		</div>
																	)}
																</div>
															</div>
														);
													})}
												</div>
											</div>
										)}

									{/* Agendar visita — bloqueado antes de "Solicitar"; oculto se já há visita pendente */}
									{showVisitSection &&
										!showScheduleVisit &&
										!hasPendingVisit && (
											<button
												onClick={() =>
													canScheduleVisit &&
													setShowScheduleVisit(true)
												}
												disabled={!canScheduleVisit}
												title={
													!canScheduleVisit ?
														'Clique em "Solicitar Visita Técnica" para liberar o agendamento'
													:	undefined
												}
												className={`text-sm font-medium transition-colors ${
													canScheduleVisit ?
														'text-purple-600 hover:underline'
													:	'text-gray-400 cursor-not-allowed opacity-50 blur-[0.5px]'
												}`}
											>
												+ Agendar Visita Técnica
											</button>
										)}

									{showScheduleVisit && showVisitSection && (
										<div className="p-4 bg-purple-50 rounded-xl border border-purple-100 space-y-3">
											<p className="text-sm font-medium text-purple-800">
												Agendar Visita Técnica
											</p>
											<p className="text-xs text-purple-600">
												A visita é opcional e não
												vinculante. A gerência pode
												aprovar independente do
												resultado.
											</p>
											<div className="relative">
												<label className="text-xs text-gray-600 mb-1 block">
													Técnico responsável
												</label>
												<input
													type="text"
													placeholder="Digite o nome do técnico…"
													value={visitAssignedSearch}
													onChange={(e) => {
														setVisitAssignedSearch(
															e.target.value,
														);
														setVisitAssignedTo('');
														setVisitAssignedOpen(
															true,
														);
													}}
													onFocus={() =>
														setVisitAssignedOpen(
															true,
														)
													}
													onBlur={() =>
														setTimeout(
															() =>
																setVisitAssignedOpen(
																	false,
																),
															150,
														)
													}
													className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-purple-300"
												/>
												{visitAssignedOpen &&
													getUserSuggestions(
														visitAssignedSearch,
													).length > 0 && (
														<ul className="absolute z-20 w-full mt-0.5 bg-white border border-gray-200 rounded-lg shadow-lg max-h-40 overflow-y-auto">
															{getUserSuggestions(
																visitAssignedSearch,
															).map((u) => (
																<li key={u.id}>
																	<button
																		type="button"
																		onMouseDown={() => {
																			setVisitAssignedSearch(
																				u.full_name,
																			);
																			setVisitAssignedTo(
																				String(
																					u.id,
																				),
																			);
																			setVisitAssignedOpen(
																				false,
																			);
																		}}
																		className="w-full text-left px-3 py-2 text-sm hover:bg-purple-50 text-gray-700"
																	>
																		{
																			u.full_name
																		}
																	</button>
																</li>
															))}
														</ul>
													)}
												{visitAssignedSearch &&
													!visitAssignedTo && (
														<p className="text-xs text-amber-600 mt-0.5">
															Selecione um nome da
															lista
														</p>
													)}
											</div>
											<div className="grid grid-cols-2 gap-3">
												<div>
													<label className="text-xs text-gray-600 mb-1 block">
														Data prevista
													</label>
													<input
														type="date"
														value={
															visitScheduledDate
														}
														onChange={(e) =>
															setVisitScheduledDate(
																e.target.value,
															)
														}
														className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-purple-300"
													/>
												</div>
												<div>
													<label className="text-xs text-gray-600 mb-1 block">
														Horário
													</label>
													<input
														type="time"
														value={
															visitScheduledTime
														}
														onChange={(e) =>
															setVisitScheduledTime(
																e.target.value,
															)
														}
														className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-purple-300"
													/>
												</div>
											</div>
											<div className="flex gap-2">
												<button
													onClick={() => {
														setShowScheduleVisit(
															false,
														);
														setVisitAssignedSearch(
															'',
														);
														setVisitAssignedTo('');
													}}
													className="flex-1 py-1.5 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50"
												>
													Cancelar
												</button>
												<button
													onClick={
														handleScheduleVisit
													}
													disabled={isActing}
													className="flex-1 py-1.5 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-60"
												>
													{isActing ?
														'Agendando…'
													:	'Agendar'}
												</button>
											</div>
										</div>
									)}

									{/* ── Deliberação da Gerência (por equipamento) ── */}
									{DELIBERATION_STATUSES.has(request.status) &&
										['manager', 'admin'].includes(currentUserRole) && (
										<div className="border border-yellow-200 rounded-xl overflow-hidden">
											<div className="bg-yellow-50 px-4 py-2.5 flex items-center justify-between">
												<span className="text-sm font-semibold text-yellow-900">
													Deliberação da Gerência
												</span>
												{!showDeliberationForm && (
													<button
														onClick={initDeliberationDraft}
														className="text-xs px-2.5 py-1 bg-yellow-600 hover:bg-yellow-700 text-white rounded-md font-medium"
													>
														Deliberar por equipamento
													</button>
												)}
											</div>
											{showDeliberationForm ? (
												<div className="p-4 space-y-3 bg-white">
													{(request.items || []).map((item) => {
														const draft = deliberationDraft[item.id] || {
															decision: '',
															approved_quantity: item.quantity,
														}
														return (
															<div
																key={item.id}
																className="border border-gray-200 rounded-lg p-3 space-y-2"
															>
																<p className="text-sm font-medium text-gray-800">
																	{itemLabel(item)}
																	<span className="text-xs text-gray-500 font-normal ml-2">
																		Solicitado: × {item.quantity}
																	</span>
																</p>
																{item.visit_result && (
																	<p className="text-xs text-gray-500">
																		Visita:{' '}
																		{item.visit_result.result === 'constatada'
																			? 'necessidade constatada'
																			: 'necessidade não constatada'}
																		{' '}(não vinculante)
																	</p>
																)}
																<div className="flex gap-2">
																	{[
																		{ value: 'aprovado', label: 'Aprovar' },
																		{ value: 'reprovado', label: 'Reprovar' },
																	].map((opt) => (
																		<button
																			key={opt.value}
																			type="button"
																			onClick={() =>
																				setDeliberationDraft((prev) => ({
																					...prev,
																					[item.id]: {
																						decision: opt.value as ItemDeliberationDecision,
																						approved_quantity:
																							prev[item.id]?.approved_quantity || item.quantity,
																					},
																				}))
																			}
																			className={`flex-1 py-1.5 text-xs rounded-lg border-2 font-medium ${
																				draft.decision === opt.value
																					? opt.value === 'aprovado'
																						? 'border-green-500 bg-green-50 text-green-700'
																						: 'border-red-500 bg-red-50 text-red-700'
																					: 'border-gray-200 text-gray-600'
																			}`}
																		>
																			{opt.label}
																		</button>
																	))}
																</div>
																{draft.decision === 'aprovado' && (
																	<div>
																		<label className="text-xs text-gray-600 mb-1 block">
																			Quantidade autorizada
																		</label>
																		<input
																			type="number"
																			min={1}
																			max={item.quantity}
																			value={draft.approved_quantity}
																			onChange={(e) =>
																				setDeliberationDraft((prev) => ({
																					...prev,
																					[item.id]: {
																						...prev[item.id],
																						decision: 'aprovado',
																						approved_quantity: parseInt(e.target.value, 10) || 1,
																					},
																				}))
																			}
																			className="w-28 px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-yellow-400"
																		/>
																	</div>
																)}
															</div>
														)
													})}
													<textarea
														rows={2}
														placeholder="Observação geral da deliberação (opcional)…"
														value={deliberationNotes}
														onChange={(e) => setDeliberationNotes(e.target.value)}
														className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-yellow-400 resize-none"
													/>
													<div className="flex gap-2 justify-end">
														<button
															onClick={() => {
																setShowDeliberationForm(false)
																setDeliberationNotes('')
															}}
															className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50"
														>
															Cancelar
														</button>
														<button
															onClick={handleSubmitDeliberation}
															disabled={isActing}
															className="px-4 py-1.5 text-sm bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg font-medium disabled:opacity-60"
														>
															{isActing ? 'Salvando…' : 'Confirmar deliberação'}
														</button>
													</div>
												</div>
											) : (
												<div className="px-4 py-3 text-xs text-yellow-800 bg-white">
													Aprove ou reprove cada equipamento e defina a quantidade autorizada.
													Itens reprovados não seguirão para Registro de Movimentação.
												</div>
											)}
										</div>
									)}

									{/* ── Histórico DIT ── */}
								{request.dit_ciente_at && (
									<div className="border border-blue-200 rounded-xl overflow-hidden">
										<div className="bg-blue-600 px-4 py-2.5 flex items-center justify-between">
											<span className="text-sm font-semibold text-white">Histórico DIT</span>
											{['aprovado', 'parcialmente_aprovado', 'indisponivel_estoque'].includes(request.status) &&
												['operator', 'manager', 'admin'].includes(currentUserRole) && (
												<div className="flex gap-2">
													<button
														onClick={() => { setShowReagForm(true); setShowObsForm(false); }}
														className="text-xs px-2.5 py-1 bg-white/20 hover:bg-white/30 text-white rounded-md font-medium transition-colors"
													>
														Reagendar
													</button>
													<button
														onClick={() => { setShowObsForm(true); setShowReagForm(false); }}
														className="text-xs px-2.5 py-1 bg-white/20 hover:bg-white/30 text-white rounded-md font-medium transition-colors"
													>
														+ Observação
													</button>
												</div>
											)}
										</div>

										{/* Form de reagendamento */}
										{showReagForm && (
											<div className="px-4 py-3 bg-orange-50 border-b border-orange-200 space-y-2">
												<p className="text-xs font-semibold text-orange-800">Reagendar</p>
												<div>
													<label className="text-xs text-gray-600 mb-1 block">Nova data prevista</label>
													<input
														type="date"
														value={reagNovaData}
														onChange={e => setReagNovaData(e.target.value)}
														className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-300"
													/>
												</div>
												<div>
													<label className="text-xs text-gray-600 mb-1 block">Motivo do reagendamento</label>
													<textarea
														rows={2}
														placeholder="Descreva o motivo…"
														value={reagMotivo}
														onChange={e => setReagMotivo(e.target.value)}
														className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-300 resize-none"
													/>
												</div>
												<div className="flex gap-2 justify-end">
													<button onClick={() => { setShowReagForm(false); setReagNovaData(''); setReagMotivo(''); }} className="text-xs px-3 py-1.5 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50">Cancelar</button>
													<button onClick={() => handleRegistrarEventoDit('reagendamento')} disabled={isActing} className="text-xs px-3 py-1.5 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-medium disabled:opacity-50">{isActing ? 'Aguarde…' : 'Salvar'}</button>
												</div>
											</div>
										)}

										{/* Form de observação */}
										{showObsForm && (
											<div className="px-4 py-3 bg-gray-50 border-b border-gray-200 space-y-2">
												<p className="text-xs font-semibold text-gray-700">Nova Observação</p>
												<textarea
													rows={2}
													placeholder="Digite a observação…"
													value={obsMotivo}
													onChange={e => setObsMotivo(e.target.value)}
													className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300 resize-none"
												/>
												<div className="flex gap-2 justify-end">
													<button onClick={() => { setShowObsForm(false); setObsMotivo(''); }} className="text-xs px-3 py-1.5 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50">Cancelar</button>
													<button onClick={() => handleRegistrarEventoDit('observacao')} disabled={isActing} className="text-xs px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium disabled:opacity-50">{isActing ? 'Aguarde…' : 'Salvar'}</button>
												</div>
											</div>
										)}

										{/* Lista de eventos */}
										<div className="divide-y divide-gray-100">
											{(request.dit_eventos ?? []).map(ev => (
												<div key={ev.id} className="px-4 py-3 text-xs space-y-0.5">
													{ev.tipo === 'ciente' && (
														<>
															<p className="font-semibold text-green-700 flex items-center gap-1">
																<CheckCheck size={12} /> Ciência registrada
																{ev.modalidade && (
																	<span className="ml-1 px-1.5 py-0.5 bg-green-100 rounded font-bold uppercase">
																		{ev.modalidade === 'entrega' ? 'Entrega' : 'Retirada'}
																	</span>
																)}
															</p>
														</>
													)}
													{ev.tipo === 'reagendamento' && (
														<>
															<p className="font-semibold text-orange-700">Reagendamento</p>
															<p className="text-gray-600">
																De{' '}
																<span className="font-medium">{ev.data_anterior ? new Date(String(ev.data_anterior).slice(0, 10) + 'T12:00:00').toLocaleDateString('pt-BR') : '—'}</span>
																{' → '}
																<span className="font-medium">{ev.nova_data ? new Date(String(ev.nova_data).slice(0, 10) + 'T12:00:00').toLocaleDateString('pt-BR') : '—'}</span>
															</p>
															{ev.motivo && <p className="text-gray-500 italic">"{ev.motivo}"</p>}
														</>
													)}
													{ev.tipo === 'observacao' && (
														<>
															<p className="font-semibold text-blue-700">Observação</p>
															{ev.motivo && <p className="text-gray-600">"{ev.motivo}"</p>}
														</>
													)}
													<p className="text-gray-400 mt-1">
														{ev.changed_by_name} · {new Date(ev.changed_at).toLocaleString('pt-BR')}
													</p>
												</div>
											))}
										</div>
									</div>
								)}
								</>
							)}

							{/* ── Aba Histórico ── */}
							{activeTab === 'timeline' && (
								<div className="space-y-1">
									{(
										!request.history ||
										request.history.length === 0
									) ?
										<p className="text-sm text-gray-400 text-center py-8">
											Nenhum registro de histórico.
										</p>
									:	request.history.map((entry) => (
											<TimelineEntry
												key={entry.id}
												entry={entry}
											/>
										))
									}
								</div>
							)}

							{/* ── Aba Movimentações ── */}
							{activeTab === 'movements' && (
								<div className="space-y-3">
									{canLinkMovement &&
										APPROVED_LIKE_STATUSES.has(
											request.status,
										) &&
										(!request.movements ||
											request.movements.length === 0) && (
											<div className="flex justify-end">
												<button
													type="button"
													onClick={() => {
														setShowLinkModal(true);
														setLinkResults([]);
														setSelectedLinkMovement(
															null,
														);
														setLinkMatch(null);
														setConfirmMismatches(
															false,
														);
													}}
													className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-teal-600 hover:bg-teal-700 text-white"
												>
													<Link2 size={14} />
													Vincular movimentação
												</button>
											</div>
										)}
									{(
										!request.movements ||
										request.movements.length === 0
									) ?
										<div className="py-8 px-4">
											<div className="text-center">
												<Truck
													size={32}
													className="mx-auto text-gray-300 mb-2"
												/>
												<p className="text-sm text-gray-500 font-medium">
													Nenhuma movimentação
													vinculada.
												</p>
											</div>
											{APPROVED_LIKE_STATUSES.has(request.status) && (
												<div className="mt-4 p-3 bg-blue-50 border border-blue-100 rounded-lg text-xs text-blue-700 leading-relaxed">
													<p className="font-semibold mb-1">
														Próximo passo: registrar
														a movimentação
													</p>
													<p>
														Acesse{' '}
														<span className="font-medium">
															Logística &amp;
															Operações →
															Registrar
															Movimentação
														</span>
														, informe o protocolo{' '}
														<span className="font-mono font-bold">
															{request.protocol}
														</span>{' '}
														e selecione um ativo
														disponível. O status
														desta solicitação será
														atualizado
														automaticamente.
													</p>
													{canLinkMovement && (
														<p className="mt-2">
															Se a movimentação já
															foi concluída sem o
															protocolo, use{' '}
															<span className="font-medium">
																Vincular
																movimentação
															</span>{' '}
															acima para corrigir
															o vínculo
															retroativamente.
														</p>
													)}
												</div>
											)}
											{request.status ===
												'em_execucao' && (
												<div className="mt-4 p-3 bg-yellow-50 border border-yellow-100 rounded-lg text-xs text-yellow-700 leading-relaxed">
													<p className="font-semibold mb-1">
														Em execução — aguardando
														confirmação
													</p>
													<p>
														Uma movimentação foi
														criada. Após a
														confirmação da entrega
														(recibo assinado), esta
														solicitação será
														concluída
														automaticamente.
													</p>
												</div>
											)}
										</div>
									:	request.movements.map((m) => (
											<MovementCard key={m.id} m={m} />
										))
									}
								</div>
							)}
						</div>

						{/* ── Ações de transição ── */}
						{hasFooterActions && (
								<div className="px-6 py-4 border-t border-gray-100 shrink-0">
									{confirmingRevert && request.previous_status ?
										<div className="rounded-lg border border-amber-300 bg-amber-50 p-3 space-y-2.5">
											<p className="text-sm font-semibold text-amber-900 flex items-center gap-2">
												<RotateCcw size={15} className="shrink-0" />
												Desfazer última alteração?
											</p>
											<p className="text-sm text-amber-900">
												Status:{' '}
												<span className="font-medium">
													{REQUEST_STATUS_LABELS[request.status] ||
														request.status}
												</span>
												{' → '}
												<span className="font-medium">
													{REQUEST_STATUS_LABELS[request.previous_status] ||
														request.previous_status}
												</span>
											</p>
											<p className="text-xs text-amber-800 leading-relaxed">
												{request.status === 'visita_tecnica_solicitada' &&
												request.previous_status === 'requisitado'
													? 'Visitas técnicas agendadas pendentes serão canceladas automaticamente.'
													: ['em_execucao', 'concluido'].includes(request.status)
														? 'A solicitação será desvinculada da movimentação. Estoque e ativos vinculados à movimentação permanecerão inalterados.'
														: ['aprovado', 'parcialmente_aprovado', 'reprovado'].includes(
																	request.status,
															  )
															? 'A deliberação atual será limpa para permitir nova correção.'
															: 'O status voltará ao passo imediatamente anterior do fluxo.'}
											</p>
											<textarea
												rows={2}
												placeholder="Motivo da alteração (obrigatório)…"
												value={revertNotes}
												onChange={(e) => setRevertNotes(e.target.value)}
												className="w-full px-3 py-2 text-sm border border-amber-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-300 resize-none bg-white"
											/>
											<div className="flex gap-2">
												<button
													type="button"
													onClick={() => {
														setConfirmingRevert(false);
														setRevertNotes('');
													}}
													className="flex-1 py-2 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 bg-white"
												>
													Não, voltar
												</button>
												<button
													type="button"
													onClick={() => handleRevert()}
													disabled={isActing || !revertNotes.trim()}
													className="flex-1 py-2 text-sm rounded-lg font-medium disabled:opacity-60 bg-amber-600 hover:bg-amber-700 text-white"
												>
													{isActing ? 'Aguarde…' : 'Sim, desfazer'}
												</button>
											</div>
										</div>
									: confirmingTransition ?
										<div className="rounded-lg border border-red-200 bg-red-50 p-3 space-y-2.5">
											<p className="text-sm font-semibold text-red-800 flex items-center gap-2">
												<AlertTriangle size={15} className="shrink-0" />
												{confirmingTransition === 'cancelado' ?
													'Confirmar cancelamento desta solicitação?'
												:	'Confirmar reprovação desta solicitação?'}
											</p>
											<textarea
												rows={2}
												placeholder="Motivo / observação (opcional)…"
												value={transitionNotes}
												onChange={(e) =>
													setTransitionNotes(
														e.target.value,
													)
												}
												className="w-full px-3 py-2 text-sm border border-red-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-300 resize-none bg-white"
											/>
											<div className="flex gap-2">
												<button
													onClick={() => {
														setConfirmingTransition(
															null,
														);
														setTransitionNotes('');
													}}
													className="flex-1 py-2 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 bg-white"
												>
													Não, voltar
												</button>
												<button
													onClick={() =>
														handleTransition(
															confirmingTransition,
														)
													}
													disabled={isActing}
													className={`flex-1 py-2 text-sm rounded-lg font-medium disabled:opacity-60 ${TRANSITION_STYLES[confirmingTransition] || 'bg-red-600 hover:bg-red-700 text-white'}`}
												>
													{isActing ?
														'Aguarde…'
													:	'Sim, confirmar'}
												</button>
											</div>
										</div>
									:	<div className="space-y-3">
									{APPROVED_LIKE_STATUSES.has(request.status) && !request.dit_ciente_at &&
										['operator', 'manager', 'admin'].includes(currentUserRole) &&
										showDitForm && (
												<div className="w-full border border-amber-300 bg-amber-50 rounded-xl p-4 space-y-3">
													<p className="text-sm font-semibold text-amber-900">Registrar Ciência da DIT</p>
													<div>
														<p className="text-xs font-medium text-gray-600 mb-1.5">Modalidade</p>
														<div className="flex gap-2">
															{(['entrega', 'retirada'] as const).map(m => (
																<button
																	key={m}
																	type="button"
																	onClick={() => setDitModalidade(m)}
																	className={`flex-1 py-1.5 text-sm rounded-lg border-2 font-medium transition-colors ${ditModalidade === m ? 'border-amber-500 bg-amber-100 text-amber-800' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}
																>
																	{m === 'entrega' ? 'Entrega na unidade' : 'Retirada pelo solicitante'}
																</button>
															))}
														</div>
													</div>
													<div>
														<label className="text-xs font-medium text-gray-600 mb-1 block">Data prevista de realização</label>
														<input
															type="date"
															value={ditPrevisao}
															onChange={e => setDitPrevisao(e.target.value)}
															className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-300"
														/>
													</div>
													<div className="flex gap-2 justify-end">
														<button
															type="button"
															onClick={() => { setShowDitForm(false); setDitModalidade(''); setDitPrevisao(''); }}
															className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50"
														>
															Cancelar
														</button>
														<button
															type="button"
															onClick={handleDitCiente}
															disabled={isActing}
															className="px-4 py-1.5 text-sm bg-amber-500 hover:bg-amber-600 text-white rounded-lg font-medium disabled:opacity-50"
														>
															{isActing ? 'Aguarde…' : 'Confirmar'}
														</button>
													</div>
												</div>
										)}
									<div className="flex flex-wrap items-center justify-between gap-3">
										<div className="flex flex-wrap items-center gap-2">
											{auxiliaryTransitions.map(renderTransitionButton)}
											{canRevert && request.previous_status && (
												<button
													type="button"
													onClick={() => {
														setConfirmingRevert(true);
														setConfirmingTransition(null);
														setRevertNotes('');
													}}
													className="px-4 py-2 text-sm rounded-lg font-medium transition-colors border border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100"
												>
													<RotateCcw size={14} className="inline mr-1.5" />
													Desfazer última alteração
												</button>
											)}
											{APPROVED_LIKE_STATUSES.has(request.status) && !request.dit_ciente_at &&
												['operator', 'manager', 'admin'].includes(currentUserRole) &&
												!showDitForm && (
													<button
														onClick={() => setShowDitForm(true)}
														disabled={isActing}
														className="px-4 py-2 text-sm rounded-lg font-medium transition-colors bg-amber-500 hover:bg-amber-600 text-white disabled:opacity-50"
													>
														<CheckCheck size={14} className="inline mr-1.5" />
														Marcar DIT Ciente
													</button>
												)}
										</div>
										<div className="flex flex-wrap items-center gap-2 ml-auto">
											{decisionTransitions.map(renderTransitionButton)}
										</div>
									</div>
									</div>
									}
								</div>
							)}
					</>
				}
			</div>

			{showLinkModal && (
				<div className="absolute inset-0 z-20 flex items-center justify-center bg-black/40 p-4">
					<div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
						<div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between shrink-0">
							<div>
								<h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
									<Link2 size={18} className="text-teal-600" />
									Vincular movimentação concluída
								</h3>
								<p className="text-xs text-gray-500 mt-0.5">
									Busque por ID, solicitante, unidade ou patrimônio.
									Sem termo, listamos apenas empréstimos/saídas com
									afinidade de solicitante ou unidade.
								</p>
							</div>
							<button
								type="button"
								onClick={resetLinkModal}
								className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600"
							>
								<X size={18} />
							</button>
						</div>

						<div className="px-5 py-4 overflow-y-auto space-y-4 flex-1">
							<div className="flex gap-2">
								<input
									type="text"
									value={linkSearch}
									onChange={(e) => setLinkSearch(e.target.value)}
									onKeyDown={(e) => {
										if (e.key === 'Enter') {
											e.preventDefault();
											handleSearchLinkableMovements();
										}
									}}
									placeholder="ID, solicitante, unidade ou patrimônio…"
									className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-300"
								/>
								<button
									type="button"
									onClick={handleSearchLinkableMovements}
									disabled={linkSearching}
									className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg bg-gray-800 hover:bg-gray-900 text-white disabled:opacity-60"
								>
									<Search size={14} />
									{linkSearching ? 'Buscando…' : 'Buscar'}
								</button>
							</div>

							{linkResults.length > 0 && (
								<div className="space-y-2">
									<p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
										Resultados
									</p>
									{linkResults.map((m) => {
										const selected =
											selectedLinkMovement?.id === m.id;
										return (
											<button
												key={m.id}
												type="button"
												onClick={() =>
													handleSelectLinkMovement(m)
												}
												className={`w-full text-left p-3 rounded-lg border transition-colors ${
													selected
														? 'border-teal-500 bg-teal-50'
														: 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
												}`}
											>
												<div className="flex items-center justify-between gap-2">
													<span className="text-sm font-semibold text-gray-800">
														#{m.id} ·{' '}
														{MOVEMENT_TYPE_LABELS[
															m.movement_type
														] || m.movement_type}
													</span>
													<span className="text-xs text-gray-500">
														{m.asset_count} ativo(s)
													</span>
												</div>
												<p className="text-xs text-gray-600 mt-1">
													{m.recipient_name ||
														'Sem solicitante'}{' '}
													·{' '}
													{m.destination_unit_name ||
														'Sem unidade'}
												</p>
												<p className="text-xs text-gray-400 mt-0.5">
													{m.movement_date
														? new Date(
																m.movement_date,
															).toLocaleDateString(
																'pt-BR',
															)
														: new Date(
																m.created_at,
															).toLocaleDateString(
																'pt-BR',
															)}
													{m.responsible_name
														? ` · ${m.responsible_name}`
														: ''}
												</p>
											</button>
										);
									})}
								</div>
							)}

							{linkChecking && (
								<p className="text-sm text-gray-500">
									Analisando correspondência…
								</p>
							)}

							{linkMatch && selectedLinkMovement && !linkChecking && (
								<div
									className={`rounded-lg border p-3 space-y-3 ${
										linkMatch.matches
											? 'border-green-200 bg-green-50'
											: 'border-amber-300 bg-amber-50'
									}`}
								>
									<p
										className={`text-sm font-semibold flex items-center gap-1.5 ${
											linkMatch.matches
												? 'text-green-800'
												: 'text-amber-900'
										}`}
									>
										{linkMatch.matches ?
											<>
												<CheckCircle2 size={16} />
												Correspondência completa
											</>
										:	<>
												<AlertTriangle size={16} />
												Atenção: há divergências
											</>
										}
									</p>

									{(
										[
											[
												'Solicitante',
												linkMatch.solicitante,
											],
											['Unidade', linkMatch.unidade],
										] as const
									).map(([label, check]) => (
										<div
											key={label}
											className="text-xs grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5"
										>
											<span className="font-semibold text-gray-700 flex items-center gap-1 col-span-2">
												{check.match ?
													<CheckCircle2
														size={12}
														className="text-green-600"
													/>
												:	<XCircle
														size={12}
														className="text-amber-600"
													/>
												}
												{label}
											</span>
											<span className="text-gray-500">
												Solicitação:
											</span>
											<span className="text-gray-800">
												{check.request.name || '—'}
											</span>
											<span className="text-gray-500">
												Movimentação:
											</span>
											<span className="text-gray-800">
												{check.movement.name || '—'}
											</span>
										</div>
									))}

									<div className="text-xs space-y-1">
										<p className="font-semibold text-gray-700 flex items-center gap-1">
											{linkMatch.equipamento.match ?
												<CheckCircle2
													size={12}
													className="text-green-600"
												/>
											:	<XCircle
													size={12}
													className="text-amber-600"
												/>
											}
											Equipamento
										</p>
										<p className="text-gray-600">
											Solicitação:{' '}
											{linkMatch.equipamento.request_types
												.length > 0
												? linkMatch.equipamento.request_types
														.map(
															(t) =>
																`${t.item_type_name || 'Tipo'} (qtd ${t.quantity})`,
														)
														.join(', ')
												: '—'}
										</p>
										<p className="text-gray-600">
											Movimentação:{' '}
											{linkMatch.equipamento
												.movement_types.length > 0
												? linkMatch.equipamento.movement_types
														.map(
															(t) =>
																`${t.item_type_name || 'Tipo'} (qtd ${t.quantity})`,
														)
														.join(', ')
												: '—'}
										</p>
										{(linkMatch.equipamento.missing_in_movement
											?.length ?? 0) > 0 && (
											<p className="text-amber-800">
												Ausentes na movimentação:{' '}
												{(
													linkMatch.equipamento
														.missing_in_movement || []
												)
													.map(
														(t) =>
															`${t.item_type_name || 'Tipo'} (qtd ${t.quantity})`,
													)
													.join(', ')}
											</p>
										)}
										{(linkMatch.equipamento.quantity_shortfalls
											?.length ?? 0) > 0 && (
											<p className="text-amber-800">
												Quantidade insuficiente:{' '}
												{(
													linkMatch.equipamento
														.quantity_shortfalls || []
												)
													.map(
														(t) =>
															`${t.item_type_name || 'Tipo'} (solicitado ${t.requested}, encontrado ${t.found})`,
													)
													.join(', ')}
											</p>
										)}
										{(linkMatch.equipamento.extra_in_movement
											?.length ?? 0) > 0 && (
											<p className="text-amber-800">
												Extras na movimentação:{' '}
												{(
													linkMatch.equipamento
														.extra_in_movement || []
												)
													.map(
														(t) =>
															`${t.item_type_name || 'Tipo'} (qtd ${t.quantity})`,
													)
													.join(', ')}
											</p>
										)}
									</div>

									{!linkMatch.matches && (
										<label className="flex items-start gap-2 text-xs text-amber-900 cursor-pointer pt-1 border-t border-amber-200">
											<input
												type="checkbox"
												checked={confirmMismatches}
												onChange={(e) =>
													setConfirmMismatches(
														e.target.checked,
													)
												}
												className="mt-0.5"
											/>
											<span>
												Confirmo o vínculo retroativo
												mesmo com as divergências
												destacadas (
												{linkMatch.mismatches.join(
													', ',
												)}
												).
											</span>
										</label>
									)}

									<textarea
										rows={2}
										value={linkNotes}
										onChange={(e) =>
											setLinkNotes(e.target.value)
										}
										placeholder="Observação opcional sobre o vínculo…"
										className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-300 resize-none bg-white"
									/>
								</div>
							)}
						</div>

						<div className="px-5 py-3 border-t border-gray-100 flex justify-end gap-2 shrink-0">
							<button
								type="button"
								onClick={resetLinkModal}
								className="px-3 py-2 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50"
							>
								Cancelar
							</button>
							<button
								type="button"
								onClick={handleConfirmLinkMovement}
								disabled={
									isLinking ||
									!selectedLinkMovement ||
									!linkMatch ||
									linkChecking ||
									(!linkMatch.matches && !confirmMismatches)
								}
								className="px-4 py-2 text-sm rounded-lg font-medium bg-teal-600 hover:bg-teal-700 text-white disabled:opacity-50"
							>
								{isLinking
									? 'Vinculando…'
									: 'Confirmar vínculo'}
							</button>
						</div>
					</div>
				</div>
			)}
		</div>
	);
};

export default RequestDetail;
