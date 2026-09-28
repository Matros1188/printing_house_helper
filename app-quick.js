
"use strict";


const SUPABASE_URL =
    window.PRINTCALC_SUPABASE_URL || "";


const SUPABASE_KEY =
    window.PRINTCALC_SUPABASE_KEY || "";


let supabaseClient = null;


if (
    SUPABASE_URL &&
    SUPABASE_KEY &&
    window.supabase
) {

    try {

        supabaseClient =
            window.supabase.createClient(
                SUPABASE_URL,
                SUPABASE_KEY
            );

    }
    catch (error) {

        console.warn(error);

    }

}


const $ =
    id => document.getElementById(id);


const HISTORY_KEY =
    "printcalc_flexo_history";


function num(
    element,
    fallback
) {

    const number =
        Number(
            element?.value
        );


    if (
        Number.isFinite(number)
    ) {

        return number;

    }


    return fallback;

}


function fmt(
    number,
    digits
) {

    return Number(
        number || 0
    ).toLocaleString(
        "ru-RU",
        {
            minimumFractionDigits:
                digits,

            maximumFractionDigits:
                digits
        }
    );

}


function rub(
    number
) {

    return (
        fmt(
            number,
            0
        ) +
        " ₽"
    );

}


function getHistory() {

    try {

        return JSON.parse(
            localStorage.getItem(
                HISTORY_KEY
            ) ||
            "[]"
        );

    }
    catch {

        return [];

    }

}


function saveHistory(
    item
) {

    const history =
        getHistory();


    history.unshift(
        item
    );


    localStorage.setItem(
        HISTORY_KEY,
        JSON.stringify(
            history.slice(
                0,
                30
            )
        )
    );


    renderHistory();

}


function renderHistory() {

    const box =
        $("historyList");


    if (!box)
        return;


    const history =
        getHistory();


    if (
        !history.length
    ) {

        box.innerHTML =
            "<div class=\"empty\">" +
            "Сохранённых расчётов пока нет." +
            "</div>";

        return;

    }


    box.innerHTML =
        history
            .slice(
                0,
                6
            )
            .map(
                item => {

                    return `
<div class="history-item">

<div>

<div class="history-title">
${fmt(item.quantity,0)}
шт. ·
${item.streams}
ручья
</div>

<div class="history-sub">
${item.width}×${item.height}
мм ·
${fmt(item.meters,1)}
м
</div>

</div>

<div class="history-price">
${rub(item.clientPrice)}
</div>

</div>
`;

                }
            )
            .join("");

}


