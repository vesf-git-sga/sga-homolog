// controllers/requestController.js
// Camada HTTP — validação de req.body, formatação de resposta

const fs = require('fs')
const service = require('../services/requestService')
const repository = require('../repositories/requestRepository')

async function create(req, res, pool, logAudit) {
  const oficioPath = req.file ? req.file.path : null
  const oficioOriginalName = req.file ? req.file.originalname : null

  try {
    // Campos numéricos chegam como string em multipart/form-data
    const data = {
      ...req.body,
      requester_person_id: parseInt(req.body.requester_person_id),
      unit_id: parseInt(req.body.unit_id),
      items: req.body.items ? JSON.parse(req.body.items) : [],
    }

    const result = await service.createRequest(pool, data, req.user.id, oficioPath, oficioOriginalName)
    await logAudit(req.user.id, 'request_created', 'requests', result.id,
      { type: result.type, protocol: result.protocol }, req.ip)
    res.status(201).json(result)
  } catch (err) {
    // Remove arquivo enviado se a criação falhou
    if (oficioPath && fs.existsSync(oficioPath)) {
      try { fs.unlinkSync(oficioPath) } catch (_) {}
    }
    const status = err.message.includes('obrigatório') || err.message.includes('inválid') ||
                   err.message.includes('item') || err.message.includes('ofício') ? 400 : 500
    res.status(status).json({ message: err.message })
  }
}

async function list(req, res, pool) {
  try {
    const filters = {
      status:  req.query.status,
      type:    req.query.type,
      unit_id: req.query.unit_id,
      search:  req.query.search,
    }
    const results = await service.listRequests(pool, filters)
    res.status(200).json(results)
  } catch (err) {
    res.status(500).json({ message: 'Erro ao listar solicitações.' })
  }
}

async function getById(req, res, pool) {
  try {
    const request = await service.getRequestById(pool, parseInt(req.params.id), req.user)
    res.status(200).json(request)
  } catch (err) {
    const status = err.message.includes('não encontrada') ? 404 : 500
    res.status(status).json({ message: err.message })
  }
}

async function changeStatus(req, res, pool, logAudit) {
  try {
    const { status: newStatus, notes } = req.body
    if (!newStatus) return res.status(400).json({ message: 'Campo status é obrigatório.' })

    const result = await service.changeStatus(pool, parseInt(req.params.id), newStatus, req.user, notes)
    await logAudit(req.user.id, 'request_status_changed', 'requests', result.id,
      { newStatus, notes }, req.ip)
    res.status(200).json(result)
  } catch (err) {
    const status =
      err.message.includes('não encontrada') ? 404 :
      err.message.includes('Transição') || err.message.includes('perfil') ||
      err.message.includes('obrigatório') || err.message.includes('terminal') ? 400 :
      err.message.includes('mudou de status') ? 409 : 500
    res.status(status).json({ message: err.message })
  }
}

async function getStatusHistory(req, res, pool) {
  try {
    const history = await repository.findStatusHistory(pool, parseInt(req.params.id))
    res.status(200).json(history)
  } catch (err) {
    res.status(500).json({ message: 'Erro ao buscar histórico.' })
  }
}

async function scheduleTechnicalVisit(req, res, pool, logAudit) {
  try {
    const requestId = parseInt(req.params.id)
    const visit = await service.scheduleTechnicalVisit(pool, requestId, req.body, req.user.id)
    await logAudit(req.user.id, 'technical_visit_scheduled', 'technical_visits', visit.id,
      { request_id: requestId }, req.ip)
    res.status(201).json(visit)
  } catch (err) {
    const status =
      err.message.includes('não encontrada') ? 404 :
      err.message.includes('disponível') || err.message.includes('início') ? 400 : 500
    res.status(status).json({ message: err.message })
  }
}

async function completeTechnicalVisit(req, res, pool, logAudit) {
  try {
    const visitId = parseInt(req.params.visitId)
    const { item_results, findings, result } = req.body

    // Compatibilidade: resultado único antigo → aplica a todos os itens
    let itemResults = item_results
    if ((!itemResults || !Array.isArray(itemResults)) && result) {
      const items = await repository.findCatalogItemsByRequestId(pool, parseInt(req.params.id))
      itemResults = items.map((item) => ({
        catalog_item_id: item.id,
        result,
        findings: findings || null,
      }))
    }

    const data = await service.completeTechnicalVisit(pool, visitId, itemResults, findings, req.user.id)
    await logAudit(req.user.id, 'technical_visit_completed', 'technical_visits', visitId,
      { request_id: data.request_id, status: data.status, item_results: data.item_results }, req.ip)
    res.status(200).json(data)
  } catch (err) {
    const status =
      err.message.includes('não encontrada') ? 404 :
      err.message.includes('obrigatório') || err.message.includes('concluída') ||
      err.message.includes('disponível') || err.message.includes('inválid') ||
      err.message.includes('equipamento') ? 400 : 500
    res.status(status).json({ message: err.message })
  }
}

async function updateVisitSchedule(req, res, pool, logAudit) {
  try {
    const visitId = parseInt(req.params.visitId)
    const visit = await service.updateVisitSchedule(pool, visitId, req.body, req.user.id)
    await logAudit(req.user.id, 'technical_visit_schedule_updated', 'technical_visits', visitId,
      { request_id: parseInt(req.params.id) }, req.ip)
    res.status(200).json(visit)
  } catch (err) {
    const status =
      err.message.includes('não encontrada') ? 404 :
      err.message.includes('disponível') || err.message.includes('pendente') ? 400 : 500
    res.status(status).json({ message: err.message })
  }
}

