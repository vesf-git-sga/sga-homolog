// controllers/requestController.js
// Camada HTTP — validação de req.body, formatação de resposta

const service = require('../services/requestService')
const repository = require('../repositories/requestRepository')

async function create(req, res, pool, logAudit) {
  try {
    const result = await service.createRequest(pool, req.body, req.user.id)
    await logAudit(req.user.id, 'request_created', 'requests', result.id,
      { type: result.type, protocol: result.protocol }, req.ip)
    res.status(201).json(result)
  } catch (err) {
    res.status(400).json({ message: err.message })
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
    const { result, findings } = req.body
    const data = await service.completeTechnicalVisit(pool, visitId, result, findings, req.user.id)
    await logAudit(req.user.id, 'technical_visit_completed', 'technical_visits', visitId,
      { request_id: data.request_id, result }, req.ip)
    res.status(200).json(data)
  } catch (err) {
    const status =
      err.message.includes('não encontrada') ? 404 :
      err.message.includes('obrigatório') || err.message.includes('concluída') ||
      err.message.includes('disponível') ? 400 : 500
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

module.exports = {
  create,
  list,
  getById,
  changeStatus,
  getStatusHistory,
  scheduleTechnicalVisit,
  completeTechnicalVisit,
  listTechnicalVisits,
  getApprovedPrefill,
}
