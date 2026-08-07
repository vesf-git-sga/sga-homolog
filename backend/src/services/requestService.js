// services/requestService.js
// Camada de regras de negócio — sem SQL direto, sem req/res

const repository = require('../repositories/requestRepository')

// ─── Tipos e canais válidos ────────────────────────────────────────────────

const VALID_TYPES = ['emprestimo', 'substituicao', 'acrescimo']

// Canais permitidos por tipo
const CHANNELS_BY_TYPE = {
  emprestimo:   ['email', 'sei'],
  substituicao: ['chamado', 'sei', 'email'],
  acrescimo:    ['sei', 'email', 'educagestor'],
}

const EDUCAGESTOR_PROTOCOL_RE = /^\d{9}$/

// ─── Máquina de estados ────────────────────────────────────────────────────
//
// Fluxo unificado para todos os tipos:
//
//   requisitado
//     → visita_tecnica_solicitada  (1ª oportunidade: "Solicitar Visita Técnica")
//     → aguardando_aprovacao       (pular visita diretamente — manager/admin)
//
//   visita_tecnica_solicitada
//     → aguardando_aprovacao | necessidade_parcialmente_constatada
//       (automático ao registrar resultado da visita por equipamento)
//
//   visita_realizada  (status legado — mantido para registros antigos)
//     → aguardando_aprovacao
//
//   aguardando_aprovacao | necessidade_parcialmente_constatada
//     → visita_tecnica_solicitada  (2ª oportunidade: gerência solicita visita)
//     → aprovado | parcialmente_aprovado | reprovado  (via deliberação por item)
//
//   aprovado | parcialmente_aprovado
//     → em_execucao  (auto via movement com request_id)
//
//   em_execucao
//     → concluido    (auto via movement confirmed)
//
//   Cancelamento: qualquer estado não-terminal → cancelado (manager/admin)
//
//   Reversões (REVERTIBLE_STATUSES + histórico):
//     botão universal "voltar ao status anterior"; destino = última transição
//     real no histórico (entradas de reversão são ignoradas na resolução).
//     Side effects: cancela visita pendente; desvincula movimentação;
//     limpa deliberação ao sair de aprovado/reprovado/parcial.
//
// TRANSITIONS[fromStatus][toStatus] = [roles que podem executar]

const TRANSITIONS = {
  requisitado: {
    visita_tecnica_solicitada: ['basic', 'operator', 'manager', 'admin'],
    aguardando_aprovacao:      ['manager', 'admin'],
    cancelado:                 ['manager', 'admin'],
  },
  visita_tecnica_solicitada: {
    // Sem transição manual: completeTechnicalVisit avança automaticamente.
    cancelado: ['manager', 'admin'],
  },
  visita_realizada: {
    // Status legado: registros antigos podem avançar manualmente.
    aguardando_aprovacao: ['manager', 'admin'],
    cancelado:            ['manager', 'admin'],
  },
  aguardando_aprovacao: {
    visita_tecnica_solicitada: ['manager', 'admin'],
    cancelado:  ['manager', 'admin'],
  },
  necessidade_parcialmente_constatada: {
    visita_tecnica_solicitada: ['manager', 'admin'],
    cancelado:  ['manager', 'admin'],
  },
  // aprovado/parcialmente_aprovado → em_execucao: automático (movimentação)
  // em_execucao → concluido: automático (confirmação)
  aprovado: {
    indisponivel_estoque: ['operator', 'manager', 'admin'],
    cancelado:            ['manager', 'admin'],
  },
  parcialmente_aprovado: {
    indisponivel_estoque: ['operator', 'manager', 'admin'],
    cancelado:            ['manager', 'admin'],
  },
  indisponivel_estoque: {
    // Frontend envia "aprovado"; o service restaura aprovado ou parcialmente_aprovado.
    aprovado:  ['operator', 'manager', 'admin'],
    cancelado: ['manager', 'admin'],
  },
  em_execucao: {
    cancelado: ['manager', 'admin'],
  },
}

// ─── Reversões de status (voltar ao status anterior) ───────────────────────
// REVERTIBLE_STATUSES: quem pode reverter em cada status.
// O destino vem do histórico (última transição real, ignorando reversões).
const REVERSE_ROLES = ['basic', 'operator', 'manager', 'admin']

const REVERTIBLE_STATUSES = {
  visita_tecnica_solicitada:           REVERSE_ROLES,
  visita_realizada:                    REVERSE_ROLES,
  aguardando_aprovacao:                REVERSE_ROLES,
  necessidade_parcialmente_constatada: REVERSE_ROLES,
  aprovado:                            REVERSE_ROLES,
  parcialmente_aprovado:               REVERSE_ROLES,
  reprovado:                           REVERSE_ROLES,
  indisponivel_estoque:                REVERSE_ROLES,
  em_execucao:                         REVERSE_ROLES,
  concluido:                           REVERSE_ROLES,
}

const MOVEMENT_UNLINK_FROM_STATUSES = new Set(['em_execucao', 'concluido'])
const CLEAR_DELIBERATION_FROM_STATUSES = new Set([
  'aprovado',
  'parcialmente_aprovado',
  'reprovado',
])

// Statuses que encerram o ciclo de vida da solicitação
const TERMINAL_STATUSES = ['concluido', 'reprovado', 'cancelado']

