(function () {
  "use strict";

  function button(label, className, title) {
    var element = document.createElement("button");
    element.type = "button";
    element.className = className;
    element.textContent = label;
    if (title) element.setAttribute("aria-label", title);
    return element;
  }

  function PdfPageManager(root, input, options) {
    this.root = root;
    this.input = input;
    this.mode = (options || {}).mode || root.dataset.mode || "extract-pdf-pages";
    this.limit = (options || {}).limit || "";
    this.pages = [];
    this.pageCount = 0;
    this.draggedNumber = null;
    this.requestId = 0;
    this.grid = root.querySelector("[data-page-grid]");
    this.summary = root.querySelector("[data-pdf-summary]");
    this.status = root.querySelector("[data-selection-status]");
    this.loading = root.querySelector("[data-preview-loading]");
    this.limitNotice = root.querySelector("[data-preview-limit]");
    this.pagesInput = document.getElementById("pages");
    this.rotationsInput = document.getElementById("rotations");
    this.bind();
  }

  PdfPageManager.prototype.bind = function () {
    var manager = this;
    this.input.addEventListener("change", function () {
      var file = manager.input.files && manager.input.files[0];
      if (file) manager.load(file); else manager.reset();
    });
    var selectAll = this.root.querySelector("[data-pages-select-all]");
    var clear = this.root.querySelector("[data-pages-clear]");
    if (selectAll) selectAll.addEventListener("click", function () {
      manager.pages.forEach(function (page) { page.selected = true; });
      manager.render();
      if (manager.mode === "pdf-splitter") {
        var splitMode = document.getElementById("split-mode");
        manager.root.hidden = Boolean(splitMode && splitMode.value !== "selected");
      }
    });
    if (clear) clear.addEventListener("click", function () {
      manager.pages.forEach(function (page) { page.selected = false; });
      manager.render();
    });
    this.root.querySelectorAll("[data-rotate-selected]").forEach(function (control) {
      control.addEventListener("click", function () {
        var amount = Number(control.dataset.rotateSelected);
        manager.pages.forEach(function (page) {
          if (page.selected) page.rotation = (page.rotation + amount) % 360;
        });
        manager.render();
      });
    });
  };

  PdfPageManager.prototype.defaultSelected = function () {
    return this.mode !== "delete-pdf-pages" && this.mode !== "rotate-pdf";
  };

  PdfPageManager.prototype.load = async function (file) {
    var manager = this;
    var requestId = ++this.requestId;
    this.root.hidden = false;
    this.loading.hidden = false;
    this.grid.innerHTML = "";
    this.status.textContent = "";
    var body = new FormData();
    body.append("pdf", file);
    if (this.limit) body.append("limit", String(this.limit));
    try {
      var response = await fetch("/api/pdf/preview", {
        method: "POST",
        body: body,
        headers: {
          "X-CSRFToken": (document.querySelector('meta[name="csrf-token"]') || {}).content || "",
          "X-Requested-With": "Toolbox"
        }
      });
      var payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Unable to render this PDF.");
      if (requestId !== manager.requestId) return;
      manager.pageCount = payload.page_count;
      manager.pages = payload.pages.map(function (page) {
        return {
          number: page.number,
          image: page.data_url,
          width: page.width,
          height: page.height,
          selected: manager.defaultSelected(),
          rotation: 0
        };
      });
      manager.summary.textContent = file.name + " - " + payload.page_count + (payload.page_count === 1 ? " page" : " pages") + " - " + window.ToolCommon.humanSize(file.size);
      manager.limitNotice.hidden = !payload.truncated;
      var rendered = manager.limitNotice.querySelector("[data-rendered-count]");
      if (rendered) rendered.textContent = payload.rendered_count;
      manager.render();
    } catch (error) {
      if (requestId !== manager.requestId) return;
      window.ToolCommon.showError(error.message);
      manager.reset();
    } finally {
      if (requestId === manager.requestId) manager.loading.hidden = true;
    }
  };

  PdfPageManager.prototype.toggle = function (page) {
    page.selected = !page.selected;
    this.render();
  };

  PdfPageManager.prototype.rotate = function (page, amount) {
    page.rotation = (page.rotation + amount + 360) % 360;
    page.selected = true;
    this.render();
  };

  PdfPageManager.prototype.move = function (fromNumber, toNumber) {
    var fromIndex = this.pages.findIndex(function (page) { return page.number === fromNumber; });
    var toIndex = this.pages.findIndex(function (page) { return page.number === toNumber; });
    if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return;
    var moved = this.pages.splice(fromIndex, 1)[0];
    this.pages.splice(toIndex, 0, moved);
    this.render();
  };

  PdfPageManager.prototype.card = function (page) {
    var manager = this;
    var card = document.createElement("article");
    card.className = "pdf-page-card" + (page.selected ? " is-selected" : "");
    card.setAttribute("role", "listitem");
    card.setAttribute("aria-label", "Page " + page.number + (page.selected ? ", selected" : ", not selected"));
    card.dataset.pageNumber = page.number;
    var canReorder = ["reorder-pdf-pages", "extract-pdf-pages", "pdf-splitter"].indexOf(this.mode) !== -1;
    if (canReorder) {
      card.draggable = true;
      card.addEventListener("dragstart", function (event) {
        manager.draggedNumber = page.number;
        card.classList.add("dragging");
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", String(page.number));
      });
      card.addEventListener("dragend", function () { card.classList.remove("dragging"); });
      card.addEventListener("dragover", function (event) { event.preventDefault(); event.dataTransfer.dropEffect = "move"; });
      card.addEventListener("drop", function (event) {
        event.preventDefault();
        manager.move(Number(event.dataTransfer.getData("text/plain") || manager.draggedNumber), page.number);
      });
    }

    var imageWrap = document.createElement("div");
    imageWrap.className = "pdf-page-image-wrap";
    var image = document.createElement("img");
    image.src = page.image;
    image.alt = "Preview of PDF page " + page.number;
    image.width = page.width;
    image.height = page.height;
    image.loading = "lazy";
    image.style.transform = "rotate(" + page.rotation + "deg)";
    imageWrap.appendChild(image);

    var heading = document.createElement("div");
    heading.className = "pdf-page-card-heading";
    var pageLabel = document.createElement("strong");
    pageLabel.textContent = "Page " + page.number;
    var selectedLabel = document.createElement("span");
    selectedLabel.className = "pdf-selected-label";
    if (this.mode === "delete-pdf-pages") selectedLabel.textContent = page.selected ? "Delete" : "Keep";
    else if (this.mode === "rotate-pdf" && page.rotation) selectedLabel.textContent = "Rotated " + page.rotation + " degrees";
    else selectedLabel.textContent = page.selected ? "Selected" : "Not selected";
    heading.append(pageLabel, selectedLabel);

    var controls = document.createElement("div");
    controls.className = "pdf-page-controls";
    var selectLabel = this.mode === "delete-pdf-pages" ? (page.selected ? "Keep page" : "Delete page") : (page.selected ? "Remove from selection" : "Select page");
    var select = button(this.mode === "delete-pdf-pages" ? (page.selected ? "Undo delete" : "Delete") : (page.selected ? "Selected" : "Select"), "btn btn-page-select", selectLabel + " " + page.number);
    select.setAttribute("aria-pressed", page.selected ? "true" : "false");
    select.addEventListener("click", function () { manager.toggle(page); });
    controls.appendChild(select);
    if (this.mode === "rotate-pdf") {
      var left = button("Left", "btn btn-ghost", "Rotate page " + page.number + " counterclockwise");
      var right = button("Right", "btn btn-ghost", "Rotate page " + page.number + " clockwise");
      left.addEventListener("click", function () { manager.rotate(page, -90); });
      right.addEventListener("click", function () { manager.rotate(page, 90); });
      controls.append(left, right);
    }
    if (canReorder) {
      var handle = document.createElement("span");
      handle.className = "pdf-drag-handle";
      handle.textContent = "Drag to set output order";
      controls.appendChild(handle);
    }
    card.append(imageWrap, heading, controls);
    return card;
  };

  PdfPageManager.prototype.syncInputs = function () {
    var selected = this.pages.filter(function (page) { return page.selected; });
    if (this.pagesInput && this.mode !== "rotate-pdf") this.pagesInput.value = selected.map(function (page) { return page.number; }).join(",");
    if (this.rotationsInput) {
      var rotations = {};
      this.pages.forEach(function (page) { if (page.rotation) rotations[page.number] = page.rotation; });
      this.rotationsInput.value = Object.keys(rotations).length ? JSON.stringify(rotations) : "";
    }
    var action = this.mode === "delete-pdf-pages" ? "marked for deletion" : "selected";
    this.status.textContent = selected.length + " of " + this.pages.length + " previewed pages " + action + ".";
  };

  PdfPageManager.prototype.render = function () {
    var manager = this;
    this.grid.innerHTML = "";
    this.pages.forEach(function (page) { manager.grid.appendChild(manager.card(page)); });
    this.syncInputs();
  };

  PdfPageManager.prototype.reset = function () {
    this.requestId += 1;
    this.pages = [];
    this.pageCount = 0;
    this.grid.innerHTML = "";
    this.summary.textContent = "";
    this.status.textContent = "";
    this.limitNotice.hidden = true;
    this.loading.hidden = true;
    this.root.hidden = true;
    if (this.rotationsInput) this.rotationsInput.value = "";
  };

  window.PdfPageManager = PdfPageManager;
})();
