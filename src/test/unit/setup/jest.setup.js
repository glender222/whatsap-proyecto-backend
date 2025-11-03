// tests/setup/jest.setup.js

/**
 * Configuración global de Jest para tests de WhatsApp
 * - Mockea módulos externos (whatsapp-web.js, qrcode, node-fetch)
 * - Define variables globales de test
 * - Configura timeouts
 */

// ============================================
// 1. MOCK de whatsapp-web.js (librería externa)
// ============================================
jest.mock('whatsapp-web.js', () => {
  // Mock de MessageMedia
  class MessageMedia {
    constructor(mimetype, data, filename) {
      this.mimetype = mimetype;
      this.data = data;
      this.filename = filename;
    }

    static fromFilePath(path) {
      return new MessageMedia('image/jpeg', 'base64data', 'test.jpg');
    }
  }

  // Mock de LocalAuth
  class LocalAuth {
    constructor() {
      this.clientId = 'test-client';
    }
  }

  // Mock de Client
  class Client {
    constructor() {
      this.info = null;
      this._events = {};
    }

    on(event, callback) {
      this._events[event] = callback;
    }

    async initialize() {
      // Simular inicialización
      return Promise.resolve();
    }

    async sendMessage(chatId, content, options) {
      return {
        id: { _serialized: 'msg_mock_' + Date.now() },
        timestamp: Math.floor(Date.now() / 1000),
        body: typeof content === 'string' ? content : '',
        ack: 1
      };
    }

    async getChatById(chatId) {
      return {
        id: { _serialized: chatId },
        name: 'Test Chat',
        unreadCount: 0,
        fetchMessages: jest.fn().mockResolvedValue([]),
        sendSeen: jest.fn().mockResolvedValue(true)
      };
    }

    async getChats() {
      return [];
    }

    getState() {
      return 'CONNECTED';
    }

    async logout() {
      return Promise.resolve();
    }

    async destroy() {
      return Promise.resolve();
    }
  }

  return {
    Client,
    LocalAuth,
    MessageMedia
  };
});

// ============================================
// 2. MOCK de qrcode (generación de QR)
// ============================================
jest.mock('qrcode', () => ({
  toDataURL: jest.fn((qr, callback) => {
    callback(null, 'data:image/png;base64,mockQRCode');
  })
}));

// ============================================
// 3. MOCK de node-fetch (para fotos de perfil)
// ============================================
jest.mock('node-fetch', () => {
  return jest.fn(() =>
    Promise.resolve({
      ok: true,
      arrayBuffer: () => Promise.resolve(Buffer.from('fake-image-data'))
    })
  );
});

// ============================================
// 4. MOCK de fs (sistema de archivos)
// ============================================
const fs = require('fs');
jest.spyOn(fs, 'existsSync').mockReturnValue(false);
jest.spyOn(fs, 'mkdirSync').mockImplementation(() => {});
jest.spyOn(fs, 'writeFileSync').mockImplementation(() => {});
jest.spyOn(fs, 'readFileSync').mockReturnValue(Buffer.from('test-file-content'));
jest.spyOn(fs, 'readdirSync').mockReturnValue([]);
jest.spyOn(fs, 'unlinkSync').mockImplementation(() => {});

// ============================================
// 5. Variables globales de test
// ============================================
global.mockWhatsAppClient = {
  client: null,
  chatsList: [],
  qrImage: '',
  isConnected: false,
  socketIO: {
    emit: jest.fn(),
    to: jest.fn(() => ({ emit: jest.fn() }))
  }
};

global.mockMessage = {
  id: { _serialized: 'msg_test_12345' },
  body: 'Mensaje de prueba',
  fromMe: false,
  timestamp: 1698765432,
  author: '5491112345678@c.us',
  from: '5491112345678@c.us',
  type: 'chat',
  hasMedia: false,
  _data: {}
};

global.mockChat = {
  id: { _serialized: '5491112345678@c.us' },
  name: 'Test User',
  unreadCount: 0,
  isGroup: false,
  timestamp: 1698765432,
  fetchMessages: jest.fn().mockResolvedValue([])
};

// ============================================
// 6. Configuración de timeouts
// ============================================
jest.setTimeout(10000); // 10 segundos para tests

// ============================================
// 7. Limpiar mocks después de cada test
// ============================================
afterEach(() => {
  jest.clearAllMocks();
});

// ============================================
// 8. Funciones de ayuda para tests
// ============================================
global.createMockMessage = (overrides = {}) => {
  return {
    ...global.mockMessage,
    ...overrides
  };
};

global.createMockChat = (overrides = {}) => {
  return {
    ...global.mockChat,
    ...overrides
  };
};

console.log('✅ Jest setup completado - Mocks configurados');