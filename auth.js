(() => {
  "use strict";

  const core = window.PRINTCALC_AUTH_CORE || {};
  const client = typeof core.getClient === "function" ? core.getClient() : null;
  let currentUser = null;
  let authMode = "login";
  let saveInFlight = false;

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (c) => ({
      "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#039;"
    }[c]));
  }

  function normalizeEmail(value) {
    return String(value || "").trim().toLowerCase();
  }

  function setMessage(text, type = "") {
    const el = document.getElementById("pc-auth-message");
    if (!el) return;
    el.textContent = text || "";
    el.className = "pc-auth-message " + type;
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
        <p class="pc-auth-lead">Сохраняйте расчёты и открывайте историю с любого устройства.</p>
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
        <div class="pc-auth-foot">Один email соответствует одному аккаунту Supabase. История хранится в облаке.</div>
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
  }

  function renderAuth() {
    const form = document.getElementById("pc-auth-form");
    const session = document.getElementById("pc-session");
    const email = document.getElementById("pc-session-email");
    if (form && session) {
      form.hidden = Boolean(currentUser);
      session.hidden = !currentUser;
    }
    if (email) email.textContent = currentUser?.email || "";
    document.querySelectorAll("[data-auth-mode]").forEach((button) => {
      button.classList.toggle("active", button.dataset.authMode === authMode);
    });
    const submit = document.getElementById("pc-submit");
    if (submit) submit.textContent = authMode === "register" ? "Создать аккаунт" : "Войти";
  }

  async function refreshUser() {
    if (!client) {
      currentUser = null;
      return null;
    }
    try {
      const result = await client.auth.getSession();
      currentUser = result?.data?.session?.user || null;
      return currentUser;
    } catch (_) {
      currentUser = null;
      return null;
    }
  }

  async function submitAuth() {
    if (!client) {
      setMessage("Supabase не подключён.", "error");
      return;
    }
    const email = normalizeEmail(document.getElementById("pc-email")?.value);
    const password = document.getElementById("pc-password")?.value || "";
    const submit = document.getElementById("pc-submit");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
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

      await refreshUser();
      renderAuth();

      if (currentUser) {
        closeAccount();
        window.setTimeout(() => window.dispatchEvent(new CustomEvent("printcalc:auth-changed", { detail: currentUser })), 0);
      } else if (authMode === "register") {
        setMessage("Аккаунт создан. Проверьте почту для подтверждения.", "success");
      }
    } catch (error) {
      const message = String(error?.message || "Ошибка авторизации.");
      if (/already registered|already exists|user already|duplicate/i.test(message)) {
        setMessage("Этот email уже зарегистрирован. Войдите в существующий аккаунт.", "error");
      } else if (/invalid login credentials/i.test(message)) {
        setMessage("Неверный email или пароль.", "error");
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

  async function loadHistory() {
    if (!client || !currentUser) return;
    const box = document.getElementById("pc-history");
    if (!box) return;
    box.innerHTML = "<div class='pc-empty'>Загрузка...</div>";
    const response = await client.from("calculations")
      .select("id,user_id,mode,calculation_data,created_at")
      .eq("user_id", currentUser.id)
      .in("mode", ["quick", "detail"])
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
      const data = item.calculation_data || {};
      const title = data.title || "Расчёт заказа";
      const order = data.order_number ? `№ ${data.order_number}` : "Без номера";
      const date = item.created_at ? new Date(item.created_at).toLocaleString("ru-RU") : "";
      return `<div class="pc-history-item"><div><b>${escapeHtml(order)} · ${item.mode === "detail" ? "Детальный расчёт" : "Быстрый расчёт"}</b><small>${escapeHtml(title)}</small><small>${escapeHtml(date)}</small></div></div>`;
    }).join("");
  }

  async function duplicateOrderNumberExists(orderNumber) {
    const clean = String(orderNumber || "").trim().toLocaleLowerCase("ru-RU");
    if (!clean || !currentUser || !client) return false;
    const response = await client.from("calculations")
      .select("id,calculation_data")
      .eq("user_id", currentUser.id)
      .in("mode", ["quick", "detail"])
      .order("created_at", { ascending: false })
      .limit(250);
    if (response.error) throw response.error;
    return (response.data || []).some(row => String(row.calculation_data?.order_number || "").trim().toLocaleLowerCase("ru-RU") === clean);
  }

  async function findSimilar(source) {
    if (!client || !currentUser) return [];
    const inputs = source?.inputs || {};
    const summary = source?.summary || {};
    const repeat = Number(source?.repeat_mm ?? inputs.repeatMm ?? window.PRINTORA_REPEAT_MM?.(inputs.repeat || "") ?? 0);
    const a = {
      width: Number(inputs.width ?? summary.width ?? 0),
      height: Number(inputs.height ?? summary.height ?? 0),
      repeat: repeat,
      streams: Number(inputs.streams ?? summary.streams ?? 0),
      web: Number(inputs.web ?? summary.web ?? 0),
      colors: Number(inputs.colors ?? summary.colors ?? 0),
      materialId: source?.materialId || inputs.materialId || inputs.material?.id || "",
      lam: Boolean(inputs.lam ?? inputs.lamEnabled),
      die: Boolean(inputs.die ?? inputs.dieEnabled)
    };
    if (a.width <= 0 || a.height <= 0 || a.repeat <= 0) return [];
    const response = await client.from("calculations")
      .select("id,mode,calculation_data,created_at")
      .eq("user_id", currentUser.id)
      .in("mode", ["quick", "detail"])
      .order("created_at", { ascending: false })
      .limit(250);
    if (response.error) throw response.error;

    const relative = (x, y, tolerance) => {
      if (!x || !y) return x === y ? 1 : 0;
      const diff = Math.abs(x - y);
      return diff <= tolerance ? 1 : Math.max(0, 1 - diff / (Math.abs(y) + tolerance));
    };

    return (response.data || []).map((row) => {
      const d = row.calculation_data || {};
      const i = d.inputs || {};
      const s = d.summary || {};
      const rep = Number(d.repeat_mm ?? i.repeatMm ?? window.PRINTORA_REPEAT_MM?.(i.repeat || "") ?? 0);
      const b = {
        width: Number(i.width ?? s.width ?? 0), height: Number(i.height ?? s.height ?? 0), repeat: rep,
        streams: Number(i.streams ?? s.streams ?? 0), web: Number(i.web ?? s.web ?? 0), colors: Number(i.colors ?? s.colors ?? 0),
        materialId: d.materialId || i.materialId || i.material?.id || "",
        lam: Boolean(i.lam ?? i.lamEnabled), die: Boolean(i.die ?? i.dieEnabled)
      };
      const score = Math.round(
        relative(a.width,b.width,.5)*24 +
        relative(a.height,b.height,.5)*24 +
        relative(a.repeat,b.repeat,.75)*22 +
        (a.streams === b.streams ? 10 : 0) +
        relative(a.web,b.web,1)*7 +
        (a.colors === b.colors ? 4 : 0) +
        (a.materialId && b.materialId && a.materialId === b.materialId ? 5 : 0) +
        (a.lam === b.lam ? 2 : 0) +
        (a.die === b.die ? 2 : 0)
      );
      return {
        score,
        order: d.order_number || "без номера",
        createdAt: row.created_at,
        width: b.width,
        height: b.height,
        repeat: b.repeat
      };
    }).filter(x => x.score >= 72)
      .sort((a,b) => b.score - a.score || new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0,5);
  }

  async function saveCalculation(source) {
    if (!client) throw new Error("Supabase не подключён.");
    const user = await refreshUser();
    if (!user) {
      setMessage("Войдите в аккаунт, чтобы сохранить расчёт.", "error");
      return { saved:false, reason:"not-authenticated" };
    }
    const mode = source?.mode || (location.pathname.toLowerCase().includes("detail") ? "detail" : "quick");
    const orderNumber = String(source?.order_number || "").trim();
    if (!orderNumber) throw new Error("Номер заказа обязателен для сохранения.");

    const payload = {
      mode,
      title: source.title || (mode === "detail" ? "Детальный расчёт" : "Быстрый расчёт"),
      order_number: orderNumber,
      customer_name: source.customerName || source.customer_name || source.inputs?.customerName || "",
      customerName: source.customerName || source.customer_name || source.inputs?.customerName || "",
      materialId: source.materialId || source.inputs?.materialId || source.inputs?.material?.id || "",
      materialName: source.materialName || source.inputs?.materialName || source.inputs?.material?.name || "",
      repeat_mm: Number(source.repeat_mm ?? source.inputs?.repeatMm ?? 0),
      inputs: source.inputs || {},
      summary: source.summary || {},
      result_text: source.result_text || (document.getElementById("result")?.innerText || "").trim(),
      saved_at_client: new Date().toISOString()
    };

    const existingNumber = await duplicateOrderNumberExists(orderNumber);
    if (existingNumber) {
      const proceed = window.confirm(`Заказ №${orderNumber} уже есть в истории.\n\nСохранить ещё одну версию с этим номером?`);
      if (!proceed) return { saved:false, reason:"duplicate-order-cancelled" };
    }

    const inserted = await client.from("calculations")
      .insert({ user_id:user.id, mode, calculation_data:payload })
      .select("id,user_id,mode,calculation_data,created_at")
      .single();
    if (inserted.error) throw inserted.error;
    if (!inserted.data?.id || inserted.data.user_id !== user.id) {
      throw new Error("Запись создана, но проверка владельца не пройдена.");
    }

    const verify = await client.from("calculations")
      .select("id,user_id,mode,calculation_data,created_at")
      .eq("id", inserted.data.id)
      .eq("user_id", user.id)
      .maybeSingle();
    if (verify.error) throw verify.error;
    if (!verify.data?.id || verify.data.user_id !== user.id) {
      throw new Error("Сохранённый заказ не подтвердился повторным чтением.");
    }

    window.dispatchEvent(new CustomEvent("printcalc:history-saved", { detail:verify.data }));
    return { saved:true, row:verify.data };
  }

  async function handleSaveRequest(event) {
    if (saveInFlight) return;
    saveInFlight = true;
    const button = document.querySelector('#result [data-action="save-calculation"]');
    try {
      const source = event.detail || window.PRINTCALC_LAST_CALC;
      if (!source) throw new Error("Сначала выполните расчёт.");

      const orderNumber = window.prompt("Введите номер заказа");
      if (orderNumber === null) return;
      const clean = String(orderNumber).trim();
      if (!clean) throw new Error("Номер заказа обязателен для сохранения.");

      const similar = await findSimilar(source);
      if (similar.length) {
        const text = similar.slice(0,3).map(x =>
          `№ ${x.order} — ${x.score}% · ${x.width}×${x.height} мм · раппорт ${x.repeat.toLocaleString("ru-RU", { maximumFractionDigits:2 })} мм`
        ).join("\n");
        const proceed = window.confirm(
          `Найдены похожие прошлые заказы:\n${text}\n\nПроверьте, не подходит ли ранее использованный штамп. Сохранить №${clean}?`
        );
        if (!proceed) return;
      }

      const payload = { ...source, order_number:clean };
      if (button) { button.disabled = true; button.textContent = "Сохраняем…"; }
      const result = await saveCalculation(payload);
      if (button) { button.disabled = false; button.textContent = result.saved ? "Расчёт сохранён" : "Сохранить расчёт"; }
    } catch (error) {
      console.error("PRINTORA SAVE", error);
      setMessage(error?.message || "Не удалось сохранить расчёт.", "error");
      if (button) { button.disabled = false; button.textContent = "Ошибка сохранения"; }
    } finally {
      saveInFlight = false;
    }
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

  window.PRINTORA_FIND_SIMILAR = findSimilar;
  window.PRINTORA_SAVE_CALCULATION = saveCalculation;
  window.PRINTCALC_AUTH_CORE.getCurrentUser = () => currentUser;
  window.PRINTCALC_AUTH_CORE.openAccount = openAccount;
  window.PRINTCALC_AUTH_CORE.saveCalculation = saveCalculation;

  async function init() {
    createModal();
    await refreshUser();
    renderAuth();

    const params = new URLSearchParams(window.location.search);
    if (!currentUser && params.get("auth") === "1") {
      window.history.replaceState({}, document.title, window.location.pathname);
      window.setTimeout(openAccount, 80);
    }

    if (client) {
      client.auth.onAuthStateChange((_event, session) => {
        currentUser = session?.user || null;
        renderAuth();
        window.setTimeout(() => window.dispatchEvent(new CustomEvent("printcalc:auth-changed", { detail:currentUser })), 0);
      });
    }

    window.addEventListener("printcalc:save-request", handleSaveRequest);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once:true });
  } else {
    init();
  }
})();
