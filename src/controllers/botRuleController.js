const BotRule = require('../models/BotRule');
const BotRuleService = require('../services/botRuleService');
const Bot = require('../models/Bot');

class BotRuleController {
  /**
   * GET /api/bots/:botId/rules
   * Listar todas las reglas de un bot
   */
  static async listRules(req, res) {
    try {
      const { botId } = req.params;
      const { type } = req.query; // 'option' | 'keyword' | undefined

      // Validar que el bot existe
      const bot = await Bot.findById(botId);
      if (!bot) {
        return res.status(404).json({ error: 'Bot no encontrado' });
      }

      // Validar ownership
      if (bot.owner_id !== req.user.userId) {
        return res.status(403).json({ error: 'No tienes permiso para acceder a este bot' });
      }

      const rules = await BotRule.findByBotId(botId, type);

      return res.status(200).json({
        success: true,
        botId: botId,
        botModality: bot.modality,
        rulesCount: rules.length,
        rules: rules
      });
    } catch (error) {
      console.error('Error listando reglas:', error.message);
      return res.status(500).json({ error: error.message });
    }
  }

  /**
   * POST /api/bots/:botId/rules
   * Crear una nueva regla
   */
  static async createRule(req, res) {
    try {
      const { botId } = req.params;
      const { type, text, tagId, order, groupName } = req.body;

      // Validaciones
      if (!type || !text) {
        return res.status(400).json({ error: 'Campos requeridos: type, text' });
      }

      if (!['option', 'keyword'].includes(type)) {
        return res.status(400).json({ error: 'type debe ser "option" o "keyword"' });
      }

      // Validar bot ownership
      const bot = await Bot.findById(botId);
      if (!bot) {
        return res.status(404).json({ error: 'Bot no encontrado' });
      }
      if (bot.owner_id !== req.user.userId) {
        return res.status(403).json({ error: 'Sin permiso para modificar este bot' });
      }

      // Validar que el tag existe y pertenece al mismo admin (si se proporciona)
      if (tagId) {
        const Tag = require('../models/Tag');
        const tag = await Tag.findById(tagId);
        if (!tag) {
          return res.status(400).json({ 
            error: 'Tag inválido', 
            details: `El tag con ID ${tagId} no existe. Por favor selecciona un tag válido.` 
          });
        }
        if (tag.owner_id !== req.user.userId) {
          return res.status(403).json({ 
            error: 'Tag no permitido', 
            details: 'El tag seleccionado no te pertenece' 
          });
        }
      }

      // Validaciones específicas por tipo
      if (type === 'option' && (order === null || order === undefined)) {
        return res.status(400).json({ 
          error: 'Campo requerido: order', 
          details: 'Las reglas de tipo "option" requieren el campo "order"' 
        });
      }

      if (type === 'keyword' && !groupName) {
        return res.status(400).json({ 
          error: 'Campo requerido: groupName', 
          details: 'Las reglas de tipo "keyword" requieren el campo "groupName"' 
        });
      }

      // Crear regla
      const rule = await BotRule.create(botId, type, text, tagId || null, order, groupName);

      return res.status(201).json({
        success: true,
        message: 'Regla creada exitosamente',
        rule: rule
      });
    } catch (error) {
      console.error('Error creando regla:', error.message);
      if (error.message.includes('Conflicto')) {
        return res.status(409).json({ error: error.message });
      }
      if (error.message.includes('llave foránea')) {
        return res.status(400).json({ 
          error: 'Error de referencia', 
          details: 'El tag o bot especificado no existe o no es válido' 
        });
      }
      return res.status(500).json({ error: error.message });
    }
  }

  /**
   * GET /api/bots/:botId/rules/:ruleId
   * Obtener una regla específica
   */
  static async getRule(req, res) {
    try {
      const { botId, ruleId } = req.params;

      // Validar bot ownership
      const bot = await Bot.findById(botId);
      if (!bot || bot.owner_id !== req.user.userId) {
        return res.status(403).json({ error: 'Sin permiso' });
      }

      const rule = await BotRule.findById(ruleId);
      if (!rule || parseInt(rule.bot_id) !== parseInt(botId)) {
        return res.status(404).json({ error: 'Regla no encontrada' });
      }

      return res.status(200).json({
        success: true,
        rule: rule
      });
    } catch (error) {
      console.error('Error obteniendo regla:', error.message);
      return res.status(500).json({ error: error.message });
    }
  }

  /**
   * PUT /api/bots/:botId/rules/:ruleId
   * Actualizar una regla
   */
  static async updateRule(req, res) {
    try {
      const { botId, ruleId } = req.params;
      const updates = req.body;

      // Validar bot ownership
      const bot = await Bot.findById(botId);
      if (!bot || bot.owner_id !== req.user.userId) {
        return res.status(403).json({ error: 'Sin permiso' });
      }

      // Validar que la regla pertenece al bot
      const rule = await BotRule.findById(ruleId);
      if (!rule || parseInt(rule.bot_id) !== parseInt(botId)) {
        return res.status(404).json({ error: 'Regla no encontrada' });
      }

      // Actualizar
      const updated = await BotRule.update(ruleId, updates);

      return res.status(200).json({
        success: true,
        message: 'Regla actualizada exitosamente',
        rule: updated
      });
    } catch (error) {
      console.error('Error actualizando regla:', error.message);
      return res.status(500).json({ error: error.message });
    }
  }

