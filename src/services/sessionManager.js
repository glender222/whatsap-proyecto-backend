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
    // 1. Adquirir el lock ANTES de iniciar cualquier cosa
    const lockAcquired = await stateManager.acquireLock(adminId);
    if (!lockAcquired) {
      // Este caso es normal en un entorno multi-instancia. Significa que otra instancia ya está trabajando.
      console.log(`[SessionManager] No se pudo adquirir el lock para el admin ${adminId}. Otra instancia probablemente ya tiene el control.`);
      throw new Error(`No se pudo adquirir el lock para iniciar la sesión del admin ${adminId}.`);
    }

    // 2. Si se adquiere el lock, iniciar el refresco TEMPORAL
    let tempLockRefreshInterval = setInterval(() => {
      stateManager.refreshLock(adminId).catch(err => {
        console.error(`[SessionManager] Error crítico: Fallo al refrescar el lock TEMPORAL para ${adminId}. Limpiando intervalo.`, err);
        clearInterval(tempLockRefreshInterval);
      });
    }, 8000); // 8 segundos

    console.log(`[SessionManager] Lock adquirido para ${adminId}. Iniciando cliente de WhatsApp...`);

    const onDisconnected = () => {
      console.log(`[SessionManager] Sesión para el admin ${adminId} desconectada. Limpiando...`);
      this.sessions.delete(adminId);
      // La liberación del lock y la detención del intervalo permanente ya se manejan en EventHandler
    };

    // Pasar el intervalo temporal al cliente
    const client = new WhatsAppClient(adminId, onDisconnected, tempLockRefreshInterval);
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

      // Si la inicialización falla, es CRÍTICO limpiar todo
      clearInterval(tempLockRefreshInterval);
      await stateManager.releaseLock(adminId);
      this.sessions.delete(adminId);

      throw error;
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
