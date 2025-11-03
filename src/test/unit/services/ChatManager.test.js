// tests/unit/services/ChatManager.test.js
const ChatManager = require('../../../src/services/whatsapp/ChatManager');

const mockWhatsAppClient = {
  client: {
    getChats: jest.fn()
  },
  chatsList: [],
  socketIO: {
    emit: jest.fn()
  },
  isConnected: true
};

describe('ChatManager - Unit Tests', () => {
  let chatManager;

  beforeEach(() => {
    chatManager = new ChatManager(mockWhatsAppClient);
    mockWhatsAppClient.chatsList = [];
    jest.clearAllMocks();
  });

  describe('updateChatInList()', () => {
    it('debe actualizar un chat existente con nuevo mensaje', async () => {
      mockWhatsAppClient.chatsList = [
        {
          id: 'test@c.us',
          name: 'Test User',
          lastMessageTimestamp: 1000,
          unreadCount: 0,
          lastMessagePreview: 'Mensaje viejo'
        }
      ];

      const mockChat = {
        id: { _serialized: 'test@c.us' },
        name: 'Test User',
        unreadCount: 1
      };

      const mockMsg = {
        body: 'Mensaje nuevo',
        hasMedia: false
      };

      await chatManager.updateChatInList(mockChat, 5000, mockMsg);

      const updatedChat = mockWhatsAppClient.chatsList[0];
      expect(updatedChat.lastMessageTimestamp).toBe(5000);
      expect(updatedChat.unreadCount).toBe(1);
      expect(updatedChat.lastMessagePreview).toBe('Mensaje nuevo');
    });

    it('debe agregar un chat nuevo si no existe en la lista', async () => {
      mockWhatsAppClient.chatsList = [];

      const mockChat = {
        id: { _serialized: 'new@c.us' },
        name: 'New User',
        unreadCount: 1
      };

      const mockMsg = {
        body: 'Primer mensaje',
        hasMedia: false
      };

      await chatManager.updateChatInList(mockChat, 2000, mockMsg);

      expect(mockWhatsAppClient.chatsList).toHaveLength(1);
      expect(mockWhatsAppClient.chatsList[0].id).toBe('new@c.us');
      expect(mockWhatsAppClient.chatsList[0].lastMessagePreview).toBe('Primer mensaje');
    });

    it('debe mostrar "[Media]" si el mensaje tiene archivo', async () => {
      const mockChat = {
        id: { _serialized: 'media@c.us' },
        name: 'Media User',
        unreadCount: 0
      };

      const mockMsg = {
        body: '',
        hasMedia: true
      };

      await chatManager.updateChatInList(mockChat, 3000, mockMsg);

      expect(mockWhatsAppClient.chatsList[0].lastMessagePreview).toBe('[Media]');
    });
  });
});