/**
 * Utilidades comunes para el proyecto de chat
 */

/**
 * Valida si un string es un nombre de usuario válido
 */
export function isValidUsername(username) {
    if (!username || typeof username !== 'string') {
        return false;
    }

    const trimmed = username.trim();
    return trimmed.length >= 2 && trimmed.length <= 20 && /^[a-zA-Z0-9_\-\s]+$/.test(trimmed);
}

/**
 * Valida si un string es un nombre de sala válido
 */
export function isValidRoomName(roomName) {
    if (!roomName || typeof roomName !== 'string') {
        return false;
    }

    const trimmed = roomName.trim();
    return trimmed.length >= 2 && trimmed.length <= 30 && /^[a-zA-Z0-9_\-\s]+$/.test(trimmed);
}

/**
 * Sanitiza texto para prevenir inyección de código
 */
export function sanitizeText(text) {
    if (!text || typeof text !== 'string') {
        return '';
    }

    return text
        .trim()
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/<[^>]*>/g, '')
        .replace(/javascript:/gi, '')
        .replace(/on\w+\s*=/gi, '');
}

/**
 * Formatea un timestamp para mostrar
 */
export function formatTimestamp(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) {
        return 'ahora';
    } else if (diffMins < 60) {
        return `hace ${diffMins}m`;
    } else if (diffHours < 24) {
        return `hace ${diffHours}h`;
    } else if (diffDays < 7) {
        return `hace ${diffDays}d`;
    } else {
        return date.toLocaleDateString();
    }
}

/**
 * Genera un color aleatorio en formato hexadecimal
 */
export function generateRandomColor() {
    const colors = [
        '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
        '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9',
        '#82E0AA', '#F8C471', '#EC7063', '#5DADE2', '#58D68D'
    ];
    return colors[Math.floor(Math.random() * colors.length)];
}

/**
 * Genera un emoji aleatorio para avatar
 */
export function generateRandomEmoji() {
    const emojis = [
        '😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '😊', '😇',
        '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘', '😗', '😙', '😚',
        '😋', '😛', '😝', '😜', '🤪', '🤨', '🧐', '🤓', '😎', '🤩',
        '🥳', '😏', '😒', '😞', '😔', '😟', '😕', '🙁', '☹️', '😣',
        '🤔', '🤭', '🤫', '🤐', '🤨', '😐', '😑', '😶', '😏', '😒',
        '🙄', '😬', '🤥', '😌', '😔', '😪', '🤤', '😴', '😷', '🤒'
    ];
    return emojis[Math.floor(Math.random() * emojis.length)];
}

/**
 * Valida si un mensaje es un comando válido
 */
export function isCommand(message) {
    return typeof message === 'string' && message.trim().startsWith('/');
}

/**
 * Parsea un comando y devuelve el comando y argumentos
 */
export function parseCommand(message) {
    if (!isCommand(message)) {
        return null;
    }

    const parts = message.trim().split(' ');
    const command = parts[0].toLowerCase();
    const args = parts.slice(1);

    return { command, args };
}

/**
 * Limita la longitud de un string
 */
export function truncateString(str, maxLength) {
    if (!str || typeof str !== 'string') {
        return '';
    }

    if (str.length <= maxLength) {
        return str;
    }

    return str.substring(0, maxLength - 3) + '...';
}

/**
 * Convierte un string a formato slug (URL-friendly)
 */
export function slugify(text) {
    return text
        .toString()
        .toLowerCase()
        .trim()
        .replace(/\s+/g, '-')
        .replace(/[^\w\-]+/g, '')
        .replace(/\-\-+/g, '-')
        .replace(/^-+/, '')
        .replace(/-+$/, '');
}

/**
 * Valida si un email es válido
 */
export function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

/**
 * Genera un ID único simple
 */
export function generateSimpleId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

/**
 * Debounce function para limitar la frecuencia de ejecución
 */
export function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

/**
 * Throttle function para limitar la frecuencia de ejecución
 */
export function throttle(func, limit) {
    let inThrottle;
    return function () {
        const args = arguments;
        const context = this;
        if (!inThrottle) {
            func.apply(context, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

/**
 * Convierte bytes a formato legible
 */
export function formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];

    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

/**
 * Valida si una URL es válida
 */
export function isValidUrl(string) {
    try {
        new URL(string);
        return true;
    } catch (_) {
        return false;
    }
}

/**
 * Extrae URLs de un texto
 */
export function extractUrls(text) {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    return text.match(urlRegex) || [];
}

/**
 * Escapa caracteres especiales para regex
 */
export function escapeRegex(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Calcula la diferencia entre dos fechas en formato legible
 */
export function getTimeDifference(date1, date2) {
    const diffMs = Math.abs(date2 - date1);
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const diffHours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    const diffSeconds = Math.floor((diffMs % (1000 * 60)) / 1000);

    if (diffDays > 0) {
        return `${diffDays}d ${diffHours}h`;
    } else if (diffHours > 0) {
        return `${diffHours}h ${diffMinutes}m`;
    } else if (diffMinutes > 0) {
        return `${diffMinutes}m ${diffSeconds}s`;
    } else {
        return `${diffSeconds}s`;
    }
}

/**
 * Genera un hash simple de un string
 */
export function simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash);
}

/**
 * Verifica si un objeto está vacío
 */
export function isEmpty(obj) {
    return Object.keys(obj).length === 0 && obj.constructor === Object;
}

/**
 * Clona profundamente un objeto
 */
export function deepClone(obj) {
    if (obj === null || typeof obj !== 'object') {
        return obj;
    }

    if (obj instanceof Date) {
        return new Date(obj.getTime());
    }

    if (obj instanceof Array) {
        return obj.map(item => deepClone(item));
    }

    if (typeof obj === 'object') {
        const clonedObj = {};
        for (const key in obj) {
            if (obj.hasOwnProperty(key)) {
                clonedObj[key] = deepClone(obj[key]);
            }
        }
        return clonedObj;
    }
}

/**
 * Mezcla arrays de forma aleatoria
 */
export function shuffleArray(array) {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}

/**
 * Obtiene un elemento aleatorio de un array
 */
export function getRandomElement(array) {
    return array[Math.floor(Math.random() * array.length)];
}

/**
 * Capitaliza la primera letra de un string
 */
export function capitalize(str) {
    if (!str || typeof str !== 'string') {
        return '';
    }
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

/**
 * Convierte camelCase a snake_case
 */
export function camelToSnake(str) {
    return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
}

/**
 * Convierte snake_case a camelCase
 */
export function snakeToCamel(str) {
    return str.replace(/_([a-z])/g, (match, letter) => letter.toUpperCase());
} 