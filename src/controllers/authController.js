const { asyncHandler } = require('../middleware/errorHandler');
const AuthService = require('../services/authService');
const User = require('../models/User');
const { verifyToken } = require('../utils/jwt');

class AuthController {
  constructor(whatsappService) {
    this.whatsappService = whatsappService;
  }

  // ========================
  // Legacy endpoints (WhatsApp)
  // ========================

  getQRLegacy = asyncHandler(async (req, res) => {
    const qr = this.whatsappService.getQR();
    res.json({ qr: qr || null });
  });

  getStatusLegacy = asyncHandler(async (req, res) => {
    const status = this.whatsappService.getStatus();
    res.json(status);
  });

  getMeLegacy = asyncHandler(async (req, res) => {
    const info = this.whatsappService.getMyInfo();
    
    if (!info) {
      return res.status(503).json({ error: "No disponible aún" });
    }
    
    res.json(info);
  });

  logoutLegacy = asyncHandler(async (req, res) => {
    console.log("🔴 Iniciando cierre de sesión...");
    
    await this.whatsappService.logout();
    
    console.log("Sesión cerrada exitosamente - Dispositivo desvinculado");
    res.json({ 
      success: true, 
      message: "Sesión cerrada exitosamente - Dispositivo desvinculado de WhatsApp" 
    });
  });

  // ========================
  // New JWT endpoints
  // ========================

  /**
   * POST /api/auth/register - Registrar nuevo DUEÑO
   */
  register = asyncHandler(async (req, res) => {
    const { nombre, email, password } = req.body;

    const result = await AuthService.register(nombre, email, password);

    res.status(201).json({
      success: true,
      message: 'Usuario registrado exitosamente',
      data: result
    });
  });

  /**
   * POST /api/auth/login - Login
   */
  login = asyncHandler(async (req, res) => {
    const { email, password } = req.body;

    const result = await AuthService.login(email, password);

    res.json({
      success: true,
      message: 'Login exitoso',
      data: result
    });
  });

  /**
   * POST /api/auth/refresh - Refrescar token
   */
  refresh = asyncHandler(async (req, res) => {
    const { refreshToken } = req.body;
    const userId = req.user.userId;

    if (!refreshToken) {
      return res.status(400).json({
        success: false,
        error: 'Refresh token requerido'
      });
    }

    const result = await AuthService.refreshAccessToken(refreshToken, userId);

    res.json({
      success: true,
      data: result
    });
  });

  /**
   * GET /api/auth/me - Obtener usuario autenticado
   */
  getMe = asyncHandler(async (req, res) => {
    const user = await User.findById(req.user.userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'Usuario no encontrado'
      });
    }

    // Determinar el número de WhatsApp a mostrar.
    // Prioridad:
    // 1) Si el propio usuario tiene la columna whatsapp_number en BD, usarla.
    // 2) Si el usuario es EMPLEADO, buscar el dueño (id_padre) y usar su whatsapp_number si existe.
    // 3) Si no existe persistencia, intentar obtenerlo desde la sesión en memoria (SessionManager).
    try {
      // 1) Si ya viene en el registro del usuario
      if (user.whatsapp_number) {
        user.whatsappNumber = user.whatsapp_number;
      } else if (user.rol === 'EMPLEADO' && user.id_padre) {
        // 2) Intentar obtener del dueño
        try {
          const owner = await User.findById(user.id_padre);
          if (owner && owner.whatsapp_number) {
            user.whatsappNumber = owner.whatsapp_number;
          } else {
            // 3) Intentar leer desde la sesión en memoria del dueño
            if (this.whatsappService && typeof this.whatsappService.getSession === 'function') {
              const client = this.whatsappService.getSession(user.id_padre);
              if (client && typeof client.getMyInfo === 'function') {
                const info = client.getMyInfo();
                if (info) user.whatsappNumber = info.user || (info.id && info.id.split('@')[0]);
              }
            }
          }
        } catch (ownerErr) {
          console.warn('No se pudo obtener el dueño o su whatsapp_number:', ownerErr.message);
        }
      } else {
        // Usuario es ADMIN o no tiene id_padre: intentar sesión propia
        if (this.whatsappService && typeof this.whatsappService.getSession === 'function') {
          const client = this.whatsappService.getSession(req.user.userId);
          if (client && typeof client.getMyInfo === 'function') {
            const info = client.getMyInfo();
            if (info) user.whatsappNumber = info.user || (info.id && info.id.split('@')[0]);
          }
        }
      }
    } catch (err) {
      console.warn('No se pudo obtener el número de WhatsApp para el usuario:', err.message);
    }

