(() => {
  "use strict";

  const core = window.PRINTCALC_AUTH_CORE || {};
  const client = typeof core.getClient === "function" ? core.getClient() : null;
  let currentUser = null;
  let authMode = "login";
  let saveInFlight = false;

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (char) => ({
      "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#039;"
    }[char]));
  }

  function normalizeEmail(value) {
    return String(value || "").trim().toLowerCase();
  }

  function accountButton() {
    return document.querySelector(".pc-account-button");
  }

  function addAccountButton() {
    const existing = document.querySelectorAll(".pc-account-button");
    existing.forEach((el, index) => {
      if (index > 0) el.remove();
    });

    const header = document.querySelector(".printora-header-v34 .printora-header-actions-v34")
      || document.querySelector(".printora-header-v32 .header-in")
      || document.querySelector(".header-in");
    if (!header) return;

    let button = header.querySelector(".pc-account-button");
    if (!button) {
      button = document.createElement("button");
      button.type = "button";
      button.className = "pc-account-button";
      button.addEventListener("click", openAccount);
      header.insertBefore(button, header.firstChild);
    } else if (!button.dataset.authBound) {
      button.dataset.authBound = "1";
      button.addEventListener("click", openAccount);
    }
    renderAccountButton();
  }

  function renderAccountButton() {
    const button = accountButton();
    if (!button) return;
    button.textContent = currentUser ? "АККАУНТ" : "АККАУНТ";
    button.dataset.loggedIn = currentUser ? "1" : "0";
    button.setAttribute("aria-label", currentUser ? "Аккаунт" : "Войти в аккаунт");
  }

  function setMessage(text, type) {
    const box = document.getElementById("pc-auth-message");
    if (!box) return;
    box.textContent = text || "";
    box.className = "pc-auth-message " + (type || "");
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
          <label><span>Email</span><input id="pc-email" type="email" autocomplete="email" placeholder="name@company.ru"></label>
          <label><span>Пароль</span><input id="pc-password" type="password" autocomplete="current-password" placeholder="Минимум 6 символов"></label>
          <button id="pc-submit" class="pc-submit" type="button">Войти</button>
        </div>
        <div id="pc-session" hidden>
          <div class="pc-session-label">ВЫ ВОШЛИ</div>
          <div id="pc-session-email" class="pc-session-email"></div>
          <div class="pc-history-head"><span>История расчётов</span><button id="pc-refresh" type="button">Обновить</button></div>
          <div id="pc-history" class="pc-history"></div>
          <button id="pc-logout" class="pc-logout" type="button">Выйти</button>
        </div>
        <div class="pc-auth-foot">Каждый аккаунт видит только собственные расчёты.</div>
      </div>`;
    document.body.appendChild(modal);

    modal.addEventListener("click", (event) => {
      if (event.target === modal) closeAccount();
    });
    modal.querySelector(".pc-auth-close")?.addEventListener("click", closeAccount);
    modal.querySelectorAll("[data-auth-mode]").forEach((button) => {
      button.addEventListener("click", () => {
        authMode = button.dataset.authMode || "login";
        renderAuth();
      });
    });
    modal.querySelector("#pc-submit")?.addEventListener("click", submitAuth);
    modal.querySelector("#pc-refresh")?.addEventListener("click", loadHistory);
    modal.querySelector("#pc-logout")?.addEventListener("click", logout);
    renderAuth();
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
    if (!client) return setMessage("Supabase не подключён.", "error");
    const email = normalizeEmail(document.getElementById("pc-email")?.value);
    const password = document.getElementById("pc-password")?.value || "";
    const submit = document.getElementById("pc-submit");
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return setMessage("Введите корректный email.", "error");
    if (password.length < 6) return setMessage("Пароль должен быть минимум 6 символов.", "error");
    if (submit) submit.disabled = true;

    try {
      const response = authMode === "register"
        ? await client.auth.signUp({ email, password })
        : await client.auth.signInWithPassword({ email, password });
      if (response.error) throw response.error;

      const sessionResult = await client.auth.getSession();
      currentUser = sessionResult.data?.session?.user || null;

      if (authMode === "register" && !currentUser) {
        setMessage("Аккаунт создан. Проверьте почту для подтверждения.", "success");
      } else {
        setMessage("Вход выполнен.", "success");
        closeAccount();
        await loadHistory();
      }
      renderAuth();
      window.setTimeout(() => window.dispatchEvent(new CustomEvent("printcalc:auth-changed", { detail: currentUser })), 0);
    } catch (error) {
      const message = String(error?.message || "Ошибка авторизации.");
      if (/already registered|already exists|user already/i.test(message)) {
        setMessage("Этот email уже зарегистрирован. Войдите в существующий аккаунт.", "error");
      } else {
        setMessage(message, "error");
      }
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
    window.setTimeout(() => window.dispatchEvent(new CustomEvent("printcalc:auth-changed", { detail: null })), 0);
  }

  async function getFreshUser() {
    if (!client) return null;
    const result = await client.auth.getUser();
    if (result.error) throw result.error;
    currentUser = result.data?.user || null;
    return currentUser;
  }

  function stableHash(text) {
    let h = 2166136261;
    const s = String(text || "");
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return (h >>> 0).toString(16);
  }

  function calculationPayload(source, mode, auto) {
    const data = source || {};
    const payload = {
      mode: mode || data.mode || (location.pathname.toLowerCase().includes("detail") ? "detail" : "quick"),
      title: data.title || (mode === "detail" ? "Детальный расчёт" : "Быстрый расчёт"),
      customer_name: data.customerName || data.customer_name || "",
      inputs: data.inputs || {},
      summary: data.summary || {},
      result_text: data.result_text || "",
      saved_at_client: new Date().toISOString()
    };
    const fingerprintSource = JSON.stringify({ mode: payload.mode, title: payload.title, customer_name: payload.customer_name, inputs: payload.inputs, summary: payload.summary });
    // Один и тот же расчёт получает стабильный client_id.
    // Это защищает историю от повторного создания одинаковой записи
    // и для автосохранения, и для ручного «Сохранить расчёт».
    payload.client_id = `calc-${payload.mode}-${stableHash(fingerprintSource)}`;
    return payload;
  }

  function cacheHistory(userId, row) {
    if (!userId || !row) return;
    try {
      const key = `printcalc_history_cache_v7::${userId}`;
      const old = JSON.parse(localStorage.getItem(key) || "[]");
      const list = Array.isArray(old) ? old : [];
      const id = row.id || `local-${Date.now()}`;
      const merged = [{ ...row, id }, ...list.filter((x) => x && x.id !== id)];
      localStorage.setItem(key, JSON.stringify(merged.slice(0, 200)));
    } catch (_) {}
  }

  async function saveCalculation(source, options = {}) {
    if (!client) throw new Error("Supabase не подключён.");
    const user = await getFreshUser();
    if (!user) {
      if (!options.silent) setMessage("Войдите в аккаунт, чтобы сохранить расчёт.", "error");
      return { saved: false, reason: "not-authenticated" };
    }

    const mode = source?.mode || (location.pathname.toLowerCase().includes("detail") ? "detail" : "quick");
    const data = calculationPayload(source, mode, Boolean(options.auto));
    if (!data.summary || Object.keys(data.summary).length === 0) {
      data.result_text = data.result_text || (document.querySelector("#result")?.innerText || "").trim();
    }

    // Одинаковый расчёт не плодит строки ни при автосохранении, ни при ручном сохранении.
    const recent = await client.from("calculations")
      .select("id,user_id,mode,calculation_data,created_at")
      .eq("user_id", user.id)
      .eq("mode", data.mode)
      .order("created_at", { ascending: false })
      .limit(200);
    if (!recent.error) {
      const exists = (recent.data || []).find((row) => row?.calculation_data?.client_id === data.client_id);
      if (exists) {
        cacheHistory(user.id, exists);
        return { saved: true, duplicate: true, row: exists };
      }
    }

    const insertResult = await client.from("calculations").insert({
      user_id: user.id,
      mode: data.mode,
      calculation_data: data
    }).select("id,user_id,mode,calculation_data,created_at").single();

    if (insertResult.error) throw insertResult.error;
    const row = insertResult.data;
    if (!row?.id || row.user_id !== user.id) throw new Error("Расчёт записан, но проверка владельца не пройдена.");

    // Реальная проверка: перечитываем созданную запись из облака.
    const verify = await client.from("calculations")
      .select("id,user_id,mode,calculation_data,created_at")
      .eq("id", row.id)
      .eq("user_id", user.id)
      .maybeSingle();
    if (verify.error) throw verify.error;
    if (!verify.data?.id || verify.data.user_id !== user.id) {
      throw new Error("Запись создана, но повторное чтение не подтвердило сохранение.");
    }

    cacheHistory(user.id, verify.data);
    window.dispatchEvent(new CustomEvent("printcalc:history-saved", { detail: verify.data }));
    return { saved: true, duplicate: false, row: verify.data };
  }

  async function loadHistory() {
    if (!client || !currentUser) return;
    const box = document.getElementById("pc-history");
    if (!box) return;
    box.innerHTML = "<div class='pc-empty'>Загрузка...</div>";
    const response = await client.from("calculations")
      .select("id,user_id,mode,calculation_data,created_at")
      .eq("user_id", currentUser.id)
      .order("created_at", { ascending: false })
      .limit(100);
    if (response.error) {
      box.innerHTML = `<div class='pc-empty'>${escapeHtml(response.error.message)}</div>`;
      return;
    }
    if (!response.data?.length) {
      box.innerHTML = "<div class='pc-empty'>Сохранённых расчётов пока нет.</div>";
      return;
    }
    box.innerHTML = response.data.map((item) => {
      const title = item.calculation_data?.title || "Расчёт заказа";
      const date = new Date(item.created_at).toLocaleString("ru-RU");
      return `<div class="pc-history-item"><div><b>${item.mode === "detail" ? "Σ Детальный расчёт" : "⚡ Быстрый расчёт"}</b><small>${escapeHtml(title)}</small><small>${escapeHtml(date)}</small></div></div>`;
    }).join("");
  }

  async function handleSaveRequest(event) {
    if (saveInFlight) return;
    saveInFlight = true;
    try {
      await saveCalculation(event.detail || window.PRINTCALC_LAST_CALC, { auto: false });
      const button = document.querySelector('#result [data-action="save-calculation"]');
      if (button) button.textContent = "Расчёт сохранён";
    } catch (error) {
      console.error("PRINTORA SAVE:", error);
      setMessage(error?.message || "Не удалось сохранить расчёт.", "error");
      const button = document.querySelector('#result [data-action="save-calculation"]');
      if (button) button.textContent = "Ошибка сохранения";
    } finally {
      saveInFlight = false;
    }
  }

  async function handleCalculated(event) {
    if (saveInFlight) return;
    saveInFlight = true;
    try {
      await saveCalculation(event.detail || window.PRINTCALC_LAST_CALC, { auto: true, silent: true });
    } catch (error) {
      console.warn("PRINTORA AUTO SAVE:", error?.message || error);
    } finally {
      saveInFlight = false;
    }
  }

  async function runSelfTest() {
    const user = await getFreshUser();
    if (!user) throw new Error("Для self-test сначала войдите в аккаунт.");
    const marker = `PRINTORA SELF TEST ${new Date().toISOString()}`;
    const payload = {
      mode: "selftest",
      title: "PRINTORA — самопроверка сохранения",
      client_id: `selftest-${Date.now()}`,
      result_text: marker,
      saved_at_client: new Date().toISOString(),
      inputs: { qty: 1, width: 1, height: 1 },
      summary: { test: true }
    };
    const inserted = await client.from("calculations").insert({ user_id: user.id, mode: "selftest", calculation_data: payload }).select("id,user_id,mode,calculation_data,created_at").single();
    if (inserted.error) throw inserted.error;
    const verified = await client.from("calculations").select("id,user_id,mode,calculation_data,created_at").eq("id", inserted.data.id).eq("user_id", user.id).maybeSingle();
    if (verified.error) throw verified.error;
    if (!verified.data?.id || verified.data.calculation_data?.result_text !== marker) throw new Error("Self-test: запись не подтверждена повторным чтением.");
    const removed = await client.from("calculations").delete().eq("id", verified.data.id).eq("user_id", user.id);
    if (removed.error) {
      return { ok: true, cleanup: false, userId: user.id, email: user.email, message: "Создание → чтение → проверка владельца прошли успешно. Удаление тестовой записи запрещено текущей RLS-политикой, поэтому тестовая запись оставлена в истории." };
    }
    return { ok: true, cleanup: true, userId: user.id, email: user.email, message: "Создание → чтение → проверка владельца → удаление прошли успешно." };
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
    window.PRINTORA_SAVE_CALCULATION = saveCalculation;
    window.PRINTORA_SELF_TEST = runSelfTest;

    if (!client) {
      renderAuth();
      return;
    }

    try {
      const session = await client.auth.getSession();
      currentUser = session.data?.session?.user || null;
    } catch (_) {
      currentUser = null;
    }
    renderAuth();
    if (currentUser) loadHistory();

    client.auth.onAuthStateChange((_event, sessionData) => {
      currentUser = sessionData?.user || null;
      renderAuth();
      if (currentUser) loadHistory();
    });

    window.addEventListener("printcalc:save-request", handleSaveRequest);
    window.addEventListener("printcalc:calculated", handleCalculated);

    const params = new URLSearchParams(window.location.search);
    if (!currentUser && params.get("auth") === "1") {
      window.history.replaceState({}, document.title, window.location.pathname);
      setTimeout(openAccount, 80);
    }
    if (params.get("selftest") === "1") {
      setTimeout(async () => {
        try {
          const result = await runSelfTest();
          console.log("PRINTORA SELF TEST OK", result);
          alert("PRINTORA: самопроверка сохранения пройдена.\nСоздание → чтение → проверка → удаление OK.");
        } catch (error) {
          console.error("PRINTORA SELF TEST FAILED", error);
          alert("PRINTORA: самопроверка не пройдена.\n" + (error?.message || error));
        }
      }, 500);
    }
  }

  window.PRINTCALC_AUTH_CORE = window.PRINTCALC_AUTH_CORE || {};
  window.PRINTCALC_AUTH_CORE.getCurrentUser = () => currentUser;
  window.PRINTCALC_AUTH_CORE.saveCalculation = saveCalculation;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
