# Лунный храм 5×3 — геометрия и ТЕСТОВЫЙ cash-adapter

> Текущий выбранный выпуск — **обычные осколки → предметы**, только подтверждённому аккаунту после отдельного допуска. Этот документ сохраняет геометрию и QA-адаптер предыдущего этапа, НЕ утверждает cash-release. Актуальный account/item контракт: [moon-temple-items-contract.md](moon-temple-items-contract.md). `TempleWallet` теперь требует explicit testMode; default UI использует отключённый `TempleAccountClient`, не демо-кошелёк. Cash-RTP не валидирует предметную экономику.

Дата: 2026-11-04 UTC / 05.11.2026 МСК. Продолжение той же `feature/fortuna-demo-slots`, draft PR №1.

**Влад отклонил 7×1 по формату и виду. Новый согласованный target: пять барабанов × три ряда, «Лунный храм».** Прежние307 тестов и RTP92,526627% НЕ подтверждают новые правила. Общий каталог `cmw2lw6da0ehj07adgjdzl71q` прочитан, версия8: новый target явно отделён от старой реализации. Каталог не изменялся и не дублировался этим worker.

## Статус этого bounded этапа

Реализованы чистая оценка линий, конфигурационный API, демо-кошелёк, ручные free spins, миграция и controller/view boundary. Представление — только нейтральный **WIREFRAME** с15 техническими ячейками и IDs, не иллюстрированный автомат. Старой машины7×1 больше нет.

**Обычный production-путь заблокирован до получения финального конфига:** `temple-config.js` экспортирует `TEMPLE_CONFIG = null`. SPIN показывает «ОЖИДАЕТ CONFIG». Не придумывались финальные ленты, выплаты, RTP или арт. Финальные данные Кометы, иллюстрации/кабина Призмы и независимая проверка Контура пока не интегрированы.

Синтетический QA-config находится отдельно в `tools/slots/temple-fixtures.js`; это не баланс игры. Превью по умолчанию не включает его в модель. Флаг `--fixtures` включает **явный** тестовый режим с предупреждением; `--test-tools` лишь добавляет импортируемые тестовые данные в автономный стенд, не меняя обычную конфигурацию.

## Файлы и границы

| Компонент | Файл | Что разрешено |
|---|---|---|
| Чистый контракт/оценка | `src/modules/game/temple-rules.js` | Проверка config, stops→grid, paylines/WILD/SCATTER; без Storage/RNG/DOM |
| Демо-транзакции | `src/modules/game/temple-wallet.js` | Пять draw, единственная запись денег+bonus, save/reload/migration |
| Инъекция финальной математики | `src/modules/game/temple-config.js` | Сейчас null; сюда будет подключён версионированный config Кометы |
| Контроллер | `src/modules/ui/slots.js` | Единственный busy-lock, manual spin, stakes/reset, snapshot и lifecycle |
| Временный view | `fortune-slots-view.js`, `fortune-slots-template.js`, `css/slots.css` | Только wireframe, 5×3, один overlay, отображение; заменить на арт без второй модели |
| QA-функции | `tools/slots/temple-fixtures.js` | Искусственные ленты и именованные fixture stops, только явная отладка |

Прежние wheel/auth/main game/core state/серверный backend не менялись. Сохранены существующие hooks `fortuneWheel.connect/open/close/disconnect` для единственного блока в `#fortuneTabContent`. Старое колесо остаётся ниже, его основной кошелёк не связан с демо.

## Общая геометрия и IDs — фиксированы

- `columns = 5`, `rows = 3`.
- Матрица **column-major**: `grid[reel][row]`, индексы reel0…4 и row0…2.
- IDs: `ten,jack,queen,king,ace,crystal,moon,guardian,wild,scatter`.
- `stop[reel]` — индекс **верхнего** видимого символа на круговой ленте. Остальные: `(stop+1)%length`, `(stop+2)%length`. Это уточнение API для согласованного использования во всех ролях.
- Ровно пять независимых draw для stop-индексов; **не 15 независимых символов**. Ни pressure, ни компенсируемых шансов, ни переброса ради near-miss нет.

