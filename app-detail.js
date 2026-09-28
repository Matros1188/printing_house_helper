
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

        console.warn(
            error
        );

    }

}


const $ =
    id =>
    document.getElementById(id);


function numberValue(
    id,
    fallback
) {

    const value =
        Number(
            $(id)?.value
        );


    if (
        Number.isFinite(value)
    ) {

        return value;

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


function calculateDetail() {


    const quantity =
        Math.max(
            1,
            numberValue(
                "dQuantity",
                10000
            )
        );


    const streams =
        Math.max(
            1,
            numberValue(
                "dStreams",
                2
            )
        );


    const width =
        Math.max(
            1,
            numberValue(
                "dWidth",
                100
            )
        );


    const height =
        Math.max(
            1,
            numberValue(
                "dHeight",
                70
            )
        );


    const repeat =
        Math.max(
            1,
            numberValue(
                "dRepeat",
                70
            )
        );


    const webWidth =
        Math.max(
            20,
            numberValue(
                "dWebWidth",
                330
            )
        );


    const grammage =
        Math.max(
            1,
            numberValue(
                "dGrammage",
                80
            )
        );


    const materialPrice =
        Math.max(
            0,
            numberValue(
                "dMaterialPrice",
                175
            )
        );


    const waste =
        Math.max(
            0,
            numberValue(
                "dWaste",
                8
            )
        );


    const colors =
        Math.max(
            1,
            numberValue(
                "dColors",
                4
            )
        );


    const speed =
        Math.max(
            1,
            numberValue(
                "dSpeed",
                70
            )
        );


    const setup =
        Math.max(
            0,
            numberValue(
                "dSetup",
                45
            )
        );


    const inkConsumption =
        Math.max(
            0,
            numberValue(
                "dInkConsumption",
                1.6
            )
        );


    const inkPrice =
        Math.max(
            0,
            numberValue(
                "dInkPrice",
                850
            )
        );


    const machineRate =
        Math.max(
            0,
            numberValue(
                "dMachineRate",
                3500
            )
        );


    const laborRate =
        Math.max(
            0,
            numberValue(
                "dLaborRate",
                1200
            )
        );


    const overheadPct =
        Math.max(
            0,
            numberValue(
                "dOverhead",
                12
            )
        );


    const adminPct =
        Math.max(
            0,
            numberValue(
                "dAdmin",
                5
            )
        );


    const markupPct =
        Math.max(
            0,
            numberValue(
                "dMarkup",
                35
            )
        );


    const lamArea =
        Math.max(
            0,
            numberValue(
                "dLamArea",
                19
            )
        );


    const lamSetup =
        Math.max(
            0,
            numberValue(
                "dLamSetup",
                850
            )
        );


    const dieSetup =
        Math.max(
            0,
            numberValue(
                "dDieSetup",
                1800
            )
        );


    const diePiece =
        Math.max(
            0,
            numberValue(
                "dDiePiece",
                0.028
            )
        );


    const slitting =
        Math.max(
            0,
            numberValue(
                "dSlitting",
                900
            )
        );


    const minOrder =
        Math.max(
            0,
            numberValue(
                "dMinOrder",
                6500
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


    const materialKg =
        area *
        grammage /
        1000;


    const materialCost =
        materialKg *
        materialPrice;


    const inkKg =
        area *
        inkConsumption *
        colors /
        1000;


    const inkCost =
        inkKg *
        inkPrice;


    const runMinutes =
        meters /
        speed *
        60;


    const machineHours =
        (
            setup +
            runMinutes
        ) /
        60;


    const machineCost =
        machineHours *
        machineRate;


    const laborCost =
        machineHours *
        laborRate;


    let lamCost =
        0;


    if (
        $("dUseLam").checked
    ) {

        lamCost =
            area *
            lamArea +
            lamSetup;

    }


    let dieCost =
        0;


    if (
        $("dUseDie").checked
    ) {

        dieCost =
            dieSetup +
            quantity *
            diePiece;

    }


    let slitCost =
        0;


    if (
        $("dUseSlitting").checked
    ) {

        slitCost =
            slitting;

    }


    const directCost =
        materialCost +
        inkCost +
        machineCost +
        laborCost +
        lamCost +
        dieCost +
        slitCost;


    const overhead =
        (
            machineCost +
            laborCost
        ) *
        overheadPct /
        100;


    const admin =
        directCost *
        adminPct /
        100;


    const totalCost =
        directCost +
        overhead +
        admin;


    let clientPrice =
        totalCost *
        (
            1 +
            markupPct /
            100
        );


    clientPrice =
        Math.max(
            clientPrice,
            minOrder
        );


    clientPrice =
        Math.ceil(
            clientPrice /
            100
        ) *
        100;


    const markup =
        clientPrice -
        totalCost;


    $("dMeters").textContent =
        fmt(
            meters,
            1
        ) +
        " м";


    $("dMaterialKg").textContent =
        fmt(
            materialKg,
            2
        ) +
        " кг";


    $("dInkKg").textContent =
        fmt(
            inkKg,
            2
        ) +
        " кг";


    $("dHours").textContent =
        fmt(
            machineHours,
            1
        ) +
        " ч";


    $("cMaterial").textContent =
        rub(
            materialCost
        );


    $("cInk").textContent =
        rub(
            inkCost
        );


    $("cMachine").textContent =
        rub(
            machineCost
        );


    $("cLabor").textContent =
        rub(
            laborCost
        );


    $("cOverhead").textContent =
        rub(
            overhead
        );


    $("cAdmin").textContent =
        rub(
            admin
        );


    $("cLam").textContent =
        rub(
            lamCost
        );


    $("cDie").textContent =
        rub(
            dieCost
        );


    $("cSlit").textContent =
        rub(
            slitCost
        );


    $("cTotal").textContent =
        rub(
            totalCost
        );


    $("cMarkup").textContent =
        rub(
            markup
        );


    $("dClientPrice").textContent =
        rub(
            clientPrice
        );


    $("dFinalPrice").textContent =
        rub(
            clientPrice
        );


    const warnings = [];


    if (
        streams *
        width >
        webWidth
    ) {

        warnings.push(
            "ширина по ручьям больше рабочей ширины"
        );

    }


    if (
        repeat <
        height
    ) {

        warnings.push(
            "Repeat меньше высоты изделия"
        );

    }


    if (
        waste <
        3
    ) {

        warnings.push(
            "очень низкий запас"
        );

    }


    if (
        warnings.length
    ) {

        $("warning").textContent =
            "Проверка: " +
            warnings.join(
                "; "
            ) +
            ".";

    }
    else {

        $("warning").textContent =
            "Проверка: критичных предупреждений нет.";

    }


    window.currentDetailCalculation = {

        mode:
            "detail",

        date:
            new Date().toISOString(),

        quantity,

        streams,

        width,

        height,

        repeat,

        webWidth,

        material:
            $("dMaterial").value,

        grammage,

        materialPrice,

        waste,

        colors,

        speed,

        setup,

        inkConsumption,

        inkPrice,

        machineRate,

        laborRate,

        overheadPct,

        adminPct,

        markupPct,

        meters,

        area,

        materialKg,

        inkKg,

        machineHours,

        materialCost,

        inkCost,

        machineCost,

        laborCost,

        overhead,

        admin,

        lamCost,

        dieCost,

        slitCost,

        totalCost,

        markup,

        clientPrice

    };


    return window.currentDetailCalculation;

}


/* EVENTS */

[
    "dQuantity",
    "dStreams",
    "dWidth",
    "dHeight",
    "dRepeat",
    "dWebWidth",
    "dMaterial",
    "dGrammage",
    "dMaterialPrice",
    "dWaste",
    "dColors",
    "dSpeed",
    "dSetup",
    "dInkConsumption",
    "dInkPrice",
    "dMachineRate",
    "dLaborRate",
    "dOverhead",
    "dAdmin",
    "dMarkup",
    "dLamArea",
    "dLamSetup",
    "dDieSetup",
    "dDiePiece",
    "dSlitting",
    "dMinOrder",
    "dUseLam",
    "dUseDie",
    "dUseSlitting"
].forEach(
    id => {

        const element =
            $(id);


        if (!element)
            return;


        element.addEventListener(
            "input",
            calculateDetail
        );


        element.addEventListener(
            "change",
            calculateDetail
        );

    }
);


/* CALCULATE */

$("detailCalculateBtn")
    .addEventListener(
        "click",
        calculateDetail
    );


/* RESET */

$("resetBtn")
    .addEventListener(
        "click",
        () => {

            location.reload();

        }
    );


/* SAVE */

$("dSaveBtn")
    .addEventListener(
        "click",
        async () => {

            const item =
                window.currentDetailCalculation ||
                calculateDetail();


            const key =
                "printcalc_flexo_history";


            let history = [];


            try {

                history =
                    JSON.parse(
                        localStorage.getItem(
                            key
                        ) ||
                        "[]"
                    );

            }
            catch {

                history = [];

            }


            history.unshift(
                item
            );


            localStorage.setItem(
                key,
                JSON.stringify(
                    history.slice(
                        0,
                        30
                    )
                )
            );


            if (
                supabaseClient
            ) {

                try {

                    const response =
                        await supabaseClient
                            .auth
                            .getUser();


                    const user =
                        response?.data?.user;


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
                "Детальный расчёт сохранён."
            );

        }
    );


/* COPY */

$("dCopyBtn")
    .addEventListener(
        "click",
        async () => {

            const item =
                window.currentDetailCalculation ||
                calculateDetail();


            const text = [

                "PRINTCALC FLEXO",

                "ДЕТАЛЬНЫЙ РАСЧЁТ",

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

                "Метраж: " +
                fmt(
                    item.meters,
                    1
                ) +
                " м",

                "Материал: " +
                fmt(
                    item.materialKg,
                    2
                ) +
                " кг",

                "Краска: " +
                fmt(
                    item.inkKg,
                    2
                ) +
                " кг",

                "",

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


                $("dCopyBtn").textContent =
                    "Скопировано ✓";


                setTimeout(
                    () => {

                        $("dCopyBtn").textContent =
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

                const response =
                    await supabaseClient
                        .auth
                        .getUser();


                const user =
                    response?.data?.user;


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

calculateDetail();
