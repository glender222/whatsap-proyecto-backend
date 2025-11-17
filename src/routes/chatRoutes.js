const express = require('express');
const multer = require('multer');
const ChatController = require('../controllers/chatController');
const TagController = require('../controllers/tagController');
const botSessionController = require('../controllers/botSessionController');
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

  /**
   * @swagger
   * /chats/{chatId}/tags:
   *   get:
   *     tags: [Chats]
   *     summary: Obtener etiquetas de un chat
   *     security:
   *       - BearerAuth: []
   *     parameters:
   *       - in: path
   *         name: chatId
   *         required: true
   *         schema: { type: string }
   *     responses:
   *       200:
   *         description: Lista de etiquetas del chat.
   */
  router.get('/:chatId/tags', TagController.getTagsByChat);

  /**
   * @swagger
   * /chats/{chatId}/sessions:
   *   get:
   *     tags: [Bot Sessions]
   *     summary: Obtener historial de sesiones de bot de un chat
   *     description: Devuelve el historial de interacciones del bot con este chat específico
   *     security:
   *       - BearerAuth: []
   *     parameters:
   *       - in: path
   *         name: chatId
   *         required: true
   *         schema: { type: string }
   *       - in: query
   *         name: limit
   *         schema: { type: integer, default: 20 }
   *     responses:
   *       200:
   *         description: Historial de sesiones del chat
   */
  router.get('/:chatId/sessions', botSessionController.getChatSessions);

  /**
   * @swagger
   * /chats/{chatId}/sessions/complete:
   *   post:
   *     tags: [Bot Sessions]
   *     summary: Completar sesión activa de un chat (finalizar atención)
   *     description: Marca la sesión activa del bot como completada, permitiendo que el bot se reactive si el cliente vuelve a escribir
   *     security:
   *       - BearerAuth: []
   *     parameters:
   *       - in: path
   *         name: chatId
   *         required: true
   *         schema: { type: string }
   *         example: "51912345678@c.us"
   *     responses:
   *       200:
   *         description: Sesión completada exitosamente
   *       404:
   *         description: No hay sesión activa para este chat
   *       403:
   *         description: No tienes permiso para modificar esta sesión
   */
  router.post('/:chatId/sessions/complete', botSessionController.completeSessionByChat);

  /**
   * @swagger
   * /chats/{chatId}/session/status:
   *   get:
   *     tags: [Bot Sessions]
   *     summary: Obtener estado actual de sesión de un chat
   *     description: Devuelve el estado de la sesión activa (pending/active) o null si no hay sesión. Útil para mostrar indicadores visuales en el frontend.
   *     security:
   *       - BearerAuth: []
   *     parameters:
   *       - in: path
   *         name: chatId
   *         required: true
   *         schema: { type: string }
   *         example: "51912345678@c.us"
   *     responses:
   *       200:
   *         description: Estado de sesión obtenido
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                 chatId:
   *                   type: string
   *                 hasActiveSession:
   *                   type: boolean
   *                 status:
   *                   type: string
   *                   enum: [pending, active, null]
   *                   nullable: true
   *                 sessionId:
   *                   type: integer
   *                   nullable: true
   *                 botId:
   *                   type: integer
   *                   nullable: true
   *                 botName:
   *                   type: string
   *                   nullable: true
   *                 tagId:
   *                   type: integer
   *                   nullable: true
   *                 tagName:
   *                   type: string
   *                   nullable: true
   *                 selectedOption:
   *                   type: integer
   *                   nullable: true
   *                 createdAt:
   *                   type: string
   *                   format: date-time
   *                   nullable: true
   */
  router.get('/:chatId/session/status', botSessionController.getSessionStatus);

  return router;
}

module.exports = createChatRoutes;
