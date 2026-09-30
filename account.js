(() => {
  "use strict";

  const core = window.PRINTCALC_AUTH_CORE || {};
  const client = core.getClient ? core.getClient() : null;

  let allHistoryRows = [];

  const $ = (id) => document.getElementById(id);

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (ch) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;",
    }[ch]));
  }

  function textNorm(value) {
    return String(value || "")
      .trim()
      .toLocaleLowerCase("ru-RU")
      .replace(/ё/g, "е");
  }

  function dateValue(value) {
    const d = new Date(value || 0);
    return Number.isNaN(d.getTime()) ? 0 : d.getTime();
  }

  function formatDate(value) {
    const d = new Date(value || 0);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleString("ru-RU", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function dateOnly(value) {
    const d = new Date(value || 0);
    if (Number.isNaN(d.getTime())) return "";
    return [
      d.getFullYear(),
      String(d.getMonth() + 1).padStart(2, "0"),
      String(d.getDate()).padStart(2, "0"),
    ].join("-");
  }

  function parseNumber(value) {
    if (value === null || value === undefined) return null;
    const cleaned = String(value)
      .replace(/\u00a0/g, " ")
      .replace(/\s+/g, "")
      .replace(/₽/g, "")
      .replace(/%/g, "")
      .replace(/м²/g, "")
      .replace(/шт\.?/gi, "")
      .replace(/кг/gi, "")
      .replace(/мин/gi, "")
      .replace(/кВт/gi, "")
      .replace(/,/g, ".")
      .replace(/[^0-9.\-]/g, "");
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : null;
  }

  function fmt(value, unit = "", digits = 2) {
    const n = parseNumber(value);
    if (n === null) return value ? String(value) : "—";
    return n.toLocaleString("ru-RU", { maximumFractionDigits: digits }) + (unit ? " " + unit : "");
  }

  function fmtMoney(value) {
    const n = parseNumber(value);
    if (n === null) return value ? String(value) : "—";
    return n.toLocaleString("ru-RU", { maximumFractionDigits: 0 }) + " ₽";
  }

  function findMetric(text, regex) {
    const m = String(text || "").match(regex);
    return m ? m[1].trim() : "";
  }

  function getData(item) {
    return item?.calculation_data || {};
  }

  function getInputs(item) {
    return getData(item).inputs || {};
  }

  function getCustomer(item) {
    const data = getData(item);
    const inputs = getInputs(item);

    const candidates = [
      data.customer_name,
      data.customer,
      data.client_name,
      data.client,
      inputs.customerName,
      inputs.customer,
      inputs.clientName,
      inputs.client,
      item.customer_name,
      item.customer,
      item.client_name,
      item.client
    ];

    for (const candidate of candidates) {
      const value = String(candidate ?? "").trim();

      if (
        value &&
        value.toLowerCase() !== "undefined" &&
        value.toLowerCase() !== "null"
      ) {
        return value;
      }
    }

    const raw = String(
      data.result_text || ""
    );

    const match = raw.match(
      /(?:Заказчик|Клиент)\s*[:—-]\s*([^\n|]+)/i
    );

    if (match && match[1]) {
      return String(
        match[1]
      ).trim();
    }

    return "";
  }

  function cleanTitle(item) {
    const data = getData(item);
    const inputs = getInputs(item);
    const customer = getCustomer(item);
    const rawTitle = String(data.title || inputs.title || "").trim();
    if (!rawTitle || /^undefined$/i.test(rawTitle) || /^(быстрый|детальный) расч[её]т$/i.test(rawTitle)) {
      return customer || (item.mode === "detail" ? "Детальный расчёт" : "Быстрый расчёт");
    }
    return rawTitle;
  }

  

  async function loadCloudHistory(user) {
    if (!client || !user) return [];
    const all = [];
    const page = 500;
    let from = 0;
    while (true) {
      const result = await client
        .from("calculations")
        .select("id,user_id,mode,calculation_data,created_at")
        .eq("user_id", user.id)
        .in("mode", ["quick", "detail"])
        .order("created_at", { ascending: false })
        .range(from, from + page - 1);
      if (result.error) throw result.error;
      const rows = result.data || [];
      all.push(...rows);
      if (rows.length < page) break;
      from += page;
    }
    return all;
  }

  function fingerprint(item) {
    const data = getData(item);
    if (data.client_id) return "client:" + data.client_id;
    if (item.id && !String(item.id).startsWith("local-")) return "id:" + item.id;
    return [
      item.mode || "",
      data.saved_at_client || "",
      data.result_text || "",
      data.title || "",
    ].join("|");
  }

  

  function metrics(item) {
    const data = getData(item);
    const inputs = getInputs(item);
    const raw = String(data.result_text || "");

    const price =
      findMetric(raw, /Цена клиенту\s*[:—-]?\s*([\d\s\u00a0.,]+\s*₽)/i) ||
      findMetric(raw, /Цена продажи\s*[:—-]?\s*([\d\s\u00a0.,]+\s*₽)/i) ||
      (inputs.price ? fmtMoney(inputs.price) : "—");

    const cost =
      findMetric(raw, /Себестоимость\s*[:—-]?\s*([\d\s\u00a0.,]+\s*₽)/i) ||
      (inputs.cost ? fmtMoney(inputs.cost) : "—");

    const margin =
      findMetric(raw, /Маржинальность\s*[:—-]?\s*([\d\s\u00a0.,]+%)/i) ||
      (inputs.margin !== undefined && inputs.margin !== "" ? fmt(inputs.margin, "%") : "—");

    const price1000 =
      findMetric(raw, /([\d\s\u00a0.,]+\s*₽\s*\/\s*1000\s*шт\.?)/i) ||
      (inputs.price1000 ? fmtMoney(inputs.price1000) + " / 1000 шт." : "");

    const priceM2 =
      findMetric(raw, /([\d\s\u00a0.,]+\s*₽\s*\/\s*м²)/i) ||
      (inputs.priceM2 ? fmtMoney(inputs.priceM2) + " / м²" : "");

    return {
      price,
      cost,
      margin,
      price1000,
      priceM2,
      qty: inputs.qty ? fmt(inputs.qty, "шт.", 0) : findMetric(raw, /Тираж\s*[:—-]?\s*([\d\s\u00a0.,]+\s*шт\.?)/i) || "—",
      width: inputs.width || "",
      height: inputs.height || "",
      machine: inputs.machineName || "",
      materialName: inputs.materialName || "",
      meters: inputs.meters ? fmt(inputs.meters, "м") : findMetric(raw, /Метраж\s*[:—-]?\s*([\d\s\u00a0.,]+\s*м)/i),
      area: inputs.area ? fmt(inputs.area, "м²") : findMetric(raw, /Площадь\s*[:—-]?\s*([\d\s\u00a0.,]+\s*м²)/i),
      materialKg: inputs.materialKg ? fmt(inputs.materialKg, "кг") : findMetric(raw, /Материал\s*[:—-]?\s*([\d\s\u00a0.,]+\s*кг)/i),
      setup: inputs.setup ? fmt(inputs.setup, "мин", 0) : findMetric(raw, /Наладка\s*[:—-]?\s*([\d\s\u00a0.,]+\s*мин)/i),
      printTime: inputs.printTime ? fmt(inputs.printTime, "мин") : findMetric(raw, /Печать\s*[:—-]?\s*([\d\s\u00a0.,]+\s*мин)/i),
      speed: inputs.speed ? fmt(inputs.speed, "м/мин") : "",
      power: inputs.power ? fmt(inputs.power, "кВт") : "",
      lamination: inputs.lamEnabled ? "Включена" : "",
      die: inputs.dieEnabled ? "Включена" : "",
    };
  }

  function buildExtraDetails(item, m) {
    const data = getData(item);
    const inputs = getInputs(item);
    const raw = String(data.result_text || "");
    const rows = [];

    const add = (label, value) => {
      if (value !== null && value !== undefined && String(value).trim() !== "") {
        rows.push(`<div class="pc-history-detail-item"><span>${escapeHtml(label)}</span><b>${escapeHtml(value)}</b></div>`);
      }
    };

    add("Скорость", m.speed);
    add("Мощность", m.power);
    add("Наладка", m.setup);
    add("Печать", m.printTime);
    add("Ламинация", m.lamination);
    add("Вырубка", m.die);

    const cleanRaw = raw
      .split(/\n+/)
      .map((line) => line.trim())
      .filter(Boolean)
      .filter((line) => !/^undefined$/i.test(line))
      .filter((line) => !/^расч[её]т\s+готов$/i.test(line))
      .filter((line) => !/^готово$/i.test(line))
      .filter((line) => !/^(цена\s+клиенту|себестоимость|маржинальность)/i.test(line));

    const extras = cleanRaw.slice(0, 12);
    extras.forEach((line) => {
      const normalized = line.replace(/^[:—-]\s*/, "");
      const parts = normalized.split(/\s{2,}|:\s+/);
      if (parts.length >= 2) add(parts[0], parts.slice(1).join(": "));
    });

    if (!rows.length) return "";

    return `
      <details class="pc-history-details-v22">
        <summary>
          <span>Полная расшифровка</span>
          <span class="pc-details-arrow">⌄</span>
        </summary>
        <div class="pc-history-detail-grid-v22">${rows.slice(0, 18).join("")}</div>
      </details>`;
  }

  function renderHistory(rows) {
    const box = $("pc-account-history");
    if (!box) return;

    if (!rows.length) {
      box.innerHTML = `
        <div class="pc-history-empty-v22">
          <div class="pc-history-empty-icon">⌕</div>
          <strong>Расчётов не найдено</strong>
          <span>Попробуйте изменить дату, период или название заказчика.</span>
        </div>`;
      return;
    }

    box.innerHTML = rows.map((item) => {
      const data = getData(item);
      const m = metrics(item);
      const customer = getCustomer(item);
      const detail = item.mode === "detail";
      const title = cleanTitle(item);
      const orderNoV36 = data.order_number ? `№ ${escapeHtml(data.order_number)}` : "№ без номера";
      const when = formatDate(item.created_at || data.saved_at_client);
      const size = m.width && m.height ? `${m.width} × ${m.height} мм` : "";
      const extraDetails = buildExtraDetails(item, m);
      const secondary = [m.price1000, m.priceM2].filter(Boolean);

      return `
        <article class="pc-history-card-v22">
          <header class="pc-history-card-head-v23">

          <div class="pc-history-card-ident-v23">

            <div class="pc-history-type-row-v23">

              <span class="pc-history-kind-v22 ${detail ? "detail" : "quick"}">
                <span class="pc-history-kind-dot-v22"></span>
                <span class="pc-history-order-v36">${orderNoV36}</span>
                ${detail ? "ДЕТАЛЬНЫЙ РАСЧЁТ" : "БЫСТРЫЙ РАСЧЁТ"}
              </span>

              <span class="pc-history-customer-v23 ${customer ? "" : "is-empty"}">
                ${customer
                  ? escapeHtml(customer)
                  : "ЗАКАЗЧИК НЕ УКАЗАН"
                }
              </span>

            </div>

            <h3>${escapeHtml(title)}</h3>

            <div class="pc-history-date-v23">
              ${escapeHtml(when)}
            </div>

          </div>

          <span class="pc-history-ready-v22">
            <i></i>ГОТОВО
          </span>

        </header>

          <section class="pc-history-finance-v22">
            <div class="pc-history-finance-main-v22">
              <span>ЦЕНА КЛИЕНТУ</span>
              <strong>${escapeHtml(m.price)}</strong>
              ${secondary.length ? `<small>${secondary.join(" · ")}</small>` : ""}
            </div>
            <div class="pc-history-finance-v22 cost">
              <span>СЕБЕСТОИМОСТЬ</span>
              <strong>${escapeHtml(m.cost)}</strong>
            </div>
            <div class="pc-history-finance-v22 margin">
              <span>МАРЖИНАЛЬНОСТЬ</span>
              <strong>${escapeHtml(m.margin)}</strong>
            </div>
          </section>

          <section class="pc-history-order-v22">
            <div class="pc-history-group-title-v22">ЗАКАЗ</div>
            <div class="pc-history-data-grid-v22">
              <div><span>ТИРАЖ</span><b>${escapeHtml(m.qty)}</b></div>
              ${size ? `<div><span>РАЗМЕР</span><b>${escapeHtml(size)}</b></div>` : ""}
              ${m.materialName ? `<div><span>МАТЕРИАЛ</span><b>${escapeHtml(m.materialName)}</b></div>` : ""}
              ${m.machine ? `<div><span>СТАНОК</span><b>${escapeHtml(m.machine)}</b></div>` : ""}
            </div>
          </section>

          <section class="pc-history-production-v22">
            <div class="pc-history-group-title-v22">КЛЮЧЕВЫЕ ПАРАМЕТРЫ</div>
            <div class="pc-history-metrics-grid-v22">
              ${m.meters ? `<div><span>МЕТРАЖ</span><b>${escapeHtml(m.meters)}</b></div>` : ""}
              ${m.area ? `<div><span>ПЛОЩАДЬ</span><b>${escapeHtml(m.area)}</b></div>` : ""}
              ${m.materialKg ? `<div><span>МАТЕРИАЛ</span><b>${escapeHtml(m.materialKg)}</b></div>` : ""}
              ${m.setup ? `<div><span>НАЛАДКА</span><b>${escapeHtml(m.setup)}</b></div>` : ""}
              ${m.printTime ? `<div><span>ПЕЧАТЬ</span><b>${escapeHtml(m.printTime)}</b></div>` : ""}
            </div>
          </section>

          ${extraDetails}
        </article>`;
    }).join("");
  }

  function updateCount(visible) {
    const badge = $("pc-history-filter-count-v22");
    if (!badge) return;
    badge.textContent = visible === allHistoryRows.length
      ? `${allHistoryRows.length} расчётов`
      : `${visible} из ${allHistoryRows.length}`;
  }

  function customerNames() {
    const seen = new Map();
    allHistoryRows.forEach((item) => {
      const name = getCustomer(item);
      if (!name) return;
      const key = textNorm(name);
      if (!seen.has(key)) seen.set(key, name);
    });
    return [...seen.values()].sort((a, b) => a.localeCompare(b, "ru"));
  }

  function renderFilterFields() {
    const host = $("pc-history-filter-fields-v22");
    const type = $("pc-history-filter-type-v22")?.value || "date";
    if (!host) return;

    if (type === "date") {
      host.innerHTML = `
        <input id="pc-history-filter-date-v22" class="pc-history-date-input-v22" type="date" aria-label="Дата расчёта">`;
      $("pc-history-filter-date-v22")?.addEventListener("input", applyFilters);
      return;
    }

    if (type === "period") {
      host.innerHTML = `
        <div class="pc-history-period-fields-v22">
          <label><span>С</span><input id="pc-history-filter-from-v22" type="date"></label>
          <label><span>ПО</span><input id="pc-history-filter-to-v22" type="date"></label>
        </div>`;
      $("pc-history-filter-from-v22")?.addEventListener("input", applyFilters);
      $("pc-history-filter-to-v22")?.addEventListener("input", applyFilters);
      return;
    }

    host.innerHTML = `
      <div class="pc-history-customer-search-v22">
        <input id="pc-history-filter-customer-v22" type="text" autocomplete="off" placeholder="Начните вводить заказчика…" aria-label="Заказчик">
        <div id="pc-history-customer-suggestions-v22" class="pc-history-suggestions-v22" hidden></div>
      </div>`;

    const input = $("pc-history-filter-customer-v22");
    const suggestions = $("pc-history-customer-suggestions-v22");

    function drawSuggestions() {
      const q = textNorm(input?.value || "");
      const names = customerNames().filter((name) => !q || textNorm(name).includes(q)).slice(0, 8);
      if (!suggestions || !names.length) {
        if (suggestions) suggestions.hidden = true;
        return;
      }
      suggestions.innerHTML = names.map((name) => `
        <button type="button" class="pc-history-suggestion-v22" data-name="${escapeHtml(name)}">
          <span>${escapeHtml(name)}</span><b>↗</b>
        </button>`).join("");
      suggestions.hidden = false;
    }

    input?.addEventListener("input", () => {
      drawSuggestions();
      applyFilters();
    });
    input?.addEventListener("focus", drawSuggestions);

    suggestions?.addEventListener("click", (event) => {
      const button = event.target.closest("[data-name]");
      if (!button) return;
      input.value = button.dataset.name || "";
      suggestions.hidden = true;
      applyFilters();
    });

    document.addEventListener("click", (event) => {
      if (!host.contains(event.target) && suggestions) suggestions.hidden = true;
    }, { once: false });
  }

  function applyFilters() {
    const type = $("pc-history-filter-type-v22")?.value || "date";
    let visible = allHistoryRows;

    if (type === "date") {
      const day = $("pc-history-filter-date-v22")?.value || "";
      if (day) visible = allHistoryRows.filter((item) => dateOnly(item.created_at || getData(item).saved_at_client) === day);
    }

    if (type === "period") {
      const from = $("pc-history-filter-from-v22")?.value || "";
      const to = $("pc-history-filter-to-v22")?.value || "";
      if (from || to) {
        visible = allHistoryRows.filter((item) => {
          const day = dateOnly(item.created_at || getData(item).saved_at_client);
          if (!day) return false;
          if (from && day < from) return false;
          if (to && day > to) return false;
          return true;
        });
      }
    }

    if (type === "customer") {
      const query = textNorm($("pc-history-filter-customer-v22")?.value || "");
      if (query) visible = allHistoryRows.filter((item) => textNorm(getCustomer(item)).includes(query));
    }

    renderHistory(visible);
    updateCount(visible.length);
  }

  async function loadAccount() {
    if (!client) return;
    const session = await client.auth.getSession();
    const user = session.data?.session?.user || null;
    if (!user) {
      window.location.replace("./?auth=1");
      return;
    }
    const email = $("pc-account-email");
    if (email) email.textContent = user.email || "Рабочий аккаунт";
    try {
      allHistoryRows = await loadCloudHistory(user);
    } catch (error) {
      console.warn("PRINTORA: history cloud read", error);
      const box = $("pc-history");
      if (box) box.innerHTML = `<div class="pc-empty">Не удалось загрузить облачную историю: ${escapeHtml(error?.message || "ошибка")}</div>`;
      allHistoryRows = [];
    }
    const count = $("pc-calculation-count");
    if (count) count.textContent = String(allHistoryRows.length);
    renderFilterFields();
    applyFilters();
  }

  async function logout() {
    const button = $("pc-account-logout");
    if (button) {
      button.disabled = true;
      button.textContent = "Выходим…";
    }
    try {
      if (client) await client.auth.signOut({ scope: "local" });
    } catch (_) {}
    window.location.replace("./");
  }

  function init() {
    $("pc-account-logout")?.addEventListener("click", logout);
    $("pc-account-refresh")?.addEventListener("click", loadAccount);
    $("pc-history-filter-type-v22")?.addEventListener("change", () => {
      renderFilterFields();
      applyFilters();
    });
    window.addEventListener("printcalc:history-saved", loadAccount);
    loadAccount();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
