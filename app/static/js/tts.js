/**
 * tts.js — Text to Speech tool frontend.
 */
(function () {
  "use strict";

  var TC = window.ToolCommon;
  var form = document.getElementById("tts-form");
  if (!form) return;

  var textarea = TC.$("#tts-text", form);
  var counter = TC.$("[data-count]");
  var resetBtn = TC.$("[data-reset]", form);

  TC.initCharacterCounter(textarea, counter);

  /* Form submission */
  form.addEventListener("submit", async function (e) {
    e.preventDefault();
    var blob = await TC.submitForm(form, "/tools/text-to-speech/generate");
    if (blob) {
      TC.setAudio(blob, "toolbox-speech.mp3");
    }
  });

  /* Reset */
  if (resetBtn) {
    resetBtn.addEventListener("click", function () {
      form.reset();
      if (counter) counter.textContent = "0";
      TC.resetTool();
    });
  }
})();
