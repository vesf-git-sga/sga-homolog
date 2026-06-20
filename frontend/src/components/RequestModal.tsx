import React, { useState, useContext, useEffect } from 'react';
import InputMask from 'react-input-mask';
import { X, Plus, Trash2, Paperclip, Loader2, UserPlus } from 'lucide-react';
import { AuthContext } from '../App';
import { useToast } from '../App';
import { requestsApi, RequestItemPayload } from '../services/requestsApi';
import {
	REQUEST_TYPE_LABELS,
	REQUEST_CHANNEL_LABELS,
} from '../utils/translations';
import {
	RequestType,
	InputChannel,
	CatalogBrand,
	CatalogModel,
	ItemType,
} from '../types/requests';
import PeopleModal, { PeopleModalUnit, PersonFormData } from './PeopleModal';

// ─── Helpers de canal ─────────────────────────────────────────────────────────

function getChannelOptions(
	type: RequestType,
	fundamentacao: string,
): { value: InputChannel; label: string }[] {
	if (type === 'emprestimo')
		return [
			{ value: 'sei', label: 'SEI' },
			{ value: 'email', label: 'E-mail' },
		];
	if (type === 'acrescimo')
		return [
			{ value: 'sei', label: 'SEI' },
			{ value: 'email', label: 'E-mail' },
		];
	if (type === 'substituicao') {
		return fundamentacao === 'avaria' ?
				[
					{ value: 'chamado', label: 'Chamado (defeito)' },
					{ value: 'sei', label: 'SEI' },
					{ value: 'email', label: 'E-mail' },
				]
			:	[
					{ value: 'sei', label: 'SEI' },
					{ value: 'email', label: 'E-mail' },
				];
	}
	return [];
}

// ─── Tipos locais ─────────────────────────────────────────────────────────────

interface PersonEntry {
	id: number;
	full_name: string;
	registration_number?: string;
	email?: string;
	unit_id?: number;
}

