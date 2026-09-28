"use strict";

const $ = id => document.getElementById(id);

const num = id => {
  const v = Number($(id).value);
  return Number.isFinite(v) ? v : 0;
};

const rub = v =>
  Math.round(v).toLocaleString("ru-RU") + " ₽";

function calculate() {

  const qty = Math.max(1, num("qty"));
  const streams = Math.max(1, num("streams"));
  const width = Math.max(1, num("width"));
  const web = Math.max(width, num("web"));
  const repeat = Math.max(1, num("repeat"));
  const gsm = Math.max(1, num("gsm"));
  const waste = Math.max(0, num("waste"));
  const matPrice = Math.max(0, num("matPrice"));
  const colors = Math.max(1, num("colors"));
  const inkPrice = Math.max(0, num("inkPrice"));
  const inkUse = Math.max(0, num("inkUse"));

  const repeats = Math.ceil(qty / streams);
  const meters = repeats * repeat / 1000 * (1 + waste / 100);
  const area = meters * web / 1000;

  const materialKg = area * gsm / 1000;
  const inkKg = area * colors * inkUse / 1000;

  const materialCost = materialKg * matPrice;
  const inkCost = inkKg * inkPrice;

  const setup = 25 + colors * 4;
  const speed = Math.max(35, 85 - colors * 3);
  const runMinutes = meters / speed * 60;
  const printCost = 2300 + (setup + runMinutes) / 60 * 3500;

  const lamCost = $("lam").checked ? area * 19 + 850 : 0;
  const dieCost = $("die").checked ? 1800 + qty * 0.028 : 0;

  const total = materialCost + inkCost + printCost + lamCost + dieCost;

  let markup = 0.30;

  if (qty < 5000) markup = 0.52;
  else if (qty < 15000) markup = 0.43;
  else if (qty < 50000) markup = 0.36;

  let price = Math.max(6500, total * (1 + markup));
  price = Math.ceil(price / 100) * 100;

  $("result").innerHTML = `
    <div class="result-top">
      <div>
        <span>РАСЧЁТ ГОТОВ</span>
        <h2>Ориентир по заказу</h2>
      </div>
    </div>

    <div class="price-grid">
      <div class="price-box main">
        <span>Цена клиенту</span>
        <b>${rub(price)}</b>
      </div>

      <div class="price-box">
        <span>Себестоимость</span>
        <b>${rub(total)}</b>
      </div>
    </div>

    <div class="stat-grid">
      <div class="stat"><span>Тираж</span><b>${qty.toLocaleString("ru-RU")} шт.</b></div>
      <div class="stat"><span>Метраж</span><b>${meters.toFixed(1)} м</b></div>
      <div class="stat"><span>Материал</span><b>${materialKg.toFixed(2)} кг</b></div>
      <div class="stat"><span>Время печати</span><b>${((setup + runMinutes) / 60).toFixed(1)} ч</b></div>
    </div>

    <div class="breakdown">
      <div><span>Материал</span><b>${rub(materialCost)}</b></div>
      <div><span>Краска</span><b>${rub(inkCost)}</b></div>
      <div><span>Печать</span><b>${rub(printCost)}</b></div>
      <div><span>Ламинация</span><b>${rub(lamCost)}</b></div>
      <div><span>Вырубка</span><b>${rub(dieCost)}</b></div>
    </div>

    <div class="note">
      Быстрый расчёт предназначен для предварительной оценки заказа менеджером.
    </div>
  `;
}

$("calc").addEventListener("click", calculate);
calculate();
