/**
 * EventHandler
 * Maneja los eventos del cliente de WhatsApp
 */
const qrcode = require("qrcode");
const ChatPermission = require("../../models/ChatPermission");

class EventHandler {
  constructor(whatsappClient) {
    this.whatsappClient = whatsappClient;
  }

  /**
   * Configura todos los event listeners del cliente
   * @param {Object} client - Cliente de WhatsApp
   */
  setupEventHandlers(client) {
    client.on("qr", this.handleQR.bind(this));
    client.on("ready", this.handleReady.bind(this));
    client.on("disconnected", this.handleDisconnected.bind(this));
    client.on("auth_failure", this.handleAuthFailure.bind(this));
    client.on("change_state", this.handleStateChange.bind(this));
    client.on("message", this.handleMessage.bind(this));
  }

  /**
   * Maneja la generación del código QR
   * @param {string} qr - Código QR
   */
  async handleQR(qr) {
    try {
      this.whatsappClient.qrImage = await new Promise((resolve, reject) => {
        qrcode.toDataURL(qr, (err, url) => {
          if (err) reject(err);
          else resolve(url);
        });
      });
      
      console.log("QR generado");
      if (this.whatsappClient.socketIO) {
        this.whatsappClient.socketIO.emit("qr", this.whatsappClient.qrImage);
      }
    } catch (error) {
      console.error("Error generando QR:", error);
    }
  }

  /**
   * Maneja el evento cuando WhatsApp está listo
   */
  async handleReady() {
    console.log("✅ WhatsApp conectado!");
    this.whatsappClient.isConnected = true;
    this.whatsappClient.qrImage = "";
    
    // EMITIR ready INMEDIATAMENTE cuando se conecta
    if (this.whatsappClient.socketIO) {
      this.whatsappClient.socketIO.emit("ready", { status: "connected" });
      console.log("📡 Evento 'ready' emitido al frontend");
    }
    
    // LUEGO empezar a cargar chats (los eventos se emiten dentro de loadChats)
    try {
      await this.whatsappClient.chatManager.loadChats();
      console.log("✅ Todos los chats cargados completamente");
    } catch (err) {
      console.error('❌ Error en carga de chats:', err);
      if (this.whatsappClient.socketIO) {
        this.whatsappClient.socketIO.emit("loading-chats", {
          status: "error",
          message: "Error cargando chats"
        });
      }
    }
    
    // Si configurado, arrancar polling para detectar actividad desde otros dispositivos
    const config = require("../../config");
    const intervalSec = config.whatsapp.pollIntervalSeconds || 0;
    if (intervalSec > 0) {
      console.log(`Iniciando polling de chats cada ${intervalSec}s para detectar actividad remota`);
      this.whatsappClient._pollInterval = setInterval(() => {
        this.whatsappClient.chatManager.refreshRecentChats().catch(err => 
          console.warn('Error en refreshRecentChats:', err)
        );
      }, intervalSec * 1000);
    }
  }

  /**
   * Maneja la desconexión de WhatsApp
   * @param {string} reason - Razón de la desconexión
   */
  handleDisconnected(reason) {
    console.log("WhatsApp desconectado:", reason);
    
    // Si es un logout intencional, no procesar como desconexión
    if (this.whatsappClient.isIntentionalLogout) {
      console.log("Desconexión por logout intencional - ignorando evento");
      return;
    }
    
    this.whatsappClient.isConnected = false;
    this.whatsappClient.chatsList = [];
    this.whatsappClient.qrImage = "";
    
    if (this.whatsappClient.socketIO) {
      this.whatsappClient.socketIO.emit("disconnected", { reason, status: "disconnected" });
      this.whatsappClient.socketIO.emit("chats-updated", []);
    }
    
    // Detener polling si estaba activo
    if (this.whatsappClient._pollInterval) {
      clearInterval(this.whatsappClient._pollInterval);
      this.whatsappClient._pollInterval = null;
    }
  }

  /**
   * Maneja los errores de autenticación
   * @param {string} message - Mensaje de error
   */
  handleAuthFailure(message) {
    console.error("Error de autenticación:", message);
    this.whatsappClient.qrImage = "";
    
    if (this.whatsappClient.socketIO) {
      this.whatsappClient.socketIO.emit("auth_failure", { message, status: "auth_failed" });
    }
  }

  /**
   * Maneja los cambios de estado
   * @param {string} state - Nuevo estado
   */
  handleStateChange(state) {
    console.log("Estado cambió a:", state);
    
    if (this.whatsappClient.socketIO) {
      this.whatsappClient.socketIO.emit("state_changed", { state });
    }
  }

  /**
   * Maneja los mensajes entrantes
   * @param {Object} msg - Mensaje recibido
   */
  async handleMessage(msg) {
    const chat = await msg.getChat();
    const chatId = chat.id._serialized;
    
    // Filtrar canales/newsletters
    if (chatId.includes("@newsletter") || 
        (chat.isGroup && !chatId.includes("@g.us"))) {
      return;
    }
    
    // Ignorar mensajes de sistema/evento que no representan un mensaje "real"
    const ChatValidator = require('./ChatValidator');
    if (!ChatValidator.isRealMessage(msg)) return;

    // Actualizar el chat en la lista
    await this.whatsappClient.chatManager.updateChatInList(chat, msg.timestamp, msg);
    
    const formatted = this.whatsappClient.messageHandler.formatMessage(msg, chatId);
    
    if (this.whatsappClient.socketIO) {
      const adminId = this.whatsappClient.adminId;
      if (!adminId) return; // No emitir si no hay un admin asociado

      const permittedEmployeeIds = await ChatPermission.findByChatId(chatId);

      const recipientIds = [adminId, ...permittedEmployeeIds].map(id => id.toString());

      if (recipientIds.length > 0) {
        // Enviar el mensaje a las salas de los usuarios autorizados
        this.whatsappClient.socketIO.to(recipientIds).emit("message", formatted);
      }

      // Actualizar la lista de chats para todos los usuarios conectados
      // La lógica de filtrado está en el socketHandler
      this.whatsappClient.socketIO.emit("chats-updated", this.whatsappClient.chatsList);
    }
  }
}

module.exports = EventHandler;