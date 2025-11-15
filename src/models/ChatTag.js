const pool = require('../config/database');

class ChatTag {
  /**
   * Crear tabla de relación chat-etiqueta si no existe
   */
  static async createTableIfNotExists() {
    const query = `
      CREATE TABLE IF NOT EXISTS chat_tags (
        id BIGSERIAL PRIMARY KEY,
        chat_id VARCHAR(255) NOT NULL,
        tag_id BIGINT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
        assigned_by BIGINT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(chat_id, tag_id)
      );
    `;

    const indexQuery = `
      CREATE INDEX IF NOT EXISTS idx_chat_tags_chat_id ON chat_tags(chat_id);
      CREATE INDEX IF NOT EXISTS idx_chat_tags_tag_id ON chat_tags(tag_id);
    `;

    try {
      await pool.query(query);
      console.log('✅ Tabla chat_tags creada o ya existe');
      await pool.query(indexQuery);
      console.log('✅ Índices para chat_tags creados o ya existen');
    } catch (error) {
      console.error('❌ Error creando tabla chat_tags:', error.message);
      throw error;
    }
  }

  /**
   * Asignar un chat a una etiqueta
   * @param {string} chatId - ID del chat de WhatsApp
   * @param {number} tagId - ID de la etiqueta
   * @param {number} assignedBy - ID del usuario que asigna
   * @returns {Object} La relación creada
   */
  static async assign(chatId, tagId, assignedBy) {
    const query = `
      INSERT INTO chat_tags (chat_id, tag_id, assigned_by)
      VALUES ($1, $2, $3)
      ON CONFLICT (chat_id, tag_id) DO NOTHING
      RETURNING *;
    `;
    const result = await pool.query(query, [chatId, tagId, assignedBy]);
    return result.rows[0];
  }

  /**
   * Remover un chat de una etiqueta
   * @param {string} chatId - ID del chat
   * @param {number} tagId - ID de la etiqueta
   * @returns {boolean} True si se eliminó
   */
  static async remove(chatId, tagId) {
    const query = `
      DELETE FROM chat_tags
      WHERE chat_id = $1 AND tag_id = $2;
    `;
    const result = await pool.query(query, [chatId, tagId]);
    return result.rowCount > 0;
  }

  /**
   * Obtener todas las etiquetas de un chat
   * @param {string} chatId - ID del chat
   * @returns {Array<Object>} Lista de etiquetas
   */
  static async findByChatId(chatId) {
    const query = `
      SELECT t.*, ct.assigned_by, ct.created_at as assigned_at
      FROM tags t
      INNER JOIN chat_tags ct ON t.id = ct.tag_id
      WHERE ct.chat_id = $1
      ORDER BY ct.created_at DESC;
    `;
    const result = await pool.query(query, [chatId]);
    return result.rows;
  }

  /**
   * Obtener todos los chats de una etiqueta
   * @param {number} tagId - ID de la etiqueta
   * @returns {Array<string>} Lista de IDs de chats
   */
  static async findByTagId(tagId) {
    const query = `
      SELECT chat_id, assigned_by, created_at
      FROM chat_tags
      WHERE tag_id = $1
      ORDER BY created_at DESC;
    `;
    const result = await pool.query(query, [tagId]);
    return result.rows;
  }

  /**
   * Obtener IDs de chats según las etiquetas de un usuario
   * @param {number} userId - ID del usuario
   * @param {number} adminId - ID del admin (para verificar "Todo")
   * @returns {Array<string>} Lista de IDs de chats
   */
  static async getChatIdsByUserTags(userId, adminId) {
    const query = `
      SELECT DISTINCT ct.chat_id
      FROM chat_tags ct
      INNER JOIN user_tags ut ON ct.tag_id = ut.tag_id
      WHERE ut.user_id = $1
      ORDER BY ct.chat_id;
    `;
    const result = await pool.query(query, [userId]);
    return result.rows.map(row => row.chat_id);
  }

  /**
   * Obtener IDs de chats de un admin (todas las etiquetas que posee)
   * @param {number} adminId - ID del admin
   * @returns {Array<string>} Lista de IDs de chats
   */
  static async getChatIdsByAdminTags(adminId) {
    const query = `
      SELECT DISTINCT ct.chat_id
      FROM chat_tags ct
      INNER JOIN tags t ON ct.tag_id = t.id
      WHERE t.owner_id = $1
      ORDER BY ct.chat_id;
    `;
    const result = await pool.query(query, [adminId]);
    return result.rows.map(row => row.chat_id);
  }

  /**
   * Verificar si un chat tiene una etiqueta específica
   * @param {string} chatId - ID del chat
   * @param {number} tagId - ID de la etiqueta
   * @returns {boolean} True si el chat tiene esa etiqueta
   */
  static async chatHasTag(chatId, tagId) {
    const query = `
      SELECT 1 FROM chat_tags
      WHERE chat_id = $1 AND tag_id = $2
      LIMIT 1;
    `;
    const result = await pool.query(query, [chatId, tagId]);
    return result.rowCount > 0;
  }

  /**
   * Remover todas las etiquetas de un chat
   * @param {string} chatId - ID del chat
   * @returns {number} Cantidad de etiquetas removidas
   */
  static async removeAllFromChat(chatId) {
    const query = `
      DELETE FROM chat_tags
      WHERE chat_id = $1;
    `;
    const result = await pool.query(query, [chatId]);
    return result.rowCount;
  }

  /**
   * Obtener estadísticas de una etiqueta
   * @param {number} tagId - ID de la etiqueta
   * @returns {Object} Estadísticas (cantidad de chats)
   */
  static async getTagStats(tagId) {
    const query = `
      SELECT COUNT(*) as chat_count
      FROM chat_tags
      WHERE tag_id = $1;
    `;
    const result = await pool.query(query, [tagId]);
    return {
      chatCount: parseInt(result.rows[0].chat_count, 10)
    };
  }

  /**
   * Eliminar TODOS los chat_tags de un tenant/admin
   * (usado al hacer logout para limpiar datos de chats antiguos)
   * @param {number} adminId - ID del admin propietario
   * @returns {number} Cantidad de registros eliminados
   */
  static async deleteAllByAdmin(adminId) {
    const query = `
      DELETE FROM chat_tags
      WHERE tag_id IN (
        SELECT id FROM tags WHERE owner_id = $1
      );
    `;
    const result = await pool.query(query, [adminId]);
    return result.rowCount;
  }
}

module.exports = ChatTag;
