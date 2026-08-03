// services/feedbackService.js

const repository = require('../repositories/feedbackRepository')

const VALID_TIPOS = ['reclamacao', 'elogio', 'observacao', 'duvida']
const VALID_STATUSES = ['aberto', 'respondido', 'encerrado']
const STAFF_ROLES = ['admin', 'manager']

function isStaff(user) {
  return STAFF_ROLES.includes(user?.role)
}

function assertTipo(tipo) {
  if (!tipo || !VALID_TIPOS.includes(tipo)) {
    throw new Error('Tipo inválido. Use: reclamacao, elogio, observacao ou duvida.')
  }
}

function assertStatus(status) {
  if (!status || !VALID_STATUSES.includes(status)) {
    throw new Error('Status inválido. Use: aberto, respondido ou encerrado.')
  }
}

async function createFeedback(pool, data, userId) {
  const { tipo, page_context, body } = data

  assertTipo(tipo)

  if (!page_context || !String(page_context).trim()) {
    throw new Error('Contexto da página é obrigatório.')
  }
  if (!body || !String(body).trim()) {
    throw new Error('Mensagem é obrigatória.')
  }
  if (String(body).trim().length > 5000) {
    throw new Error('Mensagem inválida: máximo de 5000 caracteres.')
  }

  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const { feedback } = await repository.create(client, {
      userId,
      tipo,
      pageContext: String(page_context).trim().slice(0, 120),
      body: String(body).trim(),
    }, client)
    await client.query('COMMIT')

    return getFeedbackById(pool, feedback.id, { id: userId, role: 'basic' })
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}

async function listMine(pool, userId) {
  return repository.findMine(pool, userId)
}

async function listAll(pool, filters, user) {
  if (!isStaff(user)) {
    throw new Error('Acesso negado. Perfil sem permissão para listar feedbacks.')
  }
  return repository.list(pool, filters)
}

async function getFeedbackById(pool, id, user) {
  const feedback = await repository.findById(pool, id)
  if (!feedback) {
    throw new Error('Feedback não encontrado.')
  }

  const canView = isStaff(user) || feedback.user_id === user.id
  if (!canView) {
    throw new Error('Acesso negado. Você não pode visualizar este feedback.')
  }

  const messages = await repository.findMessages(pool, id)
  return { ...feedback, messages }
}

async function addStaffMessage(pool, feedbackId, body, user) {
  if (!isStaff(user)) {
    throw new Error('Acesso negado. Apenas admin/manager podem responder.')
  }
  if (!body || !String(body).trim()) {
    throw new Error('Mensagem é obrigatória.')
  }
  if (String(body).trim().length > 5000) {
    throw new Error('Mensagem inválida: máximo de 5000 caracteres.')
  }

  const feedback = await repository.findById(pool, feedbackId)
  if (!feedback) {
    throw new Error('Feedback não encontrado.')
  }
  if (feedback.status === 'encerrado') {
    throw new Error('Não é possível responder um feedback encerrado.')
  }

  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await repository.addMessage(client, {
      feedbackId,
      authorId: user.id,
      body: String(body).trim(),
    }, client)

    if (feedback.status === 'aberto') {
      await repository.updateStatus(client, feedbackId, 'respondido', client)
    }

    await client.query('COMMIT')
    return getFeedbackById(pool, feedbackId, user)
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}

async function changeStatus(pool, feedbackId, status, user) {
  assertStatus(status)

  const feedback = await repository.findById(pool, feedbackId)
  if (!feedback) {
    throw new Error('Feedback não encontrado.')
  }

  const isOwner = feedback.user_id === user.id

  // Autor pode apenas arquivar (encerrar) o próprio registro
  if (!isStaff(user)) {
    if (!isOwner || status !== 'encerrado') {
      throw new Error('Acesso negado. Você só pode arquivar os próprios feedbacks.')
    }
  }

  if (feedback.status === 'encerrado' && status === 'encerrado') {
    return getFeedbackById(pool, feedbackId, user)
  }

  const updated = await repository.updateStatus(pool, feedbackId, status)
  return getFeedbackById(pool, updated.id, user)
}

module.exports = {
  createFeedback,
  listMine,
  listAll,
  getFeedbackById,
  addStaffMessage,
  changeStatus,
  VALID_TIPOS,
  VALID_STATUSES,
}
