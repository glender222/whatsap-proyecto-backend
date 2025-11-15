# 🏷️ Guía de Integración Frontend - Sistema de Etiquetas

## 📋 Resumen

Nuevo endpoint que unifica la información de etiquetas con los datos completos de WhatsApp.

---

## 🚀 Endpoint Principal

### `GET /api/tags/:tagId/chats/full`

Este endpoint retorna los chats completos con toda la información de WhatsApp, filtrados por etiqueta.

---

## 📊 Respuestas del Endpoint

### Etiqueta "Todo" (acceso total)

```json
GET /api/tags/1/chats/full

{
  "success": true,
  "data": [
    {
      "id": "51913739833@c.us",
      "name": "+51 913 739 833",
      "lastMessageTimestamp": 1761311348,
      "unreadCount": 0,
      "isGroup": false,
      "lastMessagePreview": "[Media]"
    },
    {
      "id": "51925593795@c.us",
      "name": "Juan Pérez",
      "lastMessageTimestamp": 1761311100,
      "unreadCount": 3,
      "isGroup": false,
      "lastMessagePreview": "Hola, ¿cómo estás?"
    }
  ],
  "tag": {
    "id": 1,
    "name": "Todo",
    "is_default": true
  }
}
```

### Etiqueta Personalizada (filtrado)

```json
GET /api/tags/2/chats/full

{
  "success": true,
  "data": [
    {
      "id": "51925593795@c.us",
      "name": "Juan Pérez",
      "lastMessageTimestamp": 1761311100,
      "unreadCount": 3,
      "isGroup": false,
      "lastMessagePreview": "Hola, ¿cómo estás?"
    }
  ],
  "tag": {
    "id": 2,
    "name": "Clientes VIP",
    "is_default": false
  }
}
```

### Etiqueta Sin Chats

```json
GET /api/tags/3/chats/full

{
  "success": true,
  "data": [],
  "tag": {
    "id": 3,
    "name": "Soporte",
    "is_default": false
  }
}
```

---

## 💡 Lógica Frontend Recomendada

### Paso 1: Obtener las Etiquetas del Usuario

```javascript
// GET /api/tags
const response = await fetch('/api/tags', {
  headers: { 'Authorization': `Bearer ${token}` }
});

const { data: tags } = await response.json();

/*
Respuesta:
[
  { id: 1, name: "Todo", color: "#10B981", is_default: true },
  { id: 2, name: "Clientes VIP", color: "#3B82F6", is_default: false },
  { id: 3, name: "Soporte", color: "#EF4444", is_default: false }
]
*/
```

### Paso 2: Cuando el Usuario Selecciona una Etiqueta

```javascript
async function loadChatsByTag(tagId) {
  const response = await fetch(`/api/tags/${tagId}/chats/full`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });

  const result = await response.json();
  
  // ✅ Ya tienes toda la información necesaria
  const chats = result.data;
  const tagInfo = result.tag;

  console.log(`Mostrando ${chats.length} chats de la etiqueta "${tagInfo.name}"`);
  
  return { chats, tagInfo };
}
```

### Paso 3: Renderizar los Chats

```javascript
function ChatList({ selectedTagId }) {
  const [chats, setChats] = useState([]);
  const [tagInfo, setTagInfo] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchChats() {
      setLoading(true);
      const { chats, tagInfo } = await loadChatsByTag(selectedTagId);
      setChats(chats);
      setTagInfo(tagInfo);
      setLoading(false);
    }

    fetchChats();
  }, [selectedTagId]);

  if (loading) return <div>Cargando chats...</div>;

  return (
    <div>
      <h2>
        {tagInfo.name} 
        {tagInfo.is_default && <span> (Todos los chats)</span>}
      </h2>
      
      {chats.length === 0 ? (
        <p>No hay chats en esta etiqueta</p>
      ) : (
        <ul>
          {chats.map(chat => (
            <li key={chat.id}>
              <strong>{chat.name}</strong>
              <p>{chat.lastMessagePreview}</p>
              {chat.unreadCount > 0 && (
                <span className="badge">{chat.unreadCount}</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

---

## 🔄 Comparación de Endpoints

### ❌ Antes (2 llamadas necesarias)

```javascript
// 1️⃣ Obtener IDs de chats de la etiqueta
const tagChats = await fetch(`/api/tags/2/chats`);
// { data: [{ chat_id: "51925593795@c.us", ... }] }

// 2️⃣ Obtener todos los chats de WhatsApp
const allChats = await fetch(`/api/chats`);
// { data: [{ id: "51913739833@c.us", name: "...", ... }] }

