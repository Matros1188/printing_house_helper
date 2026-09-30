(() => {
  "use strict";
  const $ = id => document.getElementById(id);
  const core = window.PRINTCALC_AUTH_CORE || {};
  let timer = null;
  let lastKey = "";

  const n = id => {
    const value = Number(String($(id)?.value || "").replace(/\s/g, "").replace(/,/g, "."));
    return Number.isFinite(value) ? value : 0;
  };
  const source = () => ({
    mode: location.pathname.toLowerCase().includes("detail") ? "detail" : "quick",
    inputs: {
      width:n("width"), height:n("height"), web:n("web"), streams:n("streams"), colors:n("colors"),
      repeat:$("repeat")?.value || "", repeatMm:window.PRINTORA_REPEAT_MM?.($("repeat")?.value) || 0,
      lam:Boolean($("lam")?.checked || $("lamEnabled")?.checked), die:Boolean($("die")?.checked || $("dieEnabled")?.checked)
    },
    materialId:window.PRINTORA_MATERIAL?.id || "",
    customerName:$("customerName")?.value || ""
  });
  function render(rows) {
    const box = $("pc-similar-orders-v36"); if (!box) return;
    if (!rows.length) { box.hidden = true; box.innerHTML = ""; return; }
    box.hidden = false;
    box.innerHTML = `<div class="pc-similar-head-v36"><strong>Похожие заказы в истории</strong><span>проверьте старый штамп</span></div>` + rows.slice(0,3).map(item => {
      const date = item.createdAt ? new Date(item.createdAt).toLocaleDateString("ru-RU") : "";
      return `<div class="pc-similar-item-v36"><b>${item.score}%</b><div><strong>№ ${String(item.order).replace(/^№\s*/, "")}</strong><span>${item.width}×${item.height} мм · раппорт ${item.repeat.toLocaleString("ru-RU", {maximumFractionDigits:2})} мм · ${date}</span></div></div>`;
    }).join("");
  }
  async function check() {
    const box = $("pc-similar-orders-v36");
    if (!box || typeof core.getCurrentUser !== "function" || typeof core.getClient !== "function") return;
    const user = core.getCurrentUser();
    if (!user) { box.hidden = true; return; }
    const s = source();
    if (s.inputs.width <= 0 || s.inputs.height <= 0 || s.inputs.repeatMm <= 0) { box.hidden = true; return; }
    const key = JSON.stringify(s); if (key === lastKey) return; lastKey = key;
    try {
      const rows = await window.PRINTORA_FIND_SIMILAR?.({ ...s, summary:s.inputs, inputs:s.inputs, materialId:s.materialId });
      render(rows || []);
    } catch (error) { console.warn("PRINTORA similarity", error); }
  }
  function schedule() { clearTimeout(timer); timer = setTimeout(check, 900); }
  function init() {
    if (!$("pc-similar-orders-v36")) return;
    ["width","height","web","streams","colors","repeat","customerName","lam","die","lamEnabled","dieEnabled","machineSelect"].forEach(id => {
      $(id)?.addEventListener("input", schedule);
      $(id)?.addEventListener("change", schedule);
    });
    window.addEventListener("printora:material-changed", schedule);
    window.addEventListener("printcalc:auth-changed", schedule);
    schedule();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once:true }); else init();
})();
