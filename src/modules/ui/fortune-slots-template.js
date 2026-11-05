import { LUNAR_HTML } from './lunar-temple-runtime.mjs';
// LUNAR_HTML already contains both original SVG blocks. Add only integration controls.
const controls=`
<div class="lt-extension">
  <p class="lt-save-status" data-mt-storage role="status"></p>
  <div class="lt-extra-controls"><button type="button" data-mt-minus aria-label="Уменьшить ставку">−</button><span data-mt-stake-label>Ставка</span><button type="button" data-mt-plus aria-label="Увеличить ставку">+</button><button type="button" data-mt-reset>Сбросить демо: фишки и предметы</button></div>
  <details class="lt-bag" data-mt-bag-panel><summary data-mt-inventory-title>Тестовый инвентарь</summary><p data-mt-bag-status></p><ul data-mt-bag></ul></details>
  <details class="lt-rules"><summary>i · Правила и награды</summary><div data-mt-rules-copy></div><p>5×3, 10 фиксированных линий, совпадения слева от первого барабана. WILD заменяет обычные символы, не SCATTER. Одна партия за лучшую линию всего поля, не за каждую линию.</p><p>Цепь 3/4/5 → уровень 1/2/3. Ставки 10/20/50/100 → количество 1/2/5/10. Только тестовая «Реликвия храма · ДЕМО», без статов, экипировки или слияния.</p><p>3+ SCATTER в обычном вращении дают 10 бесплатных, вручную по одному. Free: списание 0, количество по ставке триггера; без прямого scatter-предмета и retrigger.</p></details>
  <label class="lt-fixture" data-mt-fixture-wrap hidden>Явный QA-сценарий, не обычный исход<select data-mt-fixture><option value="">Обычный RNG</option></select></label>
  <dialog class="lt-reset-dialog" data-mt-reset-dialog aria-labelledby="ltResetTitle"><h3 id="ltResetTitle">Сбросить только это демо?</h3><p data-mt-reset-warning></p><button type="button" data-mt-reset-cancel>Отмена</button><button type="button" data-mt-reset-accept>Сбросить демо</button></dialog>
</div>`;
export const FORTUNE_SLOTS_HTML=LUNAR_HTML
  .replace('data-lunar-temple data-phase','data-lunar-temple data-mt-slots data-phase')
  .replace('data-lt-spin aria-label','data-lt-spin data-mt-spin aria-label')
  .replace('</div></section>',controls+'</div></section>');
