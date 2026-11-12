# Тестирование

CI использует Node.js 22 и запускает `node --test tests/*.test.cjs`. Для локальной правки сначала запускай профильные тесты, перед релизом — весь набор.

| Изменение | С чего начать |
| --- | --- |
| Пыль, луны, престиж | `tests/lunar-dust.test.cjs`, `tests/moon-progression.test.cjs`, `tests/clone-prestige.test.cjs` |
| Фортуна | `tests/fortune-wheel.test.cjs`, `tests/casino-economy.test.cjs` |
| Вход, повторы, сохранение | `tests/registration.test.cjs`, `tests/server.test.cjs`, `tests/recovery-monitor.test.cjs` |
| Память и слабые устройства | `tests/memory-lifecycle.test.cjs`, `tests/low-device.test.cjs` |

При проверке в браузере пройди затронутый сценарий. Для входа проверь загрузку сохранения и хотя бы одно игровое действие, для панели — компоновку и управление на нужных ширинах. Отдельно укажи результаты автоматических тестов и проверок на опубликованной версии.