const DELIBERATION_STATUSES = ['aguardando_aprovacao', 'necessidade_parcialmente_constatada']
const APPROVED_LIKE_STATUSES = ['aprovado', 'parcialmente_aprovado']

function aggregateVisitStatus(itemResults) {
  const results = itemResults.map((i) => i.result)
  const allSame = results.every((r) => r === results[0])
  if (allSame) return 'aguardando_aprovacao'
  return 'necessidade_parcialmente_constatada'
}

function aggregateDeliberationStatus(decisions) {
  const approved = decisions.filter((d) => d.decision === 'aprovado')
  const rejected = decisions.filter((d) => d.decision === 'reprovado')
  if (approved.length === decisions.length) return 'aprovado'
  if (rejected.length === decisions.length) return 'reprovado'
  return 'parcialmente_aprovado'
}

function summarizeVisitResults(itemResults, itemsById) {
  const parts = itemResults.map((i) => {
    const item = itemsById?.get?.(i.catalog_item_id)
    const label = item?.item_type_name || `Item #${i.catalog_item_id}`
    if (i.result === 'constatada') {
      return `${label}: constatada (qtd ${i.constatada_quantity})`
    }
    return `${label}: não constatada`
  })
  const constatados = itemResults.filter((i) => i.result === 'constatada').length
  const naoConstatados = itemResults.length - constatados
  return `Visita concluída por equipamento (${constatados} constatada(s), ${naoConstatados} não constatada(s)). ${parts.join('; ')}.`
}

function validateItemVisitResults(itemResults, catalogItems) {
  const itemsById = new Map(catalogItems.map((i) => [i.id, i]))
  const normalized = []
  for (const item of itemResults) {
    if (!item.catalog_item_id || !['constatada', 'nao_constatada'].includes(item.result)) {
      throw new Error('Resultado inválido: use "constatada" ou "nao_constatada" por equipamento.')
    }
    const catalogItem = itemsById.get(item.catalog_item_id)
    if (!catalogItem) {
      throw new Error(`Equipamento #${item.catalog_item_id} não pertence à solicitação.`)
    }
    if (item.result === 'constatada') {
      const qty = parseInt(item.constatada_quantity, 10)
      if (!qty || qty < 1) {
        throw new Error(`Quantidade constatada inválida para "${catalogItem.item_type_name}".`)
      }
      if (qty > catalogItem.quantity) {
        throw new Error(
          `Quantidade constatada (${qty}) não pode exceder a solicitada (${catalogItem.quantity}) em "${catalogItem.item_type_name}".`
        )
      }
      normalized.push({
        catalog_item_id: item.catalog_item_id,
        result: item.result,
        findings: item.findings || null,
        constatada_quantity: qty,
      })
    } else {
      normalized.push({
        catalog_item_id: item.catalog_item_id,
        result: item.result,
        findings: item.findings || null,
        constatada_quantity: null,
      })
    }
  }
  return normalized
}

function summarizeDeliberations(decisions, itemsById) {
  const parts = decisions.map((d) => {
    const item = itemsById.get(d.catalog_item_id)
    const label = item
      ? (item.item_type_name || `Item #${d.catalog_item_id}`)
      : `Item #${d.catalog_item_id}`
    if (d.decision === 'aprovado') {
      return `${label}: aprovado (qtd ${d.approved_quantity})`
    }
    return `${label}: reprovado`
  })
  return `Deliberação por equipamento. ${parts.join('; ')}.`
}

// ─── Helpers ──────────────────────────────────────────────────────────────

function getAllowedTransitions(request, role) {
  const fromMap = TRANSITIONS[request.status] || {}
  return Object.entries(fromMap)
    .filter(([, roles]) => roles.includes(role))
    .map(([toStatus]) => toStatus)
}

/** Última transição real que chegou ao status atual (ignora reversões e no-ops). */
function resolvePreviousStatus(history, currentStatus) {
  if (!Array.isArray(history) || history.length === 0) return null
  for (let i = history.length - 1; i >= 0; i--) {
    const entry = history[i]
    if (!entry.old_status || entry.old_status === entry.new_status) continue
    if (entry.new_status !== currentStatus) continue
    if (String(entry.notes || '').startsWith('Reversão de status')) continue
    return entry.old_status
  }
  return null
}

