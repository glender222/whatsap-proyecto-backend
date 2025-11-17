const express = require('express');
const router = express.Router();
const botController = require('../controllers/botController');
const botRuleController = require('../controllers/botRuleController');
const { validateJWT } = require('../middleware/authMiddleware');

/**
 * @swagger
 * components:
 *   schemas:
 *     Bot:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *         name:
 *           type: string
 *         owner_id:
 *           type: integer
 *         is_active:
 *           type: boolean
 *         strategy:
 *           type: string
 *           enum: [round_robin, random, priority]
 *         modality:
 *           type: string
 *           enum: [options, keywords]
 *         welcome_message:
 *           type: string
 *         created_at:
 *           type: string
 *           format: date-time
 *         updated_at:
 *           type: string
 *           format: date-time
 *     BotRule:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *         bot_id:
 *           type: integer
 *         type:
 *           type: string
 *           enum: [option, keyword]
 *         order:
 *           type: integer
 *           nullable: true
 *         text:
 *           type: string
 *         group_name:
 *           type: string
 *           nullable: true
 *         tag_id:
 *           type: integer
 *         is_active:
 *           type: boolean
 *         created_at:
 *           type: string
 *           format: date-time
 *         updated_at:
 *           type: string
 *           format: date-time
 */

// ===== BOTS ENDPOINTS =====

/**
 * @swagger
 * /bots:
 *   post:
 *     summary: Crear un nuevo bot
 *     tags: [Bots]
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
 *                 example: "Soporte Técnico"
 *               strategy:
 *                 type: string
 *                 enum: [round_robin, random, priority]
 *                 default: round_robin
 *               modality:
 *                 type: string
 *                 enum: [options, keywords]
 *                 default: options
 *               welcome_message:
 *                 type: string
 *                 example: "¡Bienvenido! Selecciona una opción:"
 *     responses:
 *       201:
 *         description: Bot creado exitosamente
 *       400:
 *         description: Validación fallida
 */
router.post('/', validateJWT, botController.createBot);

/**
 * @swagger
 * /bots:
 *   get:
 *     summary: Obtener todos los bots del admin
 *     tags: [Bots]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de bots
 */
router.get('/', validateJWT, botController.getBots);

/**
 * @swagger
 * /bots/{id}:
 *   get:
 *     summary: Obtener un bot por ID
 *     tags: [Bots]
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
 *         description: Bot encontrado
 *       404:
 *         description: Bot no encontrado
 */
router.get('/:id', validateJWT, botController.getBotById);

/**
 * @swagger
 * /bots/{id}:
 *   put:
 *     summary: Actualizar un bot
 *     tags: [Bots]
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
 *               is_active:
 *                 type: boolean
 *               strategy:
 *                 type: string
 *                 enum: [round_robin, random, priority]
 *               modality:
 *                 type: string
 *                 enum: [options, keywords]
 *               welcome_message:
 *                 type: string
 *     responses:
 *       200:
 *         description: Bot actualizado
 */
router.put('/:id', validateJWT, botController.updateBot);

/**
 * @swagger
 * /bots/{id}:
 *   delete:
 *     summary: Eliminar un bot
 *     tags: [Bots]
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
 *         description: Bot eliminado
 */
router.delete('/:id', validateJWT, botController.deleteBot);

/**
 * @swagger
 * /bots/{id}/tags:
 *   post:
 *     summary: Asignar tags al bot
 *     tags: [Bots]
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
 *               - tagIds
 *             properties:
 *               tagIds:
 *                 type: array
 *                 items:
 *                   type: integer
 *     responses:
 *       200:
 *         description: Tags asignados
 */
router.post('/:id/tags', validateJWT, botController.assignTags);

/**
 * @swagger
 * /bots/{id}/tags/{tagId}:
 *   delete:
 *     summary: Remover un tag del bot
 *     tags: [Bots]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *       - in: path
 *         name: tagId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Tag removido
 */
