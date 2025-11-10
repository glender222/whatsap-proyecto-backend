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

  /**
   * @swagger
   * /media/test-profile-photo:
   *   get:
   *     tags: [Media]
   *     summary: Test endpoint - Siempre devuelve null
   *     description: Endpoint de prueba para verificar que el frontend puede manejar respuestas 200 con null.
   *     security:
   *       - BearerAuth: []
   *     responses:
   *       200:
   *         description: Respuesta de prueba con profilePhotoUrl null.
   */
  router.get('/test-profile-photo', (req, res) => {
    console.log('🧪 [TEST] Endpoint de prueba llamado');
    const response = { 
      success: true, 
      data: { 
        profilePhotoUrl: null,
        reason: 'test_endpoint' 
      } 
    };
    console.log('🧪 [TEST] Respuesta:', JSON.stringify(response));
    res.status(200).json(response);
  });

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
   * /media/file/{filename}:
   *   get:
   *     tags: [Media]
   *     summary: Descargar archivo directo (con autenticación)
   *     description: |
   *       Sirve archivos multimedia con validación de acceso.
   *       - Para ADMIN: puede descargar cualquier archivo
   *       - Para EMPLEADO: solo archivos de chats asignados
   *       
   *       Útil para PDFs, documentos y otros archivos que necesitan validación de acceso.
   *     security:
   *       - BearerAuth: []
   *     parameters:
   *       - in: path
   *         name: filename
   *         required: true
   *         schema: { type: string }
   *         description: Nombre del archivo (URL encoded)
   *         example: "false_51925593795@c.us_3F9DA6CA293062239189"
   *     responses:
   *       200:
   *         description: El archivo multimedia
   *       403:
   *         description: Acceso denegado.
   *       404:
   *         description: Archivo no encontrado.
   *       500:
   *         description: Error al descargar.
   */
  router.get('/file/:filename', controller.serveFile);

  return router;
};
