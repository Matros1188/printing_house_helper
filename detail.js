"use strict";

const $ = id => document.getElementById(id);

const num = id => {
  const v = Number($(id).value);
  return Number.isFinite(v) ? v : 0;
};

const rub = v =>
  Math.round(v).toLocaleString("ru-RU") + " ₽";

function calculate() {

  const qty = Math.max(1, num("qty"));
  const streams = Math.max(1, num("streams"));
  const width = Math.max(1, num("width"));
  const web = Math.max(width, num("web"));
  const repeat = Math.max(1, num("repeat"));
  const gsm = Math.max(1, num("gsm"));
  const waste = Math.max(0, num("waste"));

  const matPrice = Math.max(0, num("matPrice"));
  const colors = Math.max(1, num("colors"));
  const inkPrice = Math.max(0, num("inkPrice"));
  const inkUse = Math.max(0, num("inkUse"));

  const speed = Math.max(1, num("speed"));
  const setup = Math.max(0, num("setup"));
  const machine = Math.max(0, num("machine"));
  const labor = Math.max(0, num("labor"));

  const lamRate = Math.max(0, num("lam"));
  const dieRate = Math.max(0, num("die"));

  const overheadRate = Math.max(0, num("overhead"));
  const adminRate = Math.max(0, num("admin"));
  const markupRate = Math.max(0, num("markup"));
  const minimum = Math.max(0, num("minimum"));

  const repeats = Math.ceil(qty / streams);
  const meters = repeats * repeat / 1000 * (1 + waste / 100);
  const area = meters * web / 1000;

  const materialKg = area * gsm / 1000;
  const inkKg = area * colors * inkUse / 1000;

  const materialCost = materialKg * matPrice;
  const inkCost = inkKg * inkPrice;

  const printMinutes = meters / speed;
  const totalMinutes = setup + printMinutes;

  const machineCost = totalMinutes / 60 * machine;
  const laborCost = totalMinutes / 60 * labor;

  const lamCost = area * lamRate;
  const dieCost = qty / 1000 * dieRate;

  const direct =
    materialCost +
    inkCost +
    machineCost +
    laborCost +
    lamCost +
    dieCost;

  const overheadCost = direct * overheadRate / 100;
  const adminCost = (direct + overheadCost) * adminRate / 100;

  const fullCost =
    direct +
    overheadCost +
    adminCost;

  const calculatedPrice =
    fullCost * (1 + markupRate / 100);

  const price =
    Math.max(minimum, calculatedPrice);

  const profit = price - fullCost;

  $("result").innerHTML = `
    <div class="result-top">
      <div>
        <span>ЭКОНОМИКА ГОТОВА</span>
        <h2>Полная структура заказа</h2>
      </div>
    </div>

    <div class="price-grid">
      <div class="price-box main">
        <span>Цена продажи</span>
        <b>${rub(price)}</b>
      </div>

      <div class="price-box">
        <span>Себестоимость</span>
        <b>${rub(fullCost)}</b>
      </div>
    </div>

    <div class="stat-grid">
      <div class="stat"><span>Тираж</span><b>${qty.toLocaleString("ru-RU")} шт.</b></div>
      <div class="stat"><span>Метраж</span><b>${meters.toFixed(1)} м</b></div>
      <div class="stat"><span>Материал</span><b>${materialKg.toFixed(2)} кг</b></div>
      <div class="stat"><span>Время</span><b>${(totalMinutes / 60).toFixed(1)} ч</b></div>
    </div>

    <div class="breakdown">
      <div><span>Материал</span><b>${rub(materialCost)}</b></div>
      <div><span>Краска</span><b>${rub(inkCost)}</b></div>
      <div><span>Машина</span><b>${rub(machineCost)}</b></div>
      <div><span>Работа</span><b>${rub(laborCost)}</b></div>
      <div><span>Ламинация</span><b>${rub(lamCost)}</b></div>
      <div><span>Вырубка</span><b>${rub(dieCost)}</b></div>
      <div><span>Накладные</span><b>${rub(overheadCost)}</b></div>
      <div><span>Административные</span><b>${rub(adminCost)}</b></div>
      <div><span>ПРИБЫЛЬ</span><b>${rub(profit)}</b></div>
    </div>

    <div class="note">
      Детальный расчёт показывает управленческую экономику заказа.
      Фактическая себестоимость зависит от производственных норм.
    </div>
  `;
}

