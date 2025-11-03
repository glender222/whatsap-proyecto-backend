// tests/unit/services/ChatValidator.test.js
const ChatValidator = require('../../../src/services/whatsapp/ChatValidator');

describe('ChatValidator - Tests de Validación en Memoria', () => {
  describe('isValidChat()', () => {
    it('debe rechazar estado de WhatsApp', () => {
      const chat = { id: { _serialized: 'status@broadcast' } };
      expect(ChatValidator.isValidChat(chat)).toBe(false);
    });

    it('debe rechazar canales/newsletters', () => {
      const chat = { id: { _serialized: '12345@newsletter' } };
      expect(ChatValidator.isValidChat(chat)).toBe(false);
    });

    it('debe aceptar chats individuales válidos', () => {
      const chat = { 
        id: { _serialized: '5491112345678@c.us' },
        isGroup: false
      };
      expect(ChatValidator.isValidChat(chat)).toBe(true);
    });

    it('debe aceptar grupos válidos', () => {
      const chat = { 
        id: { _serialized: '123456789@g.us' },
        isGroup: true
      };
      expect(ChatValidator.isValidChat(chat)).toBe(true);
    });
  });

  describe('isRealMessage()', () => {
    it('debe rechazar mensajes de sistema tipo "gp2"', () => {
      const msg = { type: 'gp2', body: 'Usuario se unió' };
      expect(ChatValidator.isRealMessage(msg)).toBe(false);
    });

    it('debe rechazar call_log', () => {
      const msg = { type: 'call_log' };
      expect(ChatValidator.isRealMessage(msg)).toBe(false);
    });

    it('debe aceptar mensajes de texto normales', () => {
      const msg = { type: 'chat', body: 'Hola' };
      expect(ChatValidator.isRealMessage(msg)).toBe(true);
    });

    it('debe rechazar eventos de grupo por contenido', () => {
      const msg = { 
        type: 'chat',
        body: 'Juan se unió usando el enlace de invitación'
      };
      expect(ChatValidator.isRealMessage(msg)).toBe(false);
    });
  });

  describe('sortChats()', () => {
    it('debe priorizar chats con mensajes no leídos', () => {
      const chats = [
        { id: 'chat1', unreadCount: 0, lastMessageTimestamp: 5000 },
        { id: 'chat2', unreadCount: 3, lastMessageTimestamp: 2000 },
        { id: 'chat3', unreadCount: 0, lastMessageTimestamp: 8000 }
      ];

      const sorted = ChatValidator.sortChats(chats);

      // chat2 debe estar primero (tiene no leídos)
      expect(sorted[0].id).toBe('chat2');
    });

    it('debe ordenar por timestamp si no hay no leídos', () => {
      const chats = [
        { id: 'chat1', unreadCount: 0, lastMessageTimestamp: 2000 },
        { id: 'chat2', unreadCount: 0, lastMessageTimestamp: 5000 },
        { id: 'chat3', unreadCount: 0, lastMessageTimestamp: 1000 }
      ];

      const sorted = ChatValidator.sortChats(chats);

      expect(sorted[0].lastMessageTimestamp).toBe(5000);
      expect(sorted[2].lastMessageTimestamp).toBe(1000);
    });
  });
});