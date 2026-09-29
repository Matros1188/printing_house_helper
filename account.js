(() => {
  "use strict";

  const core = window.PRINTCALC_AUTH_CORE || {};
  const client = core.getClient ? core.getClient() : null;
  const HISTORY_PREFIX = "printcalc_history_cache_v6::";
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
    try {
      const data = JSON.parse(localStorage.getItem(localKey(userId)) || "[]");
      return Array.isArray(data) ? data : [];
    } catch (_) {
      return [];
    }
  }

  function stableStringify(value) {
    if (value === null || typeof value !== "object") return JSON.stringify(value);
    if (Array.isArray(value)) return "[" + value.map(stableStringify).join(",") + "]";
    return "{" + Object.keys(value).sort().map(k => JSON.stringify(k) + ":" + stableStringify(value[k])).join(",") + "}";
  }

  function fingerprint(item) {
    if (item.local_fingerprint) return item.local_fingerprint;
    const data = item.calculation_data || {};
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

    box.innerHTML = items.map((item) => {
      const data = item.calculation_data || {};
      const inputs = data.inputs || {};
      const detail = item.mode === "detail";
      const qty = Number(inputs.qty);
      const tags = [];

      if (Number.isFinite(qty) && qty > 0) {
        tags.push(qty.toLocaleString("ru-RU") + " шт.");
      }
      if (inputs.machineName) tags.push(inputs.machineName);
      if (inputs.width && inputs.height) {
        tags.push(`${inputs.width} × ${inputs.height} мм`);
      }

      return `
        <article class="pc-account-history-item">
          <div class="pc-history-type ${detail ? "is-detail" : "is-quick"}">
            ${detail ? "Σ" : "⚡"}
          </div>
          <div class="pc-history-content">
            <div class="pc-history-line">
              <span class="pc-history-mode">${detail ? "Детальный расчёт" : "Быстрый расчёт"}</span>
              <time>${escapeHtml(formatDate(item.created_at || data.saved_at_client))}</time>
            </div>
            <strong>${escapeHtml(data.title || (detail ? "Детальный расчёт" : "Быстрый расчёт"))}</strong>
            ${tags.length ? `<div class="pc-history-tags">${tags.map(v => `<span>${escapeHtml(v)}</span>`).join("")}</div>` : ""}
            ${data.result_text ? `<div class="pc-history-result-text">${escapeHtml(data.result_text).slice(0, 500)}${data.result_text.length > 500 ? "…" : ""}</div>` : ""}
          </div>
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
    loadAccount();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
