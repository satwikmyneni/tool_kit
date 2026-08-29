/**
 * qr.js — QR Code Generator tool frontend.
 */
(function () {
  "use strict";

  var TC = window.ToolCommon;
  var form = document.getElementById("qr-form");
  if (!form) return;

  var resetBtn = TC.$("[data-reset]", form);
  var textInput = TC.$("#qr-text", form);
  var counter = TC.$("[data-count]", form);

  TC.initCharacterCounter(textInput, counter);

  form.addEventListener("submit", async function (e) {
    e.preventDefault();
    var blob = await TC.submitForm(form, "/tools/qr-generator/generate");
    if (blob) {
      TC.setPreview(blob, "toolbox-qr-code.png");
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
