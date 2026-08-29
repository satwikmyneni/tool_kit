/**
 * gif.js — GIF Maker tool frontend.
 *
 * Supports drag-and-drop, thumbnails, reordering, removing frames,
 * and creating GIF via server endpoint.
 */
(function () {
  "use strict";

  var TC = window.ToolCommon;
  var form = document.getElementById("gif-form");
  if (!form) return;

  var dropzone = TC.$("[data-dropzone]", form);
  var fileInput = TC.$('input[type="file"]', form);
  var thumbList = TC.$("[data-file-list]", form);
  var resetBtn = TC.$("[data-reset]", form);

  var frames = []; // { file: File, id: number, thumbUrl: string }
  var nextId = 0;
  var maxFiles = parseInt(form.dataset.maxFiles || "24", 10);
  var maxBytes = parseInt(form.dataset.maxBytes || "10485760", 10);

  TC.initDropZone(dropzone, fileInput);

  /* ---- Frame management ---- */

  function addFiles(newFiles) {
    TC.hideError();
    for (var i = 0; i < newFiles.length; i++) {
      var f = newFiles[i];
      if (!/^image\/(png|jpe?g|webp)$/i.test(f.type)) {
        TC.showError("Please choose PNG, JPEG, or WEBP images.");
        continue;
      }
      if (f.size > maxBytes) {
        TC.showError(f.name + " is larger than the per-file limit.");
        continue;
      }
      if (frames.length >= maxFiles) {
        TC.showError("You can use up to " + maxFiles + " images in one GIF.");
        break;
      }
      var thumbUrl = URL.createObjectURL(f);
      frames.push({ file: f, id: nextId++, thumbUrl: thumbUrl });
    }
    renderList();
  }

  function removeFrame(id) {
    frames = frames.filter(function (item) {
      if (item.id === id) {
        URL.revokeObjectURL(item.thumbUrl);
        return false;
      }
      return true;
    });
    renderList();
  }

  function moveFrame(fromIndex, toIndex) {
    if (toIndex < 0 || toIndex >= frames.length) return;
    var item = frames.splice(fromIndex, 1)[0];
    frames.splice(toIndex, 0, item);
    renderList();
  }

  function renderList() {
    thumbList.innerHTML = "";
    if (frames.length === 0) return;

    frames.forEach(function (item, index) {
      var li = document.createElement("li");
      li.className = "thumb-item";
      li.setAttribute("draggable", "true");
      li.dataset.index = index;

      var img = document.createElement("img");
      img.src = item.thumbUrl;
      img.alt = "Frame " + (index + 1);
      img.className = "thumb-img";

      var label = document.createElement("span");
      label.className = "thumb-label muted";
      label.textContent = (index + 1) + ". " + item.file.name;

      var controls = document.createElement("span");
      controls.className = "thumb-controls";

      if (index > 0) {
        var upBtn = document.createElement("button");
        upBtn.type = "button";
        upBtn.className = "btn btn-ghost";
        upBtn.textContent = "↑";
        upBtn.title = "Move up";
        upBtn.setAttribute("aria-label", "Move frame " + (index + 1) + " up");
        upBtn.addEventListener("click", function () { moveFrame(index, index - 1); });
        controls.appendChild(upBtn);
      }

      if (index < frames.length - 1) {
        var downBtn = document.createElement("button");
        downBtn.type = "button";
        downBtn.className = "btn btn-ghost";
        downBtn.textContent = "↓";
        downBtn.title = "Move down";
        downBtn.setAttribute("aria-label", "Move frame " + (index + 1) + " down");
        downBtn.addEventListener("click", function () { moveFrame(index, index + 1); });
        controls.appendChild(downBtn);
      }

      var removeBtn = document.createElement("button");
      removeBtn.type = "button";
      removeBtn.className = "btn btn-ghost";
      removeBtn.textContent = "✕";
      removeBtn.title = "Remove";
      removeBtn.setAttribute("aria-label", "Remove frame " + (index + 1));
      removeBtn.addEventListener("click", function () { removeFrame(item.id); });
      controls.appendChild(removeBtn);

      li.appendChild(img);
      li.appendChild(label);
      li.appendChild(controls);
      thumbList.appendChild(li);

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

  thumbList.addEventListener("dragover", function (e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  });

  thumbList.addEventListener("drop", function (e) {
    e.preventDefault();
    var fromStr = e.dataTransfer.getData("text/plain");
    if (fromStr === "") return;
    var target = e.target.closest(".thumb-item");
    if (!target) return;
    moveFrame(parseInt(fromStr, 10), parseInt(target.dataset.index, 10));
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
    if (frames.length < 2) {
      TC.showError("Please add at least two images.");
      return;
    }

    var formData = new FormData();
    frames.forEach(function (item) {
      formData.append("files", item.file);
    });
    formData.append("duration", TC.$("#gif-duration", form).value || "400");
    formData.append("width", TC.$("#gif-width", form).value || "480");
    formData.append("height", TC.$("#gif-height", form).value || "320");
    formData.append("loop", TC.$("#gif-loop", form).value || "1");

    var blob = await TC.submitForm(form, "/tools/gif-maker/create", { body: formData });
    if (blob) {
      TC.setPreview(blob, "toolbox-animation.gif");
    }
  });

  /* Reset */
  if (resetBtn) {
    resetBtn.addEventListener("click", function () {
      frames.forEach(function (item) { URL.revokeObjectURL(item.thumbUrl); });
      frames = [];
      nextId = 0;
      renderList();
      form.reset();
      TC.resetTool();
    });
  }
})();
