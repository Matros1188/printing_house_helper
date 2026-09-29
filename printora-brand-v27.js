/* ============================================================
   PRINTORA V27 — VISIBLE BRAND CLEANUP
   ============================================================ */
(function () {
  "use strict";

  function replaceText(node) {
    if (!node || node.nodeType !== Node.TEXT_NODE) return;
    var value = node.nodeValue || "";
    if (!/printcalc/i.test(value)) return;
    node.nodeValue = value
      .replace(/PRINTCALC\s+FLEXO/gi, "PRINTORA")
      .replace(/PRINTCALC/gi, "PRINTORA")
      .replace(/PrintCalc/gi, "PRINTORA");
  }

  function cleanVisibleBrand() {
    document.querySelectorAll("*").forEach(function (el) {
      if (el.closest("script, style, textarea, code")) return;
      el.childNodes.forEach(replaceText);
    });

    document.querySelectorAll(
      "[alt], [title], [aria-label], [placeholder]"
    ).forEach(function (el) {
      ["alt", "title", "aria-label", "placeholder"].forEach(function (attr) {
        if (!el.hasAttribute(attr)) return;
        var value = el.getAttribute(attr) || "";
        if (/printcalc/i.test(value)) {
          el.setAttribute(
            attr,
            value
              .replace(/PRINTCALC\s+FLEXO/gi, "PRINTORA")
              .replace(/PRINTCALC/gi, "PRINTORA")
              .replace(/PrintCalc/gi, "PRINTORA")
          );
        }
      });
    });

    document.title = "PRINTORA — расчёт и экономика типографии";
  }

  function boot() {
    cleanVisibleBrand();
    setTimeout(cleanVisibleBrand, 200);
    setTimeout(cleanVisibleBrand, 900);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();