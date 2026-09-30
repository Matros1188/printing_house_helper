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
    "customerName", "customerName", "customerName", "customerName", "customerName", "qty", "streams", "width", "height", "web", "repeat", "gsm", "waste",
    "matPrice", "colors", "inkPrice", "inkUse", "lam", "die", "sideMargin", "labelGap", "markupQuick", "materialSelect", "sideMargin", "labelGap", "markupQuick", "materialSelect", "sideMargin", "labelGap", "markupQuick", "materialSelect", "sideMargin", "labelGap", "markupQuick", "materialSelect"
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

function calculate(){
  const valid=window.PRINTORA_VALIDATE_COMMON?.()||{ok:true,errors:[]};if(!valid.ok){window.PRINTORA_SHOW_CALC_ERRORS?.(valid.errors);return;}
  const num=id=>Number(document.getElementById(id)?.value||0);const text=id=>String(document.getElementById(id)?.value||"").trim();
  const qty=num("qty"),streams=Math.floor(num("streams")),width=num("width"),height=num("height"),web=num("web"),repeat=Number(valid.repeat||window.PRINTORA_REPEAT_MM?.(text("repeat"))||0),gsm=num("gsm"),waste=num("waste"),matPrice=Number(valid.matPrice||window.PRINTORA_MATERIAL_PRICE?.()||num("matPrice")),colors=Math.floor(num("colors")),inkPrice=num("inkPrice"),inkUse=num("inkUse"),extraMarkup=Math.max(0,num("markupQuick"));
  const repeats=Math.ceil(qty/streams),meters=repeats*repeat/1000*(1+waste/100),area=meters*web/1000,materialKg=area*gsm/1000,inkKg=area*colors*inkUse/1000,materialCost=area*matPrice,inkCost=inkKg*inkPrice,setup=25+colors*4,speed=Math.max(35,85-colors*3),runMinutes=meters/speed,printCost=2300+setup/60*3500+runMinutes/60*3500;
  const lam=Boolean(document.getElementById("lam")?.checked),die=Boolean(document.getElementById("die")?.checked),lamCost=lam?(850+area*19):0,dieCost=die?(1800+qty*0.028):0,volumeMarkup=window.PRINTORA_SMOOTH_VOLUME_MARKUP?.(qty)||0,markupRate=volumeMarkup+extraMarkup,total=materialCost+inkCost+printCost+lamCost+dieCost;
  const price=Math.ceil(Math.max(6500,total*(1+markupRate/100))/100)*100,pricePer1000=price/qty*1000,margin=price>0?(price-total)/price*100:0,selected=window.PRINTORA_MATERIAL||null,customer=String(document.getElementById("customer")?.value||document.getElementById("customerName")?.value||"").trim();
  const calc={mode:"quick",customerName:customer,qty,streams,width,height,web,repeat,repeat_mm:repeat,gsm,waste,colors,matPrice,inkPrice,inkUse,meters,area,materialKg,inkKg,materialCost,inkCost,speed,runMinutes,printMinutes:runMinutes,printHours:runMinutes/60,setup,printCost,lamCost,dieCost,lamEnabled:lam,dieEnabled:die,volumeMarkup,extraMarkup,markupRate,total,price,pricePer1000,margin,materialId:selected?.id||"",materialName:selected?.name||"",layout:valid.layout||{},inputs:{qty,streams,width,height,web,repeat,repeat_mm:repeat,gsm,waste,colors,matPrice,inkPrice,inkUse,markupQuick:extraMarkup,lam,die,sideMargin:Number(document.getElementById("sideMargin")?.value||0),labelGap:Number(document.getElementById("labelGap")?.value||0),materialId:selected?.id||"",customer},summary:{qty,price,total,meters,area,materialKg,printHours:runMinutes/60,pricePer1000,margin},__printora_v40:true};
  window.PRINTCALC_LAST_CALC=calc;window.currentQuickCalculation=calc;
  const result=document.getElementById("result"),rub=v=>Math.round(v||0).toLocaleString("ru-RU")+" ₽";
  if(result)result.innerHTML=`<div class="result-top"><div><span>РАСЧЁТ ГОТОВ</span><h2>Ориентир по заказу</h2></div></div><div class="price-grid"><div class="price-box main"><span>Цена клиенту</span><b>${rub(price)}</b></div><div class="price-box"><span>Себестоимость</span><b>${rub(total)}</b></div></div><div class="stat-grid"><div class="stat"><span>Тираж</span><b>${qty.toLocaleString("ru-RU")} шт.</b></div><div class="stat"><span>Метраж</span><b>${meters.toFixed(1)} м</b></div><div class="stat"><span>Материал</span><b>${materialKg.toFixed(2)} кг</b></div><div class="stat"><span>Время</span><b>${(runMinutes/60).toFixed(1)} ч</b></div></div><div class="breakdown"><div><span>Материал</span><b>${rub(materialCost)}</b></div><div><span>Краска</span><b>${rub(inkCost)}</b></div><div><span>Печать</span><b>${rub(printCost)}</b></div><div><span>Ламинация</span><b>${rub(lamCost)}</b></div><div><span>Вырубка</span><b>${rub(dieCost)}</b></div><div><span>Объёмная наценка</span><b>${volumeMarkup.toFixed(1)}%</b></div><div><span>Доп. наценка</span><b>${extraMarkup.toFixed(1)}%</b></div></div><div class="printora-result-source-v40">${selected?`Материал: ${selected.name}`:"Материал введён вручную"} · ${streams} ручьёв · раппорт ${repeat.toLocaleString("ru-RU")} мм</div><button type="button" class="printora-detail-transfer-v40" data-to-detail>ПЕРЕВЕСТИ В ДЕТАЛЬНЫЙ РАСЧЁТ →</button>`;
  document.querySelector("[data-to-detail]")?.addEventListener("click",()=>{window.PRINTORA_QUICK_TO_DETAIL?.(calc);try{localStorage.setItem("printora_quick_to_detail_v40",JSON.stringify(calc));}catch(_){}window.location.href="./detail.html?from=quick";});
}

function setupAutoCalculation() {
  const ids = [
    "customerName", "customerName", "customerName", "customerName", "qty", "streams", "width", "height", "web", "repeat", "gsm", "waste",
    "matPrice", "colors", "inkPrice", "inkUse", "lam", "die", "sideMargin", "labelGap", "markupQuick", "materialSelect", "sideMargin", "labelGap", "markupQuick", "materialSelect", "sideMargin", "labelGap", "markupQuick", "materialSelect", "sideMargin", "labelGap", "markupQuick", "materialSelect"
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
