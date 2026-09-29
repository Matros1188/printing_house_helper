(() => {
  "use strict";

  const config = window.PRINTCALC_CONFIG || {};
  const AUTH_STORAGE_KEY = "printcalc-flexo-auth";
  const HISTORY_PREFIX = "printcalc_history_cache_v4::";

  const client = window.supabase && config.SUPABASE_URL && config.SUPABASE_ANON_KEY
    ? window.supabase.createClient(
        config.SUPABASE_URL,
        config.SUPABASE_ANON_KEY,
        {
          auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true,
            storage: window.localStorage,
            storageKey: AUTH_STORAGE_KEY
          }
        }
      )
    : null;

  const $ = id => document.getElementById(id);

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
    }[char]));
  }

  function dateValue(value) {
    const date = new Date(value || 0);
    return Number.isNaN(date.getTime()) ? 0 : date.getTime();
  }

  function formatDate(value) {
    const date = new Date(value || 0);
    if (Number.isNaN(date.getTime())) return "";
    return date.toLocaleString("ru-RU", {
      day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit"
    });
  }

  function localHistoryKey(userId) {
    return HISTORY_PREFIX + userId;
  }

  function readLocalHistory(userId) {
    try {
      const raw = localStorage.getItem(localHistoryKey(userId));
      const data = raw ? JSON.parse(raw) : [];
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
      saved: data.saved_at_client || item.created_at || ""
    });
  }

  async function loadCloudHistory(user) {
    const all = [];
    const size = 1000;
    let start = 0;

    while (true) {
      const response = await client
        .from("calculations")
        .select("id,user_id,mode,calculation_data,created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .range(start, start + size - 1);

      if (response.error) throw response.error;
      const rows = response.data || [];
      all.push(...rows);
      if (rows.length < size) break;
      start += size;
    }
    return all;
  }

  function mergeHistory(cloudRows, localRows) {
    const map = new Map();
    [...localRows, ...cloudRows].forEach(item => {
      if (!item) return;
      const key = fingerprint(item);
      const old = map.get(key);
      if (!old) {
        map.set(key, item);
        return;
      }
      const oldLocal = String(old.id || "").startsWith("local-");
      const newLocal = String(item.id || "").startsWith("local-");
      if (oldLocal && !newLocal) map.set(key, item);
    });
    return Array.from(map.values()).sort((a,b) =>
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
          <span>После сохранения расчётов они появятся здесь.</span>
          <a href="quick.html">Открыть быстрый расчёт →</a>
        </div>`;
      return;
    }

    box.innerHTML = items.map(item => {
      const data = item.calculation_data || {};
      const inputs = data.inputs || {};
      const detail = item.mode === "detail";
      const qty = Number(inputs.qty);
      const tags = [];
      if (Number.isFinite(qty) && qty > 0) tags.push(qty.toLocaleString("ru-RU") + " шт.");
      if (inputs.machineName) tags.push(inputs.machineName);
      if (inputs.width && inputs.height) tags.push(`${inputs.width} × ${inputs.height} мм`);

      return `
        <article class="pc-account-history-item">
          <div class="pc-history-type ${detail ? "is-detail" : "is-quick"}">${detail ? "Σ" : "⚡"}</div>
          <div class="pc-history-content">
            <div class="pc-history-line">
              <span class="pc-history-mode">${detail ? "Детальный расчёт" : "Быстрый расчёт"}</span>
              <time>${escapeHtml(formatDate(item.created_at || data.saved_at_client))}</time>
            </div>
            <strong>${escapeHtml(data.title || (detail ? "Детальный расчёт" : "Быстрый расчёт"))}</strong>
            ${tags.length ? `<div class="pc-history-tags">${tags.map(v => `<span>${escapeHtml(v)}</span>`).join("")}</div>` : ""}
            ${data.result_text ? `<div class="pc-history-result-text">${escapeHtml(data.result_text).slice(0, 420)}${data.result_text.length > 420 ? "…" : ""}</div>` : ""}
          </div>
        </article>`;
    }).join("");
  }

  async function loadAccount() {
    if (!client) {
      const box = $("pc-account-history");
      if (box) box.innerHTML = `<div class="pc-account-error">Supabase не подключён.</div>`;
      return;
    }

    const sessionResponse = await client.auth.getSession();
    const user = sessionResponse.data?.session?.user || null;
    if (!user) {
      window.location.replace("./?auth=1");
      return;
    }

    const email = $("pc-account-email");
    if (email) email.textContent = user.email || "Рабочий аккаунт";

    const localRows = readLocalHistory(user.id);
    let cloudRows = [];
    try {
      cloudRows = await loadCloudHistory(user);
    } catch (error) {
      console.warn("PRINTCALC cloud history:", error);
    }

    const rows = mergeHistory(cloudRows, localRows);
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
      await client?.auth.signOut();
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
