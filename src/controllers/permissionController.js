const { asyncHandler } = require('../middleware/errorHandler');
const ChatPermission = require('../models/ChatPermission');
const User = require('../models/User');

class PermissionController {

  /**
   * Asignar permiso a un empleado
   * POST /api/permissions/assign
   */
  assignPermission = asyncHandler(async (req, res) => {
    const { employeeId, chatId } = req.body;
    const adminId = req.user.userId;

    if (!employeeId || !chatId) {
      return res.status(400).json({ success: false, error: 'employeeId y chatId son requeridos' });
    }

    // Verificar que el empleado exista y pertenezca al admin
    const employee = await User.findById(employeeId);
    if (!employee || employee.id_padre !== adminId) {
      return res.status(404).json({ success: false, error: 'Empleado no encontrado o no pertenece a este administrador' });
    }

    const permission = await ChatPermission.assign(employeeId, chatId, adminId);

    res.status(201).json({
      success: true,
      message: 'Permiso asignado correctamente',
      data: permission
    });
  });

  /**
   * Revocar permiso a un empleado
   * POST /api/permissions/revoke
   */
  revokePermission = asyncHandler(async (req, res) => {
    const { employeeId, chatId } = req.body;
    const adminId = req.user.userId;

    if (!employeeId || !chatId) {
      return res.status(400).json({ success: false, error: 'employeeId y chatId son requeridos' });
    }

    // Opcional: Verificar que el admin es dueño del empleado antes de revocar.
    const employee = await User.findById(employeeId);
    if (!employee || employee.id_padre !== adminId) {
        return res.status(404).json({ success: false, error: 'Empleado no encontrado o no pertenece a este administrador' });
    }

    const revoked = await ChatPermission.revoke(employeeId, chatId);

    if (revoked) {
      res.status(200).json({ success: true, message: 'Permiso revocado correctamente' });
    } else {
      res.status(404).json({ success: false, error: 'El permiso no existía' });
    }
  });

  /**
   * Obtener permisos de un empleado
   * GET /api/permissions/employee/:employeeId
   */
  getEmployeePermissions = asyncHandler(async (req, res) => {
    const { employeeId } = req.params;
    const adminId = req.user.userId;

    const employee = await User.findById(employeeId);
    if (!employee || employee.id_padre !== adminId) {
      return res.status(404).json({ success: false, error: 'Empleado no encontrado o no pertenece a este administrador' });
    }

    const permissions = await ChatPermission.findByEmployeeId(employeeId);
    res.status(200).json({ success: true, data: permissions });
  });

  /**
   * Obtener empleados asignados a un chat
   * GET /api/permissions/chat/:chatId
   */
  getChatPermissions = asyncHandler(async (req, res) => {
    const { chatId } = req.params;

    if (!chatId) {
        return res.status(400).json({ success: false, error: 'chatId es requerido' });
    }

    const employeeIds = await ChatPermission.findByChatId(chatId);

    // Opcional: verificar que los empleados pertenecen al admin que consulta
    const employees = await User.findEmployeesByOwner(req.user.userId);
    const filteredEmployeeIds = employeeIds.filter(id => employees.some(e => e.id === id));

    res.status(200).json({ success: true, data: filteredEmployeeIds });
  });

}

module.exports = PermissionController;
