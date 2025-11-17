/**
 * Controlador para gestionar sesiones de bot (BotChatSession)
 */

const BotChatSession = require('../models/BotChatSession');
const Bot = require('../models/Bot');

/**
 * Obtener estadísticas de un bot
 * GET /api/bots/:botId/stats
 */
exports.getBotStats = async (req, res) => {
  try {
    const { botId } = req.params;
    const userId = req.user.userId;

    // Verificar que el bot existe y pertenece al usuario
    const bot = await Bot.findById(botId);
    if (!bot) {
      return res.status(404).json({
        success: false,
        message: 'Bot no encontrado'
      });
    }

    if (bot.owner_id !== userId) {
      return res.status(403).json({
        success: false,
        message: 'No tienes permiso para ver este bot'
      });
    }

    // Obtener estadísticas
    const stats = await BotChatSession.getStats(botId);
    const tagDistribution = await BotChatSession.getTagDistribution(botId);

    res.json({
      success: true,
      data: {
        general: {
          total_sessions: parseInt(stats.total_sessions) || 0,
          pending: parseInt(stats.pending) || 0,
          active: parseInt(stats.active) || 0,
          completed: parseInt(stats.completed) || 0,
          with_tag: parseInt(stats.with_tag) || 0,
          avg_duration_seconds: parseFloat(stats.avg_duration_seconds) || 0
        },
        tag_distribution: tagDistribution
      }
    });

  } catch (error) {
    console.error('Error obteniendo estadísticas de bot:', error);
    res.status(500).json({
      success: false,
      message: 'Error obteniendo estadísticas',
      error: error.message
    });
  }
};

/**
 * Obtener sesiones de un bot
 * GET /api/bots/:botId/sessions
 */
exports.getBotSessions = async (req, res) => {
  try {
    const { botId } = req.params;
    const userId = req.user.userId;
    const { limit = 50, offset = 0 } = req.query;

    // Verificar que el bot existe y pertenece al usuario
    const bot = await Bot.findById(botId);
    if (!bot) {
      return res.status(404).json({
        success: false,
        message: 'Bot no encontrado'
      });
    }

    if (bot.owner_id !== userId) {
      return res.status(403).json({
        success: false,
        message: 'No tienes permiso para ver este bot'
      });
    }

    // Obtener sesiones
    const sessions = await BotChatSession.findByBot(botId, {
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    res.json({
      success: true,
      data: sessions,
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset),
        total: sessions.length
      }
    });

  } catch (error) {
    console.error('Error obteniendo sesiones de bot:', error);
    res.status(500).json({
      success: false,
      message: 'Error obteniendo sesiones',
      error: error.message
    });
  }
};

/**
 * Obtener historial de sesiones de un chat
 * GET /api/chats/:chatId/sessions
 */
exports.getChatSessions = async (req, res) => {
  try {
    const { chatId } = req.params;
    const { limit = 20 } = req.query;

    const sessions = await BotChatSession.findByChat(chatId, {
      limit: parseInt(limit)
    });

    res.json({
      success: true,
      data: sessions
    });

  } catch (error) {
    console.error('Error obteniendo sesiones de chat:', error);
    res.status(500).json({
      success: false,
      message: 'Error obteniendo sesiones',
      error: error.message
    });
  }
};

/**
 * Forzar reset de sesión de un chat (marcar como completada)
 * POST /api/bots/:botId/sessions/reset
 */
exports.resetChatSession = async (req, res) => {
  try {
    const { botId } = req.params;
    const { chatId } = req.body;
    const userId = req.user.userId;

    if (!chatId) {
      return res.status(400).json({
        success: false,
        message: 'chatId es requerido'
      });
    }

    // Verificar que el bot existe y pertenece al usuario
    const bot = await Bot.findById(botId);
    if (!bot) {
      return res.status(404).json({
        success: false,
        message: 'Bot no encontrado'
      });
    }

    if (bot.owner_id !== userId) {
      return res.status(403).json({
        success: false,
        message: 'No tienes permiso para modificar este bot'
      });
    }

    // Resetear sesión
    const resetSessions = await BotChatSession.resetSession(chatId, botId);

    if (resetSessions.length === 0) {
      return res.json({
        success: true,
        message: 'No había sesiones activas para este chat',
        data: []
      });
    }

    res.json({
      success: true,
      message: `${resetSessions.length} sesión(es) marcada(s) como completada(s)`,
      data: resetSessions
    });

  } catch (error) {
    console.error('Error reseteando sesión:', error);
    res.status(500).json({
      success: false,
      message: 'Error reseteando sesión',
      error: error.message
    });
  }
};

