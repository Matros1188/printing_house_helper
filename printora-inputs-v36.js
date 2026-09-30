(() => {
  "use strict";
  const DEFAULT_TOOTH_PITCH_MM = 3.175;
  window.PRINTORA_TOOTH_PITCH_MM = DEFAULT_TOOTH_PITCH_MM;

  function parseRepeat(value) {
    const raw = String(value ?? "").trim().toLocaleLowerCase("ru-RU").replace(/,/g, ".");
    if (!raw) return { value:0, mm:0, unit:"mm", raw:"" };
    const numberMatch = raw.match(/-?\d+(?:\.\d+)?/);
    const valueNumber = numberMatch ? Number(numberMatch[0]) : 0;
    if (!Number.isFinite(valueNumber) || valueNumber <= 0) return { value:0, mm:0, unit:"mm", raw };
    if (/(зуб(?:а|ов)?|(^|\s)з\.?($|\s))/i.test(raw)) {
      return { value:valueNumber, mm:valueNumber * DEFAULT_TOOTH_PITCH_MM, unit:"tooth", raw };
    }
    return { value:valueNumber, mm:valueNumber, unit:"mm", raw };
  }
  window.PRINTORA_PARSE_REPEAT = parseRepeat;
  window.PRINTORA_REPEAT_MM = value => parseRepeat(value).mm;
  window.PRINTORA_REPEAT_INPUT = value => parseRepeat(value);

  function installRepeatInput() {
    const input = document.getElementById("repeat");
    if (!input || input.dataset.repeatV36 === "1") return;
    input.dataset.repeatV36 = "1";
    input.type = "text";
    input.inputMode = "decimal";
    input.autocomplete = "off";

    const field = input.closest(".field") || input.parentElement;
    if (!field) return;
    field.classList.add("pc-repeat-field-v36");

    const picker = document.createElement("div");
    picker.className = "pc-repeat-picker-v36";
    picker.innerHTML = `<span>Единица раппорта</span><button type="button" data-repeat-unit="mm">ММ</button><button type="button" data-repeat-unit="tooth">ЗУБ</button>`;
    field.appendChild(picker);

    function show() {
      const parsed = parseRepeat(input.value);
      const current = input.dataset.repeatUnit || parsed.unit || "mm";
      picker.querySelectorAll("button").forEach(btn => btn.classList.toggle("is-active", btn.dataset.repeatUnit === current));
      picker.classList.add("is-open", "is-pulsing");
      setTimeout(() => picker.classList.remove("is-pulsing"), 500);
    }
    function hide() { picker.classList.remove("is-open", "is-pulsing"); }
    function setUnit(unit) {
      const parsed = parseRepeat(input.value);
      if (!parsed.value) return;
      input.dataset.repeatUnit = unit;
      input.value = unit === "tooth" ? `${parsed.value} зуб` : `${parsed.value} мм`;
      hide();
      input.dispatchEvent(new Event("input", { bubbles:true }));
      input.dispatchEvent(new Event("change", { bubbles:true }));
    }

    input.addEventListener("focus", show);
    input.addEventListener("click", show);
    input.addEventListener("input", () => {
      const parsed = parseRepeat(input.value);
      if (parsed.unit === "tooth") input.dataset.repeatUnit = "tooth";
      else if (/(мм|mm|миллиметр)/i.test(input.value)) input.dataset.repeatUnit = "mm";
      if (/(зуб|(^|\s)з\.?($|\s)|мм|mm|миллиметр)/i.test(input.value)) hide();
    });
    input.addEventListener("blur", () => {
      const raw = String(input.value || "").trim();
      const parsed = parseRepeat(raw);
      if (!parsed.value) { hide(); return; }
      const explicit = /(зуб|(^|\s)з\.?($|\s)|мм|mm|миллиметр)/i.test(raw);
      if (!explicit) {
        input.dataset.repeatUnit = "mm";
        input.value = `${parsed.value} мм`;
      }
      hide();
      input.dispatchEvent(new Event("change", { bubbles:true }));
    });
    picker.querySelectorAll("button").forEach(btn => {
      btn.addEventListener("mousedown", e => e.preventDefault());
      btn.addEventListener("click", () => setUnit(btn.dataset.repeatUnit));
    });
  }

  function materialPrice() {
    const state = window.PRINTORA_MATERIAL || {};
    const selected = Number(state.priceM2);
    if (Number.isFinite(selected) && selected > 0) return selected;
    const raw = String(document.getElementById("matPrice")?.value || "").replace(/\s/g, "").replace(/,/g, ".");
    const manual = Number(raw);
    return Number.isFinite(manual) ? Math.max(0, manual) : 0;
  }
  window.PRINTORA_MATERIAL_PRICE = materialPrice;

  function init() { installRepeatInput(); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once:true }); else init();
})();