function calculateQuick() {

    const quantity =
        Math.max(
            1,
            num(
                $("quantity"),
                10000
            )
        );


    const width =
        Math.max(
            1,
            num(
                $("width"),
                100
            )
        );


    const height =
        Math.max(
            1,
            num(
                $("height"),
                70
            )
        );


    const streams =
        Math.max(
            1,
            num(
                $("streams"),
                2
            )
        );


    const webWidth =
        Math.max(
            20,
            num(
                $("webWidth"),
                330
            )
        );


    const repeat =
        Math.max(
            1,
            num(
                $("repeat"),
                height
            )
        );


    const waste =
        Math.max(
            0,
            num(
                $("waste"),
                8
            )
        );


    const colors =
        Math.max(
            1,
            num(
                $("colors"),
                4
            )
        );


    const repeats =
        Math.ceil(
            quantity /
            streams
        );


    const meters =
        repeats *
        repeat /
        1000 *
        (
            1 +
            waste /
            100
        );


    const area =
        webWidth /
        1000 *
        meters;


    const density = {
        pp:0.91,
        pe:0.93,
        pet:1.39,
        paper:0.72,
        adhesive:0.78
    };


    const thickness = {
        pp:45,
        pe:50,
        pet:12,
        paper:60,
        adhesive:80
    };


    const material =
        $("material").value;


    const materialKg =
        area *
        (
            density[material] || 0.8
        ) *
        (
            thickness[material] || 60
        ) /
        1000;


    const inkKg =
        area *
        colors *
        0.0016;


    const speed =
        Math.max(
            35,
            85 -
            colors *
            3
        );


    const hours =
        (
            25 +
            colors *
            4 +
            meters /
            speed *
            60
        ) /
        60;


    const materialCost =
        materialKg *
        175;


    const inkCost =
        inkKg *
        850;


    const printCost =
        2300 +
        hours *
        3500;


    let extras =
        0;


    if (
        $("lamination").checked
    ) {

        extras +=
            area *
            19 +
            850;

    }


    if (
        $("dieCut").checked
    ) {

        extras +=
            1800 +
            quantity *
            0.028;

    }


    const totalCost =
        materialCost +
        inkCost +
        printCost +
        extras;


    let markup =
        0.33;


    if (
        quantity < 3000
    ) {

        markup =
            0.55;

    }
    else if (
        quantity < 10000
    ) {

        markup =
            0.45;

    }
    else if (
        quantity < 30000
    ) {

        markup =
            0.38;

    }


    let clientPrice =
        totalCost *
        (
            1 +
            markup
        );


    clientPrice =
        Math.max(
            clientPrice,
            6500
        );


    clientPrice =
        Math.ceil(
            clientPrice /
            100
        ) *
        100;


    $("resultPieces").textContent =
        fmt(
            quantity,
            0
        );


    $("resultMeters").textContent =
        fmt(
            meters,
            1
        ) +
        " м";


    $("resultMaterial").textContent =
        fmt(
            materialKg,
            2
        ) +
        " кг";


    $("resultTime").textContent =
        fmt(
            hours,
            1
        ) +
        " ч";


    $("costMaterial").textContent =
        rub(
            materialCost
        );


    $("costInk").textContent =
        rub(
            inkCost
        );


    $("costPrint").textContent =
        rub(
            printCost
        );


    $("costExtras").textContent =
        rub(
            extras
        );


    $("costTotal").textContent =
        rub(
            totalCost
        );


    $("clientPrice").textContent =
        rub(
            clientPrice
        );


    $("finalPrice").textContent =
        rub(
            clientPrice
        );


    if (
        streams *
        width >
        webWidth
    ) {

        $("managerTip").textContent =
            "Проверьте: выбранное количество " +
            "ручьёв не помещается в рабочую ширину.";

    }
    else {

        $("managerTip").textContent =
            "Для предварительной цены " +
            "основных параметров достаточно. " +
            "При необходимости используйте детальный расчёт.";

    }


    window.currentQuickCalculation = {

        mode:
            "quick",

        date:
            new Date().toISOString(),

        quantity,

        width,

        height,

        streams,

        material,

        webWidth,

        repeat,

        waste,

        colors,

        lamination:
            $("lamination").checked,

        dieCut:
            $("dieCut").checked,

        meters,

        materialKg,

        inkKg,

        hours,

        materialCost,

        inkCost,

        printCost,

        extras,

        totalCost,

        clientPrice

    };


    return window.currentQuickCalculation;

}


/* AUTO */

[
    "quantity",
    "width",
    "height",
    "streams",
    "material",
    "webWidth",
    "repeat",
    "waste",
    "colors",
    "lamination",
    "dieCut"
].forEach(
    id => {

        const element =
            $(id);


        if (!element)
            return;


        element.addEventListener(
            "input",
            calculateQuick
        );


        element.addEventListener(
            "change",
            calculateQuick
        );

    }
);


/* WASTE */

$("waste").addEventListener(
    "input",
    () => {

        $("wasteValue").textContent =
            $("waste").value +
            "%";

    }
);


/* CALCULATE */

$("calculateBtn")
    .addEventListener(
        "click",
        calculateQuick
    );


/* SAVE */

