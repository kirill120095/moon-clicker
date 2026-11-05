# Лунный храм — SVG/test готовность и остаток закрытого release

## Что действительно соединено

В той же feature-ветке и PR№1 соединены кандидат Кометы, один `TempleTestItems`, controller и переданный Призмой SVG runtime. Это работающий **тестовый** 5×3 автомат с предметами, не новые API-заглушки и не production release.

Canonical test contract:
- `demo_lunar_relic`, «Реликвия храма · ДЕМО», уровни1–3, без stats/equip/merge.
- Одна партия за лучшую линию ВСЕГО поля; length3/4/5→level1/2/3, stake10/20/50/100→qty1/2/5/10, максимум10предметов/grid.
- WILD ранжируется длиной/itemlevel, не cash-таблицей. WWWtenjack→ten4/level2; allwild→level3. Tie: min lineId, затем порядок ordinary IDs.
- Scatter3+paid→10manualfree, debit0free, quantity по triggerstake, без scatteritem/retrigger.
- Новый отдельный ключ `moonclicker.lunarTempleItemsDemo.v1`, **saveVersion1**. Старые test/cash7×1 keys не читаются, не удаляются, не конвертируются.
- Одна запись balance/inventory/freecounter/last доанимации. Reload не даёт предмет повторно. Unknown version/corrupt save — read-only; reset и overwrite запрещены.
- Reset: «Сбросить демо: фишки и предметы», только1000+emptydemo; при активныхfree сначала диалог-предупреждение.

## SVG handoff и точные адаптации

Исходник восстановлен из полного текста, сохранён отдельно до адаптации: **40779байт**, SHA256 **8a3e98c4cea119ee6057c79e95105b7a982b0aea1471a3959caedf0af93ae792**. `node --check` прошёл.

В рабочем `src/modules/ui/lunar-temple-runtime.mjs` функции адаптированы, но **LUNAR_CSS, LUNAR_SVG, LUNAR_ARCHITECTURE и LUNAR_HTML побайтово равны оригинальным экспортам**. Арт не перерисован. HTML уже содержит обаSVG; вставляется один экземпляр.

Исправления review:
1. Reveal2500мс, включая reduced/low-power, а не640мс.
2. Видим один наградной маршрут, затем очередь при нескольких переданныхлиниях; у текущейbest-batch моделинаграднаялинияодна.
3. Readout «ДОБЫЧА» суммирует quantity: batch1×qty10 отображает10.
4. `begin(spinningSnapshot)` получает уже списанный баланс, в том числе0 от последних10.
5. Cancel не рисует старый settled; controller renderactualmodel. Latecallbacks не разблокируютновыйspin. Destroyed view пересоздаётся при reconnect.
6. Demo/live подписи, валюта иARIA различаются. Production default закрыт: `TEMPLE_DEFAULT_DEMO=false`; изолированный preview-builder включает demo явно. Без подтверждённогоaccount/capability храм в настоящемclient скрыт, не открытвсем.

Scoped `lt-fortune-wide` включается только при активной видимой Фортуне, снимаетсяприуходе. Прежнее колесо не скрыто/не переписано. Дополнительные stakes/reset/rules/bag controls встроены вокруг исходной SVG-кабины, без второй модели.

## Фактические проверки

- **324/324 текущих Node-теста**, не сумма чужих72/24/старых307. Включены canonicalstops/grid, chain-levelranking,onebatch,freefixedqty,level-stacks,новыйkey/save1,readonlyunknownversion,resetwarning,model/controller и прежниemain-регрессии.
- Browser обычный SPIN5×3 работает. Тестовые списания/предметы не меняют основные ресурсы.
- Явный control `[2,2,1,1,9]`, stake100: один batch10×level3, debit100,freeAward0; одна награднаяline1 несмотрянаостальные совпадения.
-20прямыхповторов со снятымdisabled — одна транзакция. Цикл измерен~2502мс.
- Storage-adapter reload:level/qty сохраняются без новой выдачи;unknownversion99 не перезаписывается/resetне проходит. Это не объявляется nativepage-reload.
- Cancel/return иdisposed-viewreconnect сохраняют committedstate/одинroot. Последние10 правильно даютbeginбаланс0, затем результат иdisabledspin.
- Resetприfree10 показываетдиалог;отмена сохраняет10;подтверждение даёт1000/emptyinventory/free0.
-320/360×1000 и1280×1000:15SVGячеекцеликом,10symboldefs,одинroot,нетhorizontaloverflow;SPIN64×64mobile и118×118desktop. Другиевкладкиснимаютwideclass. Колесо/основнойstateнеизменны,diagnostics[].
-Иллюстрациивзятыизhandoff; совпадение с пользовательским художественным ожиданием требует родительского визуального review, не выводится из счётчика тестов.

### Честное ограничение persistence

В artifact sandbox nativeStorage недоступен; показан session-only warning. Native Storage/full page reload на обычном HTTP-origin **ещё не подтверждён этим браузером**: его попытка открыть локальный127.0.0.1:8766 не получила страницу приложения. Блокировку sandbox не обходили. Модель сериализации и восстановление новымэкземпляром проверены Node и браузернымStorage-адаптером. Для полного acceptance нужен обычный staging/local HTTP-origin; не утверждать, что публичноеiframe сохраняетпрогресс послеreload.

