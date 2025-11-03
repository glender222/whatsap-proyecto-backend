// tests/unit/utils/chatUtils.test.js
const { sortChatsByActivity, isValidChat, formatMessage } = require('../../../src/utils/chatUtils');

describe('chatUtils - Unit Tests', () => {
  describe('sortChatsByActivity()', () => {
    it('debe priorizar chats con mensajes no leídos', () => {
      const chats = [
        { id: 'chat1', unreadCount: 0, lastMessageTimestamp: 5000 },
        { id: 'chat2', unreadCount: 3, lastMessageTimestamp: 2000 },
        { id: 'chat3', unreadCount: 0, lastMessageTimestamp: 8000 }
      ];

      const sorted = sortChatsByActivity(chats);

      // chat2 debe estar primero (tiene no leídos)
      expect(sorted[0].id).toBe('chat2');
    });

    it('debe ordenar por timestamp si no hay no leídos', () => {
      const chats = [
        { id: 'chat1', unreadCount: 0, lastMessageTimestamp: 2000 },
        { id: 'chat2', unreadCount: 0, lastMessageTimestamp: 5000 },
        { id: 'chat3', unreadCount: 0, lastMessageTimestamp: 1000 }
      ];

      const sorted = sortChatsByActivity(chats);

      expect(sorted[0].lastMessageTimestamp).toBe(5000); // Más reciente primero
      expect(sorted[2].lastMessageTimestamp).toBe(1000); // Más antiguo al final
    });
  });

  describe('isValidChat()', () => {
    it('debe rechazar estado de WhatsApp', () => {
      const chat = { id: { _serialized: 'status@broadcast' } };
      expect(isValidChat(chat)).toBe(false);
    });

    it('debe rechazar canales/newsletters', () => {
      const chat = { id: { _serialized: '12345@newsletter' } };
      expect(isValidChat(chat)).toBe(false);
    });

    it('debe aceptar chats individuales válidos', () => {
      const chat = { id: { _serialized: '5491112345678@c.us' }, isGroup: false };
      expect(isValidChat(chat)).toBe(true);
    });

    it('debe aceptar grupos válidos', () => {
      const chat = { id: { _serialized: '123456789@g.us' }, isGroup: true };
      expect(isValidChat(chat)).toBe(true);
    });
  });
});