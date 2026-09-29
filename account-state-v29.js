
/* ============================================================
   PRINTORA V29
   ONE ACCOUNT BUTTON
   ============================================================ */

(function () {

  "use strict";


  const BUTTON_ID =
    "printora-account-v29";


  function button() {

    return document.getElementById(
      BUTTON_ID
    );

  }


  function loggedOut() {

    const el =
      button();


    if (!el) {
      return;
    }


    el.textContent =
      "АККАУНТ";


    el.dataset.accountState =
      "logged-out";


    el.classList.remove(
      "is-logged-in"
    );


    el.setAttribute(
      "aria-label",
      "Войти в аккаунт"
    );


    window.PRINTORA_ACCOUNT_LOGGED_IN =
      false;

  }


  function loggedIn() {

    const el =
      button();


    if (!el) {
      return;
    }


    el.textContent =
      "ЛИЧНЫЙ КАБИНЕТ";


    el.dataset.accountState =
      "logged-in";


    el.classList.add(
      "is-logged-in"
    );


    el.setAttribute(
      "aria-label",
      "Открыть личный кабинет"
    );


    window.PRINTORA_ACCOUNT_LOGGED_IN =
      true;

  }


  function client() {

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


  function localSession() {

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


        let parsed;


        try {

          parsed =
            JSON.parse(raw);

        } catch (error) {

          continue;

        }


        if (
          parsed &&
          parsed.access_token
        ) {

          return true;

        }


        if (
          parsed &&
          parsed.currentSession &&
          parsed.currentSession.access_token
        ) {

          return true;

        }

      }

    } catch (error) {

      return false;

    }


    return false;

  }


  async function sessionExists() {

    const sb =
      client();


    if (sb) {

      try {

        const result =
          await sb.auth.getSession();


        return !!(
          result &&
          result.data &&
          result.data.session
        );

      } catch (error) {

        // fallback

      }

    }


    return localSession();

  }


  function openLogin() {

    const funcs = [

      "openAuthModal",

      "openLoginModal",

      "showAuthModal",

      "showLoginModal",

      "openAccountModal"

    ];


    for (
      const name of funcs
    ) {

      if (
        typeof window[name] ===
        "function"
      ) {

        try {

          window[name]();

          return true;

        } catch (error) {}

      }

    }


    const triggers = [

      "[data-auth-open]",

      "[data-open-auth]",

      "#openAuth",

      "#openLogin",

      "#loginBtn",

      "#loginButton",

      ".auth-open",

      ".login-btn",

      ".login-button"

    ];


    for (
      const selector of
      triggers
    ) {

      const el =
        document.querySelector(
          selector
        );


      if (el) {

        el.click();

        return true;

      }

    }


    const modals = [

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
      modals
    ) {

      const modal =
        document.querySelector(
          selector
        );


      if (!modal) {
        continue;
      }


      modal.hidden =
        false;


      modal.removeAttribute(
        "aria-hidden"
      );


      modal.classList.remove(
        "hidden"
      );


      modal.classList.remove(
        "is-hidden"
      );


      modal.style.display =
        "flex";


      return true;

    }


    return false;

  }


  async function accountClick() {

    const logged =
      await sessionExists();


    if (logged) {

      loggedIn();

      window.location.href =
        "./account.html";

    } else {

      loggedOut();

      openLogin();

    }

  }


  function installClick() {

    document.addEventListener(
      "click",
      function (event) {

        const el =
          event.target.closest(
            "#" + BUTTON_ID
          );


        if (!el) {
          return;
        }


        event.preventDefault();

        event.stopPropagation();

        event.stopImmediatePropagation();


        accountClick();

      },
      true
    );

  }


  function listenAuth() {

    const sb =
      client();


    if (!sb) {
      return;
    }


    try {

      sb.auth.onAuthStateChange(
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

    } catch (error) {}

  }


  async function sync() {

    /*
      Старое состояние никогда не сохраняем.
    */

    loggedOut();


    const logged =
      await sessionExists();


    if (logged) {

      loggedIn();

    } else {

      loggedOut();

    }

  }


  function start() {

    /*
      Базовое состояние.
    */

    loggedOut();


    /*
      Проверяем реальную session.
    */

    sync();


    installClick();

    listenAuth();


    /*
      Повторяем после загрузки auth-core.
    */

    setTimeout(
      sync,
      300
    );


    setTimeout(
      sync,
      900
    );


    setTimeout(
      sync,
      1600
    );

  }


  /*
    Доступно существующему logout-коду.
  */

  window.PRINTORA_SET_ACCOUNT_LOGGED_OUT =
    loggedOut;


  window.PRINTORA_SET_ACCOUNT_LOGGED_IN =
    loggedIn;


  window.PRINTORA_REFRESH_ACCOUNT_BUTTON =
    sync;


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
