(() => {
  "use strict";

  const config = window.PRINTCALC_CONFIG || {};
  const SUPABASE_STORAGE_KEY = "printcalc-flexo-auth";
  const HISTORY_PREFIX = "printcalc_history_cache_v4::";
  const LAST_USER_KEY = "printcalc_last_account";

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
            storageKey: SUPABASE_STORAGE_KEY
          }
        }
      )
    : null;

  let currentUser = null;
  let authMode = "login";
  let saveTimer = null;
  let lastFingerprint = "";

  const $ = id => document.getElementById(id);

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
    button.textContent = loggedIn ? "ЛИЧНЫЙ КАБИНЕТ" : "АККАУНТ";
    button.classList.toggle("pc-account-authenticated", loggedIn);
    button.setAttribute("aria-label", loggedIn ? "Открыть личный кабинет" : "Войти в аккаунт");
    button.title = loggedIn ? "Открыть личный кабинет" : "Войти в аккаунт";
    button.onclick = () => loggedIn
      ? (window.location.href = "account.html")
      : openAccount();
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
          <img src="brand-mark.svg?v=171" alt="" aria-hidden="true">
          <span><b>PRINTCALC</b><small>FLEXO</small></span>
        </div>
        <h2 id="pc-auth-title">Ваш рабочий аккаунт</h2>
        <p class="pc-auth-lead">Расчёты, станки и история сохраняются за вашим аккаунтом.</p>
        <div class="pc-auth-tabs">
          <button type="button" data-auth-mode="login">Войти</button>
          <button type="button" data-auth-mode="register">Создать аккаунт</button>
        </div>
        <div id="pc-auth-message" class="pc-auth-message"></div>
        <div id="pc-auth-form">
          <label>Email<input id="pc-email" type="email" autocomplete="email" placeholder="name@company.ru"></label>
          <label>Пароль<input id="pc-password" type="password" autocomplete="current-password" placeholder="Минимум 6 символов"></label>
          <button id="pc-submit" class="pc-submit" type="button">Войти</button>
        </div>
        <div id="pc-session" hidden>
          <div class="pc-session-label">ВЫ ВОШЛИ</div>
          <div id="pc-session-email" class="pc-session-email"></div>
          <a class="pc-modal-account-link" href="account.html">Открыть личный кабинет →</a>
          <button id="pc-logout" class="pc-logout" type="button">Выйти из аккаунта</button>
        </div>
        <div class="pc-auth-foot">Сессия сохраняется на этом устройстве до нажатия «Выйти из аккаунта».</div>
      </div>
    `;

    document.body.appendChild(modal);
    modal.addEventListener("click", event => {
      if (event.target === modal) closeAccount();
    });
    modal.querySelector(".pc-auth-close")?.addEventListener("click", closeAccount);
    modal.querySelectorAll("[data-auth-mode]").forEach(button => {
      button.addEventListener("click", () => {
        authMode = button.dataset.authMode || "login";
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
    if (submit) submit.textContent = authMode === "register" ? "Создать аккаунт" : "Войти";
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
    window.setTimeout(() => $("pc-email")?.focus(), 60);
  }

  function closeAccount() {
    const modal = $("pc-auth-modal");
    if (!modal) return;
    modal.hidden = true;
    modal.setAttribute("aria-hidden", "true");
  }

  function historyKey() {
    return currentUser?.id ? HISTORY_PREFIX + currentUser.id : "";
  }

  function readLocalHistory() {
    const key = historyKey();
    if (!key) return [];
    try {
      const raw = localStorage.getItem(key);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (_) {
      return [];
    }
  }

  function writeLocalHistory(rows) {
    const key = historyKey();
    if (!key) return;
    try { localStorage.setItem(key, JSON.stringify(rows)); } catch (_) {}
  }

  function stableStringify(value) {
    if (value === null || typeof value !== "object") return JSON.stringify(value);
    if (Array.isArray(value)) return "[" + value.map(stableStringify).join(",") + "]";
    return "{" + Object.keys(value).sort().map(key => JSON.stringify(key) + ":" + stableStringify(value[key])).join(",") + "}";
  }

  function collectCalculationSnapshot(mode) {
    const ids = mode === "detail"
      ? ["qty","streams","width","height","web","repeat","gsm","waste","matPrice","colors","inkPrice","inkUse","machineSelect","speed","power","setup","machine","labor","powerRate","lam","die","lamEnabled","dieEnabled","overhead","admin","markup","minimum"]
      : ["qty","streams","width","height","web","repeat","gsm","waste","matPrice","colors","inkPrice","inkUse","lam","die"];

    const inputs = {};
    ids.forEach(id => {
      const element = $(id);
      if (!element) return;
      inputs[id] = element.type === "checkbox" ? element.checked : element.value;
    });

    if (mode === "detail") {
      const select = $("machineSelect");
      if (select && select.value) {
        inputs.machineName = select.options[select.selectedIndex]?.textContent || "";
      }
    }
    return inputs;
  }

  function findResultElement() {
    return $("result") || document.querySelector(".result");
  }

  async function saveCalculation() {
    if (!currentUser) return;
    const result = findResultElement();
    if (!result) return;

    const resultText = (result.innerText || result.textContent || "").trim();
    if (resultText.length < 20) return;

    const mode = window.location.pathname.toLowerCase().includes("detail") ? "detail" : "quick";
    const inputs = collectCalculationSnapshot(mode);
    const calculationData = {
      title: mode === "detail" ? "Детальный расчёт" : "Быстрый расчёт",
      result_text: resultText,
      inputs,
      saved_at_client: new Date().toISOString()
    };

    const fingerprint = stableStringify({ mode, resultText, inputs });
    if (fingerprint === lastFingerprint) return;
    lastFingerprint = fingerprint;

    const localId = "local-" + Date.now() + "-" + Math.random().toString(36).slice(2,9);
    const localItem = {
      id: localId,
      user_id: currentUser.id,
      mode,
      calculation_data: calculationData,
      created_at: calculationData.saved_at_client,
      local_fingerprint: fingerprint
    };

    const localRows = readLocalHistory();
    localRows.unshift(localItem);
    writeLocalHistory(localRows.slice(0, 5000));

    if (!client) return;

    try {
      const response = await client
        .from("calculations")
        .insert({
          user_id: currentUser.id,
          mode,
          calculation_data: calculationData
        })
        .select("id,user_id,mode,calculation_data,created_at")
        .single();

      if (!response.error && response.data) {
        const rows = readLocalHistory().filter(item => item.id !== localId);
        rows.unshift(response.data);
        writeLocalHistory(rows.slice(0, 5000));
      } else if (response.error) {
        console.warn("PRINTCALC cloud history:", response.error.message);
      }
    } catch (error) {
      console.warn("PRINTCALC cloud history:", error);
    }
  }

  function scheduleSave() {
    window.clearTimeout(saveTimer);
    saveTimer = window.setTimeout(saveCalculation, 900);
  }

  function watchResultChanges() {
    const result = findResultElement();
    if (!result || result.__printcalcObserved) return;
    result.__printcalcObserved = true;
    const observer = new MutationObserver(() => scheduleSave());
    observer.observe(result, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true
    });
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
      currentUser = sessionResponse.data?.session?.user || null;

      if (!currentUser) {
        setMessage("Аккаунт создан. Проверьте почту для подтверждения.", "success");
        renderAuth();
        return;
      }

      try {
        localStorage.setItem(LAST_USER_KEY, JSON.stringify({
          id: currentUser.id,
          email: currentUser.email || "",
          rememberedAt: new Date().toISOString()
        }));
      } catch (_) {}

      renderAuth();
      closeAccount();
      window.setTimeout(watchResultChanges, 100);
    } catch (error) {
      setMessage(error?.message || "Ошибка авторизации.", "error");
    } finally {
      if (submit) submit.disabled = false;
    }
  }

  async function logout() {
    try {
      if (client) await client.auth.signOut();
    } catch (_) {}
    currentUser = null;
    lastFingerprint = "";
    renderAuth();
    closeAccount();
    window.location.replace("./");
  }

  async function init() {
    createModal();
    ensureAccountButton();

    if (!client) {
      renderAuth();
      return;
    }

    try {
      const sessionResponse = await client.auth.getSession();
      currentUser = sessionResponse.data?.session?.user || null;
    } catch (error) {
      currentUser = null;
      console.warn("PRINTCALC session:", error);
    }

    renderAuth();
    if (currentUser) closeAccount();

    client.auth.onAuthStateChange((event, sessionData) => {
      currentUser = sessionData?.session?.user || null;
      renderAuth();
      if (currentUser) {
        closeAccount();
        window.setTimeout(watchResultChanges, 100);
      } else if (event === "SIGNED_OUT") {
        closeAccount();
      }
    });

    document.addEventListener("click", event => {
      if (event.target.closest("#calc") || event.target.closest("[data-calculate]")) {
        scheduleSave();
      }
    });

    window.setTimeout(watchResultChanges, 200);
  }

  window.PRINTCALC_AUTH = {
    getUser: () => currentUser,
    getClient: () => client,
    saveCalculation,
    getLocalHistory: readLocalHistory,
    authStorageKey: SUPABASE_STORAGE_KEY
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
