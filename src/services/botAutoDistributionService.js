/**
 * Servicio de Distribución Automática de Bot
 * 
 * Escucha mensajes entrantes y:
 * 1. Detecta bot activo del owner
 * 2. Verifica modalidad (options/keywords)
 * 3. Chequea si chat ya tiene sesión activa
 * 4. Si no la tiene, envía welcome_message + opciones enumeradas
 * 5. Si el usuario responde con número, asigna tag correspondiente
 */

const Bot = require('../models/Bot');
const BotRule = require('../models/BotRule');
const BotChatSession = require('../models/BotChatSession');
const Tag = require('../models/Tag');

class BotAutoDistributionService {
  /**
   * Procesar mensaje entrante
   * @param {Object} message - Objeto mensaje de WhatsApp
   * @param {string} message.from - Chat ID (ej: 51912345678@c.us)
   * @param {string} message.body - Contenido del mensaje
   * @param {Object} message.contact - Información del contacto
   * @param {Object} whatsappClient - Cliente de WhatsApp para enviar respuestas
   * @param {number} tenantId - ID del tenant/owner
   */
  static async processIncomingMessage(message, whatsappClient, tenantId) {
    try {
      const chatId = message.from;
      const userMessage = message.body?.trim();

      // Ignorar mensajes vacíos o de grupos (opcional)
      if (!userMessage) {
        console.log(`[Bot] Mensaje vacío ignorado de ${chatId}`);
        return;
      }

      // 1. Obtener bot activo del owner
      const activeBot = await this.getActiveBot(tenantId);
      if (!activeBot) {
        console.log(`[Bot] No hay bot activo para tenant ${tenantId}`);
        return;
      }

      console.log(`[Bot] Bot activo encontrado: ${activeBot.name} (ID: ${activeBot.id}, Modalidad: ${activeBot.modality})`);

      // 2. Verificar si chat ya tiene sesión activa
      const existingSession = await BotChatSession.hasActiveSession(chatId, activeBot.id);

      if (existingSession) {
        // Si la sesión está en 'pending', procesar respuesta del usuario
        if (existingSession.status === 'pending') {
          console.log(`[Bot] Sesión pending encontrada para ${chatId}, procesando respuesta...`);
          await this.handleUserResponse(existingSession, userMessage, whatsappClient, activeBot);
        } 
        // Si la sesión está en 'active', el chat está en atención, no hacer nada
        else if (existingSession.status === 'active') {
          console.log(`[Bot] Chat ${chatId} tiene sesión activa (en atención), bot no se activará hasta que se complete la sesión`);
          return;
        }
      } else {
        // No tiene sesión, enviar menú según modalidad
        console.log(`[Bot] No hay sesión activa para ${chatId}, enviando menú...`);
        await this.sendBotMenu(chatId, activeBot, whatsappClient);
      }

    } catch (error) {
      console.error('[Bot] Error procesando mensaje:', error);
    }
  }

  /**
   * Obtener bot activo de un owner
   */
  static async getActiveBot(ownerId) {
    try {
      const result = await Bot.findByOwnerId(ownerId);
      return result.find(bot => bot.is_active) || null;
    } catch (error) {
      console.error('[Bot] Error obteniendo bot activo:', error);
      return null;
    }
  }

  /**
   * Enviar menú de opciones/keywords al chat
   */
  static async sendBotMenu(chatId, bot, whatsappClient) {
    try {
      if (bot.modality === 'options') {
        await this.sendOptionsMenu(chatId, bot, whatsappClient);
      } else if (bot.modality === 'keywords') {
        await this.sendKeywordsInfo(chatId, bot, whatsappClient);
      }
    } catch (error) {
      console.error('[Bot] Error enviando menú:', error);
    }
  }

