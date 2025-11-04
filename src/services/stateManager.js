const redis = require('redis');
const config = require('../config');

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

  _getKey(adminId, keyType) {
    if (!adminId) throw new Error('adminId es requerido para generar una clave de Redis');
    return `session:${adminId}:${keyType}`;
  }

  async connect() {
    if (this.isConnected) return;
    try {
      await this.client.connect();
      this.isConnected = true;
      console.log('✅ Conectado a Redis');
    } catch (error) {
      console.error('❌ No se pudo conectar a Redis:', error);
      process.exit(1);
    }
  }

  /**
   * Intenta adquirir un lock para una sesión de WhatsApp específica.
   * @param {number} adminId
   * @returns {boolean} - True si el lock fue adquirido.
   */
  async acquireLock(adminId) {
    if (!this.isConnected) await this.connect();
    const lockKey = this._getKey(adminId, 'lock');
    const result = await this.client.set(lockKey, 'locked', {
      EX: LOCK_TIMEOUT_SECONDS,
      NX: true,
    });
    return result === 'OK';
  }

  /**
   * Libera el lock de una sesión.
   * @param {number} adminId
   */
  async releaseLock(adminId) {
    if (!this.isConnected) await this.connect();
    const lockKey = this._getKey(adminId, 'lock');
    return await this.client.del(lockKey);
  }

  /**
   * Refresca un lock para mantenerlo vivo.
   * @param {number} adminId
   */
  async refreshLock(adminId) {
    if (!this.isConnected) await this.connect();
    const lockKey = this._getKey(adminId, 'lock');
    const result = await this.client.set(lockKey, 'locked', {
        EX: LOCK_TIMEOUT_SECONDS,
        XX: true, // Solo actualiza si la clave ya existe
    });
    // Si el lock expiró y otro proceso lo tomó, set fallará y devolverá null.
    if (result === null) {
      throw new Error(`No se pudo refrescar el lock para el admin ${adminId}. Posiblemente expiró.`);
    }
    return result;
  }
}

// Exportar una única instancia (Singleton)
module.exports = new StateManager();
