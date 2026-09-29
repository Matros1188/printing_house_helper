(() => {
  "use strict";

  const config = window.PRINTCALC_CONFIG || {};
  const client = window.supabase && config.SUPABASE_URL && config.SUPABASE_ANON_KEY
    ? window.supabase.createClient(config.SUPABASE_URL, config.SUPABASE_ANON_KEY)
    : null;

  let currentUser = null;
  let authMode = "login";

  const $ = id => document.getElementById(id);

  function addAccountButton() {
    let button = document.querySelector(".pc-account-button");

    if (!button) {
      button = document.createElement("button");
      button.type = "button";
      button.className = "pc-account-button";

      const header = document.querySelector(".header-in") || document.querySelector(".header");
      (header || document.body).appendChild(button);
    }

    button.onclick = () => {
      if (currentUser) {
        window.location.href = "account.html";
      } else {
        openAccount();
      }
    };

    renderAccountButton();
  }

  function renderAccountButton() {
    const button = document.querySelector(".pc-account-button");
    if (!button) return;

    const loggedIn = Boolean(currentUser);

    button.textContent = loggedIn
      ? "ЛИЧНЫЙ КАБИНЕТ"
      : "АККАУНТ";

    button.classList.toggle(
      "pc-account-authenticated",
      loggedIn
    );

    button.title = loggedIn
      ? "Открыть личный кабинет"
      : "Войти в аккаунт";
  }

  function createModal() {
    if ($("pc-auth-modal")) return;

    const modal = document.createElement("div");
    modal.id = "pc-auth-modal";
    modal.className = "pc-auth-modal";
    modal.hidden = true;

    modal.innerHTML = `
      <div class="pc-auth-card" role="dialog" aria-modal="true" aria-labelledby="pc-auth-title">
        <button type="button" class="pc-auth-close" aria-label="Закрыть">×</button>

        <div class="pc-auth-brand">PRINTCALC FLEXO</div>
        <h2 id="pc-auth-title">Ваш рабочий аккаунт</h2>
        <p class="pc-auth-lead">
          Сохраняйте расчёты и открывайте историю из личного кабинета.
        </p>

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
          <a class="pc-modal-account-link" href="account.html">
            Открыть личный кабинет →
          </a>
          <button id="pc-logout" class="pc-logout" type="button">
            Выйти из аккаунта
          </button>
        </div>

        <div class="pc-auth-foot">
          Каждый аккаунт видит только собственные расчёты.
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    modal.addEventListener("click", event => {
      if (event.target === modal) closeAccount();
    });

    modal.querySelector(".pc-auth-close")?.addEventListener(
      "click",
      closeAccount
    );

    modal.querySelectorAll("[data-auth-mode]").forEach(button => {
      button.addEventListener("click", () => {
        authMode = button.dataset.authMode;
        renderAuth();
      });
    });

    $("pc-submit")?.addEventListener("click", submitAuth);
    $("pc-logout")?.addEventListener("click", logout);

    renderAuth();
  }

  function setMessage(text, type = "") {
    const box = $("pc-auth-message");
    if (!box) return;

    box.textContent = text || "";
    box.className = "pc-auth-message " + type;
  }

  function renderAuth() {
    const form = $("pc-auth-form");
    const session = $("pc-session");
    const email = $("pc-session-email");
    const submit = $("pc-submit");

    if (form) form.hidden = Boolean(currentUser);
    if (session) session.hidden = !currentUser;
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

    renderAccountButton();
  }

  function openAccount() {
    if (currentUser) {
      window.location.href = "account.html";
      return;
    }

    createModal();

    const modal = $("pc-auth-modal");
    if (modal) modal.hidden = false;

    const email = $("pc-email");
    if (email) {
      window.setTimeout(() => email.focus(), 50);
    }
  }

  function closeAccount() {
    const modal = $("pc-auth-modal");
    if (modal) modal.hidden = true;
  }

  async function submitAuth() {
    if (!client) {
      setMessage("Supabase не подключён.", "error");
      return;
    }

    const email = ($("pc-email")?.value || "").trim();
    const password = $("pc-password")?.value || "";
    const submit = $("pc-submit");

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

      const sessionResponse = await client.auth.getSession();
      currentUser = sessionResponse.data?.session?.user || null;

      if (authMode === "register" && !currentUser) {
        setMessage(
          "Аккаунт создан. Проверьте почту для подтверждения.",
          "success"
        );
        renderAuth();
        return;
      }

      if (currentUser) {
        renderAuth();

        // Ключевое изменение V15:
        // после успешного входа окно больше НЕ остаётся на экране.
        closeAccount();

        try {
          const params = new URLSearchParams(window.location.search);
          if (params.get("auth") === "1") {
            params.delete("auth");
            const clean = window.location.pathname +
              (params.toString() ? "?" + params.toString() : "");
            window.history.replaceState({}, "", clean);
          }
        } catch (_) {
          // ignore
        }
      }
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
    } finally {
      currentUser = null;
      renderAuth();
      closeAccount();
    }
  }

  function collectCalculationSnapshot(mode) {
    const ids = mode === "detail"
      ? [
          "qty", "streams", "width", "height", "web", "repeat", "gsm", "waste",
          "matPrice", "colors", "inkPrice", "inkUse",
          "machineSelect", "speed", "power", "setup", "machine", "labor", "powerRate",
          "lam", "die", "lamEnabled", "dieEnabled",
          "overhead", "admin", "markup", "minimum"
        ]
      : [
          "qty", "streams", "width", "height", "web", "repeat", "gsm", "waste",
          "matPrice", "colors", "inkPrice", "inkUse", "lam", "die"
        ];

    const inputs = {};

    ids.forEach(id => {
      const element = $(id);
      if (!element) return;

      if (element.type === "checkbox") {
        inputs[id] = element.checked;
      } else {
        inputs[id] = element.value;
      }
    });

    if (mode === "detail") {
      const select = $("machineSelect");
      if (select && select.value) {
        const option = select.options[select.selectedIndex];
        inputs.machineName = option?.textContent || "";
      }
    }

    return inputs;
  }

  async function saveCalculation() {
    if (!client || !currentUser) return;

    const result = $("result") || document.querySelector(".result");
    if (!result) return;

    const resultText = (result.innerText || "").trim();
    if (resultText.length < 20) return;

    const mode = window.location.pathname
      .toLowerCase()
      .includes("detail")
      ? "detail"
      : "quick";

    const inputs = collectCalculationSnapshot(mode);

    const response = await client
      .from("calculations")
      .insert({
        user_id: currentUser.id,
        mode,
        calculation_data: {
          title: mode === "detail"
            ? "Детальный расчёт"
            : "Быстрый расчёт",
          result_text: resultText,
          inputs,
          saved_at_client: new Date().toISOString()
        }
      });

    if (response.error) {
      console.warn(
        "PRINTCALC saveCalculation:",
        response.error.message
      );
    }
  }

  async function init() {
    addAccountButton();
    createModal();

    if (!client) return;

    const sessionResponse = await client.auth.getSession();
    currentUser = sessionResponse.data?.session?.user || null;
    renderAuth();

    client.auth.onAuthStateChange((event, sessionData) => {
      currentUser = sessionData?.user || null;
      renderAuth();

      if (event === "SIGNED_IN" || event === "INITIAL_SESSION") {
        if (currentUser) closeAccount();
      }
    });

    // Сохраняем расчёт только после фактического нажатия на кнопку расчёта.
    document.addEventListener("click", event => {
      if (
        event.target.closest("#calc") ||
        event.target.closest("[data-calculate]")
      ) {
        window.setTimeout(saveCalculation, 700);
      }
    });

    // Прямая ссылка account.html → главная + открытие входа.
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get("auth") === "1" && !currentUser) {
        window.setTimeout(openAccount, 120);
      }
    } catch (_) {
      // ignore
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
