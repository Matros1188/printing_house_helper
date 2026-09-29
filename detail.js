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
    "qty", "streams", "width", "height", "web", "repeat", "gsm", "waste",
    "matPrice", "colors", "inkPrice", "inkUse", "overhead", "admin",
    "markup", "minimum", "lam", "die", "lamEnabled", "dieEnabled"
  ];
  return Object.fromEntries(ids.map(id => [id, fieldValue(id)]));
}

function applySnapshot(snapshot) {
  const data = snapshot || {};
  const inputs = data.inputs || {};

  if (data.machineId) {
    window.PRINTCALC_PENDING_MACHINE_ID = data.machineId;
  }

  Object.entries(inputs).forEach(([id, value]) => {
    const el = $(id);
    if (!el || value === undefined || value === null) return;
    if (el.type === "checkbox") el.checked = Boolean(value);
    else el.value = value;
  });

  updateOperationStates();
}

function selectedMachine() {
  const id = $("machineSelect")?.value || "";
  return window.PRINTCALC_MACHINES?.getById?.(id) || null;
}

function buildTitle(qty, width, height, machine) {
  const size = width && height ? `${fmt(width)}×${fmt(height)} мм` : "Без размера";
  return `${fmt(qty)} шт · ${size}${machine ? ` · ${machine.name}` : ""}`;
}

function updateOperationStates() {
  const lam = $("lam");
  const die = $("die");
  const lamOn = Boolean($("lamEnabled")?.checked);
  const dieOn = Boolean($("dieEnabled")?.checked);

  if (lam) lam.disabled = !lamOn;
  if (die) die.disabled = !dieOn;
}

function showNoMachine() {
  const result = $("result");
  if (!result) return;

  result.innerHTML = `
    <div class="pc-empty-result">
      <span class="pc-empty-result-icon">⚙</span>
      <div>
        <span>ПРОИЗВОДСТВО</span>
        <h2>Выберите ваш станок</h2>
        <p>Расчёт использует только параметры станков из раздела «Мои станки».</p>
      </div>
      <a href="./#my-machines">Добавить или выбрать станок →</a>
    </div>
  `;
}

