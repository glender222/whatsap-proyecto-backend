const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'WhatsApp Empresas API',
      version: '1.0.0',
      description: 'API de autenticación y gestión de WhatsApp para empresas',
      contact: {
        name: 'API Support',
        url: 'http://localhost:3000'
      }
    },
    servers: [
      {
        url: 'http://localhost:3000/api',
        description: 'API de desarrollo'
      }
    ],
    components: {
      securitySchemes: {
        BearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'JWT Access Token'
        }
      },
      schemas: {
        User: {
          type: 'object',
          properties: {
            id: {
              type: 'integer',
              example: 1
            },
            nombre: {
              type: 'string',
              example: 'Juan Pérez'
            },
            email: {
              type: 'string',
              example: 'juan@empresa.com'
            },
              whatsappNumber: {
                type: 'string',
                nullable: true,
                description: 'Número de teléfono asociado a la sesión de WhatsApp (sin sufijo @c.us).',
                example: '5491122334455'
              },
            rol: {
              type: 'string',
              enum: ['ADMIN', 'EMPLEADO'],
              example: 'ADMIN'
            },
            id_padre: {
              type: 'integer',
              nullable: true,
              example: null
            },
            activo: {
              type: 'boolean',
              example: true
            },
            fecha_creacion: {
              type: 'string',
              format: 'date-time',
              example: '2024-10-17T00:23:52.000Z'
            }
          }
        },
        AuthResponse: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: true
            },
            message: {
              type: 'string',
              example: 'Login exitoso'
            },
            data: {
              type: 'object',
              properties: {
                user: {
                  $ref: '#/components/schemas/User'
                },
                accessToken: {
                  type: 'string',
                  example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
                },
                refreshToken: {
                  type: 'string',
                  example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
                }
              }
            }
          }
        },
        StationResponse: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: true
            },
            message: {
              type: 'string',
              example: 'Estación de trabajo creada exitosamente'
            },
            data: {
              type: 'object',
              properties: {
                employee: {
                  $ref: '#/components/schemas/User'
                },
                tempPassword: {
                  type: 'string',
                  example: 'aBc123!@#Xyz'
                }
              }
            }
          }
        },
        ErrorResponse: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: false
            },
            error: {
              type: 'string',
              example: 'Error message'
            },
            details: {
              type: 'string',
              example: 'Additional error details'
            }
          }
        },
        Tag: {
          type: 'object',
          properties: {
            id: {
              type: 'integer',
              example: 1
            },
            name: {
              type: 'string',
              example: 'Clientes VIP'
            },
            color: {
              type: 'string',
              example: '#3B82F6'
            },
            owner_id: {
              type: 'integer',
              example: 1
            },
            is_default: {
              type: 'boolean',
              example: false
            },
            created_at: {
              type: 'string',
              format: 'date-time',
              example: '2024-10-17T00:23:52.000Z'
            },
            updated_at: {
              type: 'string',
              format: 'date-time',
              example: '2024-10-17T00:23:52.000Z'
            }
          }
        },
        TagResponse: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: true
            },
            message: {
              type: 'string',
              example: 'Etiqueta creada exitosamente'
            },
            data: {
              $ref: '#/components/schemas/Tag'
            }
          }
        },
        TagListResponse: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: true
            },
            data: {
              type: 'array',
              items: {
                $ref: '#/components/schemas/Tag'
              }
            }
          }
        },
        TagStatsResponse: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: true
            },
            data: {
              type: 'object',
              properties: {
                chatCount: {
                  type: 'integer',
                  example: 25
                },
                userCount: {
                  type: 'integer',
                  example: 3
                }
              }
            }
          }
        }
      }
    },
    tags: [
      {
        name: 'Auth',
        description: 'Autenticación y gestión de usuarios'
      },
      {
        name: 'WhatsApp',
        description: 'Gestión de sesiones de WhatsApp'
      },
      {
        name: 'Chats',
        description: 'Gestión de chats y mensajes'
      },
      {
        name: 'Media',
        description: 'Gestión de archivos multimedia'
      },
      {
        name: 'Permissions',
        description: 'Gestión de permisos de chat'
      },
      {
        name: 'Tags',
        description: 'Gestión de etiquetas para organización de chats'
      }
    ]
  },
  apis: [
    './src/routes/authRoutes.js',
    './src/routes/permissionRoutes.js',
    './src/routes/whatsappRoutes.js',
    './src/routes/chatRoutes.js',
    './src/routes/mediaRoutes.js',
    './src/routes/tagRoutes.js'
  ]
};

const swaggerSpec = swaggerJsdoc(options);

module.exports = swaggerSpec;