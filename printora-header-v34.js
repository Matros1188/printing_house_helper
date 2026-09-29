(() => {

  "use strict";


  const ACCOUNT_ID =
    "printora-account-button-v34";


  const CABINET_ID =
    "printora-cabinet-button-v34";


  function getClient() {

    const core =
      window.PRINTCALC_AUTH_CORE || {};

    if (
      typeof core.getClient ===
      "function"
    ) {

      return core.getClient();

    }

    return null;

  }


  function getAccountButton() {

    return document.getElementById(
      ACCOUNT_ID
    );

  }


  function getCabinetButton() {

    return document.getElementById(
      CABINET_ID
    );

  }


  function applyState(user) {

    const account =
      getAccountButton();

    const cabinet =
      getCabinetButton();


    if (account) {

      // До входа кнопка АККАУНТ видна.
      // После входа она полностью исчезает.

      account.hidden =
        Boolean(user);

      account.textContent =
        "АККАУНТ";

      account.setAttribute(
        "aria-hidden",
        user ? "true" : "false"
      );

    }


    if (cabinet) {

      // Кабинет — самостоятельная правая кнопка.
      cabinet.hidden = false;

    }


    if (user) {

      const modal =
        document.getElementById(
          "pc-auth-modal"
        );

      if (modal) {
        modal.hidden = true;
      }

    }

  }


  function openLoginModal() {

    const modal =
      document.getElementById(
        "pc-auth-modal"
      );


    if (modal) {

      modal.hidden = false;
      return;

    }


    // auth.js создаёт окно авторизации
    // при запуске страницы.

    window.setTimeout(
      openLoginModal,
      80
    );

  }


  function bindAccountButton() {

    const account =
      getAccountButton();


    if (!account) {
      return;
    }


    if (
      account.dataset.headerV34Bound ===
      "1"
    ) {
      return;
    }


    account.dataset.headerV34Bound =
      "1";


    account.addEventListener(
      "click",
      () => {

        const client =
          getClient();


        if (!client) {

          openLoginModal();
          return;

        }


        client.auth
          .getSession()
          .then(
            ({ data }) => {

              const user =
                data?.session?.user ||
                null;


              if (user) {

                window.location.href =
                  "./account.html";

              } else {

                openLoginModal();

              }

            }
          )
          .catch(() => {

            openLoginModal();

          });

      }
    );

  }


  async function init() {

    bindAccountButton();


    const client =
      getClient();


    if (!client) {

      applyState(null);
      return;

    }


    let user = null;


    try {

      const result =
        await client.auth.getSession();

      user =
        result?.data?.session?.user ||
        null;

    } catch (_) {

      user = null;

    }


    applyState(user);


    client.auth.onAuthStateChange(
      (_event, session) => {

        const nextUser =
          session?.user || null;


        window.setTimeout(
          () => {

            bindAccountButton();

            applyState(nextUser);

          },
          0
        );

      }
    );


    // account.html при отсутствии авторизации
    // возвращает пользователя на главную:
    // ./?auth=1
    //
    // Здесь автоматически открываем окно входа.

    const params =
      new URLSearchParams(
        window.location.search
      );


    if (
      !user &&
      params.get("auth") === "1"
    ) {

      window.history.replaceState(
        {},
        document.title,
        window.location.pathname
      );


      window.setTimeout(
        openLoginModal,
        150
      );

    }

  }


  if (
    document.readyState ===
    "loading"
  ) {

    document.addEventListener(
      "DOMContentLoaded",
      init,
      { once: true }
    );

  } else {

    init();

  }

})();