router.delete('/:id/tags/:tagId', validateJWT, botController.removeTag);

/**
 * @swagger
 * /bots/{id}/stats:
 *   get:
 *     summary: Obtener estadísticas del bot
 *     tags: [Bots]
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
 *         description: Estadísticas obtenidas
 */
router.get('/:id/stats', validateJWT, botController.getBotStats);

// ===== BOT RULES ENDPOINTS =====
// IMPORTANTE: El orden de las rutas importa en Express.
// Las rutas más específicas deben ir ANTES que las genéricas con parámetros.
// Por eso /rules/process, /rules/menu, etc. van antes que /rules/:ruleId

/**
 * @swagger
 * /bots/{botId}/rules/process:
 *   post:
 *     summary: Procesar un mensaje según las reglas del bot (SIN AUTENTICACIÓN)
 *     tags: [Bot Rules - Public]
 *     security: []
 *     parameters:
 *       - in: path
 *         name: botId
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
 *               - message
 *             properties:
 *               message:
 *                 type: string
 *                 example: "1"
 *     responses:
 *       200:
 *         description: Mensaje procesado exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 botId:
 *                   type: integer
 *                 botName:
 *                   type: string
 *                 modality:
 *                   type: string
 *                   enum: [options, keywords]
 *                 message:
 *                   type: string
 *                 matched:
 *                   type: boolean
 *                 ruleId:
 *                   type: integer
 *                   nullable: true
 *                 tagId:
 *                   type: integer
 *                   nullable: true
 *                 error:
 *                   type: string
 *                   nullable: true
 *                 rule:
 *                   $ref: '#/components/schemas/BotRule'
 *                   nullable: true
 */
router.post('/:botId/rules/process', botRuleController.processMessage);

/**
 * @swagger
 * /bots/{botId}/rules/menu:
 *   get:
 *     summary: Obtener menú de opciones (SIN AUTENTICACIÓN)
 *     tags: [Bot Rules - Public]
 *     security: []
 *     parameters:
 *       - in: path
 *         name: botId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Menú obtenido exitosamente
 */
router.get('/:botId/rules/menu', botRuleController.getMenu);

/**
 * @swagger
 * /bots/{botId}/rules/keywords/reference:
 *   get:
 *     summary: Obtener referencia de palabras clave (SIN AUTENTICACIÓN)
 *     tags: [Bot Rules - Public]
 *     security: []
 *     parameters:
 *       - in: path
 *         name: botId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Referencia de palabras clave obtenida
 */
router.get('/:botId/rules/keywords/reference', botRuleController.getKeywordReference);

/**
 * @swagger
 * /bots/{botId}/rules/stats:
 *   get:
 *     summary: Obtener estadísticas de reglas del bot
 *     tags: [Bot Rules]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: botId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Estadísticas obtenidas
 */
router.get('/:botId/rules/stats', validateJWT, botRuleController.getStats);

/**
 * @swagger
 * /bots/{botId}/rules/reorder:
 *   put:
 *     summary: Reordenar opciones en bulk
 *     tags: [Bot Rules]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: botId
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
 *               - rules
 *             properties:
 *               rules:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required:
 *                     - id
 *                     - order
 *                   properties:
 *                     id:
 *                       type: integer
 *                     order:
 *                       type: integer
 *     responses:
 *       200:
 *         description: Opciones reordenadas exitosamente
 */
router.put('/:botId/rules/reorder', validateJWT, botRuleController.reorderOptions);

/**
 * @swagger
 * /bots/{botId}/rules:
 *   get:
 *     summary: Listar todas las reglas de un bot
 *     tags: [Bot Rules]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: botId
 *         required: true
 *         schema:
 *           type: integer
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [option, keyword]
 *         description: Filtrar por tipo de regla
 *     responses:
 *       200:
 *         description: Lista de reglas del bot
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 botId:
 *                   type: integer
 *                 botModality:
 *                   type: string
 *                   enum: [options, keywords]
 *                 rulesCount:
 *                   type: integer
 *                 rules:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/BotRule'
 */
