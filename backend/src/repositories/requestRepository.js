// repositories/requestRepository.js
// Camada de acesso a dados — apenas SQL parametrizado, sem regras de negócio

// ─── Geração de protocolo ────────────────────────────────────────────────────

async function generateProtocol(pool) {
  const year = new Date().getFullYear()
  const result = await pool.query(
    `SELECT COUNT(*) FROM requests WHERE EXTRACT(YEAR FROM created_at) = $1`,
    [year]
  )
  const seq = parseInt(result.rows[0].count) + 1
  return `SOL-${year}-${String(seq).padStart(5, '0')}`
}

// ─── CRUD básico ─────────────────────────────────────────────────────────────

async function create(pool, data) {
  const protocol = await generateProtocol(pool)
  const result = await pool.query(
    `INSERT INTO requests
      (protocol, type, status, input_channel, input_channel_details,
       requester_person_id, unit_id, fundamentacao, notes, created_by)
     VALUES ($1, $2, 'requisitado', $3, $4, $5, $6, $7, $8, $9)
     RETURNING *`,
    [
      protocol,
      data.type,
      data.input_channel,
      data.input_channel_details || null,
      data.requester_person_id,
      data.unit_id,
      data.fundamentacao || null,
      data.notes || null,
      data.created_by,
    ]
  )
  await pool.query(
    `INSERT INTO request_status_history (request_id, old_status, new_status, notes, changed_by)
     VALUES ($1, NULL, 'requisitado', 'Solicitação criada.', $2)`,
    [result.rows[0].id, data.created_by]
  )
  return result.rows[0]
}

async function findById(pool, id) {
  const result = await pool.query(
    `SELECT r.*,
            p.full_name  AS requester_name,
            u.name       AS unit_name,
            u.rpa        AS unit_rpa,
            uc.full_name AS created_by_name,
            ua.full_name AS approved_by_name,
            ud.full_name AS dit_ciente_by_name,
            COALESCE(
              (SELECT json_agg(
                json_build_object(
                  'id',            de.id,
                  'tipo',          de.tipo,
                  'modalidade',    de.modalidade,
                  'data_anterior', de.data_anterior,
                  'nova_data',     de.nova_data,
                  'motivo',        de.motivo,
                  'changed_by_name', ude.full_name,
                  'changed_at',    de.changed_at
                ) ORDER BY de.changed_at ASC)
               FROM dit_eventos de
               LEFT JOIN users ude ON ude.id = de.changed_by
               WHERE de.request_id = r.id),
              '[]'::json
            ) AS dit_eventos
     FROM requests r
     LEFT JOIN people  p  ON p.id = r.requester_person_id
     LEFT JOIN units   u  ON u.id = r.unit_id
     LEFT JOIN users   uc ON uc.id = r.created_by
     LEFT JOIN users   ua ON ua.id = r.approved_by
     LEFT JOIN users   ud ON ud.id = r.dit_ciente_by
     WHERE r.id = $1`,
    [id]
  )
  return result.rows[0] || null
}

