const { asyncHandler } = require('../middleware/errorHandler');
const stateManager = require('../services/stateManager');

class WhatsAppController {
  constructor(sessionManager) {
    this.sessionManager = sessionManager;
  }

  /**
   * Inicializa la sesión de WhatsApp para el admin autenticado.
   * POST /api/whatsapp/init
   */
  initialize = asyncHandler(async (req, res) => {
    const adminId = req.user.userId;

    // Verificar si ya existe una sesión activa en el SessionManager
    if (this.sessionManager.getSession(adminId)) {
      return res.status(400).json({ success: false, error: 'La sesión para este administrador ya está activa.' });
    }

    // Intentar adquirir el lock específico para este admin
    const lockAcquired = await stateManager.acquireLock(adminId);
    if (!lockAcquired) {
      return res.status(409).json({ success: false, error: 'Ya hay un proceso de inicialización en curso para esta cuenta.' });
    }

    try {
      // Iniciar la sesión a través del SessionManager
      await this.sessionManager.startSession(adminId);

      // Nota: El SessionManager es ahora responsable de mantener el lock vivo.

      res.status(200).json({ success: true, message: 'Inicialización de sesión comenzada. Escanee el QR si es necesario.' });
    } catch (error) {
      // Si algo falla durante el inicio, liberar el lock
      await stateManager.releaseLock(adminId);
      res.status(500).json({ success: false, error: 'No se pudo inicializar la sesión de WhatsApp.', details: error.message });
    }
  });

  /**
   * Cierra la sesión de WhatsApp para el admin autenticado.
   * POST /api/whatsapp/logout
   */
  logout = asyncHandler(async (req, res) => {
    const adminId = req.user.userId;

    const success = await this.sessionManager.stopSession(adminId);

    if (success) {
      res.status(200).json({ success: true, message: 'Sesión cerrada correctamente.' });
    } else {
      res.status(404).json({ success: false, error: 'No se encontró una sesión activa para cerrar.' });
    }
  });
}

module.exports = WhatsAppController;