$("saveBtn")
    .addEventListener(
        "click",
        async () => {

            const item =
                window.currentQuickCalculation ||
                calculateQuick();


            saveHistory(
                item
            );


            if (
                supabaseClient
            ) {

                try {

                    const result =
                        await supabaseClient
                            .auth
                            .getUser();


                    const user =
                        result?.data?.user;


                    if (user) {

                        await supabaseClient
                            .from(
                                "calculations"
                            )
                            .insert({
                                user_id:
                                    user.id,

                                calculation_data:
                                    item
                            });

                    }

                }
                catch (error) {

                    console.warn(
                        error
                    );

                }

            }


            alert(
                "Расчёт сохранён."
            );

        }
    );


/* COPY */

$("copyBtn")
    .addEventListener(
        "click",
        async () => {

            const item =
                window.currentQuickCalculation ||
                calculateQuick();


            const text = [

                "PRINTCALC FLEXO",

                "БЫСТРЫЙ РАСЧЁТ",

                "",

                "Тираж: " +
                fmt(
                    item.quantity,
                    0
                ) +
                " шт.",

                "Размер: " +
                item.width +
                " × " +
                item.height +
                " мм",

                "Ручьи: " +
                item.streams,

                "Материал: " +
                item.material,

                "Метраж: " +
                fmt(
                    item.meters,
                    1
                ) +
                " м",

                "Себестоимость: " +
                rub(
                    item.totalCost
                ),

                "Цена клиенту: " +
                rub(
                    item.clientPrice
                ),

                "",

                "Created by Sergey Pavlov"

            ].join("\\n");


            try {

                await navigator.clipboard
                    .writeText(
                        text
                    );


                $("copyBtn").textContent =
                    "Скопировано ✓";


                setTimeout(
                    () => {

                        $("copyBtn").textContent =
                            "Скопировать";

                    },
                    1200
                );

            }
            catch {

                alert(
                    text
                );

            }

        }
    );


/* HISTORY */

$("clearHistoryBtn")
    .addEventListener(
        "click",
        () => {

            if (
                confirm(
                    "Удалить историю?"
                )
            ) {

                localStorage.removeItem(
                    HISTORY_KEY
                );

                renderHistory();

            }

        }
    );


/* ACCOUNT */

$("accountBtn")
    .addEventListener(
        "click",
        async () => {

            $("accountModal")
                .classList
                .add("open");


            if (!supabaseClient) {

                $("accountStatus").innerHTML =
                    "<p>Локальный режим.</p>";

                $("logoutBtn")
                    .style
                    .display = "none";

                return;

            }


            try {

                const result =
                    await supabaseClient
                        .auth
                        .getUser();


                const user =
                    result?.data?.user;


                if (user) {

                    $("accountStatus").innerHTML =
                        "<p>Вы вошли как " +
                        "<strong>" +
                        user.email +
                        "</strong>.</p>";


                    $("logoutBtn")
                        .style
                        .display = "block";

                }
                else {

                    $("accountStatus").innerHTML =
                        "<p>Пользователь не авторизован.</p>";


                    $("logoutBtn")
                        .style
                        .display = "none";

                }

            }
            catch (error) {

                console.warn(
                    error
                );

            }

        }
    );


/* MODAL */

document
    .querySelectorAll(
        "[data-close]"
    )
    .forEach(
        button => {

            button.addEventListener(
                "click",
                () => {

                    $("accountModal")
                        .classList
                        .remove("open");

                }
            );

        }
    );


$("accountModal")
    .addEventListener(
        "click",
        event => {

            if (
                event.target ===
                $("accountModal")
            ) {

                $("accountModal")
                    .classList
                    .remove("open");

            }

        }
    );


/* LOGOUT */

$("logoutBtn")
    .addEventListener(
        "click",
        async () => {

            if (
                !supabaseClient
            )
                return;


            try {

                await supabaseClient
                    .auth
                    .signOut();


                alert(
                    "Вы вышли из аккаунта."
                );

            }
            catch (error) {

                console.warn(
                    error
                );

            }

        }
    );


/* INIT */

$("wasteValue").textContent =
    $("waste").value +
    "%";


calculateQuick();

renderHistory();
