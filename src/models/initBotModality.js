/**
 * Inicializador simplificado para tabla de reglas de bot
 * Una sola tabla maneja OPCIONES y KEYWORDS
 */

const BotRule = require('./BotRule');

/**
 * Inicializar tabla unificada de reglas
 */
async function initializeBotRules() {
  try {
    console.log('🔧 Inicializando tabla de reglas de bot...');
    
    await BotRule.createTableIfNotExists();
    
    console.log('✅ Tabla bot_rules inicializada correctamente');
  } catch (error) {
    console.error('❌ Error inicializando bot_rules:', error.message);
    throw error;
  }
}

module.exports = {
  initializeBotRules
};
