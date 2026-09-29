(() => {
  "use strict";

  const PDFMAKE_URL = "https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.3.11/pdfmake.min.js";
  const PDFVFS_URL = "https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.3.11/vfs_fonts.js";

  let pdfLoading = null;

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const existing = document.querySelector(`script[src^="${src}"]`);
      if (existing) {
        if (window.pdfMake) resolve();
        else existing.addEventListener("load", resolve, { once: true });
        return;
      }

      const script = document.createElement("script");
      script.src = src;
      script.async = true;
      script.onload = resolve;
      script.onerror = () => reject(new Error("Не удалось загрузить PDF-модуль."));
      document.head.appendChild(script);
    });
  }

  async function ensurePdfMake() {
    if (window.pdfMake) return window.pdfMake;

    if (!pdfLoading) {
      pdfLoading = (async () => {
        await loadScript(PDFMAKE_URL);
        await loadScript(PDFVFS_URL);
        return window.pdfMake;
      })();
    }

    return pdfLoading;
  }

  function money(value) {
    return Math.round(Number(value || 0)).toLocaleString("ru-RU") + " ₽";
  }

  function num(value) {
    return Number(value || 0).toLocaleString("ru-RU", { maximumFractionDigits: 2 });
  }

  function today() {
    return new Date().toLocaleDateString("ru-RU");
  }

  function getCompanyName() {
    try {
      return localStorage.getItem("printcalc_company_name") || "Ваша типография";
    } catch (error) {
      return "Ваша типография";
    }
  }

  function getCompanyContact() {
    try {
      return localStorage.getItem("printcalc_company_contact") || "";
    } catch (error) {
      return "";
    }
  }

  function makeFileName(data) {
    const mode = data?.mode === "detail" ? "detalnoe" : "bystroe";
    return `PRINTCALC_${mode}_${new Date().toISOString().slice(0,10)}.pdf`;
  }

  function buildDocument(data) {
    const summary = data?.summary || {};
    const inputs = data?.inputs || {};
    const company = getCompanyName();
    const contact = getCompanyContact();

    const quantity = summary.qty || inputs.qty || 0;
    const width = summary.width || inputs.width || 0;
    const height = summary.height || inputs.height || 0;
    const material = inputs.materialName || "Материал по расчёту";

    const body = [
      [
        { text: "Показатель", style: "tableHead" },
        { text: "Значение", style: "tableHead", alignment: "right" }
      ],
      ["Тираж", `${num(quantity)} шт.`],
      ["Размер", `${num(width)} × ${num(height)} мм`],
      ["Метраж", `${num(summary.meters)} м`],
      ["Площадь", `${num(summary.area)} м²`],
      ["Материал", material]
    ];

    if (data.mode === "detail") {
      body.push([
        "Дополнительная обработка",
        [
          summary.lamCost > 0 ? "Ламинация" : "",
          summary.dieCost > 0 ? "Вырубка" : ""
        ].filter(Boolean).join(", ") || "Не указана"
      ]);
    }

    body.push([
      { text: "Цена заказа", bold: true },
      { text: money(summary.price), bold: true, alignment: "right" }
    ]);

    body.push([
      "Цена за 1000 шт.",
      { text: money(summary.pricePer1000), alignment: "right" }
    ]);

    body.push([
      "Цена за 1 м²",
      { text: money(summary.pricePerM2), alignment: "right" }
    ]);

    return {
      pageSize: "A4",
      pageMargins: [42, 42, 42, 42],
      defaultStyle: {
        font: "Roboto",
        fontSize: 10,
        color: "#172033"
      },
      footer: function(currentPage, pageCount) {
        return {
          margin: [42, 0, 42, 20],
          columns: [
            { text: company, color: "#718096", fontSize: 8 },
            { text: `${currentPage} / ${pageCount}`, alignment: "right", color: "#718096", fontSize: 8 }
          ]
        };
      },
      content: [
        {
          columns: [
            {
              stack: [
                { text: "PRINTCALC", style: "brand" },
                { text: "FLEXO", style: "brandAccent" }
              ],
              width: "*"
            },
            {
              stack: [
                { text: "КОММЕРЧЕСКОЕ ПРЕДЛОЖЕНИЕ", style: "proposalLabel", alignment: "right" },
                { text: today(), style: "date", alignment: "right" }
              ],
              width: 210
            }
          ]
        },

        {
          canvas: [
            { type: "line", x1: 0, y1: 12, x2: 511, y2: 12, lineWidth: 1, lineColor: "#dfe4ec" }
          ],
          margin: [0, 12, 0, 20]
        },

        { text: "Предложение на изготовление", style: "title" },
        { text: company, style: "company" },
        contact ? { text: contact, style: "contact" } : null,
        { text: "", margin: [0, 4] },

        {
          table: {
            headerRows: 1,
            widths: ["*", 180],
            body
          },
          layout: {
            fillColor: function(rowIndex) {
              return rowIndex === 0 ? "#f3f5f8" : null;
            },
            hLineColor: function() { return "#e5e9f0"; },
            vLineColor: function() { return "#e5e9f0"; },
            paddingLeft: function() { return 9; },
            paddingRight: function() { return 9; },
            paddingTop: function() { return 8; },
            paddingBottom: function() { return 8; }
          }
        },

        {
          margin: [0, 22, 0, 0],
          columns: [
            {
              width: "*",
              stack: [
                { text: "К расчёту", style: "smallLabel" },
                { text: data.title || "Заказ", style: "orderTitle" }
              ]
            },
            {
              width: 190,
              alignment: "right",
              stack: [
                { text: "ИТОГО", style: "totalLabel", alignment: "right" },
                { text: money(summary.price), style: "totalValue", alignment: "right" }
              ]
            }
          ]
        },

        {
          margin: [0, 22, 0, 0],
          table: {
            widths: [10, "*"],
            body: [[
              { text: "", fillColor: "#2563eb" },
              { text: "Цена указана для указанной спецификации. Сроки, доставка и окончательные условия согласовываются при подтверждении заказа.", style: "note" }
            ]]
          },
          layout: "noBorders"
        }
      ].filter(Boolean),
      styles: {
        brand: {
          fontSize: 20,
          bold: true,
          color: "#172033",
          characterSpacing: 0.3
        },
        brandAccent: {
          fontSize: 11,
          bold: true,
          color: "#2563eb",
          characterSpacing: 2
        },
        proposalLabel: {
          fontSize: 8,
          bold: true,
          color: "#2563eb",
          characterSpacing: 1.2
        },
        date: {
          fontSize: 8,
          color: "#718096",
          margin: [0, 5, 0, 0]
        },
        title: {
          fontSize: 22,
          bold: true,
          color: "#172033",
          margin: [0, 0, 0, 8]
        },
        company: {
          fontSize: 11,
          bold: true,
          color: "#172033"
        },
        contact: {
          fontSize: 9,
          color: "#718096",
          margin: [0, 3, 0, 0]
        },
        tableHead: {
          fontSize: 9,
          bold: true,
          color: "#172033"
        },
        smallLabel: {
          fontSize: 8,
          bold: true,
          color: "#718096",
          characterSpacing: 0.7
        },
        orderTitle: {
          fontSize: 11,
          bold: true,
          margin: [0, 4, 0, 0]
        },
        totalLabel: {
          fontSize: 8,
          bold: true,
          color: "#718096",
          characterSpacing: 0.7
        },
        totalValue: {
          fontSize: 20,
          bold: true,
          color: "#2563eb",
          margin: [0, 4, 0, 0]
        },
        note: {
          fontSize: 8,
          color: "#718096",
          lineHeight: 1.35,
          margin: [10, 0, 0, 0]
        }
      }
    };
  }

  window.PRINTCALC_GENERATE_PDF = async function(data) {
    if (!data?.summary) return;

    try {
      const pdfMake = await ensurePdfMake();
      if (!pdfMake) throw new Error("PDF-модуль не загрузился.");
      pdfMake.createPdf(buildDocument(data)).download(makeFileName(data));
    } catch (error) {
      console.error("PRINTCALC PDF:", error);
      alert("Не удалось сформировать PDF. Проверьте интернет-соединение и попробуйте ещё раз.");
    }
  };
})();
