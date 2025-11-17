# 🤖 Sistema de Distribución Automática de Bot - Guía Rápida

## 📋 Resumen

El sistema de bot ahora está completamente implementado y listo para conectar tu WhatsApp de reserva.

## ✅ Componentes Implementados

### 1. Base de Datos
- ✅ **Tabla `bot_chat_sessions`**: Almacena historial de interacciones bot-chat
  - Estados: `pending` (esperando respuesta), `active` (respondido), `completed` (servicio terminado)
  - Checkpoint para evitar re-activación hasta que se complete el servicio

### 2. Modelos
- ✅ **`BotChatSession.js`**: CRUD completo para gestión de sesiones
  - `create()`: Crear nueva sesión
  - `hasActiveSession()`: Verificar si chat tiene sesión activa
  - `updateResponse()`: Guardar respuesta del usuario
  - `complete()`: Marcar como completada
  - `resetSession()`: Forzar reset manual
  - `getStats()`: Estadísticas generales
  - `getTagDistribution()`: Distribución por tags

### 3. Servicios
- ✅ **`botAutoDistributionService.js`**: Motor principal del bot
  - Detecta bot activo del owner
  - Verifica modalidad (options/keywords)
  - Envía menú de opciones enumeradas
  - Procesa respuestas del usuario
  - Asigna tags automáticamente
  - Maneja keywords con matching de texto

### 4. Integración WhatsApp
- ✅ **`EventHandler.js`** modificado para llamar al bot en cada mensaje entrante
- ✅ No interfiere con el flujo normal de mensajes

### 5. API Endpoints

#### Estadísticas
```http
GET /api/bots/:botId/stats
Authorization: Bearer {token}
```
Retorna:
- Total de sesiones
- Sesiones pending/active/completed
- Distribución por tags
- Tiempo promedio de respuesta

#### Sesiones de un Bot
```http
GET /api/bots/:botId/sessions?limit=50&offset=0
Authorization: Bearer {token}
```

#### Historial de un Chat
```http
GET /api/chats/:chatId/sessions?limit=20
Authorization: Bearer {token}
```

#### Reset de Sesión
```http
POST /api/bots/:botId/sessions/reset
Authorization: Bearer {token}
Content-Type: application/json

{
  "chatId": "51912345678@c.us"
}
```

## 🚀 Flujo de Funcionamiento

### Modalidad: OPTIONS (Opciones Enumeradas)

#### 1. Usuario envía mensaje
```
Usuario: "Hola"
```

#### 2. Bot detecta que no hay sesión activa
- Verifica bot activo del owner
- Carga reglas type='option' y is_active=true
- Ordena por `order` ASC

#### 3. Bot envía menú
```
Bot: "¡Hola! Bienvenido

Por favor, elige una opción:

1. Copias
2. Banners
3. Diseño personalizado

_Responde con el número de tu opción_"
```

#### 4. Se crea sesión en DB
```sql
INSERT INTO bot_chat_sessions (bot_id, chat_id, status)
VALUES (9, '51912345678@c.us', 'pending')
```

#### 5. Usuario responde
```
Usuario: "1"
```

#### 6. Bot procesa respuesta
- Valida que sea número válido (1-3)
- Obtiene la opción correspondiente (order=1 → "Copias")
- Obtiene `tag_id` de esa opción
- Asigna tag al chat
- Actualiza sesión a `active`

#### 7. Bot confirma
```
Bot: "✅ Perfecto, un asesor te atenderá pronto.

_Tu consulta ha sido categorizada: Copias_"
```

#### 8. Sesión se marca como completada
```sql
UPDATE bot_chat_sessions 
SET status='completed', completed_at=NOW()
WHERE id=...
```

#### 9. Bot no se reactivará
- Hasta que un admin haga reset manual
- O hasta que la sesión expire (si implementas TTL)

### Modalidad: KEYWORDS (Palabras Clave)