Десять фиксированных линий, IDs1…10, значения — row0…2:

```js
[
 [1,1,1,1,1], [0,0,0,0,0], [2,2,2,2,2],
 [0,1,2,1,0], [2,1,0,1,2], [0,0,1,0,0],
 [2,2,1,2,2], [1,0,0,0,1], [1,2,2,2,1], [0,1,1,1,0]
]
```

## API конфигурации для Кометы/Контура

```ts
createTempleConfig({
  id: string,                       // новый immutable ID при изменении математики
  columns: 5, rows: 3,
  reelStrips: string[][],            // ровно5 круговых лент длиной3…4096
  paytable: {
    ten: {3: number, 4: number, 5: number},
    // остальные7 ordinary IDs обязательны
    wild?: {3: number, 4: number, 5: number}
  },
  paylines?: number[][],             // только точное совпадение с10линиями выше
  provisional?: boolean             // маркировка QA-конфига
})
```

**Технические ограничения первого API:** множители `paytable[id][count]` — неотрицательные целые, неубывающие по count, максимум1 000 000; считаются от `lineBet`. Дроби не округляются молча: неподходящий config отклоняется. Если финальная математика потребует дробных множителей, fixed-point контракт нужно согласовать до подключения. Реальные выплаты/полосы этим документом не задаются.

Собственная строка WILD **необязательна**: при её отсутствии собственная выплата WILD=0, но он всё равно заменяет ordinary. Это позволяет явно принять окончательное решение геймдизайнера о5WILD без скрытой второй выплаты. SCATTER-строка cash-выплат запрещена в этом baseline.

## Чистая оценка

- `templeGridFromStops(config, stops)` возвращает `grid[5][3]` по фактическим лентам.
- `evaluateTempleLine(config, symbols[5], lineBet)` возвращает `null` либо **одного** лучшего кандидата `{symbol,count,multiplier,gross}`.
- `evaluateTempleGrid(config, grid, totalStake)` возвращает `grid,totalStake,lineBet,lineWins,gross,scatterCount,scatterPositions,triggersFreeSpins`.
- Каждая `lineWin`: `lineId(1…10), rows[5], symbol, count, multiplier, gross, positions:[{reel,row}]`.

Ordinary-кандидат — максимальный непрерывный prefix от первого барабана, состоящий из этого символа и WILD; минимум3. Начало со второго барабана или совпадения где угодно не платят. SCATTER прекращает любой обычный/WILD-prefix и никогда не подменяется WILD.

Если есть собственная WILD-строка, её кандидат использует только literal WILD-prefix. Среди допустимых кандидатов линии выбирается наибольший gross; при равенстве — большее count, затем фиксированный порядок IDs выше. Это tie-break для стабильного представления, не дополнительная выплата. Разные линии суммируются, даже если используют общую ячейку.

## Демо-кошелёк / bonus API

```ts
new TempleWallet({config, storage?, rng?, testMode:false, fixtures:{}})
wallet.setStake(10 | 20 | 50 | 100)
wallet.spin({ mode?: 'paid' | 'free', requestId?: string, fixtureId?: string })
wallet.reload()
wallet.reset()
```

