// ============================================================
//  ВАЛИДАЦИЯ ДАННЫХ + АВТОРИЗАЦИЯ
// ============================================================

export const validators = {
    email(value) {
        if (!value || typeof value !== 'string') {
            return { valid: false, error: 'Email обязателен' };
        }
        const trimmed = value.trim();
        if (!trimmed) {
            return { valid: false, error: 'Email не может быть пустым' };
        }
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(trimmed)) {
            return { valid: false, error: 'Некорректный email' };
        }
        return { valid: true, value: trimmed };
    },

    password(value, minLength = 6) {
        if (!value || typeof value !== 'string') {
            return { valid: false, error: 'Пароль обязателен' };
        }
        const trimmed = value.trim();
        if (!trimmed) {
            return { valid: false, error: 'Пароль не может быть пустым' };
        }
        if (trimmed.length < minLength) {
            return { valid: false, error: `Пароль должен содержать минимум ${minLength} символов` };
        }
        let strength = 0;
        if (/[a-z]/.test(trimmed)) strength++;
        if (/[A-Z]/.test(trimmed)) strength++;
        if (/[0-9]/.test(trimmed)) strength++;
        if (/[^a-zA-Z0-9]/.test(trimmed)) strength++;
        if (strength < 2) {
            return { valid: false, error: 'Пароль должен содержать буквы разного регистра, цифры или спецсимволы' };
        }
        return { valid: true, value: trimmed };
    },

    nickname(value) {
        if (!value || typeof value !== 'string') {
            return { valid: false, error: 'Логин обязателен' };
        }
        const trimmed = value.trim();
        if (!trimmed) {
            return { valid: false, error: 'Логин не может быть пустым' };
        }
        if (trimmed.length < 3) {
            return { valid: false, error: 'Логин должен содержать минимум 3 символа' };
        }
        if (trimmed.length > 30) {
            return { valid: false, error: 'Логин не должен превышать 30 символов' };
        }
        const validChars = /^[a-zA-Z0-9_\-]+$/;
        if (!validChars.test(trimmed)) {
            return { valid: false, error: 'Логин может содержать только буквы, цифры, _ и -' };
        }
        return { valid: true, value: trimmed };
    },

    number(value, options = {}) {
        const num = Number(value);
        if (isNaN(num)) {
            return { valid: false, error: 'Должно быть число' };
        }
        if (options.min !== undefined && num < options.min) {
            return { valid: false, error: `Минимальное значение: ${options.min}` };
        }
        if (options.max !== undefined && num > options.max) {
            return { valid: false, error: `Максимальное значение: ${options.max}` };
        }
        if (options.integer && !Number.isInteger(num)) {
            return { valid: false, error: 'Должно быть целое число' };
        }
        if (options.positive && num <= 0) {
            return { valid: false, error: 'Должно быть положительным' };
        }
        return { valid: true, value: num };
    },

    required(value) {
        if (value === undefined || value === null || value === '') {
            return { valid: false, error: 'Поле обязательно' };
        }
        return { valid: true, value };
    },

    maxLength(value, max) {
        if (value && value.length > max) {
            return { valid: false, error: `Максимальная длина: ${max} символов` };
        }
        return { valid: true, value };
    },

    minLength(value, min) {
        if (value && value.length < min) {
            return { valid: false, error: `Минимальная длина: ${min} символов` };
        }
        return { valid: true, value };
    },

    compose(...validatorsList) {
        return (value) => {
            let currentValue = value;
            for (const validator of validatorsList) {
                const result = validator(currentValue);
                if (!result.valid) {
                    return result;
                }
                currentValue = result.value;
            }
            return { valid: true, value: currentValue };
        };
    },

    level(value) {
        const result = this.number(value, { integer: true, positive: true, min: 1 });
        if (!result.valid) return result;
        if (result.value > 1000) {
            return { valid: false, error: 'Слишком высокий уровень' };
        }
        return result;
    },

    shards(value) {
        const result = this.number(value, { integer: true, min: 0 });
        if (!result.valid) return result;
        if (result.value > 999999999) {
            return { valid: false, error: 'Слишком много осколков' };
        }
        return result;
    },

    moonId(value) {
        if (!value || typeof value !== 'string') {
            return { valid: false, error: 'Неверный ID луны' };
        }
        const validMoons = ['normal', 'blood', 'ice', 'shadow', 'gold', 'fire', 'electric'];
        if (!validMoons.includes(value)) {
            return { valid: false, error: 'Неизвестный тип луны' };
        }
        return { valid: true, value };
    }
};

