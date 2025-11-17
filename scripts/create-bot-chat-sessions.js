/**
 * Script de migración: Crear tabla bot_chat_sessions
 * 
 * Esta tabla sirve como:
 * 1. Checkpoint: evita que el bot se reactive hasta que termine el servicio
 * 2. Histórico: guarda todas las asignaciones bot → chat → tag
 * 3. Estadísticas: permite análisis de conversiones y tiempos
 */

const pool = require('../src/config/database');

async function createBotChatSessionsTable() {
  const client = await pool.connect();
  
  try {
    console.log('🚀 Creando tabla bot_chat_sessions...');
    
    await client.query(`
      CREATE TABLE IF NOT EXISTS bot_chat_sessions (
        id BIGSERIAL PRIMARY KEY,
        bot_id BIGINT NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
        chat_id VARCHAR(255) NOT NULL,
        tag_id BIGINT REFERENCES tags(id) ON DELETE SET NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'pending',
        -- pending: bot envió opciones, esperando respuesta
        -- active: usuario respondió pero aún no se completó el servicio
        -- completed: servicio terminado, bot puede reactivarse
        
        selected_option INTEGER,
        -- Número de opción seleccionada por el usuario (1, 2, 3...)
        
        user_response TEXT,
        -- Texto exacto que envió el usuario
        
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        completed_at TIMESTAMP,
        
        CONSTRAINT chk_status CHECK (status IN ('pending', 'active', 'completed')),
        CONSTRAINT unique_bot_chat_active UNIQUE (bot_id, chat_id, status)
      );
    `);
    
    console.log('✅ Tabla bot_chat_sessions creada');
    
    // Crear índices para consultas frecuentes
    console.log('📊 Creando índices...');
    
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_bot_chat_sessions_bot_id 
      ON bot_chat_sessions(bot_id);
    `);
    
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_bot_chat_sessions_chat_id 
      ON bot_chat_sessions(chat_id);
    `);
    
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_bot_chat_sessions_status 
      ON bot_chat_sessions(status);
    `);
    
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_bot_chat_sessions_created_at 
      ON bot_chat_sessions(created_at DESC);
    `);
    
    console.log('✅ Índices creados');
    
    console.log('\n✨ Migración completada con éxito');
    console.log('\n📋 Estructura de la tabla:');
    console.log('   - id: Identificador único');
    console.log('   - bot_id: Bot que gestionó la conversación');
    console.log('   - chat_id: WhatsApp chat ID (ej: 51912345678@c.us)');
    console.log('   - tag_id: Tag asignado después de la respuesta');
    console.log('   - status: pending | active | completed');
    console.log('   - selected_option: Número de opción elegida');
    console.log('   - user_response: Mensaje del usuario');
    console.log('   - created_at: Cuándo se envió el menú');
    console.log('   - completed_at: Cuándo se completó el servicio');
    
  } catch (error) {
    console.error('❌ Error creando tabla:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

createBotChatSessionsTable()
  .then(() => {
    console.log('\n✅ Script finalizado');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script falló:', error);
    process.exit(1);
  });