- Старт и reset ровно1000; общая ставка10/20/50/100; `lineBet = totalStake / 10`. Все10линий активны.
- Paid: один debit общей ставки, сумма line gross начисляется один раз.
- Paid-результат с3+SCATTER **по всему полю** выдаёт10free spins; scatter cash0, expanding0.
- Free: запускается только вручную по одному; debit0; используется зафиксированная **ставка paid-триггера**, не новая выбранная ставка. Counter уменьшается ровно на1. Paid-mode и изменение ставки при remaining>0 блокируются до RNG.
- SCATTER внутри free не retrigger; обычные линии продолжают платить. После последнего free counter0, triggerStake=null.
- `spin` возвращает результат либо null при недоступном режиме, нехватке, незаданном config или дубликате последнего requestId. Повтор последнего requestId не пишет/не бросает RNG. Это клиентская защита, не заявленная серверная idempotency всей истории.
- При нехватке paid-баланса RNG0, записей0. Новый spin контроллер синхронно блокирует **до** обращения к модели, включая reentrant-вызов и снятый disabled.
- Один `storage.setItem` атомарно фиксирует debit, все line credits и новое bonus-состояние **до** анимации. View никогда не начисляет деньги.

Результат содержит `mode`, `source:{kind:'random'|'fixture',id?}`, `stops[5]`, `rulesId`, `requestId`, `sequence`, `before`, `after`, `debit`, `gross`, `creditedGross`, `net`, `lineWins`, `bonusBefore`, `bonusAfter`, `freeSpinsAwarded`, `outcome`, `celebrate`. В чистой grid-оценке `triggersFreeSpins` обозначает scatter-условие; в результате транзакции — фактическую выдачу, поэтому в free-mode всегда false.

Технический прежний предел демо-баланса1 000 000 000 сохранён: `gross` — номинальная сумма линий, `creditedGross` ограничен свободным местом, `net=creditedGross−debit`. UI отдельно сообщает ограничение, когда оно реально сработает. Это ограничение безопасных тестовых чисел, не адаптивные шансы.

**Никакой ложной победы:** `celebrate` только если creditedGross больше reference totalStake. Paid `gross<stake` — partial-return/net<0, `gross==stake` — return/net0. Free всегда сообщает debit0, trigger stake и фактический net; малый free gross не маскируется под большой чистый win.

## Save/reload/migration

Ключ только `moonclicker.fortunaDemo.v1`, payload теперь **version4**:

```ts
{version:4, rulesId, balance, stake, bonus:{remaining,triggerStake}, sequence,
 rulesChanged, last:{before,bonusBefore,mode,stake,stops,requestId,sequence,source}|null}
```

- Допустимый старый баланс v1/v2/v3 сохраняется; old7×1 last/bonus очищаются, появляется явное уведомление о смене правил. Старые исходы не переоцениваются.
- При смене `rulesId` аналогично сохраняется баланс, но старые last/bonus не пересчитываются новым конфигом.
- Same-rules last восстанавливается из stop-индексов и фактического конфига, без RNG/доплаты; проверяются after и bonusAfter. Повреждённый last не изменяет баланс; bonus без согласованного last не принимается.
- Storage-недоступность → подписанный session-only режим. Другие ключи и основные ресурсы не трогаются.

## Controller ↔ view контракт для Призмы

Controller singleton `demoSlots` сохраняет connect/open/close/disconnect/play/reset; добавлены `configure(config,{testMode,fixtures})`, `changeStake(-1|1)`. Основные handlers остаются в контроллере.

View-фабрика сейчас `createTempleWireframeView(root)`; для финального арта нужны совместимые hooks:

- `render(snapshot)` — отображает **актуальную модель**, отменяя старую визуальную очередь.
- `begin(snapshot)` — один принятый spin; balance уже после debit, итоговый gross ещё не раскрыт.
- `reveal(snapshot): Promise<boolean>` — раскрывает пять колонок без RNG/денег. Текущий базовый цикл2500мс, также в reduced-motion (без пульса/движения).
- `cancel()/destroy()` — только визуальная отмена, не rollback транзакции. Старые promises не разблокируют новый spin.
- `selectedFixture()` — только явно видимый тестовый selector; обычный режим возвращает undefined.
- `highlightLine(index)` — один выигравший маршрут за раз. Wireframe циклически показывает выигравшие линии по одной, не все сразу; таймер очищается при уходе.

