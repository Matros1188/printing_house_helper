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


  async function fetchAllRows(modes = ["quick", "detail"]) {
    if (!client || !currentUser) return [];
    const all = [];
    const page = 500;
    let from = 0;
    while (true) {
      const response = await client.from("calculations")
        .select("id,user_id,mode,calculation_data,created_at")
        .eq("user_id", currentUser.id)
        .in("mode", modes)
        .order("created_at", { ascending: false })
        .range(from, from + page - 1);
      if (response.error) throw response.error;
      const rows = response.data || [];
      all.push(...rows);
      if (rows.length < page) break;
      from += page;
    }
    return all;
  }
  async function loadHistory() {
    if (!client || !currentUser) return;
    const box = document.getElementById("pc-history");
    if (!box) return;
    box.innerHTML = "<div class='pc-empty'>Загрузка истории…</div>";
    try {
      const rows = await fetchAllRows(["quick", "detail"]);
      if (!rows.length) {
        box.innerHTML = "<div class='pc-empty'>Сохранённых расчётов пока нет.</div>";
        return;
      }
      box.innerHTML = rows.slice(0, 120).map((item) => {
        const d = item.calculation_data || {};
        const order = d.order_number ? `№ ${d.order_number}` : "Без номера";
        const title = d.customer || d.customerName || "Заказ";
        const date = item.created_at ? new Date(item.created_at).toLocaleString("ru-RU") : "";
        const mode = item.mode === "detail" ? "Детальный" : "Быстрый";
        return `<article class="printora-history-card-v38"><div><strong>${escapeHtml(order)}</strong><span>${escapeHtml(title)}</span><small>${mode} · ${escapeHtml(date)}</small></div></article>`;
      }).join("");
    } catch (error) {
      box.innerHTML = `<div class='pc-empty'>Не удалось загрузить историю: ${escapeHtml(error?.message || "ошибка")}</div>`;
    }
  }

  async function duplicateOrderNumberExists(orderNumber) {
    const clean = String(orderNumber || "").trim().toLocaleLowerCase("ru-RU");
    if (!clean || !currentUser || !client) return false;
    const rows = await fetchAllRows(["quick", "detail"]);
    return rows.some((row) => String(row.calculation_data?.order_number || "").trim().toLocaleLowerCase("ru-RU") === clean);
  }

  async function findSimilar(source) {
    if (!client || !currentUser) return [];
    const inputs = source?.inputs || {};
    const summary = source?.summary || {};
    const repeat = Number(source?.repeat_mm ?? inputs.repeatMm ?? window.PRINTORA_REPEAT_MM?.(inputs.repeat || "") ?? 0);
    const a = {
      width: Number(inputs.width ?? summary.width ?? 0),
      height: Number(inputs.height ?? summary.height ?? 0),
      repeat,
      streams: Number(inputs.streams ?? summary.streams ?? 0),
      web: Number(inputs.web ?? summary.web ?? 0),
      colors: Number(inputs.colors ?? summary.colors ?? 0),
      materialId: source?.materialId || inputs.materialId || inputs.material?.id || "",
      lam: Boolean(inputs.lam ?? inputs.lamEnabled),
      die: Boolean(inputs.die ?? inputs.dieEnabled),
      clientId: source?.client_id || ""
    };
    if (a.width <= 0 || a.height <= 0 || a.repeat <= 0) return [];
    const rows = await fetchAllRows(["quick", "detail"]);
    const relative = (x, y, tolerance) => !x || !y ? (x === y ? 1 : 0) : (Math.abs(x-y) <= tolerance ? 1 : Math.max(0, 1 - Math.abs(x-y) / (Math.abs(y)+tolerance)));
    return rows.map((row) => {
      const d = row.calculation_data || {};
      if (a.clientId && d.client_id === a.clientId) return null;
      const i = d.inputs || {}; const s = d.summary || {};
      const rep = Number(d.repeat_mm ?? i.repeatMm ?? window.PRINTORA_REPEAT_MM?.(i.repeat || "") ?? 0);
      const b = {
        width: Number(i.width ?? s.width ?? 0), height: Number(i.height ?? s.height ?? 0), repeat: rep,
        streams: Number(i.streams ?? s.streams ?? 0), web: Number(i.web ?? s.web ?? 0), colors: Number(i.colors ?? s.colors ?? 0),
        materialId: d.materialId || i.materialId || i.material?.id || "", lam: Boolean(i.lam ?? i.lamEnabled), die: Boolean(i.die ?? i.dieEnabled)
      };
      const score = Math.round(
        relative(a.width,b.width,1)*24 + relative(a.height,b.height,1)*24 + relative(a.repeat,b.repeat,1)*22 +
        (a.streams===b.streams?10:0) + relative(a.web,b.web,2)*7 + (a.colors===b.colors?4:0) +
        (a.materialId && b.materialId && a.materialId===b.materialId?5:0) + (a.lam===b.lam?2:0) + (a.die===b.die?2:0)
      );
      return { score, order:d.order_number||"без номера", createdAt:row.created_at, width:b.width, height:b.height, repeat:b.repeat };
    }).filter(Boolean).filter((x)=>x.score>=72).sort((a,b)=>b.score-a.score || new Date(b.createdAt)-new Date(a.createdAt)).slice(0,5);
  }

  async function saveCalculation(payload){
  if(!client||!currentUser)throw new Error("Войдите в аккаунт, чтобы сохранить расчёт.");
  const order=String(payload?.order_number||"").trim();if(!order)throw new Error("Номер заказа обязателен для сохранения.");
  const orderKey=order.toLocaleLowerCase("ru-RU");
  const duplicate=typeof duplicateOrderNumberExists==="function"?await duplicateOrderNumberExists(order):false;if(duplicate)throw new Error(`Заказ №${order} уже существует в истории этого аккаунта.`);
  const data={...(payload||{}),order_number:order,order_number_key:orderKey};
  const result=await client.from("calculations").insert({user_id:currentUser.id,mode:data.mode==="detail"?"detail":"quick",order_number_key:orderKey,calculation_data:data}).select("id,user_id,mode,order_number_key,calculation_data,created_at").single();
  if(result.error){if(window.PRINTORA_IS_SCHEMA_ERROR?.(result.error))throw new Error(window.PRINTORA_FRIENDLY_ERROR?.(result.error));if(result.error.code==="23505")throw new Error(`Заказ №${order} уже существует в истории этого аккаунта.`);throw result.error;}
  if(!result.data?.id||result.data.user_id!==currentUser.id)throw new Error("Облако не подтвердило сохранение расчёта.");
  window.dispatchEvent(new CustomEvent("printcalc:history-saved",{detail:result.data}));return{saved:true,id:result.data.id,row:result.data};
}

  async function handleSaveRequest(event) {
    if (saveInFlight) return;
    saveInFlight = true;
    const button = document.querySelector('#result [data-action="save-calculation"]');
    try {
      const source = event.detail || window.PRINTCALC_LAST_CALC;
      if (!source) throw new Error("Сначала выполните расчёт.");
      const orderNumber = typeof window.PRINTORA_SAVE_ORDER_DIALOG === "function" ? await window.PRINTORA_SAVE_ORDER_DIALOG({ source }) : window.prompt("Введите номер заказа");
      if (orderNumber === null || orderNumber === undefined) return;
      const clean = String(orderNumber).trim();
      if (!clean) throw new Error("Номер заказа обязателен для сохранения.");
      if (await duplicateOrderNumberExists(clean)) {
        if (typeof window.PRINTORA_DUPLICATE_ORDER_DIALOG === "function") await window.PRINTORA_DUPLICATE_ORDER_DIALOG(clean);
        else window.alert(`Заказ №${clean} уже существует в истории этого аккаунта.`);
        return;
      }
      const similar = await findSimilar({ ...source, order_number:clean });
      if (similar.length) {
        const proceed = typeof window.PRINTORA_SIMILAR_DIALOG === "function" ? await window.PRINTORA_SIMILAR_DIALOG({ orderNumber:clean, similar, source }) : window.confirm("Найдены похожие прошлые заказы. Сохранить новый заказ?");
        if (!proceed) return;
      }
      if (button) { button.disabled=true; button.textContent="Сохраняем…"; }
      const result = await saveCalculation({ ...source, order_number:clean });
      if (button) { button.disabled=false; button.textContent = result.saved ? "Расчёт сохранён" : "Сохранить расчёт"; }
    } catch (error) {
      console.error("PRINTORA SAVE", error);
      setMessage(error?.message || "Не удалось сохранить расчёт.", "error");
      window.dispatchEvent(new CustomEvent("printcalc:history-save-error", { detail:{ message:error?.message || "Ошибка сохранения" } }));
      if (button) { button.disabled=false; button.textContent="Ошибка сохранения"; }
    } finally { saveInFlight=false; }
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
    if (!window.__PRINTORA_SAVE_LISTENER_INSTALLED) {
      window.__PRINTORA_SAVE_LISTENER_INSTALLED = true;
      window.addEventListener("printcalc:save-request", handleSaveRequest);
    }
    if (!window.__PRINTORA_AUTH_LISTENER_INSTALLED && client?.auth?.onAuthStateChange) {
      window.__PRINTORA_AUTH_LISTENER_INSTALLED = true;
      client.auth.onAuthStateChange((_event, session) => {
        currentUser = session?.user || null;
        renderAuth();
        window.dispatchEvent(new CustomEvent("printcalc:auth-changed", { detail: currentUser }));
      });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once:true });
  } else {
    init();
  }
})();
