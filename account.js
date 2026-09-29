(() => {
  "use strict";

  const config = window.PRINTCALC_CONFIG || {};
  const client = window.supabase && config.SUPABASE_URL && config.SUPABASE_ANON_KEY
    ? window.supabase.createClient(config.SUPABASE_URL, config.SUPABASE_ANON_KEY)
    : null;

  const $ = id => document.getElementById(id);

  const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  }[char]));

  function formatDate(value) {
    if (!value) return "";

    return new Date(value).toLocaleString("ru-RU", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  }

  function modeLabel(mode) {
    return mode === "detail" ? "Детальный расчёт" : "Быстрый расчёт";
  }

  function getInputs(item) {
    return item?.calculation_data?.inputs || {};
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
        </div>
      `;
      return;
    }

    box.innerHTML = items.map(item => {
      const data = item.calculation_data || {};
      const inputs = getInputs(item);
      const mode = item.mode || "quick";
      const resultText = data.result_text || "";
      const machine = inputs.machineName || "";
      const qtyNumber = Number(inputs.qty);
      const qty = Number.isFinite(qtyNumber) && qtyNumber > 0
        ? qtyNumber.toLocaleString("ru-RU") + " шт."
        : "";

      const details = [];
      if (qty) details.push(qty);
      if (machine) details.push(machine);
      if (inputs.width && inputs.height) details.push(`${inputs.width} × ${inputs.height} мм`);
      if (inputs.markup !== undefined && mode === "detail") details.push(`Наценка ${inputs.markup}%`);

      return `
        <article class="pc-account-history-item">
          <div class="pc-history-type ${mode === "detail" ? "is-detail" : "is-quick"}">
            ${mode === "detail" ? "Σ" : "⚡"}
          </div>

          <div class="pc-history-content">
            <div class="pc-history-line">
              <span class="pc-history-mode">${escapeHtml(modeLabel(mode))}</span>
              <time>${escapeHtml(formatDate(item.created_at))}</time>
            </div>

            <strong>${escapeHtml(data.title || modeLabel(mode))}</strong>

            ${details.length ? `
              <div class="pc-history-tags">
                ${details.map(value => `<span>${escapeHtml(value)}</span>`).join("")}
              </div>
            ` : ""}

            ${resultText ? `
              <div class="pc-history-result-text">
                ${escapeHtml(resultText).slice(0, 420)}${resultText.length > 420 ? "…" : ""}
              </div>
            ` : ""}
          </div>
        </article>
      `;
    }).join("");
  }

  async function loadAllHistory(user) {
    const all = [];
    const pageSize = 1000;
    let start = 0;

    while (true) {
      const response = await client
        .from("calculations")
        .select("id,mode,calculation_data,created_at")
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

    try {
      const rows = await loadAllHistory(user);
      const count = $("pc-calculation-count");

      if (count) count.textContent = String(rows.length);
      renderHistory(rows);
    } catch (error) {
      console.warn("PRINTCALC account:", error);

      const count = $("pc-calculation-count");
      const box = $("pc-account-history");

      if (count) count.textContent = "0";
      if (box) {
        box.innerHTML = `
          <div class="pc-account-error">
            Не удалось загрузить историю расчётов.
          </div>
        `;
      }
    }
  }

  async function logout() {
    const button = $("pc-account-logout");
    if (button) {
      button.disabled = true;
      button.textContent = "Выходим…";
    }

    try {
      if (client) await client.auth.signOut();
    } finally {
      window.location.replace("./");
    }
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
