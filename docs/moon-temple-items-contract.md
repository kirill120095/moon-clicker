# Лунный храм: обычные осколки → предметы — отключённый release-slice

## Статус и границы

Кирилл выбрал **обычные осколки и предметы сразу в инвентарь**, только для его аккаунта после проверок. Промежуточный рабочий cash-payout не выбран. Ник `kirill120095` известен, но **auth UUID не определён и не угадывается**.

Это подготовка клиентского контракта/отображения, **не работающий spin за реальные осколки**. `TEMPLE_ACCOUNT_RELEASE` по умолчанию: `enabled:false`, `ownerAuthUserId:null`, `projectRef:null`, `rulesVersion:null`, `rewardMappingVersion:null`. Transport не подключён. Supabase не вызывался; target/UUID не подтверждены. Main/merge/deploy/реальные списания не выполняются.

Backend готовит Контур отдельно; здесь нет новых server/SQL/Edge Function файлов и нет дублирования его работы. Будущий сервер обязан сам проверять JWT subject/allowlist и атомарно коммитить debit+inventory+версии. **Клиентские gates не являются серверной авторизацией.**

## Что изменено

- `temple-rules.js`: geometry отделена от cash-конфига; физические WILD/prefix candidates и unitless line-score отделены от кошелька/наград.
- `temple-candidate-geometry.js`: точно декодированы пять кандидатных лент длиной24 с переданным symbolOrder. Данные provisional; это не утверждённая предметная экономика.
- `temple-item-protocol.js`: whitelist запроса, строгий column-major ответ, typed item receipts, версии и disabled release policy.
- `temple-account-client.js`: только projection подтверждённого ответа. Нет собственного RNG, fetch/Supabase, localStorage, локального дебета или grant предметов.
- `slots.js`: реальный путь теперь использует отключённый account-client; локальный TempleWallet создаётся только при явном `testMode:true`. Никакой передачи demo balance в аккаунт.
- View/template: отдельные «Сумка»/«Последние дропы», серверная версия инвентаря, подтверждённые осколки/списание. Нет fake gross/net выигрыша осколками. Test cash labels видны только в явном QA-режиме.

## Геометрия — строго column-major

`grid[reel][row]`: **5 outer × 3 inner**, rows0..2. `gridOrder:'column-major'` обязателен в ответе. Row-major3×5 **отклоняется**, не транспонируется молча.

Кандидатные числовые strips сохранены без переупорядочивания в `TEMPLE_CANDIDATE_INDICES`. Каждая длиной24; `24^5 = 7 962 624` наборов остановок. `decodeTempleStrips` требует точный symbolOrder:

`ten,jack,queen,king,ace,crystal,moon,guardian,wild,scatter`.

Stop — верхняя видимая позиция; следующие две берутся по кругу. При stops=[0,0,0,0,0] ожидается:

```js
[
 ['guardian','queen','jack'],
 ['ten','queen','ace'],
 ['king','crystal','wild'],
 ['moon','king','wild'],
 ['queen','crystal','ten']
]
```

Десять фиксированных paylines не менялись. Денежный RTP95.676% кандидата **не является предметным RTP/балансом** и нигде не используется для выдачи предметов.

## Score — не валюта и не reward mapper

- `createTempleGeometry(input)` — полосы/геометрия без paytable.
- `templeGridFromStops(geometry,stops)` — те же пять круговых лент.
- `templeLineCandidates(symbols[5])` — физически допустимые ordinary/WILD prefixes3–5 слева, без SCATTER substitution.
- `scoreTempleLine(symbols,scoreTable)` — один максимальный **unitless score** из явно переданной таблицы, без денежного fallback.
- `scoreTempleGrid(grid,scoreTable)` → `{grid,lineWins,totalLineScore}`; не содержит gross/shards/awardedItems.

Старый `evaluateTempleGrid` и cash-таблица остались только для test-adapter и регрессионных проверок. Они не вызываются account-client и не определяют предметы. Выбор предмета/количества/эффектов/слияния/вознесения здесь **не придуман** — mapping ожидается от Кометы.

## Предлагаемый wire protocol v1 для Контур

Это название DTO, **не существующий/deployed RPC endpoint**. Будущая transport-обёртка согласуется с готовым backend отдельно.

### Запрос

```ts
{
 protocolVersion:1,
 type:'temple.spin',
 requestId:UUID,
 mode:'paid'|'free',
 totalStake:10|20|50|100,
 expectedStateVersion:number,
 expectedInventoryVersion:number
}
```

Whitelist не пропускает subject/username, grid/stops, lineWins, score, item IDs, payouts или balances от клиента. Авторитетный subject берётся сервером из проверенного JWT, **не из request body**.

### Ответ spin

```ts
{
 protocolVersion:1,
 requestId:UUID,
 subjectId:UUID,                  // подтверждённый server subject
 rulesVersion:string,
 rewardMappingVersion:string,
 stateVersion:number,
 inventoryVersion:number,
 shardsBalance:number,            // серверный итог, не clientBalance-delta
 mode:'paid'|'free', totalStake:number,
 shardsDebited:number,            // paid=stake, free=0
 gridOrder:'column-major',
 grid:string[5][3],
 lineWins:[{lineId:1..10,symbol:string,count:3..5,score?:number}],
 awardedItems:[{awardId:string,itemDefinitionId:string,quantity:number,displayName?:string}],
 inventoryItems?:[{instanceId:string,itemDefinitionId:string,quantity:number,displayName?:string}],
 bonus?:{remaining:number,triggerStake:number|null}
}
```

