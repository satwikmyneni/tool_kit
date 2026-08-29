/**
 * pdf.js — PDF Merger tool frontend.
 *
 * Supports drag-and-drop, multiple file selection, reordering, removing files,
 * and merging via server endpoint.
 */
(function () {
  "use strict";

  var TC = window.ToolCommon;
  var form = document.getElementById("pdf-form");
  if (!form) return;

  var dropzone = TC.$("[data-dropzone]", form);
  var fileInput = TC.$('input[type="file"]', form);
  var fileList = TC.$("[data-file-list]", form);
  var resetBtn = TC.$("[data-reset]", form);

  var files = []; // { file: File, id: number }
  var nextId = 0;
  var maxFiles = parseInt(form.dataset.maxFiles || "20", 10);
  var maxBytes = parseInt(form.dataset.maxBytes || "20971520", 10);

  TC.initDropZone(dropzone, fileInput);

  /* ---- File management ---- */

  function addFiles(newFiles) {
    TC.hideError();
    for (var i = 0; i < newFiles.length; i++) {
      var f = newFiles[i];
      if (!f.name.toLowerCase().endsWith(".pdf")) {
        TC.showError("Please choose PDF files with a .pdf extension.");
        continue;
      }
      if (f.size > maxBytes) {
        TC.showError(f.name + " is larger than the per-file limit.");
        continue;
      }
      if (files.length >= maxFiles) {
        TC.showError("You can merge up to " + maxFiles + " PDF files at a time.");
        break;
      }
      files.push({ file: f, id: nextId++ });
    }
    renderList();
  }

  function removeFile(id) {
    files = files.filter(function (item) { return item.id !== id; });
    renderList();
  }

  function moveFile(fromIndex, toIndex) {
    if (toIndex < 0 || toIndex >= files.length) return;
    var item = files.splice(fromIndex, 1)[0];
    files.splice(toIndex, 0, item);
    renderList();
  }

  function renderList() {
    fileList.innerHTML = "";
    if (files.length === 0) return;

    files.forEach(function (item, index) {
      var li = document.createElement("li");
      li.className = "file-list-item";
      li.setAttribute("draggable", "true");
      li.dataset.index = index;

      var nameSpan = document.createElement("span");
      nameSpan.className = "file-name";
      nameSpan.textContent = item.file.name;

      var sizeSpan = document.createElement("span");
      sizeSpan.className = "file-size muted";
      sizeSpan.textContent = TC.humanSize(item.file.size);

      var controls = document.createElement("span");
      controls.className = "file-controls";

      if (index > 0) {
        var upBtn = document.createElement("button");
        upBtn.type = "button";
        upBtn.className = "btn btn-ghost";
        upBtn.textContent = "↑";
        upBtn.title = "Move up";
        upBtn.setAttribute("aria-label", "Move " + item.file.name + " up");
        upBtn.addEventListener("click", function () { moveFile(index, index - 1); });
        controls.appendChild(upBtn);
      }

      if (index < files.length - 1) {
        var downBtn = document.createElement("button");
        downBtn.type = "button";
        downBtn.className = "btn btn-ghost";
        downBtn.textContent = "↓";
        downBtn.title = "Move down";
        downBtn.setAttribute("aria-label", "Move " + item.file.name + " down");
        downBtn.addEventListener("click", function () { moveFile(index, index + 1); });
        controls.appendChild(downBtn);
      }

      var removeBtn = document.createElement("button");
      removeBtn.type = "button";
      removeBtn.className = "btn btn-ghost";
      removeBtn.textContent = "✕";
      removeBtn.title = "Remove";
      removeBtn.setAttribute("aria-label", "Remove " + item.file.name);
      removeBtn.addEventListener("click", function () { removeFile(item.id); });
      controls.appendChild(removeBtn);

      li.appendChild(nameSpan);
      li.appendChild(sizeSpan);
      li.appendChild(controls);
      fileList.appendChild(li);

      /* Drag-to-reorder */
      li.addEventListener("dragstart", function (e) {
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", index.toString());
        li.classList.add("dragging");
      });
      li.addEventListener("dragend", function () {
        li.classList.remove("dragging");
      });
    });

  }

  fileList.addEventListener("dragover", function (e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  });

  fileList.addEventListener("drop", function (e) {
    e.preventDefault();
    var fromStr = e.dataTransfer.getData("text/plain");
    if (fromStr === "") return;
    var target = e.target.closest(".file-list-item");
    if (!target) return;
    moveFile(parseInt(fromStr, 10), parseInt(target.dataset.index, 10));
  });

  /* File input change */
  if (fileInput) {
    fileInput.addEventListener("change", function () {
      if (fileInput.files) {
        addFiles(fileInput.files);
        fileInput.value = "";
      }
    });
  }

  /* Form submission */
  form.addEventListener("submit", async function (e) {
    e.preventDefault();
    if (files.length < 2) {
      TC.showError("Please add at least two PDF files.");
      return;
    }

    var formData = new FormData();
    files.forEach(function (item) {
      formData.append("files", item.file);
    });

    var blob = await TC.submitForm(form, "/tools/pdf-merger/merge", { body: formData });
    if (blob) {
      TC.setDownload(blob, "merged-pdf.pdf");
    }
  });

  /* Reset */
  if (resetBtn) {
    resetBtn.addEventListener("click", function () {
      files = [];
      nextId = 0;
      renderList();
      form.reset();
      TC.resetTool();
    });
  }
})();
