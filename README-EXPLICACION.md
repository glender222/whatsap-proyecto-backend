# Informe Técnico del Proyecto: WhatsApp API Gateway Multi-Tenant

### **1. Resumen Ejecutivo**

El proyecto es una pasarela de API de WhatsApp robusta y escalable, diseñada bajo una arquitectura **multi-tenant**. Su objetivo principal es permitir que múltiples clientes (tenants), identificados como `ADMIN`, gestionen sus propias sesiones de WhatsApp de forma simultánea y aislada a través de una API RESTful y WebSockets. El sistema está preparado para alta disponibilidad y escalabilidad horizontal gracias a su gestión de estado distribuido mediante Redis.

### **2. Arquitectura General y Componentes Clave**

La aplicación sigue un diseño modular y bien estructurado, separando las responsabilidades en capas bien definidas:

*   **Punto de Entrada (`src/app.js`):** Orquesta la inicialización de la aplicación, configurando middlewares, rutas, Sockets y la conexión a la base de datos y Redis.
*   **Servidor API (Express.js):** Proporciona los endpoints RESTful para la gestión de la aplicación (autenticación, sesiones de WhatsApp, chats, permisos, etc.).
*   **Comunicación en Tiempo Real (Socket.IO):** Gestiona la comunicación bidireccional para eventos de WhatsApp (ej. recepción de mensajes, cambios de estado de la sesión, entrega del código QR).
*   **Capa de Servicios:** Contiene la lógica de negocio principal.
    *   **`SessionManager`**: Es el **corazón de la arquitectura multi-tenant**. Mantiene un mapa de sesiones de WhatsApp activas, asociando una instancia de `WhatsAppClient` a cada `adminId`.
    *   **`StateManager`**: Gestiona el estado distribuido utilizando **Redis**. Su función más crítica es el sistema de **bloqueo distribuido (distributed lock)**, que garantiza que solo una instancia de la aplicación controle una sesión de WhatsApp a la vez.
    *   **`WhatsAppClient`**: Es un wrapper sobre la librería `whatsapp-web.js` que encapsula toda la lógica de interacción con una única sesión de WhatsApp (enviar mensajes, recibir eventos, etc.).
*   **Capa de Controladores:** Maneja las solicitudes HTTP, extrae datos de la petición y utiliza los servicios para ejecutar las acciones.
*   **Capa de Rutas:** Define los endpoints de la API y les asocia los middlewares y controladores correspondientes.
*   **Capa de Middleware:** Contiene funciones que procesan las solicitudes antes de que lleguen a los controladores.
    *   **`authMiddleware`**: Valida los tokens JWT y adjunta la información del usuario (`payload`) a la petición.
    *   **`injectWhatsAppClient`** (en `sessionUtils.js`): Middleware crucial que obtiene la sesión de WhatsApp del tenant correspondiente del `SessionManager` y la inyecta en el objeto `req`, facilitando su acceso en los controladores.

### **3. Modelo Multi-Tenant: Aislamiento y Funcionamiento**

El multi-tenancy está implementado de forma efectiva, garantizando que los datos y las operaciones de un tenant estén completamente aislados de los demás. El flujo es el siguiente:

1.  **Autenticación:** Un usuario (ADMIN o EMPLEADO) se autentica y recibe un **token JWT**. Este token contiene información clave: `userId`, `rol`, y, para los empleados, el `adminId` de su tenant.
2.  **Identificación del Tenant:** En cada solicitud a un endpoint protegido, el middleware `validateJWT` decodifica el token. El `adminId` se obtiene directamente (si el rol es EMPLEADO) o se asume que `userId` es el `adminId` (si el rol es ADMIN).
3.  **Aislamiento de Sesión:** El `SessionManager` utiliza este `adminId` como clave única para almacenar y recuperar la instancia específica del `WhatsAppClient` del tenant. Esto asegura que las operaciones (ej. enviar un mensaje) se ejecuten en la sesión de WhatsApp correcta.
4.  **Aislamiento de Datos (Base de Datos):** La lógica en los controladores (ej. `chatController`) y modelos (`ChatPermission`) asegura que las consultas a la base de datos (PostgreSQL) también estén segmentadas por tenant. Un empleado solo puede acceder a los chats para los que su ADMIN le ha concedido permisos explícitos.

