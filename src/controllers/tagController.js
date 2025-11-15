const TagService = require('../services/tagService');

class TagController {
  /**
   * Crear una nueva etiqueta
   * POST /api/tags
   */
  static async createTag(req, res, next) {
    try {
      const { name, color } = req.body;
      const userId = req.user.userId;

      if (!name || name.trim() === '') {
        return res.status(400).json({
          success: false,
          message: 'El nombre de la etiqueta es requerido'
        });
      }

      const tag = await TagService.createTag(name.trim(), userId, color);

      res.status(201).json({
        success: true,
        message: 'Etiqueta creada exitosamente',
        data: tag
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Obtener todas las etiquetas del usuario
   * GET /api/tags
   */
  static async getTags(req, res, next) {
    try {
      const userId = req.user.userId;
      const rol = req.user.rol;

      const tags = await TagService.getUserTags(userId, rol);

      res.json({
        success: true,
        data: tags
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Obtener una etiqueta por ID
   * GET /api/tags/:id
   */
  static async getTagById(req, res, next) {
    try {
      const { id } = req.params;
      const userId = req.user.userId;

      const Tag = require('../models/Tag');
      const tag = await Tag.findById(id);

      if (!tag) {
        return res.status(404).json({
          success: false,
          message: 'Etiqueta no encontrada'
        });
      }

      // Verificar acceso
      const hasAccess = await Tag.userHasAccess(userId, id);
      if (!hasAccess) {
        return res.status(403).json({
          success: false,
          message: 'No tienes acceso a esta etiqueta'
        });
      }

      res.json({
        success: true,
        data: tag
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Actualizar una etiqueta
   * PUT /api/tags/:id
   */
  static async updateTag(req, res, next) {
    try {
      const { id } = req.params;
      const { name, color } = req.body;
      const userId = req.user.userId;

      const data = {};
      if (name !== undefined) data.name = name.trim();
      if (color !== undefined) data.color = color;

      const tag = await TagService.updateTag(id, userId, data);

      if (!tag) {
        return res.status(404).json({
          success: false,
          message: 'Etiqueta no encontrada o no se pudo actualizar'
        });
      }

      res.json({
        success: true,
        message: 'Etiqueta actualizada exitosamente',
        data: tag
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Eliminar una etiqueta
   * DELETE /api/tags/:id
   */
  static async deleteTag(req, res, next) {
    try {
      const { id } = req.params;
      const userId = req.user.userId;

      const deleted = await TagService.deleteTag(id, userId);

      if (!deleted) {
        return res.status(404).json({
          success: false,
          message: 'Etiqueta no encontrada'
        });
      }

      res.json({
        success: true,
        message: 'Etiqueta eliminada exitosamente'
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Asignar etiqueta a un empleado
   * POST /api/tags/:id/users
   */
  static async assignTagToEmployee(req, res, next) {
    try {
      const { id } = req.params;
      const { employeeId } = req.body;
      const adminId = req.user.userId;

      if (!employeeId) {
        return res.status(400).json({
          success: false,
          message: 'El ID del empleado es requerido'
        });
      }

      const result = await TagService.assignTagToEmployee(id, employeeId, adminId);

      res.status(201).json({
        success: true,
        message: 'Etiqueta asignada al empleado exitosamente',
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Quitar etiqueta de un empleado
   * DELETE /api/tags/:id/users/:employeeId
   */
  static async removeTagFromEmployee(req, res, next) {
    try {
      const { id, employeeId } = req.params;
      const adminId = req.user.userId;

      const removed = await TagService.removeTagFromEmployee(id, employeeId, adminId);

      if (!removed) {
        return res.status(404).json({
          success: false,
          message: 'Relación no encontrada'
        });
      }

      res.json({
        success: true,
        message: 'Etiqueta removida del empleado exitosamente'
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Obtener empleados con acceso a una etiqueta
   * GET /api/tags/:id/users
   */
  static async getEmployeesWithAccess(req, res, next) {
    try {
      const { id } = req.params;
      const userId = req.user.userId;

      const employees = await TagService.getEmployeesWithAccess(id, userId);

      res.json({
        success: true,
        data: employees
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Asignar chat a una etiqueta
   * POST /api/tags/:id/chats
   */
  static async assignChatToTag(req, res, next) {
    try {
      const { id } = req.params;
      const { chatId } = req.body;
      const userId = req.user.userId;

      if (!chatId) {
        return res.status(400).json({
          success: false,
          message: 'El ID del chat es requerido'
        });
      }

      const result = await TagService.assignChatToTag(id, chatId, userId);

      res.status(201).json({
        success: true,
        message: 'Chat asignado a la etiqueta exitosamente',
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Remover chat de una etiqueta
   * DELETE /api/tags/:id/chats/:chatId
   */
  static async removeChatFromTag(req, res, next) {
    try {
      const { id, chatId } = req.params;
      const userId = req.user.userId;

      const removed = await TagService.removeChatFromTag(id, chatId, userId);

      if (!removed) {
        return res.status(404).json({
          success: false,
          message: 'Relación no encontrada'
        });
      }

      res.json({
        success: true,
        message: 'Chat removido de la etiqueta exitosamente'
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Obtener chats de una etiqueta (solo IDs)
   * GET /api/tags/:id/chats
   */
  static async getChatsByTag(req, res, next) {
    try {
      const { id } = req.params;
      const userId = req.user.userId;

      const chats = await TagService.getChatsByTag(id, userId);

      res.json({
        success: true,
        data: chats
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Obtener chats completos de una etiqueta (con información de WhatsApp)
   * GET /api/tags/:id/chats/full
   */
  static async getFullChatsByTag(req, res, next) {
    try {
      const { id } = req.params;
      const { userId, rol, idPadre } = req.user;
      const whatsappClient = req.whatsappClient;

      // Validar que el tag existe y el usuario tiene acceso
      const tag = await TagService.getTagById(id, userId);
      
      if (!tag) {
        return res.status(404).json({
          success: false,
          message: 'Etiqueta no encontrada o no tienes acceso'
        });
      }

      // Obtener todos los chats de WhatsApp
      const allChats = await whatsappClient.getChats();

      // Si es la etiqueta "Todo" (is_default = true), retornar todos los chats
      if (tag.is_default) {
        return res.json({
          success: true,
          data: allChats,
          tag: {
            id: tag.id,
            name: tag.name,
            is_default: true
          }
        });
      }

      // Para otras etiquetas, obtener solo los chat_ids asignados a esta etiqueta
      const assignedChats = await TagService.getChatsByTag(id, userId);
      const chatIds = assignedChats.map(c => c.chat_id);

      console.log(`[DEBUG] Tag ${id} - Chats asignados en BD:`, chatIds);

      // Si no hay chats asignados, retornar array vacío
      if (chatIds.length === 0) {
        return res.json({
          success: true,
          data: [],
          tag: {
            id: tag.id,
            name: tag.name,
            is_default: false
          }
        });
      }

      // Obtener los IDs de WhatsApp para debug
      const whatsappChatIds = allChats.map(c => c.id._serialized);
      console.log(`[DEBUG] WhatsApp tiene ${allChats.length} chats:`, whatsappChatIds);

      // Filtrar los chats de WhatsApp que están asignados a esta etiqueta
      const filteredChats = allChats.filter(chat => {
        const chatId = chat.id._serialized || chat.id;
        const isIncluded = chatIds.includes(chatId);
        if (isIncluded) {
          console.log(`[DEBUG] ✅ Chat ${chatId} incluido en filtro`);
        }
        return isIncluded;
      });

      console.log(`[DEBUG] Chats filtrados: ${filteredChats.length}`);

      res.json({
        success: true,
        data: filteredChats,
        tag: {
          id: tag.id,
          name: tag.name,
          is_default: false
        }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Obtener etiquetas de un chat
   * GET /api/chats/:chatId/tags
   */
  static async getTagsByChat(req, res, next) {
    try {
      const { chatId } = req.params;

      const tags = await TagService.getTagsByChat(chatId);

      res.json({
        success: true,
        data: tags
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Obtener estadísticas de una etiqueta
   * GET /api/tags/:id/stats
   */
  static async getTagStats(req, res, next) {
    try {
      const { id } = req.params;
      const userId = req.user.userId;

      const stats = await TagService.getTagStats(id, userId);

      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = TagController;
