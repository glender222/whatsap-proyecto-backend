const express = require('express');
const MediaController = require('../controllers/mediaController');
const { validateJWT } = require('../middleware/authMiddleware');
const { injectWhatsAppClient } = require('../utils/sessionUtils');

/**
 * @swagger
 * tags:
 *   name: Media
 *   description: API para descargar archivos multimedia y fotos de perfil.
 */

module.exports = (sessionManager) => { // Recibe sessionManager
  const router = express.Router();
  const controller = new MediaController(); // Sin dependencias

  // 1. Validar JWT
  router.use(validateJWT);
  // 2. Inyectar el cliente de WhatsApp correcto
  router.use(injectWhatsAppClient(sessionManager));

  /**
   * @swagger
   * /media/{messageId}:
   *   get:
   *     tags: [Media]
   *     summary: Descargar archivo multimedia
   *     description: Descarga el archivo de un mensaje. Los empleados solo pueden descargar media de chats asignados.
   *     security:
   *       - BearerAuth: []
   *     parameters:
   *       - in: path
   *         name: messageId
   *         required: true
   *         schema: { type: string }
   *     responses:
   *       200:
   *         description: El archivo multimedia.
   *       403:
   *         description: Acceso denegado.
   *       404:
   *         description: Mensaje no encontrado.
   *       503:
   *         description: Sesión de WhatsApp no activa.
   */
  router.get('/:messageId', controller.downloadMedia);

  /**
   * @swagger
   * /media/profile-photo/{chatId}:
   *   get:
   *     tags: [Media]
   *     summary: Obtener foto de perfil
   *     description: Devuelve la URL de la foto de perfil. Los empleados solo pueden ver fotos de chats asignados.
   *     security:
   *       - BearerAuth: []
   *     parameters:
   *       - in: path
   *         name: chatId
   *         required: true
   *         schema: { type: string }
   *     responses:
   *       200:
   *         description: URL de la foto de perfil.
   *       403:
   *         description: Acceso denegado.
   *       404:
   *         description: Foto no encontrada.
   *       503:
   *         description: Sesión de WhatsApp no activa.
   */
  router.get('/profile-photo/:chatId', controller.getProfilePhoto);

  return router;
};
