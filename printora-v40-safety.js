(() => {
  "use strict";
  const $ = id => document.getElementById(id);
  const num = value => {
    const n = Number(String(value ?? "").replace(/\s/g, "").replace(/,/g, "."));
    return Number.isFinite(n) ? n : 0;
  };
  const text = value => String(value ?? "").trim();
  const lower = value => text(value).toLocaleLowerCase("ru-RU");
  const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;", "'":"&#039;"}[c]));
  const fmt = value => Number(value || 0).toLocaleString("ru-RU", { maximumFractionDigits: 2 });

  function friendlyError(error) {
    const code = String(error?.code || error?.status || "");
    const message = String(error?.message || error?.details || error || "");
    if (/PGRST205|42P01|schema cache|relation .*calculations.* does not exist/i.test(`${code} ${message}`)) {
      return "Не создана таблица облачных данных PRINTORA «calculations». Откройте опубликованный файл PRINTORA_V40_SUPABASE_MIGRATION.sql и выполните его один раз в Supabase → SQL Editor, затем обновите страницу.";
    }
    if (/23505|duplicate key|unique constraint/i.test(`${code} ${message}`)) {
      return "Такая запись уже существует. Проверьте номер заказа или название элемента.";
    }
    if (/JWT|auth|token|session/i.test(`${code} ${message}`)) {
      return "Сессия аккаунта устарела. Войдите в аккаунт заново и повторите операцию.";
    }
    return message || "Не удалось выполнить операцию.";
  }

  function field(id, label) {
    const el = $(id);
    return { id, label, el, value: el?.value };
  }

  function repeatMm(value) {
    if (typeof window.PRINTORA_REPEAT_MM === "function") {
      const n = Number(window.PRINTORA_REPEAT_MM(value));
      if (Number.isFinite(n) && n > 0) return n;
    }
    const raw = text(value).toLocaleLowerCase("ru-RU").replace(/,/g, ".");
    const m = raw.match(/^([-+]?\d+(?:\.\d+)?)\s*(зуб(?:а|ов)?|teeth|tooth|мм|mm)?$/i);
    if (!m) return 0;
    const n = Number(m[1]);
    if (!Number.isFinite(n) || n <= 0) return 0;
    return /зуб|teeth|tooth/i.test(m[2] || "") ? n * 3.175 : n;
  }

  function materialWidth() {
    const selected = window.PRINTORA_MATERIAL;
    if (selected && num(selected.widthMm) > 0) return num(selected.widthMm);
    const preview = $("materialPreviewWidth-v36");
    if (preview) {
      const n = num(String(preview.textContent || "").replace(/мм/gi, ""));
      if (n > 0) return n;
    }
    return num($("web")?.value);
  }

  function getLayout(values = {}) {
    const width = num(values.width ?? $("width")?.value);
    const streams = Math.floor(num(values.streams ?? $("streams")?.value));
    const material = num(values.materialWidth ?? materialWidth());
    const margin = Math.max(0, num(values.sideMargin ?? $("sideMargin")?.value));
    const gap = Math.max(0, num(values.labelGap ?? $("labelGap")?.value));
    const max = width > 0 && material > 0 && width + gap > 0
      ? Math.floor((material - 2 * margin + gap + 1e-9) / (width + gap))
      : 0;
    const used = streams > 0 ? streams * width + Math.max(0, streams - 1) * gap + 2 * margin : 0;
    return { width, streams, material, margin, gap, max, used };
  }

  function validateCommon(options = {}) {
    const errors = [];
    const warnings = [];
    const qty = num($("qty")?.value);
    const streamsRaw = num($("streams")?.value);
    const width = num($("width")?.value);
    const height = num($("height")?.value);
    const web = num($("web")?.value);
    const repeat = repeatMm($("repeat")?.value);
    const gsm = num($("gsm")?.value);
    const matPrice = typeof window.PRINTORA_MATERIAL_PRICE === "function" && window.PRINTORA_MATERIAL?.id
      ? num(window.PRINTORA_MATERIAL.priceM2)
      : num($("matPrice")?.value);
    const colors = num($("colors")?.value);
    const inkPrice = num($("inkPrice")?.value);
    const inkUse = num($("inkUse")?.value);
    const waste = num($("waste")?.value);
    const markup = num($("markup")?.value);

    const mostlyEmpty = [qty, streamsRaw, width, height, web, repeat, gsm, matPrice, colors, inkPrice, inkUse].every(v => v <= 0);
    if (mostlyEmpty && options.allowEmpty !== false) return {ok:true, errors, warnings, draftEmpty:true, repeat, matPrice, markup};

    if (qty <= 0) errors.push("Укажите тираж больше нуля.");
    if (!Number.isInteger(streamsRaw) || streamsRaw < 1) errors.push("Укажите целое число ручьёв: минимум 1.");
    if (width <= 0) errors.push("Укажите ширину этикетки больше нуля.");
    if (height <= 0) errors.push("Укажите высоту этикетки больше нуля.");
    if (web <= 0) errors.push("Укажите ширину полотна материала.");
    if (web < width) errors.push(`Ширина полотна ${fmt(web)} мм меньше ширины этикетки ${fmt(width)} мм.`);
    if (repeat <= 0) errors.push("Укажите раппорт больше нуля. Например: 63,5 мм или 20 зубьев.");
    if (gsm <= 0) errors.push("Укажите граммаж материала больше нуля.");
    if (matPrice <= 0) errors.push("Укажите цену материала больше нуля.");
    if (!Number.isInteger(colors) || colors < 1) errors.push("Количество цветов должно быть целым числом от 1.");
    if (inkPrice <= 0) errors.push("Укажите цену краски больше нуля.");
    if (inkUse <= 0) errors.push("Укажите расход краски больше нуля.");
    if (waste < 0 || waste > 100) errors.push("Отходы должны быть от 0 до 100%.");
    if (markup < 0 || markup > 500) errors.push("Наценка должна быть от 0 до 500%.");

    const layout = getLayout({width, streams:streamsRaw, materialWidth:web});
    if (layout.material > 0 && layout.width > 0 && layout.streams > 0) {
      if (layout.max < 1) errors.push(`На полотне ${fmt(layout.material)} мм не помещается даже 1 ручей шириной ${fmt(layout.width)} мм с заданными полями.`);
      else if (layout.streams > layout.max) errors.push(`Невозможная раскладка: задано ${layout.streams} ручьёв, максимум ${layout.max}. Уменьшите ручьи или проверьте ширину полотна.`);
      else if (layout.streams === layout.max) warnings.push(`Раскладка проходит впритык: ${layout.used.toFixed(2)} мм из ${layout.material.toFixed(2)} мм.`);
    }

    return {ok: errors.length === 0, errors, warnings, draftEmpty:false, repeat, matPrice, markup, layout};
  }

  function validateDetail() {
    const result = validateCommon({allowEmpty:false});
    const errors = result.errors.slice();
    const machineSelect = $("machineSelect");
    const machineId = text(machineSelect?.value);
    const hasManual = num($("speed")?.value) > 0;
    const machine = machineId && window.PRINTCALC_MACHINES?.getById ? window.PRINTCALC_MACHINES.getById(machineId) : null;
    if (!machine && !hasManual) errors.push("Выберите станок или заполните производственные параметры вручную.");
    const speed = num($("speed")?.value);
    const power = num($("power")?.value);
    const setup = num($("setup")?.value);
    const machineRate = num($("machine")?.value);
    const labor = num($("labor")?.value);
    const powerRate = num($("powerRate")?.value);
    if (speed <= 0) errors.push("Скорость станка должна быть больше нуля.");
    if (power <= 0) errors.push("Мощность станка должна быть больше нуля.");
    if (setup < 0) errors.push("Время наладки не может быть отрицательным.");
    if (machineRate <= 0) errors.push("Ставка станка должна быть больше нуля.");
    if (labor <= 0) errors.push("Ставка труда должна быть больше нуля.");
    if (powerRate <= 0) errors.push("Тариф электроэнергии должен быть больше нуля.");
    const lamEnabled = Boolean($("lamEnabled")?.checked);
    const dieEnabled = Boolean($("dieEnabled")?.checked);
    if (lamEnabled && num($("lam")?.value) <= 0) errors.push("Для ламинации укажите цену больше нуля.");
    if (dieEnabled && num($("die")?.value) <= 0) errors.push("Для вырубки укажите цену больше нуля.");
    return {...result, ok:errors.length===0, errors, machine};
  }

  function showErrors(errors, warnings = []) {
    if (typeof window.PRINTORA_TOAST === "function") {
      if (errors.length) window.PRINTORA_TOAST(errors[0], "error");
      else if (warnings.length) window.PRINTORA_TOAST(warnings[0], "info");
    }
    const box = $("result");
    if (!box || !errors.length) return;
    box.innerHTML = `<div class="printora-safety-error-v40"><strong>Расчёт остановлен</strong><ul>${errors.slice(0,6).map(x=>`<li>${esc(x)}</li>`).join("")}</ul></div>`;
  }

  function smoothVolumeMarkup(qty, streams = 1) {
    const q = Math.max(1, num(qty));
    const s = Math.max(1, Math.floor(num(streams)) || 1);
    const x = Math.max(1, Math.ceil(q / s));
    const points = [[1,52],[5000,52],[15000,43],[50000,36],[100000,30]].map(([label,rate]) => [Math.max(1, Math.ceil(label / s)),rate]);
    if (x <= points[0][0]) return points[0][1];
    for (let i=1;i<points.length;i++) {
      if (x <= points[i][0]) {
        const [x0,y0]=points[i-1], [x1,y1]=points[i];
        const t=(x-x0)/(x1-x0);
        return y0+(y1-y0)*t;
      }
    }
    return 30;
  }

  function quickCalc() {
    const valid = validateCommon({allowEmpty:false});
    if (!valid.ok) { showErrors(valid.errors, valid.warnings); return null; }
    const qty = num($("qty").value);
    const streams = Math.floor(num($("streams").value));
    const width = num($("width").value);
    const height = num($("height").value);
    const web = num($("web").value);
    const repeat = valid.repeat;
    const gsm = num($("gsm").value);
    const waste = num($("waste").value);
    const matPrice = valid.matPrice;
    const colors = Math.floor(num($("colors").value));
    const inkPrice = num($("inkPrice").value);
    const inkUse = num($("inkUse").value);
    const extraMarkup = num($("markup").value);
    const volumeMarkup = smoothVolumeMarkup(qty, streams);
    const markupRate = volumeMarkup + extraMarkup;
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
    const lamEnabled = Boolean($("lam")?.checked);
    const dieEnabled = Boolean($("die")?.checked);
    const lamRate = Math.max(0, num($("lamPrice")?.value));
    const dieRate = Math.max(0, num($("diePrice")?.value));
    const lamCost = lamEnabled ? lamRate : 0;
    const cutCost = dieEnabled ? dieRate : 0;
    const variableLam = lamEnabled ? area * 19 : 0;
    const variableCut = dieEnabled ? qty * 0.028 : 0;
    const fixedCost = fixedPrintCost + lamCost + cutCost;
    const variableCost = materialCost + inkCost + variablePrintCost + variableLam + variableCut;
    const total = fixedCost + variableCost;
    const variablePrice = variableCost * (1 + markupRate / 100);
    const priceBeforeMin = fixedCost * 1.30 + variablePrice;
    const price = Math.ceil(Math.max(6500, priceBeforeMin) / 100) * 100;
    const selected = window.PRINTORA_MATERIAL || null;
    const calc = {
      mode:"quick", customerName:text($("customer")?.value || $("customerName")?.value),
      qty, streams, width, height, web, repeat, repeat_mm:repeat, gsm, waste, colors,
      matPrice, inkPrice, inkUse, meters, area, materialKg, inkKg, materialCost, inkCost,
      printHours:(setup + runMinutes) / 60, printCost:fixedPrintCost + variablePrintCost,
      lamCost, cutCost, lamEnabled, dieEnabled, volumeMarkup, extraMarkup, markupRate,
      markupAmount:total * markupRate / 100, total, price,
      materialId:selected?.id || "", materialName:selected?.name || "",
      layout:valid.layout, summary:{total,price,meters,area,materialKg,inkKg,printHours:(setup+runMinutes)/60},
      inputs:{qty,streams,width,height,web,repeat,repeat_mm:repeat,gsm,waste,colors,matPrice,inkPrice,inkUse,markup:extraMarkup,lam:lamEnabled,die:dieEnabled,materialId:selected?.id||"",materialName:selected?.name||{},customer: text($("customer")?.value || $("customerName")?.value)},
      __printora_v40:true
    };
    return calc;
  }

  function detailCalc() {
    const valid = validateDetail();
    if (!valid.ok) { showErrors(valid.errors, valid.warnings); return null; }
    const qty = num($("qty").value);
    const streams = Math.floor(num($("streams").value));
    const width = num($("width").value);
    const height = num($("height").value);
    const web = num($("web").value);
    const repeat = valid.repeat;
    const gsm = num($("gsm").value);
    const waste = num($("waste").value);
    const matPrice = valid.matPrice;
    const colors = Math.floor(num($("colors").value));
    const inkPrice = num($("inkPrice").value);
    const inkUse = num($("inkUse").value);
    const speed = num($("speed").value);
    const power = num($("power").value);
    const setup = Math.max(0, num($("setup").value));
    const machineRate = num($("machine").value);
    const laborRate = num($("labor").value);
    const powerRate = num($("powerRate").value);
    const lamEnabled = Boolean($("lamEnabled")?.checked);
    const dieEnabled = Boolean($("dieEnabled")?.checked);
    const lamRate = Math.max(0, num($("lam")?.value));
    const dieRate = Math.max(0, num($("die")?.value));
    const overhead = Math.max(0, num($("overhead")?.value));
    const admin = Math.max(0, num($("admin")?.value));
    const markup = Math.max(0, num($("markup")?.value));
    const minPrice = Math.max(0, num($("minPrice")?.value)) || 0;
    const repeats = Math.ceil(qty / streams);
    const meters = repeats * repeat / 1000 * (1 + waste / 100);
    const area = meters * web / 1000;
    const materialKg = area * gsm / 1000;
    const inkKg = area * colors * inkUse / 1000;
    const materialCost = area * matPrice;
    const inkCost = inkKg * inkPrice;
    const printMinutes = meters / speed;
    const printHours = (setup + printMinutes) / 60;
    const machineCost = printHours * machineRate;
    const laborCost = printHours * laborRate;
    const electricCost = printHours * power * powerRate;
    const lamCost = lamEnabled ? Math.max(0, lamRate) : 0;
    const dieCost = dieEnabled ? Math.max(0, dieRate) : 0;
    const direct = materialCost + inkCost + machineCost + laborCost + electricCost + lamCost + dieCost;
    const overheadCost = direct * overhead / 100;
    const adminCost = direct * admin / 100;
    const cost = direct + overheadCost + adminCost;
    const markupAmount = cost * markup / 100;
    const price = Math.ceil(Math.max(minPrice, cost + markupAmount) / 100) * 100;
    const machineSelect = $("machineSelect");
    const machineId = text(machineSelect?.value);
    const machine = machineId && window.PRINTCALC_MACHINES?.getById ? window.PRINTCALC_MACHINES.getById(machineId) : null;
    const selected = window.PRINTORA_MATERIAL || null;
    const calc = {
      mode:"detail", customerName:text($("customer")?.value || $("customerName")?.value),
      qty,streams,width,height,web,repeat,repeat_mm:repeat,gsm,waste,colors,matPrice,inkPrice,inkUse,
      meters,area,materialKg,inkKg,materialCost,inkCost,speed,power,setup,printMinutes,printHours,
      machineCost,laborCost,electricCost,lamCost,dieCost,overheadCost,adminCost,markupRate:markup,
      markupAmount,total:cost,price,lamEnabled,dieEnabled,
      machineId:machine?.id || machineId || "",machineName:machine?.name || "",
      materialId:selected?.id || "",materialName:selected?.name || "",layout:valid.layout,
      summary:{total:cost,price,meters,area,materialKg,inkKg,printHours},
      inputs:{qty,streams,width,height,web,repeat,repeat_mm:repeat,gsm,waste,colors,matPrice,inkPrice,inkUse,markup,lam:lamEnabled,die:dieEnabled,materialId:selected?.id||"",materialName:selected?.name||{},machineId:machine?.id||machineId||"",machineName:machine?.name||{},speed,power,setup,machine:machineRate,labor:laborRate,powerRate,overhead,admin,minimum:minPrice},
      __printora_v40:true
    };
    return calc;
  }

  function renderResult(calc, detail = false) {
    const result = $("result");
    if (!result || !calc) return;
    const rub = v => Math.round(v || 0).toLocaleString("ru-RU") + " ₽";
    const title = detail ? "Детальный расчёт" : "Ориентир по заказу";
    const lines = detail ? `
      <div class="breakdown"><div><span>Материал</span><b>${rub(calc.materialCost)}</b></div><div><span>Краска</span><b>${rub(calc.inkCost)}</b></div><div><span>Станок</span><b>${rub(calc.machineCost)}</b></div><div><span>Работа</span><b>${rub(calc.laborCost)}</b></div><div><span>Электроэнергия</span><b>${rub(calc.electricCost)}</b></div><div><span>Ламинация</span><b>${rub(calc.lamCost)}</b></div><div><span>Вырубка</span><b>${rub(calc.dieCost)}</b></div><div><span>Накладные</span><b>${rub(calc.overheadCost + calc.adminCost)}</b></div><div><span>Наценка ${fmt(calc.markupRate)}%</span><b>${rub(calc.markupAmount)}</b></div></div>` : `
      <div class="breakdown"><div><span>Материал</span><b>${rub(calc.materialCost)}</b></div><div><span>Краска</span><b>${rub(calc.inkCost)}</b></div><div><span>Печать</span><b>${rub(calc.printCost)}</b></div><div><span>Ламинация</span><b>${rub(calc.lamCost)}</b></div><div><span>Вырубка</span><b>${rub(calc.cutCost)}</b></div><div><span>Объёмная наценка</span><b>${fmt(calc.volumeMarkup)}%</b></div><div><span>Доп. наценка</span><b>${fmt(calc.extraMarkup)}%</b></div></div>`;
    result.innerHTML = `<div class="result-top"><div><span>РАСЧЁТ ГОТОВ</span><h2>${title}</h2></div></div><div class="price-grid"><div class="price-box main"><span>Цена клиенту</span><b>${rub(calc.price)}</b></div><div class="price-box"><span>Себестоимость</span><b>${rub(calc.total)}</b></div></div><div class="stat-grid"><div class="stat"><span>Тираж</span><b>${Number(calc.qty).toLocaleString("ru-RU")} шт.</b></div><div class="stat"><span>Метраж</span><b>${Number(calc.meters).toFixed(1)} м</b></div><div class="stat"><span>Материал</span><b>${Number(calc.materialKg).toFixed(2)} кг</b></div><div class="stat"><span>Время</span><b>${Number(calc.printHours).toFixed(2)} ч</b></div></div>${lines}<div class="printora-result-source-v40">${calc.materialName ? `Материал: ${esc(calc.materialName)}` : "Материал введён вручную"}${detail && calc.machineName ? ` · Станок: ${esc(calc.machineName)}` : ""} · ${calc.streams} ручьёв · раппорт ${fmt(calc.repeat)} мм</div></div><div class="printora-quick-next-v40" hidden></div>`;
    window.PRINTCALC_LAST_CALC = calc;
    window.currentQuickCalculation = detail ? window.currentQuickCalculation : calc;
    attachQuickNext(detail);
  }

  function attachQuickNext(detail) {
    const host = document.querySelector(".printora-quick-next-v40");
    if (!host) return;
    host.hidden = false;
    if (detail) { host.innerHTML = ""; return; }
    host.innerHTML = `<button type="button" class="printora-detail-transfer-v40">ПЕРЕВЕСТИ В ДЕТАЛЬНЫЙ РАСЧЁТ →</button>`;
    host.querySelector("button")?.addEventListener("click", () => {
      try { localStorage.setItem("printora_quick_to_detail_v40", JSON.stringify(window.PRINTCALC_LAST_CALC || {})); } catch (_) {}
      window.location.href = "./detail.html?from=quick";
    });
  }

  function patchCalculators() {
    if (typeof window.PRINTORA_V40_CALCULATORS_PATCHED !== "boolean") window.PRINTORA_V40_CALCULATORS_PATCHED = false;
    if (window.PRINTORA_V40_CALCULATORS_PATCHED) return;
    window.PRINTORA_V40_CALCULATORS_PATCHED = true;
    // calculate() is already bound by quick.js/detail.js. V40 only provides validation helpers and transfer logic.
    ["qty","streams","width","height","web","repeat","gsm","waste","matPrice","colors","inkPrice","inkUse","markup","lamPrice","diePrice","speed","power","setup","machine","labor","powerRate","lam","die","overhead","admin","minPrice"].forEach(id => {
      $(id)?.addEventListener("input", () => { window.dispatchEvent(new CustomEvent("printora:v40-input-changed")); });
      $(id)?.addEventListener("change", () => { window.dispatchEvent(new CustomEvent("printora:v40-input-changed")); });
    });
    window.addEventListener("printora:material-changed", () => window.dispatchEvent(new Event("printora:v40-input-changed")));
  }

  function loadQuickSnapshot() {
    if (!$('machineSelect')) return;
    let raw = null;
    try { raw = JSON.parse(localStorage.getItem("printora_quick_to_detail_v40") || "null"); } catch (_) { raw = null; }
    if (!raw || !raw.inputs) return;
    const i = raw.inputs;
    const set = (id, value) => { const el=$(id); if(el && value !== undefined && value !== null) el.value = value; };
    ["qty","streams","width","height","web","repeat","gsm","waste","colors","inkPrice","inkUse","markup"].forEach(id=>set(id,i[id]));
    if (i.matPrice != null) set("matPrice",i.matPrice);
    if (i.lam != null && $("lamEnabled")) $("lamEnabled").checked=Boolean(i.lam);
    if (i.die != null && $("dieEnabled")) $("dieEnabled").checked=Boolean(i.die);
    if (raw.customerName) set("customer",raw.customerName);
    try { localStorage.removeItem("printora_quick_to_detail_v40"); } catch (_) {}
    window.setTimeout(() => {
      const mat = window.PRINTORA_MATERIALS?.getAll?.().find(m=>m.id===i.materialId);
      if (mat && typeof window.PRINTORA_MATERIALS?.selectById === "function") window.PRINTORA_MATERIALS.selectById(mat.id);
      else $("calc")?.focus();
    }, 500);
    if (typeof window.PRINTORA_TOAST === "function") window.PRINTORA_TOAST("Данные быстрого расчёта перенесены в детальный.","info");
  }

  function patchMaterialCard() {
    if (!document.body || !document.querySelector('[data-printora-material-card="1"]')) return;
    document.querySelectorAll('[data-printora-material-card="1"]').forEach(card => {
      card.setAttribute("href", "#");
      if (card.__v40) return;
      card.__v40 = true;
      card.addEventListener("click", e => {
        e.preventDefault();
        if (typeof window.PRINTORA_MATERIALS?.openManager === "function") window.PRINTORA_MATERIALS.openManager();
        else if (typeof window.PRINTORA_MATERIALS?.open === "function") window.PRINTORA_MATERIALS.open();
      });
    });
  }

  function patchErrorMessages() {
    const names = ["__PRINTORA_CLOUD_ERROR_PATCHED"];
    if (window[names[0]]) return;
    window[names[0]] = true;
    window.PRINTORA_FRIENDLY_ERROR = friendlyError;
  }

  function boot() {
    patchErrorMessages();
    patchCalculators();
    patchMaterialCard();
    loadQuickSnapshot();
    setTimeout(patchMaterialCard, 700);
  }

  window.PRINTORA_SAFETY = {friendlyError,validateCommon,validateDetail,repeatMm,getLayout,smoothVolumeMarkup};
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot, {once:true});
  else boot();
})();
