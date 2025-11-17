/**
 * ChatManager
 * Responsable de gestionar la lista de chats (cargar, actualizar, ordenar)
 */
const ChatValidator = require('./ChatValidator');
const { sortChatsByActivity } = require("../../utils/chatUtils");

class ChatManager {
  constructor(whatsappClient) {
    this.whatsappClient = whatsappClient;
    this.config = require("../../config");
  }

  /**
   * Carga todos los chats del usuario
   */
  async loadChats() {
    // EMITIR EVENTO ANTES de obtener chats
    if (this.whatsappClient.socketIO) {
      this.whatsappClient.socketIO.emit("loading-chats", {
        status: "fetching",
        message: "Obteniendo lista de chats..."
      });
    }
    console.log("📡 Obteniendo chats desde WhatsApp...");
    
    const chats = await this.whatsappClient.client.getChats();
    const validChats = chats.filter(chat => ChatValidator.isValidChat(chat));
    console.log(`Total de chats obtenidos: ${chats.length}`);
    console.log(`Chats válidos: ${validChats.length}`);
    
    // EMITIR EVENTO de inicio de procesamiento
    if (this.whatsappClient.socketIO) {
      this.whatsappClient.socketIO.emit("loading-chats", {
        status: "processing",
        total: validChats.length,
        message: `Procesando ${validChats.length} chats...`
      });
    }
    
    const INITIAL_BATCH = 50; // Primeros 50 chats para carga rápida
    const PROGRESSIVE_BATCH = 20; // Lotes de 20 para carga progresiva
    const MAX_CONCURRENT_PHOTOS = 5; // Máximo 5 fotos descargando en paralelo
    
    // FASE 1: Carga rápida de primeros 50 (SIN obtener mensajes)
    const initialChats = validChats.slice(0, INITIAL_BATCH);
    console.log(`⚡ Cargando primeros ${initialChats.length} chats...`);
    
    // Procesar chats de forma ULTRA-RÁPIDA (sin fetchMessages)
    this.whatsappClient.chatsList = await Promise.all(
      initialChats.map(async (chat) => await this._processChatFast(chat))
    );
    
    // Ordenar
    this.whatsappClient.chatsList = ChatValidator.sortChats(this.whatsappClient.chatsList);
    
    // Emitir INMEDIATAMENTE al frontend (SIN ESPERAR FOTOS)
    if (this.whatsappClient.socketIO) {
      this.whatsappClient.socketIO.emit("chats-updated", this.whatsappClient.chatsList);
      this.whatsappClient.socketIO.emit("loading-chats", {
        status: "initial-loaded",
        loaded: this.whatsappClient.chatsList.length,
        total: validChats.length,
        percentage: Math.round((this.whatsappClient.chatsList.length / validChats.length) * 100),
        message: `${this.whatsappClient.chatsList.length} de ${validChats.length} chats cargados`
      });
    }
    
    console.log(`✅ Primeros ${this.whatsappClient.chatsList.length} chats cargados y enviados al frontend`);
    
    // Descargar fotos en paralelo CON TIMEOUT (EN SEGUNDO PLANO, no bloquea)
    const socketIO = this.whatsappClient.socketIO;
    this._downloadPhotosWithLimitBackground(initialChats, MAX_CONCURRENT_PHOTOS, socketIO);
    
    // FASE 2: Carga progresiva del resto (EN SEGUNDO PLANO, sin esperar)
    if (validChats.length > INITIAL_BATCH) {
      const remainingChats = validChats.slice(INITIAL_BATCH);
      console.log(`📦 Cargando ${remainingChats.length} chats restantes en segundo plano...`);
      
      // Capturar socketIO ahora (puede cambiar después)
      const socketIO = this.whatsappClient.socketIO;
      console.log(`[FASE2] socketIO disponible: ${socketIO ? '✅ SÍ' : '❌ NO'}`);
      
      // Iniciar carga sin esperar (método separado para acceso correcto a 'this')
      this._loadRemainingChatsBackground(remainingChats, PROGRESSIVE_BATCH, MAX_CONCURRENT_PHOTOS, validChats.length, socketIO);
    } else {
      // Si hay menos de 50 chats, notificar finalización
      if (this.whatsappClient.socketIO) {
        this.whatsappClient.socketIO.emit("loading-chats", {
          status: "completed",
          loaded: this.whatsappClient.chatsList.length,
          total: validChats.length,
          percentage: 100,
          message: "Todos los chats cargados"
        });
      }
    }
  }

