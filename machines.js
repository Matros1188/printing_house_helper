(() => {
  "use strict";

  const config = window.PRINTCALC_CONFIG || {};
  const supabaseLib = window.supabase || null;

  let supabaseClient = window.PRINTCALC_AUTH_CORE?.getClient?.() || null;
  let storageNamespace = "guest";
  let machines = [];
  let editingId = null;
  let cloudReady = false;
  let previousMachines = [];

  const MACHINE_MODE = "machine";
  const MACHINE_LEGACY_MODE = "machine";
  const MACHINE_LIBRARY_KIND = "machine";

  function safeNumber(value, fallback = 0) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
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

  function storageKey() {
    return "printcalc_my_machines_v4::" + storageNamespace;
  }

  function selectedMachineKey() {
    return "printcalc_selected_machine::" + storageNamespace;
  }

  function setStorageStatus(text, state = "") {
    const box = document.getElementById("pc-machine-storage-status");
    if (!box) return;
    box.textContent = text;
    box.className = "pc-machine-storage " + state;
  }

  function loadLocalMachines() {
    try {
      const raw = localStorage.getItem(storageKey());
      const parsed = raw ? JSON.parse(raw) : [];
      machines = Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      machines = [];
      console.warn("PRINTCALC machines local:", error);
    }
  }

  function saveLocalMachines() {
    try {
      localStorage.setItem(storageKey(), JSON.stringify(machines));
      return true;
    } catch (error) {
      console.warn("PRINTCALC machines save:", error);
      return false;
    }
  }

  function normalizeMachine(item = {}) {
    return {
      id: String(item.id || ("machine-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8))),
      name: String(item.name || "").trim(),
      type: String(item.type || "Другое"),
      speed: safeNumber(item.speed),
      power: safeNumber(item.power),
      setup: safeNumber(item.setup),
      machineRate: safeNumber(item.machineRate),
      laborRate: safeNumber(item.laborRate),
      powerRate: safeNumber(item.powerRate),
      createdAt: item.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      cloudId: item.cloudId || null
    };
  }

  async function createClientIfNeeded() {
  if (window.PRINTCALC_AUTH_CORE?.getClient) {
    supabaseClient = window.PRINTCALC_AUTH_CORE.getClient() || supabaseClient;
    if (supabaseClient) return supabaseClient;
  }
  if (!supabaseClient && supabaseLib && config.SUPABASE_URL && config.SUPABASE_ANON_KEY) {
    supabaseClient = supabaseLib.createClient(config.SUPABASE_URL, config.SUPABASE_ANON_KEY, {
      auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false,storage:window.localStorage,storageKey:"printcalc-flexo-auth"}
    });
  }
  return supabaseClient;
}

  async function getUserId() {
  const client = await createClientIfNeeded();
  if (!client) return null;
  try { return (await client.auth.getSession())?.data?.session?.user?.id || null; } catch (_) { return null; }
}

  async function loadCloudMachines() {
  const client = await createClientIfNeeded();
  if (!client || storageNamespace === "guest") {
    cloudReady=false;
    setStorageStatus("Гость: станки сохраняются на этом устройстве","local");
    return;
  }
  try {
    const all=[]; let from=0; const page=500;
    while(true){
      const response=await client.from("calculations")
        .select("id,user_id,mode,calculation_data,created_at,updated_at")
        .eq("user_id",storageNamespace)
        .in("mode",[MACHINE_MODE,MACHINE_LEGACY_MODE])
        .order("created_at",{ascending:true})
        .range(from,from+page-1);
      if(response.error) throw response.error;
      const rows=response.data||[];
      for(const row of rows){
        const data=row.calculation_data||{};
        if(row.mode===MACHINE_LEGACY_MODE || data.__printora_library===MACHINE_LIBRARY_KIND) all.push({...data,cloudId:row.id});
      }
      if(rows.length<page) break;
      from+=page;
    }
    machines=all.map(normalizeMachine).filter(m=>m.name);
    cloudReady=true;
    saveLocalMachines();
    setStorageStatus("Сохраняется в аккаунте и доступно на ваших устройствах","cloud");
  }catch(error){
    cloudReady=false;
    setStorageStatus("Не удалось загрузить станки из аккаунта","local");
    console.warn("PRINTORA machines cloud load:",error);
  }
}

  async function cloudInsert(machine) {
  const client=await createClientIfNeeded();
  if(!client || storageNamespace==="guest") return machine;
  const response=await client.from("calculations").insert({
    user_id:storageNamespace,
    mode:MACHINE_MODE,
    calculation_data:{
      __printora_library:MACHINE_LIBRARY_KIND,
      id:machine.id,name:machine.name,type:machine.type,
      speed:machine.speed,power:machine.power,setup:machine.setup,
      machineRate:machine.machineRate,laborRate:machine.laborRate,powerRate:machine.powerRate,
      createdAt:machine.createdAt
    }
  }).select("id,user_id,mode,calculation_data").single();
  if(response.error) throw response.error;
  if(!response.data?.id || response.data.user_id!==storageNamespace) throw new Error("Облако не подтвердило сохранение станка.");
  machine.cloudId=response.data.id;
  return machine;
}

  async function cloudUpdate(machine) {
  const client=await createClientIfNeeded();
  if(!client || storageNamespace==="guest" || !machine?.cloudId) throw new Error("Облачная запись станка не найдена.");
  const response=await client.from("calculations").update({
    calculation_data:{
      __printora_library:MACHINE_LIBRARY_KIND,
      id:machine.id,name:machine.name,type:machine.type,
      speed:machine.speed,power:machine.power,setup:machine.setup,
      machineRate:machine.machineRate,laborRate:machine.laborRate,powerRate:machine.powerRate,
      createdAt:machine.createdAt,updatedAt:new Date().toISOString()
    }
  }).eq("id",machine.cloudId).eq("user_id",storageNamespace)
    .select("id,user_id,mode,calculation_data").maybeSingle();
  if(response.error) throw response.error;
  if(!response.data?.id || response.data.user_id!==storageNamespace) throw new Error("Изменение станка не подтверждено облаком.");
  return machine;
}

  async function syncAllToCloud() {
    const client = await createClientIfNeeded();
    if (!client || storageNamespace === "guest") return;

    try {
      for (const machine of machines) {
        if (machine.cloudId) {
          await cloudUpdate(machine);
        } else {
          await cloudInsert(machine);
        }
      }
      cloudReady = true;
      saveLocalMachines();
      setStorageStatus(
        "Сохраняется в аккаунте и доступно на ваших устройствах",
        "cloud"
      );
    } catch (error) {
      cloudReady = false;
      setStorageStatus(
        "Не удалось обновить облако — локальная копия сохранена",
        "local"
      );
      console.warn("PRINTCALC machines sync:", error);
    }
  }

  async function cloudDelete(machine) {
  const client=await createClientIfNeeded();
  if(!client || storageNamespace==="guest" || !machine?.cloudId) return;
  const response=await client.from("calculations").delete().eq("id",machine.cloudId).eq("user_id",storageNamespace).select("id");
  if(response.error) throw response.error;
  if(!response.data?.length) throw new Error("Удаление станка не подтверждено облаком.");
}

  async function switchNamespace() {
    previousMachines = machines.slice();

    const userId = await getUserId();
    storageNamespace = userId || "guest";

    loadLocalMachines();

    if (
      storageNamespace !== "guest" &&
      !machines.length &&
      previousMachines.length
    ) {
      machines = previousMachines.map(normalizeMachine);
      saveLocalMachines();
    }

    await loadCloudMachines();
  }

  function machineTypeLabel(type) {
    return escapeHtml(type || "Другое");
  }

  function createManagerModal() {
    if (document.getElementById("pc-machine-modal")) return;

    const modal = document.createElement("div");
    modal.id = "pc-machine-modal";
    modal.className = "pc-machine-modal";
    modal.hidden = true;

    modal.innerHTML = `
      <div class="pc-machine-modal-card" role="dialog" aria-modal="true" aria-labelledby="pc-machine-modal-title">
        <button type="button" class="pc-machine-modal-close" id="pc-machine-close" aria-label="Закрыть">×</button>

        <div class="pc-machine-modal-eyebrow">МОИ СТАНКИ</div>
        <h2 id="pc-machine-modal-title">Добавить станок</h2>
        <p class="pc-machine-modal-lead">Заполните параметры один раз. В детальном расчёте они будут подставляться автоматически.</p>
        <div id="pc-machine-form-message" class="pc-machine-form-message"></div>

        <div class="pc-machine-form-grid">
          <label class="pc-machine-form-field pc-machine-form-wide">
            <span>Название станка</span>
            <input id="pc-machine-name" type="text" maxlength="80" placeholder="Например, Bobst Expert 106">
          </label>

          <label class="pc-machine-form-field">
            <span>Тип станка</span>
            <select id="pc-machine-type">
              <option value="Флексопечать">Флексопечать</option>
              <option value="Цифровая печать">Цифровая печать</option>
              <option value="Ламинация">Ламинация</option>
              <option value="Резка">Резка</option>
              <option value="Вырубка">Вырубка</option>
              <option value="Другое">Другое</option>
            </select>
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
      if (event.target === modal) closeMachineModal();
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

  function setField(id, value) {
    const element = document.getElementById(id);
    if (element) element.value = value ?? "";
  }

  function clearMachineForm() {
    setField("pc-machine-name", "");
    setField("pc-machine-type", "Флексопечать");
    setField("pc-machine-speed", "");
    setField("pc-machine-power", "");
    setField("pc-machine-setup", "");
    setField("pc-machine-rate", "");
    setField("pc-machine-labor", "");
    setField("pc-machine-power-rate", "");
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

      setField("pc-machine-name", machine.name);
      setField("pc-machine-type", machine.type);
      setField("pc-machine-speed", machine.speed);
      setField("pc-machine-power", machine.power);
      setField("pc-machine-setup", machine.setup);
      setField("pc-machine-rate", machine.machineRate);
      setField("pc-machine-labor", machine.laborRate);
      setField("pc-machine-power-rate", machine.powerRate);
      showFormMessage("");
    } else {
      if (title) title.textContent = "Добавить станок";
      if (saveButton) saveButton.textContent = "Сохранить станок";
      clearMachineForm();
    }

    const modal = document.getElementById("pc-machine-modal");
    if (modal) modal.hidden = false;

    setTimeout(() => document.getElementById("pc-machine-name")?.focus(), 50);
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

    const machine = normalizeMachine({
      name,
      type: document.getElementById("pc-machine-type")?.value || "Другое",
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

    if (machine.power < 0 || machine.setup < 0 || machine.machineRate < 0 || machine.laborRate < 0 || machine.powerRate < 0) {
      showFormMessage("Параметры станка не могут быть отрицательными.", "error");
      return null;
    }

    return machine;
  }

  async function saveMachineFromForm() {
  const formMachine=readMachineForm();
  if(!formMachine) return;
  if(storageNamespace==="guest"){
    const liveUserId=await getUserId();
    if(liveUserId){ storageNamespace=liveUserId; loadLocalMachines(); }
  }
  const duplicateName=machines.some(item=>item.id!==editingId && item.name.toLocaleLowerCase("ru-RU")===formMachine.name.toLocaleLowerCase("ru-RU"));
  if(duplicateName){ showFormMessage("Станок с таким названием уже есть.","error"); return; }
  const isGuest=storageNamespace==="guest";
  const saveButton=document.getElementById("pc-machine-save");
  if(saveButton){saveButton.disabled=true;saveButton.textContent="Сохраняем…";}
  const originalEditingId=editingId;
  try{
    let savedMachine;
    if(originalEditingId){
      const index=machines.findIndex(item=>item.id===originalEditingId);
      if(index<0) throw new Error("Станок не найден.");
      savedMachine={...machines[index],...formMachine,id:machines[index].id,cloudId:machines[index].cloudId,createdAt:machines[index].createdAt,updatedAt:new Date().toISOString()};
      if(!isGuest) savedMachine=await cloudUpdate(savedMachine);
      machines[index]=savedMachine;
    }else{
      savedMachine=formMachine;
      if(!isGuest) savedMachine=await cloudInsert(savedMachine);
      machines.push(savedMachine);
    }
    if(!saveLocalMachines()) throw new Error("Не удалось сохранить станок на этом устройстве.");
    setStorageStatus(isGuest?"Гость: станок сохранён на этом устройстве":"Сохраняется в аккаунте и доступно на ваших устройствах",isGuest?"local":"cloud");
    closeMachineModal(); renderMachineList(); populateMachineSelect();
    window.dispatchEvent(new CustomEvent("printora:machine-saved",{detail:savedMachine}));
  }catch(error){
    showFormMessage(error?.message||"Не удалось сохранить станок.","error");
    console.warn("PRINTORA machine save:",error);
  }finally{
    if(saveButton){saveButton.disabled=false;saveButton.textContent=originalEditingId?"Сохранить изменения":"Сохранить станок";}
  }
}

  async function deleteMachine(machineId) {
    const machine = machines.find(item => item.id === machineId);
    if (!machine) return;
    const accepted = window.confirm(`Удалить станок «${machine.name}»?

Он исчезнет из списка выбора в детальном расчёте.`);
    if (!accepted) return;
    try {
      if (storageNamespace !== "guest") await cloudDelete(machine);
      machines = machines.filter(item => item.id !== machineId);
      saveLocalMachines();
      renderMachineList(); populateMachineSelect();
    } catch (error) {
      setStorageStatus(error?.message || "Не удалось удалить станок из облака", "local");
      console.warn("PRINTORA machine cloud delete", error);
    }
  }

  function getFilteredMachines() {
    const input = document.getElementById("pc-machine-search");
    const query = (input?.value || "").trim().toLocaleLowerCase("ru-RU");
    if (!query) return machines.slice();
    return machines.filter(machine =>
      [machine.name, machine.type].join(" ").toLocaleLowerCase("ru-RU").includes(query)
    );
  }

  function pluralMachines(count) {
    if (count % 10 === 1 && count % 100 !== 11) return `${count} станок`;
    if ([2,3,4].includes(count % 10) && ![12,13,14].includes(count % 100)) return `${count} станка`;
    return `${count} станков`;
  }

  function renderMachineList() {
    const box = document.getElementById("pc-machine-list");
    const countBox = document.getElementById("pc-machine-count");
    if (!box) return;

    const filtered = getFilteredMachines();
    if (countBox) countBox.textContent = `${pluralMachines(filtered.length)}${filtered.length !== machines.length ? ` из ${machines.length}` : ""}`;

    if (!machines.length) {
      box.innerHTML = `
        <div class="pc-machine-empty-home">
          <div class="pc-machine-empty-home-icon">⚙</div>
          <div class="pc-machine-empty-copy">
            <strong>Добавьте первый станок</strong>
            <span>Ваши реальные машины появятся здесь и станут доступны в детальном расчёте.</span>
          </div>
          <button type="button" class="pc-machine-empty-add" data-machine-add>ДОБАВИТЬ СТАНОК</button>
        </div>
      `;
    } else if (!filtered.length) {
      box.innerHTML = `
        <div class="pc-machine-empty-home compact">
          <div class="pc-machine-empty-home-icon">⌕</div>
          <div class="pc-machine-empty-copy">
            <strong>Станок не найден</strong>
            <span>Измените поисковый запрос.</span>
          </div>
        </div>
      `;
    } else {
      box.innerHTML = filtered.map(machine => `
        <article class="pc-machine-card" data-machine-card="${escapeHtml(machine.id)}">
          <div class="pc-machine-card-top">
            <div class="pc-machine-card-icon">⚙</div>
            <div class="pc-machine-card-title">
              <span>${machineTypeLabel(machine.type)}</span>
              <h3>${escapeHtml(machine.name)}</h3>
            </div>
            <div class="pc-machine-card-actions">
              <button type="button" data-machine-edit="${escapeHtml(machine.id)}">Изменить</button>
              <button type="button" data-machine-delete="${escapeHtml(machine.id)}">Удалить</button>
            </div>
          </div>

          <div class="pc-machine-card-metrics">
            <div><span>Скорость</span><b>${safeNumber(machine.speed).toLocaleString("ru-RU")}</b><small>м/мин</small></div>
            <div><span>Мощность</span><b>${safeNumber(machine.power).toLocaleString("ru-RU")}</b><small>кВт</small></div>
            <div><span>Наладка</span><b>${safeNumber(machine.setup).toLocaleString("ru-RU")}</b><small>мин</small></div>
            <div><span>Машина</span><b>${money(machine.machineRate)}</b><small>в час</small></div>
            <div><span>Работа</span><b>${money(machine.laborRate)}</b><small>в час</small></div>
            <div><span>Электроэнергия</span><b>${safeNumber(machine.powerRate).toLocaleString("ru-RU")}</b><small>₽/кВт⋅ч</small></div>
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

  function setReadonlyMachineFields(readonly) {
    ["speed", "power", "setup", "machine", "labor", "powerRate"].forEach(id => {
      const element = document.getElementById(id);
      if (!element) return;
      element.readOnly = readonly;
      element.setAttribute("aria-readonly", String(readonly));
    });
  }

  function formatPreviewValue(value) {
    return safeNumber(value).toLocaleString("ru-RU", { maximumFractionDigits: 2 });
  }

  function updateMachinePreview(machine) {
    const preview = document.getElementById("machinePreview");
    const empty = document.getElementById("machineEmpty");
    const select = document.getElementById("machineSelect");

    if (!machine) {
      if (preview) preview.hidden = true;
      if (empty) empty.hidden = machines.length > 0;
      if (select) select.classList.remove("has-selection");
      return;
    }

    if (empty) empty.hidden = true;
    if (preview) preview.hidden = false;
    if (select) select.classList.add("has-selection");

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
        localStorage.setItem(selectedMachineKey(), machine.id);
      } catch (error) {
        // ignore
      }
    }

    window.dispatchEvent(new CustomEvent("printcalc:machine-selected", {
      detail: machine
    }));
  }

  function populateMachineSelect() {
    const select = document.getElementById("machineSelect");
    if (!select) return;

    let savedId = "";
    try {
      savedId = localStorage.getItem(selectedMachineKey()) || "";
    } catch (error) {
      // ignore
    }

    const pendingId = window.PRINTCALC_PENDING_MACHINE_ID || "";
    const targetId = pendingId || savedId;

    select.innerHTML = `<option value="">Выберите станок</option>` +
      machines.map(machine =>
        `<option value="${escapeHtml(machine.id)}">${escapeHtml(machine.name)}</option>`
      ).join("");

    select.value = machines.some(item => item.id === targetId) ? targetId : "";

    setReadonlyMachineFields(false);

    select.onchange = () => {
      const machine = machines.find(item => item.id === select.value) || null;
      if (!machine) {
        updateMachinePreview(null);
        window.dispatchEvent(new CustomEvent("printcalc:machine-selected", { detail: null }));
        return;
      }
      applyMachine(machine, true);
    };

    if (select.value) {
      const machine = machines.find(item => item.id === select.value);
      if (machine) applyMachine(machine, false);
    } else {
      updateMachinePreview(null);
    }

    window.dispatchEvent(new CustomEvent("printcalc:machines-ready", {
      detail: machines.slice()
    }));
  }

  function installV18MachineAuthBridge() {
    if (window.PRINTCALC_V18_MACHINE_AUTH) return;
    window.PRINTCALC_V18_MACHINE_AUTH = true;

    if (window.PRINTCALC_AUTH_CORE?.getClient) {
      supabaseClient = window.PRINTCALC_AUTH_CORE.getClient() || supabaseClient;
    }
  }

  function initHomeManager() {
  installV18MachineAuthBridge();
  createManagerModal();
  const trigger=document.getElementById("pc-open-machine-modal");
  if(trigger) trigger.onclick=event=>{event.preventDefault();event.stopPropagation();openMachineModal();};
  if(!window.PRINTORA_MACHINE_ADD_DELEGATE){
    window.PRINTORA_MACHINE_ADD_DELEGATE=true;
    document.addEventListener("click",event=>{
      const button=event.target?.closest?.("[data-machine-add]");
      if(!button)return;
      event.preventDefault(); event.stopPropagation(); openMachineModal();
    });
  }
  document.getElementById("pc-machine-search")?.addEventListener("input",renderMachineList);
  renderMachineList();
  window.PRINTORA_MACHINES = window.PRINTORA_MACHINES || {};
  window.PRINTORA_MACHINES.open = () => openMachineModal();
  window.PRINTORA_MACHINES.refresh = () => renderMachineList();
}

  async function init() {
    await switchNamespace();
    initHomeManager();
    populateMachineSelect();
    renderMachineList();

    const client = await createClientIfNeeded();
    if (client) {
      client.auth.onAuthStateChange(() => {
        window.setTimeout(async () => {
          await switchNamespace();
          renderMachineList();
          populateMachineSelect();
          initMachineSearch();
        }, 0);
      });
    }
  }

  window.PRINTCALC_MACHINES = {
    getAll: () => machines.slice(),
    getById: id => machines.find(item => item.id === id) || null,
    refresh: async () => {
      loadLocalMachines();
      await loadCloudMachines();
      renderMachineList();
      populateMachineSelect();
    }
  };



  function updateManualModeVisual(fromUserInput = false) {
    const note = document.getElementById("pc-manual-mode-note");
    const select = document.getElementById("machineSelect");

    if (!note) return;

    if (select && select.value && fromUserInput) {
      note.innerHTML = '<span class="pc-mode-dot pc-mode-dot-manual"></span> Значения станка скорректированы вручную';
      note.classList.add("is-manual");
    } else if (select && select.value) {
      note.innerHTML = '<span class="pc-mode-dot"></span> Значения подставлены из вашего станка — их можно изменить';
      note.classList.remove("is-manual");
    } else {
      note.innerHTML = '<span class="pc-mode-dot pc-mode-dot-manual"></span> Ручной ввод производственных параметров';
      note.classList.add("is-manual");
    }
  }

  function bindProductionManualInputs() {
    ["speed", "power", "setup", "machine", "labor", "powerRate"].forEach(id => {
      const field = document.getElementById(id);
      if (!field || field.dataset.pcManualBound === "1") return;
      field.dataset.pcManualBound = "1";
      field.addEventListener("input", () => updateManualModeVisual(true));
    });

    const select = document.getElementById("machineSelect");
    if (select && select.dataset.pcManualBound !== "1") {
      select.dataset.pcManualBound = "1";
      select.addEventListener("change", () => updateManualModeVisual(false));
    }

    updateManualModeVisual(false);
  }



  function initMachineSearch() {
    const search = document.getElementById("pc-machine-search");
    const list = document.getElementById("pc-machine-list");
    if (!search || !list || search.dataset.bound === "1") return;

    search.dataset.bound = "1";

    search.addEventListener("input", () => {
      const query = search.value.trim().toLocaleLowerCase("ru-RU");
      const cards = list.querySelectorAll(".pc-machine-card");
      let visible = 0;

      cards.forEach(card => {
        const text = card.textContent.toLocaleLowerCase("ru-RU");
        const show = !query || text.includes(query);
        card.style.display = show ? "" : "none";
        if (show) visible += 1;
      });

      let emptySearch = list.querySelector(".pc-machine-search-empty");
      if (!emptySearch) {
        emptySearch = document.createElement("div");
        emptySearch.className = "pc-machine-search-empty";
        emptySearch.textContent = "По вашему запросу станков не найдено.";
        list.appendChild(emptySearch);
      }

      emptySearch.hidden = !query || visible !== 0;
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
