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
    "markup", "minimum", "lam", "die", "lamEnabled", "dieEnabled", "sideMargin", "labelGap", "extraCost", "materialSelect", "machineSelect"
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

function calculate(){
  const valid=window.PRINTORA_VALIDATE_DETAIL?.()||{ok:true,errors:[]};if(!valid.ok){window.PRINTORA_SHOW_CALC_ERRORS?.(valid.errors,"Проверьте заказ и производственные параметры");return;}
  const $id=id=>document.getElementById(id),n=id=>Number($id(id)?.value||0),qty=n("qty"),streams=Math.floor(n("streams")),width=n("width"),height=n("height"),web=n("web"),repeat=Number(valid.repeat||window.PRINTORA_REPEAT_MM?.($id("repeat")?.value)||0),gsm=n("gsm"),waste=n("waste"),matPrice=Number(valid.matPrice||window.PRINTORA_MATERIAL_PRICE?.()||n("matPrice")),colors=Math.floor(n("colors")),inkPrice=n("inkPrice"),inkUse=n("inkUse"),speed=n("speed"),power=n("power"),setup=Math.max(0,n("setup")),machineRate=n("machine"),laborRate=n("labor"),powerRate=n("powerRate"),lamEnabled=Boolean($id("lamEnabled")?.checked),dieEnabled=Boolean($id("dieEnabled")?.checked),lamRate=Math.max(0,n("lam")),dieRate=Math.max(0,n("die")),overhead=Math.max(0,n("overhead")),admin=Math.max(0,n("admin")),extraCost=Math.max(0,n("extraCost")),markup=Math.max(0,n("markup")),minPrice=Math.max(0,n("minimum"));
  const repeats=Math.ceil(qty/streams),meters=repeats*repeat/1000*(1+waste/100),area=meters*web/1000,materialKg=area*gsm/1000,inkKg=area*colors*inkUse/1000,materialCost=area*matPrice,inkCost=inkKg*inkPrice,printMinutes=meters/speed,printHours=(setup+printMinutes)/60,machineCost=printHours*machineRate,laborCost=printHours*laborRate,electricCost=printHours*power*powerRate,lamCost=lamEnabled?lamRate:0,dieCost=dieEnabled?dieRate:0,direct=materialCost+inkCost+machineCost+laborCost+electricCost+lamCost+dieCost,overheadCost=direct*overhead/100,adminCost=(direct+overheadCost)*admin/100,fullCost=direct+overheadCost+adminCost+extraCost,markupAmount=fullCost*markup/100,price=Math.ceil(Math.max(minPrice,fullCost+markupAmount)/100)*100,profit=price-fullCost,margin=price>0?profit/price*100:0;
  const machineId=String($id("machineSelect")?.value||""),machine=window.PRINTCALC_MACHINES?.getById?.(machineId)||null,selected=window.PRINTORA_MATERIAL||null,customer=String($id("customer")?.value||$id("customerName")?.value||"").trim();
  const calc={mode:"detail",customerName:customer,qty,streams,width,height,web,repeat,repeat_mm:repeat,gsm,waste,colors,matPrice,inkPrice,inkUse,meters,area,materialKg,inkKg,materialCost,inkCost,speed,power,setup,printMinutes,printHours,machineCost,laborCost,electricCost,lamCost,dieCost,overheadCost,adminCost,extraCost,fullCost,markupRate:markup,markupAmount,price,profit,margin,machineId:machine?.id||machineId,machineName:machine?.name||"",materialId:selected?.id||"",materialName:selected?.name||"",layout:valid.layout||{},inputs:{qty,streams,width,height,web,repeat,repeat_mm:repeat,gsm,waste,colors,matPrice,inkPrice,inkUse,markup,lam:lamEnabled,die:dieEnabled,lamEnabled,dieEnabled,sideMargin:n("sideMargin"),labelGap:n("labelGap"),overhead,admin,extraCost,minimum:minPrice,machineId:machine?.id||machineId,machineName:machine?.name||"",speed,power,setup,machine:machineRate,labor:laborRate,powerRate,materialId:selected?.id||"",customer},summary:{qty,price,fullCost,meters,area,materialKg,printHours,margin,profit},__printora_v40:true};
  window.PRINTCALC_LAST_CALC=calc;window.currentDetailCalculation=calc;
  const result=$id("result"),rub=v=>Math.round(v||0).toLocaleString("ru-RU")+" ₽";if(result)result.innerHTML=`<div class="result-top"><div><span>РАСЧЁТ ГОТОВ</span><h2>Детальный расчёт</h2></div></div><div class="price-grid"><div class="price-box main"><span>Цена клиенту</span><b>${rub(price)}</b></div><div class="price-box"><span>Себестоимость</span><b>${rub(fullCost)}</b></div></div><div class="stat-grid"><div class="stat"><span>Тираж</span><b>${qty.toLocaleString("ru-RU")} шт.</b></div><div class="stat"><span>Метраж</span><b>${meters.toFixed(1)} м</b></div><div class="stat"><span>Материал</span><b>${materialKg.toFixed(2)} кг</b></div><div class="stat"><span>Время</span><b>${printHours.toFixed(2)} ч</b></div></div><div class="breakdown"><div><span>Материал</span><b>${rub(materialCost)}</b></div><div><span>Краска</span><b>${rub(inkCost)}</b></div><div><span>Станок</span><b>${rub(machineCost)}</b></div><div><span>Работа</span><b>${rub(laborCost)}</b></div><div><span>Электроэнергия</span><b>${rub(electricCost)}</b></div><div><span>Ламинация</span><b>${rub(lamCost)}</b></div><div><span>Вырубка</span><b>${rub(dieCost)}</b></div><div><span>Накладные</span><b>${rub(overheadCost+adminCost)}</b></div><div><span>Доп. расходы</span><b>${rub(extraCost)}</b></div><div><span>Наценка ${markup.toFixed(1)}%</span><b>${rub(markupAmount)}</b></div></div><div class="printora-result-source-v40">${selected?`Материал: ${selected.name}`:"Материал введён вручную"}${machine?` · Станок: ${machine.name}`:""} · ${streams} ручьёв · раппорт ${repeat.toLocaleString("ru-RU")} мм</div>`;
}

