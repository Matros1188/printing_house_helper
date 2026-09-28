
/* ============================================================
   PRINTCALC FLEXO V4
   Основная логика менеджерского калькулятора
   ============================================================ */

"use strict";

const SUPABASE_URL = "";
const SUPABASE_KEY = "";

let supabaseClient = null;

if (
    SUPABASE_URL &&
    SUPABASE_KEY &&
    SUPABASE_URL !== "__SUPABASE_URL__" &&
    SUPABASE_KEY !== "__SUPABASE_KEY__" &&
    typeof window.supabase !== "undefined"
) {
    try {
        supabaseClient = window.supabase.createClient(
            SUPABASE_URL,
            SUPABASE_KEY
        );
        console.log("✅ Supabase подключён.");
    } catch (error) {
        console.warn(
            "Supabase не удалось инициализировать:",
            error
        );
    }
}

/* ------------------------------------------------------------
   DOM
------------------------------------------------------------ */

const $ = (id) => document.getElementById(id);

const quantityInput = $("quantity");
const widthInput = $("width");
const heightInput = $("height");
const streamsInput = $("streams");
const materialInput = $("material");
const webWidthInput = $("webWidth");
const repeatInput = $("repeat");
const wasteInput = $("waste");
const colorsInput = $("colors");
const laminationInput = $("lamination");
const dieCutInput = $("dieCut");
const priceMaterialInput = $("priceMaterial");
const priceInkInput = $("priceInk");

const resultPrice = $("resultPrice");
const resultPieces = $("resultPieces");
const resultMeters = $("resultMeters");
const resultMaterial = $("resultMaterial");
const resultTime = $("resultTime");

const costMaterial = $("costMaterial");
const costInk = $("costInk");
const costPrint = $("costPrint");
const costLam = $("costLam");
const costDie = $("costDie");
const costTotal = $("costTotal");
const markupResult = $("markupResult");
const clientPrice = $("clientPrice");

const wasteValue = $("wasteValue");
const managerTipText = $("managerTipText");

const historyList = $("historyList");
const fullHistoryList = $("fullHistoryList");

const accountModal = $("accountModal");
const historyModal = $("historyModal");
const accountStatus = $("accountStatus");

/* ------------------------------------------------------------
   УТИЛИТЫ
------------------------------------------------------------ */

function numberValue(input, fallback = 0) {
    const value = Number(input?.value);

    return Number.isFinite(value)
        ? value
        : fallback;
}

function clamp(value, min, max) {
    return Math.min(
        Math.max(value, min),
        max
    );
}

function round(value, digits = 2) {
    const multiplier = Math.pow(10, digits);

    return Math.round(
        value * multiplier
    ) / multiplier;
}

function formatNumber(value, digits = 0) {
    return Number(value || 0).toLocaleString(
        "ru-RU",
        {
            minimumFractionDigits: digits,
            maximumFractionDigits: digits
        }
    );
}

function rub(value) {
    return `${formatNumber(value, 0)} ₽`;
}

function saveLocalHistory(item) {
    const key = "printcalc_flexo_history";

    const existing = JSON.parse(
        localStorage.getItem(key) || "[]"
    );

    existing.unshift(item);

    const limited = existing.slice(0, 30);

    localStorage.setItem(
        key,
        JSON.stringify(limited)
    );

    renderHistory();
}

function getLocalHistory() {
    try {
        return JSON.parse(
            localStorage.getItem(
                "printcalc_flexo_history"
            ) || "[]"
        );
    } catch {
        return [];
    }
}

/* ------------------------------------------------------------
   ПРЕСЕТЫ
------------------------------------------------------------ */

const PRESETS = {
    label: {
        quantity: 10000,
        width: 100,
        height: 70,
        streams: 2,
        material: "adhesive",
        webWidth: 330,
        repeat: 70,
        waste: 8,
        colors: 4,
        lamination: false,
        dieCut: true
    },

    film: {
        quantity: 25000,
        width: 120,
        height: 80,
        streams: 2,
        material: "pp",
        webWidth: 330,
        repeat: 80,
        waste: 7,
        colors: 6,
        lamination: true,
        dieCut: false
    },

    package: {
        quantity: 15000,
        width: 180,
        height: 250,
        streams: 1,
        material: "pe",
        webWidth: 330,
        repeat: 250,
        waste: 9,
        colors: 6,
        lamination: true,
        dieCut: false
    }
};

