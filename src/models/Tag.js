const pool = require('../config/database');

class Tag {
  /**
   * Crear tabla de etiquetas si no existe
   */
  static async createTableIfNotExists() {
    const tagsQuery = `
      CREATE TABLE IF NOT EXISTS tags (
        id BIGSERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        color VARCHAR(20) DEFAULT '#3B82F6',
        owner_id BIGINT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
        is_default BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(owner_id, name)
      );
    `;

    const userTagsQuery = `
      CREATE TABLE IF NOT EXISTS user_tags (
        user_id BIGINT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
        tag_id BIGINT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
        granted_by BIGINT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
        granted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (user_id, tag_id)
      );
    `;

    const indexQuery = `
      CREATE INDEX IF NOT EXISTS idx_tags_owner_id ON tags(owner_id);
      CREATE INDEX IF NOT EXISTS idx_tags_is_default ON tags(is_default);
      CREATE INDEX IF NOT EXISTS idx_user_tags_user_id ON user_tags(user_id);
      CREATE INDEX IF NOT EXISTS idx_user_tags_tag_id ON user_tags(tag_id);
    `;

    try {
      await pool.query(tagsQuery);
      console.log('✅ Tabla tags creada o ya existe');
      await pool.query(userTagsQuery);
      console.log('✅ Tabla user_tags creada o ya existe');
      await pool.query(indexQuery);
      console.log('✅ Índices para tags creados o ya existen');
    } catch (error) {
      console.error('❌ Error creando tabla tags:', error.message);
      throw error;
    }
  }

  /**
   * Crear una nueva etiqueta
   * @param {string} name - Nombre de la etiqueta
   * @param {number} ownerId - ID del usuario propietario (admin)
   * @param {string} color - Color en formato hex (opcional)
   * @param {boolean} isDefault - Si es la etiqueta "Todo" por defecto
   * @returns {Object} La etiqueta creada
   */
  static async create(name, ownerId, color = '#3B82F6', isDefault = false) {
    const query = `
      INSERT INTO tags (name, owner_id, color, is_default)
      VALUES ($1, $2, $3, $4)
      RETURNING *;
    `;
    
    try {
      const result = await pool.query(query, [name, ownerId, color, isDefault]);
      return result.rows[0];
    } catch (error) {
      if (error.code === '23505') { // Unique violation
        throw new Error('Ya existe una etiqueta con ese nombre');
      }
      throw error;
    }
  }

  /**
   * Obtener todas las etiquetas de un propietario (admin)
   * @param {number} ownerId - ID del admin
   * @returns {Array<Object>} Lista de etiquetas
   */
  static async findByOwnerId(ownerId) {
    const query = `
      SELECT * FROM tags
      WHERE owner_id = $1
      ORDER BY is_default DESC, created_at ASC;
    `;
    const result = await pool.query(query, [ownerId]);
    return result.rows;
  }

  /**
   * Obtener etiquetas de un empleado (etiquetas asignadas a él)
   * @param {number} userId - ID del empleado
   * @returns {Array<Object>} Lista de etiquetas
   */
  static async findByUserId(userId) {
    const query = `
      SELECT t.* 
      FROM tags t
      INNER JOIN user_tags ut ON t.id = ut.tag_id
      WHERE ut.user_id = $1
      ORDER BY t.is_default DESC, t.created_at ASC;
    `;
    const result = await pool.query(query, [userId]);
    return result.rows;
  }

  /**
   * Obtener una etiqueta por ID
   * @param {number} id - ID de la etiqueta
   * @returns {Object|null} La etiqueta o null
   */
  static async findById(id) {
    const query = `SELECT * FROM tags WHERE id = $1;`;
    const result = await pool.query(query, [id]);
    return result.rows[0] || null;
  }

  /**
   * Obtener la etiqueta "Todo" de un admin
   * @param {number} ownerId - ID del admin
   * @returns {Object|null} La etiqueta "Todo" o null
   */
  static async findDefaultByOwner(ownerId) {
    const query = `
      SELECT * FROM tags
      WHERE owner_id = $1 AND is_default = true
      LIMIT 1;
    `;
    const result = await pool.query(query, [ownerId]);
    return result.rows[0] || null;
  }

