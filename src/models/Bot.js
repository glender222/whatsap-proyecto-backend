const pool = require('../config/database');

class Bot {
  /**
   * Crear tabla de bots si no existe
   */
  static async createTableIfNotExists() {
    const botsQuery = `
      CREATE TABLE IF NOT EXISTS bots (
        id BIGSERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        owner_id BIGINT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
        is_active BOOLEAN DEFAULT true,
        strategy VARCHAR(20) DEFAULT 'round_robin' CHECK (strategy IN ('round_robin', 'random', 'priority')),
        last_assigned_index INT DEFAULT 0,
        modality VARCHAR(20) DEFAULT 'options' CHECK (modality IN ('options', 'keywords')),
        welcome_message TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(owner_id, name)
      );
    `;

    const botTagsQuery = `
      CREATE TABLE IF NOT EXISTS bot_tags (
        bot_id BIGINT NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
        tag_id BIGINT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
        assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (bot_id, tag_id)
      );
    `;

    const indexQuery = `
      CREATE INDEX IF NOT EXISTS idx_bots_owner_id ON bots(owner_id);
      CREATE INDEX IF NOT EXISTS idx_bots_is_active ON bots(is_active);
      CREATE INDEX IF NOT EXISTS idx_bot_tags_bot_id ON bot_tags(bot_id);
      CREATE INDEX IF NOT EXISTS idx_bot_tags_tag_id ON bot_tags(tag_id);
    `;

    try {
      await pool.query(botsQuery);
      console.log('✅ Tabla bots creada o ya existe');
      await pool.query(botTagsQuery);
      console.log('✅ Tabla bot_tags creada o ya existe');
      await pool.query(indexQuery);
      console.log('✅ Índices para bots y bot_tags creados o ya existen');
    } catch (error) {
      console.error('❌ Error creando tablas de bots:', error.message);
      throw error;
    }
  }

  /**
   * Crear un nuevo bot
   * @param {string} name - Nombre del bot
   * @param {number} ownerId - ID del admin propietario
   * @param {string} strategy - Estrategia de distribución
   * @param {string} modality - 'options' | 'keywords'
   * @param {string} welcome_message - Mensaje de bienvenida
   * @param {boolean} isActive - Si el bot debe estar activo (default false)
   * @returns {Object} Bot creado
   */
  static async create(name, ownerId, strategy = 'round_robin', modality = 'options', welcome_message = '', isActive = false) {
    const query = `
      INSERT INTO bots (name, owner_id, strategy, modality, welcome_message, is_active)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *;
    `;

    try {
      const result = await pool.query(query, [name, ownerId, strategy, modality, welcome_message, isActive]);
      return result.rows[0];
    } catch (error) {
      if (error.code === '23505') {
        throw new Error('Ya existe un bot con ese nombre');
      }
      throw error;
    }
  }

  /**
   * Obtener todos los bots de un propietario
   * @param {number} ownerId - ID del admin
   * @returns {Array<Object>} Lista de bots
   */
  static async findByOwnerId(ownerId) {
    const query = `
      SELECT b.*,
        COUNT(DISTINCT bt.tag_id) as tag_count
      FROM bots b
      LEFT JOIN bot_tags bt ON b.id = bt.bot_id
      WHERE b.owner_id = $1
      GROUP BY b.id
      ORDER BY b.created_at DESC;
    `;
    const result = await pool.query(query, [ownerId]);
    return result.rows;
  }

  /**
   * Obtener un bot por ID
   * @param {number} id - ID del bot
   * @returns {Object|null} Bot o null
   */
  static async findById(id) {
    const query = `
      SELECT b.*,
        COUNT(DISTINCT bt.tag_id) as tag_count
      FROM bots b
      LEFT JOIN bot_tags bt ON b.id = bt.bot_id
      WHERE b.id = $1
      GROUP BY b.id;
    `;
    const result = await pool.query(query, [id]);
    return result.rows[0] || null;
  }

  /**
   * Verificar si un bot pertenece a un propietario
   * @param {number} botId - ID del bot
   * @param {number} ownerId - ID del propietario
   * @returns {boolean} True si el bot pertenece al propietario
   */
  static async belongsToOwner(botId, ownerId) {
    const query = `
      SELECT 1 FROM bots
      WHERE id = $1 AND owner_id = $2
      LIMIT 1;
    `;
    const result = await pool.query(query, [botId, ownerId]);
    return result.rows.length > 0;
  }

