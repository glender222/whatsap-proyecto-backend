const { asyncHandler } = require('../middleware/errorHandler');
const stateManager = require('../services/stateManager');

class WhatsAppController {
  constructor(whatsappService) {
    this.whatsappService = whatsappService;
  }

  /**
   * Inicializa el servicio de WhatsApp. Solo para Admins.
   * POST /api/whatsapp/init
   */
  initialize = asyncHandler(async (req, res) => {
    const adminId = req.user.userId;

    // Intentar adquirir el lock
    const lockAcquired = await stateManager.acquireLock();
    if (!lockAcquired) {
      return res.status(409).json({ success: false, error: 'Ya hay un proceso de inicialización en curso o una sesión activa.' });
    }

    // Si el servicio ya está conectado en esta instancia (poco probable pero posible)
    if (this.whatsappService.getStatus().isConnected) {
        await stateManager.releaseLock();
        return res.status(400).json({ success: false, error: 'El servicio de WhatsApp ya está inicializado en esta instancia.' });
    }

    try {
      // Guardar el adminId en Redis antes de empezar
      await stateManager.setSessionAdmin(adminId);

      // Iniciar el servicio. El servicio ahora será responsable de mantener el lock vivo.
      await this.whatsappService.initialize(adminId);

      res.status(200).json({ success: true, message: 'Servicio de WhatsApp inicializado. Escanee el QR.' });
    } catch (error) {
      // Si algo falla, liberar el lock
      await stateManager.releaseLock();
      res.status(500).json({ success: false, error: 'No se pudo inicializar el servicio de WhatsApp.', details: error.message });
    }
  });
}

module.exports = WhatsAppController;
