const { verifyToken } = require('../utils/jwt');
const { getTenantId } = require('../utils/sessionUtils');

class SocketHandler {
  constructor(sessionManager) {
    this.sessionManager = sessionManager;
  }

  handleConnection(io) {
    // Middleware de autenticación
    io.use((socket, next) => {
      const token = socket.handshake.auth.token;
      if (!token) return next(new Error('Authentication error: Token not provided'));

      const payload = verifyToken(token);
      if (!payload) return next(new Error('Authentication error: Invalid token'));

      socket.user = payload;
      next();
    });

    io.on("connection", async (socket) => {
      try {
        console.log(`Cliente autenticado: ${socket.id}, UserID: ${socket.user.userId}`);

        // 1. Determinar el Tenant ID y obtener la sesión correcta
        const tenantId = await getTenantId(socket.user);
        const whatsappClient = this.sessionManager.getSession(tenantId);

        // 2. Unir el socket a la sala de su propio usuario y a la sala de su tenant
        socket.join(socket.user.userId.toString());
        socket.join(`tenant:${tenantId}`);
        
        // 3. Una sesión es válida si existe en el sessionManager.
        // ⚠️ IMPORTANTE: No validamos estado de conexión aquí porque:
        // - La sesión WhatsApp es independiente del socket
        // - Si hace reload, socket se desconecta pero sesión persiste
        // - Las validaciones de conexión se hacen en REST API cuando sea necesario
        if (!whatsappClient) {
          console.log(`[${tenantId}] ⚠️ Socket conectado pero NO hay sesión WhatsApp activa. Usuario debe ejecutar /init`);
          socket.emit('session_status', { 
            status: 'disconnected', 
            message: 'La sesión de WhatsApp para tu organización no está activa. Inicia sesión en /api/whatsapp/init' 
          });
        } else {
          // 4. Si hay sesión, enviar la lista de chats inicial
          console.log(`[${tenantId}] ✅ Socket conectado y sesión WhatsApp existe. Enviando chats...`);
          this._sendFilteredChats(socket, whatsappClient);
        }

        // Registrar listeners para eventos del cliente
        this._registerEventListeners(socket, whatsappClient, tenantId);

      } catch (error) {
        console.error(`Error en conexión de socket para ${socket.id}:`, error);
        socket.emit('error', { message: 'Error interno al procesar la conexión.', details: error.message });
        socket.disconnect();
      }
    });
  }

  _registerEventListeners(socket, whatsappClient, tenantId) {
    socket.on("join", async (chatId) => {
      if (!whatsappClient) return; // No hacer nada si no hay sesión
      socket.join(chatId);
      // Log silenciado para reducir ruido en consola
      if (!chatId.includes("@newsletter")) {
        try {
          await whatsappClient.messageHandler.markAsRead(chatId);
        } catch (error) {
          console.error("Error marcando como leído:", error);
        }
      }
    });

    socket.on("leave", (chatId) => {
      socket.leave(chatId);
      // Log silenciado para reducir ruido en consola
    });

    socket.on("request-chats", () => {
      if (!whatsappClient) {
        socket.emit('session_status', { status: 'disconnected', message: 'La sesión no está activa. Inicia sesión en /api/whatsapp/init' });
      } else {
        this._sendFilteredChats(socket, whatsappClient);
      }
    });

    socket.on("disconnect", () => {
      console.log(`Cliente desconectado: ${socket.id}`);
    });
  }

  async _sendFilteredChats(socket, whatsappClient) {
    try {
      const allChats = await whatsappClient.getChats();
      // Todos los empleados ven todos los chats de su administrador
      // (No hay control granular de permisos por chat)
      socket.emit("chats-updated", allChats);
    } catch (error) {
      console.error('Error enviando chats:', error);
      socket.emit('error', { message: 'No se pudo obtener la lista de chats.' });
    }
  }
}

module.exports = SocketHandler;
