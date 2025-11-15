const express = require('express');
const TagController = require('../controllers/tagController');
const { validateJWT } = require('../middleware/authMiddleware');
const { injectWhatsAppClient } = require('../utils/sessionUtils');

function createTagRoutes(sessionManager) {
  const router = express.Router();

  // Todas las rutas requieren autenticación
  router.use(validateJWT);
  // NOTA: No inyectamos el cliente de WhatsApp globalmente aquí porque
  // la mayoría de las rutas de etiquetas sólo interactúan con la BD
  // (crear/editar/asignar tags). Sólo las rutas que necesitan datos
  // de WhatsApp (ej. /:id/chats/full) deben usar `injectWhatsAppClient`.

// ==================== CRUD de Etiquetas ====================
/**
 * @swagger
 * /tags:
 *   post:
 *     summary: Crear una nueva etiqueta (solo ADMIN)
 *     tags: [Tags]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *             properties:
 *               name:
 *                 type: string
 *                 example: "Clientes VIP"
 *               color:
 *                 type: string
 *                 example: "#3B82F6"
 *     responses:
 *       201:
 *         description: Etiqueta creada exitosamente
 *       400:
 *         description: Datos inválidos
 *       403:
 *         description: No autorizado
 */
router.post('/', TagController.createTag);

/**
 * @swagger
 * /tags:
 *   get:
 *     summary: Obtener todas las etiquetas del usuario
 *     tags: [Tags]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de etiquetas
 */
router.get('/', TagController.getTags);

/**
 * @swagger
 * /tags/{id}:
 *   get:
 *     summary: Obtener una etiqueta por ID
 *     tags: [Tags]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Etiqueta encontrada
 *       404:
 *         description: Etiqueta no encontrada
 */
router.get('/:id', TagController.getTagById);

/**
 * @swagger
 * /tags/{id}:
 *   put:
 *     summary: Actualizar una etiqueta (solo propietario)
 *     tags: [Tags]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               color:
 *                 type: string
 *     responses:
 *       200:
 *         description: Etiqueta actualizada
 *       403:
 *         description: No autorizado
 *       404:
 *         description: Etiqueta no encontrada
 */
router.put('/:id', TagController.updateTag);

/**
 * @swagger
 * /tags/{id}:
 *   delete:
 *     summary: Eliminar una etiqueta (solo propietario)
 *     tags: [Tags]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Etiqueta eliminada
 *       403:
 *         description: No autorizado
 *       404:
 *         description: Etiqueta no encontrada
 */
router.delete('/:id', TagController.deleteTag);

// ==================== Gestión de Empleados ====================
/**
 * @swagger
 * /tags/{id}/users:
 *   post:
 *     summary: Asignar etiqueta a un empleado (solo ADMIN propietario)
 *     tags: [Tags]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - employeeId
 *             properties:
 *               employeeId:
 *                 type: integer
 *     responses:
 *       201:
 *         description: Etiqueta asignada al empleado
 *       400:
 *         description: Datos inválidos
 *       403:
 *         description: No autorizado
 */
router.post('/:id/users', TagController.assignTagToEmployee);

/**
 * @swagger
 * /tags/{id}/users/{employeeId}:
 *   delete:
 *     summary: Quitar etiqueta de un empleado (solo ADMIN propietario)
 *     tags: [Tags]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *       - in: path
 *         name: employeeId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Etiqueta removida del empleado
 *       403:
 *         description: No autorizado
 *       404:
 *         description: Relación no encontrada
 */
router.delete('/:id/users/:employeeId', TagController.removeTagFromEmployee);

/**
 * @swagger
 * /tags/{id}/users:
 *   get:
 *     summary: Obtener empleados con acceso a una etiqueta
 *     tags: [Tags]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Lista de empleados con acceso
 */
router.get('/:id/users', TagController.getEmployeesWithAccess);

// ==================== Gestión de Chats ====================
/**
 * @swagger
 * /tags/{id}/chats:
 *   post:
 *     summary: Asignar chat a una etiqueta
 *     tags: [Tags]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - chatId
 *             properties:
 *               chatId:
 *                 type: string
 *                 example: "573001234567@c.us"
 *     responses:
 *       201:
 *         description: Chat asignado a la etiqueta
 *       400:
 *         description: Datos inválidos
 */
router.post('/:id/chats', TagController.assignChatToTag);

/**
 * @swagger
 * /tags/{id}/chats/{chatId}:
 *   delete:
 *     summary: Remover chat de una etiqueta
 *     tags: [Tags]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *       - in: path
 *         name: chatId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Chat removido de la etiqueta
 *       404:
 *         description: Relación no encontrada
 */
router.delete('/:id/chats/:chatId', TagController.removeChatFromTag);

/**
 * @swagger
 * /tags/{id}/chats:
 *   get:
 *     summary: Obtener chats de una etiqueta (solo IDs)
 *     tags: [Tags]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Lista de IDs de chats de la etiqueta
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       chat_id:
 *                         type: string
 *                       assigned_by:
 *                         type: string
 *                       created_at:
 *                         type: string
 */
router.get('/:id/chats', TagController.getChatsByTag);

/**
 * @swagger
 * /tags/{id}/chats/full:
 *   get:
 *     summary: Obtener chats completos de una etiqueta (con datos de WhatsApp)
 *     description: |
 *       Retorna los chats completos con toda la información de WhatsApp.
 *       - Si es la etiqueta "Todo", retorna todos los chats.
 *       - Para otras etiquetas, retorna solo los chats asignados a esa etiqueta.
 *     tags: [Tags]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID de la etiqueta
 *     responses:
 *       200:
 *         description: Lista de chats completos con información de WhatsApp
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                         example: "51913739833@c.us"
 *                       name:
 *                         type: string
 *                         example: "+51 913 739 833"
 *                       lastMessageTimestamp:
 *                         type: number
 *                         example: 1761311348
 *                       unreadCount:
 *                         type: number
 *                         example: 0
 *                       isGroup:
 *                         type: boolean
 *                         example: false
 *                       lastMessagePreview:
 *                         type: string
 *                         example: "[Media]"
 *                 tag:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                       example: 2
 *                     name:
 *                       type: string
 *                       example: "Clientes VIP"
 *                     is_default:
 *                       type: boolean
 *                       example: false
 *       404:
 *         description: Etiqueta no encontrada o sin acceso
 */
// Esta ruta necesita el cliente de WhatsApp en `req.whatsappClient`.
router.get('/:id/chats/full', injectWhatsAppClient(sessionManager), TagController.getFullChatsByTag);

// ==================== Estadísticas ====================
/**
 * @swagger
 * /tags/{id}/stats:
 *   get:
 *     summary: Obtener estadísticas de una etiqueta
 *     tags: [Tags]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Estadísticas de la etiqueta
 */
  router.get('/:id/stats', TagController.getTagStats);

  return router;
}

module.exports = createTagRoutes;
