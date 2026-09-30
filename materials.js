(() => {
  "use strict";
  const core = window.PRINTCALC_AUTH_CORE || {};
  const LIBRARY_MODE = "detail";
  const LEGACY_MODE = "material";
  const LIBRARY_KIND = "material";
  const LOCAL_PREFIX = "printora_materials_v1::";
  let client = null;
  let userId = null;
  let materials = [];
  let editingId = null;
  let saving = false;

  const $ = id => document.getElementById(id);
  const num = value => {
    const n = Number(String(value ?? "").replace(/\s/g, "").replace(/,/g, "."));
    return Number.isFinite(n) ? n : 0;
  };
  const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({
    "&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"
  }[c]));

function lowerMaterial(value) { return String(value ?? "").trim().toLocaleLowerCase("ru-RU"); }

  function dedupeMaterials(list) {
    const map = new Map();
    for (const item of list || []) {
      const m = normalize(item);
      if (!m.name) continue;
      const key = [lowerMaterial(m.name), lowerMaterial(m.type), Number(m.lengthM||0), Number(m.widthMm||0), Number(m.priceM2||0).toFixed(6)].join("|");
      const previous = map.get(key);
      if (!previous || (!previous.cloudId && m.cloudId)) map.set(key, m);
    }
    return Array.from(map.values());
  }  function localKey() { return `${LOCAL_PREFIX}${userId || "guest"}`; }

  function getClient() {
    client = typeof core.getClient === "function" ? core.getClient() : null;
    return client;
  }
  async function getUser() {
    const c = getClient();
    if (!c) return null;
    try { return (await c.auth.getSession())?.data?.session?.user || null; }
    catch (_) { return null; }
  }

  function normalize(item = {}) {
    return {
      id: String(item.id || `material-${Date.now()}-${Math.random().toString(36).slice(2,8)}`),
      name: String(item.name || "").trim(),
      type: String(item.type || "Материал").trim(),
      lengthM: num(item.lengthM),
      widthMm: num(item.widthMm),
      priceM2: num(item.priceM2),
      cloudId: item.cloudId || null,
      createdAt: item.createdAt || new Date().toISOString()
    };
  }

  function loadLocal() {
    try {
      const data = JSON.parse(localStorage.getItem(localKey()) || "[]");
      materials = dedupeMaterials(Array.isArray(data) ? data.map(normalize).filter(x => x.name) : []);
    } catch (_) { materials = []; }
  }
  function saveLocal() {
    try { localStorage.setItem(localKey(), JSON.stringify(materials)); } catch (_) {}
  }

  async function loadCloud() {
    const c = getClient();
    if (!c || !userId) return;
    const all = [];
    let from = 0;
    const page = 500;
    while (true) {
      const r = await c.from("calculations")
        .select("id,user_id,mode,calculation_data,created_at")
        .eq("user_id", userId)
        .in("mode", [LIBRARY_MODE, LEGACY_MODE])
        .order("created_at", { ascending: true })
        .range(from, from + page - 1);
      if (r.error) throw r.error;
      const rows = r.data || [];
      for (const row of rows) {
        const data = row.calculation_data || {};
        if (row.mode === LEGACY_MODE || data.__printora_library === LIBRARY_KIND) all.push({ ...data, cloudId: row.id });
      }
      if (rows.length < page) break;
      from += page;
    }
    materials = dedupeMaterials(all.map(normalize).filter(x => x.name));
    saveLocal();
  }

  async function cloudInsert(m) {
    const c = getClient();
    if (!c || !userId) throw new Error("Войдите в аккаунт, чтобы сохранить материал в облаке.");
    const r = await c.from("calculations").insert({
      user_id: userId,
      mode: LIBRARY_MODE,
      calculation_data: {
        __printora_library: LIBRARY_KIND,
        id: m.id, name: m.name, type: m.type,
        lengthM: m.lengthM, widthMm: m.widthMm, priceM2: m.priceM2,
        createdAt: m.createdAt
      }
    }).select("id,user_id,mode,calculation_data").single();
    if (r.error) throw r.error;
    if (!r.data?.id || r.data.user_id !== userId || r.data.mode !== LIBRARY_MODE) {
      throw new Error("Облако не подтвердило сохранение материала.");
    }
    m.cloudId = r.data.id;
    return m;
  }

  async function cloudUpdate(m) {
    const c = getClient();
    if (!c || !userId || !m.cloudId) throw new Error("Облачная запись материала не найдена.");
    const r = await c.from("calculations").update({
      calculation_data: {
        __printora_library: LIBRARY_KIND,
        id: m.id, name: m.name, type: m.type,
        lengthM: m.lengthM, widthMm: m.widthMm, priceM2: m.priceM2,
        createdAt: m.createdAt, updatedAt: new Date().toISOString()
      }
    }).eq("id", m.cloudId).eq("user_id", userId)
      .select("id,user_id,mode,calculation_data").maybeSingle();
    if (r.error) throw r.error;
    if (!r.data?.id || r.data.user_id !== userId) throw new Error("Изменение материала не подтверждено облаком.");
    return m;
  }

  async function cloudDelete(m) {
    const c = getClient();
    if (!c || !userId || !m?.cloudId) throw new Error("Облачная запись материала не найдена.");
    const r = await c.from("calculations").delete().eq("id", m.cloudId).eq("user_id", userId).select("id");
    if (r.error) throw r.error;
    if (!r.data?.length) throw new Error("Удаление материала не подтверждено облаком.");
  }

  function createModal() {
    if ($("pc-material-modal-v36")) return;
    const modal = document.createElement("div");
    modal.id = "pc-material-modal-v36";
    modal.className = "pc-material-modal-v36";
    modal.hidden = true;
    modal.innerHTML = `<div class="pc-material-modal-card-v36" role="dialog" aria-modal="true"><button type="button" class="pc-material-close-v36" id="pc-material-close-v36" aria-label="Закрыть">×</button><div class="pc-material-eyebrow-v36">МОИ МАТЕРИАЛЫ</div><h2 id="pc-material-title-v36">Добавить материал</h2><p>Название, длина, ширина и цена продажи за 1 м². Материал будет доступен в обоих калькуляторах.</p><div id="pc-material-message-v36" class="pc-material-message-v36"></div><div class="pc-material-form-grid-v36"><label><span>Название материала</span><input id="pc-material-name-v36" type="text" maxlength="100" placeholder="PP 50 мкм"></label><label><span>Тип</span><input id="pc-material-type-v36" type="text" maxlength="60" placeholder="Плёнка, бумага..."></label><label><span>Длина, м</span><input id="pc-material-length-v36" type="number" min="0" step="0.1" placeholder="1000"></label><label><span>Ширина, мм</span><input id="pc-material-width-v36" type="number" min="0" step="0.1" placeholder="300"></label><label><span>Цена продажи, ₽/м²</span><input id="pc-material-price-v36" type="number" min="0" step="0.01" placeholder="68"></label></div><div class="pc-material-actions-v36"><button type="button" id="pc-material-cancel-v36">Отмена</button><button type="button" id="pc-material-save-v36">Сохранить материал</button></div></div>`;
    document.body.appendChild(modal);
    modal.addEventListener("click", e => { if (e.target === modal) closeModal(); });
    $("pc-material-close-v36")?.addEventListener("click", closeModal);
    $("pc-material-cancel-v36")?.addEventListener("click", closeModal);
    $("pc-material-save-v36")?.addEventListener("click", saveForm);
  }

  function message(text, type = "") {
    const el = $("pc-material-message-v36");
    if (el) { el.textContent = text || ""; el.className = `pc-material-message-v36 ${type}`; }
  }
  function setField(id, value) { const el = $(id); if (el) el.value = value ?? ""; }
  function clearForm() {
    setField("pc-material-name-v36", "");
    setField("pc-material-type-v36", "Материал");
    setField("pc-material-length-v36", "");
    setField("pc-material-width-v36", "");
    setField("pc-material-price-v36", "");
    message("");
  }
  function openModal(materialId = null) {
    createModal();
    editingId = materialId;
    const title = $("pc-material-title-v36");
    const button = $("pc-material-save-v36");
    if (materialId) {
      const m = materials.find(x => x.id === materialId);
      if (!m) return;
      if (title) title.textContent = "Изменить материал";
      if (button) button.textContent = "Сохранить изменения";
      setField("pc-material-name-v36", m.name);
      setField("pc-material-type-v36", m.type);
      setField("pc-material-length-v36", m.lengthM);
      setField("pc-material-width-v36", m.widthMm);
      setField("pc-material-price-v36", m.priceM2);
      message("");
    } else {
      if (title) title.textContent = "Добавить материал";
      if (button) button.textContent = "Сохранить материал";
      clearForm();
    }
    const modal = $("pc-material-modal-v36");
    if (modal) modal.hidden = false;
    setTimeout(() => $("pc-material-name-v36")?.focus(), 40);
  }
  function closeModal() {
    const modal = $("pc-material-modal-v36");
    if (modal) modal.hidden = true;
    editingId = null;
    saving = false;
  }
  async function ensureUser() {
    if (userId) return true;
    userId = (await getUser())?.id || null;
    return Boolean(userId);
  }

  async function saveForm() {
    if (saving) return;
    const name = $("pc-material-name-v36")?.value.trim() || "";
    const type = $("pc-material-type-v36")?.value.trim() || "Материал";
    const lengthM = num($("pc-material-length-v36")?.value);
    const widthMm = num($("pc-material-width-v36")?.value);
    const priceM2 = num($("pc-material-price-v36")?.value);
    if (!name) return message("Укажите название материала.", "error");
    if (widthMm <= 0) return message("Укажите ширину материала.", "error");
    if (priceM2 <= 0) return message("Цена продажи за 1 м² должна быть больше нуля.", "error");

    const authenticated = await ensureUser();
    if (!authenticated) return message("Войдите в аккаунт, чтобы материал сохранился и был доступен на других устройствах.", "error");
    const duplicate = materials.some(x => x.id !== editingId && x.name.toLocaleLowerCase("ru-RU") === name.toLocaleLowerCase("ru-RU"));
    if (duplicate) return message("Материал с таким названием уже есть.", "error");

    saving = true;
    const saveButton = $("pc-material-save-v36");
    if (saveButton) { saveButton.disabled = true; saveButton.textContent = "Сохраняем…"; }
    try {
      let saved;
      if (editingId) {
        const current = materials.find(x => x.id === editingId);
        if (!current) throw new Error("Материал не найден.");
        saved = normalize({ ...current, name, type, lengthM, widthMm, priceM2 });
        if (authenticated) await cloudUpdate(saved);
        materials = materials.map(x => x.id === editingId ? saved : x);
      } else {
        saved = normalize({ name, type, lengthM, widthMm, priceM2 });
        if (authenticated) await cloudInsert(saved);
        materials.push(saved);
      }
      saveLocal();
      renderList();
      populateSelect();
      closeModal();
      window.dispatchEvent(new CustomEvent("printora:material-saved", { detail: saved }));
    } catch (error) {
      message(window.PRINTORA_FRIENDLY_ERROR?.(error) || error?.message || "Не удалось сохранить материал.", "error");
      console.warn("PRINTORA material save:", error);
    } finally {
      if (saveButton) { saveButton.disabled = false; saveButton.textContent = editingId ? "Сохранить изменения" : "Сохранить материал"; }
      saving = false;
    }
  }

  async function removeMaterial(id) {
    const m = materials.find(x => x.id === id);
    if (!m) return;
    if (!window.confirm(`Удалить материал «${m.name}»?`)) return;
    try {
      if (userId) await cloudDelete(m);
      materials = materials.filter(x => x.id !== id);
      saveLocal(); renderList(); populateSelect();
    } catch (e) { message(e?.message || "Не удалось удалить материал.", "error"); }
  }

  function renderList() {
    const box = $("pc-material-list-v36");
    if (!box) return;
    const q = ($( "pc-material-search-v36")?.value || "").trim().toLocaleLowerCase("ru-RU");
    const filtered = q ? materials.filter(m => `${m.name} ${m.type}`.toLocaleLowerCase("ru-RU").includes(q)) : materials;
    const count = $("pc-material-count-v36");
    if (count) count.textContent = `${filtered.length} из ${materials.length}`;
    if (!filtered.length) {
      box.innerHTML = `<div class="pc-material-empty-v36"><strong>${materials.length ? "Материал не найден" : "Добавьте первый материал"}</strong><span>${materials.length ? "Измените поиск." : "После добавления он появится в обоих калькуляторах."}</span></div>`;
      return;
    }
    box.innerHTML = filtered.map(m => `<article class="pc-material-card-v36"><div class="pc-material-card-title-v36"><small>${esc(m.type)}</small><h3>${esc(m.name)}</h3></div><div class="pc-material-card-metrics-v36"><div><span>Длина</span><b>${m.lengthM ? m.lengthM.toLocaleString("ru-RU") : "—"}</b><small>м</small></div><div><span>Ширина</span><b>${m.widthMm.toLocaleString("ru-RU")}</b><small>мм</small></div><div><span>Цена</span><b>${m.priceM2.toLocaleString("ru-RU",{maximumFractionDigits:2})}</b><small>₽/м²</small></div></div><div class="pc-material-card-actions-v36"><button type="button" data-material-edit-v36="${esc(m.id)}">Изменить</button><button type="button" data-material-delete-v36="${esc(m.id)}">Удалить</button></div></article>`).join("");
    box.querySelectorAll("[data-material-edit-v36]").forEach(b => b.addEventListener("click", () => openModal(b.dataset.materialEditV36)));
    box.querySelectorAll("[data-material-delete-v36]").forEach(b => b.addEventListener("click", () => removeMaterial(b.dataset.materialDeleteV36)));
  }
  function populateSelect() {
    const select = $("materialSelect");
    if (!select) return;
    const current = select.value;
    select.innerHTML = `<option value="">Без выбора материала — ввести цену вручную</option>` + materials.map(m => `<option value="${esc(m.id)}">${esc(m.name)} — ${m.widthMm.toLocaleString("ru-RU")} мм — ${m.priceM2.toLocaleString("ru-RU",{maximumFractionDigits:2})} ₽/м²</option>`).join("");
    if (materials.some(m => m.id === current)) select.value = current;
  }
  function renderPreview(m) {
    const box = $("materialPreview-v36");
    if (!box) return;
    if (!m) { box.hidden = true; return; }
    box.hidden = false;
    if ($("materialPreviewName-v36")) $("materialPreviewName-v36").textContent = m.name;
    if ($("materialPreviewWidth-v36")) $("materialPreviewWidth-v36").textContent = `${m.widthMm.toLocaleString("ru-RU")} мм`;
    if ($("materialPreviewLength-v36")) $("materialPreviewLength-v36").textContent = m.lengthM ? `${m.lengthM.toLocaleString("ru-RU")} м` : "—";
    if ($("materialPreviewPrice-v36")) $("materialPreviewPrice-v36").textContent = `${m.priceM2.toLocaleString("ru-RU",{maximumFractionDigits:2})} ₽/м²`;
  }
  function onSelect() {
    const id = $("materialSelect")?.value || "";
    const m = materials.find(x => x.id === id) || null;
    window.PRINTORA_MATERIAL = m ? {id:m.id,name:m.name,widthMm:m.widthMm,lengthM:m.lengthM,priceM2:m.priceM2} : null;
    if (m) { if ($("web")) $("web").value = m.widthMm; if ($("matPrice")) $("matPrice").value = m.priceM2; }
    renderPreview(m);
    window.dispatchEvent(new CustomEvent("printora:material-changed", {detail:window.PRINTORA_MATERIAL}));
  }

  async function init() {
    userId = (await getUser())?.id || null;
    loadLocal();
    if (userId) { try { await loadCloud(); } catch (e) { console.warn("PRINTORA materials cloud load:", e); } }
    createModal();
    $("pc-open-material-modal-v36")?.addEventListener("click", e => { e.preventDefault(); openModal(); });
    if (!window.PRINTORA_MATERIAL_CLICK_DELEGATE) {
      window.PRINTORA_MATERIAL_CLICK_DELEGATE = true;
      document.addEventListener("click", e => {
        const button = e.target?.closest?.("[data-material-add]");
        if (button) { e.preventDefault(); openModal(); }
      });
    }
    $("pc-material-search-v36")?.addEventListener("input", renderList);
    $("materialSelect")?.addEventListener("change", onSelect);
    renderList(); populateSelect();
    const c = getClient();
    c?.auth?.onAuthStateChange?.(async (_event, session) => {
      userId = session?.user?.id || null;
      loadLocal();
      if (userId) { try { await loadCloud(); } catch (e) { console.warn("PRINTORA materials cloud auth load:", e); } }
      renderList(); populateSelect();
    });
  }

function openManager() {
    let modal = $("pc-material-manager-v40");
    if (!modal) {
      modal = document.createElement("div");
      modal.id = "pc-material-manager-v40";
      modal.className = "pc-material-manager-v40";
      modal.innerHTML = `<div class="pc-material-manager-card-v40" role="dialog" aria-modal="true"><button type="button" class="pc-material-manager-close-v40" aria-label="Закрыть">×</button><div class="eyebrow">СПРАВОЧНИК</div><h2>Мои материалы</h2><p>Материалы доступны в быстром и детальном расчёте.</p><div class="pc-material-manager-toolbar-v40"><input id="pc-material-search-v36" type="search" placeholder="Найти материал…" autocomplete="off"><span id="pc-material-count-v36">0 из 0</span></div><div id="pc-material-list-v36" class="pc-material-list-v36"></div><div class="pc-material-manager-actions-v40"><button type="button" class="secondary" data-close>Закрыть</button><button type="button" class="primary" data-add>+ ДОБАВИТЬ МАТЕРИАЛ</button></div></div>`;
      document.body.appendChild(modal);
      modal.addEventListener("click", e => { if (e.target === modal || e.target.closest("[data-close]")) modal.remove(); });
      modal.querySelector("[data-add]")?.addEventListener("click", () => { openModal(); });
    }
    renderList();
    modal.hidden = false;
    setTimeout(() => $("pc-material-search-v36")?.focus(), 30);
  }  window.PRINTORA_MATERIALS = {
    getAll: () => materials.slice(),
    open: openModal,
    openManager,
    selectById: id => { const s=$("materialSelect"); if(!s)return; s.value=id||""; s.dispatchEvent(new Event("change",{bubbles:true})); },
    getSelected: () => window.PRINTORA_MATERIAL || null,
    refresh: async () => { if (userId) { try { await loadCloud(); } catch (e) { console.warn("PRINTORA materials refresh:",e); } } renderList(); populateSelect(); }
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, {once:true});
  else init();
})();
