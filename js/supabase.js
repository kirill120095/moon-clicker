import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

if (typeof window.supabase === 'undefined') {
    const msg = '⚠️ Не удалось загрузить библиотеку Supabase. Проверьте интернет.';
    const authMsgEl = document.getElementById('authMessage');
    if (authMsgEl) {
        authMsgEl.textContent = msg;
        authMsgEl.className = 'error';
    }
    throw new Error('Supabase library not loaded');
}

export const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