  /**
   * Carga los chats restantes en background sin bloquear
   */
  async _loadRemainingChatsBackground(remainingChats, PROGRESSIVE_BATCH, MAX_CONCURRENT_PHOTOS, totalChats, socketIO) {
    try {
      console.log(`\n[BACKGROUND] 🔄 INICIANDO CARGA DE ${remainingChats.length} CHATS RESTANTES`);
      console.log(`[BACKGROUND] Parámetros: BATCH=${PROGRESSIVE_BATCH}, FOTOS=${MAX_CONCURRENT_PHOTOS}, TOTAL=${totalChats}`);
      console.log(`[BACKGROUND] Socket.IO disponible: ${socketIO ? '✅' : '❌'}\n`);
      
      for (let i = 0; i < remainingChats.length; i += PROGRESSIVE_BATCH) {
        const batch = remainingChats.slice(i, i + PROGRESSIVE_BATCH);
        
        try {
          // Procesar chats sin esperar fotos
          const processedBatch = await Promise.all(
            batch.map(async (chat) => await this._processChatMinimal(chat))
          );
          
          this.whatsappClient.chatsList.push(...processedBatch);
          
          // Descargar fotos en paralelo
          await this._downloadPhotosWithLimit(batch, MAX_CONCURRENT_PHOTOS);
          
          // Reordenar después de cada lote
          this.whatsappClient.chatsList = ChatValidator.sortChats(this.whatsappClient.chatsList);
          
          // Emitir actualización progresiva EN TIEMPO REAL
          const percentage = Math.round((this.whatsappClient.chatsList.length / totalChats) * 100);
          
          if (socketIO) {
            socketIO.emit("chats-updated", this.whatsappClient.chatsList);
            socketIO.emit("loading-chats", {
              status: "loading",
              loaded: this.whatsappClient.chatsList.length,
              total: totalChats,
              percentage: percentage,
              message: `Cargando chats: ${this.whatsappClient.chatsList.length}/${totalChats} (${percentage}%)`
            });
          }
          
          console.log(`[BACKGROUND] 📊 Progreso: ${this.whatsappClient.chatsList.length}/${totalChats} (${percentage}%)`);
          
        } catch (error) {
          console.error(`[BACKGROUND] Error procesando lote en posición ${i}:`, error.message);
        }
      }
      
      // Notificar finalización
      if (socketIO) {
        socketIO.emit("loading-chats", {
          status: "completed",
          loaded: this.whatsappClient.chatsList.length,
          total: totalChats,
          percentage: 100,
          message: "Todos los chats cargados"
        });
      }
      
      console.log(`[BACKGROUND] ✅ Carga completa: ${this.whatsappClient.chatsList.length} chats en total`);
    } catch (error) {
      console.error(`[BACKGROUND] Error en carga de chats restantes:`, error.message);
    }
  }

  /**
   * Procesa un chat de forma ULTRA-RÁPIDA (sin obtener mensajes) - solo metadata
   * Usado en FASE 1 para carga inmediata
   */
  async _processChatFast(chat) {
    return {
      id: chat.id._serialized,
      name: chat.name || chat.id.user,
      lastMessageTimestamp: chat.timestamp || 0,
      unreadCount: chat.unreadCount || 0,
      isGroup: chat.isGroup || false,
      lastMessagePreview: null,  // Sin previsualizaciones en carga rápida
      profilePhotoUrl: null      // Se rellenará después con fotos
    };
  }