(function installPrintoraTransferV40(){if(window.__PRINTORA_TRANSFER_HANDLER_V40)return;window.__PRINTORA_TRANSFER_HANDLER_V40=true;const apply=s=>{if(!s)return;const vals=s.inputs||s;const set=(id,v)=>{const el=document.getElementById(id);if(el&&v!==undefined&&v!==null)el.value=v;};set("customerName",s.customerName||vals.customer||"");set("qty",vals.qty);set("streams",vals.streams);set("width",vals.width);set("height",vals.height);set("web",vals.web);set("repeat",vals.repeat??s.repeat);set("gsm",vals.gsm);set("waste",vals.waste);set("colors",vals.colors);set("matPrice",vals.matPrice);set("inkPrice",vals.inkPrice);set("inkUse",vals.inkUse);set("sideMargin",vals.sideMargin);set("labelGap",vals.labelGap);set("overhead",vals.overhead);set("admin",vals.admin);set("extraCost",vals.extraCost);set("minimum",vals.minimum);if(typeof vals.lam!=="undefined")document.getElementById("lamEnabled")&&(document.getElementById("lamEnabled").checked=Boolean(vals.lam));if(typeof vals.die!=="undefined")document.getElementById("dieEnabled")&&(document.getElementById("dieEnabled").checked=Boolean(vals.die));if(s.materialId)window.PRINTORA_MATERIALS?.selectById?.(s.materialId);if(s.machineId)window.PRINTCALC_PENDING_MACHINE_ID=s.machineId;};const consume=()=>{let raw=sessionStorage.getItem("PRINTORA_TRANSFER_DETAIL_V40")||localStorage.getItem("printora_quick_to_detail_v40");if(!raw)return;try{const snap=JSON.parse(raw);sessionStorage.removeItem("PRINTORA_TRANSFER_DETAIL_V40");localStorage.removeItem("printora_quick_to_detail_v40");apply(snap);setTimeout(()=>{try{window.calculate?.();}catch(e){console.warn("PRINTORA transfer calculate",e);}},500);}catch(e){console.warn("PRINTORA transfer",e);}};window.PRINTORA_APPLY_SNAPSHOT=apply;setTimeout(consume,700);window.addEventListener("printora:materials-ready",()=>setTimeout(consume,50));window.addEventListener("printcalc:machines-ready",()=>setTimeout(consume,50));})();

function setupAutoCalculation() {
  const ids = [
    "qty", "streams", "width", "height", "web", "repeat", "gsm", "waste",
    "matPrice", "colors", "inkPrice", "inkUse", "overhead", "admin",
    "markup", "minimum", "lam", "die", "lamEnabled", "dieEnabled", "sideMargin", "labelGap", "extraCost", "materialSelect", "machineSelect"
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
