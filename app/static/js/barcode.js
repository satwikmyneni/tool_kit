(function () {
  "use strict";

  var TC = window.ToolCommon;
  var form = document.getElementById("barcode-form");
  if (!form) return;

  var resetBtn = TC.$("[data-reset]", form);
  var textInput = TC.$("#barcode-text", form);
  var counter = TC.$("[data-count]", form);

  TC.initCharacterCounter(textInput, counter);

  form.addEventListener("submit", async function (e) {
    e.preventDefault();
    var blob = await TC.submitForm(form, "/tools/barcode-generator/generate");
    if (blob) {
      TC.setPreview(blob, "toolbox-barcode.png");
    }
  });

  if (resetBtn) {
    resetBtn.addEventListener("click", function () {
      form.reset();
      if (counter) counter.textContent = "0";
      TC.resetTool();
    });
  }
})();
