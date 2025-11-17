const BotRule = require('../models/BotRule');
const Bot = require('../models/Bot');

class BotRuleService {
  /**
   * Procesar un mensaje según las reglas del bot
   * Maneja ambas modalidades: 'options' (numérica) y 'keywords' (búsqueda)
   * 
   * @param {number} botId - ID del bot
   * @param {string} message - Mensaje del usuario
   * @returns {Promise<{matched: boolean, ruleId: number|null, tagId: number|null, rule: Object|null, error: string|null}>}
   */
  static async processMessage(botId, message) {
    try {
      // Obtener configuración del bot
      const bot = await Bot.findById(botId);
      if (!bot) {
        return { matched: false, ruleId: null, tagId: null, rule: null, error: 'Bot no encontrado' };
      }

      if (!bot.is_active) {
        return { matched: false, ruleId: null, tagId: null, rule: null, error: 'Bot inactivo' };
      }

      // Procesar según modalidad
      if (bot.modality === 'options') {
        return await this._processOptions(botId, message);
      } else if (bot.modality === 'keywords') {
        return await this._processKeywords(botId, message);
      } else {
        return { matched: false, ruleId: null, tagId: null, rule: null, error: 'Modalidad desconocida' };
      }
    } catch (error) {
      console.error('Error procesando mensaje:', error.message);
      return { matched: false, ruleId: null, tagId: null, rule: null, error: error.message };
    }
  }

  /**
   * Procesar modalidad OPTIONS (menú numérico)
   * Usuario envía "1", "2", "3", etc.
   * @private
   */
  static async _processOptions(botId, message) {
    const trimmedMessage = message.trim();
    const orderNumber = parseInt(trimmedMessage, 10);

    // Validar que sea un número válido
    if (isNaN(orderNumber) || orderNumber < 1) {
      return {
        matched: false,
        ruleId: null,
        tagId: null,
        rule: null,
        error: 'Opción inválida. Envíe un número entero positivo'
      };
    }

    // Buscar la opción exacta
    const rule = await BotRule.findOptionByOrder(botId, orderNumber);
    
    if (!rule) {
      return {
        matched: false,
        ruleId: null,
        tagId: null,
        rule: null,
        error: `Opción ${orderNumber} no existe`
      };
    }

    return {
      matched: true,
      ruleId: rule.id,
      tagId: rule.tag_id,
      rule: rule,
      error: null
    };
  }

  /**
   * Procesar modalidad KEYWORDS (búsqueda de texto)
   * Usuario envía texto libre, buscamos coincidencias
   * @private
   */
  static async _processKeywords(botId, message) {
    if (!message || message.trim().length === 0) {
      return {
        matched: false,
        ruleId: null,
        tagId: null,
        rule: null,
        error: 'Mensaje vacío'
      };
    }

    // Buscar coincidencias de palabras clave
    const matches = await BotRule.findKeywordMatches(botId, message);

    if (matches.length === 0) {
      return {
        matched: false,
        ruleId: null,
        tagId: null,
        rule: null,
        error: 'No se encontró coincidencia con las palabras clave disponibles'
      };
    }

    // Retornar la primera coincidencia (prioridad por longitud de palabra)
    const rule = matches[0];
    return {
      matched: true,
      ruleId: rule.id,
      tagId: rule.tag_id,
      rule: rule,
      error: null
    };
  }

  /**
   * Obtener menú completo de opciones para presentar al usuario
   * @param {number} botId - ID del bot
   * @returns {Promise<{bot: Object, options: Array<Object>}>}
   */
  static async getMenu(botId) {
    const bot = await Bot.findById(botId);
    if (!bot) {
      throw new Error('Bot no encontrado');
    }

    if (!bot.is_active) {
      throw new Error('Bot inactivo');
    }

    if (bot.modality !== 'options') {
      throw new Error('Bot no está en modalidad "options"');
    }

    const options = await BotRule.findOptions(botId);
    
    return {
      botId: bot.id,
      botName: bot.name,
      welcomeMessage: bot.welcome_message,
      options: options.map(opt => ({
        id: opt.id,
        order: opt.order,
        text: opt.text,
        tagId: opt.tag_id
      }))
    };
  }

  /**
   * Obtener grupos de palabras clave para referencia
   * @param {number} botId - ID del bot
   * @returns {Promise<{bot: Object, groups: Array<Object>}>}
   */
  static async getKeywordReference(botId) {
    const bot = await Bot.findById(botId);
    if (!bot) {
      throw new Error('Bot no encontrado');
    }

    if (!bot.is_active) {
      throw new Error('Bot inactivo');
    }

    if (bot.modality !== 'keywords') {
      throw new Error('Bot no está en modalidad "keywords"');
    }

    const groups = await BotRule.getKeywordGroups(botId);

    return {
      botId: bot.id,
      botName: bot.name,
      welcomeMessage: bot.welcome_message,
      groups: groups.map(group => ({
        name: group.name,
        keywords: group.keywords.map(kw => ({
          id: kw.id,
          text: kw.text,
          tagId: kw.tag_id
        }))
      }))
    };
  }

  /**
   * Validar que una regla pertenece a un bot
   * @param {number} botId - ID del bot
   * @param {number} ruleId - ID de la regla
   * @returns {Promise<boolean>}
   */
  static async validateRuleOwnership(botId, ruleId) {
    const rule = await BotRule.findById(ruleId);
    return rule && rule.bot_id === botId;
  }

  /**
   * Obtener todas las reglas de un bot con estadísticas
   * @param {number} botId - ID del bot
   * @returns {Promise<{stats: Object, options: Array, keywords: Array}>}
   */
  static async getBotRulesSummary(botId) {
    const bot = await Bot.findById(botId);
    if (!bot) {
      throw new Error('Bot no encontrado');
    }

    const stats = await BotRule.getStats(botId);
    const options = await BotRule.findOptions(botId);
    const keywords = await BotRule.findKeywords(botId);

    return {
      botId: bot.id,
      botName: bot.name,
      modality: bot.modality,
      stats: stats,
      options: options,
      keywords: keywords
    };
  }
}

module.exports = BotRuleService;
