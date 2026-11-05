# Лунный храм5×3 — подготовка законченного TEST-items demo

Ближайшая цель родителя: playable5×3 с10линиями,WILD/SCATTER и предметами в **тестовый** инвентарь, демо-балансом и отдельным сохранением. Не ждать БД ради локального demo. Реальный account path — ordinary shards→items, толькоКирилл после отдельного допуска — остаётся default-deny.

В текущем bounded этапе готов persistent `TempleTestItems` и controller/view стыки. **Candidate mapping Кометы и SVG Призмы ещё не переданы.** Поэтому `TEMPLE_TEST_ITEM_MAPPING=null`; QA-предмет не подставлен как игровой mapping. Законченный публичный показ не объявлен, новый частныйwireframe не публикуется как итог.

- [Точный handoff локального test-items adapter](moon-temple-test-demo.md).
- [Будущий real-account protocol/default-deny](moon-temple-items-contract.md).
- [Геометрия/тестовая математика](moon-temple-contract.md).
- Та же feature/fortuna-demo-slots и [draftPR№1](https://github.com/kirill120095/moon-clicker/pull/1), безmain/merge/deploy.
-307/307 **текущих** тестов, включая13 новыхtest-items сценариев; число случайно совпало со старой7×1версией, еёRTP/утверждения не переносятся.
- Проверен pipeline на явном QAfixture: debit10→line1moon5→тестовыйitem→новыйэкземпляр изsave сохраняетquantity1 без повторнойвыдачи→reset1000/emptybag толькоtest.
- Nativebrowser reload/полный художественный проход ещё не объявлены выполненными. Если Storage недоступен, UI честно показывает session-only.
- Реальные осколки, аккаунты, backend и основнойинвентарь не затронуты. Демо не конвертируется вreal. Нетэффектов/слияния/покупок ячеек.

Текущая [публичнаяссылка](https://hyperagent.com/s/Vadvg2PkiFTR58AaKf5Aeg) пока остаётся предыдущим отключённымwireframe, **не завершённымtestdemo этого этапа**. Обновить тот жеartifact нужно после подключения candidate mapping+SVG и фактического браузерного прогона, не создавать дубль.
