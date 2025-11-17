const Bot = require('../models/Bot');

class BotDistributionService {
  /**
   * Distribuir un mensaje según la estrategia del bot
   * @param {string} chatId - ID del chat
   * @param {number} ownerId - ID del propietario
   * @returns {Object|null} Usuario seleccionado o null
   */
  static async distributeMessage(chatId, ownerId) {
    try {
      // 1. Buscar bot activo para este chat
      const bot = await Bot.findActiveBotForChat(chatId, ownerId);
      
      if (!bot) {
        console.log(`No hay bot activo para el chat ${chatId}`);
        return null;
      }

      // 2. Obtener usuarios asignados al bot
      const users = await Bot.getUsers(bot.id);

      if (users.length === 0) {
        console.log(`Bot ${bot.name} no tiene usuarios asignados`);
        return null;
      }

      // 3. Aplicar estrategia de distribución
      let selectedUser = null;

      switch (bot.strategy) {
        case 'round_robin':
          selectedUser = await this.roundRobinStrategy(bot, users);
          break;
        case 'random':
          selectedUser = await this.randomStrategy(users);
          break;
        case 'priority':
          selectedUser = await this.priorityStrategy(users);
          break;
        default:
          selectedUser = await this.roundRobinStrategy(bot, users);
      }

      console.log(`✅ Mensaje del chat ${chatId} asignado a ${selectedUser.nombre} (Bot: ${bot.name}, Estrategia: ${bot.strategy})`);
      
      return {
        user: selectedUser,
        bot: bot
      };

    } catch (error) {
      console.error('❌ Error distribuyendo mensaje:', error);
      return null;
    }
  }

  /**
   * Estrategia Round Robin - Distribuye secuencialmente
   * @param {Object} bot - Bot con índice de último asignado
   * @param {Array<Object>} users - Lista de usuarios
   * @returns {Object} Usuario seleccionado
   */
  static async roundRobinStrategy(bot, users) {
    const currentIndex = bot.last_assigned_index || 0;
    const nextIndex = (currentIndex + 1) % users.length;
    
    // Actualizar índice para la próxima vez
    await Bot.updateLastAssignedIndex(bot.id, nextIndex);
    
    return users[nextIndex];
  }

  /**
   * Estrategia Random - Selecciona aleatoriamente
   * @param {Array<Object>} users - Lista de usuarios
   * @returns {Object} Usuario seleccionado
   */
  static async randomStrategy(users) {
    const randomIndex = Math.floor(Math.random() * users.length);
    return users[randomIndex];
  }

  /**
   * Estrategia Priority - Selecciona por prioridad (ya vienen ordenados)
   * @param {Array<Object>} users - Lista de usuarios ordenados por prioridad
   * @returns {Object} Usuario seleccionado
   */
  static async priorityStrategy(users) {
    // Los usuarios ya vienen ordenados por prioridad ASC (1 es más alta)
    return users[0];
  }

  /**
   * Obtener bot con todos sus detalles
   * @param {number} botId - ID del bot
   * @returns {Object} Bot completo con tags y usuarios
   */
  static async getBotWithDetails(botId) {
    const bot = await Bot.findById(botId);
    
    if (!bot) {
      return null;
    }

    const tags = await Bot.getTags(botId);
    const users = await Bot.getUsers(botId);
    const stats = await Bot.getStats(botId);

    return {
      ...bot,
      tags,
      users,
      stats
    };
  }

  /**
   * Validar configuración del bot
   * @param {number} botId - ID del bot
   * @returns {Object} Estado de validación
   */
  static async validateBotConfiguration(botId) {
    const bot = await Bot.findById(botId);
    
    if (!bot) {
      return {
        valid: false,
        errors: ['Bot no encontrado']
      };
    }

    const errors = [];
    const warnings = [];

    // Verificar que tiene tags asignados
    const tags = await Bot.getTags(botId);
    if (tags.length === 0) {
      errors.push('El bot no tiene tags asignados');
    }

    // Verificar que tiene usuarios asignados
    const users = await Bot.getUsers(botId);
    if (users.length === 0) {
      errors.push('El bot no tiene usuarios asignados');
    }

    // Verificar prioridades si la estrategia es 'priority'
    if (bot.strategy === 'priority' && users.length > 0) {
      const priorities = users.map(u => u.priority);
      const uniquePriorities = new Set(priorities);
      
      if (priorities.length !== uniquePriorities.size) {
        warnings.push('Hay usuarios con la misma prioridad');
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      bot,
      tags,
      users
    };
  }

  /**
   * Simular distribución (para testing)
   * @param {number} botId - ID del bot
   * @param {number} messageCount - Cantidad de mensajes a simular
   * @returns {Array<Object>} Resultados de la simulación
   */
  static async simulateDistribution(botId, messageCount = 10) {
    const bot = await Bot.findById(botId);
    
    if (!bot) {
      throw new Error('Bot no encontrado');
    }

    const users = await Bot.getUsers(botId);
    
    if (users.length === 0) {
      throw new Error('Bot no tiene usuarios asignados');
    }

    const results = [];
    const userCounts = {};

    // Inicializar contadores
    users.forEach(user => {
      userCounts[user.id] = 0;
    });

    // Simular distribución
    for (let i = 0; i < messageCount; i++) {
      let selectedUser;

      switch (bot.strategy) {
        case 'round_robin':
          selectedUser = await this.roundRobinStrategy(bot, users);
          break;
        case 'random':
          selectedUser = await this.randomStrategy(users);
          break;
        case 'priority':
          selectedUser = await this.priorityStrategy(users);
          break;
        default:
          selectedUser = await this.roundRobinStrategy(bot, users);
      }

      userCounts[selectedUser.id]++;
      results.push({
        messageNumber: i + 1,
        assignedTo: selectedUser.nombre,
        userId: selectedUser.id
      });
    }

    return {
      bot: bot.name,
      strategy: bot.strategy,
      totalMessages: messageCount,
      distribution: results,
      summary: Object.keys(userCounts).map(userId => ({
        userId: parseInt(userId),
        userName: users.find(u => u.id === parseInt(userId)).nombre,
        messagesAssigned: userCounts[userId],
        percentage: ((userCounts[userId] / messageCount) * 100).toFixed(2) + '%'
      }))
    };
  }
}

module.exports = BotDistributionService;
