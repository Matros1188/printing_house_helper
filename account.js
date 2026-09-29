(() => {
  "use strict";

  const core = window.PRINTCALC_AUTH_CORE || {};
  const client = core.getClient ? core.getClient() : null;
  const HISTORY_PREFIX = "printcalc_history_cache_v7::";
  const $ = (id) => document.getElementById(id);

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (char) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;",
    }[char]));
  }

  function dateValue(value) {
    const d = new Date(value || 0);
    return Number.isNaN(d.getTime()) ? 0 : d.getTime();
  }

  function formatDate(value) {
    const d = new Date(value || 0);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleString("ru-RU", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function localKey(userId) {
    return HISTORY_PREFIX + userId;
  }

  function localHistory(userId) {
    const keys = [
      HISTORY_PREFIX + userId,
      "printcalc_history_cache_v6::" + userId,
      "printcalc_history_cache_v5::" + userId,
      "printcalc_history_cache_v4::" + userId,
    ];

    const all = [];

    for (const key of keys) {
      try {
        const data = JSON.parse(localStorage.getItem(key) || "[]");
        if (Array.isArray(data)) all.push(...data);
      } catch (_) {}
    }

    const seen = new Set();
    return all.filter((item) => {
      const data = item?.calculation_data || {};
      const key = data.client_id || item?.id;
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function stableStringify(value) {
    if (value === null || typeof value !== "object") return JSON.stringify(value);
    if (Array.isArray(value)) return "[" + value.map(stableStringify).join(",") + "]";
    return "{" + Object.keys(value).sort().map(k => JSON.stringify(k) + ":" + stableStringify(value[k])).join(",") + "}";
  }

  function fingerprint(item) {
    const data = item.calculation_data || {};
    if (data.client_id) return "client:" + data.client_id;
    if (item.id) return "id:" + item.id;
    return stableStringify({
      mode: item.mode || "quick",
      result: data.result_text || "",
      inputs: data.inputs || {},
      saved: data.saved_at_client || item.created_at || "",
    });
  }

  async function loadCloudHistory(user) {
    if (!client) return [];

    const all = [];
    let start = 0;
    const pageSize = 500;

    while (true) {
      const response = await client
        .from("calculations")
        .select("id,user_id,mode,calculation_data,created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .range(start, start + pageSize - 1);

      if (response.error) throw response.error;

      const rows = response.data || [];
      all.push(...rows);

      if (rows.length < pageSize) break;
      start += pageSize;
    }

    return all;
  }

  function merge(cloudRows, localRows) {
    const map = new Map();

    [...localRows, ...cloudRows].forEach((item) => {
      if (!item) return;
      const key = fingerprint(item);
      const existing = map.get(key);

      if (!existing) {
        map.set(key, item);
        return;
      }

      const existingLocal = String(existing.id || "").startsWith("local-");
      const newLocal = String(item.id || "").startsWith("local-");

      if (existingLocal && !newLocal) map.set(key, item);
    });

    return [...map.values()].sort((a, b) =>
      dateValue(b.created_at || b.calculation_data?.saved_at_client) -
      dateValue(a.created_at || a.calculation_data?.saved_at_client)
    );
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
      .replace(/м\/мин/gi, "")
      .replace(/кВт/gi, "")
      .replace(/,/g, ".")
      .replace(/[^0-9.\-]/g, "");
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : null;
  }

  function formatQty(value) {
    const n = parseNumber(value);
    return n === null ? "—" : Math.round(n).toLocaleString("ru-RU") + " шт.";
  }

  function formatMetric(value, unit = "") {
    const n = parseNumber(value);
    if (n === null) return value ? String(value) : "—";
    return n.toLocaleString("ru-RU", { maximumFractionDigits: 2 }) + (unit ? " " + unit : "");
  }

  function findMetric(text, regex) {
    const match = String(text || "").match(regex);
    return match ? match[1].trim() : "";
  }

  function cleanTitle(value, detail) {
    const title = String(value || "").trim();
    if (!title || title.toLowerCase() === "undefined" || title === "Детальный расчёт" || title === "Быстрый расчёт") {
      return detail ? "Детальный расчёт" : "Быстрый расчёт";
    }
    return title;
  }

  function renderHistory(items) {
    const box = $("pc-account-history");
    if (!box) return;

    if (!items.length) {
      box.innerHTML = `
        <div class="pc-account-empty">
          <div class="pc-account-empty-icon">Σ</div>
          <strong>История пока пуста</strong>
          <span>Сохранённые расчёты появятся здесь.</span>
          <a href="quick.html">Открыть быстрый расчёт →</a>
        </div>`;
      return;
    }

    box.classList.add("pc-history-v20-list");

    box.innerHTML = items.map((item) => {
      const data = item.calculation_data || {};
      const inputs = data.inputs || {};
      const detail = item.mode === "detail";
      const raw = String(data.result_text || "");

      const title = cleanTitle(data.title, detail);
      const date = formatDate(item.created_at || data.saved_at_client);

      const clientPrice =
        findMetric(raw, /Цена клиенту\s*[:—-]?\s*([\d\s\u00a0.,]+\s*₽)/i) ||
        findMetric(raw, /Цена продажи\s*[:—-]?\s*([\d\s\u00a0.,]+\s*₽)/i);

      const cost =
        findMetric(raw, /Себестоимость\s*[:—-]?\s*([\d\s\u00a0.,]+\s*₽)/i);

      const margin =
        findMetric(raw, /Маржинальность\s*[:—-]?\s*([\d\s\u00a0.,]+%)/i) ||
        (inputs.margin ? String(inputs.margin) + "%" : "");

      const price1000 =
        findMetric(raw, /([\d\s\u00a0.,]+\s*₽\s*\/\s*1000\s*шт\.?)/i);

      const priceM2 =
        findMetric(raw, /([\d\s\u00a0.,]+\s*₽\s*\/\s*м²)/i);

      const meters =
        findMetric(raw, /Метраж\s*[:—-]?\s*([\d\s\u00a0.,]+\s*м)/i) ||
        (inputs.meters ? formatMetric(inputs.meters, "м") : "");

      const area =
        findMetric(raw, /Площадь\s*[:—-]?\s*([\d\s\u00a0.,]+\s*м²)/i) ||
        (inputs.area ? formatMetric(inputs.area, "м²") : "");

      const material =
        findMetric(raw, /Материал\s*[:—-]?\s*([\d\s\u00a0.,]+\s*кг)/i) ||
        (inputs.materialKg ? formatMetric(inputs.materialKg, "кг") : "");

      const setup =
        findMetric(raw, /Наладка\s*[:—-]?\s*([\d\s\u00a0.,]+\s*мин)/i) ||
        (inputs.setup ? formatMetric(inputs.setup, "мин") : "");

      const printTime =
        findMetric(raw, /Печать\s*[:—-]?\s*([\d\s\u00a0.,]+\s*мин)/i) ||
        (inputs.printTime ? formatMetric(inputs.printTime, "мин") : "");

      const qty = inputs.qty ? formatQty(inputs.qty) :
        (findMetric(raw, /Тираж\s*[:—-]?\s*([\d\s\u00a0.,]+\s*шт\.?)/i) || "—");

      const machine = inputs.machineName || "";
      const materialName = inputs.materialName || "";
      const size = inputs.width && inputs.height
        ? `${escapeHtml(inputs.width)} × ${escapeHtml(inputs.height)} мм`
        : "";

      const readableLines = raw
        .split(/\n+/)
        .map(line => line.trim())
        .filter(line => line)
        .filter(line => !/^undefined$/i.test(line))
        .filter(line => !/^РАСЧЁТ\s+ГОТОВ$/i.test(line))
        .filter(line => !/^ГОТОВО$/i.test(line))
        .filter(line => !/^Цена\s+клиенту/i.test(line))
        .filter(line => !/^Себестоимость/i.test(line))
        .filter(line => !/^Маржинальность/i.test(line))
        .slice(0, 16);

      const detailsHtml = readableLines.length
        ? `<details class="pc-history-details">
             <summary>Полная расшифровка расчёта</summary>
             <div class="pc-history-raw-grid">
               ${readableLines.map(line => `<span>${escapeHtml(line)}</span>`).join("")}
             </div>
           </details>`
        : "";

      return `
        <article class="pc-history-card-v20">
          <div class="pc-history-card-head">
            <div class="pc-history-card-title-group">
              <span class="pc-history-mode-pill ${detail ? "is-detail" : "is-quick"}">
                <b>${detail ? "Σ" : "⚡"}</b>
                ${detail ? "Детальный расчёт" : "Быстрый расчёт"}
              </span>
              <h3>${escapeHtml(title)}</h3>
              <div class="pc-history-date">${escapeHtml(date)}</div>
            </div>
            <span class="pc-history-status">ГОТОВО</span>
          </div>

          <div class="pc-history-primary">
            <div class="pc-history-primary-card price-card">
              <span class="pc-history-label">ЦЕНА КЛИЕНТУ</span>
              <strong>${escapeHtml(clientPrice || "—")}</strong>
              ${price1000 ? `<small>${escapeHtml(price1000)}</small>` : ""}
            </div>

            <div class="pc-history-primary-card cost-card">
              <span class="pc-history-label">СЕБЕСТОИМОСТЬ</span>
              <strong>${escapeHtml(cost || "—")}</strong>
              ${priceM2 ? `<small>${escapeHtml(priceM2)}</small>` : ""}
            </div>

            <div class="pc-history-primary-card margin-card">
              <span class="pc-history-label">МАРЖИНАЛЬНОСТЬ</span>
              <strong>${escapeHtml(margin || "—")}</strong>
            </div>
          </div>

          <div class="pc-history-order-strip">
            <div>
              <span>ТИРАЖ</span>
              <b>${escapeHtml(qty)}</b>
            </div>
            ${size ? `<div><span>РАЗМЕР</span><b>${size}</b></div>` : ""}
            ${machine ? `<div><span>СТАНОК</span><b>${escapeHtml(machine)}</b></div>` : ""}
            ${materialName ? `<div><span>МАТЕРИАЛ</span><b>${escapeHtml(materialName)}</b></div>` : ""}
          </div>

          <div class="pc-history-metrics">
            ${meters ? `<div><span>МЕТРАЖ</span><b>${escapeHtml(meters)}</b></div>` : ""}
            ${area ? `<div><span>ПЛОЩАДЬ</span><b>${escapeHtml(area)}</b></div>` : ""}
            ${material ? `<div><span>МАТЕРИАЛ</span><b>${escapeHtml(material)}</b></div>` : ""}
            ${setup ? `<div><span>НАЛАДКА</span><b>${escapeHtml(setup)}</b></div>` : ""}
            ${printTime ? `<div><span>ПЕЧАТЬ</span><b>${escapeHtml(printTime)}</b></div>` : ""}
          </div>

          ${detailsHtml}
        </article>`;
    }).join("");
  }

  async function loadAccount() {
    if (!client) return;

    const sessionResponse = await client.auth.getSession();
    const user = sessionResponse.data?.session?.user || null;

    if (!user) {
      window.location.replace("./?auth=1");
      return;
    }

    const email = $("pc-account-email");
    if (email) email.textContent = user.email || "Рабочий аккаунт";

    const localRows = localHistory(user.id);
    let cloudRows = [];

    try {
      cloudRows = await loadCloudHistory(user);
    } catch (error) {
      console.warn("PRINTCALC account history:", error);
    }

    const rows = merge(cloudRows, localRows);

    const count = $("pc-calculation-count");
    if (count) count.textContent = String(rows.length);

    renderHistory(rows);
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

    try {
      localStorage.removeItem("printcalc_last_account_v3");
    } catch (_) {}

    window.location.replace("./");
  }

  function init() {
    $("pc-account-logout")?.addEventListener("click", logout);
    $("pc-account-refresh")?.addEventListener("click", loadAccount);

    // Если расчёт был сохранён в другой вкладке/странице,
    // кабинет автоматически обновится при его событии.
    window.addEventListener("storage", (event) => {
      if (event.key && event.key.includes("printcalc_history_cache_")) {
        loadAccount();
      }
    });

    loadAccount();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
