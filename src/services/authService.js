const User = require('../models/User');
const { hashPassword, comparePassword, generateRandomPassword } = require('../utils/password');
const { generateAccessToken, generateRefreshToken } = require('../utils/jwt');
const TagService = require('./tagService');

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

    // Crear etiqueta "Todo" por defecto para el admin
    try {
      await TagService.createDefaultTodoTag(user.id);
    } catch (error) {
      console.error('⚠️ Error creando etiqueta "Todo":', error.message);
      // No fallar el registro si hay error creando la etiqueta
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
  static async createStation(ownerId, nombre, email, password = null) {
    // Validar entrada
    if (!nombre || !email) {
      throw new Error('Nombre y email son requeridos');
    }

    // Usar contraseña proporcionada o generar una aleatoria
    const tempPassword = password || generateRandomPassword();
    
    // Validar longitud de contraseña si se proporcionó
    if (password && password.length < 6) {
      throw new Error('La contraseña debe tener al menos 6 caracteres');
    }

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
   * Actualizar empleado (solo admin puede actualizar sus empleados)
   */
  static async updateEmployee(adminId, employeeId, data) {
    const { nombre, email, password } = data;

    // Verificar que el empleado existe y pertenece al admin
    const employee = await User.findById(employeeId);
    if (!employee) {
      throw new Error('Empleado no encontrado');
    }

    if (employee.id_padre !== adminId) {
      throw new Error('No tienes permiso para editar este empleado');
    }

    // Preparar datos a actualizar
    const updateData = {};
    if (nombre) updateData.nombre = nombre;
    if (email) updateData.email = email;
    if (password) {
      if (password.length < 6) {
        throw new Error('La contraseña debe tener al menos 6 caracteres');
      }
      updateData.password_hash = await hashPassword(password);
    }

    // Actualizar empleado
    const updatedEmployee = await User.update(employeeId, updateData);

    return {
      id: updatedEmployee.id,
      nombre: updatedEmployee.nombre,
      email: updatedEmployee.email,
      rol: updatedEmployee.rol,
      activo: updatedEmployee.activo
    };
  }

  /**
   * Resetea la contraseña de un empleado (solo admin)
   */
  static async resetEmployeePassword(adminId, employeeId, newPassword = null) {
    // Verificar que el empleado pertenece al admin
    const employee = await User.findById(employeeId);
    if (!employee) {
      throw new Error("Empleado no encontrado");
    }

    if (employee.id_padre !== adminId) {
      throw new Error("No tienes permiso para resetear la contraseña de este empleado");
    }

    // Si no se proporciona contraseña, generar una aleatoria
    const finalPassword = newPassword || this.generateRandomPassword();

    // Validar longitud mínima si se proporciona
    if (newPassword && newPassword.length < 6) {
      throw new Error("La contraseña debe tener al menos 6 caracteres");
    }

    // Hashear la nueva contraseña
    const hashedPassword = await hashPassword(finalPassword);

    // Actualizar la contraseña
    await User.update(employeeId, { password_hash: hashedPassword });

    // Retornar la nueva contraseña en texto plano (solo en este caso de reseteo)
    return {
      id: employee.id,
      nombre: employee.nombre,
      email: employee.email,
      newPassword: finalPassword,
      message: newPassword 
        ? "Contraseña actualizada exitosamente" 
        : "Contraseña reseteada. Guarda esta contraseña, no se mostrará nuevamente"
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