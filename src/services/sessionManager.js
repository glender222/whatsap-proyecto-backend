const WhatsAppClient = require('./whatsapp/WhatsAppClient');
const stateManager = require('./stateManager');

let instance = null;

class SessionManager {
  constructor() {
    if (instance) {
      return instance;
    }
    this.sessions = new Map(); // Map<adminId, WhatsAppClient>
    this.io = null;
    instance = this;
  }

  /**
   * Establece la instancia de Socket.IO para pasarla a los clientes.
   * @param {SocketIO.Server} io
   */
  setSocketIO(io) {
    this.io = io;
  }

  /**
   * Inicia una nueva sesión de WhatsApp para un administrador.
   * @param {number} adminId
   * @returns {Promise<WhatsAppClient>}
   */
  async startSession(adminId) {
    if (this.sessions.has(adminId)) {
      throw new Error(`La sesión para el admin ${adminId} ya está activa.`);
    }

    console.log(`[SessionManager] Iniciando sesión para el admin ${adminId}...`);

    const onDisconnected = async () => {
      console.log(`[SessionManager] Sesión para el admin ${adminId} desconectada. Limpiando...`);
      this.sessions.delete(adminId);
      // No es necesario liberar el lock aquí, porque el EventHandler ya lo hace.
    };

    const client = new WhatsAppClient(adminId, onDisconnected);
    if (this.io) {
      client.setSocketIO(this.io);
    }

    this.sessions.set(adminId, client);

    try {
      await client.initialize();
      console.log(`[SessionManager] Sesión para el admin ${adminId} inicializada correctamente.`);
      return client;
    } catch (error) {
      console.error(`[SessionManager] Error al iniciar la sesión para el admin ${adminId}:`, error);
      // Si la inicialización falla, limpiar la sesión del mapa.
      this.sessions.delete(adminId);
      throw error; // Re-lanzar el error para que el controlador lo maneje.
    }
  }

  /**
   * Detiene la sesión de WhatsApp de un administrador.
   * @param {number} adminId
   * @returns {Promise<boolean>}
   */
  async stopSession(adminId) {
    const client = this.sessions.get(adminId);
    if (!client) {
      console.warn(`[SessionManager] No se encontró una sesión activa para el admin ${adminId} para detener.`);
      return false;
    }

    console.log(`[SessionManager] Deteniendo sesión para el admin ${adminId}...`);
    await client.logout(); // logout() maneja la destrucción y limpieza.
    this.sessions.delete(adminId);
    console.log(`[SessionManager] Sesión para el admin ${adminId} detenida.`);
    return true;
  }

  /**
   * Obtiene la instancia de WhatsAppClient para un administrador.
   * @param {number} adminId
   * @returns {WhatsAppClient | undefined}
   */
  getSession(adminId) {
    return this.sessions.get(adminId);
  }

  /**
   * Obtiene todas las sesiones activas.
   * @returns {Map<number, WhatsAppClient>}
   */
  getAllSessions() {
    return this.sessions;
  }
}

module.exports = new SessionManager();
