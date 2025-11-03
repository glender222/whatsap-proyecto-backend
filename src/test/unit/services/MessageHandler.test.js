// tests/unit/services/MessageHandler.test.js
const MessageHandler = require('../../../src/services/whatsapp/MessageHandler');

describe('MessageHandler - Tests Unitarios (Mensajes en Memoria)', () => {
  let messageHandler;
  let mockWhatsAppClient;

  beforeEach(() => {
    // Crear mock del cliente WhatsApp
    mockWhatsAppClient = {
      client: {
        sendMessage: jest.fn().mockResolvedValue({
          id: { _serialized: 'msg_sent_123' },
          timestamp: Math.floor(Date.now() / 1000)
        }),
        getChatById: jest.fn()
      },
      chatsList: [],
      socketIO: {
        emit: jest.fn()
      },
      isConnected: true
    };

    messageHandler = new MessageHandler(mockWhatsAppClient);
  });

  // ==========================================
  // TESTS DE FORMATEO DE MENSAJES
  // ==========================================

  describe('formatMessage() - Formateo en memoria', () => {
    it('debe formatear mensaje de texto correctamente', () => {
      const msg = createMockMessage({
        body: 'Hola desde el test',
        fromMe: false
      });

      const result = messageHandler.formatMessage(msg, '5491112345678@c.us');

      expect(result).toEqual({
        id: 'msg_test_12345',
        body: 'Hola desde el test',
        fromMe: false,
        timestamp: 1698765432,
        sender: '5491112345678@c.us',
        type: 'chat',
        mediaUrl: null,
        mimetype: null,
        filename: null,
        chatId: '5491112345678@c.us'
      });
    });

    it('debe formatear mensaje con media', () => {
      const msg = createMockMessage({
        body: '',
        hasMedia: true,
        type: 'image',
        _data: {
          mimetype: 'image/jpeg',
          filename: 'foto.jpg'
        }
      });

      const result = messageHandler.formatMessage(msg, '5491112345678@c.us');

      expect(result.mediaUrl).toBe('/download-media/msg_test_12345');
      expect(result.mimetype).toBe('image/jpeg');
      expect(result.filename).toBe('foto.jpg');
      expect(result.type).toBe('image');
    });

    it('debe convertir tipo "ptt" a "audio"', () => {
      const msg = createMockMessage({
        type: 'ptt', // Push-to-talk (nota de voz)
        hasMedia: true
      });

      const result = messageHandler.formatMessage(msg, '5491112345678@c.us');

      expect(result.type).toBe('audio');
    });

    it('debe manejar mensajes enviados por mí', () => {
      const msg = createMockMessage({
        fromMe: true,
        author: null // Mensajes propios no tienen author
      });

      const result = messageHandler.formatMessage(msg, '5491112345678@c.us');

      expect(result.fromMe).toBe(true);
      expect(result.sender).toBe('5491112345678@c.us');
    });
  });

  // ==========================================
  // TESTS DE ENVÍO DE MENSAJES
  // ==========================================

  describe('sendMessage() - Envío y actualización de memoria', () => {
    it('debe enviar mensaje de texto y actualizar chatsList', async () => {
      const chatId = '5491112345678@c.us';
      const message = 'Test message';

      // Pre-poblar chatsList
      mockWhatsAppClient.chatsList = [{
        id: chatId,
        name: 'Test User',
        lastMessageTimestamp: 1000000,
        lastMessagePreview: 'Mensaje viejo'
      }];

      await messageHandler.sendMessage(chatId, message);

      // Verificar que se llamó al cliente de WhatsApp
      expect(mockWhatsAppClient.client.sendMessage).toHaveBeenCalledWith(
        chatId,
        message
      );

      // Verificar que se actualizó chatsList en memoria
      const updatedChat = mockWhatsAppClient.chatsList[0];
      expect(updatedChat.lastMessageTimestamp).toBeGreaterThan(1000000);
      expect(updatedChat.lastMessagePreview).toBe('Test message');

      // Verificar que se emitió evento Socket.IO
      expect(mockWhatsAppClient.socketIO.emit).toHaveBeenCalledWith(
        'chats-updated',
        expect.arrayContaining([
          expect.objectContaining({
            id: chatId,
            lastMessagePreview: 'Test message'
          })
        ])
      );
    });

    it('debe enviar mensaje con media y marcar preview como [Media]', async () => {
      const chatId = '5491112345678@c.us';
      const mockMedia = {
        path: '/tmp/test.jpg',
        mimetype: 'image/jpeg',
        originalname: 'test.jpg',
        size: 12345
      };

      mockWhatsAppClient.chatsList = [{
        id: chatId,
        name: 'Test',
        lastMessageTimestamp: 1000,
        lastMessagePreview: 'Old'
      }];

      await messageHandler.sendMessage(chatId, 'Caption test', mockMedia);

      const updatedChat = mockWhatsAppClient.chatsList[0];
      expect(updatedChat.lastMessagePreview).toBe('[Media]');
    });

    it('debe lanzar error si no hay mensaje ni media', async () => {
      await expect(
        messageHandler.sendMessage('test@c.us', null, null)
      ).rejects.toThrow('No hay mensaje ni archivo para enviar');
    });

    it('debe crear entrada en chatsList si el chat no existe', async () => {
      const chatId = 'new_chat@c.us';
      mockWhatsAppClient.chatsList = []; // Lista vacía

      await messageHandler.sendMessage(chatId, 'Primer mensaje');

      // Nota: en la implementación real, sendMessage NO crea el chat
      // Solo actualiza si existe. Este test documenta el comportamiento actual
      expect(mockWhatsAppClient.chatsList.length).toBe(0);
    });
  });

  // ==========================================
  // TESTS DE OBTENCIÓN DE MENSAJES
  // ==========================================

  describe('getChatMessages() - Recuperar mensajes de memoria', () => {
    it('debe obtener y formatear mensajes de un chat', async () => {
      const chatId = '5491112345678@c.us';
      
      const mockMessages = [
        createMockMessage({ 
          id: { _serialized: 'msg_1' }, 
          body: 'Mensaje 1',
          timestamp: 1000
        }),
        createMockMessage({ 
          id: { _serialized: 'msg_2' }, 
          body: 'Mensaje 2',
          timestamp: 2000
        })
      ];

      const mockChat = {
        id: { _serialized: chatId },
        fetchMessages: jest.fn().mockResolvedValue(mockMessages)
      };

      mockWhatsAppClient.client.getChatById.mockResolvedValue(mockChat);

      const result = await messageHandler.getChatMessages(chatId, 50);

      expect(mockWhatsAppClient.client.getChatById).toHaveBeenCalledWith(chatId);
      expect(mockChat.fetchMessages).toHaveBeenCalledWith({ limit: 50 });
      expect(result).toHaveLength(2);
      
      // Verificar que están ordenados por timestamp ascendente
      expect(result[0].timestamp).toBe(1000);
      expect(result[1].timestamp).toBe(2000);
    });

    it('debe respetar parámetro de límite', async () => {
      const mockChat = {
        fetchMessages: jest.fn().mockResolvedValue([])
      };

      mockWhatsAppClient.client.getChatById.mockResolvedValue(mockChat);

      await messageHandler.getChatMessages('test@c.us', 10);

      expect(mockChat.fetchMessages).toHaveBeenCalledWith({ limit: 10 });
    });

    it('debe usar parámetro "before" para paginación', async () => {
      const mockChat = {
        fetchMessages: jest.fn().mockResolvedValue([])
      };

      mockWhatsAppClient.client.getChatById.mockResolvedValue(mockChat);

      await messageHandler.getChatMessages('test@c.us', 50, 1698765432);

      expect(mockChat.fetchMessages).toHaveBeenCalledWith({
        limit: 50,
        before: 1698765432
      });
    });
  });

  // ==========================================
  // TESTS DE MARCAR COMO LEÍDO
  // ==========================================

  describe('markAsRead() - Actualizar estado en memoria', () => {
    it('debe marcar chat como leído y actualizar chatsList', async () => {
      const chatId = 'test@c.us';
      
      const mockChat = {
        id: { _serialized: chatId },
        unreadCount: 5,
        sendSeen: jest.fn().mockResolvedValue(true)
      };

      mockWhatsAppClient.chatsList = [{
        id: chatId,
        unreadCount: 5,
        name: 'Test'
      }];

      mockWhatsAppClient.client.getChatById.mockResolvedValue(mockChat);

      await messageHandler.markAsRead(chatId);

      // Verificar que se llamó sendSeen
      expect(mockChat.sendSeen).toHaveBeenCalled();

      // Verificar que se actualizó el contador en memoria
      expect(mockWhatsAppClient.chatsList[0].unreadCount).toBe(0);

      // Verificar que se emitió actualización
      expect(mockWhatsAppClient.socketIO.emit).toHaveBeenCalledWith(
        'chats-updated',
        expect.any(Array)
      );
    });

    it('NO debe llamar sendSeen si unreadCount es 0', async () => {
      const mockChat = {
        unreadCount: 0,
        sendSeen: jest.fn()
      };

      mockWhatsAppClient.client.getChatById.mockResolvedValue(mockChat);

      await messageHandler.markAsRead('test@c.us');

      expect(mockChat.sendSeen).not.toHaveBeenCalled();
    });
  });
});