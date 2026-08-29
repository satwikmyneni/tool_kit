(function () {
  "use strict";
  var TC = window.ToolCommon;
  var form = document.getElementById("pdf-form");
  if (!form) return;
  var input = form.querySelector('input[type="file"]');
  var list = form.querySelector("[data-file-list]");
  var files = [];
  var nextId = 0;
  var maxFiles = Number(form.dataset.maxFiles || 20);
  var maxBytes = Number(form.dataset.maxBytes || 20971520);
  TC.initDropZone(form.querySelector("[data-dropzone]"), input);

  function move(from, to) {
    if (to < 0 || to >= files.length) return;
    var item = files.splice(from, 1)[0];
    files.splice(to, 0, item);
    render();
  }

  async function loadPreview(item) {
    if (item.loading || item.preview) return;
    item.loading = true;
    item.previewError = "";
    render();
    var body = new FormData();
    body.append("pdf", item.file);
    body.append("limit", "8");
    try {
      var response = await fetch("/api/pdf/preview", { method: "POST", body: body, headers: { "X-CSRFToken": (document.querySelector('meta[name="csrf-token"]') || {}).content || "", "X-Requested-With": "Toolbox" } });
      var payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Unable to render preview.");
      item.preview = payload;
    } catch (error) {
      item.previewError = error.message;
    } finally {
      item.loading = false;
      render();
    }
  }

  function control(label, ariaLabel, handler, disabled) {
    var element = document.createElement("button");
    element.type = "button";
    element.className = "btn btn-ghost";
    element.textContent = label;
    element.setAttribute("aria-label", ariaLabel);
    element.disabled = Boolean(disabled);
    element.addEventListener("click", handler);
    return element;
  }

  function render() {
    list.innerHTML = "";
    files.forEach(function (item, index) {
      var row = document.createElement("li");
      row.className = "file-list-item pdf-merge-file";
      row.draggable = true;
      row.dataset.index = index;
      var head = document.createElement("div");
      head.className = "pdf-merge-file-head";
      var grip = document.createElement("span");
      grip.className = "pdf-file-grip";
      grip.textContent = String(index + 1);
      grip.setAttribute("aria-hidden", "true");
      var info = document.createElement("div");
      info.className = "pdf-merge-file-info";
      var name = document.createElement("strong");
      name.className = "file-name";
      name.textContent = item.file.name;
      var meta = document.createElement("span");
      meta.className = "muted";
      meta.textContent = TC.humanSize(item.file.size) + (item.preview ? " - " + item.preview.page_count + (item.preview.page_count === 1 ? " page" : " pages") : "");
      info.append(name, meta);
      var controls = document.createElement("div");
      controls.className = "file-controls";
      var expand = control(item.loading ? "Loading..." : item.expanded ? "Hide pages" : "Show pages", (item.expanded ? "Hide" : "Show") + " pages for " + item.file.name, function () {
        item.expanded = !item.expanded;
        if (item.expanded && !item.preview) loadPreview(item); else render();
      }, item.loading);
      expand.classList.add("btn-secondary");
      controls.append(expand);
      controls.append(control("Up", "Move " + item.file.name + " up", function () { move(index, index - 1); }, index === 0));
      controls.append(control("Down", "Move " + item.file.name + " down", function () { move(index, index + 1); }, index === files.length - 1));
      controls.append(control("Remove", "Remove " + item.file.name, function () { files = files.filter(function (other) { return other.id !== item.id; }); render(); }));
      head.append(grip, info, controls);
      row.appendChild(head);

      if (item.previewError) {
        var error = document.createElement("p");
        error.className = "alert alert-error";
        error.textContent = item.previewError;
        row.appendChild(error);
      }
      if (item.expanded && item.preview) {
        var preview = document.createElement("div");
        preview.className = "pdf-merge-preview";
        item.preview.pages.forEach(function (page) {
          var figure = document.createElement("figure");
          var image = document.createElement("img");
          image.src = page.data_url;
          image.alt = "Preview of page " + page.number + " in " + item.file.name;
          image.width = page.width;
          image.height = page.height;
          var caption = document.createElement("figcaption");
          caption.textContent = "Page " + page.number;
          figure.append(image, caption);
          preview.appendChild(figure);
        });
        if (item.preview.truncated) {
          var note = document.createElement("p");
          note.className = "muted";
          note.textContent = "Showing the first " + item.preview.rendered_count + " of " + item.preview.page_count + " pages.";
          preview.appendChild(note);
        }
        row.appendChild(preview);
      }
      row.addEventListener("dragstart", function (event) { event.dataTransfer.effectAllowed = "move"; event.dataTransfer.setData("text/plain", String(index)); row.classList.add("dragging"); });
      row.addEventListener("dragend", function () { row.classList.remove("dragging"); });
      list.appendChild(row);
    });
  }

  input.addEventListener("change", function () {
    TC.hideError();
    Array.prototype.forEach.call(input.files || [], function (file) {
      if (!file.name.toLowerCase().endsWith(".pdf")) return TC.showError("Choose files with a .pdf extension.");
      if (file.size > maxBytes) return TC.showError(file.name + " exceeds the per-file limit.");
      if (files.length >= maxFiles) return TC.showError("You can merge up to " + maxFiles + " files.");
      files.push({ id: nextId++, file: file, expanded: false, preview: null, loading: false });
    });
    input.value = "";
    render();
  });
  list.addEventListener("dragover", function (event) { event.preventDefault(); });
  list.addEventListener("drop", function (event) {
    event.preventDefault();
    var target = event.target.closest(".pdf-merge-file");
    if (target) move(Number(event.dataTransfer.getData("text/plain")), Number(target.dataset.index));
  });
  form.addEventListener("submit", async function (event) {
    event.preventDefault();
    if (files.length < 2) return TC.showError("Add at least two PDF files.");
    var body = new FormData();
    files.forEach(function (item) { body.append("files", item.file); });
    var blob = await TC.submitForm(form, "/tools/pdf-merger/merge", { body: body });
    if (blob) TC.setDownload(blob, "merged-pdf.pdf");
  });
  function resetAll() { files = []; nextId = 0; form.reset(); render(); TC.resetTool(); }
  form.querySelector("[data-reset]").addEventListener("click", resetAll);
  var again = document.querySelector("[data-start-again]");
  if (again) again.addEventListener("click", resetAll);
})();
