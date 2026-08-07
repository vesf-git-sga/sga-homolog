// controllers/feedbackController.js

const service = require('../services/feedbackService')

function mapErrorStatus(err) {
  if (err.message.includes('não encontrado')) return 404
  if (err.message.includes('Acesso negado')) return 403
  if (
    err.message.includes('obrigatório') ||
    err.message.includes('inválid') ||
    err.message.includes('Use:') ||
    err.message.includes('máximo') ||
    err.message.includes('encerrado')
  ) return 400
  return 500
}

async function create(req, res, pool, logAudit) {
  try {
    const result = await service.createFeedback(pool, req.body, req.user.id)
    await logAudit(req.user.id, 'feedback_created', 'feedbacks', result.id,
      { tipo: result.tipo, page_context: result.page_context }, req.ip)
    res.status(201).json(result)
  } catch (err) {
    res.status(mapErrorStatus(err)).json({ message: err.message })
  }
}

async function listMine(req, res, pool) {
  try {
    const results = await service.listMine(pool, req.user.id)
    res.status(200).json(results)
  } catch (err) {
    res.status(500).json({ message: 'Erro ao listar seus feedbacks.' })
  }
}

async function list(req, res, pool) {
  try {
    const filters = {
      status: req.query.status,
      tipo: req.query.tipo,
      user_id: req.query.user_id,
      page_context: req.query.page_context,
      search: req.query.search,
      date_from: req.query.date_from,
      date_to: req.query.date_to,
    }
    const results = await service.listAll(pool, filters, req.user)
    res.status(200).json(results)
  } catch (err) {
    res.status(mapErrorStatus(err)).json({ message: err.message })
  }
}

async function getById(req, res, pool) {
  try {
    const result = await service.getFeedbackById(pool, parseInt(req.params.id, 10), req.user)
    res.status(200).json(result)
  } catch (err) {
    res.status(mapErrorStatus(err)).json({ message: err.message })
  }
}

async function addMessage(req, res, pool, logAudit) {
  try {
    const result = await service.addStaffMessage(
      pool,
      parseInt(req.params.id, 10),
      req.body.body,
      req.user
    )
    await logAudit(req.user.id, 'feedback_replied', 'feedbacks', result.id,
      { status: result.status }, req.ip)
    res.status(200).json(result)
  } catch (err) {
    res.status(mapErrorStatus(err)).json({ message: err.message })
  }
}

async function changeStatus(req, res, pool, logAudit) {
  try {
    const { status } = req.body
    if (!status) {
      return res.status(400).json({ message: 'Campo status é obrigatório.' })
    }
    const result = await service.changeStatus(
      pool,
      parseInt(req.params.id, 10),
      status,
      req.user
    )
    await logAudit(req.user.id, 'feedback_status_changed', 'feedbacks', result.id,
      { status }, req.ip)
    res.status(200).json(result)
  } catch (err) {
    res.status(mapErrorStatus(err)).json({ message: err.message })
  }
}

module.exports = {
  create,
  listMine,
  list,
  getById,
  addMessage,
  changeStatus,
}
