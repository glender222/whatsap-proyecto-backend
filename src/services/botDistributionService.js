const Bot = require('../models/Bot');
const Tag = require('../models/Tag');
const User = require('../models/User');
const ChatTag = require('../models/ChatTag');

class BotDistributionService {
  /**
   * Obtener bot con todos sus detalles (tags, stats)
   * @param {number} botId - ID del bot
   * @returns {Object} Bot completo con detalles
   */
  static async getBotWithDetails(botId) {
    const bot = await Bot.findById(botId);
    if (!bot) {
      throw new Error('Bot no encontrado');
    }

    // Obtener tags únicos desde bot_rules (no desde bot_tags)
    const BotRule = require('../models/BotRule');
    const Tag = require('../models/Tag');
    
    const rules = await BotRule.findByBotId(botId);
    const uniqueTagIds = [...new Set(rules.map(rule => rule.tag_id).filter(id => id !== null))];
    
    const tags = [];
    for (const tagId of uniqueTagIds) {
      const tag = await Tag.findById(tagId);
      if (tag) {
        tags.push(tag);
      }
    }

    // Stats actualizados desde bot_rules
    const stats = await BotRule.getStats(botId);
    const monitored_chats = 0; // TODO: Implementar conteo de chats monitoreados

    return {
      ...bot,
      tag_count: tags.length,
      tags,
      stats: {
        tag_count: tags.length,
        option_count: stats.option_count || 0,
        keyword_count: stats.keyword_count || 0,
        monitored_chats: monitored_chats.toString()
      }
    };
  }

  /**
   * Validar configuración de un bot
   * @param {number} botId - ID del bot
   * @returns {Object} Resultado de validación
   */
  static async validateBotConfiguration(botId) {
    const bot = await Bot.findById(botId);
    if (!bot) {
      throw new Error('Bot no encontrado');
    }

    const errors = [];
    const warnings = [];

    // Verificar que tenga reglas configuradas con tags
    const BotRule = require('../models/BotRule');
    const rules = await BotRule.findByBotId(botId);
    if (rules.length === 0) {
      errors.push('El bot no tiene reglas configuradas. Debe tener al menos una regla (opción o palabra clave).');
    }

    // Obtener tags únicos desde las reglas
    const uniqueTagIds = [...new Set(rules.map(rule => rule.tag_id).filter(id => id !== null))];
    if (uniqueTagIds.length === 0) {
      warnings.push('El bot no tiene tags asignados en sus reglas. Se recomienda asignar al menos un tag a cada regla.');
    }

    // Verificar que tenga usuarios asignados
    const users = await Bot.getUsers(botId);
    if (users.length === 0) {
      warnings.push('El bot no tiene usuarios asignados para distribuir chats. Se recomienda asignar al menos un usuario.');
    }

    // Validar estrategia priority
    if (bot.strategy === 'priority' && users.length > 0) {
      const priorities = users.map(u => u.priority);
      const uniquePriorities = new Set(priorities);
      if (priorities.length !== uniquePriorities.size) {
        warnings.push('Hay usuarios con prioridades duplicadas. Se recomienda asignar prioridades únicas.');
      }
    }

    // Verificar que los usuarios pertenezcan al mismo admin
    if (users.length > 0) {
      const ownerId = bot.owner_id;
      for (const user of users) {
        const userDetails = await User.findById(user.user_id);
        if (userDetails.rol === 'EMPLEADO' && userDetails.id_padre !== ownerId) {
          errors.push(`El usuario ${userDetails.nombre} no pertenece al mismo administrador del bot.`);
        }
      }
    }

    const isValid = errors.length === 0;

    return {
      valid: isValid,
      errors,
      warnings,
      bot: {
        id: bot.id,
        name: bot.name,
        strategy: bot.strategy,
        modality: bot.modality,
        is_active: bot.is_active,
        rules_count: rules.length,
        tag_count: uniqueTagIds.length,
        user_count: users.length
      }
    };
  }