  /**
   * Procesa un chat de forma MINIMAL (sin foto) para carga rápida
   */
  async _processChatMinimal(chat) {
    let lastMessageTimestamp = 0;
    let lastMessage = null;
    
    try {
      const messages = await chat.fetchMessages({ limit: 10 });
      messages.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
      
      for (const msg of messages) {
        if (ChatValidator.isRealMessage(msg)) {
          lastMessage = msg;
          lastMessageTimestamp = msg.timestamp;
          break;
        }
      }
    } catch (error) {
      console.log(`Error obteniendo mensajes para ${chat.name || chat.id.user}: ${error.message}`);
    }
    
    if (lastMessageTimestamp === 0) {
      if (chat.isGroup) {
        lastMessageTimestamp = 1;
      } else if (chat.timestamp) {
        lastMessageTimestamp = chat.timestamp;
      }
    }
    
    return {
      id: chat.id._serialized,
      name: chat.name || chat.id.user,
      lastMessageTimestamp,
      unreadCount: chat.unreadCount || 0,
      isGroup: chat.isGroup || false,
      lastMessagePreview: lastMessage ? 
        ((lastMessage.body && lastMessage.body.trim()) ? 
          lastMessage.body.substring(0, 50) : 
          (lastMessage.hasMedia ? '[Media]' : null)) : null,
      profilePhotoUrl: null  // Se rellenará después
    };
  }

  /**
   * Descarga fotos con timeout - NO bloquea, se ejecuta en background
   */
  async _downloadPhotosWithLimitBackground(chats, maxConcurrent, socketIO) {
    try {
      await Promise.race([
        this._downloadPhotosWithLimit(chats, maxConcurrent),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout descargando fotos')), 10000))
      ]);
    } catch (error) {
      console.warn(`⚠️ Timeout o error descargando fotos FASE 1: ${error.message}`);
      // Continuar sin fotos - no es crítico
    }
  }

  /**
   * Descarga fotos de perfil con límite de concurrencia
   */
  async _downloadPhotosWithLimit(chats, maxConcurrent) {
    const queue = chats.map((chat, idx) => ({ chat, idx }));
    let processing = 0;
    const promises = [];
    
    // URL base del servidor para construir URLs públicas
    const serverUrl = process.env.SERVER_URL || 'http://localhost:3000';
    
    const processNext = async () => {
      if (queue.length === 0 || processing >= maxConcurrent) {
        return;
      }
      
      processing++;
      const { chat, idx } = queue.shift();
      
      try {
        const photoUrl = await this.whatsappClient.mediaHandler.getProfilePhoto(chat.id._serialized);
        
        if (photoUrl) {
          if (typeof photoUrl === 'string' && /^https?:\/\//i.test(photoUrl)) {
            // URL remota - usarla directamente
            this.whatsappClient.chatsList[idx].profilePhotoUrl = photoUrl;
          } else if (typeof photoUrl === 'string') {
            // Path local - convertir a URL pública
            const fs = require('fs');
            const path = require('path');
            if (fs.existsSync(photoUrl)) {
              const filename = path.basename(photoUrl);
              // URL pública completa para que el frontend pueda acceder
              const publicUrl = `${serverUrl}/profile-data/${encodeURIComponent(filename)}`;
              this.whatsappClient.chatsList[idx].profilePhotoUrl = publicUrl;
            }
          }
        }
      } catch (error) {
        // Silenciar errores de foto
      }
      
      processing--;
      
      // Procesar siguiente
      if (queue.length > 0) {
        return processNext();
      }
    };
    
    // Iniciar procesamiento concurrente
    for (let i = 0; i < maxConcurrent; i++) {
      promises.push(processNext());
    }
    
    await Promise.all(promises);
  }