async function findAll(pool, filters = {}) {
  const conditions = []
  const params = []

  if (filters.status) {
    params.push(filters.status)
    conditions.push(`r.status = $${params.length}`)
  }
  if (filters.type) {
    params.push(filters.type)
    conditions.push(`r.type = $${params.length}`)
  }
  if (filters.unit_id) {
    params.push(parseInt(filters.unit_id))
    conditions.push(`r.unit_id = $${params.length}`)
  }
  if (filters.search) {
    params.push(`%${filters.search}%`)
    conditions.push(`(r.protocol ILIKE $${params.length} OR p.full_name ILIKE $${params.length} OR u.name ILIKE $${params.length})`)
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

  const result = await pool.query(
    `SELECT r.*,
            p.full_name  AS requester_name,
            u.name       AS unit_name,
            u.rpa        AS unit_rpa,
            uc.full_name AS created_by_name,
            ud.full_name AS dit_ciente_by_name
     FROM requests r
     LEFT JOIN people  p  ON p.id = r.requester_person_id
     LEFT JOIN units   u  ON u.id = r.unit_id
     LEFT JOIN users   uc ON uc.id = r.created_by
     LEFT JOIN users   ud ON ud.id = r.dit_ciente_by
     ${where}
     ORDER BY r.created_at DESC`,
    params
  )
  return result.rows
}

// ─── Transições de status ─────────────────────────────────────────────────────

async function transitionStatus(pool, requestId, newStatus, userId, notes, onTransactionFn, expectedOldStatus) {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    // SELECT FOR UPDATE para evitar race conditions
    const cur = await client.query(
      'SELECT * FROM requests WHERE id = $1 FOR UPDATE',
      [requestId]
    )
    if (cur.rows.length === 0) throw new Error('Solicitação não encontrada.')

    const request = cur.rows[0]
    if (expectedOldStatus && request.status !== expectedOldStatus) {
      throw new Error(
        `Status da solicitação mudou de status enquanto você agia ` +
        `(esperado: ${expectedOldStatus}, atual: ${request.status}).`
      )
    }

    if (onTransactionFn) {
      await onTransactionFn(client, request)
    }

    // Campos extras para algumas transições
    const extraFields = []
    const extraValues = []
    if (newStatus === 'aprovado') {
      extraFields.push(`approved_by = ${userId}`)
      extraFields.push(`approved_at = NOW()`)
    }
    const extraSql = extraFields.length > 0 ? `, ${extraFields.join(', ')}` : ''

    await client.query(
      `UPDATE requests SET status = $1, updated_at = NOW()${extraSql} WHERE id = $2`,
      [newStatus, requestId]
    )
    await client.query(
      `INSERT INTO request_status_history (request_id, old_status, new_status, notes, changed_by)
       VALUES ($1, $2, $3, $4, $5)`,
      [requestId, request.status, newStatus, notes || null, userId]
    )

    await client.query('COMMIT')
    return findById(pool, requestId)
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}

// ─── updateRequestStatus — chamado pelo server.js após COMMIT de movimentação ─
// Mapeamento de status de movimentação → status de solicitação:
//   movement criada (pending_confirmation ou confirmed) → em_execucao
//   movement status = confirmed                         → concluido
//   movement status = cancelled                         → aprovado (libera para nova tentativa)

async function updateRequestStatus(pool, requestId, movementStatus, userId, notes) {
  const statusMap = {
    pending_confirmation: 'em_execucao',
    confirmed:            'concluido',
  }
  const newRequestStatus = statusMap[movementStatus]
  if (!newRequestStatus) return null

  const ORDER = ['requisitado', 'visita_tecnica_solicitada', 'visita_realizada',
    'aguardando_aprovacao', 'aprovado', 'indisponivel_estoque', 'em_execucao', 'concluido']
  const newIdx = ORDER.indexOf(newRequestStatus)

  // Validação de progressão dentro da transação (com FOR UPDATE), eliminando a race condition
  // entre leitura livre e o SELECT FOR UPDATE do transitionStatus.
  try {
    return await transitionStatus(
      pool, requestId, newRequestStatus, userId,
      notes || 'Atualizado automaticamente via movimentação.',
      async (_client, lockedRequest) => {
        const currentIdx = ORDER.indexOf(lockedRequest.status)
        if (newRequestStatus !== 'aprovado' && newIdx <= currentIdx) {
          throw new Error('__SKIP__')
        }
        if (newRequestStatus === 'aprovado' && lockedRequest.status !== 'em_execucao') {
          throw new Error('__SKIP__')
        }
      },
      null
    )
  } catch (err) {
    if (err.message === '__SKIP__') return null
    throw err
  }
}

// ─── Visitas técnicas ─────────────────────────────────────────────────────────

async function createTechnicalVisit(pool, data) {
  const result = await pool.query(
    `INSERT INTO technical_visits
      (request_id, assigned_to, scheduled_date, scheduled_time, created_by)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [data.request_id, data.assigned_to || null, data.scheduled_date || null, data.scheduled_time || null, data.created_by]
  )
  return result.rows[0]
}

async function updateTechnicalVisitSchedule(pool, visitId, data) {
  const res = await pool.query(
    `UPDATE technical_visits
     SET assigned_to = $1, scheduled_date = $2, scheduled_time = $3
     WHERE id = $4
     RETURNING *`,
    [data.assigned_to || null, data.scheduled_date || null, data.scheduled_time || null, visitId]
  )
  return res.rows[0] || null
}

async function updateTechnicalVisitResult(pool, visitId, result, findings) {
  const res = await pool.query(
    `UPDATE technical_visits
     SET result = $1, findings = $2
     WHERE id = $3
     RETURNING *`,
    [result, findings || null, visitId]
  )
  return res.rows[0] || null
}

async function completeTechnicalVisit(pool, visitId, result, findings, completedBy) {
  const res = await pool.query(
    `UPDATE technical_visits
     SET result = $1, findings = $2, completed_by = $3, completed_at = NOW()
     WHERE id = $4 AND completed_at IS NULL
     RETURNING *`,
    [result, findings || null, completedBy, visitId]
  )
  return res.rows[0] || null
}

async function findTechnicalVisitsByRequestId(pool, requestId) {
  const result = await pool.query(
    `SELECT tv.*,
            ua.full_name AS assigned_to_name,
            uc.full_name AS completed_by_name,
            ucr.full_name AS created_by_name
     FROM technical_visits tv
     LEFT JOIN users ua  ON ua.id = tv.assigned_to
     LEFT JOIN users uc  ON uc.id = tv.completed_by
     LEFT JOIN users ucr ON ucr.id = tv.created_by
     WHERE tv.request_id = $1
     ORDER BY tv.created_at DESC`,
    [requestId]
  )
  return result.rows
}

// ─── Histórico de status ──────────────────────────────────────────────────────

async function findStatusHistory(pool, requestId) {
  const result = await pool.query(
    `SELECT rsh.*, u.full_name AS changed_by_name
     FROM request_status_history rsh
     LEFT JOIN users u ON u.id = rsh.changed_by
     WHERE rsh.request_id = $1
     ORDER BY rsh.changed_at ASC`,
    [requestId]
  )
  return result.rows
}

// ─── Movimentações vinculadas ─────────────────────────────────────────────────

async function findMovementsByRequestId(pool, requestId) {
  const result = await pool.query(
    `SELECT am.id, am.movement_type, am.delivery_status,
            am.created_at, u.full_name AS responsible_name,
            COUNT(ma.asset_id) AS asset_count
     FROM asset_movements am
     LEFT JOIN users u ON u.id = am.responsible_user_id
     LEFT JOIN movement_assets ma ON ma.movement_id = am.id
     WHERE am.request_id = $1
     GROUP BY am.id, u.full_name
     ORDER BY am.created_at DESC`,
    [requestId]
  )
  return result.rows
}

// ─── Itens do catálogo ────────────────────────────────────────────────────────

async function createCatalogItems(pool, requestId, items) {
  for (const item of items) {
    await pool.query(
      `INSERT INTO request_catalog_items
        (request_id, item_type_id, brand_id, model_id, description, quantity)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [requestId, item.item_type_id, item.brand_id || null, item.model_id || null, item.description || null, item.quantity || 1]
    )
  }
}

