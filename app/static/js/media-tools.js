(function () {
  "use strict";
  var C = window.ClientCommon; var ui = C.initialize();
  if (!ui || ui.root.dataset.toolGroup !== "media" || ui.slug !== "audio-format-information") return;
  ui.app.innerHTML = '<form><div class="upload-area"><label class="field-label" for="audio-file">Audio file</label><p>Select a file to inspect locally. The browser decodes duration when it supports the format.</p><input class="field-input" id="audio-file" type="file" accept="audio/*" required></div><div class="tool-actions"><button class="btn btn-primary" type="submit">Inspect audio</button><button class="btn btn-ghost" type="reset">Reset</button></div></form>';
  var form = ui.app.querySelector("form"); var audioUrl = null;
  form.onsubmit = function (event) {
    event.preventDefault(); var file = document.getElementById("audio-file").files[0]; if (!file) return ui.showError("Choose an audio file.");
    if (audioUrl) URL.revokeObjectURL(audioUrl); audioUrl = URL.createObjectURL(file); var audio = new Audio(); audio.preload = "metadata";
    audio.onloadedmetadata = function () { var duration = Number.isFinite(audio.duration) ? audio.duration : 0; ui.showHTML('<h2>Audio information</h2><dl class="info-list"><dt>Name</dt><dd>' + C.escapeHTML(file.name) + '</dd><dt>Browser type</dt><dd>' + C.escapeHTML(file.type || "Unknown") + '</dd><dt>Size</dt><dd>' + C.formatNumber(file.size / 1024, 2) + ' KB</dd><dt>Duration</dt><dd>' + Math.floor(duration / 60) + ':' + String(Math.round(duration % 60)).padStart(2, '0') + '</dd></dl><p class="field-hint">Format and duration are browser-reported; no file was uploaded.</p>'); URL.revokeObjectURL(audioUrl); audioUrl = null; };
    audio.onerror = function () { URL.revokeObjectURL(audioUrl); audioUrl = null; ui.showError("This browser could not read the selected audio format."); };
    audio.src = audioUrl;
  };
  form.onreset = function () { if (audioUrl) URL.revokeObjectURL(audioUrl); audioUrl = null; setTimeout(ui.clear, 0); };
})();