  /**
   * Procesa un chat individual para agregarlo a la lista
   * @param {Object} chat - Chat de WhatsApp
   * @returns {Object} - Objeto con datos del chat
   */
  async processChatForList(chat) {
    let lastMessageTimestamp = 0;
    let lastMessage = null;
    let profilePhotoUrl = null;
    
    // URL base del servidor para construir URLs públicas
    const serverUrl = process.env.SERVER_URL || 'http://localhost:3000';
    
    try {
      // Obtener más mensajes para filtrar eventos de sistema
      const messages = await chat.fetchMessages({ limit: 10 });

      // Asegurar que iteramos desde el más reciente al más antiguo
      messages.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

      // Buscar el último mensaje real (más reciente)
      for (const msg of messages) {
        if (ChatValidator.isRealMessage(msg)) {
          lastMessage = msg;
          lastMessageTimestamp = msg.timestamp;
          break;
        }
      }
      
    } catch (error) {
      console.log(`Error obteniendo mensajes para ${chat.name || chat.id.user}: ${error.message}`);
    }
    
    // Obtener foto de perfil en paralelo (no bloquea)
    try {
      const photoUrl = await this.whatsappClient.mediaHandler.getProfilePhoto(chat.id._serialized);
      
      // Si devolvió una URL remota (http/https)
      if (typeof photoUrl === 'string' && /^https?:\/\//i.test(photoUrl)) {
        profilePhotoUrl = photoUrl;
      }
      // Si devolvió un path local, convertir a URL pública absoluta
      else if (photoUrl && typeof photoUrl === 'string') {
        const fs = require('fs');
        const path = require('path');
        if (fs.existsSync(photoUrl)) {
          const filename = path.basename(photoUrl);
          // URL pública completa para que el frontend pueda acceder
          profilePhotoUrl = `${serverUrl}/profile-data/${encodeURIComponent(filename)}`;
        }
      }
    } catch (error) {
      // Silenciar errores de foto de perfil - es opcional
      if (error.message !== 'No hay foto de perfil') {
        console.debug(`No se pudo obtener foto de perfil para ${chat.id._serialized}:`, error.message);
      }
      profilePhotoUrl = null;
    }
    
    // Si no hay mensajes reales, usar timestamp muy bajo para que aparezca al final
    if (lastMessageTimestamp === 0) {
      if (chat.isGroup) {
        // Para grupos sin mensajes reales, usar timestamp muy bajo
        lastMessageTimestamp = 1;
      } else if (chat.timestamp) {
        // Para contactos individuales, usar timestamp del chat
        lastMessageTimestamp = chat.timestamp;
      }
    }
    
    return {
      id: chat.id._serialized,
      name: chat.name || chat.id.user,
      lastMessageTimestamp,
      unreadCount: chat.unreadCount || 0,
      isGroup: chat.isGroup || false,
      lastMessagePreview: lastMessage ? 
        ((lastMessage.body && lastMessage.body.trim()) ? 
          lastMessage.body.substring(0, 50) : 
          (lastMessage.hasMedia ? '[Media]' : null)) : null,
      profilePhotoUrl: profilePhotoUrl
    };
  }

  /**
   * Actualiza un chat en la lista
   * @param {Object} chat - Chat de WhatsApp
   * @param {number} timestamp - Timestamp del mensaje
   * @param {Object} msg - Mensaje (opcional)
   */
  async updateChatInList(chat, timestamp, msg = null) {
    const chatId = chat.id._serialized;
    const idx = this.whatsappClient.chatsList.findIndex((c) => c.id === chatId);
    const previewFromMsg = msg ? 
      ((msg.body && msg.body.trim()) ? 
        msg.body.substring(0, 50) : 
        (msg.hasMedia ? '[Media]' : null)) : null;

    if (idx > -1) {
      this.whatsappClient.chatsList[idx].lastMessageTimestamp = timestamp;
      this.whatsappClient.chatsList[idx].unreadCount = chat.unreadCount || 0;
      this.whatsappClient.chatsList[idx].name = chat.name || chat.id.user;
      // Actualizar preview si recibimos el mensaje real en tiempo real
      if (previewFromMsg) {
        this.whatsappClient.chatsList[idx].lastMessagePreview = previewFromMsg;
      }
      // Mantener profilePhotoUrl si ya existe
      if (!this.whatsappClient.chatsList[idx].profilePhotoUrl) {
        this._updateProfilePhoto(chatId, idx);
      }
    } else {
      const newChat = {
        id: chatId,
        name: chat.name || chat.id.user,
        lastMessageTimestamp: timestamp,
        unreadCount: chat.unreadCount || 0,
        lastMessagePreview: previewFromMsg || null,
        profilePhotoUrl: null
      };
      this.whatsappClient.chatsList.push(newChat);
      // Intentar obtener foto de perfil en segundo plano
      this._updateProfilePhoto(chatId, this.whatsappClient.chatsList.length - 1);
    }
    
    this.whatsappClient.chatsList = sortChatsByActivity(this.whatsappClient.chatsList);
  }