function getRevertInfo(request, history, role) {
  const roles = REVERTIBLE_STATUSES[request.status]
  if (!roles || !roles.includes(role)) {
    return { can_revert: false, previous_status: null }
  }
  const previous_status = resolvePreviousStatus(history, request.status)
  if (!previous_status) {
    return { can_revert: false, previous_status: null }
  }
  return { can_revert: true, previous_status }
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
    if (data.fundamentacao === 'necessidade_operacional' && data.input_channel === 'chamado') {
      throw new Error('Canal "chamado" é exclusivo para substituições por avaria.')
    }
  }

  if (data.input_channel === 'sei' && !data.input_channel_details) {
    throw new Error('Número do processo SEI é obrigatório.')
  }
  if (data.input_channel === 'educagestor') {
    const protocol = (data.input_channel_details || '').replace(/\D/g, '')
    data.input_channel_details = protocol
    if (!protocol) {
      throw new Error('Protocolo da Ocorrência (EducaGestor) é obrigatório.')
    }
    if (!EDUCAGESTOR_PROTOCOL_RE.test(protocol)) {
      throw new Error('Protocolo da Ocorrência inválido. Informe 9 dígitos numéricos.')
    }
  }
  if (data.input_channel === 'chamado' && !data.input_channel_details) {
    throw new Error('Número do chamado é obrigatório.')
  }
  if (data.fundamentacao === 'avaria' && !data.input_channel_details?.trim()) {
    throw new Error('O número do chamado é obrigatório para substituição por avaria.')
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

  const visitsWithResults = await Promise.all(
    visits.map(async (visit) => {
      if (!visit.completed_at || visit.result === 'frustrada' || visit.result === 'cancelada') return visit
      const item_results = await repository.findVisitItemResults(pool, visit.id)
      return { ...visit, item_results }
    })
  )

  const allowed_transitions = currentUser
    ? getAllowedTransitions(request, currentUser.role)
    : []
  const revertInfo = currentUser
    ? getRevertInfo(request, history, currentUser.role)
    : { can_revert: false, previous_status: null }

  return {
    ...request,
    visits: visitsWithResults,
    history,
    movements,
    items,
    allowed_transitions,
    can_revert: revertInfo.can_revert,
    previous_status: revertInfo.previous_status,
  }
}

// ─── Transições de status ─────────────────────────────────────────────────

async function changeStatus(pool, requestId, newStatus, currentUser, notes) {
  const request = await repository.findById(pool, requestId)
  if (!request) throw new Error('Solicitação não encontrada.')

  if (TERMINAL_STATUSES.includes(request.status)) {
    throw new Error(`Solicitação já está em status terminal (${request.status}).`)
  }

  // Ao liberar estoque, restaura o status aprovado correto conforme a deliberação.
  let targetStatus = newStatus
  if (request.status === 'indisponivel_estoque' && APPROVED_LIKE_STATUSES.includes(newStatus)) {
    const deliberations = await repository.findItemDeliberations(pool, requestId)
    if (deliberations.length > 0) {
      targetStatus = aggregateDeliberationStatus(deliberations)
    }
  }

  const allowedRoles = TRANSITIONS[request.status]?.[targetStatus]
    || (request.status === 'indisponivel_estoque' && APPROVED_LIKE_STATUSES.includes(newStatus)
      ? TRANSITIONS.indisponivel_estoque.aprovado
      : null)
  if (!allowedRoles) {
    throw new Error(
      `Transição de '${request.status}' para '${targetStatus}' não é permitida.`
    )
  }
  if (!allowedRoles.includes(currentUser.role)) {
    throw new Error(`Seu perfil (${currentUser.role}) não tem permissão para esta transição.`)
  }

  return repository.transitionStatus(
    pool, requestId, targetStatus, currentUser.id, notes, null, request.status
  )
}

// ─── Reversão de status ────────────────────────────────────────────────────

async function revertStatus(pool, requestId, currentUser, notes, expectedPreviousStatus) {
  const request = await repository.findById(pool, requestId)
  if (!request) throw new Error('Solicitação não encontrada.')

  if (!notes || !String(notes).trim()) {
    throw new Error('O motivo da alteração de status é obrigatório.')
  }

  const roles = REVERTIBLE_STATUSES[request.status]
  if (!roles) {
    throw new Error(`Reversão a partir de '${request.status}' não é permitida.`)
  }
  if (!roles.includes(currentUser.role)) {
    throw new Error(`Seu perfil (${currentUser.role}) não tem permissão para esta reversão.`)
  }

  const history = await repository.findStatusHistory(pool, requestId)
  const previousStatus = resolvePreviousStatus(history, request.status)
  if (!previousStatus) {
    throw new Error('Não há status anterior disponível para reverter.')
  }
  if (expectedPreviousStatus && expectedPreviousStatus !== previousStatus) {
    throw new Error(
      `Status anterior mudou enquanto você agia (esperado: ${expectedPreviousStatus}, atual: ${previousStatus}).`
    )
  }

  const fromStatus = request.status
  const historyNotes = `Reversão de status. Motivo: ${String(notes).trim()}`

  return repository.transitionStatus(
    pool,
    requestId,
    previousStatus,
    currentUser.id,
    historyNotes,
    async (client) => {
      if (fromStatus === 'visita_tecnica_solicitada' && previousStatus === 'requisitado') {
        await client.query(
          `UPDATE technical_visits
           SET result = 'cancelada',
               findings = $1,
               completed_by = $2,
               completed_at = NOW()
           WHERE request_id = $3 AND completed_at IS NULL`,
          [
            `Visita cancelada automaticamente ao desfazer alteração de status. Motivo: ${String(notes).trim()}`,
            currentUser.id,
            requestId,
          ]
        )
      }

      if (MOVEMENT_UNLINK_FROM_STATUSES.has(fromStatus)) {
        await client.query(
          `UPDATE asset_movements
           SET request_id = NULL
           WHERE request_id = $1`,
          [requestId]
        )
      }

      if (CLEAR_DELIBERATION_FROM_STATUSES.has(fromStatus)) {
        await client.query(
          `DELETE FROM request_item_deliberations WHERE request_id = $1`,
          [requestId]
        )
        await client.query(
          `UPDATE requests
           SET approved_by = NULL, approved_at = NULL
           WHERE id = $1`,
          [requestId]
        )
      }
    },
    fromStatus
  )
}

