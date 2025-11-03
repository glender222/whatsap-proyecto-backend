# 💬 WhatsApp Web API

Una API REST moderna y multi-agente para gestionar WhatsApp Web con Socket.IO en tiempo real.
🟩 **Node.js + Express + Socket.IO**

## 🚀 Características

Sistema completo para interactuar con WhatsApp Web desde un servidor Node.js: envío y recepción de mensajes, manejo de archivos multimedia, perfiles y comunicación en tiempo real.

- ✅ **Arquitectura Multi-Agente:** Permite que un administrador conecte una cuenta de WhatsApp y asigne chats específicos a diferentes empleados/estaciones de trabajo.
- ✅ **Sistema de Permisos Robusto:** Control granular sobre qué empleado puede ver y responder a qué chat.
- ✅ **API REST Semántica y Segura:** Endpoints claros con autenticación JWT y roles (Admin/Empleado).
- ✅ **Comunicación en Tiempo Real con Socket.IO:** Notificaciones instantáneas de nuevos mensajes solo a los usuarios autorizados.

---

## 🚀 Sistema Multi-Agente y Gestión de Permisos

Esta API ahora funciona como una plataforma multi-agente. El flujo de trabajo está diseñado para que un **Administrador (rol `ADMIN`)** controle la sesión de WhatsApp y gestione los permisos de sus **Empleados (rol `EMPLEADO`)**.

### Flujo de Trabajo (Admin y Empleados)

1.  **Registro y Login del Admin:** Un administrador se registra y obtiene sus tokens de autenticación.
2.  **Inicialización de WhatsApp (¡Nuevo!):** El admin **debe** llamar al nuevo endpoint `POST /api/whatsapp/init` para iniciar la conexión con WhatsApp y generar el QR.
3.  **Creación de Empleados:** El admin crea cuentas para sus empleados (`POST /api/auth/create-station`).
4.  **Asignación de Chats:** Una vez que WhatsApp está conectado, el admin usa los nuevos endpoints de permisos para asignar chats específicos a cada empleado.
5.  **Login del Empleado:** El empleado inicia sesión con sus credenciales.
6.  **Acceso Limitado:** El empleado ahora puede usar la API y los sockets, pero **solo verá y podrá interactuar con los chats que el admin le asignó**.

### Guía de Integración para el Frontend (¡Importante!)

Para que tu aplicación frontend funcione con este nuevo sistema, necesitas implementar los siguientes cambios:

#### 1. Inicialización Manual de WhatsApp (Solo Admin)

La conexión con WhatsApp ya no es automática. El administrador, después de iniciar sesión, debe hacer clic en un botón "Conectar WhatsApp" que realice la siguiente llamada:

```bash
POST /api/whatsapp/init
Authorization: Bearer <ADMIN_JWT_TOKEN>
```

Solo después de esta llamada, el servidor empezará el proceso y emitirá el evento `qr` por el socket.

#### 2. Autenticación del Cliente de Socket.IO

El cliente de Socket.IO **debe** enviar el token JWT al conectarse. Esto es crucial para que el servidor sepa qué usuario es y a qué salas de notificación debe unirlo.

**Ejemplo en JavaScript (Cliente):**

```javascript
import { io } from "socket.io-client";

const jwtToken = "tu_token_jwt_aqui"; // El token obtenido del login

const socket = io("http://localhost:3000", {
  auth: {
    token: jwtToken
  }
});

socket.on('connect', () => {
  console.log('Conectado y autenticado al servidor de sockets!');
});

// ... tus otros listeners
```

#### 3. Vista Filtrada para Empleados

No necesitas implementar lógica de filtrado en el frontend. El backend se encarga de todo.
- Un **admin** que llame a `GET /api/chats` recibirá todos los chats.
- Un **empleado** que llame al mismo endpoint `GET /api/chats` recibirá **automáticamente** solo la lista de chats que tiene asignados.
- Lo mismo ocurre con los eventos de socket: un empleado solo recibirá notificaciones `message` de los chats permitidos.

### Nuevos Endpoints de API (`/api/permissions`)

Estos endpoints son **solo para administradores** y requieren un token JWT de admin.

#### Asignar un chat a un empleado

```bash
POST /api/permissions/assign
Authorization: Bearer <ADMIN_JWT_TOKEN>
Content-Type: application/json

{
  "employeeId": 123,  // ID del empleado
  "chatId": "5491122334455@c.us" // ID del chat de WhatsApp
}
```

#### Revocar un chat a un empleado

```bash
POST /api/permissions/revoke
Authorization: Bearer <ADMIN_JWT_TOKEN>
Content-Type: application/json

{
  "employeeId": 123,
  "chatId": "5491122334455@c.us"
}
```

#### Listar chats de un empleado

```bash
GET /api/permissions/employee/123
Authorization: Bearer <ADMIN_JWT_TOKEN>
```

---

## 📋 API Endpoints (Referencia General)

### Autenticación (`/api/auth`)
- `POST /register`: Registrar un nuevo **Administrador**.
- `POST /login`: Iniciar sesión (para Admins y Empleados).
- `POST /create-station`: (Admin) Crear una nueva cuenta de **Empleado**.
- `GET /employees`: (Admin) Listar todos los empleados creados por el admin.
- `GET /qr`: Obtener el código QR actual para vincular WhatsApp (después de llamar a `/init`).
- `GET /status`: Estado de la conexión de WhatsApp.

### Chats (`/api/chats`)
- `GET /`: Obtener la lista de chats (filtrada automáticamente para empleados).
- `GET /:chatId/messages`: Obtener mensajes de un chat (restringido para empleados).
- `POST /:chatId/messages`: Enviar un mensaje a un chat (restringido para empleados).

### Media (`/api/media`)
- `GET /:messageId`: Descargar un archivo multimedia de un mensaje.

### WhatsApp (`/api/whatsapp`)
- `POST /init`: (Admin) Iniciar la conexión con WhatsApp y generar el QR.

---

## 🔌 Socket.IO Events

### Servidor → Cliente
- `qr`: Envía el QR generado para escanear.
- `ready`: Notifica que WhatsApp está conectado.
- `message`: Envía un nuevo mensaje entrante (solo a usuarios autorizados).
- `chats-updated`: Notifica que la lista de chats ha cambiado.
- `disconnected`: Notifica que la sesión de WhatsApp se ha desconectado.

### Cliente → Servidor
- `join`: (Opcional) Unirse a una sala de chat específica para notificaciones.
- `request-chats`: Pide al servidor que reenvíe la lista de chats actualizada.

---

## 🛠️ Instalación

```bash
npm install
```

## 🚀 Uso

### Desarrollo
```bash
npm run dev
```

### Producción
```bash
npm start
```