interface ConfirmedItem extends RequestItemPayload {
	_key: string;
	label: string;
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface RequestModalProps {
	onClose: () => void;
	onCreated: () => void;
}

// ─── Componente ──────────────────────────────────────────────────────────────

const RequestModal = ({ onClose, onCreated }: RequestModalProps) => {
	const ctx = useContext(AuthContext) as any;
	const API_URL: string = ctx?.API_URL || '';
	const { addToast } = useToast();

	// ── Campos principais ──────────────────────────────────────────────────
	const [type, setType] = useState<RequestType>('emprestimo');
	const [fundamentacao, setFundamentacao] = useState<
		'avaria' | 'necessidade_operacional' | ''
	>('');
	const [inputChannel, setInputChannel] = useState<InputChannel | ''>('');
	const [channelDetails, setChannelDetails] = useState('');
	const [notes, setNotes] = useState('');

	// ── Solicitante e Unidade ──────────────────────────────────────────────
	const [people, setPeople] = useState<PersonEntry[]>([]);
	const [units, setUnits] = useState<PeopleModalUnit[]>([]);
	const [personSearch, setPersonSearch] = useState('');
	const [selectedPerson, setSelectedPerson] = useState<{
		id: number;
		full_name: string;
	} | null>(null);
	const [showPersonDrop, setShowPersonDrop] = useState(false);
	const [selectedUnitId, setSelectedUnitId] = useState<number | ''>('');
	const [emailPrefilled, setEmailPrefilled] = useState(false);

	// ── Modal de nova pessoa ───────────────────────────────────────────────
	const [showNewPersonModal, setShowNewPersonModal] = useState(false);

	// ── Catálogo ──────────────────────────────────────────────────────────
	const [itemTypes, setItemTypes] = useState<ItemType[]>([]);
	const [brands, setBrands] = useState<CatalogBrand[]>([]);
	const [models, setModels] = useState<CatalogModel[]>([]);

	const [stagingTypeId, setStagingTypeId] = useState<number | ''>('');
	const [stagingBrandId, setStagingBrandId] = useState<number | ''>('');
	const [stagingModelId, setStagingModelId] = useState<number | ''>('');
	const [stagingQty, setStagingQty] = useState(1);
	const [newBrandName, setNewBrandName] = useState('');
	const [newModelName, setNewModelName] = useState('');
	const [addingBrand, setAddingBrand] = useState(false);
	const [addingModel, setAddingModel] = useState(false);
	const [catalogLoading, setCatalogLoading] = useState(false);

	const [items, setItems] = useState<ConfirmedItem[]>([]);

	// ── Ofício ────────────────────────────────────────────────────────────
	const [oficioFile, setOficioFile] = useState<File | null>(null);

	// ── Submit ────────────────────────────────────────────────────────────
	const [isLoading, setIsLoading] = useState(false);

	// ─── Carregamento inicial ──────────────────────────────────────────────────
	useEffect(() => {
		const token = localStorage.getItem('token');
		const headers = { Authorization: `Bearer ${token}` };
		const base = API_URL.replace(/\/api$/, '');

		Promise.all([
			fetch(`${base}/api/people`, { headers })
				.then((r) => r.json())
				.catch(() => []),
			fetch(`${base}/api/units`, { headers })
				.then((r) => r.json())
				.catch(() => []),
		]).then(([p, u]) => {
			setPeople(Array.isArray(p) ? p : []);
			const unitList = Array.isArray(u) ? u : u?.units || [];
			setUnits(unitList);
		});

		requestsApi
			.listItemTypes()
			.then(setItemTypes)
			.catch(() => {});
	}, [API_URL]);

	// Reseta canal quando muda tipo / fundamentação
	useEffect(() => {
		setInputChannel('');
		setChannelDetails('');
	}, [type, fundamentacao]);

	useEffect(() => {
		setChannelDetails('');
		setEmailPrefilled(false);
	}, [inputChannel]);

	// Pré-preenchimento automático quando canal = e-mail e endereço bate com cadastro
	useEffect(() => {
		if (inputChannel !== 'email') {
			setEmailPrefilled(false);
			return;
		}
		const emailVal = channelDetails.trim().toLowerCase();
		if (!emailVal.includes('@')) return;
		const match = people.find(
			(p) => p.email?.toLowerCase() === emailVal,
		);
		if (match) {
			setSelectedPerson({ id: match.id, full_name: match.full_name });
			setPersonSearch(match.full_name);
			setEmailPrefilled(true);
			if (match.unit_id) setSelectedUnitId(match.unit_id);
		}
	}, [channelDetails, inputChannel, people]);

	// Carrega marcas ao selecionar tipo de item no staging
	useEffect(() => {
		setStagingBrandId('');
		setStagingModelId('');
		setBrands([]);
		setModels([]);
		if (!stagingTypeId) return;
		setCatalogLoading(true);
		requestsApi
			.listBrands(stagingTypeId as number)
			.then(setBrands)
			.catch(() => {})
			.finally(() => setCatalogLoading(false));
	}, [stagingTypeId]);

	// Carrega modelos ao selecionar marca no staging
	useEffect(() => {
		setStagingModelId('');
		setModels([]);
		if (!stagingBrandId || !stagingTypeId) return;
		setCatalogLoading(true);
		requestsApi
			.listModels(stagingBrandId as number, stagingTypeId as number)
			.then(setModels)
			.catch(() => {})
			.finally(() => setCatalogLoading(false));
	}, [stagingBrandId, stagingTypeId]);

	// ─── Autocomplete de pessoa ───────────────────────────────────────────────
	const filteredPeople =
		personSearch.length >= 2 ?
			people
				.filter(
					(p) =>
						p.full_name
							.toLowerCase()
							.includes(personSearch.toLowerCase()) ||
						(p.registration_number || '').includes(personSearch),
				)
				.slice(0, 50)
		:	[];

	const handleSelectPerson = (p: { id: number; full_name: string }) => {
		setSelectedPerson(p);
		setPersonSearch(p.full_name);
		setShowPersonDrop(false);
		setEmailPrefilled(false);
	};

	// ─── Cadastro de nova pessoa ──────────────────────────────────────────────
	const handleSaveNewPerson = async (personData: PersonFormData) => {
		const token = localStorage.getItem('token');
		const base = API_URL.replace(/\/api$/, '');
		const resp = await fetch(`${base}/api/people`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${token}`,
			},
			body: JSON.stringify(personData),
		});
		if (!resp.ok) {
			const err = await resp.json().catch(() => ({}));
			throw new Error(err.message || 'Erro ao cadastrar pessoa.');
		}
		const newPerson = await resp.json();
		setPeople((prev) => [...prev, newPerson]);
		setSelectedPerson({ id: newPerson.id, full_name: newPerson.full_name });
		setPersonSearch(newPerson.full_name);
		if (newPerson.unit_id) setSelectedUnitId(newPerson.unit_id);
		setShowNewPersonModal(false);
		addToast('Pessoa cadastrada e selecionada como solicitante.', 'success');
	};

	// ─── Cadastro inline de marca ─────────────────────────────────────────────
	const handleCreateBrand = async () => {
		if (!newBrandName.trim()) return;
		try {
			const brand = await requestsApi.createBrand(newBrandName.trim());
			setBrands((prev) =>
				[...prev, brand].sort((a, b) => a.name.localeCompare(b.name)),
			);
			setStagingBrandId(brand.id);
			setNewBrandName('');
			setAddingBrand(false);
		} catch (err: any) {
			addToast(
				err?.response?.data?.error || 'Erro ao cadastrar marca.',
				'error',
			);
		}
	};

	// ─── Cadastro inline de modelo ────────────────────────────────────────────
	const handleCreateModel = async () => {
		if (!newModelName.trim() || !stagingBrandId || !stagingTypeId) return;
		try {
			const model = await requestsApi.createModel(
				newModelName.trim(),
				stagingBrandId as number,
				stagingTypeId as number,
			);
			setModels((prev) =>
				[...prev, model].sort((a, b) => a.name.localeCompare(b.name)),
			);
			setStagingModelId(model.id);
			setNewModelName('');
			setAddingModel(false);
		} catch (err: any) {
			addToast(
				err?.response?.data?.error || 'Erro ao cadastrar modelo.',
				'error',
			);
		}
	};

	// ─── Adicionar item à lista ───────────────────────────────────────────────
	const handleAddItem = () => {
		if (!stagingTypeId) {
			addToast('Selecione o tipo de equipamento.', 'warning');
			return;
		}
		if (stagingQty < 1) {
			addToast('Quantidade inválida.', 'warning');
			return;
		}

		const typeName =
			itemTypes.find((t) => t.id === stagingTypeId)?.name || '';
		const brandName =
			brands.find((b) => b.id === stagingBrandId)?.name || '';
		const modelName =
			models.find((m) => m.id === stagingModelId)?.name || '';
		const label =
			[typeName, brandName, modelName].filter(Boolean).join(' · ') +
			(stagingQty > 1 ? ` × ${stagingQty}` : '');

		setItems((prev) => [
			...prev,
			{
				_key: `${Date.now()}`,
				label,
				item_type_id: stagingTypeId as number,
				brand_id: stagingBrandId || null,
				model_id: stagingModelId || null,
				quantity: stagingQty,
			},
		]);

		setStagingTypeId('');
		setStagingBrandId('');
		setStagingModelId('');
		setStagingQty(1);
		setBrands([]);
		setModels([]);
	};

	const handleRemoveItem = (key: string) =>
		setItems((prev) => prev.filter((i) => i._key !== key));

	// ─── Submit ───────────────────────────────────────────────────────────────
	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();

		if (!selectedPerson) {
			addToast('Selecione o solicitante.', 'error');
			return;
		}
		if (!selectedUnitId) {
			addToast('Selecione a unidade solicitante.', 'error');
			return;
		}
		if (!inputChannel) {
			addToast('Selecione o canal de entrada.', 'error');
			return;
		}
		if (type === 'substituicao' && !fundamentacao) {
			addToast('Selecione a fundamentação da substituição.', 'error');
			return;
		}
		if (
			(inputChannel === 'sei' || inputChannel === 'chamado') &&
			!channelDetails.trim()
		) {
			addToast(
				`Informe ${inputChannel === 'sei' ? 'o número do processo SEI' : 'o número do chamado'}.`,
				'error',
			);
			return;
		}
		if (items.length === 0) {
			addToast('Adicione ao menos um item de equipamento.', 'error');
			return;
		}
		if (!oficioFile) {
			addToast(
				'Anexe o ofício da solicitação (PDF obrigatório).',
				'error',
			);
			return;
		}

		const formData = new FormData();
		formData.append('type', type);
		formData.append('input_channel', inputChannel);
		formData.append('requester_person_id', String(selectedPerson.id));
		formData.append('unit_id', String(selectedUnitId));
		if (channelDetails.trim())
			formData.append('input_channel_details', channelDetails.trim());
		if (fundamentacao) formData.append('fundamentacao', fundamentacao);
		if (notes.trim()) formData.append('notes', notes.trim());
		formData.append(
			'items',
			JSON.stringify(
				items.map(({ item_type_id, brand_id, model_id, quantity }) => ({
					item_type_id,
					brand_id: brand_id ?? null,
					model_id: model_id ?? null,
					quantity,
				})),
			),
		);
		formData.append('oficio', oficioFile);

		setIsLoading(true);
		try {
			await requestsApi.create(formData);
			addToast('Solicitação criada com sucesso.', 'success');
			onCreated();
		} catch (err: any) {
			addToast(
				err?.response?.data?.message || 'Erro ao criar solicitação.',
				'error',
			);
		} finally {
			setIsLoading(false);
		}
	};

	const channelOptions = getChannelOptions(type, fundamentacao);

	// ─── Render ───────────────────────────────────────────────────────────────
	return (
		<>
			<div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
				<div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[92vh] overflow-y-auto">
					{/* Header */}
					<div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white z-10">
						<h2 className="text-lg font-semibold text-gray-900">
							Nova Solicitação de TI
						</h2>
						<button
							onClick={onClose}
							className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
						>
							<X size={18} />
						</button>
					</div>

					<form onSubmit={handleSubmit} className="px-6 py-5 space-y-6">
						{/* ── Tipo ──────────────────────────────────────────────────────── */}
						<div>
							<label className="block text-sm font-medium text-gray-700 mb-2">
								Tipo de Solicitação{' '}
								<span className="text-red-500">*</span>
							</label>
							<div className="grid grid-cols-3 gap-2">
								{(
									[
										'emprestimo',
										'substituicao',
										'acrescimo',
									] as RequestType[]
								).map((t) => (
									<button
										key={t}
										type="button"
										onClick={() => {
											setType(t);
											setFundamentacao('');
										}}
										className={`py-2 px-3 text-sm rounded-lg border-2 font-medium transition-colors ${type === t ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}
									>
										{REQUEST_TYPE_LABELS[t]}
									</button>
								))}
							</div>
						</div>

