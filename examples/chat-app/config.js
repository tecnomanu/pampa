/**
 * Configuración centralizada para el proyecto de chat PAMPA
 */

export const config = {
    // Configuración del servidor
    server: {
        port: process.env.PORT || 3000,
        host: process.env.HOST || 'localhost',
        environment: process.env.NODE_ENV || 'development',

        // Configuración de Fastify
        fastify: {
            logger: process.env.NODE_ENV !== 'production',
            connectionTimeout: 60000,
            keepAliveTimeout: 30000,
            bodyLimit: 1048576, // 1MB
            maxParamLength: 100
        }
    },

    // Configuración de WebSocket
    websocket: {
        pingInterval: 30000, // 30 segundos
        connectionTimeout: 60000, // 1 minuto
        maxConnections: 1000,
        compression: true
    },

    // Configuración de chat
    chat: {
        // Límites de mensajes
        message: {
            maxLength: 1000,
            minLength: 1,
            historyLimit: 50,
            maxHistoryPerRoom: 1000
        },

        // Límites de usuarios
        user: {
            usernameMinLength: 2,
            usernameMaxLength: 20,
            maxUsersPerRoom: 100,
            inactivityTimeout: 300000 // 5 minutos
        },

        // Límites de salas
        room: {
            nameMinLength: 2,
            nameMaxLength: 30,
            descriptionMaxLength: 200,
            maxRooms: 50,
            defaultMaxUsers: 20
        },

        // Configuración de comandos
        commands: {
            enabled: true,
            prefix: '/',
            cooldown: 1000, // 1 segundo entre comandos
            maxArgsLength: 100
        },

        // Configuración de emojis y reacciones
        emojis: {
            enabled: true,
            maxReactionsPerMessage: 10,
            maxReactionsPerUser: 5
        }
    },

    // Configuración de seguridad
    security: {
        // Rate limiting
        rateLimit: {
            messagesPerMinute: 30,
            commandsPerMinute: 10,
            connectionsPerIP: 5
        },

        // Filtros de contenido
        content: {
            enableProfanityFilter: false,
            enableSpamDetection: true,
            maxRepeatedChars: 5,
            maxCapsPercentage: 70
        },

        // Validación
        validation: {
            strictMode: false,
            allowSpecialChars: true,
            allowEmojis: true
        }
    },

    // Configuración de logging
    logging: {
        level: process.env.LOG_LEVEL || 'info',
        enableFileLogging: false,
        logDirectory: './logs',
        maxLogFiles: 10,
        maxLogSize: '10MB'
    },

    // Configuración de base de datos (para futuras extensiones)
    database: {
        enabled: false,
        type: 'memory', // 'memory', 'sqlite', 'mongodb', 'postgresql'
        connectionString: process.env.DATABASE_URL || '',
        options: {
            maxConnections: 10,
            connectionTimeout: 30000
        }
    },

    // Configuración de cache
    cache: {
        enabled: true,
        type: 'memory', // 'memory', 'redis'
        ttl: 3600, // 1 hora
        maxSize: 1000
    },

    // Configuración de archivos estáticos
    static: {
        enabled: true,
        directory: './public',
        maxAge: 86400, // 1 día
        compression: true
    },

    // Configuración de CORS
    cors: {
        enabled: true,
        origin: process.env.CORS_ORIGIN || '*',
        methods: ['GET', 'POST', 'PUT', 'DELETE'],
        allowedHeaders: ['Content-Type', 'Authorization']
    },

    // Configuración de SSL/TLS
    ssl: {
        enabled: process.env.SSL_ENABLED === 'true',
        keyPath: process.env.SSL_KEY_PATH || '',
        certPath: process.env.SSL_CERT_PATH || '',
        caPath: process.env.SSL_CA_PATH || ''
    },

    // Configuración de monitoreo
    monitoring: {
        enabled: process.env.MONITORING_ENABLED === 'true',
        metricsInterval: 60000, // 1 minuto
        healthCheckPath: '/health',
        enablePerformanceMetrics: true
    },

    // Configuración de notificaciones
    notifications: {
        enabled: true,
        types: {
            userJoined: true,
            userLeft: true,
            roomCreated: true,
            systemMessages: true
        },
        sound: {
            enabled: false,
            volume: 0.5
        }
    },

    // Configuración de temas y UI
    ui: {
        theme: 'dark', // 'dark', 'light', 'auto'
        language: 'es', // 'es', 'en'
        animations: true,
        compactMode: false,
        showTimestamps: true,
        showAvatars: true
    },

    // Configuración de desarrollo
    development: {
        hotReload: process.env.NODE_ENV === 'development',
        debugMode: process.env.DEBUG === 'true',
        mockData: false,
        enableTestUsers: false
    },

    // URLs y endpoints
    api: {
        baseUrl: process.env.API_BASE_URL || '',
        version: 'v1',
        endpoints: {
            rooms: '/api/rooms',
            users: '/api/users',
            messages: '/api/messages',
            stats: '/api/stats'
        }
    },

    // Configuración de backup (para futuras extensiones)
    backup: {
        enabled: false,
        interval: 86400000, // 24 horas
        directory: './backups',
        maxBackups: 7,
        compression: true
    }
};

