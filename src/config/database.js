const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'whatsapp_empresas',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'password',
});

pool.on('error', (err) => {
  console.error('❌ Error inesperado en el pool de conexión:', err);
});

pool.on('connect', () => {
  console.log('✅ Conexión exitosa a PostgreSQL');
});

module.exports = pool;