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
  const base = Object.fromEntries(ids.map(id => [id, fieldValue(id)]));
  base.repeatInput = fieldValue("repeat");
  base.repeatMm = window.PRINTORA_REPEAT_MM?.(fieldValue("repeat")) || 0;
  base.repeatUnit = window.PRINTORA_PARSE_REPEAT?.(fieldValue("repeat"))?.unit || "mm";
  base.material = window.PRINTORA_MATERIAL || null;
  base.materialId = window.PRINTORA_MATERIAL?.id || "";
  base.materialName = window.PRINTORA_MATERIAL?.name || "";
  return base;
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
  const hasStarted = ["qty","streams","width","height","web","repeat","gsm","matPrice","colors","inkPrice","inkUse"].some(id => String(document.getElementById(id)?.value || "").trim() !== "");
  if (!hasStarted) return;
  const qty = Math.max(1, Number(document.getElementById("qty")?.value || 0));
  const streams = Math.floor(Number(document.getElementById("streams")?.value || 0));
  const width = Number(document.getElementById("width")?.value || 0);
  const height = Number(document.getElementById("height")?.value || 0);
  const web = Number(document.getElementById("web")?.value || 0);
  const repeat = Number(window.PRINTORA_REPEAT_MM?.(document.getElementById("repeat")?.value) || 0);
  const gsm = Number(document.getElementById("gsm")?.value || 0);
  const waste = Number(document.getElementById("waste")?.value || 0);
  const matPrice = Number(window.PRINTORA_MATERIAL_PRICE?.() || document.getElementById("matPrice")?.value || 0);
  const colors = Math.floor(Number(document.getElementById("colors")?.value || 0));
  const inkPrice = Number(document.getElementById("inkPrice")?.value || 0);
  const inkUse = Number(document.getElementById("inkUse")?.value || 0);
  const extraMarkup = Math.max(0, Number(document.getElementById("markup")?.value || 0));
  if (window.PRINTORA_SAFETY) {
    const valid = window.PRINTORA_SAFETY.validateCommon({allowEmpty:false});
    if (!valid.ok) { window.PRINTORA_SAFETY?.friendlyError && window.PRINTORA_TOAST?.(valid.errors[0], "error"); const r=document.getElementById("result"); if(r) r.innerHTML=`<div class="printora-safety-error-v40"><strong>Расчёт остановлен</strong><ul>${valid.errors.map(x=>`<li>${x}</li>`).join("")}</ul></div>`; return; }
  }
  const repeats = Math.ceil(qty / streams);
  const meters = repeats * repeat / 1000 * (1 + waste / 100);
  const area = meters * web / 1000;
  const materialKg = area * gsm / 1000;
  const inkKg = area * colors * inkUse / 1000;
  const materialCost = area * matPrice;
  const inkCost = inkKg * inkPrice;
  const setup = 25 + colors * 4;
  const speed = Math.max(35, 85 - colors * 3);
  const runMinutes = meters / speed;
  const fixedPrintCost = 2300 + setup / 60 * 3500;
  const variablePrintCost = runMinutes / 60 * 3500;
  const lamEnabled = Boolean(document.getElementById("lam")?.checked);
  const dieEnabled = Boolean(document.getElementById("die")?.checked);
  const lamCost = lamEnabled ? Math.max(0, Number(document.getElementById("lamPrice")?.value || 0)) : 0;
  const cutCost = dieEnabled ? Math.max(0, Number(document.getElementById("diePrice")?.value || 0)) : 0;
  const volumeMarkup = window.PRINTORA_SAFETY?.smoothVolumeMarkup?.(qty) ?? 30;
  const markupRate = volumeMarkup + extraMarkup;
  const variableLam = lamEnabled ? area * 19 : 0;
  const variableCut = dieEnabled ? qty * 0.028 : 0;
  const fixedCost = fixedPrintCost + lamCost + cutCost;
  const variableCost = materialCost + inkCost + variablePrintCost + variableLam + variableCut;
  const total = fixedCost + variableCost;
  const markupAmount = total * markupRate / 100;
  const price = Math.ceil(Math.max(6500, fixedCost * 1.30 + variableCost * (1 + markupRate / 100)) / 100) * 100;
  const selected = window.PRINTORA_MATERIAL || null;
  const customerName = String(document.getElementById("customer")?.value || document.getElementById("customerName")?.value || "").trim();
  const calc = {mode:"quick", customerName, qty, streams, width, height, web, repeat, repeat_mm:repeat, gsm, waste, colors, matPrice, inkPrice, inkUse, meters, area, materialKg, inkKg, materialCost, inkCost, printHours:(setup+runMinutes)/60, printCost:fixedPrintCost+variablePrintCost, lamCost, cutCost, lamEnabled, dieEnabled, volumeMarkup, extraMarkup, markupRate, markupAmount, total, price, materialId:selected?.id||"", materialName:selected?.name||"", layout:window.PRINTORA_SAFETY?.getLayout?.({width,streams,materialWidth:web})||{}, summary:{total,price,meters,area,materialKg,inkKg,printHours:(setup+runMinutes)/60}, inputs:{qty,streams,width,height,web,repeat,repeat_mm:repeat,gsm,waste,colors,matPrice,inkPrice,inkUse,markup:extraMarkup,lam:lamEnabled,die:dieEnabled,materialId:selected?.id||"",materialName:selected?.name||"",customer:customerName}, __printora_v40:true};
  const result=document.getElementById("result");
  const rub=v=>Math.round(v||0).toLocaleString("ru-RU")+" ₽";
  if(result) result.innerHTML=`<div class="result-top"><div><span>РАСЧЁТ ГОТОВ</span><h2>Ориентир по заказу</h2></div></div><div class="price-grid"><div class="price-box main"><span>Цена клиенту</span><b>${rub(calc.price)}</b></div><div class="price-box"><span>Себестоимость</span><b>${rub(calc.total)}</b></div></div><div class="stat-grid"><div class="stat"><span>Тираж</span><b>${calc.qty.toLocaleString("ru-RU")} шт.</b></div><div class="stat"><span>Метраж</span><b>${calc.meters.toFixed(1)} м</b></div><div class="stat"><span>Материал</span><b>${calc.materialKg.toFixed(2)} кг</b></div><div class="stat"><span>Время печати</span><b>${calc.printHours.toFixed(1)} ч</b></div></div><div class="breakdown"><div><span>Материал</span><b>${rub(calc.materialCost)}</b></div><div><span>Краска</span><b>${rub(calc.inkCost)}</b></div><div><span>Печать</span><b>${rub(calc.printCost)}</b></div><div><span>Ламинация</span><b>${rub(calc.lamCost)}</b></div><div><span>Вырубка</span><b>${rub(calc.cutCost)}</b></div><div><span>Объёмная наценка</span><b>${volumeMarkup.toFixed(1)}%</b></div><div><span>Доп. наценка</span><b>${extraMarkup.toFixed(1)}%</b></div></div><div class="printora-result-source-v40">${calc.materialName?`Материал: ${calc.materialName}`:"Материал введён вручную"} · ${calc.streams} ручьёв · раппорт ${calc.repeat.toLocaleString("ru-RU")} мм</div><div class="printora-quick-next-v40"><button type="button" class="printora-detail-transfer-v40">ПЕРЕВЕСТИ В ДЕТАЛЬНЫЙ РАСЧЁТ →</button></div>`;
  window.PRINTCALC_LAST_CALC=calc;
  window.currentQuickCalculation=calc;
  document.querySelector(".printora-detail-transfer-v40")?.addEventListener("click",()=>{try{localStorage.setItem("printora_quick_to_detail_v40",JSON.stringify(calc));}catch(_){} window.location.href="./detail.html?from=quick";});
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
