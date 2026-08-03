// repositories/feedbackRepository.js

async function create(pool, { userId, tipo, pageContext, body }, client = null) {
  const db = client || pool
  const feedbackResult = await db.query(
    `INSERT INTO feedbacks (user_id, tipo, status, page_context)
     VALUES ($1, $2, 'aberto', $3)
     RETURNING *`,
    [userId, tipo, pageContext]
  )
  const feedback = feedbackResult.rows[0]

  const messageResult = await db.query(
    `INSERT INTO feedback_messages (feedback_id, author_id, body)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [feedback.id, userId, body]
  )

  return { feedback, message: messageResult.rows[0] }
}

async function findById(pool, id) {
  const result = await pool.query(
    `SELECT f.*,
            u.full_name AS user_full_name,
            u.username  AS user_username,
            u.email     AS user_email,
            u.role      AS user_role
     FROM feedbacks f
     JOIN users u ON u.id = f.user_id
     WHERE f.id = $1`,
    [id]
  )
  return result.rows[0] || null
}

async function findMessages(pool, feedbackId) {
  const result = await pool.query(
    `SELECT m.*,
            u.full_name AS author_full_name,
            u.username  AS author_username,
            u.role      AS author_role
     FROM feedback_messages m
     JOIN users u ON u.id = m.author_id
     WHERE m.feedback_id = $1
     ORDER BY m.created_at ASC`,
    [feedbackId]
  )
  return result.rows
}

async function findMine(pool, userId) {
  const result = await pool.query(
    `SELECT f.*,
            (SELECT COUNT(*)::int FROM feedback_messages m WHERE m.feedback_id = f.id) AS message_count,
            (SELECT m.body FROM feedback_messages m
              WHERE m.feedback_id = f.id
              ORDER BY m.created_at ASC LIMIT 1) AS first_message
     FROM feedbacks f
     WHERE f.user_id = $1
     ORDER BY f.updated_at DESC`,
    [userId]
  )
  return result.rows
}

async function list(pool, filters = {}) {
  const conditions = []
  const values = []
  let i = 1

  if (filters.status) {
    conditions.push(`f.status = $${i++}`)
    values.push(filters.status)
  }
  if (filters.tipo) {
    conditions.push(`f.tipo = $${i++}`)
    values.push(filters.tipo)
  }
  if (filters.user_id) {
    conditions.push(`f.user_id = $${i++}`)
    values.push(parseInt(filters.user_id, 10))
  }
  if (filters.page_context) {
    conditions.push(`f.page_context ILIKE $${i++}`)
    values.push(`%${filters.page_context}%`)
  }
  if (filters.search) {
    conditions.push(`(
      u.full_name ILIKE $${i} OR u.username ILIKE $${i} OR u.email ILIKE $${i}
      OR EXISTS (
        SELECT 1 FROM feedback_messages m
        WHERE m.feedback_id = f.id AND m.body ILIKE $${i}
      )
    )`)
    values.push(`%${filters.search}%`)
    i++
  }
  if (filters.date_from) {
    conditions.push(`f.created_at >= $${i++}::timestamptz`)
    values.push(filters.date_from)
  }
  if (filters.date_to) {
    conditions.push(`f.created_at < ($${i++}::date + INTERVAL '1 day')`)
    values.push(filters.date_to)
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''

  const result = await pool.query(
    `SELECT f.*,
            u.full_name AS user_full_name,
            u.username  AS user_username,
            u.email     AS user_email,
            (SELECT COUNT(*)::int FROM feedback_messages m WHERE m.feedback_id = f.id) AS message_count,
            (SELECT m.body FROM feedback_messages m
              WHERE m.feedback_id = f.id
              ORDER BY m.created_at ASC LIMIT 1) AS first_message
     FROM feedbacks f
     JOIN users u ON u.id = f.user_id
     ${where}
     ORDER BY f.updated_at DESC`,
    values
  )
  return result.rows
}

async function addMessage(pool, { feedbackId, authorId, body }, client = null) {
  const db = client || pool
  const messageResult = await db.query(
    `INSERT INTO feedback_messages (feedback_id, author_id, body)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [feedbackId, authorId, body]
  )
  await db.query(
    `UPDATE feedbacks SET updated_at = NOW() WHERE id = $1`,
    [feedbackId]
  )
  return messageResult.rows[0]
}

async function updateStatus(pool, id, status, client = null) {
  const db = client || pool
  const result = await db.query(
    `UPDATE feedbacks
     SET status = $1, updated_at = NOW()
     WHERE id = $2
     RETURNING *`,
    [status, id]
  )
  return result.rows[0] || null
}

module.exports = {
  create,
  findById,
  findMessages,
  findMine,
  list,
  addMessage,
  updateStatus,
}
