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
    const { nombre, email } = req.body;

    // Solo ADMIN puede crear empleados
    if (req.user.rol !== 'ADMIN') {
      return res.status(403).json({
        success: false,
        error: 'Solo administradores pueden crear estaciones'
      });
    }

    const result = await AuthService.createStation(req.user.userId, nombre, email);

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
    res.json({ 
      success: true, 
      message: "Sesión cerrada exitosamente - Dispositivo desvinculado de WhatsApp" 
    });
  });
}

module.exports = AuthController;