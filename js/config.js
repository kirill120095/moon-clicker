// Конфигурация игры: URL, ключи, настройки
export const SUPABASE_URL = 'https://zllnsmztaakdwjpnijsk.supabase.co';
export const SUPABASE_ANON_KEY = 'sb_publishable_AHp63XmOZhgE2xYmhxFvsw_cB1urGrt';

export const TEST_MODE = true;               // true – HP уменьшены в 10 раз для теста
export const HP_SCALE = TEST_MODE ? 0.1 : 1;
export const BOSS_INTERVAL = 10;             // босс каждые 10 уровней
export const BOSS_TIMER = 30;                // секунд на босса
export const BASE_HP = 100 * HP_SCALE;       // базовое HP для 1-го уровня
