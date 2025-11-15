/**
 * WhatsAppClient
 * Cliente principal de WhatsApp - Gestiona la conexión y coordinación de componentes
 */
const { Client, LocalAuth } = require("whatsapp-web.js");
const fs = require("fs");
const path = require("path");
const config = require("../../config");

const EventHandler = require("./EventHandler");
const ChatManager = require("./ChatManager");
const MessageHandler = require("./MessageHandler");
const MediaHandler = require("./MediaHandler");

class WhatsAppClient {
  constructor(adminId, onDisconnectedCallback = () => {}, tempLockRefreshInterval = null) {
    if (!adminId) {
      throw new Error('WhatsAppClient requiere un adminId');
    }
    this.adminId = adminId;
    this.client = null;
    this.chatsList = [];
    this.qrImage = "";
    this.isConnected = false;
    this.socketIO = null;
    this.isIntentionalLogout = false;
    this.cacheFilePath = path.join(config.whatsapp.sessionPath, `session-${this.adminId}`, '.chats-cache.json');
    this._pollInterval = null;
    
    // Inicializar componentes, pasando el intervalo temporal al EventHandler
    this.eventHandler = new EventHandler(this, onDisconnectedCallback, tempLockRefreshInterval);
    this.chatManager = new ChatManager(this);
    this.messageHandler = new MessageHandler(this);
    this.mediaHandler = new MediaHandler(this);
    
    this.initializeDirectories();
  }

  /**
   * Inicializa los directorios necesarios
   */
  initializeDirectories() {
    if (!fs.existsSync(config.whatsapp.profileDir)) {
      fs.mkdirSync(config.whatsapp.profileDir, { recursive: true });
    }
    if (!fs.existsSync(config.whatsapp.uploadDir)) {
      fs.mkdirSync(config.whatsapp.uploadDir, { recursive: true });
    }
  }

  /**
   * Establece la instancia de Socket.IO
   * @param {Object} io - Instancia de Socket.IO
   */
  setSocketIO(io) {
    this.socketIO = io;
  }

  /**
   * Inicializa el cliente de WhatsApp
   */
  async initialize() {
    const sessionPath = path.join(config.whatsapp.sessionPath, `session-${this.adminId}`);

    this.client = new Client({
      authStrategy: new LocalAuth({
        clientId: `session-${this.adminId}`,
        dataPath: sessionPath
      }),
      puppeteer: {
        headless: true,
        executablePath: process.env.CHROME_PATH, // Permite especificar la ruta de Chrome
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu'
        ],
      }
    });

    this.eventHandler.setupEventHandlers(this.client);
    
    // Timeout para detectar cuelgues en initialize()
    const INIT_TIMEOUT = 60000; // 60 segundos
    
