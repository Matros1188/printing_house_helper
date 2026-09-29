
/* ============================================================
   PRINTORA V26
   ACCOUNT BUTTON STATE
   ============================================================ */

(function () {

  "use strict";


  /* ----------------------------------------------------------
     НАХОДИМ КНОПКУ АККАУНТА
     ---------------------------------------------------------- */

  function findAccountButtons() {

    const buttons = [];


    const selectors = [
      "#accountBtn",
      "#accountButton",
      "#authBtn",
      ".account-btn",
      ".account-button",
      ".account-link",
      "[data-account]",
      "[data-action='account']"
    ];


    selectors.forEach(
      function (selector) {

        document
          .querySelectorAll(selector)
          .forEach(
            function (element) {

              if (
                !buttons.includes(element)
              ) {

                buttons.push(element);

              }

            }
          );

      }
    );


    /* --------------------------------------------------------
       FALLBACK:
       если класс/ID отличается, ищем элемент,
       внутри которого сейчас написано ЛИЧНЫЙ КАБИНЕТ
       -------------------------------------------------------- */

    document
      .querySelectorAll(
        "button, a, [role='button']"
      )
      .forEach(
        function (element) {

          const text =
            (
              element.textContent || ""
            )
            .trim()
            .toUpperCase();

          if (
            text === "ЛИЧНЫЙ КАБИНЕТ" ||
            text === "АККАУНТ"
          ) {

            if (
              !buttons.includes(element)
            ) {

              buttons.push(element);

            }

          }

        }
      );


    return buttons;

  }


  /* ----------------------------------------------------------
     СОСТОЯНИЕ: НЕ ВОШЁЛ
     ---------------------------------------------------------- */

  function setLoggedOut() {

    const buttons =
      findAccountButtons();


    buttons.forEach(
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


    window.PRINTORA_ACCOUNT_LOGGED_IN =
      false;

  }


  /* ----------------------------------------------------------
     СОСТОЯНИЕ: ВОШЁЛ
     ---------------------------------------------------------- */

  function setLoggedIn() {

    const buttons =
      findAccountButtons();


    buttons.forEach(
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


    window.PRINTORA_ACCOUNT_LOGGED_IN =
      true;

  }


  /* ----------------------------------------------------------
     ПОЛУЧАЕМ SUPABASE CLIENT
     ---------------------------------------------------------- */

  function getSupabaseClient() {

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


  /* ----------------------------------------------------------
     ПРОВЕРКА ТЕКУЩЕЙ СЕССИИ
     ---------------------------------------------------------- */

  async function syncAccountButton() {

    /*
      Самое важное:

      Сначала всегда ставим АККАУНТ.

      Поэтому старая надпись ЛИЧНЫЙ КАБИНЕТ
      не зависает на экране, пока Supabase
      восстанавливает сессию.
    */

    setLoggedOut();


    const client =
      getSupabaseClient();


    if (!client) {

      /*
        Auth client может загрузиться позже.
      */

      return;

    }


    try {

      const result =
        await client.auth.getSession();


      const session =
        result &&
        result.data &&
        result.data.session
          ? result.data.session
          : null;


      if (session) {

        setLoggedIn();

      } else {

        setLoggedOut();

      }

    } catch (error) {

      /*
        Ошибка проверки = пользователь считается
        неавторизованным.
      */

      setLoggedOut();

    }

  }


  /* ----------------------------------------------------------
     СЛУШАЕМ AUTH STATE
     ---------------------------------------------------------- */

  function installAuthListener() {

    const client =
      getSupabaseClient();


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

            setLoggedIn();

          } else {

            setLoggedOut();

          }

        }
      );

    } catch (error) {

      // ignore

    }

  }


  /* ----------------------------------------------------------
     ОТЛОВ ВЫХОДА
     ---------------------------------------------------------- */

  function installLogoutListener() {

    const selectors = [

      "#logoutBtn",
      "#logoutButton",
      ".logout-btn",
      ".logout-button",
      "[data-action='logout']",
      "[data-logout]"

    ];


    selectors.forEach(
      function (selector) {

        document
          .querySelectorAll(selector)
          .forEach(
            function (button) {

              if (
                button.dataset
                  .printoraLogoutBound === "1"
              ) {

                return;

              }


              button.addEventListener(
                "click",
                function () {

                  /*
                    Моментально меняем
                    ЛИЧНЫЙ КАБИНЕТ -> АККАУНТ.
                  */

                  setLoggedOut();


                  setTimeout(
                    syncAccountButton,
                    100
                  );


                  setTimeout(
                    syncAccountButton,
                    500
                  );


                  setTimeout(
                    syncAccountButton,
                    1200
                  );

                },
                true
              );


              button.dataset
                .printoraLogoutBound = "1";

            }
          );

      }
    );

  }


  /* ----------------------------------------------------------
     ГЛОБАЛЬНАЯ ФУНКЦИЯ
     ---------------------------------------------------------- */

  window.PRINTORA_REFRESH_ACCOUNT_BUTTON =
    syncAccountButton;


  window.PRINTORA_SET_ACCOUNT_LOGGED_IN =
    setLoggedIn;


  window.PRINTORA_SET_ACCOUNT_LOGGED_OUT =
    setLoggedOut;


  /* ----------------------------------------------------------
     START
     ---------------------------------------------------------- */

  function start() {

    /*
      Немедленно показываем правильное безопасное
      начальное состояние.
    */

    setLoggedOut();


    /*
      Сверяемся с реальной Supabase session.
    */

    syncAccountButton();


    /*
      Подключаем слушатель.
    */

    installAuthListener();


    /*
      Auth core может загрузиться позже.
      Поэтому повторяем проверку.
    */

    setTimeout(
      syncAccountButton,
      150
    );


    setTimeout(
      syncAccountButton,
      500
    );


    setTimeout(
      syncAccountButton,
      1200
    );


    /*
      Logout может появиться динамически.
    */

    installLogoutListener();


    const observer =
      new MutationObserver(
        function () {

          installLogoutListener();

        }
      );


    observer.observe(
      document.body,
      {
        childList: true,
        subtree: true
      }
    );

  }


  /* ----------------------------------------------------------
     ЗАПУСК
     ---------------------------------------------------------- */

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
