const path = require("path");
require('dotenv').config();

module.exports = {
  server: {
    port: process.env.PORT || 3000,
    host: process.env.HOST || "localhost"
  },
  
  whatsapp: {
    profileDir: path.join(__dirname, "../../profile-data"),
    sessionPath: path.join(__dirname, "../../.wwebjs_auth"),
    uploadDir: path.join(__dirname, "../../uploads"),
    pollIntervalSeconds: parseInt(process.env.POLL_INTERVAL_SECONDS || '0', 10),
    pollLimit: parseInt(process.env.POLL_LIMIT || '20', 10)
  },
  
  cors: {
    origin: process.env.CORS_ORIGIN || "*"
  },
  
  multer: {
    dest: "uploads/",
    maxFileSize: 100 * 1024 * 1024 // 100MB
  },
  
  messages: {
    defaultLimit: 50,
    maxLimit: 100
  },

  jwt: {
    secret: process.env.JWT_SECRET || 'your_super_secret_key_min_32_chars_very_secure_key_2024',
    accessExpiry: process.env.JWT_ACCESS_EXPIRY || '24h',
    refreshExpiry: process.env.JWT_REFRESH_EXPIRY || '30d'
  },

  database: {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    name: process.env.DB_NAME || 'whatsapp_empresas',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'password'
  }
};