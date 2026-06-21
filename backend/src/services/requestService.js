// services/requestService.js
// Camada de regras de negócio — sem SQL direto, sem req/res

const repository = require('../repositories/requestRepository')

// ─── Tipos e canais válidos ────────────────────────────────────────────────

const VALID_TYPES = ['emprestimo', 'substituicao', 'acrescimo']

// Canais permitidos por tipo
const CHANNELS_BY_TYPE = {
  emprestimo:   ['email', 'sei'],
  substituicao: ['chamado', 'sei', 'email'],
  acrescimo:    ['sei', 'email'],
}

// ─── Máquina de estados ────────────────────────────────────────────────────
//
// Fluxo unificado para todos os tipos:
//
//   requisitado
//     → visita_tecnica_solicitada  (botão "Solicitar Visita Técnica")
//     → aguardando_aprovacao       (pular visita diretamente)
//
//   visita_tecnica_solicitada
//     → aguardando_aprovacao  (automático ao registrar resultado da visita)
//
//   visita_realizada  (status legado — mantido para registros antigos)
//     → aguardando_aprovacao
//
//   aguardando_aprovacao
//     → aprovado   (gerência aprova — bloqueante)
//     → reprovado
//
//   aprovado
//     → em_execucao  (auto via movement com request_id)
//
//   em_execucao
//     → concluido    (auto via movement confirmed)
//
//   Cancelamento: qualquer estado não-terminal → cancelado (manager/admin)
//
// TRANSITIONS[fromStatus][toStatus] = [roles que podem executar]

const TRANSITIONS = {
  requisitado: {
    visita_tecnica_solicitada: ['basic', 'operator', 'manager', 'admin'],
    aguardando_aprovacao:      ['manager', 'admin'],
    cancelado:                 ['manager', 'admin'],
  },
  visita_tecnica_solicitada: {
    // Sem transição manual: completeTechnicalVisit avança direto para aguardando_aprovacao.
    cancelado: ['manager', 'admin'],
  },
  visita_realizada: {
    // Status legado: registros antigos podem avançar manualmente.
    aguardando_aprovacao: ['manager', 'admin'],
    cancelado:            ['manager', 'admin'],
  },
  aguardando_aprovacao: {
    aprovado:   ['manager', 'admin'],
    reprovado:  ['manager', 'admin'],
    cancelado:  ['manager', 'admin'],
  },
  // aprovado → em_execucao: exclusivamente automático (criação de movimentação vinculada)
  // em_execucao → concluido: exclusivamente automático (confirmação da movimentação)
  // Transições manuais removidas para garantir rastreabilidade pelo fluxo de movimentações.
  aprovado: {
    cancelado: ['manager', 'admin'],
  },
  em_execucao: {
    cancelado: ['manager', 'admin'],
  },
}

// Statuses que encerram o ciclo de vida da solicitação
const TERMINAL_STATUSES = ['concluido', 'reprovado', 'cancelado']

// ─── Helpers ──────────────────────────────────────────────────────────────

function getAllowedTransitions(request, role) {
  const fromMap = TRANSITIONS[request.status] || {}
  return Object.entries(fromMap)
    .filter(([, roles]) => roles.includes(role))
    .map(([toStatus]) => toStatus)
}

// ─── Criação ───────────────────────────────────────────────────────────────

