// ============================================================
//  ГЛОБАЛЬНОЕ СОСТОЯНИЕ
// ============================================================
import { BASE_HP, BOSS_TIMER } from './config.js';

// --- Основные переменные ---
export let currentUser = null;
export let playerData = null;
export let clickCount = 0;
export let totalSecondsPlayed = 0;
export let currentLevel = 1;
export let moonHP = BASE_HP;
export let maxHP = BASE_HP;
export let sessionStartTimestamp = null;
export let timeUpdateInterval = null;
export let autoSaveInterval = null;

// --- Босс ---
export let bossTimer = BOSS_TIMER;
export let bossTimerInterval = null;
export let isBossActive = false;
export let bossTimerRunning = false;

// --- Настройки ---
export let levelLocked = false;
export let testMode = false;

// ============================================================
//  СЕТТЕРЫ (для обновления состояния из других модулей)
// ============================================================
export function setUser(user) {
    currentUser = user;
}

export function setPlayerData(data) {
    playerData = data;
}

export function setClickCount(value) {
    clickCount = value;
}

export function setTotalSecondsPlayed(value) {
    totalSecondsPlayed = value;
}

export function setCurrentLevel(value) {
    currentLevel = value;
}

export function setMoonHP(value) {
    moonHP = value;
}

export function setMaxHP(value) {
    maxHP = value;
}

export function setSessionStartTimestamp(value) {
    sessionStartTimestamp = value;
}

export function setLevelLocked(value) {
    levelLocked = value;
}

export function setTestMode(value) {
    testMode = value;
}

export function setBossTimerRunning(value) {
    bossTimerRunning = value;
}

export function setBossTimer(value) {
    bossTimer = value;
}

export function setBossTimerInterval(value) {
    bossTimerInterval = value;
}
