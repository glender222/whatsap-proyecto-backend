const WhatsAppClient = require('./whatsapp/WhatsAppClient');
const stateManager = require('./stateManager');

let instance = null;

class SessionManager {
  constructor() {
    if (instance) {
      return instance;
    }
    this.sessions = new Map(); // Almacena clientes activos: Map<adminId, WhatsAppClient>
    this.startingSessions = new Set(); // Previene race conditions: Set<adminId>
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
    // 1. Prevenir Race Conditions: Verificar si ya se está iniciando una sesión para este admin
    if (this.startingSessions.has(adminId)) {
      console.warn(`[SessionManager] Intento duplicado de iniciar sesión para el admin ${adminId} mientras ya estaba en proceso.`);
      throw new Error(`La sesión para el admin ${adminId} ya se está iniciando.`);
    }
    if (this.sessions.has(adminId)) {
        return this.sessions.get(adminId);
    }

    this.startingSessions.add(adminId); // Poner el "cerrojo"
    let tempLockRefreshInterval = null;

    try {
      // 2. Adquirir el lock distribuido
      const lockAcquired = await stateManager.acquireLock(adminId);
      if (!lockAcquired) {
        throw new Error(`No se pudo adquirir el lock para iniciar la sesión del admin ${adminId}. Otra instancia tiene el control.`);
      }

      // 3. Iniciar el refresco TEMPORAL del lock
      tempLockRefreshInterval = setInterval(() => {
        stateManager.refreshLock(adminId).catch(err => {
          console.error(`[SessionManager] Error crítico: Fallo al refrescar el lock TEMPORAL para ${adminId}.`, err);
          clearInterval(tempLockRefreshInterval);
        });
      }, 8000);

      console.log(`[SessionManager] Lock adquirido para ${adminId}. Iniciando cliente...`);

      const onDisconnected = () => {
        console.log(`[SessionManager] Sesión para ${adminId} desconectada. Limpiando...`);
        this.sessions.delete(adminId);
      };

      const client = new WhatsAppClient(adminId, onDisconnected, tempLockRefreshInterval);
      if (this.io) {
        client.setSocketIO(this.io);
      }

      await client.initialize();

      this.sessions.set(adminId, client);
      console.log(`[SessionManager] Sesión para ${adminId} inicializada correctamente.`);
      return client;

    } catch (error) {
      console.error(`[SessionManager] Error al iniciar la sesión para ${adminId}:`, error.message);
      // Si algo falla, limpiar los recursos que se hayan podido crear
      if (tempLockRefreshInterval) {
        clearInterval(tempLockRefreshInterval);
      }
      // Liberar el lock solo si se llegó a adquirir (esto es idempotente)
      await stateManager.releaseLock(adminId);
      throw error;
    } finally {
      // 4. Quitar el "cerrojo" sin importar si hubo éxito o error
      this.startingSessions.delete(adminId);
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
      // Intentar liberar el lock de todas formas por si quedó colgado
      await stateManager.releaseLock(adminId);
      return false;
    }

    console.log(`[SessionManager] Deteniendo sesión para el admin ${adminId}...`);
    
    // logout() maneja la destrucción y limpieza completa del cliente
    await client.logout();
    
    // Liberar el lock de Redis para permitir que otras instancias (o una futura sesión) puedan tomar el control
    console.log(`[SessionManager] Liberando lock de Redis para ${adminId}...`);
    await stateManager.releaseLock(adminId);
    
    // Eliminar la sesión del Map
    this.sessions.delete(adminId);
    
    console.log(`[SessionManager] Sesión para el admin ${adminId} detenida y limpiada completamente.`);
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
