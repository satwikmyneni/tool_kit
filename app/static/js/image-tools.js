(function () {
  "use strict";
  var C = window.ClientCommon; var ui = C.initialize();
  if (!ui || ui.root.dataset.toolGroup !== "image" || ui.slug !== "image-color-picker") return;
  ui.app.innerHTML = '<div class="upload-area"><label class="field-label" for="color-image">Image</label><p>Select a PNG, JPEG, WEBP, or GIF. It stays in this browser.</p><input class="field-input" id="color-image" type="file" accept="image/png,image/jpeg,image/webp,image/gif" required></div><div class="canvas-wrap" data-canvas-wrap hidden><canvas data-canvas aria-label="Selected image. Click a pixel to inspect its color."></canvas><p class="field-hint">Click or tap the image to pick a pixel.</p></div><div class="result-panel" data-color-result hidden aria-live="polite"><div class="color-chip" data-chip></div><p class="client-result-value" data-hex></p><p data-rgb></p><button class="btn btn-secondary" type="button" data-copy>Copy HEX</button></div>';
  var input = document.getElementById("color-image"); var wrap = ui.app.querySelector("[data-canvas-wrap]"); var canvas = ui.app.querySelector("[data-canvas]"); var context = canvas.getContext("2d", { willReadFrequently: true }); var colorResult = ui.app.querySelector("[data-color-result]"); var currentHex = "";
  input.onchange = function () {
    var file = input.files[0]; if (!file) return; if (file.size > 20 * 1024 * 1024) { input.value = ""; return ui.showError("Choose an image smaller than 20 MB."); }
    var url = URL.createObjectURL(file); var image = new Image();
    image.onload = function () { var scale = Math.min(1, 2000 / Math.max(image.naturalWidth, image.naturalHeight)); canvas.width = Math.max(1, Math.round(image.naturalWidth * scale)); canvas.height = Math.max(1, Math.round(image.naturalHeight * scale)); context.drawImage(image, 0, 0, canvas.width, canvas.height); URL.revokeObjectURL(url); wrap.hidden = false; colorResult.hidden = true; ui.clear(); };
    image.onerror = function () { URL.revokeObjectURL(url); ui.showError("This browser could not decode the selected image."); };
    image.src = url;
  };
  canvas.onclick = function (event) { var rect = canvas.getBoundingClientRect(); var x = Math.min(canvas.width - 1, Math.max(0, Math.floor((event.clientX - rect.left) * canvas.width / rect.width))); var y = Math.min(canvas.height - 1, Math.max(0, Math.floor((event.clientY - rect.top) * canvas.height / rect.height))); var pixel = context.getImageData(x, y, 1, 1).data; currentHex = "#" + [pixel[0], pixel[1], pixel[2]].map(function (item) { return item.toString(16).padStart(2, "0"); }).join(""); ui.app.querySelector("[data-chip]").style.background = "rgba(" + pixel.join(",") + ")"; ui.app.querySelector("[data-hex]").textContent = currentHex; ui.app.querySelector("[data-rgb]").textContent = "rgba(" + pixel[0] + ", " + pixel[1] + ", " + pixel[2] + ", " + (pixel[3] / 255).toFixed(3) + ") at x " + x + ", y " + y; colorResult.hidden = false; };
  ui.app.querySelector("[data-copy]").onclick = function () { C.copyText(currentHex, this).catch(function (error) { ui.showError(error.message); }); };
})();
