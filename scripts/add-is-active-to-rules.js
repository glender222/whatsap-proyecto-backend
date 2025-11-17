/**
 * Script para agregar columna is_active a la tabla bot_rules
 * Esta columna fue creada en la definición pero la BD no la tiene
 */

const pool = require('../src/config/database');

async function migrationAddIsActive() {
  console.log('🔧 Migrando tabla bot_rules...');

  try {
    // Primero, revisar si la columna ya existe
    const checkQuery = `
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'bot_rules' AND column_name = 'is_active';
    `;

    const checkResult = await pool.query(checkQuery);

    if (checkResult.rows.length > 0) {
      console.log('✅ Columna is_active ya existe en bot_rules');
      return;
    }

    // Si no existe, agregarla
    console.log('📝 Agregando columna is_active a bot_rules...');
    const addColumnQuery = `
      ALTER TABLE bot_rules 
      ADD COLUMN is_active BOOLEAN DEFAULT true;
    `;

    await pool.query(addColumnQuery);
    console.log('✅ Columna is_active agregada exitosamente');

    // Actualizar todos los registros existentes para asegurar que sean activos
    const updateQuery = `UPDATE bot_rules SET is_active = true WHERE is_active IS NULL;`;
    await pool.query(updateQuery);
    console.log('✅ Registros actualizados');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error en migración:', error.message);
    process.exit(1);
  }
}

migrationAddIsActive();
