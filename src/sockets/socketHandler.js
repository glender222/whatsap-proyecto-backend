const { verifyToken } = require('../utils/jwt');

class SocketHandler {
  constructor(whatsappService) {
    this.whatsappService = whatsappService;
  }

  handleConnection(io) {
    // Middleware de autenticación para Sockets
    io.use((socket, next) => {
      const token = socket.handshake.auth.token;
      if (!token) {
        return next(new Error('Authentication error: Token not provided'));
      }
      const payload = verifyToken(token);
      if (!payload) {
        return next(new Error('Authentication error: Invalid token'));
      }
      socket.user = payload; // Adjuntar datos del usuario al socket
      next();
    });

    io.on("connection", (socket) => {
      console.log(`Cliente autenticado y conectado: ${socket.id}, UserID: ${socket.user.userId}`);

      // Unir el socket a una sala con su propio ID de usuario para notificaciones privadas
      socket.join(socket.user.userId.toString());

      // Enviar lista de chats actualizada (y filtrada) al conectarse
      this._sendFilteredChats(socket);
      
      // Unirse a un chat específico
      socket.on("join", async (chatId) => {
        socket.join(chatId);
        console.log(`Cliente ${socket.id} se unió al chat: ${chatId}`);
        
        // Verificar que no sea un canal antes de marcar como leído
        if (chatId.includes("@newsletter")) {
          console.log("Intento de unirse a un canal, ignorando marcado como leído");
          return;
        }
        
        try {
          await this.whatsappService.markAsRead(chatId);
        } catch (error) {
          console.error("Error marcando como leído al unirse:", error);
        }
      });

      // Salir de un chat
      socket.on("leave", (chatId) => {
        socket.leave(chatId);
        console.log(`Cliente ${socket.id} dejó el chat: ${chatId}`);
      });

      // Solicitar lista actualizada de chats
      socket.on("request-chats", () => {
        this._sendFilteredChats(socket);
      });

      // Notificación de mensaje enviado desde frontend
      socket.on("sent-message", (data) => {
        console.log(`Mensaje enviado notificado por cliente ${socket.id}:`, data);
      });

      // Logout desde Socket.IO
      socket.on("logout", async () => {
        try {
          console.log(`Cliente ${socket.id} solicitó logout`);
          
          await this.whatsappService.logout();
          
          socket.emit("logout-confirmed", { success: true });
          
        } catch (error) {
          console.error("Error en logout via socket:", error);
          socket.emit("logout-confirmed", { 
            success: false, 
            error: error.message 
          });
        }
      });

      socket.on("disconnect", () => {
        console.log("Cliente desconectado:", socket.id);
      });
    });
  }

  async _sendFilteredChats(socket) {
    const { userId, rol } = socket.user;
    const allChats = this.whatsappService.getChats();

    if (rol === 'ADMIN') {
      return socket.emit("chats-updated", allChats);
    }

    // Asegurarse de que ChatPermission está disponible.
    // Lo ideal sería inyectarlo en el constructor, pero por simplicidad lo requerimos aquí.
    const ChatPermission = require('../models/ChatPermission');
    const permittedChatIds = await ChatPermission.findByEmployeeId(userId);
    const filteredChats = allChats.filter(chat => permittedChatIds.includes(chat.id._serialized));

    socket.emit("chats-updated", filteredChats);
  }
}

module.exports = SocketHandler;