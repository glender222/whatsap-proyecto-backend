const express = require('express');
const WhatsAppController = require('../controllers/whatsappController');
const { validateJWT, requireAdmin } = require('../middleware/authMiddleware');

function createWhatsAppRoutes(whatsappService) {
  const router = express.Router();
  const whatsAppController = new WhatsAppController(whatsappService);

  router.post('/init', validateJWT, requireAdmin, whatsAppController.initialize);

  return router;
}

module.exports = createWhatsAppRoutes;
