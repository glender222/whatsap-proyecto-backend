# Sistema de Etiquetas (Tags)

## 📋 Descripción General

El sistema de etiquetas permite organizar y controlar el acceso a los contactos/chats de WhatsApp de manera eficiente. Los administradores pueden crear etiquetas y asignarlas tanto a chats como a empleados, controlando así qué conversaciones puede ver cada empleado.

## 🏗️ Arquitectura

### Modelos de Base de Datos

#### 1. **Tags (Etiquetas)**
```sql
CREATE TABLE tags (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  color VARCHAR(20) DEFAULT '#3B82F6',
  owner_id BIGINT NOT NULL REFERENCES usuarios(id),
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(owner_id, name)
);
```

#### 2. **UserTags (Relación Empleado-Etiqueta)**
```sql
CREATE TABLE user_tags (
  user_id BIGINT NOT NULL REFERENCES usuarios(id),
  tag_id BIGINT NOT NULL REFERENCES tags(id),
  granted_by BIGINT NOT NULL REFERENCES usuarios(id),
  granted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, tag_id)
);
```

#### 3. **ChatTags (Relación Chat-Etiqueta)**
```sql
CREATE TABLE chat_tags (
  id BIGSERIAL PRIMARY KEY,
  chat_id VARCHAR(255) NOT NULL,
  tag_id BIGINT NOT NULL REFERENCES tags(id),
  assigned_by BIGINT NOT NULL REFERENCES usuarios(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(chat_id, tag_id)
);
```

## 🎯 Características Principales

### 1. **Etiqueta "Todo" (Especial)**

- **Creación automática**: Se crea al registrar un administrador
- **No almacena chats**: No utiliza la tabla `chat_tags` para evitar duplicación de datos
- **Acceso completo**: Funciona como un permiso virtual que da acceso a todos los chats
- **No se puede eliminar ni editar**: Protegida para mantener la integridad del sistema
- **Color por defecto**: Verde (`#10B981`)

### 2. **Permisos de Acceso**

#### Administradores:
- ✅ Acceso automático a todos los chats (vía etiqueta "Todo")
- ✅ Pueden crear, editar y eliminar etiquetas
- ✅ Pueden asignar/revocar etiquetas a empleados
- ✅ Pueden asignar chats a etiquetas
- ✅ Ven todas sus etiquetas creadas

#### Empleados:
- ✅ Solo ven etiquetas asignadas a ellos
- ✅ Si tienen "Todo", ven todos los chats
- ✅ Si tienen etiquetas específicas, solo ven chats de esas etiquetas
- ✅ Si NO tienen etiquetas, NO ven ningún chat (seguridad por defecto)
- ❌ No pueden crear ni eliminar etiquetas

## 🔄 Flujo de Trabajo

### Registro de Admin
```javascript
1. Usuario se registra como ADMIN
2. Se crea automáticamente la etiqueta "Todo"
3. Admin tiene acceso a todos los chats sin necesidad de asignarlos
```

### Asignar Acceso a Empleado
```javascript
// Opción 1: Dar acceso completo
POST /api/tags/{todoTagId}/users
Body: { "employeeId": 123 }

// Opción 2: Dar acceso a etiquetas específicas
POST /api/tags/{tagId}/users
Body: { "employeeId": 123 }
```

### Organizar Chats con Etiquetas
```javascript
// 1. Crear etiqueta
POST /api/tags
Body: { "name": "Clientes VIP", "color": "#EF4444" }

// 2. Asignar chat a etiqueta
POST /api/tags/{tagId}/chats
Body: { "chatId": "573001234567@c.us" }

// 3. Dar acceso a empleado
POST /api/tags/{tagId}/users
Body: { "employeeId": 123 }
```

## 📡 Endpoints API

### CRUD de Etiquetas

| Método | Endpoint | Descripción | Rol |
|--------|----------|-------------|-----|
| POST | `/api/tags` | Crear etiqueta | ADMIN |
| GET | `/api/tags` | Listar mis etiquetas | Todos |
| GET | `/api/tags/:id` | Obtener etiqueta | Todos* |
| PUT | `/api/tags/:id` | Actualizar etiqueta | ADMIN |
| DELETE | `/api/tags/:id` | Eliminar etiqueta | ADMIN |

*Con acceso verificado

### Gestión de Empleados

| Método | Endpoint | Descripción | Rol |
|--------|----------|-------------|-----|
| POST | `/api/tags/:id/users` | Asignar etiqueta a empleado | ADMIN |
| DELETE | `/api/tags/:id/users/:employeeId` | Quitar etiqueta | ADMIN |
| GET | `/api/tags/:id/users` | Ver empleados con acceso | ADMIN |

### Gestión de Chats

| Método | Endpoint | Descripción | Rol |
|--------|----------|-------------|-----|
| POST | `/api/tags/:id/chats` | Asignar chat a etiqueta | Todos* |
| DELETE | `/api/tags/:id/chats/:chatId` | Remover chat | Todos* |
| GET | `/api/tags/:id/chats` | Ver chats de etiqueta | Todos* |
| GET | `/api/chats/:chatId/tags` | Ver etiquetas de un chat | Todos |

*Con acceso a la etiqueta

### Estadísticas

| Método | Endpoint | Descripción | Rol |
|--------|----------|-------------|-----|
| GET | `/api/tags/:id/stats` | Estadísticas de etiqueta | Todos* |

## 💡 Ejemplos de Uso