// ─── Visita técnica ────────────────────────────────────────────────────────

async function scheduleTechnicalVisit(pool, requestId, data, currentUserId) {
  const request = await repository.findById(pool, requestId)
  if (!request) throw new Error('Solicitação não encontrada.')

  if (request.status !== 'visita_tecnica_solicitada') {
    throw new Error('Agendamento disponível apenas após ativação do botão "Solicitar Visita Técnica".')
  }

  // Permite N visitas por solicitação; só uma pode ficar pendente por vez.
  const pending = await pool.query(
    `SELECT id FROM technical_visits
     WHERE request_id = $1 AND completed_at IS NULL
     LIMIT 1`,
    [requestId]
  )
  if (pending.rowCount > 0) {
    throw new Error('Já existe uma visita técnica pendente para esta solicitação. Conclua-a antes de agendar outra.')
  }

  const visit = await repository.createTechnicalVisit(pool, {
    request_id:     requestId,
    assigned_to:    data.assigned_to || null,
    scheduled_date: data.scheduled_date || null,
    scheduled_time: data.scheduled_time || null,
    created_by:     currentUserId,
  })

  const lastFrustrada = await pool.query(
    `SELECT id, findings, completed_at FROM technical_visits
     WHERE request_id = $1 AND result = 'frustrada' AND completed_at IS NOT NULL
     ORDER BY completed_at DESC LIMIT 1`,
    [requestId]
  )
  if (lastFrustrada.rows.length > 0) {
    const scheduleParts = []
    if (data.scheduled_date) {
      const d = new Date(data.scheduled_date).toLocaleDateString('pt-BR')
      scheduleParts.push(`data ${d}`)
    }
    if (data.scheduled_time) scheduleParts.push(`horário ${data.scheduled_time}`)
    const when = scheduleParts.length > 0 ? scheduleParts.join(', ') : 'sem data definida'
    const motivoAnterior = lastFrustrada.rows[0].findings || 'não informado'
    await pool.query(
      `INSERT INTO request_status_history (request_id, old_status, new_status, notes, changed_by)
       VALUES ($1, 'visita_tecnica_solicitada', 'visita_tecnica_solicitada', $2, $3)`,
      [
        requestId,
        `Nova visita técnica agendada (${when}) após visita frustrada. Motivo anterior: ${motivoAnterior}`,
        currentUserId,
      ]
    )
  }

  return visit
}

