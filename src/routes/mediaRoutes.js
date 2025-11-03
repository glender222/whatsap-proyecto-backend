const express = require('express');
const multer = require('multer');
const upload = multer({ dest: 'tmp_uploads/' });
const MediaController = require('../controllers/mediaController');
const { validateJWT } = require('../middleware/authMiddleware');

/**
 * @swagger
 * tags:
 *   name: Media
 *   description: API para descargar archivos multimedia y fotos de perfil.
 */

module.exports = (whatsappService) => {
  const router = express.Router();
  const controller = new MediaController(whatsappService);

  // Todas las rutas de media requieren autenticación
  router.use(validateJWT);

  /**
   * @swagger
   * /media/{messageId}:
   *   get:
   *     tags: [Media]
   *     summary: Descargar archivo multimedia
   *     description: Descarga el archivo multimedia (imagen, video, audio, documento) de un mensaje específico.
   *     security:
   *       - BearerAuth: []
   *     parameters:
   *       - in: path
   *         name: messageId
   *         required: true
   *         schema:
   *           type: string
   *         description: El ID del mensaje que contiene el archivo.
   *     responses:
   *       200:
   *         description: El archivo multimedia.
   *         content:
   *           application/octet-stream:
   *             schema:
   *               type: string
   *               format: binary
   *       401:
   *         description: No autenticado.
   *       404:
   *         description: Mensaje no encontrado o sin multimedia.
   */
  router.get('/:messageId', controller.downloadMedia);

  /**
   * @swagger
   * /media/profile-photo/{chatId}:
   *   get:
   *     tags: [Media]
   *     summary: Obtener foto de perfil
   *     description: Devuelve la URL de la foto de perfil de un contacto o grupo.
   *     security:
   *       - BearerAuth: []
   *     parameters:
   *       - in: path
   *         name: chatId
   *         required: true
   *         schema:
   *           type: string
   *         description: El ID del chat (contacto o grupo).
   *     responses:
   *       200:
   *         description: URL de la foto de perfil.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 profilePhotoUrl:
   *                   type: string
   *                   example: "https://pps.whatsapp.net/..."
   *       401:
   *         description: No autenticado.
   *       404:
   *         description: Foto de perfil no encontrada.
   */
  router.get('/profile-photo/:chatId', controller.getProfilePhoto);

  // Las rutas adicionales en mediaController no parecen estar expuestas en este archivo de rutas,
  // por lo que solo se documentan las que están activas.

  return router;
};