### 1. Crear una etiqueta y asignar chats

```javascript
// 1. Crear etiqueta "Clientes Importantes"
const response = await fetch('/api/tags', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${accessToken}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    name: 'Clientes Importantes',
    color: '#F59E0B'
  })
});

const { data: tag } = await response.json();

// 2. Asignar varios chats a esta etiqueta
const chatIds = [
  '573001234567@c.us',
  '573007654321@c.us'
];

for (const chatId of chatIds) {
  await fetch(`/api/tags/${tag.id}/chats`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ chatId })
  });
}
```

### 2. Dar acceso a un empleado

```javascript
// Dar acceso a la etiqueta "Clientes Importantes"
await fetch(`/api/tags/${tag.id}/users`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${accessToken}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    employeeId: 456
  })
});
```

### 3. Obtener chats según etiquetas del usuario

```javascript
// Este endpoint automáticamente filtra según las etiquetas del usuario
const response = await fetch('/api/chats', {
  headers: {
    'Authorization': `Bearer ${accessToken}`
  }
});

const { data: chats } = await response.json();
// Si el usuario tiene "Todo": retorna TODOS los chats
// Si tiene etiquetas específicas: retorna solo chats de esas etiquetas
// Si NO tiene etiquetas: retorna array vacío []
```

## ⚡ Optimización de Performance

### Query de Chats Optimizado

El sistema utiliza una lógica optimizada para evitar queries innecesarios:

```javascript
// Pseudo-código del flujo
if (usuario.rol === 'ADMIN') {
  return TODOS_LOS_CHATS; // Sin query a chat_tags
}

if (usuario.tieneEtiquetaTodo()) {
  return TODOS_LOS_CHATS; // Sin query a chat_tags
}

// Solo aquí se hace JOIN con chat_tags
const chatIds = await obtenerChatsDeSusEtiquetas(usuario.id);
return filtrarChats(chatIds);
```

**Ventajas:**
- ✅ No duplica datos en la BD
- ✅ Carga rápida para usuarios con acceso completo
- ✅ Sin inyección de 300+ contactos al iniciar sesión
- ✅ Escalable para múltiples etiquetas por chat

## 🔒 Seguridad

### Validaciones Implementadas

1. **Propiedad de etiquetas**: Solo el propietario puede editar/eliminar
2. **Relación empleado-admin**: Solo se pueden asignar empleados propios
3. **Acceso a etiquetas**: Verificación en cada operación
4. **Protección de "Todo"**: No se puede editar, eliminar ni asignar chats
5. **Seguridad por defecto**: Sin etiquetas = Sin acceso

## 🚀 Migración desde ChatPermission

Si ya usabas el sistema anterior de `ChatPermission`, aquí está cómo migrar:

### Opción 1: Coexistencia Temporal
- Mantener ambos sistemas funcionando
- Migrar gradualmente usuarios al nuevo sistema
- Eliminar `ChatPermission` cuando todos estén migrados

### Opción 2: Migración Automática
```javascript
// Script de migración (ejemplo)
const migratePermissionsToTags = async (adminId) => {
  // 1. Obtener empleados del admin
  const employees = await User.findEmployeesByOwner(adminId);
  
  for (const employee of employees) {
    // 2. Obtener chats permitidos del empleado
    const chatIds = await ChatPermission.findByEmployeeId(employee.id);
    
    if (chatIds.length === 0) continue;
    
    // 3. Crear etiqueta para este empleado
    const tag = await Tag.create(
      `Chats de ${employee.nombre}`,
      adminId,
      '#3B82F6',
      false
    );
    
    // 4. Asignar chats a la etiqueta
    for (const chatId of chatIds) {
      await ChatTag.assign(chatId, tag.id, adminId);
    }
    
    // 5. Dar acceso al empleado
    await Tag.assignToUser(tag.id, employee.id, adminId);
  }
};
```

## 📝 Notas Importantes

1. **Un chat puede tener múltiples etiquetas**: Permite organización flexible
2. **Un empleado puede tener múltiples etiquetas**: Acceso granular
3. **La etiqueta "Todo" es única por admin**: No se puede duplicar
4. **Los colores son opcionales**: Facilitan la UI pero no afectan la lógica
5. **Las etiquetas se eliminan en cascada**: Al eliminar una etiqueta, se eliminan sus relaciones

## 🎨 Colores Sugeridos

Para una mejor UX, aquí algunos colores recomendados:

```javascript
const TAG_COLORS = {
  'Todo': '#10B981',        // Verde
  'VIP': '#F59E0B',         // Amarillo/Oro
  'Soporte': '#3B82F6',     // Azul
  'Ventas': '#EF4444',      // Rojo
  'Pendiente': '#8B5CF6',   // Púrpura
  'Archivado': '#6B7280'    // Gris
};
```

## 🐛 Troubleshooting

### Empleado no ve ningún chat
**Causa**: No tiene etiquetas asignadas  
**Solución**: Asignarle al menos una etiqueta

### Admin no ve todos los chats
**Causa**: Etiqueta "Todo" no se creó al registrar  
**Solución**: Crear manualmente la etiqueta "Todo" con `is_default=true`

### Error al asignar chat a "Todo"
**Causa**: No se puede asignar chats a la etiqueta "Todo"  
**Solución**: Usar otras etiquetas para organización, "Todo" es solo para acceso completo

---

**¡Sistema implementado exitosamente!** 🎉
