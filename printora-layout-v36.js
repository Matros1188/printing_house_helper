(() => {
  "use strict";
  const $ = id => document.getElementById(id);
  const n = id => {
    const el = $(id);
    const v = Number(String(el?.value || "").replace(/\s/g, "").replace(/,/g, "."));
    return Number.isFinite(v) ? v : 0;
  };
  function ensure() {
    if ($("pc-layout-preview-v36") || !$("width") || !$("height")) return;
    const anchor = $("height").closest(".field") || $("height").parentElement;
    if (!anchor) return;
    const box = document.createElement("div");
    box.id = "pc-layout-preview-v36";
    box.className = "pc-layout-preview-v36";
    anchor.insertAdjacentElement("afterend", box);
  }
  function render() {
    const box = $("pc-layout-preview-v36"); if (!box) return;
    const width = Math.max(1, n("width"));
    const height = Math.max(1, n("height"));
    const web = Math.max(width, n("web"));
    const streams = Math.max(1, Math.floor(n("streams") || Math.floor(web / width) || 1));
    const repeat = Math.max(1, window.PRINTORA_REPEAT_MM?.($("repeat")?.value) || n("height"));
    const count = Math.min(streams, 8);
    const gap = 4;
    const left = 10, top = 20, stripW = 170, stripH = 70;
    const usable = stripW - left*2;
    const labelW = Math.max(8, Math.min(usable/count - gap, usable));
    const ratioH = Math.min(42, Math.max(13, labelW * (height/Math.max(1,width))));
    const y = top + (stripH-ratioH)/2;
    const rects = Array.from({length:count}, (_,i) => {
      const x = left + i * (labelW + gap);
      return `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${labelW.toFixed(1)}" height="${ratioH.toFixed(1)}" rx="2" fill="none" stroke="currentColor" stroke-width="1.5"/>`;
    }).join("");
    box.innerHTML = `<div class="pc-layout-title-v36">СХЕМА РАСКЛАДКИ</div><svg viewBox="0 0 190 96" role="img" aria-label="Схема раскладки этикеток"><rect x="4" y="10" width="182" height="72" rx="5" fill="none" stroke="#cfd8e5"/><line x1="10" y1="87" x2="180" y2="87" stroke="#a9b5c5"/><text x="95" y="95" text-anchor="middle">полотно ${web.toLocaleString("ru-RU")} мм</text>${rects}<text x="95" y="17" text-anchor="middle">${width.toLocaleString("ru-RU")} × ${height.toLocaleString("ru-RU")} мм · ${streams} ручья · раппорт ${repeat.toLocaleString("ru-RU", {maximumFractionDigits:2})} мм</text></svg>`;
  }
  function init() {
    ensure();
    ["width","height","web","streams","repeat"].forEach(id => { $(id)?.addEventListener("input", render); $(id)?.addEventListener("change", render); });
    render();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once:true }); else init();
})();
