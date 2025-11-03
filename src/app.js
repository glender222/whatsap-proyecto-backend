const express = require("express");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./config/swagger');
require('dotenv').config();

const config = require("./config");
const WhatsAppService = require("./services/whatsappService");
const SocketHandler = require("./sockets/socketHandler");
const { errorHandler, notFound } = require("./middleware/errorHandler");
const User = require("./models/User");
const ChatPermission = require("./models/ChatPermission");

// Importar rutas
const createAuthRoutes = require("./routes/authRoutes");
const createChatRoutes = require("./routes/chatRoutes");
const createMediaRoutes = require("./routes/mediaRoutes");
const permissionRoutes = require("./routes/permissionRoutes");
const createWhatsAppRoutes = require("./routes/whatsappRoutes");

class App {
  constructor() {
    this.app = express();
    this.server = http.createServer(this.app);
    this.io = new Server(this.server, { 
      cors: { origin: config.cors.origin } 
    });
    
    this.whatsappService = new WhatsAppService();
    this.socketHandler = new SocketHandler(this.whatsappService);
    
    this.setupMiddleware();
    this.setupSwagger();
    this.setupRoutes();
    this.setupSocketIO();
    this.setupErrorHandling();
    this.setupProcessHandlers();
    this.initializeDatabase();
  }

  setupMiddleware() {
    // Seguridad: helmet configurado para permitir imágenes cross-origin
    this.app.use(
      helmet({
        crossOriginResourcePolicy: false, // Desactiva CORP para permitir imágenes
        crossOriginEmbedderPolicy: false  // Desactiva COEP para evitar bloqueos
      })
    );

    // CORS
    this.app.use(cors(config.cors));

    // JSON
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));

    // Rate limiting
    const limiter = rateLimit({
      windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'),
      max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'),
      message: 'Demasiadas solicitudes, intenta más tarde'
    });

    this.app.use('/api/', limiter);
  }

  setupSwagger() {
    this.app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
      swaggerOptions: {
        persistAuthorization: true,
        defaultModelsExpandDepth: 1
      },
      customCss: '.swagger-ui .topbar { display: none }'
    }));

    // Ruta para obtener spec en JSON
    this.app.get('/api/docs/swagger.json', (req, res) => {
      res.setHeader('Content-Type', 'application/json');
      res.send(swaggerSpec);
    });
  }

  async initializeDatabase() {
    try {
      await User.createTableIfNotExists();
      await ChatPermission.createTableIfNotExists();
      console.log('✅ Base de datos inicializada');
    } catch (error) {
      console.error('❌ Error inicializando BD:', error);
    }
  }

  setupRoutes() {
    // Rutas principales
    this.app.use("/api/auth", createAuthRoutes(this.whatsappService));
    this.app.use("/api/chats", createChatRoutes(this.whatsappService));
    this.app.use("/api/media", createMediaRoutes(this.whatsappService));
    this.app.use("/api/permissions", permissionRoutes);
    this.app.use("/api/whatsapp", createWhatsAppRoutes(this.whatsappService));

    // Rutas de compatibilidad con el frontend existente
    this.setupLegacyRoutes();

    // Health check
    this.app.get('/health', (req, res) => {
      res.json({ status: 'ok', timestamp: new Date().toISOString() });
    });
  }

  setupLegacyRoutes() {
    const multer = require('multer');
    const upload = multer({ dest: "uploads/" });
    
    // Importar controladores
    const AuthController = require("./controllers/authController");
    const ChatController = require("./controllers/chatController");
    const MediaController = require("./controllers/mediaController");
    
    const authController = new AuthController(this.whatsappService);
    const chatController = new ChatController(this.whatsappService);
    const mediaController = new MediaController(this.whatsappService);

    // Mantener endpoints originales para compatibilidad DIRECTA
    this.app.get("/qr", authController.getQRLegacy);
    this.app.get("/status", authController.getStatusLegacy);
    this.app.get("/me", authController.getMeLegacy);
    this.app.post("/logout", authController.logoutLegacy);
    this.app.get("/chats", chatController.getChatsLegacy);
    this.app.get("/messages/:chatId", chatController.getMessagesLegacy);
    this.app.post("/send-message", upload.single("file"), chatController.sendMessageLegacy);
    this.app.get("/download-media/:messageId", mediaController.downloadMedia);
    this.app.get("/profile-photo/:chatId", mediaController.getProfilePhoto);
  }

  setupSocketIO() {
    this.whatsappService.setSocketIO(this.io);
    this.socketHandler.handleConnection(this.io);
  }

  setupErrorHandling() {
    this.app.use(notFound);
    this.app.use(errorHandler);
  }

  setupProcessHandlers() {
    process.on('unhandledRejection', (reason, promise) => {
      console.error('❌ Error no manejado (UNHANDLED REJECTION):', reason);
      console.error('Promise:', promise);
    });

    process.on('uncaughtException', (error) => {
      console.error('❌ Excepción no capturada (UNCAUGHT EXCEPTION):', error);
      console.error('Stack trace:', error.stack);
    });
  }

  async start() {
    try {
      // La inicialización de WhatsApp ahora es manual a través de la API
      this.server.listen(config.server.port, () => {
        console.log(`🚀 API + Socket.IO corriendo en http://${config.server.host}:${config.server.port}`);
        console.log(`🔐 Autenticación JWT activada`);
        console.log(`📖 Swagger disponible en http://${config.server.host}:${config.server.port}/api/docs`);
        console.log('✅ Servidor listo. Esperando inicialización de WhatsApp por parte de un administrador.');
      });
    } catch (error) {
      console.error('Error al iniciar la aplicación:', error);
      process.exit(1);
    }
  }
}

// Inicializar aplicación
const app = new App();
app.start();