function applyPreset(name) {

    const preset = PRESETS[name];

    if (!preset) return;

    quantityInput.value = preset.quantity;
    widthInput.value = preset.width;
    heightInput.value = preset.height;
    streamsInput.value = preset.streams;
    materialInput.value = preset.material;
    webWidthInput.value = preset.webWidth;
    repeatInput.value = preset.repeat;
    wasteInput.value = preset.waste;
    colorsInput.value = preset.colors;
    laminationInput.checked = preset.lamination;
    dieCutInput.checked = preset.dieCut;

    updateWasteLabel();
    calculate();
}

/* ------------------------------------------------------------
   РАСЧЁТ
------------------------------------------------------------ */

function calculate() {

    const quantity = Math.max(
        1,
        numberValue(quantityInput, 1)
    );

    const width = Math.max(
        1,
        numberValue(widthInput, 1)
    );

    const height = Math.max(
        1,
        numberValue(heightInput, 1)
    );

    const streams = Math.max(
        1,
        numberValue(streamsInput, 1)
    );

    const webWidth = Math.max(
        20,
        numberValue(webWidthInput, 330)
    );

    const repeat = Math.max(
        1,
        numberValue(repeatInput, height)
    );

    const waste = clamp(
        numberValue(wasteInput, 8),
        0,
        20
    );

    const colors = clamp(
        numberValue(colorsInput, 4),
        1,
        8
    );

    const materialPrice = Math.max(
        0,
        numberValue(priceMaterialInput, 175)
    );

    const inkPrice = Math.max(
        0,
        numberValue(priceInkInput, 850)
    );

    /*
       ---------------------------------------------------------
       1. РУЧЬИ
       ---------------------------------------------------------

       Если менеджер указал больше одного ручья,
       получаем количество изделий за один продольный повтор.

       Это не попытка заменить технологический расчёт,
       а удобная предварительная оценка.
    */

    const piecesPerRepeat = streams;

    const repeatsRequired = Math.ceil(
        quantity / piecesPerRepeat
    );

    /*
       ---------------------------------------------------------
       2. МЕТРАЖ
       ---------------------------------------------------------
    */

    const baseMeters =
        (repeatsRequired * repeat) / 1000;

    const metersWithWaste =
        baseMeters *
        (1 + waste / 100);

    /*
       ---------------------------------------------------------
       3. ПЛОЩАДЬ ПОЛОТНА
       ---------------------------------------------------------
    */

    const webAreaM2 =
        (webWidth / 1000) *
        metersWithWaste;

    /*
       ---------------------------------------------------------
       4. ПРИБЛИЗИТЕЛЬНАЯ МАССА МАТЕРИАЛА
       ---------------------------------------------------------
    */

    const densities = {
        pp: 0.91,
        pe: 0.93,
        pet: 1.39,
        paper: 0.72,
        adhesive: 0.78,
        other: 0.80
    };

    const thickness = {
        pp: 0.045,
        pe: 0.050,
        pet: 0.012,
        paper: 0.060,
        adhesive: 0.080,
        other: 0.060
    };

    const materialType = materialInput.value;

    const density =
        densities[materialType] || 0.80;

    const thicknessMicron =
        thickness[materialType] || 0.06;

    /*
       Для предварительного менеджерского расчёта
       применяем приближённую модель массы.
    */

    const materialKg =
        webAreaM2 *
        density *
        (thicknessMicron * 1000) /
        1000;

    /*
       ---------------------------------------------------------
       5. КРАСКА
       ---------------------------------------------------------
    */

    const inkKg =
        webAreaM2 *
        colors *
        0.0016;

    /*
       ---------------------------------------------------------
       6. ПЕЧАТЬ
       ---------------------------------------------------------
    */

    const setupMinutes =
        25 +
        colors * 4 +
        (streams > 4 ? 10 : 0);

    const printSpeed =
        Math.max(
            35,
            85 - colors * 3
        );

    const runMinutes =
        metersWithWaste /
        printSpeed *
        60;

    const printHours =
        (setupMinutes + runMinutes) / 60;

    /*
       ---------------------------------------------------------
       7. ЛАМИНАЦИЯ
       ---------------------------------------------------------
    */

    let laminationCost = 0;

    if (laminationInput.checked) {
        laminationCost =
            webAreaM2 * 19 +
            850;
    }

    /*
       ---------------------------------------------------------
       8. ВЫРУБКА / РЕЗКА
       ---------------------------------------------------------
    */

    let dieCost = 0;

    if (dieCutInput.checked) {
        dieCost =
            1800 +
            quantity * 0.028;
    }

    /*
       ---------------------------------------------------------
       9. СЕБЕСТОИМОСТЬ
       ---------------------------------------------------------
    */

    const materialCost =
        materialKg * materialPrice;

    const inkCost =
        inkKg * inkPrice;

    const printCost =
        2300 +
        printHours * 3500;

    const totalCost =
        materialCost +
        inkCost +
        printCost +
        laminationCost +
        dieCost;

    /*
       ---------------------------------------------------------
       10. МАРЖА
       ---------------------------------------------------------

       Коэффициент выбираем динамически,
       чтобы маленькие заказы не теряли экономику,
       а крупные не становились чрезмерно дорогими.
    */

    let markupRate = 0.33;

    if (quantity < 5000) {
        markupRate = 0.52;
    } else if (quantity < 15000) {
        markupRate = 0.43;
    } else if (quantity < 50000) {
        markupRate = 0.36;
    } else {
        markupRate = 0.30;
    }

    const markup =
        totalCost * markupRate;

    let clientTotal =
        totalCost + markup;

    /*
       Минимальная сумма заказа.
    */

    clientTotal =
        Math.max(
            clientTotal,
            6500
        );

    /*
       Округление до удобного коммерческого значения.
    */

    clientTotal =
        Math.ceil(
            clientTotal / 100
        ) * 100;

    /*
       ---------------------------------------------------------
       11. ОБНОВЛЯЕМ UI
       ---------------------------------------------------------
    */

    resultPrice.textContent = rub(clientTotal);

    resultPieces.textContent =
        formatNumber(quantity);

    resultMeters.textContent =
        `${formatNumber(metersWithWaste, 1)} м`;

    resultMaterial.textContent =
        `${formatNumber(materialKg, 2)} кг`;

    resultTime.textContent =
        `${formatNumber(printHours, 1)} ч`;

    costMaterial.textContent =
        rub(materialCost);

    costInk.textContent =
        rub(inkCost);

    costPrint.textContent =
        rub(printCost);

    costLam.textContent =
        rub(laminationCost);

    costDie.textContent =
        rub(dieCost);

    costTotal.textContent =
        rub(totalCost);

    markupResult.textContent =
        rub(markup);

    clientPrice.textContent =
        rub(clientTotal);

    /*
       ---------------------------------------------------------
       12. ПОДСКАЗКА МЕНЕДЖЕРУ
       ---------------------------------------------------------
    */

    const warnings = [];

    if (streams > 1 && webWidth < streams * width) {
        warnings.push(
            "проверьте, помещается ли выбранное количество ручьёв"
        );
    }

    if (waste < 5) {
        warnings.push(
            "запас ниже типового предварительного уровня"
        );
    }

    if (quantity < 3000) {
        warnings.push(
            "для малого тиража доля переналадки выше"
        );
    }

    if (warnings.length) {
        managerTipText.textContent =
            "Обратите внимание: " +
            warnings.join("; ") +
            ".";
    } else {
        managerTipText.textContent =
            "Расчёт выглядит нормально для предварительного "
            + "коммерческого предложения. Перед запуском в производство "
            + "проверьте утверждённую спецификацию.";
    }

    const result = {
        id: Date.now(),
        date: new Date().toISOString(),

        quantity,
        width,
        height,
        streams,
        material: materialType,
        webWidth,
        repeat,
        waste,
        colors,
        lamination: laminationInput.checked,
        dieCut: dieCutInput.checked,

        meters: metersWithWaste,
        materialKg,
        inkKg,
        printHours,

        materialCost,
        inkCost,
        printCost,
        laminationCost,
        dieCost,

        totalCost,
        markup,
        clientTotal
    };

    window.currentCalculation = result;

    return result;
}