  /**
   * Actualiza la foto de perfil de un chat (operación en segundo plano)
   */
  _updateProfilePhoto(chatId, idx) {
    try {
      // URL base del servidor para construir URLs públicas
      const serverUrl = process.env.SERVER_URL || 'http://localhost:3000';
      
      this.whatsappClient.mediaHandler.getProfilePhoto(chatId).then(photoUrl => {
        if (photoUrl && idx < this.whatsappClient.chatsList.length) {
          if (typeof photoUrl === 'string' && /^https?:\/\//i.test(photoUrl)) {
            this.whatsappClient.chatsList[idx].profilePhotoUrl = photoUrl;
          } else if (typeof photoUrl === 'string') {
            const fs = require('fs');
            const path = require('path');
            if (fs.existsSync(photoUrl)) {
              const filename = path.basename(photoUrl);
              // URL pública completa para que el frontend pueda acceder
              this.whatsappClient.chatsList[idx].profilePhotoUrl = `${serverUrl}/profile-data/${encodeURIComponent(filename)}`;
            }
          }
        }
      }).catch(() => {
        // Silenciar errores de foto de perfil
      });
    } catch (error) {
      // Silenciar errores
    }
  }

  /**
   * Refresca los chats recientes (polling ligero)
   */
  async refreshRecentChats() {
    if (!this.whatsappClient.client || !this.whatsappClient.isConnected) return;

    try {
      const pollLimit = this.config.whatsapp.pollLimit || 20;
      const chats = await this.whatsappClient.client.getChats();
      const toCheck = chats
        .filter(chat => ChatValidator.isValidChat(chat))
        .slice(0, pollLimit);

      for (const chat of toCheck) {
        try {
          const messages = await chat.fetchMessages({ limit: 1 });
          if (!messages || messages.length === 0) continue;
          const msg = messages[0];
          if (!ChatValidator.isRealMessage(msg)) continue;

          const chatId = chat.id._serialized;
          const idx = this.whatsappClient.chatsList.findIndex(c => c.id === chatId);
          const lastTs = msg.timestamp || 0;

          if (idx === -1) {
            // No estaba en la lista, agregar
            this.whatsappClient.chatsList.push({
              id: chatId,
              name: chat.name || chat.id.user,
              lastMessageTimestamp: lastTs,
              unreadCount: chat.unreadCount || 0,
              lastMessagePreview: (msg.body && msg.body.trim()) ? 
                msg.body.substring(0,50) : 
                (msg.hasMedia ? '[Media]' : null),
              profilePhotoUrl: null
            });
            continue;
          }

          // Si el mensaje polled es más reciente que lo que tenemos, actualizar
          if ((this.whatsappClient.chatsList[idx].lastMessageTimestamp || 0) < lastTs) {
            this.whatsappClient.chatsList[idx].lastMessageTimestamp = lastTs;
            this.whatsappClient.chatsList[idx].unreadCount = chat.unreadCount || 0;
            this.whatsappClient.chatsList[idx].name = chat.name || chat.id.user;
            this.whatsappClient.chatsList[idx].lastMessagePreview = (msg.body && msg.body.trim()) ? 
              msg.body.substring(0,50) : 
              (msg.hasMedia ? '[Media]' : null);
          }

        } catch (e) {
          console.debug('Error polling chat', chat.id?._serialized, e.message || e);
        }
      }

      // Reordenar y emitir si hay cambios
      this.whatsappClient.chatsList = sortChatsByActivity(this.whatsappClient.chatsList);
      if (this.whatsappClient.socketIO) {
        this.whatsappClient.socketIO.emit('chats-updated', this.whatsappClient.chatsList);
      }

    } catch (error) {
      console.warn('Error en refreshRecentChats (global):', error.message || error);
    }
  }
}

module.exports = ChatManager;