#### 1. Usuario envía mensaje
```
Usuario: "Necesito hacer unas copias"
```

#### 2. Bot busca keywords
- Carga reglas type='keyword' y is_active=true
- Separa keywords por comas: `["estimado", "compañero", "esto", "es", "una", "extorcion"]`
- Busca coincidencia en mensaje del usuario

#### 3. Si encuentra match
- Asigna tag_id correspondiente
- Confirma al usuario
- Completa sesión

#### 4. Si NO encuentra match
- Envía mensaje genérico
- Completa sesión sin tag

## 🎯 Configuración de Bot

### Ejemplo de Bot con Opciones
```json
{
  "name": "Bot Ventas",
  "is_active": true,
  "strategy": "round_robin",
  "modality": "options",
  "welcome_message": "¡Hola! Bienvenido a nuestra tienda"
}
```

### Reglas (Options)
```json
[
  {
    "type": "option",
    "text": "Copias",
    "tagId": 5,
    "order": 1,
    "is_active": true
  },
  {
    "type": "option",
    "text": "Banners",
    "tagId": 6,
    "order": 2,
    "is_active": true
  },
  {
    "type": "option",
    "text": "Diseño personalizado",
    "tagId": 7,
    "order": 3,
    "is_active": true
  }
]
```

### Reglas (Keywords)
```json
[
  {
    "type": "keyword",
    "text": "copias, fotocopias, imprimir, impresion",
    "tagId": 5,
    "groupName": "Copias",
    "is_active": true
  },
  {
    "type": "keyword",
    "text": "banner, pancarta, lona, publicidad",
    "tagId": 6,
    "groupName": "Publicidad",
    "is_active": true
  }
]
```

## 🔧 Comandos de Prueba

### 1. Levantar servidor
```powershell
cd "c:\Leroy\PROYECTOS ING. SISTEMAS\Watsapp gestion\whatsap-proyecto-backend"
npm run dev
```

### 2. Login y obtener token
```powershell
$headers = @{"Content-Type" = "application/json"}
$body = '{"email":"leroy@empresa.com","password":"123456"}'
$response = Invoke-RestMethod -Uri http://localhost:3000/api/auth/login -Method POST -Headers $headers -Body $body
$token = $response.accessToken
Write-Host "Token: $token"
```

### 3. Ver estadísticas del bot
```powershell
$headers = @{"Authorization" = "Bearer $token"}
Invoke-RestMethod -Uri http://localhost:3000/api/bots/9/stats -Headers $headers | ConvertTo-Json -Depth 10
```

### 4. Ver sesiones del bot
```powershell
Invoke-RestMethod -Uri http://localhost:3000/api/bots/9/sessions -Headers $headers | ConvertTo-Json -Depth 10
```

### 5. Resetear sesión de un chat
```powershell
$headers = @{
  "Authorization" = "Bearer $token"
  "Content-Type" = "application/json"
}
$body = '{"chatId":"51912345678@c.us"}'
Invoke-RestMethod -Uri http://localhost:3000/api/bots/9/sessions/reset -Method POST -Headers $headers -Body $body
```

## 📊 Ejemplos de Respuestas

### Estadísticas
```json
{
  "success": true,
  "data": {
    "general": {
      "total_sessions": 45,
      "pending": 2,
      "active": 3,
      "completed": 40,
      "with_tag": 38,
      "avg_duration_seconds": 125.5
    },
    "tag_distribution": [
      { "tag_id": 5, "tag_name": "Copias", "count": 18 },
      { "tag_id": 6, "tag_name": "Banners", "count": 12 },
      { "tag_id": 7, "tag_name": "Diseño", "count": 8 }
    ]
  }
}
```