    res.json({
      success: true,
      data: user
    });
  });

  /**
   * POST /api/auth/logout - Logout
   */
  logout = asyncHandler(async (req, res) => {
    const { refreshToken } = req.body;

    await AuthService.logout(refreshToken);

    res.json({
      success: true,
      message: 'Logout exitoso'
    });
  });

  /**
   * POST /api/auth/create-station - Crear estación de trabajo (ADMIN)
   */
  createStation = asyncHandler(async (req, res) => {
    const { nombre, email, password } = req.body;

    // Solo ADMIN puede crear empleados
    if (req.user.rol !== 'ADMIN') {
      return res.status(403).json({
        success: false,
        error: 'Solo administradores pueden crear estaciones'
      });
    }

    const result = await AuthService.createStation(req.user.userId, nombre, email, password);

    res.status(201).json({
      success: true,
      message: 'Estación de trabajo creada exitosamente',
      data: result
    });
  });

  /**
   * GET /api/auth/employees - Obtener empleados del dueño
   */
  getEmployees = asyncHandler(async (req, res) => {
    if (req.user.rol !== 'ADMIN') {
      return res.status(403).json({
        success: false,
        error: 'Solo administradores pueden acceder'
      });
    }

    const employees = await User.findEmployeesByOwner(req.user.userId);

    res.json({
      success: true,
      data: employees
    });
  });

  /**
   * PUT /api/auth/employees/:id - Actualizar empleado (ADMIN)
   */
  updateEmployee = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { nombre, email, password } = req.body;

    // Solo ADMIN puede actualizar empleados
    if (req.user.rol !== 'ADMIN') {
      return res.status(403).json({
        success: false,
        error: 'Solo administradores pueden actualizar empleados'
      });
    }

    const updatedEmployee = await AuthService.updateEmployee(
      req.user.userId, 
      id, 
      { nombre, email, password }
    );

    res.json({
      success: true,
      message: 'Empleado actualizado exitosamente',
      data: updatedEmployee
    });
  });

  /**
   * GET /api/auth/employees/:id - Obtener un empleado específico (ADMIN)
   */
  getEmployeeById = asyncHandler(async (req, res) => {
    const { id } = req.params;

    // Solo ADMIN puede ver empleados
    if (req.user.rol !== 'ADMIN') {
      return res.status(403).json({
        success: false,
        error: 'Solo administradores pueden acceder'
      });
    }

    const employee = await User.findById(id);

    if (!employee) {
      return res.status(404).json({
        success: false,
        error: 'Empleado no encontrado'
      });
    }

    // Verificar que el empleado pertenece al admin
    if (employee.id_padre !== req.user.userId) {
      return res.status(403).json({
        success: false,
        error: 'No tienes permiso para ver este empleado'
      });
    }

    res.json({
      success: true,
      data: employee
    });
  });

  /**
   * Resetear contraseña de empleado (solo ADMIN)
   */
  resetEmployeePassword = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { password } = req.body;

    const result = await AuthService.resetEmployeePassword(
      req.user.userId,
      id,
      password || null
    );

    res.json({
      success: true,
      data: result
    });
  });

  // ========================
  // API endpoints (nuevos)
  // ========================

  getQR = asyncHandler(async (req, res) => {
    const qr = this.whatsappService.getQR();
    res.json({ qr: qr || null });
  });

  getStatus = asyncHandler(async (req, res) => {
    const status = this.whatsappService.getStatus();
    res.json(status);
  });

  logoutWhatsapp = asyncHandler(async (req, res) => {
    console.log("🔴 Iniciando cierre de sesión...");
    
    await this.whatsappService.logout();
    
    console.log("Sesión cerrada exitosamente - Dispositivo desvinculado");
    // Limpiar el número persistido en la BD para este usuario
    try {
      await User.update(req.user.userId, { whatsapp_number: null });
      console.log(`[${req.user.userId}] whatsapp_number limpiado en la BD tras logout (legacy route).`);
    } catch (err) {
      console.warn('No se pudo limpiar whatsapp_number en la BD (legacy route):', err.message);
    }

    res.json({ 
      success: true, 
      message: "Sesión cerrada exitosamente - Dispositivo desvinculado de WhatsApp" 
    });
  });
}

module.exports = AuthController;