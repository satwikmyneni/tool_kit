(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.ClientCommon = api;
})(typeof window !== "undefined" ? window : null, function () {
  "use strict";

  function escapeHTML(value) {
    return String(value).replace(/[&<>'"]/g, function (char) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char];
    });
  }

  function secureUint32() {
    var cryptoObject = typeof crypto !== "undefined" ? crypto : null;
    if (!cryptoObject || !cryptoObject.getRandomValues) throw new Error("Secure randomness is unavailable in this browser.");
    var values = new Uint32Array(1);
    cryptoObject.getRandomValues(values);
    return values[0];
  }

  function secureInt(min, max) {
    min = Math.ceil(Number(min));
    max = Math.floor(Number(max));
    if (!Number.isSafeInteger(min) || !Number.isSafeInteger(max) || max < min) throw new Error("Enter a valid integer range.");
    var range = max - min + 1;
    if (range > 0x100000000) throw new Error("The range is too large.");
    var limit = Math.floor(0x100000000 / range) * range;
    var value;
    do { value = secureUint32(); } while (value >= limit);
    return min + (value % range);
  }

  function secureChoice(items) {
    if (!Array.isArray(items) || !items.length) throw new Error("Add at least one option.");
    return items[secureInt(0, items.length - 1)];
  }

  function readJSON(key, fallback) {
    try {
      var value = JSON.parse(localStorage.getItem(key));
      return value === null ? fallback : value;
    } catch (_error) { return fallback; }
  }

  function writeJSON(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); return true; }
    catch (_error) { return false; }
  }

  function formatNumber(value, digits) {
    if (!Number.isFinite(value)) throw new Error("The result is outside the supported range.");
    return new Intl.NumberFormat(undefined, { maximumFractionDigits: digits === undefined ? 4 : digits }).format(value);
  }

  function initialize() {
    if (typeof document === "undefined") return null;
    var root = document.querySelector("[data-client-tool]");
    if (!root) return null;
    var app = root.querySelector("[data-client-app]");
    var result = root.querySelector("[data-client-result]");
    var error = root.querySelector("[data-client-error]");
    function clearState() {
      if (result) { result.hidden = true; result.innerHTML = ""; }
      if (error) { error.hidden = true; error.textContent = ""; }
    }
    function showError(message) {
      clearState();
      if (error) { error.textContent = message || "Check the values and try again."; error.hidden = false; }
      if (window.ToolboxAnalytics) window.ToolboxAnalytics.track("error", { tool: root.dataset.toolSlug });
    }
    function showHTML(html) {
      clearState();
      result.innerHTML = html;
      result.hidden = false;
      if (window.ToolboxAnalytics) window.ToolboxAnalytics.track("tool_complete", { tool: root.dataset.toolSlug });
    }
    function showText(text, label) {
      clearState();
      var heading = document.createElement("h2");
      heading.textContent = label || "Result";
      var output = document.createElement("pre");
      output.className = "client-tool-output";
      output.textContent = String(text);
      result.appendChild(heading);
      result.appendChild(output);
      result.hidden = false;
      if (window.ToolboxAnalytics) window.ToolboxAnalytics.track("tool_complete", { tool: root.dataset.toolSlug });
    }
    return { root: root, app: app, result: result, error: error, slug: root.dataset.toolSlug, clear: clearState, showError: showError, showHTML: showHTML, showText: showText };
  }

  function copyText(text, button) {
    if (!navigator.clipboard) return Promise.reject(new Error("Clipboard access is unavailable."));
    return navigator.clipboard.writeText(String(text)).then(function () {
      if (button) {
        var old = button.textContent;
        button.textContent = "Copied";
        setTimeout(function () { button.textContent = old; }, 1200);
      }
    });
  }

  return {
    escapeHTML: escapeHTML,
    secureInt: secureInt,
    secureChoice: secureChoice,
    readJSON: readJSON,
    writeJSON: writeJSON,
    formatNumber: formatNumber,
    initialize: initialize,
    copyText: copyText
  };
});