						{/* ── Fundamentação (substituição) ──────────────────────────────── */}
						{type === 'substituicao' && (
							<div>
								<label className="block text-sm font-medium text-gray-700 mb-2">
									Fundamentação{' '}
									<span className="text-red-500">*</span>
								</label>
								<div className="grid grid-cols-2 gap-2">
									{[
										{ value: 'avaria', label: 'Avaria' },
										{
											value: 'necessidade_operacional',
											label: 'Necessidade Operacional',
										},
									].map((f) => (
										<button
											key={f.value}
											type="button"
											onClick={() =>
												setFundamentacao(
													f.value as
														| 'avaria'
														| 'necessidade_operacional',
												)
											}
											className={`py-2 px-3 text-sm rounded-lg border-2 font-medium transition-colors ${fundamentacao === f.value ? 'border-orange-500 bg-orange-50 text-orange-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}
										>
											{f.label}
										</button>
									))}
								</div>
							</div>
						)}

						{/* ── Canal de Entrada ──────────────────────────────────────────── */}
						{channelOptions.length > 0 && (
							<div>
								<label className="block text-sm font-medium text-gray-700 mb-2">
									Canal de Entrada{' '}
									<span className="text-red-500">*</span>
								</label>
								<div className="flex gap-2 flex-wrap">
									{channelOptions.map((opt) => (
										<button
											key={opt.value}
											type="button"
											onClick={() =>
												setInputChannel(opt.value)
											}
											className={`py-2 px-4 text-sm rounded-lg border-2 font-medium transition-colors ${inputChannel === opt.value ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}
										>
											{opt.label}
										</button>
									))}
								</div>
								{inputChannel === 'sei' && (
									<div className="mt-2">
										<InputMask
											mask="99.999999/9999-99"
											value={channelDetails}
											onChange={(e) =>
												setChannelDetails(e.target.value)
											}
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
										onChange={(e) =>
											setChannelDetails(e.target.value)
										}
										className="mt-2 w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300"
									/>
								)}
								{inputChannel === 'email' && (
									<input
										type="text"
										placeholder="Endereço de e-mail do solicitante"
										value={channelDetails}
										onChange={(e) =>
											setChannelDetails(e.target.value)
										}
										className="mt-2 w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300"
									/>
								)}
							</div>
						)}

						{/* ── Solicitante ───────────────────────────────────────────────── */}
						<div className="relative">
							<div className="flex items-center justify-between mb-1">
								<label className="block text-sm font-medium text-gray-700">
									Solicitante <span className="text-red-500">*</span>
								</label>
								<button
									type="button"
									onClick={() => setShowNewPersonModal(true)}
									className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 hover:underline"
								>
									<UserPlus size={13} />
									Cadastrar novo solicitante
								</button>
							</div>
							<input
								type="text"
								placeholder="Digite nome ou matrícula…"
								value={personSearch}
								onChange={(e) => {
									setPersonSearch(e.target.value);
									setSelectedPerson(null);
									setShowPersonDrop(true);
									setEmailPrefilled(false);
								}}
								onFocus={() => setShowPersonDrop(true)}
								onBlur={() =>
									setTimeout(() => setShowPersonDrop(false), 150)
								}
								className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300"
							/>
							{emailPrefilled && selectedPerson && (
								<p className="mt-1 text-xs text-indigo-600 flex items-center gap-1">
									<span className="inline-block w-1.5 h-1.5 rounded-full bg-indigo-500" />
									Preenchido automaticamente pelo e-mail — pode ser alterado
								</p>
							)}
							{showPersonDrop && filteredPeople.length > 0 && (
								<ul className="absolute z-20 w-full bg-white border border-gray-200 rounded-lg shadow-lg mt-1 max-h-48 overflow-y-auto">
									{filteredPeople.map((p) => (
										<li
											key={p.id}
											onMouseDown={() =>
												handleSelectPerson(p)
											}
											className="px-3 py-2 text-sm cursor-pointer hover:bg-blue-50"
										>
											<span className="font-medium">
												{p.full_name}
											</span>
											{p.registration_number && (
												<span className="text-gray-400 ml-2 text-xs">
													{p.registration_number}
												</span>
											)}
										</li>
									))}
								</ul>
							)}
						</div>

						{/* ── Unidade ───────────────────────────────────────────────────── */}
						<div>
							<label className="block text-sm font-medium text-gray-700 mb-1">
								Unidade Solicitante{' '}
								<span className="text-red-500">*</span>
							</label>
							<select
								value={selectedUnitId}
								onChange={(e) => {
									setSelectedUnitId(
										e.target.value ?
											parseInt(e.target.value)
										:	'',
									);
									setEmailPrefilled(false);
								}}
								className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300"
							>
								<option value="">Selecione a unidade…</option>
								{units.map((u) => (
									<option key={u.id} value={u.id}>
										{u.name}
									</option>
								))}
							</select>
							{emailPrefilled && selectedUnitId && (
								<p className="mt-1 text-xs text-indigo-600 flex items-center gap-1">
									<span className="inline-block w-1.5 h-1.5 rounded-full bg-indigo-500" />
									Lotação preenchida automaticamente — pode ser alterada
								</p>
							)}
						</div>

						{/* ── Itens de Equipamento ──────────────────────────────────────── */}
						<div className="border border-gray-200 rounded-xl p-4 space-y-4">
							<p className="text-sm font-semibold text-gray-800">
								Equipamentos Solicitados{' '}
								<span className="text-red-500">*</span>
							</p>

							{items.length > 0 && (
								<ul className="space-y-2">
									{items.map((item) => (
										<li
											key={item._key}
											className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 text-sm text-blue-800"
										>
											<span>{item.label}</span>
											<button
												type="button"
												onClick={() =>
													handleRemoveItem(item._key)
												}
												className="text-blue-400 hover:text-red-500 ml-2 flex-shrink-0"
											>
												<Trash2 size={14} />
											</button>
										</li>
									))}
								</ul>
							)}

							{/* Seletor em cascata: tipo → marca → modelo */}
							<div className="bg-gray-50 rounded-lg p-3 space-y-3 border border-dashed border-gray-300">
								<p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
									Adicionar item
								</p>

								{/* Tipo de equipamento */}
								<div>
									<label className="block text-xs font-medium text-gray-600 mb-1">
										Tipo de equipamento
									</label>
									<select
										value={stagingTypeId}
										onChange={(e) =>
											setStagingTypeId(
												e.target.value ?
													parseInt(e.target.value)
												:	'',
											)
										}
										className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-300"
									>
										<option value="">Selecione o tipo…</option>
										{itemTypes.map((t) => (
											<option key={t.id} value={t.id}>
												{t.name}
											</option>
										))}
									</select>
								</div>

								{/* Marca */}
								{stagingTypeId !== '' && (
									<div>
										<label className="block text-xs font-medium text-gray-600 mb-1">
											Marca
										</label>
										{catalogLoading ?
											<div className="flex items-center gap-2 text-xs text-gray-400 py-2">
												<Loader2
													size={12}
													className="animate-spin"
												/>{' '}
												Carregando marcas…
											</div>
										:	<>
												<select
													value={stagingBrandId}
													onChange={(e) =>
														setStagingBrandId(
															e.target.value ?
																parseInt(
																	e.target.value,
																)
															:	'',
														)
													}
													className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-300"
												>
													<option value="">
														Selecione a marca…
													</option>
													{brands.map((b) => (
														<option
															key={b.id}
															value={b.id}
														>
															{b.name}
														</option>
													))}
												</select>

												{!addingBrand ?
													<button
														type="button"
														onClick={() =>
															setAddingBrand(true)
														}
														className="mt-1 text-xs text-blue-600 hover:underline"
													>
														+ Cadastrar nova marca
													</button>
												:	<div className="flex gap-2 mt-2">
														<input
															type="text"
															placeholder="Nome da marca"
															value={newBrandName}
															onChange={(e) =>
																setNewBrandName(
																	e.target.value,
																)
															}
															className="flex-1 px-2 py-1.5 text-sm border border-gray-300 rounded-lg"
														/>
														<button
															type="button"
															onClick={
																handleCreateBrand
															}
															className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
														>
															Salvar
														</button>
														<button
															type="button"
															onClick={() => {
																setAddingBrand(
																	false,
																);
																setNewBrandName('');
															}}
															className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg text-gray-600"
														>
															Cancelar
														</button>
													</div>
												}
											</>
										}
									</div>
								)}

								{/* Modelo */}
								{stagingBrandId !== '' && (
									<div>
										<label className="block text-xs font-medium text-gray-600 mb-1">
											Modelo
										</label>
										{catalogLoading ?
											<div className="flex items-center gap-2 text-xs text-gray-400 py-2">
												<Loader2
													size={12}
													className="animate-spin"
												/>{' '}
												Carregando modelos…
											</div>
										:	<>
												<select
													value={stagingModelId}
													onChange={(e) =>
														setStagingModelId(
															e.target.value ?
																parseInt(
																	e.target.value,
																)
															:	'',
														)
													}
													className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-300"
												>
													<option value="">
														Selecione o modelo…
													</option>
													{models.map((m) => (
														<option
															key={m.id}
															value={m.id}
														>
															{m.name}
														</option>
													))}
												</select>

												{!addingModel ?
													<button
														type="button"
														onClick={() =>
															setAddingModel(true)
														}
														className="mt-1 text-xs text-blue-600 hover:underline"
													>
														+ Cadastrar novo modelo
													</button>
												:	<div className="flex gap-2 mt-2">
														<input
															type="text"
															placeholder="Nome do modelo"
															value={newModelName}
															onChange={(e) =>
																setNewModelName(
																	e.target.value,
																)
															}
															className="flex-1 px-2 py-1.5 text-sm border border-gray-300 rounded-lg"
														/>
														<button
															type="button"
															onClick={
																handleCreateModel
															}
															className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
														>
															Salvar
														</button>
														<button
															type="button"
															onClick={() => {
																setAddingModel(
																	false,
																);
																setNewModelName('');
															}}
															className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg text-gray-600"
														>
															Cancelar
														</button>
													</div>
												}
											</>
										}
									</div>
								)}

								{/* Quantidade + botão adicionar */}
								{stagingTypeId !== '' && (
									<div className="flex items-center gap-3">
										<div>
											<label className="block text-xs font-medium text-gray-600 mb-1">
												Quantidade
											</label>
											<div className="flex items-center border border-gray-300 rounded-lg overflow-hidden bg-white">
												<button
													type="button"
													onClick={() =>
														setStagingQty((q) =>
															Math.max(1, q - 1),
														)
													}
													className="px-3 py-1.5 text-gray-600 hover:bg-gray-100 font-bold text-base leading-none"
												>
													−
												</button>
												<input
													type="number"
													min={1}
													value={stagingQty}
													onChange={(e) =>
														setStagingQty(
															Math.max(
																1,
																parseInt(
																	e.target.value,
																) || 1,
															),
														)
													}
													className="w-14 text-center py-1.5 text-sm border-x border-gray-300 focus:outline-none"
												/>
												<button
													type="button"
													onClick={() =>
														setStagingQty((q) => q + 1)
													}
													className="px-3 py-1.5 text-gray-600 hover:bg-gray-100 font-bold text-base leading-none"
												>
													+
												</button>
											</div>
										</div>
										<button
											type="button"
											onClick={handleAddItem}
											className="mt-5 flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 font-medium"
										>
											<Plus size={14} /> Adicionar
										</button>
									</div>
								)}
							</div>
						</div>

						{/* ── Ofício ────────────────────────────────────────────────────── */}
						<div className="rounded-xl p-4 border-2 border-amber-300 bg-amber-50 space-y-2">
							<div className="flex items-center gap-2">
								<Paperclip size={15} className="text-amber-700" />
								<label className="text-sm font-semibold text-amber-900">
									Ofício{' '}
									<span className="font-normal text-amber-700 text-xs">
										(PDF, JPG ou PNG — obrigatório)
									</span>
								</label>
							</div>
							<input
								type="file"
								accept=".pdf,.jpg,.jpeg,.png"
								onChange={(e) =>
									setOficioFile(e.target.files?.[0] || null)
								}
								className="block text-sm text-gray-600 file:mr-4 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-amber-200 file:text-amber-900 hover:file:bg-amber-300"
							/>
							{oficioFile && (
								<p className="text-xs text-green-700 font-medium">
									✓ {oficioFile.name}
								</p>
							)}
						</div>

						{/* ── Observações ───────────────────────────────────────────────── */}
						<div>
							<label className="block text-sm font-medium text-gray-700 mb-1">
								Observações
							</label>
							<textarea
								rows={3}
								placeholder="Informações adicionais…"
								value={notes}
								onChange={(e) => setNotes(e.target.value)}
								className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300 resize-none"
							/>
						</div>

						{/* ── Rodapé ────────────────────────────────────────────────────── */}
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

			{/* Modal de cadastro de nova pessoa */}
			{showNewPersonModal && (
				<PeopleModal
					person={null}
					units={units}
					onClose={() => setShowNewPersonModal(false)}
					onSave={handleSaveNewPerson}
				/>
			)}
		</>
	);
};

export default RequestModal;
