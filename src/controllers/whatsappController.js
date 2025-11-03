const { asyncHandler } = require('../middleware/errorHandler');

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

    if (this.whatsappService.getStatus().isConnected) {
        return res.status(400).json({ success: false, error: 'El servicio de WhatsApp ya está inicializado.' });
    }

    try {
      await this.whatsappService.initialize(adminId);
      res.status(200).json({ success: true, message: 'Servicio de WhatsApp inicializado. Escanee el QR.' });
    } catch (error) {
      res.status(500).json({ success: false, error: 'No se pudo inicializar el servicio de WhatsApp.', details: error.message });
    }
  });
}

module.exports = WhatsAppController;
