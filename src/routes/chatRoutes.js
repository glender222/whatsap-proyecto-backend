const express = require('express');
const multer = require('multer');
const ChatController = require('../controllers/chatController');
const config = require('../config');
const { validateJWT } = require('../middleware/authMiddleware');

/**
 * @swagger
 * tags:
 *   name: Chats
 *   description: API para interactuar con los chats de WhatsApp.
 */

function createChatRoutes(whatsappService) {
  const router = express.Router();
  const chatController = new ChatController(whatsappService);
  
  const upload = multer({ 
    dest: config.multer.dest,
    limits: {
      fileSize: config.multer.maxFileSize
    }
  });

  // Todas las rutas de chats requieren autenticación
  router.use(validateJWT);

  /**
   * @swagger
   * /chats:
   *   get:
   *     tags: [Chats]
   *     summary: Obtener lista de chats
   *     description: Devuelve la lista de chats de la sesión de WhatsApp conectada. Para los empleados, esta lista se filtra automáticamente para mostrar solo los chats asignados.
   *     security:
   *       - BearerAuth: []
   *     responses:
   *       200:
   *         description: Lista de chats obtenida correctamente.
   *       401:
   *         description: No autenticado.
   */
  router.get('/', chatController.getChats);

  /**
   * @swagger
   * /chats/{chatId}/messages:
   *   get:
   *     tags: [Chats]
   *     summary: Obtener mensajes de un chat
   *     description: Devuelve los mensajes de un chat específico. Los empleados solo pueden acceder a los chats que tienen asignados.
   *     security:
   *       - BearerAuth: []
   *     parameters:
   *       - in: path
   *         name: chatId
   *         required: true
   *         schema:
   *           type: string
   *         description: El ID del chat de WhatsApp (e.g., "5491122334455@c.us").
   *       - in: query
   *         name: limit
   *         schema:
   *           type: integer
   *           default: 50
   *         description: Número máximo de mensajes a devolver.
   *     responses:
   *       200:
   *         description: Mensajes obtenidos correctamente.
   *       401:
   *         description: No autenticado.
   *       403:
   *         description: Acceso denegado (si un empleado intenta acceder a un chat no asignado).
   */
  router.get('/:chatId/messages', chatController.getMessages);

  /**
   * @swagger
   * /chats/{chatId}/messages:
   *   post:
   *     tags: [Chats]
   *     summary: Enviar un mensaje a un chat
   *     description: Envía un mensaje de texto o un archivo multimedia a un chat específico. Los empleados solo pueden enviar mensajes a los chats que tienen asignados.
   *     security:
   *       - BearerAuth: []
   *     parameters:
   *       - in: path
   *         name: chatId
   *         required: true
   *         schema:
   *           type: string
   *         description: El ID del chat de WhatsApp.
   *     requestBody:
   *       content:
   *         multipart/form-data:
   *           schema:
   *             type: object
   *             properties:
   *               message:
   *                 type: string
   *                 description: El texto del mensaje (opcional si se envía un archivo).
   *               file:
   *                 type: string
   *                 format: binary
   *                 description: El archivo a enviar (imagen, video, documento, etc.).
   *     responses:
   *       200:
   *         description: Mensaje enviado correctamente.
   *       401:
   *         description: No autenticado.
   *       403:
   *         description: Acceso denegado.
   */
  router.post('/:chatId/messages', upload.single("file"), chatController.sendMessage);

  /**
   * @swagger
   * /chats/{chatId}/read:
   *   put:
   *     tags: [Chats]
   *     summary: Marcar chat como leído
   *     description: Marca todos los mensajes de un chat como leídos.
   *     security:
   *       - BearerAuth: []
   *     parameters:
   *       - in: path
   *         name: chatId
   *         required: true
   *         schema:
   *           type: string
   *         description: El ID del chat a marcar como leído.
   *     responses:
   *       200:
   *         description: Chat marcado como leído.
   *       401:
   *         description: No autenticado.
   */
  router.put('/:chatId/read', chatController.markAsRead);

  return router;
}

module.exports = createChatRoutes;
