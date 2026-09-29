(() => {
  "use strict";

  const config = window.PRINTCALC_CONFIG || {};
  const supabaseLib = window.supabase || null;

  let supabaseClient = null;
  let storageNamespace = "guest";
  let machines = [];
  let editingId = null;

  function safeNumber(value, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    }[char]));
  }

  function money(value) {
    return Math.round(safeNumber(value)).toLocaleString("ru-RU") + " ₽";
  }

  function key() {
    return "printcalc_my_machines_v2::" + storageNamespace;
  }

  function loadLocalMachines() {
    try {
      const raw = localStorage.getItem(key());
      const parsed = raw ? JSON.parse(raw) : [];
      machines = Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      machines = [];
      console.warn("PRINTCALC machines:", error);
    }
  }

  function saveLocalMachines() {
    try {
      localStorage.setItem(key(), JSON.stringify(machines));
      return true;
    } catch (error) {
      console.warn("PRINTCALC machines save:", error);
      return false;
    }
  }

  async function resolveStorageNamespace() {
    storageNamespace = "guest";

    if (
      supabaseLib &&
      config.SUPABASE_URL &&
      config.SUPABASE_ANON_KEY
    ) {
      try {
        if (!supabaseClient) {
          supabaseClient = supabaseLib.createClient(
            config.SUPABASE_URL,
            config.SUPABASE_ANON_KEY
          );
        }

        const sessionResponse = await supabaseClient.auth.getSession();
        const user = sessionResponse?.data?.session?.user || null;

        if (user?.id) {
          storageNamespace = user.id;
        }
      } catch (error) {
        console.warn("PRINTCALC session:", error);
      }
    }

    loadLocalMachines();
  }

  function machineTemplate(machine) {
    return {
      id: machine?.id || ("machine-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8)),
      name: String(machine?.name || "").trim(),
      speed: safeNumber(machine?.speed),
      power: safeNumber(machine?.power),
      setup: safeNumber(machine?.setup),
      machineRate: safeNumber(machine?.machineRate),
      laborRate: safeNumber(machine?.laborRate),
      powerRate: safeNumber(machine?.powerRate),
      createdAt: machine?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  }

  function createManagerModal() {
    if (document.getElementById("pc-machine-modal")) {
      return;
    }

    const modal = document.createElement("div");
    modal.id = "pc-machine-modal";
    modal.className = "pc-machine-modal";
    modal.hidden = true;

    modal.innerHTML = `
      <div class="pc-machine-modal-card" role="dialog" aria-modal="true" aria-labelledby="pc-machine-modal-title">
        <button type="button" class="pc-machine-modal-close" id="pc-machine-close" aria-label="Закрыть">×</button>

        <div class="pc-machine-modal-eyebrow">МОИ СТАНКИ</div>
        <h2 id="pc-machine-modal-title">Добавить станок</h2>
        <p class="pc-machine-modal-lead">
          Заполните параметры один раз. В детальном расчёте они будут подставляться автоматически.
        </p>

        <div id="pc-machine-form-message" class="pc-machine-form-message"></div>

        <div class="pc-machine-form-grid">
          <label class="pc-machine-form-field pc-machine-form-wide">
            <span>Название станка</span>
            <input id="pc-machine-name" type="text" maxlength="80" placeholder="Например, Bobst Expert 106">
          </label>

          <label class="pc-machine-form-field">
            <span>Скорость, м/мин</span>
            <input id="pc-machine-speed" type="number" min="0" step="0.1" placeholder="80">
          </label>

          <label class="pc-machine-form-field">
            <span>Мощность, кВт</span>
            <input id="pc-machine-power" type="number" min="0" step="0.1" placeholder="18">
          </label>

          <label class="pc-machine-form-field">
            <span>Наладка, мин</span>
            <input id="pc-machine-setup" type="number" min="0" step="0.1" placeholder="35">
          </label>

          <label class="pc-machine-form-field">
            <span>Машина, ₽/час</span>
            <input id="pc-machine-rate" type="number" min="0" step="1" placeholder="1800">
          </label>

          <label class="pc-machine-form-field">
            <span>Работа, ₽/час</span>
            <input id="pc-machine-labor" type="number" min="0" step="1" placeholder="650">
          </label>

          <label class="pc-machine-form-field">
            <span>Электроэнергия, ₽/кВт⋅ч</span>
            <input id="pc-machine-power-rate" type="number" min="0" step="0.01" placeholder="8">
          </label>
        </div>

        <div class="pc-machine-modal-actions">
          <button type="button" class="pc-machine-cancel" id="pc-machine-cancel">Отмена</button>
          <button type="button" class="pc-machine-save" id="pc-machine-save">Сохранить станок</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    modal.addEventListener("click", event => {
      if (event.target === modal) {
        closeMachineModal();
      }
    });

    document.getElementById("pc-machine-close")?.addEventListener("click", closeMachineModal);
    document.getElementById("pc-machine-cancel")?.addEventListener("click", closeMachineModal);
    document.getElementById("pc-machine-save")?.addEventListener("click", saveMachineFromForm);
  }

  function showFormMessage(text, type = "") {
    const box = document.getElementById("pc-machine-form-message");
    if (!box) return;
    box.textContent = text || "";
    box.className = "pc-machine-form-message " + type;
  }

  function clearMachineForm() {
    const values = {
      "pc-machine-name": "",
      "pc-machine-speed": "",
      "pc-machine-power": "",
      "pc-machine-setup": "",
      "pc-machine-rate": "",
      "pc-machine-labor": "",
      "pc-machine-power-rate": ""
    };

    Object.entries(values).forEach(([id, value]) => {
      const element = document.getElementById(id);
      if (element) element.value = value;
    });

    showFormMessage("");
  }

  function openMachineModal(machineId = null) {
    createManagerModal();
    editingId = machineId;

    const title = document.getElementById("pc-machine-modal-title");
    const saveButton = document.getElementById("pc-machine-save");

    if (machineId) {
      const machine = machines.find(item => item.id === machineId);
      if (!machine) return;

      if (title) title.textContent = "Изменить станок";
      if (saveButton) saveButton.textContent = "Сохранить изменения";

      const fields = {
        "pc-machine-name": machine.name,
        "pc-machine-speed": machine.speed,
        "pc-machine-power": machine.power,
        "pc-machine-setup": machine.setup,
        "pc-machine-rate": machine.machineRate,
        "pc-machine-labor": machine.laborRate,
        "pc-machine-power-rate": machine.powerRate
      };

      Object.entries(fields).forEach(([id, value]) => {
        const element = document.getElementById(id);
        if (element) element.value = value;
      });
    } else {
      if (title) title.textContent = "Добавить станок";
      if (saveButton) saveButton.textContent = "Сохранить станок";
      clearMachineForm();
    }

    const modal = document.getElementById("pc-machine-modal");
    if (modal) modal.hidden = false;

    setTimeout(() => document.getElementById("pc-machine-name")?.focus(), 40);
  }

  function closeMachineModal() {
    const modal = document.getElementById("pc-machine-modal");
    if (modal) modal.hidden = true;
    editingId = null;
  }

  function readMachineForm() {
    const name = document.getElementById("pc-machine-name")?.value.trim() || "";

    if (!name) {
      showFormMessage("Укажите название станка.", "error");
      return null;
    }

    const machine = machineTemplate({
      name,
      speed: safeNumber(document.getElementById("pc-machine-speed")?.value),
      power: safeNumber(document.getElementById("pc-machine-power")?.value),
      setup: safeNumber(document.getElementById("pc-machine-setup")?.value),
      machineRate: safeNumber(document.getElementById("pc-machine-rate")?.value),
      laborRate: safeNumber(document.getElementById("pc-machine-labor")?.value),
      powerRate: safeNumber(document.getElementById("pc-machine-power-rate")?.value)
    });

    if (machine.speed <= 0) {
      showFormMessage("Скорость должна быть больше нуля.", "error");
      return null;
    }

    return machine;
  }

  function saveMachineFromForm() {
    const formMachine = readMachineForm();
    if (!formMachine) return;

    if (editingId) {
      const index = machines.findIndex(item => item.id === editingId);
      if (index >= 0) {
        machines[index] = {
          ...machines[index],
          ...formMachine,
          id: machines[index].id,
          createdAt: machines[index].createdAt,
          updatedAt: new Date().toISOString()
        };
      }
    } else {
      machines.push(formMachine);
    }

    if (!saveLocalMachines()) {
      showFormMessage("Не удалось сохранить станок в браузере.", "error");
      return;
    }

    closeMachineModal();
    renderMachineList();
    populateMachineSelect();
  }

  function deleteMachine(machineId) {
    const machine = machines.find(item => item.id === machineId);
    if (!machine) return;

    const accepted = window.confirm(
      `Удалить станок «${machine.name}»?\n\nОн исчезнет из списка выбора в детальном расчёте.`
    );

    if (!accepted) return;

    machines = machines.filter(item => item.id !== machineId);
    saveLocalMachines();
    renderMachineList();
    populateMachineSelect();
  }

  function renderMachineList() {
    const box = document.getElementById("pc-machine-list");
    if (!box) return;

    if (!machines.length) {
      box.innerHTML = `
        <div class="pc-machine-empty-home">
          <div class="pc-machine-empty-home-icon">⚙</div>
          <div>
            <strong>Добавьте первый станок</strong>
            <span>После добавления он появится здесь и станет доступен в детальном расчёте.</span>
          </div>
          <button type="button" class="pc-machine-empty-add" data-machine-add>ДОБАВИТЬ СТАНОК</button>
        </div>
      `;
    } else {
      box.innerHTML = machines.map(machine => `
        <article class="pc-machine-card">
          <div class="pc-machine-card-top">
            <div class="pc-machine-card-icon">⚙</div>
            <div class="pc-machine-card-title">
              <span>СТАНОК</span>
              <h3>${escapeHtml(machine.name)}</h3>
            </div>
            <div class="pc-machine-card-actions">
              <button type="button" data-machine-edit="${escapeHtml(machine.id)}">Изменить</button>
              <button type="button" data-machine-delete="${escapeHtml(machine.id)}">Удалить</button>
            </div>
          </div>

          <div class="pc-machine-card-metrics">
            <div><span>СКОРОСТЬ</span><b>${machine.speed}</b><small>м/мин</small></div>
            <div><span>МОЩНОСТЬ</span><b>${machine.power}</b><small>кВт</small></div>
            <div><span>НАЛАДКА</span><b>${machine.setup}</b><small>мин</small></div>
            <div><span>МАШИНА</span><b>${money(machine.machineRate)}</b><small>в час</small></div>
            <div><span>РАБОТА</span><b>${money(machine.laborRate)}</b><small>в час</small></div>
            <div><span>ЭЛЕКТРОЭНЕРГИЯ</span><b>${machine.powerRate}</b><small>₽/кВт⋅ч</small></div>
          </div>
        </article>
      `).join("");
    }

    box.querySelectorAll("[data-machine-add]").forEach(button => {
      button.addEventListener("click", () => openMachineModal());
    });

    box.querySelectorAll("[data-machine-edit]").forEach(button => {
      button.addEventListener("click", () => openMachineModal(button.dataset.machineEdit));
    });

    box.querySelectorAll("[data-machine-delete]").forEach(button => {
      button.addEventListener("click", () => deleteMachine(button.dataset.machineDelete));
    });
  }

  function initHomeManager() {
    if (!document.getElementById("pc-machine-list")) return;
    createManagerModal();

    document.getElementById("pc-open-machine-modal")?.addEventListener("click", () => {
      openMachineModal();
    });

    renderMachineList();
  }

  function setReadonlyMachineFields(readonly) {
    ["speed", "power", "setup", "machine", "labor", "powerRate"].forEach(id => {
      const element = document.getElementById(id);
      if (!element) return;
      element.readOnly = readonly;
      element.setAttribute("aria-readonly", String(readonly));
    });
  }

  function formatPreviewValue(value) {
    return safeNumber(value).toLocaleString("ru-RU", {
      maximumFractionDigits: 2
    });
  }

  function updateMachinePreview(machine) {
    const preview = document.getElementById("machinePreview");
    const empty = document.getElementById("machineEmpty");

    if (!machine) {
      if (preview) preview.hidden = true;
      if (empty) empty.hidden = machines.length > 0;
      return;
    }

    if (empty) empty.hidden = true;
    if (preview) preview.hidden = false;

    const mapping = {
      machinePreviewName: machine.name,
      machinePreviewSpeed: formatPreviewValue(machine.speed),
      machinePreviewPower: formatPreviewValue(machine.power),
      machinePreviewSetup: formatPreviewValue(machine.setup),
      machinePreviewRate: money(machine.machineRate),
      machinePreviewLabor: money(machine.laborRate),
      machinePreviewPowerRate: formatPreviewValue(machine.powerRate)
    };

    Object.entries(mapping).forEach(([id, value]) => {
      const element = document.getElementById(id);
      if (element) element.textContent = value;
    });
  }

  function applyMachine(machine, shouldPersist = true) {
    if (!machine) return;

    const values = {
      speed: machine.speed,
      power: machine.power,
      setup: machine.setup,
      machine: machine.machineRate,
      labor: machine.laborRate,
      powerRate: machine.powerRate
    };

    Object.entries(values).forEach(([id, value]) => {
      const element = document.getElementById(id);
      if (element) element.value = value;
    });

    updateMachinePreview(machine);

    if (shouldPersist) {
      try {
        localStorage.setItem(
          "printcalc_selected_machine::" + storageNamespace,
          machine.id
        );
      } catch (error) {
        // ignore
      }
    }
  }

  function populateMachineSelect() {
    const select = document.getElementById("machineSelect");
    if (!select) return;

    let savedId = "";
    try {
      savedId = localStorage.getItem(
        "printcalc_selected_machine::" + storageNamespace
      ) || "";
    } catch (error) {
      // ignore
    }

    select.innerHTML = `<option value="">Выберите станок</option>` +
      machines.map(machine =>
        `<option value="${escapeHtml(machine.id)}">${escapeHtml(machine.name)}</option>`
      ).join("");

    select.value = machines.some(item => item.id === savedId) ? savedId : "";

    setReadonlyMachineFields(true);

    select.onchange = () => {
      const machine = machines.find(item => item.id === select.value) || null;

      if (!machine) {
        updateMachinePreview(null);
        return;
      }

      applyMachine(machine, true);
    };

    if (select.value) {
      const machine = machines.find(item => item.id === select.value);
      if (machine) {
        applyMachine(machine, false);
      }
    } else {
      updateMachinePreview(null);
    }
  }

  function initDetailSelector() {
    if (!document.getElementById("machineSelect")) return;

    populateMachineSelect();
  }

  async function init() {
    await resolveStorageNamespace();
    initHomeManager();
    initDetailSelector();

    if (supabaseClient) {
      supabaseClient.auth.onAuthStateChange(() => {
        window.setTimeout(async () => {
          await resolveStorageNamespace();
          renderMachineList();
          populateMachineSelect();
        }, 0);
      });
    }
  }

  window.PRINTCALC_MACHINES = {
    getAll: () => machines.slice(),
    getById: id => machines.find(item => item.id === id) || null,
    refresh: () => {
      loadLocalMachines();
      renderMachineList();
      populateMachineSelect();
    }
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
