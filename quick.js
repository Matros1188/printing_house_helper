"use strict";

const $ = id => document.getElementById(id);

const num = id => {
  const element = $(id);
  if (!element) return 0;
  const value = Number(element.value);
  return Number.isFinite(value) ? value : 0;
};

const rub = value =>
  Math.round(value).toLocaleString("ru-RU") + " ₽";

const fmt = value =>
  Number(value || 0).toLocaleString("ru-RU", {
    maximumFractionDigits: 2
  });

function fieldValue(id) {
  const el = $(id);
  if (!el) return "";
  return el.type === "checkbox" ? el.checked : el.value;
}

function snapshotInputs() {
  const ids = [
    "customerName", "qty", "streams", "width", "height", "web", "repeat", "gsm", "waste",
    "matPrice", "colors", "inkPrice", "inkUse", "lam", "die"
  ];
  return Object.fromEntries(ids.map(id => [id, fieldValue(id)]));
}

function applySnapshot(snapshot) {
  const inputs = snapshot?.inputs || snapshot || {};
  Object.entries(inputs).forEach(([id, value]) => {
    const el = $(id);
    if (!el || value === undefined || value === null) return;
    if (el.type === "checkbox") el.checked = Boolean(value);
    else el.value = value;
  });
}

function buildTitle(qty, width, height) {
  const size = width && height ? `${fmt(width)}×${fmt(height)} мм` : "Без размера";
  return `${fmt(qty)} шт · ${size}`;
}

function renderResult(data) {
  const {
    qty,
    price,
    total,
    meters,
    area,
    materialKg,
    setup,
    runMinutes,
    printCost,
    materialCost,
    inkCost,
    lamCost,
    dieCost,
    margin,
    pricePer1000,
    pricePerM2,
    title
  } = data;

  $("result").innerHTML = `
    <div class="result-top pc-result-header">
      <div>
        <span class="pc-result-kicker">РАСЧЁТ ГОТОВ</span>
        <h2>Ориентир по заказу</h2>
        <small class="pc-result-title">${title}</small>
      </div>
      <span class="pc-ready-badge">ГОТОВО</span>
    </div>

    <div class="price-grid pc-price-grid-v13">
      <div class="price-box main pc-price-main">
        <span>Цена клиенту</span>
        <b>${rub(price)}</b>
        <small>${rub(pricePer1000)} / 1000 шт.</small>
      </div>
      <div class="price-box pc-cost-box">
        <span>Себестоимость</span>
        <b>${rub(total)}</b>
        <small>${rub(pricePerM2)} / м²</small>
      </div>
    </div>

    <div class="pc-margin-row">
      <div>
        <span>Маржинальность</span>
        <b>${margin.toFixed(1)}%</b>
      </div>
      <div>
        <span>Метраж</span>
        <b>${fmt(meters)} м</b>
      </div>
      <div>
        <span>Площадь</span>
        <b>${fmt(area)} м²</b>
      </div>
    </div>

    <div class="stat-grid pc-stat-grid-v13">
      <div class="stat"><span>Тираж</span><b>${fmt(qty)} шт.</b></div>
      <div class="stat"><span>Материал</span><b>${fmt(materialKg)} кг</b></div>
      <div class="stat"><span>Наладка</span><b>${fmt(setup)} мин</b></div>
      <div class="stat"><span>Печать</span><b>${fmt(runMinutes)} мин</b></div>
      <div class="stat"><span>Всего</span><b>${((setup + runMinutes) / 60).toFixed(1)} ч</b></div>
    </div>

    <div class="pc-time-breakdown">
      <div class="pc-time-heading"><span>Время производства</span><b>${((setup + runMinutes) / 60).toFixed(1)} ч</b></div>
      <div class="pc-time-bar"><span style="width:${Math.min(100, ((setup / Math.max(1, setup + runMinutes)) * 100))}%"></span></div>
      <div class="pc-time-legend"><span>Наладка · ${fmt(setup)} мин</span><span>Печать · ${fmt(runMinutes)} мин</span></div>
    </div>

    <div class="pc-breakdown-card">
      <div class="pc-breakdown-head"><span>Структура себестоимости</span><small>Внутренний расчёт</small></div>
      <div class="breakdown pc-breakdown-grid">
        <div><span>Материал</span><b>${rub(materialCost)}</b></div>
        <div><span>Краска</span><b>${rub(inkCost)}</b></div>
        <div><span>Печать</span><b>${rub(printCost)}</b></div>
        <div><span>Ламинация</span><b>${rub(lamCost)}</b></div>
        <div><span>Вырубка</span><b>${rub(dieCost)}</b></div>
      </div>
    </div>

    <div class="pc-result-actions">
      <button type="button" class="pc-result-btn primary" data-action="save-calculation">Сохранить расчёт</button>
      <button type="button" class="pc-result-btn" data-action="copy-price">Скопировать цену</button>
      <button type="button" class="pc-result-btn" data-action="pdf-proposal">КП в PDF</button>
    </div>
  `;

  const saveBtn = $("result").querySelector('[data-action="save-calculation"]');
  const copyBtn = $("result").querySelector('[data-action="copy-price"]');
  const pdfBtn = $("result").querySelector('[data-action="pdf-proposal"]');

  saveBtn?.addEventListener("click", () => {
    window.dispatchEvent(new CustomEvent("printcalc:save-request", {
      detail: window.PRINTCALC_LAST_CALC
    }));
});

  copyBtn?.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(String(Math.round(price)) + " ₽");
      copyBtn.textContent = "Цена скопирована";
      setTimeout(() => copyBtn.textContent = "Скопировать цену", 1600);
    } catch (error) {
      copyBtn.textContent = rub(price);
    }
  });

  pdfBtn?.addEventListener("click", () => {
    if (typeof window.PRINTCALC_GENERATE_PDF === "function") {
      window.PRINTCALC_GENERATE_PDF(window.PRINTCALC_LAST_CALC);
    }
  });
}

