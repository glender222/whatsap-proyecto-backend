const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'your_super_secret_key_min_32_chars_very_secure_key_2024';
const JWT_ACCESS_EXPIRY = process.env.JWT_ACCESS_EXPIRY || '24h';
const JWT_REFRESH_EXPIRY = process.env.JWT_REFRESH_EXPIRY || '30d';

/**
 * Genera un JWT token de acceso
 * @param {Object} payload - Datos a incluir en el token
 * @returns {string} - Token JWT
 */
function generateAccessToken(payload) {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_ACCESS_EXPIRY,
    algorithm: 'HS256'
  });
}

/**
 * Genera un JWT token de refresco
 * @param {Object} payload - Datos a incluir en el token
 * @returns {string} - Token JWT
 */
function generateRefreshToken(payload) {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_REFRESH_EXPIRY,
    algorithm: 'HS256'
  });
}

/**
 * Verifica un JWT token
 * @param {string} token - Token a verificar
 * @returns {Object|null} - Payload si es válido, null si no
 */
function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    console.error('Error verificando token:', error.message);
    return null;
  }
}

/**
 * Extrae el token del header Authorization
 * @param {string} authHeader - Header Authorization
 * @returns {string|null} - Token o null
 */
function extractTokenFromHeader(authHeader) {
  if (!authHeader) return null;
  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') return null;
  return parts[1];
}

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  verifyToken,
  extractTokenFromHeader
};