  /**
   * Enviar menú de opciones enumeradas
   */
  static async sendOptionsMenu(chatId, bot, whatsappClient) {
    try {
      // Obtener todas las opciones activas, ordenadas
      const options = await BotRule.findByBotId(bot.id, 'option');
      const activeOptions = options.filter(opt => opt.is_active);
      
      if (activeOptions.length === 0) {
        console.log(`[Bot] No hay opciones activas para bot ${bot.id}`);
        return;
      }

      // Ordenar por order ASC
      activeOptions.sort((a, b) => a.order - b.order);

      // Construir mensaje
      let menuMessage = bot.welcome_message || '¡Hola! Bienvenido';
      menuMessage += '\n\n';
      menuMessage += 'Por favor, elige una opción:\n\n';

      activeOptions.forEach((option, index) => {
        menuMessage += `${index + 1}. ${option.text}\n`;
      });

      menuMessage += '\n_Responde con el número de tu opción_';

      // Enviar mensaje
      await whatsappClient.client.sendMessage(chatId, menuMessage);
      console.log(`[Bot] Menú de opciones enviado a ${chatId}`);

      // Crear sesión
      await BotChatSession.create({
        botId: bot.id,
        chatId: chatId,
        status: 'pending'
      });
      console.log(`[Bot] Sesión creada para ${chatId}`);

    } catch (error) {
      console.error('[Bot] Error enviando menú de opciones:', error);
      throw error;
    }
  }

  /**
   * Enviar información sobre keywords (modalidad keyword)
   */
  static async sendKeywordsInfo(chatId, bot, whatsappClient) {
    try {
      let message = bot.welcome_message || '¡Hola! Bienvenido';
      message += '\n\n';
      message += '_Escribe lo que necesitas y te ayudaremos automáticamente_';

      await whatsappClient.client.sendMessage(chatId, message);
      console.log(`[Bot] Mensaje de keywords enviado a ${chatId}`);

      // Crear sesión
      await BotChatSession.create({
        botId: bot.id,
        chatId: chatId,
        status: 'pending'
      });

    } catch (error) {
      console.error('[Bot] Error enviando info de keywords:', error);
      throw error;
    }
  }

  /**
   * Manejar respuesta del usuario
   */
  static async handleUserResponse(session, userMessage, whatsappClient, bot) {
    try {
      if (bot.modality === 'options') {
        await this.handleOptionResponse(session, userMessage, whatsappClient, bot);
      } else if (bot.modality === 'keywords') {
        await this.handleKeywordResponse(session, userMessage, whatsappClient, bot);
      }
    } catch (error) {
      console.error('[Bot] Error manejando respuesta:', error);
    }
  }

  /**
   * Manejar respuesta de opción (número)
   */
  static async handleOptionResponse(session, userMessage, whatsappClient, bot) {
    try {
      const chatId = session.chat_id;
      const optionNumber = parseInt(userMessage.trim());

      if (isNaN(optionNumber) || optionNumber < 1) {
        console.log(`[Bot] Respuesta inválida de ${chatId}: "${userMessage}"`);
        await whatsappClient.client.sendMessage(
          chatId,
          '❌ Por favor, responde con el número de la opción que deseas.'
        );
        return;
      }

      // Obtener opciones disponibles
      const options = await BotRule.findByBotId(bot.id, 'option');
      const activeOptions = options.filter(opt => opt.is_active).sort((a, b) => a.order - b.order);

      if (optionNumber > activeOptions.length) {
        console.log(`[Bot] Opción fuera de rango: ${optionNumber} (máx: ${activeOptions.length})`);
        await whatsappClient.client.sendMessage(
          chatId,
          `❌ Opción inválida. Por favor elige un número entre 1 y ${activeOptions.length}.`
        );
        return;
      }

      // Obtener la opción seleccionada
      const selectedOption = activeOptions[optionNumber - 1];
      const tagId = selectedOption.tag_id;

      console.log(`[Bot] Usuario ${chatId} seleccionó opción ${optionNumber}: ${selectedOption.text}`);

      // Actualizar sesión
      await BotChatSession.updateResponse({
        sessionId: session.id,
        selectedOption: optionNumber,
        userResponse: userMessage,
        tagId: tagId,
        status: 'active'
      });

      // Asignar tag al chat (si existe tag_id)
      if (tagId) {
        const tag = await Tag.findById(tagId);
        if (tag) {
          // Asignar tag usando la API interna
          await this.assignTagToChat(chatId, tagId, bot.owner_id);
          console.log(`[Bot] Tag "${tag.name}" asignado a chat ${chatId}`);

          // Mensaje de confirmación automático
          const confirmationMessage = this.buildConfirmationMessage(selectedOption, tag.name);
          await whatsappClient.client.sendMessage(chatId, confirmationMessage);
        }
      } else {
        // Opción sin tag (ej: opción informativa)
        const defaultMessage = '✅ Gracias por tu respuesta.\n\nEn un momento serás atendido por uno de nuestros asesores. Por favor, mantén activa esta conversación.';
        await whatsappClient.client.sendMessage(chatId, defaultMessage);
      }

      // Marcar sesión como completada
      await BotChatSession.complete(session.id);
      console.log(`[Bot] Sesión ${session.id} marcada como completada`);

    } catch (error) {
      console.error('[Bot] Error procesando respuesta de opción:', error);
    }
  }

