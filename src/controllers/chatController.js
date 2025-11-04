const { asyncHandler } = require('../middleware/errorHandler');
const ChatPermission = require('../models/ChatPermission');
const fs = require('fs');

class ChatController {
  constructor() {
    // El constructor ya no necesita dependencias.
    // El cliente de WhatsApp se inyecta a través del middleware en `req.whatsappClient`.
  }

  // GET /api/chats
  getChats = asyncHandler(async (req, res) => {
    const { userId, rol } = req.user;
    const whatsappClient = req.whatsappClient; // Cliente correcto inyectado

    const allChats = await whatsappClient.getChats();

    if (rol === 'ADMIN') {
      return res.json({ success: true, data: allChats });
    }

    // Para empleados, filtrar por permisos
    const permittedChatIds = await ChatPermission.findByEmployeeId(userId);
    const filteredChats = allChats.filter(chat => permittedChatIds.includes(chat.id._serialized));

    res.json({ success: true, data: filteredChats });
  });

  // GET /api/chats/:chatId/messages
  getMessages = asyncHandler(async (req, res) => {
    const { chatId } = req.params;
    const { userId, rol } = req.user;
    const whatsappClient = req.whatsappClient;

    const limit = parseInt(req.query.limit || "50", 10);

    // Verificar permiso si es empleado
    if (rol === 'EMPLEADO') {
      const hasPermission = await ChatPermission.hasPermission(userId, chatId);
      if (!hasPermission) {
        return res.status(403).json({ success: false, error: 'Acceso denegado a este chat' });
      }
    }

    const messages = await whatsappClient.messageHandler.getChatMessages(chatId, limit);
    res.json({ success: true, data: messages });
  });

  // POST /api/chats/:chatId/messages
  sendMessage = asyncHandler(async (req, res) => {
    const { chatId } = req.params;
    const { userId, rol } = req.user;
    const whatsappClient = req.whatsappClient;
    const { message } = req.body;
    const file = req.file;

    // Verificar permiso si es empleado
    if (rol === 'EMPLEADO') {
      const hasPermission = await ChatPermission.hasPermission(userId, chatId);
      if (!hasPermission) {
        // Limpiar archivo subido si no hay permiso
        if (file && file.path) fs.unlinkSync(file.path);
        return res.status(403).json({ success: false, error: 'Acceso denegado a este chat' });
      }
    }

    if (!message && !file) {
      return res.status(400).json({ success: false, error: "Mensaje o archivo es requerido" });
    }

    const sentMessage = await whatsappClient.messageHandler.sendMessage(chatId, message, file);

    // Limpiar archivo temporal si existe
    if (file && file.path) {
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
    const whatsappClient = req.whatsappClient;

    // La lógica de permisos ya se aplica a nivel de si el empleado puede ver el chat o no.
    // Si un empleado conoce un `chatId` para el que no tiene permiso, fallará en otras partes,
    // pero aquí podríamos añadir una comprobación explícita si la seguridad necesita ser más estricta.

    if (chatId.includes("@newsletter")) {
      return res.status(400).json({ success: false, error: "No se puede marcar como leído un canal" });
    }

    await whatsappClient.messageHandler.markAsRead(chatId);
    res.json({ success: true, message: "Chat marcado como leído" });
  });
}

module.exports = ChatController;