async function findCatalogItemsByRequestId(pool, requestId) {
  const result = await pool.query(
    `SELECT rci.*,
            it.name  AS item_type_name,
            cb.name  AS brand_name,
            cm.name  AS model_name
     FROM request_catalog_items rci
     JOIN item_types    it ON it.id = rci.item_type_id
     LEFT JOIN catalog_brands cb ON cb.id = rci.brand_id
     LEFT JOIN catalog_models  cm ON cm.id = rci.model_id
     WHERE rci.request_id = $1
     ORDER BY rci.created_at ASC`,
    [requestId]
  )
  return result.rows
}

async function updateOficioPath(pool, requestId, oficioPath, oficioOriginalName) {
  await pool.query(
    `UPDATE requests
     SET oficio_path = $1, oficio_original_name = $2, updated_at = NOW()
     WHERE id = $3`,
    [oficioPath, oficioOriginalName, requestId]
  )
}

// ─── Helpers de validação ─────────────────────────────────────────────────────

async function personExists(pool, personId) {
  const r = await pool.query('SELECT 1 FROM people WHERE id = $1', [personId])
  return r.rowCount > 0
}

async function findUnitById(pool, unitId) {
  const r = await pool.query('SELECT id, name, type FROM units WHERE id = $1', [unitId])
  return r.rows[0] || null
}

