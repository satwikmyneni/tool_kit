(function () {
  "use strict";
  var TC = window.ToolCommon; var form = document.getElementById("pdf-utility-form"); if (!form) return;
  var slug = form.dataset.toolSlug; var input = document.getElementById("utility-files"); var reset = form.querySelector("[data-reset]"); var inspectButton = form.querySelector("[data-inspect]"); var details = document.querySelector("[data-details]"); var download = document.querySelector("[data-download]"); var files = []; var nextId = 0;
  var names = { "pdf-compressor": "compressed-pdf.pdf", "images-to-pdf": "images-to-pdf.pdf", "rotate-pdf": "rotated-pdf.pdf", "delete-pdf-pages": "pages-deleted.pdf", "extract-pdf-pages": "extracted-pages.pdf", "reorder-pdf-pages": "reordered-pages.pdf", "pdf-metadata": "metadata-updated.pdf", "protect-pdf": "protected-pdf.pdf", "unlock-pdf": "unlocked-pdf.pdf" };
  TC.initDropZone(form.querySelector("[data-dropzone]"), input);
  var managerRoot = form.querySelector("[data-page-manager]");
  var pageManager = managerRoot && window.PdfPageManager ? new window.PdfPageManager(managerRoot, input, { mode: slug }) : null;
  var splitMode = document.getElementById("split-mode");
  if (splitMode && managerRoot) splitMode.addEventListener("change", function () {
    managerRoot.hidden = splitMode.value !== "selected" || !pageManager.pages.length;
    var advanced = form.querySelector(".advanced-options");
    if (advanced && splitMode.value === "ranges") advanced.open = true;
  });

  function size(bytes) { return TC.humanSize(bytes); }
  function currentUpload() { return input && input.files ? input.files[0] : null; }

  if (slug === "images-to-pdf") {
    var list = form.querySelector("[data-file-list]"); var maxFiles = Number(form.dataset.maxFiles || 20);
    input.addEventListener("change", function () { Array.prototype.forEach.call(input.files || [], function (file) { if (files.length < maxFiles) files.push({ id: nextId++, file: file }); }); input.value = ""; renderFiles(); });
    function move(index, offset) { var target = index + offset; if (target < 0 || target >= files.length) return; var item = files.splice(index, 1)[0]; files.splice(target, 0, item); renderFiles(); }
    function renderFiles() { list.innerHTML = ""; files.forEach(function (item, index) { var row = document.createElement("li"); row.className = "file-list-item"; var name = document.createElement("span"); name.className = "file-name"; name.textContent = item.file.name; var controls = document.createElement("span"); controls.className = "file-controls"; [["↑", -1, "Move up"], ["↓", 1, "Move down"]].forEach(function (config) { var button = document.createElement("button"); button.type = "button"; button.className = "btn btn-ghost"; button.textContent = config[0]; button.title = config[2]; button.disabled = index + config[1] < 0 || index + config[1] >= files.length; button.onclick = function () { move(index, config[1]); }; controls.appendChild(button); }); var remove = document.createElement("button"); remove.type = "button"; remove.className = "btn btn-ghost"; remove.textContent = "Remove"; remove.onclick = function () { files = files.filter(function (other) { return other.id !== item.id; }); renderFiles(); }; controls.appendChild(remove); row.append(name, controls); list.appendChild(row); }); }
  }

  async function inspectPDF() {
    if (!currentUpload()) { TC.showError("Choose a PDF file."); return; }
    TC.showLoading();
    try {
      var response = await fetch("/tools/" + slug + "/inspect", { method: "POST", body: new FormData(form), headers: { "X-CSRFToken": document.querySelector('meta[name="csrf-token"]').content, "X-Requested-With": "Toolbox" } });
      var payload = await response.json(); if (!response.ok) throw new Error(payload.error || "Unable to inspect this PDF.");
      TC.hideLoading();
      if (slug === "pdf-metadata") ["title", "author", "subject", "creator"].forEach(function (key) { document.getElementById(key).value = payload[key] || ""; });
      details.innerHTML = '<dl class="info-list">' + Object.keys(payload).map(function (key) { var value = key === "file_size" ? size(payload[key]) : payload[key] === null || payload[key] === "" ? "Not set" : String(payload[key]); return '<dt>' + key.replace(/_/g, " ") + '</dt><dd></dd>'; }).join("") + '</dl>';
      var values = Object.keys(payload); details.querySelectorAll("dd").forEach(function (node, index) { var key = values[index]; node.textContent = key === "file_size" ? size(payload[key]) : payload[key] === null || payload[key] === "" ? "Not set" : String(payload[key]); });
      download.hidden = true; TC.showResult();
    } catch (error) { TC.showError(error.message); }
  }

  if (inspectButton) inspectButton.addEventListener("click", inspectPDF);
  form.addEventListener("submit", async function (event) {
    event.preventDefault();
    if (slug === "pdf-inspector") return inspectPDF();
    var body;
    if (slug === "images-to-pdf") {
      if (!files.length) return TC.showError("Add at least one image.");
      body = new FormData(); files.forEach(function (item) { body.append("images", item.file); }); ["page_size", "orientation", "margin", "fit"].forEach(function (key) { body.append(key, form.elements[key].value); });
    } else if (!currentUpload()) return TC.showError("Choose a PDF file.");
    if (["delete-pdf-pages", "extract-pdf-pages", "reorder-pdf-pages"].indexOf(slug) !== -1 && !form.elements.pages.value.trim()) return TC.showError("Select at least one page.");
    if (slug === "rotate-pdf" && pageManager && pageManager.pages.length && !form.elements.rotations.value && !form.querySelector(".advanced-options").open) return TC.showError("Rotate a page in the preview, or open Advanced uniform rotation.");
    var originalSize = slug === "images-to-pdf" ? files.reduce(function (total, item) { return total + item.file.size; }, 0) : currentUpload().size;
    var blob = await TC.submitForm(form, "/tools/" + slug + "/process", body ? { body: body } : undefined);
    if (!blob) return;
    var filename = names[slug] || (blob.type === "application/zip" ? "split-pdf-pages.zip" : "extracted-pages.pdf");
    TC.setDownload(blob, filename); download.hidden = false;
    var copy = "File ready · " + size(blob.size); if (slug === "pdf-compressor") { var saved = originalSize ? (1 - blob.size / originalSize) * 100 : 0; copy += saved > 0 ? " · " + saved.toFixed(1) + "% smaller" : " · no size reduction for this PDF"; }
    details.textContent = copy;
  });

  function resetAll() { files = []; var list = form.querySelector("[data-file-list]"); if (list) list.innerHTML = ""; form.reset(); if (pageManager) pageManager.reset(); TC.resetTool(); details.textContent = ""; download.hidden = false; }
  reset.addEventListener("click", resetAll); var again = document.querySelector("[data-start-again]"); if (again) again.addEventListener("click", resetAll);
})();
