// ============================================================
//  ВАЛИДАЦИЯ ДАННЫХ
// ============================================================

export const validators = {
    // ============================================================
    //  EMAIL
    // ============================================================
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

    // ============================================================
    //  ПАРОЛЬ
    // ============================================================
    password(value, minLength = 6) {
        if (!value || typeof value !== 'string') {
            return { valid: false, error: 'Пароль обязателен' };
        }
        
        const trimmed = value.trim();
        if (!trimmed) {
            return { valid: false, error: 'Пароль не может быть пустым' };
        }
        
        if (trimmed.length < minLength) {
            return { 
                valid: false, 
                error: `Пароль должен содержать минимум ${minLength} символов` 
            };
        }
        
        // Проверка на сложность
        let strength = 0;
        if (/[a-z]/.test(trimmed)) strength++;
        if (/[A-Z]/.test(trimmed)) strength++;
        if (/[0-9]/.test(trimmed)) strength++;
        if (/[^a-zA-Z0-9]/.test(trimmed)) strength++;
        
        if (strength < 2) {
            return { 
                valid: false, 
                error: 'Пароль должен содержать буквы разного регистра, цифры или спецсимволы' 
            };
        }
        
        return { valid: true, value: trimmed };
    },

    // ============================================================
    //  ЛОГИН/NICKNAME
    // ============================================================
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
            return { 
                valid: false, 
                error: 'Логин может содержать только буквы, цифры, _ и -' 
            };
        }
        
        return { valid: true, value: trimmed };
    },

    // ============================================================
    //  ЧИСЛА
    // ============================================================
    number(value, options = {}) {
        const num = Number(value);
        if (isNaN(num)) {
            return { valid: false, error: 'Должно быть число' };
        }
        
        if (options.min !== undefined && num < options.min) {
            return { 
                valid: false, 
                error: `Минимальное значение: ${options.min}` 
            };
        }
        
        if (options.max !== undefined && num > options.max) {
            return { 
                valid: false, 
                error: `Максимальное значение: ${options.max}` 
            };
        }
        
        if (options.integer && !Number.isInteger(num)) {
            return { valid: false, error: 'Должно быть целое число' };
        }
        
        if (options.positive && num <= 0) {
            return { valid: false, error: 'Должно быть положительным' };
        }
        
        return { valid: true, value: num };
    },

    // ============================================================
    //  ОБЩИЕ
    // ============================================================
    required(value) {
        if (value === undefined || value === null || value === '') {
            return { valid: false, error: 'Поле обязательно' };
        }
        return { valid: true, value };
    },

    maxLength(value, max) {
        if (value && value.length > max) {
            return { 
                valid: false, 
                error: `Максимальная длина: ${max} символов` 
            };
        }
        return { valid: true, value };
    },

    minLength(value, min) {
        if (value && value.length < min) {
            return { 
                valid: false, 
                error: `Минимальная длина: ${min} символов` 
            };
        }
        return { valid: true, value };
    },

    // ============================================================
    //  КОМПОЗИТОРЫ
    // ============================================================
    compose(...validators) {
        return (value) => {
            let currentValue = value;
            for (const validator of validators) {
                const result = validator(currentValue);
                if (!result.valid) {
                    return result;
                }
                currentValue = result.value;
            }
            return { valid: true, value: currentValue };
        };
    },

    // ============================================================
    //  СПЕЦИАЛЬНЫЕ ДЛЯ ИГРЫ
    // ============================================================
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

// ============================================================
//  ВАЛИДАЦИЯ ФОРМ
// ============================================================
export function validateForm(data, schema) {
    const errors = {};
    const validData = {};
    
    for (const [key, validators] of Object.entries(schema)) {
        const value = data[key];
        let result = { valid: true, value };
        
        for (const validator of validators) {
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

// ============================================================
//  ПРЕДНАСТРОЕННЫЕ СХЕМЫ
// ============================================================
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
