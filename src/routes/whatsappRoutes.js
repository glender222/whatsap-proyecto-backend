const express = require('express');
const WhatsAppController = require('../controllers/whatsappController');
const { validateJWT, requireAdmin } = require('../middleware/authMiddleware');

function createWhatsAppRoutes(whatsappService) {
  const router = express.Router();
  const whatsAppController = new WhatsAppController(whatsappService);

  /**
   * @swagger
   * tags:
   *   name: WhatsApp
   *   description: Acciones relacionadas con la gestión de la sesión de WhatsApp.
   */

  /**
   * @swagger
   * /whatsapp/init:
   *   post:
   *     tags:
   *       - WhatsApp
   *     summary: Inicializar la sesión de WhatsApp
   *     description: Inicia el proceso de conexión con WhatsApp y la generación del código QR. Esta acción debe ser ejecutada por un administrador antes de poder usar el servicio.
   *     security:
   *       - BearerAuth: []
   *     responses:
   *       200:
   *         description: Servicio de WhatsApp inicializado. El QR se enviará por Socket.IO.
   *       400:
   *         description: El servicio ya está inicializado.
   *       403:
   *         description: No autorizado (solo para Admins).
   *       500:
   *         description: Error interno al inicializar el servicio.
   */
  router.post('/init', validateJWT, requireAdmin, whatsAppController.initialize);

  return router;
}

module.exports = createWhatsAppRoutes;
