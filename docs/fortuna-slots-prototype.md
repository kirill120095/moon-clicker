# Лунный храм 5×3 — подготовка item-release, доступ ОТКЛЮЧЁН

Кирилл выбрал обычные осколки и награды предметами сразу в инвентарь, только своему аккаунту после проверок. Ник известен, auth UUID/target ещё не подтверждены. **Реальных spin-запросов, списаний, merge или deploy не было.**

Текущий bounded этап: strict column-major геометрия, кандидатные5×24ленты, unitless line-score, отключённый клиентский server-authoritative adapter и readonly wireframe «Сумка / Последние дропы». Ни item-mapping, ни эффекты/слияние/вознесение, ни окончательный арт не придуманы.

- [Актуальный account/item protocol и блокеры](moon-temple-items-contract.md).
- [Геометрия и отдельный TEST-адаптер](moon-temple-contract.md).
- Та же `feature/fortuna-demo-slots`, [draft PR№1](https://github.com/kirill120095/moon-clicker/pull/1).
- [Wireframe](https://hyperagent.com/s/Vadvg2PkiFTR58AaKf5Aeg) — не готовая игра и не подключение аккаунта. SPIN недоступен; shards/inventory не подменены демо-данными.
- 293/293 текущих теста. Это проверки кода/DTO/mock transports, **не предметного баланса и не настоящей серверной авторизации**.
- Cash-кандидат95.676% RTP и старые7×1 цифры не применяются к предметным наградам.
- Старое колесо, основная игра, auth/core/backend не изменены. Backend отдельно готовит Контур; его файлы здесь не дублируются.

Перед реальным запуском нужны подтверждённый Supabase target, auth UUID, approved item-mapping и версионированный атомарный backend, затем отдельный родительский этап допуска. Предыдущие опубликованные версии не являются текущим target или художественной приёмкой.
