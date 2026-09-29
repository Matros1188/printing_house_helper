/* ============================================================
   PRINTCALC FLEXO — MACHINE DATABASE
   ============================================================ */

(function () {
  "use strict";

  window.PRINTCALC_MACHINES = [

    {
      id: "flexo-main",
      name: "Флексографская машина",
      speed: 80,
      power: 18,
      setup: 35,
      machineRate: 1800,
      laborRate: 650
    },

    {
      id: "flexo-fast",
      name: "Флексомашина — высокая скорость",
      speed: 120,
      power: 28,
      setup: 45,
      machineRate: 2400,
      laborRate: 700
    },

    {
      id: "digital",
      name: "Цифровая печатная машина",
      speed: 35,
      power: 12,
      setup: 15,
      machineRate: 1600,
      laborRate: 600
    },

    {
      id: "laminator",
      name: "Ламинатор",
      speed: 60,
      power: 15,
      setup: 25,
      machineRate: 1500,
      laborRate: 600
    },

    {
      id: "slitter",
      name: "Бобинорезательная машина",
      speed: 100,
      power: 10,
      setup: 20,
      machineRate: 1200,
      laborRate: 550
    },

    {
      id: "die-cutter",
      name: "Вырубной станок",
      speed: 40,
      power: 16,
      setup: 30,
      machineRate: 1700,
      laborRate: 650
    }

  ];

})();
