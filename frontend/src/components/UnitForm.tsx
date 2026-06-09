import React, { useState, useMemo, useEffect } from 'react';
import axios from 'axios';
import { X, Save, Layers } from 'lucide-react';
import InputMask from 'react-input-mask';
import Select from 'react-select'; 

interface Unit {
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
  rpa?: string;
}

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
    rpa?: string;
}

interface UnitFormProps {
  units: Unit[];
  onClose: () => void;
  onUnitSaved: () => void;
  unitToEdit: Unit | null;
  API_URL: string;
  addToast: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
}

const UnitForm: React.FC<UnitFormProps> = ({ onClose, onUnitSaved, unitToEdit, units, API_URL, addToast }) => {
  
  // Estado do Formulário
  const [formData, setFormData] = useState<UnitData>(() => (
    unitToEdit 
      ? { ...unitToEdit, rpa: unitToEdit.rpa || '', contact_phone: unitToEdit.contact_phone || '' } 
      : { type: '', name: '', status: 'active', parent_id: null, rpa: '', contact_phone: '' }
  ));

  const [loading, setLoading] = useState<boolean>(false);

  // --- ESTADOS PARA O EFEITO CASCATA (HIERARQUIA) ---
  const [level1Id, setLevel1Id] = useState<string>(''); // Ex: Secretaria Executiva
  const [level2Id, setLevel2Id] = useState<string>(''); // Ex: Gerência Geral
  const [level3Id, setLevel3Id] = useState<string>(''); // Ex: Gerência
  const [level4Id, setLevel4Id] = useState<string>(''); // Ex: Divisão

  // Encontra a unidade "Raiz Absoluta" (Secretaria de Educação) para filtrar o Nível 1
  const topLevelSeduc = useMemo(() => 
    units.find(u => u.name.toLowerCase().includes('secretaria de educação') && !u.parent_id), 
    [units]
  );

  // --- RECONSTRUÇÃO DA HIERARQUIA (PARA MODO EDIÇÃO) ---
  useEffect(() => {
    if (unitToEdit && unitToEdit.parent_id) {
      const parentUnit = units.find(u => u.id === unitToEdit.parent_id);
      
      if (parentUnit) {
        // Reconstrói a árvore de baixo para cima
        const hierarchy: Unit[] = [];
        let current: Unit | undefined = parentUnit;
        
        while(current) {
            hierarchy.unshift(current);
            current = units.find(u => u.id === current?.parent_id);
        }

        // Se for Administrativa, remove a "Secretaria de Educação" da visualização para começar da Executiva
        if (unitToEdit.type === 'ADMINISTRATIVA' && hierarchy.length > 0 && hierarchy[0].id === topLevelSeduc?.id) {
           hierarchy.shift();
        }

        if (hierarchy[0]) setLevel1Id(hierarchy[0].id.toString());
        if (hierarchy[1]) setLevel2Id(hierarchy[1].id.toString());
        if (hierarchy[2]) setLevel3Id(hierarchy[2].id.toString());
        if (hierarchy[3]) setLevel4Id(hierarchy[3].id.toString());
      }
    }
  }, [unitToEdit, units, topLevelSeduc]);

  // --- LÓGICA DE ATUALIZAÇÃO DO PARENT_ID ---
  useEffect(() => {
      // CORREÇÃO AQUI: Tipagem explícita para evitar erro TS7034
      let newParentId: number | null = null;
      
      if (level4Id) newParentId = parseInt(level4Id);
      else if (level3Id) newParentId = parseInt(level3Id);
      else if (level2Id) newParentId = parseInt(level2Id);
      else if (level1Id) newParentId = parseInt(level1Id);
      else if (formData.type === 'ADMINISTRATIVA' && topLevelSeduc) newParentId = topLevelSeduc.id;

      setFormData(prev => ({ ...prev, parent_id: newParentId }));
  }, [level1Id, level2Id, level3Id, level4Id, formData.type, topLevelSeduc]);

  // --- HELPERS PARA OS SELECTS ---
  const formatOptions = (list: Unit[]) => 
    list
    .filter(u => u.id !== unitToEdit?.id)
    .sort((a, b) => a.name.localeCompare(b.name))
    .map(u => ({ value: u.id.toString(), label: `${u.name} (${u.code || 'S/C'})` }));

  const level1Options = useMemo(() => {
    if (formData.type === 'ADMINISTRATIVA' && topLevelSeduc) {
      return formatOptions(units.filter(u => u.parent_id === topLevelSeduc.id));
    }
    if (formData.type === 'EXTERNA') {
      return formatOptions(units.filter(u => u.type === 'EXTERNA' && !u.parent_id));
    }
    return [];
  }, [units, formData.type, topLevelSeduc, unitToEdit]);

  const level2Options = useMemo(() => {
    if (!level1Id) return [];
    return formatOptions(units.filter(u => u.parent_id === parseInt(level1Id)));
  }, [units, level1Id, unitToEdit]);

  const level3Options = useMemo(() => {
    if (!level2Id) return [];
    return formatOptions(units.filter(u => u.parent_id === parseInt(level2Id)));
  }, [units, level2Id, unitToEdit]);

  const level4Options = useMemo(() => {
    if (!level3Id) return [];
    return formatOptions(units.filter(u => u.parent_id === parseInt(level3Id)));
  }, [units, level3Id, unitToEdit]);


  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
      const { name, value } = e.target;
      setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.type || !formData.name) {
      addToast("Tipo e Nome da unidade são obrigatórios.", "error");
      return;
    }
    
    setLoading(true);
    try {
      if (unitToEdit) {
        await axios.put(`${API_URL}/units/${unitToEdit.id}`, formData);
        addToast('Unidade atualizada com sucesso!', 'success');
      } else {
        await axios.post(`${API_URL}/units`, formData);
        addToast('Unidade criada com sucesso!', 'success');
      }
      onUnitSaved();
      onClose();
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || 'Ocorreu um erro ao salvar a unidade.';
      addToast(errorMessage, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-900 bg-opacity-75 flex items-center justify-center z-[1001] p-4">
      <div className="bg-white p-8 rounded-xl shadow-2xl w-full max-w-2xl relative max-h-[90vh] overflow-y-auto">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-500 hover:text-gray-800"><X className="w-6 h-6" /></button>
        <h2 className="text-2xl font-bold text-blue-900 mb-6">{unitToEdit ? 'Editar Unidade' : 'Adicionar Nova Unidade'}</h2>

        <form onSubmit={handleSubmit} className="space-y-6">
            
            {/* ETAPA 1: ESCOLHA DO TIPO */}
            <div className="p-4 border rounded-lg bg-gray-50">
              <label className="block text-sm font-medium text-gray-700 mb-2">1. Qual o tipo da unidade?</label>
              <select 
                name="type" 
                value={formData.type} 
                onChange={(e) => {
                    handleChange(e);
                    setLevel1Id(''); setLevel2Id(''); setLevel3Id(''); setLevel4Id('');
                }} 
                required 
                className="w-full p-2 border rounded-md"
                disabled={loading}
              >
                  <option value="" disabled>Selecione o tipo...</option>
                  <option value="ADMINISTRATIVA">Unidade Administrativa (SEDUC)</option>
                  <option value="ESCOLAR">Unidade Escolar</option>
                  <option value="EXTERNA">Unidade Externa</option>
              </select>
            </div>
            
            {formData.type && (
                <>
                  {/* SEÇÃO HIERARQUIA CASCATA */}
                  {(formData.type === 'ADMINISTRATIVA' || formData.type === 'EXTERNA') && (
                      <div className="p-4 border rounded-lg bg-blue-50 border-blue-100">
                          <h3 className="text-sm font-bold text-blue-800 uppercase mb-3 flex items-center">
                             <Layers className="w-4 h-4 mr-2"/> Definição Hierárquica
                          </h3>
                          
                          <div className="grid grid-cols-1 gap-3">
                              {/* NÍVEL 1 */}
                              <div>
                                <label className="block text-xs font-bold text-gray-600 mb-1">
                                    Nível 1: Secretaria Executiva / Órgão
                                </label>
                                <Select
                                    options={level1Options}
                                    value={level1Options.find(o => o.value === level1Id)}
                                    onChange={(opt) => {
                                        setLevel1Id(opt?.value || '');
                                        setLevel2Id(''); setLevel3Id(''); setLevel4Id('');
                                    }}
                                    placeholder="Selecione a Executiva..."
                                    isClearable
                                    noOptionsMessage={() => "Nenhuma unidade encontrada."}
                                />
                              </div>

                              {/* NÍVEL 2 */}
                              {level1Id && level2Options.length > 0 && (
                                  <div className="animate-fadeIn ml-4 pl-4 border-l-2 border-blue-200">
                                    <label className="block text-xs font-bold text-gray-600 mb-1">
                                        ↳ Nível 2: Gerência Geral / Departamento
                                    </label>
                                    <Select
                                        options={level2Options}
                                        value={level2Options.find(o => o.value === level2Id)}
                                        onChange={(opt) => {
                                            setLevel2Id(opt?.value || '');
                                            setLevel3Id(''); setLevel4Id('');
                                        }}
                                        placeholder="Selecione..."
                                        isClearable
                                    />
                                  </div>
                              )}

                              {/* NÍVEL 3 */}
                              {level2Id && level3Options.length > 0 && (
                                  <div className="animate-fadeIn ml-8 pl-4 border-l-2 border-blue-200">
                                    <label className="block text-xs font-bold text-gray-600 mb-1">
                                        ↳ Nível 3: Gerência / Divisão
                                    </label>
                                    <Select
                                        options={level3Options}
                                        value={level3Options.find(o => o.value === level3Id)}
                                        onChange={(opt) => {
                                            setLevel3Id(opt?.value || '');
                                            setLevel4Id('');
                                        }}
                                        placeholder="Selecione..."
                                        isClearable
                                    />
                                  </div>
                              )}

                               {/* Nível 4 */}
                               {level3Id && level4Options.length > 0 && (
                                  <div className="animate-fadeIn ml-12 pl-4 border-l-2 border-blue-200">
                                    <label className="block text-xs font-bold text-gray-600 mb-1">
                                        ↳ Nível 4: Setor / Núcleo
                                    </label>
                                    <Select
                                        options={level4Options}
                                        value={level4Options.find(o => o.value === level4Id)}
                                        onChange={(opt) => setLevel4Id(opt?.value || '')}
                                        placeholder="Selecione..."
                                        isClearable
                                    />
                                  </div>
                              )}
                          </div>

                          <div className="mt-3 p-2 bg-blue-100 rounded text-xs text-blue-800">
                              <strong>Unidade Pai Definida: </strong> 
                              {formData.parent_id 
                                ? units.find(u => u.id === formData.parent_id)?.name 
                                : (formData.type === 'ADMINISTRATIVA' ? 'Secretaria de Educação (Raiz)' : 'Sem Pai (Raiz)')
                              }
                          </div>
                      </div>
                  )}

                  {/* SEÇÃO DE DADOS PRINCIPAIS */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t pt-6">
                      <div className="md:col-span-2">
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                              {formData.type === 'ESCOLAR' ? 'Nome da Escola *' : 'Nome da Nova Unidade *'}
                          </label>
                          <input type="text" name="name" value={formData.name} onChange={handleChange} required className="w-full p-2 border rounded-md" placeholder="Ex: Divisão de Redes"/>
                      </div>
                      
                      <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                              {formData.type === 'ESCOLAR' ? 'Código INEP' : 'Código / Sigla'}
                          </label>
                          <input type="text" name="code" value={formData.code || ''} onChange={handleChange} className="w-full p-2 border rounded-md" />
                      </div>

                      {/* RPA: EXIBE APENAS SE FOR ESCOLA */}
                      {formData.type === 'ESCOLAR' && (
                          <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">RPA (Região)</label>
                              <select name="rpa" value={formData.rpa} onChange={handleChange} className="w-full p-2 border rounded-md bg-white">
                                  <option value="">Selecione...</option>
                                  {[1,2,3,4,5,6].map(n => <option key={n} value={n}>RPA {n}</option>)}
                              </select>
                          </div>
                      )}

                      <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Telefone de Contato</label>
                          <InputMask 
                              // Tratamento seguro para string possivelmente undefined
                              mask={(formData.contact_phone || '').replace(/\D/g, '').length > 10 ? "(99) 99999-9999" : "(99) 9999-99999?"} 
                              // @ts-ignore
                              formatChars={{ "9": "[0-9]", "?": "[0-9]" }} 
                              maskChar={null} 
                              value={formData.contact_phone || ''} 
                              onChange={(e) => setFormData(prev => ({ ...prev, contact_phone: e.target.value }))}
                            >
                              {(inputProps: any) => (
                                  <input {...inputProps} type="tel" className="w-full p-2 border rounded-md" placeholder="(81) 3355-5714" />
                              )}
                            </InputMask>
                      </div>
                      <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Email de Contato</label>
                          <input type="email" name="contact_email" value={formData.contact_email || ''} onChange={handleChange} className="w-full p-2 border rounded-md" />
                      </div>
                      <div className="md:col-span-2">
                          <label className="block text-sm font-medium text-gray-700 mb-1">Endereço</label>
                          <textarea name="address" value={formData.address || ''} onChange={handleChange} rows={2} className="w-full p-2 border rounded-md"></textarea>
                      </div>
                      <div className="md:col-span-2">
                          <label className="block text-sm font-medium text-gray-700 mb-1">Observações</label>
                          <textarea name="notes" value={formData.notes || ''} onChange={handleChange} rows={2} className="w-full p-2 border rounded-md"></textarea>
                      </div>
                  </div>
                </>
            )}

            <div className="flex justify-end space-x-3 mt-6 border-t pt-6">
                <button type="button" onClick={onClose} className="px-6 py-2 bg-gray-200 text-gray-800 rounded-lg shadow-sm hover:bg-gray-300" disabled={loading}>Cancelar</button>
                <button type="submit" disabled={loading} className="px-6 py-2 bg-blue-700 text-white rounded-lg shadow-sm hover:bg-blue-800 disabled:opacity-50">
                    <Save className="w-5 h-5 mr-2 inline-block"/>{loading ? 'Salvando...' : 'Salvar'}
                </button>
            </div>
        </form>
      </div>
    </div>
  );
};

export default UnitForm;