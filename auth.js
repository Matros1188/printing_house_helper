(() => {
  "use strict";

  const config = window.PRINTCALC_CONFIG || {};
  const client = window.supabase && config.SUPABASE_URL && config.SUPABASE_ANON_KEY
    ? window.supabase.createClient(config.SUPABASE_URL, config.SUPABASE_ANON_KEY)
    : null;

  let currentUser = null;
  let authMode = "login";

  const $ = id => document.getElementById(id);

  function removeLegacyAccountControls() {
    document.querySelectorAll(
      "[data-account-button], .account-btn, .account-button"
    ).forEach(node => {
      if (!node.classList.contains("pc-account-button") && !node.closest(".pc-auth-card")) {
        node.remove();
      }
    });
  }

  function ensureAccountButton() {
    let button = document.querySelector(".pc-account-button");

    if (!button) {
      const header = document.querySelector(".header-in") ||
                     document.querySelector("header .wrap") ||
                     document.querySelector("header");

      if (!header) return null;

      button = document.createElement("button");
      button.type = "button";
      button.className = "pc-account-button";
      button.id = "pc-account-button";
      header.appendChild(button);
    }

    return button;
  }

  function renderAccountButton() {
    const button = ensureAccountButton();
    if (!button) return;

    const loggedIn = Boolean(currentUser);

    button.textContent = loggedIn
      ? "ЛИЧНЫЙ КАБИНЕТ"
      : "АККАУНТ";

    button.classList.toggle("pc-account-authenticated", loggedIn);
    button.setAttribute(
      "aria-label",
      loggedIn ? "Открыть личный кабинет" : "Войти в аккаунт"
    );
    button.title = loggedIn
      ? "Открыть личный кабинет"
      : "Войти в аккаунт";

    button.onclick = () => {
      if (currentUser) {
        window.location.href = "account.html";
      } else {
        openAccount();
      }
    };
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

        <div class="pc-auth-brand pc-auth-brand-v16">
  <img src="brand-mark.svg?v=160" alt="" aria-hidden="true">
  <span><b>PRINTCALC</b><small>FLEXO</small></span>
</div>
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

    modal.querySelector(".pc-auth-close")?.addEventListener("click", closeAccount);

    modal.querySelectorAll("[data-auth-mode]").forEach(button => {
      button.addEventListener("click", () => {
        authMode = button.dataset.authMode;
        setMessage("");
        renderAuth();
      });
    });

    $("pc-submit")?.addEventListener("click", submitAuth);
    $("pc-logout")?.addEventListener("click", logout);

    $("pc-password")?.addEventListener("keydown", event => {
      if (event.key === "Enter") submitAuth();
    });
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
      button.classList.toggle("active", button.dataset.authMode === authMode);
    });

    if (submit) {
      submit.textContent = authMode === "register" ? "Создать аккаунт" : "Войти";
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
    if (!modal) return;

    modal.hidden = false;
    modal.removeAttribute("aria-hidden");

    const email = $("pc-email");
    if (email) window.setTimeout(() => email.focus(), 50);
  }

  function closeAccount() {
    const modal = $("pc-auth-modal");
    if (!modal) return;

    modal.hidden = true;
    modal.setAttribute("aria-hidden", "true");
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
        // Сразу закрываем окно после успешного входа.
        closeAccount();
      }
    } catch (error) {
      setMessage(error?.message || "Ошибка авторизации.", "error");
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
      window.location.replace("./");
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
      inputs[id] = element.type === "checkbox"
        ? element.checked
        : element.value;
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

    const mode = window.location.pathname.toLowerCase().includes("detail")
      ? "detail"
      : "quick";

    const inputs = collectCalculationSnapshot(mode);

    const response = await client
      .from("calculations")
      .insert({
        user_id: currentUser.id,
        mode,
        calculation_data: {
          title: mode === "detail" ? "Детальный расчёт" : "Быстрый расчёт",
          result_text: resultText,
          inputs,
          saved_at_client: new Date().toISOString()
        }
      });

    if (response.error) {
      console.warn("PRINTCALC saveCalculation:", response.error.message);
    }
  }

  async function init() {
    removeLegacyAccountControls();
    createModal();

    if (!client) {
      renderAuth();
      return;
    }

    const sessionResponse = await client.auth.getSession();
    currentUser = sessionResponse.data?.session?.user || null;
    renderAuth();

    // Уже авторизован — никакого висящего окна входа.
    if (currentUser) closeAccount();

    client.auth.onAuthStateChange((event, sessionData) => {
      currentUser = sessionData?.session?.user || null;
      renderAuth();

      if (currentUser) {
        closeAccount();
      } else if (event === "SIGNED_OUT") {
        closeAccount();
      }
    });

    document.addEventListener("click", event => {
      if (event.target.closest("#calc") || event.target.closest("[data-calculate]")) {
        window.setTimeout(saveCalculation, 700);
      }
    });

    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get("auth") === "1" && !currentUser) {
        window.setTimeout(openAccount, 120);
      }
    } catch (_) {}
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
