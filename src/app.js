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
const sessionManager = require("./services/sessionManager"); // Reemplazar WhatsAppService con SessionManager
const SocketHandler = require("./sockets/socketHandler");
const { errorHandler, notFound } = require("./middleware/errorHandler");
const User = require("./models/User");
const ChatPermission = require("./models/ChatPermission");
const stateManager = require("./services/stateManager");

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
    
    // El SessionManager es ahora el servicio principal
    this.sessionManager = sessionManager;
    this.socketHandler = new SocketHandler(this.sessionManager);
    
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
    // Rutas principales - ahora se les pasa el sessionManager
    this.app.use("/api/auth", createAuthRoutes(this.sessionManager));
    this.app.use("/api/chats", createChatRoutes(this.sessionManager));
    this.app.use("/api/media", createMediaRoutes(this.sessionManager));
    this.app.use("/api/permissions", permissionRoutes); // Este no necesita el servicio
    this.app.use("/api/whatsapp", createWhatsAppRoutes(this.sessionManager));

    // Health check
    this.app.get('/health', (req, res) => {
      res.json({ status: 'ok', timestamp: new Date().toISOString() });
    });
  }

  setupSocketIO() {
    this.sessionManager.setSocketIO(this.io); // Inyectar 'io' en el sessionManager
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
      await stateManager.connect(); // Conectar a Redis

      this.server.listen(config.server.port, () => {
        console.log(`🚀 API + Socket.IO corriendo en http://${config.server.host}:${config.server.port}`);
        console.log(`🔐 Autenticación JWT activada`);
        console.log(`📖 Swagger disponible en http://${config.server.host}:${config.server.port}/api/docs`);
        console.log('✅ Servidor listo para gestionar múltiples sesiones.');
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