// 3️⃣ Filtrar manualmente en el frontend
const chatIds = tagChats.data.map(c => c.chat_id);
const filteredChats = allChats.data.filter(chat => 
  chatIds.includes(chat.id)
);
```

### ✅ Ahora (1 llamada)

```javascript
// Una sola llamada con todo resuelto
const response = await fetch(`/api/tags/2/chats/full`);
const { data: chats } = await response.json();
// Ya tienes los chats completos filtrados
```

---

## 🎯 Ventajas del Nuevo Endpoint

| Característica | Valor |
|---------------|-------|
| **Simplicidad** | 1 llamada en lugar de 2 |
| **Performance** | Filtrado en backend (más rápido) |
| **Datos completos** | Incluye toda la info de WhatsApp |
| **Manejo de "Todo"** | Automático (retorna todos los chats) |
| **Consistencia** | Misma estructura que `/api/chats` |

---

## 🔐 Seguridad

- ✅ Valida que el usuario tenga acceso a la etiqueta
- ✅ Solo retorna chats asignados a esa etiqueta
- ✅ La etiqueta "Todo" es especial (acceso total)
- ✅ Requiere token JWT válido

---

## 📱 Ejemplo de UI Completa

```javascript
function WhatsAppDashboard() {
  const [tags, setTags] = useState([]);
  const [selectedTag, setSelectedTag] = useState(null);
  const [chats, setChats] = useState([]);

  // Cargar etiquetas al inicio
  useEffect(() => {
    async function loadTags() {
      const response = await fetch('/api/tags', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const { data } = await response.json();
      setTags(data);
      
      // Seleccionar "Todo" por defecto
      const todoTag = data.find(t => t.is_default);
      if (todoTag) setSelectedTag(todoTag.id);
    }
    loadTags();
  }, []);

  // Cargar chats cuando cambia la etiqueta
  useEffect(() => {
    if (!selectedTag) return;

    async function loadChats() {
      const response = await fetch(`/api/tags/${selectedTag}/chats/full`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const { data } = await response.json();
      setChats(data);
    }
    loadChats();
  }, [selectedTag]);

  return (
    <div className="dashboard">
      {/* Sidebar de etiquetas */}
      <aside className="tags-sidebar">
        <h3>Etiquetas</h3>
        {tags.map(tag => (
          <button
            key={tag.id}
            className={selectedTag === tag.id ? 'active' : ''}
            onClick={() => setSelectedTag(tag.id)}
            style={{ borderLeft: `4px solid ${tag.color}` }}
          >
            {tag.name}
            {tag.is_default && ' 📋'}
          </button>
        ))}
      </aside>

      {/* Lista de chats */}
      <main className="chats-list">
        <h2>
          {tags.find(t => t.id === selectedTag)?.name || 'Chats'}
        </h2>
        {chats.length === 0 ? (
          <p>No hay chats en esta etiqueta</p>
        ) : (
          chats.map(chat => (
            <div key={chat.id} className="chat-item">
              <img src={chat.profilePic || '/default-avatar.png'} alt={chat.name} />
              <div>
                <strong>{chat.name}</strong>
                <p>{chat.lastMessagePreview}</p>
              </div>
              {chat.unreadCount > 0 && (
                <span className="badge">{chat.unreadCount}</span>
              )}
            </div>
          ))
        )}
      </main>
    </div>
  );
}
```

---

## 🎉 Resultado Final

Con este nuevo endpoint, tu frontend puede:

1. ✅ Obtener chats completos con una sola llamada
2. ✅ Cambiar entre etiquetas fácilmente
3. ✅ Manejar la etiqueta "Todo" automáticamente
4. ✅ Mostrar chats vacíos cuando no hay asignaciones
5. ✅ Tener mejor performance y UX

---

## 📞 Endpoints Relacionados

- `GET /api/tags` - Obtener todas las etiquetas del usuario
- `GET /api/tags/:id/chats/full` - ⭐ **NUEVO** - Chats completos por etiqueta
- `GET /api/tags/:id/chats` - Solo IDs de chats (legacy)
- `POST /api/tags/:id/chats` - Asignar chat a etiqueta
- `DELETE /api/tags/:id/chats/:chatId` - Remover chat de etiqueta

---

## 🐛 Debugging

Si tienes problemas:

1. Verifica que el token JWT sea válido
2. Confirma que el `tagId` existe y el usuario tiene acceso
3. Asegúrate que WhatsApp esté conectado
4. Revisa los logs del servidor para errores

```bash
# Ver logs del servidor
npm run dev
```
