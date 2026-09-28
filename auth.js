(() => {

  "use strict";

  const config =
    window.PRINTCALC_CONFIG || {};

  const client =
    window.supabase &&
    config.SUPABASE_URL &&
    config.SUPABASE_ANON_KEY
      ? window.supabase.createClient(
          config.SUPABASE_URL,
          config.SUPABASE_ANON_KEY
        )
      : null;

  let currentUser = null;
  let authMode = "login";

  function escapeHtml(value) {

    return String(
      value ?? ""
    ).replace(
      /[&<>"']/g,
      (char) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
      }[char])
    );

  }

  function addAccountButton() {

    if (
      document.querySelector(
        ".pc-account-button"
      )
    ) {
      return;
    }

    const button =
      document.createElement(
        "button"
      );

    button.type = "button";

    button.className =
      "pc-account-button";

    button.textContent =
      "Аккаунт";

    button.addEventListener(
      "click",
      openAccount
    );

    const header =
      document.querySelector(
        ".header-in"
      ) ||
      document.querySelector(
        ".header"
      );

    if (header) {

      header.appendChild(
        button
      );

    } else {

      document.body.appendChild(
        button
      );

    }

  }

  function moveCreator() {

    const logo =
      document.querySelector(
        ".logo"
      );

    if (
      !logo ||
      logo.querySelector(
        ".pc-brand-credit"
      )
    ) {
      return;
    }

    const credit =
      document.createElement(
        "div"
      );

    credit.className =
      "pc-brand-credit";

    credit.textContent =
      "Created by Sergey Pavlov";

    logo.appendChild(
      credit
    );

  }

  function addSlogan() {

    const home =
      location.pathname.endsWith(
        "/"
      ) ||
      location.pathname.endsWith(
        "index.html"
      );

    if (!home) {
      return;
    }

    if (
      document.querySelector(
        ".pc-selling-slogan"
      )
    ) {
      return;
    }

    const h1 =
      document.querySelector(
        "h1"
      );

    if (!h1) {
      return;
    }

    const slogan =
      document.createElement(
        "div"
      );

    slogan.className =
      "pc-selling-slogan";

    slogan.textContent =
      "СЧИТАЙТЕ БЫСТРЕЕ. ПРЕДЛАГАЙТЕ УВЕРЕННЕЕ.";

    h1.insertAdjacentElement(
      "afterend",
      slogan
    );

  }

  function replaceDetailIcons() {

    document
      .querySelectorAll(
        "body *"
      )
      .forEach(
        (element) => {

          if (
            element.children.length >
            0
          ) {
            return;
          }

          if (
            element.textContent
              .includes("📊")
          ) {

            element.textContent =
              element.textContent.replace(
                /📊/g,
                "Σ"
              );

          }

        }
      );

  }

  function createModal() {

    if (
      document.getElementById(
        "pc-auth-modal"
      )
    ) {
      return;
    }

    const modal =
      document.createElement(
        "div"
      );

    modal.id =
      "pc-auth-modal";

    modal.className =
      "pc-auth-modal";

    modal.hidden = true;

    modal.innerHTML = `
      <div class="pc-auth-card">

        <button
          type="button"
          class="pc-auth-close"
          aria-label="Закрыть"
        >
          ×
        </button>

        <div class="pc-auth-brand">
          PRINTCALC FLEXO
        </div>

        <h2>
          Ваш рабочий аккаунт
        </h2>

        <p class="pc-auth-lead">
          Сохраняйте расчёты и открывайте
          свою историю с любого устройства.
        </p>

        <div class="pc-auth-tabs">

          <button
            type="button"
            data-auth-mode="login"
          >
            Войти
          </button>

          <button
            type="button"
            data-auth-mode="register"
          >
            Создать аккаунт
          </button>

        </div>

        <div
          id="pc-auth-message"
          class="pc-auth-message"
        ></div>

        <div id="pc-auth-form">

          <label>
            Email

            <input
              id="pc-email"
              type="email"
              autocomplete="email"
              placeholder="name@company.ru"
            >

          </label>

          <label>
            Пароль

            <input
              id="pc-password"
              type="password"
              autocomplete="current-password"
              placeholder="Минимум 6 символов"
            >

          </label>

          <button
            id="pc-submit"
            class="pc-submit"
            type="button"
          >
            Войти
          </button>

        </div>

        <div
          id="pc-session"
          hidden
        >

          <div class="pc-session-label">
            ВЫ ВОШЛИ
          </div>

          <div
            id="pc-session-email"
            class="pc-session-email"
          ></div>

          <div class="pc-history-head">

            <span>
              История расчётов
            </span>

            <button
              id="pc-refresh"
              type="button"
            >
              Обновить
            </button>

          </div>

          <div
            id="pc-history"
            class="pc-history"
          ></div>

          <button
            id="pc-logout"
            class="pc-logout"
            type="button"
          >
            Выйти
          </button>

        </div>

        <div class="pc-auth-foot">
          Каждый аккаунт видит только
          собственные расчёты.
        </div>

      </div>
    `;

    document.body.appendChild(
      modal
    );

    modal.addEventListener(
      "click",
      (event) => {

        if (
          event.target === modal
        ) {

          closeAccount();

        }

      }
    );

    modal
      .querySelector(
        ".pc-auth-close"
      )
      .addEventListener(
        "click",
        closeAccount
      );

    modal
      .querySelectorAll(
        "[data-auth-mode]"
      )
      .forEach(
        (button) => {

          button.addEventListener(
            "click",
            () => {

              authMode =
                button.dataset.authMode;

              renderAuth();

            }
          );

        }
      );

    document
      .getElementById(
        "pc-submit"
      )
      .addEventListener(
        "click",
        submitAuth
      );

    document
      .getElementById(
        "pc-refresh"
      )
      .addEventListener(
        "click",
        loadHistory
      );

    document
      .getElementById(
        "pc-logout"
      )
      .addEventListener(
        "click",
        logout
      );

    renderAuth();

  }

  function setMessage(
    text,
    type
  ) {

    const box =
      document.getElementById(
        "pc-auth-message"
      );

    if (!box) {
      return;
    }

    box.textContent =
      text || "";

    box.className =
      "pc-auth-message " +
      (type || "");

  }

  function renderAuth() {

    const form =
      document.getElementById(
        "pc-auth-form"
      );

    const session =
      document.getElementById(
        "pc-session"
      );

    const email =
      document.getElementById(
        "pc-session-email"
      );

    if (!form || !session) {
      return;
    }

    form.hidden =
      Boolean(
        currentUser
      );

    session.hidden =
      !currentUser;

    if (email) {

      email.textContent =
        currentUser?.email ||
        "";

    }

    document
      .querySelectorAll(
        "[data-auth-mode]"
      )
      .forEach(
        (button) => {

          button.classList.toggle(
            "active",
            button.dataset.authMode ===
              authMode
          );

        }
      );

    const submit =
      document.getElementById(
        "pc-submit"
      );

    if (submit) {

      submit.textContent =
        authMode === "register"
          ? "Создать аккаунт"
          : "Войти";

    }

    const account =
      document.querySelector(
        ".pc-account-button"
      );

    if (account) {

      account.textContent =
        currentUser
          ? "Аккаунт · ●"
          : "Аккаунт";

    }

  }

  async function submitAuth() {

    if (!client) {

      setMessage(
        "Supabase не подключён.",
        "error"
      );

      return;
    }

    const email =
      document
        .getElementById(
          "pc-email"
        )
        .value
        .trim();

    const password =
      document
        .getElementById(
          "pc-password"
        )
        .value;

    if (
      !email ||
      !email.includes("@")
    ) {

      setMessage(
        "Введите корректный email.",
        "error"
      );

      return;
    }

    if (
      password.length < 6
    ) {

      setMessage(
        "Пароль должен быть минимум 6 символов.",
        "error"
      );

      return;
    }

    const submit =
      document.getElementById(
        "pc-submit"
      );

    submit.disabled =
      true;

    try {

      let response;

      if (
        authMode ===
        "register"
      ) {

        response =
          await client.auth.signUp({
            email,
            password
          });

      } else {

        response =
          await client.auth.signInWithPassword({
            email,
            password
          });

      }

      if (response.error) {
        throw response.error;
      }

      const session =
        await client.auth.getSession();

      currentUser =
        session
          .data
          .session
          ?.user || null;

      if (
        authMode === "register" &&
        !currentUser
      ) {

        setMessage(
          "Аккаунт создан. Проверьте почту.",
          "success"
        );

      } else {

        setMessage(
          "Вход выполнен.",
          "success"
        );

      }

      renderAuth();

      if (currentUser) {
        loadHistory();
      }

    } catch (error) {

      setMessage(
        error?.message ||
          "Ошибка авторизации.",
        "error"
      );

    } finally {

      submit.disabled =
        false;

    }

  }

  async function logout() {

    if (client) {
      await client.auth.signOut();
    }

    currentUser = null;

    renderAuth();

    setMessage(
      "Вы вышли из аккаунта.",
      "success"
    );

  }

  async function loadHistory() {

    if (
      !client ||
      !currentUser
    ) {
      return;
    }

    const box =
      document.getElementById(
        "pc-history"
      );

    if (!box) {
      return;
    }

    box.innerHTML =
      "<div class='pc-empty'>Загрузка...</div>";

    const response =
      await client
        .from("calculations")
        .select(
          "id,mode,calculation_data,created_at"
        )
        .order(
          "created_at",
          {
            ascending: false
          }
        )
        .limit(30);

    if (response.error) {

      box.innerHTML =
        "<div class='pc-empty'>" +
        escapeHtml(
          response.error.message
        ) +
        "</div>";

      return;
    }

    if (
      !response.data ||
      !response.data.length
    ) {

      box.innerHTML =
        "<div class='pc-empty'>" +
        "Сохранённых расчётов пока нет." +
        "</div>";

      return;
    }

    box.innerHTML =
      response.data
        .map(
          (item) => {

            const title =
              item
                .calculation_data
                ?.title ||
              "Расчёт заказа";

            const date =
              new Date(
                item.created_at
              ).toLocaleString(
                "ru-RU"
              );

            return `
              <div class="pc-history-item">

                <div>

                  <b>
                    ${
                      item.mode === "detail"
                        ? "Σ Детальный расчёт"
                        : "⚡ Быстрый расчёт"
                    }
                  </b>

                  <small>
                    ${escapeHtml(title)}
                  </small>

                  <small>
                    ${escapeHtml(date)}
                  </small>

                </div>

              </div>
            `;

          }
        )
        .join("");

  }

  async function saveCalculation() {

    if (
      !client ||
      !currentUser
    ) {
      return;
    }

    const result =
      document.querySelector(
        "#result"
      ) ||
      document.querySelector(
        ".result"
      );

    if (!result) {
      return;
    }

    const resultText =
      (
        result.innerText ||
        ""
      ).trim();

    if (
      resultText.length < 30
    ) {
      return;
    }

    const mode =
      location.pathname
        .toLowerCase()
        .includes("detail")
        ? "detail"
        : "quick";

    const response =
      await client
        .from("calculations")
        .insert({
          user_id:
            currentUser.id,

          mode:
            mode,

          calculation_data: {
            title:
              mode === "detail"
                ? "Детальный расчёт"
                : "Быстрый расчёт",

            result_text:
              resultText
          }
        });

    if (response.error) {

      console.warn(
        "PRINTCALC:",
        response.error.message
      );

    }

  }

  function openAccount() {

    createModal();

    const modal =
      document.getElementById(
        "pc-auth-modal"
      );

    if (modal) {
      modal.hidden = false;
    }

    if (currentUser) {
      loadHistory();
    }

  }

  function closeAccount() {

    const modal =
      document.getElementById(
        "pc-auth-modal"
      );

    if (modal) {
      modal.hidden = true;
    }

  }

  async function init() {

    addAccountButton();
    moveCreator();
    addSlogan();
    createModal();

    setTimeout(
      replaceDetailIcons,
      100
    );

    if (!client) {
      return;
    }

    const session =
      await client.auth.getSession();

    currentUser =
      session
        .data
        .session
        ?.user || null;

    renderAuth();

    client.auth.onAuthStateChange(
      (_event, sessionData) => {

        currentUser =
          sessionData
            ?.user || null;

        renderAuth();

        if (currentUser) {
          loadHistory();
        }

      }
    );

    document.addEventListener(
      "click",
      (event) => {

        if (
          event.target.closest(
            "#calc"
          ) ||
          event.target.closest(
            "[data-calculate]"
          )
        ) {

          setTimeout(
            saveCalculation,
            700
          );

        }

      }
    );

  }

  if (
    document.readyState ===
    "loading"
  ) {

    document.addEventListener(
      "DOMContentLoaded",
      init
    );

  } else {

    init();

  }

})();
