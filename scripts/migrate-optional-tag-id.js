const pool = require('../src/config/database');

/**
 * Script de migración para hacer tag_id opcional en bot_rules
 * Ejecutar una sola vez para actualizar la tabla existente
 */
async function migrateOptionalTagId() {
  const client = await pool.connect();
  
  try {
    console.log('🔄 Iniciando migración de bot_rules...\n');

    // Paso 1: Verificar si la tabla existe
    const tableCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'bot_rules'
      );
    `);

    if (!tableCheck.rows[0].exists) {
      console.log('⚠️  Tabla bot_rules no existe. No se requiere migración.');
      return;
    }

    // Paso 2: Verificar constraint actual
    const constraintCheck = await client.query(`
      SELECT constraint_name, column_name
      FROM information_schema.key_column_usage
      WHERE table_name = 'bot_rules' AND column_name = 'tag_id'
      AND constraint_name LIKE '%fk%' OR constraint_name LIKE '%references%';
    `);

    console.log('📋 Constraint actual en tag_id:');
    if (constraintCheck.rows.length > 0) {
      console.log(constraintCheck.rows);
    } else {
      console.log('  No se encontró constraint de clave foránea en tag_id');
    }

    // Paso 3: Eliminar constraint NOT NULL si existe
    console.log('\n🔨 Eliminar restricción NOT NULL de tag_id...');
    
    try {
      await client.query(`
        ALTER TABLE bot_rules 
        ALTER COLUMN tag_id DROP NOT NULL;
      `);
      console.log('✅ Restricción NOT NULL eliminada de tag_id');
    } catch (error) {
      if (error.message.includes('does not exist')) {
        console.log('⚠️  La restricción NOT NULL ya no existe (probablemente ya fue actualizada)');
      } else {
        throw error;
      }
    }

    // Paso 4: Verificar la estructura final
    const columnInfo = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'bot_rules' AND column_name = 'tag_id';
    `);

    console.log('\n📊 Estructura final de tag_id:');
    console.log(columnInfo.rows[0]);

    // Paso 5: Mostrar estadísticas
    const stats = await client.query(`
      SELECT 
        COUNT(*) as total_rules,
        COUNT(CASE WHEN tag_id IS NULL THEN 1 END) as rules_without_tag
      FROM bot_rules;
    `);

    console.log('\n📈 Estadísticas de bot_rules:');
    console.log(`  Total de reglas: ${stats.rows[0].total_rules}`);
    console.log(`  Reglas sin tag: ${stats.rows[0].rules_without_tag}`);

    console.log('\n✅ Migración completada exitosamente!');
    console.log('\n💡 Ahora puedes crear reglas con tagId: null');
    console.log('   Ejemplo: { "type": "option", "text": "Mi opción", "tagId": null, "order": 1 }');

  } catch (error) {
    console.error('\n❌ Error durante la migración:', error.message);
    console.error('Stack:', error.stack);
    throw error;
  } finally {
    client.release();
  }
}

// Ejecutar migración
migrateOptionalTagId()
  .then(() => {
    console.log('\n🎉 Proceso finalizado');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n💥 Error fatal:', error);
    process.exit(1);
  });