$("calc").addEventListener("click", calculate);
calculate();



/* ============================================================
   PRINTCALC FLEXO — MACHINE SELECTOR
   ============================================================ */

(function () {

  "use strict";

  function pcNum(id, fallback) {
    const el = document.getElementById(id);

    if (!el) {
      return fallback;
    }

    const value = Number(el.value);

    return Number.isFinite(value)
      ? value
      : fallback;
  }


  function pcSet(id, value) {

    const el = document.getElementById(id);

    if (!el) {
      return;
    }

    el.value = value;
  }


  function pcInitMachineSelector() {

    const select = document.getElementById("machineSelect");

    if (!select) {
      return;
    }

    const machines =
      Array.isArray(window.PRINTCALC_MACHINES)
        ? window.PRINTCALC_MACHINES
        : [];

    select.innerHTML =
      '<option value="">Выберите станок</option>';

    machines.forEach(function (machine) {

      const option = document.createElement("option");

      option.value = machine.id;
      option.textContent = machine.name;

      select.appendChild(option);

    });


    select.addEventListener(
      "change",
      function () {

        const machine = machines.find(function (item) {
          return item.id === select.value;
        });

        if (!machine) {
          return;
        }

        pcSet("speed", machine.speed);
        pcSet("power", machine.power);
        pcSet("setup", machine.setup);
        pcSet("machine", machine.machineRate);
        pcSet("labor", machine.laborRate);

        const hint =
          document.getElementById("machineHint");

        if (hint) {

          hint.textContent =
            machine.name
            + " • "
            + machine.speed
            + " м/мин • "
            + machine.power
            + " кВт";

        }

        try {

          localStorage.setItem(
            "printcalc_selected_machine",
            machine.id
          );

        } catch (error) {
          // localStorage может быть запрещён.
        }

      }
    );


    try {

      const saved =
        localStorage.getItem(
          "printcalc_selected_machine"
        );

      if (saved) {

        const exists =
          machines.some(function (machine) {
            return machine.id === saved;
          });

        if (exists) {

          select.value = saved;

          select.dispatchEvent(
            new Event("change")
          );

        }

      }

    } catch (error) {
      // ignore
    }

  }


  function pcElectricityCost(hours) {

    const power = pcNum("power", 0);
    const rate = pcNum("powerRate", 0);

    return power * rate * hours;

  }


  function pcProductionExtras(area, quantity, hours) {

    const result = {

      electricity: pcElectricityCost(hours),

      lamination: 0,

      die: 0

    };


    const lamEnabled =
      document.getElementById("lamEnabled");

    const dieEnabled =
      document.getElementById("dieEnabled");


    if (
      lamEnabled &&
      lamEnabled.checked
    ) {

      result.lamination =
        area * pcNum("lam", 0);

    }


    if (
      dieEnabled &&
      dieEnabled.checked
    ) {

      result.die =
        (quantity / 1000)
        * pcNum("die", 0);

    }


    result.total =
      result.electricity
      + result.lamination
      + result.die;


    return result;

  }


  window.PRINTCALC_ELECTRICITY_COST =
    pcElectricityCost;

  window.PRINTCALC_PRODUCTION_EXTRAS =
    pcProductionExtras;


  function pcStart() {

    pcInitMachineSelector();

  }


  if (document.readyState === "loading") {

    document.addEventListener(
      "DOMContentLoaded",
      pcStart
    );

  } else {

    pcStart();

  }

})();