  /**
   * Actualizar una etiqueta
   * @param {number} id - ID de la etiqueta
   * @param {Object} data - Datos a actualizar (name, color)
   * @returns {Object|null} La etiqueta actualizada
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

    if (data.color !== undefined) {
      fields.push(`color = $${paramCount}`);
      values.push(data.color);
      paramCount++;
    }

    if (fields.length === 0) {
      throw new Error('No hay campos para actualizar');
    }

    fields.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(id);

    const query = `
      UPDATE tags
      SET ${fields.join(', ')}
      WHERE id = $${paramCount} AND is_default = false
      RETURNING *;
    `;

    const result = await pool.query(query, values);
    return result.rows[0] || null;
  }

  /**
   * Eliminar una etiqueta (no se puede eliminar "Todo")
   * @param {number} id - ID de la etiqueta
   * @returns {boolean} True si se eliminó
   */
  static async delete(id) {
    const query = `
      DELETE FROM tags
      WHERE id = $1 AND is_default = false;
    `;
    const result = await pool.query(query, [id]);
    return result.rowCount > 0;
  }

  /**
   * Asignar etiqueta a un empleado
   * @param {number} tagId - ID de la etiqueta
   * @param {number} userId - ID del empleado
   * @param {number} grantedBy - ID del admin que otorga el acceso
   * @returns {Object} La relación creada
   */
  static async assignToUser(tagId, userId, grantedBy) {
    const query = `
      INSERT INTO user_tags (tag_id, user_id, granted_by)
      VALUES ($1, $2, $3)
      ON CONFLICT (user_id, tag_id) DO NOTHING
      RETURNING *;
    `;
    const result = await pool.query(query, [tagId, userId, grantedBy]);
    return result.rows[0];
  }

  /**
   * Quitar etiqueta de un empleado
   * @param {number} tagId - ID de la etiqueta
   * @param {number} userId - ID del empleado
   * @returns {boolean} True si se eliminó
   */
  static async removeFromUser(tagId, userId) {
    const query = `
      DELETE FROM user_tags
      WHERE tag_id = $1 AND user_id = $2;
    `;
    const result = await pool.query(query, [tagId, userId]);
    return result.rowCount > 0;
  }

  /**
   * Obtener empleados con acceso a una etiqueta
   * @param {number} tagId - ID de la etiqueta
   * @returns {Array<Object>} Lista de usuarios con acceso
   */
  static async getUsersWithAccess(tagId) {
    const query = `
      SELECT u.id, u.nombre, u.email, ut.granted_at, ut.granted_by
      FROM usuarios u
      INNER JOIN user_tags ut ON u.id = ut.user_id
      WHERE ut.tag_id = $1
      ORDER BY ut.granted_at DESC;
    `;
    const result = await pool.query(query, [tagId]);
    return result.rows;
  }

  /**
   * Verificar si un usuario tiene acceso a una etiqueta
   * @param {number} userId - ID del usuario
   * @param {number} tagId - ID de la etiqueta
   * @returns {boolean} True si tiene acceso
   */
  static async userHasAccess(userId, tagId) {
    // Primero verificar si es el propietario
    const ownerQuery = `SELECT 1 FROM tags WHERE id = $1 AND owner_id = $2 LIMIT 1;`;
    const ownerResult = await pool.query(ownerQuery, [tagId, userId]);
    if (ownerResult.rowCount > 0) return true;

    // Si no es propietario, verificar en user_tags
    const accessQuery = `
      SELECT 1 FROM user_tags
      WHERE tag_id = $1 AND user_id = $2
      LIMIT 1;
    `;
    const result = await pool.query(accessQuery, [tagId, userId]);
    return result.rowCount > 0;
  }

  /**
   * Verificar si un usuario tiene acceso a la etiqueta "Todo"
   * @param {number} userId - ID del usuario
   * @param {number} adminId - ID del admin propietario
   * @returns {boolean} True si tiene acceso a "Todo"
   */
  static async userHasTodoAccess(userId, adminId) {
    // Verificar si el usuario es el admin (propietario de "Todo")
    if (userId === adminId) return true;

    // Verificar si tiene asignada la etiqueta "Todo" del admin
    const query = `
      SELECT 1 FROM user_tags ut
      INNER JOIN tags t ON ut.tag_id = t.id
      WHERE ut.user_id = $1 AND t.owner_id = $2 AND t.is_default = true
      LIMIT 1;
    `;
    const result = await pool.query(query, [userId, adminId]);
    return result.rowCount > 0;
  }
}

module.exports = Tag;