    try {
      await Promise.race([
        this.client.initialize(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Initialize timeout after 60s')), INIT_TIMEOUT)
        )
      ]);
    } catch (error) {
      console.error('❌ Error o timeout en initialize:', error.message);
      
      console.log('🧹 Limpiando posible sesión corrupta tras error en initialize...');
      try {
        if (this.client) {
          // Intentar destruir el cliente para cerrar el navegador y liberar archivos
          await this.client.destroy();
          console.log('✅ Cliente destruido después del fallo.');
        }
      } catch (destroyError) {
        console.warn('⚠️ Error al destruir el cliente después del fallo (la limpieza continuará):', destroyError.message);
      }

      // Limpiar los datos de la sesión y resetear el estado
      this.clearLocalData();
      this.client = null; // Asegurarse de que la instancia del cliente se elimine

      // Re-lanzar el error para que el llamador (SessionManager) sepa que falló
      throw new Error(`Fallo en la inicialización: ${error.message}. La sesión se ha limpiado.`);
    }
  }

  /**
   * Obtiene el código QR actual
   * @returns {string} - Imagen QR en base64
   */
  getQR() {
    return this.qrImage;
  }

  /**
   * Obtiene el estado actual de la conexión
   * @returns {Object} - Estado de la conexión
   */
  getStatus() {
    let state = "DISCONNECTED";
    let isReady = false;
    
    try {
      if (this.client && this.isConnected) {
        state = this.client.getState() || "DISCONNECTED";
        isReady = this.client.info ? true : false;
      }
    } catch (error) {
      console.warn("Error obteniendo estado:", error.message);
      state = "DISCONNECTED";
      isReady = false;
    }
    
    return {
      status: state,
      isReady: isReady && this.isConnected,
      hasQR: this.qrImage ? true : false,
      isConnected: this.isConnected
    };
  }

  /**
   * Obtiene la lista de chats
   * @returns {Array} - Lista de chats
   */
  getChats() {
    return this.chatsList;
  }

  /**
   * Obtiene la información del usuario conectado
   * @returns {Object|null} - Información del usuario
   */
  getMyInfo() {
    // Verificar múltiples condiciones para asegurar que hay sesión válida
    if (!this.client || 
        !this.client.info || 
        !this.isConnected || 
        this.client.getState() === "DISCONNECTED") {
      return null;
    }
    
    try {
      return {
        id: this.client.info.wid._serialized,
        user: this.client.info.wid.user,
      };
    } catch (error) {
      console.warn("Error obteniendo info del usuario:", error.message);
      return null;
    }
  }

  /**
   * Cierra sesión y limpia datos COMPLETAMENTE (sin reinicializar)
   */
  async logout() {
    console.log(`[${this.adminId}] 🔴 Iniciando proceso de logout COMPLETO...`);
    
    // Detener inmediatamente el refresco del lock para evitar renovaciones accidentales
    this.eventHandler.stopLockRefresh();

    // Marcar como logout intencional
    this.isIntentionalLogout = true;
    
    // PASO 1: PRIMERO notificar al frontend para activar animación de cierre
    if (this.socketIO) {
      console.log("🔴 Notificando logout al frontend (ANTES de limpiar datos)...");
      this.socketIO.emit("disconnected", { reason: "LOGOUT", status: "disconnected" });
      // Esperar 500ms para que la animación comience antes de limpiar datos
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    // PASO 2: Intentar cerrar WhatsApp (desconexión REAL del teléfono)
    try {
      if (this.client && this.client.getState() !== "DISCONNECTED") {
        console.log("🔴 Cerrando sesión de WhatsApp (esto desconectará del teléfono)...");
        await this.client.logout();
        console.log("✅ Sesión de WhatsApp cerrada - el teléfono debe mostrar 'desconectado'");
      } else {
        console.log("⚠️ WhatsApp ya estaba desconectado");
      }
    } catch (error) {
      console.warn("⚠️ Error al cerrar sesión de WhatsApp (continuando limpieza):", error.message);
    }
    
    // PASO 3: Destruir cliente (cierra navegador puppeteer)
    try {
      if (this.client) {
        console.log("🔴 Destruyendo cliente...");
        await this.client.destroy();
        console.log("✅ Cliente destruido");
      }
    } catch (error) {
      console.warn("⚠️ Error al destruir cliente (continuando limpieza):", error.message);
    }
    
    // PASO 4: Limpiar TODOS los datos locales (sesión, cache, uploads, fotos)
    console.log("🔴 Limpiando TODOS los datos locales...");
    this.clearLocalData();
    
    if (this.socketIO) {
      this.socketIO.emit("chats-updated", []);
    }
    
    // PASO 5: Reinicializar completamente el estado
    this.client = null;
    this.isConnected = false;
    
    // Resetear marca de logout intencional
    this.isIntentionalLogout = false;
    
    console.log("✅ Logout COMPLETO exitoso - sesión eliminada permanentemente");
    
    // NO reinicializamos el cliente - el usuario debe llamar a /init nuevamente si quiere reconectar
    
    return true;
  }

  /**
   * Limpia todos los datos locales (sesión, cache, perfiles, uploads)
   */
  clearLocalData() {
    this.chatsList = [];
    this.qrImage = "";
    this.isConnected = false;
    
    const sessionPath = path.join(config.whatsapp.sessionPath, `session-${this.adminId}`);
    // 1. Limpiar sesión local específica del tenant
    if (fs.existsSync(sessionPath)) {
      console.log(`🧹 Eliminando carpeta de sesión: ${sessionPath}`);
      fs.rmSync(sessionPath, { recursive: true, force: true });
      console.log(`✅ Carpeta de sesión eliminada`);
    }
    
    // 2. Limpiar cache de perfiles (fotos de perfil)
    if (fs.existsSync(config.whatsapp.profileDir)) {
      console.log(`🧹 Eliminando fotos de perfil en: ${config.whatsapp.profileDir}`);
      const files = fs.readdirSync(config.whatsapp.profileDir);
      let deletedCount = 0;
      files.forEach(file => {
        const filePath = path.join(config.whatsapp.profileDir, file);
        try {
          fs.unlinkSync(filePath);
          deletedCount++;
        } catch (e) {
          console.warn("⚠️ No se pudo eliminar:", filePath, e.message);
        }
      });
      console.log(`✅ ${deletedCount} fotos de perfil eliminadas`);
    }
    
    // 3. Limpiar archivos descargados (uploads)
    if (fs.existsSync(config.whatsapp.uploadDir)) {
      console.log(`🧹 Eliminando archivos descargados en: ${config.whatsapp.uploadDir}`);
      const files = fs.readdirSync(config.whatsapp.uploadDir);
      let deletedCount = 0;
      files.forEach(file => {
        const filePath = path.join(config.whatsapp.uploadDir, file);
        try {
          fs.unlinkSync(filePath);
          deletedCount++;
        } catch (e) {
          console.warn("⚠️ No se pudo eliminar:", filePath, e.message);
        }
      });
      console.log(`✅ ${deletedCount} archivos descargados eliminados`);
    }
    
    console.log("✅ Limpieza de datos locales completada");
  }

  /**
   * Destruye el cliente
   */
  async destroy() {
    if (this.client) {
      await this.client.destroy();
    }
  }
}

module.exports = WhatsAppClient;
