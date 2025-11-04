const express = require('express');
const multer = require('multer');
const ChatController = require('../controllers/chatController');
const config = require('../config');
const { validateJWT } = require('../middleware/authMiddleware');
const { injectWhatsAppClient } = require('../utils/sessionUtils');

/**
 * @swagger
 * tags:
 *   name: Chats
 *   description: API para interactuar con los chats de WhatsApp.
 */

function createChatRoutes(sessionManager) { // Recibe sessionManager
  const router = express.Router();
  const chatController = new ChatController(); // Ya no necesita dependencias
  
  const upload = multer({ 
    dest: config.multer.dest,
    limits: {
      fileSize: config.multer.maxFileSize
    }
  });

  // 1. Validar JWT para saber quién es el usuario
  router.use(validateJWT);
  // 2. Inyectar el cliente de WhatsApp correcto para ese usuario
  router.use(injectWhatsAppClient(sessionManager));

  // A partir de aquí, todas las rutas tienen req.user y req.whatsappClient disponibles

  /**
   * @swagger
   * /chats:
   *   get:
   *     tags: [Chats]
   *     summary: Obtener lista de chats
   *     description: Devuelve la lista de chats de la sesión de WhatsApp conectada. Para los empleados, esta lista se filtra automáticamente.
   *     security:
   *       - BearerAuth: []
   *     responses:
   *       200:
   *         description: Lista de chats obtenida.
   *       503:
   *         description: La sesión de WhatsApp para esta organización no está activa.
   */
  router.get('/', chatController.getChats);

  /**
   * @swagger
   * /chats/{chatId}/messages:
   *   get:
   *     tags: [Chats]
   *     summary: Obtener mensajes de un chat
   *     description: Devuelve los mensajes de un chat específico. Restringido para empleados.
   *     security:
   *       - BearerAuth: []
   *     parameters:
   *       - in: path
   *         name: chatId
   *         required: true
   *         schema: { type: string }
   *       - in: query
   *         name: limit
   *         schema: { type: integer, default: 50 }
   *     responses:
   *       200:
   *         description: Mensajes obtenidos.
   *       403:
   *         description: Acceso denegado.
   *       503:
   *         description: Sesión de WhatsApp no activa.
   */
  router.get('/:chatId/messages', chatController.getMessages);

  /**
   * @swagger
   * /chats/{chatId}/messages:
   *   post:
   *     tags: [Chats]
   *     summary: Enviar un mensaje
   *     description: Envía un mensaje a un chat. Restringido para empleados.
   *     security:
   *       - BearerAuth: []
   *     parameters:
   *       - in: path
   *         name: chatId
   *         required: true
   *         schema: { type: string }
   *     requestBody:
   *       content:
   *         multipart/form-data:
   *           schema:
   *             type: object
   *             properties:
   *               message: { type: string }
   *               file: { type: string, format: binary }
   *     responses:
   *       200:
   *         description: Mensaje enviado.
   *       403:
   *         description: Acceso denegado.
   *       503:
   *         description: Sesión de WhatsApp no activa.
   */
  router.post('/:chatId/messages', upload.single("file"), chatController.sendMessage);

  /**
   * @swagger
   * /chats/{chatId}/read:
   *   put:
   *     tags: [Chats]
   *     summary: Marcar chat como leído
   *     security:
   *       - BearerAuth: []
   *     parameters:
   *       - in: path
   *         name: chatId
   *         required: true
   *         schema: { type: string }
   *     responses:
   *       200:
   *         description: Chat marcado como leído.
   *       503:
   *         description: Sesión de WhatsApp no activa.
   */
  router.put('/:chatId/read', chatController.markAsRead);

  return router;
}

module.exports = createChatRoutes;