/**
 * Obtener sesión específica por ID
 * GET /api/sessions/:sessionId
 */
exports.getSessionById = async (req, res) => {
  try {
    const { sessionId } = req.params;

    const session = await BotChatSession.findById(sessionId);

    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Sesión no encontrada'
      });
    }

    res.json({
      success: true,
      data: session
    });

  } catch (error) {
    console.error('Error obteniendo sesión:', error);
    res.status(500).json({
      success: false,
      message: 'Error obteniendo sesión',
      error: error.message
    });
  }
};

/**
 * Completar sesión (marcar como completada desde frontend)
 * POST /api/chats/:chatId/sessions/complete
 */
exports.completeSessionByChat = async (req, res) => {
  try {
    const { chatId } = req.params;
    const userId = req.user.userId;

    // Buscar sesión activa de este chat (sin necesidad de botId)
    const session = await BotChatSession.getActiveByChat(chatId);
    
    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'No hay sesión activa para este chat'
      });
    }

    // Verificar que el usuario es owner del bot de la sesión
    const Bot = require('../models/Bot');
    const bot = await Bot.findById(session.bot_id);
    
    if (!bot || bot.owner_id !== userId) {
      return res.status(403).json({
        success: false,
        message: 'No tienes permiso para modificar esta sesión'
      });
    }

    // Completar la sesión
    const completedSession = await BotChatSession.complete(session.id);

    console.log(`[API] Sesión ${session.id} del chat ${chatId} marcada como completada desde frontend por usuario ${userId}`);

    res.json({
      success: true,
      message: 'Sesión completada exitosamente. El bot podrá activarse nuevamente si el cliente envía un mensaje.',
      data: completedSession
    });

  } catch (error) {
    console.error('Error completando sesión:', error);
    res.status(500).json({
      success: false,
      message: 'Error completando sesión',
      error: error.message
    });
  }
};

/**
 * Obtener estado de sesión de un chat (para indicadores en frontend)
 * GET /api/chats/:chatId/session/status
 */
exports.getSessionStatus = async (req, res) => {
  try {
    const { chatId } = req.params;

    // Buscar sesión activa de este chat (sin necesidad de botId)
    const session = await BotChatSession.getActiveByChat(chatId);
    
    if (!session) {
      // No hay sesión activa
      return res.json({
        success: true,
        chatId,
        hasActiveSession: false,
        status: null,
        sessionId: null,
        botName: null,
        tagName: null,
        createdAt: null
      });
    }

    // Hay sesión activa, devolver información completa
    res.json({
      success: true,
      chatId,
      hasActiveSession: true,
      status: session.status, // 'pending' o 'active'
      sessionId: session.id,
      botId: session.bot_id,
      botName: session.bot_name,
      tagId: session.tag_id,
      tagName: session.tag_name,
      selectedOption: session.selected_option,
      createdAt: session.created_at
    });

  } catch (error) {
    console.error('Error obteniendo estado de sesión:', error);
    res.status(500).json({
      success: false,
      message: 'Error obteniendo estado de sesión',
      error: error.message
    });
  }
};

/**
 * Completar sesión (marcar como completada desde frontend)
 * POST /api/sessions/:sessionId/complete
 */
exports.completeSession = async (req, res) => {
  try {
    const { sessionId } = req.params;

    // Verificar que la sesión existe
    const session = await BotChatSession.findById(sessionId);
    
    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Sesión no encontrada'
      });
    }

    // Verificar que la sesión no esté ya completada
    if (session.status === 'completed') {
      return res.json({
        success: true,
        message: 'La sesión ya estaba completada',
        data: session
      });
    }

    // Completar la sesión
    const completedSession = await BotChatSession.complete(sessionId);

    console.log(`[API] Sesión ${sessionId} marcada como completada desde frontend`);

    res.json({
      success: true,
      message: 'Sesión completada exitosamente',
      data: completedSession
    });

  } catch (error) {
    console.error('Error completando sesión:', error);
    res.status(500).json({
      success: false,
      message: 'Error completando sesión',
      error: error.message
    });
  }
};
