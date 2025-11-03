const pool = require('../config/database');

class ChatPermission {
  /**
   * Crear tabla de permisos de chat si no existe
   */
  static async createTableIfNotExists() {
    const query = `
      CREATE TABLE IF NOT EXISTS chat_permissions (
        id BIGSERIAL PRIMARY KEY,
        employee_id BIGINT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
        chat_id VARCHAR(255) NOT NULL,
        assigned_by BIGINT REFERENCES usuarios(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(employee_id, chat_id)
      );
    `;

    const indexQuery = `
      CREATE INDEX IF NOT EXISTS idx_chat_permissions_employee_id ON chat_permissions(employee_id);
      CREATE INDEX IF NOT EXISTS idx_chat_permissions_chat_id ON chat_permissions(chat_id);
    `;

    try {
      await pool.query(query);
      console.log('✅ Tabla chat_permissions creada o ya existe');
      await pool.query(indexQuery);
      console.log('✅ Índices para chat_permissions creados o ya existen');
    } catch (error) {
      console.error('❌ Error creando tabla chat_permissions:', error.message);
      throw error;
    }
  }

  /**
   * Asignar permiso de chat a un empleado
   * @param {number} employeeId - ID del empleado
   * @param {string} chatId - ID del chat de WhatsApp
   * @param {number} adminId - ID del admin que asigna el permiso
   * @returns {Object} El permiso creado
   */
  static async assign(employeeId, chatId, adminId) {
    const query = `
      INSERT INTO chat_permissions (employee_id, chat_id, assigned_by)
      VALUES ($1, $2, $3)
      ON CONFLICT (employee_id, chat_id) DO NOTHING
      RETURNING *;
    `;
    const result = await pool.query(query, [employeeId, chatId, adminId]);
    return result.rows[0];
  }

  /**
   * Revocar permiso de chat a un empleado
   * @param {number} employeeId - ID del empleado
   * @param {string} chatId - ID del chat de WhatsApp
   * @returns {boolean} True si se revocó, false si no existía
   */
  static async revoke(employeeId, chatId) {
    const query = `
      DELETE FROM chat_permissions
      WHERE employee_id = $1 AND chat_id = $2;
    `;
    const result = await pool.query(query, [employeeId, chatId]);
    return result.rowCount > 0;
  }

  /**
   * Encontrar permisos por ID de empleado
   * @param {number} employeeId - ID del empleado
   * @returns {Array<Object>} Lista de permisos
   */
  static async findByEmployeeId(employeeId) {
    const query = `
      SELECT chat_id FROM chat_permissions
      WHERE employee_id = $1;
    `;
    const result = await pool.query(query, [employeeId]);
    return result.rows.map(row => row.chat_id);
  }

  /**
   * Encontrar empleados con permiso para un chat
   * @param {string} chatId - ID del chat
   * @returns {Array<Object>} Lista de IDs de empleados
   */
  static async findByChatId(chatId) {
    const query = `
      SELECT employee_id FROM chat_permissions
      WHERE chat_id = $1;
    `;
    const result = await pool.query(query, [chatId]);
    return result.rows.map(row => row.employee_id);
  }

  /**
   * Verificar si un empleado tiene permiso para un chat
   * @param {number} employeeId - ID del empleado
   * @param {string} chatId - ID del chat
   * @returns {boolean}
   */
  static async hasPermission(employeeId, chatId) {
    const query = `
      SELECT 1 FROM chat_permissions
      WHERE employee_id = $1 AND chat_id = $2
      LIMIT 1;
    `;
    const result = await pool.query(query, [employeeId, chatId]);
    return result.rowCount > 0;
  }
}

module.exports = ChatPermission;