## Серверные материалы: точный блокер

**`GetThreadMessages` отсутствует в инструментах этого worker.** Поэтому указанные RUNTIME_PATCH, SQL_PROPOSAL, SERVER_DTO_DELTA и client extension не получены/не применены. Чтение остановлено; APIURL/credentials/ACL обходов и замены самописным похожимпатчем нет. Parent может передать полные текстовые блоки тем же способом, какSVG, либо включить штатное чтение.

Хеши ожидаемых материалов известны из handoff, но здесь не проверены по байтам:
- Runtime55581байт: `6a8ffcc8f35a1a5886b2acb580158ad283bc7d9c6fb19c93e5478a9dab62c314`.
- SQL17616байт: `3800e548f20d12ad93e6d6fa86b18181be25c7166b194b2dab25a0e6c74d9e0b`.
- DTOdelta16139байт поверхruntime: `e02e6a33dc7c07ec7b0e115dc4645f501041da93825adc637b0a5e9d645de3f0`.

Не заявляется интеграция stable db.action intentUUID, внешний request_id binding, unique instance quantity1/rolledProperties, shared revision CAS, guardedRPC/RLS или ascension itemSystem. Именно эти client/server конфликты нужно свести по точному патчу и проверить. Демо-стекquantity10 не является реализацией real unique-instanceinventory.

## Минимальные решения для closed test — предложение, НЕ включено

| Решение | Минимальный безопасный вариант для согласования | Что ещё нужно |
|---|---|---|
| Допуск/ставка/лимиты | Один уже подтверждённый владелец; первыйliveтест толькоstake10; max1instanceнавыигрыш; пример inventorycap200 с отказом ДО RNG/debit при заполнении | Подтвердитьcap и итоговую serverpolicy; UUID держатьтольконаserver, не впубличномclient |
| Registry/reward | Использовать настоящие зарегистрированныеID выбранныхтипов урон/добыча/крит; никакогоfallbackнаdemo_lunar_relic | ТочныеID и явное правило выборатипа (таблица/веса), не переименованнаяфикстура |
| Rolled stats/suffix | Сохранятьtype,level,uniqueinstanceId,rolledProperties; сlevel2buff+debuff; всёпослевознесения | Утверждённые численные диапазоны базовыхэффектов и suffix-pairs. Не подставлятьноли/случайныечисла молча |

Выбор «2одинаковых→следующийуровень» и persistenceпослевознесения зафиксирован для будущего subsystem/migration, но **не реализован в демоавтомате**. Не терятьэти поля при будущеймиграции; нет implicitfusion тестовыхqty.

## Порядок ограниченного release после review

1. Получить точные runtime/SQL/deltas; сверитьSHA; вручную свести с текущимPR. Freeze reviewedcommit/diff; убедиться, что clientневыбрасываетlevel/rolledProperties, quantity1/instanceId сохраняются.
2. Подготовить проверяемый backup существующего serverbundle/config/schema и конкретного user state/revision. Не менять сохранение владельца тестовыминачислениями. Snapshot/read-onlyпроверки не равны restoreготовности.
3. На безопасной тестовой БД проверить SQL/RLS/guardedRPC, same-request replay, parallelrequests, CAS/stale/reconcile, foreignJWTdeny доDB/RNG/spend, inventorycapиascensionpersistence. Никаких широких grants.
4. Только после отдельного родительского допуска: применить additiveSQL/server сfeatureoff; проверитьсовместимость. Deploy EdgeFunction сновымprotocol, покаgateзакрыт. Затем client сservercapability UIgate, не demo fallback.
5. Включитьтолькоserver-onlyallowlist владельца и согласованнуюpolicy. Неразрушающийowner-onlysmoke сbackup/заранее согласованнойставкой; проверитьauthoritativerefresh/receipt/free/reconcile и отказчужомуJWT. ДругимновыйUIнепоказывается.
6. После разрешённого merge/clientrelease дождаться фактическогоPagesrun и проверитьактивныйorigin. Доэтого **GitHubPages не объявлятьобновлённым**.

Rollback: сначала закрыть serverfeaturegate (новыеspinsstop, ужеcommittedreceiptsнеповторять); вернутьclientкпоследнемуverifiedcommit. Не удалятьинвентарь/receiptтаблицы и не откатыватьигровоесохранениеповерхновогопрогресса. Edge rollback только на версию, доказанносохраняющуюitemSystem; не считатьстаруюv34автоматическибезопаснойдляновыхданных. SQL rollbackпоотдельнопроверенномуplan,неblinddrop.

## Что НЕ сделано

Нетmainmerge,SQLapply,Edge deploy,реальныхсписаний/выдач илиGitHubPagesrelease. Подтверждённыеparent target/UUID повторно не спрашиваются и не публикуются здесь. Production-readiness сейчас **нет**: точныйserverhandoffнепрочитан,policyрешения/DBintegration/nativeoriginchecks не завершены.
