const pool = require('../config/database');

class BotRule {
  /**
   * Crear tabla unificada de reglas de bot
   */
  static async createTableIfNotExists() {
    const botRulesQuery = `
      CREATE TABLE IF NOT EXISTS bot_rules (
        id BIGSERIAL PRIMARY KEY,
        bot_id BIGINT NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
        type VARCHAR(20) NOT NULL CHECK (type IN ('option', 'keyword')),
        "order" INT,
        text VARCHAR(255) NOT NULL,
        group_name VARCHAR(100),
        tag_id BIGINT REFERENCES tags(id) ON DELETE CASCADE,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(bot_id, type, "order") DEFERRABLE INITIALLY DEFERRED
      );
    `;

    const indexQuery = `
      CREATE INDEX IF NOT EXISTS idx_bot_rules_bot_id ON bot_rules(bot_id);
      CREATE INDEX IF NOT EXISTS idx_bot_rules_type ON bot_rules(type);
      CREATE INDEX IF NOT EXISTS idx_bot_rules_tag_id ON bot_rules(tag_id);
      CREATE INDEX IF NOT EXISTS idx_bot_rules_bot_type ON bot_rules(bot_id, type);
      CREATE INDEX IF NOT EXISTS idx_bot_rules_text ON bot_rules USING gin(to_tsvector('spanish', text));
    `;

    try {
      await pool.query(botRulesQuery);
      console.log('✅ Tabla bot_rules creada o ya existe');
      await pool.query(indexQuery);
      console.log('✅ Índices para bot_rules creados o ya existen');
    } catch (error) {
      console.error('❌ Error creando tabla bot_rules:', error.message);
      throw error;
    }
  }

  /**
   * CRUD METHODS - PRODUCCIÓN READY
   */

  /**
   * Crear una regla para un bot
   * @param {number} botId - ID del bot
   * @param {string} type - 'option' | 'keyword'
   * @param {string} text - Texto de la opción o palabra clave
   * @param {number} tagId - ID del tag destino (opcional)
   * @param {number} order - Orden (para type='option')
   * @param {string} groupName - Nombre del grupo (para type='keyword')
   * @returns {Object} Regla creada
   */
  static async create(botId, type, text, tagId = null, order = null, groupName = null) {
    if (!botId || !type || !text) {
      throw new Error('Campos requeridos: botId, type, text');
    }
    if (!['option', 'keyword'].includes(type)) {
      throw new Error('type debe ser "option" o "keyword"');
    }

    const query = `
      INSERT INTO bot_rules (bot_id, type, text, tag_id, "order", group_name)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *;
    `;

    try {
      const result = await pool.query(query, [botId, type, text, tagId, order, groupName]);
      return result.rows[0];
    } catch (error) {
      if (error.code === '23505') {
        throw new Error(`Conflicto: Ya existe una regla con ese orden para este bot`);
      }
      throw error;
    }
  }

  /**
   * Obtener todas las reglas de un bot
   * @param {number} botId - ID del bot
   * @param {string} type - Filtrar por tipo opcional
   * @returns {Array<Object>} Lista de reglas
   */
  static async findByBotId(botId, type = null) {
    let query = `SELECT * FROM bot_rules WHERE bot_id = $1 AND is_active = true`;
    const params = [botId];
    
    if (type) {
      query += ` AND type = $2`;
      params.push(type);
    }
    
    query += ` ORDER BY "order" ASC, created_at ASC;`;
    const result = await pool.query(query, params);
    return result.rows;
  }

  /**
   * Obtener una regla por ID
   * @param {number} id - ID de la regla
   * @returns {Object|null} Regla o null
   */
  static async findById(id) {
    const result = await pool.query(`SELECT * FROM bot_rules WHERE id = $1;`, [id]);
    return result.rows[0] || null;
  }

  /**
   * Actualizar una regla
   * @param {number} id - ID de la regla
   * @param {Object} data - Campos a actualizar
   * @returns {Object|null} Regla actualizada
   */
  static async update(id, data) {
    const fields = [];
    const values = [];
    let paramCount = 1;

    if (data.text !== undefined) {
      fields.push(`text = $${paramCount}`);
      values.push(data.text);
      paramCount++;
    }
    if (data.tag_id !== undefined) {
      fields.push(`tag_id = $${paramCount}`);
      values.push(data.tag_id);
      paramCount++;
    }
    if (data.order !== undefined) {
      fields.push(`"order" = $${paramCount}`);
      values.push(data.order);
      paramCount++;
    }
    if (data.group_name !== undefined) {
      fields.push(`group_name = $${paramCount}`);
      values.push(data.group_name);
      paramCount++;
    }
    if (data.is_active !== undefined) {
      fields.push(`is_active = $${paramCount}`);
      values.push(data.is_active);
      paramCount++;
    }

    if (fields.length === 0) {
      throw new Error('No hay campos para actualizar');
    }

    fields.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(id);

    const query = `UPDATE bot_rules SET ${fields.join(', ')} WHERE id = $${paramCount} RETURNING *;`;
    const result = await pool.query(query, values);
    return result.rows[0] || null;
  }

