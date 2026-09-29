
/* ============================================================
   PRINTORA V28
   ACCOUNT STATE
   ============================================================ */

(function () {

  "use strict";


  function getButtons() {

    const result = [];


    const selectors = [

      "#accountBtn",

      "#accountButton",

      "#authBtn",

      ".account-btn",

      ".account-button",

      ".account-link",

      "[data-account]"

    ];


    selectors.forEach(
      function (selector) {

        document
          .querySelectorAll(selector)
          .forEach(
            function (element) {

              if (
                !result.includes(element)
              ) {

                result.push(element);

              }

            }
          );

      }
    );


    /*
      Дополнительный поиск по тексту.
      Это позволяет поймать старую кнопку,
      если старый CSS/HTML всё ещё оставил
      прежний class.
    */

    document
      .querySelectorAll(
        "button, a"
      )
      .forEach(
        function (element) {

          const text = (
            element.textContent || ""
          )
            .trim()
            .toUpperCase();


          if (
            text === "АККАУНТ" ||
            text === "ЛИЧНЫЙ КАБИНЕТ"
          ) {

            if (
              !result.includes(element)
            ) {

              result.push(element);

            }

          }

        }
      );


    return result;

  }


  function loggedOut() {

    getButtons().forEach(
      function (button) {

        button.textContent =
          "АККАУНТ";


        button.dataset.loggedIn =
          "0";


        button.classList.remove(
          "is-logged-in"
        );


        button.setAttribute(
          "aria-label",
          "Войти в аккаунт"
        );


        button.setAttribute(
          "title",
          "Войти в аккаунт"
        );

      }
    );


    window.PRINTORA_LOGGED_IN =
      false;

  }


  function loggedIn() {

    getButtons().forEach(
      function (button) {

        button.textContent =
          "ЛИЧНЫЙ КАБИНЕТ";


        button.dataset.loggedIn =
          "1";


        button.classList.add(
          "is-logged-in"
        );


        button.setAttribute(
          "aria-label",
          "Открыть личный кабинет"
        );


        button.setAttribute(
          "title",
          "Открыть личный кабинет"
        );

      }
    );


    window.PRINTORA_LOGGED_IN =
      true;

  }


  function getClient() {

    if (
      window.PRINTORA_SUPABASE &&
      window.PRINTORA_SUPABASE.auth
    ) {

      return window.PRINTORA_SUPABASE;

    }


    if (
      window.supabase &&
      window.supabase.auth
    ) {

      return window.supabase;

    }


    return null;

  }


  function localSessionExists() {

    try {

      for (
        let i = 0;
        i < localStorage.length;
        i++
      ) {

        const key =
          localStorage.key(i);


        if (
          !key ||
          !key.startsWith("sb-") ||
          !key.endsWith("-auth-token")
        ) {

          continue;

        }


        const raw =
          localStorage.getItem(key);


        if (!raw) {
          continue;
        }


        let data;


        try {

          data =
            JSON.parse(raw);

        } catch (error) {

          continue;

        }


        const session =
          data &&
          data.currentSession
            ? data.currentSession
            : data;


        if (
          session &&
          session.access_token
        ) {

          if (
            session.expires_at &&
            Number(session.expires_at) *
              1000 <=
            Date.now()
          ) {

            continue;

          }


          return true;

        }

      }

    } catch (error) {

      return false;

    }


    return false;

  }


  async function hasSession() {

    const client =
      getClient();


    if (client) {

      try {

        const result =
          await client.auth.getSession();


        if (
          result &&
          result.data &&
          result.data.session
        ) {

          return true;

        }


      } catch (error) {

        /*
          Fallback ниже.
        */

      }

    }


    return localSessionExists();

  }


  function openLogin() {

    const functions = [

      "openAuthModal",

      "openLoginModal",

      "showAuthModal",

      "showLoginModal",

      "openAccountModal"

    ];


    for (
      const name of functions
    ) {

      if (
        typeof window[name] ===
        "function"
      ) {

        try {

          window[name]();

          return true;

        } catch (error) {

          // continue

        }

      }

    }


    const selectors = [

      "#authModal",

      "#auth-modal",

      "#loginModal",

      "#login-modal",

      "#accountModal",

      "#account-modal",

      ".auth-modal",

      ".login-modal"

    ];


    for (
      const selector of
      selectors
    ) {

      const modal =
        document.querySelector(
          selector
        );


      if (!modal) {

        continue;

      }


      modal.hidden = false;

      modal.classList.remove(
        "hidden"
      );

      modal.classList.remove(
        "is-hidden"
      );

      modal.removeAttribute(
        "aria-hidden"
      );

      modal.style.display =
        "flex";


      return true;

    }


    return false;

  }


  function installClick() {

    document.addEventListener(
      "click",
      async function (event) {

        const button =
          event.target.closest(
            "#accountBtn, #accountButton, #authBtn, .account-btn, .account-button, .account-link, [data-account]"
          );


        if (!button) {

          return;

        }


        const session =
          await hasSession();


        /*
          ВСЕГДА синхронизируем надпись
          перед действием.
        */

        if (session) {

          loggedIn();

        } else {

          loggedOut();

        }


        event.preventDefault();

        event.stopPropagation();

        event.stopImmediatePropagation();


        if (session) {

          /*
            Пользователь вошёл.
            Открываем кабинет.
          */

          window.location.href =
            "./account.html";

        } else {

          /*
            Пользователь не вошёл.
            Открываем авторизацию.
          */

          openLogin();

        }

      },
      true
    );

  }


  function installLogout() {

    document.addEventListener(
      "click",
      function (event) {

        const button =
          event.target.closest(
            "#logoutBtn, #logoutButton, .logout-btn, .logout-button, [data-action='logout'], [data-logout]"
          );


        if (!button) {

          return;

        }


        /*
          МОМЕНТАЛЬНО:
          ЛИЧНЫЙ КАБИНЕТ -> АККАУНТ
        */

        loggedOut();


        /*
          После signOut повторяем.
        */

        setTimeout(
          loggedOut,
          100
        );


        setTimeout(
          loggedOut,
          500
        );


        setTimeout(
          loggedOut,
          1200
        );

      },
      true
    );

  }


  function listenAuth() {

    const client =
      getClient();


    if (!client) {

      return;

    }


    try {

      client.auth.onAuthStateChange(
        function (
          event,
          session
        ) {

          if (session) {

            loggedIn();

          } else {

            loggedOut();

          }

        }
      );

    } catch (error) {

      // ignore

    }

  }


  async function sync() {

    loggedOut();


    const session =
      await hasSession();


    if (session) {

      loggedIn();

    } else {

      loggedOut();

    }

  }


  function start() {

    /*
      Никогда не оставляем старую
      надпись ЛИЧНЫЙ КАБИНЕТ
      до проверки сессии.
    */

    loggedOut();


    sync();


    listenAuth();

    installClick();

    installLogout();


    setTimeout(
      sync,
      250
    );


    setTimeout(
      sync,
      750
    );


    setTimeout(
      sync,
      1500
    );


    /*
      Если кнопка создаётся динамически,
      MutationObserver не нужен для click,
      потому что click обработчик глобальный.
    */

  }


  window.PRINTORA_REFRESH_ACCOUNT_BUTTON =
    sync;


  window.PRINTORA_SET_ACCOUNT_LOGGED_OUT =
    loggedOut;


  window.PRINTORA_SET_ACCOUNT_LOGGED_IN =
    loggedIn;


  if (
    document.readyState ===
    "loading"
  ) {

    document.addEventListener(
      "DOMContentLoaded",
      start
    );

  } else {

    start();

  }

})();
