const express = require('express');
const WhatsAppController = require('../controllers/whatsappController');
const { validateJWT, requireAdmin } = require('../middleware/authMiddleware');

function createWhatsAppRoutes(sessionManager) { // Recibe sessionManager
  const router = express.Router();
  const whatsAppController = new WhatsAppController(sessionManager);

  /**
   * @swagger
   * tags:
   *   name: WhatsApp
   *   description: Acciones relacionadas con la gestión de las sesiones de WhatsApp.
   */

  /**
   * @swagger
   * /whatsapp/init:
   *   post:
   *     tags: [WhatsApp]
   *     summary: Inicializar la sesión de WhatsApp del administrador
   *     description: Inicia el proceso de conexión con WhatsApp para el administrador autenticado.
   *     security:
   *       - BearerAuth: []
   *     responses:
   *       200:
   *         description: Proceso de inicialización comenzado.
   *       400:
   *         description: La sesión ya está activa.
   *       409:
   *         description: Conflicto, ya hay un proceso de inicialización en curso.
   */
  router.post('/init', validateJWT, requireAdmin, whatsAppController.initialize);

  /**
   * @swagger
   * /whatsapp/logout:
   *   post:
   *     tags: [WhatsApp]
   *     summary: Cerrar la sesión de WhatsApp del administrador
   *     description: Desconecta la sesión de WhatsApp del administrador autenticado y limpia los datos.
   *     security:
   *       - BearerAuth: []
   *     responses:
   *       200:
   *         description: Sesión cerrada correctamente.
   *       404:
   *         description: No se encontró una sesión activa para cerrar.
   */
  router.post('/logout', validateJWT, requireAdmin, whatsAppController.logout);

  /**
   * GET /whatsapp/qr
   * Devuelve la última imagen QR (data URL) para el admin autenticado.
   */
  router.get('/qr', validateJWT, requireAdmin, whatsAppController.getQR);


  return router;
}

module.exports = createWhatsAppRoutes;
