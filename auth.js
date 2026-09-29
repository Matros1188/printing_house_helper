(() => {
  "use strict";

  const core = window.PRINTCALC_AUTH_CORE || {};
  const client = core.getClient ? core.getClient() : null;
  const LAST_USER_KEY = "printcalc_last_account_v3";
  const HISTORY_PREFIX = "printcalc_history_cache_v7::";

  let currentUser = null;
  let authMode = "login";
  let saveTimer = 0;
  let signedOutCheckTimer = 0;
  let initialized = false;

  const $ = (id) => document.getElementById(id);

  function readRememberedUser() {
    try {
      const raw = localStorage.getItem(LAST_USER_KEY);
      const data = raw ? JSON.parse(raw) : null;
      return data && data.id ? data : null;
    } catch (_) {
      return null;
    }
  }

  function rememberUser(user) {
    if (!user?.id) return;
    try {
      localStorage.setItem(
        LAST_USER_KEY,
        JSON.stringify({
          id: user.id,
          email: user.email || "",
        })
      );
    } catch (_) {}
  }

  function forgetUser() {
    try {
      localStorage.removeItem(LAST_USER_KEY);
    } catch (_) {}
  }

  function ensureAccountButton() {
    let button = document.querySelector(".pc-account-button");
    if (button) return button;

    const header =
      document.querySelector(".header-in") ||
      document.querySelector("header .wrap") ||
      document.querySelector("header");

    if (!header) return null;

    button = document.createElement("button");
    button.type = "button";
    button.className = "pc-account-button";
    button.id = "pc-account-button";
    header.appendChild(button);
    return button;
  }

  function renderAccountButton() {
    const button = ensureAccountButton();
    if (!button) return;

    const loggedIn = Boolean(currentUser);

    button.textContent = loggedIn
      ? "ЛИЧНЫЙ КАБИНЕТ"
      : "АККАУНТ";

    button.classList.toggle(
      "pc-account-authenticated",
      loggedIn
    );

    button.onclick = loggedIn
      ? () => {
          window.location.href = "account.html";
        }
      : openAccount;
  }

  function createModal() {
    if ($("pc-auth-modal")) return;

    const modal = document.createElement("div");
    modal.id = "pc-auth-modal";
    modal.className = "pc-auth-modal";
    modal.hidden = true;
    modal.setAttribute("aria-hidden", "true");

    modal.innerHTML = `
      <div class="pc-auth-card" role="dialog" aria-modal="true" aria-labelledby="pc-auth-title">
        <button type="button" class="pc-auth-close" aria-label="Закрыть">×</button>

        <div class="pc-auth-brand pc-auth-brand-v16">
          <img src="brand-mark.svg?v=190" alt="" aria-hidden="true">
          <span>
            <b>PRINTCALC</b>
            <small>FLEXO</small>
          </span>
        </div>

        <h2 id="pc-auth-title">Ваш рабочий аккаунт</h2>

        <p class="pc-auth-lead">
          Расчёты, станки и история сохраняются за вашим аккаунтом.
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
          <a class="pc-modal-account-link" href="account.html">Открыть личный кабинет →</a>
          <button id="pc-logout" class="pc-logout" type="button">Выйти из аккаунта</button>
        </div>

        <div class="pc-auth-foot">
          Сессия сохраняется на этом устройстве до нажатия «Выйти из аккаунта».
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    modal.addEventListener("click", (event) => {
      if (event.target === modal) closeAccount();
    });

    modal
      .querySelector(".pc-auth-close")
      ?.addEventListener("click", closeAccount);

    modal
      .querySelectorAll("[data-auth-mode]")
      .forEach((button) => {
        button.addEventListener("click", () => {
          authMode = button.dataset.authMode || "login";
          setMessage("");
          renderAuth();
        });
      });

    $("pc-submit")?.addEventListener("click", submitAuth);
    $("pc-logout")?.addEventListener("click", logout);

    $("pc-password")?.addEventListener("keydown", (event) => {
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

    document
      .querySelectorAll("[data-auth-mode]")
      .forEach((button) => {
        button.classList.toggle(
          "active",
          button.dataset.authMode === authMode
        );
      });

    if (submit) {
      submit.textContent =
        authMode === "register" ? "Создать аккаунт" : "Войти";
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
    modal.setAttribute("aria-hidden", "false");
    window.setTimeout(() => $("pc-email")?.focus(), 50);
  }

  function closeAccount() {
    const modal = $("pc-auth-modal");
    if (!modal) return;
    modal.hidden = true;
    modal.setAttribute("aria-hidden", "true");
  }

  function historyKey() {
    return currentUser?.id
      ? HISTORY_PREFIX + currentUser.id
      : "";
  }

  function readLocalHistory() {
    const key = historyKey();
    if (!key) return [];
    try {
      const data = JSON.parse(localStorage.getItem(key) || "[]");
      return Array.isArray(data) ? data : [];
    } catch (_) {
      return [];
    }
  }

  function writeLocalHistory(rows) {
    const key = historyKey();
    if (!key) return;
    try {
      localStorage.setItem(key, JSON.stringify(rows.slice(0, 5000)));
    } catch (_) {}
  }

  function stableStringify(value) {
    if (value === null || typeof value !== "object") {
      return JSON.stringify(value);
    }
    if (Array.isArray(value)) {
      return "[" + value.map(stableStringify).join(",") + "]";
    }
    return "{" +
      Object.keys(value)
        .sort()
        .map((key) => JSON.stringify(key) + ":" + stableStringify(value[key]))
        .join(",") +
      "}";
  }

  function collectSnapshot(mode) {
    const detailIds = [
      "customerName","qty","streams","width","height","web","repeat","gsm","waste",
      "matPrice","colors","inkPrice","inkUse","machineSelect",
      "speed","power","setup","machine","labor","powerRate",
      "lam","die","lamEnabled","dieEnabled","overhead","admin",
      "markup","minimum"
    ];

    const quickIds = [
      "customerName","qty","streams","width","height","web","repeat","gsm","waste",
      "matPrice","colors","inkPrice","inkUse","lam","die"
    ];

    const inputs = {};

    (mode === "detail" ? detailIds : quickIds).forEach((id) => {
      const element = $(id);
      if (!element) return;
      inputs[id] = element.type === "checkbox"
        ? Boolean(element.checked)
        : element.value;
    });

    const machineSelect = $("machineSelect");
    if (machineSelect?.value) {
      inputs.machineName =
        machineSelect.options[machineSelect.selectedIndex]?.textContent || "";
    }

    return inputs;
  }

  function getResultElement() {
    return $("result") || document.querySelector(".result");
  }

  async function getLiveUser() {
    // Всегда перепроверяем реальную persisted-session перед сохранением.
    if (!client) return currentUser;

    try {
      const response = await client.auth.getSession();
      const session = response.data?.session || null;
      const user = session?.user || null;

      if (user) {
        currentUser = user;
        rememberUser(user);
        renderAuth();
        return user;
      }
    } catch (error) {
      console.warn("PRINTCALC session before history save:", error);
    }

    return currentUser;
  }

  function makeHistoryId() {
    if (window.crypto?.randomUUID) return window.crypto.randomUUID();
    return "pc-" + Date.now() + "-" + Math.random().toString(36).slice(2, 12);
  }

  async function saveCalculation(reason = "manual") {
    const user = await getLiveUser();
    if (!user?.id) return null;

    const result = getResultElement();
    if (!result) return null;

    const resultText =
      (result.innerText || result.textContent || "").trim();

    // До расчёта в result лежит приглашение.
    // Не создаём запись для стартового экрана.
    if (resultText.length < 25) return null;

    const mode = window.location.pathname
      .toLowerCase()
      .includes("detail")
      ? "detail"
      : "quick";

    const inputs = collectSnapshot(mode);
    const savedAt = new Date().toISOString();
    const clientId = makeHistoryId();

    const customerName = String(inputs.customerName || "").trim();

    const calculationData = {
      title: mode === "detail" ? "Детальный расчёт" : "Быстрый расчёт",
      customer_name: customerName,
      result_text: resultText,
      inputs,
      reason,
      client_id: clientId,
      saved_at_client: savedAt,
    };

    const localItem = {
      id: "local-" + clientId,
      user_id: user.id,
      mode,
      calculation_data: calculationData,
      created_at: savedAt,
      local: true,
    };

    // СНАЧАЛА сохраняем локально.
    // Даже если Supabase временно недоступен, история остаётся на устройстве.
    const localRows = readLocalHistory();
    localRows.unshift(localItem);
    writeLocalHistory(localRows);

    // Показываем текущий статус для других частей приложения.
    window.dispatchEvent(new CustomEvent("printcalc:history-saved", {
      detail: { item: localItem, cloud: false }
    }));

    if (!client) return localItem;

    try {
      const response = await client
        .from("calculations")
        .insert({
          user_id: user.id,
          mode,
          calculation_data: calculationData,
        })
        .select("id,user_id,mode,calculation_data,created_at")
        .single();

      if (response.error) {
        throw response.error;
      }

      if (response.data) {
        // Заменяем локальный дубль облачной записью,
        // сохраняя client_id внутри calculation_data.
        const rows = readLocalHistory().filter(
          (item) => item.id !== localItem.id
        );
        rows.unshift(response.data);
        writeLocalHistory(rows);

        window.dispatchEvent(new CustomEvent("printcalc:history-saved", {
          detail: { item: response.data, cloud: true }
        }));

        return response.data;
      }
    } catch (error) {
      console.warn("PRINTCALC cloud history save failed; local copy kept:", error);
    }

    return localItem;
  }

  function scheduleSave(reason = "calculate") {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      saveCalculation(reason);
    }, 250);
  }

  function watchResult() {
    // В V19 НЕ сохраняем расчёт через MutationObserver.
    // Он вызывал сохранение в неподходящий момент и создавал гонку с auth.
    // История пишется только после явного действия «Рассчитать».
  }

  async function submitAuth() {
    if (!client) {
      setMessage("Supabase не подключён.", "error");
      return;
    }

    const email = ($("pc-email")?.value || "").trim().toLowerCase();
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
      const session = sessionResponse.data?.session || null;
      currentUser = session?.user || null;

      if (!currentUser) {
        setMessage(
          "Аккаунт создан. Проверьте почту для подтверждения.",
          "success"
        );
        renderAuth();
        return;
      }

      rememberUser(currentUser);
      renderAuth();
      closeAccount();
      setTimeout(watchResult, 100);
    } catch (error) {
      setMessage(error?.message || "Ошибка авторизации.", "error");
    } finally {
      if (submit) submit.disabled = false;
    }
  }

  async function refreshSession() {
    if (!client) return currentUser;

    try {
      const response = await client.auth.getSession();
      const session = response.data?.session || null;
      const user = session?.user || null;

      if (user) {
        currentUser = user;
        rememberUser(user);
        renderAuth();
        closeAccount();
      }

      return currentUser;
    } catch (error) {
      console.warn("PRINTCALC session refresh:", error);
      return currentUser;
    }
  }

  function installAuthListener() {
    if (!client || client.__PRINTCALC_V19_AUTH_LISTENER__) return;
    client.__PRINTCALC_V19_AUTH_LISTENER__ = true;

    client.auth.onAuthStateChange((event, sessionData) => {
      if (sessionData?.user) {
        currentUser = sessionData.user;
        rememberUser(currentUser);
        renderAuth();
        closeAccount();
        return;
      }

      // Не выбрасываем пользователя мгновенно из интерфейса.
      // Сначала повторно читаем реальную persisted-сессию.
      if (event === "SIGNED_OUT") {
        clearTimeout(signedOutCheckTimer);
        signedOutCheckTimer = setTimeout(async () => {
          try {
            const response = await client.auth.getSession();
            const user = response.data?.session?.user || null;

            if (user) {
              currentUser = user;
              rememberUser(user);
              renderAuth();
              closeAccount();
              return;
            }

            currentUser = null;
            forgetUser();
            renderAuth();
            closeAccount();
          } catch (_) {
            // При сетевой ошибке ничего не меняем.
          }
        }, 350);
      }
    });
  }

  async function logout() {
    // Единственное место, где приложение само завершает сессию.
    try {
      if (client) await client.auth.signOut({ scope: "local" });
    } catch (_) {}

    currentUser = null;
    forgetUser();
    renderAuth();
    closeAccount();
    window.location.replace("./");
  }

  function init() {
    if (initialized) return;
    initialized = true;

    createModal();

    // Мгновенно восстанавливаем имя аккаунта из локального маркера,
    // затем подтверждаем реальной persisted-сессией Supabase.
    const remembered = readRememberedUser();
    if (remembered?.id) {
      currentUser = {
        id: remembered.id,
        email: remembered.email || "",
      };
    }

    renderAuth();

    if (!client) return;

    refreshSession();
    installAuthListener();

    document.addEventListener("click", (event) => {
      const target = event.target;
      if (!target?.closest) return;

      if (
        target.closest("#calc") ||
        target.closest("[data-calculate]")
      ) {
        // calculate.js уже успел обновить #result, когда событие
        // доходит сюда по bubble-фазе. Небольшая задержка даёт
        // Supabase-сессии время восстановиться.
        scheduleSave("calculate");
      }
    });

    window.addEventListener("pageshow", () => refreshSession());
    window.addEventListener("focus", () => refreshSession());

    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") refreshSession();
    });

    setTimeout(watchResult, 200);
  }

  window.PRINTCALC_AUTH = {
    getUser: () => currentUser,
    getClient: () => client,
    saveCalculation,
    saveNow: () => saveCalculation("manual"),
    getLocalHistory: readLocalHistory,
    refreshSession,
    authStorageKey: core.storageKey || "printcalc-flexo-auth",
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
