const User = require('../models/User');

/**
 * Obtiene el ID del administrador (tenant) para un usuario autenticado.
 * @param {object} userPayload - El payload del JWT (req.user).
 * @returns {Promise<number>} - El ID del administrador.
 */
async function getTenantId(userPayload) {
  if (userPayload.rol === 'ADMIN') {
    return userPayload.userId;
  }

  // Si es empleado, necesitamos buscar su id_padre en la base de datos.
  // Podríamos optimizar esto guardando id_padre en el JWT en el futuro.
  if (userPayload.rol === 'EMPLEADO') {
    const user = await User.findById(userPayload.userId);
    if (!user || !user.id_padre) {
      throw new Error('Empleado no está asociado a ningún administrador.');
    }
    return user.id_padre;
  }

  throw new Error('Rol de usuario no válido.');
}


/**
 * Middleware de Express para obtener la sesión de WhatsApp del tenant y adjuntarla a la petición.
 * @param {SessionManager} sessionManager
 */
const injectWhatsAppClient = (sessionManager) => async (req, res, next) => {
  try {
    const tenantId = await getTenantId(req.user);
    const whatsappClient = sessionManager.getSession(tenantId);

    if (!whatsappClient || !whatsappClient.isConnected) {
      return res.status(503).json({
        success: false,
        error: 'La sesión de WhatsApp para tu organización no está activa.'
      });
    }

    // Inyectar el cliente de WhatsApp en el objeto de la petición
    req.whatsappClient = whatsappClient;
    next();
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Error al obtener la sesión de WhatsApp.', details: error.message });
  }
};

module.exports = {
  getTenantId,
  injectWhatsAppClient
};
