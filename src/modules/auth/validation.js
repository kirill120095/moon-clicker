// ============================================================
//  ДОПОЛНИТЕЛЬНАЯ ВАЛИДАЦИЯ ДЛЯ АВТОРИЗАЦИИ
// ============================================================
import { validators } from '../../utils/validation.js';

// ============================================================
//  СПЕЦИАЛЬНЫЕ ВАЛИДАТОРЫ ДЛЯ АВТОРИЗАЦИИ
// ============================================================
export const authValidators = {
    // ============================================================
    //  EMAIL С ДОПОЛНИТЕЛЬНЫМИ ПРОВЕРКАМИ
    // ============================================================
    email(value) {
        const result = validators.email(value);
        if (!result.valid) return result;
        
        // Проверка на временные email
        const tempEmailDomains = [
            'tempmail', '10minutemail', 'guerrillamail',
            'mailinator', 'throwaway', 'spamgourmet'
        ];
        
        const domain = result.value.split('@')[1].toLowerCase();
        if (tempEmailDomains.some(d => domain.includes(d))) {
            return { 
                valid: false, 
                error: 'Используйте постоянный email' 
            };
        }
        
        return result;
    },

    // ============================================================
    //  ПАРОЛЬ С ДОПОЛНИТЕЛЬНЫМИ ПРОВЕРКАМИ
    // ============================================================
    password(value, minLength = 6) {
        const result = validators.password(value, minLength);
        if (!result.valid) return result;
        
        // Проверка на простые пароли
        const commonPasswords = [
            'password', '123456', 'qwerty', 'admin',
            'letmein', 'welcome', 'monkey', 'dragon'
        ];
        
        if (commonPasswords.includes(result.value.toLowerCase())) {
            return { 
                valid: false, 
                error: 'Слишком простой пароль' 
            };
        }
        
        return result;
    },

    // ============================================================
    //  NICKNAME С ДОПОЛНИТЕЛЬНЫМИ ПРОВЕРКАМИ
    // ============================================================
    nickname(value) {
        const result = validators.nickname(value);
        if (!result.valid) return result;
        
        // Проверка на запрещенные слова
        const forbiddenWords = ['admin', 'root', 'moderator', 'support'];
        if (forbiddenWords.includes(result.value.toLowerCase())) {
            return { 
                valid: false, 
                error: 'Это имя недоступно' 
            };
        }
        
        return result;
    },

    // ============================================================
    //  ПРОВЕРКА ПОЧТЫ ПРИ ВХОДЕ
    // ============================================================
    loginIdentifier(value) {
        if (!value || typeof value !== 'string') {
            return { valid: false, error: 'Обязательное поле' };
        }
        
        const trimmed = value.trim();
        if (!trimmed) {
            return { valid: false, error: 'Поле не может быть пустым' };
        }
        
        // Проверяем, что это email или nickname
        if (trimmed.includes('@')) {
            return validators.email(trimmed);
        } else {
            return validators.nickname(trimmed);
        }
    }
};

// ============================================================
//  СХЕМЫ ДЛЯ АВТОРИЗАЦИИ
// ============================================================
export const authSchemas = {
    login: {
        identifier: [authValidators.loginIdentifier],
        password: [authValidators.password]
    },
    
    register: {
        email: [authValidators.email],
        nickname: [authValidators.nickname],
        password: [(v) => authValidators.password(v, 6)]
    },
    
    updateProfile: {
        username: [validators.nickname],
        email: [validators.email]
    }
};

// ============================================================
//  ХЕЛПЕРЫ
// ============================================================
export function isEmail(value) {
    return value && value.includes('@');
}

export function getEmailFromIdentifier(identifier) {
    if (isEmail(identifier)) {
        return identifier;
    }
    // Если это nickname, нам нужно найти email в БД
    // Эта логика должна быть на сервере
    return null;
}