/**
 * Valida la configuración
 */
export function validateConfig() {
    const errors = [];

    // Validar configuración del servidor
    if (!config.server.port || config.server.port < 1 || config.server.port > 65535) {
        errors.push('Puerto del servidor inválido');
    }

    // Validar límites de chat
    if (config.chat.message.maxLength < config.chat.message.minLength) {
        errors.push('Límite máximo de mensaje debe ser mayor al mínimo');
    }

    if (config.chat.user.usernameMaxLength < config.chat.user.usernameMinLength) {
        errors.push('Límite máximo de username debe ser mayor al mínimo');
    }

    // Validar configuración de WebSocket
    if (config.websocket.pingInterval < 1000) {
        errors.push('Intervalo de ping debe ser al menos 1 segundo');
    }

    return {
        isValid: errors.length === 0,
        errors
    };
}

/**
 * Obtiene configuración específica por entorno
 */
export function getEnvironmentConfig() {
    const env = config.server.environment;

    const envConfigs = {
        development: {
            logging: { level: 'debug' },
            security: { rateLimit: { messagesPerMinute: 100 } },
            development: { debugMode: true, hotReload: true }
        },

        production: {
            logging: { level: 'warn', enableFileLogging: true },
            security: { rateLimit: { messagesPerMinute: 20 } },
            development: { debugMode: false, hotReload: false },
            static: { maxAge: 604800 } // 1 semana
        },

        test: {
            logging: { level: 'error' },
            development: { mockData: true, enableTestUsers: true },
            database: { type: 'memory' }
        }
    };

    return envConfigs[env] || {};
}

/**
 * Combina configuración base con configuración de entorno
 */
export function getMergedConfig() {
    const envConfig = getEnvironmentConfig();
    return mergeDeep(config, envConfig);
}

/**
 * Función auxiliar para merge profundo de objetos
 */
function mergeDeep(target, source) {
    const output = Object.assign({}, target);

    if (isObject(target) && isObject(source)) {
        Object.keys(source).forEach(key => {
            if (isObject(source[key])) {
                if (!(key in target)) {
                    Object.assign(output, { [key]: source[key] });
                } else {
                    output[key] = mergeDeep(target[key], source[key]);
                }
            } else {
                Object.assign(output, { [key]: source[key] });
            }
        });
    }

    return output;
}

/**
 * Verifica si un valor es un objeto
 */
function isObject(item) {
    return item && typeof item === 'object' && !Array.isArray(item);
}

/**
 * Exporta configuración por defecto
 */
export default config; 