### **4. Gestión de Estado y Escalabilidad: El Rol de Redis**

Una de las características más potentes y bien implementadas del proyecto es su capacidad para escalar horizontalmente (ejecutar múltiples instancias de la aplicación en paralelo). Esto es posible gracias a Redis:

*   **Bloqueo Distribuido (Distributed Lock):** Cuando un `ADMIN` inicia una sesión (`/api/whatsapp/init`), la aplicación adquiere un **lock en Redis** asociado a ese `adminId`.
*   **Prevención de "Split-Brain":** Este lock garantiza que solo **una instancia de la aplicación** pueda ser la "trabajadora activa" para esa sesión de WhatsApp. Si otra instancia intenta inicializar la misma sesión, Redis se lo impedirá. Esto es vital para evitar que dos servidores intenten conectarse a la misma cuenta de WhatsApp, lo cual corrompería la sesión.
*   **Alta Disponibilidad:** Las otras instancias de la aplicación actúan como "standby". Si la instancia activa se cae, el lock en Redis eventually expirará, permitiendo que otra instancia tome el control, reinicie la sesión y se convierta en la nueva trabajadora activa.

### **5. Flujo de una Petición Típica (Ej: Enviar un Mensaje)**

1.  Un usuario envía una petición `POST /api/chats/{chatId}/messages` con su token JWT en la cabecera `Authorization`.
2.  La ruta (`chatRoutes.js`) recibe la petición.
3.  El middleware `validateJWT` se ejecuta: valida el token y adjunta el `payload` (con `userId`, `rol`, `adminId`) a `req.user`.
4.  El middleware `injectWhatsAppClient` se ejecuta:
    *   Obtiene el `adminId` del tenant a partir de `req.user`.
    *   Llama a `sessionManager.getSession(adminId)`.
    *   Si la sesión existe, la adjunta a `req.whatsappClient`.
    *   Si no existe, devuelve un error 503 (Servicio no disponible), impidiendo que la petición continúe.
5.  El controlador `chatController.sendMessage` se ejecuta:
    *   Verifica los permisos del usuario si su rol es `EMPLEADO` consultando la base de datos.
    *   Utiliza el cliente inyectado (`req.whatsappClient`) para llamar a la función que envía el mensaje.
6.  El `WhatsAppClient` procesa la petición y la envía a través de la librería `whatsapp-web.js`.
7.  El controlador devuelve la respuesta al usuario.

### **6. Fortalezas del Proyecto**

*   **Arquitectura Sólida y Escalable:** El diseño multi-tenant y la gestión de estado distribuido son de nivel profesional y permiten un crecimiento futuro.
*   **Aislamiento de Tenants:** La separación de sesiones y datos es clara y robusta, minimizando riesgos de seguridad.
*   **Código Modular y Organizado:** La separación de responsabilidades facilita el mantenimiento y la adición de nuevas funcionalidades.
*   **Sistema de Permisos Granular:** La capacidad de los ADMINS para asignar chats específicos a sus empleados es una funcionalidad avanzada y valiosa.
*   **Buena Documentación de API (Swagger):** La integración con `swagger-jsdoc` facilita la comprensión y el uso de la API.

### **7. Posibles Puntos de Mejora (Teóricos)**

Aunque la arquitectura es excelente, se podrían considerar las siguientes mejoras a futuro, sin necesidad de tocar el código actual:

*   **Centralización de la Lógica de Tenant ID:** Crear una función de utilidad `getTenantId(req)` que determine el ID del tenant a partir del objeto `req.user` podría reducir duplicaciones y hacer el código más limpio.
*   **Mejorar la Observabilidad:** Integrar un sistema de logging estructurado (como Winston o Pino) y un sistema de monitoreo (como Prometheus/Grafana) permitiría tener una visión más clara del estado de las sesiones, el rendimiento de la API y la detección temprana de errores.
*   **Webhooks para Eventos:** En lugar de depender únicamente de Socket.IO, se podría implementar un sistema de webhooks. Esto permitiría a los tenants integrar la pasarela con sus propios sistemas de backend de forma más sencilla.
*   **Pruebas Unitarias y de Integración:** La estructura del proyecto es idónea para añadir una suite de pruebas más completa (usando Jest, como ya está configurado) para validar la lógica de negocio, los controladores y los servicios, garantizando la estabilidad del código a largo plazo.
