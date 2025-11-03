const User = require('../models/User');
const { hashPassword, comparePassword, generateRandomPassword } = require('../utils/password');
const { generateAccessToken, generateRefreshToken } = require('../utils/jwt');

class AuthService {
  /**
   * Registrar un nuevo DUEÑO
   */
  static async register(nombre, email, password) {
    // Validar entrada
    if (!nombre || !email || !password) {
      throw new Error('Nombre, email y contraseña son requeridos');
    }

    if (password.length < 6) {
      throw new Error('La contraseña debe tener al menos 6 caracteres');
    }

    // Hashear contraseña
    const passwordHash = await hashPassword(password);

    // Crear usuario con rol ADMIN
    const user = await User.create(nombre, email, passwordHash, 'ADMIN', null);

    // Generar tokens
    const accessToken = generateAccessToken({
      userId: user.id,
      email: user.email,
      nombre: user.nombre,
      rol: user.rol,
      idPadre: user.id_padre
    });

    const refreshToken = generateRefreshToken({
      userId: user.id,
      email: user.email
    });

    // Guardar refresh token en BD
    await User.saveRefreshToken(user.id, refreshToken, 30 * 24 * 60 * 60 * 1000); // 30 días

    return {
      user: {
        id: user.id,
        nombre: user.nombre,
        email: user.email,
        rol: user.rol
      },
      accessToken,
      refreshToken
    };
  }

  /**
   * Login de usuario
   */
  static async login(email, password) {
    // Validar entrada
    if (!email || !password) {
      throw new Error('Email y contraseña son requeridos');
    }

    // Buscar usuario
    const user = await User.findByEmail(email);
    if (!user) {
      throw new Error('Usuario no encontrado');
    }

    // Comparar contraseña
    const isValidPassword = await comparePassword(password, user.password_hash);
    if (!isValidPassword) {
      throw new Error('Contraseña incorrecta');
    }

    // Generar tokens
    const accessToken = generateAccessToken({
      userId: user.id,
      email: user.email,
      nombre: user.nombre,
      rol: user.rol,
      idPadre: user.id_padre
    });

    const refreshToken = generateRefreshToken({
      userId: user.id,
      email: user.email
    });

    // Guardar refresh token en BD
    await User.saveRefreshToken(user.id, refreshToken, 30 * 24 * 60 * 60 * 1000); // 30 días

    return {
      user: {
        id: user.id,
        nombre: user.nombre,
        email: user.email,
        rol: user.rol,
        idPadre: user.id_padre
      },
      accessToken,
      refreshToken
    };
  }

  /**
   * Refrescar access token
   */
  static async refreshAccessToken(refreshToken, userId) {
    // Validar que el refresh token existe en BD
    const isValid = await User.verifyRefreshToken(userId, refreshToken);
    if (!isValid) {
      throw new Error('Refresh token inválido o expirado');
    }

    // Obtener datos del usuario
    const user = await User.findById(userId);
    if (!user) {
      throw new Error('Usuario no encontrado');
    }

    // Generar nuevo access token
    const newAccessToken = generateAccessToken({
      userId: user.id,
      email: user.email,
      nombre: user.nombre,
      rol: user.rol,
      idPadre: user.id_padre
    });

    return {
      accessToken: newAccessToken
    };
  }

  /**
   * Crear estación de trabajo (empleado)
   */
  static async createStation(ownerId, nombre, email) {
    // Validar entrada
    if (!nombre || !email) {
      throw new Error('Nombre y email son requeridos');
    }

    // Generar contraseña aleatoria
    const tempPassword = generateRandomPassword();
    const passwordHash = await hashPassword(tempPassword);

    // Crear empleado
    const employee = await User.create(nombre, email, passwordHash, 'EMPLEADO', ownerId);

    return {
      employee: {
        id: employee.id,
        nombre: employee.nombre,
        email: employee.email,
        rol: employee.rol
      },
      tempPassword // Mostrar solo una vez
    };
  }

  /**
   * Logout
   */
  static async logout(refreshToken) {
    if (refreshToken) {
      await User.revokeRefreshToken(refreshToken);
    }
    return true;
  }
}

module.exports = AuthService;