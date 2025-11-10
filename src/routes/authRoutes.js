const express = require('express');
const AuthController = require('../controllers/authController');
const { validateJWT, requireAdmin } = require('../middleware/authMiddleware');

/**
 * @swagger
 * /auth/register:
 *   post:
 *     tags:
 *       - Autenticación
 *     summary: Registrar nuevo DUEÑO
 *     description: Solo los propietarios (DUEÑO) pueden registrarse. Este endpoint crea una nueva cuenta con rol ADMIN.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               nombre:
 *                 type: string
 *                 example: "Juan Pérez"
 *               email:
 *                 type: string
 *                 format: email
 *                 example: "juan@empresa.com"
 *               password:
 *                 type: string
 *                 format: password
 *                 example: "MiPassword123!"
 *                 description: "Mínimo 6 caracteres"
 *     responses:
 *       201:
 *         description: Usuario registrado exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *       400:
 *         description: Datos de entrada inválidos
 */

/**
 * @swagger
 * /auth/login:
 *   post:
 *     tags:
 *       - Autenticación
 *     summary: Iniciar sesión
 *     description: Endpoint para login de DUEÑO o EMPLEADO. Devuelve JWT tokens.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: "juan@empresa.com"
 *               password:
 *                 type: string
 *                 format: password
 *                 example: "MiPassword123!"
 *     responses:
 *       200:
 *         description: Login exitoso
 *       401:
 *         description: Email o contraseña incorrectos
 */

/**
 * @swagger
 * /auth/refresh:
 *   post:
 *     tags:
 *       - Autenticación
 *     summary: Refrescar Access Token
 *     description: Genera un nuevo Access Token usando el Refresh Token
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               refreshToken:
 *                 type: string
 *                 example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 *     responses:
 *       200:
 *         description: Token refrescado exitosamente
 *       401:
 *         description: Refresh token inválido o expirado
 */

/**
 * @swagger
 * /auth/me:
 *   get:
 *     tags:
 *       - Autenticación
 *     summary: Obtener información del usuario autenticado
 *     description: Devuelve los datos del usuario que está autenticado
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Información del usuario
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/User'
 *       401:
 *         description: Token no proporcionado o inválido
 */

/**
 * @swagger
 * /auth/logout:
 *   post:
 *     tags:
 *       - Autenticación
 *     summary: Cerrar sesión
 *     description: Revoca el refresh token y cierra la sesión
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               refreshToken:
 *                 type: string
 *                 example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 *     responses:
 *       200:
 *         description: Logout exitoso
 */

/**
 * @swagger
 * /auth/create-station:
 *   post:
 *     tags:
 *       - Estaciones de Trabajo
 *     summary: Crear estación de trabajo (ADMIN solo)
 *     description: Solo los DUEÑO (ADMIN) pueden crear empleados. Puedes proporcionar una contraseña personalizada o dejar que se genere automáticamente.
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - nombre
 *               - email
 *             properties:
 *               nombre:
 *                 type: string
 *                 example: "Carlos López"
 *               email:
 *                 type: string
 *                 format: email
 *                 example: "carlos@empresa.com"
 *               password:
 *                 type: string
 *                 format: password
 *                 example: "MiPassword123!"
 *                 description: "Opcional. Si no se proporciona, se generará automáticamente. Mínimo 6 caracteres."
 *     responses:
 *       201:
 *         description: Estación de trabajo creada exitosamente
 *       403:
 *         description: Solo administradores pueden crear estaciones
 */

/**
 * @swagger
 * /auth/employees:
 *   get:
 *     tags:
 *       - Estaciones de Trabajo
 *     summary: Obtener empleados del DUEÑO
 *     description: Lista todos los empleados creados por el DUEÑO autenticado
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de empleados
 *       403:
 *         description: Solo administradores pueden acceder
 */

/**
 * @swagger
 * /auth/employees/{id}:
 *   get:
 *     tags:
 *       - Estaciones de Trabajo
 *     summary: Obtener un empleado específico
 *     description: Obtiene la información de un empleado por su ID
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID del empleado
 *     responses:
 *       200:
 *         description: Información del empleado
 *       403:
 *         description: Solo administradores pueden acceder
 *       404:
 *         description: Empleado no encontrado
 */

/**
 * @swagger
 * /auth/employees/{id}:
 *   put:
 *     tags:
 *       - Estaciones de Trabajo
 *     summary: Actualizar un empleado
 *     description: Actualiza la información de un empleado (nombre, email y/o contraseña)
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID del empleado
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               nombre:
 *                 type: string
 *                 example: "Carlos López Actualizado"
 *               email:
 *                 type: string
 *                 format: email
 *                 example: "carlos.nuevo@empresa.com"
 *               password:
 *                 type: string
 *                 format: password
 *                 example: "NuevaPassword123!"
 *                 description: "Opcional. Mínimo 6 caracteres."
 *     responses:
 *       200:
 *         description: Empleado actualizado exitosamente
 *       403:
 *         description: Solo administradores pueden actualizar empleados
 *       404:
 *         description: Empleado no encontrado
 */

/**
 * @swagger
 * /auth/employees/{id}/reset-password:
 *   post:
 *     summary: Resetear contraseña de un empleado (solo ADMIN)
 *     tags: [Auth]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID del empleado
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               password:
 *                 type: string
 *                 format: password
 *                 example: "NuevaPassword123!"
 *                 description: "Opcional. Si no se proporciona, se genera una contraseña aleatoria. Mínimo 6 caracteres."
 *     responses:
 *       200:
 *         description: Contraseña reseteada exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       example: "9"
 *                     nombre:
 *                       type: string
 *                       example: "PC luchito"
 *                     email:
 *                       type: string
 *                       example: "leroy324"
 *                     newPassword:
 *                       type: string
 *                       example: "Abc123XyZ"
 *                       description: "Nueva contraseña en texto plano (SOLO se muestra en este endpoint)"
 *                     message:
 *                       type: string
 *                       example: "Contraseña reseteada. Guarda esta contraseña, no se mostrará nuevamente"
 *       403:
 *         description: Solo administradores pueden resetear contraseñas
 *       404:
 *         description: Empleado no encontrado
 */

function createAuthRoutes(whatsappService) {
  const router = express.Router();
  const authController = new AuthController(whatsappService);

  // ========================
  // JWT Routes (No requieren autenticación)
  // ========================
  
  router.post('/register', authController.register);
  router.post('/login', authController.login);

  // ========================
  // JWT Routes (Requieren autenticación)
  // ========================

  router.post('/refresh', validateJWT, authController.refresh);
  router.get('/me', validateJWT, authController.getMe);
  router.post('/logout', validateJWT, authController.logout);
  
  // Gestión de empleados
  router.post('/create-station', validateJWT, requireAdmin, authController.createStation);
  router.get('/employees', validateJWT, requireAdmin, authController.getEmployees);
  router.get('/employees/:id', validateJWT, requireAdmin, authController.getEmployeeById);
  router.put('/employees/:id', validateJWT, requireAdmin, authController.updateEmployee);
  router.post('/employees/:id/reset-password', validateJWT, requireAdmin, authController.resetEmployeePassword);

  // ========================
  // WhatsApp Routes (Legacy)
  // ========================

  router.get('/qr', authController.getQR);
  router.get('/status', authController.getStatus);
  router.post('/logout-whatsapp', validateJWT, authController.logoutWhatsapp);

  return router;
}

module.exports = createAuthRoutes;