  /**
   * Eliminar una regla (soft delete)
   * @param {number} id - ID de la regla
   * @returns {boolean} True si se eliminó
   */
  static async delete(id) {
    const result = await pool.query(
      `UPDATE bot_rules SET is_active = false, updated_at = CURRENT_TIMESTAMP WHERE id = $1;`,
      [id]
    );
    return result.rowCount > 0;
  }

  /**
   * Eliminar una regla permanentemente
   * @param {number} id - ID de la regla
   * @returns {boolean} True si se eliminó
   */
  static async hardDelete(id) {
    const result = await pool.query(`DELETE FROM bot_rules WHERE id = $1;`, [id]);
    return result.rowCount > 0;
  }

  /**
   * QUERY HELPERS - MODALITY SPECIFIC
   */

  /**
   * Obtener opciones de un bot ordenadas
   * @param {number} botId - ID del bot
   * @returns {Array<Object>} Opciones ordenadas
   */
  static async findOptions(botId) {
    const result = await pool.query(
      `SELECT * FROM bot_rules WHERE bot_id = $1 AND type = 'option' AND is_active = true ORDER BY "order" ASC;`,
      [botId]
    );
    return result.rows;
  }

  /**
   * Buscar una opción exacta por número
   * @param {number} botId - ID del bot
   * @param {number} order - Número de opción
   * @returns {Object|null} Opción o null
   */
  static async findOptionByOrder(botId, order) {
    const result = await pool.query(
      `SELECT * FROM bot_rules WHERE bot_id = $1 AND type = 'option' AND "order" = $2 AND is_active = true LIMIT 1;`,
      [botId, order]
    );
    return result.rows[0] || null;
  }

  /**
   * Obtener todas las palabras clave de un bot
   * @param {number} botId - ID del bot
   * @returns {Array<Object>} Palabras clave
   */
  static async findKeywords(botId) {
    const result = await pool.query(
      `SELECT * FROM bot_rules WHERE bot_id = $1 AND type = 'keyword' AND is_active = true ORDER BY group_name ASC, text ASC;`,
      [botId]
    );
    return result.rows;
  }

  /**
   * Buscar coincidencias de palabras clave en un texto
   * Busca palabras exactas separadas por espacios
   * @param {number} botId - ID del bot
   * @param {string} text - Texto a buscar
   * @returns {Array<Object>} Palabras clave coincidentes
   */
  static async findKeywordMatches(botId, text) {
    const words = text.toLowerCase().trim().split(/\s+/);
    const result = await pool.query(
      `SELECT * FROM bot_rules WHERE bot_id = $1 AND type = 'keyword' AND is_active = true AND LOWER(text) = ANY($2) ORDER BY LENGTH(text) DESC, created_at ASC;`,
      [botId, words]
    );
    return result.rows;
  }

  /**
   * UTILITY METHODS
   */

  /**
   * Obtener estadísticas de reglas para un bot
   * @param {number} botId - ID del bot
   * @returns {Object} Estadísticas
   */
  static async getStats(botId) {
    const result = await pool.query(
      `SELECT 
        (SELECT COUNT(*) FROM bot_rules WHERE bot_id = $1 AND type = 'option' AND is_active = true) as option_count,
        (SELECT COUNT(*) FROM bot_rules WHERE bot_id = $1 AND type = 'keyword' AND is_active = true) as keyword_count,
        (SELECT COUNT(DISTINCT tag_id) FROM bot_rules WHERE bot_id = $1 AND is_active = true) as tag_count`,
      [botId]
    );
    return result.rows[0];
  }

  /**
   * Reordenar opciones en transacción
   * @param {number} botId - ID del bot
   * @param {Array<{id, order}>} rules - Reglas con nuevo orden
   * @returns {boolean} True si se actualizó
   */
  static async reorderOptions(botId, rules) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      for (const rule of rules) {
        await client.query(
          `UPDATE bot_rules SET "order" = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 AND bot_id = $3;`,
          [rule.order, rule.id, botId]
        );
      }
      await client.query('COMMIT');
      return true;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Obtener grupos de palabras clave
   * @param {number} botId - ID del bot
   * @returns {Array<{name, keywords}>} Grupos organizados
   */
  static async getKeywordGroups(botId) {
    const keywords = await this.findKeywords(botId);
    const groups = {};
    keywords.forEach(kw => {
      const group = kw.group_name || 'Sin grupo';
      if (!groups[group]) groups[group] = [];
      groups[group].push(kw);
    });
    return Object.entries(groups).map(([name, keywords]) => ({ name, keywords }));
  }

  /**
   * Duplicar reglas de un bot a otro
   * @param {number} sourceBotId - ID del bot fuente
   * @param {number} targetBotId - ID del bot destino
   * @returns {number} Cantidad de reglas duplicadas
   */
  static async duplicate(sourceBotId, targetBotId) {
    const result = await pool.query(
      `INSERT INTO bot_rules (bot_id, type, text, tag_id, "order", group_name) SELECT $1, type, text, tag_id, "order", group_name FROM bot_rules WHERE bot_id = $2 AND is_active = true;`,
      [targetBotId, sourceBotId]
    );
    return result.rowCount;
  }
}

module.exports = BotRule;
