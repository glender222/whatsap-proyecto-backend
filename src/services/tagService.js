const Tag = require('../models/Tag');
const ChatTag = require('../models/ChatTag');
const User = require('../models/User');

class TagService {
  /**
   * Crear la etiqueta "Todo" para un admin al registrarse
   * @param {number} adminId - ID del admin
   * @returns {Object} La etiqueta "Todo" creada
   */
  static async createDefaultTodoTag(adminId) {
    try {
      const todoTag = await Tag.create('Todo', adminId, '#10B981', true);
      console.log(`✅ Etiqueta "Todo" creada para admin ${adminId}`);
      return todoTag;
    } catch (error) {
      console.error('❌ Error creando etiqueta "Todo":', error.message);
      throw error;
    }
  }

  /**
   * Crear una nueva etiqueta (solo admin)
   * @param {string} name - Nombre de la etiqueta
   * @param {number} ownerId - ID del admin propietario
   * @param {string} color - Color en hex
   * @returns {Object} La etiqueta creada
   */
  static async createTag(name, ownerId, color = '#3B82F6') {
    // Verificar que el usuario sea admin
    const owner = await User.findById(ownerId);
    if (!owner || owner.rol !== 'ADMIN') {
      throw new Error('Solo los administradores pueden crear etiquetas');
    }

    // No permitir crear otra etiqueta "Todo"
    if (name.toLowerCase() === 'todo') {
      throw new Error('No puedes crear otra etiqueta llamada "Todo"');
    }

    return await Tag.create(name, ownerId, color, false);
  }

  /**
   * Obtener una etiqueta por ID (verifica acceso del usuario)
   * @param {number} tagId - ID de la etiqueta
   * @param {number} userId - ID del usuario
   * @returns {Object|null} La etiqueta si existe y el usuario tiene acceso
   */
  static async getTagById(tagId, userId) {
    const tag = await Tag.findById(tagId);
    
    if (!tag) {
      return null;
    }

    // Verificar que el usuario tenga acceso a esta etiqueta
    const hasAccess = await Tag.userHasAccess(userId, tagId);
    
    if (!hasAccess) {
      return null;
    }

    return tag;
  }

  /**
   * Obtener etiquetas según el rol del usuario
   * @param {number} userId - ID del usuario
   * @param {string} rol - Rol del usuario (ADMIN o EMPLEADO)
   * @returns {Array<Object>} Lista de etiquetas
   */
  static async getUserTags(userId, rol) {
    if (rol === 'ADMIN') {
      // Admin ve todas sus etiquetas
      return await Tag.findByOwnerId(userId);
    } else {
      // Empleado ve solo las etiquetas asignadas a él
      return await Tag.findByUserId(userId);
    }
  }

  /**
   * Actualizar una etiqueta (solo admin propietario)
   * @param {number} tagId - ID de la etiqueta
   * @param {number} userId - ID del usuario que intenta actualizar
   * @param {Object} data - Datos a actualizar
   * @returns {Object} La etiqueta actualizada
   */
  static async updateTag(tagId, userId, data) {
    const tag = await Tag.findById(tagId);
    
    if (!tag) {
      throw new Error('Etiqueta no encontrada');
    }

    if (tag.owner_id !== userId) {
      throw new Error('No tienes permiso para editar esta etiqueta');
    }

    if (tag.is_default) {
      throw new Error('No puedes editar la etiqueta "Todo"');
    }

    return await Tag.update(tagId, data);
  }

  /**
   * Eliminar una etiqueta (solo admin propietario)
   * @param {number} tagId - ID de la etiqueta
   * @param {number} userId - ID del usuario que intenta eliminar
   * @returns {boolean} True si se eliminó
   */
  static async deleteTag(tagId, userId) {
    const tag = await Tag.findById(tagId);
    
    if (!tag) {
      throw new Error('Etiqueta no encontrada');
    }

    if (tag.owner_id !== userId) {
      throw new Error('No tienes permiso para eliminar esta etiqueta');
    }

    if (tag.is_default) {
      throw new Error('No puedes eliminar la etiqueta "Todo"');
    }

    return await Tag.delete(tagId);
  }

  /**
   * Asignar etiqueta a un empleado (solo admin propietario)
   * @param {number} tagId - ID de la etiqueta
   * @param {number} employeeId - ID del empleado
   * @param {number} adminId - ID del admin
   * @returns {Object} La relación creada
   */
  static async assignTagToEmployee(tagId, employeeId, adminId) {
    const tag = await Tag.findById(tagId);
    
    if (!tag) {
      throw new Error('Etiqueta no encontrada');
    }

    if (tag.owner_id !== adminId) {
      throw new Error('No tienes permiso para asignar esta etiqueta');
    }

    // Verificar que el empleado existe y es empleado del admin
    const employee = await User.findById(employeeId);
    if (!employee) {
      throw new Error('Empleado no encontrado');
    }

    if (employee.id_padre !== adminId) {
      throw new Error('Este empleado no pertenece a tu organización');
    }

    return await Tag.assignToUser(tagId, employeeId, adminId);
  }

  /**
   * Quitar etiqueta de un empleado (solo admin propietario)
   * @param {number} tagId - ID de la etiqueta
   * @param {number} employeeId - ID del empleado
   * @param {number} adminId - ID del admin
   * @returns {boolean} True si se eliminó
   */
  static async removeTagFromEmployee(tagId, employeeId, adminId) {
    const tag = await Tag.findById(tagId);
    
    if (!tag) {
      throw new Error('Etiqueta no encontrada');
    }

    if (tag.owner_id !== adminId) {
      throw new Error('No tienes permiso para quitar esta etiqueta');
    }

    return await Tag.removeFromUser(tagId, employeeId);
  }