export function validateForm(data, schema) {
    const errors = {};
    const validData = {};
    for (const [key, validatorsList] of Object.entries(schema)) {
        const value = data[key];
        let result = { valid: true, value };
        for (const validator of validatorsList) {
            result = validator(value);
            if (!result.valid) {
                errors[key] = result.error;
                break;
            }
        }
        if (result.valid) {
            validData[key] = result.value;
        }
    }
    return {
        valid: Object.keys(errors).length === 0,
        errors,
        data: validData
    };
}

export const schemas = {
    login: {
        email: [validators.required, validators.email],
        password: [validators.required, validators.password]
    },
    register: {
        email: [validators.required, validators.email],
        nickname: [validators.required, validators.nickname],
        password: [validators.required, (v) => validators.password(v, 6)]
    },
    nickname: {
        nickname: [validators.required, validators.nickname]
    }
};

export const authValidators = {
    email(value) {
        const result = validators.email(value);
        if (!result.valid) return result;
        const tempEmailDomains = [
            'tempmail', '10minutemail', 'guerrillamail',
            'mailinator', 'throwaway', 'spamgourmet'
        ];
        const domain = result.value.split('@')[1].toLowerCase();
        if (tempEmailDomains.some(d => domain.includes(d))) {
            return { valid: false, error: 'Используйте постоянный email' };
        }
        return result;
    },

    password(value, minLength = 6) {
        const result = validators.password(value, minLength);
        if (!result.valid) return result;
        const commonPasswords = [
            'password', '123456', 'qwerty', 'admin',
            'letmein', 'welcome', 'monkey', 'dragon'
        ];
        if (commonPasswords.includes(result.value.toLowerCase())) {
            return { valid: false, error: 'Слишком простой пароль' };
        }
        return result;
    },

    nickname(value) {
        const result = validators.nickname(value);
        if (!result.valid) return result;
        const forbiddenWords = ['admin', 'root', 'moderator', 'support'];
        if (forbiddenWords.includes(result.value.toLowerCase())) {
            return { valid: false, error: 'Это имя недоступно' };
        }
        return result;
    },

    loginIdentifier(value) {
        if (!value || typeof value !== 'string') {
            return { valid: false, error: 'Обязательное поле' };
        }
        const trimmed = value.trim();
        if (!trimmed) {
            return { valid: false, error: 'Поле не может быть пустым' };
        }
        if (trimmed.includes('@')) {
            return validators.email(trimmed);
        } else {
            return validators.nickname(trimmed);
        }
    },

    // Новый валидатор: только длина, без проверки сложности (для входа)
    loginPassword(value) {
        if (!value || typeof value !== 'string') {
            return { valid: false, error: 'Пароль обязателен' };
        }
        const trimmed = value.trim();
        if (!trimmed) {
            return { valid: false, error: 'Пароль не может быть пустым' };
        }
        if (trimmed.length < 6) {
            return { valid: false, error: 'Пароль должен содержать минимум 6 символов' };
        }
        return { valid: true, value: trimmed };
    }
};

export const authSchemas = {
    login: {
        identifier: [authValidators.loginIdentifier],
        password: [authValidators.loginPassword]
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

export function isEmail(value) {
    return value && value.includes('@');
}

export function getEmailFromIdentifier(identifier) {
    if (isEmail(identifier)) {
        return identifier;
    }
    return null;
}