async function updateVisitSchedule(pool, visitId, data, currentUserId) {
  const visitRes = await pool.query(
    'SELECT * FROM technical_visits WHERE id = $1', [visitId]
  )
  if (visitRes.rows.length === 0) throw new Error('Visita técnica não encontrada.')
  const visit = visitRes.rows[0]
  if (visit.completed_at) {
    throw new Error('Não é possível editar o agendamento de uma visita já concluída.')
  }

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

async function updateVisitResult(pool, visitId, itemResults, findings, currentUserId) {
  if (!Array.isArray(itemResults) || itemResults.length === 0) {
    throw new Error('Informe o resultado por equipamento.')
  }

  const visitRes = await pool.query(
    'SELECT * FROM technical_visits WHERE id = $1', [visitId]
  )
  if (visitRes.rows.length === 0) throw new Error('Visita técnica não encontrada.')
  if (!visitRes.rows[0].completed_at) throw new Error('A visita ainda não foi concluída.')
  if (visitRes.rows[0].result === 'frustrada' || visitRes.rows[0].result === 'cancelada') {
    throw new Error('Visitas frustradas ou canceladas não permitem correção de resultado por equipamento.')
  }

  const requestId = visitRes.rows[0].request_id
  const latestVisitRes = await pool.query(
    `SELECT id FROM technical_visits
     WHERE request_id = $1 AND completed_at IS NOT NULL AND result IS DISTINCT FROM 'frustrada' AND result IS DISTINCT FROM 'cancelada'
     ORDER BY completed_at DESC, id DESC
     LIMIT 1`,
    [requestId]
  )
  if (latestVisitRes.rows[0]?.id !== visitId) {
    throw new Error('Somente a visita técnica mais recente pode ter o resultado corrigido.')
  }

  const reqRes = await pool.query(
    'SELECT status FROM requests WHERE id = $1', [requestId]
  )
  if (reqRes.rows.length === 0) throw new Error('Solicitação não encontrada.')
  const LOCKED = ['aprovado', 'parcialmente_aprovado', 'em_execucao', 'concluido', 'reprovado']
  if (LOCKED.includes(reqRes.rows[0].status)) {
    throw new Error('O parecer da visita não pode ser alterado após a deliberação da gerência.')
  }

  const catalogItems = await repository.findCatalogItemsByRequestId(pool, requestId)
  const catalogIds = new Set(catalogItems.map((i) => i.id))
  const payloadIds = new Set(itemResults.map((i) => i.catalog_item_id))
  if (catalogIds.size !== payloadIds.size || [...catalogIds].some((id) => !payloadIds.has(id))) {
    throw new Error('É obrigatório informar o resultado para todos os equipamentos da solicitação.')
  }

  const normalized = validateItemVisitResults(itemResults, catalogItems)
  const itemsById = new Map(catalogItems.map((i) => [i.id, i]))

  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await repository.upsertVisitItemResults(client, visitId, normalized)

    const allSame = normalized.every((i) => i.result === normalized[0].result)
    await client.query(
      `UPDATE technical_visits
       SET result = $1, findings = $2
       WHERE id = $3`,
      [allSame ? normalized[0].result : null, findings || null, visitId]
    )

    const newStatus = aggregateVisitStatus(normalized)
    const oldStatus = reqRes.rows[0].status
    if (DELIBERATION_STATUSES.includes(oldStatus) && oldStatus !== newStatus) {
      await client.query(
        `UPDATE requests SET status = $1, updated_at = NOW() WHERE id = $2`,
        [newStatus, requestId]
      )
      await client.query(
        `INSERT INTO request_status_history (request_id, old_status, new_status, notes, changed_by)
         VALUES ($1, $2, $3, $4, $5)`,
        [requestId, oldStatus, newStatus, summarizeVisitResults(normalized, itemsById) + ' (resultado corrigido)', currentUserId]
      )
    }

    await client.query('COMMIT')
    return repository.findVisitItemResults(pool, visitId)
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}

async function completeTechnicalVisit(pool, visitId, itemResults, findings, currentUserId) {
  if (!Array.isArray(itemResults) || itemResults.length === 0) {
    throw new Error('Resultado da visita é obrigatório por equipamento.')
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

    const reqRes = await client.query(
      'SELECT status FROM requests WHERE id = $1 FOR UPDATE',
      [visit.request_id]
    )
    if (reqRes.rows.length === 0) throw new Error('Solicitação não encontrada.')
    if (reqRes.rows[0].status !== 'visita_tecnica_solicitada') {
      throw new Error(
        'A visita só pode ser concluída enquanto a solicitação está em visita técnica solicitada.'
      )
    }

    const itemsRes = await client.query(
      `SELECT rci.id, rci.quantity, it.name AS item_type_name
       FROM request_catalog_items rci
       JOIN item_types it ON it.id = rci.item_type_id
       WHERE rci.request_id = $1`,
      [visit.request_id]
    )
    const catalogItems = itemsRes.rows
    const catalogIds = new Set(catalogItems.map((r) => r.id))
    const payloadIds = new Set(itemResults.map((i) => i.catalog_item_id))
    if (catalogIds.size === 0) throw new Error('A solicitação não possui equipamentos.')
    if (catalogIds.size !== payloadIds.size || [...catalogIds].some((id) => !payloadIds.has(id))) {
      throw new Error('É obrigatório informar o resultado para todos os equipamentos da solicitação.')
    }

    const normalized = validateItemVisitResults(itemResults, catalogItems)
    const itemsById = new Map(catalogItems.map((i) => [i.id, i]))
    const allSame = normalized.every((i) => i.result === normalized[0].result)
    const aggregatedResult = allSame ? normalized[0].result : null
    const newStatus = aggregateVisitStatus(normalized)

    await client.query(
      `UPDATE technical_visits
       SET result = $1, findings = $2, completed_by = $3, completed_at = NOW()
       WHERE id = $4`,
      [aggregatedResult, findings || null, currentUserId, visitId]
    )

    await repository.upsertVisitItemResults(client, visitId, normalized)

    await client.query(
      `UPDATE requests SET status = $1, updated_at = NOW() WHERE id = $2`,
      [newStatus, visit.request_id]
    )
    await client.query(
      `INSERT INTO request_status_history (request_id, old_status, new_status, notes, changed_by)
       VALUES ($1, 'visita_tecnica_solicitada', $2, $3, $4)`,
      [
        visit.request_id,
        newStatus,
        summarizeVisitResults(normalized, itemsById) + (findings ? ` Parecer geral: ${findings}` : ''),
        currentUserId,
      ]
    )

    await client.query('COMMIT')
    return {
      visit_id: visitId,
      request_id: visit.request_id,
      status: newStatus,
      item_results: normalized,
    }
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}

async function completeFrustratedTechnicalVisit(pool, visitId, reason, currentUserId) {
  if (!reason?.trim()) {
    throw new Error('O motivo da visita frustrada é obrigatório.')
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

    const reqRes = await client.query(
      'SELECT status FROM requests WHERE id = $1 FOR UPDATE',
      [visit.request_id]
    )
    if (reqRes.rows.length === 0) throw new Error('Solicitação não encontrada.')
    if (reqRes.rows[0].status !== 'visita_tecnica_solicitada') {
      throw new Error('Visita frustrada só pode ser registrada enquanto a visita técnica está em andamento.')
    }

    const scheduleInfo = []
    if (visit.scheduled_date) {
      scheduleInfo.push(`Data agendada: ${new Date(visit.scheduled_date).toLocaleDateString('pt-BR')}`)
    }
    if (visit.scheduled_time) scheduleInfo.push(`Horário: ${visit.scheduled_time}`)

    await client.query(
      `UPDATE technical_visits
       SET result = 'frustrada', findings = $1, completed_by = $2, completed_at = NOW()
       WHERE id = $3`,
      [reason.trim(), currentUserId, visitId]
    )

    const historyNotes = [
      'Visita técnica frustrada — verificação não realizada in loco.',
      `Motivo: ${reason.trim()}`,
      ...scheduleInfo,
      'Uma nova visita técnica poderá ser agendada.',
    ].join(' ')

    await client.query(
      `INSERT INTO request_status_history (request_id, old_status, new_status, notes, changed_by)
       VALUES ($1, 'visita_tecnica_solicitada', 'visita_tecnica_solicitada', $2, $3)`,
      [visit.request_id, historyNotes, currentUserId]
    )

    await client.query('COMMIT')
    return {
      visit_id: visitId,
      request_id: visit.request_id,
      status: 'visita_tecnica_solicitada',
      outcome: 'frustrada',
    }
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}

async function submitItemDeliberations(pool, requestId, decisions, currentUser, notes) {
  if (!['manager', 'admin'].includes(currentUser.role)) {
    throw new Error(`Seu perfil (${currentUser.role}) não tem permissão para deliberar.`)
  }
  if (!Array.isArray(decisions) || decisions.length === 0) {
    throw new Error('Informe a deliberação de cada equipamento.')
  }

  const request = await repository.findById(pool, requestId)
  if (!request) throw new Error('Solicitação não encontrada.')
  if (!DELIBERATION_STATUSES.includes(request.status)) {
    throw new Error('Deliberação disponível apenas enquanto a solicitação aguarda aprovação.')
  }

  const catalogItems = await repository.findCatalogItemsByRequestId(pool, requestId)
  if (catalogItems.length === 0) throw new Error('A solicitação não possui equipamentos.')

  const itemsById = new Map(catalogItems.map((i) => [i.id, i]))
  const payloadIds = new Set(decisions.map((d) => d.catalog_item_id))
  if (itemsById.size !== payloadIds.size || [...itemsById.keys()].some((id) => !payloadIds.has(id))) {
    throw new Error('É obrigatório deliberar sobre todos os equipamentos da solicitação.')
  }

  const normalized = []
  for (const d of decisions) {
    if (!['aprovado', 'reprovado'].includes(d.decision)) {
      throw new Error('Decisão inválida: use "aprovado" ou "reprovado".')
    }
    const item = itemsById.get(d.catalog_item_id)
    if (d.decision === 'aprovado') {
      const qty = parseInt(d.approved_quantity, 10)
      if (!qty || qty < 1) {
        throw new Error(`Quantidade aprovada inválida para o equipamento "${item.item_type_name}".`)
      }
      if (qty > item.quantity) {
        throw new Error(
          `Quantidade aprovada (${qty}) não pode exceder a solicitada (${item.quantity}) em "${item.item_type_name}".`
        )
      }
      normalized.push({
        catalog_item_id: d.catalog_item_id,
        decision: 'aprovado',
        approved_quantity: qty,
        notes: d.notes || null,
      })
    } else {
      normalized.push({
        catalog_item_id: d.catalog_item_id,
        decision: 'reprovado',
        approved_quantity: null,
        notes: d.notes || null,
      })
    }
  }

  const newStatus = aggregateDeliberationStatus(normalized)
  const historyNotes = (notes ? `${notes} ` : '') + summarizeDeliberations(normalized, itemsById)

  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    const cur = await client.query(
      'SELECT * FROM requests WHERE id = $1 FOR UPDATE',
      [requestId]
    )
    if (cur.rows.length === 0) throw new Error('Solicitação não encontrada.')
    if (!DELIBERATION_STATUSES.includes(cur.rows[0].status)) {
      throw new Error('Status da solicitação mudou enquanto você agia.')
    }

    await repository.upsertItemDeliberations(client, requestId, normalized, currentUser.id)

    const extraSql = APPROVED_LIKE_STATUSES.includes(newStatus)
      ? `, approved_by = ${currentUser.id}, approved_at = NOW()`
      : ''
    await client.query(
      `UPDATE requests SET status = $1, updated_at = NOW()${extraSql} WHERE id = $2`,
      [newStatus, requestId]
    )
    await client.query(
      `INSERT INTO request_status_history (request_id, old_status, new_status, notes, changed_by)
       VALUES ($1, $2, $3, $4, $5)`,
      [requestId, cur.rows[0].status, newStatus, historyNotes, currentUser.id]
    )

    await client.query('COMMIT')
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }

  return getRequestById(pool, requestId, currentUser)
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

// ─── Ciência da DIT ───────────────────────────────────────────────────────────

async function ditCiente(pool, requestId, currentUser, modalidade, previsaoAt) {
  const request = await repository.findById(pool, requestId)
  if (!request) throw new Error('Solicitação não encontrada.')
  if (!APPROVED_LIKE_STATUSES.includes(request.status)) {
    throw new Error('A ciência da DIT só pode ser registrada quando a solicitação está aprovada ou parcialmente aprovada.')
  }
  if (request.dit_ciente_at) {
    throw new Error('A DIT já registrou ciência desta solicitação.')
  }
  const allowed = ['operator', 'manager', 'admin']
  if (!allowed.includes(currentUser.role)) {
    throw new Error(`Seu perfil (${currentUser.role}) não tem permissão para registrar ciência da DIT.`)
  }
  if (!modalidade || !['entrega', 'retirada'].includes(modalidade)) {
    throw new Error('Modalidade é obrigatória: "entrega" ou "retirada".')
  }
  if (!previsaoAt) {
    throw new Error('Data prevista é obrigatória.')
  }
  const dataPrevisao = new Date(previsaoAt)
  if (isNaN(dataPrevisao.getTime())) {
    throw new Error('Data prevista inválida.')
  }
  return repository.markDitCiente(pool, requestId, currentUser.id, modalidade, previsaoAt)
}

async function registrarEventoDit(pool, requestId, currentUser, tipo, dados) {
  const request = await repository.findById(pool, requestId)
  if (!request) throw new Error('Solicitação não encontrada.')
  if (!request.dit_ciente_at) {
    throw new Error('A DIT ainda não registrou ciência desta solicitação.')
  }
  if (TERMINAL_STATUSES.includes(request.status)) {
    throw new Error('Não é possível registrar evento em solicitação com status terminal.')
  }
  const allowed = ['operator', 'manager', 'admin']
  if (!allowed.includes(currentUser.role)) {
    throw new Error(`Seu perfil (${currentUser.role}) não tem permissão para esta ação.`)
  }
  if (!['reagendamento', 'observacao'].includes(tipo)) {
    throw new Error('Tipo de evento inválido. Use "reagendamento" ou "observacao".')
  }
  if (tipo === 'reagendamento') {
    if (!dados.nova_data) throw new Error('Nova data é obrigatória para reagendamento.')
    if (isNaN(new Date(dados.nova_data).getTime())) throw new Error('Nova data inválida.')
    if (!dados.motivo?.trim()) throw new Error('Motivo é obrigatório para reagendamento.')
  }
  if (tipo === 'observacao') {
    if (!dados.motivo?.trim()) throw new Error('Observação não pode ser vazia.')
  }
  return repository.criarEventoDit(pool, requestId, currentUser.id, tipo, dados)
}

// ─── Fila de indisponíveis no estoque ────────────────────────────────────────

async function getUnavailableQueue(pool) {
  return repository.findUnavailableQueue(pool)
}

// ─── Vínculo retroativo com movimentação concluída ───────────────────────────

const LINK_MOVEMENT_ROLES = ['admin', 'manager', 'basic', 'operator']
const LINKABLE_MOVEMENT_TYPES = repository.LINKABLE_MOVEMENT_TYPES || ['loan', 'exit']

function buildRetroactiveMatchAnalysis(request, items, movement) {
  const requestPersonId = request.requester_person_id
  const movementPersonId = movement.recipient_person_id
  const personMatch =
    requestPersonId != null &&
    movementPersonId != null &&
    Number(requestPersonId) === Number(movementPersonId)

  const requestUnitId = request.unit_id
  const movementUnitId = movement.destination_unit_id
  const unitMatch =
    requestUnitId != null &&
    movementUnitId != null &&
    Number(requestUnitId) === Number(movementUnitId)

  const approvedItems = (items || []).filter((item) => {
    if (!item.deliberation) return request.status === 'aprovado'
    return item.deliberation.decision === 'aprovado'
  })
  const fallbackItems =
    approvedItems.length > 0 ? approvedItems : (items || [])

  // Agrega quantidades por tipo na solicitação
  const requestTypeCounts = new Map()
  for (const item of fallbackItems) {
    if (item.item_type_id == null) continue
    const key = Number(item.item_type_id)
    const qty = Number(item.deliberation?.approved_quantity ?? item.quantity) || 0
    const prev = requestTypeCounts.get(key) || {
      item_type_id: key,
      item_type_name: item.item_type_name,
      quantity: 0,
    }
    prev.quantity += qty
    if (!prev.item_type_name && item.item_type_name) {
      prev.item_type_name = item.item_type_name
    }
    requestTypeCounts.set(key, prev)
  }
  const requestTypes = Array.from(requestTypeCounts.values())

  const movementTypeCounts = new Map()
  for (const asset of movement.assets || []) {
    if (asset.item_type_id == null) continue
    const key = Number(asset.item_type_id)
    const prev = movementTypeCounts.get(key) || {
      item_type_id: key,
      item_type_name: asset.item_type_name,
      quantity: 0,
    }
    prev.quantity += 1
    movementTypeCounts.set(key, prev)
  }
  const movementTypes = Array.from(movementTypeCounts.values())

  const missingInMovement = []
  const quantityShortfalls = []
  for (const rt of requestTypes) {
    const found = movementTypeCounts.get(Number(rt.item_type_id))
    if (!found || found.quantity === 0) {
      missingInMovement.push({ ...rt })
      continue
    }
    if (found.quantity < rt.quantity) {
      quantityShortfalls.push({
        item_type_id: rt.item_type_id,
        item_type_name: rt.item_type_name,
        requested: rt.quantity,
        found: found.quantity,
        quantity: rt.quantity - found.quantity,
      })
    }
  }

  const extraInMovement = movementTypes.filter(
    (mt) => !requestTypeCounts.has(Number(mt.item_type_id))
  )

  const equipmentMatch =
    missingInMovement.length === 0 &&
    quantityShortfalls.length === 0 &&
    extraInMovement.length === 0

  const mismatches = []
  if (!personMatch) mismatches.push('solicitante')
  if (!unitMatch) mismatches.push('unidade')
  if (!equipmentMatch) mismatches.push('equipamento')

  return {
    matches: mismatches.length === 0,
    mismatches,
    solicitante: {
      match: personMatch,
      request: {
        person_id: requestPersonId,
        name: request.requester_name || null,
      },
      movement: {
        person_id: movementPersonId,
        name: movement.recipient_name || null,
      },
    },
    unidade: {
      match: unitMatch,
      request: {
        unit_id: requestUnitId,
        name: request.unit_name || null,
      },
      movement: {
        unit_id: movementUnitId,
        name: movement.destination_unit_name || null,
      },
    },
    equipamento: {
      match: equipmentMatch,
      request_types: requestTypes,
      movement_types: movementTypes,
      missing_in_movement: missingInMovement,
      quantity_shortfalls: quantityShortfalls,
      extra_in_movement: extraInMovement,
    },
  }
}

function assertRequestEligibleForRetroactiveLink(request) {
  if (!request) throw new Error('Solicitação não encontrada.')
  if (!APPROVED_LIKE_STATUSES.includes(request.status)) {
    throw new Error(
      'Somente solicitações aprovadas ou parcialmente aprovadas podem receber vínculo retroativo.'
    )
  }
}

function assertMovementEligibleForRetroactiveLink(movement) {
  if (!movement) throw new Error('Movimentação não encontrada.')
  if (movement.request_id) {
    throw new Error('Esta movimentação já está vinculada a uma solicitação.')
  }
  if (movement.delivery_status !== 'confirmed') {
    throw new Error(
      'Somente movimentações com entrega confirmada podem ser vinculadas retroativamente.'
    )
  }
  if (!LINKABLE_MOVEMENT_TYPES.includes(movement.movement_type)) {
    throw new Error(
      `Tipo de movimentação "${movement.movement_type}" não é elegível para vínculo retroativo com solicitação de TI.`
    )
  }
}

function buildRetroactiveLinkNotes(movementId, match, userNotes) {
  const mismatchNote = match.matches
    ? 'Correspondência total entre solicitante, unidade e equipamento.'
    : `Divergências confirmadas pelo usuário: ${match.mismatches.join(', ')}.`

  const parts = [
    `Vínculo retroativo com movimentação #${movementId}.`,
    mismatchNote,
  ]
  const trimmed = userNotes?.trim()
  if (trimmed) parts.push(`Observação: ${trimmed}`)
  return parts.join(' ')
}

async function searchLinkableMovements(pool, requestId, search) {
  const request = await repository.findById(pool, requestId)
  assertRequestEligibleForRetroactiveLink(request)

  const existingCount = await repository.countMovementsByRequestId(pool, requestId)
  if (existingCount > 0) {
    throw new Error('Esta solicitação já possui movimentação vinculada.')
  }

  return repository.findConfirmedUnlinkedMovements(pool, {
    search,
    limit: 20,
    affinityPersonId: request.requester_person_id,
    affinityUnitId: request.unit_id,
    allowedTypes: LINKABLE_MOVEMENT_TYPES,
  })
}

async function checkRetroactiveLink(pool, requestId, movementId) {
  const request = await repository.findById(pool, requestId)
  assertRequestEligibleForRetroactiveLink(request)

  const existingCount = await repository.countMovementsByRequestId(pool, requestId)
  if (existingCount > 0) {
    throw new Error('Esta solicitação já possui movimentação vinculada.')
  }

  const movement = await repository.findMovementForRetroactiveLink(pool, movementId)
  assertMovementEligibleForRetroactiveLink(movement)

  const items = await repository.findCatalogItemsByRequestId(pool, requestId)
  const match = buildRetroactiveMatchAnalysis(request, items, movement)
  return { request_id: requestId, movement, match }
}

async function linkMovementRetroactively(pool, requestId, movementId, currentUser, options = {}) {
  if (!LINK_MOVEMENT_ROLES.includes(currentUser.role)) {
    throw new Error(`Seu perfil (${currentUser.role}) não tem permissão para esta ação.`)
  }

  const confirmMismatches = Boolean(options.confirm_mismatches)
  const preview = await checkRetroactiveLink(pool, requestId, movementId)
  const { match, movement } = preview

  if (!match.matches && !confirmMismatches) {
    const err = new Error(
      'Há divergências entre a solicitação e a movimentação. Confirme explicitamente para prosseguir.'
    )
    err.code = 'MATCH_CONFIRMATION_REQUIRED'
    err.match = match
    err.movement = movement
    throw err
  }

  const notes = buildRetroactiveLinkNotes(movementId, match, options.notes)

  await repository.linkMovementAndConcludeRequest(pool, {
    requestId,
    movementId,
    userId: currentUser.id,
    notes,
    allowedStatuses: APPROVED_LIKE_STATUSES,
    allowedMovementTypes: LINKABLE_MOVEMENT_TYPES,
  })

  const request = await getRequestById(pool, requestId, currentUser)
  return {
    request,
    linkMeta: {
      matches: match.matches,
      mismatches: match.mismatches,
      confirm_mismatches: confirmMismatches,
      notes,
    },
  }
}

module.exports = {
  createRequest,
  listRequests,
  getRequestById,
  changeStatus,
  revertStatus,
  scheduleTechnicalVisit,
  updateVisitSchedule,
  updateVisitResult,
  completeTechnicalVisit,
  completeFrustratedTechnicalVisit,
  submitItemDeliberations,
  updateRequestFromMovement,
  findApprovedRequest,
  getMovementPrefill,
  getAllowedTransitions,
  getRevertInfo,
  ditCiente,
  registrarEventoDit,
  getUnavailableQueue,
  searchLinkableMovements,
  checkRetroactiveLink,
  linkMovementRetroactively,
  DELIBERATION_STATUSES,
  APPROVED_LIKE_STATUSES,
}
