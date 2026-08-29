/**
 * tool-common.js — Shared utilities for Toolbox tool pages.
 *
 * Provides:
 *  - submitForm(form, url, options)  AJAX form submission returning blob or JSON error
 *  - initDropZone(dropzone, input)   drag-and-drop highlighting
 *  - showLoading / hideLoading       toggle the loading spinner
 *  - showError / hideError           toggle the error alert
 *  - showResult / hideResult         toggle the result panel
 *  - resetTool()                     return to initial state
 */

(function () {
  "use strict";

  /* ---- DOM helpers ---- */

  function $(sel, root) {
    return (root || document).querySelector(sel);
  }

  function show(el) {
    if (el) el.hidden = false;
  }

  function hide(el) {
    if (el) el.hidden = true;
  }

  var activeObjectUrls = [];

  function rememberObjectUrl(url) {
    activeObjectUrls.push(url);
    return url;
  }

  function revokeObjectUrls() {
    activeObjectUrls.forEach(function (url) {
      URL.revokeObjectURL(url);
    });
    activeObjectUrls = [];
  }

  /* ---- State management ---- */

  function showLoading() {
    hide($("[data-error]"));
    hide($("[data-result]"));
    show($("[data-loading]"));
    var btn = $("[data-submit]");
    if (btn) btn.disabled = true;
    var form = $("[data-tool-form]");
    if (form) form.setAttribute("aria-busy", "true");
  }

  function hideLoading() {
    hide($("[data-loading]"));
    var btn = $("[data-submit]");
    if (btn) btn.disabled = false;
    var form = $("[data-tool-form]");
    if (form) form.setAttribute("aria-busy", "false");
  }

  function showError(message) {
    hideLoading();
    var el = $("[data-error]");
    if (el) {
      el.textContent = message;
      show(el);
    }
  }

  function hideError() {
    hide($("[data-error]"));
  }

  function showResult() {
    hideLoading();
    hideError();
    show($("[data-result]"));
  }

  function hideResult() {
    hide($("[data-result]"));
  }

  function resetTool() {
    revokeObjectUrls();
    hideLoading();
    hideError();
    hideResult();
    var preview = $("[data-preview]");
    if (preview) preview.removeAttribute("src");
    var download = $("[data-download]");
    if (download) download.removeAttribute("href");
    var audio = $("[data-audio]");
    if (audio) {
      audio.removeAttribute("src");
      audio.load();
    }
  }

  /* ---- Form submission ---- */

  /**
   * Submit a form via fetch. Returns the response blob on success.
   * On error (JSON body with {error}), calls showError automatically.
   *
   * @param {HTMLFormElement} form
   * @param {string} url        POST endpoint
   * @param {object} options
   * @param {FormData} [options.body]  Custom FormData (overrides form)
   * @returns {Promise<Blob|null>}
   */
  async function submitForm(form, url, options) {
    options = options || {};
    if (form.dataset.submitting === "true") return null;
    form.dataset.submitting = "true";
    showLoading();

    var body = options.body || new FormData(form);

    try {
      var response = await fetch(url, {
        method: "POST",
        body: body,
        headers: {
          "X-CSRFToken": (($('meta[name="csrf-token"]') || {}).content || ""),
          "X-Requested-With": "Toolbox",
        },
      });

      if (!response.ok) {
        var contentType = response.headers.get("content-type") || "";
        if (contentType.indexOf("application/json") !== -1) {
          var json = await response.json();
          showError(json.error || "Something went wrong. Please try again.");
        } else {
          showError("Something went wrong. Please try again.");
        }
        return null;
      }

      var blob = await response.blob();
      hideLoading();
      return blob;
    } catch (err) {
      showError("Network error. Please check your connection and try again.");
      return null;
    } finally {
      delete form.dataset.submitting;
    }
  }

  /**
   * Set preview image and download link from a blob.
   */
  function setPreview(blob, filename) {
    revokeObjectUrls();
    var objectUrl = rememberObjectUrl(URL.createObjectURL(blob));
    var preview = $("[data-preview]");
    if (preview) preview.src = objectUrl;
    var download = $("[data-download]");
    if (download) {
      download.href = objectUrl;
      if (filename) download.download = filename;
    }
    showResult();
  }

  /**
   * Set audio player and download link from a blob.
   */
  function setAudio(blob, filename) {
    revokeObjectUrls();
    var objectUrl = rememberObjectUrl(URL.createObjectURL(blob));
    var audio = $("[data-audio]");
    if (audio) {
      audio.src = objectUrl;
      audio.load();
    }
    var download = $("[data-download]");
    if (download) {
      download.href = objectUrl;
      if (filename) download.download = filename;
    }
    showResult();
  }

  /**
   * Set download link from a blob (no preview).
   */
  function setDownload(blob, filename) {
    revokeObjectUrls();
    var objectUrl = rememberObjectUrl(URL.createObjectURL(blob));
    var download = $("[data-download]");
    if (download) {
      download.href = objectUrl;
      if (filename) download.download = filename;
    }
    showResult();
  }

  /* ---- Drag-and-drop zone ---- */

  function initDropZone(zone, input) {
    if (!zone || !input) return;

    zone.addEventListener("click", function (event) {
      if (event.target !== input && !event.target.closest("button, a, label")) {
        input.click();
      }
    });

    zone.addEventListener("dragover", function (e) {
      e.preventDefault();
      zone.classList.add("is-dragover");
    });

    zone.addEventListener("dragleave", function () {
      zone.classList.remove("is-dragover");
    });

    zone.addEventListener("drop", function (e) {
      e.preventDefault();
      zone.classList.remove("is-dragover");
      if (e.dataTransfer.files.length) {
        input.files = e.dataTransfer.files;
        input.dispatchEvent(new Event("change", { bubbles: true }));
      }
    });
  }

  /* ---- Human-readable file size ---- */

  function humanSize(bytes) {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  }

  function initCharacterCounter(input, output) {
    if (!input || !output) return;
    function update() {
      output.textContent = input.value.length;
    }
    input.addEventListener("input", update);
    update();
  }

  /* ---- Public API ---- */

  window.ToolCommon = {
    $: $,
    show: show,
    hide: hide,
    showLoading: showLoading,
    hideLoading: hideLoading,
    showError: showError,
    hideError: hideError,
    showResult: showResult,
    hideResult: hideResult,
    resetTool: resetTool,
    submitForm: submitForm,
    setPreview: setPreview,
    setAudio: setAudio,
    setDownload: setDownload,
    initDropZone: initDropZone,
    humanSize: humanSize,
    initCharacterCounter: initCharacterCounter,
  };
})();