async function createRequest(pool, data, currentUserId, oficioPath, oficioOriginalName) {
  if (!data.type || !data.requester_person_id || !data.unit_id) {
    throw new Error('Campos obrigatórios: type, requester_person_id, unit_id.')
  }
  if (!VALID_TYPES.includes(data.type)) {
    throw new Error(`Tipo inválido. Use: ${VALID_TYPES.join(', ')}.`)
  }

  const personOk = await repository.personExists(pool, data.requester_person_id)
  if (!personOk) throw new Error('Solicitante não encontrado.')

  const unit = await repository.findUnitById(pool, data.unit_id)
  if (!unit) throw new Error('Unidade não encontrada.')

  // Canal de entrada
  if (!data.input_channel) throw new Error('Canal de entrada é obrigatório.')
  const validChannels = CHANNELS_BY_TYPE[data.type] || []
  if (!validChannels.includes(data.input_channel)) {
    throw new Error(`Canal inválido para ${data.type}. Use: ${validChannels.join(', ')}.`)
  }

  // Validações específicas por tipo
  if (data.type === 'substituicao') {
    if (!data.fundamentacao) throw new Error('Fundamentação é obrigatória para substituições.')
    if (data.fundamentacao === 'avaria' && data.input_channel !== 'chamado') {
      throw new Error('Substituição por avaria deve usar canal "chamado".')
    }
    if (data.fundamentacao === 'necessidade_operacional' && data.input_channel === 'chamado') {
      throw new Error('Canal "chamado" é exclusivo para substituições por avaria.')
    }
  }

  if (data.input_channel === 'sei' && !data.input_channel_details) {
    throw new Error('Número do processo SEI é obrigatório.')
  }
  if (data.input_channel === 'chamado' && !data.input_channel_details) {
    throw new Error('Número do chamado é obrigatório.')
  }

  // Itens do catálogo — obrigatório ao menos um
  const items = Array.isArray(data.items) ? data.items : []
  if (items.length === 0) {
    throw new Error('A solicitação deve conter pelo menos um item de equipamento.')
  }
  for (const item of items) {
    if (!item.item_type_id) throw new Error('Cada item deve ter um tipo de equipamento.')
    if (!item.quantity || item.quantity < 1) throw new Error('Quantidade inválida em algum item.')
  }

  // Ofício obrigatório
  if (!oficioPath) {
    throw new Error('O anexo do ofício é obrigatório.')
  }

  const request = await repository.create(pool, { ...data, created_by: currentUserId })

  // Persiste itens
  await repository.createCatalogItems(pool, request.id, items)

  // Persiste caminho do ofício
  await repository.updateOficioPath(pool, request.id, oficioPath, oficioOriginalName)

  return { ...request, oficio_path: oficioPath, oficio_original_name: oficioOriginalName, items }
}

// ─── Consultas ────────────────────────────────────────────────────────────

async function listRequests(pool, filters) {
  return repository.findAll(pool, filters)
}

async function getRequestById(pool, id, currentUser) {
  const request = await repository.findById(pool, id)
  if (!request) throw new Error('Solicitação não encontrada.')

  const [visits, history, movements, items] = await Promise.all([
    repository.findTechnicalVisitsByRequestId(pool, id),
    repository.findStatusHistory(pool, id),
    repository.findMovementsByRequestId(pool, id),
    repository.findCatalogItemsByRequestId(pool, id),
  ])

  const allowed_transitions = currentUser
    ? getAllowedTransitions(request, currentUser.role)
    : []

  return { ...request, visits, history, movements, items, allowed_transitions }
}

// ─── Transições de status ─────────────────────────────────────────────────

async function changeStatus(pool, requestId, newStatus, currentUser, notes) {
  const request = await repository.findById(pool, requestId)
  if (!request) throw new Error('Solicitação não encontrada.')

  if (TERMINAL_STATUSES.includes(request.status)) {
    throw new Error(`Solicitação já está em status terminal (${request.status}).`)
  }

  const allowedRoles = TRANSITIONS[request.status]?.[newStatus]
  if (!allowedRoles) {
    throw new Error(
      `Transição de '${request.status}' para '${newStatus}' não é permitida.`
    )
  }
  if (!allowedRoles.includes(currentUser.role)) {
    throw new Error(`Seu perfil (${currentUser.role}) não tem permissão para esta transição.`)
  }

  return repository.transitionStatus(
    pool, requestId, newStatus, currentUser.id, notes, null, request.status
  )
}

// ─── Visita técnica ────────────────────────────────────────────────────────

async function scheduleTechnicalVisit(pool, requestId, data, currentUserId) {
  const request = await repository.findById(pool, requestId)
  if (!request) throw new Error('Solicitação não encontrada.')

  if (request.status !== 'visita_tecnica_solicitada') {
    throw new Error('Agendamento disponível apenas após ativação do botão "Solicitar Visita Técnica".')
  }

  return repository.createTechnicalVisit(pool, {
    request_id:     requestId,
    assigned_to:    data.assigned_to || null,
    scheduled_date: data.scheduled_date || null,
    scheduled_time: data.scheduled_time || null,
    created_by:     currentUserId,
  })
}