`stateVersion` добавлен для защиты от stale-response: **одного inventoryVersion недостаточно**, когда spin списал осколки, но не выдал предметов. Для каждого подтверждённого spin stateVersion должен продвинуться. InventoryVersion не убывает и продвигается при выдаче предметов. Согласовать эти поля с реальным revision backend до включения.

`lineWins` проверяются на уникальность lineId, реальный left-prefix/WILD-match и согласованную геометрию; клиент не пытается доказать предметный ranking старой cash-таблицей. `gross/payout/net/shardsReward` в item-response отклоняются. Item IDs/quantities/receipt IDs проверяются структурно, дубликаты receipts отклоняются; это **не оценка экономики предметов**.

Если backend приложит `inventoryItems`, bag обновляется сразу из полного подтверждённого snapshot. Без этого поля UI показывает реальные lastdrops/новую версию и явно просит актуальный список; **локально складывать awardedItems со старой сумкой нельзя**. Отдельный read-state можно передать через `acceptState` после проверки того же subject/target/версий.

DisplayName рендерится только через textContent. Эффекты, редкость, asset URLs, equip/merge/ascend API в эту фазу не добавлены.

## Client adapter и безопасность подготовки

```ts
new TempleAccountClient({
 release:{enabled:false,ownerAuthUserId:null,projectRef:null,rulesVersion:null,rewardMappingVersion:null},
 binding:()=>({subjectId,projectRef}),  // позднее: из реальной проверенной auth-привязки
 transport:null,                     // позднее: утверждённый серверный adapter
 requestId:()=>crypto.randomUUID()
})
```

Для spin нужны ВСЕ: явное release-enable, проверенный UUID, подтверждённый target, rules/mapping versions, совпавшие subject и project binding, подключённый transport, первоначальный авторитетный snapshot. Ник не участвует в gate. Пустой/чужой UUID, другой project или отсутствие mapping/transport дают0запросов.

Account-client не импортирует demo-save и не знает его balance1000. Нет оптимистического списания, refunds или локального начисления предметов. Ответ полностью заменяет подтверждённую projection. Идентичный подтверждённый requestId не отправляется снова; busy защищает подготовку ID и transport.

При timeout/некорректном/stale ответе результат мог быть закоммичен сервером: следующий новый spin блокируется, pending request сохраняется в памяти. `retryPending()` — **только явная** сверка тем же requestId и исходным payload, не автоматический retry и не новая ставка. Повторный ответ заменяет lastdrops, не добавляет их к инвентарю. Реальный backend обязан обеспечивать идемпотентность; после reload/потери сессии потребуется отдельный согласованный reconciliation flow перед release.

При смене аккаунта/target ответ не применяется. Controller скрывает финансовую и inventory-projection при несовпавшем binding. Cash-фикстуры запрещены в account mode. Account reset API отсутствует; test reset скрыт.

## UI snapshot для Призмы

Account snapshot помечен `rewardMode:'items'`. Поля: `balance` (confirmed shards либоnull), `shardsDebited`, `awardedItems`, `inventoryItems|null`, `inventoryVersion|null`, `blockReason`, `result`, column-major `grid`, `stake`, `mode`, authoritative `bonus`, `busy`, `spinAvailable`.

Без связи с сервером: осколки `—`, сумка «не загружена», lastdrops не выдуманы, SPIN «ДОСТУП НЕ АКТИВИРОВАН». Cash gross/net элементы переименованы в «Новых предметов»/«Списано осколков», test cash правила скрыты. Line-score подписан «не валюта».

Предметная карточка пока только ID/имя/количество из сервера; никакой новой картинки или эффекта не придумано. Иллюстрированный арт по-прежнему отсутствует: это WIREFRAME, не приёмка вида.

## Проверки этой фазы

-293/293 Node-теста: прежние применимые геометрия/bonus/test-adapter/main-регрессии плюс новая protocol/account/controller проверка.
- Точное декодирование пяти24лент, wrap,5×3 shape и отказ row-major.
- Score отдельно отcash/кошелька; отсутствие implicit reward mapping.
- Disabled policy/nullUUID/другойsubject с ником kirill120095/другойproject/mapping missing →0transport calls.
- Нет оптимистического списания/инвентаря; один запрос при20повторах/reentrantIDfactory; timeout не создаёт новыйrequestId.
- Неправильный responseID/subject, cash fields, row-major, duplicate lines/items, неверные версии и несуществующий prefix не меняют projection.
- Free использует подтверждённую сервером bonus-stake/debit0; клиент не генерирует bonus или предметы.
- Переключение test→account не переносит фишки, async cancel не отправляет второйrequest, identity mismatch скрываетданные.

Все auth UUID, project IDs и предметы в тестах — явно синтетические, **не Кирилл и не реальные награды**. Ни Supabase, ни реальные ресурсы/инвентарь не вызывались. Это контрактные тесты, не проверка готового backend или предметной экономики.

## Блокеры ограниченного release

1. Подтверждённый Supabase target и auth UUID Кирилла (не ник/GitHub ID/Hyperagent ID).
2. Backend Контур: JWT allowlist только этого UUID; атомарные shards-debit + inventory + revisions; идемпотентность requestId и reconciliation.
3. Item mapping Кометы и его версия. Cash-RTP95.676% не используется как критерий.
4. Финальные assets/кабина и отдельные решения по effects/merge/ascension.
5. Отдельный родительский этап допуска/проверок перед main/merge/deploy или реальными списаниями.