async function updateVisitResult(req, res, pool, logAudit) {
  try {
    const visitId = parseInt(req.params.visitId)
    const { item_results, findings, result } = req.body

    let itemResults = item_results
    if ((!itemResults || !Array.isArray(itemResults)) && result) {
      const items = await repository.findCatalogItemsByRequestId(pool, parseInt(req.params.id))
      itemResults = items.map((item) => ({
        catalog_item_id: item.id,
        result,
        findings: findings || null,
      }))
    }

    const visit = await service.updateVisitResult(pool, visitId, itemResults, findings, req.user.id)
    await logAudit(req.user.id, 'technical_visit_result_updated', 'technical_visits', visitId,
      { request_id: parseInt(req.params.id) }, req.ip)
    res.status(200).json(visit)
  } catch (err) {
    const status =
      err.message.includes('não encontrada') ? 404 :
      err.message.includes('inválido') || err.message.includes('concluída') ||
      err.message.includes('deliberação') || err.message.includes('equipamento') ? 400 : 500
    res.status(status).json({ message: err.message })
  }
}

async function submitItemDeliberations(req, res, pool, logAudit) {
  try {
    const requestId = parseInt(req.params.id)
    const { decisions, notes } = req.body || {}
    const result = await service.submitItemDeliberations(pool, requestId, decisions, req.user, notes)
    await logAudit(req.user.id, 'request_item_deliberation', 'requests', requestId,
      { decisions, notes }, req.ip)
    res.status(200).json(result)
  } catch (err) {
    const status =
      err.message.includes('não encontrada') ? 404 :
      err.message.includes('permissão') || err.message.includes('Deliberação') ||
      err.message.includes('obrigatório') || err.message.includes('inválid') ||
      err.message.includes('Quantidade') || err.message.includes('mudou') ? 400 : 500
    res.status(status).json({ message: err.message })
  }
}

async function listTechnicalVisits(req, res, pool) {
  try {
    const visits = await repository.findTechnicalVisitsByRequestId(pool, parseInt(req.params.id))
    res.status(200).json(visits)
  } catch (err) {
    res.status(500).json({ message: 'Erro ao buscar visitas técnicas.' })
  }
}

// Usado pelo formulário de movimentação para pré-preencher campos
// quando o operador informa um protocolo de solicitação aprovada.
async function getApprovedPrefill(req, res, pool) {
  try {
    const requestId = parseInt(req.params.id)
    const data = await service.findApprovedRequest(pool, requestId)
    if (!data) return res.status(404).json({ message: 'Solicitação aprovada não encontrada.' })
    res.status(200).json(data)
  } catch (err) {
    res.status(500).json({ message: 'Erro ao buscar solicitação.' })
  }
}

// Pré-preenchimento rico por protocolo: retorna solicitante, unidade, canal e itens solicitados.
async function getMovementPrefill(req, res, pool) {
  try {
    const { protocol } = req.query
    if (!protocol) return res.status(400).json({ message: 'Parâmetro protocol obrigatório.' })
    const data = await service.getMovementPrefill(pool, protocol.trim().toUpperCase())
    if (!data) return res.status(404).json({ message: 'Solicitação aprovada não encontrada para este protocolo.' })
    res.status(200).json(data)
  } catch (err) {
    res.status(500).json({ message: 'Erro ao buscar solicitação.' })
  }
}

async function getVisitRoute(req, res, pool) {
  try {
    const entries = await repository.findRequestsForVisitRoute(pool)
    res.status(200).json(entries)
  } catch (err) {
    res.status(500).json({ message: 'Erro ao buscar rotas de visitas.' })
  }
}

async function ackDitCiente(req, res, pool, logAudit) {
  try {
    const requestId = parseInt(req.params.id)
    const { modalidade, previsao_at } = req.body || {}
    const result = await service.ditCiente(pool, requestId, req.user, modalidade, previsao_at)
    await logAudit(req.user.id, 'request_dit_ciente', 'requests', requestId,
      { modalidade, previsao_at }, req.ip)
    res.status(200).json(result)
  } catch (err) {
    const status =
      err.message.includes('não encontrada') ? 404 :
      err.message.includes('aprovada') || err.message.includes('já registrou') ||
      err.message.includes('permissão') || err.message.includes('obrigatóri') ||
      err.message.includes('inválid') ? 400 : 500
    res.status(status).json({ message: err.message })
  }
}

async function registrarEventoDit(req, res, pool, logAudit) {
  try {
    const requestId = parseInt(req.params.id)
    const { tipo, nova_data, motivo } = req.body || {}
    const result = await service.registrarEventoDit(
      pool, requestId, req.user, tipo, { nova_data, motivo }
    )
    await logAudit(req.user.id, `request_dit_${tipo}`, 'requests', requestId,
      { tipo, nova_data, motivo }, req.ip)
    res.status(200).json(result)
  } catch (err) {
    const status =
      err.message.includes('não encontrada') ? 404 :
      err.message.includes('obrigatóri') || err.message.includes('inválid') ||
      err.message.includes('permissão') || err.message.includes('ciência') ||
      err.message.includes('terminal') || err.message.includes('vazia') ? 400 : 500
    res.status(status).json({ message: err.message })
  }
}

async function getUnavailableQueue(req, res, pool) {
  try {
    const entries = await service.getUnavailableQueue(pool)
    res.status(200).json(entries)
  } catch (err) {
    res.status(500).json({ message: 'Erro ao buscar fila de indisponíveis.' })
  }
}

module.exports = {
  create,
  list,
  getById,
  changeStatus,
  getStatusHistory,
  scheduleTechnicalVisit,
  updateVisitSchedule,
  updateVisitResult,
  completeTechnicalVisit,
  submitItemDeliberations,
  listTechnicalVisits,
  getApprovedPrefill,
  getMovementPrefill,
  getVisitRoute,
  ackDitCiente,
  registrarEventoDit,
  getUnavailableQueue,
}
