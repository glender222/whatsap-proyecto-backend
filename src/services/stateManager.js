const redis = require('redis');
const config = require('../config');

// Constantes para las claves de Redis
const SESSION_ADMIN_ID_KEY = 'whatsapp_session:admin_id';
const SESSION_LOCK_KEY = 'whatsapp_session:lock';
const LOCK_TIMEOUT_SECONDS = 10; // Tiempo que una instancia mantiene el lock

let instance = null;

class StateManager {
  constructor() {
    if (instance) {
      return instance;
    }

    this.client = redis.createClient({
      socket: {
        host: config.redis.host,
        port: config.redis.port,
      },
      password: config.redis.password,
    });

    this.client.on('error', (err) => console.error('Redis Client Error', err));
    this.isConnected = false;
    instance = this;
  }

  async connect() {
    if (this.isConnected) return;
    try {
      await this.client.connect();
      this.isConnected = true;
      console.log('✅ Conectado a Redis');
    } catch (error) {
      console.error('❌ No se pudo conectar a Redis:', error);
      // Salir si Redis no está disponible, ya que es crítico
      process.exit(1);
    }
  }

  async setSessionAdmin(adminId) {
    if (!this.isConnected) await this.connect();
    return await this.client.set(SESSION_ADMIN_ID_KEY, adminId);
  }

  async getSessionAdmin() {
    if (!this.isConnected) await this.connect();
    return await this.client.get(SESSION_ADMIN_ID_KEY);
  }

  /**
   * Intenta adquirir un lock para la sesión de WhatsApp.
   * Utiliza un set con NX (not exists) y EX (expire) para asegurar atomicidad.
   * @returns {boolean} - True si el lock fue adquirido, false en caso contrario.
   */
  async acquireLock() {
    if (!this.isConnected) await this.connect();
    // El 'OK' es la respuesta estándar de Redis para un SET exitoso.
    const result = await this.client.set(SESSION_LOCK_KEY, 'locked', {
      EX: LOCK_TIMEOUT_SECONDS,
      NX: true,
    });
    return result === 'OK';
  }

  /**
   * Libera el lock de la sesión.
   */
  async releaseLock() {
    if (!this.isConnected) await this.connect();
    return await this.client.del(SESSION_LOCK_KEY);
  }

  /**
   * Refresca el lock para mantenerlo vivo.
   */
  async refreshLock() {
    if (!this.isConnected) await this.connect();
    // Usamos EX para renovar el tiempo de expiración
    return await this.client.set(SESSION_LOCK_KEY, 'locked', {
        EX: LOCK_TIMEOUT_SECONDS,
        XX: true, // Only set the key if it already exists
    });
  }
}

// Exportar una única instancia (Singleton)
module.exports = new StateManager();
