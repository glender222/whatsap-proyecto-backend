const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: 'postgres', // Usar base de datos por defecto
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '1234567',
});

pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('❌ Error de conexión:', err.message);
    console.log('\n📋 Variables leídas del .env:');
    console.log('DB_HOST:', process.env.DB_HOST);
    console.log('DB_PORT:', process.env.DB_PORT);
    console.log('DB_USER:', process.env.DB_USER);
    console.log('DB_PASSWORD:', process.env.DB_PASSWORD ? '***' : 'NO SET');
  } else {
    console.log('✅ Conexión exitosa!');
    console.log('Hora actual en BD:', res.rows[0]);
  }
  pool.end();
});