  /**
   * Obtener empleados con acceso a una etiqueta
   * @param {number} tagId - ID de la etiqueta
   * @param {number} userId - ID del usuario que consulta
   * @returns {Array<Object>} Lista de empleados
   */
  static async getEmployeesWithAccess(tagId, userId) {
    const tag = await Tag.findById(tagId);
    
    if (!tag) {
      throw new Error('Etiqueta no encontrada');
    }

    if (tag.owner_id !== userId) {
      throw new Error('No tienes permiso para ver esta información');
    }

    return await Tag.getUsersWithAccess(tagId);
  }

  /**
   * Asignar chat a una etiqueta
   * @param {number} tagId - ID de la etiqueta
   * @param {string} chatId - ID del chat de WhatsApp
   * @param {number} userId - ID del usuario que asigna
   * @returns {Object} La relación creada
   */
  static async assignChatToTag(tagId, chatId, userId) {
    const tag = await Tag.findById(tagId);
    
    if (!tag) {
      throw new Error('Etiqueta no encontrada');
    }

    // Verificar que el usuario tiene acceso a esta etiqueta
    const hasAccess = await Tag.userHasAccess(userId, tagId);
    if (!hasAccess) {
      throw new Error('No tienes acceso a esta etiqueta');
    }

    // No permitir asignar a la etiqueta "Todo"
    if (tag.is_default) {
      throw new Error('No puedes asignar chats a la etiqueta "Todo"');
    }

    return await ChatTag.assign(chatId, tagId, userId);
  }

  /**
   * Remover chat de una etiqueta
   * @param {number} tagId - ID de la etiqueta
   * @param {string} chatId - ID del chat
   * @param {number} userId - ID del usuario que remueve
   * @returns {boolean} True si se eliminó
   */
  static async removeChatFromTag(tagId, chatId, userId) {
    const tag = await Tag.findById(tagId);
    
    if (!tag) {
      throw new Error('Etiqueta no encontrada');
    }

    // Verificar que el usuario tiene acceso a esta etiqueta
    const hasAccess = await Tag.userHasAccess(userId, tagId);
    if (!hasAccess) {
      throw new Error('No tienes acceso a esta etiqueta');
    }

    if (tag.is_default) {
      throw new Error('No puedes remover chats de la etiqueta "Todo"');
    }

    return await ChatTag.remove(chatId, tagId);
  }

  /**
   * Obtener chats de una etiqueta
   * @param {number} tagId - ID de la etiqueta
   * @param {number} userId - ID del usuario que consulta
   * @returns {Array<Object>} Lista de chats
   */
  static async getChatsByTag(tagId, userId) {
    const tag = await Tag.findById(tagId);
    
    if (!tag) {
      throw new Error('Etiqueta no encontrada');
    }

    // Verificar acceso
    const hasAccess = await Tag.userHasAccess(userId, tagId);
    if (!hasAccess) {
      throw new Error('No tienes acceso a esta etiqueta');
    }

    return await ChatTag.findByTagId(tagId);
  }

  /**
   * Obtener etiquetas de un chat
   * @param {string} chatId - ID del chat
   * @returns {Array<Object>} Lista de etiquetas
   */
  static async getTagsByChat(chatId) {
    return await ChatTag.findByChatId(chatId);
  }

  /**
   * Obtener IDs de chats accesibles para un usuario según sus etiquetas
   * @param {number} userId - ID del usuario
   * @param {string} rol - Rol del usuario
   * @param {number} adminId - ID del admin (puede ser el mismo userId si es admin)
   * @returns {Array<string>|null} Lista de IDs de chats, o null si tiene acceso a "Todo"
   */
  static async getAccessibleChatIds(userId, rol, adminId) {
    // Si es admin, verificar si debe ver todos los chats o filtrar
    if (rol === 'ADMIN') {
      // Admin siempre tiene acceso a "Todo" (su propia etiqueta)
      return null; // null indica acceso a TODOS los chats
    }

    // Si es empleado, verificar si tiene la etiqueta "Todo"
    const hasTodoAccess = await Tag.userHasTodoAccess(userId, adminId);
    if (hasTodoAccess) {
      return null; // null indica acceso a TODOS los chats
    }

    // Si no tiene "Todo", obtener chats de sus etiquetas asignadas
    return await ChatTag.getChatIdsByUserTags(userId, adminId);
  }

  /**
   * Obtener estadísticas de una etiqueta
   * @param {number} tagId - ID de la etiqueta
   * @param {number} userId - ID del usuario
   * @returns {Object} Estadísticas
   */
  static async getTagStats(tagId, userId) {
    const tag = await Tag.findById(tagId);
    
    if (!tag) {
      throw new Error('Etiqueta no encontrada');
    }

    // Verificar acceso
    const hasAccess = await Tag.userHasAccess(userId, tagId);
    if (!hasAccess) {
      throw new Error('No tienes acceso a esta etiqueta');
    }

    const stats = await ChatTag.getTagStats(tagId);
    const users = await Tag.getUsersWithAccess(tagId);

    return {
      ...stats,
      userCount: users.length
    };
  }
}

module.exports = TagService;