/* ------------------------------------------------------------
   LABEL
------------------------------------------------------------ */

function updateWasteLabel() {
    wasteValue.textContent =
        `${wasteInput.value}%`;
}

wasteInput.addEventListener(
    "input",
    updateWasteLabel
);

/* ------------------------------------------------------------
   АВТОПЕРЕСЧЁТ
------------------------------------------------------------ */

[
    quantityInput,
    widthInput,
    heightInput,
    streamsInput,
    materialInput,
    webWidthInput,
    repeatInput,
    wasteInput,
    colorsInput,
    laminationInput,
    dieCutInput,
    priceMaterialInput,
    priceInkInput
].forEach((element) => {

    element.addEventListener(
        "input",
        calculate
    );

    element.addEventListener(
        "change",
        calculate
    );
});

/* ------------------------------------------------------------
   КНОПКА РАСЧЁТА
------------------------------------------------------------ */

$("calculateBtn").addEventListener(
    "click",
    () => {
        calculate();

        document
            .querySelector(".result-card")
            ?.scrollIntoView({
                behavior: "smooth",
                block: "nearest"
            });
    }
);

/* ------------------------------------------------------------
   PRESETS
------------------------------------------------------------ */

document
    .querySelectorAll(".preset-card")
    .forEach((button) => {

        button.addEventListener(
            "click",
            () => {
                applyPreset(
                    button.dataset.preset
                );
            }
        );

    });

