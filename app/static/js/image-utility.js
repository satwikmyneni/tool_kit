(function () {
  "use strict";
  var TC = window.ToolCommon; var form = document.getElementById("image-utility-form"); if (!form) return;
  var slug = form.dataset.toolSlug; var input = document.getElementById("image-file"); var sourceWrap = form.querySelector("[data-source-preview]"); var sourceImage = form.querySelector("[data-source-image]"); var details = document.querySelector("[data-details]"); var download = document.querySelector("[data-download]"); var outputPreview = document.querySelector("[data-preview]"); var outputWrap = outputPreview ? outputPreview.closest(".preview-row") : null; var sourceUrl = null;
  TC.initDropZone(form.querySelector("[data-dropzone]"), input);

  var quality = document.getElementById("quality"); if (quality) quality.addEventListener("input", function () { var output = form.querySelector("[data-quality]"); if (output) output.textContent = quality.value; });
  var aspect = form.querySelector("[data-aspect]"); var upscale = form.querySelector("[data-upscale]"); if (aspect) aspect.onchange = function () { form.elements.keep_aspect.value = aspect.checked ? "true" : "false"; }; if (upscale) upscale.onchange = function () { form.elements.allow_upscale.value = upscale.checked ? "true" : "false"; };

  input.addEventListener("change", function () {
    var file = input.files[0]; if (!file) return; if (file.size > Number(form.dataset.maxBytes)) { form.reset(); return TC.showError("That image is larger than the per-file limit."); }
    if (sourceUrl) URL.revokeObjectURL(sourceUrl); sourceUrl = URL.createObjectURL(file); sourceImage.src = sourceUrl; sourceWrap.hidden = false;
    sourceImage.onload = function () { if (slug === "image-cropper") { document.getElementById("width").value = sourceImage.naturalWidth; document.getElementById("height").value = sourceImage.naturalHeight; } };
    TC.hideError(); TC.hideResult();
  });

  var inspect = form.querySelector("[data-inspect]");
  if (inspect) inspect.onclick = async function () {
    if (!input.files[0]) return TC.showError("Choose an image file."); TC.showLoading();
    try {
      var response = await fetch("/tools/image-metadata/inspect", { method: "POST", body: new FormData(form), headers: { "X-CSRFToken": document.querySelector('meta[name="csrf-token"]').content, "X-Requested-With": "Toolbox" } });
      var payload = await response.json(); if (!response.ok) throw new Error(payload.error || "Unable to inspect the image."); TC.hideLoading();
      details.innerHTML = ""; var list = document.createElement("dl"); list.className = "info-list"; Object.keys(payload).forEach(function (key) { var term = document.createElement("dt"); term.textContent = key.replace(/_/g, " "); var value = document.createElement("dd"); value.textContent = key === "file_size" ? TC.humanSize(payload[key]) : key === "exif" ? (Object.keys(payload.exif).length ? JSON.stringify(payload.exif, null, 2) : "No EXIF entries") : String(payload[key]); list.append(term, value); }); details.appendChild(list); if (outputWrap) outputWrap.hidden = true; download.hidden = true; TC.showResult();
    } catch (error) { TC.showError(error.message); }
  };

  form.addEventListener("submit", async function (event) {
    event.preventDefault(); var file = input.files[0]; if (!file) return TC.showError("Choose an image file.");
    var blob = await TC.submitForm(form, "/tools/" + slug + "/process"); if (!blob) return;
    var suffix = blob.type === "image/jpeg" ? ".jpg" : blob.type === "image/webp" ? ".webp" : ".png"; TC.setPreview(blob, "toolbox-image" + suffix); download.hidden = false; if (outputWrap) outputWrap.hidden = false;
    var saved = file.size ? (1 - blob.size / file.size) * 100 : 0; details.textContent = "Original: " + TC.humanSize(file.size) + " · Result: " + TC.humanSize(blob.size) + (saved > 0 ? " · " + saved.toFixed(1) + "% smaller" : "");
  });

  function resetAll() { form.reset(); if (sourceUrl) URL.revokeObjectURL(sourceUrl); sourceUrl = null; sourceImage.removeAttribute("src"); sourceWrap.hidden = true; if (outputWrap) outputWrap.hidden = false; TC.resetTool(); }
  form.querySelector("[data-reset]").onclick = resetAll; var again = document.querySelector("[data-start-again]"); if (again) again.onclick = resetAll;
})();