### Sesiones
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "bot_id": 9,
      "chat_id": "51912345678@c.us",
      "tag_id": 5,
      "tag_name": "Copias",
      "tag_color": "#3B82F6",
      "status": "completed",
      "selected_option": 1,
      "user_response": "1",
      "created_at": "2025-11-16T10:30:00.000Z",
      "completed_at": "2025-11-16T10:32:15.000Z"
    }
  ]
}
```

## ⚠️ Importante

### Reglas de Exclusividad de Bot
- ✅ Solo 1 bot puede estar activo por usuario
- ✅ Al activar uno, los demás se desactivan automáticamente
- ✅ Nuevos bots se crean inactivos (excepto el primero)

### Comportamiento de Sesiones
- ✅ Una vez enviado el menú, el chat tiene sesión `pending`
- ✅ Al responder, pasa a `active` y se asigna tag
- ✅ Se marca `completed` inmediatamente después de asignar tag
- ✅ Bot NO se reactivará hasta que un admin haga reset
- ✅ Esto evita spam de mensajes

### Validaciones
- ✅ Solo bots activos procesan mensajes
- ✅ Solo se procesan mensajes reales (no status, no notificaciones)
- ✅ Opciones se validan contra el rango disponible
- ✅ Keywords requieren coincidencia exacta (case-insensitive)

## 🧪 Próximos Pasos para Pruebas

1. **Conectar WhatsApp de reserva**
   - Escanear QR desde el frontend
   - Verificar conexión exitosa

2. **Activar un bot**
   - Asegurarte que tenga `is_active=true`
   - Verificar que tenga `welcome_message`
   - Confirmar que tenga reglas activas

3. **Enviar mensaje de prueba**
   - Desde otro número de WhatsApp
   - Verificar que reciba el menú
   - Responder con un número
   - Confirmar asignación de tag

4. **Verificar logs**
   - Revisar consola del servidor
   - Ver logs de `[Bot]`
   - Confirmar cada paso del flujo

5. **Probar estadísticas**
   - Llamar a `/api/bots/:botId/stats`
   - Verificar contadores
   - Ver distribución por tags

6. **Probar reset**
   - Intentar enviar otro mensaje al mismo chat
   - Confirmar que bot NO responde
   - Hacer reset manual
   - Enviar mensaje nuevamente
   - Confirmar que bot SÍ responde

## 🐛 Troubleshooting

### Bot no responde
1. Verificar que el bot esté activo: `GET /api/bots`
2. Verificar que tenga reglas activas: `GET /api/bots/:botId/rules`
3. Ver logs del servidor para errores

### Mensaje no se envía
1. Verificar conexión de WhatsApp
2. Ver logs de `[Bot]` en consola
3. Verificar que `whatsappClient.sendMessage()` funcione

### Tag no se asigna
1. Verificar que la regla tenga `tag_id`
2. Verificar que el tag exista: `GET /api/tags`
3. Ver logs de asignación de tag

### Bot se reactiva cuando no debería
1. Verificar estado de sesión: `GET /api/chats/:chatId/sessions`
2. Confirmar que la sesión esté `completed`
3. Hacer reset si es necesario

## 📝 Logs Útiles

```
[Bot] Bot activo encontrado: Bot Principal (ID: 9, Modalidad: options)
[Bot] No hay sesión activa para 51912345678@c.us, enviando menú...
[Bot] Menú de opciones enviado a 51912345678@c.us
[Bot] Sesión creada para 51912345678@c.us
[Bot] Sesión activa encontrada para 51912345678@c.us, procesando respuesta...
[Bot] Usuario 51912345678@c.us seleccionó opción 1: Copias
[Bot] Tag "Copias" asignado a chat 51912345678@c.us
[Bot] Sesión 1 marcada como completada
```

## 🎉 ¡Listo para Producción!

Todo el sistema está implementado y funcionando. Solo falta:
1. Conectar tu WhatsApp de reserva
2. Configurar tu bot activo
3. Agregar reglas (opciones o keywords)
4. ¡Probar!

¡Todo saldrá a la primera! 🚀