async function updateVisitSchedule(pool, visitId, data, currentUserId) {
  const visitRes = await pool.query(
    'SELECT * FROM technical_visits WHERE id = $1', [visitId]
  )
  if (visitRes.rows.length === 0) throw new Error('Visita técnica não encontrada.')
  const visit = visitRes.rows[0]

  const reqRes = await pool.query(
    'SELECT status FROM requests WHERE id = $1', [visit.request_id]
  )
  if (!reqRes.rows.length) throw new Error('Solicitação não encontrada.')
  if (reqRes.rows[0].status !== 'visita_tecnica_solicitada') {
    throw new Error('Edição de agendamento disponível apenas enquanto a visita está pendente.')
  }

  return repository.updateTechnicalVisitSchedule(pool, visitId, {
    assigned_to:    data.assigned_to || null,
    scheduled_date: data.scheduled_date || null,
    scheduled_time: data.scheduled_time || null,
  })
}

async function updateVisitResult(pool, visitId, result, findings, currentUserId) {
  if (!result || !['constatada', 'nao_constatada'].includes(result)) {
    throw new Error('Resultado inválido: use "constatada" ou "nao_constatada".')
  }

  const visitRes = await pool.query(
    'SELECT * FROM technical_visits WHERE id = $1', [visitId]
  )
  if (visitRes.rows.length === 0) throw new Error('Visita técnica não encontrada.')
  if (!visitRes.rows[0].completed_at) throw new Error('A visita ainda não foi concluída.')

  return repository.updateTechnicalVisitResult(pool, visitId, result, findings)
}

async function completeTechnicalVisit(pool, visitId, result, findings, currentUserId) {
  if (!result || !['constatada', 'nao_constatada'].includes(result)) {
    throw new Error('Resultado da visita é obrigatório: "constatada" ou "nao_constatada".')
  }

  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    const visitRes = await client.query(
      'SELECT * FROM technical_visits WHERE id = $1 FOR UPDATE',
      [visitId]
    )
    if (visitRes.rows.length === 0) throw new Error('Visita técnica não encontrada.')
    const visit = visitRes.rows[0]
    if (visit.completed_at) throw new Error('Esta visita já foi concluída.')

    await client.query(
      `UPDATE technical_visits
       SET result = $1, findings = $2, completed_by = $3, completed_at = NOW()
       WHERE id = $4`,
      [result, findings || null, currentUserId, visitId]
    )

    // Avança direto para aguardando_aprovacao (skip visita_realizada)
    await client.query(
      `UPDATE requests SET status = 'aguardando_aprovacao', updated_at = NOW() WHERE id = $1`,
      [visit.request_id]
    )
    await client.query(
      `INSERT INTO request_status_history (request_id, old_status, new_status, notes, changed_by)
       VALUES ($1, 'visita_tecnica_solicitada', 'aguardando_aprovacao', $2, $3)`,
      [
        visit.request_id,
        `Visita concluída. Resultado: ${result === 'constatada' ? 'Defeito constatado' : 'Defeito não constatado'}.${findings ? ' Parecer: ' + findings : ''}`,
        currentUserId,
      ]
    )

    await client.query('COMMIT')
    return { visit_id: visitId, result, request_id: visit.request_id }
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}

// ─── Acoplamento com movimentações ────────────────────────────────────────
// Chamada pelo server.js após COMMIT de cada movimentação que tenha request_id.

async function updateRequestFromMovement(pool, requestId, movementStatus, userId) {
  return repository.updateRequestStatus(
    pool, requestId, movementStatus, userId,
    `Status atualizado automaticamente via movimentação.`
  )
}

// ─── Busca de solicitações aprovadas (para pré-preenchimento no form de movimentação) ─

async function findApprovedRequest(pool, requestId) {
  return repository.findApprovedRequestById(pool, requestId)
}

async function getMovementPrefill(pool, protocol) {
  return repository.findRequestForMovementPrefill(pool, protocol)
}

module.exports = {
  createRequest,
  listRequests,
  getRequestById,
  changeStatus,
  scheduleTechnicalVisit,
  updateVisitSchedule,
  updateVisitResult,
  completeTechnicalVisit,
  updateRequestFromMovement,
  findApprovedRequest,
  getMovementPrefill,
  getAllowedTransitions,
}
