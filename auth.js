(() => {
  "use strict";

  const config = window.PRINTCALC_CONFIG || {};
  const supabaseLib = window.supabase || null;

  const client =
    supabaseLib &&
    config.SUPABASE_URL &&
    config.SUPABASE_ANON_KEY
      ? supabaseLib.createClient(
          config.SUPABASE_URL,
          config.SUPABASE_ANON_KEY
        )
      : null;

  let currentUser = null;
  let authMode = "login";

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    }[char]));
  }

  function addAccountButton() {
    let button = document.querySelector(".pc-account-button");

    if (!button) {
      button = document.createElement("button");
      button.type = "button";
      button.className = "pc-account-button";

      const header =
        document.querySelector(".header-in") ||
        document.querySelector(".header") ||
        document.body;

      header.appendChild(button);
      button.addEventListener("click", openAccount);
    }

    button.textContent = currentUser
      ? "Аккаунт · ●"
      : "Аккаунт";
  }

  function ensureCreator() {
    const logo = document.querySelector(".logo-text");
    if (!logo || logo.querySelector(".pc-brand-credit")) return;

    const credit = document.createElement("em");
    credit.className = "pc-brand-credit";
    credit.textContent = "Created by Sergey Pavlov";
    logo.appendChild(credit);
  }

  function createModal() {
    if (document.getElementById("pc-auth-modal")) return;

    const modal = document.createElement("div");
    modal.id = "pc-auth-modal";
    modal.className = "pc-auth-modal";
    modal.hidden = true;

    modal.innerHTML = `
      <div class="pc-auth-card" role="dialog" aria-modal="true" aria-labelledby="pc-auth-title">
        <button type="button" class="pc-auth-close" id="pc-auth-close" aria-label="Закрыть">×</button>
        <div class="pc-auth-brand">PRINTCALC FLEXO</div>
        <h2 id="pc-auth-title">Ваш рабочий аккаунт</h2>
        <p class="pc-auth-lead">Сохраняйте расчёты и свои станки в аккаунте и открывайте их с другого устройства.</p>

        <div class="pc-auth-tabs">
          <button type="button" data-auth-mode="login">Войти</button>
          <button type="button" data-auth-mode="register">Создать аккаунт</button>
        </div>

        <div id="pc-auth-message" class="pc-auth-message"></div>

        <div id="pc-auth-form">
          <label class="pc-auth-field">
            <span>Email</span>
            <input id="pc-email" type="email" autocomplete="email" placeholder="name@company.ru">
          </label>
          <label class="pc-auth-field">
            <span>Пароль</span>
            <input id="pc-password" type="password" autocomplete="current-password" placeholder="Минимум 6 символов">
          </label>
          <button id="pc-submit" class="pc-submit" type="button">Войти</button>
        </div>

        <div id="pc-session" hidden>
          <div class="pc-session-label">ВЫ ВОШЛИ</div>
          <div id="pc-session-email" class="pc-session-email"></div>

          <div class="pc-history-head">
            <span>История расчётов</span>
            <button id="pc-refresh" type="button">Обновить</button>
          </div>
          <div id="pc-history" class="pc-history"></div>

          <button id="pc-logout" class="pc-logout" type="button">Выйти</button>
        </div>

        <div class="pc-auth-foot">Каждый аккаунт видит только собственные данные.</div>
      </div>
    `;

    document.body.appendChild(modal);

    modal.addEventListener("click", event => {
      if (event.target === modal) closeAccount();
    });

    document.getElementById("pc-auth-close")?.addEventListener("click", closeAccount);
    document.getElementById("pc-submit")?.addEventListener("click", submitAuth);
    document.getElementById("pc-refresh")?.addEventListener("click", loadHistory);
    document.getElementById("pc-logout")?.addEventListener("click", logout);

    modal.querySelectorAll("[data-auth-mode]").forEach(button => {
      button.addEventListener("click", () => {
        authMode = button.dataset.authMode || "login";
        renderAuth();
      });
    });

    renderAuth();
  }

  function setMessage(text, type = "") {
    const box = document.getElementById("pc-auth-message");
    if (!box) return;
    box.textContent = text || "";
    box.className = "pc-auth-message " + type;
  }

  function renderAuth() {
    addAccountButton();
    createModal();

    const form = document.getElementById("pc-auth-form");
    const session = document.getElementById("pc-session");
    const email = document.getElementById("pc-session-email");
    const submit = document.getElementById("pc-submit");

    if (!form || !session) return;

    form.hidden = Boolean(currentUser);
    session.hidden = !currentUser;

    if (email) email.textContent = currentUser?.email || "";

    document.querySelectorAll("[data-auth-mode]").forEach(button => {
      button.classList.toggle(
        "active",
        button.dataset.authMode === authMode
      );
    });

    if (submit) {
      submit.textContent = authMode === "register"
        ? "Создать аккаунт"
        : "Войти";
    }

    const account = document.querySelector(".pc-account-button");
    if (account) {
      account.textContent = currentUser
        ? "Аккаунт · ●"
        : "Аккаунт";
    }
  }

  async function submitAuth() {
    if (!client) {
      setMessage("Supabase не подключён.", "error");
      return;
    }

    const email = document.getElementById("pc-email")?.value.trim() || "";
    const password = document.getElementById("pc-password")?.value || "";

    if (!email || !email.includes("@")) {
      setMessage("Введите корректный email.", "error");
      return;
    }

    if (password.length < 6) {
      setMessage("Пароль должен быть минимум 6 символов.", "error");
      return;
    }

    const submit = document.getElementById("pc-submit");
    if (submit) submit.disabled = true;

    try {
      const response = authMode === "register"
        ? await client.auth.signUp({ email, password })
        : await client.auth.signInWithPassword({ email, password });

      if (response.error) throw response.error;

      const sessionResponse = await client.auth.getSession();
      currentUser = sessionResponse?.data?.session?.user || null;

      if (authMode === "register" && !currentUser) {
        setMessage("Аккаунт создан. Проверьте почту.", "success");
      } else {
        setMessage("Вход выполнен.", "success");
      }

      renderAuth();
      if (currentUser) {
        await loadHistory();
        await loadSnapshotFromUrl();
      }

      window.dispatchEvent(new CustomEvent("printcalc:auth-changed", {
        detail: currentUser
      }));
    } catch (error) {
      setMessage(
        error?.message || "Ошибка авторизации.",
        "error"
      );
    } finally {
      if (submit) submit.disabled = false;
    }
  }

  async function logout() {
    try {
      if (client) await client.auth.signOut();
    } catch (error) {
      console.warn("PRINTCALC logout:", error);
    }

    currentUser = null;
    renderAuth();
    setMessage("Вы вышли из аккаунта.", "success");

    window.dispatchEvent(new CustomEvent("printcalc:auth-changed", {
      detail: null
    }));
  }

  async function loadHistory() {
    if (!client || !currentUser) return;

    const box = document.getElementById("pc-history");
    if (!box) return;

    box.innerHTML = "<div class='pc-empty'>Загрузка...</div>";

    const response = await client
      .from("calculations")
      .select("id,mode,calculation_data,created_at")
      .neq("mode", "machine")
      .order("created_at", { ascending: false })
      .limit(50);

    if (response.error) {
      box.innerHTML = `<div class="pc-empty">${escapeHtml(response.error.message)}</div>`;
      return;
    }

    if (!response.data?.length) {
      box.innerHTML = "<div class='pc-empty'>Сохранённых расчётов пока нет.</div>";
      return;
    }

    response.data.forEach(item => {
      try {
        localStorage.setItem(
          "printcalc_history_snapshot::" + item.id,
          JSON.stringify(item.calculation_data || {})
        );
      } catch (error) {
        // ignore
      }
    });

    box.innerHTML = response.data.map(item => {
      const data = item.calculation_data || {};
      const title = data.title || "Расчёт заказа";
      const date = new Date(item.created_at).toLocaleString("ru-RU");
      const label = item.mode === "detail" ? "Детальный расчёт" : "Быстрый расчёт";

      return `
        <button type="button" class="pc-history-item pc-history-clickable"
          data-history-id="${escapeHtml(item.id)}"
          data-history-mode="${escapeHtml(item.mode)}">
          <span class="pc-history-type">${label}</span>
          <strong>${escapeHtml(title)}</strong>
          <small>${escapeHtml(date)}</small>
          <span class="pc-history-open">Открыть →</span>
        </button>
      `;
    }).join("");
  }

  async function saveCalculation(payload) {
    payload = payload || window.PRINTCALC_LAST_CALC || null;
    if (!payload) return;

    const mode = payload.mode ||
      (location.pathname.toLowerCase().includes("detail") ? "detail" : "quick");

    const result =
      document.querySelector("#result") ||
      document.querySelector(".result");

    const calculationData = {
      title: payload.title || "Расчёт заказа",
      mode,
      snapshot: payload,
      result_text: (result?.innerText || "").trim()
    };

    if (!client || !currentUser) {
      try {
        localStorage.setItem(
          "printcalc_last_guest_calculation",
          JSON.stringify(calculationData)
        );
      } catch (error) {
        // ignore
      }
      return;
    }

    const response = await client
      .from("calculations")
      .insert({
        user_id: currentUser.id,
        mode,
        calculation_data: calculationData
      })
      .select("id")
      .maybeSingle();

    if (response.error) {
      console.warn("PRINTCALC save:", response.error.message);
      return;
    }

    try {
      if (response.data?.id) {
        localStorage.setItem(
          "printcalc_history_snapshot::" + response.data.id,
          JSON.stringify(calculationData)
        );
      }
    } catch (error) {
      // ignore
    }

    await loadHistory();
  }

  async function loadSnapshotFromUrl() {
    const loadId = new URLSearchParams(location.search).get("load");
    if (!loadId) return;

    try {
      const raw = localStorage.getItem(
        "printcalc_history_snapshot::" + loadId
      );
      const localData = raw ? JSON.parse(raw) : null;

      if (localData?.snapshot) {
        window.setTimeout(() => {
          window.dispatchEvent(new CustomEvent("printcalc:load-snapshot", {
            detail: localData.snapshot
          }));
        }, 120);
        return;
      }
    } catch (error) {
      // ignore
    }

    if (!client || !currentUser) return;

    try {
      const response = await client
        .from("calculations")
        .select("id,mode,calculation_data")
        .eq("id", loadId)
        .eq("user_id", currentUser.id)
        .maybeSingle();

      if (response.error || !response.data) return;

      const data = response.data.calculation_data || {};

      try {
        localStorage.setItem(
          "printcalc_history_snapshot::" + loadId,
          JSON.stringify(data)
        );
      } catch (error) {
        // ignore
      }

      window.setTimeout(() => {
        window.dispatchEvent(new CustomEvent("printcalc:load-snapshot", {
          detail: data.snapshot || data
        }));
      }, 120);
    } catch (error) {
      console.warn("PRINTCALC history load:", error);
    }
  }

  function openAccount() {
    createModal();
    const modal = document.getElementById("pc-auth-modal");
    if (modal) modal.hidden = false;
    if (currentUser) loadHistory();
  }

  function closeAccount() {
    const modal = document.getElementById("pc-auth-modal");
    if (modal) modal.hidden = true;
  }

  async function init() {
    addAccountButton();
    ensureCreator();
    createModal();

    document.addEventListener("printcalc:save-request", event => {
      saveCalculation(event.detail || window.PRINTCALC_LAST_CALC);
    });

    document.addEventListener("click", event => {
      const item = event.target.closest("[data-history-id]");
      if (!item) return;

      const id = item.getAttribute("data-history-id");
      const mode = item.getAttribute("data-history-mode") || "quick";
      const target = mode === "detail" ? "detail.html" : "quick.html";
      location.href = `${target}?load=${encodeURIComponent(id)}`;
    });

    if (!client) {
      renderAuth();
      return;
    }

    const sessionResponse = await client.auth.getSession();
    currentUser = sessionResponse?.data?.session?.user || null;
    renderAuth();

    if (currentUser) {
      await loadHistory();
      await loadSnapshotFromUrl();
    }

    client.auth.onAuthStateChange((_event, session) => {
      currentUser = session?.user || null;
      renderAuth();
      window.dispatchEvent(new CustomEvent("printcalc:auth-changed", {
        detail: currentUser
      }));
      if (currentUser) {
        loadHistory();
        loadSnapshotFromUrl();
      }
    });
  }

  window.PRINTCALC_AUTH = {
    getUser: () => currentUser,
    getClient: () => client
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
