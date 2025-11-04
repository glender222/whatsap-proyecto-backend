const { asyncHandler } = require('../middleware/errorHandler');
const ChatPermission = require('../models/ChatPermission');
const fs = require('fs');
const path = require('path');

class MediaController {
  constructor() {
    // El cliente de WhatsApp se inyecta a través de `req.whatsappClient`.
  }

  /**
   * GET /api/media/:messageId
   * Descarga el media asociado a un mensaje.
   */
  downloadMedia = asyncHandler(async (req, res) => {
    const { messageId } = req.params;
    const { userId, rol } = req.user;
    const whatsappClient = req.whatsappClient;

    if (!messageId) {
      return res.status(400).json({ success: false, error: "messageId es requerido" });
    }

    let media;
    try {
      // Obtenemos el mensaje primero para poder verificar el chatId
      const message = await whatsappClient.client.getMessageById(messageId);
      if (!message) {
        return res.status(404).json({ success: false, error: "Mensaje no encontrado" });
      }

      const chatId = message.fromMe ? message.to : message.from;

      // Verificar permiso si es empleado
      if (rol === 'EMPLEADO') {
        const hasPermission = await ChatPermission.hasPermission(userId, chatId);
        if (!hasPermission) {
          return res.status(403).json({ success: false, error: 'Acceso denegado a este chat' });
        }
      }

      media = await whatsappClient.mediaHandler.downloadMedia(message);
    } catch (err) {
      return res.status(404).json({
        success: false,
        error: "No se pudo descargar el archivo",
        details: err.message || err
      });
    }

    // El resto de la lógica de streaming/envío de archivo permanece igual.
    // Asumimos que `downloadMedia` devuelve un `localPath`.
    if (media.localPath && fs.existsSync(media.localPath)) {
      res.setHeader('Content-Type', media.mimetype || 'application/octet-stream');
      return res.sendFile(media.localPath);
    }

    return res.status(404).json({ success: false, error: "Archivo no encontrado localmente" });
  });

  /**
   * GET /api/media/profile-photo/:chatId
   * Obtiene la foto de perfil de un chat.
   */
  getProfilePhoto = asyncHandler(async (req, res) => {
    const { chatId } = req.params;
    const { userId, rol } = req.user;
    const whatsappClient = req.whatsappClient;

    if (!chatId) {
      return res.status(400).json({ success: false, error: 'chatId requerido' });
    }

    // Verificar permiso si es empleado
    if (rol === 'EMPLEADO') {
      const hasPermission = await ChatPermission.hasPermission(userId, chatId);
      if (!hasPermission) {
        return res.status(403).json({ success: false, error: 'Acceso denegado a este chat' });
      }
    }

    try {
      const photoUrl = await whatsappClient.mediaHandler.getProfilePhoto(chatId);
      // Idealmente, deberíamos descargar la imagen y servirla, no solo devolver la URL.
      // Por simplicidad, devolvemos la URL si la obtenemos.
      res.json({ success: true, data: { profilePhotoUrl: photoUrl } });
    } catch (e) {
      res.status(404).json({ success: false, error: 'Foto de perfil no encontrada' });
    }
  });
}

module.exports = MediaController;
