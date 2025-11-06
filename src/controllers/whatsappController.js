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

    try {
      // Toda la lógica compleja, incluyendo la prevención de sesiones duplicadas
      // y la gestión de locks, ahora está encapsulada en el SessionManager.
      await this.sessionManager.startSession(adminId);

      res.status(200).json({
        success: true,
        message: 'Inicialización de sesión comenzada. Escanee el QR si es necesario.'
      });
    } catch (error) {
      // El SessionManager ahora arroja errores descriptivos que podemos pasar al cliente.
      // Por ejemplo: "La sesión ya se está iniciando" o "No se pudo adquirir el lock".
      // Usamos un código 409 (Conflicto) para estos casos.
      res.status(409).json({
        success: false,
        error: 'No se pudo inicializar la sesión.',
        details: error.message
      });
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
