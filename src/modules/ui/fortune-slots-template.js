// Temporary technical wireframe only. Illustrated Moon Temple assets are pending.
export const FORTUNE_SLOTS_HTML = `
<section class="mt-slots" data-mt-slots aria-labelledby="mt-title">
  <header><p class="mt-stage">WIREFRAME · НЕ ФИНАЛЬНЫЙ ДИЗАЙН</p><h2 id="mt-title">Лунный храм · 5×3</h2></header>
  <p class="mt-warning" data-mt-warning>Ожидаются утверждённые полосы, paytable и иллюстрированный кабинет. Это технический каркас.</p>
  <p class="mt-migration" data-mt-migration hidden></p>
  <div class="mt-arena" aria-label="Пять барабанов, три строки, grid[reel][row]">
    <div class="mt-grid" data-mt-grid></div>
    <svg class="mt-lines" data-mt-lines viewBox="0 0 500 300" preserveAspectRatio="none" aria-hidden="true"></svg>
  </div>
  <p class="mt-line-info" data-mt-line-info>10 фиксированных линий · слева направо</p>
  <dl class="mt-ledger"><div><dt>Демо-фишки</dt><dd data-mt-balance>—</dd></div><div><dt>Общая ставка</dt><dd data-mt-stake>10</dd></div><div><dt>Gross</dt><dd data-mt-gross>—</dd></div><div><dt>Net</dt><dd data-mt-net>—</dd></div></dl>
  <p class="mt-bonus" data-mt-bonus>Бесплатных вращений: 0</p>
  <div class="mt-controls"><button type="button" data-mt-minus aria-label="Предыдущая общая ставка">−</button><button type="button" class="mt-spin" data-mt-spin disabled>SPIN</button><button type="button" data-mt-plus aria-label="Следующая общая ставка">+</button></div>
  <button type="button" class="mt-reset" data-mt-reset>Восстановить только демо до 1 000</button>
  <div class="mt-result" role="status" aria-live="polite" aria-atomic="true"><strong data-mt-title>Каркас</strong><p data-mt-detail></p></div>
  <label class="mt-fixture" data-mt-fixture-wrap hidden>ЯВНЫЙ TEST FIXTURE (не обычный исход)<select data-mt-fixture><option value="">Обычный RNG по тестовым лентам</option></select></label>
  <details class="mt-rules"><summary>i · Правила и таблица</summary>
    <p>10 линий всегда активны. Общая ставка: 10 / 20 / 50 / 100; ставка линии = общая / 10. Обычные 3–5 подряд оплачиваются только слева с первого барабана. На линию — один самый дорогой WILD-вариант, разные линии суммируются.</p>
    <p>WILD не заменяет SCATTER. 3+ SCATTER на всём поле дают 10 бесплатных вращений, без отдельной cash-выплаты, expanding и retrigger. Бесплатные запускаются вручную, списание 0, ставка триггера зафиксирована. Стандартные paid spins во время бонуса недоступны.</p>
    <p>Gross — начисление; net = начисление − фактическое списание. Возврат не больше общей ставки не показывается как чистый выигрыш. Демо-кошелёк не связан с основными ресурсами или прежним колесом ниже.</p>
    <div data-mt-paytable></div><ol data-mt-paylines></ol>
  </details>
  <p class="mt-storage" data-mt-storage></p>
</section>`;