/* ------------------------------------------------------------
   СОХРАНЕНИЕ
------------------------------------------------------------ */

$("saveBtn").addEventListener(
    "click",
    async () => {

        const calculation =
            window.currentCalculation || calculate();

        saveLocalHistory(calculation);

        /*
           Пытаемся сохранить в Supabase,
           если подключение и таблица доступны.
        */

        if (supabaseClient) {

            try {

                const {
                    data: {
                        user
                    }
                } = await supabaseClient.auth.getUser();

                if (user) {

                    await supabaseClient
                        .from("calculations")
                        .insert({
                            user_id: user.id,
                            calculation_data: calculation
                        });

                }

            } catch (error) {

                console.warn(
                    "Облачное сохранение недоступно:",
                    error
                );

            }

        }

        alert(
            "Расчёт сохранён."
        );

        renderHistory();
    }
);

/* ------------------------------------------------------------
   COPY
------------------------------------------------------------ */

$("copyBtn").addEventListener(
    "click",
    async () => {

        const calculation =
            window.currentCalculation || calculate();

        const text = [
            "PRINTCALC FLEXO",
            "",
            `Тираж: ${formatNumber(calculation.quantity)} шт.`,
            `Размер: ${calculation.width} × ${calculation.height} мм`,
            `Ручьи: ${calculation.streams}`,
            `Материал: ${calculation.material}`,
            `Метраж: ${formatNumber(calculation.meters, 1)} м`,
            `Материал: ${formatNumber(calculation.materialKg, 2)} кг`,
            `Красочность: ${calculation.colors}+0`,
            "",
            `Себестоимость: ${rub(calculation.totalCost)}`,
            `Цена клиенту: ${rub(calculation.clientTotal)}`
        ].join("\n");

        try {

            await navigator.clipboard.writeText(
                text
            );

            $("copyBtn").textContent =
                "Скопировано ✓";

            setTimeout(
                () => {
                    $("copyBtn").textContent =
                        "Скопировать расчёт";
                },
                1500
            );

        } catch {

            alert(text);

        }

    }
);

