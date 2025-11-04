const qrcode = require("qrcode");
const ChatPermission = require("../../models/ChatPermission");
const stateManager = require('../stateManager');

class EventHandler {
  constructor(whatsappClient, onDisconnectedCallback) {
    this.whatsappClient = whatsappClient;
    this.onDisconnected = onDisconnectedCallback;
    this.adminId = this.whatsappClient.adminId; // Guardar adminId para fácil acceso
    this.tenantRoom = `tenant:${this.adminId}`; // Sala de socket para este tenant
  }

  setupEventHandlers(client) {
    client.on("qr", this.handleQR.bind(this));
    client.on("ready", this.handleReady.bind(this));
    client.on("disconnected", this.handleDisconnected.bind(this));
    client.on("message", this.handleMessage.bind(this));
  }

  async handleQR(qr) {
    if (!this.whatsappClient.socketIO) return;
    try {
      const qrImage = await qrcode.toDataURL(qr);
      // Emitir QR solo a la sala del admin/tenant que lo solicitó
      this.whatsappClient.socketIO.to(this.tenantRoom).emit("qr", qrImage);
    } catch (error) {
      console.error(`[${this.adminId}] Error generando QR:`, error);
    }
  }

  async handleReady() {
    console.log(`[${this.adminId}] ✅ WhatsApp conectado!`);
    this.whatsappClient.isConnected = true;
    
    if (this.whatsappClient.socketIO) {
      // Notificar a todo el tenant que la sesión está lista
      this.whatsappClient.socketIO.to(this.tenantRoom).emit("session_status", { status: "connected" });
    }
    
    try {
      await this.whatsappClient.chatManager.loadChats();
      console.log(`[${this.adminId}] ✅ Chats cargados.`);
    } catch (err) {
      console.error(`[${this.adminId}] ❌ Error cargando chats:`, err);
    }
  }

  async handleDisconnected(reason) {
    console.log(`[${this.adminId}] WhatsApp desconectado:`, reason);
    
    // Liberar el lock para que otra instancia/proceso pueda tomar el control
    await stateManager.releaseLock(this.adminId);
    this.onDisconnected(); // Detener el refresco del lock

    this.whatsappClient.isConnected = false;
    
    if (this.whatsappClient.socketIO) {
      // Notificar a todo el tenant que la sesión se ha desconectado
      this.whatsappClient.socketIO.to(this.tenantRoom).emit("session_status", {
        status: "disconnected",
        reason
      });
    }
    
    if (this.whatsappClient._pollInterval) {
      clearInterval(this.whatsappClient._pollInterval);
      this.whatsappClient._pollInterval = null;
    }
  }

  async handleMessage(msg) {
    if (!this.whatsappClient.socketIO) return;

    const chat = await msg.getChat();
    const chatId = chat.id._serialized;
    
    const ChatValidator = require('./ChatValidator');
    if (!ChatValidator.isRealMessage(msg)) return;

    await this.whatsappClient.chatManager.updateChatInList(chat, msg.timestamp, msg);
    
    const formattedMessage = this.whatsappClient.messageHandler.formatMessage(msg, chatId);
    
    // Obtener la lista de usuarios (admin + empleados) que deben recibir el mensaje
    const permittedEmployeeIds = await ChatPermission.findByChatId(chatId);
    const recipientIds = [this.adminId, ...permittedEmployeeIds].map(id => id.toString());

    if (recipientIds.length > 0) {
      // Emitir el mensaje a las salas de usuario individuales de los destinatarios
      this.whatsappClient.socketIO.to(recipientIds).emit("message", formattedMessage);
    }

    // Notificar a todo el tenant que la lista de chats ha sido actualizada
    // El frontend se encargará de refrescar su lista, que ya viene filtrada por el backend.
    this.whatsappClient.socketIO.to(this.tenantRoom).emit("chats-updated");
  }
}

module.exports = EventHandler;
