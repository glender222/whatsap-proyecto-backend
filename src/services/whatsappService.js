/**
 * WhatsAppService (Facade Pattern)
 * Punto de entrada principal que delega funcionalidad a componentes especializados
 */
const WhatsAppClient = require('./whatsapp/WhatsAppClient');

const stateManager = require('./stateManager');

class WhatsAppService {
  constructor() {
    this.adminId = null;
    this.lockRefreshInterval = null;
    // Pasar el método stopLockRefresh como callback. Usar .bind(this) para mantener el contexto.
    this.whatsappClient = new WhatsAppClient(this.stopLockRefresh.bind(this));
  }

  // ==========================================
  // Métodos de conexión y configuración
  // ==========================================

  setSocketIO(io) {
    this.whatsappClient.setSocketIO(io);
  }

  async initialize(adminId) {
    if (!adminId) {
      throw new Error('Se requiere un adminId para inicializar el servicio de WhatsApp.');
    }
    this.adminId = adminId;
    this.whatsappClient.setAdminId(adminId);

    // Iniciar el refresco del lock
    this.startLockRefresh();

    return await this.whatsappClient.initialize();
  }

  getQR() {
    return this.whatsappClient.getQR();
  }

  getStatus() {
    return this.whatsappClient.getStatus();
  }

  getMyInfo() {
    return this.whatsappClient.getMyInfo();
  }

  async logout() {
    this.stopLockRefresh();
    await stateManager.releaseLock();
    return await this.whatsappClient.logout();
  }

  async destroy() {
    return await this.whatsappClient.destroy();
  }

  // ==========================================
  // Métodos de gestión de chats
  // ==========================================

  getChats() {
    return this.whatsappClient.getChats();
  }

  // ==========================================
  // Métodos de mensajes
  // ==========================================

  async getChatMessages(chatId, limit = 50, before = 0) {
    return await this.whatsappClient.messageHandler.getChatMessages(chatId, limit, before);
  }

  async sendMessage(chatId, message, media = null, options = {}) {
    // options: { forceDocument, ptt, asSticker }
    return await this.whatsappClient.messageHandler.sendMessage(chatId, message, media, options);
  }
  // ===================== NUEVOS MÉTODOS PARA MEDIA ROBUSTA =====================

  async getChatsList() {
    // Implementar en WhatsAppClient/ChatManager si no existe
    if (typeof this.whatsappClient.getChatsList === 'function') {
      return await this.whatsappClient.getChatsList();
    }
    // fallback: getChats
    return this.getChats();
  }

  async getMediaInfo(messageId) {
    if (typeof this.whatsappClient.mediaHandler.getMediaInfo === 'function') {
      return await this.whatsappClient.mediaHandler.getMediaInfo(messageId);
    }
    return null;
  }

  async getMediaThumbnail(messageId) {
    if (typeof this.whatsappClient.mediaHandler.getMediaThumbnail === 'function') {
      return await this.whatsappClient.mediaHandler.getMediaThumbnail(messageId);
    }
    return null;
  }

  async markAsRead(chatId) {
    return await this.whatsappClient.messageHandler.markAsRead(chatId);
  }

  // ==========================================
  // Métodos de multimedia
  // ==========================================

  async downloadMedia(messageId) {
    return await this.whatsappClient.mediaHandler.downloadMedia(messageId);
  }

  async getProfilePhoto(chatId) {
    return await this.whatsappClient.mediaHandler.getProfilePhoto(chatId);
  }

  // Métodos para gestionar el lock de Redis
  startLockRefresh() {
    if (this.lockRefreshInterval) {
      clearInterval(this.lockRefreshInterval);
    }
    // Refrescar el lock cada 5 segundos (la mitad del timeout del lock)
    this.lockRefreshInterval = setInterval(() => {
      stateManager.refreshLock().catch(err => {
        console.error('❌ Error refrescando el lock de sesión:', err);
        // Si no se puede refrescar, es crítico. Parar el intervalo.
        this.stopLockRefresh();
      });
    }, 5000);
  }

  stopLockRefresh() {
    if (this.lockRefreshInterval) {
      clearInterval(this.lockRefreshInterval);
      this.lockRefreshInterval = null;
      console.log('🛑 Refresco del lock detenido.');
    }
  }
}

module.exports = WhatsAppService;