Snapshot: `phase,title,detail,visible,ready,grid[5][3]|null,result|null,balance,selectedStake,stake,mode,bonus,debit,rulesChanged,persistent,testMode,fixtureIds,config,busy,spinAvailable`. `grid` и result — отдельные копии, мутация view не меняет кошелёк. Config immutable. Не выбирать итоговые символы в анимации и не имитировать near-miss.

Текущие wireframe hooks: root `[data-mt-slots]`, `.mt-grid` с5 `.mt-column`, по3 `.mt-cell[data-reel][data-row]`; controls `[data-mt-spin/minus/plus/reset]`, `[data-mt-lines]` SVG с одним polyline. Это технический container, не утверждённая художественная разметка. Широкую кабину можно подключить scoped к Фортуне, не меняя остальные вкладки.

## Детерминированные сценарии

`tools/slots/temple-fixtures.js` содержит искусственный QA-config и именованные **stop[5]** для `loss,leftThree,trigger,fiveWild,fourFromSecond,lineAndBonus`. Они соответствуют реальным соседним символам тех же QA-лент, не подменяют grid произвольной матрицей.

`wallet.spin({fixtureId:'trigger'})` разрешён только при `testMode:true` и зарегистрированном ID; результат отмечен `source.kind='fixture'`. Без явного fixtureId обычный spin всегда использует5RNG. Скрытой очереди forced outcomes нет.

Локальный стенд:

```sh
node tools/slots/preview.cjs                    # config pending: SPIN отключён
node tools/slots/preview.cjs --fixtures         # явно помеченная QA-математика
node tools/slots/preview.cjs --test-tools --output wireframe.html
```

## Выполнено в первом этапе

- `node --test tests/*.test.cjs`: **273/273**. Сохранены применимые main-регрессии; obsolete7×1 assertions заменены, старые307 не выдаются за новые273.
-22 новых model/rules проверок: точные10линий/IDs/stakes, wrap/adjacency,5RNG, from-first-only, WILDambiguity/5WILD/scatter exclusion,10линий суммарно, fixture gating, duplicate/insufficient, bonus10/debit0/fixedstake/no-retrigger/reload/reset/migration, partial-return.
-10controller проверок: shadow/reentrant spin, disabled bypass, cancel/return/late callback, free snapshots, no false celebration, immutable result snapshot, no auto chaining, lifecycle.
- Реальный Chromium: normal RNG дал5stops по лентам; base/reduced cycle около2503мс.20повторов при снятом disabled — один debit/одна запись. Paid trigger после ухода/возврата сохранил980фишек/free10/stake20; paid и новая ставка блокируются. Free leftThree далdebit0/net4/balance984/free9; reload это сохранил без новой выплаты. Scatter воfree не далcash/retrigger. ОдинSVGoverlay при10выигравшихлиниях; маршрутline4 совпал с договорённым. Partial-return не празднуется. Основные4321, прочийStorage-key и прежнее колесо неизменны, diagnostics[].
-320/360×760px: поле целиком5×3,15ячеек видно одновременно, horizontal overflowfalse. Это проверка wireframe, не художественная приёмка.
- Render health wireframev8 — healthy, без ошибок консоли/загрузки. Это не приёмка арта. Default config pending реально блокируетSPIN. Тестовые данные подключались для проверки только явным testMode.

## Блокеры следующего этапа

1. Финальный версионированный config Кометы: пять реальных strip-массивов, ordinary paytable, явное решение о собственной WILD-строке; математика для base/free и целевые ожидания.
2. Иллюстрированные assets и широкая5×3 кабина Призмы. Никакой готовности художественного вида не заявляется.
3. Независимая проверка Контура по этому pure contract и согласование любых расхождений до подключения.
4. Перед будущим merge остаются настоящая авторизация и native Storage/full reload на обычном origin. Сейчас только изолированный стенд, Node и Storage-адаптер; production не использовался.

Merge/deploy/main/force-push не выполняются. Новый backend не подключён.
