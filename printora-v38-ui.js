(() => {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const num = (value) => {
    const n = Number(String(value ?? "").replace(/\s/g, "").replace(/,/g, "."));
    return Number.isFinite(n) ? n : 0;
  };
  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;", "'":"&#039;"
  }[c]));
  const fmt = (value, digits = 2) => Number(value || 0).toLocaleString("ru-RU", { maximumFractionDigits: digits });

  function parseRepeat(value) {
    const raw = String(value ?? "").trim().toLocaleLowerCase("ru-RU").replace(/,/g, ".");
    if (!raw) return 0;
    const m = raw.match(/([-+]?\d+(?:\.\d+)?)\s*(зуб(?:а|ов)?|teeth|tooth|мм|mm)?/i);
    if (!m) return 0;
    const amount = Number(m[1]);
    if (!Number.isFinite(amount) || amount <= 0) return 0;
    return /зуб|teeth|tooth/i.test(m[2] || "") ? amount * 3.175 : amount;
  }

  function materialWidth() {
    if (window.PRINTORA_MATERIAL?.widthMm > 0) return Number(window.PRINTORA_MATERIAL.widthMm);
    const preview = $("materialPreviewWidth-v36");
    const pv = preview ? num(String(preview.textContent || "").replace("мм", "")) : 0;
    return pv > 0 ? pv : num($("web")?.value);
  }

  function layoutValues() {
    const labelWidth = num($("width")?.value);
    const labelHeight = num($("height")?.value);
    const streams = Math.max(0, Math.floor(num($("streams")?.value)));
    const material = materialWidth();
    const margin = Math.max(0, num($("sideMargin")?.value));
    const gap = Math.max(0, num($("labelGap")?.value));
    const used = streams > 0 ? streams * labelWidth + Math.max(0, streams - 1) * gap + 2 * margin : 0;
    const max = labelWidth > 0 && material > 0
      ? Math.max(0, Math.floor((material - 2 * margin + gap + 1e-9) / (labelWidth + gap)))
      : 0;
    return { labelWidth, labelHeight, streams, material, margin, gap, used, max };
  }

  function ensureCapacity() {
    let box = $("printora-capacity-v38");
    if (box) return box;
    box = document.createElement("div");
    box.id = "printora-capacity-v38";
    box.className = "printora-capacity-v38";
    const anchor = $("streams")?.closest(".field")?.parentElement;
    if (anchor) anchor.insertAdjacentElement("afterend", box);
    else $("streams")?.closest("section")?.appendChild(box);
    return box;
  }

  function renderCapacity() {
    const box = ensureCapacity();
    if (!box) return;
    const v = layoutValues();
    if (!(v.labelWidth > 0 && v.material > 0 && v.streams > 0)) {
      box.hidden = true;
      document.body.classList.remove("printora-capacity-error-v38");
      return;
    }
    if (v.streams > v.max) {
      box.hidden = false;
      box.className = "printora-capacity-v38 is-error";
      box.innerHTML = `<div class="printora-capacity-icon-v38">!</div><div><strong>На данную ширину материала максимальная вместимость — ${v.max} ручьёв</strong><p>Сейчас задано ${v.streams}. ${fmt(v.labelWidth)} × ${v.streams} = ${fmt(v.streams * v.labelWidth)} мм, а материал ${fmt(v.material)} мм.</p><small>В расчёте учтены поля по краям ${fmt(v.margin)} мм и межэтикеточное расстояние ${fmt(v.gap)} мм. Максимум: ${v.max} ручьёв.</small></div>`;
      document.body.classList.add("printora-capacity-error-v38");
      return;
    }
    if (v.streams === v.max) {
      box.hidden = false;
      box.className = "printora-capacity-v38 is-limit";
      box.innerHTML = `<div class="printora-capacity-icon-v38">✓</div><div><strong>Раскладка по ширине проходит впритык</strong><p>${v.streams} ручьёв: ${fmt(v.used)} мм из ${fmt(v.material)} мм.</p><small>Свободно ${fmt(Math.max(0, v.material - v.used))} мм.</small></div>`;
      document.body.classList.remove("printora-capacity-error-v38");
      return;
    }
    box.hidden = true;
    document.body.classList.remove("printora-capacity-error-v38");
  }

  function ensureLayout() {
    let box = $("printora-layout-v38");
    if (box) return box;
    box = document.createElement("div");
    box.id = "printora-layout-v38";
    box.className = "printora-layout-v38";
    const panel = $("streams")?.closest("section");
    const fields = panel?.querySelector(".fields");
    if (fields) fields.insertAdjacentElement("afterend", box);
    else panel?.appendChild(box);
    return box;
  }

  function renderLayout() {
    const box = ensureLayout();
    if (!box) return;
    const v = layoutValues();
    if (!(v.labelWidth > 0 && v.labelHeight > 0 && v.material > 0)) {
      box.hidden = true;
      return;
    }
    const W = 320;
    const innerW = 292;
    const scale = innerW / v.material;
    const materialH = 82;
    const labelW = Math.max(1, v.labelWidth * scale);
    const gapPx = v.gap * scale;
    const marginPx = v.margin * scale;
    const x0 = 14 + marginPx;
    const count = Math.min(Math.max(v.max, v.streams), 24);
    const rects = [];
    for (let i = 0; i < count; i++) {
      const x = x0 + i * (labelW + gapPx);
      if (x > 14 + innerW + 1) break;
      rects.push(`<rect x="${x.toFixed(2)}" y="24" width="${Math.max(1,labelW).toFixed(2)}" height="45" rx="2" class="${i < v.streams ? "active" : "ghost"}"/>`);
    }
    const over = v.streams > v.max;
    box.hidden = false;
    box.classList.toggle("has-error", over);
    box.innerHTML = `<div class="printora-layout-head-v38"><span>СХЕМА РАСКЛАДКИ</span><small>${fmt(v.material)} мм полотна</small></div><svg viewBox="0 0 ${W} 120" role="img" aria-label="Схематичная раскладка этикеток на материале"><rect x="14" y="14" width="${innerW}" height="64" rx="7" class="material"/>${rects.join("")}<line x1="14" y1="93" x2="${14+innerW}" y2="93" class="dim"/><text x="160" y="107" text-anchor="middle">${fmt(v.material)} мм</text></svg><div class="printora-layout-foot-v38"><span>${fmt(v.labelWidth)} × ${fmt(v.labelHeight)} мм</span><span>${v.streams} ручьёв</span><span class="${over ? "bad" : "ok"}">${over ? `не влезает: ${fmt(v.used)} мм` : `занято: ${fmt(v.used)} мм`}</span></div>`;
  }

  function refresh() {
    renderCapacity();
    renderLayout();
    const material = window.PRINTORA_MATERIAL;
    document.querySelectorAll("#matPrice").forEach((el) => {
      const field = el.closest(".field");
      if (!field) return;
      let note = field.querySelector(".printora-source-note-v38");
      if (!note) { note = document.createElement("small"); note.className = "printora-source-note-v38"; field.appendChild(note); }
      field.classList.toggle("is-from-directory-v38", Boolean(material));
      note.textContent = material ? `Цена из справочника: ${material.name}` : "Цена введена вручную";
    });
  }

  function toast(text, type = "info") {
    let host = $("printora-toast-host-v38");
    if (!host) { host = document.createElement("div"); host.id = "printora-toast-host-v38"; host.className = "printora-toast-host-v38"; document.body.appendChild(host); }
    const item = document.createElement("div");
    item.className = `printora-toast-v38 ${type}`;
    item.textContent = text;
    host.appendChild(item);
    requestAnimationFrame(() => item.classList.add("show"));
    setTimeout(() => { item.classList.remove("show"); setTimeout(() => item.remove(), 220); }, 3200);
  }
  window.PRINTORA_TOAST = toast;

  function dialog(id, title, body, actions) {
    $(id)?.remove();
    const modal = document.createElement("div");
    modal.id = id;
    modal.className = "printora-dialog-v38-backdrop";
    modal.innerHTML = `<div class="printora-dialog-v38" role="dialog" aria-modal="true" aria-labelledby="${id}-title"><button class="printora-dialog-close-v38" type="button" aria-label="Закрыть">×</button><div class="printora-dialog-eyebrow-v38">PRINTORA</div><h2 id="${id}-title">${title}</h2><div class="printora-dialog-body-v38">${body}</div><div class="printora-dialog-actions-v38">${actions}</div></div>`;
    document.body.appendChild(modal);
    modal.querySelector(".printora-dialog-close-v38")?.addEventListener("click", () => modal.remove());
    modal.addEventListener("click", (e) => { if (e.target === modal) modal.remove(); });
    setTimeout(() => modal.querySelector("input,button")?.focus(), 30);
    return modal;
  }

  window.PRINTORA_SAVE_ORDER_DIALOG = (payload = {}) => new Promise((resolve) => {
    const source = payload.source || {};
    const summary = source.summary || {};
    const body = `<div class="printora-save-summary-v38"><div><span>ЗАКАЗЧИК</span><b>${esc(source.customer || source.customerName || "Не указан")}</b></div><div><span>ТИРАЖ</span><b>${fmt(source.inputs?.qty || 0)} шт.</b></div><div><span>РАППОРТ</span><b>${fmt(source.repeat_mm || parseRepeat(source.inputs?.repeat || ""))} мм</b></div><div><span>ИТОГО</span><b>${summary.total != null ? `${fmt(summary.total)} ₽` : "—"}</b></div></div><label class="printora-dialog-field-v38"><span>Номер заказа</span><input id="printora-order-number-v38" type="text" maxlength="80" autocomplete="off" placeholder="Например, 1842"><small>Номер сохраняется вместе с расчётом и используется при поиске похожих заказов.</small></label>`;
    const modal = dialog("printora-save-dialog-v38", "Сохранить заказ", body, `<button type="button" class="secondary" data-cancel>Отмена</button><button type="button" class="primary" data-ok>Продолжить</button>`);
    const input = $("printora-order-number-v38");
    const finish = (value) => { modal.remove(); resolve(value); };
    modal.querySelector("[data-cancel]")?.addEventListener("click", () => finish(null));
    modal.querySelector("[data-ok]")?.addEventListener("click", () => {
      const value = String(input?.value || "").trim();
      if (!value) { input?.classList.add("error"); input?.focus(); toast("Введите номер заказа", "error"); return; }
      finish(value);
    });
    input?.addEventListener("keydown", (e) => { if (e.key === "Enter") modal.querySelector("[data-ok]")?.click(); if (e.key === "Escape") modal.querySelector("[data-cancel]")?.click(); });
  });

  window.PRINTORA_DUPLICATE_ORDER_DIALOG = (orderNumber) => new Promise((resolve) => {
    const modal = dialog("printora-duplicate-dialog-v38", "Номер заказа уже существует", `<p class="printora-dialog-text-v38">Заказ <b>№ ${esc(orderNumber)}</b> уже есть в истории этого аккаунта. Для нового сохранения укажите другой номер.</p>`, `<button type="button" class="primary" data-close>Понятно</button>`);
    modal.querySelector("[data-close]")?.addEventListener("click", () => { modal.remove(); resolve(false); });
  });

  window.PRINTORA_SIMILAR_DIALOG = (payload = {}) => new Promise((resolve) => {
    const rows = (payload.similar || []).slice(0, 5).map((x) => `<article><b>${x.score}%</b><div><strong>№ ${esc(x.order)}</strong><span>${fmt(x.width)} × ${fmt(x.height)} мм · раппорт ${fmt(x.repeat)} мм</span></div></article>`).join("");
    const body = `<p class="printora-dialog-text-v38">В истории уже есть очень похожие заказы. Проверьте, не подходит ли ранее использованный штамп.</p><div class="printora-similar-list-v38">${rows}</div>`;
    const modal = dialog("printora-similar-dialog-v38", "Похожий заказ уже был", body, `<button type="button" class="secondary" data-cancel>Отмена</button><button type="button" class="primary" data-ok>Сохранить как новый</button>`);
    modal.querySelector("[data-cancel]")?.addEventListener("click", () => { modal.remove(); resolve(false); });
    modal.querySelector("[data-ok]")?.addEventListener("click", () => { modal.remove(); resolve(true); });
  });

  function mobileNav() {
    if ($("printora-mobile-nav-v38")) return;
    const path = location.pathname.toLowerCase();
    const items = [
      ["./", "⌂", "Главная", path.endsWith("/") || path.endsWith("index.html")],
      ["quick.html", "⚡", "Быстро", path.endsWith("quick.html")],
      ["detail.html", "Σ", "Детально", path.endsWith("detail.html")],
      ["account.html", "◉", "История", path.endsWith("account.html")]
    ];
    const nav = document.createElement("nav");
    nav.id = "printora-mobile-nav-v38";
    nav.className = "printora-mobile-nav-v38";
    nav.innerHTML = items.map(([href, icon, label, active]) => `<a href="${href}" class="${active ? "active" : ""}"><span>${icon}</span><small>${label}</small></a>`).join("");
    document.body.appendChild(nav);
  }

  function accessibility() {
    document.querySelectorAll(".field input, .field select").forEach((el) => {
      el.addEventListener("invalid", () => el.closest(".field")?.classList.add("is-error-v38"));
      el.addEventListener("input", () => el.closest(".field")?.classList.remove("is-error-v38"));
    });
  }

  function bind() {
    ["qty","streams","width","height","web","repeat","sideMargin","labelGap","gsm","colors","matPrice","inkPrice","inkUse","speed","power","setup","machine","labor","powerRate","markup","overhead","admin","minimum"].forEach((id) => {
      const el = $(id);
      if (!el) return;
      ["input","change","blur"].forEach((eventName) => el.addEventListener(eventName, refresh));
    });
    window.addEventListener("printora:material-changed", refresh);
    window.addEventListener("printcalc:history-saved", () => toast("Заказ сохранён в облачную историю", "success"));
    window.addEventListener("printcalc:history-save-error", (e) => toast(e.detail?.message || "Не удалось сохранить заказ", "error"));
    refresh();
  }

  function init() {
    mobileNav();
    accessibility();
    bind();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();
