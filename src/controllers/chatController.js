const { asyncHandler } = require('../middleware/errorHandler');
const ChatPermission = require('../models/ChatPermission');

class ChatController {
  constructor(whatsappService) {
    this.whatsappService = whatsappService;
  }

  // GET /chats (compatibilidad legacy)
  getChatsLegacy = asyncHandler(async (req, res) => {
    const chats = this.whatsappService.getChats();
    res.json(chats); // Respuesta directa sin wrapper
  });

  // GET /messages/:chatId (compatibilidad legacy)
  getMessagesLegacy = asyncHandler(async (req, res) => {
    const { chatId } = req.params;
    const limit = parseInt(req.query.limit || "50", 10);
    const before = parseInt(req.query.before || "0", 10);

    if (!chatId) {
      return res.status(400).json({ error: "ChatId es requerido" });
    }

    try {
      const messages = await this.whatsappService.getChatMessages(chatId, limit, before);
      res.json(messages); // Respuesta directa sin wrapper
    } catch (error) {
      res.status(500).json({ error: "No se pudo obtener los mensajes" });
    }
  });

  // GET /api/chats
  getChats = asyncHandler(async (req, res) => {
    const { userId, rol } = req.user;

    const allChats = this.whatsappService.getChats();

    if (rol === 'ADMIN') {
      // Los admins ven todos los chats
      return res.json({
        success: true,
        data: allChats
      });
    }

    // Los empleados solo ven los chats asignados
    const permittedChatIds = await ChatPermission.findByEmployeeId(userId);
    const filteredChats = allChats.filter(chat => permittedChatIds.includes(chat.id._serialized));

    res.json({
      success: true,
      data: filteredChats
    });
  });

  // GET /api/chats/:chatId/messages
  getMessages = asyncHandler(async (req, res) => {
    const { chatId } = req.params;
    const { userId, rol } = req.user;
    const limit = parseInt(req.query.limit || "50", 10);
    const before = parseInt(req.query.before || "0", 10);

    if (!chatId) {
      return res.status(400).json({
        success: false,
        error: "ChatId es requerido"
      });
    }

    // Verificar permiso si es empleado
    if (rol === 'EMPLEADO') {
      const hasPermission = await ChatPermission.hasPermission(userId, chatId);
      if (!hasPermission) {
        return res.status(403).json({ success: false, error: 'Acceso denegado a este chat' });
      }
    }

    const messages = await this.whatsappService.getChatMessages(chatId, limit, before);
    
    res.json({
      success: true,
      data: messages
    });
  });

  // POST /send-message (compatibilidad legacy)
  sendMessageLegacy = asyncHandler(async (req, res) => {
    const { chatId, message } = req.body;
    const file = req.file;

    if (!chatId) {
      return res.status(400).json({
        success: false,
        error: "Falta parámetro chatId"
      });
    }

    if (!message && !file) {
      return res.status(400).json({
        success: false,
        error: "No hay mensaje ni archivo para enviar"
      });
    }

    const sentMessage = await this.whatsappService.sendMessage(chatId, message, file);

    // Limpiar archivo temporal si existe
    if (file && file.path) {
      const fs = require('fs');
      try {
        fs.unlinkSync(file.path);
      } catch (e) {
        console.warn('No se pudo eliminar archivo temporal:', file.path);
      }
    }

    res.json({
      success: true,
      sentType: file ? "media" : "text",
      messageId: sentMessage?.id?._serialized
    });
  });

  // POST /api/chats/:chatId/messages
  sendMessage = asyncHandler(async (req, res) => {
    const { chatId } = req.params;
    const { userId, rol } = req.user;
    const { message } = req.body;
    const file = req.file;

    if (!chatId) {
      return res.status(400).json({
        success: false,
        error: "ChatId es requerido"
      });
    }

    // Verificar permiso si es empleado
    if (rol === 'EMPLEADO') {
      const hasPermission = await ChatPermission.hasPermission(userId, chatId);
      if (!hasPermission) {
        return res.status(403).json({ success: false, error: 'Acceso denegado a este chat' });
      }
    }

    if (!message && !file) {
      return res.status(400).json({
        success: false,
        error: "Mensaje o archivo es requerido"
      });
    }

    const sentMessage = await this.whatsappService.sendMessage(chatId, message, file);

    // Limpiar archivo temporal si existe
    if (file && file.path) {
      const fs = require('fs');
      try {
        fs.unlinkSync(file.path);
      } catch (e) {
        console.warn('No se pudo eliminar archivo temporal:', file.path);
      }
    }

    res.json({
      success: true,
      data: {
        sentType: file ? "media" : "text",
        messageId: sentMessage?.id?._serialized
      }
    });
  });

  // PUT /api/chats/:chatId/read
  markAsRead = asyncHandler(async (req, res) => {
    const { chatId } = req.params;

    if (!chatId) {
      return res.status(400).json({
        success: false,
        error: "ChatId es requerido"
      });
    }

    // Verificar que no sea un canal
    if (chatId.includes("@newsletter")) {
      return res.status(400).json({
        success: false,
        error: "No se puede marcar como leído un canal"
      });
    }

    await this.whatsappService.markAsRead(chatId);

    res.json({
      success: true,
      message: "Chat marcado como leído"
    });
  });
}

module.exports = ChatController;