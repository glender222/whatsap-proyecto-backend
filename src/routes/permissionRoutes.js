const express = require('express');
const PermissionController = require('../controllers/permissionController');
const { validateJWT, requireAdmin } = require('../middleware/authMiddleware');

const router = express.Router();
const permissionController = new PermissionController();

/**
 * @swagger
 * tags:
 *   name: Permisos
 *   description: API para gestionar permisos de chat para los empleados.
 */

// Todas las rutas en este archivo requieren que el usuario sea un ADMIN autenticado.
router.use(validateJWT, requireAdmin);

/**
 * @swagger
 * /permissions/assign:
 *   post:
 *     tags:
 *       - Permisos
 *     summary: Asignar permiso de chat a un empleado
 *     description: Otorga a un empleado acceso a un chat específico. Solo para ADMINS.
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               employeeId:
 *                 type: integer
 *                 description: ID del empleado.
 *               chatId:
 *                 type: string
 *                 description: ID del chat de WhatsApp (e.j., "5491122334455@c.us").
 *     responses:
 *       201:
 *         description: Permiso asignado correctamente.
 *       400:
 *         description: Datos inválidos.
 *       404:
 *         description: Empleado no encontrado.
 */
router.post('/assign', permissionController.assignPermission);

/**
 * @swagger
 * /permissions/revoke:
 *   post:
 *     tags:
 *       - Permisos
 *     summary: Revocar permiso de chat a un empleado
 *     description: Elimina el acceso de un empleado a un chat específico. Solo para ADMINS.
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               employeeId:
 *                 type: integer
 *                 description: ID del empleado.
 *               chatId:
 *                 type: string
 *                 description: ID del chat de WhatsApp.
 *     responses:
 *       200:
 *         description: Permiso revocado correctamente.
 *       400:
 *         description: Datos inválidos.
 */
router.post('/revoke', permissionController.revokePermission);

/**
 * @swagger
 * /permissions/employee/{employeeId}:
 *   get:
 *     tags:
 *       - Permisos
 *     summary: Listar chats asignados a un empleado
 *     description: Devuelve una lista de todos los chat_id asignados a un empleado. Solo para ADMINS.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: employeeId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Lista de permisos del empleado.
 */
router.get('/employee/:employeeId', permissionController.getEmployeePermissions);

/**
 * @swagger
 * /permissions/chat/{chatId}:
 *   get:
 *     tags:
 *       - Permisos
 *     summary: Listar empleados asignados a un chat
 *     description: Devuelve una lista de todos los empleados que tienen acceso a un chat. Solo para ADMINS.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: chatId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Lista de empleados con acceso al chat.
 */
router.get('/chat/:chatId', permissionController.getChatPermissions);

module.exports = router;
