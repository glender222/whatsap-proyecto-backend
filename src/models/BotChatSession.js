const pool = require('../config/database');

class BotChatSession {
  /**
   * Crear nueva sesión (cuando bot envía menú de opciones)
   */
  static async create({ botId, chatId, status = 'pending' }) {
    const query = `
      INSERT INTO bot_chat_sessions (bot_id, chat_id, status)
      VALUES ($1, $2, $3)
      RETURNING *
    `;
    const result = await pool.query(query, [botId, chatId, status]);
    return result.rows[0];
  }

  /**
   * Verificar si un chat tiene sesión activa (pending o active)
   */
  static async hasActiveSession(chatId, botId) {
    const query = `
      SELECT * FROM bot_chat_sessions
      WHERE chat_id = $1 
        AND bot_id = $2
        AND status IN ('pending', 'active')
      ORDER BY created_at DESC
      LIMIT 1
    `;
    const result = await pool.query(query, [chatId, botId]);
    return result.rows[0] || null;
  }

  /**
   * Obtener sesión activa por chat (cualquier bot)
   */
  static async getActiveByChat(chatId) {
    const query = `
      SELECT * FROM bot_chat_sessions
      WHERE chat_id = $1
        AND status IN ('pending', 'active')
      ORDER BY created_at DESC
      LIMIT 1
    `;
    const result = await pool.query(query, [chatId]);
    return result.rows[0] || null;
  }

  /**
   * Actualizar sesión cuando usuario responde
   */
  static async updateResponse({ sessionId, selectedOption, userResponse, tagId, status = 'active' }) {
    const query = `
      UPDATE bot_chat_sessions
      SET 
        selected_option = $1,
        user_response = $2,
        tag_id = $3,
        status = $4
      WHERE id = $5
      RETURNING *
    `;
    const result = await pool.query(query, [selectedOption, userResponse, tagId, status, sessionId]);
    return result.rows[0];
  }

  /**
   * Marcar sesión como completada
   */
  static async complete(sessionId) {
    const query = `
      UPDATE bot_chat_sessions
      SET 
        status = 'completed',
        completed_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *
    `;
    const result = await pool.query(query, [sessionId]);
    return result.rows[0];
  }

  /**
   * Forzar reset de sesión (marcar como completada manualmente)
   */
  static async resetSession(chatId, botId) {
    const query = `
      UPDATE bot_chat_sessions
      SET 
        status = 'completed',
        completed_at = CURRENT_TIMESTAMP
      WHERE chat_id = $1
        AND bot_id = $2
        AND status IN ('pending', 'active')
      RETURNING *
    `;
    const result = await pool.query(query, [chatId, botId]);
    return result.rows;
  }

  /**
   * Obtener estadísticas de un bot
   */
  static async getStats(botId) {
    const query = `
      SELECT 
        COUNT(*) as total_sessions,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending,
        COUNT(CASE WHEN status = 'active' THEN 1 END) as active,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed,
        COUNT(CASE WHEN tag_id IS NOT NULL THEN 1 END) as with_tag,
        AVG(EXTRACT(EPOCH FROM (completed_at - created_at))) as avg_duration_seconds
      FROM bot_chat_sessions
      WHERE bot_id = $1
    `;
    const result = await pool.query(query, [botId]);
    return result.rows[0];
  }

  /**
   * Obtener distribución por tags
   */
  static async getTagDistribution(botId) {
    const query = `
      SELECT 
        t.id as tag_id,
        t.name as tag_name,
        COUNT(bcs.id) as count
      FROM bot_chat_sessions bcs
      LEFT JOIN tags t ON bcs.tag_id = t.id
      WHERE bcs.bot_id = $1 AND bcs.tag_id IS NOT NULL
      GROUP BY t.id, t.name
      ORDER BY count DESC
    `;
    const result = await pool.query(query, [botId]);
    return result.rows;
  }

  /**
   * Obtener todas las sesiones de un bot (con paginación)
   */
  static async findByBot(botId, { limit = 50, offset = 0 } = {}) {
    const query = `
      SELECT 
        bcs.*,
        t.name as tag_name,
        t.color as tag_color
      FROM bot_chat_sessions bcs
      LEFT JOIN tags t ON bcs.tag_id = t.id
      WHERE bcs.bot_id = $1
      ORDER BY bcs.created_at DESC
      LIMIT $2 OFFSET $3
    `;
    const result = await pool.query(query, [botId, limit, offset]);
    return result.rows;
  }

  /**
   * Obtener historial de sesiones de un chat específico
   */
  static async findByChat(chatId, { limit = 20 } = {}) {
    const query = `
      SELECT 
        bcs.*,
        b.name as bot_name,
        t.name as tag_name,
        t.color as tag_color
      FROM bot_chat_sessions bcs
      LEFT JOIN bots b ON bcs.bot_id = b.id
      LEFT JOIN tags t ON bcs.tag_id = t.id
      WHERE bcs.chat_id = $1
      ORDER BY bcs.created_at DESC
      LIMIT $2
    `;
    const result = await pool.query(query, [chatId, limit]);
    return result.rows;
  }

  /**
   * Encontrar sesión por ID
   */
  static async findById(sessionId) {
    const query = `
      SELECT 
        bcs.*,
        b.name as bot_name,
        t.name as tag_name,
        t.color as tag_color
      FROM bot_chat_sessions bcs
      LEFT JOIN bots b ON bcs.bot_id = b.id
      LEFT JOIN tags t ON bcs.tag_id = t.id
      WHERE bcs.id = $1
    `;
    const result = await pool.query(query, [sessionId]);
    return result.rows[0] || null;
  }
}

module.exports = BotChatSession;