  /**
   * Manejar respuesta con keywords
   */
  static async handleKeywordResponse(session, userMessage, whatsappClient, bot) {
    try {
      const chatId = session.chat_id;
      const messageLower = userMessage.toLowerCase();

      // Obtener todas las reglas de tipo keyword
      const keywordRules = await BotRule.findByBotId(bot.id, 'keyword');
      const activeKeywords = keywordRules.filter(kw => kw.is_active);

      let matchedRule = null;

      // Buscar coincidencia
      for (const rule of activeKeywords) {
        const keywords = rule.text.toLowerCase().split(',').map(k => k.trim());
        
        for (const keyword of keywords) {
          if (messageLower.includes(keyword)) {
            matchedRule = rule;
            break;
          }
        }
        
        if (matchedRule) break;
      }

      if (matchedRule && matchedRule.tag_id) {
        const tag = await Tag.findById(matchedRule.tag_id);
        
        // Actualizar sesión
        await BotChatSession.updateResponse({
          sessionId: session.id,
          selectedOption: null,
          userResponse: userMessage,
          tagId: matchedRule.tag_id,
          status: 'active'
        });

        // Asignar tag
        await this.assignTagToChat(chatId, matchedRule.tag_id, bot.owner_id);
        console.log(`[Bot] Keyword detectada, tag "${tag.name}" asignado a ${chatId}`);

        // Confirmar con mensaje automático
        const confirmationMessage = this.buildConfirmationMessage(null, tag.name);
        await whatsappClient.client.sendMessage(chatId, confirmationMessage);

        // Completar sesión
        await BotChatSession.complete(session.id);
        console.log(`[Bot] Sesión ${session.id} completada por keyword`);

      } else {
        console.log(`[Bot] No se encontró keyword match para: "${userMessage}"`);
        const defaultMessage = '✅ Gracias por tu mensaje.\n\nEn un momento serás atendido por uno de nuestros asesores. Por favor, mantén activa esta conversación.';
        await whatsappClient.client.sendMessage(chatId, defaultMessage);

        // Completar sin tag
        await BotChatSession.updateResponse({
          sessionId: session.id,
          selectedOption: null,
          userResponse: userMessage,
          tagId: null,
          status: 'active'
        });
        await BotChatSession.complete(session.id);
      }

    } catch (error) {
      console.error('[Bot] Error procesando respuesta con keywords:', error);
    }
  }

  /**
   * Construir mensaje de confirmación personalizado
   * TODO: En el futuro, obtener de bot_rules.response_message si existe
   */
  static buildConfirmationMessage(selectedOption, tagName) {
    const messages = [
      `✅ *Perfecto!*\n\nTu solicitud sobre *${tagName}* ha sido registrada.\n\nEn un momento serás atendido por uno de nuestros asesores especializados. Por favor, mantén activa esta conversación.`,
      `✅ *Recibido!*\n\nHemos derivado tu consulta al área de *${tagName}*.\n\nUn asesor te contactará en breve. Mientras tanto, puedes enviar cualquier detalle adicional que consideres importante.`,
      `✅ *Entendido!*\n\nTu solicitud de *${tagName}* está siendo procesada.\n\nEn unos momentos un especialista te atenderá. Gracias por tu paciencia.`
    ];
    
    // Seleccionar mensaje aleatorio para variedad
    const randomIndex = Math.floor(Math.random() * messages.length);
    return messages[randomIndex];
  }

  /**
   * Asignar tag a un chat (llamada interna)
   */
  static async assignTagToChat(chatId, tagId, ownerId) {
    try {
      const ChatTag = require('../models/ChatTag');
      
      // Verificar si ya tiene el tag
      const hasTag = await ChatTag.chatHasTag(chatId, tagId);
      if (hasTag) {
        console.log(`[Bot] Chat ${chatId} ya tiene tag ${tagId}`);
        return;
      }

      // Asignar tag (assignedBy = owner del bot para asignación automática)
      await ChatTag.assign(chatId, tagId, ownerId);
      console.log(`[Bot] Tag ${tagId} asignado exitosamente a chat ${chatId}`);

    } catch (error) {
      console.error('[Bot] Error asignando tag:', error);
      throw error;
    }
  }
}

module.exports = BotAutoDistributionService;
