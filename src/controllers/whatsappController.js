const { asyncHandler } = require('../middleware/errorHandler');
const stateManager = require('../services/stateManager');
const User = require('../models/User');
const ChatTag = require('../models/ChatTag');

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
   * 
   * Limpieza completa:
   * 1. Detiene sesión (cierra cliente, elimina carpeta .wwebjs_auth)
   * 2. Limpia whatsapp_number en tabla usuarios
   * 3. Elimina TODOS los registros de chat_tags del admin
   */
  logout = asyncHandler(async (req, res) => {
    const adminId = req.user.userId;

    // 1. Detener sesión (incluye limpieza de carpeta y caché)
    const success = await this.sessionManager.stopSession(adminId);

    // 2. Limpiar el número persistido en la tabla usuarios
    try {
      await User.update(adminId, { whatsapp_number: null });
      console.log(`[${adminId}] ✅ whatsapp_number limpiado en la BD tras logout.`);
    } catch (err) {
      console.warn(`[${adminId}] ⚠️ No se pudo limpiar whatsapp_number en la BD:`, err.message);
    }

    // 3. Eliminar TODOS los registros de chat_tags del admin
    try {
      const deletedCount = await ChatTag.deleteAllByAdmin(adminId);
      console.log(`[${adminId}] ✅ ${deletedCount} registros de chat_tags eliminados tras logout.`);
    } catch (err) {
      console.warn(`[${adminId}] ⚠️ No se pudieron eliminar chat_tags:`, err.message);
    }

    if (success) {
      res.status(200).json({ 
        success: true, 
        message: 'Sesión cerrada correctamente. Datos locales, caché y asignaciones de chats eliminados.' 
      });
    } else {
      // Aunque no hubiera sesión activa, devolvemos 200 porque hemos limpiado el número y chat_tags.
      res.status(200).json({ 
        success: true, 
        message: 'No había sesión activa, pero se limpiaron los datos persistidos (número de WhatsApp y chat_tags).' 
      });
    }
  });

  /**
   * Devuelve la última imagen QR (data URL) para el admin autenticado.
   * GET /api/whatsapp/qr
   */
  getQR = asyncHandler(async (req, res) => {
    const adminId = req.user.userId;

    const client = this.sessionManager.getSession(adminId);
    if (!client) {
      return res.status(404).json({ success: false, error: 'No hay una sesión activa para este admin.' });
    }

    const qr = client.getQR();
    if (!qr) {
      return res.status(204).json({ success: true, qr: null, message: 'No hay QR disponible en este momento.' });
    }

    return res.status(200).json({ success: true, qr });
  });
}

module.exports = WhatsAppController;
