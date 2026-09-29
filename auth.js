(() => {
  "use strict";

  const config = window.PRINTCALC_CONFIG || {};
  const client = window.supabase && config.SUPABASE_URL && config.SUPABASE_ANON_KEY
    ? window.supabase.createClient(
        config.SUPABASE_URL,
        config.SUPABASE_ANON_KEY,
        {
          auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: false,
            storage: window.localStorage,
            storageKey: "printcalc-flexo-auth"
          }
        }
      )
    : null;

  let currentUser = null;
  let authMode = "login";

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (char) => ({
      "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#039;"
    }[char]));
  }

  function accountButton() {
    return document.querySelector(".pc-account-button");
  }

  function addAccountButton() {
    document.querySelectorAll(".pc-account-button").forEach((el, index) => {
      if (index > 0 || !el.closest(".printora-header-v32")) el.remove();
    });

    const header = document.querySelector(".printora-header-v32 .header-in");
    if (!header) return;

    let button = header.querySelector(".pc-account-button");
    if (!button) {
      button = document.createElement("button");
      button.type = "button";
      button.className = "pc-account-button";
      button.addEventListener("click", openAccount);
      header.appendChild(button);
    }

    renderAccountButton();
  }

  function renderAccountButton() {
    const button = accountButton();
    if (!button) return;

    button.textContent = currentUser ? "ЛИЧНЫЙ КАБИНЕТ" : "АККАУНТ";
    button.setAttribute("aria-label", currentUser ? "Открыть личный кабинет" : "Войти в аккаунт");
    button.dataset.loggedIn = currentUser ? "1" : "0";
  }

  function createModal() {
    if (document.getElementById("pc-auth-modal")) return;

    const modal = document.createElement("div");
    modal.id = "pc-auth-modal";
    modal.className = "pc-auth-modal";
    modal.hidden = true;

    modal.innerHTML = `
      <div class="pc-auth-card">
        <button type="button" class="pc-auth-close" aria-label="Закрыть">×</button>
        <div class="pc-auth-brand">PRINTORA</div>
        <h2>Ваш рабочий аккаунт</h2>
        <p class="pc-auth-lead">Сохраняйте расчёты и открывайте свою историю с любого устройства.</p>
        <div class="pc-auth-tabs">
          <button type="button" data-auth-mode="login">Войти</button>
          <button type="button" data-auth-mode="register">Создать аккаунт</button>
        </div>
        <div id="pc-auth-message" class="pc-auth-message"></div>
        <div id="pc-auth-form">
          <label>
            Email
            <input id="pc-email" type="email" autocomplete="email" placeholder="name@company.ru">
          </label>
          <label>
            Пароль
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
        <div class="pc-auth-foot">Каждый аккаунт видит только собственные расчёты.</div>
      </div>`;

    document.body.appendChild(modal);

    modal.addEventListener("click", (event) => {
      if (event.target === modal) closeAccount();
    });

    modal.querySelector(".pc-auth-close").addEventListener("click", closeAccount);
    modal.querySelectorAll("[data-auth-mode]").forEach((button) => {
      button.addEventListener("click", () => {
        authMode = button.dataset.authMode || "login";
        renderAuth();
      });
    });
    modal.querySelector("#pc-submit").addEventListener("click", submitAuth);
    modal.querySelector("#pc-refresh").addEventListener("click", loadHistory);
    modal.querySelector("#pc-logout").addEventListener("click", logout);
  }

  function setMessage(text, type) {
    const box = document.getElementById("pc-auth-message");
    if (!box) return;
    box.textContent = text || "";
    box.className = "pc-auth-message " + (type || "");
  }

  function renderAuth() {
    renderAccountButton();
    const form = document.getElementById("pc-auth-form");
    const session = document.getElementById("pc-session");
    const email = document.getElementById("pc-session-email");
    if (!form || !session) return;

    form.hidden = Boolean(currentUser);
    session.hidden = !currentUser;
    if (email) email.textContent = currentUser?.email || "";

    document.querySelectorAll("[data-auth-mode]").forEach((button) => {
      button.classList.toggle("active", button.dataset.authMode === authMode);
    });

    const submit = document.getElementById("pc-submit");
    if (submit) submit.textContent = authMode === "register" ? "Создать аккаунт" : "Войти";
  }

  async function submitAuth() {
    if (!client) {
      setMessage("Supabase не подключён.", "error");
      return;
    }

    const emailEl = document.getElementById("pc-email");
    const passwordEl = document.getElementById("pc-password");
    const submit = document.getElementById("pc-submit");
    const email = (emailEl?.value || "").trim();
    const password = passwordEl?.value || "";

    if (!email || !email.includes("@")) {
      setMessage("Введите корректный email.", "error");
      return;
    }
    if (password.length < 6) {
      setMessage("Пароль должен быть минимум 6 символов.", "error");
      return;
    }

    if (submit) submit.disabled = true;

    try {
      const response = authMode === "register"
        ? await client.auth.signUp({ email, password })
        : await client.auth.signInWithPassword({ email, password });

      if (response.error) throw response.error;

      const sessionResult = await client.auth.getSession();
      currentUser = sessionResult.data?.session?.user || null;
      renderAuth();

      if (currentUser) {
        closeAccount();
        await loadHistory();
        setTimeout(() => window.dispatchEvent(new CustomEvent("printcalc:auth-changed")), 0);
      } else {
        setMessage("Аккаунт создан. Проверьте почту.", "success");
      }
    } catch (error) {
      setMessage(error?.message || "Ошибка авторизации.", "error");
    } finally {
      if (submit) submit.disabled = false;
    }
  }

  async function logout() {
    try {
      if (client) await client.auth.signOut({ scope: "local" });
    } catch (_) {}

    currentUser = null;
    renderAuth();
    closeAccount();
  }

  async function loadHistory() {
    if (!client || !currentUser) return;

    const box = document.getElementById("pc-history");
    if (!box) return;

    box.innerHTML = "<div class='pc-empty'>Загрузка...</div>";

    const response = await client
      .from("calculations")
      .select("id,mode,calculation_data,created_at")
      .eq("user_id", currentUser.id)
      .order("created_at", { ascending: false })
      .limit(30);

    if (response.error) {
      box.innerHTML = "<div class='pc-empty'>" + escapeHtml(response.error.message) + "</div>";
      return;
    }

    if (!response.data?.length) {
      box.innerHTML = "<div class='pc-empty'>Сохранённых расчётов пока нет.</div>";
      return;
    }

    box.innerHTML = response.data.map((item) => {
      const title = item.calculation_data?.title || "Расчёт заказа";
      const date = new Date(item.created_at).toLocaleString("ru-RU");
      return `
        <div class="pc-history-item">
          <div>
            <b>${item.mode === "detail" ? "Σ Детальный расчёт" : "⚡ Быстрый расчёт"}</b>
            <small>${escapeHtml(title)}</small>
            <small>${escapeHtml(date)}</small>
          </div>
        </div>`;
    }).join("");
  }

  async function saveCalculation() {
    if (!client || !currentUser) return;

    const result = document.querySelector("#result") || document.querySelector(".result");
    if (!result) return;

    const resultText = (result.innerText || "").trim();
    if (resultText.length < 30) return;

    const mode = location.pathname.toLowerCase().includes("detail") ? "detail" : "quick";
    const response = await client.from("calculations").insert({
      user_id: currentUser.id,
      mode,
      calculation_data: {
        title: mode === "detail" ? "Детальный расчёт" : "Быстрый расчёт",
        result_text: resultText,
        saved_at_client: new Date().toISOString()
      }
    });

    if (response.error) console.warn("PRINTORA:", response.error.message);
    window.dispatchEvent(new CustomEvent("printcalc:history-saved"));
  }

  function openAccount() {
    if (currentUser) {
      window.location.href = "./account.html";
      return;
    }
    createModal();
    const modal = document.getElementById("pc-auth-modal");
    if (modal) modal.hidden = false;
    renderAuth();
  }

  function closeAccount() {
    const modal = document.getElementById("pc-auth-modal");
    if (modal) modal.hidden = true;
  }

  async function init() {
    addAccountButton();
    createModal();

    if (!client) {
      renderAuth();
      return;
    }

    const session = await client.auth.getSession();
    currentUser = session.data?.session?.user || null;
    renderAuth();

    if (!currentUser && new URLSearchParams(window.location.search).get("auth") === "1") {
      window.history.replaceState({}, document.title, window.location.pathname);
      setTimeout(openAccount, 80);
    }

    client.auth.onAuthStateChange((_event, sessionData) => {
      currentUser = sessionData?.user || null;
      renderAuth();
      if (currentUser) loadHistory();
    });

    document.addEventListener("click", (event) => {
      if (event.target.closest("#calc") || event.target.closest("[data-calculate]")) {
        setTimeout(saveCalculation, 700);
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