/* ------------------------------------------------------------
   ИСТОРИЯ
------------------------------------------------------------ */

function renderHistory() {

    const items =
        getLocalHistory();

    if (!items.length) {

        historyList.innerHTML =
            `<div class="empty-history">
                Сохранённых расчётов пока нет.
            </div>`;

        fullHistoryList.innerHTML =
            `<div class="empty-history">
                Сохранённых расчётов пока нет.
            </div>`;

        return;
    }

    historyList.innerHTML =
        items.slice(0, 5)
        .map(renderHistoryItem)
        .join("");

    fullHistoryList.innerHTML =
        items
        .map(renderHistoryItem)
        .join("");
}

function renderHistoryItem(item) {

    const date =
        new Date(item.date);

    const dateText =
        date.toLocaleString(
            "ru-RU",
            {
                day: "2-digit",
                month: "2-digit",
                hour: "2-digit",
                minute: "2-digit"
            }
        );

    return `
        <div class="history-item">

            <div>

                <div class="history-item-title">
                    ${formatNumber(item.quantity)} шт.
                    · ${item.streams} ручья
                </div>

                <div class="history-item-sub">
                    ${item.width}×${item.height} мм
                    · ${formatNumber(item.meters, 1)} м
                    · ${dateText}
                </div>

            </div>

            <div class="history-item-price">
                ${rub(item.clientTotal)}
            </div>

        </div>
    `;
}

/* ------------------------------------------------------------
   МОДАЛКИ
------------------------------------------------------------ */

function openModal(element) {
    element.classList.add("open");
}

function closeModal(element) {
    element.classList.remove("open");
}

$("historyBtn").addEventListener(
    "click",
    () => {
        renderHistory();
        openModal(historyModal);
    }
);

$("accountBtn").addEventListener(
    "click",
    async () => {
        await updateAccountStatus();
        openModal(accountModal);
    }
);

document
    .querySelectorAll("[data-close]")
    .forEach((button) => {

        button.addEventListener(
            "click",
            () => {
                const target =
                    $(button.dataset.close);

                if (target) {
                    closeModal(target);
                }
            }
        );

    });

document
    .querySelectorAll(".modal")
    .forEach((modal) => {

        modal.addEventListener(
            "click",
            (event) => {
                if (event.target === modal) {
                    closeModal(modal);
                }
            }
        );

    });

/* ------------------------------------------------------------
   АККАУНТ
------------------------------------------------------------ */

async function updateAccountStatus() {

    if (!supabaseClient) {

        accountStatus.innerHTML =
            "<p>Локальный режим. Supabase-конфигурация "
            + "в текущей версии не определена.</p>";

        return;
    }

    try {

        const {
            data: {
                user
            }
        } = await supabaseClient.auth.getUser();

        if (user) {

            accountStatus.innerHTML =
                `<p>
                    Вы вошли как
                    <strong>${user.email}</strong>.
                </p>`;

            $("logoutBtn").style.display =
                "block";

        } else {

            accountStatus.innerHTML =
                "<p>Пользователь не авторизован.</p>";

            $("logoutBtn").style.display =
                "none";
        }

    } catch (error) {

        accountStatus.innerHTML =
            "<p>Не удалось получить статус аккаунта.</p>";

        console.warn(error);
    }
}

$("logoutBtn").addEventListener(
    "click",
    async () => {

        if (!supabaseClient) {
            return;
        }

        try {
            await supabaseClient.auth.signOut();
            await updateAccountStatus();

            alert(
                "Вы вышли из аккаунта."
            );

        } catch (error) {

            console.error(error);

            alert(
                "Не удалось выполнить выход."
            );

        }

    }
);

/* ------------------------------------------------------------
   INIT
------------------------------------------------------------ */

updateWasteLabel();

calculate();

renderHistory();

updateAccountStatus();

console.log(
    "PRINTCALC FLEXO V4 loaded successfully."
);

