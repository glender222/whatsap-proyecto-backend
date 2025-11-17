const pool = require('../src/config/database');

/**
 * Script para eliminar tablas no utilizadas:
 * - bot_tags (redundante con bot_rules)
 * - chat_permissions (no utilizada en el flujo actual)
 */

async function cleanup() {
  const client = await pool.connect();
  try {
    console.log('🗑️  Iniciando limpieza de tablas no utilizadas...\n');

    // Eliminar tabla bot_tags
    console.log('1️⃣  Eliminando tabla bot_tags...');
    try {
      await client.query(`DROP TABLE IF EXISTS bot_tags CASCADE;`);
      console.log('   ✅ Tabla bot_tags eliminada\n');
    } catch (error) {
      console.error('   ⚠️  Error eliminando bot_tags:', error.message, '\n');
    }

    // Eliminar tabla chat_permissions
    console.log('2️⃣  Eliminando tabla chat_permissions...');
    try {
      await client.query(`DROP TABLE IF EXISTS chat_permissions CASCADE;`);
      console.log('   ✅ Tabla chat_permissions eliminada\n');
    } catch (error) {
      console.error('   ⚠️  Error eliminando chat_permissions:', error.message, '\n');
    }

    console.log('✨ Limpieza completada exitosamente');
    console.log('\n📝 Próximas acciones recomendadas:');
    console.log('   1. Eliminar archivo: src/models/ChatPermission.js');
    console.log('   2. Eliminar archivo: src/routes/permissionRoutes.js');
    console.log('   3. Eliminar archivo: src/controllers/permissionController.js (si existe)');
    console.log('   4. Remover referencias en src/app.js:');
    console.log('      - const ChatPermission = require("./models/ChatPermission");');
    console.log('      - const permissionRoutes = require("./routes/permissionRoutes");');
    console.log('      - this.app.use("/api/permissions", permissionRoutes);');
    console.log('      - await ChatPermission.createTableIfNotExists();');

  } catch (error) {
    console.error('❌ Error en limpieza:', error);
  } finally {
    client.release();
    process.exit(0);
  }
}

cleanup();
