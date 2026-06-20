import React, { useState, useEffect, useMemo } from 'react'
import InputMask from 'react-input-mask'
import Select from 'react-select'
import { X, Save } from 'lucide-react'

// Tipos locais — evita importação circular com App.tsx
export interface PersonFormData {
	full_name: string
	unit_id?: number
	registration_number?: string
	cpf: string
	email: string
	contact_phone?: string
	job_title?: string
}

export interface PeopleModalUnit {
	id: number
	type: 'ADMINISTRATIVA' | 'ESCOLAR' | 'EXTERNA'
	name: string
	parent_id?: number | null
}

interface Props {
	onClose: () => void
	onSave: (personData: PersonFormData, id?: number) => Promise<void>
	person?: (PersonFormData & { id: number }) | null
	units: PeopleModalUnit[]
}

const PeopleModal = ({ onClose, onSave, person, units }: Props) => {
	const [fullName, setFullName] = useState(person?.full_name || '')
	const [registrationNumber, setRegistrationNumber] = useState(person?.registration_number || '')
	const [cpf, setCpf] = useState(person?.cpf || '')
	const [email, setEmail] = useState(person?.email || '')
	const [contactPhone, setContactPhone] = useState(person?.contact_phone || '')
	const [jobTitle, setJobTitle] = useState(person?.job_title || '')
	const [selectedUnitType, setSelectedUnitType] = useState<'ADMINISTRATIVA' | 'ESCOLAR' | 'EXTERNA' | ''>('')
	const [level1UnitId, setLevel1UnitId] = useState('')
	const [level2UnitId, setLevel2UnitId] = useState('')
	const [level3UnitId, setLevel3UnitId] = useState('')
	const [level4UnitId, setLevel4UnitId] = useState('')
	const [finalUnitId, setFinalUnitId] = useState(person?.unit_id?.toString() || '')
	const [loading, setLoading] = useState(false)

	const formatOptions = (list: PeopleModalUnit[]) =>
		list.sort((a, b) => a.name.localeCompare(b.name)).map(u => ({ value: u.id.toString(), label: u.name }))

	const topLevelSeduc = useMemo(
		() => units.find(u => u.name.toLowerCase().includes('secretaria de educação') && !u.parent_id),
		[units],
	)

	const level1Options = useMemo(() => {
		if (selectedUnitType === 'ADMINISTRATIVA' && topLevelSeduc)
			return formatOptions(units.filter(u => u.parent_id === topLevelSeduc.id))
		if (selectedUnitType === 'EXTERNA')
			return formatOptions(units.filter(u => u.type === 'EXTERNA' && !u.parent_id))
		return []
	}, [units, selectedUnitType, topLevelSeduc])

	const level2Options = useMemo(
		() => (level1UnitId ? formatOptions(units.filter(u => u.parent_id === parseInt(level1UnitId))) : []),
		[units, level1UnitId],
	)
	const level3Options = useMemo(
		() => (level2UnitId ? formatOptions(units.filter(u => u.parent_id === parseInt(level2UnitId))) : []),
		[units, level2UnitId],
	)
	const level4Options = useMemo(
		() => (level3UnitId ? formatOptions(units.filter(u => u.parent_id === parseInt(level3UnitId))) : []),
		[units, level3UnitId],
	)
	const schoolUnits = useMemo(() => units.filter(u => u.type === 'ESCOLAR'), [units])

	useEffect(() => {
		if (!person?.unit_id) return
		const personUnit = units.find(u => u.id === person.unit_id)
		if (!personUnit) return
		setSelectedUnitType(personUnit.type)
		const hierarchy: PeopleModalUnit[] = []
		let current: PeopleModalUnit | undefined = personUnit
		while (current) {
			hierarchy.unshift(current)
			current = units.find(u => u.id === current?.parent_id)
		}
		if (personUnit.type === 'ADMINISTRATIVA' && hierarchy[0]?.id === topLevelSeduc?.id)
			hierarchy.shift()
		if (hierarchy[0]) setLevel1UnitId(hierarchy[0].id.toString())
		if (hierarchy[1]) setLevel2UnitId(hierarchy[1].id.toString())
		if (hierarchy[2]) setLevel3UnitId(hierarchy[2].id.toString())
		if (hierarchy[3]) setLevel4UnitId(hierarchy[3].id.toString())
		setFinalUnitId(person.unit_id.toString())
	}, [person, units, topLevelSeduc])

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault()
		setLoading(true)
		await onSave(
			{
				full_name: fullName,
				unit_id: finalUnitId ? parseInt(finalUnitId) : undefined,
				registration_number: registrationNumber || undefined,
				cpf,
				email,
				contact_phone: contactPhone || undefined,
				job_title: jobTitle || undefined,
			},
			person?.id,
		)
		setLoading(false)
	}

	return (
		<div className="fixed inset-0 bg-gray-900 bg-opacity-75 flex items-center justify-center z-[1001] p-4">
			<div className="bg-white p-8 rounded-xl shadow-2xl w-full max-w-4xl relative max-h-[90vh] overflow-y-auto">
				<button onClick={onClose} className="absolute top-4 right-4 text-gray-500 hover:text-gray-800">
					<X className="w-6 h-6" />
				</button>
				<h2 className="text-2xl font-bold text-blue-900 mb-6">
					{person ? 'Editar Pessoa' : 'Adicionar Nova Pessoa'}
				</h2>

				<form onSubmit={handleSubmit} className="space-y-4">
					{/* Dados Pessoais */}
					<div className="border border-gray-200 p-4 rounded-lg space-y-4">
						<h3 className="text-lg font-semibold text-gray-800">Dados Pessoais</h3>
						<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
							<div className="lg:col-span-2">
								<label className="block text-sm font-medium text-gray-700 mb-1">Nome Completo *</label>
								<input
									type="text"
									value={fullName}
									onChange={e => setFullName(e.target.value)}
									className="w-full p-2 border rounded-md"
									required
								/>
							</div>
							<div>
								<label className="block text-sm font-medium text-gray-700 mb-1">Cargo (Opcional)</label>
								<input
									type="text"
									value={jobTitle}
									onChange={e => setJobTitle(e.target.value)}
									className="w-full p-2 border rounded-md"
								/>
							</div>
							<div>
								<label className="block text-sm font-medium text-gray-700 mb-1">CPF *</label>
								<InputMask mask="999.999.999-99" value={cpf} onChange={e => setCpf(e.target.value)}>
									{(inputProps: any) => (
										<input {...inputProps} type="text" className="w-full p-2 border rounded-md" required />
									)}
								</InputMask>
							</div>
							<div>
								<label className="block text-sm font-medium text-gray-700 mb-1">Matrícula (Opcional)</label>
								<InputMask
									mask="999999-9"
									value={registrationNumber}
									onChange={e => setRegistrationNumber(e.target.value)}
								>
									{(inputProps: any) => <input {...inputProps} type="text" className="w-full p-2 border rounded-md" />}
								</InputMask>
							</div>
							<div>
								<label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
								<input
									type="email"
									value={email}
									onChange={e => setEmail(e.target.value)}
									className="w-full p-2 border rounded-md"
									required
								/>
							</div>
							<div>
								<label className="block text-sm font-medium text-gray-700 mb-1">Telefone (Opcional)</label>
								<InputMask
									mask={contactPhone.replace(/\D/g, '').length > 10 ? '(99) 99999-9999' : '(99) 9999-99999?'}
									// @ts-ignore
									formatChars={{ '9': '[0-9]', '?': '[0-9]' }}
									maskChar={null}
									value={contactPhone}
									onChange={e => setContactPhone(e.target.value)}
								>
									{(inputProps: any) => (
										<input {...inputProps} type="tel" className="w-full p-2 border rounded-md" placeholder="(81) 99999-9999" />
									)}
								</InputMask>
							</div>
						</div>
					</div>

					{/* Lotação */}
					<div className="border border-gray-200 p-4 rounded-lg space-y-4">
						<h3 className="text-lg font-semibold text-gray-800">Lotação (Opcional)</h3>
						<div>
							<label className="block text-sm font-medium text-gray-700 mb-1">1. Tipo de Unidade</label>
							<select
								value={selectedUnitType}
								onChange={e => {
									setSelectedUnitType(e.target.value as any)
									setLevel1UnitId('')
									setLevel2UnitId('')
									setLevel3UnitId('')
									setLevel4UnitId('')
									setFinalUnitId('')
								}}
								className="w-full p-2 border rounded-md"
							>
								<option value="">Selecione o tipo...</option>
								<option value="ADMINISTRATIVA">Unidade Administrativa (SEDUC)</option>
								<option value="ESCOLAR">Unidade Escolar</option>
								<option value="EXTERNA">Unidade Externa</option>
							</select>
						</div>

						{(selectedUnitType === 'ADMINISTRATIVA' || selectedUnitType === 'EXTERNA') && (
							<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
								<div>
									<label className="block text-sm font-medium text-gray-700 mb-1">
										{selectedUnitType === 'ADMINISTRATIVA' ? '2. Secretaria Executiva' : '2. Secretaria/Órgão Principal'}
									</label>
									<Select
										options={level1Options}
										isClearable
										placeholder="Selecione..."
										onChange={opt => {
											const newId = opt ? opt.value : ''
											setLevel1UnitId(newId)
											setLevel2UnitId('')
											setLevel3UnitId('')
											setLevel4UnitId('')
											setFinalUnitId(newId)
										}}
										value={level1Options.find(o => o.value === level1UnitId) ?? null}
										noOptionsMessage={() => 'Nenhuma unidade encontrada'}
									/>
								</div>
								{level1UnitId && level2Options.length > 0 && (
									<div>
										<label className="block text-sm font-medium text-gray-700 mb-1">
											{selectedUnitType === 'ADMINISTRATIVA' ? '3. Ger.Geral ou Gerência' : '3. Sec. Executiva / Depto'}
										</label>
										<Select
											options={level2Options}
											isClearable
											placeholder="Selecione..."
											onChange={opt => {
												const newId = opt ? opt.value : ''
												setLevel2UnitId(newId)
												setLevel3UnitId('')
												setLevel4UnitId('')
												setFinalUnitId(newId || level1UnitId)
											}}
											value={level2Options.find(o => o.value === level2UnitId) ?? null}
										/>
									</div>
								)}
								{level2UnitId && level3Options.length > 0 && (
									<div>
										<label className="block text-sm font-medium text-gray-700 mb-1">4. Gerência ou Setor</label>
										<Select
											options={level3Options}
											isClearable
											placeholder="Selecione..."
											onChange={opt => {
												const newId = opt ? opt.value : ''
												setLevel3UnitId(newId)
												setLevel4UnitId('')
												setFinalUnitId(newId || level2UnitId)
											}}
											value={level3Options.find(o => o.value === level3UnitId) ?? null}
										/>
									</div>
								)}
								{level3UnitId && level4Options.length > 0 && (
									<div>
										<label className="block text-sm font-medium text-gray-700 mb-1">5. Setor</label>
										<Select
											options={level4Options}
											isClearable
											placeholder="Selecione..."
											onChange={opt => {
												const newId = opt ? opt.value : ''
												setLevel4UnitId(newId)
												setFinalUnitId(newId || level3UnitId)
											}}
											value={level4Options.find(o => o.value === level4UnitId) ?? null}
										/>
									</div>
								)}
							</div>
						)}

						{selectedUnitType === 'ESCOLAR' && (
							<div>
								<label className="block text-sm font-medium text-gray-700 mb-1">2. Escola</label>
								<Select
									options={formatOptions(schoolUnits)}
									isClearable
									placeholder="Busque a Escola..."
									onChange={opt => setFinalUnitId(opt ? opt.value : '')}
									value={formatOptions(schoolUnits).find(o => o.value === finalUnitId) ?? null}
								/>
							</div>
						)}
					</div>

					<div className="flex justify-end space-x-3 mt-6 border-t pt-6">
						<button
							type="button"
							onClick={onClose}
							className="px-6 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300"
						>
							Cancelar
						</button>
						<button
							type="submit"
							disabled={loading}
							className="px-6 py-2 bg-blue-700 text-white rounded-lg hover:bg-blue-800 disabled:opacity-50"
						>
							<Save className="w-5 h-5 mr-2 inline-block" />
							{loading ? 'Salvando...' : 'Salvar Pessoa'}
						</button>
					</div>
				</form>
			</div>
		</div>
	)
}

export default PeopleModal