async function findApprovedRequestById(pool, requestId) {
  const r = await pool.query(
    `SELECT id, protocol, type, status, unit_id, requester_person_id
     FROM requests WHERE id = $1 AND status = 'aprovado'`,
    [requestId]
  )
  return r.rows[0] || null
}

async function findRequestForMovementPrefill(pool, protocol) {
  const r = await pool.query(
    `SELECT
       r.id, r.protocol, r.type, r.status,
       r.input_channel, r.input_channel_details,
       r.requester_person_id, p.full_name AS requester_name,
       r.unit_id, u.name AS unit_name,
       COALESCE(
         json_agg(
           json_build_object(
             'item_type_name', it.name,
             'brand_name',     cb.name,
             'model_name',     cm.name,
             'description',    rci.description,
             'quantity',       rci.quantity
           ) ORDER BY rci.id
         ) FILTER (WHERE rci.id IS NOT NULL),
         '[]'::json
       ) AS items
     FROM requests r
     JOIN people p ON r.requester_person_id = p.id
     JOIN units  u ON r.unit_id = u.id
     LEFT JOIN request_catalog_items rci ON r.id  = rci.request_id
     LEFT JOIN item_types            it  ON rci.item_type_id = it.id
     LEFT JOIN catalog_brands        cb  ON rci.brand_id     = cb.id
     LEFT JOIN catalog_models        cm  ON rci.model_id     = cm.id
     WHERE r.protocol = $1 AND r.status = 'aprovado'
     GROUP BY r.id, p.full_name, u.name`,
    [protocol]
  )
  return r.rows[0] || null
}

async function findRequestsForVisitRoute(pool) {
  const r = await pool.query(
    `SELECT r.id, r.protocol, r.type,
            u.name    AS unit_name,
            u.rpa     AS unit_rpa,
            u.address AS unit_address,
            p.full_name AS requester_name,
            tv.id            AS visit_id,
            tv.scheduled_date,
            tv.scheduled_time,
            ua.full_name     AS assigned_to_name
     FROM requests r
     JOIN units   u  ON u.id = r.unit_id
     JOIN people  p  ON p.id = r.requester_person_id
     LEFT JOIN technical_visits tv ON tv.request_id = r.id AND tv.completed_at IS NULL
     LEFT JOIN users            ua ON ua.id = tv.assigned_to
     WHERE r.status = 'visita_tecnica_solicitada'
     ORDER BY u.rpa NULLS LAST, tv.scheduled_date NULLS FIRST`
  )
  return r.rows
}

// ─── Ciência da DIT ──────────────────────────────────────────────────────────

async function markDitCiente(pool, requestId, userId, modalidade, previsaoAt) {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await client.query(
      `UPDATE requests
       SET dit_ciente_at = NOW(), dit_ciente_by = $1,
           dit_modalidade = $3, dit_previsao_at = $4,
           updated_at = NOW()
       WHERE id = $2`,
      [userId, requestId, modalidade, previsaoAt]
    )
    const previsaoFormatted = new Date(previsaoAt).toLocaleDateString('pt-BR')
    const modalidadeLabel = modalidade === 'entrega' ? 'Entrega na unidade' : 'Retirada pelo solicitante'
    await client.query(
      `INSERT INTO request_status_history (request_id, old_status, new_status, notes, changed_by)
       SELECT id, status, status, $3, $1
       FROM requests WHERE id = $2`,
      [userId, requestId, `DIT ciente. Modalidade: ${modalidadeLabel}. Previsão: ${previsaoFormatted}.`]
    )
    await client.query(
      `INSERT INTO dit_eventos (request_id, tipo, modalidade, changed_by)
       VALUES ($1, 'ciente', $2, $3)`,
      [requestId, modalidade, userId]
    )
    await client.query('COMMIT')
    return findById(pool, requestId)
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}

