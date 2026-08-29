/**
 * image.js — Image Background Remover tool frontend.
 */
(function () {
  "use strict";

  var TC = window.ToolCommon;
  var form = document.getElementById("image-form");
  if (!form) return;

  var dropzone = TC.$("[data-dropzone]", form);
  var fileInput = TC.$('input[type="file"]', form);
  var originalWrap = TC.$("[data-original-wrap]");
  var originalImg = TC.$("[data-original]");
  var resetBtn = TC.$("[data-reset]", form);
  var maxBytes = parseInt(form.dataset.maxBytes || "10485760", 10);

  TC.initDropZone(dropzone, fileInput);

  /* Show original preview when a file is selected */
  if (fileInput) {
    fileInput.addEventListener("change", function () {
      if (fileInput.files && fileInput.files[0]) {
        if (fileInput.files[0].size > maxBytes) {
          form.reset();
          TC.hide(originalWrap);
          TC.showError("That image is larger than the per-file limit.");
          return;
        }
        var reader = new FileReader();
        reader.onload = function (e) {
          if (originalImg) originalImg.src = e.target.result;
          TC.show(originalWrap);
        };
        reader.readAsDataURL(fileInput.files[0]);
        TC.hideError();
        TC.hideResult();
      }
    });
  }

  /* Form submission */
  form.addEventListener("submit", async function (e) {
    e.preventDefault();
    if (!fileInput.files || !fileInput.files.length) {
      TC.showError("Please upload an image file.");
      return;
    }
    var blob = await TC.submitForm(form, "/tools/background-remover/process");
    if (blob) {
      TC.setPreview(blob, "background-removed.png");
    }
  });

  /* Reset */
  if (resetBtn) {
    resetBtn.addEventListener("click", function () {
      form.reset();
      TC.hide(originalWrap);
      if (originalImg) originalImg.removeAttribute("src");
      TC.resetTool();
    });
  }
})();