router.get('/:botId/rules', validateJWT, botRuleController.listRules);

/**
 * @swagger
 * /bots/{botId}/rules:
 *   post:
 *     summary: Crear una nueva regla
 *     tags: [Bot Rules]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: botId
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
 *               - type
 *               - text
 *             properties:
 *               type:
 *                 type: string
 *                 enum: [option, keyword]
 *                 example: "option"
 *               text:
 *                 type: string
 *                 example: "1. Ventas"
 *               tagId:
 *                 type: integer
 *                 nullable: true
 *                 description: ID del tag destino (opcional)
 *                 example: null
 *               order:
 *                 type: integer
 *                 description: Requerido si type='option'
 *                 example: 1
 *               groupName:
 *                 type: string
 *                 nullable: true
 *                 description: Requerido si type='keyword'
 *                 example: "Consultas"
 *     responses:
 *       201:
 *         description: Regla creada exitosamente
 *       400:
 *         description: Validación fallida
 *       409:
 *         description: Conflicto (orden duplicado)
 */
router.post('/:botId/rules', validateJWT, botRuleController.createRule);

/**
 * @swagger
 * /bots/{botId}/rules/{ruleId}:
 *   get:
 *     summary: Obtener una regla específica
 *     tags: [Bot Rules]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: botId
 *         required: true
 *         schema:
 *           type: integer
 *       - in: path
 *         name: ruleId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Regla encontrada
 *       404:
 *         description: Regla no encontrada
 */
router.get('/:botId/rules/:ruleId', validateJWT, botRuleController.getRule);

/**
 * @swagger
 * /bots/{botId}/rules/{ruleId}:
 *   put:
 *     summary: Actualizar una regla
 *     tags: [Bot Rules]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: botId
 *         required: true
 *         schema:
 *           type: integer
 *       - in: path
 *         name: ruleId
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               text:
 *                 type: string
 *               tag_id:
 *                 type: integer
 *               order:
 *                 type: integer
 *               group_name:
 *                 type: string
 *               is_active:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Regla actualizada
 */
router.put('/:botId/rules/:ruleId', validateJWT, botRuleController.updateRule);

/**
 * @swagger
 * /bots/{botId}/rules/{ruleId}:
 *   delete:
 *     summary: Eliminar una regla (soft delete)
 *     tags: [Bot Rules]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: botId
 *         required: true
 *         schema:
 *           type: integer
 *       - in: path
 *         name: ruleId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Regla eliminada
 */
router.delete('/:botId/rules/:ruleId', validateJWT, botRuleController.deleteRule);

// ===== BOT SESSIONS ENDPOINTS =====

const botSessionController = require('../controllers/botSessionController');

/**
 * @swagger
 * /bots/{botId}/stats:
 *   get:
 *     summary: Obtener estadísticas de un bot
 *     tags: [Bot Sessions]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: botId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Estadísticas del bot
 */
router.get('/:botId/stats', validateJWT, botSessionController.getBotStats);

/**
 * @swagger
 * /bots/{botId}/sessions:
 *   get:
 *     summary: Obtener sesiones de un bot
 *     tags: [Bot Sessions]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: botId
 *         required: true
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *     responses:
 *       200:
 *         description: Lista de sesiones
 */
router.get('/:botId/sessions', validateJWT, botSessionController.getBotSessions);

/**
 * @swagger
 * /bots/{botId}/sessions/reset:
 *   post:
 *     summary: Resetear sesión de un chat (forzar completado)
 *     tags: [Bot Sessions]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: botId
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               chatId:
 *                 type: string
 *                 example: "51912345678@c.us"
 *     responses:
 *       200:
 *         description: Sesión reseteada
 */
router.post('/:botId/sessions/reset', validateJWT, botSessionController.resetChatSession);

module.exports = router;
