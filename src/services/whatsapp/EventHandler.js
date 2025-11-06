const qrcode = require("qrcode");
const ChatPermission = require("../../models/ChatPermission");
const stateManager = require('../stateManager');

const LOCK_REFRESH_INTERVAL_MS = 8000; // 8 segundos

class EventHandler {
  constructor(whatsappClient, onDisconnectedCallback, tempLockRefreshInterval = null) {
    this.whatsappClient = whatsappClient;
    this.onDisconnected = onDisconnectedCallback;
    this.adminId = this.whatsappClient.adminId; // Guardar adminId para fácil acceso
    this.tenantRoom = `tenant:${this.adminId}`; // Sala de socket para este tenant
    this.lockRefreshInterval = null; // Referencia al intervalo de refresco PERMANENTE
    this.tempLockRefreshInterval = tempLockRefreshInterval; // Ref al intervalo TEMPORAL
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

    // 1. Detener el intervalo temporal que venía de SessionManager.
    if (this.tempLockRefreshInterval) {
      clearInterval(this.tempLockRefreshInterval);
      this.tempLockRefreshInterval = null;
      console.log(`[${this.adminId}] Handover: Intervalo de lock temporal detenido.`);
    }

    try {
      // 2. REALIZAR UN REFRESH INMEDIATO. Esto cierra la "ventana de vulnerabilidad".
      await stateManager.refreshLock(this.adminId);
      console.log(`[${this.adminId}] Handover: Lock refrescado inmediatamente.`);

      // 3. Iniciar el proceso de renovación de lock permanente, gestionado por EventHandler.
      this.startLockRefresh();

      this.whatsappClient.isConnected = true;
      if (this.whatsappClient.socketIO) {
        this.whatsappClient.socketIO.to(this.tenantRoom).emit("session_status", { status: "connected" });
      }

      await this.whatsappClient.chatManager.loadChats();
      console.log(`[${this.adminId}] ✅ Chats cargados.`);

    } catch (err) {
      // Si el refresh inmediato falla, significa que perdimos el lock justo en la transición.
      console.error(`[${this.adminId}] ❌ Error crítico durante el handover del lock:`, err.message);
      this.stopLockRefresh(); // Asegurarse de que no queden intervalos.
      this.whatsappClient.logout(); // Forzar logout para una recuperación limpia.
    }
  }

  async handleDisconnected(reason) {
    console.log(`[${this.adminId}] WhatsApp desconectado:`, reason);
    
    // Detener el refresco del lock ANTES de liberar el lock
    this.stopLockRefresh();

    // Liberar el lock para que otra instancia/proceso pueda tomar el control
    await stateManager.releaseLock(this.adminId);
    this.onDisconnected(); // Callback para notificar al SessionManager

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

  /**
   * Inicia el intervalo para refrescar el lock de Redis.
   */
  startLockRefresh() {
    if (this.lockRefreshInterval) {
      clearInterval(this.lockRefreshInterval);
    }

    this.lockRefreshInterval = setInterval(async () => {
      try {
        await stateManager.refreshLock(this.adminId);
        console.log(`[${this.adminId}] 🔄 Lock refrescado exitosamente.`);
      } catch (error) {
        console.error(`[${this.adminId}] ❌ Error al refrescar el lock: ${error.message}. Esta instancia ha perdido el control.`);
        console.log(`[${this.adminId}] 🔴 Forzando logout para permitir que otra instancia tome el control...`);

        // Detener el intervalo inmediatamente para no seguir intentando
        this.stopLockRefresh();

        // Forzar un logout para limpiar el estado y permitir que otra instancia tome el control.
        // No usamos 'await' para no bloquear el intervalo. El logout se encargará del resto.
        this.whatsappClient.logout();
      }
    }, LOCK_REFRESH_INTERVAL_MS);
  }

  /**
   * Detiene el intervalo de refresco del lock.
   */
  stopLockRefresh() {
    // Detener el intervalo permanente
    if (this.lockRefreshInterval) {
      clearInterval(this.lockRefreshInterval);
      this.lockRefreshInterval = null;
      console.log(`[${this.adminId}] 🛑 Intervalo de refresco del lock permanente detenido.`);
    }
    // Por seguridad, detener también el temporal si aún existiera
    if (this.tempLockRefreshInterval) {
      clearInterval(this.tempLockRefreshInterval);
      this.tempLockRefreshInterval = null;
      console.log(`[${this.adminId}] 🛑 Intervalo de refresco del lock temporal detenido.`);
    }
  }
}

module.exports = EventHandler;