function calculate() {
  const qty = Math.max(1, num("qty"));
  const streams = Math.max(1, num("streams"));
  const width = Math.max(1, num("width"));
  const height = Math.max(1, num("height"));
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
  const runMinutes = meters / speed;
  const printCost = 2300 + (setup + runMinutes) / 60 * 3500;
  const lamCost = $("lam")?.checked ? area * 19 + 850 : 0;
  const dieCost = $("die")?.checked ? 1800 + qty * 0.028 : 0;

  const total = materialCost + inkCost + printCost + lamCost + dieCost;

  let markup = 0.30;
  if (qty < 5000) markup = 0.52;
  else if (qty < 15000) markup = 0.43;
  else if (qty < 50000) markup = 0.36;

  let price = Math.max(6500, total * (1 + markup));
  price = Math.ceil(price / 100) * 100;

  const pricePer1000 = qty > 0 ? price / qty * 1000 : 0;
  const pricePerM2 = area > 0 ? price / area : 0;
  const margin = price > 0 ? ((price - total) / price) * 100 : 0;
  const title = buildTitle(qty, width, height);

  const snapshot = {
    mode: "quick",
    title,
    inputs: snapshotInputs(),
    summary: {
      qty,
      width,
      height,
      price,
      total,
      meters,
      area,
      materialKg,
      setup,
      runMinutes,
      printCost,
      materialCost,
      inkCost,
      lamCost,
      dieCost,
      pricePer1000,
      pricePerM2,
      margin
    }
  };

  window.PRINTCALC_LAST_CALC = snapshot;
  renderResult(snapshot.summary);

  if (window.PRINTCALC_LAST_CALC) {
    window.PRINTCALC_LAST_CALC.result_text = (document.getElementById("result")?.innerText || "").trim();
    window.dispatchEvent(new CustomEvent("printcalc:calculated", {
      detail: window.PRINTCALC_LAST_CALC
    }));
  }
}

function setupAutoCalculation() {
  const ids = [
    "qty", "streams", "width", "height", "web", "repeat", "gsm", "waste",
    "matPrice", "colors", "inkPrice", "inkUse", "lam", "die"
  ];

  let timer = null;
  const schedule = () => {
    clearTimeout(timer);
    timer = setTimeout(calculate, 220);
  };

  ids.forEach(id => {
    $(id)?.addEventListener("input", schedule);
    $(id)?.addEventListener("change", schedule);
  });

  $("calc")?.addEventListener("click", calculate);
}

window.addEventListener("printcalc:load-snapshot", event => {
  if (event.detail?.mode && event.detail.mode !== "quick") return;
  applySnapshot(event.detail);
  calculate();
});

setupAutoCalculation();
calculate();