  /**
   * Actualizar un bot
   * @param {number} id - ID del bot
   * @param {Object} data - Datos a actualizar
   * @returns {Object|null} Bot actualizado
   */
  static async update(id, data) {
    const fields = [];
    const values = [];
    let paramCount = 1;

    if (data.name !== undefined) {
      fields.push(`name = $${paramCount}`);
      values.push(data.name);
      paramCount++;
    }

    if (data.is_active !== undefined) {
      fields.push(`is_active = $${paramCount}`);
      values.push(data.is_active);
      paramCount++;
    }

    if (data.strategy !== undefined) {
      fields.push(`strategy = $${paramCount}`);
      values.push(data.strategy);
      paramCount++;
    }

    if (data.modality !== undefined) {
      fields.push(`modality = $${paramCount}`);
      values.push(data.modality);
      paramCount++;
    }

    if (data.welcome_message !== undefined) {
      fields.push(`welcome_message = $${paramCount}`);
      values.push(data.welcome_message);
      paramCount++;
    }

    if (fields.length === 0) {
      throw new Error('No hay campos para actualizar');
    }

    fields.push(`updated_at = CURRENT_TIMESTAMP`);
    
    // Agregar id para el WHERE - usar paramCount sin incrementar después
    values.push(id);

    const query = `
      UPDATE bots
      SET ${fields.join(', ')}
      WHERE id = $${paramCount}
      RETURNING *;
    `;

    try {
      const result = await pool.query(query, values);
      return result.rows[0] || null;
    } catch (error) {
      console.error('Error en Bot.update():', error.message);
      console.error('Query:', query);
      console.error('Values:', values);
      throw error;
    }
  }

  /**
   * Eliminar un bot
   * @param {number} id - ID del bot
   * @returns {boolean} True si se eliminó
   */
  static async delete(id) {
    const query = `DELETE FROM bots WHERE id = $1;`;
    const result = await pool.query(query, [id]);
    return result.rowCount > 0;
  }

  /**
   * Asignar un tag al bot
   * @param {number} botId - ID del bot
   * @param {number} tagId - ID del tag
   * @returns {Object} Relación creada
   */
  static async assignTag(botId, tagId) {
    const query = `
      INSERT INTO bot_tags (bot_id, tag_id)
      VALUES ($1, $2)
      ON CONFLICT (bot_id, tag_id) DO NOTHING
      RETURNING *;
    `;
    const result = await pool.query(query, [botId, tagId]);
    return result.rows[0];
  }

  /**
   * Remover un tag del bot
   * @param {number} botId - ID del bot
   * @param {number} tagId - ID del tag
   * @returns {boolean} True si se eliminó
   */
  static async removeTag(botId, tagId) {
    const query = `
      DELETE FROM bot_tags
      WHERE bot_id = $1 AND tag_id = $2;
    `;
    const result = await pool.query(query, [botId, tagId]);
    return result.rowCount > 0;
  }

  /**
   * Obtener tags de un bot
   * @param {number} botId - ID del bot
   * @returns {Array<Object>} Lista de tags
   */
  static async getTags(botId) {
    const query = `
      SELECT t.*, bt.assigned_at
      FROM tags t
      INNER JOIN bot_tags bt ON t.id = bt.tag_id
      WHERE bt.bot_id = $1
      ORDER BY bt.assigned_at DESC;
    `;
    const result = await pool.query(query, [botId]);
    return result.rows;
  }

  /**
   * Obtener estadísticas de un bot
   * @param {number} botId - ID del bot
   * @returns {Object} Estadísticas
   */
  static async getStats(botId) {
    const query = `
      SELECT 
        (SELECT COUNT(*) FROM bot_tags WHERE bot_id = $1) as tag_count,
        (SELECT COUNT(DISTINCT ct.chat_id) 
         FROM chat_tags ct 
         INNER JOIN bot_tags bt ON ct.tag_id = bt.tag_id 
         WHERE bt.bot_id = $1) as monitored_chats
    `;
    const result = await pool.query(query, [botId]);
    return result.rows[0];
  }

  /**
   * Desactivar todos los bots de un propietario excepto uno
   * (Garantiza exclusividad: solo 1 bot activo por admin)
   * @param {number} ownerId - ID del admin propietario
   * @param {number} botIdToActivate - ID del bot a activar
   * @returns {Object} Resultado de la operación
   */
  static async ensureOnlyOneBotActive(ownerId, botIdToActivate) {
    const deactivateQuery = `
      UPDATE bots
      SET is_active = false
      WHERE owner_id = $1 AND id != $2;
    `;

    const activateQuery = `
      UPDATE bots
      SET is_active = true
      WHERE id = $1 AND owner_id = $2;
    `;

    try {
      const deactivateResult = await pool.query(deactivateQuery, [ownerId, botIdToActivate]);
      const activateResult = await pool.query(activateQuery, [botIdToActivate, ownerId]);

      return {
        deactivated: deactivateResult.rowCount,
        activated: activateResult.rowCount,
        success: true
      };
    } catch (error) {
      console.error('Error en ensureOnlyOneBotActive():', error.message);
      throw error;
    }
  }

  /**
   * Obtener el bot activo de un propietario
   * @param {number} ownerId - ID del admin propietario
   * @returns {Object|null} Bot activo o null si no hay
   */
  static async getActiveBotByOwner(ownerId) {
    const query = `
      SELECT * FROM bots
      WHERE owner_id = $1 AND is_active = true
      LIMIT 1;
    `;
    const result = await pool.query(query, [ownerId]);
    return result.rows[0] || null;
  }

  /**
   * Contar bots activos de un propietario
   * @param {number} ownerId - ID del admin propietario
   * @returns {number} Cantidad de bots activos
   */
  static async countActiveBots(ownerId) {
    const query = `
      SELECT COUNT(*) as count FROM bots
      WHERE owner_id = $1 AND is_active = true;
    `;
    const result = await pool.query(query, [ownerId]);
    return parseInt(result.rows[0].count, 10);
  }
}

module.exports = Bot;
