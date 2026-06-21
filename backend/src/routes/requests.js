// routes/requests.js
// Camada de rotas do módulo de Solicitações de TI

module.exports = function (pool, authenticateToken, authorizePermission, logAudit) {
  const express = require('express')
  const multer  = require('multer')
  const path    = require('path')
  const fs      = require('fs')
  const router  = express.Router()
  const controller = require('../controllers/requestController')

  // ─── Multer para upload de ofício ────────────────────────────────────────
  const oficioDir = path.join(__dirname, '..', 'uploads', 'requests', 'oficios')
  if (!fs.existsSync(oficioDir)) fs.mkdirSync(oficioDir, { recursive: true })

  const uploadOficio = multer({
    storage: multer.diskStorage({
      destination: (_req, _file, cb) => cb(null, oficioDir),
      filename: (_req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase()
        cb(null, `oficio_${Date.now()}${ext}`)
      },
    }),
    fileFilter: (_req, file, cb) => {
      const allowed = ['.pdf', '.jpg', '.jpeg', '.png']
      if (allowed.includes(path.extname(file.originalname).toLowerCase())) {
        cb(null, true)
      } else {
        cb(new Error('Formato não permitido. Use PDF, JPG ou PNG.'))
      }
    },
    limits: { fileSize: 10 * 1024 * 1024 },
  })

  // ─── Usuários para seleção de técnico (qualquer perfil autenticado) ────────
  router.get('/users/for-assignment', authenticateToken, async (req, res) => {
    try {
      const result = await pool.query(
        'SELECT id, full_name FROM users WHERE is_active = true ORDER BY full_name ASC'
      )
      res.status(200).json(result.rows)
    } catch (err) {
      res.status(500).json({ message: 'Erro interno.' })
    }
  })

  // ─── CRUD ───────────────────────────────────────────────────────────────
  router.post('/requests', authenticateToken, uploadOficio.single('oficio'),
    (req, res) => controller.create(req, res, pool, logAudit))

  router.get('/requests', authenticateToken,
    (req, res) => controller.list(req, res, pool))

  // Deve ficar antes de /requests/:id para não ser capturada como id numérico
  router.get('/requests/movement-prefill', authenticateToken,
    authorizePermission('ACTION_REGISTER_MOVEMENT'),
    (req, res) => controller.getMovementPrefill(req, res, pool))

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

  router.patch('/requests/:id/technical-visits/:visitId/schedule', authenticateToken,
    (req, res) => controller.updateVisitSchedule(req, res, pool, logAudit))

  router.patch('/requests/:id/technical-visits/:visitId/result', authenticateToken,
    (req, res) => controller.updateVisitResult(req, res, pool, logAudit))

  // ─── Download do ofício ──────────────────────────────────────────────────
  router.get('/requests/:id/oficio', authenticateToken, async (req, res) => {
    try {
      const result = await pool.query(
        'SELECT oficio_path, oficio_original_name FROM requests WHERE id = $1',
        [req.params.id]
      )
      if (!result.rows.length || !result.rows[0].oficio_path)
        return res.status(404).json({ message: 'Ofício não encontrado.' })
      const { oficio_path, oficio_original_name } = result.rows[0]
      if (!fs.existsSync(oficio_path))
        return res.status(404).json({ message: 'Arquivo não encontrado no servidor.' })
      res.download(oficio_path, oficio_original_name || path.basename(oficio_path))
    } catch (err) {
      res.status(500).json({ message: 'Erro ao baixar ofício.' })
    }
  })

  // ─── Pré-preenchimento para formulário de movimentação ───────────────────
  router.get('/requests/:id/approved-prefill', authenticateToken,
    authorizePermission('ACTION_REGISTER_MOVEMENT'),
    (req, res) => controller.getApprovedPrefill(req, res, pool))

  return router
}
