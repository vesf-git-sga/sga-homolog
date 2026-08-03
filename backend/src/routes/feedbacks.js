// routes/feedbacks.js
// Camada de rotas do módulo de Feedback

module.exports = function (pool, authenticateToken, authorizeRole, logAudit) {
  const express = require('express')
  const router = express.Router()
  const controller = require('../controllers/feedbackController')

  const staffOnly = authorizeRole(['admin', 'manager'])

  router.post('/feedbacks', authenticateToken,
    (req, res) => controller.create(req, res, pool, logAudit))

  router.get('/feedbacks/mine', authenticateToken,
    (req, res) => controller.listMine(req, res, pool))

  router.get('/feedbacks', authenticateToken, staffOnly,
    (req, res) => controller.list(req, res, pool))

  router.get('/feedbacks/:id', authenticateToken,
    (req, res) => controller.getById(req, res, pool))

  router.post('/feedbacks/:id/messages', authenticateToken, staffOnly,
    (req, res) => controller.addMessage(req, res, pool, logAudit))

  router.patch('/feedbacks/:id/status', authenticateToken,
    (req, res) => controller.changeStatus(req, res, pool, logAudit))

  return router
}
