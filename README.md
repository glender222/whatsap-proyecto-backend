# 💬 WhatsApp Web API (Multi-Tenant)

Una API REST moderna y multi-tenant para gestionar múltiples sesiones de WhatsApp Web de forma simultánea y aislada, con Socket.IO para comunicación en tiempo real.
🟩 **Node.js + Express + PostgreSQL + Redis**

## 🚀 Características Principales

- ✅ **Arquitectura Multi-Tenant:** Permite que múltiples administradores se registren y conecten sus propias cuentas de WhatsApp de forma independiente.
- ✅ **Aislamiento de Datos:** Garantiza que los datos de un administrador (chats, empleados, permisos) nunca sean visibles para otro.
- ✅ **Sistema de Permisos Robusto:** Cada administrador puede asignar chats específicos a sus propios empleados.
- ✅ **API REST Semántica y Segura:** Endpoints claros con autenticación JWT y roles (Admin/Empleado).
- ✅ **Alta Disponibilidad:** Diseñada para entornos de producción, utilizando Redis para gestionar el estado y permitir la escalabilidad horizontal.

---

## 🛠️ Entorno de Desarrollo

### Prerrequisitos
- **Node.js** (v18 o superior)
- **Docker** (para levantar Redis y PostgreSQL fácilmente)
- **Git**

### Instalación
1. Clona el repositorio:
   ```bash
   git clone <URL_DEL_REPOSITORIO>
   cd <NOMBRE_DEL_REPOSITORIO>
   ```
2. Instala las dependencias:
   ```bash
   npm install
   ```
3. Crea un archivo `.env` en la raíz del proyecto y configúralo con las credenciales para PostgreSQL y Redis.

### Uso en Desarrollo
1. **Levantar Servicios Externos (Redis y PostgreSQL):**
   Abre una terminal y ejecuta Docker para iniciar Redis:
   ```bash
   docker run -d --name mi-redis -p 6379:6379 redis
   ```
   (Asegúrate de tener también una instancia de PostgreSQL corriendo).

2. **Iniciar la Aplicación:**
   En la terminal de tu proyecto, ejecuta:
   ```bash
   npm run dev
   ```
   El servidor se iniciará en `http://localhost:3000`.

---

## 🧪 Guía de Pruebas y Flujo de Trabajo Local

Una vez que el backend está corriendo, puedes probar toda la funcionalidad multi-tenant usando la documentación de Swagger.

**Abre Swagger en tu navegador:** `http://localhost:3000/api/docs`

### Flujo 1: Probar como Administrador A

1.  **Registro y Login:**
    *   Usa `POST /auth/register` para crear un "Admin A".
    *   Usa `POST /auth/login` con las credenciales del Admin A para obtener su `accessToken`.
    *   **Autoriza** Swagger haciendo clic en el botón "Authorize" y pegando el token.

2.  **Preparar Cliente de Sockets:**
    *   Crea un archivo local `test-client.html` (código más abajo) y pega el `accessToken` del Admin A.
    *   Abre este archivo en tu navegador. Verás "Esperando código QR...".

3.  **Iniciar Sesión de WhatsApp:**
    *   En Swagger, ejecuta `POST /whatsapp/init`.
    *   El código QR aparecerá en `test-client.html`. Escanéalo con el teléfono del Admin A.
    *   La página web confirmará la conexión.

4.  **Gestionar Chats y Permisos:**
    *   Ejecuta `GET /chats` en Swagger. Verás la lista de chats del Admin A.
    *   Usa `POST /auth/create-station` para crear un "Empleado 1" para A.
    *   Usa `POST /permissions/assign` para dar al Empleado 1 acceso a un chat específico.

### Flujo 2: Probar Aislamiento con Administrador B

1.  **Registro y Login:**
    *   Usa `POST /auth/register` para crear un "Admin B".
    *   Usa `POST /auth/login` para obtener el `accessToken` de B.
    *   **Vuelve a Autorizar** Swagger con el nuevo token de B.

2.  **Preparar OTRO Cliente de Sockets:**
    *   Abre `test-client.html` en una **nueva ventana de navegador (o modo incógnito)**.
    *   Pega el `accessToken` del **Admin B**.

3.  **Iniciar Sesión de WhatsApp para B:**
    *   En Swagger (autorizado como B), ejecuta `POST /whatsapp/init`.
    *   El nuevo QR aparecerá en la segunda ventana del navegador. Escanéalo con un **teléfono diferente**.

4.  **Verificar Aislamiento:**
    *   Ejecuta `GET /chats` en Swagger. Verás la lista de chats del **Admin B**, y no la de A. El sistema está funcionando de forma aislada.

### Código para `test-client.html`

```html
<!DOCTYPE html>
<html>
<head><title>Cliente de Test Socket.IO</title></head>
<body>
  <h1>Receptor de Código QR</h1>
  <div id="qr-container"></div>
  <script src="https://cdn.socket.io/4.7.5/socket.io.min.js"></script>
  <script>
    const jwtToken = "PEGA_AQUÍ_TU_ACCESS_TOKEN";

    const socket = io("http://localhost:3000", { auth: { token: jwtToken } });

    socket.on('connect', () => {
      document.getElementById('qr-container').innerHTML = '<p>Conectado y autenticado. Esperando QR...</p>';
    });

    socket.on('qr', (qrDataUrl) => {
      document.getElementById('qr-container').innerHTML = `<p>Escanea este código:</p><img src="${qrDataUrl}" alt="Código QR">`;
    });

    socket.on('session_status', (data) => {
       if(data.status === 'connected') {
        document.getElementById('qr-container').innerHTML = '<h2>¡WhatsApp Conectado!</h2>';
       }
    });
  </script>
</body>
</html>
```

---

## 📦 Despliegue en Producción (Alta Disponibilidad)

Para desplegar esta aplicación en un entorno escalable (Kubernetes, Docker Swarm), es crucial manejar el estado.

### 1. Requisito de Redis
**Redis es obligatorio.** Se usa para gestionar un "lock" distribuido por cada tenant, asegurando que solo una instancia de la API maneje una sesión de WhatsApp a la vez.
- **Variables de Entorno:** `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD`.

### 2. Volúmenes Persistentes
La carpeta `.wwebjs_auth/` debe montarse en un volumen persistente para que las sesiones de WhatsApp sobrevivan a reinicios. La aplicación creará subcarpetas (`session-<adminId>`) dentro de este volumen.

---
## 📋 API Endpoints (Referencia General)
*Consulta la documentación interactiva en `/api/docs` para detalles completos.*

- **Autenticación (`/api/auth`):** `register`, `login`, `create-station`, `employees`.
- **Gestión de Sesión (`/api/whatsapp`):** `init`, `logout`.
- **Permisos (`/api/permissions`):** `assign`, `revoke`.
- **Chats (`/api/chats`):** `GET /`, `GET /:chatId/messages`, `POST /:chatId/messages`.
- **Media (`/api/media`):** `GET /:messageId`, `GET /profile-photo/:chatId`.
