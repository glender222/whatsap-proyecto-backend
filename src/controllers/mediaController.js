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
   * Devuelve una URL pública para que el frontend pueda acceder sin autenticación.
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

      // Pasar el messageId (string), no el objeto message
      media = await whatsappClient.mediaHandler.downloadMedia(messageId);
    } catch (err) {
      return res.status(404).json({
        success: false,
        error: "No se pudo descargar el archivo",
        details: err.message || err
      });
    }

    // Devolver URL pública en lugar de sendFile()
    // Esto permite que el frontend acceda al archivo sin autenticación
    if (media.localPath && fs.existsSync(media.localPath)) {
      const filename = path.basename(media.localPath);
      const publicUrl = `${req.protocol}://${req.get('host')}/uploads/${encodeURIComponent(filename)}`;
      
      return res.json({
        success: true,
        data: {
          mediaUrl: publicUrl,
          filename: media.filename || filename,
          mimetype: media.mimetype || 'application/octet-stream'
        }
      });
    }

    return res.status(404).json({ success: false, error: "Archivo no encontrado localmente" });
  });

  /**
   * GET /api/media/file/:filename
   * Descargar archivo directo (requiere autenticación)
   * Busca el archivo en /uploads y lo sirve al cliente
   */
  serveFile = asyncHandler(async (req, res) => {
    const { filename } = req.params;
    const { userId, rol, idPadre } = req.user;

    if (!filename) {
      return res.status(400).json({ success: false, error: "filename es requerido" });
    }

    // Decodificar el nombre del archivo (si fue codificado)
    const decodedFilename = decodeURIComponent(filename);
    
    // Construir la ruta del archivo
    const config = require('../config');
    const filePath = path.join(config.whatsapp.uploadDir, decodedFilename);

    // Validar que el archivo existe y está en el directorio correcto
    const normalizedPath = path.normalize(filePath);
    const uploadDir = path.normalize(config.whatsapp.uploadDir);

    if (!normalizedPath.startsWith(uploadDir)) {
      return res.status(403).json({ 
        success: false, 
        error: 'Acceso denegado: ruta inválida' 
      });
    }

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ 
        success: false, 
        error: 'Archivo no encontrado' 
      });
    }

    // Validar acceso según etiquetas (para empleados)
    if (rol === 'EMPLEADO') {
      // Extraer el chatId del nombre del archivo
      // Formato: [boolean]_[chatId]_[hash].[ext]
      const parts = decodedFilename.split('_');
      if (parts.length >= 2) {
        const chatId = parts[1];
        
        // Verificar que el empleado tiene acceso a este chat
        const TagService = require('../services/tagService');
        const adminId = idPadre; // El admin del empleado
        const accessibleChatIds = await TagService.getAccessibleChatIds(userId, rol, adminId);
        
        // Si no tiene acceso total (accessibleChatIds === null) y el chat no está en la lista
        if (accessibleChatIds !== null && !accessibleChatIds.includes(chatId)) {
          return res.status(403).json({ 
            success: false, 
            error: 'Acceso denegado a este archivo' 
          });
        }
      }
    }

    // Obtener tipo MIME
    const ext = path.extname(decodedFilename).toLowerCase();
    const mimeType = {
      '.pdf': 'application/pdf',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.mp4': 'video/mp4',
      '.mp3': 'audio/mpeg',
      '.ogg': 'audio/ogg',
      '.webm': 'video/webm'
    }[ext] || 'application/octet-stream';

    // Servir el archivo
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', `inline; filename="${decodedFilename}"`);
    
    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
    
    fileStream.on('error', (err) => {
      console.error('[ERROR] Error sirviendo archivo:', err);
      if (!res.headersSent) {
        res.status(500).json({ 
          success: false, 
          error: 'Error al descargar el archivo' 
        });
      }
    });
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
      const photoPathOrUrl = await whatsappClient.mediaHandler.getProfilePhoto(chatId);

      // Si el handler devolvió una URL remota, devolvemos esa URL directa.
      if (typeof photoPathOrUrl === 'string' && /^https?:\/\//i.test(photoPathOrUrl)) {
        return res.json({ success: true, data: { profilePhotoUrl: photoPathOrUrl } });
      }

      // Si devolvió un path local, exponerlo como URL pública bajo /profile-data
      const fs = require('fs');
      const path = require('path');
      const config = require('../config');

      if (photoPathOrUrl && fs.existsSync(photoPathOrUrl)) {
        const filename = path.basename(photoPathOrUrl);
        const publicUrl = `${req.protocol}://${req.get('host')}/profile-data/${encodeURIComponent(filename)}`;
        return res.json({ success: true, data: { profilePhotoUrl: publicUrl } });
      }

      return res.status(404).json({ success: false, error: 'Foto de perfil no encontrada' });
    } catch (e) {
      // Si el error es porque no hay foto disponible (privacidad, sin foto, etc.)
      // devolver 200 con null en lugar de 404 para que el frontend sepa que el contacto existe pero no tiene foto
      if (e.message === 'No hay foto de perfil') {
        return res.status(200).json({ 
          success: true, 
          data: { 
            profilePhotoUrl: null,
            reason: 'no_photo_available' 
          } 
        });
      }
      
      return res.status(404).json({ success: false, error: 'Foto de perfil no encontrada', details: e.message });
    }
  });
}

module.exports = MediaController;