  /**
   * Simular distribución de mensajes
   * @param {number} botId - ID del bot
   * @param {number} messageCount - Cantidad de mensajes a simular
   * @returns {Object} Resultado de simulación
   */
  static async simulateDistribution(botId, messageCount = 10) {
    const bot = await Bot.findById(botId);
    if (!bot) {
      throw new Error('Bot no encontrado');
    }

    const users = await Bot.getUsers(botId);
    if (users.length === 0) {
      throw new Error('El bot no tiene usuarios asignados');
    }

    const distribution = {};
    users.forEach(user => {
      distribution[user.user_id] = {
        nombre: user.nombre,
        email: user.email,
        count: 0,
        priority: user.priority
      };
    });

    let currentIndex = bot.last_assigned_index || 0;

    for (let i = 0; i < messageCount; i++) {
      let selectedUser;

      switch (bot.strategy) {
        case 'round_robin':
          selectedUser = users[currentIndex % users.length];
          currentIndex++;
          break;

        case 'random':
          const randomIndex = Math.floor(Math.random() * users.length);
          selectedUser = users[randomIndex];
          break;

        case 'priority':
          // Ordenar por prioridad (menor número = mayor prioridad)
          const sortedUsers = [...users].sort((a, b) => a.priority - b.priority);
          selectedUser = sortedUsers[0];
          break;

        default:
          selectedUser = users[0];
      }

      distribution[selectedUser.user_id].count++;
    }

    return {
      bot: {
        id: bot.id,
        name: bot.name,
        strategy: bot.strategy
      },
      messageCount,
      distribution: Object.values(distribution),
      analysis: {
        mostAssigned: Object.values(distribution).reduce((max, user) => 
          user.count > max.count ? user : max
        ),
        leastAssigned: Object.values(distribution).reduce((min, user) => 
          user.count < min.count ? user : min
        ),
        averagePerUser: messageCount / users.length,
        isBalanced: bot.strategy === 'round_robin'
      }
    };
  }

  /**
   * Distribuir un mensaje entrante a un usuario
   * (Método principal para integración con WhatsApp)
   * @param {string} chatId - ID del chat de WhatsApp
   * @param {number} adminId - ID del admin propietario
   * @returns {Object|null} Usuario asignado y bot usado, o null si no hay bot activo
   */
  static async distributeMessage(chatId, adminId) {
    // 1. Obtener bots activos del admin
    const bots = await Bot.findByOwnerId(adminId);
    const activeBots = bots.filter(b => b.is_active);

    if (activeBots.length === 0) {
      return null; // No hay bots activos
    }

    // 2. Obtener tags del chat
    const chatTags = await ChatTag.findByChatId(chatId);
    const chatTagIds = chatTags.map(ct => ct.id);

    if (chatTagIds.length === 0) {
      return null; // El chat no tiene tags asignados
    }

    // 3. Buscar bot que monitoree alguno de los tags del chat
    let matchingBot = null;
    for (const bot of activeBots) {
      const botTags = await Bot.getTags(bot.id);
      const botTagIds = botTags.map(bt => bt.tag_id);
      
      // Verificar si hay intersección de tags
      const hasCommonTag = botTagIds.some(tagId => chatTagIds.includes(tagId));
      if (hasCommonTag) {
        matchingBot = bot;
        break;
      }
    }

    if (!matchingBot) {
      return null; // Ningún bot monitorea este chat
    }

    // 4. Obtener usuarios del bot
    const users = await Bot.getUsers(matchingBot.id);
    if (users.length === 0) {
      return null; // El bot no tiene usuarios asignados
    }

    // 5. Seleccionar usuario según estrategia
    let selectedUser;

    switch (matchingBot.strategy) {
      case 'round_robin':
        const currentIndex = matchingBot.last_assigned_index || 0;
        selectedUser = users[currentIndex % users.length];
        // Actualizar índice para próxima asignación
        await Bot.update(matchingBot.id, {
          last_assigned_index: (currentIndex + 1) % users.length
        });
        break;

      case 'random':
        const randomIndex = Math.floor(Math.random() * users.length);
        selectedUser = users[randomIndex];
        break;

      case 'priority':
        // Ordenar por prioridad (menor número = mayor prioridad)
        const sortedUsers = [...users].sort((a, b) => a.priority - b.priority);
        selectedUser = sortedUsers[0];
        break;

      default:
        selectedUser = users[0];
    }

    return {
      bot: {
        id: matchingBot.id,
        name: matchingBot.name,
        strategy: matchingBot.strategy
      },
      user: {
        id: selectedUser.user_id,
        nombre: selectedUser.nombre,
        email: selectedUser.email,
        priority: selectedUser.priority
      },
      chatId,
      assignedAt: new Date()
    };
  }
}

module.exports = BotDistributionService;
