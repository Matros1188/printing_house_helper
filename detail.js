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
    "matPrice", "colors", "inkPrice", "inkUse", "overhead", "admin",
    "markup", "minimum", "lam", "die", "lamEnabled", "dieEnabled"
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
  if (!hasStarted && !String(document.getElementById("machineSelect")?.value || "").trim()) return;
  const valid = window.PRINTORA_SAFETY?.validateDetail ? window.PRINTORA_SAFETY.validateDetail() : {ok:true,errors:[],repeat:Number(window.PRINTORA_REPEAT_MM?.(document.getElementById("repeat")?.value)||0)};
  if (!valid.ok) { const r=document.getElementById("result"); if(r) r.innerHTML=`<div class="printora-safety-error-v40"><strong>Расчёт остановлен</strong><ul>${valid.errors.map(x=>`<li>${x}</li>`).join("")}</ul></div>`; window.PRINTORA_TOAST?.(valid.errors[0],"error"); return; }
  const $id=id=>document.getElementById(id); const n=id=>Number($id(id)?.value||0); const qty=n("qty"); const streams=Math.floor(n("streams")); const width=n("width"); const height=n("height"); const web=n("web"); const repeat=valid.repeat||Number(window.PRINTORA_REPEAT_MM?.($id("repeat")?.value)||0); const gsm=n("gsm"); const waste=n("waste"); const matPrice=Number(window.PRINTORA_MATERIAL_PRICE?.()||n("matPrice")); const colors=Math.floor(n("colors")); const inkPrice=n("inkPrice"); const inkUse=n("inkUse"); const speed=n("speed"); const power=n("power"); const setup=Math.max(0,n("setup")); const machineRate=n("machine"); const laborRate=n("labor"); const powerRate=n("powerRate"); const lamEnabled=Boolean($id("lamEnabled")?.checked); const dieEnabled=Boolean($id("dieEnabled")?.checked); const lamRate=n("lam"); const dieRate=n("die"); const overhead=Math.max(0,n("overhead")); const admin=Math.max(0,n("admin")); const markup=Math.max(0,n("markup")); const minPrice=Math.max(0,n("minPrice")); const repeats=Math.ceil(qty/streams); const meters=repeats*repeat/1000*(1+waste/100); const area=meters*web/1000; const materialKg=area*gsm/1000; const inkKg=area*colors*inkUse/1000; const materialCost=area*matPrice; const inkCost=inkKg*inkPrice; const printMinutes=meters/speed; const printHours=(setup+printMinutes)/60; const machineCost=printHours*machineRate; const laborCost=printHours*laborRate; const electricCost=printHours*power*powerRate; const lamCost=lamEnabled?lamRate:0; const dieCost=dieEnabled?dieRate:0; const direct=materialCost+inkCost+machineCost+laborCost+electricCost+lamCost+dieCost; const overheadCost=direct*overhead/100; const adminCost=direct*admin/100; const total=direct+overheadCost+adminCost; const markupAmount=total*markup/100; const price=Math.ceil(Math.max(minPrice,total+markupAmount)/100)*100; const machineId=String($id("machineSelect")?.value||""); const machine=machineId&&window.PRINTCALC_MACHINES?.getById?window.PRINTCALC_MACHINES.getById(machineId):null; const selected=window.PRINTORA_MATERIAL||null; const customerName=String($id("customer")?.value||$id("customerName")?.value||"").trim(); const calc={mode:"detail",customerName,qty,streams,width,height,web,repeat,repeat_mm:repeat,gsm,waste,colors,matPrice,inkPrice,inkUse,meters,area,materialKg,inkKg,materialCost,inkCost,speed,power,setup,printMinutes,printHours,machineCost,laborCost,electricCost,lamCost,dieCost,overheadCost,adminCost,markupRate:markup,markupAmount,total,price,lamEnabled,dieEnabled,machineId:machine?.id||machineId,machineName:machine?.name||"",materialId:selected?.id||"",materialName:selected?.name||"",layout:valid.layout||{},summary:{total,price,meters,area,materialKg,inkKg,printHours},inputs:{qty,streams,width,height,web,repeat,repeat_mm:repeat,gsm,waste,colors,matPrice,inkPrice,inkUse,markup,lam:lamEnabled,die:dieEnabled,materialId:selected?.id||"",materialName:selected?.name||"",machineId:machine?.id||machineId,machineName:machine?.name||"",speed,power,setup,machine:machineRate,labor:laborRate,powerRate,overhead,admin,minimum:minPrice},__printora_v40:true}; const result=$id("result"); const rub=v=>Math.round(v||0).toLocaleString("ru-RU")+" ₽"; if(result) result.innerHTML=`<div class="result-top"><div><span>РАСЧЁТ ГОТОВ</span><h2>Детальный расчёт</h2></div></div><div class="price-grid"><div class="price-box main"><span>Цена клиенту</span><b>${rub(calc.price)}</b></div><div class="price-box"><span>Себестоимость</span><b>${rub(calc.total)}</b></div></div><div class="stat-grid"><div class="stat"><span>Тираж</span><b>${calc.qty.toLocaleString("ru-RU")} шт.</b></div><div class="stat"><span>Метраж</span><b>${calc.meters.toFixed(1)} м</b></div><div class="stat"><span>Материал</span><b>${calc.materialKg.toFixed(2)} кг</b></div><div class="stat"><span>Время</span><b>${calc.printHours.toFixed(2)} ч</b></div></div><div class="breakdown"><div><span>Материал</span><b>${rub(calc.materialCost)}</b></div><div><span>Краска</span><b>${rub(calc.inkCost)}</b></div><div><span>Станок</span><b>${rub(calc.machineCost)}</b></div><div><span>Работа</span><b>${rub(calc.laborCost)}</b></div><div><span>Электроэнергия</span><b>${rub(calc.electricCost)}</b></div><div><span>Ламинация</span><b>${rub(calc.lamCost)}</b></div><div><span>Вырубка</span><b>${rub(calc.dieCost)}</b></div><div><span>Накладные</span><b>${rub(calc.overheadCost+calc.adminCost)}</b></div><div><span>Наценка ${markup.toFixed(1)}%</span><b>${rub(calc.markupAmount)}</b></div></div><div class="printora-result-source-v40">${calc.materialName?`Материал: ${calc.materialName}`:"Материал введён вручную"}${calc.machineName?` · Станок: ${calc.machineName}`:""} · ${calc.streams} ручьёв · раппорт ${calc.repeat.toLocaleString("ru-RU")} мм</div>`; window.PRINTCALC_LAST_CALC=calc; window.currentDetailCalculation=calc; }

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
