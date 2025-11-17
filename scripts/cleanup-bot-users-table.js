/**
 * Script para eliminar tabla bot_users de la base de datos
 * Esta tabla ya no se utiliza. La distribución se maneja mediante tags.
 * 
 * Uso: node scripts/cleanup-bot-users-table.js
 */

const pool = require('../src/config/database');

async function cleanup() {
  const client = await pool.connect();
  
  try {
    console.log('🗑️  Iniciando limpieza de tabla bot_users...');
    
    // Verificar si la tabla existe
    const checkTable = `
      SELECT 1 FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'bot_users';
    `;
    
    const tableExists = await client.query(checkTable);
    
    if (tableExists.rows.length === 0) {
      console.log('ℹ️  Tabla bot_users no existe o ya fue eliminada.');
      return;
    }
    
    // Eliminar tabla
    await client.query('DROP TABLE IF EXISTS bot_users CASCADE;');
    console.log('✅ Tabla bot_users eliminada exitosamente.');
    
    // Verificar que se eliminó
    const verifyDelete = await client.query(checkTable);
    if (verifyDelete.rows.length === 0) {
      console.log('✅ Verificación: tabla bot_users no existe en la base de datos.');
    }
    
  } catch (error) {
    console.error('❌ Error durante la limpieza:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
    process.exit(0);
  }
}

cleanup().catch(err => {
  console.error('❌ Limpieza fallida:', err);
  process.exit(1);
});
