(function () {
  "use strict";
  var TC = window.ToolCommon;
  var form = document.getElementById("document-conversion-form");
  if (!form) return;
  var slug = form.dataset.toolSlug;
  var input = document.getElementById("conversion-file");
  var imageMode = slug === "jpg-to-pdf" || slug === "png-to-pdf";
  var images = [];
  var nextId = 0;
  var maxFiles = Number(form.dataset.maxFiles || 20);
  var details = document.querySelector("[data-details]");
  var download = document.querySelector("[data-download]");
  var filenames = {
    "pdf-to-jpg": "pdf-pages-jpg.zip", "pdf-to-png": "pdf-pages-png.zip",
    "pdf-to-word": "converted-document.docx", "pdf-to-excel": "extracted-tables.xlsx",
    "pdf-to-powerpoint": "pdf-pages.pptx", "word-to-pdf": "converted-document.pdf",
    "excel-to-pdf": "converted-document.pdf", "powerpoint-to-pdf": "converted-document.pdf",
    "jpg-to-pdf": "jpg-to-pdf.pdf", "png-to-pdf": "png-to-pdf.pdf"
  };

  TC.initDropZone(form.querySelector("[data-dropzone]"), input);
  var managerRoot = form.querySelector("[data-page-manager]");
  var pageManager = managerRoot && window.PdfPageManager ? new window.PdfPageManager(managerRoot, input, { mode: "extract-pdf-pages" }) : null;

  function moveImage(index, offset) {
    var target = index + offset;
    if (target < 0 || target >= images.length) return;
    var item = images.splice(index, 1)[0];
    images.splice(target, 0, item);
    renderImages();
  }

  function renderImages() {
    var list = form.querySelector("[data-file-list]");
    if (!list) return;
    list.innerHTML = "";
    images.forEach(function (item, index) {
      var row = document.createElement("li");
      row.className = "file-list-item";
      var name = document.createElement("span");
      name.className = "file-name";
      name.textContent = item.file.name;
      var fileSize = document.createElement("span");
      fileSize.className = "file-size muted";
      fileSize.textContent = TC.humanSize(item.file.size);
      var controls = document.createElement("span");
      controls.className = "file-controls";
      [["Up", -1], ["Down", 1]].forEach(function (action) {
        var control = document.createElement("button");
        control.type = "button";
        control.className = "btn btn-ghost";
        control.textContent = action[0];
        control.disabled = index + action[1] < 0 || index + action[1] >= images.length;
        control.addEventListener("click", function () { moveImage(index, action[1]); });
        controls.appendChild(control);
      });
      var remove = document.createElement("button");
      remove.type = "button";
      remove.className = "btn btn-ghost";
      remove.textContent = "Remove";
      remove.addEventListener("click", function () {
        images = images.filter(function (other) { return other.id !== item.id; });
        renderImages();
      });
      controls.appendChild(remove);
      row.append(name, fileSize, controls);
      list.appendChild(row);
    });
  }

  if (imageMode) input.addEventListener("change", function () {
    Array.prototype.forEach.call(input.files || [], function (file) {
      if (images.length < maxFiles) images.push({ id: nextId++, file: file });
    });
    input.value = "";
    renderImages();
  });

  form.addEventListener("submit", async function (event) {
    event.preventDefault();
    var body;
    if (imageMode) {
      if (!images.length) return TC.showError("Choose at least one image.");
      body = new FormData();
      images.forEach(function (item) { body.append("images", item.file); });
      ["page_size", "orientation", "margin", "fit"].forEach(function (name) { body.append(name, form.elements[name].value); });
    } else if (!input.files || !input.files[0]) {
      return TC.showError("Choose a file to convert.");
    }
    var blob = await TC.submitForm(form, form.dataset.processUrl, body ? { body: body } : undefined);
    if (!blob) return;
    var filename = filenames[slug];
    if ((slug === "pdf-to-jpg" || slug === "pdf-to-png") && blob.type.indexOf("image/") === 0) {
      filename = "pdf-page-1." + (slug === "pdf-to-jpg" ? "jpg" : "png");
    }
    TC.setDownload(blob, filename);
    details.textContent = "Converted file - " + TC.humanSize(blob.size);
  });

  function resetAll() {
    images = [];
    nextId = 0;
    renderImages();
    form.reset();
    if (pageManager) pageManager.reset();
    if (details) details.textContent = "";
    TC.resetTool();
  }
  form.querySelector("[data-reset]").addEventListener("click", resetAll);
  var again = document.querySelector("[data-start-again]");
  if (again) again.addEventListener("click", resetAll);
})();