async function criarEventoDit(pool, requestId, userId, tipo, dados) {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    if (tipo === 'reagendamento') {
      const cur = await client.query(
        'SELECT dit_previsao_at, status FROM requests WHERE id = $1 FOR UPDATE',
        [requestId]
      )
      const dataAnterior = cur.rows[0]?.dit_previsao_at || null
      await client.query(
        `INSERT INTO dit_eventos (request_id, tipo, data_anterior, nova_data, motivo, changed_by)
         VALUES ($1, 'reagendamento', $2, $3, $4, $5)`,
        [requestId, dataAnterior, dados.nova_data, dados.motivo, userId]
      )
      await client.query(
        `UPDATE requests SET dit_previsao_at = $1, updated_at = NOW() WHERE id = $2`,
        [dados.nova_data, requestId]
      )
      const anterior = dataAnterior
        ? new Date(dataAnterior).toLocaleDateString('pt-BR')
        : 'não definida'
      const nova = new Date(dados.nova_data).toLocaleDateString('pt-BR')
      await client.query(
        `INSERT INTO request_status_history (request_id, old_status, new_status, notes, changed_by)
         SELECT id, status, status, $3, $1
         FROM requests WHERE id = $2`,
        [userId, requestId, `DIT reagendou de ${anterior} para ${nova}. Motivo: ${dados.motivo}`]
      )
    } else if (tipo === 'observacao') {
      await client.query(
        `INSERT INTO dit_eventos (request_id, tipo, motivo, changed_by)
         VALUES ($1, 'observacao', $2, $3)`,
        [requestId, dados.motivo, userId]
      )
    }

    await client.query('COMMIT')
    return findById(pool, requestId)
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}

// ─── Fila de indisponíveis no estoque ────────────────────────────────────────

async function findUnavailableQueue(pool) {
  const r = await pool.query(
    `SELECT r.id, r.protocol, r.type,
            u.name AS unit_name,
            u.rpa  AS unit_rpa,
            p.full_name AS requester_name,
            rsh.changed_at AS unavailable_since,
            COALESCE(
              json_agg(
                json_build_object(
                  'item_type_name', it.name,
                  'brand_name',     cb.name,
                  'model_name',     cm.name,
                  'quantity',       rci.quantity
                ) ORDER BY rci.id
              ) FILTER (WHERE rci.id IS NOT NULL),
              '[]'::json
            ) AS items
     FROM requests r
     JOIN units   u ON u.id = r.unit_id
     JOIN people  p ON p.id = r.requester_person_id
     LEFT JOIN LATERAL (
       SELECT changed_at FROM request_status_history
       WHERE request_id = r.id AND new_status = 'indisponivel_estoque'
       ORDER BY id DESC LIMIT 1
     ) rsh ON true
     LEFT JOIN request_catalog_items rci ON rci.request_id = r.id
     LEFT JOIN item_types            it  ON it.id = rci.item_type_id
     LEFT JOIN catalog_brands        cb  ON cb.id = rci.brand_id
     LEFT JOIN catalog_models        cm  ON cm.id = rci.model_id
     WHERE r.status = 'indisponivel_estoque'
     GROUP BY r.id, u.name, u.rpa, p.full_name, rsh.changed_at
     ORDER BY rsh.changed_at ASC NULLS LAST`
  )
  return r.rows
}

module.exports = {
  create,
  findById,
  findAll,
  transitionStatus,
  updateRequestStatus,
  createTechnicalVisit,
  updateTechnicalVisitSchedule,
  updateTechnicalVisitResult,
  completeTechnicalVisit,
  findTechnicalVisitsByRequestId,
  findStatusHistory,
  findMovementsByRequestId,
  createCatalogItems,
  findCatalogItemsByRequestId,
  updateOficioPath,
  personExists,
  findUnitById,
  findApprovedRequestById,
  findRequestForMovementPrefill,
  findRequestsForVisitRoute,
  markDitCiente,
  criarEventoDit,
  findUnavailableQueue,
}
