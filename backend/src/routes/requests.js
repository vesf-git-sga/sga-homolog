// routes/requests.js
// Camada de rotas do módulo de Solicitações de TI

module.exports = function (pool, authenticateToken, authorizePermission, logAudit) {
  const express = require('express')
  const router = express.Router()
  const controller = require('../controllers/requestController')

  // ─── CRUD ───────────────────────────────────────────────────────────────
  router.post('/requests', authenticateToken,
    (req, res) => controller.create(req, res, pool, logAudit))

  router.get('/requests', authenticateToken,
    (req, res) => controller.list(req, res, pool))

  router.get('/requests/:id', authenticateToken,
    (req, res) => controller.getById(req, res, pool))

  // ─── Transições de status ────────────────────────────────────────────────
  router.patch('/requests/:id/status', authenticateToken,
    (req, res) => controller.changeStatus(req, res, pool, logAudit))

  // ─── Histórico de status ─────────────────────────────────────────────────
  router.get('/requests/:id/history', authenticateToken,
    (req, res) => controller.getStatusHistory(req, res, pool))

  // ─── Visitas técnicas ────────────────────────────────────────────────────
  router.get('/requests/:id/technical-visits', authenticateToken,
    (req, res) => controller.listTechnicalVisits(req, res, pool))

  router.post('/requests/:id/technical-visits', authenticateToken,
    (req, res) => controller.scheduleTechnicalVisit(req, res, pool, logAudit))

  router.patch('/requests/:id/technical-visits/:visitId/complete', authenticateToken,
    (req, res) => controller.completeTechnicalVisit(req, res, pool, logAudit))

  // ─── Pré-preenchimento para formulário de movimentação ───────────────────
  router.get('/requests/:id/approved-prefill', authenticateToken,
    authorizePermission('ACTION_REGISTER_MOVEMENT'),
    (req, res) => controller.getApprovedPrefill(req, res, pool))

  return router
}