  /**
   * DELETE /api/bots/:botId/rules/:ruleId
   * Eliminar una regla (soft delete)
   */
  static async deleteRule(req, res) {
    try {
      const { botId, ruleId } = req.params;

      // Validar bot ownership
      const bot = await Bot.findById(botId);
      if (!bot || bot.owner_id !== req.user.userId) {
        return res.status(403).json({ error: 'Sin permiso' });
      }

      // Validar que la regla pertenece al bot
      const rule = await BotRule.findById(ruleId);
      if (!rule || parseInt(rule.bot_id) !== parseInt(botId)) {
        return res.status(404).json({ error: 'Regla no encontrada' });
      }

      // Eliminar
      const deleted = await BotRule.delete(ruleId);

      if (!deleted) {
        return res.status(400).json({ error: 'No se pudo eliminar la regla' });
      }

      return res.status(200).json({
        success: true,
        message: 'Regla eliminada exitosamente'
      });
    } catch (error) {
      console.error('Error eliminando regla:', error.message);
      return res.status(500).json({ error: error.message });
    }
  }

  /**
   * POST /api/bots/:botId/rules/process
   * Procesar un mensaje según las reglas del bot (SIN AUTENTICACIÓN)
   * Endpoint público para WhatsApp/clientes
   */
  static async processMessage(req, res) {
    try {
      const { botId } = req.params;
      const { message } = req.body;

      if (!message || message.trim().length === 0) {
        return res.status(400).json({ error: 'El campo "message" es requerido y no puede estar vacío' });
      }

      // Validar que bot existe y está activo
      const bot = await Bot.findById(botId);
      if (!bot) {
        return res.status(404).json({ error: 'Bot no encontrado' });
      }

      if (!bot.is_active) {
        return res.status(400).json({ error: 'Bot está inactivo' });
      }

      // Procesar el mensaje
      const result = await BotRuleService.processMessage(botId, message);

      return res.status(200).json({
        success: result.matched,
        botId: botId,
        botName: bot.name,
        modality: bot.modality,
        message: message.trim(),
        matched: result.matched,
        ruleId: result.ruleId,
        tagId: result.tagId,
        error: result.error,
        rule: result.rule ? {
          id: result.rule.id,
          type: result.rule.type,
          text: result.rule.text,
          order: result.rule.order,
          groupName: result.rule.group_name,
          tagId: result.rule.tag_id
        } : null
      });
    } catch (error) {
      console.error('Error procesando mensaje:', error.message);
      return res.status(500).json({ error: error.message });
    }
  }

  /**
   * GET /api/bots/:botId/rules/menu
   * Obtener menú de opciones para presentar al usuario
   * (Solo para modalidad 'options')
   */
  static async getMenu(req, res) {
    try {
      const { botId } = req.params;

      const menu = await BotRuleService.getMenu(botId);

      return res.status(200).json({
        success: true,
        menu: menu
      });
    } catch (error) {
      console.error('Error obteniendo menú:', error.message);
      return res.status(400).json({ error: error.message });
    }
  }

  /**
   * GET /api/bots/:botId/rules/keywords/reference
   * Obtener referencia de palabras clave agrupadas
   * (Solo para modalidad 'keywords')
   */
  static async getKeywordReference(req, res) {
    try {
      const { botId } = req.params;

      const reference = await BotRuleService.getKeywordReference(botId);

      return res.status(200).json({
        success: true,
        reference: reference
      });
    } catch (error) {
      console.error('Error obteniendo referencia de keywords:', error.message);
      return res.status(400).json({ error: error.message });
    }
  }

  /**
   * GET /api/bots/:botId/rules/stats
   * Obtener estadísticas de las reglas del bot
   */
  static async getStats(req, res) {
    try {
      const { botId } = req.params;

      // Validar bot ownership
      const bot = await Bot.findById(botId);
      if (!bot || bot.owner_id !== req.user.userId) {
        return res.status(403).json({ error: 'Sin permiso' });
      }

      const summary = await BotRuleService.getBotRulesSummary(botId);

      return res.status(200).json({
        success: true,
        summary: summary
      });
    } catch (error) {
      console.error('Error obteniendo estadísticas:', error.message);
      return res.status(500).json({ error: error.message });
    }
  }

  /**
   * PUT /api/bots/:botId/rules/reorder
   * Reordenar opciones en bulk
   */
  static async reorderOptions(req, res) {
    try {
      const { botId } = req.params;
      const { rules } = req.body; // Array de {id, order}

      if (!Array.isArray(rules)) {
        return res.status(400).json({ error: 'El campo "rules" debe ser un array' });
      }

      // Validar bot ownership
      const bot = await Bot.findById(botId);
      if (!bot || bot.owner_id !== req.user.userId) {
        return res.status(403).json({ error: 'Sin permiso' });
      }

      if (bot.modality !== 'options') {
        return res.status(400).json({ error: 'El bot no está en modalidad "options"' });
      }

      // Reordenar
      const reordered = await BotRule.reorderOptions(botId, rules);

      return res.status(200).json({
        success: reordered,
        message: 'Opciones reordenadas exitosamente'
      });
    } catch (error) {
      console.error('Error reordenando opciones:', error.message);
      return res.status(500).json({ error: error.message });
    }
  }
}

module.exports = BotRuleController;
