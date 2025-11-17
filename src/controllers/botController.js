  const Bot = require('../models/Bot');
  const Tag = require('../models/Tag');
  const User = require('../models/User');
  const BotDistributionService = require('../services/botDistributionService');

  /**
   * Crear un nuevo bot
   */
  exports.createBot = async (req, res) => {
    try {
      const { name, strategy, modality, welcome_message } = req.body;
      const userId = req.user.userId;
      const userRole = req.user.rol;

      // Solo admins pueden crear bots
      if (userRole !== 'ADMIN') {
        return res.status(403).json({
          success: false,
          message: 'Solo los administradores pueden crear bots'
        });
      }

      // Validar estrategia
      const validStrategies = ['round_robin', 'random', 'priority'];
      if (strategy && !validStrategies.includes(strategy)) {
        return res.status(400).json({
          success: false,
          message: 'Estrategia inválida. Opciones: round_robin, random, priority'
        });
      }

      // Validar modality
      const validModalities = ['options', 'keywords'];
      let finalModality = modality || 'options';
      if (!validModalities.includes(finalModality)) {
        return res.status(400).json({
          success: false,
          message: 'Modalidad inválida. Opciones: options, keywords'
        });
      }

      // Verificar si hay bots existentes para este admin
      const existingBots = await Bot.findByOwnerId(userId);
      const isFirstBot = existingBots.length === 0;

      const bot = await Bot.create(
        name,
        userId,
        strategy || 'round_robin',
        finalModality,
        welcome_message || '',
        isFirstBot ? true : false // Primer bot activo, otros inactivos
      );

      res.status(201).json({
        success: true,
        message: 'Bot creado exitosamente',
        data: bot,
        note: isFirstBot ? 'Primer bot activado por defecto' : 'Bot creado como inactivo. Actívalo para usarlo.'
      });
    } catch (error) {
      console.error('Error creando bot:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Error creando bot'
      });
    }
  };

  /**
   * Obtener todos los bots del admin
   */
  exports.getBots = async (req, res) => {
    try {
      const userId = req.user.userId;
      const userRole = req.user.rol;

      // Solo admins pueden ver sus bots
      if (userRole !== 'ADMIN') {
        return res.status(403).json({
          success: false,
          message: 'Solo los administradores pueden ver bots'
        });
      }

      const bots = await Bot.findByOwnerId(userId);

      res.json({
        success: true,
        data: bots,
        count: bots.length
      });
    } catch (error) {
      console.error('Error obteniendo bots:', error);
      res.status(500).json({
        success: false,
        message: 'Error obteniendo bots'
      });
    }
  };

  /**
   * Obtener un bot por ID con detalles
   */
  exports.getBotById = async (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.userId;
      const userRole = req.user.rol;

      const bot = await Bot.findById(id);

      if (!bot) {
        return res.status(404).json({
          success: false,
          message: 'Bot no encontrado'
        });
      }

      // Verificar propiedad
      if (userRole !== 'ADMIN' || bot.owner_id !== userId) {
        return res.status(403).json({
          success: false,
          message: 'No tienes permiso para ver este bot'
        });
      }

      const botWithDetails = await BotDistributionService.getBotWithDetails(id);

      res.json({
        success: true,
        data: botWithDetails
      });
    } catch (error) {
      console.error('Error obteniendo bot:', error.message);
      console.error('Stack:', error.stack);
      res.status(500).json({
        success: false,
        message: 'Error obteniendo bot',
        error: error.message
      });
    }
  };

  /**
   * Actualizar un bot
   */
  exports.updateBot = async (req, res) => {
    try {
      const { id } = req.params;
      const { name, is_active, strategy, modality, welcome_message } = req.body;
      const userId = req.user.userId;
      const userRole = req.user.rol;

      if (userRole !== 'ADMIN') {
        return res.status(403).json({
          success: false,
          message: 'Solo los administradores pueden actualizar bots'
        });
      }

      // Verificar propiedad
      const belongsToOwner = await Bot.belongsToOwner(id, userId);
      if (!belongsToOwner) {
        return res.status(403).json({
          success: false,
          message: 'No tienes permiso para actualizar este bot'
        });
      }

      const updateData = {};
      if (name !== undefined) updateData.name = name;
      if (is_active !== undefined) updateData.is_active = is_active;
      if (strategy !== undefined) {
        const validStrategies = ['round_robin', 'random', 'priority'];
        if (!validStrategies.includes(strategy)) {
          return res.status(400).json({
            success: false,
            message: 'Estrategia inválida'
          });
        }
        updateData.strategy = strategy;
      }
      if (modality !== undefined) {
        const validModalities = ['options', 'keywords'];
        if (!validModalities.includes(modality)) {
          return res.status(400).json({
            success: false,
            message: 'Modalidad inválida. Opciones: options, keywords'
          });
        }
        updateData.modality = modality;
      }
      if (welcome_message !== undefined) {
        updateData.welcome_message = welcome_message;
      }

      // 🔑 REGLA DE EXCLUSIVIDAD: Si se intenta activar este bot, desactiva todos los otros
      if (is_active === true) {
        const exclusivityResult = await Bot.ensureOnlyOneBotActive(userId, id);
        console.log('🤖 Exclusividad aplicada:', exclusivityResult);
      }

      const bot = await Bot.update(id, updateData);

      res.json({
        success: true,
        message: 'Bot actualizado exitosamente',
        data: bot,
        exclusivityApplied: is_active === true
      });
    } catch (error) {
      console.error('Error actualizando bot:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Error actualizando bot'
      });
    }
  };

  /**
   * Eliminar un bot
   */
  exports.deleteBot = async (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.userId;
      const userRole = req.user.rol;

      if (userRole !== 'ADMIN') {
        return res.status(403).json({
          success: false,
          message: 'Solo los administradores pueden eliminar bots'
        });
      }

      // Verificar propiedad
      const belongsToOwner = await Bot.belongsToOwner(id, userId);
      if (!belongsToOwner) {
        return res.status(403).json({
          success: false,
          message: 'No tienes permiso para eliminar este bot'
        });
      }

      const deleted = await Bot.delete(id);

      if (!deleted) {
        return res.status(404).json({
          success: false,
          message: 'Bot no encontrado'
        });
      }

      res.json({
        success: true,
        message: 'Bot eliminado exitosamente'
      });
    } catch (error) {
      console.error('Error eliminando bot:', error);
      res.status(500).json({
        success: false,
        message: 'Error eliminando bot'
      });
    }
  };

  /**
   * Asignar tags al bot
   */
  exports.assignTags = async (req, res) => {
    try {
      const { id } = req.params;
      const { tagIds } = req.body;
      const userId = req.user.userId;
      const userRole = req.user.rol;

      if (userRole !== 'ADMIN') {
        return res.status(403).json({
          success: false,
          message: 'Solo los administradores pueden asignar tags'
        });
      }

      // Verificar propiedad del bot
      const belongsToOwner = await Bot.belongsToOwner(id, userId);
      if (!belongsToOwner) {
        return res.status(403).json({
          success: false,
          message: 'No tienes permiso para modificar este bot'
        });
      }

      if (!Array.isArray(tagIds) || tagIds.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Debes proporcionar un array de tagIds'
        });
      }

      // Verificar que todos los tags pertenecen al admin
      const results = [];
      for (const tagId of tagIds) {
        const tag = await Tag.findById(tagId);
        
        if (!tag) {
          results.push({ tagId, success: false, message: 'Tag no encontrado' });
          continue;
        }

        if (tag.owner_id !== userId) {
          results.push({ tagId, success: false, message: 'No eres propietario de este tag' });
          continue;
        }

        await Bot.assignTag(id, tagId);
        results.push({ tagId, success: true, message: 'Tag asignado' });
      }

      res.json({
        success: true,
        message: 'Tags procesados',
        data: results
      });
    } catch (error) {
      console.error('Error asignando tags:', error);
      res.status(500).json({
        success: false,
        message: 'Error asignando tags'
      });
    }
  };

  /**
   * Remover un tag del bot
   */
  exports.removeTag = async (req, res) => {
    try {
      const { id, tagId } = req.params;
      const userId = req.user.userId;
      const userRole = req.user.rol;

      if (userRole !== 'ADMIN') {
        return res.status(403).json({
          success: false,
          message: 'Solo los administradores pueden remover tags'
        });
      }

      const belongsToOwner = await Bot.belongsToOwner(id, userId);
      if (!belongsToOwner) {
        return res.status(403).json({
          success: false,
          message: 'No tienes permiso para modificar este bot'
        });
      }

      const removed = await Bot.removeTag(id, tagId);

      if (!removed) {
        return res.status(404).json({
          success: false,
          message: 'Tag no encontrado en este bot'
        });
      }

      res.json({
        success: true,
        message: 'Tag removido del bot'
      });
    } catch (error) {
      console.error('Error removiendo tag:', error);
      res.status(500).json({
        success: false,
        message: 'Error removiendo tag'
      });
    }
  };

  /**
   * Asignar usuarios al bot
   */
  exports.assignUsers = async (req, res) => {
    try {
      const { id } = req.params;
      const { users } = req.body; // [{userId, priority}]
      const userId = req.user.userId;
      const userRole = req.user.rol;

      if (userRole !== 'ADMIN') {
        return res.status(403).json({
          success: false,
          message: 'Solo los administradores pueden asignar usuarios'
        });
      }

      const belongsToOwner = await Bot.belongsToOwner(id, userId);
      if (!belongsToOwner) {
        return res.status(403).json({
          success: false,
          message: 'No tienes permiso para modificar este bot'
        });
      }

      if (!Array.isArray(users) || users.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Debes proporcionar un array de usuarios [{userId, priority}]'
        });
      }

      const results = [];
      for (const userObj of users) {
        const { userId: employeeId, priority = 1 } = userObj;

        // Verificar que el usuario existe y es empleado del admin
        const employee = await User.findById(employeeId);
        
        if (!employee) {
          results.push({ userId: employeeId, success: false, message: 'Usuario no encontrado' });
          continue;
        }

        if (employee.owner_id !== userId) {
          results.push({ userId: employeeId, success: false, message: 'No es tu empleado' });
          continue;
        }

        await Bot.assignUser(id, employeeId, priority);
        results.push({ userId: employeeId, priority, success: true, message: 'Usuario asignado' });
      }

      res.json({
        success: true,
        message: 'Usuarios procesados',
        data: results
      });
    } catch (error) {
      console.error('Error asignando usuarios:', error);
      res.status(500).json({
        success: false,
        message: 'Error asignando usuarios'
      });
    }
  };

  /**
   * Remover un usuario del bot
   */
  exports.removeUser = async (req, res) => {
    try {
      const { id, userId: employeeId } = req.params;
      const userId = req.user.userId;
      const userRole = req.user.rol;

      if (userRole !== 'ADMIN') {
        return res.status(403).json({
          success: false,
          message: 'Solo los administradores pueden remover usuarios'
        });
      }

      const belongsToOwner = await Bot.belongsToOwner(id, userId);
      if (!belongsToOwner) {
        return res.status(403).json({
          success: false,
          message: 'No tienes permiso para modificar este bot'
        });
      }

      const removed = await Bot.removeUser(id, employeeId);

      if (!removed) {
        return res.status(404).json({
          success: false,
          message: 'Usuario no encontrado en este bot'
        });
      }

      res.json({
        success: true,
        message: 'Usuario removido del bot'
      });
    } catch (error) {
      console.error('Error removiendo usuario:', error);
      res.status(500).json({
        success: false,
        message: 'Error removiendo usuario'
      });
    }
  };

  /**
   * Validar configuración del bot
   */
  exports.validateBot = async (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.userId;
      const userRole = req.user.rol;

      if (userRole !== 'ADMIN') {
        return res.status(403).json({
          success: false,
          message: 'Solo los administradores pueden validar bots'
        });
      }

      const belongsToOwner = await Bot.belongsToOwner(id, userId);
      if (!belongsToOwner) {
        return res.status(403).json({
          success: false,
          message: 'No tienes permiso para validar este bot'
        });
      }

      const validation = await BotDistributionService.validateBotConfiguration(id);

      res.json({
        success: validation.valid,
        data: validation
      });
    } catch (error) {
      console.error('Error validando bot:', error);
      res.status(500).json({
        success: false,
        message: 'Error validando bot'
      });
    }
  };

  /**
   * Simular distribución de mensajes
   */
  exports.simulateDistribution = async (req, res) => {
    try {
      const { id } = req.params;
      const { messageCount = 10 } = req.body;
      const userId = req.user.userId;
      const userRole = req.user.rol;

      if (userRole !== 'ADMIN') {
        return res.status(403).json({
          success: false,
          message: 'Solo los administradores pueden simular distribuciones'
        });
      }

      const belongsToOwner = await Bot.belongsToOwner(id, userId);
      if (!belongsToOwner) {
        return res.status(403).json({
          success: false,
          message: 'No tienes permiso para este bot'
        });
      }

      const simulation = await BotDistributionService.simulateDistribution(id, messageCount);

      res.json({
        success: true,
        data: simulation
      });
    } catch (error) {
      console.error('Error simulando distribución:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Error simulando distribución'
      });
    }
  };

  /**
   * Obtener estadísticas del bot
   */
  exports.getBotStats = async (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.userId;
      const userRole = req.user.rol;

      if (userRole !== 'ADMIN') {
        return res.status(403).json({
          success: false,
          message: 'Solo los administradores pueden ver estadísticas'
        });
      }

      const belongsToOwner = await Bot.belongsToOwner(id, userId);
      if (!belongsToOwner) {
        return res.status(403).json({
          success: false,
          message: 'No tienes permiso para ver este bot'
        });
      }

      const stats = await Bot.getStats(id);

      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      console.error('Error obteniendo estadísticas:', error);
      res.status(500).json({
        success: false,
        message: 'Error obteniendo estadísticas'
      });
    }
  };