function renderResult(data) {
  const {
    qty,
    width,
    height,
    machineName,
    price,
    fullCost,
    meters,
    area,
    materialKg,
    setup,
    printMinutes,
    productionHours,
    machineCost,
    laborCost,
    electricityCost,
    materialCost,
    inkCost,
    lamCost,
    dieCost,
    overheadCost,
    adminCost,
    profit,
    margin,
    pricePer1000,
    pricePerM2,
    title
  } = data;

  $("result").innerHTML = `
    <div class="result-top pc-result-header">
      <div>
        <span class="pc-result-kicker">ЭКОНОМИКА ГОТОВА</span>
        <h2>Полная структура заказа</h2>
        <small class="pc-result-title">${title}</small>
      </div>
      <span class="pc-ready-badge">РАСЧЁТ ГОТОВ</span>
    </div>

    <div class="pc-selected-machine-result">
      <span>Мой станок</span>
      <b>${machineName}</b>
    </div>

    <div class="price-grid pc-price-grid-v13">
      <div class="price-box main pc-price-main">
        <span>Цена продажи</span>
        <b>${rub(price)}</b>
        <small>${rub(pricePer1000)} / 1000 шт.</small>
      </div>
      <div class="price-box pc-cost-box">
        <span>Себестоимость</span>
        <b>${rub(fullCost)}</b>
        <small>${rub(pricePerM2)} / м²</small>
      </div>
    </div>

    <div class="pc-margin-row">
      <div>
        <span>Маржинальность</span>
        <b>${margin.toFixed(1)}%</b>
      </div>
      <div>
        <span>Прибыль</span>
        <b>${rub(profit)}</b>
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
      <div class="stat"><span>Размер</span><b>${fmt(width)}×${fmt(height)} мм</b></div>
      <div class="stat"><span>Материал</span><b>${fmt(materialKg)} кг</b></div>
      <div class="stat"><span>Всего времени</span><b>${productionHours.toFixed(1)} ч</b></div>
    </div>

    <div class="pc-time-breakdown">
      <div class="pc-time-heading"><span>Время производства</span><b>${productionHours.toFixed(1)} ч</b></div>
      <div class="pc-time-bar"><span style="width:${Math.min(100, ((setup / Math.max(1, setup + printMinutes)) * 100))}%"></span></div>
      <div class="pc-time-legend"><span>Наладка · ${fmt(setup)} мин</span><span>Печать · ${fmt(printMinutes)} мин</span></div>
    </div>

    <div class="pc-breakdown-card">
      <div class="pc-breakdown-head"><span>Структура себестоимости</span><small>Внутренний расчёт</small></div>
      <div class="breakdown pc-breakdown-grid">
        <div><span>Материал</span><b>${rub(materialCost)}</b></div>
        <div><span>Краска</span><b>${rub(inkCost)}</b></div>
        <div><span>Машина</span><b>${rub(machineCost)}</b></div>
        <div><span>Работа</span><b>${rub(laborCost)}</b></div>
        <div><span>Электроэнергия</span><b>${rub(electricityCost)}</b></div>
        <div><span>Ламинация</span><b>${rub(lamCost)}</b></div>
        <div><span>Вырубка</span><b>${rub(dieCost)}</b></div>
        <div><span>Накладные</span><b>${rub(overheadCost)}</b></div>
        <div><span>Административные</span><b>${rub(adminCost)}</b></div>
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
    saveBtn.textContent = "Расчёт сохранён";
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
  const machine = selectedMachine();
  if (!machine) {
    showNoMachine();
    return;
  }

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

  const speed = Math.max(1, num("speed"));
  const power = Math.max(0, num("power"));
  const powerRate = Math.max(0, num("powerRate"));
  const setup = Math.max(0, num("setup"));
  const machineRate = Math.max(0, num("machine"));
  const labor = Math.max(0, num("labor"));

  const lamRate = Math.max(0, num("lam"));
  const dieRate = Math.max(0, num("die"));
  const lamEnabled = Boolean($("lamEnabled")?.checked);
  const dieEnabled = Boolean($("dieEnabled")?.checked);

  const overheadRate = Math.max(0, num("overhead"));
  const adminRate = Math.max(0, num("admin"));
  const markupRate = Math.max(0, num("markup"));
  const minimum = Math.max(0, num("minimum"));

  const repeats = Math.ceil(qty / streams);
  const meters = repeats * repeat / 1000 * (1 + waste / 100);
  const area = meters * web / 1000;
  const materialKg = area * gsm / 1000;
  const inkKg = area * colors * inkUse / 1000;

  const materialCost = materialKg * matPrice;
  const inkCost = inkKg * inkPrice;

  const printMinutes = meters / speed;
  const totalMinutes = setup + printMinutes;
  const productionHours = totalMinutes / 60;

  const machineCost = productionHours * machineRate;
  const laborCost = productionHours * labor;
  const electricityCost = productionHours * power * powerRate;
  const lamCost = lamEnabled ? area * lamRate : 0;
  const dieCost = dieEnabled ? qty / 1000 * dieRate : 0;

  const direct =
    materialCost +
    inkCost +
    machineCost +
    laborCost +
    electricityCost +
    lamCost +
    dieCost;

  const overheadCost = direct * overheadRate / 100;
  const adminCost = (direct + overheadCost) * adminRate / 100;
  const fullCost = direct + overheadCost + adminCost;
  const calculatedPrice = fullCost * (1 + markupRate / 100);
  const price = Math.max(minimum, calculatedPrice);
  const profit = price - fullCost;
  const margin = price > 0 ? profit / price * 100 : 0;
  const pricePer1000 = qty > 0 ? price / qty * 1000 : 0;
  const pricePerM2 = area > 0 ? price / area : 0;
  const title = buildTitle(qty, width, height, machine);

  const snapshot = {
    mode: "detail",
    title,
    machineId: machine.id,
    machineName: machine.name,
    inputs: snapshotInputs(),
    summary: {
      qty,
      width,
      height,
      machineName: machine.name,
      price,
      fullCost,
      meters,
      area,
      materialKg,
      setup,
      printMinutes,
      productionHours,
      machineCost,
      laborCost,
      electricityCost,
      materialCost,
      inkCost,
      lamCost,
      dieCost,
      overheadCost,
      adminCost,
      profit,
      margin,
      pricePer1000,
      pricePerM2
    }
  };

  window.PRINTCALC_LAST_CALC = snapshot;
  renderResult(snapshot.summary);
}

function setupAutoCalculation() {
  const ids = [
    "qty", "streams", "width", "height", "web", "repeat", "gsm", "waste",
    "matPrice", "colors", "inkPrice", "inkUse", "overhead", "admin",
    "markup", "minimum", "lam", "die", "lamEnabled", "dieEnabled"
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

window.addEventListener("printcalc:machine-selected", () => {
  updateOperationStates();
  calculate();
});

window.addEventListener("printcalc:machines-ready", () => {
  updateOperationStates();
  calculate();
});

window.addEventListener("printcalc:load-snapshot", event => {
  if (event.detail?.mode && event.detail.mode !== "detail") return;
  applySnapshot(event.detail);
  window.setTimeout(calculate, 120);
});

updateOperationStates();
setupAutoCalculation();
