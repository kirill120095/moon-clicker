# Лунный храм — SVG5×3 + тестовый инвентарь

Собран один тестовый автомат в существующей Фортуне: оригинальный SVG runtime Призмы, кандидат Кометы, один кошелёк/controller. Это не7×1, не emoji-wireframe и не отдельная фикстурная экономика художника.

- Canonical `demo_lunar_relic` / «Реликвия храма · ДЕМО», level1–3; одна партия за лучшую линию поля. Stake10/20/50/100→qty1/2/5/10, WILD по itemlevel, не cash-table.
- Новый ключ `moonclicker.lunarTempleItemsDemo.v1`, save1; старые demo keys не читаются/не удаляются. Unknown version read-only. Reset1000+очистка только этого демо, с предупреждением приfree.
- ИсходныйSVG40779байт/SHA совпал; SVG/CSS/architecture/HTML искусства не менялись. Lifecycle/adapter исправлены:2500мс,одналиния,quantitysum,актуальныйdebit/cancel,новыйviewпослеdestroy,modeподписи.
- Production default-deny; demo включён явно в изолированном preview-builder. На GitHubPages изменения НЕ опубликованы.

[Рабочий тестовый стенд](https://hyperagent.com/s/Vadvg2PkiFTR58AaKf5Aeg) — не production. В sandbox Storage может быть недоступен, тогда UI явно говоритsession-only; nativeHTTP fullreload не заявляется проверенным.

Главный текущий отчёт и конкретный release-остаток: **[lunar-temple-readiness.md](lunar-temple-readiness.md)**. В нём разделены frontend integration, серверныйreadblock, policyрешения, SQL/deploy/rollback и невыполненные productionпроверки.

`GetThreadMessages` не доступен worker: точные runtime/SQL/serverDTO/clientdelta Контура не прочитаны и не применены. Аналогичный самописныйпатч не подставлялся. Нужна передача этих текстовыхблоков либо штатное чтение.

Тот же [draftPR№1](https://github.com/kirill120095/moon-clicker/pull/1),безmerge/deploy/реальныхсписаний. Текущие324/324Node и browserchecks относятся к собранному frontend/test пути, не кPostgres/RLS/Deno/live.
