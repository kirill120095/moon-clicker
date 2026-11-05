# Следующий законченный показ: локальное test-items demo

## Текущий bounded результат

Родитель выбрал ближайший результат без ожидания БД:5×3 «Лунный храм»,10линий,WILD/SCATTER, предметы в **явно тестовый** инвентарь, отдельный демо-баланс. Реальный account path остаётся default-deny. Демо-данные не конвертируются в обычные осколки или настоящий инвентарь.

В этом этапе подготовлены persistent local item-adapter и controller/view стыки. Candidate item-mapping Кометы и ручной SVG-арт Призмы **ещё не переданы этому worker**. Поэтому `TEMPLE_TEST_ITEM_MAPPING=null`: готовый игровой показ не объявляется, QA fixture не подставляется как GD-кандидат. Главный опубликованный артефакт пока не перепубликовывается очередным частным wireframe.

## Новый adapter — без перезапуска ядра

`src/modules/game/temple-test-items.js`, класс `TempleTestItems` использует прежние:
- `TEMPLE_CANDIDATE_GEOMETRY`, five circular stops → strict column-major5×3;
- `scoreTempleGrid`,10фиксированных линий и один WILD-кандидат;
- прежние controller/view hooks и2.5сек reveal.

Только local-test транзакция: один debit тестовых фишек, item receipts, inventoryVersion и bonuscounter фиксируются одним сохранением до анимации. Никакого cash-начисления и обращения к real account/server. Default UI теперь выбирает test-items; отдельный real-client при его выборе по-прежнему запрещает запросы без проверенного release/UUID/target/mapping/backend.

## Точка для incoming candidate item-mapping

```ts
TEMPLE_TEST_ITEM_MAPPING = {
  id: 'versioned-candidate-id',
  scoreTable: { /* явные unitless scores по symbol/count */ },
  resolveItems({grid,lineWins,totalLineScore,totalStake,mode}) {
    return [{itemDefinitionId,quantity,displayName?}];
  }
}
```

`resolveItems` — синхронный, чистый и детерминированный adapter candidate-данных. Не получает кошелёк, RNG, историю или аккаунт. Не должен начислять валюту/эффекты; допустимы только ID/quantity/name. При другом формате данных Кометы нужно написать маленький переводчик, не менять смысл mapping молча. Этот файл **не определяет** предметы или коэффициенты за геймдизайнера.

Конфигурация хранится в `src/modules/game/temple-config.js`; сейчас null. QA mapping существует только внутри `tests/temple-test-items.test.cjs`, явно назван `QA-ONLY` и выдаёт `QA-NOT-GD-ITEM`. Он не импортируется приложением и не публикуется как игровой баланс.

API:

```ts
new TempleTestItems({geometry?,mapping,storage?,rng?,fixtures?,allowFixtures:false})
model.spin({mode?:'paid'|'free',requestId?,fixtureId?})
model.setStake(10|20|50|100)
model.reload()
model.reset()
controller.configureTestItems(mapping,{storage?,fixtures?,allowFixtures?})
```

Без mapping —0RNG/0списаний. Fixture доступен только при explicit allowFixtures и зарегистрированном stop-наборе. Обычныйspin всегда пять RNGdraw по лентам, без скрытой подмены. Второй controller-start или reentrant вызов mapper не создают дополнительную транзакцию.

## Сохранение и инвентарь

Новый отдельный ключ: **`moonclicker.templeItemsTest.v1`**. Legacy cash-key и real account не читаются для конвертации и не очищаются.

В одной записи: version,geometryId,mappingId,balance,stake,inventoryItems,inventoryVersion,sequence,bonus,last. Start/reset ровно1000. Reset очищает только тестовую сумку/freecounter/last, не остальные ключи/основную игру.

Same-rules reload восстанавливает test balance, bag и receipt без вызова item mapper и без повторной выдачи. Восстанавливается геометрия/line-score для отображения, не награды. При смене mapping/geometry сохраняется допустимая тестовая коллекция и баланс, но старый last/bonus не переоценивается.

Одинаковые itemDefinitionId суммируют quantity как счётчик тестовой коллекции; это **не** crafting/слияние/улучшение предметов. Нет боевых эффектов, equip/ascend/merge и покупок ячеек.

Storage failure явно переключает adapter в session-only. Тогда reload persistence не обещается. Публичный HTML sandbox ранее запрещал nativeStorage; для полной browser-reload приёмки нужен обычный HTTP-origin, а не обход sandbox. Node-тесты проверяют реальную сериализацию в Storage-адаптер и новый экземпляр после reload, но не объявляются физическим page reload тестом.

## Controller/view

Snapshot остаётся `rewardMode:'items'`, добавлен `walletMode:'test-items'`, видимый `data-mode='test'` и «ТЕСТОВЫЙ РЕЖИМ». Баланс подписан тестовыми фишками, сумка — тестовым инвентарём, debitAmount — списанными тестовыми фишками. Никаких fake cash-гроссов и реальных осколков.

На begin показаны debit и **предыдущая** сумка: новые дропы не раскрываются раньше линии. На reveal рисуются line overlay, awardedItems и текущая сумка. При cancel/возврате показывается уже committed test state, не старый snapshot и не повторная выдача. Reset доступен только тестовому пути; real reset запрещён.

При `configureAccount(client)` новая account-projection остаётся без баланса/предметов; тестовые деньги и сумка не копируются. Real `TEMPLE_ACCOUNT_RELEASE` не изменён, enabledfalse и неизвестные UUID/target остаются null.

Новые hooks для Призмы: `[data-mt-inventory-title]`, `[data-mt-item-test-rules]`; остальные matrix/line/bag/lastdrops hooks сохранены. После получения SVG не нужна новая игровая модель.

## Фактические проверки

`node --test tests/*.test.cjs`: **307/307 текущих тестов**. Это совпадение количества со старой7×1версией, не перенос её тестов/RTP. Новые13 test-items сценариев +syntax и прежние293регрессии:
- spin→line1 moon×5→QA item→новый экземпляр из сохранения: balance990,quantity1, mapper вызван ровно1раз;
- повторный reload не начисляет; два разныхspin даютquantity2, duplicate request не списывает;
- атомарная запись включает debit/receipt/bag/freecounter;
- reset→1000/emptybag и reload остаётся пустым; main/legacykeys неизменны;
- mapping сменился — коллекция сохранена, прошлый результат не переоценён;
-5draw и explicitfixtures, insufficientRNG0, reentrantmapper блокирован;
- неправильный/async/cash/effect mapping отклоняется до debit;
-free debit0/fixedstake/manualcounter/no-retrigger сохраняются вместе с вещами;
-controller скрывает будущую сумку до reveal; cancel/open не удваивает;
-test→real не конвертирует ничего, real canSpin=false;
-storagefailure честно session-only.

Это bounded код/контрактные проверки на явно synthetic fixture, не принятие GD mapping, SVG-вида или native browser reload. Новый частный wireframe не публиковался как финал.

## Следующий короткий этап

Получить candidate mapping и SVG исходники, адаптировать их в те же точки, прогнать настоящий browser flow и обычный-origin reload, затем обновить **тот же** основной artifact/public link. Liveрежим не включать: Supabase не enabled/неподтверждён, агентский draft должен сохранить пользователь; real UUID/target/backend и отдельный допуск остаются обязательными.
